
-- Branch transfer requests table
CREATE TABLE public.branch_transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  from_branch text NOT NULL,
  to_branch text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.branch_transfer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own transfer requests"
  ON public.branch_transfer_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own transfer requests"
  ON public.branch_transfer_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Branch managers view same branch transfers"
  ON public.branch_transfer_requests FOR SELECT TO authenticated
  USING (is_same_branch(user_id) OR from_branch = get_my_branch());

CREATE POLICY "Branch managers update same branch transfers"
  ON public.branch_transfer_requests FOR UPDATE TO authenticated
  USING (is_same_branch(user_id) OR from_branch = get_my_branch());

CREATE POLICY "Super admins manage all transfers"
  ON public.branch_transfer_requests FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

-- Add video fields to mission_submissions
ALTER TABLE public.mission_submissions
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS video_timestamp_comments jsonb DEFAULT '[]'::jsonb;

-- Request branch transfer function
CREATE OR REPLACE FUNCTION public.request_branch_transfer(_to_branch text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _from_branch text;
  _req_id uuid;
BEGIN
  SELECT branch_name INTO _from_branch FROM profiles WHERE user_id = _user_id;
  IF _from_branch IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF _from_branch = _to_branch THEN RAISE EXCEPTION 'Same branch'; END IF;

  -- Check no pending request exists
  IF EXISTS (SELECT 1 FROM branch_transfer_requests WHERE user_id = _user_id AND status = 'pending') THEN
    RAISE EXCEPTION '이미 대기 중인 이전 요청이 있습니다';
  END IF;

  INSERT INTO branch_transfer_requests (user_id, from_branch, to_branch)
  VALUES (_user_id, _from_branch, _to_branch)
  RETURNING id INTO _req_id;

  RETURN _req_id;
END;
$$;

-- Approve branch transfer
CREATE OR REPLACE FUNCTION public.approve_branch_transfer(_request_id uuid, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _caller_id uuid := auth.uid();
  _req record;
BEGIN
  SELECT * INTO _req FROM branch_transfer_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF _req.status != 'pending' THEN RAISE EXCEPTION 'Already processed'; END IF;

  IF NOT (has_role(_caller_id, 'super_admin') OR is_branch_manager_of(_caller_id, _req.user_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE branch_transfer_requests
  SET status = 'approved', reviewed_by = _caller_id, reviewed_at = now(), review_note = _note
  WHERE id = _request_id;

  -- Actually change the branch
  UPDATE profiles SET branch_name = _req.to_branch WHERE user_id = _req.user_id;

  PERFORM create_notification(_req.user_id,
    '지점 이전이 승인되었습니다: ' || _req.to_branch, COALESCE(_note, ''));
END;
$$;

-- Reject branch transfer
CREATE OR REPLACE FUNCTION public.reject_branch_transfer(_request_id uuid, _note text DEFAULT '이전 요청이 반려되었습니다')
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _caller_id uuid := auth.uid();
  _req record;
BEGIN
  SELECT * INTO _req FROM branch_transfer_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF _req.status != 'pending' THEN RAISE EXCEPTION 'Already processed'; END IF;

  IF NOT (has_role(_caller_id, 'super_admin') OR is_branch_manager_of(_caller_id, _req.user_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE branch_transfer_requests
  SET status = 'rejected', reviewed_by = _caller_id, reviewed_at = now(), review_note = _note
  WHERE id = _request_id;

  PERFORM create_notification(_req.user_id,
    '지점 이전 요청이 반려되었습니다', COALESCE(_note, ''));
END;
$$;
