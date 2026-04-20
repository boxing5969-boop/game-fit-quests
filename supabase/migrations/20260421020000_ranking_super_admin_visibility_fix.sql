-- ══════════════════════════════════════════════════════════════════
-- 랭킹 RPC 수정 — super_admin 이 전 지점 랭킹을 봤을 때 빈 결과가
-- 뜨던 버그 수정 + master track 정렬 defensive 처리
--
-- 원인
--   기존 5개 랭킹 RPC 는 모든 호출자에게 admin/branch_manager/super_admin
--   role 을 가진 멤버를 결과에서 제외했다. 테스트 DB 처럼 관리자/스태프
--   계정 위주인 환경에서 super_admin 이 "전 지점" 을 보면 0 행이 반환됨.
--   또한 20260420170000 에서 get_division_ranking 을 overall_level
--   컬럼을 전제로 재작성했는데, master-track 마이그레이션(160000) 이
--   아직 적용되지 않은 환경에서는 컬럼이 없어 RPC 가 실패했다.
--
-- 정책
--   • super_admin 이 caller 일 때   → 모든 role 포함 (전 회원 보임)
--   • 일반 회원 / 코치 / branch_manager → 기존 exclusion 유지
--     (관리자 3종은 경쟁 대상 아님)
--   • 정렬 키 overall_level 은 CASE 로 인라인 계산 → 컬럼 의존성 제거
--     (master_track 유저는 여전히 black Lv10 묶음으로 표시되지만
--      본 이슈 해결이 우선. master 정렬 복구는 마이그레이션 160000/170000
--      이 적용된 환경에서 별도 작업으로 처리 가능.)
--   • 기존 파라미터 시그니처, 반환 테이블 형태, exported 하지 않은 내부
--     필드 모두 변경 없음.
-- ══════════════════════════════════════════════════════════════════

-- 공통 오버올 레벨 계산식 — master_track 미적용 환경도 지원
-- white=0, blue=10, red=20, black=30 + current_level(1..10)

-- ──────────────────────────────────────────────────────────────────
-- 1. get_division_ranking
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_division_ranking(
  _branch_name text DEFAULT NULL,
  _limit       integer DEFAULT 50
)
RETURNS TABLE (
  r_user_id        uuid,
  r_nickname       text,
  r_avatar_url     text,
  r_current_rank   rank_name,
  r_current_level  integer,
  r_bosses_cleared integer,
  r_total_xp       integer,
  r_streak_days    integer,
  rank_position    bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH caller_role AS (
    SELECT EXISTS (
      SELECT 1 FROM user_roles ur
       WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    ) AS is_super_admin
  ),
  effective_filter AS (
    SELECT
      CASE WHEN cr.is_super_admin THEN _branch_name
           ELSE (SELECT p.branch_name FROM profiles p WHERE p.user_id = auth.uid())
      END AS branch_filter,
      cr.is_super_admin
    FROM caller_role cr
  )
  SELECT
    mp.user_id, p.nickname, p.avatar_url,
    mp.current_rank, mp.current_level,
    mp.bosses_cleared, mp.total_xp, mp.streak_days,
    ROW_NUMBER() OVER (
      ORDER BY
        (CASE mp.current_rank
           WHEN 'white' THEN 0 WHEN 'blue' THEN 10
           WHEN 'red'   THEN 20 WHEN 'black' THEN 30
           ELSE 0
         END + COALESCE(mp.current_level, 1)) DESC,
        mp.bosses_cleared DESC,
        mp.total_xp DESC
    ) AS rank_position
  FROM member_progress mp
  JOIN profiles p ON p.user_id = mp.user_id
  CROSS JOIN effective_filter ef
  WHERE (ef.branch_filter IS NULL OR p.branch_name = ef.branch_filter)
    AND (
      ef.is_super_admin
      OR NOT EXISTS (
        SELECT 1 FROM user_roles ur
         WHERE ur.user_id = mp.user_id
           AND ur.role IN ('super_admin', 'admin', 'branch_manager')
      )
    )
  ORDER BY rank_position
  LIMIT _limit;
$$;


-- ──────────────────────────────────────────────────────────────────
-- 2. get_weekly_activity_ranking
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_weekly_activity_ranking(
  _branch_name text DEFAULT NULL,
  _limit       integer DEFAULT 20
)
RETURNS TABLE (
  r_user_id       uuid,
  r_nickname      text,
  r_avatar_url    text,
  r_current_rank  rank_name,
  r_current_level integer,
  weekly_xp       bigint,
  rank_position   bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH caller_role AS (
    SELECT EXISTS (
      SELECT 1 FROM user_roles ur
       WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    ) AS is_super_admin
  ),
  effective_filter AS (
    SELECT
      CASE WHEN cr.is_super_admin THEN _branch_name
           ELSE (SELECT p.branch_name FROM profiles p WHERE p.user_id = auth.uid())
      END AS branch_filter,
      cr.is_super_admin
    FROM caller_role cr
  )
  SELECT
    xl.user_id, p.nickname, p.avatar_url,
    mp.current_rank, mp.current_level,
    COALESCE(SUM(xl.amount), 0)::bigint AS weekly_xp,
    ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(xl.amount), 0) DESC) AS rank_position
  FROM xp_logs xl
  JOIN profiles p ON p.user_id = xl.user_id
  JOIN member_progress mp ON mp.user_id = xl.user_id
  CROSS JOIN effective_filter ef
  WHERE (ef.branch_filter IS NULL OR p.branch_name = ef.branch_filter)
    AND xl.created_at >= date_trunc('week', CURRENT_DATE)
    AND (
      ef.is_super_admin
      OR NOT EXISTS (
        SELECT 1 FROM user_roles ur
         WHERE ur.user_id = xl.user_id
           AND ur.role IN ('super_admin', 'admin', 'branch_manager')
      )
    )
  GROUP BY xl.user_id, p.nickname, p.avatar_url, mp.current_rank, mp.current_level
  ORDER BY weekly_xp DESC
  LIMIT _limit;
$$;


-- ──────────────────────────────────────────────────────────────────
-- 3. get_monthly_risers
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_monthly_risers(
  _branch_name text DEFAULT NULL,
  _limit       integer DEFAULT 10
)
RETURNS TABLE (
  r_user_id       uuid,
  r_nickname      text,
  r_avatar_url    text,
  r_current_rank  rank_name,
  r_current_level integer,
  monthly_xp      bigint,
  rank_position   bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH caller_role AS (
    SELECT EXISTS (
      SELECT 1 FROM user_roles ur
       WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    ) AS is_super_admin
  ),
  effective_filter AS (
    SELECT
      CASE WHEN cr.is_super_admin THEN _branch_name
           ELSE (SELECT p.branch_name FROM profiles p WHERE p.user_id = auth.uid())
      END AS branch_filter,
      cr.is_super_admin
    FROM caller_role cr
  )
  SELECT
    xl.user_id, p.nickname, p.avatar_url,
    mp.current_rank, mp.current_level,
    COALESCE(SUM(xl.amount), 0)::bigint AS monthly_xp,
    ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(xl.amount), 0) DESC) AS rank_position
  FROM xp_logs xl
  JOIN profiles p ON p.user_id = xl.user_id
  JOIN member_progress mp ON mp.user_id = xl.user_id
  CROSS JOIN effective_filter ef
  WHERE (ef.branch_filter IS NULL OR p.branch_name = ef.branch_filter)
    AND xl.created_at >= date_trunc('month', CURRENT_DATE)
    AND (
      ef.is_super_admin
      OR NOT EXISTS (
        SELECT 1 FROM user_roles ur
         WHERE ur.user_id = xl.user_id
           AND ur.role IN ('super_admin', 'admin', 'branch_manager')
      )
    )
  GROUP BY xl.user_id, p.nickname, p.avatar_url, mp.current_rank, mp.current_level
  ORDER BY monthly_xp DESC
  LIMIT _limit;
$$;


-- ──────────────────────────────────────────────────────────────────
-- 4. get_streak_ranking
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_streak_ranking(
  _branch_name text DEFAULT NULL,
  _limit       integer DEFAULT 10
)
RETURNS TABLE (
  r_user_id       uuid,
  r_nickname      text,
  r_avatar_url    text,
  r_current_rank  rank_name,
  r_current_level integer,
  r_streak_days   integer,
  rank_position   bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH caller_role AS (
    SELECT EXISTS (
      SELECT 1 FROM user_roles ur
       WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    ) AS is_super_admin
  ),
  effective_filter AS (
    SELECT
      CASE WHEN cr.is_super_admin THEN _branch_name
           ELSE (SELECT p.branch_name FROM profiles p WHERE p.user_id = auth.uid())
      END AS branch_filter,
      cr.is_super_admin
    FROM caller_role cr
  )
  SELECT
    mp.user_id, p.nickname, p.avatar_url,
    mp.current_rank, mp.current_level, mp.streak_days,
    ROW_NUMBER() OVER (ORDER BY mp.streak_days DESC) AS rank_position
  FROM member_progress mp
  JOIN profiles p ON p.user_id = mp.user_id
  CROSS JOIN effective_filter ef
  WHERE (ef.branch_filter IS NULL OR p.branch_name = ef.branch_filter)
    AND mp.streak_days > 0
    AND (
      ef.is_super_admin
      OR NOT EXISTS (
        SELECT 1 FROM user_roles ur
         WHERE ur.user_id = mp.user_id
           AND ur.role IN ('super_admin', 'admin', 'branch_manager')
      )
    )
  ORDER BY mp.streak_days DESC
  LIMIT _limit;
$$;


-- ──────────────────────────────────────────────────────────────────
-- 5. get_boss_conquerors
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_boss_conquerors(
  _branch_name text DEFAULT NULL,
  _limit       integer DEFAULT 10
)
RETURNS TABLE (
  r_user_id        uuid,
  r_nickname       text,
  r_avatar_url     text,
  r_current_rank   rank_name,
  r_current_level  integer,
  r_bosses_cleared integer,
  rank_position    bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH caller_role AS (
    SELECT EXISTS (
      SELECT 1 FROM user_roles ur
       WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    ) AS is_super_admin
  ),
  effective_filter AS (
    SELECT
      CASE WHEN cr.is_super_admin THEN _branch_name
           ELSE (SELECT p.branch_name FROM profiles p WHERE p.user_id = auth.uid())
      END AS branch_filter,
      cr.is_super_admin
    FROM caller_role cr
  )
  SELECT
    mp.user_id, p.nickname, p.avatar_url,
    mp.current_rank, mp.current_level, mp.bosses_cleared,
    ROW_NUMBER() OVER (ORDER BY mp.bosses_cleared DESC) AS rank_position
  FROM member_progress mp
  JOIN profiles p ON p.user_id = mp.user_id
  CROSS JOIN effective_filter ef
  WHERE (ef.branch_filter IS NULL OR p.branch_name = ef.branch_filter)
    AND mp.bosses_cleared > 0
    AND (
      ef.is_super_admin
      OR NOT EXISTS (
        SELECT 1 FROM user_roles ur
         WHERE ur.user_id = mp.user_id
           AND ur.role IN ('super_admin', 'admin', 'branch_manager')
      )
    )
  ORDER BY mp.bosses_cleared DESC
  LIMIT _limit;
$$;
