
DROP POLICY IF EXISTS "System creates notifications" ON public.notifications;
CREATE POLICY "Managers create notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'super_admin') OR
    has_role(auth.uid(), 'branch_manager') OR
    auth.uid() = user_id
  );
