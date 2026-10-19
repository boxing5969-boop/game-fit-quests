-- 라이브보드(TV) 회원 정보 잠그기 2단계 (2026-10-19) — 로그인 안 한 사람의 공개 표 직접 읽기를 막는다
--   1단계(20261019190000)로 TV 가 board_* 함수만 쓰게 바뀐 것을 확인한 뒤 적용했다
--   (API 기록: 선릉역점 TV 가 18:57 KST 에 새 화면으로 바뀐 뒤 로그인 안 한 직접 읽기 0건).
--   · public_profiles(전 회원 이름·지점·사진) — 로그인 안 한 사람은 못 읽는다
--   · 출석(어제·오늘) · 운동 세션 · 캐릭터 지정 — TV 용으로 열어 둔 정책을 닫는다 (정책은 남기고 false)
--   · 카드에 보일 것 · 메달 — 로그인한 회원만
--   캐릭터 모양(character_presets)은 회원 정보가 아니라 그대로 둔다. TV 메달은 get_member_medals 함수로 읽는다.
revoke select on public.public_profiles from anon;

alter policy "Anon view attendance for live board" on public.attendance_logs using (false);
alter policy "Anon view sessions for live board" on public.activity_sessions using (false);
alter policy "Anon view assignments" on public.member_character_assignments using (false);

alter policy "card display readable" on public.member_card_display to authenticated;
alter policy "member medals readable" on public.member_medals to authenticated;

revoke select on public.attendance_logs from anon;
revoke select on public.activity_sessions from anon;
revoke select on public.member_character_assignments from anon;
revoke select on public.member_card_display from anon;
revoke select on public.member_medals from anon;
