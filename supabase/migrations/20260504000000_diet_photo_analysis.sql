-- =========================================================================
-- 153 다이어트 · 식단 사진 AI 간편 평가 필드
--
-- 목적: diet_daily_log_photos 에 분석 카테고리 + 한 줄 피드백 + 태그 저장.
--      정확한 영양학 판정이 아니라 "좋음/보통/조절 필요" 3단계 코칭 수준.
--
-- 원칙:
--   · 벌점·죄책감 유발 문구 금지 (DB 에 저장되는 text 는 클라이언트 생성)
--   · 제공자 교체 가능하게 — provider 필드 따로 저장 (claude|groq|rules)
--   · 자동 삭제 90일 정책(기존)과 호환
-- =========================================================================

-- 1. Enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'diet_photo_category') THEN
    CREATE TYPE public.diet_photo_category AS ENUM ('good','normal','adjust');
  END IF;
END$$;

-- 2. 컬럼 추가
ALTER TABLE public.diet_daily_log_photos
  ADD COLUMN IF NOT EXISTS category public.diet_photo_category,
  ADD COLUMN IF NOT EXISTS feedback text,
  ADD COLUMN IF NOT EXISTS detected_tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS analyzed_at timestamptz;

COMMENT ON COLUMN public.diet_daily_log_photos.category IS
  '분석 카테고리 — good(좋음) | normal(보통) | adjust(조절 필요). 코칭 수준 3단계.';
COMMENT ON COLUMN public.diet_daily_log_photos.feedback IS
  '한 줄 피드백 (한국어, 부드러운 톤). 실패/벌 프레임 금지.';
COMMENT ON COLUMN public.diet_daily_log_photos.detected_tags IS
  '감지 태그 배열 예: protein_ok, carb_high, late_night, fried_heavy.';

-- 3. RPC — save_diet_photo_analysis
CREATE OR REPLACE FUNCTION public.save_diet_photo_analysis(
  _photo_id uuid,
  _category public.diet_photo_category,
  _feedback text,
  _detected_tags text[] DEFAULT NULL,
  _provider text DEFAULT 'rules'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _owner uuid;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT user_id INTO _owner FROM public.diet_daily_log_photos WHERE id = _photo_id;
  IF _owner IS NULL OR _owner <> _uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  -- feedback 길이·카테고리 방어
  IF _feedback IS NULL OR length(trim(_feedback)) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'empty_feedback');
  END IF;
  IF length(_feedback) > 400 THEN
    _feedback := substr(_feedback, 1, 400);
  END IF;

  UPDATE public.diet_daily_log_photos SET
    category = _category,
    feedback = trim(_feedback),
    detected_tags = COALESCE(_detected_tags, '{}'::text[]),
    provider = COALESCE(_provider, 'rules'),
    analyzed_at = now()
  WHERE id = _photo_id;

  RETURN jsonb_build_object('success', true, 'photo_id', _photo_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_diet_photo_analysis(
  uuid, public.diet_photo_category, text, text[], text
) TO authenticated;

-- 4. 인덱스 — 일자별 사진 카테고리 집계
CREATE INDEX IF NOT EXISTS diet_photos_user_uploaded_idx
  ON public.diet_daily_log_photos(user_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS diet_photos_category_idx
  ON public.diet_daily_log_photos(category) WHERE category IS NOT NULL;
