-- ============================================================
-- 보안 정비 후속 픽스 — anon RLS 헬퍼 함수 EXECUTE 복구 (2026-07-06 운영DB 적용됨)
--
-- 20260705120932(security_revoke_anon_rpc_execute)가 SECURITY DEFINER 함수
-- 전체에서 anon EXECUTE 를 회수했는데, 이 중 6개는 RLS 정책 qual 내부에서
-- 호출되는 헬퍼라 anon 요청의 정책 평가 자체가 permission denied 로 실패함
-- (예: 비로그인 지점 TV 라이브보드의 테이블 조회).
-- 해당 6개는 boolean/스칼라 판정 함수로 데이터 노출이 없어 anon 부여가 안전.
-- 적용 후 anon 실증: storage/주요 테이블 조회가 에러 없이 정상 거부(0건)됨을 확인.
-- ============================================================

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon;
GRANT EXECUTE ON FUNCTION public.is_same_branch(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_branch_manager_of(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_coach_of(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_journal_partner(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_my_branch() TO anon;
