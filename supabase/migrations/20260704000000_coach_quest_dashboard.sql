-- ============================================================
-- 153 QUEST v2 — 22단계 코치 대시보드 QUEST 데이터 확장
-- ============================================================
-- 목적:
--   코치/관장이 회원의 QUEST 활동, 복귀 위험, 칭찬 대상,
--   코너맨/짐 레이드 기여를 한 화면에서 본다.
--
-- 보호 원칙 (§3 + §11):
--   - 공식 1~40 levels/missions/member_progress 일절 미수정 (SELECT 만)
--   - 공식 미션 승인 흐름 무수정 — 본 RPC 는 표시 전용
--   - wallet 직접 update 0
--   - 권한 검증 RPC 내부 (§11-⑮) — 클라이언트만 믿지 마라
--   - 민감정보 화이트리스트 (phone/email/birth_date/address 미반환)
--   - N+1 회피 — 단일 CTE 쿼리로 회원 1000명 지점도 1회 호출
--
-- 권한 매트릭스:
--   - super_admin: 전체 / 모든 branch 조회 가능
--   - branch_manager: 자기 branch 만 (운영에서 'coach' 도 'branch_manager' 로 변환됨)
--   - 일반 회원: 차단 (RAISE EXCEPTION)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_coach_quest_dashboard(
  p_branch_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_super boolean;
  v_my_branch text;
  v_target_branch text;
  v_kst_now timestamptz;
  v_seven_days_ago timestamptz;
  v_summary jsonb;
  v_at_risk jsonb;
  v_praise jsonb;
  v_community jsonb;
  v_total_members integer;
  v_active_quest_7d integer;
  v_quiz_7d integer;
  v_challenge_7d integer;
  v_journal_7d integer;
  v_cheer_7d integer;
  v_return_candidates integer;
  v_cornerman_pairs integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  -- §11-⑮ 권한 검증 — 클라이언트만 믿지 마라
  v_is_super := public.has_role(v_uid, 'super_admin');

  IF NOT v_is_super
     AND NOT public.has_role(v_uid, 'branch_manager')
     AND NOT public.has_role(v_uid, 'coach') THEN
    RAISE EXCEPTION 'insufficient permissions';
  END IF;

  -- branch_manager 는 자기 branch 만
  SELECT branch_name INTO v_my_branch
  FROM public.profiles WHERE id = v_uid;

  IF v_is_super THEN
    v_target_branch := COALESCE(p_branch_name, v_my_branch);
  ELSE
    -- 비-super_admin 은 자기 branch 만 강제 (인자 무시)
    v_target_branch := v_my_branch;
    IF p_branch_name IS NOT NULL AND p_branch_name <> v_my_branch THEN
      RAISE EXCEPTION 'branch scope mismatch';
    END IF;
  END IF;

  IF v_target_branch IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'reason', 'no branch scope',
      'summary', jsonb_build_object(),
      'at_risk_members', '[]'::jsonb,
      'praise_targets', '[]'::jsonb,
      'community', jsonb_build_object()
    );
  END IF;

  v_kst_now := now() AT TIME ZONE 'Asia/Seoul';
  v_seven_days_ago := now() - INTERVAL '7 days';

  -- ============================================================
  -- 1. summary
  -- ============================================================

  SELECT COUNT(*)::integer INTO v_total_members
  FROM public.profiles
  WHERE branch_name = v_target_branch
    AND COALESCE(role::text, 'member') = 'member';

  SELECT COUNT(DISTINCT e.user_id)::integer INTO v_active_quest_7d
  FROM public.boxing_engagement_events e
  JOIN public.profiles p ON p.id = e.user_id
  WHERE p.branch_name = v_target_branch
    AND e.created_at >= v_seven_days_ago;

  SELECT COUNT(*)::integer INTO v_quiz_7d
  FROM public.boxing_quiz_attempts a
  JOIN public.profiles p ON p.id = a.user_id
  WHERE p.branch_name = v_target_branch
    AND a.created_at >= v_seven_days_ago;

  SELECT COUNT(*)::integer INTO v_challenge_7d
  FROM public.boxing_fun_challenge_attempts a
  JOIN public.profiles p ON p.id = a.user_id
  WHERE p.branch_name = v_target_branch
    AND a.status = 'completed'
    AND a.created_at >= v_seven_days_ago;

  SELECT COUNT(*)::integer INTO v_journal_7d
  FROM public.champion_journal_entries j
  JOIN public.profiles p ON p.id = j.user_id
  WHERE p.branch_name = v_target_branch
    AND j.created_at >= v_seven_days_ago;

  SELECT COUNT(*)::integer INTO v_cheer_7d
  FROM public.boxing_cheers c
  JOIN public.profiles p ON p.id = c.sender_user_id
  WHERE p.branch_name = v_target_branch
    AND c.created_at >= v_seven_days_ago;

  -- 복귀 대상: 마지막 활동 7일 이상 (boxing_engagement_events 기준)
  WITH last_activity AS (
    SELECT p.id AS user_id, MAX(e.created_at) AS last_at
    FROM public.profiles p
    LEFT JOIN public.boxing_engagement_events e ON e.user_id = p.id
    WHERE p.branch_name = v_target_branch
      AND COALESCE(p.role::text, 'member') = 'member'
    GROUP BY p.id
  )
  SELECT COUNT(*)::integer INTO v_return_candidates
  FROM last_activity
  WHERE last_at IS NULL OR last_at < now() - INTERVAL '7 days';

  -- 코너맨 active pair 수
  SELECT COUNT(*)::integer INTO v_cornerman_pairs
  FROM public.boxing_cornerman_pairs cp
  WHERE cp.status = 'active'
    AND cp.branch_name = v_target_branch;

  v_summary := jsonb_build_object(
    'total_members', v_total_members,
    'active_quest_members_7d', v_active_quest_7d,
    'quiz_attempts_7d', v_quiz_7d,
    'challenge_clears_7d', v_challenge_7d,
    'journals_7d', v_journal_7d,
    'cheers_7d', v_cheer_7d,
    'return_round_candidates', v_return_candidates,
    'cornerman_active_pairs', v_cornerman_pairs
  );

  -- ============================================================
  -- 2. at_risk_members — 7일 이상 비활동 + 정렬 inactive_days DESC
  --    민감정보 화이트리스트 (phone/email/birth_date/address 미포함)
  -- ============================================================
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', x.user_id,
    'display_name', x.display_name,
    'current_rank', x.current_rank,
    'current_level', x.current_level,
    'last_activity_at', x.last_at,
    'inactive_days', x.inactive_days,
    'suggested_action', x.suggested_action
  ) ORDER BY x.inactive_days DESC), '[]'::jsonb) INTO v_at_risk
  FROM (
    WITH last_activity AS (
      SELECT p.id AS user_id,
             p.display_name,
             COALESCE(mp.current_rank::text, 'white') AS current_rank,
             COALESCE(mp.current_level, 1) AS current_level,
             MAX(e.created_at) AS last_at
      FROM public.profiles p
      LEFT JOIN public.member_progress mp ON mp.user_id = p.id
      LEFT JOIN public.boxing_engagement_events e ON e.user_id = p.id
      WHERE p.branch_name = v_target_branch
        AND COALESCE(p.role::text, 'member') = 'member'
      GROUP BY p.id, p.display_name, mp.current_rank, mp.current_level
    )
    SELECT user_id, display_name, current_rank, current_level, last_at,
      CASE
        WHEN last_at IS NULL THEN 999
        ELSE GREATEST(0, EXTRACT(DAY FROM (now() - last_at))::integer)
      END AS inactive_days,
      CASE
        WHEN last_at IS NULL THEN '신규/완전 비활성 — 첫 인사 권장'
        WHEN last_at < now() - INTERVAL '30 days' THEN '리스타트 코치 한마디 권장'
        WHEN last_at < now() - INTERVAL '14 days' THEN '리턴 라운드 권장 + 코치 메시지'
        WHEN last_at < now() - INTERVAL '7 days' THEN '리턴 라운드 권장'
        ELSE '관찰'
      END AS suggested_action
    FROM last_activity
    WHERE last_at IS NULL OR last_at < now() - INTERVAL '7 days'
    LIMIT 30
  ) x;

  -- ============================================================
  -- 3. praise_targets — 이번 주 두드러진 활동 회원
  --    (정렬: 활동 합산 DESC)
  -- ============================================================
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', x.user_id,
    'display_name', x.display_name,
    'current_rank', x.current_rank,
    'current_level', x.current_level,
    'reason', x.reason,
    'metric', x.metric
  ) ORDER BY x.score DESC), '[]'::jsonb) INTO v_praise
  FROM (
    WITH weekly AS (
      SELECT p.id AS user_id,
             p.display_name,
             COALESCE(mp.current_rank::text, 'white') AS current_rank,
             COALESCE(mp.current_level, 1) AS current_level,
             COALESCE((SELECT COUNT(*) FROM public.boxing_quiz_attempts qa
                       WHERE qa.user_id = p.id AND qa.is_correct = true
                         AND qa.created_at >= v_seven_days_ago), 0) AS quiz_w,
             COALESCE((SELECT COUNT(*) FROM public.boxing_fun_challenge_attempts ca
                       WHERE ca.user_id = p.id AND ca.status = 'completed'
                         AND ca.created_at >= v_seven_days_ago), 0) AS challenge_w,
             COALESCE((SELECT COUNT(*) FROM public.champion_journal_entries je
                       WHERE je.user_id = p.id
                         AND je.created_at >= v_seven_days_ago), 0) AS journal_w,
             COALESCE((SELECT COUNT(*) FROM public.boxing_cheers ch
                       WHERE ch.sender_user_id = p.id
                         AND ch.created_at >= v_seven_days_ago), 0) AS cheer_w,
             COALESCE((SELECT COUNT(*) FROM public.boxing_engagement_events ee
                       WHERE ee.user_id = p.id
                         AND ee.action = 'return_round_claimed'
                         AND ee.created_at >= v_seven_days_ago), 0) AS return_w
      FROM public.profiles p
      LEFT JOIN public.member_progress mp ON mp.user_id = p.id
      WHERE p.branch_name = v_target_branch
        AND COALESCE(p.role::text, 'member') = 'member'
    )
    SELECT user_id, display_name, current_rank, current_level,
      (quiz_w * 1.5 + challenge_w * 2.0 + journal_w * 1.0 + cheer_w * 0.8 + return_w * 5.0) AS score,
      CASE
        WHEN return_w > 0 THEN '복귀 — 따뜻한 환영 한마디'
        WHEN quiz_w >= 5 THEN '복싱 IQ 학습 강점 — 머리로 치는 펀치 칭찬'
        WHEN challenge_w >= 3 THEN '도전 라운드 누적 — 꾸준함 칭찬'
        WHEN journal_w >= 5 THEN '챔피언 일기 누적 — 기록하는 복서 칭찬'
        WHEN cheer_w >= 5 THEN '응원 활동 — 코너맨 멘탈 칭찬'
        ELSE '꾸준한 활동 — 가벼운 격려'
      END AS reason,
      concat(
        '퀴즈 ', quiz_w, ' · 챌린지 ', challenge_w,
        ' · 일기 ', journal_w, ' · 응원 ', cheer_w,
        CASE WHEN return_w > 0 THEN ' · 복귀 1' ELSE '' END
      ) AS metric
    FROM weekly
    WHERE quiz_w + challenge_w + journal_w + cheer_w + return_w > 0
    ORDER BY score DESC
    LIMIT 10
  ) x;

  -- ============================================================
  -- 4. community — 응원 / 코너맨 / 짐 레이드 요약
  -- ============================================================
  v_community := jsonb_build_object(
    'active_cornerman_pairs', v_cornerman_pairs,
    'cheers_sent_7d', v_cheer_7d,
    'top_respect_members', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'user_id', x.user_id,
        'display_name', x.display_name,
        'respect_points', x.rp
      ) ORDER BY x.rp DESC), '[]'::jsonb)
      FROM (
        SELECT p.id AS user_id, p.display_name, prof.respect_points AS rp
        FROM public.profiles p
        JOIN public.boxing_engagement_profiles prof ON prof.user_id = p.id
        WHERE p.branch_name = v_target_branch
          AND COALESCE(p.role::text, 'member') = 'member'
          AND prof.respect_points > 0
        ORDER BY prof.respect_points DESC
        LIMIT 5
      ) x
    ),
    'gym_raid_progress', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'raid_id', r.id,
        'title', r.title,
        'raid_type', r.raid_type,
        'current_value', r.current_value,
        'target_value', r.target_value,
        'percentage', LEAST(100,
          CASE WHEN r.target_value > 0
            THEN ROUND((r.current_value / r.target_value) * 100, 1)
            ELSE 0
          END
        ),
        'end_date', r.end_date,
        'status', r.status
      ) ORDER BY r.end_date ASC), '[]'::jsonb)
      FROM public.boxing_gym_raids r
      WHERE r.branch_name = v_target_branch
        AND r.status IN ('active', 'completed')
    ),
    'gym_raid_top_contributors', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'user_id', x.user_id,
        'display_name', x.display_name,
        'contribution_count', x.cnt
      ) ORDER BY x.cnt DESC), '[]'::jsonb)
      FROM (
        SELECT p.id AS user_id, p.display_name, COUNT(c.id) AS cnt
        FROM public.boxing_gym_raid_contributions c
        JOIN public.boxing_gym_raids r ON r.id = c.raid_id
        JOIN public.profiles p ON p.id = c.user_id
        WHERE r.branch_name = v_target_branch
          AND c.contributed_at >= v_seven_days_ago
        GROUP BY p.id, p.display_name
        ORDER BY cnt DESC
        LIMIT 5
      ) x
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'branch', v_target_branch,
    'summary', v_summary,
    'at_risk_members', v_at_risk,
    'praise_targets', v_praise,
    'community', v_community,
    'generated_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_coach_quest_dashboard(text) TO authenticated;
