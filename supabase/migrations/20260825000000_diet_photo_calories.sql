-- =========================================================================
-- 153 다이어트 · 식단 사진 칼로리 추정 필드
--
-- 목적: diet_daily_log_photos 에 "무엇을 얼마나 먹었나" 를 저장한다.
--      Vision AI 가 음식 목록과 양을 추정하고, 회원이 화면에서 고친 뒤
--      확정한 최종값만 여기에 들어온다. (AI 추정값 단독 저장 안 함)
--
-- 원칙:
--   · 칼로리는 "추정" 이다. 정확한 영양 판정 아님 — 화면에 항상 약(≈) 표기.
--   · 회원이 확정(confirmed_at)한 값만 오늘 합계에 잡힌다.
--   · 죄책감 유발·벌점 문구 금지 (기존 feedback 규칙 그대로 승계)
--   · 기존 save_diet_photo_analysis 는 건드리지 않는다 (하위 호환)
-- =========================================================================

-- 1. 컬럼 추가
ALTER TABLE public.diet_daily_log_photos
  ADD COLUMN IF NOT EXISTS items           jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS total_kcal      integer,
  ADD COLUMN IF NOT EXISTS total_protein_g integer,
  ADD COLUMN IF NOT EXISTS kcal_source     text,
  ADD COLUMN IF NOT EXISTS kcal_confidence text,
  ADD COLUMN IF NOT EXISTS confirmed_at    timestamptz;

COMMENT ON COLUMN public.diet_daily_log_photos.items IS
  '확정된 음식 목록. [{"name":"김치찌개","portion":"1인분","kcal":320,"protein_g":18}, ...]';
COMMENT ON COLUMN public.diet_daily_log_photos.total_kcal IS
  '확정 칼로리 합계(kcal). 추정값이며 오차 ±20~30% 를 전제로 한다.';
COMMENT ON COLUMN public.diet_daily_log_photos.total_protein_g IS
  '확정 단백질 합계(g). 복싱 회원 코칭용 보조 지표.';
COMMENT ON COLUMN public.diet_daily_log_photos.kcal_source IS
  'ai(추정 그대로) | edited(회원이 수정) | manual(회원이 직접 입력)';
COMMENT ON COLUMN public.diet_daily_log_photos.kcal_confidence IS
  'AI 자체 신뢰도 — low | medium | high. 낮으면 화면에서 범위로만 안내.';
COMMENT ON COLUMN public.diet_daily_log_photos.confirmed_at IS
  '회원이 확정 버튼을 누른 시각. NULL 이면 오늘 합계에 잡히지 않는다.';

-- 2. 방어적 체크 제약 (이미 있으면 건너뜀)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'diet_photos_kcal_range_chk'
  ) THEN
    ALTER TABLE public.diet_daily_log_photos
      ADD CONSTRAINT diet_photos_kcal_range_chk
      CHECK (total_kcal IS NULL OR (total_kcal >= 0 AND total_kcal <= 6000));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'diet_photos_protein_range_chk'
  ) THEN
    ALTER TABLE public.diet_daily_log_photos
      ADD CONSTRAINT diet_photos_protein_range_chk
      CHECK (total_protein_g IS NULL OR (total_protein_g >= 0 AND total_protein_g <= 400));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'diet_photos_kcal_source_chk'
  ) THEN
    ALTER TABLE public.diet_daily_log_photos
      ADD CONSTRAINT diet_photos_kcal_source_chk
      CHECK (kcal_source IS NULL OR kcal_source IN ('ai','edited','manual'));
  END IF;
END$$;

-- 3. RPC — confirm_diet_photo_calories
--    회원이 확인·수정한 최종값을 한 번에 저장한다. 사진 소유자만 가능.
CREATE OR REPLACE FUNCTION public.confirm_diet_photo_calories(
  _photo_id        uuid,
  _items           jsonb,
  _total_kcal      integer,
  _total_protein_g integer DEFAULT NULL,
  _source          text    DEFAULT 'ai',
  _confidence      text    DEFAULT NULL,
  _category        public.diet_photo_category DEFAULT NULL,
  _feedback        text    DEFAULT NULL,
  _detected_tags   text[]  DEFAULT NULL,
  _provider        text    DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid   uuid := auth.uid();
  _owner uuid;
  _kcal  integer;
  _prot  integer;
  _src   text;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT user_id INTO _owner FROM public.diet_daily_log_photos WHERE id = _photo_id;
  IF _owner IS NULL OR _owner <> _uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  -- items 는 배열이어야 하고, 개수·크기를 제한한다.
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' THEN
    RETURN jsonb_build_object('success', false, 'error', 'items_not_array');
  END IF;
  IF jsonb_array_length(_items) > 20 THEN
    RETURN jsonb_build_object('success', false, 'error', 'too_many_items');
  END IF;
  IF length(_items::text) > 4000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'items_too_large');
  END IF;

  -- 숫자는 범위로 클램프 (제약 위반으로 실패하지 않게)
  _kcal := LEAST(GREATEST(COALESCE(_total_kcal, 0), 0), 6000);
  _prot := CASE
             WHEN _total_protein_g IS NULL THEN NULL
             ELSE LEAST(GREATEST(_total_protein_g, 0), 400)
           END;
  _src  := CASE WHEN _source IN ('ai','edited','manual') THEN _source ELSE 'ai' END;

  UPDATE public.diet_daily_log_photos SET
    items           = _items,
    total_kcal      = _kcal,
    total_protein_g = _prot,
    kcal_source     = _src,
    kcal_confidence = CASE WHEN _confidence IN ('low','medium','high') THEN _confidence ELSE NULL END,
    confirmed_at    = now(),
    category        = COALESCE(_category, category),
    feedback        = COALESCE(NULLIF(trim(COALESCE(_feedback,'')), ''), feedback),
    detected_tags   = COALESCE(_detected_tags, detected_tags),
    provider        = COALESCE(_provider, provider),
    analyzed_at     = COALESCE(analyzed_at, now())
  WHERE id = _photo_id;

  RETURN jsonb_build_object(
    'success', true,
    'photo_id', _photo_id,
    'total_kcal', _kcal,
    'total_protein_g', _prot
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_diet_photo_calories(
  uuid, jsonb, integer, integer, text, text,
  public.diet_photo_category, text, text[], text
) TO authenticated;

-- 4. 인덱스 — 오늘 확정분 합계 조회
CREATE INDEX IF NOT EXISTS diet_photos_confirmed_idx
  ON public.diet_daily_log_photos(user_id, confirmed_at DESC)
  WHERE confirmed_at IS NOT NULL;
