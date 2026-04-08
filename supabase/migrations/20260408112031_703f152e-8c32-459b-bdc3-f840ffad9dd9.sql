
-- Add phone_number to profiles (unique to prevent duplicate signups)
ALTER TABLE public.profiles ADD COLUMN phone_number text UNIQUE;

-- Create phone_verifications table for OTP codes
CREATE TABLE public.phone_verifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number text NOT NULL,
  code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for lookups
CREATE INDEX idx_phone_verifications_phone ON public.phone_verifications(phone_number, verified);

-- RLS: allow anon/authenticated to insert (before signup)
ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;

-- No direct access - only via edge functions (security definer RPCs)
-- We'll use edge functions to manage this table

-- Update handle_new_user to store phone_number from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, nickname, phone_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'nickname', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone_number', NULL)
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
  INSERT INTO public.member_progress (user_id) VALUES (NEW.id);
  INSERT INTO public.hidden_mastery (user_id) VALUES (NEW.id);
  INSERT INTO public.external_cert_progress (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;
