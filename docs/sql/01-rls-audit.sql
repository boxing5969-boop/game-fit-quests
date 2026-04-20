-- ─────────────────────────────────────────────────────────────
--  RLS 정책 현황 진단
--  Supabase Dashboard → SQL Editor에서 그대로 실행.
--  결과는 읽기 전용(select) 이므로 데이터에 영향 없음.
-- ─────────────────────────────────────────────────────────────

-- 1. 모든 RLS 정책 요약
SELECT
  tablename,
  policyname,
  cmd  AS operation,   -- SELECT / INSERT / UPDATE / DELETE / ALL
  roles,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 2. 랭킹에 중요한 테이블만 따로 확인
SELECT
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'member_progress', 'xp_logs', 'branches', 'user_roles')
ORDER BY tablename, cmd;

-- 3. RLS가 아예 꺼져 있는 테이블이 있는지
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname;

-- 4. 현재 랭킹 RPC 함수들의 실제 시그니처
SELECT
  proname AS function_name,
  pg_get_function_arguments(oid) AS arguments,
  pg_get_function_result(oid)    AS returns
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'get_division_ranking',
    'get_weekly_activity_ranking',
    'get_monthly_risers',
    'get_streak_ranking',
    'get_boss_conquerors',
    'get_hall_of_fame'
  )
ORDER BY proname;
