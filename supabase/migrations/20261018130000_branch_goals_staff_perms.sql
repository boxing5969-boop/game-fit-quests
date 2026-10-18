-- 우리 지점 목표 만들기 · 지점장·코치 권한 (2026-10-18 대표님:
--   "우리지점 목표도 내가 설정할수있게 해줘 그리고 지점장이나 코치에게 내가 관리할수있는 권한을 주는 기능 넣자.")
--
-- 예전: 지점 목표(boxing_gym_raids)는 SQL 로만 넣을 수 있어서 화면에는 "코치님이 새 목표를 열면 여기에 보여요"만 떠 있었다.
--   · 전체관리자·관리자(_dm_kind='hq')는 켜 둔 지점(is_branch_visible) 어디든 목표를 열고 끝낸다.
--   · 지점장·코치(_dm_kind='coach')는 '우리 지점 목표 만들기' 권한을 받은 사람만, 자기 지점에.
--   · 권한 표 staff_permissions — 끄면 지우지 않고 revoked_at 을 남긴다 (community_view_grants 와 같은 방식).
--     '커뮤니티 모든 글 보기'는 그대로 community_view_grants 에 둔다. 두 권한을 한 화면에서 켜고 끈다 (list/set_staff_permission).
--   · 목표 종류는 contribute_to_gym_raid 가 실제로 세는 4가지만: 응원 보내기 · 오늘 운동 한 줄 · 복싱 IQ 퀴즈 정답 · 챌린지 완료.
--   · 목표를 열어도 회원에게 알림은 보내지 않는다 (커뮤니티 '우리 지점 목표'에 보인다).
-- 화면: src/components/engagement/GymRaidSheet.tsx · CommunityViewGrants.tsx · src/services/branchGoalService.ts

-- 1) 권한 표 — RPC 로만 읽고 쓴다 (정책 없음)
create table if not exists public.staff_permissions (
  user_id uuid not null references auth.users (id) on delete cascade,
  perm text not null check (perm in ('branch_goal')),
  granted_by uuid,
  created_at timestamptz not null default now(), -- 마지막으로 켠 때
  revoked_at timestamptz,                        -- 끈 때 (켜져 있으면 비어 있다)
  revoked_by uuid,
  primary key (user_id, perm)
);
alter table public.staff_permissions enable row level security;

-- 2) 도우미
create or replace function public._staff_has_perm(p_uid uuid, p_perm text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_uid is not null
     and exists (select 1 from public.staff_permissions s
                  where s.user_id = p_uid and s.perm = p_perm and s.revoked_at is null)
     and public._dm_kind(p_uid) = 'coach';
$$;

-- 이 사람이 이 지점 목표를 열고 끝낼 수 있나
create or replace function public._can_manage_branch_goals(p_uid uuid, p_branch text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when p_uid is null or p_branch is null or btrim(p_branch) = '' then false
    when public._dm_kind(p_uid) = 'hq' then public.is_branch_visible(p_branch)
    else public._staff_has_perm(p_uid, 'branch_goal')
         and coalesce(public._community_branch_of(p_uid) = p_branch, false)
  end;
$$;

revoke all on function public._staff_has_perm(uuid, text) from public, anon;
revoke all on function public._can_manage_branch_goals(uuid, text) from public, anon;

-- 3) 지점장·코치 목록과 권한 (전체관리자·관리자만)
create or replace function public.list_staff_permissions()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if public._dm_kind(v_uid) is distinct from 'hq' then raise exception '관리자만 볼 수 있어요'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', s.user_id,
           'name', s.display_name,
           'title', s.title,
           'branch', s.branch_name,
           'avatar_url', s.avatar_url,
           'community_view', g.user_id is not null and g.revoked_at is null,
           'community_view_at', case when g.user_id is not null and g.revoked_at is null then g.created_at end,
           'branch_goal', bg.user_id is not null and bg.revoked_at is null,
           'branch_goal_at', case when bg.user_id is not null and bg.revoked_at is null then bg.created_at end
         ) order by s.branch_name nulls last, s.display_name), '[]'::jsonb)
    into v_out
    from (
      select p.user_id,
             coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '이름 없음') as display_name,
             coalesce(nullif(btrim(p.staff_title), ''),
                      case when exists (select 1 from public.user_roles r
                                         where r.user_id = p.user_id and r.role = 'branch_manager')
                           then '지점장' else '코치' end) as title,
             p.branch_name,
             p.avatar_url
        from public.profiles p
       where (coalesce(p.is_staff, false)
              or exists (select 1 from public.user_roles r
                          where r.user_id = p.user_id and r.role in ('branch_manager', 'coach')))
         and not exists (select 1 from public.user_roles r
                          where r.user_id = p.user_id and r.role in ('super_admin', 'admin'))
    ) s
    left join public.community_view_grants g on g.user_id = s.user_id
    left join public.staff_permissions bg on bg.user_id = s.user_id and bg.perm = 'branch_goal';

  return jsonb_build_object('staff', v_out);
end $$;

-- 4) 권한 켜고 끄기 (전체관리자·관리자만) — community_view · branch_goal. 새로 켰을 때만 받은 사람에게 알림
create or replace function public.set_staff_permission(p_user_id uuid, p_perm text, p_on boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_on boolean := coalesce(p_on, false);
  v_new boolean;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if public._dm_kind(v_uid) is distinct from 'hq' then raise exception '관리자만 권한을 바꿀 수 있어요'; end if;
  if p_user_id is null then raise exception '누구에게 줄지 골라 주세요'; end if;
  if p_perm is null or p_perm not in ('community_view', 'branch_goal') then raise exception '알 수 없는 권한이에요'; end if;
  if v_on and public._dm_kind(p_user_id) is distinct from 'coach' then
    raise exception '지점장·코치에게만 줄 수 있어요';
  end if;

  if p_perm = 'community_view' then
    if v_on then
      insert into public.community_view_grants (user_id, granted_by, created_at, revoked_at, revoked_by)
      values (p_user_id, v_uid, now(), null, null)
      on conflict (user_id) do update
         set granted_by = excluded.granted_by, created_at = excluded.created_at, revoked_at = null, revoked_by = null
       where public.community_view_grants.revoked_at is not null
      returning true into v_new;
      if coalesce(v_new, false) then
        insert into public.notifications (user_id, title, body, link)
        values (p_user_id, '🔑 커뮤니티 보기 권한을 받았어요',
                '우리 지점 회원 글을 공개 범위와 상관없이 볼 수 있어요 (친구만 · 나만 보기 포함). 회원 관리와 응원에만 써 주세요.',
                '/myboxer/community');
      end if;
    else
      update public.community_view_grants
         set revoked_at = now(), revoked_by = v_uid
       where user_id = p_user_id and revoked_at is null;
    end if;
  else
    if v_on then
      insert into public.staff_permissions (user_id, perm, granted_by, created_at, revoked_at, revoked_by)
      values (p_user_id, 'branch_goal', v_uid, now(), null, null)
      on conflict (user_id, perm) do update
         set granted_by = excluded.granted_by, created_at = excluded.created_at, revoked_at = null, revoked_by = null
       where public.staff_permissions.revoked_at is not null
      returning true into v_new;
      if coalesce(v_new, false) then
        insert into public.notifications (user_id, title, body, link)
        values (p_user_id, '🔑 우리 지점 목표를 만들 수 있게 됐어요',
                '커뮤니티 > 우리 지점 목표에서 회원들과 함께 깰 목표를 열고 끝낼 수 있어요.',
                '/myboxer/community');
      end if;
    else
      update public.staff_permissions
         set revoked_at = now(), revoked_by = v_uid
       where user_id = p_user_id and perm = 'branch_goal' and revoked_at is null;
    end if;
  end if;

  return jsonb_build_object('success', true, 'perm', p_perm, 'granted', v_on);
end $$;

-- 5) 지점 목표 보기 — get_active_gym_raids 와 같은 모양 + 만들 수 있는지 + (전체관리자·관리자) 고를 수 있는 지점
create or replace function public.get_branch_gym_raids(p_branch text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_hq boolean;
  v_own text;
  v_branch text;
  v_branches jsonb := '[]'::jsonb;
  v_raids jsonb;
begin
  if v_uid is null then raise exception 'auth required'; end if;

  perform public.boxing_gym_raid_lazy_expire();

  v_hq := public._dm_kind(v_uid) = 'hq';
  v_own := public._community_branch_of(v_uid);
  if v_hq then
    select coalesce(jsonb_agg(b.name order by b.name), '[]'::jsonb) into v_branches
      from public.branches b where b.is_visible;
    v_branch := nullif(btrim(coalesce(p_branch, '')), '');
    if v_branch is null or not public.is_branch_visible(v_branch) then
      v_branch := case when public.is_branch_visible(v_own) then v_own
                       else (select b.name from public.branches b where b.is_visible order by b.name limit 1) end;
    end if;
  else
    v_branch := v_own;
  end if;

  if v_branch is null then
    return jsonb_build_object('success', true, 'branch', null, 'can_manage', false,
                              'branches', v_branches, 'raids', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id,
           'title', r.title,
           'description', r.description,
           'raid_type', r.raid_type,
           'target_value', r.target_value,
           'current_value', r.current_value,
           'percentage', least(100, case when r.target_value > 0
                                         then round((r.current_value / r.target_value) * 100, 1)
                                         else 0 end),
           'start_date', r.start_date,
           'end_date', r.end_date,
           'status', r.status,
           'reward_quest_xp', r.reward_quest_xp,
           'reward_gems', r.reward_gems,
           'reward_respect', r.reward_respect,
           'my_contribution', coalesce(c.my_count, 0),
           'reward_claimed', cl.id is not null,
           'created_by_name', (select coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''))
                                 from public.profiles p
                                where r.metadata ? 'created_by'
                                  and p.user_id::text = r.metadata->>'created_by')
         ) order by r.end_date asc), '[]'::jsonb)
    into v_raids
    from public.boxing_gym_raids r
    left join (
      select x.raid_id, count(*)::integer as my_count
        from public.boxing_gym_raid_contributions x
       where x.user_id = v_uid
       group by x.raid_id
    ) c on c.raid_id = r.id
    left join public.boxing_gym_raid_reward_claims cl on cl.raid_id = r.id and cl.user_id = v_uid
   where r.branch_name = v_branch
     and r.status in ('active', 'completed');

  return jsonb_build_object('success', true, 'branch', v_branch,
                            'can_manage', public._can_manage_branch_goals(v_uid, v_branch),
                            'branches', case when v_hq then v_branches else '[]'::jsonb end,
                            'raids', v_raids);
end $$;

-- 6) 목표 열기
create or replace function public.create_gym_raid(
  p_branch text,
  p_title text,
  p_description text,
  p_raid_type text,
  p_target integer,
  p_start date,
  p_end date,
  p_reward_gems integer default 20,
  p_reward_xp integer default 100,
  p_reward_respect integer default 15
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_branch text := nullif(btrim(coalesce(p_branch, '')), '');
  v_title text := btrim(coalesce(p_title, ''));
  v_desc text := nullif(btrim(coalesce(p_description, '')), '');
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_id uuid;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if v_branch is null then v_branch := public._community_branch_of(v_uid); end if;
  if not public._can_manage_branch_goals(v_uid, v_branch) then
    raise exception '이 지점 목표를 만들 권한이 없어요';
  end if;
  if char_length(v_title) < 2 then raise exception '목표 이름을 2자 이상 적어 주세요'; end if;
  if char_length(v_title) > 40 then raise exception '목표 이름은 40자까지예요'; end if;
  if v_desc is not null and char_length(v_desc) > 300 then raise exception '설명은 300자까지예요'; end if;
  if p_raid_type is null or p_raid_type not in ('cheer_sent', 'journal_write', 'quiz_correct', 'challenge_clear') then
    raise exception '목표 종류를 골라 주세요';
  end if;
  if p_target is null or p_target < 1 or p_target > 10000 then
    raise exception '목표 숫자는 1~10000 사이로 적어 주세요';
  end if;
  if p_start is null or p_end is null then raise exception '기간을 골라 주세요'; end if;
  if p_end < p_start then raise exception '끝나는 날이 시작하는 날보다 빨라요'; end if;
  if p_start < v_today - 1 then raise exception '시작하는 날은 오늘부터 고를 수 있어요'; end if;
  if (p_end - p_start) + 1 > 60 then raise exception '기간은 60일까지예요'; end if;
  if coalesce(p_reward_gems, 0) not between 0 and 500 then raise exception '챔피언 머니 보상은 0~500 사이예요'; end if;
  if coalesce(p_reward_xp, 0) not between 0 and 1000 then raise exception '경험치 보상은 0~1000 사이예요'; end if;
  if coalesce(p_reward_respect, 0) not between 0 and 100 then raise exception '리스펙트 보상은 0~100 사이예요'; end if;

  -- 설명을 안 적으면 종류에 맞는 기본 설명
  v_desc := coalesce(v_desc,
    case p_raid_type
      when 'cheer_sent' then '동료에게 응원을 보내면 1점이에요. '
      when 'journal_write' then '오늘 운동 한 줄을 남기면 1점이에요. '
      when 'quiz_correct' then '복싱 IQ 퀴즈를 맞히면 1점이에요. '
      else '챌린지를 완료하면 1점이에요. '
    end || '지점이 함께 ' || p_target || '점을 채우면 모두 보상을 받아요.');

  insert into public.boxing_gym_raids
    (branch_name, title, description, raid_type, target_value, current_value, start_date, end_date, status,
     reward_quest_xp, reward_gems, reward_respect, metadata)
  values
    (v_branch, v_title, v_desc, p_raid_type, p_target, 0, p_start, p_end, 'active',
     coalesce(p_reward_xp, 0), coalesce(p_reward_gems, 0), coalesce(p_reward_respect, 0),
     jsonb_build_object('created_by', v_uid, 'created_via', 'app'))
  returning id into v_id;

  return jsonb_build_object('success', true, 'raid_id', v_id, 'branch', v_branch);
end $$;

-- 7) 목표 끝내기 (진행 중인 것만 — 달성한 목표는 보상을 받을 수 있게 그대로 둔다)
create or replace function public.end_gym_raid(p_raid_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_status text;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  select r.branch_name, r.status into v_branch, v_status from public.boxing_gym_raids r where r.id = p_raid_id;
  if not found then raise exception '목표를 찾을 수 없어요'; end if;
  if not public._can_manage_branch_goals(v_uid, v_branch) then raise exception '이 목표를 끝낼 권한이 없어요'; end if;
  if v_status <> 'active' then raise exception '진행 중인 목표만 끝낼 수 있어요'; end if;

  update public.boxing_gym_raids
     set status = 'ended',
         updated_at = now(),
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('ended_by', v_uid, 'ended_at', now())
   where id = p_raid_id;

  return jsonb_build_object('success', true);
end $$;

-- 8) 권한
revoke all on function public.list_staff_permissions() from public, anon;
grant execute on function public.list_staff_permissions() to authenticated;
revoke all on function public.set_staff_permission(uuid, text, boolean) from public, anon;
grant execute on function public.set_staff_permission(uuid, text, boolean) to authenticated;
revoke all on function public.get_branch_gym_raids(text) from public, anon;
grant execute on function public.get_branch_gym_raids(text) to authenticated;
revoke all on function public.create_gym_raid(text, text, text, text, integer, date, date, integer, integer, integer) from public, anon;
grant execute on function public.create_gym_raid(text, text, text, text, integer, date, date, integer, integer, integer) to authenticated;
revoke all on function public.end_gym_raid(uuid) from public, anon;
grant execute on function public.end_gym_raid(uuid) to authenticated;
