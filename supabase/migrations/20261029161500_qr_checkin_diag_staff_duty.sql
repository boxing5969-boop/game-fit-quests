-- 칠금점 QR 출석 점검 (2026-10-29 대표님 "칠금점 회원들이 qr출석을 찍으면 프로필 카드가 안뜨고 오류나고
--   코치님들도 코치 스텝 칸에 이름이 떠야하는데 안뜬다고 하네 점검해줘")
--
-- 찾은 것:
--   1) 코치 칸 — TV 의 '지금 근무중인 코치'(public_staff_on_duty)는 출근부 staff_duty_logs 만 본다.
--      출근부는 브로제이 얼굴 출근(sync-broj-checkins)만 적는다. 칠금점은 브로제이가 없어 출근부가 0줄 →
--      지점장님이 QR 을 찍어도(출석 행은 생김) 코치 칸에 영원히 안 뜬다.
--   2) 회원 QR — 10/28 회원 2명이 7번 찍었는데 출석 행 0. 서버 함수는 그대로 잘 된다(지금 토큰으로 재현 → 성공).
--      실패 답은 'QR이 바뀌었어요'(지난 토큰) 하나뿐이라 회원이 찍은 QR 이 지금 TV QR 이 아니었다 —
--      어떤 QR 이었는지(몇 분 전 것인지) 남는 곳이 없어 더는 알 수 없다. 출석 없음 → TV 환영 카드도 없음.
--
-- 고친 것 (기존 함수 이름 · 인자 그대로, 동작만 덧붙임):
--   · qr_checkin_attempts — QR 출석 시도마다 결과 한 줄(누가 · 지점 · 결과 · 지난 QR 이면 몇 분 전 QR).
--     RLS 켬 · 정책 없음 · anon/authenticated 권한 없음 — SQL 편집기와 운영 점검만.
--   · 지난 QR 이면 몇 분 · 몇 시간 · 며칠 전 QR 인지 회원 폰에 알려 준다(사진 · 캡처 QR 구분).
--   · 토큰 비교를 소문자로 — 스캐너가 대문자로 바꿔 읽어도 통과.
--   · 직원(is_staff)이 QR 을 찍으면 그 지점 · 그날 출근부가 없을 때만 출근부 한 줄 → TV 코치 칸 · 153운영본부 근무 출근 시각.
--     얼굴 출근이 있는 지점은 얼굴 줄이 먼저 있으면 덧붙이지 않는다.
--   · 10/21(칠금 QR 출석 시작)부터 직원 QR 출석을 출근부로 한 번 옮긴다 — 오늘 지점장님이 바로 코치 칸에 뜬다.

-- ───────────────────────── 시도 기록 ─────────────────────────
create table if not exists public.qr_checkin_attempts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid,
  branch_name text,
  result text not null,          -- ok · already · bad_token · unknown_branch · no_profile · not_logged_in
  token_age_min integer,         -- bad_token 이고 7일 안의 QR 이면 그 QR 이 나온 지 몇 분
  is_staff boolean not null default false
);
create index if not exists qr_checkin_attempts_created_idx on public.qr_checkin_attempts (created_at desc);
alter table public.qr_checkin_attempts enable row level security;
revoke all on public.qr_checkin_attempts from anon, authenticated;

create or replace function public._qr_attempt_log(p_uid uuid, p_branch text, p_result text, p_age integer, p_staff boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.qr_checkin_attempts (user_id, branch_name, result, token_age_min, is_staff)
  values (p_uid, p_branch, p_result, p_age, coalesce(p_staff, false));
exception when others then
  raise warning '_qr_attempt_log: %', sqlerrm; -- 기록은 부가 기능 — 출석을 막지 않는다
end $$;
revoke all on function public._qr_attempt_log(uuid, text, text, integer, boolean) from public, anon, authenticated;

-- 지난 토큰이면 몇 분 전 QR 인지 (7일 = 2016 구간까지). 모르면 null.
create or replace function public._board_qr_token_age_min(p_branch_name text, p_token text, p_now timestamptz)
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  _secret text;
  _epoch bigint := floor(extract(epoch from p_now))::bigint;
  _bucket bigint := floor(extract(epoch from p_now))::bigint / 300;
  _t text := lower(coalesce(p_token, ''));
  k int;
begin
  if length(_t) <> 24 then return null; end if;
  select value into _secret from public.internal_sync_config where key = 'board_qr_secret';
  if _secret is null or length(_secret) < 32 then return null; end if;
  for k in 2..2016 loop
    if substr(encode(extensions.hmac(p_branch_name || '|' || (_bucket - k)::text, _secret, 'sha256'), 'hex'), 1, 24) = _t then
      return ((_epoch - (_bucket - k) * 300) / 60)::int;
    end if;
  end loop;
  return null;
end $$;
revoke all on function public._board_qr_token_age_min(text, text, timestamptz) from public, anon, authenticated;

-- 직원 QR → 출근부 (그 지점 · 그날 줄이 없을 때만)
create or replace function public._qr_staff_duty(p_uid uuid, p_branch text, p_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _day date := (p_at at time zone 'Asia/Seoul')::date;
  _p record;
  _digits text;
begin
  select name, nickname, phone_number into _p from public.profiles where user_id = p_uid;
  _digits := coalesce(nullif(regexp_replace(coalesce(_p.phone_number, ''), '\D', '', 'g'), ''), 'app:' || p_uid::text);
  if exists (select 1 from public.staff_duty_logs d
              where d.branch_name = p_branch and d.attend_date = _day
                and (d.user_id = p_uid or d.phone_digits = _digits)) then
    return;
  end if;
  insert into public.staff_duty_logs (source_ref, branch_name, phone_digits, staff_name, user_id, checked_in_at, attend_date)
  values ('qr:' || md5(p_uid::text || '|' || p_branch || '|' || _day::text), p_branch, _digits,
          coalesce(nullif(btrim(_p.name), ''), nullif(btrim(_p.nickname), ''), '코치'),
          p_uid, p_at, _day)
  on conflict (source_ref) do nothing;
exception when others then
  raise warning '_qr_staff_duty: %', sqlerrm; -- 출근부는 부가 기능 — 출석을 막지 않는다
end $$;
revoke all on function public._qr_staff_duty(uuid, text, timestamptz) from public, anon, authenticated;

-- ───────────────────────── QR 출석 (인자 · 규칙 그대로 + 기록 · 출근부 · 지난 QR 안내) ─────────────────────────
create or replace function public.qr_manual_checkin(p_branch text, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  _uid uuid := auth.uid();
  _name text;
  _epoch bigint;
  _bucket bigint;
  _tok text := lower(coalesce(p_token, ''));
  _age int;
  _ago text;
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
    perform public._qr_attempt_log(null, p_branch, 'not_logged_in', null, false);
    return jsonb_build_object('ok', false, 'error', 'not_logged_in', 'message', '로그인이 필요해요');
  end if;

  select b.name into _name
    from public.branches b
   where b.name = p_branch or (b.code is not null and b.code = p_branch)
   limit 1;
  if _name is null then
    perform public._qr_attempt_log(_uid, p_branch, 'unknown_branch', null, false);
    return jsonb_build_object('ok', false, 'error', 'unknown_branch', 'message', '알 수 없는 지점 QR이에요');
  end if;

  select user_id, nickname, name, is_staff into _prof
    from public.profiles where user_id = _uid;
  if not found then
    perform public._qr_attempt_log(_uid, _name, 'no_profile', null, false);
    return jsonb_build_object('ok', false, 'error', 'no_profile', 'message', '프로필을 찾을 수 없어요');
  end if;

  -- 토큰: 현재 5분 구간 또는 직전 구간 (화면이 막 바뀐 직후에 찍어도 통과)
  _epoch  := floor(extract(epoch from _now))::bigint;
  _bucket := _epoch / 300;
  if length(_tok) < 16
     or (_tok <> public._board_qr_token_for(_name, _bucket)
         and _tok <> public._board_qr_token_for(_name, _bucket - 1)) then
    _age := public._board_qr_token_age_min(_name, _tok, _now);
    perform public._qr_attempt_log(_uid, _name, 'bad_token', _age, _prof.is_staff);
    if _age is null then
      return jsonb_build_object('ok', false, 'error', 'bad_token',
        'message', 'QR을 확인하지 못했어요. TV 화면에 지금 떠 있는 QR을 다시 찍어 주세요');
    end if;
    _ago := case when _age >= 2880 then (_age / 1440) || '일'
                 when _age >= 1440 then '하루'
                 when _age >= 60 then (_age / 60) || '시간'
                 else _age || '분' end;
    return jsonb_build_object('ok', false, 'error', 'bad_token', 'token_age_min', _age,
      'message', '이 QR은 ' || _ago || ' 전 화면이에요. TV 화면에 지금 떠 있는 QR을 찍어 주세요');
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
    if coalesce(_prof.is_staff, false) then
      perform public._qr_staff_duty(_uid, _name,
        case when _existing.branch_name = _name then _existing.checked_in_at else _now end);
    end if;
    perform public._qr_attempt_log(_uid, _name, 'already', null, _prof.is_staff);
    return jsonb_build_object('ok', true, 'already', true,
      'branch', _existing.branch_name,
      'checked_in_at', _existing.checked_in_at,
      'method', _existing.method,
      'staff', coalesce(_prof.is_staff, false),
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

  if coalesce(_prof.is_staff, false) then
    -- 직원 출근 — 출근부에 적어 TV 코치 칸 · 근무 출근 시각에 쓴다 (승급 검사는 하지 않는다)
    perform public._qr_staff_duty(_uid, _name, _now);
  else
    -- 승급 검사 — 브로제이 출석과 같은 자격. 직원은 제외(출근이 승급으로 이어지면 안 된다).
    perform public.auto_advance_from_attendance(_uid);
  end if;

  perform public._qr_attempt_log(_uid, _name, 'ok', null, _prof.is_staff);
  return jsonb_build_object('ok', true, 'already', false,
    'id', _id,
    'branch', _name,
    'checked_in_at', _now,
    'display_name', _display,
    'staff', coalesce(_prof.is_staff, false),
    'xp_granted', _xp,
    'message', '출석 완료! 라이브보드에 곧 표시돼요');
end;
$function$;
revoke all on function public.qr_manual_checkin(text, text) from public, anon;
grant execute on function public.qr_manual_checkin(text, text) to authenticated;

-- ───────────────────────── 한 번 옮기기: 10/21 부터 직원 QR 출석 → 출근부 ─────────────────────────
select public._qr_staff_duty(a.user_id, a.branch_name, a.checked_in_at)
  from public.attendance_logs a
  join public.profiles p on p.user_id = a.user_id
 where a.method = 'qr_manual'
   and coalesce(a.is_duplicate, false) = false
   and coalesce(p.is_staff, false)
   and a.checked_in_at >= timestamptz '2026-10-21 00:00:00+09'
 order by a.checked_in_at;
