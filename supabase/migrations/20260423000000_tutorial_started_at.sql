-- ══════════════════════════════════════════════════════════════════
-- 입단식 Phase 1 — tutorial_started_at 컬럼 추가 + RPC 스탬핑
--
-- 이 마이그레이션은 20260420140000 (tutorial_state_columns),
-- 20260422000000 (tutorial_induction_ceremony) 의 후속.
-- 기존 컬럼/RPC/테이블/보상 정책은 전부 유지하고, 감사 추적용
-- `tutorial_started_at` 타임스탬프 하나만 추가한다.
--
-- 설계 의도
--   • "최초 로그인 1회 자동 실행" 판별을 분석 이벤트와 맞물리게
--     하려면 시작 시점 기록이 필요하다. 현재는 completed_at 만 있어
--     도중 이탈/스킵 시점을 알 수 없다.
--   • UI 로직은 여전히 tutorial_completed / tutorial_step /
--     tutorial_skipped 조합으로만 판단 — started_at 은 감사용.
--   • 스킵도 "시작했다"로 간주 (스킵 버튼을 누른 시점도 스탬핑).
--
-- 기존 호환성
--   • 컬럼은 nullable + DEFAULT 없음 → 기존 row 손상 없음.
--   • 기존 유저 백필은 completed_at 또는 skipped=true 케이스만 수행.
--   • update_tutorial_step / mark_tutorial_skipped 시그니처는 불변.
-- ══════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- A. 컬럼 추가 (nullable, default 없음 — 기존 데이터 불변)
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tutorial_started_at timestamptz;

COMMENT ON COLUMN public.profiles.tutorial_started_at IS
  '튜토리얼 최초 진입 시점 (첫 update_tutorial_step 호출 또는 mark_tutorial_skipped). NULL = 아직 미진입. 재시작해도 보존 (최초 시점 추적용).';


-- ──────────────────────────────────────────────────────────────────
-- B. update_tutorial_step — 최초 1회 started_at 스탬핑
--   기존 로직 (GREATEST 전진) 유지 + COALESCE 로 최초 진입만 기록.
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_tutorial_step(_step integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_step    int  := GREATEST(0, LEAST(COALESCE(_step, 0), 5));
  v_new     int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.profiles
     SET tutorial_step       = GREATEST(tutorial_step, v_step),
         tutorial_started_at = COALESCE(tutorial_started_at, now())
   WHERE user_id = v_user_id
  RETURNING tutorial_step INTO v_new;

  RETURN v_new;
END;
$$;


-- ──────────────────────────────────────────────────────────────────
-- C. mark_tutorial_skipped — 스킵도 시작 시점으로 간주
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_tutorial_skipped()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  UPDATE public.profiles
     SET tutorial_skipped    = true,
         tutorial_started_at = COALESCE(tutorial_started_at, now())
   WHERE user_id = v_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- ──────────────────────────────────────────────────────────────────
-- D. 백필 — 이미 완료/스킵한 유저의 started_at 을 알 수 있는 범위 내에서 복원
--    우선순위: completed_at > created_at.  Skipped-only 유저는 created_at.
-- ──────────────────────────────────────────────────────────────────
UPDATE public.profiles
   SET tutorial_started_at = COALESCE(
     tutorial_started_at,
     tutorial_completed_at,
     created_at
   )
 WHERE tutorial_started_at IS NULL
   AND (
     tutorial_completed = true
     OR tutorial_skipped = true
     OR tutorial_step > 0
   );


-- ──────────────────────────────────────────────────────────────────
-- E. PostgREST schema 캐시 리로드
-- ──────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
