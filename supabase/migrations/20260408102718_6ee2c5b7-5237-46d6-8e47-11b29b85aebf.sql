
CREATE TABLE public.branches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated view branches" ON public.branches
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage branches" ON public.branches
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
