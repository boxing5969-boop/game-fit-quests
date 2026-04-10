
-- Add is_approved column to profiles (existing members auto-approved)
ALTER TABLE public.profiles ADD COLUMN is_approved boolean NOT NULL DEFAULT false;

-- Approve all existing members
UPDATE public.profiles SET is_approved = true;

-- Function to approve a member
CREATE OR REPLACE FUNCTION public.approve_member(_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller_id uuid := auth.uid();
BEGIN
  IF NOT (has_role(_caller_id, 'super_admin') OR is_branch_manager_of(_caller_id, _member_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE profiles SET is_approved = true WHERE user_id = _member_id;

  PERFORM create_notification(_member_id, '가입이 승인되었습니다! 🎉', '이제 153랭크업을 사용할 수 있습니다.');
END;
$$;

-- Function to reject/delete a member
CREATE OR REPLACE FUNCTION public.reject_member(_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller_id uuid := auth.uid();
BEGIN
  IF NOT (has_role(_caller_id, 'super_admin') OR is_branch_manager_of(_caller_id, _member_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE profiles SET is_approved = false WHERE user_id = _member_id;
END;
$$;
