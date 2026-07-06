-- ============================================================
-- cancel_checkin RPC — 관리자 보드 "체크인 취소" 시 보상 원자적 회수
-- (2026-07-06 운영DB 적용됨 · anon/PUBLIC EXECUTE 회수 포함)
--
-- 배경: 기존 프런트는 attendance_logs 행만 직접 DELETE — qr-checkin 이
-- 지급한 XP(+10)·스트릭(+1)·xp_logs 는 남아 있었음.
-- 이 RPC 는 삭제 + 회수를 한 트랜잭션으로 처리한다.
--   · 회수 대상: 첫 체크인(is_duplicate=false, xp_granted>0)만
--   · member_progress.total_xp -xp, streak_days -1 (0 미만 방지)
--   · xp_logs 에 마이너스 원장 기록(원본 삭제 대신 감사추적 유지)
--   · 회원에게 취소 알림
-- 권한: super_admin/admin 전지점, branch_manager 는 자기 지점 회원만
-- ============================================================

CREATE OR REPLACE FUNCTION public.cancel_checkin(_log_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_log attendance_logs%ROWTYPE;
  v_reverted_xp integer := 0;
  v_streak_reverted boolean := false;
BEGIN
  SELECT * INTO v_log FROM attendance_logs WHERE id = _log_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND');
  END IF;

  IF NOT (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'branch_manager'::app_role) AND is_same_branch(v_log.user_id))
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM attendance_logs WHERE id = _log_id;

  IF v_log.is_duplicate = false AND coalesce(v_log.xp_granted, 0) > 0 THEN
    v_reverted_xp := v_log.xp_granted;
    v_streak_reverted := true;

    UPDATE member_progress
    SET total_xp   = greatest(0, total_xp - v_reverted_xp),
        streak_days = greatest(0, streak_days - 1)
    WHERE user_id = v_log.user_id;

    INSERT INTO xp_logs (user_id, amount, reason)
    VALUES (v_log.user_id, -v_reverted_xp, '체크인 취소 회수');

    INSERT INTO notifications (user_id, title, body)
    VALUES (v_log.user_id, '체크인이 취소되었습니다', '관리자가 출석을 취소해 XP가 회수되었습니다. 문의는 지점으로 부탁드려요.');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'reverted_xp', v_reverted_xp,
    'streak_reverted', v_streak_reverted
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_checkin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_checkin(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_checkin(uuid) TO authenticated, service_role;
