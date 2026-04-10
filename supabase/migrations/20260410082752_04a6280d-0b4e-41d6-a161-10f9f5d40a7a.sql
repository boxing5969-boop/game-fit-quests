CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, name, nickname, phone_number, branch_name, birth_date)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'nickname', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone_number', NULL),
    COALESCE(NEW.raw_user_meta_data->>'branch_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'birth_date', NULL)
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
  INSERT INTO public.member_progress (user_id) VALUES (NEW.id);
  INSERT INTO public.hidden_mastery (user_id) VALUES (NEW.id);
  INSERT INTO public.external_cert_progress (user_id) VALUES (NEW.id);

  IF COALESCE((NEW.raw_user_meta_data->>'is_coach_request')::boolean, false) THEN
    INSERT INTO public.coach_requests (user_id, status) VALUES (NEW.id, 'pending');
  END IF;

  RETURN NEW;
END;
$function$;