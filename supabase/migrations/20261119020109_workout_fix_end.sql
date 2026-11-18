-- ⏱ 운동 시간 고치기 — 운동 종료를 깜빡한 날, 끝난 시각을 회원이 한 번 고른다
--   (2026-11-19 선릉역점 회원 제안 「깜박잊고 운동종료를 안눌렀는데 12시 지나니까 자동반영이되었어요 ·
--    운동한시간을 수정할수있었으면좋겠어요」 → 대표님 「이거진행」)
--
-- 왜: 운동 끝은 '운동 종료' 버튼(finish_workout_session — 그날만) 또는 입구 얼굴 인식 한 번 더(두 번째 체크 — 3시간 안)로만 잰다.
--     둘 다 없으면 기본 66분. 자정이 지나면 버튼이 어제 출석을 못 찾아(오늘 출석만 닫는다) 고칠 길이 없었다.
--     늦게 와서 자정을 넘겨 운동한 날도 마찬가지 · 같은 날이라도 4시간이 지나 누르면 기본 66분이 된다(workout_minutes).
--
-- 규칙 (종료 버튼 · 두 번째 체크와 같은 숫자 — 새 상한은 없다)
--   · 고칠 수 있는 기록: 오늘 · 어제(한국 시각) 그날 첫 정식 출석 중 운동 끝 기록이 없는 것(기본 66분으로 쳐진 날) — 한 번만.
--     어제 기록은 오늘 밤 12시까지. 이미 끝 시각이 있으면(버튼 · 두 번째 체크 · 고침) 고칠 수 없다.
--   · 고르는 것: 운동한 시간 67분 ~ 180분(끝 = 입장 + 그 분) · 아직 오지 않은 시각은 안 됨.
--     180분 = 하루 최대(workout_minutes) · 버튼을 3~4시간 사이에 눌러도 180분이라 새로 늘어나는 몫은 없다.
--   · XP: 종료 버튼과 같은 규칙 — workout_xp(분) 에서 이미 받은 만큼 빼고 남는 만큼만 · 지도진 · 진행 기록 없는 계정은 0.
--   · 승급 진행도 · 운동 시간 랭킹 · 운동 기록은 workout_minutes 로 저절로 바뀐다(승급 판정은 다음 출석 때 — 종료 버튼과 같다).
--   · 기록 표시: ended_source = 'member_fix' — 코치진 운동 기록 화면에 「시간 고침」으로 보인다.
--
-- 새 함수 2개만 — 표 · 기존 함수 · 트리거는 그대로. 줄을 지우는 문장이 없다.
--   get_my_workout_fix()            : 지금 고칠 수 있는 기록(오늘 · 어제) — 화면이 안내 줄 · 시트에 쓴다
--   fix_my_workout_end(날, 분)       : 그날 끝 시각을 입장 + 분으로 기록 + XP

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
  _items   jsonb;
begin
  if _uid is null then
    return jsonb_build_object('ok', false, 'items', '[]'::jsonb);
  end if;

  -- 오늘 · 어제 그날 첫 정식 출석 (finish_workout_session · 두 번째 체크와 같은 기준)
  with d as (
    select distinct on ((a.checked_in_at at time zone 'Asia/Seoul')::date)
           a.checked_in_at,
           a.ended_at,
           (a.checked_in_at at time zone 'Asia/Seoul')::date as kday
      from public.attendance_logs a
     where a.user_id = _uid
       and coalesce(a.is_duplicate, false) = false
       and a.checked_in_at >= ((_today - 1)::timestamp at time zone 'Asia/Seoul')
     order by (a.checked_in_at at time zone 'Asia/Seoul')::date, a.checked_in_at asc
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'day',             d.kday,
           'today',           d.kday = _today,
           'started_at',      d.checked_in_at,
           'default_minutes', _default,
           'min_minutes',     _default + 1,
           'max_minutes',     least(180, floor(extract(epoch from (now() - d.checked_in_at)) / 60)::int),
           'until',           ((d.kday + 2)::timestamp at time zone 'Asia/Seoul')
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
  if p_day > _today or p_day < _today - 1 then
    return jsonb_build_object('success', false, 'error', '오늘과 어제 운동만 고칠 수 있어요.');
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
