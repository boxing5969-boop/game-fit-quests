-- =====================================================================
-- 7일 스타터 캠프 — 튜토리얼 글로벌 오버라이드 (관리자 publish → 전체 회원)
--
-- 단일 row (id=1) 의 JSON 컬럼에 3종 데이터 통째로 보관:
--   · step_overrides — Record<"day.step", TutorialStepOverridePartial>
--   · step_order     — Record<day, originalSteps[]>
--   · custom_steps   — Record<day, TutorialCampStep[]>
--
-- RLS: SELECT all authenticated, WRITE only has_role(auth.uid(),'admin').
-- RPC:
--   · get_tutorial_global_overrides() — 모든 회원 호출 가능
--   · publish_tutorial_global_overrides(p_payload jsonb) — admin 만
--
-- 보호 원칙:
--   · 공식 1~40 levels/missions/member_progress 미수정
--   · 공식 XP / wallet 변경 0건 — 튜토리얼 메타데이터만
-- =====================================================================

-- ─── 1. tutorial_global_overrides 테이블 ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.tutorial_global_overrides (
  id integer PRIMARY KEY DEFAULT 1,
  step_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  step_order     jsonb NOT NULL DEFAULT '{}'::jsonb,
  custom_steps   jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tutorial_global_overrides_singleton CHECK (id = 1)
);

ALTER TABLE public.tutorial_global_overrides ENABLE ROW LEVEL SECURITY;

-- 초기 row insert (없을 때만)
INSERT INTO public.tutorial_global_overrides (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ─── 2. RLS ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tutorial_global_overrides_select_all"
  ON public.tutorial_global_overrides;
CREATE POLICY "tutorial_global_overrides_select_all"
  ON public.tutorial_global_overrides FOR SELECT TO authenticated
  USING (true);

-- WRITE 는 RPC 만 — authenticated 에 직접 권한 부여 X.
-- (publish RPC 가 SECURITY DEFINER + has_role admin 체크로 우회.)

-- ─── 3. RPC: get_tutorial_global_overrides ────────────────────────────
CREATE OR REPLACE FUNCTION public.get_tutorial_global_overrides()
RETURNS TABLE (
  step_overrides jsonb,
  step_order     jsonb,
  custom_steps   jsonb,
  updated_at     timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 로그인 안 해도 호출 가능 — 튜토리얼 메타는 공개 데이터.
  RETURN QUERY
  SELECT
    t.step_overrides,
    t.step_order,
    t.custom_steps,
    t.updated_at
  FROM public.tutorial_global_overrides t
  WHERE t.id = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tutorial_global_overrides() TO anon, authenticated;

-- ─── 4. RPC: publish_tutorial_global_overrides ────────────────────────
-- payload 형식 (jsonb):
--   {
--     "step_overrides": { ... },
--     "step_order":     { ... },
--     "custom_steps":   { ... }
--   }
-- 누락된 키는 빈 객체 처리.
CREATE OR REPLACE FUNCTION public.publish_tutorial_global_overrides(
  p_payload jsonb
)
RETURNS TABLE (success boolean, updated_at timestamptz, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_overrides jsonb;
  v_order jsonb;
  v_custom jsonb;
  v_ts timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  IF NOT public.has_role(v_user, 'admin') THEN
    RAISE EXCEPTION '관리자만 튜토리얼을 전체 회원에게 반영할 수 있습니다.';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid payload — must be a JSON object';
  END IF;

  v_overrides := COALESCE(p_payload -> 'step_overrides', '{}'::jsonb);
  v_order     := COALESCE(p_payload -> 'step_order',     '{}'::jsonb);
  v_custom    := COALESCE(p_payload -> 'custom_steps',   '{}'::jsonb);

  IF jsonb_typeof(v_overrides) <> 'object'
     OR jsonb_typeof(v_order) <> 'object'
     OR jsonb_typeof(v_custom) <> 'object' THEN
    RAISE EXCEPTION 'invalid payload — step_overrides/step_order/custom_steps must each be a JSON object';
  END IF;

  -- 단일 row upsert
  INSERT INTO public.tutorial_global_overrides (id, step_overrides, step_order, custom_steps, updated_by, updated_at)
  VALUES (1, v_overrides, v_order, v_custom, v_user, now())
  ON CONFLICT (id) DO UPDATE
  SET step_overrides = EXCLUDED.step_overrides,
      step_order     = EXCLUDED.step_order,
      custom_steps   = EXCLUDED.custom_steps,
      updated_by     = EXCLUDED.updated_by,
      updated_at     = EXCLUDED.updated_at
  RETURNING tutorial_global_overrides.updated_at INTO v_ts;

  RETURN QUERY SELECT true, v_ts, '전체 회원에게 반영되었습니다.'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_tutorial_global_overrides(jsonb) TO authenticated;
