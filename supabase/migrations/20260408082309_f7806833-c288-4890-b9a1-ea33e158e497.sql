
-- Create a SECURITY DEFINER function to get branch without recursion
CREATE OR REPLACE FUNCTION public.get_my_branch()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_name FROM profiles WHERE user_id = auth.uid()
$$;

-- Drop the recursive policies
DROP POLICY IF EXISTS "Same branch members view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Same branch members view progress" ON public.member_progress;

-- Recreate with the safe function
CREATE POLICY "Same branch members view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (branch_name = get_my_branch());

CREATE POLICY "Same branch members view progress"
ON public.member_progress
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT p.user_id FROM public.profiles p
    WHERE p.branch_name = get_my_branch()
  )
);
