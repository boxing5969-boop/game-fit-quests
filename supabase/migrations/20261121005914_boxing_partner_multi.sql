-- 운동 짝꿍 → 「복싱파트너」 · 여러 명 맺기 (2026-11-21 대표님 「짝꿍은 한명만 하는것이 아니라 여러명 할수있게 하자 … 복싱파트너로 이름 변경하자」)
--
-- 한 사람당 살아 있는 파트너(boxing_cornerman_pairs status 'active')는 _boxing_partner_limit()(10)명까지.
-- 같은 두 사람은 한 쌍만(이미 파트너면 'cornerman already partners').
-- 일일 보너스는 그대로 사람마다 하루 한 번(멱등키가 사람 · 날짜) — 오늘 운동한 파트너 하나와 함께 받는다.
-- 표 · 다른 표 · 예약은 그대로 · 줄을 지우는 문장 없음 · 표 이름 · 함수 이름(cornerman)은 그대로(앱이 부르는 이름).
-- 함수마다 운영 DB 의 지금 정의 위에 고쳤다(2026-11-21 00:59 KST 읽음).

-- ── 안쪽 함수 3개 ─────────────────────────────────────────────
create or replace function public._boxing_partner_limit()
returns integer
language sql
immutable
as $$ select 10 $$;

create or replace function public._boxing_partner_count(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  select count(*)::int from public.boxing_cornerman_pairs
   where status = 'active' and (requester_user_id = p_user_id or receiver_user_id = p_user_id)
$$;

create or replace function public._boxing_are_partners(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.boxing_cornerman_pairs
     where status = 'active'
       and ((requester_user_id = p_a and receiver_user_id = p_b)
         or (requester_user_id = p_b and receiver_user_id = p_a))
  )
$$;

revoke all on function public._boxing_partner_limit() from public, anon, authenticated;
revoke all on function public._boxing_partner_count(uuid) from public, anon, authenticated;
revoke all on function public._boxing_are_partners(uuid, uuid) from public, anon, authenticated;
grant execute on function public._boxing_partner_limit() to service_role;
grant execute on function public._boxing_partner_count(uuid) to service_role;
grant execute on function public._boxing_are_partners(uuid, uuid) to service_role;

-- ── 요청 ──────────────────────────────────────────────────────
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
    RAISE EXCEPTION '코치님·운영진과는 복싱파트너를 맺을 수 없어요';
  END IF;
  IF NOT public._is_active_member(p_receiver_user_id) THEN
    RAISE EXCEPTION '아직 앱 승인 전인 회원이에요';
  END IF;

  PERFORM public.boxing_cornerman_expire_stale_pending();

  -- 같은 두 사람 요청이 동시에 와도 한 줄만 (2026-11-21 여러 명 맺기)
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'boxing_partner:' || least(v_uid, p_receiver_user_id)::text || ':' || greatest(v_uid, p_receiver_user_id)::text, 0));

  IF public._boxing_are_partners(v_uid, p_receiver_user_id) THEN
    RAISE EXCEPTION 'cornerman already partners';
  END IF;
  IF public._boxing_partner_count(v_uid) >= public._boxing_partner_limit() THEN
    RAISE EXCEPTION 'cornerman partner limit';
  END IF;
  IF public._boxing_partner_count(p_receiver_user_id) >= public._boxing_partner_limit() THEN
    RAISE EXCEPTION 'cornerman receiver partner limit';
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
    'message', '복싱파트너 요청을 보냈어요. 상대 회원이 수락하면 파트너가 돼요.'
  );
END;
$function$;

-- ── 수락 · 거절 ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.respond_cornerman_pair(p_pair_id uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_pair public.boxing_cornerman_pairs%ROWTYPE;
  v_msg text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF p_pair_id IS NULL THEN
    RAISE EXCEPTION 'pair_id required';
  END IF;
  IF p_action NOT IN ('accept', 'decline') THEN
    RAISE EXCEPTION 'invalid action';
  END IF;

  PERFORM public.boxing_cornerman_expire_stale_pending();

  SELECT * INTO v_pair FROM public.boxing_cornerman_pairs WHERE id = p_pair_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cornerman pair not found';
  END IF;

  -- receiver 만 응답 가능
  IF v_pair.receiver_user_id <> v_uid THEN
    RAISE EXCEPTION 'cornerman not your pair';
  END IF;

  IF p_action = 'accept' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(
      'boxing_partner:' || least(v_pair.requester_user_id, v_pair.receiver_user_id)::text || ':'
        || greatest(v_pair.requester_user_id, v_pair.receiver_user_id)::text, 0));
    SELECT * INTO v_pair FROM public.boxing_cornerman_pairs WHERE id = p_pair_id FOR UPDATE;
  END IF;

  IF v_pair.status <> 'pending' THEN
    RAISE EXCEPTION 'cornerman not pending';
  END IF;

  IF p_action = 'accept' THEN
    -- 여러 명 맺기 (2026-11-21) — 이미 파트너가 아니고 · 둘 다 10명 아래일 때만
    IF public._boxing_are_partners(v_pair.requester_user_id, v_pair.receiver_user_id) THEN
      RAISE EXCEPTION 'cornerman already partners';
    END IF;
    IF public._boxing_partner_count(v_pair.receiver_user_id) >= public._boxing_partner_limit() THEN
      RAISE EXCEPTION 'cornerman partner limit';
    END IF;
    IF public._boxing_partner_count(v_pair.requester_user_id) >= public._boxing_partner_limit() THEN
      RAISE EXCEPTION 'cornerman receiver partner limit';
    END IF;

    UPDATE public.boxing_cornerman_pairs
    SET status = 'active', accepted_at = now()
    WHERE id = p_pair_id;

    v_msg := '복싱파트너가 됐어요. 함께 오래 가는 복서가 되어 봐요.';
  ELSE
    UPDATE public.boxing_cornerman_pairs
    SET status = 'declined', ended_at = now()
    WHERE id = p_pair_id;

    v_msg := '요청을 거절했어요.';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'pair_id', p_pair_id,
    'status', CASE WHEN p_action = 'accept' THEN 'active' ELSE 'declined' END,
    'message', v_msg
  );
END;
$function$;

-- ── 내 상태 — partners 배열 더함 (예전 한 명 칸은 가장 최근 파트너로 그대로) ──
CREATE OR REPLACE FUNCTION public.get_my_cornerman_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_active_pair public.boxing_cornerman_pairs%ROWTYPE;
  v_pending_received jsonb := '[]'::jsonb;
  v_pending_sent jsonb := '[]'::jsonb;
  v_partners jsonb := '[]'::jsonb;
  v_partner_id uuid;
  v_partner_name text;
  v_partner_rank text;
  v_partner_level integer;
  v_kst_date date;
  v_my_completed boolean;
  v_any_partner_completed boolean := false;
  v_bonus_claimed boolean;
  v_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  PERFORM public.boxing_cornerman_expire_stale_pending();

  v_kst_date := (now() AT TIME ZONE 'Asia/Seoul')::date;

  -- pending received (남이 나에게 보낸 요청) — 이름은 닉네임 → 이름 (profiles 에 display_name 은 없다)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'pair_id', cp.id,
    'requester_user_id', cp.requester_user_id,
    'requester_name', COALESCE(NULLIF(btrim(p.nickname), ''), NULLIF(btrim(p.name), ''), '회원'),
    'requester_rank', COALESCE(mp.current_rank::text, 'white'),
    'requester_level', COALESCE(mp.current_level, 1),
    'requested_at', cp.requested_at
  )), '[]'::jsonb) INTO v_pending_received
  FROM public.boxing_cornerman_pairs cp
  LEFT JOIN public.profiles p ON p.user_id = cp.requester_user_id
  LEFT JOIN public.member_progress mp ON mp.user_id = cp.requester_user_id
  WHERE cp.status = 'pending'
    AND cp.receiver_user_id = v_uid;

  -- pending sent (내가 보낸 요청)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'pair_id', cp.id,
    'receiver_user_id', cp.receiver_user_id,
    'receiver_name', COALESCE(NULLIF(btrim(p.nickname), ''), NULLIF(btrim(p.name), ''), '회원'),
    'requested_at', cp.requested_at
  )), '[]'::jsonb) INTO v_pending_sent
  FROM public.boxing_cornerman_pairs cp
  LEFT JOIN public.profiles p ON p.user_id = cp.receiver_user_id
  WHERE cp.status = 'pending'
    AND cp.requester_user_id = v_uid;

  -- 오늘 보너스는 사람마다 하루 한 번 (claim_cornerman_daily_bonus 의 멱등키와 같은 열쇠)
  v_bonus_claimed := EXISTS (
    SELECT 1 FROM public.boxing_engagement_events
     WHERE user_id = v_uid
       AND idempotency_key = concat('cornerman_bonus:', v_kst_date::text, ':', v_uid::text)
  );

  -- 살아 있는 파트너 모두 (가장 최근에 맺은 순)
  SELECT COALESCE(jsonb_agg(x.j ORDER BY x.acc DESC NULLS LAST), '[]'::jsonb), count(*)::int
    INTO v_partners, v_count
    FROM (
      SELECT cp.accepted_at AS acc,
             jsonb_build_object(
               'pair_id', cp.id,
               'partner_user_id', q.pid,
               'partner_name', COALESCE(NULLIF(btrim(p.nickname), ''), NULLIF(btrim(p.name), ''), '회원'),
               'partner_rank', COALESCE(mp.current_rank::text, 'white'),
               'partner_level', COALESCE(mp.current_level, 1),
               'accepted_at', cp.accepted_at,
               'today_completed', public.boxing_cornerman_user_completed_today(q.pid)
             ) AS j
        FROM public.boxing_cornerman_pairs cp
        CROSS JOIN LATERAL (
          SELECT CASE WHEN cp.requester_user_id = v_uid THEN cp.receiver_user_id ELSE cp.requester_user_id END AS pid
        ) q
        LEFT JOIN public.profiles p ON p.user_id = q.pid
        LEFT JOIN public.member_progress mp ON mp.user_id = q.pid
       WHERE cp.status = 'active'
         AND (cp.requester_user_id = v_uid OR cp.receiver_user_id = v_uid)
    ) x;

  IF v_count = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'has_active', false,
      'partners', '[]'::jsonb,
      'partner_count', 0,
      'partner_limit', public._boxing_partner_limit(),
      'pending_received', v_pending_received,
      'pending_sent', v_pending_sent
    );
  END IF;

  -- 예전 화면용 한 명 칸 = 가장 최근 파트너
  SELECT * INTO v_active_pair
  FROM public.boxing_cornerman_pairs
  WHERE status = 'active'
    AND (requester_user_id = v_uid OR receiver_user_id = v_uid)
  ORDER BY accepted_at DESC NULLS LAST
  LIMIT 1;

  IF v_active_pair.requester_user_id = v_uid THEN
    v_partner_id := v_active_pair.receiver_user_id;
  ELSE
    v_partner_id := v_active_pair.requester_user_id;
  END IF;

  SELECT COALESCE(NULLIF(btrim(p.nickname), ''), NULLIF(btrim(p.name), ''), '회원'),
         COALESCE(mp.current_rank::text, 'white'),
         COALESCE(mp.current_level, 1)
  INTO v_partner_name, v_partner_rank, v_partner_level
  FROM public.profiles p
  LEFT JOIN public.member_progress mp ON mp.user_id = p.user_id
  WHERE p.user_id = v_partner_id;

  v_my_completed := public.boxing_cornerman_user_completed_today(v_uid);
  v_any_partner_completed := EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_partners) e WHERE (e->>'today_completed')::boolean
  );

  RETURN jsonb_build_object(
    'success', true,
    'has_active', true,
    'pair_id', v_active_pair.id,
    'partner_user_id', v_partner_id,
    'partner_name', v_partner_name,
    'partner_rank', v_partner_rank,
    'partner_level', v_partner_level,
    'accepted_at', v_active_pair.accepted_at,
    'partners', v_partners,
    'partner_count', v_count,
    'partner_limit', public._boxing_partner_limit(),
    'today', jsonb_build_object(
      'date', v_kst_date,
      'my_completed', v_my_completed,
      'partner_completed', v_any_partner_completed,
      'both_completed', v_my_completed AND v_any_partner_completed,
      'bonus_claimed', v_bonus_claimed
    ),
    'pending_received', v_pending_received,
    'pending_sent', v_pending_sent
  );
END;
$function$;

-- ── 일일 보너스 — 오늘 운동한 파트너 하나와 (사람마다 하루 한 번 그대로) ──
CREATE OR REPLACE FUNCTION public.claim_cornerman_daily_bonus()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_pair public.boxing_cornerman_pairs%ROWTYPE;
  v_partner_id uuid;
  v_kst_date date;
  v_my_completed boolean;
  v_xp integer := 50;
  v_gems integer := 100;
  v_respect integer := 10;
  v_idem text;
  v_sync_id uuid;
  v_ins_me int := 0;
  v_ins_partner int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  v_kst_date := (now() AT TIME ZONE 'Asia/Seoul')::date;

  -- 검증 1: 나도 오늘 진짜 활동
  v_my_completed := public.boxing_cornerman_user_completed_today(v_uid);
  IF NOT v_my_completed THEN
    RAISE EXCEPTION 'cornerman bonus not eligible';
  END IF;

  -- 검증 2: 오늘 진짜 활동한 파트너 하나 (가장 최근에 맺은 순 — 여러 명 맺기 2026-11-21)
  SELECT cp.* INTO v_pair
  FROM public.boxing_cornerman_pairs cp
  WHERE cp.status = 'active'
    AND (cp.requester_user_id = v_uid OR cp.receiver_user_id = v_uid)
    AND public.boxing_cornerman_user_completed_today(
          CASE WHEN cp.requester_user_id = v_uid THEN cp.receiver_user_id ELSE cp.requester_user_id END)
  ORDER BY cp.accepted_at DESC NULLS LAST
  LIMIT 1;

  IF NOT FOUND OR v_pair.id IS NULL THEN
    RAISE EXCEPTION 'cornerman bonus not eligible';
  END IF;

  IF v_pair.requester_user_id = v_uid THEN
    v_partner_id := v_pair.receiver_user_id;
  ELSE
    v_partner_id := v_pair.requester_user_id;
  END IF;

  -- 검증 3: 오늘 이미 받았는지 — 짝이 아니라 "사람+날짜" 기준.
  IF EXISTS (
    SELECT 1 FROM public.boxing_engagement_events
     WHERE user_id = v_uid
       AND idempotency_key = concat('cornerman_bonus:', v_kst_date::text, ':', v_uid::text)
  ) THEN
    RAISE EXCEPTION 'cornerman bonus already claimed';
  END IF;

  PERFORM public.ensure_boxing_engagement_profile(v_uid);
  PERFORM public.ensure_boxing_engagement_profile(v_partner_id);

  -- daily_syncs upsert (짝 단위 기록은 그대로 유지 — 화면·통계용)
  INSERT INTO public.boxing_cornerman_daily_syncs (
    pair_id, user_a_id, user_b_id, sync_date,
    user_a_completed, user_b_completed, bonus_claimed,
    quest_xp_granted, gems_granted, respect_granted
  ) VALUES (
    v_pair.id, v_pair.requester_user_id, v_pair.receiver_user_id, v_kst_date,
    true, true, true, v_xp, v_gems, v_respect
  )
  ON CONFLICT (pair_id, sync_date) DO UPDATE
    SET user_a_completed = true, user_b_completed = true, bonus_claimed = true,
        quest_xp_granted = EXCLUDED.quest_xp_granted,
        gems_granted = EXCLUDED.gems_granted,
        respect_granted = EXCLUDED.respect_granted
  RETURNING id INTO v_sync_id;

  -- 본인 — 멱등키에서 pair_id 제거
  v_idem := concat('cornerman_bonus:', v_kst_date::text, ':', v_uid::text);
  INSERT INTO public.boxing_engagement_events (
    user_id, event_type, source_type, source_id, action,
    quest_xp_delta, gems_delta, respect_delta, idempotency_key, metadata
  ) VALUES (
    v_uid, 'reward', 'boxing_cornerman', v_pair.id, 'cornerman_bonus_claimed',
    v_xp, v_gems, v_respect, v_idem,
    jsonb_build_object('pair_id', v_pair.id, 'partner_id', v_partner_id)
  )
  ON CONFLICT (user_id, idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_ins_me = ROW_COUNT;

  -- 파트너 (그 파트너가 오늘 이미 받았으면 다시 안 줌 — 멱등키)
  v_idem := concat('cornerman_bonus:', v_kst_date::text, ':', v_partner_id::text);
  INSERT INTO public.boxing_engagement_events (
    user_id, event_type, source_type, source_id, action,
    quest_xp_delta, gems_delta, respect_delta, idempotency_key, metadata
  ) VALUES (
    v_partner_id, 'reward', 'boxing_cornerman', v_pair.id, 'cornerman_bonus_claimed',
    v_xp, v_gems, v_respect, v_idem,
    jsonb_build_object('pair_id', v_pair.id, 'partner_id', v_uid)
  )
  ON CONFLICT (user_id, idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_ins_partner = ROW_COUNT;

  IF v_ins_me > 0 THEN
    UPDATE public.boxing_engagement_profiles
       SET quest_xp = quest_xp + v_xp, respect_points = respect_points + v_respect
     WHERE user_id = v_uid;
    IF v_gems > 0 THEN PERFORM public.grant_gems(v_uid, v_gems, '복싱파트너 일일 보너스'); END IF;
  END IF;

  IF v_ins_partner > 0 THEN
    UPDATE public.boxing_engagement_profiles
       SET quest_xp = quest_xp + v_xp, respect_points = respect_points + v_respect
     WHERE user_id = v_partner_id;
    IF v_gems > 0 THEN PERFORM public.grant_gems(v_partner_id, v_gems, '복싱파트너 일일 보너스'); END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'pair_id', v_pair.id,
    'sync_id', v_sync_id,
    'quest_xp_granted', CASE WHEN v_ins_me > 0 THEN v_xp ELSE 0 END,
    'gems_granted',     CASE WHEN v_ins_me > 0 THEN v_gems ELSE 0 END,
    'respect_granted',  CASE WHEN v_ins_me > 0 THEN v_respect ELSE 0 END,
    'partner_granted',  (v_ins_partner > 0),
    'message', '복싱파트너 보너스를 받았어요. 오늘 함께 운동했어요.'
  );
END;
$function$;

-- ── 후보 목록 · 찾기 — 「다른 파트너가 있음」 대신 「이미 내 파트너 · 10명 가득」 ──
CREATE OR REPLACE FUNCTION public.get_cornerman_candidates(p_limit integer DEFAULT 30)
 RETURNS TABLE(user_id uuid, display_name text, branch_name text, current_rank text, current_level integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_my_branch text;
  v_all boolean;
  v_limit integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  if not public._is_active_member(auth.uid()) then raise exception '승인된 회원만 쓸 수 있어요' using errcode = '42501'; end if;

  PERFORM public.boxing_cornerman_expire_stale_pending();

  -- 본사(전체관리자·관리자)는 전 지점 회원을 둘러본다. 요청은 request_cornerman_pair 가 같은 지점끼리만 받는다 (2026-09-30)
  v_all := public.has_role(v_uid, 'super_admin') OR public.has_role(v_uid, 'admin');
  v_my_branch := public.boxing_cornerman_user_branch(v_uid);
  IF NOT v_all AND (v_my_branch IS NULL OR length(trim(v_my_branch)) = 0) THEN
    RAISE EXCEPTION 'cornerman branch unknown';
  END IF;

  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 30), 100));

  RETURN QUERY
  SELECT
    p.user_id AS user_id,
    COALESCE(NULLIF(btrim(p.nickname), ''), NULLIF(btrim(p.name), ''), '회원')::text AS display_name,
    p.branch_name::text AS branch_name,
    COALESCE(mp.current_rank::text, 'white') AS current_rank,
    COALESCE(mp.current_level, 1) AS current_level
  FROM public.profiles p
  LEFT JOIN public.member_progress mp ON mp.user_id = p.user_id
  LEFT JOIN LATERAL (
    SELECT max(a.checked_in_at) AS last_at FROM public.attendance_logs a WHERE a.user_id = p.user_id
  ) la ON true
  WHERE p.user_id <> v_uid
    AND ((v_all AND public.is_branch_visible(p.branch_name)) OR p.branch_name = v_my_branch)
    AND COALESCE(p.is_staff, false) = false AND NOT COALESCE(p.is_test_account, false)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p.user_id
        AND ur.role::text <> 'member'
    )
    -- 여러 명 맺기 (2026-11-21): 이미 내 파트너 · 파트너가 가득(10명)인 회원만 뺀다
    AND NOT public._boxing_are_partners(v_uid, p.user_id)
    AND public._boxing_partner_count(p.user_id) < public._boxing_partner_limit()
    AND NOT EXISTS (
      SELECT 1 FROM public.boxing_cornerman_pairs cp
      WHERE cp.status = 'pending'
        AND ((cp.requester_user_id = v_uid AND cp.receiver_user_id = p.user_id)
          OR (cp.receiver_user_id = v_uid AND cp.requester_user_id = p.user_id))
    )
  ORDER BY la.last_at DESC NULLS LAST, p.created_at DESC
  LIMIT v_limit;
END;
$function$;

CREATE OR REPLACE FUNCTION public.search_cornerman_candidates(p_query text, p_limit integer DEFAULT 20)
 RETURNS TABLE(user_id uuid, display_name text, branch_name text, current_rank text, current_level integer, state text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_my_branch text;
  v_all boolean;
  v_q text := left(btrim(coalesce(p_query, '')), 30);
  v_pat text;
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
begin
  if v_uid is null then raise exception 'auth required'; end if;
  if not public._is_active_member(auth.uid()) then raise exception '승인된 회원만 쓸 수 있어요' using errcode = '42501'; end if;
  if char_length(v_q) < 1 then return; end if;

  v_all := public.has_role(v_uid, 'super_admin') or public.has_role(v_uid, 'admin');
  v_my_branch := public.boxing_cornerman_user_branch(v_uid);
  if not v_all and (v_my_branch is null or length(trim(v_my_branch)) = 0) then
    raise exception 'cornerman branch unknown';
  end if;

  -- % _ \ 는 글자 그대로 찾는다
  v_pat := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  select s.user_id, s.display_name, s.branch_name, s.current_rank, s.current_level, s.state
    from (
      select p.user_id,
             coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '회원')::text as display_name,
             p.branch_name::text as branch_name,
             coalesce(mp.current_rank::text, 'white') as current_rank,
             coalesce(mp.current_level, 1) as current_level,
             (case
                when public._boxing_are_partners(v_uid, p.user_id) then 'paired'
                when exists (select 1 from public.boxing_cornerman_pairs cp
                              where cp.status = 'pending'
                                and ((cp.requester_user_id = v_uid and cp.receiver_user_id = p.user_id)
                                  or (cp.receiver_user_id = v_uid and cp.requester_user_id = p.user_id))) then 'pending'
                when public._boxing_partner_count(p.user_id) >= public._boxing_partner_limit() then 'full'
                else 'available'
              end)::text as state,
             (select max(a.checked_in_at) from public.attendance_logs a where a.user_id = p.user_id) as last_at,
             p.created_at
        from public.profiles p
        left join public.member_progress mp on mp.user_id = p.user_id
       where p.user_id <> v_uid
         and ((v_all and public.is_branch_visible(p.branch_name)) or p.branch_name = v_my_branch)
         and coalesce(p.is_staff, false) = false
         and not coalesce(p.is_test_account, false)
         and not exists (select 1 from public.user_roles ur
                          where ur.user_id = p.user_id and ur.role::text <> 'member')
         and coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '회원') ilike v_pat
    ) s
   order by (s.state = 'available') desc, s.last_at desc nulls last, s.created_at desc
   limit v_limit;
end $function$;

CREATE OR REPLACE FUNCTION public.get_cornerman_people(p_limit integer DEFAULT 30)
 RETURNS TABLE(user_id uuid, display_name text, branch_name text, current_rank text, current_level integer, state text, joined boolean, invited_by_me boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_my_branch text;
  v_all boolean;
  v_limit int := greatest(1, least(coalesce(p_limit, 30), 60));
begin
  if v_uid is null then raise exception 'auth required'; end if;
  if not public._is_active_member(auth.uid()) then raise exception '승인된 회원만 쓸 수 있어요' using errcode = '42501'; end if;
  perform public.boxing_cornerman_expire_stale_pending();
  v_all := public.has_role(v_uid, 'super_admin') or public.has_role(v_uid, 'admin');
  v_my_branch := public.boxing_cornerman_user_branch(v_uid);
  if not v_all and (v_my_branch is null or length(trim(v_my_branch)) = 0) then
    raise exception 'cornerman branch unknown';
  end if;

  return query
  with base as (
    select p.user_id as uid,
           coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '회원')::text as dn,
           p.branch_name::text as br,
           coalesce(mp.current_rank::text, 'white') as rk,
           coalesce(mp.current_level, 1) as lv,
           (u.last_sign_in_at is not null) as jn,
           (select max(a.checked_in_at) from public.attendance_logs a where a.user_id = p.user_id) as last_at,
           p.created_at as ca
      from public.profiles p
      left join public.member_progress mp on mp.user_id = p.user_id
      left join auth.users u on u.id = p.user_id
     where p.user_id <> v_uid
       and ((v_all and public.is_branch_visible(p.branch_name)) or p.branch_name = v_my_branch)
       and coalesce(p.is_staff, false) = false
       and not coalesce(p.is_test_account, false)
       and not exists (select 1 from public.user_roles ur where ur.user_id = p.user_id and ur.role::text <> 'member')
  ),
  joined_c as (
    select b.* from base b
     where b.jn
       -- 여러 명 맺기 (2026-11-21): 이미 내 파트너 · 파트너가 가득(10명)인 회원만 뺀다
       and not public._boxing_are_partners(v_uid, b.uid)
       and public._boxing_partner_count(b.uid) < public._boxing_partner_limit()
       and not exists (select 1 from public.boxing_cornerman_pairs cp
                        where cp.status = 'pending'
                          and ((cp.requester_user_id = v_uid and cp.receiver_user_id = b.uid)
                            or (cp.receiver_user_id = v_uid and cp.requester_user_id = b.uid)))
     order by b.last_at desc nulls last, b.ca desc
     limit v_limit
  ),
  unjoined_c as (
    select b.* from base b
     where not b.jn
     order by b.last_at desc nulls last, b.ca desc
     limit v_limit
  )
  select x.uid, x.dn, x.br, x.rk, x.lv, 'available'::text, x.jn,
         exists (select 1 from public.member_invites i where i.inviter_user_id = v_uid and i.invitee_user_id = x.uid)
    from (select * from joined_c union all select * from unjoined_c) x
   order by x.jn desc, x.last_at desc nulls last, x.ca desc;
end $function$;

CREATE OR REPLACE FUNCTION public.search_cornerman_people(p_query text, p_limit integer DEFAULT 20)
 RETURNS TABLE(user_id uuid, display_name text, branch_name text, current_rank text, current_level integer, state text, joined boolean, invited_by_me boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_my_branch text;
  v_all boolean;
  v_q text := left(btrim(coalesce(p_query, '')), 30);
  v_pat text;
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
begin
  if v_uid is null then raise exception 'auth required'; end if;
  if not public._is_active_member(auth.uid()) then raise exception '승인된 회원만 쓸 수 있어요' using errcode = '42501'; end if;
  if char_length(v_q) < 1 then return; end if;
  v_all := public.has_role(v_uid, 'super_admin') or public.has_role(v_uid, 'admin');
  v_my_branch := public.boxing_cornerman_user_branch(v_uid);
  if not v_all and (v_my_branch is null or length(trim(v_my_branch)) = 0) then
    raise exception 'cornerman branch unknown';
  end if;
  v_pat := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  select s.uid, s.dn, s.br, s.rk, s.lv, s.st, s.jn,
         exists (select 1 from public.member_invites i where i.inviter_user_id = v_uid and i.invitee_user_id = s.uid)
    from (
      select p.user_id as uid,
             coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '회원')::text as dn,
             p.branch_name::text as br,
             coalesce(mp.current_rank::text, 'white') as rk,
             coalesce(mp.current_level, 1) as lv,
             (u.last_sign_in_at is not null) as jn,
             (case
                when u.last_sign_in_at is null then 'available'
                when public._boxing_are_partners(v_uid, p.user_id) then 'paired'
                when exists (select 1 from public.boxing_cornerman_pairs cp
                              where cp.status = 'pending'
                                and ((cp.requester_user_id = v_uid and cp.receiver_user_id = p.user_id)
                                  or (cp.receiver_user_id = v_uid and cp.requester_user_id = p.user_id))) then 'pending'
                when public._boxing_partner_count(p.user_id) >= public._boxing_partner_limit() then 'full'
                else 'available'
              end)::text as st,
             (select max(a.checked_in_at) from public.attendance_logs a where a.user_id = p.user_id) as last_at,
             p.created_at as ca
        from public.profiles p
        left join public.member_progress mp on mp.user_id = p.user_id
        left join auth.users u on u.id = p.user_id
       where p.user_id <> v_uid
         and ((v_all and public.is_branch_visible(p.branch_name)) or p.branch_name = v_my_branch)
         and coalesce(p.is_staff, false) = false
         and not coalesce(p.is_test_account, false)
         and not exists (select 1 from public.user_roles ur where ur.user_id = p.user_id and ur.role::text <> 'member')
         and coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '회원') ilike v_pat
    ) s
   order by (s.jn and s.st = 'available') desc, s.jn desc, s.last_at desc nulls last, s.ca desc
   limit v_limit;
end $function$;

-- ── 운동 달력 「파트너와 같이 운동한 날」 — 파트너 누구와든 (약속 요일 줄은 가장 최근 파트너 그대로) ──
CREATE OR REPLACE FUNCTION public._cal_partner_json(_uid uuid, _from date, _to date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with pp as (
    select public._cal_partner_of(_uid) as pid
  ), allp as (
    select case when cp.requester_user_id = _uid then cp.receiver_user_id else cp.requester_user_id end as pid
      from public.boxing_cornerman_pairs cp
     where cp.status = 'active' and (cp.requester_user_id = _uid or cp.receiver_user_id = _uid)
  ), b as (
    select (_from::timestamp at time zone 'Asia/Seoul') as f, ((_to + 1)::timestamp at time zone 'Asia/Seoul') as t
  )
  select jsonb_build_object(
           'name', coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '파트너'),
           'count', (select count(*) from allp),
           'days', coalesce((select to_jsonb(mp.weekdays) from public.member_promises mp
                              where mp.user_id = pp.pid and mp.stopped_at is null), '[]'::jsonb),
           'slot', (select mp.time_slot from public.member_promises mp where mp.user_id = pp.pid and mp.stopped_at is null),
           'together', coalesce((
             select jsonb_agg(x.d order by x.d)
               from (
                 select (a.checked_in_at at time zone 'Asia/Seoul')::date as d
                   from public.attendance_logs a, b
                  where a.user_id = _uid and not coalesce(a.is_duplicate, false)
                    and a.checked_in_at >= b.f and a.checked_in_at < b.t
                 intersect
                 select (a2.checked_in_at at time zone 'Asia/Seoul')::date
                   from public.attendance_logs a2, b
                  where a2.user_id in (select allp.pid from allp) and not coalesce(a2.is_duplicate, false)
                    and a2.checked_in_at >= b.f and a2.checked_in_at < b.t
               ) x), '[]'::jsonb))
    from pp
    join public.profiles p on p.user_id = pp.pid
   where pp.pid is not null and public._is_active_member(pp.pid)
$function$;

-- ── 알림 · 안내 글만 바꾸는 함수 5개 (덧대기 — 본문은 운영 지금 정의 그대로, 글자만) ──
do $$
declare
  f text;
  def text;
begin
  foreach f in array array[
    'public.end_cornerman_pair(uuid)',
    'public.send_member_invite(uuid)',
    'public.claim_invite_reward_v2(text)',
    'public.admin_member_activity(uuid,integer)',
    'public.get_coach_quest_dashboard(text)'
  ] loop
    def := pg_get_functiondef(f::regprocedure);
    def := replace(def, '코너맨 관계를 종료했습니다.', '복싱파트너를 그만했어요.');
    def := replace(def, '운동 짝꿍이 됐어요', '복싱파트너가 됐어요');
    def := replace(def, '운동 짝꿍도', '복싱파트너도');
    def := replace(def, '짝꿍 요청을', '복싱파트너 요청을');
    def := replace(def, '짝꿍 신청', '복싱파트너 신청');
    def := replace(def, '짝꿍 (', '복싱파트너 (');
    def := replace(def, '응원 활동 — 코너맨 멘탈 칭찬', '응원 활동 — 복싱파트너 멘탈 칭찬');
    execute def;
  end loop;
end $$;
