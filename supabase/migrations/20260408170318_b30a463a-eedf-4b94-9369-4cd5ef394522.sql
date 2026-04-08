
-- Coach requests table
CREATE TABLE public.coach_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID
);

ALTER TABLE public.coach_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all coach requests"
  ON public.coach_requests FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users view own coach request"
  ON public.coach_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Update handle_new_user to also insert coach request if is_coach_request
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, nickname, phone_number, branch_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'nickname', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone_number', NULL),
    COALESCE(NEW.raw_user_meta_data->>'branch_name', '')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
  INSERT INTO public.member_progress (user_id) VALUES (NEW.id);
  INSERT INTO public.hidden_mastery (user_id) VALUES (NEW.id);
  INSERT INTO public.external_cert_progress (user_id) VALUES (NEW.id);

  -- If coach request, add to coach_requests
  IF COALESCE((NEW.raw_user_meta_data->>'is_coach_request')::boolean, false) THEN
    INSERT INTO public.coach_requests (user_id, status) VALUES (NEW.id, 'pending');
  END IF;

  RETURN NEW;
END;
$$;

-- Function to approve coach request (sets role to coach)
CREATE OR REPLACE FUNCTION public.approve_coach_request(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller_id uuid := auth.uid();
  _req record;
BEGIN
  IF NOT has_role(_caller_id, 'admin') THEN
    RAISE EXCEPTION 'Not authorized - admin only';
  END IF;

  SELECT * INTO _req FROM coach_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF _req.status != 'pending' THEN RAISE EXCEPTION 'Request already processed'; END IF;

  -- Update role to coach
  UPDATE user_roles SET role = 'coach' WHERE user_id = _req.user_id;

  -- Update request status
  UPDATE coach_requests SET status = 'approved', reviewed_at = now(), reviewed_by = _caller_id
  WHERE id = _request_id;
END;
$$;

-- Function to reject coach request
CREATE OR REPLACE FUNCTION public.reject_coach_request(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller_id uuid := auth.uid();
BEGIN
  IF NOT has_role(_caller_id, 'admin') THEN
    RAISE EXCEPTION 'Not authorized - admin only';
  END IF;

  UPDATE coach_requests SET status = 'rejected', reviewed_at = now(), reviewed_by = _caller_id
  WHERE id = _request_id AND status = 'pending';
END;
$$;
