-- 앱에 아직 안 들어온 우리 지점 회원 초대 (2026-10-18 대표님:
--   "앱에 가입안한회원도 뜨게 해주고 앱에 가입할수있도록 앱 공유 링크 초대 보낼수있도록해줘 초대하면 챔피언머니 1000원 보상하자")
--
-- '앱에 안 들어온 회원' = 일괄등록으로 계정만 있고 한 번도 로그인하지 않은 회원 (auth.users.last_sign_in_at 이 비어 있음).
--   선릉역점 654명 중 612명이 이 상태였다 — 운동 짝꿍 목록에 섞여 '요청 보내기'가 떴지만 받을 수가 없었다.
-- · get_cornerman_people / search_cornerman_people — 짝꿍 후보(앱 쓰는 회원)와 앱에 없는 회원을 joined 로 나눠 준다
--   (예전 get_cornerman_candidates · search_cornerman_candidates 는 예전 앱을 위해 그대로 둔다)
-- · send_member_invite — 초대 기록(누가 누구를). 문구·링크는 화면이 공유 창으로 보낸다. 같은 지점 · 앱에 없는 회원만 · 하루 50번까지
-- · claim_invite_reward — 앱을 열 때 부른다. 내가 초대받은 사람이면 '처음 초대한 1명'에게 챔피언 머니 1,000 + 알림
--   (카카오로 들어와 기존 계정과 합쳐지면 계정 id 가 바뀌므로 전화번호로도 맞춘다 — 전화번호는 화면에 내려가지 않는다)
--   한 사람이 받는 초대 보상은 한 달 20번(20,000)까지.
-- · my_invite_stats — 내가 초대한 수 · 들어온 수 · 받은 보상

create table if not exists public.member_invites (
  id uuid primary key default gen_random_uuid(),
  inviter_user_id uuid not null,
  invitee_user_id uuid not null,   -- 일괄등록 계정 id (합쳐지면 지워질 수 있어 FK 를 걸지 않는다)
  invitee_phone text,              -- 서버에서만 쓴다
  branch_name text,
  created_at timestamptz not null default now(),
  joined_at timestamptz,
  joined_user_id uuid,
  rewarded boolean not null default false,
  reward_amount integer not null default 0,
  unique (inviter_user_id, invitee_user_id)
);
create index if not exists member_invites_invitee_idx on public.member_invites (invitee_user_id) where joined_at is null;
create index if not exists member_invites_phone_idx on public.member_invites (invitee_phone) where joined_at is null;
alter table public.member_invites enable row level security; -- RPC 로만

-- 앱에 들어온 적이 있나 (한 번이라도 로그인)
create or replace function public._app_joined(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from auth.users u where u.id = p_uid and u.last_sign_in_at is not null);
$$;
revoke all on function public._app_joined(uuid) from public, anon, authenticated;

-- 짝꿍 후보 + 앱에 없는 회원 (각각 최근 출석 순으로 p_limit 명까지)
create or replace function public.get_cornerman_people(p_limit integer default 30)
returns table(user_id uuid, display_name text, branch_name text, current_rank text, current_level integer,
              state text, joined boolean, invited_by_me boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_my_branch text;
  v_all boolean;
  v_limit int := greatest(1, least(coalesce(p_limit, 30), 60));
begin
  if v_uid is null then raise exception 'auth required'; end if;
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
       and not public.boxing_cornerman_has_active_pair(b.uid)
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
end $$;

-- 이름으로 찾기 — 앱 쓰는 회원(짝꿍 상태)과 앱에 없는 회원 모두
create or replace function public.search_cornerman_people(p_query text, p_limit integer default 20)
returns table(user_id uuid, display_name text, branch_name text, current_rank text, current_level integer,
              state text, joined boolean, invited_by_me boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_my_branch text;
  v_all boolean;
  v_q text := left(btrim(coalesce(p_query, '')), 30);
  v_pat text;
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
begin
  if v_uid is null then raise exception 'auth required'; end if;
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
                when public.boxing_cornerman_has_active_pair(p.user_id) then 'paired'
                when exists (select 1 from public.boxing_cornerman_pairs cp
                              where cp.status = 'pending'
                                and ((cp.requester_user_id = v_uid and cp.receiver_user_id = p.user_id)
                                  or (cp.receiver_user_id = v_uid and cp.requester_user_id = p.user_id))) then 'pending'
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
end $$;

-- 초대 기록 — 화면은 이 결과를 받은 뒤 공유 창(카톡·문자)으로 링크를 보낸다
create or replace function public.send_member_invite(p_invitee uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  t record;
  v_cnt int;
  v_first boolean;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if p_invitee is null or p_invitee = v_uid then raise exception '다른 회원을 골라 주세요'; end if;
  select p.user_id, p.branch_name, p.phone_number, coalesce(p.is_staff, false) as staff, coalesce(p.is_test_account, false) as test,
         coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '회원') as dn
    into t from public.profiles p where p.user_id = p_invitee;
  if not found then raise exception '회원을 찾을 수 없어요'; end if;
  if t.staff or t.test then raise exception '초대할 수 없는 계정이에요'; end if;
  if public._app_joined(p_invitee) then raise exception '이미 앱을 쓰고 있는 회원이에요 — 짝꿍 요청을 보내 보세요'; end if;
  if public._dm_kind(v_uid) is distinct from 'hq'
     and public._community_branch_of(v_uid) is distinct from t.branch_name then
    raise exception '같은 지점 회원만 초대할 수 있어요';
  end if;
  select count(*) into v_cnt from public.member_invites
   where inviter_user_id = v_uid and created_at > now() - interval '1 day';
  if v_cnt >= 50 then raise exception '오늘은 초대를 많이 보냈어요. 내일 다시 보내 주세요'; end if;

  v_first := not exists (select 1 from public.member_invites i where i.invitee_user_id = p_invitee and i.inviter_user_id <> v_uid);
  insert into public.member_invites (inviter_user_id, invitee_user_id, invitee_phone, branch_name)
  values (v_uid, p_invitee, nullif(regexp_replace(coalesce(t.phone_number, ''), '[^0-9]', '', 'g'), ''), t.branch_name)
  on conflict (inviter_user_id, invitee_user_id) do nothing;

  return jsonb_build_object('success', true, 'name', t.dn, 'first_inviter', v_first,
                            'inviter_name', coalesce(public._community_display_name(v_uid), '회원'));
end $$;

-- 앱을 열 때 — 내가 초대받은 사람이면 처음 초대한 1명에게 보상
create or replace function public.claim_invite_reward()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_phone text;
  v_first public.member_invites%rowtype;
  v_cnt int;
  v_rewarded boolean := false;
  v_month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
begin
  if v_uid is null then return jsonb_build_object('success', true, 'rewarded', false); end if;
  select nullif(regexp_replace(coalesce(p.phone_number, ''), '[^0-9]', '', 'g'), '') into v_phone
    from public.profiles p where p.user_id = v_uid;

  select i.* into v_first
    from public.member_invites i
   where i.joined_at is null and i.inviter_user_id <> v_uid
     and (i.invitee_user_id = v_uid or (v_phone is not null and i.invitee_phone = v_phone))
   order by i.created_at asc
   limit 1
   for update;
  if not found then return jsonb_build_object('success', true, 'rewarded', false); end if;

  update public.member_invites i
     set joined_at = now(), joined_user_id = v_uid
   where i.joined_at is null
     and (i.invitee_user_id = v_uid or (v_phone is not null and i.invitee_phone = v_phone));

  if exists (select 1 from public.profiles p where p.user_id = v_first.inviter_user_id) then
    select count(*) into v_cnt from public.member_invites i
     where i.inviter_user_id = v_first.inviter_user_id and i.rewarded and i.joined_at >= v_month_start;
    if v_cnt < 20 then
      perform public.grant_gems(v_first.inviter_user_id, 1000, '친구 초대 보상');
      update public.member_invites set rewarded = true, reward_amount = 1000 where id = v_first.id;
      insert into public.notifications (user_id, title, body, link)
      values (v_first.inviter_user_id,
              '🎉 ' || coalesce(public._community_display_name(v_uid), '회원') || '님이 앱에 들어왔어요',
              '초대 보상으로 챔피언 머니 +1,000을 받았어요. 운동 짝꿍도 신청해 보세요!',
              '/myboxer/community');
      v_rewarded := true;
    end if;
  end if;

  return jsonb_build_object('success', true, 'rewarded', v_rewarded,
                            'inviter', public._community_display_name(v_first.inviter_user_id));
end $$;

create or replace function public.my_invite_stats()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'invited', count(*),
    'joined', count(*) filter (where i.joined_at is not null),
    'reward', coalesce(sum(i.reward_amount), 0)
  )
  from public.member_invites i
  where i.inviter_user_id = auth.uid();
$$;

revoke all on function public.get_cornerman_people(integer) from public, anon;
grant execute on function public.get_cornerman_people(integer) to authenticated;
revoke all on function public.search_cornerman_people(text, integer) from public, anon;
grant execute on function public.search_cornerman_people(text, integer) to authenticated;
revoke all on function public.send_member_invite(uuid) from public, anon;
grant execute on function public.send_member_invite(uuid) to authenticated;
revoke all on function public.claim_invite_reward() from public, anon;
grant execute on function public.claim_invite_reward() to authenticated;
revoke all on function public.my_invite_stats() from public, anon;
grant execute on function public.my_invite_stats() to authenticated;
