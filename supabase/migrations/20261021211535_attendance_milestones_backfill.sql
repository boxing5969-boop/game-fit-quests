-- 이미 출석 50회를 넘은 회원 축하 — 한 번 (2026-10-21 대표님: "이미 넘은 회원은? → 지금 축하해 드리기")
--   앞 마이그레이션(20261021203532_attendance_milestones)의 grant_attendance_milestones 를 회원마다 한 번 부른다.
--   넘은 횟수마다 챔피언 머니(50회 1,000 · 100회 2,000 · 150회 3,000) · 마일리지 1,000점, 알림은 회원당 1통(가장 높은 횟수),
--   축하 편지는 다음에 앱을 열면 한 통(가장 높은 횟수 · 선물 합계).
--   앱(내정보 출석 기록 · 축하 편지 · 69b900b)이 올라간 뒤에 돌렸다. 다시 돌려도 이미 준 축하는 다시 안 준다(기본 키).
--   적용 시점 대상: 회원 70명 (50회 이상 · 그중 100회 이상 11명 · 150회 이상 1명), 지도진 제외.

do $$
declare
  r record;
begin
  for r in
    select a.user_id
      from public.attendance_logs a
      join public.profiles p on p.user_id = a.user_id
     where coalesce(a.is_duplicate, false) = false
       and coalesce(p.is_staff, false) = false
       and a.checked_in_at is not null
     group by a.user_id
    having count(distinct (a.checked_in_at at time zone 'Asia/Seoul')::date) >= 50
  loop
    perform public.grant_attendance_milestones(r.user_id, true);
  end loop;
end $$;
