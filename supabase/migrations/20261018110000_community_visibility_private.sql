-- 커뮤니티 글 공개 범위 3가지 + 본사가 지점장·코치에게 '우리 지점 글 모두 보기' 권한 주기 (2026-10-18 대표님:
--   "개인 공개 전체공개 친구만 공개할수있는 기능 만들어줘 본사는 지점장이나 코치에게 볼수있는 권한줄수있는 기능 만들어주고"
--   — 선릉역점 회원 글 "아니ㅋㅋ 이거전체공개였냐고.." 를 보고)
--
-- 공개 범위 (champion_journal_entries.visibility):
--   branch   = 전체 공개 — 같은 지점 회원 모두 (예전 '지점 동료 모두' 그대로)
--   partners = 친구만 — 운동 짝꿍 · 최근 30일 서로 응원한 동료 (예전 '짝꿍만' 그대로, is_journal_partner)
--   private  = 나만 보기 — 새로 추가. 나 + 본사 + 본사가 권한을 준 우리 지점 지점장·코치만
--              (값 검사 규칙은 20261018110500_community_visibility_check.sql)
--   · 쓸 때 바로 정한다 (submit_champion_journal_entry_v2 — 글 저장과 공개 범위가 한 번에). 예전에는 '지점 공개'로 먼저
--     올라간 뒤 따로 바꿔서, 바꾸기에 실패하면 공개로 남을 수 있었다.
--   · 쓴 뒤에도 내 글은 ⋯ 에서 바꾼다 (set_journal_entry_visibility).
--
-- 보기 권한 (community_view_grants): 본사(전체관리자·관리자)가 지점장·코치 한 명씩 켜고 끈다 (커뮤니티 본사 보기 화면).
--   · 켜진 사람은 자기 지점 회원 글을 공개 범위·숨김과 상관없이 본다 (본사 보기와 같고, 다른 지점은 안 보인다).
--   · 지점장·코치가 아니게 되면(_dm_kind 가 'coach' 가 아니면) 권한도 꺼진 것으로 본다.
--   · 그동안 지점장(branch_manager)은 API 로 자기 지점 글을 직접 읽을 수 있었다(화면에서는 안 씀) → 이제 권한을 받은 사람만.

-- 1) 공개 범위 값 — 20261018110500_community_visibility_check.sql

-- 2) 보기 권한 — RPC 로만 읽고 쓴다 (정책 없음). 끄면 지우지 않고 끈 때·끈 사람을 남긴다
create table if not exists public.community_view_grants (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_by uuid,
  created_at timestamptz not null default now(), -- 마지막으로 켠 때
  revoked_at timestamptz,                        -- 끈 때 (켜져 있으면 비어 있다)
  revoked_by uuid
);
alter table public.community_view_grants enable row level security;

-- 이 사람이 '우리 지점 글 모두 보기' 권한을 받은 지점장·코치인가
create or replace function public._community_sees_branch_all(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_uid is not null
     and exists (select 1 from public.community_view_grants g where g.user_id = p_uid and g.revoked_at is null)
     and public._dm_kind(p_uid) = 'coach';
$$;

-- 권한 받은 지점장·코치가 이 회원(같은 지점)의 글을 볼 수 있나
create or replace function public._community_granted_for(p_viewer uuid, p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public._community_sees_branch_all(p_viewer)
     and coalesce(public._community_branch_of(p_viewer) = public._community_branch_of(p_owner), false);
$$;

revoke all on function public._community_sees_branch_all(uuid) from public, anon;
revoke all on function public._community_granted_for(uuid, uuid) from public, anon;
grant execute on function public._community_granted_for(uuid, uuid) to authenticated; -- 아래 RLS 정책에서 쓴다

-- 3) 글 보기 권한 — 나만 보기 · 권한 받은 지점장·코치
create or replace function public.community_can_view_entry(p_viewer uuid, p_entry_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  e record;
  v_branch text;
begin
  if p_viewer is null then return false; end if;
  select user_id, visibility, hidden_at into e from public.champion_journal_entries where id = p_entry_id;
  if not found then return false; end if;
  if e.user_id = p_viewer then return true; end if;
  -- 본사(전체관리자·관리자)는 친구만 · 나만 보기 · 숨긴 글까지 모두 (2026-10-16)
  if public._dm_kind(p_viewer) = 'hq' then return true; end if;
  -- 본사가 보기 권한을 준 지점장·코치 — 자기 지점 회원 글은 모두 (2026-10-18)
  if public._community_granted_for(p_viewer, e.user_id) then return true; end if;
  if e.hidden_at is not null then return false; end if;
  -- 나만 보기는 여기까지 (2026-10-18)
  if e.visibility = 'private' then return false; end if;
  if e.visibility = 'branch' then
    v_branch := public._community_branch_of(p_viewer);
    if v_branch is not null and v_branch = public._community_branch_of(e.user_id) then return true; end if;
  end if;
  return public.is_journal_partner(p_viewer, e.user_id);
end $$;

-- 4) 사진·공개 범위 (글 올린 직후 사진을 붙일 때) — 나만 보기도 받는다
create or replace function public.set_journal_entry_options(p_entry_id uuid, p_visibility text, p_photo_url text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if p_visibility not in ('branch', 'partners', 'private') then raise exception '공개 범위가 올바르지 않습니다'; end if;
  if p_photo_url is not null and p_photo_url !~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/community/' then
    raise exception '사진 주소가 올바르지 않습니다';
  end if;
  update public.champion_journal_entries
     set visibility = p_visibility, photo_url = p_photo_url
   where id = p_entry_id and user_id = v_uid;
  if not found then raise exception '내 글만 바꿀 수 있습니다'; end if;
  return jsonb_build_object('success', true);
end $$;

-- 5) 쓴 뒤에 공개 범위만 바꾸기 (내 '오늘 운동 한 줄'만 — 코치 이번 주 목표는 늘 전체 공개)
create or replace function public.set_journal_entry_visibility(p_entry_id uuid, p_visibility text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if p_visibility is null or p_visibility not in ('branch', 'partners', 'private') then
    raise exception '공개 범위가 올바르지 않습니다';
  end if;
  update public.champion_journal_entries
     set visibility = p_visibility
   where id = p_entry_id and user_id = v_uid and kind = 'journal';
  if not found then raise exception '내가 쓴 한 줄만 바꿀 수 있어요'; end if;
  return jsonb_build_object('success', true, 'visibility', p_visibility);
end $$;

-- 6) 글 쓰기 + 공개 범위를 한 번에 — 기존 submit_champion_journal_entry(보상 · 기록)를 그대로 부르고, 같은 트랜잭션에서
--    공개 범위를 바꾼다. 끝나기 전에는 다른 사람에게 안 보이므로 '전체 공개'로 잠깐 보이는 순간이 없다.
--    (예전 앱은 계속 submit_champion_journal_entry 를 불러 전체 공개로 올린다)
create or replace function public.submit_champion_journal_entry_v2(
  p_prompt text,
  p_content text,
  p_mood text default null,
  p_visibility text default 'branch'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_vis text := coalesce(nullif(btrim(p_visibility), ''), 'branch');
  v_res jsonb;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if v_vis not in ('branch', 'partners', 'private') then raise exception '공개 범위가 올바르지 않습니다'; end if;
  v_res := public.submit_champion_journal_entry(p_prompt, p_content, p_mood);
  if v_vis <> 'branch' then
    update public.champion_journal_entries
       set visibility = v_vis
     where id = (v_res->>'entry_id')::uuid and user_id = auth.uid();
  end if;
  return v_res || jsonb_build_object('visibility', v_vis);
end $$;
revoke all on function public.submit_champion_journal_entry_v2(text, text, text, text) from public, anon;
grant execute on function public.submit_champion_journal_entry_v2(text, text, text, text) to authenticated;

-- 7) 예전 짝꿍 일기 피드 — 나만 보기 · 숨긴 글은 빼고 (지금 화면에서는 안 쓰지만 열려 있는 함수라서)
create or replace function public.get_partner_journal_feed(p_limit integer default 10)
returns table(id uuid, user_id uuid, display_name text, prompt text, content text, mood text, created_at timestamp with time zone, comment_count integer, relation text)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
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
  -- 나만 보기 · 숨긴 글은 빼고 (2026-10-18)
  WHERE e.visibility <> 'private' AND e.hidden_at IS NULL
  ORDER BY e.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 50));
END;
$function$;

-- 8) 모두의 피드 — 권한 받은 지점장·코치는 자기 지점 글을 모두 (나만 보기는 쓴 사람 · 본사 · 권한 받은 사람만).
--    20261016100000 처럼 지금 함수에서 해당 줄만 바꾼다 (나머지 본문 그대로)
do $$
declare
  d text;
  r record;
begin
  d := pg_get_functiondef('public.get_community_feed(integer)'::regprocedure);
  if position('v_granted' in d) > 0 then
    return; -- 이미 바뀜
  end if;
  for r in
    select * from (values
      (1, E'  v_all boolean;\n',
          E'  v_all boolean;\n  v_granted boolean;\n'),
      (2, E'  v_all := public._dm_kind(v_uid) = ''hq'';\n',
          E'  v_all := public._dm_kind(v_uid) = ''hq'';\n'
          || E'  -- 본사가 보기 권한을 준 지점장·코치 — 자기 지점 글은 공개 범위·숨김과 상관없이 (2026-10-18)\n'
          || E'  v_granted := not v_all and public._community_sees_branch_all(v_uid);\n'),
      (3, E'and (e.hidden_at is null or v_all)',
          E'and (e.hidden_at is null or v_all or v_granted)'),
      (4, E'\n            or e.user_id = v_uid\n',
          E'\n            or e.user_id = v_uid\n            or (v_granted and p.branch_name = v_branch)\n'),
      (5, E'''all_branches'', v_all,',
          E'''all_branches'', v_all, ''granted'', v_granted,')
    ) as t(n, old_txt, new_txt)
    order by n
  loop
    if (length(d) - length(replace(d, r.old_txt, ''))) / length(r.old_txt) <> 1 then
      raise exception 'get_community_feed 에서 바꿀 줄이 하나가 아님: %', r.n;
    end if;
    d := replace(d, r.old_txt, r.new_txt);
  end loop;
  execute d;
end $$;

-- 9) 표에서 직접 읽기 (RLS) — 짝꿍은 나만 보기 · 숨긴 글 빼고, 지점장은 본사가 권한을 준 사람만
alter policy champion_journal_select_self_partner_admin on public.champion_journal_entries
  using (
    user_id = (select auth.uid())
    or public.has_role((select auth.uid()), 'admin'::app_role)
    or public.has_role((select auth.uid()), 'super_admin'::app_role)
    or (visibility <> 'private' and hidden_at is null and public.is_journal_partner((select auth.uid()), user_id))
    or public._community_granted_for((select auth.uid()), user_id)
  );

-- 10) 본사 — 지점장·코치 목록과 보기 권한
create or replace function public.list_community_view_staff()
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
  if public._dm_kind(v_uid) is distinct from 'hq' then raise exception '본사만 볼 수 있어요'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', s.user_id,
           'name', s.display_name,
           'title', s.title,
           'branch', s.branch_name,
           'avatar_url', s.avatar_url,
           'granted', g.user_id is not null and g.revoked_at is null,
           'granted_at', case when g.revoked_at is null then g.created_at end
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
    left join public.community_view_grants g on g.user_id = s.user_id;

  return jsonb_build_object('staff', v_out);
end $$;

create or replace function public.set_community_view_grant(p_user_id uuid, p_on boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_new boolean;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if public._dm_kind(v_uid) is distinct from 'hq' then raise exception '본사만 권한을 줄 수 있어요'; end if;
  if p_user_id is null then raise exception '누구에게 줄지 골라 주세요'; end if;

  if coalesce(p_on, false) then
    if public._dm_kind(p_user_id) is distinct from 'coach' then
      raise exception '지점장·코치에게만 줄 수 있어요';
    end if;
    -- 새로 켰을 때만 (이미 켜져 있으면 그대로) — 받은 사람에게 알림
    insert into public.community_view_grants (user_id, granted_by, created_at, revoked_at, revoked_by)
    values (p_user_id, v_uid, now(), null, null)
    on conflict (user_id) do update
       set granted_by = excluded.granted_by, created_at = excluded.created_at, revoked_at = null, revoked_by = null
     where public.community_view_grants.revoked_at is not null
    returning true into v_new;
    if coalesce(v_new, false) then
      insert into public.notifications (user_id, title, body, link)
      values (
        p_user_id,
        '🔑 커뮤니티 보기 권한을 받았어요',
        '본사가 우리 지점 회원 글을 공개 범위와 상관없이 볼 수 있는 권한을 드렸어요 (친구만 · 나만 보기 포함). 회원 관리와 응원에만 써 주세요.',
        '/myboxer/community'
      );
    end if;
  else
    update public.community_view_grants
       set revoked_at = now(), revoked_by = v_uid
     where user_id = p_user_id and revoked_at is null;
  end if;

  return jsonb_build_object('success', true, 'granted', coalesce(p_on, false));
end $$;

-- 11) 권한
revoke all on function public.set_journal_entry_visibility(uuid, text) from public, anon;
grant execute on function public.set_journal_entry_visibility(uuid, text) to authenticated;
revoke all on function public.list_community_view_staff() from public, anon;
grant execute on function public.list_community_view_staff() to authenticated;
revoke all on function public.set_community_view_grant(uuid, boolean) from public, anon;
grant execute on function public.set_community_view_grant(uuid, boolean) to authenticated;
