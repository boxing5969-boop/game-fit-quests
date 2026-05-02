-- ============================================================
-- 153 QUEST v2 — 20단계 그림자 복서 MVP
-- ============================================================
-- 목적:
--   30일 전 회원의 QUEST 활동 기록과 현재 기록을 비교해
--   "어제의 나를 이긴" 성장 경험을 제공한다. 남과 경쟁이 아니라
--   과거의 나와 경쟁.
--
-- 보호 원칙 (§3 + §11):
--   - 공식 1~40 levels/missions/member_progress 일절 미수정
--   - 공식 XP 지급 0 — QUEST XP / 파이트 머니만
--   - 점수 계산에 공식 데이터(member_progress) 사용 금지 (§11-⑦)
--   - 30일 미만 가입자 fallback "분석 준비 중" (§11-⑫)
--   - 월 1회 한도 — idempotency_key shadow_boxer:30d:{KST_yyyy-mm}
--   - 파이트 머니는 grant_gems RPC 만 경유
-- ============================================================

-- =====================================================================
-- 1. boxing_shadow_boxer_claims — 그림자 복서 보상 claim 이력
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.boxing_shadow_boxer_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comparison_window text NOT NULL DEFAULT '30d',
  shadow_score numeric NOT NULL DEFAULT 0,
  current_score numeric NOT NULL DEFAULT 0,
  improved boolean NOT NULL DEFAULT false,
  growth_rate numeric NOT NULL DEFAULT 0,
  quest_xp_granted integer NOT NULL DEFAULT 0,
  gems_granted integer NOT NULL DEFAULT 0,
  respect_granted integer NOT NULL DEFAULT 0,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT boxing_shadow_boxer_claims_window_chk
    CHECK (comparison_window IN ('30d','7d','90d'))
);

CREATE INDEX IF NOT EXISTS idx_boxing_shadow_boxer_claims_user_claimed
  ON public.boxing_shadow_boxer_claims (user_id, claimed_at DESC);

CREATE INDEX IF NOT EXISTS idx_boxing_shadow_boxer_claims_user_window
  ON public.boxing_shadow_boxer_claims (user_id, comparison_window, claimed_at DESC);

ALTER TABLE public.boxing_shadow_boxer_claims ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- RLS — §11-① super_admin + USING/WITH CHECK 양쪽 명시
-- =====================================================================
DROP POLICY IF EXISTS "boxing_shadow_boxer_claims_select_self_or_admin"
  ON public.boxing_shadow_boxer_claims;
CREATE POLICY "boxing_shadow_boxer_claims_select_self_or_admin"
  ON public.boxing_shadow_boxer_claims FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_branch_manager_of(auth.uid(), user_id)
  );

DROP POLICY IF EXISTS "boxing_shadow_boxer_claims_super_admin_manage"
  ON public.boxing_shadow_boxer_claims;
CREATE POLICY "boxing_shadow_boxer_claims_super_admin_manage"
  ON public.boxing_shadow_boxer_claims FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- =====================================================================
-- 헬퍼 — shadow / current 기간의 회원 스냅샷 점수 계산
-- (§11-⑦ 공식 데이터 미주입 — boxing_engagement_events / quiz_attempts /
--  fun_challenge_attempts / cheers / journal_entries 만 사용)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.boxing_shadow_metric_period(
  p_user_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_quiz_correct integer;
  v_challenge_clear integer;
  v_journal integer;
  v_cheer_sent integer;
  v_quest_xp integer;
  v_respect integer;
  v_return_round integer;
  v_hidden_mission integer;
  v_score numeric;
BEGIN
  -- 퀴즈 정답 (boxing_quiz_attempts 직접 SELECT — 본인 데이터 RLS 통과)
  SELECT COUNT(*)::integer INTO v_quiz_correct
  FROM public.boxing_quiz_attempts
  WHERE user_id = p_user_id
    AND is_correct = true
    AND created_at >= p_start AND created_at < p_end;

  -- 챌린지 완료
  SELECT COUNT(*)::integer INTO v_challenge_clear
  FROM public.boxing_fun_challenge_attempts
  WHERE user_id = p_user_id
    AND status = 'completed'
    AND created_at >= p_start AND created_at < p_end;

  -- 일기
  SELECT COUNT(*)::integer INTO v_journal
  FROM public.champion_journal_entries
  WHERE user_id = p_user_id
    AND created_at >= p_start AND created_at < p_end;

  -- 응원 보낸 수
  SELECT COUNT(*)::integer INTO v_cheer_sent
  FROM public.boxing_cheers
  WHERE sender_user_id = p_user_id
    AND created_at >= p_start AND created_at < p_end;

  -- QUEST XP / 응원받은 RP 누적 (events 합산)
  SELECT COALESCE(SUM(quest_xp_delta), 0)::integer,
         COALESCE(SUM(respect_delta), 0)::integer
  INTO v_quest_xp, v_respect
  FROM public.boxing_engagement_events
  WHERE user_id = p_user_id
    AND created_at >= p_start AND created_at < p_end;

  -- 리턴 라운드 클레임 (있으면)
  SELECT COUNT(*)::integer INTO v_return_round
  FROM public.boxing_engagement_events
  WHERE user_id = p_user_id
    AND action = 'return_round_claimed'
    AND created_at >= p_start AND created_at < p_end;

  -- 숨겨진 미션 클레임 (있으면)
  SELECT COUNT(*)::integer INTO v_hidden_mission
  FROM public.boxing_engagement_events
  WHERE user_id = p_user_id
    AND action = 'hidden_mission_claimed'
    AND created_at >= p_start AND created_at < p_end;

  -- 종합 점수 (가중치 단순)
  v_score :=
      v_quiz_correct      * 1.5
    + v_challenge_clear   * 2.0
    + v_journal           * 1.0
    + v_cheer_sent        * 0.8
    + v_return_round      * 3.0
    + v_hidden_mission    * 4.0
    + v_quest_xp          * 0.05
    + v_respect           * 0.5;

  RETURN jsonb_build_object(
    'quiz_correct', v_quiz_correct,
    'challenge_clear', v_challenge_clear,
    'journal', v_journal,
    'cheer_sent', v_cheer_sent,
    'quest_xp', v_quest_xp,
    'respect', v_respect,
    'return_round', v_return_round,
    'hidden_mission', v_hidden_mission,
    'score', round(v_score, 2)
  );
END;
$$;

-- =====================================================================
-- A. get_shadow_boxer_snapshot(p_window_days)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_shadow_boxer_snapshot(
  p_window_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_window text;
  v_window_days integer;
  v_kst_now timestamptz;
  v_current_start timestamptz;
  v_current_end timestamptz;
  v_shadow_start timestamptz;
  v_shadow_end timestamptz;
  v_current jsonb;
  v_shadow jsonb;
  v_shadow_score numeric;
  v_current_score numeric;
  v_improved boolean;
  v_growth_rate numeric;
  v_join_at timestamptz;
  v_metrics jsonb;
  v_message text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  -- window 정규화
  v_window_days := COALESCE(p_window_days, 30);
  IF v_window_days NOT IN (7, 30, 90) THEN
    v_window_days := 30;
  END IF;
  v_window := v_window_days::text || 'd';

  v_kst_now := now() AT TIME ZONE 'Asia/Seoul';

  -- §11-⑫ 가입 30일 미만 fallback
  SELECT created_at INTO v_join_at FROM auth.users WHERE id = v_uid;
  IF v_join_at IS NULL OR v_join_at > now() - (v_window_days || ' days')::interval THEN
    RETURN jsonb_build_object(
      'success', true,
      'ready', false,
      'window_days', v_window_days,
      'reason', '가입 ' || v_window_days || '일 후부터 비교가 가능합니다.',
      'message', '아직 그림자 복서가 도착하지 않았습니다.'
    );
  END IF;

  -- 기간 정의: current = 최근 N일 / shadow = (2N~N)일 전
  v_current_end := now();
  v_current_start := now() - (v_window_days || ' days')::interval;
  v_shadow_end := v_current_start;
  v_shadow_start := v_current_start - (v_window_days || ' days')::interval;

  -- 점수 계산
  v_current := public.boxing_shadow_metric_period(v_uid, v_current_start, v_current_end);
  v_shadow := public.boxing_shadow_metric_period(v_uid, v_shadow_start, v_shadow_end);

  v_current_score := COALESCE((v_current->>'score')::numeric, 0);
  v_shadow_score := COALESCE((v_shadow->>'score')::numeric, 0);

  v_improved := v_current_score > v_shadow_score;
  IF v_shadow_score > 0 THEN
    v_growth_rate := round(((v_current_score - v_shadow_score) / v_shadow_score) * 100, 1);
  ELSE
    -- shadow 가 0 이고 current 가 양수면 무한 성장률 → 100% 로 클램프
    v_growth_rate := CASE WHEN v_current_score > 0 THEN 100 ELSE 0 END;
  END IF;

  -- 지표별 비교 배열
  v_metrics := jsonb_build_array(
    jsonb_build_object(
      'key', 'quiz',
      'label', '복싱 IQ 정답',
      'shadow', (v_shadow->>'quiz_correct')::integer,
      'current', (v_current->>'quiz_correct')::integer,
      'improved', (v_current->>'quiz_correct')::integer > (v_shadow->>'quiz_correct')::integer
    ),
    jsonb_build_object(
      'key', 'challenge',
      'label', '챌린지 클리어',
      'shadow', (v_shadow->>'challenge_clear')::integer,
      'current', (v_current->>'challenge_clear')::integer,
      'improved', (v_current->>'challenge_clear')::integer > (v_shadow->>'challenge_clear')::integer
    ),
    jsonb_build_object(
      'key', 'journal',
      'label', '챔피언 일기',
      'shadow', (v_shadow->>'journal')::integer,
      'current', (v_current->>'journal')::integer,
      'improved', (v_current->>'journal')::integer > (v_shadow->>'journal')::integer
    ),
    jsonb_build_object(
      'key', 'cheer',
      'label', '응원 보낸 수',
      'shadow', (v_shadow->>'cheer_sent')::integer,
      'current', (v_current->>'cheer_sent')::integer,
      'improved', (v_current->>'cheer_sent')::integer > (v_shadow->>'cheer_sent')::integer
    ),
    jsonb_build_object(
      'key', 'return_round',
      'label', '리턴 라운드',
      'shadow', (v_shadow->>'return_round')::integer,
      'current', (v_current->>'return_round')::integer,
      'improved', (v_current->>'return_round')::integer > (v_shadow->>'return_round')::integer
    ),
    jsonb_build_object(
      'key', 'hidden_mission',
      'label', '숨겨진 미션',
      'shadow', (v_shadow->>'hidden_mission')::integer,
      'current', (v_current->>'hidden_mission')::integer,
      'improved', (v_current->>'hidden_mission')::integer > (v_shadow->>'hidden_mission')::integer
    )
  );

  IF v_improved THEN
    v_message := v_window_days || '일 전의 당신이 링 위에 섰습니다. 지금의 당신은 그때보다 강해졌습니다.';
  ELSIF v_current_score = v_shadow_score AND v_current_score > 0 THEN
    v_message := '같은 강도를 유지하고 있습니다. 꾸준함도 강함입니다.';
  ELSE
    v_message := '이번 라운드는 실패가 아니라 다음 승부를 위한 데이터입니다.';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'ready', true,
    'window_days', v_window_days,
    'shadow_period', (v_window_days * 2) || '~' || v_window_days || '일 전',
    'current_period', '최근 ' || v_window_days || '일',
    'shadow_score', v_shadow_score,
    'current_score', v_current_score,
    'improved', v_improved,
    'growth_rate', v_growth_rate,
    'metrics', v_metrics,
    'message', v_message
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shadow_boxer_snapshot(integer) TO authenticated;

-- =====================================================================
-- B. claim_shadow_boxer_reward(p_window_days)
--    — improved=true 만 보상, 월 1회 한도 (idempotency_key)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.claim_shadow_boxer_reward(
  p_window_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_window_days integer;
  v_window text;
  v_snapshot jsonb;
  v_ready boolean;
  v_improved boolean;
  v_shadow_score numeric;
  v_current_score numeric;
  v_growth_rate numeric;
  v_kst_yyyy_mm text;
  v_idem text;
  v_xp integer := 150;
  v_gems integer := 300;
  v_respect integer := 0;
  v_claim_id uuid;
  v_already_claimed boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  v_window_days := COALESCE(p_window_days, 30);
  IF v_window_days NOT IN (7, 30, 90) THEN
    v_window_days := 30;
  END IF;
  v_window := v_window_days::text || 'd';

  v_snapshot := public.get_shadow_boxer_snapshot(v_window_days);

  v_ready := COALESCE((v_snapshot->>'ready')::boolean, false);
  v_improved := COALESCE((v_snapshot->>'improved')::boolean, false);
  v_shadow_score := COALESCE((v_snapshot->>'shadow_score')::numeric, 0);
  v_current_score := COALESCE((v_snapshot->>'current_score')::numeric, 0);
  v_growth_rate := COALESCE((v_snapshot->>'growth_rate')::numeric, 0);

  IF NOT v_ready THEN
    RAISE EXCEPTION 'shadow boxer not ready';
  END IF;
  IF NOT v_improved THEN
    RAISE EXCEPTION 'shadow boxer not improved';
  END IF;

  -- 월 1회 한도 — idempotency
  v_kst_yyyy_mm := to_char((now() AT TIME ZONE 'Asia/Seoul')::date, 'YYYY-MM');
  v_idem := concat('shadow_boxer:', v_window, ':', v_kst_yyyy_mm);

  SELECT EXISTS (
    SELECT 1 FROM public.boxing_engagement_events
    WHERE user_id = v_uid AND idempotency_key = v_idem
  ) INTO v_already_claimed;

  IF v_already_claimed THEN
    RAISE EXCEPTION 'shadow boxer reward already claimed';
  END IF;

  -- 30% 이상 성장 시 RP 보너스 +20
  IF v_growth_rate >= 30 THEN
    v_respect := 20;
  END IF;

  PERFORM public.ensure_boxing_engagement_profile(v_uid);

  INSERT INTO public.boxing_shadow_boxer_claims (
    user_id, comparison_window, shadow_score, current_score,
    improved, growth_rate, quest_xp_granted, gems_granted, respect_granted,
    metadata
  ) VALUES (
    v_uid, v_window, v_shadow_score, v_current_score,
    true, v_growth_rate, v_xp, v_gems, v_respect,
    jsonb_build_object('snapshot', v_snapshot)
  )
  RETURNING id INTO v_claim_id;

  INSERT INTO public.boxing_engagement_events (
    user_id, event_type, source_type, source_id, action,
    quest_xp_delta, gems_delta, respect_delta, idempotency_key, metadata
  ) VALUES (
    v_uid, 'reward', 'boxing_shadow_boxer', v_claim_id,
    'shadow_boxer_claimed',
    v_xp, v_gems, v_respect, v_idem,
    jsonb_build_object('window', v_window, 'growth_rate', v_growth_rate)
  )
  ON CONFLICT (user_id, idempotency_key) DO NOTHING;

  -- 프로필 누적
  UPDATE public.boxing_engagement_profiles
  SET quest_xp = quest_xp + v_xp,
      respect_points = respect_points + v_respect
  WHERE user_id = v_uid;

  -- 파이트 머니 grant_gems 경유
  IF v_gems > 0 THEN
    PERFORM public.grant_gems(v_uid, v_gems, '그림자 복서 — 어제의 나를 이긴 보상');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'claim_id', v_claim_id,
    'window_days', v_window_days,
    'shadow_score', v_shadow_score,
    'current_score', v_current_score,
    'growth_rate', v_growth_rate,
    'quest_xp_granted', v_xp,
    'gems_granted', v_gems,
    'respect_granted', v_respect,
    'message', '어제의 나를 이긴 기록은 오래 남습니다.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_shadow_boxer_reward(integer) TO authenticated;
