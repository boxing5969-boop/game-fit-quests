-- ============================================================
-- 153 QUEST v2 — 21단계 팀 / 짐 레이드 MVP
-- ============================================================
-- 목적:
--   같은 지점 전체 회원이 누적 목표 (예: 잽 10,000 / 퀴즈 300 / 챌린지 200)
--   를 함께 달성. 개인 기여도 표시 + 100% 달성 후 보상 claim.
--
-- 보호 원칙 (§3 + §11):
--   - 공식 1~40 levels/missions/member_progress 일절 미수정
--   - 기존 /challenges 21일 챌린지 무수정 — 자체 도메인 분리
--   - source 검증 (§11-⑬) — 다른 사람 source 자기 것으로 등록 방지
--   - status 자동 ended/completed lazy update (§11-⑭)
--   - 호출 빈도 가드 — UNIQUE (raid_id, user_id, source_type, source_id)
--   - 보상은 grant_gems RPC 만 경유
-- ============================================================

-- =====================================================================
-- 1. boxing_gym_raids — 레이드 카탈로그 (지점별 active raid)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.boxing_gym_raids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_name text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  raid_type text NOT NULL,
  target_value numeric NOT NULL,
  current_value numeric NOT NULL DEFAULT 0,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'active',
  reward_quest_xp integer NOT NULL DEFAULT 0,
  reward_gems integer NOT NULL DEFAULT 0,
  reward_respect integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT boxing_gym_raids_status_chk
    CHECK (status IN ('draft','active','completed','ended')),
  CONSTRAINT boxing_gym_raids_type_chk
    CHECK (raid_type IN
      ('quiz_correct','challenge_clear','cheer_sent','journal_write','quest_xp','respect_points'))
);

CREATE INDEX IF NOT EXISTS idx_boxing_gym_raids_branch_status
  ON public.boxing_gym_raids (branch_name, status);
CREATE INDEX IF NOT EXISTS idx_boxing_gym_raids_status_end_date
  ON public.boxing_gym_raids (status, end_date);

ALTER TABLE public.boxing_gym_raids ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_boxing_gym_raids_updated_at
  ON public.boxing_gym_raids;
CREATE TRIGGER trg_boxing_gym_raids_updated_at
  BEFORE UPDATE ON public.boxing_gym_raids
  FOR EACH ROW EXECUTE FUNCTION public.boxing_engagement_set_updated_at();

-- =====================================================================
-- 2. boxing_gym_raid_contributions — 개인 기여도 이력
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.boxing_gym_raid_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raid_id uuid NOT NULL REFERENCES public.boxing_gym_raids(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contribution_value numeric NOT NULL DEFAULT 1,
  contribution_type text NOT NULL,
  source_type text,
  source_id uuid,
  contributed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT boxing_gym_raid_contributions_unique
    UNIQUE (raid_id, user_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_boxing_gym_raid_contributions_raid_user
  ON public.boxing_gym_raid_contributions (raid_id, user_id);
CREATE INDEX IF NOT EXISTS idx_boxing_gym_raid_contributions_user_contributed
  ON public.boxing_gym_raid_contributions (user_id, contributed_at DESC);

ALTER TABLE public.boxing_gym_raid_contributions ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 3. boxing_gym_raid_reward_claims — raid 당 1회 보상
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.boxing_gym_raid_reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raid_id uuid NOT NULL REFERENCES public.boxing_gym_raids(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contribution_count integer NOT NULL DEFAULT 0,
  quest_xp_granted integer NOT NULL DEFAULT 0,
  gems_granted integer NOT NULL DEFAULT 0,
  respect_granted integer NOT NULL DEFAULT 0,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT boxing_gym_raid_reward_claims_unique UNIQUE (raid_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_boxing_gym_raid_reward_claims_user
  ON public.boxing_gym_raid_reward_claims (user_id, claimed_at DESC);

ALTER TABLE public.boxing_gym_raid_reward_claims ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- RLS — §11-① super_admin + USING/WITH CHECK 양쪽 명시
-- =====================================================================

-- gym_raids: 회원은 자기 branch 의 active SELECT 가능
DROP POLICY IF EXISTS "boxing_gym_raids_select_branch_or_admin"
  ON public.boxing_gym_raids;
CREATE POLICY "boxing_gym_raids_select_branch_or_admin"
  ON public.boxing_gym_raids FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.branch_name = boxing_gym_raids.branch_name
    )
    OR public.has_role(auth.uid(), 'super_admin')
  );

DROP POLICY IF EXISTS "boxing_gym_raids_super_admin_manage"
  ON public.boxing_gym_raids;
CREATE POLICY "boxing_gym_raids_super_admin_manage"
  ON public.boxing_gym_raids FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- contributions: 본인 + 같은 raid branch 의 회원 SELECT 가능 (top contributor 표시용)
DROP POLICY IF EXISTS "boxing_gym_raid_contributions_select_branch_or_admin"
  ON public.boxing_gym_raid_contributions;
CREATE POLICY "boxing_gym_raid_contributions_select_branch_or_admin"
  ON public.boxing_gym_raid_contributions FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.boxing_gym_raids r
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE r.id = boxing_gym_raid_contributions.raid_id
        AND r.branch_name = p.branch_name
    )
    OR public.has_role(auth.uid(), 'super_admin')
  );

DROP POLICY IF EXISTS "boxing_gym_raid_contributions_super_admin_manage"
  ON public.boxing_gym_raid_contributions;
CREATE POLICY "boxing_gym_raid_contributions_super_admin_manage"
  ON public.boxing_gym_raid_contributions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- reward_claims: 본인 + super_admin
DROP POLICY IF EXISTS "boxing_gym_raid_reward_claims_select_self_or_admin"
  ON public.boxing_gym_raid_reward_claims;
CREATE POLICY "boxing_gym_raid_reward_claims_select_self_or_admin"
  ON public.boxing_gym_raid_reward_claims FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_branch_manager_of(auth.uid(), user_id)
  );

DROP POLICY IF EXISTS "boxing_gym_raid_reward_claims_super_admin_manage"
  ON public.boxing_gym_raid_reward_claims;
CREATE POLICY "boxing_gym_raid_reward_claims_super_admin_manage"
  ON public.boxing_gym_raid_reward_claims FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- =====================================================================
-- 헬퍼 — raid 의 status 자동 ended/completed (§11-⑭ lazy)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.boxing_gym_raid_lazy_expire()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- end_date 지난 active raid 는 ended (목표 미달성)
  UPDATE public.boxing_gym_raids
  SET status = 'ended'
  WHERE status = 'active'
    AND end_date < (now() AT TIME ZONE 'Asia/Seoul')::date
    AND current_value < target_value;

  -- 목표 달성한 active raid 는 completed
  UPDATE public.boxing_gym_raids
  SET status = 'completed'
  WHERE status = 'active'
    AND current_value >= target_value;
END;
$$;

-- =====================================================================
-- A. get_active_gym_raids()
--    — 내 branch 의 active raid + my_contribution 포함
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_active_gym_raids()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_my_branch text;
  v_raids jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  PERFORM public.boxing_gym_raid_lazy_expire();

  SELECT branch_name INTO v_my_branch
  FROM public.profiles WHERE id = v_uid;

  IF v_my_branch IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'raids', '[]'::jsonb
    );
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'title', r.title,
    'description', r.description,
    'raid_type', r.raid_type,
    'target_value', r.target_value,
    'current_value', r.current_value,
    'percentage', LEAST(100,
      CASE WHEN r.target_value > 0
        THEN ROUND((r.current_value / r.target_value) * 100, 1)
        ELSE 0
      END
    ),
    'start_date', r.start_date,
    'end_date', r.end_date,
    'status', r.status,
    'reward_quest_xp', r.reward_quest_xp,
    'reward_gems', r.reward_gems,
    'reward_respect', r.reward_respect,
    'my_contribution', COALESCE(c.my_count, 0),
    'reward_claimed', cl.id IS NOT NULL
  ) ORDER BY r.end_date ASC), '[]'::jsonb)
  INTO v_raids
  FROM public.boxing_gym_raids r
  LEFT JOIN (
    SELECT raid_id, COUNT(*)::integer AS my_count
    FROM public.boxing_gym_raid_contributions
    WHERE user_id = v_uid
    GROUP BY raid_id
  ) c ON c.raid_id = r.id
  LEFT JOIN public.boxing_gym_raid_reward_claims cl
    ON cl.raid_id = r.id AND cl.user_id = v_uid
  WHERE r.branch_name = v_my_branch
    AND r.status IN ('active', 'completed');

  RETURN jsonb_build_object(
    'success', true,
    'branch', v_my_branch,
    'raids', v_raids
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_gym_raids() TO authenticated;

-- =====================================================================
-- B. contribute_to_gym_raid(p_source_type, p_source_id)
--    — 4 hook 의 onSuccess 에서 호출. source 검증 (§11-⑬) 강제.
--    — raid 자동 매칭 (회원 branch + active + raid_type 호환)
--    — UNIQUE 로 중복 방지
-- =====================================================================
CREATE OR REPLACE FUNCTION public.contribute_to_gym_raid(
  p_source_type text,
  p_source_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_my_branch text;
  v_raid public.boxing_gym_raids%ROWTYPE;
  v_raid_type text;
  v_value numeric := 1;
  v_source_valid boolean := false;
  v_resolved_source_id uuid := p_source_id;
  v_inserted_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF p_source_type IS NULL OR length(trim(p_source_type)) = 0 THEN
    RAISE EXCEPTION 'gym raid invalid source';
  END IF;

  -- §11-⑬ source 검증 — 다른 사람 source 자기 것으로 등록 방지
  -- source_id 가 NULL 이면 본인의 최근 5분 내 source 자동 매칭 (v1 RPC 가 ID
  -- 반환 안 하는 quiz/challenge 우회용 — 매번 같은 source 면 UNIQUE 로 차단)
  IF p_source_type = 'boxing_quiz_attempt' THEN
    IF v_resolved_source_id IS NULL THEN
      SELECT id INTO v_resolved_source_id
      FROM public.boxing_quiz_attempts
      WHERE user_id = v_uid AND is_correct = true
        AND created_at > now() - INTERVAL '5 minutes'
      ORDER BY created_at DESC LIMIT 1;
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.boxing_quiz_attempts
      WHERE id = v_resolved_source_id AND user_id = v_uid AND is_correct = true
    ) INTO v_source_valid;
    v_raid_type := 'quiz_correct';

  ELSIF p_source_type = 'boxing_fun_challenge_attempt' THEN
    IF v_resolved_source_id IS NULL THEN
      SELECT id INTO v_resolved_source_id
      FROM public.boxing_fun_challenge_attempts
      WHERE user_id = v_uid AND status = 'completed'
        AND created_at > now() - INTERVAL '5 minutes'
      ORDER BY created_at DESC LIMIT 1;
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.boxing_fun_challenge_attempts
      WHERE id = v_resolved_source_id AND user_id = v_uid AND status = 'completed'
    ) INTO v_source_valid;
    v_raid_type := 'challenge_clear';

  ELSIF p_source_type = 'champion_journal_entry' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.champion_journal_entries
      WHERE id = v_resolved_source_id AND user_id = v_uid
    ) INTO v_source_valid;
    v_raid_type := 'journal_write';

  ELSIF p_source_type = 'boxing_cheer' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.boxing_cheers
      WHERE id = v_resolved_source_id AND sender_user_id = v_uid
    ) INTO v_source_valid;
    v_raid_type := 'cheer_sent';

  ELSE
    RAISE EXCEPTION 'gym raid invalid source';
  END IF;

  IF NOT v_source_valid OR v_resolved_source_id IS NULL THEN
    -- silent return (사용자 흐름 막지 않음 — §21 요구사항)
    RETURN jsonb_build_object(
      'success', true,
      'contributed', false,
      'reason', 'no recent source'
    );
  END IF;

  PERFORM public.boxing_gym_raid_lazy_expire();

  -- 회원의 branch + 매칭되는 active raid 찾기
  SELECT branch_name INTO v_my_branch FROM public.profiles WHERE id = v_uid;
  IF v_my_branch IS NULL THEN
    RETURN jsonb_build_object('success', true, 'contributed', false, 'reason', 'no branch');
  END IF;

  FOR v_raid IN
    SELECT * FROM public.boxing_gym_raids
    WHERE branch_name = v_my_branch
      AND status = 'active'
      AND raid_type = v_raid_type
      AND start_date <= (now() AT TIME ZONE 'Asia/Seoul')::date
      AND end_date >= (now() AT TIME ZONE 'Asia/Seoul')::date
  LOOP
    -- contribution insert (UNIQUE 충돌 시 무시)
    INSERT INTO public.boxing_gym_raid_contributions (
      raid_id, user_id, contribution_value, contribution_type,
      source_type, source_id, metadata
    ) VALUES (
      v_raid.id, v_uid, v_value, v_raid_type,
      p_source_type, v_resolved_source_id,
      jsonb_build_object('auto', true)
    )
    ON CONFLICT (raid_id, user_id, source_type, source_id) DO NOTHING;

    IF FOUND THEN
      -- raid current_value 업데이트
      UPDATE public.boxing_gym_raids
      SET current_value = current_value + v_value
      WHERE id = v_raid.id;
      v_inserted_count := v_inserted_count + 1;
    END IF;
  END LOOP;

  -- lazy completed 전환
  PERFORM public.boxing_gym_raid_lazy_expire();

  RETURN jsonb_build_object(
    'success', true,
    'contributed', v_inserted_count > 0,
    'raids_contributed', v_inserted_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.contribute_to_gym_raid(text, uuid) TO authenticated;
-- 디폴트 NULL 시그니처도 명시 grant
GRANT EXECUTE ON FUNCTION public.contribute_to_gym_raid(text) TO authenticated;

-- =====================================================================
-- C. claim_gym_raid_reward(p_raid_id)
--    — completed raid + 본인 contribution >= 1 + 미claim 시 보상
-- =====================================================================
CREATE OR REPLACE FUNCTION public.claim_gym_raid_reward(p_raid_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_raid public.boxing_gym_raids%ROWTYPE;
  v_my_count integer;
  v_already_claimed boolean;
  v_idem text;
  v_claim_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  PERFORM public.boxing_gym_raid_lazy_expire();

  SELECT * INTO v_raid FROM public.boxing_gym_raids WHERE id = p_raid_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'gym raid not found';
  END IF;

  IF v_raid.status NOT IN ('completed') THEN
    RAISE EXCEPTION 'gym raid not completed';
  END IF;

  -- 본인 contribution 확인
  SELECT COUNT(*)::integer INTO v_my_count
  FROM public.boxing_gym_raid_contributions
  WHERE raid_id = p_raid_id AND user_id = v_uid;

  IF v_my_count < 1 THEN
    RAISE EXCEPTION 'gym raid no contribution';
  END IF;

  -- 이미 받았는지
  SELECT EXISTS (
    SELECT 1 FROM public.boxing_gym_raid_reward_claims
    WHERE raid_id = p_raid_id AND user_id = v_uid
  ) INTO v_already_claimed;

  IF v_already_claimed THEN
    RAISE EXCEPTION 'gym raid reward already claimed';
  END IF;

  PERFORM public.ensure_boxing_engagement_profile(v_uid);

  INSERT INTO public.boxing_gym_raid_reward_claims (
    raid_id, user_id, contribution_count,
    quest_xp_granted, gems_granted, respect_granted
  ) VALUES (
    p_raid_id, v_uid, v_my_count,
    v_raid.reward_quest_xp, v_raid.reward_gems, v_raid.reward_respect
  )
  RETURNING id INTO v_claim_id;

  v_idem := concat('gym_raid_reward:', p_raid_id::text, ':', v_uid::text);

  INSERT INTO public.boxing_engagement_events (
    user_id, event_type, source_type, source_id, action,
    quest_xp_delta, gems_delta, respect_delta, idempotency_key, metadata
  ) VALUES (
    v_uid, 'reward', 'boxing_gym_raid', p_raid_id,
    'gym_raid_reward_claimed',
    v_raid.reward_quest_xp, v_raid.reward_gems, v_raid.reward_respect,
    v_idem,
    jsonb_build_object(
      'raid_title', v_raid.title,
      'contribution_count', v_my_count
    )
  )
  ON CONFLICT (user_id, idempotency_key) DO NOTHING;

  -- 프로필 누적
  UPDATE public.boxing_engagement_profiles
  SET quest_xp = quest_xp + v_raid.reward_quest_xp,
      respect_points = respect_points + v_raid.reward_respect
  WHERE user_id = v_uid;

  -- 파이트 머니 grant_gems 경유
  IF v_raid.reward_gems > 0 THEN
    PERFORM public.grant_gems(
      v_uid,
      v_raid.reward_gems,
      concat('짐 레이드 — ', v_raid.title)
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'claim_id', v_claim_id,
    'raid_id', p_raid_id,
    'contribution_count', v_my_count,
    'quest_xp_granted', v_raid.reward_quest_xp,
    'gems_granted', v_raid.reward_gems,
    'respect_granted', v_raid.reward_respect,
    'message', '오늘의 기록이 우리 지점 레이드에 더해졌습니다.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_gym_raid_reward(uuid) TO authenticated;

-- =====================================================================
-- Seed — 운영의 distinct branch 마다 3 raid 자동 생성
-- =====================================================================
DO $$
DECLARE
  v_branch text;
  v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
  FOR v_branch IN
    SELECT DISTINCT branch_name FROM public.profiles
    WHERE branch_name IS NOT NULL AND length(trim(branch_name)) > 0
  LOOP
    -- 1. 복싱 IQ 300문제 레이드 (14일)
    INSERT INTO public.boxing_gym_raids (
      branch_name, title, description, raid_type, target_value,
      start_date, end_date, status,
      reward_quest_xp, reward_gems, reward_respect, metadata
    ) VALUES (
      v_branch,
      '복싱 IQ 300문제 레이드',
      '우리 지점이 함께 푸는 복싱 퀴즈 300문제. 한 라운드씩, 함께.',
      'quiz_correct', 300,
      v_today, v_today + INTERVAL '14 days', 'active',
      100, 300, 0,
      jsonb_build_object('seeded', true)
    )
    ON CONFLICT DO NOTHING;

    -- 2. 챌린지 200라운드 레이드 (14일)
    INSERT INTO public.boxing_gym_raids (
      branch_name, title, description, raid_type, target_value,
      start_date, end_date, status,
      reward_quest_xp, reward_gems, reward_respect, metadata
    ) VALUES (
      v_branch,
      '챌린지 200라운드 레이드',
      '우리 지점이 함께 클리어하는 재미 챌린지 200회.',
      'challenge_clear', 200,
      v_today, v_today + INTERVAL '14 days', 'active',
      150, 500, 0,
      jsonb_build_object('seeded', true)
    )
    ON CONFLICT DO NOTHING;

    -- 3. 세컨드 응원 500회 레이드 (30일)
    INSERT INTO public.boxing_gym_raids (
      branch_name, title, description, raid_type, target_value,
      start_date, end_date, status,
      reward_quest_xp, reward_gems, reward_respect, metadata
    ) VALUES (
      v_branch,
      '세컨드 응원 500회 레이드',
      '코너에서 동료를 일으켜 세우는 응원 500회. 응원도 실력입니다.',
      'cheer_sent', 500,
      v_today, v_today + INTERVAL '30 days', 'active',
      0, 300, 50,
      jsonb_build_object('seeded', true)
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END
$$;
