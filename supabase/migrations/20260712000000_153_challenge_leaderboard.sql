-- =====================================================================
-- 153 챌린지 — 회원 간 별도 랭킹 (기존 명예의 전당과 분리)
--
-- 점수원: boxing_engagement_profiles.quest_xp (이미 추적 중인 누적 QUEST XP)
-- 기간:
--   · 'weekly'    — 최근 7일 quest_xp_delta SUM (boxing_engagement_events)
--   · 'monthly'   — 최근 30일 quest_xp_delta SUM
--   · 'all_time'  — boxing_engagement_profiles.quest_xp 그대로
--
-- 보호 원칙:
--   · 공식 1~40 levels/missions/member_progress 일절 미수정
--   · 공식 XP / wallet 변경 0건 — 읽기 전용 집계
--   · grant_gems 직접 호출 0건
-- =====================================================================

-- ─── 1. RPC: get_153_challenge_leaderboard(period, limit) ─────────────
CREATE OR REPLACE FUNCTION public.get_153_challenge_leaderboard(
  p_period text DEFAULT 'weekly',
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  rank integer,
  user_id uuid,
  display_name text,
  branch_name text,
  score integer,
  is_me boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_viewer uuid := auth.uid();
  v_since timestamptz;
BEGIN
  IF v_viewer IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  IF p_period NOT IN ('weekly','monthly','all_time') THEN
    RAISE EXCEPTION 'invalid period — must be weekly/monthly/all_time';
  END IF;

  IF p_period = 'weekly' THEN
    v_since := now() - interval '7 days';
  ELSIF p_period = 'monthly' THEN
    v_since := now() - interval '30 days';
  ELSE
    v_since := NULL; -- all_time
  END IF;

  IF p_period = 'all_time' THEN
    RETURN QUERY
    WITH ranked AS (
      SELECT
        ep.user_id,
        ep.quest_xp AS score,
        ROW_NUMBER() OVER (ORDER BY ep.quest_xp DESC, ep.user_id ASC) AS rnk
      FROM public.boxing_engagement_profiles ep
      WHERE ep.quest_xp > 0
    )
    SELECT
      r.rnk::integer AS rank,
      r.user_id,
      COALESCE(NULLIF(p.nickname, ''), NULLIF(p.name, ''), '익명 복서') AS display_name,
      COALESCE(p.branch_name, '미지정')::text AS branch_name,
      r.score::integer AS score,
      (r.user_id = v_viewer) AS is_me
    FROM ranked r
    LEFT JOIN public.profiles p ON p.user_id = r.user_id
    ORDER BY r.rnk
    LIMIT GREATEST(1, LEAST(p_limit, 100));
  ELSE
    RETURN QUERY
    WITH agg AS (
      SELECT
        e.user_id,
        COALESCE(SUM(e.quest_xp_delta), 0)::integer AS score
      FROM public.boxing_engagement_events e
      WHERE e.created_at >= v_since
      GROUP BY e.user_id
      HAVING COALESCE(SUM(e.quest_xp_delta), 0) > 0
    ),
    ranked AS (
      SELECT
        a.user_id,
        a.score,
        ROW_NUMBER() OVER (ORDER BY a.score DESC, a.user_id ASC) AS rnk
      FROM agg a
    )
    SELECT
      r.rnk::integer AS rank,
      r.user_id,
      COALESCE(NULLIF(p.nickname, ''), NULLIF(p.name, ''), '익명 복서') AS display_name,
      COALESCE(p.branch_name, '미지정')::text AS branch_name,
      r.score,
      (r.user_id = v_viewer) AS is_me
    FROM ranked r
    LEFT JOIN public.profiles p ON p.user_id = r.user_id
    ORDER BY r.rnk
    LIMIT GREATEST(1, LEAST(p_limit, 100));
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_153_challenge_leaderboard(text, integer) TO authenticated;

-- ─── 2. RPC: get_my_153_challenge_rank(period) ────────────────────────
-- 내 점수 + 내 순위 + 총 참여자 수
CREATE OR REPLACE FUNCTION public.get_my_153_challenge_rank(
  p_period text DEFAULT 'weekly'
)
RETURNS TABLE (
  my_rank integer,
  my_score integer,
  total_participants integer,
  period text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_viewer uuid := auth.uid();
  v_since timestamptz;
  v_my_score integer := 0;
  v_total integer := 0;
  v_rank integer := 0;
BEGIN
  IF v_viewer IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  IF p_period NOT IN ('weekly','monthly','all_time') THEN
    RAISE EXCEPTION 'invalid period — must be weekly/monthly/all_time';
  END IF;

  IF p_period = 'weekly' THEN
    v_since := now() - interval '7 days';
  ELSIF p_period = 'monthly' THEN
    v_since := now() - interval '30 days';
  ELSE
    v_since := NULL;
  END IF;

  IF p_period = 'all_time' THEN
    SELECT COALESCE(ep.quest_xp, 0) INTO v_my_score
    FROM public.boxing_engagement_profiles ep
    WHERE ep.user_id = v_viewer;
    v_my_score := COALESCE(v_my_score, 0);

    SELECT COUNT(*) INTO v_total
    FROM public.boxing_engagement_profiles ep
    WHERE ep.quest_xp > 0;

    IF v_my_score = 0 THEN
      v_rank := 0;
    ELSE
      SELECT COUNT(*) + 1 INTO v_rank
      FROM public.boxing_engagement_profiles ep
      WHERE ep.quest_xp > v_my_score;
    END IF;
  ELSE
    SELECT COALESCE(SUM(e.quest_xp_delta), 0) INTO v_my_score
    FROM public.boxing_engagement_events e
    WHERE e.user_id = v_viewer
      AND e.created_at >= v_since;
    v_my_score := COALESCE(v_my_score, 0);

    SELECT COUNT(DISTINCT e.user_id) INTO v_total
    FROM public.boxing_engagement_events e
    WHERE e.created_at >= v_since
      AND e.quest_xp_delta > 0;

    IF v_my_score = 0 THEN
      v_rank := 0;
    ELSE
      SELECT COUNT(*) + 1 INTO v_rank
      FROM (
        SELECT e.user_id, SUM(e.quest_xp_delta) AS s
        FROM public.boxing_engagement_events e
        WHERE e.created_at >= v_since
        GROUP BY e.user_id
        HAVING SUM(e.quest_xp_delta) > v_my_score
      ) sub;
    END IF;
  END IF;

  RETURN QUERY SELECT v_rank, v_my_score, COALESCE(v_total, 0), p_period;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_153_challenge_rank(text) TO authenticated;
