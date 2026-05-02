-- ============================================================
-- 153 QUEST v1.5 — 16단계 숨겨진 미션 + 복싱 IQ 리그
-- ============================================================
-- 목적:
--   회원의 좋은 행동(응원, 일기, 퀴즈, 챌린지, 복귀, 컨디션 기록 등)을
--   숨겨진 미션으로 발견·보상한다. 복싱 IQ 리그는 퀴즈 학습을 등급으로
--   요약하여 지속 동기를 만든다.
-- 보호 원칙:
--   - 공식 1~40 levels/missions/member_progress 일절 미수정
--   - 공식 XP 지급 0 — QUEST XP / 파이트 머니 / RP 만
--   - 파이트 머니는 grant_gems RPC 만 경유
--   - check_and_claim 호출 빈도 가드 (early return 우선)
--   - active 카탈로그 + claim 멱등성으로 중복 보상 차단
-- ============================================================

-- =====================================================================
-- 1. boxing_hidden_missions (카탈로그)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.boxing_hidden_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  trigger_type text NOT NULL,
  reward_quest_xp integer NOT NULL DEFAULT 0,
  reward_gems integer NOT NULL DEFAULT 0,
  reward_respect integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boxing_hidden_missions_active_sort
  ON public.boxing_hidden_missions (active, sort_order);

ALTER TABLE public.boxing_hidden_missions ENABLE ROW LEVEL SECURITY;

-- 회원 active SELECT
DROP POLICY IF EXISTS "boxing_hidden_missions_select_active_or_admin"
  ON public.boxing_hidden_missions;
CREATE POLICY "boxing_hidden_missions_select_active_or_admin"
  ON public.boxing_hidden_missions FOR SELECT TO authenticated
  USING (active = true OR public.has_role(auth.uid(), 'super_admin'));

-- super_admin 관리
DROP POLICY IF EXISTS "boxing_hidden_missions_super_admin_manage"
  ON public.boxing_hidden_missions;
CREATE POLICY "boxing_hidden_missions_super_admin_manage"
  ON public.boxing_hidden_missions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- =====================================================================
-- 2. boxing_hidden_mission_claims
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.boxing_hidden_mission_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES public.boxing_hidden_missions(id) ON DELETE CASCADE,
  quest_xp_granted integer NOT NULL DEFAULT 0,
  gems_granted integer NOT NULL DEFAULT 0,
  respect_granted integer NOT NULL DEFAULT 0,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT boxing_hidden_mission_claims_unique UNIQUE (user_id, mission_id)
);

CREATE INDEX IF NOT EXISTS idx_boxing_hidden_mission_claims_user_claimed
  ON public.boxing_hidden_mission_claims (user_id, claimed_at DESC);

ALTER TABLE public.boxing_hidden_mission_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boxing_hidden_mission_claims_select_self_or_admin"
  ON public.boxing_hidden_mission_claims;
CREATE POLICY "boxing_hidden_mission_claims_select_self_or_admin"
  ON public.boxing_hidden_mission_claims FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_branch_manager_of(auth.uid(), user_id)
  );

DROP POLICY IF EXISTS "boxing_hidden_mission_claims_super_admin_manage"
  ON public.boxing_hidden_mission_claims;
CREATE POLICY "boxing_hidden_mission_claims_super_admin_manage"
  ON public.boxing_hidden_mission_claims FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- =====================================================================
-- 3. seed (8 개)
-- =====================================================================
INSERT INTO public.boxing_hidden_missions
  (code, title, description, trigger_type, reward_quest_xp, reward_gems, reward_respect, sort_order)
VALUES
  ('first_cheer',     '첫 세컨드 응원',         '응원 1회 보내기 — 처음 동료에게 박수를 보낸 순간', 'cheer_sent',         0,  50, 10,  10),
  ('comeback_record', '다시 링에 오른 자',      '리턴 라운드 완료 — 휴식 끝에 돌아온 첫 라운드',     'return_round_done',  50, 100,  0,  20),
  ('quiz_streak_3',   '복싱 IQ 3연속 정답',     '퀴즈 3 연속 정답 — 알고 치는 펀치는 더 강합니다.', 'quiz_streak',        50, 150,  0,  30),
  ('journal_7',       '기록하는 파이터',         '챔피언 일기 7개 작성 — 느낀 것을 기록하는 복서는 오래 갑니다.', 'journal_total', 100, 300,  0,  40),
  ('challenge_5',     '퀘스트 파이터',           '재미 챌린지 5회 클리어 — 도전 기록이 늘고 있습니다.', 'challenge_clear',  120, 300,  0,  50),
  ('respect_30',      '세컨드의 마음',           '응원 30회 보내기 — 응원도 실력입니다.',             'cheer_sent',          0, 300, 50,  60),
  ('balanced_boxer',  '균형 잡힌 복서',          '퀴즈·챌린지·일기·응원을 각각 1회 이상',              'balanced_activity',  100, 200,  0,  70),
  ('condition_7',     '몸을 읽는 복서',          '컨디션 기록 7회 — 솔직한 점검이 첫 번째 기본기.',    'condition_total',     80, 200,  0,  80)
ON CONFLICT (code) DO NOTHING;

-- =====================================================================
-- A. check_and_claim_hidden_missions()
-- =====================================================================
-- 동작:
--   1. auth.uid() NULL 검증
--   2. 회원이 이미 claim 한 mission_id 목록 먼저 조회 (early return — §11-⑥)
--   3. 미달 미션만 조건 평가
--   4. 충족된 미션만 claim insert + events insert + grant_gems
-- =====================================================================
CREATE OR REPLACE FUNCTION public.check_and_claim_hidden_missions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile public.boxing_engagement_profiles%ROWTYPE;
  v_claimed_codes text[];
  v_claimed_count_cheer integer;
  v_claimed_return_round boolean;
  v_condition_count integer;
  v_balanced boolean;
  v_mission record;
  v_grant boolean;
  v_idem text;
  v_claim_id uuid;
  v_results jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  PERFORM public.ensure_boxing_engagement_profile(v_uid);

  SELECT * INTO v_profile
  FROM public.boxing_engagement_profiles WHERE user_id = v_uid;

  -- early return — 이미 받은 코드 목록 (§11-⑥)
  SELECT array_agg(m.code) INTO v_claimed_codes
  FROM public.boxing_hidden_mission_claims c
  JOIN public.boxing_hidden_missions m ON m.id = c.mission_id
  WHERE c.user_id = v_uid;

  v_claimed_codes := COALESCE(v_claimed_codes, ARRAY[]::text[]);

  -- 보조 카운트 미리 계산
  SELECT EXISTS (
    SELECT 1 FROM public.boxing_engagement_events
    WHERE user_id = v_uid AND action = 'return_round_claimed'
  ) INTO v_claimed_return_round;

  SELECT COUNT(*)::integer INTO v_condition_count
  FROM public.boxing_condition_logs
  WHERE user_id = v_uid;

  v_balanced := v_profile.quiz_correct_count > 0
            AND v_profile.challenge_clear_count > 0
            AND v_profile.journal_count > 0
            AND v_profile.cheer_sent_count > 0;

  -- 평가 루프 (active + 미클레임 미션만)
  FOR v_mission IN
    SELECT * FROM public.boxing_hidden_missions
    WHERE active = true
      AND NOT (code = ANY(v_claimed_codes))
    ORDER BY sort_order
  LOOP
    v_grant := false;

    -- 조건 평가 (각 mission code 별)
    IF v_mission.code = 'first_cheer' AND v_profile.cheer_sent_count >= 1 THEN
      v_grant := true;
    ELSIF v_mission.code = 'comeback_record' AND v_claimed_return_round THEN
      v_grant := true;
    ELSIF v_mission.code = 'quiz_streak_3' AND v_profile.best_quiz_streak >= 3 THEN
      v_grant := true;
    ELSIF v_mission.code = 'journal_7' AND v_profile.journal_count >= 7 THEN
      v_grant := true;
    ELSIF v_mission.code = 'challenge_5' AND v_profile.challenge_clear_count >= 5 THEN
      v_grant := true;
    ELSIF v_mission.code = 'respect_30' AND v_profile.cheer_sent_count >= 30 THEN
      v_grant := true;
    ELSIF v_mission.code = 'balanced_boxer' AND v_balanced THEN
      v_grant := true;
    ELSIF v_mission.code = 'condition_7' AND v_condition_count >= 7 THEN
      v_grant := true;
    END IF;

    IF v_grant THEN
      -- claim insert (UNIQUE 으로 중복 차단)
      INSERT INTO public.boxing_hidden_mission_claims (
        user_id, mission_id, quest_xp_granted, gems_granted, respect_granted, metadata
      ) VALUES (
        v_uid, v_mission.id,
        v_mission.reward_quest_xp,
        v_mission.reward_gems,
        v_mission.reward_respect,
        jsonb_build_object('code', v_mission.code)
      )
      ON CONFLICT (user_id, mission_id) DO NOTHING
      RETURNING id INTO v_claim_id;

      IF v_claim_id IS NOT NULL THEN
        -- events insert (idempotency)
        v_idem := concat('hidden_mission:', v_uid::text, ':', v_mission.code);
        INSERT INTO public.boxing_engagement_events (
          user_id, event_type, source_type, source_id, action,
          quest_xp_delta, gems_delta, respect_delta, idempotency_key, metadata
        ) VALUES (
          v_uid, 'reward', 'boxing_hidden_mission', v_mission.id,
          'hidden_mission_claimed',
          v_mission.reward_quest_xp,
          v_mission.reward_gems,
          v_mission.reward_respect,
          v_idem,
          jsonb_build_object('code', v_mission.code)
        )
        ON CONFLICT (user_id, idempotency_key) DO NOTHING;

        -- 프로필 누적 (XP / RP)
        UPDATE public.boxing_engagement_profiles
        SET quest_xp = quest_xp + v_mission.reward_quest_xp,
            respect_points = respect_points + v_mission.reward_respect
        WHERE user_id = v_uid;

        -- 파이트 머니
        IF v_mission.reward_gems > 0 THEN
          PERFORM public.grant_gems(
            v_uid,
            v_mission.reward_gems,
            concat('숨겨진 미션 — ', v_mission.title)
          );
        END IF;

        v_results := v_results || jsonb_build_object(
          'code', v_mission.code,
          'title', v_mission.title,
          'description', v_mission.description,
          'quest_xp_granted', v_mission.reward_quest_xp,
          'gems_granted', v_mission.reward_gems,
          'respect_granted', v_mission.reward_respect
        );

        v_claim_id := NULL;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'claimed', v_results
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_claim_hidden_missions()
  TO authenticated;

-- =====================================================================
-- B. get_my_hidden_mission_progress()
--    — MyPage 패널용. active 카탈로그 + 회원 claim 여부 조인.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_my_hidden_mission_progress()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rows jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'code', m.code,
      'title', m.title,
      'description', m.description,
      'reward_quest_xp', m.reward_quest_xp,
      'reward_gems', m.reward_gems,
      'reward_respect', m.reward_respect,
      'sort_order', m.sort_order,
      'claimed', c.id IS NOT NULL,
      'claimed_at', c.claimed_at
    )
    ORDER BY m.sort_order
  ) INTO v_rows
  FROM public.boxing_hidden_missions m
  LEFT JOIN public.boxing_hidden_mission_claims c
    ON c.mission_id = m.id AND c.user_id = v_uid
  WHERE m.active = true;

  RETURN jsonb_build_object(
    'success', true,
    'missions', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_hidden_mission_progress()
  TO authenticated;

-- =====================================================================
-- C. get_boxing_iq_league_summary()
--    — 정답 수 / 정답률 / 연속 정답 / 이번 주 정답 수 + 등급 반환.
--    공식 레벨/리그와 분리. 신규 테이블 0.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_boxing_iq_league_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile public.boxing_engagement_profiles%ROWTYPE;
  v_correct integer;
  v_attempts integer;
  v_rate numeric;
  v_week_correct integer;
  v_grade text;
  v_kst_week_start timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  PERFORM public.ensure_boxing_engagement_profile(v_uid);

  SELECT * INTO v_profile
  FROM public.boxing_engagement_profiles WHERE user_id = v_uid;

  v_correct := v_profile.quiz_correct_count;
  v_attempts := v_profile.quiz_attempt_count;
  v_rate := CASE WHEN v_attempts > 0
    THEN ROUND(v_correct::numeric / v_attempts::numeric * 100, 1)
    ELSE 0
  END;

  -- KST 기준 이번 주 (월요일 시작) 시작
  v_kst_week_start := (
    date_trunc('week', (now() AT TIME ZONE 'Asia/Seoul'))
  ) AT TIME ZONE 'Asia/Seoul';

  SELECT COUNT(*)::integer INTO v_week_correct
  FROM public.boxing_quiz_attempts
  WHERE user_id = v_uid
    AND is_correct = true
    AND created_at >= v_kst_week_start;

  v_grade := CASE
    WHEN v_correct >= 150 THEN '복싱 IQ 마스터'
    WHEN v_correct >= 80  THEN '링 전술가'
    WHEN v_correct >= 30  THEN '복싱 박사 후보'
    WHEN v_correct >= 10  THEN '복싱 연구생'
    ELSE '복싱 입문생'
  END;

  RETURN jsonb_build_object(
    'success', true,
    'quiz_correct_count', v_correct,
    'quiz_attempt_count', v_attempts,
    'accuracy_rate', v_rate,
    'current_quiz_streak', v_profile.current_quiz_streak,
    'best_quiz_streak', v_profile.best_quiz_streak,
    'week_correct_count', v_week_correct,
    'grade', v_grade
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_boxing_iq_league_summary()
  TO authenticated;
