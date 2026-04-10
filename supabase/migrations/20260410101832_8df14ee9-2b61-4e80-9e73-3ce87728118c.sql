-- Allow authenticated users to insert their own coach request
CREATE POLICY "Users can create own coach request"
ON public.coach_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
