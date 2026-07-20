-- ============================================================
-- record_class_participation — 관장·코치 수업 참여 보상 (+20XP)
-- (2026-07-20 운영DB 적용됨) 하루 1회(KST), xp_logs 원장 기록.
-- 세션 완료 화면에서 회원이 직접 신고 → 서버가 중복 방지.
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_class_participation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_xp integer := 20;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF EXISTS (
    SELECT 1 FROM xp_logs
    WHERE user_id = v_uid AND reason = '코치 수업 참여'
      AND (created_at AT TIME ZONE 'Asia/Seoul')::date = (now() AT TIME ZONE 'Asia/Seoul')::date
  ) THEN
    RETURN jsonb_build_object('success', false, 'already', true);
  END IF;

  INSERT INTO xp_logs (user_id, amount, reason) VALUES (v_uid, v_xp, '코치 수업 참여');
  UPDATE member_progress SET total_xp = total_xp + v_xp WHERE user_id = v_uid;
  INSERT INTO notifications (user_id, title, body)
  VALUES (v_uid, '코치 수업 참여 +20XP 🧑‍🏫', '오늘도 수업에서 함께 성장했어요!');

  RETURN jsonb_build_object('success', true, 'xp_granted', v_xp);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_class_participation() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_class_participation() FROM anon;
GRANT EXECUTE ON FUNCTION public.record_class_participation() TO authenticated, service_role;
