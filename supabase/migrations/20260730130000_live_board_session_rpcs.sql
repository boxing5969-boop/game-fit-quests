-- ============================================================
-- 라이브보드 세션 제어 RPC 3종 (2026-07-30 운영 적용 완료)
-- 배경: activity_sessions 의 UPDATE RLS 는 본인·super_admin 만 허용 —
--   공개 TV(anon)의 60분 자동종료와 admin/branch_manager 의 퇴장·초기화가
--   전부 0행 무음 실패(error 는 null)하고 있었다. SECURITY DEFINER 로 이관.
-- ============================================================

CREATE OR REPLACE FUNCTION public.end_stale_sessions(_branch_name text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_count integer;
BEGIN
  UPDATE activity_sessions
  SET status = 'auto_ended', ended_at = now()
  WHERE branch_name = _branch_name
    AND status = 'active'
    AND ended_at IS NULL
    AND started_at < now() - interval '60 minutes';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;
REVOKE ALL ON FUNCTION public.end_stale_sessions(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.end_stale_sessions(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.force_end_session(_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_user uuid; v_count integer;
BEGIN
  SELECT user_id INTO v_user FROM activity_sessions WHERE id = _session_id;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND');
  END IF;
  IF NOT (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'branch_manager'::app_role) AND is_same_branch(v_user))
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  -- 'force_ended' 는 activity_sessions_status_check 제약 밖 — 'auto_ended' 로 종료
  -- (허용값: active/completed/auto_ended. 레벨업 분 집계와도 정합)
  UPDATE activity_sessions
  SET status = 'auto_ended', ended_at = now()
  WHERE id = _session_id AND status = 'active';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', v_count > 0, 'ended', v_count);
END; $$;
REVOKE ALL ON FUNCTION public.force_end_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.force_end_session(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reset_active_sessions(_branch_name text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_count integer;
BEGIN
  IF NOT (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'branch_manager'::app_role)
        AND EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND branch_name = _branch_name))
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE activity_sessions
  SET status = 'auto_ended', ended_at = now()
  WHERE branch_name = _branch_name AND status = 'active';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;
REVOKE ALL ON FUNCTION public.reset_active_sessions(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_active_sessions(text) TO authenticated;
