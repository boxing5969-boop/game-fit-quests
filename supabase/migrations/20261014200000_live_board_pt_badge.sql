-- 🔵 TV 라이브보드 카드에도 PT 회원 파란 배지 (2026-10-14 대표님: "블루버튼 — 앱에서는 보이는데 pt 회원님들")
--
--   앱 라이선스 카드는 get_member_license 의 'pt'(is_pt_active)로 파란 배지를 그린다.
--   TV 는 로그인하지 않은 화면(anon)이라 profiles.pt_until 을 읽을 수 없고, public_profiles 뷰에도 PT 칸이 없다.
--   그래서 TV 전용으로 "이 지점에 오늘 출석했거나 지금 운동 중인 PT 회원의 user_id" 만 돌려준다.
--     · 날짜(pt_until)는 내보내지 않는다 — 예/아니오만.
--     · 오늘 그 지점에 온 회원만 — 화면에 이미 카드가 뜨는 사람들이다 (전체 회원 PT 여부를 훑을 수 없다).
--     · 지도진(is_staff) 제외 — 코치님 카드에는 원래 배지를 그리지 않는다.
--   PT 기준은 is_pt_active() 와 같다: pt_until(KST 날짜) >= 오늘(KST).
--   운영 실측(적용 전): PT 회원 7명, 전부 선릉역점 · 지도진 0명.

create or replace function public.get_live_board_pt_members(_branch_name text)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id
    from profiles p
   where p.pt_until >= (now() at time zone 'Asia/Seoul')::date
     and coalesce(p.is_staff, false) = false
     and (
       exists (
         select 1 from attendance_logs a
          where a.user_id = p.user_id
            and a.branch_name = _branch_name
            and a.checked_in_at >= ((now() at time zone 'Asia/Seoul')::date)::timestamp at time zone 'Asia/Seoul'
       )
       or exists (
         select 1 from activity_sessions s
          where s.user_id = p.user_id
            and s.branch_name = _branch_name
            and s.status = 'active'
            and s.ended_at is null
       )
     )
$$;

revoke all on function public.get_live_board_pt_members(text) from public;
grant execute on function public.get_live_board_pt_members(text) to anon, authenticated;
