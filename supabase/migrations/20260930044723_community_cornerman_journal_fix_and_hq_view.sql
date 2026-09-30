-- 2026-09-30 대표님: "커뮤니티에 아직도 안 보여" (본사 계정).
--
-- 확인 결과 (로그·실행 검증):
--   · get_my_cornerman_status — profiles 에 없는 display_name 컬럼을 읽어 모든 회원에게 매번 오류(400).
--     그래서 코너맨 '받은 요청'이 아무에게도 안 보였다 (수락을 못 해 짝이 맺어지지 않음). profiles.id(내부 PK)로 잇던 것도 user_id 로 고친다.
--   · get_partner_journal_feed — 결과 컬럼 relation 과 CTE 컬럼 이름이 겹쳐 모든 회원에게 오류(400). 파트너 일기가 안 보였다.
--   · get_cornerman_candidates — 본사 계정은 지점이 '153본사'라 후보가 0명. 본사는 전 지점 회원을 둘러보게 한다
--     (요청은 request_cornerman_pair 가 지금처럼 같은 지점끼리만 받는다). 이름이 비던 회원(닉네임 없음)은 이름으로, 최근 출석한 회원 먼저.

-- ── 1. 코너맨 내 상태 ─────────────────────────────────────────────
create or replace function public.get_my_cornerman_status()
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
DECLARE
  v_uid uuid := auth.uid();
  v_active_pair public.boxing_cornerman_pairs%ROWTYPE;
  v_pending_received jsonb := '[]'::jsonb;
  v_pending_sent jsonb := '[]'::jsonb;
  v_partner_id uuid;
  v_partner_name text;
  v_partner_rank text;
  v_partner_level integer;
  v_kst_date date;
  v_my_completed boolean;
  v_partner_completed boolean;
  v_today_sync public.boxing_cornerman_daily_syncs%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  PERFORM public.boxing_cornerman_expire_stale_pending();

  -- active pair
  SELECT * INTO v_active_pair
  FROM public.boxing_cornerman_pairs
  WHERE status = 'active'
    AND (requester_user_id = v_uid OR receiver_user_id = v_uid)
  ORDER BY accepted_at DESC NULLS LAST
  LIMIT 1;

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

  -- active 가 없으면 여기서 반환
  IF v_active_pair.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'has_active', false,
      'pending_received', v_pending_received,
      'pending_sent', v_pending_sent
    );
  END IF;

  -- 파트너 정보
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

  -- 오늘 활동 상태
  v_kst_date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_my_completed := public.boxing_cornerman_user_completed_today(v_uid);
  v_partner_completed := public.boxing_cornerman_user_completed_today(v_partner_id);

  -- 오늘 sync row (있으면)
  SELECT * INTO v_today_sync
  FROM public.boxing_cornerman_daily_syncs
  WHERE pair_id = v_active_pair.id
    AND sync_date = v_kst_date;

  RETURN jsonb_build_object(
    'success', true,
    'has_active', true,
    'pair_id', v_active_pair.id,
    'partner_user_id', v_partner_id,
    'partner_name', v_partner_name,
    'partner_rank', v_partner_rank,
    'partner_level', v_partner_level,
    'accepted_at', v_active_pair.accepted_at,
    'today', jsonb_build_object(
      'date', v_kst_date,
      'my_completed', v_my_completed,
      'partner_completed', v_partner_completed,
      'both_completed', v_my_completed AND v_partner_completed,
      'bonus_claimed', COALESCE(v_today_sync.bonus_claimed, false)
    ),
    'pending_received', v_pending_received,
    'pending_sent', v_pending_sent
  );
END;
$$;

-- ── 2. 파트너 챔피언 일기 피드 ────────────────────────────────────────
create or replace function public.get_partner_journal_feed(p_limit integer default 10)
returns table(id uuid, user_id uuid, display_name text, prompt text, content text, mood text,
              created_at timestamptz, comment_count integer, relation text)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
DECLARE
  v_viewer uuid := auth.uid();
BEGIN
  IF v_viewer IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  -- 결과 컬럼(relation 등)과 이름이 겹치지 않게 CTE 컬럼은 rel 로 쓴다 (2026-09-30 — 겹쳐서 매번 오류였다)
  RETURN QUERY
  WITH cornerman_partners AS (
    SELECT
      CASE WHEN cp.requester_user_id = v_viewer THEN cp.receiver_user_id
           ELSE cp.requester_user_id END AS partner_id,
      'cornerman'::text AS rel
    FROM public.boxing_cornerman_pairs cp
    WHERE cp.status = 'active'
      AND (cp.requester_user_id = v_viewer OR cp.receiver_user_id = v_viewer)
  ),
  cheer_partners AS (
    -- 양방향 cheer 인 사용자만 — A→B AND B→A
    SELECT DISTINCT c1.receiver_user_id AS partner_id, 'second'::text AS rel
    FROM public.boxing_cheers c1
    WHERE c1.sender_user_id = v_viewer
      AND c1.created_at >= (now() - interval '30 days')
      AND EXISTS (
        SELECT 1 FROM public.boxing_cheers c2
        WHERE c2.sender_user_id = c1.receiver_user_id
          AND c2.receiver_user_id = v_viewer
          AND c2.created_at >= (now() - interval '30 days')
      )
  ),
  all_partners AS (
    -- cornerman 우선
    SELECT cm.partner_id, cm.rel FROM cornerman_partners cm
    UNION
    SELECT chp.partner_id, chp.rel
    FROM cheer_partners chp
    WHERE NOT EXISTS (SELECT 1 FROM cornerman_partners cm2 WHERE cm2.partner_id = chp.partner_id)
  )
  SELECT
    e.id,
    e.user_id,
    COALESCE(NULLIF(p.nickname, ''), NULLIF(p.name, ''), '익명 복서')::text,
    e.prompt::text,
    e.content::text,
    e.mood::text,
    e.created_at,
    (SELECT COUNT(*)::integer FROM public.champion_journal_comments jc WHERE jc.entry_id = e.id),
    ap.rel
  FROM public.champion_journal_entries e
  JOIN all_partners ap ON ap.partner_id = e.user_id
  LEFT JOIN public.profiles p ON p.user_id = e.user_id
  ORDER BY e.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 50));
END;
$$;

-- ── 3. 코너맨 후보 — 본사 전 지점 둘러보기 ───────────────────────────────
create or replace function public.get_cornerman_candidates(p_limit integer default 30)
returns table(user_id uuid, display_name text, branch_name text, current_rank text, current_level integer)
language plpgsql volatile security definer
set search_path = public
as $$
DECLARE
  v_uid uuid := auth.uid();
  v_my_branch text;
  v_all boolean;
  v_limit integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

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
    AND (v_all OR p.branch_name = v_my_branch)
    AND COALESCE(p.is_staff, false) = false AND NOT COALESCE(p.is_test_account, false)
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
  -- 최근 출석한 회원 먼저 (예전: 가입 최신순 — 일괄 등록 회원이 섞여 실제 다니는 회원이 묻혔다)
  ORDER BY la.last_at DESC NULLS LAST, p.created_at DESC
  LIMIT v_limit;
END;
$$;