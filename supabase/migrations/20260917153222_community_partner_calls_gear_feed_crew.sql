-- 153 커뮤니티 확장 — 오늘 파트너 구하기 · 중고 장비 나눔 · 타이틀매치 축하 · 같은 시간대 팀
-- (2026-09-17 대표님 결정)
--
-- 설계 원칙
--   · 공식 1~40 레벨업과 무관하다. 여기서 XP·파이트머니를 직접 지급하지 않는다.
--     박수는 기존 send_boxing_cheer RPC 를 재사용해 한도·보상·멱등을 한 곳에 둔다.
--   · 쓰기는 전부 SECURITY DEFINER RPC 경유. 회원용 INSERT/UPDATE 정책은 만들지 않는다.
--   · 지점 격리는 서버가 강제한다. 프론트가 보내는 지점 값은 믿지 않는다.
--   · ⚠️ auth.uid() 는 profiles.user_id 와 일치한다. profiles.id 로 조인하면
--     한 행도 안 맞는다(2026-09-17 코너맨·짐레이드가 이걸로 7개월 죽어 있었다).
--   · 모집 글은 크론 없이 만료된다 — call_date = 오늘(KST) 인 것만 조회한다.

-- ═══════════════════════════════════════════════════════════════════
-- ① 오늘 파트너 구하기
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.boxing_partner_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  branch_name text not null,
  call_date date not null default (now() at time zone 'Asia/Seoul')::date,
  slot_hour smallint not null,
  purpose text not null,
  note text,
  status text not null default 'open',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boxing_partner_calls_slot_chk check (slot_hour between 5 and 23),
  constraint boxing_partner_calls_purpose_chk
    check (purpose in ('mitt','sparring','jump','together')),
  constraint boxing_partner_calls_status_chk check (status in ('open','closed')),
  constraint boxing_partner_calls_note_chk check (note is null or length(note) <= 120),
  -- 하루에 한 사람이 여러 글을 도배하지 못하게 한다
  constraint boxing_partner_calls_one_per_day unique (user_id, call_date)
);

create index if not exists idx_boxing_partner_calls_branch_date
  on public.boxing_partner_calls (branch_name, call_date, status);

drop trigger if exists trg_boxing_partner_calls_updated_at on public.boxing_partner_calls;
create trigger trg_boxing_partner_calls_updated_at
  before update on public.boxing_partner_calls
  for each row execute function public.boxing_engagement_set_updated_at();

alter table public.boxing_partner_calls enable row level security;

drop policy if exists "boxing_partner_calls_select_branch_or_admin" on public.boxing_partner_calls;
create policy "boxing_partner_calls_select_branch_or_admin"
  on public.boxing_partner_calls for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.branch_name = boxing_partner_calls.branch_name
    )
    or public.has_role(auth.uid(), 'super_admin')
    or public.is_branch_manager_of(auth.uid(), boxing_partner_calls.user_id)
  );

drop policy if exists "boxing_partner_calls_super_admin_manage" on public.boxing_partner_calls;
create policy "boxing_partner_calls_super_admin_manage"
  on public.boxing_partner_calls for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

create table if not exists public.boxing_partner_call_joins (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.boxing_partner_calls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint boxing_partner_call_joins_unique unique (call_id, user_id)
);

create index if not exists idx_boxing_partner_call_joins_call
  on public.boxing_partner_call_joins (call_id);

alter table public.boxing_partner_call_joins enable row level security;

drop policy if exists "boxing_partner_call_joins_select_branch_or_admin" on public.boxing_partner_call_joins;
create policy "boxing_partner_call_joins_select_branch_or_admin"
  on public.boxing_partner_call_joins for select to authenticated
  using (
    exists (
      select 1
      from public.boxing_partner_calls c
      join public.profiles p on p.user_id = auth.uid()
      where c.id = boxing_partner_call_joins.call_id
        and c.branch_name = p.branch_name
    )
    or public.has_role(auth.uid(), 'super_admin')
  );

drop policy if exists "boxing_partner_call_joins_super_admin_manage" on public.boxing_partner_call_joins;
create policy "boxing_partner_call_joins_super_admin_manage"
  on public.boxing_partner_call_joins for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

-- ═══════════════════════════════════════════════════════════════════
-- ② 중고 장비 나눔
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.boxing_gear_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  branch_name text not null,
  kind text not null,
  gear_size text,
  gear_condition text not null,
  deal text not null,
  note text,
  status text not null default 'open',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boxing_gear_posts_kind_chk
    check (kind in ('glove','handwrap','shoes','rope','headgear','other')),
  constraint boxing_gear_posts_condition_chk
    check (gear_condition in ('new','good','used')),
  -- 나눔(무료) 또는 양도. 금액은 앱에 적지 않는다 — 거래는 데스크를 통한다.
  constraint boxing_gear_posts_deal_chk check (deal in ('free','transfer')),
  constraint boxing_gear_posts_status_chk check (status in ('open','done')),
  constraint boxing_gear_posts_note_chk check (note is null or length(note) <= 200),
  constraint boxing_gear_posts_size_chk check (gear_size is null or length(gear_size) <= 30)
);

create index if not exists idx_boxing_gear_posts_branch_status
  on public.boxing_gear_posts (branch_name, status, created_at desc);

drop trigger if exists trg_boxing_gear_posts_updated_at on public.boxing_gear_posts;
create trigger trg_boxing_gear_posts_updated_at
  before update on public.boxing_gear_posts
  for each row execute function public.boxing_engagement_set_updated_at();

alter table public.boxing_gear_posts enable row level security;

drop policy if exists "boxing_gear_posts_select_branch_or_admin" on public.boxing_gear_posts;
create policy "boxing_gear_posts_select_branch_or_admin"
  on public.boxing_gear_posts for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.branch_name = boxing_gear_posts.branch_name
    )
    or public.has_role(auth.uid(), 'super_admin')
    or public.is_branch_manager_of(auth.uid(), boxing_gear_posts.user_id)
  );

drop policy if exists "boxing_gear_posts_super_admin_manage" on public.boxing_gear_posts;
create policy "boxing_gear_posts_super_admin_manage"
  on public.boxing_gear_posts for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

-- ═══════════════════════════════════════════════════════════════════
-- 공통 — 호출자의 지점 (auth.uid() = profiles.user_id)
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.boxing_community_my_branch()
returns text language sql stable security definer set search_path to 'public' as $fn$
  select branch_name from public.profiles where user_id = auth.uid();
$fn$;

grant execute on function public.boxing_community_my_branch() to authenticated;
