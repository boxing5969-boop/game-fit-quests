-- ============================================================
-- 보안 정비 2/2 — Supabase advisor 대응 (2026-07-05 운영DB 적용됨)
-- SECURITY DEFINER 함수(전체 RPC 표면 157개)에서 PUBLIC/anon EXECUTE 회수.
-- 앱은 로그인(authenticated) 후에만 RPC 를 호출하므로 동작 변화 없음.
-- 예외(anon 유지):
--   · get_signup_providers  — 로그인 화면(아이디 찾기 흐름)에서 비로그인 호출
--   · get_boss_conquerors   — 지점 TV 라이브보드(로그인 없이 상시 표시)
-- ============================================================

DO $do$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
    IF f.proname IN ('get_signup_providers', 'get_boss_conquerors') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', f.sig);
    END IF;
  END LOOP;
END
$do$;

-- 앞으로 만들어지는 함수도 기본적으로 PUBLIC/anon 실행 불가
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
