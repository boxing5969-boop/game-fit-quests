-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 리뷰 미션(네이버 · 구글 · 당근) · 프로필 카드 꾸미기 · TV 가볍게 (2026-11-21 대표님 「마이복서 153에 구글 리뷰 네이버 리뷰
-- 당근 리뷰를 미션으로 넣자 · 버튼을 클릭하면 리뷰를 달 수 있는 주소로 이동하고 리뷰를 달면 마일리지와 선물 · 선물은 프로필 카드를
-- 꾸밀 수 있는 것 · 꾸민 프로필 카드는 사이니지에 뜨게 · 칠금동 라이브보드는 렉 없이」 · 작업판 myboxer:review-missions · myboxer:tv)
--
--   ① 리뷰 미션 — 지점마다 플랫폼 주소 · 마일리지(review_mission_links) · 회원마다 플랫폼 한 번(review_mission_claims)
--      버튼 → 주소 열기(opened) → 인증 사진 올리기(submitted · 지점장 알림) → 운영진 승인(approved = 마일리지 + 카드 선물 + 알림)
--      별점 · 내용과 상관없이 드린다(좋은 후기를 조건으로 걸지 않는다 — 공정위 추천 · 보증 지침 · 플랫폼 정책).
--   ② 카드 꾸미기 — 가진 꾸미기(card_deco_owned) · 지금 낀 것(card_deco_equipped). 이름이 free_ 로 시작하면 누구나.
--      TV 는 board_card_deco(지점, 회원들, 열쇠) — board_people 과 같은 기준(오늘 그 지점에 왔거나 운동 중인 사람만).
--   ③ TV 가볍게 — TV 번호마다 켬 · 끔 · 자동(tv_board_lite). board_tv_mode 가 lite 를 같이 준다.
-- 새 표 · 새 함수 · 두 함수(board_tv_mode · get_tv_board_modes)에 칸 하나씩 더하기만 — 다른 함수 동작은 그대로.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

-- ── ① 리뷰 미션 ─────────────────────────────────────────────────────────────────────────────────
create table if not exists public.review_mission_links (
  branch_name text not null,
  platform    text not null check (platform in ('naver', 'google', 'daangn')),
  url         text check (url is null or url ~ '^https://'),
  enabled     boolean not null default true,
  mileage     integer not null default 3000 check (mileage between 0 and 50000),
  updated_by  uuid,
  updated_at  timestamptz not null default now(),
  primary key (branch_name, platform)
);

create table if not exists public.review_mission_claims (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  branch_name    text not null,
  platform       text not null check (platform in ('naver', 'google', 'daangn')),
  status         text not null default 'opened' check (status in ('opened', 'submitted', 'approved', 'rejected')),
  proof_path     text,
  note           text,
  opened_at      timestamptz not null default now(),
  submitted_at   timestamptz,
  decided_at     timestamptz,
  decided_by     uuid,
  reject_reason  text,
  reward_mileage integer,
  unique (user_id, platform)
);
create index if not exists review_mission_claims_branch_idx on public.review_mission_claims (branch_name, status, submitted_at desc);

alter table public.review_mission_links enable row level security;
alter table public.review_mission_claims enable row level security;
revoke all on public.review_mission_links from anon, authenticated;
revoke all on public.review_mission_claims from anon, authenticated;

-- 처음 값 — 선릉역점 네이버 · 구글(대표님 기존 주소). 당근 · 칠금점은 앱 「리뷰 미션」 설정에서 넣는다.
insert into public.review_mission_links (branch_name, platform, url) values
  ('153복싱짐 선릉역점', 'naver',  'https://m.place.naver.com/place/10800198/review/visitor'),
  ('153복싱짐 선릉역점', 'google', 'https://www.google.com/maps?cid=13218955786062149729'),
  ('153복싱짐 선릉역점', 'daangn', null),
  ('153복싱짐 칠금점',   'naver',  null),
  ('153복싱짐 칠금점',   'google', null),
  ('153복싱짐 칠금점',   'daangn', null)
on conflict (branch_name, platform) do nothing;

-- 플랫폼마다 드리는 카드 꾸미기(앱 src/lib/cardDeco.ts 와 같은 이름) · 세 곳 다 받으면 더 드리는 것
create or replace function public._review_gifts(_platform text)
returns text[]
language sql
immutable
set search_path to 'public'
as $$
  select case _platform
           when 'naver'  then array['skin_emerald', 'sticker_bolt']
           when 'google' then array['skin_sapphire', 'sticker_star']
           when 'daangn' then array['skin_sunset', 'sticker_heart']
           when 'all'    then array['frame_supporter', 'sticker_crown', 'title_supporter']
           else array[]::text[]
         end
$$;

create or replace function public._review_platform_ko(_platform text)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select case _platform when 'naver' then '네이버' when 'google' then '구글' when 'daangn' then '당근' else _platform end
$$;

-- 알림 — 밤 10시 ~ 아침 7시는 알림함에만(휴대폰 알림 없음). 알림이 실패해도 일은 그대로.
create or replace function public._review_notify(_user uuid, _title text, _body text, _link text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_h int := extract(hour from now() at time zone 'Asia/Seoul')::int;
begin
  if _user is null then return; end if;
  insert into public.notifications (user_id, title, body, link, pushed_at)
  values (_user, left(_title, 120), left(coalesce(_body, ''), 300), _link,
          case when v_h >= 22 or v_h < 7 then now() end);
exception when others then
  null;
end $$;

-- 미션을 받을 수 있는 회원인가 — 지도진 · 테스트 계정 · 관리 계정은 아니다
create or replace function public._review_member_branch(_uid uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.branch_name
    from public.profiles p
   where p.user_id = _uid
     and p.branch_name is not null
     and not coalesce(p.is_staff, false)
     and not coalesce(p.is_test_account, false)
     and not public.has_role(_uid, 'super_admin')
     and not public.has_role(_uid, 'admin')
     and not public.has_role(_uid, 'branch_manager')
     and not public.has_role(_uid, 'coach')
   limit 1
$$;

-- 회원 화면 — 내 지점의 열린 미션 · 내 상태
create or replace function public.get_my_review_missions()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid    uuid := auth.uid();
  v_branch text;
  v_list   jsonb;
  v_open   int;
  v_done   int;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  v_branch := public._review_member_branch(v_uid);
  if v_branch is null then
    return jsonb_build_object('on', false, 'reason', 'not_member');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'platform', l.platform,
           'url', l.url,
           'mileage', l.mileage,
           'gifts', to_jsonb(public._review_gifts(l.platform)),
           'status', coalesce(c.status, 'none'),
           'reject_reason', c.reject_reason,
           'submitted_at', c.submitted_at,
           'decided_at', c.decided_at,
           'reward_mileage', c.reward_mileage
         ) order by array_position(array['naver', 'google', 'daangn'], l.platform)), '[]'::jsonb),
         count(*),
         count(*) filter (where c.status = 'approved')
    into v_list, v_open, v_done
    from public.review_mission_links l
    left join public.review_mission_claims c on c.user_id = v_uid and c.platform = l.platform
   where l.branch_name = v_branch and l.enabled and l.url is not null;

  return jsonb_build_object(
    'on', v_open > 0,
    'branch', v_branch,
    'missions', v_list,
    'all_gifts', to_jsonb(public._review_gifts('all')),
    'all_done', v_open > 0 and v_done >= v_open,
    'done', v_done,
    'total', v_open
  );
end $$;

-- 버튼을 눌렀다 — 주소를 돌려주고 '열어 봄'을 남긴다(이미 승인 · 확인 중이면 그대로)
create or replace function public.review_mission_open(p_platform text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid    uuid := auth.uid();
  v_branch text := public._review_member_branch(auth.uid());
  v_url    text;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  if v_branch is null then
    raise exception '회원만 참여할 수 있어요' using errcode = '42501';
  end if;
  select l.url into v_url
    from public.review_mission_links l
   where l.branch_name = v_branch and l.platform = p_platform and l.enabled and l.url is not null;
  if v_url is null then
    raise exception '지금은 이 미션이 닫혀 있어요';
  end if;
  insert into public.review_mission_claims (user_id, branch_name, platform, status, opened_at)
  values (v_uid, v_branch, p_platform, 'opened', now())
  on conflict (user_id, platform) do update
     set opened_at = now(),
         branch_name = excluded.branch_name,
         status = case when review_mission_claims.status = 'rejected' then 'opened' else review_mission_claims.status end;
  return jsonb_build_object('url', v_url);
end $$;

-- 리뷰를 남겼어요 — 인증 사진(내 폴더 review-proofs/<내 id>/…)과 함께 확인 요청 · 지점장님께 알림
create or replace function public.review_mission_submit(p_platform text, p_proof_path text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid    uuid := auth.uid();
  v_branch text := public._review_member_branch(auth.uid());
  v_status text;
  v_name   text;
  v_staff  uuid;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  if v_branch is null then
    raise exception '회원만 참여할 수 있어요' using errcode = '42501';
  end if;
  if p_proof_path is null or p_proof_path !~ ('^' || v_uid::text || '/[A-Za-z0-9._-]{1,120}$') then
    raise exception '인증 사진을 다시 올려 주세요';
  end if;
  if not exists (select 1 from public.review_mission_links l
                  where l.branch_name = v_branch and l.platform = p_platform and l.enabled and l.url is not null) then
    raise exception '지금은 이 미션이 닫혀 있어요';
  end if;
  select c.status into v_status from public.review_mission_claims c where c.user_id = v_uid and c.platform = p_platform;
  if v_status = 'approved' then
    return jsonb_build_object('status', 'approved', 'already', true);
  end if;

  insert into public.review_mission_claims (user_id, branch_name, platform, status, proof_path, note, submitted_at, reject_reason)
  values (v_uid, v_branch, p_platform, 'submitted', p_proof_path, left(nullif(btrim(coalesce(p_note, '')), ''), 200), now(), null)
  on conflict (user_id, platform) do update
     set status = 'submitted', proof_path = excluded.proof_path, note = excluded.note,
         submitted_at = now(), reject_reason = null, branch_name = excluded.branch_name;

  select coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '회원') into v_name
    from public.profiles p where p.user_id = v_uid;
  for v_staff in
    select p.user_id from public.profiles p
     where p.branch_name = v_branch and p.user_id is not null and public.has_role(p.user_id, 'branch_manager')
  loop
    perform public._review_notify(v_staff, '리뷰 미션 확인 요청',
      v_name || '님이 ' || public._review_platform_ko(p_platform) || ' 리뷰 인증 사진을 올렸어요. 확인하고 승인해 주세요.',
      '/manager?review=1');
  end loop;
  return jsonb_build_object('status', 'submitted');
end $$;

-- 운영진 화면 — 우리 지점 설정 · 확인할 것 · 지난 것
create or replace function public.review_mission_admin_board(p_branch text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_scope  text := public._goods_staff_scope();
  v_branch text;
  v_links  jsonb;
  v_claims jsonb;
begin
  v_branch := case when v_scope = '*' then coalesce(nullif(btrim(coalesce(p_branch, '')), ''), '153복싱짐 선릉역점') else v_scope end;

  select coalesce(jsonb_agg(jsonb_build_object(
           'platform', s.platform,
           'url', l.url,
           'enabled', coalesce(l.enabled, true),
           'mileage', coalesce(l.mileage, 3000),
           'gifts', to_jsonb(public._review_gifts(s.platform)),
           'updated_at', l.updated_at
         ) order by s.ord), '[]'::jsonb)
    into v_links
    from (values ('naver', 1), ('google', 2), ('daangn', 3)) as s(platform, ord)
    left join public.review_mission_links l on l.branch_name = v_branch and l.platform = s.platform;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id,
           'platform', c.platform,
           'status', c.status,
           'proof_path', c.proof_path,
           'note', c.note,
           'member_name', coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.nickname), ''), '회원'),
           'member_nickname', p.nickname,
           'submitted_at', c.submitted_at,
           'decided_at', c.decided_at,
           'reject_reason', c.reject_reason,
           'reward_mileage', c.reward_mileage
         ) order by (c.status = 'submitted') desc, coalesce(c.submitted_at, c.opened_at) desc), '[]'::jsonb)
    into v_claims
    from (
      select * from public.review_mission_claims rc
       where rc.branch_name = v_branch
         and rc.status in ('submitted', 'approved', 'rejected')
         and (rc.status = 'submitted' or coalesce(rc.decided_at, rc.submitted_at) > now() - interval '90 days')
       order by (rc.status = 'submitted') desc, coalesce(rc.submitted_at, rc.opened_at) desc
       limit 200
    ) c
    left join public.profiles p on p.user_id = c.user_id;

  return jsonb_build_object(
    'scope', case when v_scope = '*' then 'all' else 'branch' end,
    'branch', v_branch,
    'can_edit', v_scope = '*' or public.has_role(auth.uid(), 'branch_manager'),
    'links', v_links,
    'claims', v_claims,
    'all_gifts', to_jsonb(public._review_gifts('all')),
    'pending', (select count(*) from public.review_mission_claims rc where rc.branch_name = v_branch and rc.status = 'submitted'),
    'approved', (select count(*) from public.review_mission_claims rc where rc.branch_name = v_branch and rc.status = 'approved')
  );
end $$;

-- 설정 저장 — 지점장 · 관리자
create or replace function public.review_mission_link_save(p_branch text, p_platform text, p_url text, p_enabled boolean, p_mileage integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_scope  text := public._goods_staff_scope();
  v_branch text;
  v_url    text := nullif(btrim(coalesce(p_url, '')), '');
begin
  if v_scope <> '*' and not public.has_role(auth.uid(), 'branch_manager') then
    raise exception '지점장님 · 관리자만 바꿀 수 있어요' using errcode = '42501';
  end if;
  v_branch := case when v_scope = '*' then nullif(btrim(coalesce(p_branch, '')), '') else v_scope end;
  if v_branch is null or not exists (select 1 from public.branches b where b.name = v_branch) then
    raise exception '지점을 찾을 수 없어요';
  end if;
  if p_platform not in ('naver', 'google', 'daangn') then
    raise exception '플랫폼이 잘못됐어요';
  end if;
  if v_url is not null and (v_url !~ '^https://[^ ]+$' or length(v_url) > 500) then
    raise exception '주소는 https:// 로 시작하는 링크로 넣어 주세요';
  end if;
  if p_mileage is null or p_mileage < 0 or p_mileage > 50000 then
    raise exception '마일리지는 0 ~ 50,000점으로 넣어 주세요';
  end if;
  insert into public.review_mission_links (branch_name, platform, url, enabled, mileage, updated_by, updated_at)
  values (v_branch, p_platform, v_url, coalesce(p_enabled, true), p_mileage, auth.uid(), now())
  on conflict (branch_name, platform) do update
     set url = excluded.url, enabled = excluded.enabled, mileage = excluded.mileage,
         updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  return public.review_mission_admin_board(v_branch);
end $$;

-- 승인 · 반려 — 승인이면 마일리지(두 번 눌려도 한 번) + 카드 선물 + 세 곳 다면 더 + 회원 알림
create or replace function public.review_mission_decide(p_id uuid, p_approve boolean, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_scope   text := public._goods_staff_scope();
  v_c       public.review_mission_claims;
  v_mileage int;
  v_item    text;
  v_total   int;
  v_done    int;
  v_bonus   boolean := false;
  v_pk      text;
begin
  select * into v_c from public.review_mission_claims where id = p_id for update;
  if v_c.id is null then
    raise exception '찾을 수 없어요';
  end if;
  if v_scope <> '*' and v_scope <> v_c.branch_name then
    raise exception '우리 지점 미션만 확인할 수 있어요' using errcode = '42501';
  end if;
  if v_c.status = 'approved' then
    return jsonb_build_object('status', 'approved', 'already', true);
  end if;
  if v_c.status <> 'submitted' then
    raise exception '확인 요청이 들어온 미션만 정할 수 있어요';
  end if;
  v_pk := public._review_platform_ko(v_c.platform);

  if not coalesce(p_approve, false) then
    update public.review_mission_claims
       set status = 'rejected', decided_at = now(), decided_by = auth.uid(),
           reject_reason = left(coalesce(nullif(btrim(coalesce(p_reason, '')), ''), '인증 사진에서 리뷰를 확인하지 못했어요'), 120)
     where id = v_c.id;
    perform public._review_notify(v_c.user_id, v_pk || ' 리뷰 미션 · 다시 올려 주세요',
      coalesce(nullif(btrim(coalesce(p_reason, '')), ''), '인증 사진에서 리뷰를 확인하지 못했어요') || ' · 리뷰가 보이게 다시 찍어 올려 주시면 바로 확인할게요.',
      '/home?sheet=review');
    return jsonb_build_object('status', 'rejected');
  end if;

  select coalesce(l.mileage, 3000) into v_mileage
    from public.review_mission_links l where l.branch_name = v_c.branch_name and l.platform = v_c.platform;
  v_mileage := coalesce(v_mileage, 3000);

  update public.review_mission_claims
     set status = 'approved', decided_at = now(), decided_by = auth.uid(), reject_reason = null, reward_mileage = v_mileage
   where id = v_c.id;

  if v_mileage > 0 then
    perform public.grant_mileage(v_c.user_id, 'adjust', v_mileage, '리뷰 미션 · ' || v_pk || ' 리뷰',
                                 'review:' || v_c.platform || ':' || v_c.user_id::text, v_c.id);
  end if;
  foreach v_item in array public._review_gifts(v_c.platform) loop
    insert into public.card_deco_owned (user_id, item_id, source) values (v_c.user_id, v_item, 'review_' || v_c.platform)
    on conflict (user_id, item_id) do nothing;
  end loop;

  -- 지점에 열린 미션을 모두 마치면 서포터 세트
  select count(*) into v_total from public.review_mission_links l
   where l.branch_name = v_c.branch_name and l.enabled and l.url is not null;
  select count(*) into v_done from public.review_mission_claims rc
    join public.review_mission_links l on l.branch_name = v_c.branch_name and l.platform = rc.platform and l.enabled and l.url is not null
   where rc.user_id = v_c.user_id and rc.status = 'approved';
  if v_total >= 2 and v_done >= v_total then
    foreach v_item in array public._review_gifts('all') loop
      insert into public.card_deco_owned (user_id, item_id, source) values (v_c.user_id, v_item, 'review_all')
      on conflict (user_id, item_id) do nothing;
      if found then v_bonus := true; end if;
    end loop;
  end if;

  perform public._review_notify(v_c.user_id, v_pk || ' 리뷰 미션 완료 · 선물이 도착했어요',
    case when v_mileage > 0 then '153 마일리지 ' || to_char(v_mileage, 'FM999,999') || '점 · ' else '' end
      || '카드 꾸미기 선물을 받았어요.'
      || case when v_bonus then ' 리뷰 미션을 모두 마쳐 153 서포터 세트도 열렸어요.' else '' end
      || ' 내 카드를 꾸며 보세요.',
    '/home?sheet=card-deco');
  return jsonb_build_object('status', 'approved', 'mileage', v_mileage, 'bonus', v_bonus);
end $$;

-- 인증 사진 저장소 — 비공개 · 사진만 · 5MB · 내 폴더에만 올리고, 본인과 운영진만 본다
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-proofs', 'review-proofs', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

do $$
begin
  create policy "review proofs own insert" on storage.objects for insert to authenticated
    with check (bucket_id = 'review-proofs' and (storage.foldername(name))[1] = (auth.uid())::text);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "review proofs read" on storage.objects for select to authenticated
    using (bucket_id = 'review-proofs'
           and ((storage.foldername(name))[1] = (auth.uid())::text
                or public.has_role(auth.uid(), 'super_admin')
                or public.has_role(auth.uid(), 'admin')
                or public.has_role(auth.uid(), 'branch_manager')
                or public.has_role(auth.uid(), 'coach')));
exception when duplicate_object then null;
end $$;

-- ── ② 프로필 카드 꾸미기 ─────────────────────────────────────────────────────────────────────────
create table if not exists public.card_deco_owned (
  user_id    uuid not null references auth.users(id) on delete cascade,
  item_id    text not null check (item_id ~ '^[a-z0-9_]{2,40}$'),
  source     text,
  granted_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
create table if not exists public.card_deco_equipped (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  frame      text check (frame ~ '^[a-z0-9_]{2,40}$'),
  skin       text check (skin ~ '^[a-z0-9_]{2,40}$'),
  sticker    text check (sticker ~ '^[a-z0-9_]{2,40}$'),
  title      text check (title ~ '^[a-z0-9_]{2,40}$'),
  updated_at timestamptz not null default now()
);
alter table public.card_deco_owned enable row level security;
alter table public.card_deco_equipped enable row level security;
revoke all on public.card_deco_owned from anon, authenticated;
revoke all on public.card_deco_equipped from anon, authenticated;

-- 낄 수 있나 — free_ 로 시작하면 누구나, 아니면 가진 것만 · 칸마다 이름 앞머리가 맞아야 한다
create or replace function public._card_deco_ok(_uid uuid, _slot text, _item text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select _item is null
      or (_item ~ '^[a-z0-9_]{2,40}$'
          and (_item like _slot || '_%' or _item like 'free_' || _slot || '_%')
          and (_item like 'free_%' or exists (select 1 from public.card_deco_owned o where o.user_id = _uid and o.item_id = _item)))
$$;

create or replace function public.get_my_card_deco()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'owned', coalesce((select jsonb_agg(jsonb_build_object('item_id', o.item_id, 'source', o.source, 'granted_at', o.granted_at)
                                       order by o.granted_at)
                         from public.card_deco_owned o where o.user_id = v_uid), '[]'::jsonb),
    'equipped', coalesce((select jsonb_build_object('frame', e.frame, 'skin', e.skin, 'sticker', e.sticker, 'title', e.title,
                                                    'updated_at', e.updated_at)
                            from public.card_deco_equipped e where e.user_id = v_uid), '{}'::jsonb)
  );
end $$;

create or replace function public.set_my_card_deco(p_frame text, p_skin text, p_sticker text, p_title text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_f text := nullif(btrim(coalesce(p_frame, '')), '');
  v_s text := nullif(btrim(coalesce(p_skin, '')), '');
  v_k text := nullif(btrim(coalesce(p_sticker, '')), '');
  v_t text := nullif(btrim(coalesce(p_title, '')), '');
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  if not public._card_deco_ok(v_uid, 'frame', v_f) or not public._card_deco_ok(v_uid, 'skin', v_s)
     or not public._card_deco_ok(v_uid, 'sticker', v_k) or not public._card_deco_ok(v_uid, 'title', v_t) then
    raise exception '아직 받지 않은 꾸미기예요';
  end if;
  insert into public.card_deco_equipped (user_id, frame, skin, sticker, title, updated_at)
  values (v_uid, v_f, v_s, v_k, v_t, now())
  on conflict (user_id) do update
     set frame = excluded.frame, skin = excluded.skin, sticker = excluded.sticker, title = excluded.title, updated_at = now();
  return public.get_my_card_deco();
end $$;

-- 다른 회원 카드(앱) — 꾸미기는 누구에게나 보이는 카드 모양이라 로그인한 사람이면 읽는다(최대 100명)
create or replace function public.get_card_decos(p_user_ids uuid[])
returns table (user_id uuid, frame text, skin text, sticker text, title text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select e.user_id, e.frame, e.skin, e.sticker, e.title
    from public.card_deco_equipped e
   where auth.uid() is not null
     and e.user_id = any ((coalesce(p_user_ids, '{}'::uuid[]))[1:100])
$$;

-- TV — board_people 과 같은 기준(TV 열쇠 · 오늘 그 지점에 왔거나 운동 중인 사람만). volatile(다른 board_* 처럼 — 대기 열쇠를 저장한다)
create or replace function public.board_card_deco(p_branch text, p_user_ids uuid[], p_key text default null)
returns table (user_id uuid, frame text, skin text, sticker text, title text)
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
#variable_conflict use_column
declare
  v_name  text := public._board_branch_ok(p_branch, p_key);
  v_start timestamptz := ((now() at time zone 'Asia/Seoul')::date)::timestamp at time zone 'Asia/Seoul';
begin
  if v_name is null then
    return;
  end if;
  return query
    select e.user_id, e.frame, e.skin, e.sticker, e.title
      from public.card_deco_equipped e
     where e.user_id = any ((coalesce(p_user_ids, '{}'::uuid[]))[1:300])
       and (exists (select 1 from public.attendance_logs a
                     where a.user_id = e.user_id and a.branch_name = v_name and a.checked_in_at >= v_start)
            or exists (select 1 from public.activity_sessions s
                        where s.user_id = e.user_id and s.branch_name = v_name
                          and s.status = 'active' and s.ended_at is null));
end $$;

-- ── ③ TV 가볍게 ─────────────────────────────────────────────────────────────────────────────────
create table if not exists public.tv_board_lite (
  branch_name text not null,
  slot        text not null check (slot in ('1', '2', '3', '4')),
  lite        boolean,
  set_by      uuid,
  set_at      timestamptz not null default now(),
  primary key (branch_name, slot)
);
alter table public.tv_board_lite enable row level security;
revoke all on public.tv_board_lite from anon, authenticated;

-- 칠금점 TV(모니터 1대 · 번호 없는 /tv/chilgeum = 4번)는 처음부터 가볍게 (대표님 「렉 없이」)
insert into public.tv_board_lite (branch_name, slot, lite) values ('153복싱짐 칠금점', '4', true)
on conflict (branch_name, slot) do nothing;

-- 켬(true) · 끔(false) · 자동(null = 기기 힘을 보고 TV 가 정함)
create or replace function public.set_tv_board_lite(p_branch text, p_slot text, p_lite boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_name text := public._tv_board_staff_branch(p_branch);
begin
  if p_slot is null or p_slot not in ('1', '2', '3', '4') then
    raise exception 'TV 번호가 잘못됐어요';
  end if;
  -- 자동(null)도 줄로 남긴다(누가 · 언제 바꿨는지)
  insert into public.tv_board_lite (branch_name, slot, lite, set_by, set_at)
  values (v_name, p_slot, p_lite, auth.uid(), now())
  on conflict (branch_name, slot) do update set lite = excluded.lite, set_by = excluded.set_by, set_at = excluded.set_at;
  begin
    perform realtime.send(jsonb_build_object('slot', p_slot, 't', floor(extract(epoch from now()) * 1000)::bigint),
                          'mode', 'tv-mode:' || v_name, false);
  exception when others then
    null;
  end;
  return public.get_tv_board_modes(v_name);
end $$;

-- 아래 두 함수는 운영 정의(2026-11-08 tv_board_modes) 그대로 + lite 칸 하나
create or replace function public.board_tv_mode(p_branch text, p_key text DEFAULT NULL::text, p_slot text DEFAULT NULL::text, p_showing text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_name text := public._board_branch_ok(p_branch, p_key);
  v_mode text;
  v_at   timestamptz;
  v_lite boolean;
begin
  if v_name is null then
    return null;
  end if;
  if p_slot is null or p_slot not in ('1', '2', '3', '4') then
    return jsonb_build_object('branch', v_name, 'slot', null, 'mode', null, 'set_at', null);
  end if;
  if p_showing in ('1', '2', '3', '4', 'pb1', 'pb2') then
    insert into public.tv_board_seen (branch_name, slot, showing, seen_at)
    values (v_name, p_slot, p_showing, now())
    on conflict (branch_name, slot) do update set showing = excluded.showing, seen_at = excluded.seen_at;
  end if;
  select m.mode, m.set_at into v_mode, v_at
    from public.tv_board_modes m
   where m.branch_name = v_name and m.slot = p_slot;
  select l.lite into v_lite from public.tv_board_lite l where l.branch_name = v_name and l.slot = p_slot;
  return jsonb_build_object('branch', v_name, 'slot', p_slot, 'mode', coalesce(v_mode, 'home'), 'set_at', v_at, 'lite', v_lite);
end $function$;

create or replace function public.get_tv_board_modes(p_branch text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_name text := public._tv_board_staff_branch(p_branch);
begin
  return jsonb_build_object(
    'branch', v_name,
    'now', now(),
    'slots', (
      select jsonb_agg(jsonb_build_object(
               'slot', s.slot,
               'mode', coalesce(m.mode, 'home'),
               'set_at', m.set_at,
               'set_by', coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), '')),
               'showing', v.showing,
               'seen_at', v.seen_at,
               'lite', l.lite
             ) order by s.slot)
        from (values ('1'), ('2'), ('3'), ('4')) as s(slot)
        left join public.tv_board_modes m on m.branch_name = v_name and m.slot = s.slot
        left join public.profiles p on p.user_id = m.set_by
        left join public.tv_board_seen v on v.branch_name = v_name and v.slot = s.slot
        left join public.tv_board_lite l on l.branch_name = v_name and l.slot = s.slot
    )
  );
end $function$;

-- ── 권한 ────────────────────────────────────────────────────────────────────────────────────────
revoke all on function public._review_gifts(text) from public, anon, authenticated;
revoke all on function public._review_platform_ko(text) from public, anon, authenticated;
revoke all on function public._review_notify(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public._review_member_branch(uuid) from public, anon, authenticated;
revoke all on function public._card_deco_ok(uuid, text, text) from public, anon, authenticated;

revoke all on function public.get_my_review_missions() from public, anon;
revoke all on function public.review_mission_open(text) from public, anon;
revoke all on function public.review_mission_submit(text, text, text) from public, anon;
revoke all on function public.review_mission_admin_board(text) from public, anon;
revoke all on function public.review_mission_link_save(text, text, text, boolean, integer) from public, anon;
revoke all on function public.review_mission_decide(uuid, boolean, text) from public, anon;
revoke all on function public.get_my_card_deco() from public, anon;
revoke all on function public.set_my_card_deco(text, text, text, text) from public, anon;
revoke all on function public.get_card_decos(uuid[]) from public, anon;
revoke all on function public.set_tv_board_lite(text, text, boolean) from public, anon;
revoke all on function public.board_card_deco(text, uuid[], text) from public;

grant execute on function public.get_my_review_missions() to authenticated;
grant execute on function public.review_mission_open(text) to authenticated;
grant execute on function public.review_mission_submit(text, text, text) to authenticated;
grant execute on function public.review_mission_admin_board(text) to authenticated;
grant execute on function public.review_mission_link_save(text, text, text, boolean, integer) to authenticated;
grant execute on function public.review_mission_decide(uuid, boolean, text) to authenticated;
grant execute on function public.get_my_card_deco() to authenticated;
grant execute on function public.set_my_card_deco(text, text, text, text) to authenticated;
grant execute on function public.get_card_decos(uuid[]) to authenticated;
grant execute on function public.set_tv_board_lite(text, text, boolean) to authenticated;
grant execute on function public.board_card_deco(text, uuid[], text) to anon, authenticated;
