-- 출석 기본 XP + 보드 키(선택) (2026-09-22)
--
-- 1. 출석 기본 XP
--   어제(09-21) 만든 운동시간 규칙은 "종료를 안 누르면 50분으로 기록"인데, XP 는 종료를 눌러야만
--   나갔다(finish_workout_session). 실제로 종료를 누른 회원은 0명 — 즉 얼굴 출석 XP 가 0 이었다.
--   대표님 지시: 얼굴 출석과 QR 출석 모두 시간에 비례해 XP 를 준다.
--   → 출석 행이 생기는 순간 50분치(workout_xp(50)=5)를 바로 주고, 종료를 누르면
--     실제 시간 XP 와의 차액만 더 준다. 어느 경로(브로제이 동기화·QR)로 들어와도 같다.
--   보호장치:
--     · is_duplicate 행·직원·member_progress 없는 계정은 제외
--     · 3일보다 오래된 checked_in_at 은 제외 — 과거 백필이 XP 를 뿌리지 않게
--     · 옛 qr-checkin Edge Function(method='qr', 자체 +10 XP)은 제외 — 이중 지급 방지
--     · xp_granted 가 이미 0 보다 크면 제외
--
-- 2. 보드 키 (선택, 기본 꺼짐)
--   get_board_qr_token 은 비로그인 TV 가 부르므로 누구나 부를 수 있다 → 기술 있는 회원이 집에서
--   토큰을 받아 출석을 만들 수 있다. internal_sync_config 에 'board_key:<지점명>' 을 넣으면
--   그 지점은 키가 맞는 TV 에만 토큰을 준다. 키가 없으면 지금처럼 열려 있다(끊김 없이 도입).
--   TV 는 /tv/<코드>?k=<키> 를 한 번 열면 localStorage 에 저장한다(LiveBoardQrCard).

-- ── 1-a. 출석 기본 XP 트리거 ────────────────────────────────────────────────
create or replace function public.attendance_base_xp_trg()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _base  int;
  _staff boolean;
begin
  if new.user_id is null then return null; end if;
  if new.checked_in_at is null or new.checked_in_at < now() - interval '3 days' then return null; end if;
  if coalesce(new.xp_granted, 0) > 0 then return null; end if;

  select coalesce(is_staff, false) into _staff from public.profiles where user_id = new.user_id;
  if coalesce(_staff, false) then return null; end if;
  if not exists (select 1 from public.member_progress where user_id = new.user_id) then return null; end if;

  _base := public.workout_xp(public.workout_default_minutes());
  if _base <= 0 then return null; end if;

  insert into public.xp_logs (user_id, amount, reason)
  values (new.user_id, _base, '운동 출석 (기본 ' || public.workout_default_minutes() || '분)');
  update public.member_progress set total_xp = total_xp + _base where user_id = new.user_id;
  update public.attendance_logs set xp_granted = _base where id = new.id;
  return null;
end;
$$;
revoke all on function public.attendance_base_xp_trg() from public;

drop trigger if exists attendance_base_xp on public.attendance_logs;
create trigger attendance_base_xp
after insert on public.attendance_logs
for each row
when (new.is_duplicate is not true and new.method is distinct from 'qr')
execute function public.attendance_base_xp_trg();

-- ── 1-b. 종료 버튼: 실제 시간 XP 와 이미 받은 기본 XP 의 차액만 지급 ─────────
create or replace function public.finish_workout_session(p_at_gym boolean default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _uid       uuid := auth.uid();
  _today     date;
  _id        uuid;
  _started   timestamptz;
  _ended     timestamptz;
  _minutes   int;
  _xp_total  int;
  _xp_before int;
  _xp        int;
begin
  if _uid is null then
    return jsonb_build_object('success', false, 'error', '로그인이 필요합니다.');
  end if;

  _today := (now() at time zone 'Asia/Seoul')::date;

  -- 오늘의 정식 출석 한 건. 여러 번 찍혔다면 가장 이른 것이 실제 입장이다.
  -- 오늘로 한정하는 것이 핵심 — 어제 열린 세션을 오늘 닫으면 24시간 기록이 나온다.
  select id, checked_in_at, ended_at, coalesce(xp_granted, 0)
    into _id, _started, _ended, _xp_before
  from public.attendance_logs
  where user_id = _uid
    and coalesce(is_duplicate, false) = false
    and (checked_in_at at time zone 'Asia/Seoul')::date = _today
  order by checked_in_at asc
  limit 1;

  if _id is null then
    return jsonb_build_object('success', false,
      'error', '오늘 출석 기록이 없습니다. 입구에서 얼굴 인식을 먼저 해주세요.');
  end if;

  if _ended is not null then
    return jsonb_build_object('success', true, 'already_finished', true,
      'minutes', public.workout_minutes(_started, _ended), 'xp_granted', 0);
  end if;

  -- ended_at is null 조건이 멱등키 역할을 한다. 동시에 두 번 눌려도 한 번만 닫히고
  -- 닫은 호출만 XP 를 받는다(xp_logs 에 멱등키 컬럼이 없어 이 방식을 쓴다).
  update public.attendance_logs
     set ended_at        = now(),
         ended_source    = 'member_app',
         at_gym_verified = p_at_gym
   where id = _id
     and ended_at is null;

  if not found then
    return jsonb_build_object('success', true, 'already_finished', true, 'xp_granted', 0);
  end if;

  select ended_at into _ended from public.attendance_logs where id = _id;
  _minutes  := public.workout_minutes(_started, _ended);
  _xp_total := public.workout_xp(_minutes);
  -- 출석 때 이미 받은 기본(50분치)을 빼고 남는 만큼만 — 50분 이하면 0.
  _xp       := greatest(0, _xp_total - _xp_before);

  if _xp > 0 then
    insert into public.xp_logs (user_id, amount, reason)
    values (_uid, _xp, '운동시간 ' || _minutes || '분 기록 (추가)');
    update public.member_progress
       set total_xp = total_xp + _xp
     where user_id = _uid;
    update public.attendance_logs
       set xp_granted = _xp_before + _xp
     where id = _id;
  end if;

  return jsonb_build_object(
    'success', true, 'minutes', _minutes, 'xp_granted', _xp,
    'xp_total_today', _xp_before + _xp,
    'at_gym_verified', p_at_gym);
end;
$$;

-- ── 1-c. QR 수동 출석: 트리거가 준 기본 XP 를 그대로 돌려준다 ──────────────
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
  _xp int := 0;
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

  -- 기본 XP 는 attendance_base_xp 트리거가 준다 (얼굴 출석과 같은 경로·같은 액수)
  insert into public.attendance_logs
    (user_id, branch_name, method, checked_in_at, xp_granted, is_duplicate,
     display_name_snapshot, league_snapshot, level_snapshot, source_ref)
  values
    (_uid, _name, 'qr_manual', _now, 0, false,
     _display, coalesce(_prog.current_rank::text, 'white'), coalesce(_prog.current_level, 1),
     'qr:' || gen_random_uuid()::text)
  returning id into _id;

  select coalesce(xp_granted, 0) into _xp from public.attendance_logs where id = _id;

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
    'xp_granted', _xp,
    'message', '출석 완료! 라이브보드에 곧 표시돼요');
end;
$$;
revoke all on function public.qr_manual_checkin(text, text) from public;
grant execute on function public.qr_manual_checkin(text, text) to authenticated;

-- ── 2. 보드 키(선택) — 지점에 키가 등록돼 있으면 그 키를 가진 TV 에만 토큰을 준다 ─
drop function if exists public.get_board_qr_token(text);

create or replace function public.get_board_qr_token(p_branch text, p_key text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  _name text;
  _code text;
  _required text;
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

  -- 지점 키가 등록된 경우에만 검사. 없으면 열림(기본).
  select value into _required from public.internal_sync_config where key = 'board_key:' || _name;
  if _required is not null and _required <> '' and (p_key is null or p_key <> _required) then
    return jsonb_build_object('ok', false, 'error', 'board_key_required', 'branch', _name);
  end if;

  _epoch  := floor(extract(epoch from now()))::bigint;
  _bucket := _epoch / 300;

  return jsonb_build_object(
    'ok', true,
    'branch', _name,
    'code', _code,
    'token', public._board_qr_token_for(_name, _bucket),
    'expires_in_sec', 300 - (_epoch % 300),
    'rotate_sec', 300,
    'locked', _required is not null and _required <> ''
  );
end;
$$;
revoke all on function public.get_board_qr_token(text, text) from public;
grant execute on function public.get_board_qr_token(text, text) to anon, authenticated;

-- ── 3. 오늘(2026-09-22 KST) 이미 들어온 얼굴 출석에 기본 XP 백필 ──────────────
--   트리거가 생기기 전에 들어온 오늘 행. 날짜를 박아 두어 다른 환경에서 다시 돌아도 그날만 본다.
do $$
declare
  _base int := public.workout_xp(public.workout_default_minutes());
  r record;
begin
  for r in
    select a.id, a.user_id
      from public.attendance_logs a
      join public.profiles p on p.user_id = a.user_id and coalesce(p.is_staff, false) = false
      join public.member_progress m on m.user_id = a.user_id
     where a.checked_in_at >= timestamptz '2026-09-22 00:00:00+09'
       and a.checked_in_at <  timestamptz '2026-09-23 00:00:00+09'
       and coalesce(a.is_duplicate, false) = false
       and coalesce(a.xp_granted, 0) = 0
       and a.method = 'broj'
  loop
    insert into public.xp_logs (user_id, amount, reason)
    values (r.user_id, _base, '운동 출석 (기본 ' || public.workout_default_minutes() || '분)');
    update public.member_progress set total_xp = total_xp + _base where user_id = r.user_id;
    update public.attendance_logs set xp_granted = _base where id = r.id;
  end loop;
end;
$$;
