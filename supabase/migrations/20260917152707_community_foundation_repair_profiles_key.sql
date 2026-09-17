-- 커뮤니티 기반 복구 — 코너맨·짐 레이드가 전 회원에게 죽어 있었다 (2026-09-17)
--
-- 원인 하나로 전부 설명된다: profiles 에서 auth.uid() 와 일치하는 컬럼은
-- user_id 인데, 코너맨·짐 레이드는 profiles.id 로 조인했다.
-- 실측: 3,339행 중 id = user_id 인 행은 0개다.
--
-- 그래서 이렇게 죽어 있었다 (전부 실측으로 확인):
--   · boxing_cornerman_user_branch() 가 항상 NULL
--     → get_cornerman_candidates 가 'cornerman branch unknown' 예외로 죽는다.
--   · get_active_gym_raids() 도 지점을 못 찾아 조용히 raids: [] 를 돌려준다.
--   · boxing_gym_raids SELECT 정책의 EXISTS 가 항상 false
--     → 일반 회원에게 짐 레이드가 한 건도 안 보인다(관장 계정만 보인다).
--
-- 덤으로 get_cornerman_candidates 는 존재하지 않는 컬럼 두 개를 참조한다:
--   p.role (profiles 에 role 컬럼이 없다 — 권한은 user_roles 테이블에 있다)
--   p.display_name (실제 컬럼은 nickname / name)
--
-- 결과: 7개월간 코너맨 0쌍, 짐 레이드 0건, 챔피언 일기 0건.
-- 기능이 인기가 없던 게 아니라 열리지 않았다.

-- ── ① 지점 조회 — 인증 키를 user_id 로 ────────────────────────────
create or replace function public.boxing_cornerman_user_branch(p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
DECLARE
  v_branch text;
BEGIN
  -- auth.uid() 는 profiles.user_id 와 일치한다. profiles.id 는 별개의 내부 PK 다.
  SELECT branch_name INTO v_branch
  FROM public.profiles
  WHERE user_id = p_user_id;
  RETURN v_branch;
END;
$function$;

-- ── ② 짐 레이드 조회 — 같은 버그 ──────────────────────────────────
create or replace function public.get_active_gym_raids()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_uid uuid := auth.uid();
  v_my_branch text;
  v_raids jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  PERFORM public.boxing_gym_raid_lazy_expire();

  -- user_id 로 조회 (예전엔 id 로 봐서 항상 NULL → 빈 목록을 돌려줬다)
  SELECT branch_name INTO v_my_branch
  FROM public.profiles WHERE user_id = v_uid;

  IF v_my_branch IS NULL THEN
    RETURN jsonb_build_object('success', true, 'raids', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'title', r.title,
    'description', r.description,
    'raid_type', r.raid_type,
    'target_value', r.target_value,
    'current_value', r.current_value,
    'percentage', LEAST(100,
      CASE WHEN r.target_value > 0
        THEN ROUND((r.current_value / r.target_value) * 100, 1)
        ELSE 0
      END
    ),
    'start_date', r.start_date,
    'end_date', r.end_date,
    'status', r.status,
    'reward_quest_xp', r.reward_quest_xp,
    'reward_gems', r.reward_gems,
    'reward_respect', r.reward_respect,
    'my_contribution', COALESCE(c.my_count, 0),
    'reward_claimed', cl.id IS NOT NULL
  ) ORDER BY r.end_date ASC), '[]'::jsonb)
  INTO v_raids
  FROM public.boxing_gym_raids r
  LEFT JOIN (
    SELECT raid_id, COUNT(*)::integer AS my_count
    FROM public.boxing_gym_raid_contributions
    WHERE user_id = v_uid
    GROUP BY raid_id
  ) c ON c.raid_id = r.id
  LEFT JOIN public.boxing_gym_raid_reward_claims cl
    ON cl.raid_id = r.id AND cl.user_id = v_uid
  WHERE r.branch_name = v_my_branch
    AND r.status IN ('active', 'completed');

  RETURN jsonb_build_object('success', true, 'branch', v_my_branch, 'raids', v_raids);
END;
$function$;

-- ── ③ 코너맨 후보 — 조인 키 + 없는 컬럼 두 개 ────────────────────
--    반환 컬럼 이름(display_name)은 프론트 계약이라 그대로 두고 nickname 을 담는다.
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
    -- 직원·권한 보유자는 후보에서 뺀다 (예전 코드의 p.role 자리 — 권한은 user_roles 에 있다)
    AND COALESCE(p.is_staff, false) = false
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id
    )
    AND NOT public.boxing_cornerman_has_active_pair(p.user_id)
    AND NOT EXISTS (
      -- 이미 본인이 보낸 pending 또는 받은 pending 이 있는 회원도 제외
      SELECT 1 FROM public.boxing_cornerman_pairs cp
      WHERE cp.status = 'pending'
        AND ((cp.requester_user_id = v_uid AND cp.receiver_user_id = p.user_id)
          OR (cp.receiver_user_id = v_uid AND cp.requester_user_id = p.user_id))
    )
  ORDER BY p.created_at DESC
  LIMIT v_limit;
END;
$function$;

-- ── ④ 짐 레이드 RLS — EXISTS 가 항상 false 였다 ──────────────────
drop policy if exists "boxing_gym_raids_select_branch_or_admin" on public.boxing_gym_raids;
create policy "boxing_gym_raids_select_branch_or_admin"
  on public.boxing_gym_raids for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.branch_name = boxing_gym_raids.branch_name
    )
    or public.has_role(auth.uid(), 'super_admin')
  );
