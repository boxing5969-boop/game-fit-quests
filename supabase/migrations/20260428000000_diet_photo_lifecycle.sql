-- ═══════════════════════════════════════════════════════════════════
-- 153 Diet — 사진 수명주기 (3개월 경과 자동 삭제)
--
-- 회원이 업로드한 `diet_daily_log_photos` 중 `uploaded_at < now() - 90d`
-- 레코드를 정리한다. storage 실물 파일도 함께 지우기 위해 RPC 는 경로
-- 배열을 반환하고, 클라이언트가 이를 받아 supabase.storage.remove() 로
-- 연달아 삭제한다 (SECURITY DEFINER 안에서 storage.objects 를 직접 건드리면
-- bucket policy 간섭이 생길 수 있어 클라이언트에 위임).
--
-- 본 RPC 는 회원 자신만 호출 가능하며, 타 사용자 데이터에 접근할 수 없다.
-- 멱등(idempotent) — 호출할수록 쌓이는 것 없음.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.purge_my_old_diet_photos(
  _older_than_days integer DEFAULT 90
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _cutoff timestamptz;
  _paths text[];
  _deleted int;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  IF _older_than_days < 30 THEN
    -- 안전장치: 실수로 최근 사진이 지워지지 않도록 최소 30일 보존.
    _older_than_days := 30;
  END IF;

  _cutoff := now() - make_interval(days => _older_than_days);

  -- 1) 지울 path 를 먼저 수집 (클라이언트가 storage 삭제에 사용)
  SELECT COALESCE(array_agg(storage_path), ARRAY[]::text[])
    INTO _paths
    FROM public.diet_daily_log_photos
   WHERE user_id = _uid
     AND uploaded_at < _cutoff;

  -- 2) DB rows 삭제
  DELETE FROM public.diet_daily_log_photos
   WHERE user_id = _uid
     AND uploaded_at < _cutoff;
  GET DIAGNOSTICS _deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'deleted', _deleted,
    'paths', to_jsonb(_paths),
    'cutoff', _cutoff
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.purge_my_old_diet_photos(integer) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
