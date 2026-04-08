
-- Update handle_new_user to store branch_name from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  RETURN NEW;
END;
$$;

-- Create privacy_consents table
CREATE TABLE public.privacy_consents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  signature_data text NOT NULL,
  consented_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.privacy_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own consent" ON public.privacy_consents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users create own consent" ON public.privacy_consents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all consents" ON public.privacy_consents
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
