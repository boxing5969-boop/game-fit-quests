-- 운동 짝꿍 요청 — 보내는 사람·받는 사람 확인 (2026-10-19 검수)
--   예전: 앱에 한 번도 안 들어온 회원(자동 생성 계정) · 코치님·운영진 · 체험용 계정에게도 요청이 쌓였다
--         (회원 카드에서 짝꿍 신청을 누르면 받는 사람이 영영 못 보는 요청이 된다). 승인 전 계정도 보낼 수 있었다.
--   이제: 보내는 사람은 승인된 회원(또는 운영진), 받는 사람은 앱에 들어온 적 있는 승인된 일반 회원만.
do $$
declare
  v_def text;
  v_anchor text := $a$  IF p_receiver_user_id = v_uid THEN
    RAISE EXCEPTION 'cannot request self';
  END IF;
$a$;
  v_add text := $b$
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
$b$;
begin
  v_def := pg_get_functiondef('public.request_cornerman_pair(uuid)'::regprocedure);
  if (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor) <> 1 then
    raise exception 'request_cornerman_pair — 넣을 자리를 정확히 한 곳 찾지 못함';
  end if;
  if v_def like '%아직 앱에 들어오지 않은 회원이에요%' then
    return; -- 이미 반영됨
  end if;
  execute replace(v_def, v_anchor, v_anchor || v_add);
end $$;
