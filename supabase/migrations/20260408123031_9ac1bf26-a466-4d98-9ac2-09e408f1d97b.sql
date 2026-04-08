-- Allow anonymous users to view branches (for signup page)
CREATE POLICY "Anyone can view branches" ON public.branches
  FOR SELECT TO anon
  USING (true);
