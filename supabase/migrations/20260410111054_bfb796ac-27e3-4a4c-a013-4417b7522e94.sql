CREATE POLICY "Super admins view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins view all progress"
ON public.member_progress
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins view all mission submissions"
ON public.mission_submissions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins view all quest submissions"
ON public.quest_submissions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins view all coach requests"
ON public.coach_requests
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));