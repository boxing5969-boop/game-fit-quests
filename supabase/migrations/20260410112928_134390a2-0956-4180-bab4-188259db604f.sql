
-- Exclude admin/branch_manager from division ranking
CREATE OR REPLACE FUNCTION public.get_division_ranking(_branch_name text, _limit integer DEFAULT 50)
 RETURNS TABLE(r_user_id uuid, r_nickname text, r_avatar_url text, r_current_rank rank_name, r_current_level integer, r_bosses_cleared integer, r_total_xp integer, r_streak_days integer, rank_position bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT
    mp.user_id, p.nickname, p.avatar_url, mp.current_rank, mp.current_level,
    mp.bosses_cleared, mp.total_xp, mp.streak_days,
    ROW_NUMBER() OVER (ORDER BY rank_order(mp.current_rank) DESC, mp.current_level DESC, mp.bosses_cleared DESC, mp.total_xp DESC) as rank_position
  FROM member_progress mp
  JOIN profiles p ON p.user_id = mp.user_id
  WHERE p.branch_name = _branch_name
    AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = mp.user_id AND ur.role IN ('super_admin', 'admin', 'branch_manager'))
  ORDER BY rank_order(mp.current_rank) DESC, mp.current_level DESC, mp.bosses_cleared DESC, mp.total_xp DESC
  LIMIT _limit;
$$;

-- Exclude from weekly activity ranking
CREATE OR REPLACE FUNCTION public.get_weekly_activity_ranking(_branch_name text, _limit integer DEFAULT 20)
 RETURNS TABLE(r_user_id uuid, r_nickname text, r_avatar_url text, r_current_rank rank_name, r_current_level integer, weekly_xp bigint, rank_position bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT
    xl.user_id, p.nickname, p.avatar_url, mp.current_rank, mp.current_level,
    COALESCE(SUM(xl.amount), 0) as weekly_xp,
    ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(xl.amount), 0) DESC) as rank_position
  FROM xp_logs xl
  JOIN profiles p ON p.user_id = xl.user_id
  JOIN member_progress mp ON mp.user_id = xl.user_id
  WHERE p.branch_name = _branch_name
    AND xl.created_at >= date_trunc('week', CURRENT_DATE)
    AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = xl.user_id AND ur.role IN ('super_admin', 'admin', 'branch_manager'))
  GROUP BY xl.user_id, p.nickname, p.avatar_url, mp.current_rank, mp.current_level
  ORDER BY weekly_xp DESC
  LIMIT _limit;
$$;

-- Exclude from monthly risers
CREATE OR REPLACE FUNCTION public.get_monthly_risers(_branch_name text, _limit integer DEFAULT 10)
 RETURNS TABLE(r_user_id uuid, r_nickname text, r_avatar_url text, r_current_rank rank_name, r_current_level integer, monthly_xp bigint, rank_position bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT
    xl.user_id, p.nickname, p.avatar_url, mp.current_rank, mp.current_level,
    COALESCE(SUM(xl.amount), 0) as monthly_xp,
    ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(xl.amount), 0) DESC) as rank_position
  FROM xp_logs xl
  JOIN profiles p ON p.user_id = xl.user_id
  JOIN member_progress mp ON mp.user_id = xl.user_id
  WHERE p.branch_name = _branch_name
    AND xl.created_at >= date_trunc('month', CURRENT_DATE)
    AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = xl.user_id AND ur.role IN ('super_admin', 'admin', 'branch_manager'))
  GROUP BY xl.user_id, p.nickname, p.avatar_url, mp.current_rank, mp.current_level
  ORDER BY monthly_xp DESC
  LIMIT _limit;
$$;

-- Exclude from streak ranking
CREATE OR REPLACE FUNCTION public.get_streak_ranking(_branch_name text, _limit integer DEFAULT 10)
 RETURNS TABLE(r_user_id uuid, r_nickname text, r_avatar_url text, r_current_rank rank_name, r_current_level integer, r_streak_days integer, rank_position bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT
    mp.user_id, p.nickname, p.avatar_url, mp.current_rank, mp.current_level, mp.streak_days,
    ROW_NUMBER() OVER (ORDER BY mp.streak_days DESC) as rank_position
  FROM member_progress mp
  JOIN profiles p ON p.user_id = mp.user_id
  WHERE p.branch_name = _branch_name
    AND mp.streak_days > 0
    AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = mp.user_id AND ur.role IN ('super_admin', 'admin', 'branch_manager'))
  ORDER BY mp.streak_days DESC
  LIMIT _limit;
$$;

-- Exclude from boss conquerors
CREATE OR REPLACE FUNCTION public.get_boss_conquerors(_branch_name text, _limit integer DEFAULT 10)
 RETURNS TABLE(r_user_id uuid, r_nickname text, r_avatar_url text, r_current_rank rank_name, r_current_level integer, r_bosses_cleared integer, rank_position bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT
    mp.user_id, p.nickname, p.avatar_url, mp.current_rank, mp.current_level, mp.bosses_cleared,
    ROW_NUMBER() OVER (ORDER BY mp.bosses_cleared DESC) as rank_position
  FROM member_progress mp
  JOIN profiles p ON p.user_id = mp.user_id
  WHERE p.branch_name = _branch_name
    AND mp.bosses_cleared > 0
    AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = mp.user_id AND ur.role IN ('super_admin', 'admin', 'branch_manager'))
  ORDER BY mp.bosses_cleared DESC
  LIMIT _limit;
$$;

-- Exclude from hall of fame
CREATE OR REPLACE FUNCTION public.get_hall_of_fame(_limit integer DEFAULT 20)
 RETURNS TABLE(r_user_id uuid, r_nickname text, r_avatar_url text, r_current_rank rank_name, r_current_level integer, r_bosses_cleared integer, r_total_xp integer, r_branch_name text, rank_position bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT
    mp.user_id, p.nickname, p.avatar_url, mp.current_rank, mp.current_level,
    mp.bosses_cleared, mp.total_xp, p.branch_name,
    ROW_NUMBER() OVER (ORDER BY mp.bosses_cleared DESC, mp.total_xp DESC) as rank_position
  FROM member_progress mp
  JOIN profiles p ON p.user_id = mp.user_id
  WHERE mp.current_rank = 'black' AND mp.current_level = 10
    AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = mp.user_id AND ur.role IN ('super_admin', 'admin', 'branch_manager'))
  ORDER BY mp.bosses_cleared DESC, mp.total_xp DESC
  LIMIT _limit;
$$;
