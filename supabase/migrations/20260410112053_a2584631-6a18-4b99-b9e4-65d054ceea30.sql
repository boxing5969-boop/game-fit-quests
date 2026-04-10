CREATE OR REPLACE FUNCTION public.approve_coach_request(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller_id uuid := auth.uid();
  _req record;
  _badge record;
BEGIN
  IF NOT has_role(_caller_id, 'super_admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _req FROM coach_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF _req.status != 'pending' THEN RAISE EXCEPTION 'Already processed'; END IF;

  -- Upgrade role to branch_manager
  UPDATE user_roles SET role = 'branch_manager' WHERE user_id = _req.user_id;

  -- Approve coach request
  UPDATE coach_requests SET status = 'approved', reviewed_at = now(), reviewed_by = _caller_id
    WHERE id = _request_id;

  -- Approve profile
  UPDATE profiles SET is_approved = true WHERE user_id = _req.user_id;

  -- Set to max rank: black Lv.10
  UPDATE member_progress
  SET current_rank = 'black', current_level = 10, bosses_cleared = 4
  WHERE user_id = _req.user_id;

  -- Grant all badges
  FOR _badge IN SELECT id FROM badges LOOP
    INSERT INTO member_badges (user_id, badge_id)
    VALUES (_req.user_id, _badge.id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Notify
  PERFORM create_notification(_req.user_id,
    '관장님 가입이 승인되었습니다! 🏆',
    '블랙 레벨 10 + 전체 배지가 부여되었습니다.');
END;
$$;