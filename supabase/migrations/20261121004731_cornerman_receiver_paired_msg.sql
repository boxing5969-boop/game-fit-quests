-- 짝꿍 신청 — 상대 회원에게 이미 짝꿍이 있을 때 알림 말을 따로 (2026-11-21 대표님 「봄님이 다윤님에게 짝궁신청했는데 오류가」)
-- 예전에는 내 쪽 · 상대 쪽 모두 'cornerman pair already exists'(→ 「이미 운동 짝꿍이 있어요」)라
-- 짝꿍이 없는 회원이 짝꿍이 있는 회원에게 신청하면 「나에게 짝꿍이 있다」로 읽혔다.
-- 운영 DB 의 지금 정의(md5 56e6d4fd…) 위에 상대 쪽 검사 한 줄만 'cornerman receiver already paired' 로 바꿨다. 나머지는 그대로.
CREATE OR REPLACE FUNCTION public.request_cornerman_pair(p_receiver_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_my_branch text;
  v_their_branch text;
  v_pair_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF p_receiver_user_id IS NULL THEN
    RAISE EXCEPTION 'receiver required';
  END IF;
  IF p_receiver_user_id = v_uid THEN
    RAISE EXCEPTION 'cannot request self';
  END IF;

  IF NOT public._is_active_member(v_uid) THEN
    RAISE EXCEPTION '승인된 회원만 쓸 수 있어요' USING ERRCODE = '42501';
  END IF;
  -- 받는 사람: 앱에 들어온 적 있는 승인된 일반 회원만 (2026-10-19)
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_receiver_user_id AND u.last_sign_in_at IS NOT NULL) THEN
    RAISE EXCEPTION '아직 앱에 들어오지 않은 회원이에요 — 초대를 먼저 보내 주세요';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p
              WHERE p.user_id = p_receiver_user_id
                AND (coalesce(p.is_staff, false) OR coalesce(p.is_test_account, false)))
     OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p_receiver_user_id AND ur.role::text <> 'member') THEN
    RAISE EXCEPTION '코치님·운영진과는 짝꿍을 맺을 수 없어요';
  END IF;
  IF NOT public._is_active_member(p_receiver_user_id) THEN
    RAISE EXCEPTION '아직 앱 승인 전인 회원이에요';
  END IF;

  PERFORM public.boxing_cornerman_expire_stale_pending();

  -- 양면 검증 — 양쪽 user 모두 active pair 없어야 함
  IF public.boxing_cornerman_has_active_pair(v_uid) THEN
    RAISE EXCEPTION 'cornerman pair already exists';
  END IF;
  IF public.boxing_cornerman_has_active_pair(p_receiver_user_id) THEN
    RAISE EXCEPTION 'cornerman receiver already paired';
  END IF;

  -- 같은 지점 검증 (§11-⑪)
  v_my_branch := public.boxing_cornerman_user_branch(v_uid);
  v_their_branch := public.boxing_cornerman_user_branch(p_receiver_user_id);
  IF v_my_branch IS NULL OR v_their_branch IS NULL THEN
    RAISE EXCEPTION 'cornerman branch unknown';
  END IF;
  IF v_my_branch <> v_their_branch THEN
    RAISE EXCEPTION 'cornerman branch mismatch';
  END IF;

  -- 중복 pending 방지 (양방향)
  IF EXISTS (
    SELECT 1 FROM public.boxing_cornerman_pairs
    WHERE status = 'pending'
      AND ((requester_user_id = v_uid AND receiver_user_id = p_receiver_user_id)
        OR (requester_user_id = p_receiver_user_id AND receiver_user_id = v_uid))
  ) THEN
    RAISE EXCEPTION 'cornerman request already pending';
  END IF;

  PERFORM public.ensure_boxing_engagement_profile(v_uid);
  PERFORM public.ensure_boxing_engagement_profile(p_receiver_user_id);

  INSERT INTO public.boxing_cornerman_pairs (
    requester_user_id, receiver_user_id, status, branch_name
  ) VALUES (
    v_uid, p_receiver_user_id, 'pending', v_my_branch
  )
  RETURNING id INTO v_pair_id;

  RETURN jsonb_build_object(
    'success', true,
    'pair_id', v_pair_id,
    'status', 'pending',
    'message', '코너맨 요청을 보냈습니다. 상대 회원의 응답을 기다리고 있습니다.'
  );
END;
$function$;
