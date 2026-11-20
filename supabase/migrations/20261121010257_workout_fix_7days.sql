-- ⏱ 운동 시간 고치기 — 7일까지 (2026-11-21 대표님 「운동시간 고르기는 7일까지수정할수있게 해줘」)
--
-- 20261119020109_workout_fix_end.sql 의 두 함수 위에 고친다(운영 본문 = 그 파일, 11/21 md5 확인).
-- 달라진 것은 고칠 수 있는 날뿐:
--   예전 = 오늘 · 어제(어제 기록은 오늘 밤 12시까지)
--   지금 = 출석한 날부터 7일 안 — 그날(D)부터 D+7 밤 12시까지. 그래서 목록은 오늘부터 7일 전까지의 날(8일치).
-- 그 밖은 그대로: 그날 첫 정식 출석 중 운동 끝 기록이 없는 날(기본 66분) · 67 ~ 180분 · 지난 시각까지 ·
--   한 번만(끝 기록이 이미 있으면 막힘) · XP 는 종료 버튼과 같은 규칙 · ended_source = 'member_fix'.
-- 승급 진행도 · 운동 시간 랭킹 · 운동 기록 · 달력은 workout_minutes 로 저절로 바뀐다(승급 판정은 다음 출석 때).
--   지난 레벨 사이클의 날을 고쳐도 지금 레벨은 움직이지 않는다(get_level_cycle_progress 는 이번 사이클만 센다).
-- 표 · 다른 함수 · 트리거는 그대로. 줄을 지우는 문장이 없다.

create or replace function public.get_my_workout_fix()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  _uid     uuid := auth.uid();
  _today   date := (now() at time zone 'Asia/Seoul')::date;
  _default int  := public.workout_default_minutes();
  _days    int  := 7;   -- 출석한 날부터 며칠 안 (화면 lib/workoutFix.ts FIX_WINDOW_DAYS 와 같은 숫자)
  _items   jsonb;
begin
  if _uid is null then
    return jsonb_build_object('ok', false, 'items', '[]'::jsonb);
  end if;

  -- 오늘부터 7일 전까지 그날 첫 정식 출석 (finish_workout_session · 두 번째 체크와 같은 기준)
  with d as (
    select distinct on ((a.checked_in_at at time zone 'Asia/Seoul')::date)
           a.checked_in_at,
           a.ended_at,
           (a.checked_in_at at time zone 'Asia/Seoul')::date as kday
      from public.attendance_logs a
     where a.user_id = _uid
       and coalesce(a.is_duplicate, false) = false
       and a.checked_in_at >= ((_today - _days)::timestamp at time zone 'Asia/Seoul')
     order by (a.checked_in_at at time zone 'Asia/Seoul')::date, a.checked_in_at asc
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'day',             d.kday,
           'today',           d.kday = _today,
           'started_at',      d.checked_in_at,
           'default_minutes', _default,
           'min_minutes',     _default + 1,
           'max_minutes',     least(180, floor(extract(epoch from (now() - d.checked_in_at)) / 60)::int),
           -- 고칠 수 있는 끝 = 그날부터 7일째 밤 12시
           'until',           ((d.kday + _days + 1)::timestamp at time zone 'Asia/Seoul')
         ) order by d.kday desc), '[]'::jsonb)
    into _items
    from d
   where d.ended_at is null
     and now() - d.checked_in_at >= make_interval(mins => _default + 1);

  return jsonb_build_object('ok', true, 'items', _items);
end;
$function$;

create or replace function public.fix_my_workout_end(p_day date, p_minutes integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  _uid       uuid := auth.uid();
  _today     date := (now() at time zone 'Asia/Seoul')::date;
  _default   int  := public.workout_default_minutes();
  _days      int  := 7;   -- 출석한 날부터 며칠 안 (get_my_workout_fix 와 같은 숫자)
  _id        uuid;
  _started   timestamptz;
  _ended     timestamptz;
  _xp_before int;
  _end       timestamptz;
  _minutes   int;
  _xp        int;
  _eligible  boolean;
begin
  if _uid is null then
    return jsonb_build_object('success', false, 'error', '로그인이 필요합니다.');
  end if;
  if p_day is null or p_minutes is null then
    return jsonb_build_object('success', false, 'error', '고칠 날과 운동한 시간을 골라 주세요.');
  end if;
  if p_day > _today or p_day < _today - _days then
    return jsonb_build_object('success', false, 'error', '출석한 날부터 7일 안의 운동만 고칠 수 있어요.');
  end if;
  if p_minutes <= _default or p_minutes > 180 then
    return jsonb_build_object('success', false,
      'error', '운동한 시간은 ' || (_default + 1) || '분부터 3시간까지 고를 수 있어요.');
  end if;

  -- 그날 첫 정식 출석 — 같은 줄을 두 번 고치지 않게 잠근다(두 번 눌러도 한 번만)
  select id, checked_in_at, ended_at, coalesce(xp_granted, 0)
    into _id, _started, _ended, _xp_before
    from public.attendance_logs
   where user_id = _uid
     and coalesce(is_duplicate, false) = false
     and (checked_in_at at time zone 'Asia/Seoul')::date = p_day
   order by checked_in_at asc
   limit 1
   for update;

  if _id is null then
    return jsonb_build_object('success', false, 'error', '그날 출석 기록이 없어요.');
  end if;
  if _ended is not null then
    return jsonb_build_object('success', false, 'already_finished', true,
      'minutes', public.workout_minutes(_started, _ended),
      'error', '이미 운동 끝 시각이 기록돼 있어요.');
  end if;

  _end := _started + make_interval(mins => p_minutes);
  if _end > now() then
    return jsonb_build_object('success', false, 'error', '아직 오지 않은 시각은 고를 수 없어요.');
  end if;

  update public.attendance_logs
     set ended_at        = _end,
         ended_source    = 'member_fix',
         at_gym_verified = null
   where id = _id
     and ended_at is null;
  if not found then
    return jsonb_build_object('success', false, 'already_finished', true,
      'error', '이미 운동 끝 시각이 기록돼 있어요.');
  end if;

  -- XP — 종료 버튼(finish_workout_session)과 같은 규칙: 이미 받은 만큼 빼고 남는 만큼만
  _minutes := public.workout_minutes(_started, _end);
  _xp      := greatest(0, public.workout_xp(_minutes) - _xp_before);
  select exists (select 1 from public.member_progress m where m.user_id = _uid)
         and not coalesce((select p.is_staff from public.profiles p where p.user_id = _uid), false)
    into _eligible;
  if not _eligible then
    _xp := 0;
  end if;

  if _xp > 0 then
    insert into public.xp_logs (user_id, amount, reason)
    values (_uid, _xp, '운동시간 ' || _minutes || '분 기록 (시간 고침)');
    update public.member_progress
       set total_xp = total_xp + _xp
     where user_id = _uid;
    update public.attendance_logs
       set xp_granted = _xp_before + _xp
     where id = _id;
  end if;

  return jsonb_build_object(
    'success',    true,
    'day',        p_day,
    'minutes',    _minutes,
    'ended_at',   _end,
    'xp_granted', _xp);
end;
$function$;

revoke all on function public.get_my_workout_fix() from public, anon;
revoke all on function public.fix_my_workout_end(date, integer) from public, anon;
grant execute on function public.get_my_workout_fix() to authenticated;
grant execute on function public.fix_my_workout_end(date, integer) to authenticated;
