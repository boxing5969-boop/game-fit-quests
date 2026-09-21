-- 운동시간 RPC 3종. 쓰기는 반드시 이 함수를 지난다
-- (attendance_logs 에는 회원용 UPDATE 정책이 없다 — 의도된 설계).

/** 운동 종료 — 회원이 나갈 때 앱에서 한 번 누른다.
    시작 시각은 받지 않는다. 얼굴 인식 출석 시각이 곧 시작이다.
    p_at_gym: 종료 시점 위치가 지점 근처였는지(표시용). NULL 이어도 기록은 정상 처리한다
              — 실내 GPS 오차로 정당한 회원의 종료를 막으면 안 된다. */
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
  _xp        int;
begin
  if _uid is null then
    return jsonb_build_object('success', false, 'error', '로그인이 필요합니다.');
  end if;

  _today := (now() at time zone 'Asia/Seoul')::date;

  -- 오늘의 정식 출석 한 건. 여러 번 찍혔다면 가장 이른 것이 실제 입장이다.
  -- 오늘로 한정하는 것이 핵심 — 어제 열린 세션을 오늘 닫으면 24시간 기록이 나온다.
  select id, checked_in_at, ended_at
    into _id, _started, _ended
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
  _minutes := public.workout_minutes(_started, _ended);
  _xp      := public.workout_xp(_minutes);

  if _xp > 0 then
    insert into public.xp_logs (user_id, amount, reason)
    values (_uid, _xp, '운동시간 ' || _minutes || '분 기록');
    update public.member_progress
       set total_xp = total_xp + _xp
     where user_id = _uid;
  end if;

  return jsonb_build_object(
    'success', true, 'minutes', _minutes, 'xp_granted', _xp,
    'at_gym_verified', p_at_gym);
end;
$$;

/** 오늘 상태 + 이번 달 누적. 화면이 종료 버튼을 켤지 말지 이걸로 판단한다. */
create or replace function public.get_my_workout_today()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  _uid     uuid := auth.uid();
  _today   date;
  _started timestamptz;
  _ended   timestamptz;
  _month   int;
  _days    int;
begin
  if _uid is null then
    return jsonb_build_object('checked_in', false);
  end if;

  _today := (now() at time zone 'Asia/Seoul')::date;

  select checked_in_at, ended_at into _started, _ended
  from public.attendance_logs
  where user_id = _uid
    and coalesce(is_duplicate, false) = false
    and (checked_in_at at time zone 'Asia/Seoul')::date = _today
  order by checked_in_at asc
  limit 1;

  -- 이번 달 누적 — 종료를 안 누른 날도 기본 50분으로 함께 센다(대표님 결정).
  select coalesce(sum(public.workout_minutes(a.checked_in_at, a.ended_at)), 0),
         count(*)
    into _month, _days
  from public.attendance_logs a
  where a.user_id = _uid
    and coalesce(a.is_duplicate, false) = false
    and (a.checked_in_at at time zone 'Asia/Seoul')
        >= date_trunc('month', now() at time zone 'Asia/Seoul');

  return jsonb_build_object(
    'checked_in',     _started is not null,
    'started_at',     _started,
    'finished',       _ended is not null,
    'ended_at',       _ended,
    -- 아직 안 눌렀으면 지금까지 흐른 시간을 보여준다(확정 기록이 아니라 참고용).
    'elapsed_minutes', case when _started is null then null
                            when _ended is not null then public.workout_minutes(_started, _ended)
                            else floor(extract(epoch from (now() - _started)) / 60)::int end,
    'default_minutes', public.workout_default_minutes(),
    'month_minutes',   _month,
    'month_days',      _days);
end;
$$;

/** 이번 달 운동시간 랭킹. 전원 같은 랭킹에 세운다(대표님 결정) —
    종료를 안 누른 날도 50분으로 함께 집계되므로 누구도 빠지지 않는다.
    직원·관리자는 제외한다(기존 랭킹과 같은 규칙).
    비-super_admin 은 자기 지점만 본다(get_weekly_activity_ranking 과 같은 규약). */
create or replace function public.get_workout_time_ranking(
  _branch_name text default null,
  _limit       integer default 30
)
returns table (
  r_user_id     uuid,
  r_nickname    text,
  r_branch_name text,
  r_minutes     bigint,
  r_days        bigint,
  rank_position bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with caller as (
    select exists (
      select 1 from public.user_roles ur
       where ur.user_id = auth.uid() and ur.role = 'super_admin'
    ) as is_super_admin
  ),
  scope as (
    select case when c.is_super_admin then _branch_name
                else (select p.branch_name from public.profiles p where p.user_id = auth.uid())
           end as branch_name
    from caller c
  ),
  agg as (
    select a.user_id,
           sum(public.workout_minutes(a.checked_in_at, a.ended_at))::bigint as minutes,
           count(*)::bigint as days
    from public.attendance_logs a
    where coalesce(a.is_duplicate, false) = false
      and (a.checked_in_at at time zone 'Asia/Seoul')
          >= date_trunc('month', now() at time zone 'Asia/Seoul')
    group by a.user_id
  )
  select g.user_id,
         coalesce(nullif(p.nickname, ''), '익명' || substr(g.user_id::text, 1, 6)),
         p.branch_name,
         g.minutes,
         g.days,
         row_number() over (order by g.minutes desc, g.days desc, p.nickname asc)
  from agg g
  join public.profiles p on p.user_id = g.user_id
  cross join scope s
  where coalesce(p.is_staff, false) = false
    and (s.branch_name is null or p.branch_name = s.branch_name)
    and not exists (
      select 1 from public.user_roles ur
       where ur.user_id = g.user_id and ur.role in ('super_admin', 'admin')
    )
  order by g.minutes desc, g.days desc, p.nickname asc
  limit greatest(1, least(coalesce(_limit, 30), 100));
$$;

revoke all on function public.finish_workout_session(boolean) from public;
revoke all on function public.get_my_workout_today() from public;
revoke all on function public.get_workout_time_ranking(text, integer) from public;
grant execute on function public.finish_workout_session(boolean) to authenticated;
grant execute on function public.get_my_workout_today() to authenticated;
grant execute on function public.get_workout_time_ranking(text, integer) to authenticated;
