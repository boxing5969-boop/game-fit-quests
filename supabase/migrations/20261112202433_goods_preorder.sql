-- 153 굿즈 사전예약 · 첫 상품 「153 플리스 집업」 (2026-11-12 대표님 「디자인 마무리 하고 모델에 입혀서 상세페이지 처럼 만들어줘
--   마이복서에 올려서 회원님들에게 판매신청받고 … 유효 회원님들에게 전체 문자 보내서 판매하게 상세페이지 링크 만들어줘」
--   → 39,000원 · 인쇄 색 흰색/진회색 고르기 · 신청 뒤 데스크 카드 결제 · 마감 2주)
--
-- 새 표 2 · 새 함수만 (기존 표 · 함수는 손대지 않는다).
--   goods_campaigns  상품 한 줄(가격 · 색 · 사이즈 · 마감) — 값을 바꿔도 앱을 다시 올릴 필요가 없다.
--   goods_orders     신청 한 줄(누가 · 어느 지점 · 색 · 사이즈 · 벌 수 · 상태 applied → paid → delivered / canceled).
--
-- 표는 anon · authenticated 모두 막고 함수로만 읽고 쓴다.
--   goods_campaign_info(slug)        anon · 회원  상세페이지(public/goods/fleece)가 가격 · 마감 · 지점 목록을 읽는다
--   goods_order_apply(…)             anon · 회원  신청. 로그인이면 그 계정, 아니면 이름 · 휴대폰 · 지점(같은 번호의 앱 계정이 있으면 잇는다 —
--                                                답에는 회원인지 아닌지 싣지 않는다)
--   goods_my_page(slug)              회원         내 정보(채우기) + 내 신청(같은 번호로 링크에서 한 신청 포함)
--   goods_order_cancel(id)           회원         결제 전 · 마감 전 내 신청 취소
--   goods_admin_orders(slug, 지점)   운영진       대표님 · 관리자 = 전 지점, 지점장 · 코치 = 자기 지점
--   goods_admin_update(id, …)        운영진       결제 완료 · 받음 · 취소 · 되돌리기 · 색/사이즈/벌 수 고치기 · 메모

create table if not exists public.goods_campaigns (
  slug        text primary key check (slug ~ '^[a-z0-9-]{3,40}$'),
  title       text not null,
  price       integer not null check (price between 1000 and 1000000),
  colors      jsonb not null,                 -- [{"key":"white","label":"흰색 인쇄"}, …]
  sizes       jsonb not null,                 -- ["M","L","XL","2XL"]
  max_qty     integer not null default 3 check (max_qty between 1 and 10),
  max_orders_per_phone integer not null default 5 check (max_orders_per_phone between 1 and 50),
  opens_at    timestamptz not null default now(),
  closes_at   timestamptz not null,
  is_open     boolean not null default true,
  branches    text[],                         -- null = 153복싱짐 모든 지점
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.goods_orders (
  id            uuid primary key default gen_random_uuid(),
  order_no      text not null unique,
  campaign      text not null references public.goods_campaigns(slug) on delete restrict,
  user_id       uuid,
  name          text not null check (char_length(name) between 1 and 30),
  phone         text not null check (phone ~ '^01[016789][0-9]{7,8}$'),
  branch_name   text not null,
  color         text not null,
  size          text not null,
  qty           integer not null check (qty between 1 and 10),
  unit_price    integer not null,
  amount        integer not null,
  status        text not null default 'applied' check (status in ('applied', 'paid', 'delivered', 'canceled')),
  source        text not null default 'link' check (source in ('app', 'link')),
  member_match  text not null default 'none' check (member_match in ('login', 'phone', 'none')),
  staff_memo    text check (staff_memo is null or char_length(staff_memo) <= 200),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  paid_at       timestamptz,
  paid_by       uuid,
  delivered_at  timestamptz,
  delivered_by  uuid,
  canceled_at   timestamptz,
  canceled_by   uuid,
  cancel_reason text
);

create index if not exists goods_orders_campaign_status_idx on public.goods_orders (campaign, status);
create index if not exists goods_orders_campaign_phone_idx on public.goods_orders (campaign, phone);
create index if not exists goods_orders_user_idx on public.goods_orders (user_id);

alter table public.goods_campaigns enable row level security;
alter table public.goods_orders enable row level security;
revoke all on table public.goods_campaigns from public, anon, authenticated;
revoke all on table public.goods_orders from public, anon, authenticated;
grant all on table public.goods_campaigns to service_role;
grant all on table public.goods_orders to service_role;

-- ── 안쪽 함수 ─────────────────────────────────────────────

create or replace function public._goods_digits(p text)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $function$
  select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g')
$function$;

-- 부른 분의 범위: '*' = 전 지점(대표님 · 관리자), 지점 이름 = 그 지점 운영진(지점장 · 코치 · is_staff). 그 밖은 막는다.
create or replace function public._goods_staff_scope()
returns text
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid    uuid := auth.uid();
  v_branch text;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  if public.has_role(v_uid, 'super_admin') or public.has_role(v_uid, 'admin') then
    return '*';
  end if;
  select p.branch_name into v_branch
    from public.profiles p
   where p.user_id = v_uid
     and p.branch_name is not null
     and (coalesce(p.is_staff, false)
          or public.has_role(v_uid, 'branch_manager')
          or public.has_role(v_uid, 'coach'))
   limit 1;
  if v_branch is null then
    raise exception '운영진만 볼 수 있어요' using errcode = '42501';
  end if;
  return v_branch;
end $function$;

-- 신청 한 줄 → 화면에 보낼 모양 (운영진용은 이름 · 휴대폰 · 메모까지)
create or replace function public._goods_order_json(o public.goods_orders, p_staff boolean, p_closes_at timestamptz)
returns jsonb
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  select jsonb_build_object(
           'id', o.id, 'order_no', o.order_no, 'color', o.color, 'size', o.size, 'qty', o.qty,
           'unit_price', o.unit_price, 'amount', o.amount, 'status', o.status, 'branch_name', o.branch_name,
           'created_at', o.created_at, 'paid_at', o.paid_at, 'delivered_at', o.delivered_at, 'canceled_at', o.canceled_at,
           'can_cancel', (o.status = 'applied' and now() < p_closes_at))
         || case when p_staff then jsonb_build_object(
              'name', o.name, 'phone', o.phone, 'source', o.source, 'member_match', o.member_match,
              'user_id', o.user_id, 'staff_memo', o.staff_memo, 'cancel_reason', o.cancel_reason)
            else '{}'::jsonb end
$function$;

-- ── 상세페이지 · 회원 ─────────────────────────────────────

create or replace function public.goods_campaign_info(p_slug text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  c          public.goods_campaigns;
  v_branches jsonb;
begin
  select * into c from public.goods_campaigns where slug = p_slug;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  select coalesce(jsonb_agg(b.name order by b.name), '[]'::jsonb) into v_branches
    from public.branches b
   where b.name like '153복싱짐 %'
     and (c.branches is null or b.name = any (c.branches));
  return jsonb_build_object(
    'ok', true, 'slug', c.slug, 'title', c.title, 'price', c.price,
    'colors', c.colors, 'sizes', c.sizes, 'max_qty', c.max_qty,
    'opens_at', c.opens_at, 'closes_at', c.closes_at,
    'open', (c.is_open and now() >= c.opens_at and now() < c.closes_at),
    'branches', v_branches, 'now', now());
end $function$;

create or replace function public.goods_order_apply(
  p_slug   text,
  p_color  text,
  p_size   text,
  p_qty    integer,
  p_name   text,
  p_phone  text,
  p_branch text,
  p_agree  boolean,
  p_source text default 'link'
)
returns jsonb
language plpgsql
volatile security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid     uuid := auth.uid();
  c         public.goods_campaigns;
  v_name    text;
  v_phone   text;
  v_branch  text;
  v_user    uuid;
  v_match   text := 'none';
  v_pname   text;
  v_pphone  text;
  v_pbranch text;
  v_prefix  text;
  v_no      text;
  v_order   public.goods_orders;
begin
  select * into c from public.goods_campaigns where slug = p_slug;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if not (c.is_open and now() >= c.opens_at and now() < c.closes_at) then
    return jsonb_build_object('ok', false, 'code', 'CLOSED', 'closes_at', c.closes_at);
  end if;
  if not exists (select 1 from jsonb_array_elements(c.colors) e where e ->> 'key' = p_color) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_OPTION');
  end if;
  if not (c.sizes ? coalesce(p_size, '')) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_OPTION');
  end if;
  if p_qty is null or p_qty < 1 or p_qty > c.max_qty then
    return jsonb_build_object('ok', false, 'code', 'INVALID_QTY', 'max_qty', c.max_qty);
  end if;
  if not coalesce(p_agree, false) then
    return jsonb_build_object('ok', false, 'code', 'AGREE_REQUIRED');
  end if;

  if v_uid is not null then
    select p.name, p.phone_number, p.branch_name into v_pname, v_pphone, v_pbranch
      from public.profiles p where p.user_id = v_uid;
    v_name   := coalesce(nullif(btrim(coalesce(p_name, '')), ''), btrim(coalesce(v_pname, '')));
    v_phone  := case when public._goods_digits(p_phone) ~ '^01[016789][0-9]{7,8}$'
                     then public._goods_digits(p_phone) else public._goods_digits(v_pphone) end;
    v_branch := coalesce(nullif(btrim(coalesce(p_branch, '')), ''), v_pbranch);
    v_user   := v_uid;
    v_match  := 'login';
  else
    v_name   := btrim(coalesce(p_name, ''));
    v_phone  := public._goods_digits(p_phone);
    v_branch := btrim(coalesce(p_branch, ''));
  end if;

  if char_length(v_name) < 1 or char_length(v_name) > 30 or v_name ~ '[[:cntrl:]]' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_NAME');
  end if;
  if v_phone !~ '^01[016789][0-9]{7,8}$' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PHONE');
  end if;
  if not exists (select 1 from public.branches b
                  where b.name = v_branch and b.name like '153복싱짐 %'
                    and (c.branches is null or b.name = any (c.branches))) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_BRANCH');
  end if;

  if v_user is null then
    -- 같은 번호의 앱 계정이 있으면 잇는다(나중에 로그인하면 '내 신청'에 보인다). 답에는 싣지 않는다.
    select p.user_id into v_user
      from public.profiles p
     where p.phone_number = v_phone and p.merged_into is null
     order by (p.membership_end >= current_date) desc nulls last, p.membership_end desc nulls last
     limit 1;
    if v_user is not null then
      v_match := 'phone';
    end if;
  end if;

  -- 두 번 눌림 — 2분 안의 같은 신청은 아까 것을 그대로 돌려준다
  select * into v_order
    from public.goods_orders o
   where o.campaign = c.slug and o.phone = v_phone and o.color = p_color and o.size = p_size
     and o.qty = p_qty and o.branch_name = v_branch and o.status = 'applied'
     and o.created_at > now() - interval '2 minutes'
   order by o.created_at desc
   limit 1;
  if found then
    return jsonb_build_object('ok', true, 'again', true, 'closes_at', c.closes_at,
                              'order', public._goods_order_json(v_order, false, c.closes_at));
  end if;

  if (select count(*) from public.goods_orders o
       where o.campaign = c.slug and o.phone = v_phone and o.status in ('applied', 'paid')) >= c.max_orders_per_phone then
    return jsonb_build_object('ok', false, 'code', 'TOO_MANY', 'max', c.max_orders_per_phone);
  end if;
  -- 회원과 이어지지 않는 신청이 짧은 시간에 몰리면 잠깐 멈춘다(링크가 바깥으로 퍼졌을 때)
  if v_match = 'none'
     and (select count(*) from public.goods_orders o
           where o.campaign = c.slug and o.member_match = 'none'
             and o.created_at > now() - interval '10 minutes') >= 60 then
    return jsonb_build_object('ok', false, 'code', 'BUSY');
  end if;

  v_prefix := upper(substr(regexp_replace(c.slug, '[^a-z]', '', 'g'), 1, 2));
  loop
    v_no := v_prefix || '-' || lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
    exit when not exists (select 1 from public.goods_orders o where o.order_no = v_no);
  end loop;

  insert into public.goods_orders (order_no, campaign, user_id, name, phone, branch_name, color, size, qty,
                                   unit_price, amount, source, member_match)
  values (v_no, c.slug, v_user, v_name, v_phone, v_branch, p_color, p_size, p_qty,
          c.price, c.price * p_qty, case when p_source = 'app' then 'app' else 'link' end, v_match)
  returning * into v_order;

  return jsonb_build_object('ok', true, 'closes_at', c.closes_at,
                            'order', public._goods_order_json(v_order, false, c.closes_at));
end $function$;

create or replace function public.goods_my_page(p_slug text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid    uuid := auth.uid();
  c        public.goods_campaigns;
  v_name   text;
  v_phone  text;
  v_branch text;
  v_orders jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', true, 'me', null, 'orders', '[]'::jsonb);
  end if;
  select * into c from public.goods_campaigns where slug = p_slug;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  select p.name, nullif(public._goods_digits(p.phone_number), ''), p.branch_name
    into v_name, v_phone, v_branch
    from public.profiles p where p.user_id = v_uid;
  select coalesce(jsonb_agg(public._goods_order_json(o, false, c.closes_at) order by o.created_at desc), '[]'::jsonb)
    into v_orders
    from (select * from public.goods_orders o
           where o.campaign = c.slug and (o.user_id = v_uid or (v_phone is not null and o.phone = v_phone))
           order by o.created_at desc
           limit 50) o;
  return jsonb_build_object('ok', true,
                            'me', jsonb_build_object('name', v_name, 'phone', v_phone, 'branch', v_branch),
                            'orders', v_orders);
end $function$;

create or replace function public.goods_order_cancel(p_order_id uuid)
returns jsonb
language plpgsql
volatile security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid   uuid := auth.uid();
  v_phone text;
  v_order public.goods_orders;
  v_close timestamptz;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  select nullif(public._goods_digits(p.phone_number), '') into v_phone
    from public.profiles p where p.user_id = v_uid;
  select * into v_order from public.goods_orders o where o.id = p_order_id for update;
  if not found or not (v_order.user_id = v_uid or (v_phone is not null and v_order.phone = v_phone)) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  select c.closes_at into v_close from public.goods_campaigns c where c.slug = v_order.campaign;
  if v_order.status <> 'applied' then
    return jsonb_build_object('ok', false, 'code', 'NOT_CANCELABLE', 'status', v_order.status);
  end if;
  if now() >= v_close then
    return jsonb_build_object('ok', false, 'code', 'CLOSED');
  end if;
  update public.goods_orders
     set status = 'canceled', canceled_at = now(), canceled_by = v_uid, cancel_reason = 'member', updated_at = now()
   where id = v_order.id
  returning * into v_order;
  return jsonb_build_object('ok', true, 'order', public._goods_order_json(v_order, false, v_close));
end $function$;

-- ── 운영진 ────────────────────────────────────────────────

create or replace function public.goods_admin_orders(p_slug text, p_branch text default null)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_scope  text := public._goods_staff_scope();
  v_filter text;
  c        public.goods_campaigns;
  v_orders jsonb;
begin
  select * into c from public.goods_campaigns where slug = p_slug;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  v_filter := case when v_scope = '*' then nullif(btrim(coalesce(p_branch, '')), '') else v_scope end;
  select coalesce(jsonb_agg(public._goods_order_json(o, true, c.closes_at) order by o.created_at desc), '[]'::jsonb)
    into v_orders
    from (select * from public.goods_orders o
           where o.campaign = c.slug and (v_filter is null or o.branch_name = v_filter)
           order by o.created_at desc
           limit 3000) o;
  return jsonb_build_object(
    'ok', true,
    'scope', jsonb_build_object('all', v_scope = '*', 'branch', case when v_scope = '*' then v_filter else v_scope end),
    'campaign', public.goods_campaign_info(p_slug),
    'orders', v_orders);
end $function$;

create or replace function public.goods_admin_update(
  p_order_id uuid,
  p_status   text default null,
  p_color    text default null,
  p_size     text default null,
  p_qty      integer default null,
  p_memo     text default null
)
returns jsonb
language plpgsql
volatile security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid   uuid := auth.uid();
  v_scope text := public._goods_staff_scope();
  v_order public.goods_orders;
  c       public.goods_campaigns;
  v_from  text;
  v_color text;
  v_size  text;
  v_qty   integer;
begin
  select * into v_order from public.goods_orders o where o.id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if v_scope <> '*' and v_order.branch_name <> v_scope then
    raise exception '그 지점 운영진만 바꿀 수 있어요' using errcode = '42501';
  end if;
  select * into c from public.goods_campaigns where slug = v_order.campaign;
  v_from := v_order.status;

  -- 색 · 사이즈 · 벌 수 (받기 전 · 취소 전만)
  if p_color is not null or p_size is not null or p_qty is not null then
    if v_from not in ('applied', 'paid') then
      return jsonb_build_object('ok', false, 'code', 'LOCKED', 'status', v_from);
    end if;
    v_color := coalesce(p_color, v_order.color);
    v_size  := coalesce(p_size, v_order.size);
    v_qty   := coalesce(p_qty, v_order.qty);
    if not exists (select 1 from jsonb_array_elements(c.colors) e where e ->> 'key' = v_color)
       or not (c.sizes ? v_size) then
      return jsonb_build_object('ok', false, 'code', 'INVALID_OPTION');
    end if;
    if v_qty < 1 or v_qty > 10 then
      return jsonb_build_object('ok', false, 'code', 'INVALID_QTY');
    end if;
    update public.goods_orders
       set color = v_color, size = v_size, qty = v_qty, amount = unit_price * v_qty, updated_at = now()
     where id = v_order.id
    returning * into v_order;
  end if;

  if p_status is not null and p_status <> v_from then
    if not ((v_from = 'applied'   and p_status in ('paid', 'canceled'))
         or (v_from = 'paid'      and p_status in ('applied', 'delivered', 'canceled'))
         or (v_from = 'delivered' and p_status = 'paid')
         or (v_from = 'canceled'  and p_status = 'applied')) then
      return jsonb_build_object('ok', false, 'code', 'BAD_STATUS', 'from', v_from, 'to', p_status);
    end if;
    update public.goods_orders
       set status       = p_status,
           paid_at      = case when p_status = 'paid' and v_from = 'applied' then now()
                               when p_status = 'applied' then null else paid_at end,
           paid_by      = case when p_status = 'paid' and v_from = 'applied' then v_uid
                               when p_status = 'applied' then null else paid_by end,
           delivered_at = case when p_status = 'delivered' then now() when p_status = 'paid' then null else delivered_at end,
           delivered_by = case when p_status = 'delivered' then v_uid when p_status = 'paid' then null else delivered_by end,
           canceled_at  = case when p_status = 'canceled' then now() when p_status = 'applied' then null else canceled_at end,
           canceled_by  = case when p_status = 'canceled' then v_uid when p_status = 'applied' then null else canceled_by end,
           cancel_reason = case when p_status = 'canceled' then 'staff' when p_status = 'applied' then null else cancel_reason end,
           updated_at   = now()
     where id = v_order.id
    returning * into v_order;
  end if;

  if p_memo is not null then
    update public.goods_orders
       set staff_memo = nullif(left(btrim(p_memo), 200), ''), updated_at = now()
     where id = v_order.id
    returning * into v_order;
  end if;

  return jsonb_build_object('ok', true, 'order', public._goods_order_json(v_order, true, c.closes_at));
end $function$;

-- ── 권한 ──────────────────────────────────────────────────

revoke all on function public._goods_digits(text) from public, anon, authenticated;
revoke all on function public._goods_staff_scope() from public, anon, authenticated;
revoke all on function public._goods_order_json(public.goods_orders, boolean, timestamptz) from public, anon, authenticated;
revoke all on function public.goods_campaign_info(text) from public;
revoke all on function public.goods_order_apply(text, text, text, integer, text, text, text, boolean, text) from public;
revoke all on function public.goods_my_page(text) from public, anon;
revoke all on function public.goods_order_cancel(uuid) from public, anon;
revoke all on function public.goods_admin_orders(text, text) from public, anon;
revoke all on function public.goods_admin_update(uuid, text, text, text, integer, text) from public, anon;

grant execute on function public.goods_campaign_info(text) to anon, authenticated, service_role;
grant execute on function public.goods_order_apply(text, text, text, integer, text, text, text, boolean, text) to anon, authenticated, service_role;
grant execute on function public.goods_my_page(text) to authenticated, service_role;
grant execute on function public.goods_order_cancel(uuid) to authenticated, service_role;
grant execute on function public.goods_admin_orders(text, text) to authenticated, service_role;
grant execute on function public.goods_admin_update(uuid, text, text, text, integer, text) to authenticated, service_role;

-- ── 첫 상품 ───────────────────────────────────────────────
-- 마감 = 11/26(목) 밤 · 사이즈는 업체 확인 전 기본값(M · L · XL · 2XL) — 바꿀 때는 이 줄을 update 한다.
insert into public.goods_campaigns (slug, title, price, colors, sizes, max_qty, closes_at)
values ('fleece-2026', '153 플리스 집업', 39000,
        '[{"key":"white","label":"흰색 인쇄"},{"key":"gray","label":"진회색 인쇄"}]'::jsonb,
        '["M","L","XL","2XL"]'::jsonb, 3, '2026-11-26 23:59:59+09')
on conflict (slug) do nothing;
