-- 코너맨 후보 필터 교정 (2026-09-17)
--
-- 직전 복구에서 "권한 보유자 제외"를 NOT EXISTS(user_roles) 로 썼는데,
-- 이 앱은 일반 회원에게도 user_roles 에 role='member' 행을 하나씩 준다(3,337행).
-- 그래서 후보가 전원 제외돼 0명이 됐다(선릉 626명 → 0명, 실측).
--
-- 제외해야 하는 것은 'member' 가 아닌 권한(super_admin·admin·coach·branch_manager)이다.

create or replace function public.get_cornerman_candidates(p_limit integer DEFAULT 30)
returns TABLE(user_id uuid, display_name text, branch_name text, current_rank text, current_level integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_uid uuid := auth.uid();
  v_my_branch text;
  v_limit integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  PERFORM public.boxing_cornerman_expire_stale_pending();

  v_my_branch := public.boxing_cornerman_user_branch(v_uid);
  IF v_my_branch IS NULL OR length(trim(v_my_branch)) = 0 THEN
    RAISE EXCEPTION 'cornerman branch unknown';
  END IF;

  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 30), 100));

  RETURN QUERY
  SELECT
    p.user_id AS user_id,
    p.nickname AS display_name,
    p.branch_name,
    COALESCE(mp.current_rank::text, 'white') AS current_rank,
    COALESCE(mp.current_level, 1) AS current_level
  FROM public.profiles p
  LEFT JOIN public.member_progress mp ON mp.user_id = p.user_id
  WHERE p.user_id <> v_uid
    AND p.branch_name = v_my_branch
    AND COALESCE(p.is_staff, false) = false
    -- 코치·지점장·관장은 후보에서 뺀다. 일반 회원도 role='member' 행을 갖고 있으므로
    -- 'member' 이외의 권한만 걸러야 한다.
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p.user_id
        AND ur.role::text <> 'member'
    )
    AND NOT public.boxing_cornerman_has_active_pair(p.user_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.boxing_cornerman_pairs cp
      WHERE cp.status = 'pending'
        AND ((cp.requester_user_id = v_uid AND cp.receiver_user_id = p.user_id)
          OR (cp.receiver_user_id = v_uid AND cp.requester_user_id = p.user_id))
    )
  ORDER BY p.created_at DESC
  LIMIT v_limit;
END;
$function$;
