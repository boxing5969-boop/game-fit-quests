-- ============================================================
-- 153 QUEST v2 — 19단계 코너맨 매칭 MVP
-- ============================================================
-- 목적:
--   회원 2명이 서로 코너맨 관계를 맺고, 같은 날 둘 다 QUEST 활동을
--   완료하면 보조 보상을 받는다. "혼자 안 가는 사람" 의 이탈 방지 +
--   1:1 약한 사회적 압력.
--
-- 보호 원칙 (§3 + §11):
--   - 공식 1~40 levels/missions/member_progress 일절 미수정
--   - 공식 XP 지급 0 — QUEST XP / RP / 파이트 머니만
--   - 파이트 머니는 grant_gems RPC 만 경유
--   - 4중 어뷰징 방지 (같은 지점 + 진짜 활동 + 1일 1회 + active pair)
--   - 코너맨 active pair 1개 제한 — RPC 양면 검증
--   - pending 7일 자동 만료 (lazy update, cron 인프라 신규 구축 금지)
-- ============================================================

-- =====================================================================
-- 1. boxing_cornerman_pairs — 코너맨 짝
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.boxing_cornerman_pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  branch_name text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  ended_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT boxing_cornerman_pairs_status_chk
    CHECK (status IN ('pending','active','declined','ended','expired')),
  CONSTRAINT boxing_cornerman_pairs_no_self
    CHECK (requester_user_id <> receiver_user_id)
);

CREATE INDEX IF NOT EXISTS idx_boxing_cornerman_pairs_requester
  ON public.boxing_cornerman_pairs (requester_user_id, status);
CREATE INDEX IF NOT EXISTS idx_boxing_cornerman_pairs_receiver
  ON public.boxing_cornerman_pairs (receiver_user_id, status);
CREATE INDEX IF NOT EXISTS idx_boxing_cornerman_pairs_status_branch
  ON public.boxing_cornerman_pairs (status, branch_name);

ALTER TABLE public.boxing_cornerman_pairs ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 2. boxing_cornerman_daily_syncs — 일일 동기화 + 보너스 claim
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.boxing_cornerman_daily_syncs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid NOT NULL REFERENCES public.boxing_cornerman_pairs(id) ON DELETE CASCADE,
  user_a_id uuid NOT NULL,
  user_b_id uuid NOT NULL,
  sync_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Seoul')::date,
  user_a_completed boolean NOT NULL DEFAULT false,
  user_b_completed boolean NOT NULL DEFAULT false,
  bonus_claimed boolean NOT NULL DEFAULT false,
  quest_xp_granted integer NOT NULL DEFAULT 0,
  gems_granted integer NOT NULL DEFAULT 0,
  respect_granted integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT boxing_cornerman_daily_syncs_unique UNIQUE (pair_id, sync_date)
);

CREATE INDEX IF NOT EXISTS idx_boxing_cornerman_daily_syncs_pair_date
  ON public.boxing_cornerman_daily_syncs (pair_id, sync_date DESC);

ALTER TABLE public.boxing_cornerman_daily_syncs ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- updated_at trigger (engagement 도메인 패턴 재사용)
-- =====================================================================
DROP TRIGGER IF EXISTS trg_boxing_cornerman_daily_syncs_updated_at
  ON public.boxing_cornerman_daily_syncs;
CREATE TRIGGER trg_boxing_cornerman_daily_syncs_updated_at
  BEFORE UPDATE ON public.boxing_cornerman_daily_syncs
  FOR EACH ROW EXECUTE FUNCTION public.boxing_engagement_set_updated_at();

-- =====================================================================
-- RLS 정책 — §11-① super_admin + USING/WITH CHECK 양쪽 명시
-- =====================================================================

-- boxing_cornerman_pairs: 본인 (requester 또는 receiver) + super_admin SELECT
DROP POLICY IF EXISTS "boxing_cornerman_pairs_select_party_or_admin"
  ON public.boxing_cornerman_pairs;
CREATE POLICY "boxing_cornerman_pairs_select_party_or_admin"
  ON public.boxing_cornerman_pairs FOR SELECT TO authenticated
  USING (
    requester_user_id = auth.uid()
    OR receiver_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_branch_manager_of(auth.uid(), requester_user_id)
    OR public.is_branch_manager_of(auth.uid(), receiver_user_id)
  );

DROP POLICY IF EXISTS "boxing_cornerman_pairs_super_admin_manage"
  ON public.boxing_cornerman_pairs;
CREATE POLICY "boxing_cornerman_pairs_super_admin_manage"
  ON public.boxing_cornerman_pairs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- boxing_cornerman_daily_syncs: 본인이 포함된 pair 만 SELECT
DROP POLICY IF EXISTS "boxing_cornerman_daily_syncs_select_party_or_admin"
  ON public.boxing_cornerman_daily_syncs;
CREATE POLICY "boxing_cornerman_daily_syncs_select_party_or_admin"
  ON public.boxing_cornerman_daily_syncs FOR SELECT TO authenticated
  USING (
    user_a_id = auth.uid()
    OR user_b_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_branch_manager_of(auth.uid(), user_a_id)
    OR public.is_branch_manager_of(auth.uid(), user_b_id)
  );

DROP POLICY IF EXISTS "boxing_cornerman_daily_syncs_super_admin_manage"
  ON public.boxing_cornerman_daily_syncs;
CREATE POLICY "boxing_cornerman_daily_syncs_super_admin_manage"
  ON public.boxing_cornerman_daily_syncs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- =====================================================================
-- 헬퍼 — 코너맨 pending 7일 만료 lazy update (§11-⑩)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.boxing_cornerman_expire_stale_pending()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.boxing_cornerman_pairs
  SET status = 'expired'
  WHERE status = 'pending'
    AND requested_at < now() - INTERVAL '7 days';
END;
$$;

-- =====================================================================
-- 헬퍼 — 회원이 이미 active pair 가지고 있는지 (§11-⑨ 양면 검증)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.boxing_cornerman_has_active_pair(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.boxing_cornerman_pairs
    WHERE status = 'active'
      AND (requester_user_id = p_user_id OR receiver_user_id = p_user_id)
  );
END;
$$;

-- =====================================================================
-- 헬퍼 — 회원의 branch_name 조회 (RLS 우회용)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.boxing_cornerman_user_branch(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_branch text;
BEGIN
  SELECT branch_name INTO v_branch
  FROM public.profiles
  WHERE id = p_user_id;
  RETURN v_branch;
END;
$$;

-- =====================================================================
-- 헬퍼 — 오늘 회원이 진짜 QUEST 활동을 했는지 (§11-⑪ 어뷰징 방지)
-- 컨디션 기록(보상 0)은 제외 — 실제 보상 또는 의미 있는 활동만 카운트
-- =====================================================================
CREATE OR REPLACE FUNCTION public.boxing_cornerman_user_completed_today(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_kst_date date;
BEGIN
  v_kst_date := (now() AT TIME ZONE 'Asia/Seoul')::date;

  -- boxing_engagement_events 단일 소스 (§11-④).
  -- 컨디션은 보상 0 이라 어뷰징 가능 → 제외.
  -- 진짜 활동: 퀴즈 정답, 챌린지 완료/제출, 일기, 응원, 리턴 라운드, 숨겨진 미션
  RETURN EXISTS (
    SELECT 1 FROM public.boxing_engagement_events
    WHERE user_id = p_user_id
      AND ((created_at AT TIME ZONE 'Asia/Seoul')::date) = v_kst_date
      AND action NOT IN ('condition_logged')
  );
END;
$$;

-- =====================================================================
-- A. get_cornerman_candidates(p_limit integer)
--    — 같은 branch 회원 중 본인 제외 + active pair 없는 회원 후보
--    — 민감정보 (phone, email, birth_date) 미포함
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_cornerman_candidates(p_limit integer DEFAULT 30)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  branch_name text,
  current_rank text,
  current_level integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_my_branch text;
  v_limit integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  -- 만료 처리 (lazy)
  PERFORM public.boxing_cornerman_expire_stale_pending();

  v_my_branch := public.boxing_cornerman_user_branch(v_uid);
  IF v_my_branch IS NULL OR length(trim(v_my_branch)) = 0 THEN
    RAISE EXCEPTION 'cornerman branch unknown';
  END IF;

  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 30), 100));

  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.display_name,
    p.branch_name,
    COALESCE(mp.current_rank::text, 'white') AS current_rank,
    COALESCE(mp.current_level, 1) AS current_level
  FROM public.profiles p
  LEFT JOIN public.member_progress mp ON mp.user_id = p.id
  WHERE p.id <> v_uid
    AND p.branch_name = v_my_branch
    AND COALESCE(p.role::text, 'member') = 'member'
    AND NOT public.boxing_cornerman_has_active_pair(p.id)
    AND NOT EXISTS (
      -- 이미 본인이 보낸 pending 또는 받은 pending 이 있는 회원도 제외
      SELECT 1 FROM public.boxing_cornerman_pairs cp
      WHERE cp.status = 'pending'
        AND ((cp.requester_user_id = v_uid AND cp.receiver_user_id = p.id)
          OR (cp.receiver_user_id = v_uid AND cp.requester_user_id = p.id))
    )
  ORDER BY p.created_at DESC
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cornerman_candidates(integer) TO authenticated;

-- =====================================================================
-- B. request_cornerman_pair(p_receiver_user_id)
--    — pending 상태로 요청 생성
--    — 양면 검증 (§11-⑨), 같은 지점만 (§11-⑪)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.request_cornerman_pair(p_receiver_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_my_branch text;
  v_their_branch text;
  v_pair_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF p_receiver_user_id IS NULL THEN
    RAISE EXCEPTION 'receiver required';
  END IF;
  IF p_receiver_user_id = v_uid THEN
    RAISE EXCEPTION 'cannot request self';
  END IF;

  PERFORM public.boxing_cornerman_expire_stale_pending();

  -- 양면 검증 — 양쪽 user 모두 active pair 없어야 함
  IF public.boxing_cornerman_has_active_pair(v_uid) THEN
    RAISE EXCEPTION 'cornerman pair already exists';
  END IF;
  IF public.boxing_cornerman_has_active_pair(p_receiver_user_id) THEN
    RAISE EXCEPTION 'cornerman pair already exists';
  END IF;

  -- 같은 지점 검증 (§11-⑪)
  v_my_branch := public.boxing_cornerman_user_branch(v_uid);
  v_their_branch := public.boxing_cornerman_user_branch(p_receiver_user_id);
  IF v_my_branch IS NULL OR v_their_branch IS NULL THEN
    RAISE EXCEPTION 'cornerman branch unknown';
  END IF;
  IF v_my_branch <> v_their_branch THEN
    RAISE EXCEPTION 'cornerman branch mismatch';
  END IF;

  -- 중복 pending 방지 (양방향)
  IF EXISTS (
    SELECT 1 FROM public.boxing_cornerman_pairs
    WHERE status = 'pending'
      AND ((requester_user_id = v_uid AND receiver_user_id = p_receiver_user_id)
        OR (requester_user_id = p_receiver_user_id AND receiver_user_id = v_uid))
  ) THEN
    RAISE EXCEPTION 'cornerman request already pending';
  END IF;

  PERFORM public.ensure_boxing_engagement_profile(v_uid);
  PERFORM public.ensure_boxing_engagement_profile(p_receiver_user_id);

  INSERT INTO public.boxing_cornerman_pairs (
    requester_user_id, receiver_user_id, status, branch_name
  ) VALUES (
    v_uid, p_receiver_user_id, 'pending', v_my_branch
  )
  RETURNING id INTO v_pair_id;

  RETURN jsonb_build_object(
    'success', true,
    'pair_id', v_pair_id,
    'status', 'pending',
    'message', '코너맨 요청을 보냈습니다. 상대 회원의 응답을 기다리고 있습니다.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_cornerman_pair(uuid) TO authenticated;

-- =====================================================================
-- C. respond_cornerman_pair(p_pair_id, p_action)
--    — receiver 만 응답 가능, accept 시 active 처리
-- =====================================================================
CREATE OR REPLACE FUNCTION public.respond_cornerman_pair(
  p_pair_id uuid,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pair public.boxing_cornerman_pairs%ROWTYPE;
  v_msg text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF p_pair_id IS NULL THEN
    RAISE EXCEPTION 'pair_id required';
  END IF;
  IF p_action NOT IN ('accept', 'decline') THEN
    RAISE EXCEPTION 'invalid action';
  END IF;

  PERFORM public.boxing_cornerman_expire_stale_pending();

  SELECT * INTO v_pair FROM public.boxing_cornerman_pairs WHERE id = p_pair_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cornerman pair not found';
  END IF;

  -- receiver 만 응답 가능
  IF v_pair.receiver_user_id <> v_uid THEN
    RAISE EXCEPTION 'cornerman not your pair';
  END IF;

  IF v_pair.status <> 'pending' THEN
    RAISE EXCEPTION 'cornerman not pending';
  END IF;

  IF p_action = 'accept' THEN
    -- 양면 검증 — 수락 시점에 양쪽 모두 active pair 없어야
    IF public.boxing_cornerman_has_active_pair(v_pair.requester_user_id) THEN
      RAISE EXCEPTION 'cornerman pair already exists';
    END IF;
    IF public.boxing_cornerman_has_active_pair(v_pair.receiver_user_id) THEN
      RAISE EXCEPTION 'cornerman pair already exists';
    END IF;

    UPDATE public.boxing_cornerman_pairs
    SET status = 'active', accepted_at = now()
    WHERE id = p_pair_id;

    v_msg := '코너맨이 되었습니다. 함께 오래 가는 복서가 되어봅시다.';
  ELSE
    UPDATE public.boxing_cornerman_pairs
    SET status = 'declined', ended_at = now()
    WHERE id = p_pair_id;

    v_msg := '요청을 거절했습니다.';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'pair_id', p_pair_id,
    'status', CASE WHEN p_action = 'accept' THEN 'active' ELSE 'declined' END,
    'message', v_msg
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_cornerman_pair(uuid, text) TO authenticated;

-- =====================================================================
-- D. end_cornerman_pair(p_pair_id)
--    — pair 당사자만 종료 가능
-- =====================================================================
CREATE OR REPLACE FUNCTION public.end_cornerman_pair(p_pair_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pair public.boxing_cornerman_pairs%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  SELECT * INTO v_pair FROM public.boxing_cornerman_pairs WHERE id = p_pair_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cornerman pair not found';
  END IF;

  IF v_pair.requester_user_id <> v_uid AND v_pair.receiver_user_id <> v_uid THEN
    RAISE EXCEPTION 'cornerman not your pair';
  END IF;

  IF v_pair.status NOT IN ('active', 'pending') THEN
    RAISE EXCEPTION 'cornerman already ended';
  END IF;

  UPDATE public.boxing_cornerman_pairs
  SET status = 'ended', ended_at = now()
  WHERE id = p_pair_id;

  RETURN jsonb_build_object(
    'success', true,
    'pair_id', p_pair_id,
    'status', 'ended',
    'message', '코너맨 관계를 종료했습니다.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.end_cornerman_pair(uuid) TO authenticated;

-- =====================================================================
-- E. get_my_cornerman_status()
--    — 현재 active pair, pending received/sent, 오늘 sync 상태 반환
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_my_cornerman_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_active_pair public.boxing_cornerman_pairs%ROWTYPE;
  v_pending_received jsonb := '[]'::jsonb;
  v_pending_sent jsonb := '[]'::jsonb;
  v_partner_id uuid;
  v_partner_name text;
  v_partner_rank text;
  v_partner_level integer;
  v_kst_date date;
  v_my_completed boolean;
  v_partner_completed boolean;
  v_today_sync public.boxing_cornerman_daily_syncs%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  PERFORM public.boxing_cornerman_expire_stale_pending();

  -- active pair
  SELECT * INTO v_active_pair
  FROM public.boxing_cornerman_pairs
  WHERE status = 'active'
    AND (requester_user_id = v_uid OR receiver_user_id = v_uid)
  ORDER BY accepted_at DESC NULLS LAST
  LIMIT 1;

  -- pending received (남이 나에게 보낸 요청)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'pair_id', cp.id,
    'requester_user_id', cp.requester_user_id,
    'requester_name', p.display_name,
    'requester_rank', COALESCE(mp.current_rank::text, 'white'),
    'requester_level', COALESCE(mp.current_level, 1),
    'requested_at', cp.requested_at
  )), '[]'::jsonb) INTO v_pending_received
  FROM public.boxing_cornerman_pairs cp
  LEFT JOIN public.profiles p ON p.id = cp.requester_user_id
  LEFT JOIN public.member_progress mp ON mp.user_id = cp.requester_user_id
  WHERE cp.status = 'pending'
    AND cp.receiver_user_id = v_uid;

  -- pending sent (내가 보낸 요청)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'pair_id', cp.id,
    'receiver_user_id', cp.receiver_user_id,
    'receiver_name', p.display_name,
    'requested_at', cp.requested_at
  )), '[]'::jsonb) INTO v_pending_sent
  FROM public.boxing_cornerman_pairs cp
  LEFT JOIN public.profiles p ON p.id = cp.receiver_user_id
  WHERE cp.status = 'pending'
    AND cp.requester_user_id = v_uid;

  -- active 가 없으면 여기서 반환
  IF v_active_pair.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'has_active', false,
      'pending_received', v_pending_received,
      'pending_sent', v_pending_sent
    );
  END IF;

  -- 파트너 정보
  IF v_active_pair.requester_user_id = v_uid THEN
    v_partner_id := v_active_pair.receiver_user_id;
  ELSE
    v_partner_id := v_active_pair.requester_user_id;
  END IF;

  SELECT p.display_name,
         COALESCE(mp.current_rank::text, 'white'),
         COALESCE(mp.current_level, 1)
  INTO v_partner_name, v_partner_rank, v_partner_level
  FROM public.profiles p
  LEFT JOIN public.member_progress mp ON mp.user_id = p.id
  WHERE p.id = v_partner_id;

  -- 오늘 활동 상태
  v_kst_date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_my_completed := public.boxing_cornerman_user_completed_today(v_uid);
  v_partner_completed := public.boxing_cornerman_user_completed_today(v_partner_id);

  -- 오늘 sync row (있으면)
  SELECT * INTO v_today_sync
  FROM public.boxing_cornerman_daily_syncs
  WHERE pair_id = v_active_pair.id
    AND sync_date = v_kst_date;

  RETURN jsonb_build_object(
    'success', true,
    'has_active', true,
    'pair_id', v_active_pair.id,
    'partner_user_id', v_partner_id,
    'partner_name', v_partner_name,
    'partner_rank', v_partner_rank,
    'partner_level', v_partner_level,
    'accepted_at', v_active_pair.accepted_at,
    'today', jsonb_build_object(
      'date', v_kst_date,
      'my_completed', v_my_completed,
      'partner_completed', v_partner_completed,
      'both_completed', v_my_completed AND v_partner_completed,
      'bonus_claimed', COALESCE(v_today_sync.bonus_claimed, false)
    ),
    'pending_received', v_pending_received,
    'pending_sent', v_pending_sent
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_cornerman_status() TO authenticated;

-- =====================================================================
-- F. claim_cornerman_daily_bonus()
--    — active pair + 오늘 둘 다 진짜 활동 + 1일 1회 + 어뷰징 4중 검증
-- =====================================================================
CREATE OR REPLACE FUNCTION public.claim_cornerman_daily_bonus()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pair public.boxing_cornerman_pairs%ROWTYPE;
  v_partner_id uuid;
  v_kst_date date;
  v_my_completed boolean;
  v_partner_completed boolean;
  v_existing_sync public.boxing_cornerman_daily_syncs%ROWTYPE;
  v_xp integer := 50;
  v_gems integer := 100;
  v_respect integer := 10;
  v_idem text;
  v_sync_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  -- 검증 1: active pair
  SELECT * INTO v_pair
  FROM public.boxing_cornerman_pairs
  WHERE status = 'active'
    AND (requester_user_id = v_uid OR receiver_user_id = v_uid)
  ORDER BY accepted_at DESC NULLS LAST
  LIMIT 1;

  IF NOT FOUND OR v_pair.id IS NULL THEN
    RAISE EXCEPTION 'cornerman bonus not eligible';
  END IF;

  IF v_pair.requester_user_id = v_uid THEN
    v_partner_id := v_pair.receiver_user_id;
  ELSE
    v_partner_id := v_pair.requester_user_id;
  END IF;

  v_kst_date := (now() AT TIME ZONE 'Asia/Seoul')::date;

  -- 검증 2: 오늘 둘 다 진짜 활동 (§11-⑪)
  v_my_completed := public.boxing_cornerman_user_completed_today(v_uid);
  v_partner_completed := public.boxing_cornerman_user_completed_today(v_partner_id);

  IF NOT (v_my_completed AND v_partner_completed) THEN
    RAISE EXCEPTION 'cornerman bonus not eligible';
  END IF;

  -- 검증 3: 오늘 이미 받았는지
  SELECT * INTO v_existing_sync
  FROM public.boxing_cornerman_daily_syncs
  WHERE pair_id = v_pair.id AND sync_date = v_kst_date;

  IF FOUND AND v_existing_sync.bonus_claimed THEN
    RAISE EXCEPTION 'cornerman bonus already claimed';
  END IF;

  PERFORM public.ensure_boxing_engagement_profile(v_uid);
  PERFORM public.ensure_boxing_engagement_profile(v_partner_id);

  -- daily_syncs upsert
  INSERT INTO public.boxing_cornerman_daily_syncs (
    pair_id, user_a_id, user_b_id, sync_date,
    user_a_completed, user_b_completed, bonus_claimed,
    quest_xp_granted, gems_granted, respect_granted
  ) VALUES (
    v_pair.id, v_pair.requester_user_id, v_pair.receiver_user_id, v_kst_date,
    true, true, true,
    v_xp, v_gems, v_respect
  )
  ON CONFLICT (pair_id, sync_date) DO UPDATE
    SET user_a_completed = true,
        user_b_completed = true,
        bonus_claimed = true,
        quest_xp_granted = EXCLUDED.quest_xp_granted,
        gems_granted = EXCLUDED.gems_granted,
        respect_granted = EXCLUDED.respect_granted
  RETURNING id INTO v_sync_id;

  -- engagement events 양쪽 모두 idempotency_key 별도
  -- 본인
  v_idem := concat('cornerman_bonus:', v_pair.id::text, ':', v_kst_date::text, ':', v_uid::text);
  INSERT INTO public.boxing_engagement_events (
    user_id, event_type, source_type, source_id, action,
    quest_xp_delta, gems_delta, respect_delta, idempotency_key, metadata
  ) VALUES (
    v_uid, 'reward', 'boxing_cornerman', v_pair.id,
    'cornerman_bonus_claimed',
    v_xp, v_gems, v_respect, v_idem,
    jsonb_build_object('pair_id', v_pair.id, 'partner_id', v_partner_id)
  )
  ON CONFLICT (user_id, idempotency_key) DO NOTHING;

  -- 파트너
  v_idem := concat('cornerman_bonus:', v_pair.id::text, ':', v_kst_date::text, ':', v_partner_id::text);
  INSERT INTO public.boxing_engagement_events (
    user_id, event_type, source_type, source_id, action,
    quest_xp_delta, gems_delta, respect_delta, idempotency_key, metadata
  ) VALUES (
    v_partner_id, 'reward', 'boxing_cornerman', v_pair.id,
    'cornerman_bonus_claimed',
    v_xp, v_gems, v_respect, v_idem,
    jsonb_build_object('pair_id', v_pair.id, 'partner_id', v_uid)
  )
  ON CONFLICT (user_id, idempotency_key) DO NOTHING;

  -- 프로필 누적 양쪽 모두
  UPDATE public.boxing_engagement_profiles
  SET quest_xp = quest_xp + v_xp,
      respect_points = respect_points + v_respect
  WHERE user_id IN (v_uid, v_partner_id);

  -- 파이트 머니 grant_gems 경유 (양쪽 모두)
  IF v_gems > 0 THEN
    PERFORM public.grant_gems(v_uid, v_gems, '코너맨 일일 보너스');
    PERFORM public.grant_gems(v_partner_id, v_gems, '코너맨 일일 보너스');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'pair_id', v_pair.id,
    'sync_id', v_sync_id,
    'quest_xp_granted', v_xp,
    'gems_granted', v_gems,
    'respect_granted', v_respect,
    'message', '코너맨 일일 보너스를 받았습니다. 둘 다 오늘 라운드를 클리어했습니다.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_cornerman_daily_bonus() TO authenticated;
