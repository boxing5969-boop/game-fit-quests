-- 153 마일리지 결제 할인 (2026-10-15 대표님: "153 마일리지는 결제할 때 할인받을 수 있도록")
--   규칙(대표님 확정 = 추천안): 1점 = 1원 · 한 번 결제에 결제 금액의 10%까지 · 1,000점 단위
--   · 앱 결제(결제선생): payssam-create-bill 이 use_mileage 를 받아 mileage_max_use 로 검사 → 청구 금액에서 뺀다.
--     실제 차감은 결제 완료(status → paid) 때 이 파일의 트리거가 한다. 결제 취소(paid → canceled)면 돌려준다.
--     결제창만 열고 안 낸 주문은 아무것도 빠지지 않는다.
--   · 데스크 결제: 지점장(같은 지점)·전체관리자가 회원 상세에서 admin_use_mileage 로 차감 (결제 금액 입력 → 10% 검사)
--   · 원장(mileage_ledger) kind 는 'adjust' 를 쓰고, 사유 글로 구분한다 (기존 kind 제약 그대로)
--   · 1년 소멸은 첫 소멸 대상이 2027-09 라 그 전에 따로 넣는다

alter table public.payment_orders add column if not exists mileage_used integer not null default 0;
alter table public.payment_orders add column if not exists list_price bigint;

create or replace function public.mileage_balance(_uid uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0)::integer from public.mileage_ledger where user_id = _uid
$$;
revoke all on function public.mileage_balance(uuid) from public, anon, authenticated;

-- 이번 결제에 쓸 수 있는 최대 점수 = min(보유, 결제 금액의 10%) 를 1,000 단위로 내림
create or replace function public.mileage_max_use(_uid uuid, _price bigint)
returns integer language sql stable security definer set search_path = public as $$
  select greatest(0, least(
           (floor(greatest(public.mileage_balance(_uid), 0) / 1000.0) * 1000)::bigint,
           (floor(coalesce(_price, 0) * 0.10 / 1000.0) * 1000)::bigint
         ))::integer
$$;
revoke all on function public.mileage_max_use(uuid, bigint) from public, anon, authenticated;

-- 앱 결제 완료 → 차감 / 완료된 결제 취소 → 돌려주기 (중복 없이 한 번씩)
create or replace function public.payment_orders_mileage_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.mileage_used, 0) <= 0 then return new; end if;
  if new.status = 'paid' and old.status is distinct from 'paid' then
    insert into public.mileage_ledger (user_id, amount, kind, reason, idem_key, ref_id)
    values (new.user_id, -new.mileage_used, 'adjust',
            '결제 할인 사용 · ' || coalesce(new.product_name, '수강권'), 'order-use:' || new.id, new.id)
    on conflict (idem_key) do nothing;
  elsif new.status = 'canceled' and old.status = 'paid' then
    insert into public.mileage_ledger (user_id, amount, kind, reason, idem_key, ref_id)
    values (new.user_id, new.mileage_used, 'adjust',
            '결제 취소로 돌려받음 · ' || coalesce(new.product_name, '수강권'), 'order-refund:' || new.id, new.id)
    on conflict (idem_key) do nothing;
  end if;
  return new;
end $$;

do $$ begin
  create trigger payment_orders_mileage
    after update of status on public.payment_orders
    for each row execute function public.payment_orders_mileage_trg();
exception when duplicate_object then null;
end $$;

-- 회원: 결제 화면에서 보유·이번 상품 최대 사용 점수
create or replace function public.get_mileage_quote(p_product_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_price bigint;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  select price into v_price from public.membership_products where id = p_product_id and is_active;
  return jsonb_build_object(
    'balance', public.mileage_balance(v_uid),
    'max_use', case when v_price is null then 0 else public.mileage_max_use(v_uid, v_price) end,
    'price', v_price
  );
end $$;
revoke all on function public.get_mileage_quote(uuid) from public, anon;
grant execute on function public.get_mileage_quote(uuid) to authenticated;

-- 관리자: 회원 마일리지 보기 (지점장 = 같은 지점, 전체관리자 = 전부)
create or replace function public.get_member_mileage(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not (public.has_role(auth.uid(), 'super_admin') or public.is_same_branch(p_user_id)) then
    raise exception '지점장·전체관리자만 볼 수 있어요';
  end if;
  return jsonb_build_object(
    'balance', public.mileage_balance(p_user_id),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('amount', x.amount, 'reason', x.reason, 'at', x.created_at) order by x.created_at desc)
        from (select amount, reason, created_at from public.mileage_ledger
               where user_id = p_user_id order by created_at desc limit 20) x), '[]'::jsonb)
  );
end $$;
revoke all on function public.get_member_mileage(uuid) from public, anon;
grant execute on function public.get_member_mileage(uuid) to authenticated;

-- 관리자: 데스크 결제 때 마일리지 차감
create or replace function public.admin_use_mileage(p_user_id uuid, p_amount integer, p_payment_amount bigint, p_memo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_max integer;
  v_by text;
begin
  if auth.uid() is null or not (public.has_role(auth.uid(), 'super_admin') or public.is_same_branch(p_user_id)) then
    raise exception '지점장·전체관리자만 쓸 수 있어요';
  end if;
  if coalesce(p_amount, 0) <= 0 or p_amount % 1000 <> 0 then
    raise exception '1,000점 단위로 입력해 주세요';
  end if;
  if coalesce(p_payment_amount, 0) <= 0 then
    raise exception '결제 금액을 입력해 주세요';
  end if;
  v_max := public.mileage_max_use(p_user_id, p_payment_amount);
  if p_amount > v_max then
    raise exception '이번 결제에는 최대 %점까지 쓸 수 있어요 (보유 점수와 결제 금액의 10%% 중 작은 쪽)', v_max;
  end if;
  select coalesce(nullif(btrim(name), ''), nullif(btrim(nickname), ''), '관리자') into v_by from public.profiles where user_id = auth.uid();
  insert into public.mileage_ledger (user_id, amount, kind, reason, idem_key, ref_id)
  values (p_user_id, -p_amount, 'adjust',
          '데스크 결제 할인 사용 · 결제 ' || to_char(p_payment_amount, 'FM999,999,999') || '원'
            || coalesce(' · ' || nullif(btrim(p_memo), ''), '') || ' · ' || coalesce(v_by, '관리자'),
          'desk:' || gen_random_uuid(), null);
  return jsonb_build_object('success', true, 'balance', public.mileage_balance(p_user_id));
end $$;
revoke all on function public.admin_use_mileage(uuid, integer, bigint, text) from public, anon;
grant execute on function public.admin_use_mileage(uuid, integer, bigint, text) to authenticated;
