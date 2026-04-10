CREATE OR REPLACE FUNCTION public.get_signup_providers(_user_ids uuid[])
RETURNS TABLE(user_id uuid, signup_provider text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH requested_ids AS (
    SELECT DISTINCT unnest(_user_ids) AS user_id
  )
  SELECT
    au.id AS user_id,
    CASE COALESCE(au.raw_app_meta_data->>'provider', 'email')
      WHEN 'google' THEN 'google'
      WHEN 'apple' THEN 'apple'
      WHEN 'microsoft' THEN 'microsoft'
      ELSE 'email'
    END AS signup_provider
  FROM requested_ids r
  JOIN auth.users au ON au.id = r.user_id
  WHERE public.has_role(auth.uid(), 'super_admin')
     OR public.has_role(auth.uid(), 'admin')
     OR public.is_same_branch(au.id);
$$;