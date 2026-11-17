-- 153 마켓 1단계 — 회원 용품 주문: 앱 주문 → 데스크 결제 → 발주 → 도착 알림 → 수령
--   2026-11-16 대표님 「앱에 마켓 기능도 넣어서 인터넷 최저가 보다 저렴하게 회원님들에게 복싱용품등을 판매하자」
--   2026-11-17 대표님 「골든 챔스라는 사이트에서 파는 물품을 관장님도매가로 사서 드릴거야」
--
-- 새 설정 1(app_settings 'market_pilot') · 새 표 3 · 새 함수만. 기존 표 · 함수 · 결제(payssam)는 건드리지 않는다.
-- 줄을 지우는 문장은 없다(주문 · 상품은 지우지 않고 상태 · 켜기/끄기로).
--
--   · 상품(market_products): 회원가 price · 공식몰 판매가 list_price(+ 확인한 날) · 인터넷 최저가 compare_price(+ 출처 · 확인한 날)
--     · 도매가 cost_price(대표님 · 관리자만 보고 고친다). 비교 가격은 화면이 stale_days 안에 확인한 것만 보여 준다.
--   · 주문(market_orders): applied 주문함(결제 전) → paid 결제 확인 → ordered 발주 → arrived 도착 → delivered 수령 / canceled.
--     회원은 결제 전 주문만 스스로 취소한다. 결제 · 발주 · 도착 · 수령 표시는 그 지점 운영진(_goods_staff_scope 와 같은 범위).
--   · 요청(market_wishes): 「이 용품도 넣어 주세요」 한 줄.
--   · 켠 지점(market_pilot.branches)의 승인된 회원만. 상품이 하나도 없으면 회원에게는 꺼진 것으로 보인다(운영진은 미리 본다).
--     대표님 · 관리자는 내 지점이 꺼져 있어도 켠 지점 화면을 미리 본다(preview — 주문은 못 한다).
--
-- 끄기: update public.app_settings set value = jsonb_set(value, '{branches}', '[]'::jsonb) where key = 'market_pilot';

insert into public.app_settings (key, value, updated_at)
values (
  'market_pilot',
  jsonb_build_object(
    'note', '153 마켓 1단계 (2026-11-17 · 선릉역점 시범). branches = 켠 지점(빈 배열 = 끔) · stale_days = 비교 가격(공식몰 · 인터넷 최저가)을 보여 주는 날 수(확인한 날부터) · max_open = 회원 한 명의 진행 중 주문 수 · sellers = 지점 이름마다 판매자 정보 {name 상호, owner 대표자, biz_no 사업자등록번호, address 주소, tel 전화, mail_order_no 통신판매업 신고번호}.',
    'branches', jsonb_build_array('153복싱짐 선릉역점'),
    'stale_days', 14,
    'max_open', 10,
    'sellers', '{}'::jsonb
  ),
  now()
)
on conflict (key) do nothing;

-- ───────────────────────── 표 ─────────────────────────

create table if not exists public.market_products (
  id             uuid primary key default gen_random_uuid(),
  category       text not null check (category in ('glove', 'wrap', 'guard', 'shoes', 'training', 'wear', 'etc')),
  brand          text check (brand is null or char_length(brand) between 1 and 30),
  name           text not null check (char_length(name) between 2 and 80),
  model          text check (model is null or char_length(model) between 1 and 40),
  summary        text check (summary is null or char_length(summary) between 1 and 140),
  image_path     text check (image_path is null or image_path ~ '^/market/[a-z0-9/_-]{1,80}\.(webp|jpg|png)$'),
  options        jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  option_label   text check (option_label is null or char_length(option_label) between 1 and 20),
  price          integer not null check (price between 500 and 3000000),
  list_price     integer check (list_price is null or list_price between 500 and 5000000),
  list_on        date,
  compare_price  integer check (compare_price is null or compare_price between 500 and 5000000),
  compare_source text check (compare_source is null or char_length(compare_source) between 1 and 30),
  compare_on     date,
  cost_price     integer check (cost_price is null or cost_price between 0 and 5000000),
  supplier       text not null default 'goldenchamps' check (char_length(supplier) between 1 and 30),
  supplier_ref   text check (supplier_ref is null or char_length(supplier_ref) between 1 and 120),
  max_qty        integer not null default 2 check (max_qty between 1 and 20),
  lead_note      text check (lead_note is null or char_length(lead_note) between 1 and 40),
  is_active      boolean not null default false,
  sold_out       boolean not null default false,
  sort_order     integer not null default 100 check (sort_order between 0 and 100000),
  branches       text[],
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid
);

create index if not exists market_products_show_idx on public.market_products (is_active, sort_order);

create table if not exists public.market_orders (
  id            uuid primary key default gen_random_uuid(),
  order_no      text not null unique check (order_no ~ '^M[0-9]{6}-[0-9A-F]{4}$'),
  user_id       uuid references auth.users (id) on delete set null,
  member_name   text not null check (char_length(member_name) between 1 and 40),
  branch_name   text not null,
  product_id    uuid references public.market_products (id) on delete set null,
  product_name  text not null check (char_length(product_name) between 1 and 120),
  option        text check (option is null or char_length(option) between 1 and 40),
  qty           integer not null check (qty between 1 and 20),
  unit_price    integer not null check (unit_price >= 0),
  amount        integer not null check (amount >= 0),
  status        text not null default 'applied'
                check (status in ('applied', 'paid', 'ordered', 'arrived', 'delivered', 'canceled')),
  note          text check (note is null or char_length(note) <= 100),
  staff_memo    text check (staff_memo is null or char_length(staff_memo) <= 200),
  created_at    timestamptz not null default clock_timestamp(),
  updated_at    timestamptz not null default now(),
  paid_at       timestamptz,
  paid_by       uuid,
  ordered_at    timestamptz,
  ordered_by    uuid,
  arrived_at    timestamptz,
  arrived_by    uuid,
  delivered_at  timestamptz,
  delivered_by  uuid,
  canceled_at   timestamptz,
  canceled_by   uuid,
  cancel_reason text check (cancel_reason is null or char_length(cancel_reason) <= 100)
);

create index if not exists market_orders_user_idx on public.market_orders (user_id, created_at desc);
create index if not exists market_orders_branch_idx on public.market_orders (branch_name, created_at desc);

create table if not exists public.market_wishes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete set null,
  member_name text not null check (char_length(member_name) between 1 and 40),
  branch_name text not null,
  body        text not null check (char_length(body) between 2 and 200),
  created_at  timestamptz not null default clock_timestamp()
);

create index if not exists market_wishes_branch_idx on public.market_wishes (branch_name, created_at desc);

alter table public.market_products enable row level security;
alter table public.market_orders enable row level security;
alter table public.market_wishes enable row level security;
revoke all on public.market_products from anon, authenticated;
revoke all on public.market_orders from anon, authenticated;
revoke all on public.market_wishes from anon, authenticated;

-- ───────────────────────── 안쪽 함수 ─────────────────────────

create or replace function public._market_conf()
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $$
  select coalesce((select s.value from public.app_settings s where s.key = 'market_pilot'), '{}'::jsonb)
$$;

create or replace function public._market_branch_on(_branch text)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select _branch is not null
     and exists (
       select 1
         from jsonb_array_elements_text(coalesce(public._market_conf() -> 'branches', '[]'::jsonb)) b
        where b = _branch
     )
$$;

-- 돈(도매가)을 보고 상품을 고치는 분 — 대표님 · 관리자
create or replace function public._market_is_boss(_uid uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select _uid is not null and (public.has_role(_uid, 'super_admin') or public.has_role(_uid, 'admin'))
$$;

-- 알림 — 밤 10시 ~ 아침 7시는 알림함에만. 알림이 실패해도 주문은 그대로.
create or replace function public._market_notify(_user uuid, _title text, _body text, _link text)
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

-- 새 주문을 알릴 분 — 대표님 · 관리자 + 그 지점 지점장
create or replace function public._market_staff_ids(_branch text)
returns setof uuid
language sql
stable security definer
set search_path to 'public'
as $$
  select ur.user_id
    from public.user_roles ur
   where ur.role::text in ('super_admin', 'admin')
  union
  select p.user_id
    from public.profiles p
   where p.branch_name = _branch
     and p.user_id is not null
     and public.has_role(p.user_id, 'branch_manager')
$$;

create or replace function public._market_product_json(p public.market_products, _staff boolean, _boss boolean)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select jsonb_build_object(
           'id', p.id, 'category', p.category, 'brand', p.brand, 'name', p.name, 'model', p.model,
           'summary', p.summary, 'image', p.image_path, 'options', p.options, 'option_label', p.option_label,
           'price', p.price, 'list_price', p.list_price, 'list_on', p.list_on,
           'compare_price', p.compare_price, 'compare_source', p.compare_source, 'compare_on', p.compare_on,
           'max_qty', p.max_qty, 'lead_note', p.lead_note, 'sold_out', p.sold_out
         )
      || case when _staff then jsonb_build_object(
           'active', p.is_active, 'sort', p.sort_order, 'supplier', p.supplier, 'supplier_ref', p.supplier_ref,
           'branches', to_jsonb(p.branches), 'updated_at', p.updated_at
         ) else '{}'::jsonb end
      || case when _boss then jsonb_build_object('cost', p.cost_price) else '{}'::jsonb end
$$;

create or replace function public._market_order_json(o public.market_orders, _staff boolean)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select jsonb_build_object(
           'id', o.id, 'order_no', o.order_no, 'product_id', o.product_id, 'product_name', o.product_name,
           'option', o.option, 'qty', o.qty, 'unit_price', o.unit_price, 'amount', o.amount,
           'status', o.status, 'note', o.note, 'created_at', o.created_at, 'paid_at', o.paid_at,
           'ordered_at', o.ordered_at, 'arrived_at', o.arrived_at, 'delivered_at', o.delivered_at,
           'canceled_at', o.canceled_at, 'cancel_reason', o.cancel_reason
         )
      || case when _staff then jsonb_build_object(
           'member_name', o.member_name, 'branch', o.branch_name, 'staff_memo', o.staff_memo
         ) else '{}'::jsonb end
$$;

-- ───────────────────────── 회원 ─────────────────────────

-- 마켓 첫 화면 — 상품 · 내 주문. 켠 지점의 승인된 회원이 아니면 {on:false}.
create or replace function public.market_home()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  v_uid      uuid := auth.uid();
  v_branch   text;
  v_staff    boolean;
  v_boss     boolean;
  v_preview  boolean := false;
  v_conf     jsonb := public._market_conf();
  v_products jsonb;
  v_orders   jsonb;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  if not public._is_active_member(v_uid) then
    return jsonb_build_object('on', false);
  end if;
  v_boss := public._market_is_boss(v_uid);
  select p.branch_name,
         (coalesce(p.is_staff, false) or public.has_role(v_uid, 'branch_manager') or public.has_role(v_uid, 'coach'))
    into v_branch, v_staff
    from public.profiles p
   where p.user_id = v_uid
   limit 1;
  v_staff := coalesce(v_staff, false) or v_boss;
  if not public._market_branch_on(v_branch) then
    -- 대표님 · 관리자는 내 지점이 꺼져 있어도 켠 지점(첫 번째) 화면을 미리 본다 — 주문은 그 지점 회원만
    if not v_boss then
      return jsonb_build_object('on', false);
    end if;
    select e.b into v_branch
      from jsonb_array_elements_text(coalesce(v_conf -> 'branches', '[]'::jsonb)) with ordinality as e(b, ord)
     order by e.ord
     limit 1;
    if v_branch is null then
      return jsonb_build_object('on', false);
    end if;
    v_preview := true;
  end if;

  select coalesce(jsonb_agg(public._market_product_json(p, false, false) order by p.sort_order, p.name), '[]'::jsonb)
    into v_products
    from public.market_products p
   where p.is_active
     and (p.branches is null or v_branch = any (p.branches));

  select coalesce(jsonb_agg(public._market_order_json(o, false) order by o.created_at desc), '[]'::jsonb)
    into v_orders
    from (
      select *
        from public.market_orders mo
       where mo.user_id = v_uid
         and (mo.status in ('applied', 'paid', 'ordered', 'arrived') or mo.created_at > now() - interval '120 days')
       order by mo.created_at desc
       limit 40
    ) o;

  if jsonb_array_length(v_products) = 0 and jsonb_array_length(v_orders) = 0 and not v_staff then
    return jsonb_build_object('on', false);
  end if;

  return jsonb_build_object(
    'on', true,
    'branch', v_branch,
    'staff', v_staff,
    'preview', v_preview,
    'today', to_char((now() at time zone 'Asia/Seoul')::date, 'YYYY-MM-DD'),
    'stale_days', coalesce(nullif(v_conf ->> 'stale_days', '')::int, 14),
    'max_open', coalesce(nullif(v_conf ->> 'max_open', '')::int, 10),
    'seller', v_conf -> 'sellers' -> v_branch,
    'products', v_products,
    'orders', v_orders
  );
end $$;

-- 전체 메뉴 「153 마켓」 칸 · 검색에 보일지 — market_home 의 on 과 같은 값만(상품 목록 없이 가볍게).
--   로그인 전 · 승인 전 · 켜지 않은 지점 · 상품이 아직 없는 회원 = false
create or replace function public.market_on()
returns boolean
language plpgsql
stable security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  return coalesce((public.market_home() ->> 'on')::boolean, false);
end $$;

-- 주문 넣기 — 결제 전(applied)으로 들어간다. 데스크에서 결제하면 운영진이 「결제 확인」.
create or replace function public.market_order_place(
  p_product uuid,
  p_option  text default null,
  p_qty     integer default 1,
  p_note    text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid    uuid := auth.uid();
  v_branch text;
  v_name   text;
  v_p      public.market_products;
  v_o      public.market_orders;
  v_opt    text := nullif(btrim(coalesce(p_option, '')), '');
  v_note   text := nullif(btrim(regexp_replace(coalesce(p_note, ''), '\s+', ' ', 'g')), '');
  v_max    int := coalesce(nullif(public._market_conf() ->> 'max_open', '')::int, 10);
  v_open   int;
  v_no     text;
  v_try    int := 0;
  v_staff  uuid;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  if not public._is_active_member(v_uid) then
    raise exception '승인된 회원만 주문할 수 있어요' using errcode = '42501';
  end if;
  select p.branch_name, coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '회원')
    into v_branch, v_name
    from public.profiles p
   where p.user_id = v_uid
   limit 1;
  if not public._market_branch_on(v_branch) then
    return jsonb_build_object('ok', false, 'code', 'OFF', 'message', '우리 지점 마켓은 아직 준비 중이에요');
  end if;

  -- 같은 회원의 주문은 한 줄로 (두 번 눌림 · 한도 셈)
  perform pg_advisory_xact_lock(hashtext('market:' || v_uid::text));

  select * into v_p from public.market_products p where p.id = p_product;
  if v_p.id is null or not v_p.is_active or not (v_p.branches is null or v_branch = any (v_p.branches)) then
    return jsonb_build_object('ok', false, 'code', 'NO_PRODUCT', 'message', '지금은 주문할 수 없는 상품이에요');
  end if;
  if v_p.sold_out then
    return jsonb_build_object('ok', false, 'code', 'SOLD_OUT', 'message', '지금은 품절이에요');
  end if;
  if jsonb_array_length(v_p.options) > 0 then
    if v_opt is null or not exists (select 1 from jsonb_array_elements_text(v_p.options) x where x = v_opt) then
      return jsonb_build_object('ok', false, 'code', 'OPTION',
                                'message', coalesce(v_p.option_label, '옵션') || '을(를) 골라 주세요');
    end if;
  else
    v_opt := null;
  end if;
  if p_qty is null or p_qty < 1 or p_qty > v_p.max_qty then
    return jsonb_build_object('ok', false, 'code', 'QTY',
                              'message', '한 번에 ' || v_p.max_qty || '개까지 주문할 수 있어요');
  end if;
  if v_note is not null and char_length(v_note) > 100 then
    return jsonb_build_object('ok', false, 'code', 'NOTE', 'message', '메모는 100자까지 쓸 수 있어요');
  end if;

  -- 두 번 눌림: 2분 안 같은 상품 · 옵션 · 수량의 결제 전 주문은 그 주문을 돌려준다
  select * into v_o
    from public.market_orders o
   where o.user_id = v_uid and o.product_id = v_p.id and o.option is not distinct from v_opt
     and o.qty = p_qty and o.status = 'applied' and o.created_at > now() - interval '2 minutes'
   order by o.created_at desc
   limit 1;
  if v_o.id is not null then
    return jsonb_build_object('ok', true, 'again', true, 'order', public._market_order_json(v_o, false));
  end if;

  select count(*) into v_open
    from public.market_orders o
   where o.user_id = v_uid and o.status in ('applied', 'paid', 'ordered', 'arrived');
  if v_open >= v_max then
    return jsonb_build_object('ok', false, 'code', 'LIMIT',
                              'message', '진행 중인 주문이 ' || v_max || '건이에요. 받은 뒤에 다시 주문해 주세요');
  end if;

  loop
    v_try := v_try + 1;
    v_no := 'M' || to_char(now() at time zone 'Asia/Seoul', 'YYMMDD') || '-'
            || upper(substr(md5(gen_random_uuid()::text), 1, 4));
    begin
      insert into public.market_orders
        (order_no, user_id, member_name, branch_name, product_id, product_name, option, qty, unit_price, amount, note)
      values
        (v_no, v_uid, left(v_name, 40), v_branch, v_p.id, left(concat_ws(' ', v_p.brand, v_p.name), 120),
         v_opt, p_qty, v_p.price, v_p.price * p_qty, v_note)
      returning * into v_o;
      exit;
    exception when unique_violation then
      if v_try >= 5 then raise; end if;
    end;
  end loop;

  for v_staff in select public._market_staff_ids(v_branch) loop
    if v_staff is distinct from v_uid then
      perform public._market_notify(
        v_staff,
        '마켓 새 주문 · ' || v_name,
        v_o.product_name || coalesce(' · ' || v_opt, '') || ' × ' || p_qty || ' · '
          || to_char(v_o.amount, 'FM999,999,999') || '원 — 데스크 결제를 기다려요',
        '/manager?tab=market'
      );
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'order', public._market_order_json(v_o, false));
end $$;

-- 내 주문 취소 — 결제 전에만
create or replace function public.market_order_cancel(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_o   public.market_orders;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  select * into v_o from public.market_orders o where o.id = p_id and o.user_id = v_uid for update;
  if v_o.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', '주문을 찾을 수 없어요');
  end if;
  if v_o.status = 'canceled' then
    return jsonb_build_object('ok', true, 'order', public._market_order_json(v_o, false));
  end if;
  if v_o.status <> 'applied' then
    return jsonb_build_object('ok', false, 'code', 'LOCKED', 'message', '결제한 주문은 데스크에서 취소해 주세요');
  end if;
  update public.market_orders
     set status = 'canceled', canceled_at = now(), canceled_by = v_uid, cancel_reason = '회원 취소', updated_at = now()
   where id = v_o.id
  returning * into v_o;
  return jsonb_build_object('ok', true, 'order', public._market_order_json(v_o, false));
end $$;

-- 「이 용품도 넣어 주세요」 — 하루 5개
create or replace function public.market_wish_add(p_text text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid    uuid := auth.uid();
  v_branch text;
  v_name   text;
  v_text   text := btrim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g'));
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  if not public._is_active_member(v_uid) then
    raise exception '승인된 회원만 보낼 수 있어요' using errcode = '42501';
  end if;
  select p.branch_name, coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '회원')
    into v_branch, v_name
    from public.profiles p
   where p.user_id = v_uid
   limit 1;
  if not public._market_branch_on(v_branch) then
    return jsonb_build_object('ok', false, 'code', 'OFF', 'message', '우리 지점 마켓은 아직 준비 중이에요');
  end if;
  if char_length(v_text) < 2 then
    return jsonb_build_object('ok', false, 'code', 'SHORT', 'message', '찾는 용품을 적어 주세요');
  end if;
  if char_length(v_text) > 200 then
    return jsonb_build_object('ok', false, 'code', 'LONG', 'message', '200자까지 쓸 수 있어요');
  end if;
  if (select count(*) from public.market_wishes w
       where w.user_id = v_uid and w.created_at > now() - interval '1 day') >= 5 then
    return jsonb_build_object('ok', false, 'code', 'LIMIT', 'message', '오늘은 여기까지 보낼 수 있어요');
  end if;
  insert into public.market_wishes (user_id, member_name, branch_name, body)
  values (v_uid, left(v_name, 40), v_branch, v_text);
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────── 운영진 ─────────────────────────

-- 주문함 · 상품 · 요청 — 대표님 · 관리자 = 전 지점(p_branch 로 고르기) · 지점 운영진 = 자기 지점
create or replace function public.market_admin_board(p_branch text default null)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  v_uid      uuid := auth.uid();
  v_scope    text := public._goods_staff_scope();
  v_boss     boolean := public._market_is_boss(v_uid);
  v_conf     jsonb := public._market_conf();
  v_branch   text;
  v_orders   jsonb;
  v_products jsonb;
  v_wishes   jsonb;
begin
  if v_scope = '*' then
    v_branch := nullif(btrim(coalesce(p_branch, '')), '');
  else
    v_branch := v_scope;
    if not public._market_branch_on(v_branch) then
      return jsonb_build_object('on', false);
    end if;
  end if;

  select coalesce(jsonb_agg(public._market_order_json(o, true) order by o.created_at desc), '[]'::jsonb)
    into v_orders
    from (
      select *
        from public.market_orders mo
       where (v_branch is null or mo.branch_name = v_branch)
         and (mo.status in ('applied', 'paid', 'ordered', 'arrived') or mo.created_at > now() - interval '90 days')
       order by mo.created_at desc
       limit 300
    ) o;

  select coalesce(jsonb_agg(public._market_product_json(p, true, v_boss) order by p.sort_order, p.name), '[]'::jsonb)
    into v_products
    from public.market_products p
   where v_branch is null or p.branches is null or v_branch = any (p.branches);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', w.id, 'body', w.body, 'member_name', w.member_name, 'branch', w.branch_name, 'created_at', w.created_at
         ) order by w.created_at desc), '[]'::jsonb)
    into v_wishes
    from (
      select *
        from public.market_wishes mw
       where (v_branch is null or mw.branch_name = v_branch)
         and mw.created_at > now() - interval '60 days'
       order by mw.created_at desc
       limit 50
    ) w;

  return jsonb_build_object(
    'on', true,
    'scope', case when v_scope = '*' then 'all' else 'branch' end,
    'branch', v_branch,
    'branches', coalesce(v_conf -> 'branches', '[]'::jsonb),
    'boss', v_boss,
    'today', to_char((now() at time zone 'Asia/Seoul')::date, 'YYYY-MM-DD'),
    'stale_days', coalesce(nullif(v_conf ->> 'stale_days', '')::int, 14),
    'orders', v_orders,
    'products', v_products,
    'wishes', v_wishes
  );
end $$;

-- 주문 상태 바꾸기 · 메모 — 회원에게 알리는 것은 결제 확인 · 도착 · 운영진 취소 셋뿐
create or replace function public.market_admin_order_set(
  p_id     uuid,
  p_status text default null,
  p_memo   text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid    uuid := auth.uid();
  v_scope  text := public._goods_staff_scope();
  v_o      public.market_orders;
  v_from   text;
  v_reason text := nullif(left(btrim(coalesce(p_reason, '')), 100), '');
begin
  select * into v_o from public.market_orders o where o.id = p_id for update;
  if v_o.id is null or (v_scope <> '*' and v_o.branch_name <> v_scope) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', '주문을 찾을 수 없어요');
  end if;
  v_from := v_o.status;

  if p_memo is not null then
    update public.market_orders
       set staff_memo = nullif(left(btrim(p_memo), 200), ''), updated_at = now()
     where id = v_o.id
    returning * into v_o;
  end if;

  if p_status is null or p_status = v_from then
    return jsonb_build_object('ok', true, 'order', public._market_order_json(v_o, true));
  end if;

  -- 앞으로 한 칸 · 뒤로 한 칸(잘못 눌렀을 때) · 어느 단계에서든 취소(결제 뒤 취소 = 환불 · 반품) · 취소 되돌리기 = 결제 전으로
  if not ((v_from = 'applied'   and p_status in ('paid', 'canceled'))
       or (v_from = 'paid'      and p_status in ('ordered', 'applied', 'canceled'))
       or (v_from = 'ordered'   and p_status in ('arrived', 'paid', 'canceled'))
       or (v_from = 'arrived'   and p_status in ('delivered', 'ordered', 'canceled'))
       or (v_from = 'delivered' and p_status in ('arrived', 'canceled'))
       or (v_from = 'canceled'  and p_status = 'applied')) then
    return jsonb_build_object('ok', false, 'code', 'BAD_STEP', 'message', '지금 상태에서는 그렇게 바꿀 수 없어요');
  end if;

  update public.market_orders
     set status       = p_status,
         updated_at   = now(),
         paid_at      = case when p_status = 'applied' then null
                             when p_status = 'paid' and v_from = 'applied' then now() else paid_at end,
         paid_by      = case when p_status = 'applied' then null
                             when p_status = 'paid' and v_from = 'applied' then v_uid else paid_by end,
         ordered_at   = case when p_status in ('applied', 'paid') then null
                             when p_status = 'ordered' and v_from = 'paid' then now() else ordered_at end,
         ordered_by   = case when p_status in ('applied', 'paid') then null
                             when p_status = 'ordered' and v_from = 'paid' then v_uid else ordered_by end,
         arrived_at   = case when p_status in ('applied', 'paid', 'ordered') then null
                             when p_status = 'arrived' and v_from = 'ordered' then now() else arrived_at end,
         arrived_by   = case when p_status in ('applied', 'paid', 'ordered') then null
                             when p_status = 'arrived' and v_from = 'ordered' then v_uid else arrived_by end,
         delivered_at = case when p_status = 'delivered' then now()
                             when p_status = 'canceled' then delivered_at else null end,
         delivered_by = case when p_status = 'delivered' then v_uid
                             when p_status = 'canceled' then delivered_by else null end,
         canceled_at  = case when p_status = 'canceled' then now() else null end,
         canceled_by  = case when p_status = 'canceled' then v_uid else null end,
         cancel_reason = case when p_status = 'canceled'
                              then coalesce(v_reason, case when v_from = 'applied' then '운영진 취소' else '취소 · 환불' end)
                              else null end
   where id = v_o.id
  returning * into v_o;

  if v_o.user_id is not null and v_o.user_id is distinct from v_uid then
    if p_status = 'paid' and v_from = 'applied' then
      perform public._market_notify(v_o.user_id, '마켓 결제가 확인됐어요',
        v_o.product_name || coalesce(' · ' || v_o.option, '') || ' — 주문을 넣을게요. 도착하면 알려 드려요',
        '/market?orders=1');
    elsif p_status = 'arrived' and v_from = 'ordered' then
      perform public._market_notify(v_o.user_id, '주문한 용품이 도착했어요',
        v_o.product_name || coalesce(' · ' || v_o.option, '') || ' — 데스크에서 받아 가세요',
        '/market?orders=1');
    elsif p_status = 'canceled' then
      perform public._market_notify(v_o.user_id, '마켓 주문이 취소됐어요',
        v_o.product_name || coalesce(' · ' || v_o.option, '') || ' · ' || v_o.cancel_reason,
        '/market?orders=1');
    end if;
  end if;

  return jsonb_build_object('ok', true, 'order', public._market_order_json(v_o, true));
end $$;

-- 상품 넣기 · 고치기 — 대표님 · 관리자만. 보낸 칸만 바꾼다.
create or replace function public.market_admin_product_save(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid  uuid := auth.uid();
  v_id   uuid;
  v_p    public.market_products;
  v_opts jsonb;
  t      text;
begin
  if v_uid is null or not public._market_is_boss(v_uid) then
    raise exception '상품은 대표님 · 관리자만 고칠 수 있어요' using errcode = '42501';
  end if;
  if p is null or jsonb_typeof(p) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'INVALID', 'message', '값을 다시 확인해 주세요');
  end if;

  if p ? 'options' then
    v_opts := p -> 'options';
    if jsonb_typeof(v_opts) <> 'array' or jsonb_array_length(v_opts) > 40
       or exists (select 1 from jsonb_array_elements(v_opts) x
                   where jsonb_typeof(x) <> 'string' or char_length(btrim(x #>> '{}')) not between 1 and 40) then
      return jsonb_build_object('ok', false, 'code', 'OPTIONS', 'message', '옵션은 40개 · 한 줄 40자까지예요');
    end if;
    select coalesce(jsonb_agg(v order by ord), '[]'::jsonb) into v_opts
      from (select btrim(x #>> '{}') as v, min(ord) as ord
              from jsonb_array_elements(v_opts) with ordinality as e(x, ord)
             group by 1) s;
  end if;

  begin
    v_id := nullif(p ->> 'id', '')::uuid;
    if v_id is null then
      insert into public.market_products
        (category, brand, name, model, summary, image_path, options, option_label, price, list_price, list_on,
         compare_price, compare_source, compare_on, cost_price, supplier, supplier_ref, max_qty, lead_note,
         is_active, sold_out, sort_order, branches, updated_by)
      values
        (coalesce(p ->> 'category', 'etc'),
         nullif(btrim(coalesce(p ->> 'brand', '')), ''),
         btrim(coalesce(p ->> 'name', '')),
         nullif(btrim(coalesce(p ->> 'model', '')), ''),
         nullif(btrim(coalesce(p ->> 'summary', '')), ''),
         nullif(btrim(coalesce(p ->> 'image', '')), ''),
         coalesce(v_opts, '[]'::jsonb),
         nullif(btrim(coalesce(p ->> 'option_label', '')), ''),
         nullif(p ->> 'price', '')::int,
         nullif(p ->> 'list_price', '')::int,
         nullif(p ->> 'list_on', '')::date,
         nullif(p ->> 'compare_price', '')::int,
         nullif(btrim(coalesce(p ->> 'compare_source', '')), ''),
         nullif(p ->> 'compare_on', '')::date,
         nullif(p ->> 'cost', '')::int,
         coalesce(nullif(btrim(coalesce(p ->> 'supplier', '')), ''), 'goldenchamps'),
         nullif(btrim(coalesce(p ->> 'supplier_ref', '')), ''),
         coalesce(nullif(p ->> 'max_qty', '')::int, 2),
         nullif(btrim(coalesce(p ->> 'lead_note', '')), ''),
         coalesce((p ->> 'active')::boolean, false),
         coalesce((p ->> 'sold_out')::boolean, false),
         coalesce(nullif(p ->> 'sort', '')::int, 100),
         case when p ? 'branches' and jsonb_typeof(p -> 'branches') = 'array' and jsonb_array_length(p -> 'branches') > 0
              then array(select jsonb_array_elements_text(p -> 'branches')) end,
         v_uid)
      returning * into v_p;
    else
      update public.market_products m
         set category       = case when p ? 'category' then p ->> 'category' else m.category end,
             brand          = case when p ? 'brand' then nullif(btrim(coalesce(p ->> 'brand', '')), '') else m.brand end,
             name           = case when p ? 'name' then btrim(coalesce(p ->> 'name', '')) else m.name end,
             model          = case when p ? 'model' then nullif(btrim(coalesce(p ->> 'model', '')), '') else m.model end,
             summary        = case when p ? 'summary' then nullif(btrim(coalesce(p ->> 'summary', '')), '') else m.summary end,
             image_path     = case when p ? 'image' then nullif(btrim(coalesce(p ->> 'image', '')), '') else m.image_path end,
             options        = case when p ? 'options' then v_opts else m.options end,
             option_label   = case when p ? 'option_label' then nullif(btrim(coalesce(p ->> 'option_label', '')), '') else m.option_label end,
             price          = case when p ? 'price' then nullif(p ->> 'price', '')::int else m.price end,
             list_price     = case when p ? 'list_price' then nullif(p ->> 'list_price', '')::int else m.list_price end,
             list_on        = case when p ? 'list_on' then nullif(p ->> 'list_on', '')::date else m.list_on end,
             compare_price  = case when p ? 'compare_price' then nullif(p ->> 'compare_price', '')::int else m.compare_price end,
             compare_source = case when p ? 'compare_source' then nullif(btrim(coalesce(p ->> 'compare_source', '')), '') else m.compare_source end,
             compare_on     = case when p ? 'compare_on' then nullif(p ->> 'compare_on', '')::date else m.compare_on end,
             cost_price     = case when p ? 'cost' then nullif(p ->> 'cost', '')::int else m.cost_price end,
             supplier       = case when p ? 'supplier' then coalesce(nullif(btrim(coalesce(p ->> 'supplier', '')), ''), m.supplier) else m.supplier end,
             supplier_ref   = case when p ? 'supplier_ref' then nullif(btrim(coalesce(p ->> 'supplier_ref', '')), '') else m.supplier_ref end,
             max_qty        = case when p ? 'max_qty' then coalesce(nullif(p ->> 'max_qty', '')::int, m.max_qty) else m.max_qty end,
             lead_note      = case when p ? 'lead_note' then nullif(btrim(coalesce(p ->> 'lead_note', '')), '') else m.lead_note end,
             is_active      = case when p ? 'active' then coalesce((p ->> 'active')::boolean, m.is_active) else m.is_active end,
             sold_out       = case when p ? 'sold_out' then coalesce((p ->> 'sold_out')::boolean, m.sold_out) else m.sold_out end,
             sort_order     = case when p ? 'sort' then coalesce(nullif(p ->> 'sort', '')::int, m.sort_order) else m.sort_order end,
             branches       = case when p ? 'branches' then
                                case when jsonb_typeof(p -> 'branches') = 'array' and jsonb_array_length(p -> 'branches') > 0
                                     then array(select jsonb_array_elements_text(p -> 'branches')) end
                              else m.branches end,
             updated_at     = now(),
             updated_by     = v_uid
       where m.id = v_id
      returning * into v_p;
      if v_p.id is null then
        return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', '상품을 찾을 수 없어요');
      end if;
    end if;
  exception
    when check_violation or not_null_violation or invalid_text_representation
      or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range then
      get stacked diagnostics t = constraint_name;
      return jsonb_build_object('ok', false, 'code', 'INVALID',
                                'message', '값을 다시 확인해 주세요' || coalesce(' (' || nullif(t, '') || ')', ''));
  end;

  return jsonb_build_object('ok', true, 'product', public._market_product_json(v_p, true, true));
end $$;

-- ───────────────────────── 권한 ─────────────────────────

revoke all on function public._market_conf() from public, anon, authenticated;
revoke all on function public._market_branch_on(text) from public, anon, authenticated;
revoke all on function public._market_is_boss(uuid) from public, anon, authenticated;
revoke all on function public._market_notify(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public._market_staff_ids(text) from public, anon, authenticated;
revoke all on function public._market_product_json(public.market_products, boolean, boolean) from public, anon, authenticated;
revoke all on function public._market_order_json(public.market_orders, boolean) from public, anon, authenticated;

revoke all on function public.market_home() from public, anon;
revoke all on function public.market_on() from public, anon;
revoke all on function public.market_order_place(uuid, text, integer, text) from public, anon;
revoke all on function public.market_order_cancel(uuid) from public, anon;
revoke all on function public.market_wish_add(text) from public, anon;
revoke all on function public.market_admin_board(text) from public, anon;
revoke all on function public.market_admin_order_set(uuid, text, text, text) from public, anon;
revoke all on function public.market_admin_product_save(jsonb) from public, anon;

grant execute on function public.market_home() to authenticated;
grant execute on function public.market_on() to authenticated;
grant execute on function public.market_order_place(uuid, text, integer, text) to authenticated;
grant execute on function public.market_order_cancel(uuid) to authenticated;
grant execute on function public.market_wish_add(text) to authenticated;
grant execute on function public.market_admin_board(text) to authenticated;
grant execute on function public.market_admin_order_set(uuid, text, text, text) to authenticated;
grant execute on function public.market_admin_product_save(jsonb) to authenticated;
