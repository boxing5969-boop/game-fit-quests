-- ─────────────────────────────────────────────────────────────
--  Branch-scoped ranking with super_admin override
--
--  Before this migration:
--    - All 5 ranking RPCs required _branch_name (text).
--    - Any caller (including abusive DevTools calls) could pass
--      any branch name and receive that branch's ranking.
--
--  After this migration:
--    - _branch_name gains DEFAULT NULL.
--    - Server-side role check:
--        super_admin → _branch_name is respected as-is
--                      (NULL = across all branches)
--        everyone else → silently forced to caller's own
--                        profiles.branch_name regardless of the
--                        argument
--    - Regular members cannot leak other branches' data even if
--      they call the RPC directly from the browser console.
--
--  Existing callers that pass their own branch_name (the current
--  useRankingData hooks) keep working unchanged.
--
--  Rollback: re-run the previous migration
--    20260410112928_134390a2-0956-4180-bab4-188259db604f.sql
--  to restore the old definitions.
-- ─────────────────────────────────────────────────────────────

-- 1. get_division_ranking (official total-XP leaderboard)
CREATE OR REPLACE FUNCTION public.get_division_ranking(
  _branch_name text DEFAULT NULL,
  _limit       integer DEFAULT 50
)
 RETURNS TABLE (
   r_user_id       uuid,
   r_nickname      text,
   r_avatar_url    text,
   r_current_rank  rank_name,
   r_current_level integer,
   r_bosses_cleared integer,
   r_total_xp      integer,
   r_streak_days   integer,
   rank_position   bigint
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  WITH effective_filter AS (
    SELECT
      CASE
        WHEN EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
        ) THEN _branch_name                                      -- super_admin: trust caller (NULL = all)
        ELSE (SELECT p.branch_name FROM profiles p WHERE p.user_id = auth.uid())
      END AS branch_filter
  )
  SELECT
    mp.user_id, p.nickname, p.avatar_url, mp.current_rank, mp.current_level,
    mp.bosses_cleared, mp.total_xp, mp.streak_days,
    ROW_NUMBER() OVER (
      ORDER BY rank_order(mp.current_rank) DESC,
               mp.current_level DESC,
               mp.bosses_cleared DESC,
               mp.total_xp DESC
    ) AS rank_position
  FROM member_progress mp
  JOIN profiles p ON p.user_id = mp.user_id
  CROSS JOIN effective_filter ef
  WHERE (ef.branch_filter IS NULL OR p.branch_name = ef.branch_filter)
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = mp.user_id
        AND ur.role IN ('super_admin', 'admin', 'branch_manager')
    )
  ORDER BY rank_order(mp.current_rank) DESC,
           mp.current_level DESC,
           mp.bosses_cleared DESC,
           mp.total_xp DESC
  LIMIT _limit;
$$;

-- 2. get_weekly_activity_ranking
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
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  WITH effective_filter AS (
    SELECT
      CASE
        WHEN EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
        ) THEN _branch_name
        ELSE (SELECT p.branch_name FROM profiles p WHERE p.user_id = auth.uid())
      END AS branch_filter
  )
  SELECT
    xl.user_id, p.nickname, p.avatar_url, mp.current_rank, mp.current_level,
    COALESCE(SUM(xl.amount), 0) AS weekly_xp,
    ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(xl.amount), 0) DESC) AS rank_position
  FROM xp_logs xl
  JOIN profiles p ON p.user_id = xl.user_id
  JOIN member_progress mp ON mp.user_id = xl.user_id
  CROSS JOIN effective_filter ef
  WHERE (ef.branch_filter IS NULL OR p.branch_name = ef.branch_filter)
    AND xl.created_at >= date_trunc('week', CURRENT_DATE)
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = xl.user_id
        AND ur.role IN ('super_admin', 'admin', 'branch_manager')
    )
  GROUP BY xl.user_id, p.nickname, p.avatar_url, mp.current_rank, mp.current_level
  ORDER BY weekly_xp DESC
  LIMIT _limit;
$$;

-- 3. get_monthly_risers
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
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  WITH effective_filter AS (
    SELECT
      CASE
        WHEN EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
        ) THEN _branch_name
        ELSE (SELECT p.branch_name FROM profiles p WHERE p.user_id = auth.uid())
      END AS branch_filter
  )
  SELECT
    xl.user_id, p.nickname, p.avatar_url, mp.current_rank, mp.current_level,
    COALESCE(SUM(xl.amount), 0) AS monthly_xp,
    ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(xl.amount), 0) DESC) AS rank_position
  FROM xp_logs xl
  JOIN profiles p ON p.user_id = xl.user_id
  JOIN member_progress mp ON mp.user_id = xl.user_id
  CROSS JOIN effective_filter ef
  WHERE (ef.branch_filter IS NULL OR p.branch_name = ef.branch_filter)
    AND xl.created_at >= date_trunc('month', CURRENT_DATE)
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = xl.user_id
        AND ur.role IN ('super_admin', 'admin', 'branch_manager')
    )
  GROUP BY xl.user_id, p.nickname, p.avatar_url, mp.current_rank, mp.current_level
  ORDER BY monthly_xp DESC
  LIMIT _limit;
$$;

-- 4. get_streak_ranking
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
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  WITH effective_filter AS (
    SELECT
      CASE
        WHEN EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
        ) THEN _branch_name
        ELSE (SELECT p.branch_name FROM profiles p WHERE p.user_id = auth.uid())
      END AS branch_filter
  )
  SELECT
    mp.user_id, p.nickname, p.avatar_url, mp.current_rank, mp.current_level, mp.streak_days,
    ROW_NUMBER() OVER (ORDER BY mp.streak_days DESC) AS rank_position
  FROM member_progress mp
  JOIN profiles p ON p.user_id = mp.user_id
  CROSS JOIN effective_filter ef
  WHERE (ef.branch_filter IS NULL OR p.branch_name = ef.branch_filter)
    AND mp.streak_days > 0
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = mp.user_id
        AND ur.role IN ('super_admin', 'admin', 'branch_manager')
    )
  ORDER BY mp.streak_days DESC
  LIMIT _limit;
$$;

-- 5. get_boss_conquerors
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
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  WITH effective_filter AS (
    SELECT
      CASE
        WHEN EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
        ) THEN _branch_name
        ELSE (SELECT p.branch_name FROM profiles p WHERE p.user_id = auth.uid())
      END AS branch_filter
  )
  SELECT
    mp.user_id, p.nickname, p.avatar_url, mp.current_rank, mp.current_level, mp.bosses_cleared,
    ROW_NUMBER() OVER (ORDER BY mp.bosses_cleared DESC) AS rank_position
  FROM member_progress mp
  JOIN profiles p ON p.user_id = mp.user_id
  CROSS JOIN effective_filter ef
  WHERE (ef.branch_filter IS NULL OR p.branch_name = ef.branch_filter)
    AND mp.bosses_cleared > 0
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = mp.user_id
        AND ur.role IN ('super_admin', 'admin', 'branch_manager')
    )
  ORDER BY mp.bosses_cleared DESC
  LIMIT _limit;
$$;

-- Note: get_hall_of_fame stays unchanged (it is intentionally global:
-- black Lv.10 masters across all branches are the pinnacle).
