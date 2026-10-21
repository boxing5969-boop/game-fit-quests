-- 출석 기록을 회원이 기분 좋게 · 재등록으로 이어지게 (2026-10-21 대표님)
--   "회원님들이 주 평균을 보면 손해 본다는 생각을 하지 않을까?" → "회원님들이 출석 데이터를 통해 재등록과 감정이
--    긍정적으로 생각할 수 있도록 세팅하자"
--   회원 화면은 잘한 것을 센다 — 연속 출석 주(매주 1번 이상 온 주가 몇 주 이어졌나) · 최고 기록 달 · 153과 함께한 날.
--   주 평균 · 지난달과 비교(줄었을 때)는 관리자 · 지점장 화면에만 둔다 (앱: lib/attendanceCheer).
--
--   · attendance_week_streaks(uid): 지금 연속 주(이번 주에 아직 안 왔어도 지난주까지 이어졌으면 그대로 센다) · 최고 연속 주 · 이번 주 출석 여부
--   · attendance_best_month(uid): 가장 많이 온 달 (전체 기록 · 같으면 최근 달)
--   · get_my_attendance_stats · get_attendance_history 에 위 값 + days_with(첫 기록부터 오늘까지 며칠) 를 더한다 (나머지는 그대로)

create or replace function public.attendance_week_streaks(_uid uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with w as (
    select distinct date_trunc('week', (a.checked_in_at at time zone 'Asia/Seoul'))::date as wk
      from public.attendance_logs a
     where a.user_id = _uid and coalesce(a.is_duplicate, false) = false and a.checked_in_at is not null
  ),
  g as (
    select wk, wk - (row_number() over (order by wk))::int * 7 as grp from w
  ),
  runs as (
    select max(wk) as e, count(*)::int as len from g group by grp
  ),
  cur as (
    select date_trunc('week', (now() at time zone 'Asia/Seoul'))::date as wk
  )
  select jsonb_build_object(
    'current', coalesce((select r.len from runs r, cur c where r.e = c.wk or r.e = c.wk - 7 order by r.e desc limit 1), 0),
    'best', coalesce((select max(len) from runs), 0),
    'this_week', exists (select 1 from w, cur c where w.wk = c.wk)
  )
$$;
revoke all on function public.attendance_week_streaks(uuid) from public, anon, authenticated;

create or replace function public.attendance_best_month(_uid uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select (
    select jsonb_build_object('month', to_char(y.m, 'YYYY-MM'), 'days', y.c)
      from (select date_trunc('month', x.d)::date as m, count(*)::int as c
              from (select distinct (a.checked_in_at at time zone 'Asia/Seoul')::date as d
                      from public.attendance_logs a
                     where a.user_id = _uid and coalesce(a.is_duplicate, false) = false and a.checked_in_at is not null) x
             group by 1) y
     order by y.c desc, y.m desc
     limit 1)
$$;
revoke all on function public.attendance_best_month(uuid) from public, anon, authenticated;

-- 내정보 카드 · 축하 편지 — 20261021203532 그대로 + 연속 주 · 최고 달 · 함께한 날
create or replace function public.get_my_attendance_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  v_last_start timestamptz := (date_trunc('month', now() at time zone 'Asia/Seoul') - interval '1 month') at time zone 'Asia/Seoul';
  v_total integer;
  v_month integer;
  v_last integer;
  v_since date;
  v_staff boolean;
  v_next integer;
  v_streak jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  select coalesce(is_staff, false) into v_staff from public.profiles where user_id = v_uid;

  select count(distinct (a.checked_in_at at time zone 'Asia/Seoul')::date)::integer,
         count(distinct (a.checked_in_at at time zone 'Asia/Seoul')::date) filter (where a.checked_in_at >= v_month_start)::integer,
         count(distinct (a.checked_in_at at time zone 'Asia/Seoul')::date)
           filter (where a.checked_in_at >= v_last_start and a.checked_in_at < v_month_start)::integer,
         min((a.checked_in_at at time zone 'Asia/Seoul')::date)
    into v_total, v_month, v_last, v_since
    from public.attendance_logs a
   where a.user_id = v_uid and coalesce(a.is_duplicate, false) = false and a.checked_in_at is not null;

  v_next := ((coalesce(v_total, 0) / 50) + 1) * 50;
  v_streak := public.attendance_week_streaks(v_uid);
  return jsonb_build_object(
    'total', coalesce(v_total, 0),
    'month', coalesce(v_month, 0),
    'last_month', coalesce(v_last, 0),
    'since', v_since,
    'records_since', '2026-02-01',
    'is_staff', coalesce(v_staff, false),
    'step', 50,
    'next', v_next,
    'next_gems', public.attendance_milestone_gems(v_next),
    'next_mileage', public.attendance_milestone_mileage(v_next),
    'week_streak', v_streak -> 'current',
    'best_week_streak', v_streak -> 'best',
    'this_week', v_streak -> 'this_week',
    'best_month', public.attendance_best_month(v_uid),
    'days_with', case when v_since is null then 0 else (now() at time zone 'Asia/Seoul')::date - v_since + 1 end,
    'milestones', coalesce((
      select jsonb_agg(jsonb_build_object('milestone', m.milestone, 'reached_on', m.reached_on, 'gems', m.gems,
                                          'mileage', m.mileage, 'seen', m.seen_at is not null) order by m.milestone)
        from public.attendance_milestones m where m.user_id = v_uid), '[]'::jsonb),
    'unseen', (
      select case when count(*) = 0 then null else
               jsonb_build_object('milestone', max(m.milestone), 'count', count(*),
                                  'gems', sum(m.gems), 'mileage', sum(m.mileage)) end
        from public.attendance_milestones m where m.user_id = v_uid and m.seen_at is null)
  );
end $$;
revoke all on function public.get_my_attendance_stats() from public, anon;
grant execute on function public.get_my_attendance_stats() to authenticated;

-- 출석 기록 전체 — 20261021212901 그대로 + 연속 주 · 최고 달 · 함께한 날
create or replace function public.get_attendance_history(p_user_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_uid uuid := coalesce(p_user_id, auth.uid());
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_month date := date_trunc('month', (now() at time zone 'Asia/Seoul'))::date;
  v_result jsonb;
  v_streak jsonb;
begin
  if v_me is null then raise exception '로그인이 필요합니다'; end if;
  if v_uid <> v_me
     and not (public.has_role(v_me, 'super_admin') or public.has_role(v_me, 'admin') or public.is_same_branch(v_uid)) then
    raise exception '지점장 · 관리자만 볼 수 있어요';
  end if;

  with d as (
    select distinct on ((a.checked_in_at at time zone 'Asia/Seoul')::date)
           (a.checked_in_at at time zone 'Asia/Seoul')::date as day,
           a.checked_in_at as at,
           a.ended_at,
           a.method,
           a.branch_name,
           extract(hour from (a.checked_in_at at time zone 'Asia/Seoul'))::int as hr,
           extract(isodow from (a.checked_in_at at time zone 'Asia/Seoul'))::int as dow
      from public.attendance_logs a
     where a.user_id = v_uid and coalesce(a.is_duplicate, false) = false and a.checked_in_at is not null
     order by (a.checked_in_at at time zone 'Asia/Seoul')::date, a.checked_in_at
  ),
  months as (
    select (v_month - make_interval(months => g))::date as m
      from generate_series(0, 11) g
  )
  select jsonb_build_object(
    'total', (select count(*) from d),
    'month', (select count(*) from d where day >= v_month),
    'last_month', (select count(*) from d where day >= (v_month - interval '1 month')::date and day < v_month),
    'weeks8', (select count(*) from d where day > v_today - 56),
    'first_day', (select min(day) from d),
    'last_day', (select max(day) from d),
    'days_with', coalesce((select v_today - min(day) + 1 from d), 0),
    'records_since', '2026-02-01',
    'monthly', (select jsonb_agg(jsonb_build_object('month', to_char(mo.m, 'YYYY-MM'),
                                                    'days', (select count(*) from d where date_trunc('month', d.day)::date = mo.m))
                                 order by mo.m)
                  from months mo),
    'weekday', (select jsonb_agg((select count(*) from d where d.dow = w) order by w) from generate_series(1, 7) w),
    'hours', jsonb_build_object(
      'dawn', (select count(*) from d where hr < 6),
      'morning', (select count(*) from d where hr >= 6 and hr < 11),
      'noon', (select count(*) from d where hr >= 11 and hr < 14),
      'afternoon', (select count(*) from d where hr >= 14 and hr < 18),
      'evening', (select count(*) from d where hr >= 18 and hr < 21),
      'night', (select count(*) from d where hr >= 21)),
    'list', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'at', at, 'end', ended_at, 'method', method, 'branch', branch_name)
                                       order by day desc)
                        from d), '[]'::jsonb),
    'milestones', coalesce((select jsonb_agg(jsonb_build_object('milestone', m.milestone, 'reached_on', m.reached_on,
                                                                'gems', m.gems, 'mileage', m.mileage) order by m.milestone)
                              from public.attendance_milestones m where m.user_id = v_uid), '[]'::jsonb)
  ) into v_result;

  v_streak := public.attendance_week_streaks(v_uid);
  return v_result || jsonb_build_object(
    'week_streak', v_streak -> 'current',
    'best_week_streak', v_streak -> 'best',
    'this_week', v_streak -> 'this_week',
    'best_month', public.attendance_best_month(v_uid)
  );
end $$;
revoke all on function public.get_attendance_history(uuid) from public, anon;
grant execute on function public.get_attendance_history(uuid) to authenticated;
