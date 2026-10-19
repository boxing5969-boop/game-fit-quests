-- 트리거 전용 함수는 앱(로그인 전·후)이 직접 부를 수 없게 (2026-10-19 검수 — Supabase 보안 경고 정리)
--   트리거는 함수 실행 권한과 상관없이 그대로 돈다 (authenticated 로 확인: 권한 없이도 트리거가 값을 바꿈).
--   SECURITY DEFINER 트리거 함수만. updated_at 처럼 권한이 필요 없는 일반 트리거 함수는 그대로 둔다.
revoke execute on function public.attendance_push_bonus_trg() from public, anon, authenticated;
revoke execute on function public.auto_award_badges() from public, anon, authenticated;
revoke execute on function public.character_presets_validate_unlocks() from public, anon, authenticated;
revoke execute on function public.coach_request_alert_trg() from public, anon, authenticated;
revoke execute on function public.guard_profile_privileged_columns() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.link_member_medals_trg() from public, anon, authenticated;
revoke execute on function public.mission_submission_alert_trg() from public, anon, authenticated;
revoke execute on function public.payment_orders_mileage_trg() from public, anon, authenticated;
revoke execute on function public.quest_submission_alert_trg() from public, anon, authenticated;
revoke execute on function public.records_153_reward_trg() from public, anon, authenticated;
