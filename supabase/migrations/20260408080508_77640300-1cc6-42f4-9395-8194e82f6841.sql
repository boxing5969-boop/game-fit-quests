
CREATE OR REPLACE FUNCTION public.get_quest_xp(qt quest_type)
RETURNS int
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE qt
    WHEN 'main' THEN 20
    WHEN 'sub' THEN 10
    WHEN 'weekly' THEN 30
    WHEN 'boss' THEN 100
    ELSE 0
  END;
$$;
