-- 라이브보드 QR 수동 출석 (2026-09-22)
--
-- 왜 만들었나:
--   브로제이(얼굴 인식) 서버가 느려지면 출석이 라이브보드에 늦게 뜬다. 문은 얼굴 인식으로만
--   열리므로 "출석 자체"는 이미 되어 있다 — 부족한 건 보드 표시다. 그래서 보드에 QR을 항상
--   띄우고, 회원이 앱에서 그 QR을 스캔하면 출석 행을 바로 만든다.
--
-- 규칙:
--   · 토큰은 HMAC(지점|5분구간, 비밀키) — 저장하지 않고 계산한다. 5분마다 바뀌고 직전 구간까지
--     받아주므로 사진으로 찍어 나중에 쓰는 건 막힌다.
--   · 비밀키는 internal_sync_config (RLS on, anon/authenticated 권한 없음) 에 둔다.
--   · XP 0 — 브로제이 출석과 같다. 승급 카운트(auto_advance)는 같은 자격으로 인정한다.
--   · 하루 1행 — 오늘 이미 (얼굴/QR) 출석이 있으면 새 행을 만들지 않고 already=true 로 답한다.
--     나중에 도착하는 브로제이 행은 sync-broj-checkins 가 같은 날 기준으로 is_duplicate=true 로 넣는다.
--   · method='qr_manual' — 얼굴 기록이 끝내 안 붙은 QR 출석은 이 값으로 골라낼 수 있다.

-- 1) 비밀키 (없을 때만 생성)
insert into public.internal_sync_config (key, value, updated_at)
select 'board_qr_secret', encode(extensions.gen_random_bytes(32), 'hex'), now()
where not exists (select 1 from public.internal_sync_config where key = 'board_qr_secret');

-- 2) 토큰 계산 (내부 전용)
create or replace function public._board_qr_token_for(p_branch_name text, p_bucket bigint)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  _secret text;
begin
  select value into _secret from public.internal_sync_config where key = 'board_qr_secret';
  if _secret is null or length(_secret) < 32 then
    raise exception 'board_qr_secret 미설정';
  end if;
  return substr(encode(extensions.hmac(p_branch_name || '|' || p_bucket::text, _secret, 'sha256'), 'hex'), 1, 24);
end;
$$;
revoke all on function public._board_qr_token_for(text, bigint) from public;

-- 3) 보드(비로그인 TV)가 호출 — 지금 보여줄 토큰
create or replace function public.get_board_qr_token(p_branch text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  _name text;
  _code text;
  _epoch bigint;
  _bucket bigint;
begin
  select b.name, b.code into _name, _code
    from public.branches b
   where b.name = p_branch or (b.code is not null and b.code = p_branch)
   limit 1;
  if _name is null then
    return jsonb_build_object('ok', false, 'error', 'unknown_branch');
  end if;

  _epoch  := floor(extract(epoch from now()))::bigint;
  _bucket := _epoch / 300;

  return jsonb_build_object(
    'ok', true,
    'branch', _name,
    'code', _code,
    'token', public._board_qr_token_for(_name, _bucket),
    'expires_in_sec', 300 - (_epoch % 300),
    'rotate_sec', 300
  );
end;
$$;
revoke all on function public.get_board_qr_token(text) from public;
grant execute on function public.get_board_qr_token(text) to anon, authenticated;

-- 4) 회원이 앱에서 호출 — QR 수동 출석
create or replace function public.qr_manual_checkin(p_branch text, p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  _uid uuid := auth.uid();
  _name text;
  _epoch bigint;
  _bucket bigint;
  _prof record;
  _prog record;
  _mode text;
  _display text;
  _nm text;
  _nick text;
  _day_start timestamptz;
  _existing record;
  _id uuid;
  _now timestamptz := now();
begin
  if _uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_logged_in', 'message', '로그인이 필요해요');
  end if;

  select b.name into _name
    from public.branches b
   where b.name = p_branch or (b.code is not null and b.code = p_branch)
   limit 1;
  if _name is null then
    return jsonb_build_object('ok', false, 'error', 'unknown_branch', 'message', '알 수 없는 지점 QR이에요');
  end if;

  -- 토큰: 현재 5분 구간 또는 직전 구간 (화면이 막 바뀐 직후에 찍어도 통과)
  _epoch  := floor(extract(epoch from _now))::bigint;
  _bucket := _epoch / 300;
  if p_token is null or length(p_token) < 16
     or (p_token <> public._board_qr_token_for(_name, _bucket)
         and p_token <> public._board_qr_token_for(_name, _bucket - 1)) then
    return jsonb_build_object('ok', false, 'error', 'bad_token',
      'message', 'QR이 바뀌었어요. 화면의 QR을 다시 스캔해 주세요');
  end if;

  select user_id, nickname, name, is_staff into _prof
    from public.profiles where user_id = _uid;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_profile', 'message', '프로필을 찾을 수 없어요');
  end if;

  -- 같은 회원의 동시 탭 두 번 → 한 행만
  perform pg_advisory_xact_lock(hashtext('qr_manual:' || _uid::text));

  -- 오늘(KST) 이미 출석이 있으면 새 행 없이 알려준다
  _day_start := (date_trunc('day', _now at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul';
  select id, checked_in_at, method, branch_name into _existing
    from public.attendance_logs
   where user_id = _uid
     and coalesce(is_duplicate, false) = false
     and checked_in_at >= _day_start
   order by checked_in_at asc
   limit 1;
  if found then
    return jsonb_build_object('ok', true, 'already', true,
      'branch', _existing.branch_name,
      'checked_in_at', _existing.checked_in_at,
      'method', _existing.method,
      'message', '오늘 출석은 이미 반영되어 있어요');
  end if;

  -- 표시명 — sync-broj-checkins 와 같은 규칙 (masked_name: 첫 글자 + O 반복)
  select display_name_mode into _mode
    from public.branch_display_settings where branch_name = _name;
  _nm   := nullif(trim(coalesce(_prof.name, '')), '');
  _nick := nullif(trim(coalesce(_prof.nickname, '')), '');
  if coalesce(_mode, 'nickname') = 'masked_name' then
    _display := coalesce(_nm, _nick, '회원');
    if length(_display) > 1 then
      _display := left(_display, 1) || repeat('O', length(_display) - 1);
    end if;
  elsif _mode = 'full_name' then
    _display := coalesce(_nm, _nick, '회원');
  else
    _display := coalesce(_nick, _nm, '회원');
  end if;

  select current_rank, current_level into _prog
    from public.member_progress where user_id = _uid;

  insert into public.attendance_logs
    (user_id, branch_name, method, checked_in_at, xp_granted, is_duplicate,
     display_name_snapshot, league_snapshot, level_snapshot, source_ref)
  values
    (_uid, _name, 'qr_manual', _now, 0, false,
     _display, coalesce(_prog.current_rank::text, 'white'), coalesce(_prog.current_level, 1),
     'qr:' || gen_random_uuid()::text)
  returning id into _id;

  -- 승급 검사 — 브로제이 출석과 같은 자격. 직원은 제외(출근이 승급으로 이어지면 안 된다).
  if coalesce(_prof.is_staff, false) = false then
    perform public.auto_advance_from_attendance(_uid);
  end if;

  return jsonb_build_object('ok', true, 'already', false,
    'id', _id,
    'branch', _name,
    'checked_in_at', _now,
    'display_name', _display,
    'staff', coalesce(_prof.is_staff, false),
    'xp_granted', 0,
    'message', '출석 완료! 라이브보드에 곧 표시돼요');
end;
$$;
revoke all on function public.qr_manual_checkin(text, text) from public;
grant execute on function public.qr_manual_checkin(text, text) to authenticated;
