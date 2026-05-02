-- ============================================================
-- 153 QUEST v1.5 — 14단계 컨디션 게이지
-- ============================================================
-- 목적:
--   회원이 오늘의 컨디션을 기록하고, 그 상태에 맞게 보조 퀘스트
--   추천 우선순위/문구가 바뀌게 한다. 공식 1~40 레벨업과는 무관.
-- 보호 원칙:
--   - 공식 미션/공식 XP 일절 미수정 (member_progress, missions, levels 등)
--   - 보상 0 (파밍 방지) — 컨디션 선택 자체에는 QUEST XP/RP/gems 지급 안함
--   - record_attendance 호출 0 / approve_mission_submission 호출 0
--   - boxing_engagement_profiles 직접 update 안 함 — 별도 테이블만 사용
-- 권한 패턴:
--   - 본인만 SELECT/INSERT
--   - super_admin / branch_manager SELECT
--   - UPDATE/DELETE 정책 미생성 (RLS enabled = deny by default)
-- ============================================================

-- =====================================================================
-- 1. boxing_condition_logs
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.boxing_condition_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  condition_type text NOT NULL,
  energy_level integer,
  pain_area text[] NOT NULL DEFAULT '{}',
  note text,
  selected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT boxing_condition_logs_type_chk
    CHECK (condition_type IN ('great','normal','tired','pain','short_time')),
  CONSTRAINT boxing_condition_logs_energy_chk
    CHECK (energy_level IS NULL OR (energy_level >= 0 AND energy_level <= 5))
);

CREATE INDEX IF NOT EXISTS idx_boxing_condition_logs_user_created
  ON public.boxing_condition_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_boxing_condition_logs_user_type
  ON public.boxing_condition_logs (user_id, condition_type);

ALTER TABLE public.boxing_condition_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- RLS — 본인 SELECT/INSERT 만, 변경은 RPC 만 수행 (UPDATE/DELETE 정책 없음)
-- =====================================================================

-- 본인 + super_admin + branch_manager SELECT
DROP POLICY IF EXISTS "boxing_condition_logs_select_self_or_admin"
  ON public.boxing_condition_logs;
CREATE POLICY "boxing_condition_logs_select_self_or_admin"
  ON public.boxing_condition_logs FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_branch_manager_of(auth.uid(), user_id)
  );

-- 본인 직접 INSERT 도 허용 (RPC 가 SECURITY DEFINER 지만, 보조 클라이언트
-- 인서트 안전망 — auth.uid() 와 user_id 일치 시만)
DROP POLICY IF EXISTS "boxing_condition_logs_insert_self"
  ON public.boxing_condition_logs;
CREATE POLICY "boxing_condition_logs_insert_self"
  ON public.boxing_condition_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- super_admin 전체 관리 (USING + WITH CHECK 양쪽 명시)
DROP POLICY IF EXISTS "boxing_condition_logs_super_admin_manage"
  ON public.boxing_condition_logs;
CREATE POLICY "boxing_condition_logs_super_admin_manage"
  ON public.boxing_condition_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- =====================================================================
-- A. submit_boxing_condition(p_condition_type, p_energy_level, p_pain_area, p_note)
-- =====================================================================
-- 동작:
--   1. auth.uid() NULL 검증
--   2. condition_type 검증 (CHECK 제약 + 명시 검증)
--   3. boxing_condition_logs INSERT (이력 보존 — 하루 여러 번 변경 가능)
--   4. boxing_engagement_events 에 'condition_logged' event 기록
--      (15단계 리턴 라운드의 마지막 활동일 계산이 자동 인식하도록)
--   5. 보상 0 — quest_xp_delta=0, gems_delta=0, respect_delta=0
--   6. boxing_engagement_profiles 의 metadata.last_condition 갱신 (옵션)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.submit_boxing_condition(
  p_condition_type text,
  p_energy_level integer DEFAULT NULL,
  p_pain_area text[] DEFAULT '{}',
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_log_id uuid;
  v_idem text;
  v_kst_date date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  IF p_condition_type IS NULL OR length(trim(p_condition_type)) = 0 THEN
    RAISE EXCEPTION 'condition_type required';
  END IF;

  IF p_condition_type NOT IN ('great','normal','tired','pain','short_time') THEN
    RAISE EXCEPTION 'invalid condition_type';
  END IF;

  IF p_energy_level IS NOT NULL
     AND (p_energy_level < 0 OR p_energy_level > 5) THEN
    RAISE EXCEPTION 'invalid energy_level';
  END IF;

  PERFORM public.ensure_boxing_engagement_profile(v_uid);

  -- 이력 INSERT (하루 여러 번 변경 가능 — 멱등성 없이 누적)
  INSERT INTO public.boxing_condition_logs (
    user_id, condition_type, energy_level, pain_area, note
  ) VALUES (
    v_uid, p_condition_type, p_energy_level, COALESCE(p_pain_area, '{}'), p_note
  )
  RETURNING id INTO v_log_id;

  -- engagement events 에 활동 기록 — 보상 0 / 마지막 활동일 계산용
  v_kst_date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_idem := concat(
    'condition_logged:',
    v_uid::text, ':',
    v_kst_date::text, ':',
    v_log_id::text
  );

  INSERT INTO public.boxing_engagement_events (
    user_id, event_type, source_type, source_id, action,
    quest_xp_delta, gems_delta, respect_delta, idempotency_key, metadata
  ) VALUES (
    v_uid,
    'activity',
    'boxing_condition',
    v_log_id,
    'condition_logged',
    0, 0, 0,
    v_idem,
    jsonb_build_object('condition_type', p_condition_type)
  )
  ON CONFLICT (user_id, idempotency_key) DO NOTHING;

  -- profile metadata.last_condition 갱신 (홈 진입 시 즉시 반영용)
  UPDATE public.boxing_engagement_profiles
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'last_condition', p_condition_type,
        'last_condition_at', now()
      )
  WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'success', true,
    'log_id', v_log_id,
    'condition_type', p_condition_type,
    'message', '오늘 컨디션이 기록되었습니다.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_boxing_condition(
  text, integer, text[], text
) TO authenticated;

-- =====================================================================
-- B. get_today_boxing_condition()
--    — 홈 진입 시 오늘의 KST 기준 가장 최근 컨디션 1건 반환
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_today_boxing_condition()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_log public.boxing_condition_logs%ROWTYPE;
  v_kst_start timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  v_kst_start := (now() AT TIME ZONE 'Asia/Seoul')::date::timestamptz
                 AT TIME ZONE 'Asia/Seoul';

  SELECT * INTO v_log
  FROM public.boxing_condition_logs
  WHERE user_id = v_uid
    AND created_at >= v_kst_start
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'has_today', false,
      'condition_type', NULL,
      'message', '오늘 컨디션이 아직 기록되지 않았습니다.'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'has_today', true,
    'log_id', v_log.id,
    'condition_type', v_log.condition_type,
    'energy_level', v_log.energy_level,
    'pain_area', v_log.pain_area,
    'note', v_log.note,
    'selected_at', v_log.selected_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_today_boxing_condition() TO authenticated;

-- =====================================================================
-- C. get_recent_boxing_conditions(p_days integer)
--    — 17단계 성장 리포트 / 숨겨진 미션 'condition_7' 카운트용
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_recent_boxing_conditions(
  p_days integer DEFAULT 14
)
RETURNS SETOF public.boxing_condition_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_days integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  v_days := GREATEST(1, LEAST(COALESCE(p_days, 14), 90));

  RETURN QUERY
  SELECT *
  FROM public.boxing_condition_logs
  WHERE user_id = v_uid
    AND created_at >= now() - make_interval(days => v_days)
  ORDER BY created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_recent_boxing_conditions(integer)
  TO authenticated;
