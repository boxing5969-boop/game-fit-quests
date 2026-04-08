
CREATE OR REPLACE FUNCTION public.get_hall_of_fame(_limit integer DEFAULT 20)
RETURNS TABLE(
  r_user_id uuid,
  r_nickname text,
  r_avatar_url text,
  r_current_rank rank_name,
  r_current_level integer,
  r_bosses_cleared integer,
  r_total_xp integer,
  r_branch_name text,
  rank_position bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    mp.user_id,
    p.nickname,
    p.avatar_url,
    mp.current_rank,
    mp.current_level,
    mp.bosses_cleared,
    mp.total_xp,
    p.branch_name,
    ROW_NUMBER() OVER (
      ORDER BY mp.bosses_cleared DESC, mp.total_xp DESC
    ) as rank_position
  FROM member_progress mp
  JOIN profiles p ON p.user_id = mp.user_id
  WHERE mp.current_rank = 'black' AND mp.current_level = 10
  ORDER BY mp.bosses_cleared DESC, mp.total_xp DESC
  LIMIT _limit;
$$;
