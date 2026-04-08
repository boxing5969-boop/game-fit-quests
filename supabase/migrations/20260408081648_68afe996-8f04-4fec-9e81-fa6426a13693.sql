
-- Add rival_id to member_progress
ALTER TABLE public.member_progress ADD COLUMN rival_id uuid DEFAULT NULL;

-- Allow same-branch members to view each other's profiles
CREATE POLICY "Same branch members view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  branch_name = (SELECT p.branch_name FROM public.profiles p WHERE p.user_id = auth.uid())
);

-- Allow same-branch members to view each other's progress
CREATE POLICY "Same branch members view progress"
ON public.member_progress
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT p.user_id FROM public.profiles p
    WHERE p.branch_name = (SELECT p2.branch_name FROM public.profiles p2 WHERE p2.user_id = auth.uid())
  )
);

-- Rank order helper
CREATE OR REPLACE FUNCTION public.rank_order(_rank rank_name)
RETURNS integer
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _rank
    WHEN 'white' THEN 1
    WHEN 'blue' THEN 2
    WHEN 'red' THEN 3
    WHEN 'black' THEN 4
    ELSE 0
  END;
$$;

-- Get division ranking (by branch_name)
CREATE OR REPLACE FUNCTION public.get_division_ranking(_branch_name text, _limit integer DEFAULT 50)
RETURNS TABLE(
  r_user_id uuid,
  r_nickname text,
  r_avatar_url text,
  r_current_rank rank_name,
  r_current_level integer,
  r_bosses_cleared integer,
  r_total_xp integer,
  r_streak_days integer,
  rank_position bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    mp.user_id,
    p.nickname,
    p.avatar_url,
    mp.current_rank,
    mp.current_level,
    mp.bosses_cleared,
    mp.total_xp,
    mp.streak_days,
    ROW_NUMBER() OVER (
      ORDER BY rank_order(mp.current_rank) DESC,
              mp.current_level DESC,
              mp.bosses_cleared DESC,
              mp.total_xp DESC
    ) as rank_position
  FROM member_progress mp
  JOIN profiles p ON p.user_id = mp.user_id
  WHERE p.branch_name = _branch_name
  ORDER BY rank_order(mp.current_rank) DESC,
           mp.current_level DESC,
           mp.bosses_cleared DESC,
           mp.total_xp DESC
  LIMIT _limit;
$$;

-- Get rivals above me
CREATE OR REPLACE FUNCTION public.get_rivals_above(_user_id uuid, _count integer DEFAULT 3)
RETURNS TABLE(
  r_user_id uuid,
  r_nickname text,
  r_avatar_url text,
  r_current_rank rank_name,
  r_current_level integer,
  r_bosses_cleared integer,
  r_total_xp integer,
  r_streak_days integer,
  rank_position bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH my_branch AS (
    SELECT branch_name FROM profiles WHERE profiles.user_id = _user_id
  ),
  ranked AS (
    SELECT
      mp.user_id,
      p.nickname,
      p.avatar_url,
      mp.current_rank,
      mp.current_level,
      mp.bosses_cleared,
      mp.total_xp,
      mp.streak_days,
      ROW_NUMBER() OVER (
        ORDER BY rank_order(mp.current_rank) DESC,
                mp.current_level DESC,
                mp.bosses_cleared DESC,
                mp.total_xp DESC
      ) as rank_position
    FROM member_progress mp
    JOIN profiles p ON p.user_id = mp.user_id
    WHERE p.branch_name = (SELECT branch_name FROM my_branch)
  ),
  my_pos AS (
    SELECT rank_position FROM ranked WHERE ranked.user_id = _user_id
  )
  SELECT r.user_id, r.nickname, r.avatar_url, r.current_rank, r.current_level,
         r.bosses_cleared, r.total_xp, r.streak_days, r.rank_position
  FROM ranked r, my_pos m
  WHERE r.rank_position < m.rank_position
  ORDER BY r.rank_position DESC
  LIMIT _count;
$$;

-- Weekly activity ranking
CREATE OR REPLACE FUNCTION public.get_weekly_activity_ranking(_branch_name text, _limit integer DEFAULT 20)
RETURNS TABLE(
  r_user_id uuid,
  r_nickname text,
  r_avatar_url text,
  r_current_rank rank_name,
  r_current_level integer,
  weekly_xp bigint,
  rank_position bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    xl.user_id,
    p.nickname,
    p.avatar_url,
    mp.current_rank,
    mp.current_level,
    COALESCE(SUM(xl.amount), 0) as weekly_xp,
    ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(xl.amount), 0) DESC) as rank_position
  FROM xp_logs xl
  JOIN profiles p ON p.user_id = xl.user_id
  JOIN member_progress mp ON mp.user_id = xl.user_id
  WHERE p.branch_name = _branch_name
    AND xl.created_at >= date_trunc('week', CURRENT_DATE)
  GROUP BY xl.user_id, p.nickname, p.avatar_url, mp.current_rank, mp.current_level
  ORDER BY weekly_xp DESC
  LIMIT _limit;
$$;

-- Monthly risers
CREATE OR REPLACE FUNCTION public.get_monthly_risers(_branch_name text, _limit integer DEFAULT 10)
RETURNS TABLE(
  r_user_id uuid,
  r_nickname text,
  r_avatar_url text,
  r_current_rank rank_name,
  r_current_level integer,
  monthly_xp bigint,
  rank_position bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    xl.user_id,
    p.nickname,
    p.avatar_url,
    mp.current_rank,
    mp.current_level,
    COALESCE(SUM(xl.amount), 0) as monthly_xp,
    ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(xl.amount), 0) DESC) as rank_position
  FROM xp_logs xl
  JOIN profiles p ON p.user_id = xl.user_id
  JOIN member_progress mp ON mp.user_id = xl.user_id
  WHERE p.branch_name = _branch_name
    AND xl.created_at >= date_trunc('month', CURRENT_DATE)
  GROUP BY xl.user_id, p.nickname, p.avatar_url, mp.current_rank, mp.current_level
  ORDER BY monthly_xp DESC
  LIMIT _limit;
$$;

-- Streak ranking
CREATE OR REPLACE FUNCTION public.get_streak_ranking(_branch_name text, _limit integer DEFAULT 10)
RETURNS TABLE(
  r_user_id uuid,
  r_nickname text,
  r_avatar_url text,
  r_current_rank rank_name,
  r_current_level integer,
  r_streak_days integer,
  rank_position bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    mp.user_id,
    p.nickname,
    p.avatar_url,
    mp.current_rank,
    mp.current_level,
    mp.streak_days,
    ROW_NUMBER() OVER (ORDER BY mp.streak_days DESC) as rank_position
  FROM member_progress mp
  JOIN profiles p ON p.user_id = mp.user_id
  WHERE p.branch_name = _branch_name
    AND mp.streak_days > 0
  ORDER BY mp.streak_days DESC
  LIMIT _limit;
$$;

-- Boss conquerors
CREATE OR REPLACE FUNCTION public.get_boss_conquerors(_branch_name text, _limit integer DEFAULT 10)
RETURNS TABLE(
  r_user_id uuid,
  r_nickname text,
  r_avatar_url text,
  r_current_rank rank_name,
  r_current_level integer,
  r_bosses_cleared integer,
  rank_position bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    mp.user_id,
    p.nickname,
    p.avatar_url,
    mp.current_rank,
    mp.current_level,
    mp.bosses_cleared,
    ROW_NUMBER() OVER (ORDER BY mp.bosses_cleared DESC) as rank_position
  FROM member_progress mp
  JOIN profiles p ON p.user_id = mp.user_id
  WHERE p.branch_name = _branch_name
    AND mp.bosses_cleared > 0
  ORDER BY mp.bosses_cleared DESC
  LIMIT _limit;
$$;

-- Set rival function
CREATE OR REPLACE FUNCTION public.set_rival(_rival_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE member_progress
  SET rival_id = _rival_id
  WHERE user_id = auth.uid();
END;
$$;
