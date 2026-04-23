-- =========================================================================
-- 153 다이어트 · 식단 사진 업로드 파이트 머니 보상
--
-- 목적: 사진 업로드도 "다이어트 활동"에 포함되도록 하루 최대 2장까지
--      +2 gems 지급. 3장부터는 기록만 되고 보상 없음 (스팸 방지).
--
-- 방식: add_diet_log_photo RPC 를 CREATE OR REPLACE 로 덮어써서
--      INSERT 성공 직후 당일 사진 수를 세고, 보상 대상이면 grant_gems 호출.
--      gem_transactions 테이블 존재 여부와 무관하게 diet_daily_log_photos 만 참조.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.add_diet_log_photo(
  _log_id uuid,
  _storage_path text,
  _meal_slot diet_meal_slot
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _owner uuid;
  _log_date date;
  _id uuid;
  _photos_today_before int;
  _rewarded boolean := false;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT user_id, log_date INTO _owner, _log_date
  FROM public.diet_daily_logs WHERE id = _log_id;
  IF _owner IS NULL OR _owner <> _uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  -- 같은 log 의 기존 사진 수를 먼저 센다 (이번 INSERT 전).
  -- 0장/1장이면 이번 업로드에 보상 지급, 2장 이상이면 skip.
  SELECT COALESCE(COUNT(*), 0) INTO _photos_today_before
  FROM public.diet_daily_log_photos
  WHERE log_id = _log_id;

  INSERT INTO public.diet_daily_log_photos (log_id, user_id, storage_path, meal_slot)
  VALUES (_log_id, _uid, _storage_path, _meal_slot)
  RETURNING id INTO _id;

  IF _photos_today_before < 2 THEN
    PERFORM public.grant_gems(_uid, 2, 'diet_photo_upload');
    _rewarded := true;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'photo_id', _id,
    'rewarded', _rewarded,
    'photos_on_log', _photos_today_before + 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_diet_log_photo(uuid, text, diet_meal_slot) TO authenticated;
