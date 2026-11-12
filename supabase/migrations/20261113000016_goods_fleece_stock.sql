-- 153 굿즈 · 플리스 집업 25,000원 · 원가 판매 · 선착순 50벌 (2026-11-12 23시 대표님
--   「2만5천원에 팔고 … 원가 3만5천원짜리 물건인데 연말 세일로 1만원 할인해서 2만5천원에 판매 50장 선착순 판매」)
--
-- 새 칸 2 (기존 표 · 칸은 그대로) + 함수 2개를 운영 DB 지금 정의(20261112202433_goods_preorder.sql 과 같음 — DB 어긋남 0 확인) 위에 고친다.
--   goods_campaigns.list_price   할인 전 가격(정상가). 화면이 줄을 그어 보여 준다. null = 안 보여 줌.
--                                업체가 실제로 그 값에 팔던 가격일 때만 넣는다(표시광고법 — 할인 전 가격은 실제 판매가여야 한다).
--   goods_campaigns.stock_limit  선착순 벌 수. null = 제한 없음.
--   goods_campaign_info  + list_price · stock_limit · stock_used · stock_left · sold_out (open 은 그대로 = 기간 · 켜짐만)
--   goods_order_apply    상품 줄을 잠그고(for update — 동시에 눌러도 수량을 넘지 않게) 남은 벌 수보다 많이 신청하면
--                        SOLD_OUT {left}. 2분 안 같은 신청(두 번 눌림)은 수량 검사보다 먼저 아까 것을 돌려준다.
--   세는 신청 = 결제 전 + 결제 완료 + 받음 (취소는 안 센다 — 취소하면 그 자리가 다시 난다).
--   운영진 고치기(goods_admin_update — 되돌리기 · 벌 수 고치기)는 수량을 넘어도 막지 않는다(운영진 판단). 남은 수는 0 밑으로 안 보인다.
-- 데이터: fleece-2026 → 25,000원 · 50벌 (처음 넣은 39,000원 줄일 때만 — 그 뒤 바꾼 값은 덮지 않는다).
--   정상가는 넣지 않는다 — 대표님 11/13 00시 「빼 줘」(공장 정상가 35,000원 줄은 보여 주지 않고 '원가 25,000원 그대로 · 153 이익 0원'만).

alter table public.goods_campaigns
  add column if not exists list_price integer check (list_price is null or list_price between 1000 and 1000000);
alter table public.goods_campaigns
  add column if not exists stock_limit integer check (stock_limit is null or stock_limit between 1 and 100000);

create or replace function public.goods_campaign_info(p_slug text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  c          public.goods_campaigns;
  v_branches jsonb;
  v_used     integer;
begin
  select * into c from public.goods_campaigns where slug = p_slug;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  select coalesce(jsonb_agg(b.name order by b.name), '[]'::jsonb) into v_branches
    from public.branches b
   where b.name like '153복싱짐 %'
     and (c.branches is null or b.name = any (c.branches));
  -- 선착순으로 세는 벌 수 (결제 전 + 결제 완료 + 받음)
  select coalesce(sum(o.qty), 0)::int into v_used
    from public.goods_orders o
   where o.campaign = c.slug and o.status in ('applied', 'paid', 'delivered');
  return jsonb_build_object(
    'ok', true, 'slug', c.slug, 'title', c.title, 'price', c.price, 'list_price', c.list_price,
    'colors', c.colors, 'sizes', c.sizes, 'max_qty', c.max_qty,
    'opens_at', c.opens_at, 'closes_at', c.closes_at,
    'open', (c.is_open and now() >= c.opens_at and now() < c.closes_at),
    'stock_limit', c.stock_limit,
    'stock_used', v_used,
    'stock_left', case when c.stock_limit is null then null else greatest(c.stock_limit - v_used, 0) end,
    'sold_out', (c.stock_limit is not null and v_used >= c.stock_limit),
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
  v_used    integer;
  v_order   public.goods_orders;
begin
  -- 상품 줄을 잠근다 — 신청이 한 줄로 서서 선착순 수량을 넘지 않는다
  select * into c from public.goods_campaigns where slug = p_slug for update;
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

  -- 선착순 수량 (결제 전 + 결제 완료 + 받음 — 취소는 안 센다)
  if c.stock_limit is not null then
    select coalesce(sum(o.qty), 0)::int into v_used
      from public.goods_orders o
     where o.campaign = c.slug and o.status in ('applied', 'paid', 'delivered');
    if v_used + p_qty > c.stock_limit then
      return jsonb_build_object('ok', false, 'code', 'SOLD_OUT', 'left', greatest(c.stock_limit - v_used, 0));
    end if;
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

-- 권한은 그대로(같은 이름 · 같은 인자라 replace 해도 남는다) — 한 번 더 적어 둔다
revoke all on function public.goods_campaign_info(text) from public;
revoke all on function public.goods_order_apply(text, text, text, integer, text, text, text, boolean, text) from public;
grant execute on function public.goods_campaign_info(text) to anon, authenticated, service_role;
grant execute on function public.goods_order_apply(text, text, text, integer, text, text, text, boolean, text) to anon, authenticated, service_role;

-- 첫 상품 값 — 처음 넣은 39,000원 줄일 때만 바꾼다(그 뒤 대표님이 바꾼 값은 덮지 않는다)
update public.goods_campaigns
   set price = 25000, stock_limit = 50, updated_at = now()
 where slug = 'fleece-2026' and price = 39000 and list_price is null and stock_limit is null;
