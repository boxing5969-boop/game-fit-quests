-- ============================================================
-- 153 QUEST v1.5 — 15단계 리턴 라운드
-- ============================================================
-- 목적:
--   3 / 7 / 14 / 30 일 미접속 회원이 돌아왔을 때 부담 없는 복귀
--   퀘스트 + 보상 제공. "혼내지 않는 복귀" 톤.
-- 보호 원칙:
--   - 공식 1~40 levels/missions/member_progress 일절 미수정
--   - 공식 XP 지급 0 — QUEST XP / 파이트 머니만
--   - record_attendance 호출 0 / approve_mission_submission 호출 0
--   - attendance_logs 사용 금지 — boxing_engagement_events 단일 소스
--   - 파이트 머니는 grant_gems RPC 만 경유
--   - 30일 어뷰징 방지: cooldown + idempotency_key (KST ISO week)
-- ============================================================

-- =====================================================================
-- 1. boxing_return_round_claims
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.boxing_return_round_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  return_type text NOT NULL,
  inactive_days integer NOT NULL,
  mission_code text NOT NULL,
  quest_xp_granted integer NOT NULL DEFAULT 0,
  gems_granted integer NOT NULL DEFAULT 0,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT boxing_return_round_claims_type_chk
    CHECK (return_type IN ('after_3_days','after_7_days','after_14_days','after_30_days'))
);

CREATE INDEX IF NOT EXISTS idx_boxing_return_round_claims_user_claimed
  ON public.boxing_return_round_claims (user_id, claimed_at DESC);

CREATE INDEX IF NOT EXISTS idx_boxing_return_round_claims_user_type
  ON public.boxing_return_round_claims (user_id, return_type, claimed_at DESC);

ALTER TABLE public.boxing_return_round_claims ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- RLS — 본인 SELECT 만, INSERT/UPDATE/DELETE 는 SECURITY DEFINER RPC 만
-- =====================================================================

DROP POLICY IF EXISTS "boxing_return_round_claims_select_self_or_admin"
  ON public.boxing_return_round_claims;
CREATE POLICY "boxing_return_round_claims_select_self_or_admin"
  ON public.boxing_return_round_claims FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_branch_manager_of(auth.uid(), user_id)
  );

DROP POLICY IF EXISTS "boxing_return_round_claims_super_admin_manage"
  ON public.boxing_return_round_claims;
CREATE POLICY "boxing_return_round_claims_super_admin_manage"
  ON public.boxing_return_round_claims FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- =====================================================================
-- 헬퍼 — 마지막 engagement 활동일 계산 (attendance_logs 사용 금지)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.boxing_calc_inactive_days(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_last timestamptz;
  v_days integer;
BEGIN
  SELECT MAX(created_at) INTO v_last
  FROM public.boxing_engagement_events
  WHERE user_id = p_user_id;

  IF v_last IS NULL THEN
    RETURN 999; -- 한 번도 활동 없음
  END IF;

  v_days := GREATEST(0, EXTRACT(
    DAY FROM (
      ((now() AT TIME ZONE 'Asia/Seoul')::date)::timestamp
      - ((v_last AT TIME ZONE 'Asia/Seoul')::date)::timestamp
    )
  )::integer);

  RETURN v_days;
END;
$$;

-- =====================================================================
-- 헬퍼 — inactive_days → return_type 결정
-- =====================================================================
CREATE OR REPLACE FUNCTION public.boxing_return_type_for_days(p_days integer)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_days IS NULL OR p_days < 3 THEN
    RETURN NULL;
  ELSIF p_days >= 30 THEN
    RETURN 'after_30_days';
  ELSIF p_days >= 14 THEN
    RETURN 'after_14_days';
  ELSIF p_days >= 7 THEN
    RETURN 'after_7_days';
  ELSE
    RETURN 'after_3_days';
  END IF;
END;
$$;

-- =====================================================================
-- A. get_return_round_status()
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_return_round_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inactive integer;
  v_type text;
  v_kst_date date;
  v_today_claimed boolean;
  v_cooldown_active boolean;
  v_message text;
  v_missions jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  v_inactive := public.boxing_calc_inactive_days(v_uid);
  v_type := public.boxing_return_type_for_days(v_inactive);

  IF v_type IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'active', false,
      'inactive_days', v_inactive,
      'return_type', NULL,
      'message', '꾸준히 오고 계시네요. 오늘도 한 라운드!'
    );
  END IF;

  v_kst_date := (now() AT TIME ZONE 'Asia/Seoul')::date;

  -- 오늘 이미 받았는지
  SELECT EXISTS (
    SELECT 1 FROM public.boxing_return_round_claims
    WHERE user_id = v_uid
      AND ((claimed_at AT TIME ZONE 'Asia/Seoul')::date) = v_kst_date
  ) INTO v_today_claimed;

  -- 쿨다운: 동일 return_type 의 마지막 claim 후 (3/7/14/30 일) 이내면 잠금.
  -- — 30일 보상 어뷰징 방지 (§11-⑤)
  SELECT EXISTS (
    SELECT 1 FROM public.boxing_return_round_claims
    WHERE user_id = v_uid
      AND return_type = v_type
      AND claimed_at >= now() - make_interval(days => CASE v_type
            WHEN 'after_3_days'  THEN 3
            WHEN 'after_7_days'  THEN 7
            WHEN 'after_14_days' THEN 14
            WHEN 'after_30_days' THEN 30
            ELSE 30
          END)
  ) INTO v_cooldown_active;

  v_message := CASE v_type
    WHEN 'after_3_days'  THEN '3일 만이군요. 돌아온 것부터 오늘의 승리입니다.'
    WHEN 'after_7_days'  THEN '한 주만에 다시 링에 오릅니다. 가볍게 시작해요.'
    WHEN 'after_14_days' THEN '2주가 지났네요. 회복 라운드부터 천천히.'
    WHEN 'after_30_days' THEN '한 달이 지났습니다. 링은 언제나 다시 시작할 수 있게 열려 있습니다.'
    ELSE '돌아온 것 자체가 오늘의 승리입니다.'
  END;

  v_missions := CASE v_type
    WHEN 'after_3_days' THEN jsonb_build_array(
      jsonb_build_object(
        'code', 'stretch_5min',
        'title', '5분 스트레칭',
        'description', '몸을 깨우는 가벼운 스트레칭',
        'difficulty', 'recovery'
      ),
      jsonb_build_object(
        'code', 'quiz_1',
        'title', '복싱 IQ 1문제',
        'description', '머리로 먼저 링에 오르기',
        'difficulty', 'recovery'
      ),
      jsonb_build_object(
        'code', 'journal_1line',
        'title', '챔피언 일기 1줄',
        'description', '돌아온 오늘의 한 줄',
        'difficulty', 'recovery'
      )
    )
    WHEN 'after_7_days' THEN jsonb_build_array(
      jsonb_build_object(
        'code', 'light_shadow_2min',
        'title', '가벼운 섀도우 2분',
        'description', '몸을 깨우는 복귀 라운드',
        'difficulty', 'recovery'
      ),
      jsonb_build_object(
        'code', 'jab_30',
        'title', '잽 30회',
        'description', '복싱의 기본기 잽으로 다시 시작',
        'difficulty', 'recovery'
      ),
      jsonb_build_object(
        'code', 'journal_restart',
        'title', '챔피언 일기 — 다시 시작하는 이유',
        'description', '왜 돌아왔는지 한 줄 기록',
        'difficulty', 'recovery'
      )
    )
    WHEN 'after_14_days' THEN jsonb_build_array(
      jsonb_build_object(
        'code', 'recovery_routine',
        'title', '회복 루틴',
        'description', '관절 가동 + 가벼운 스트레칭',
        'difficulty', 'recovery'
      ),
      jsonb_build_object(
        'code', 'quiz_1',
        'title', '복싱 IQ 1문제',
        'description', '학습으로 다시 진입',
        'difficulty', 'recovery'
      ),
      jsonb_build_object(
        'code', 'condition_check',
        'title', '컨디션 체크',
        'description', '오늘의 몸 상태부터 솔직히',
        'difficulty', 'recovery'
      ),
      jsonb_build_object(
        'code', 'coach_consult',
        'title', '코치 상담 권장',
        'description', '복귀 첫 훈련 전 코치와 상의',
        'difficulty', 'recovery'
      )
    )
    WHEN 'after_30_days' THEN jsonb_build_array(
      jsonb_build_object(
        'code', 'restart_chapter',
        'title', '리스타트 챕터',
        'description', '오늘은 새로운 챕터의 1라운드',
        'difficulty', 'recovery'
      ),
      jsonb_build_object(
        'code', 'coach_consult',
        'title', '코치 상담 권장',
        'description', '공식 훈련은 코치와 상의 후',
        'difficulty', 'recovery'
      ),
      jsonb_build_object(
        'code', 'journal_restart',
        'title', '챔피언 일기 — 다시 시작하는 이유',
        'description', '한 달의 휴식 끝에 남기는 한 줄',
        'difficulty', 'recovery'
      )
    )
    ELSE jsonb_build_array()
  END;

  RETURN jsonb_build_object(
    'success', true,
    'active', true,
    'inactive_days', v_inactive,
    'return_type', v_type,
    'already_claimed_today', v_today_claimed,
    'on_cooldown', v_cooldown_active,
    'message', v_message,
    'missions', v_missions
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_return_round_status() TO authenticated;

-- =====================================================================
-- B. claim_return_round_reward(p_mission_code)
-- =====================================================================
-- 동작:
--   1. auth.uid() NULL 검증
--   2. 현재 inactive_days 재계산 + return_type 결정
--   3. 오늘 이미 claim 했으면 'return round already claimed'
--   4. cooldown 활성이면 'return round on cooldown'
--   5. mission_code 검증 (return_type 별 화이트리스트)
--   6. 보상 서버 결정 (return_type 별 고정값)
--   7. boxing_return_round_claims insert
--   8. boxing_engagement_events insert (idempotency_key — KST ISO week)
--   9. boxing_engagement_profiles 업데이트 (quest_xp 만)
--   10. gems > 0 면 grant_gems RPC 경유
-- =====================================================================
CREATE OR REPLACE FUNCTION public.claim_return_round_reward(
  p_mission_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inactive integer;
  v_type text;
  v_kst_date date;
  v_kst_iso_week text;
  v_today_claimed boolean;
  v_cooldown_active boolean;
  v_xp integer := 0;
  v_gems integer := 0;
  v_idem text;
  v_valid_codes text[];
  v_claim_id uuid;
  v_message text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF p_mission_code IS NULL OR length(trim(p_mission_code)) = 0 THEN
    RAISE EXCEPTION 'mission_code required';
  END IF;

  v_inactive := public.boxing_calc_inactive_days(v_uid);
  v_type := public.boxing_return_type_for_days(v_inactive);

  IF v_type IS NULL THEN
    RAISE EXCEPTION 'no return round available';
  END IF;

  v_kst_date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_kst_iso_week := to_char(v_kst_date, 'IYYY-"W"IW');

  -- 오늘 이미 받았는지
  SELECT EXISTS (
    SELECT 1 FROM public.boxing_return_round_claims
    WHERE user_id = v_uid
      AND ((claimed_at AT TIME ZONE 'Asia/Seoul')::date) = v_kst_date
  ) INTO v_today_claimed;

  IF v_today_claimed THEN
    RAISE EXCEPTION 'return round already claimed';
  END IF;

  -- 쿨다운 검증 (§11-⑤)
  SELECT EXISTS (
    SELECT 1 FROM public.boxing_return_round_claims
    WHERE user_id = v_uid
      AND return_type = v_type
      AND claimed_at >= now() - make_interval(days => CASE v_type
            WHEN 'after_3_days'  THEN 3
            WHEN 'after_7_days'  THEN 7
            WHEN 'after_14_days' THEN 14
            WHEN 'after_30_days' THEN 30
            ELSE 30
          END)
  ) INTO v_cooldown_active;

  IF v_cooldown_active THEN
    RAISE EXCEPTION 'return round on cooldown';
  END IF;

  -- mission_code 화이트리스트
  v_valid_codes := CASE v_type
    WHEN 'after_3_days'  THEN ARRAY['stretch_5min','quiz_1','journal_1line']
    WHEN 'after_7_days'  THEN ARRAY['light_shadow_2min','jab_30','journal_restart']
    WHEN 'after_14_days' THEN ARRAY['recovery_routine','quiz_1','condition_check','coach_consult']
    WHEN 'after_30_days' THEN ARRAY['restart_chapter','coach_consult','journal_restart']
    ELSE ARRAY[]::text[]
  END;

  IF NOT (p_mission_code = ANY(v_valid_codes)) THEN
    RAISE EXCEPTION 'invalid mission_code';
  END IF;

  -- 보상 결정 (server-side)
  CASE v_type
    WHEN 'after_3_days'  THEN v_xp := 30;  v_gems := 100;
    WHEN 'after_7_days'  THEN v_xp := 60;  v_gems := 200;
    WHEN 'after_14_days' THEN v_xp := 80;  v_gems := 300;
    WHEN 'after_30_days' THEN v_xp := 100; v_gems := 500;
  END CASE;

  PERFORM public.ensure_boxing_engagement_profile(v_uid);

  -- claims insert
  INSERT INTO public.boxing_return_round_claims (
    user_id, return_type, inactive_days, mission_code,
    quest_xp_granted, gems_granted, metadata
  ) VALUES (
    v_uid, v_type, v_inactive, p_mission_code,
    v_xp, v_gems,
    jsonb_build_object(
      'iso_week', v_kst_iso_week,
      'inactive_days_at_claim', v_inactive
    )
  )
  RETURNING id INTO v_claim_id;

  -- engagement events (idempotency: return-round:{type}:{week})
  v_idem := concat('return-round:', v_type, ':', v_kst_iso_week);

  INSERT INTO public.boxing_engagement_events (
    user_id, event_type, source_type, source_id, action,
    quest_xp_delta, gems_delta, respect_delta, idempotency_key, metadata
  ) VALUES (
    v_uid,
    'reward',
    'boxing_return_round',
    v_claim_id,
    'return_round_claimed',
    v_xp, v_gems, 0, v_idem,
    jsonb_build_object(
      'return_type', v_type,
      'mission_code', p_mission_code,
      'inactive_days', v_inactive
    )
  )
  ON CONFLICT (user_id, idempotency_key) DO NOTHING;

  -- 프로필 누적 (QUEST XP 만)
  UPDATE public.boxing_engagement_profiles
  SET quest_xp = quest_xp + v_xp
  WHERE user_id = v_uid;

  -- 파이트 머니
  IF v_gems > 0 THEN
    PERFORM public.grant_gems(v_uid, v_gems, '리턴 라운드 복귀 보상');
  END IF;

  v_message := CASE v_type
    WHEN 'after_3_days'  THEN '돌아온 것부터 오늘의 승리입니다.'
    WHEN 'after_7_days'  THEN '한 주만에 링에 다시 올랐습니다.'
    WHEN 'after_14_days' THEN '천천히 회복하면서 갑시다. 잘 돌아왔어요.'
    WHEN 'after_30_days' THEN '오늘은 새로운 챕터의 1라운드입니다.'
    ELSE '돌아온 것 자체가 오늘의 승리입니다.'
  END;

  RETURN jsonb_build_object(
    'success', true,
    'claim_id', v_claim_id,
    'return_type', v_type,
    'inactive_days', v_inactive,
    'mission_code', p_mission_code,
    'quest_xp_granted', v_xp,
    'gems_granted', v_gems,
    'message', v_message
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_return_round_reward(text)
  TO authenticated;
