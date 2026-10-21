-- 출석 기록 전체 — 회원 본인 + 관리자 · 지점장(회원 상세) (2026-10-21 대표님)
--   "관리자와 지점장은 회원 상세보기 들어가면 회원이 총 몇 회 출석했는지 전체 출석 확인할 수 있게 해 줘.
--    회원님들의 출석 기록도 확인할 수 있게 해 주고, 그래프랑 UI 를 깔끔하게 정리해 줘"
--
--   get_attendance_history(p_user_id) — 비우면 나(회원 본인). 다른 회원은 전체관리자 · 관리자 · 같은 지점 지점장만
--   (attendance_logs RLS 와 같은 범위: is_same_branch = 같은 지점의 branch_manager · super_admin).
--   출석 1회 = 그날(KST) 첫 인정 출석 (is_duplicate 아님 · 날짜마다 1번). 기록은 2026-02-01 부터.
--   돌려주는 것: 총 · 이번 달 · 지난달 · 최근 8주 주 평균 · 첫/마지막 날, 최근 12개월 월별, 요일별, 시간대별,
--               출석 목록 전체(최근 순 · 날짜마다 1줄), 받은 출석 축하(attendance_milestones).
--   앱: src/lib/attendanceHistory.ts · components/attendance/AttendanceHistoryPanel.tsx

create or replace function public.get_attendance_history(p_user_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_uid uuid := coalesce(p_user_id, auth.uid());
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_month date := date_trunc('month', (now() at time zone 'Asia/Seoul'))::date;
  v_result jsonb;
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

  return v_result;
end $$;
revoke all on function public.get_attendance_history(uuid) from public, anon;
grant execute on function public.get_attendance_history(uuid) to authenticated;
