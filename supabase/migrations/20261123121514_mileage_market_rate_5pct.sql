
-- 2026-11-23 대표 결정: 153마켓 용품은 체육관 도매가라 마일리지 할인 5%까지, 수강료·운동복·락카는 기존대로 10%

create or replace function public.mileage_rate(_kind text)
returns numeric language sql immutable set search_path to 'public' as $$
  select case when lower(coalesce(_kind, '')) in ('market', 'goods') then 0.05 else 0.10 end::numeric
$$;

create or replace function public.mileage_max_use_rate(_uid uuid, _price bigint, _rate numeric)
returns integer language sql stable security definer set search_path to 'public' as $$
  select greatest(0, least(
           (floor(greatest(public.mileage_balance(_uid), 0) / 1000.0) * 1000)::bigint,
           (floor(coalesce(_price, 0) * least(greatest(coalesce(_rate, 0.10), 0), 0.10) / 1000.0) * 1000)::bigint
         ))::integer
$$;
revoke all on function public.mileage_max_use_rate(uuid, bigint, numeric) from public, anon, authenticated;

-- 데스크 결제 할인: 무엇을 결제하는지(p_kind)에 따라 한도가 다름
drop function if exists public.admin_use_mileage(uuid, integer, bigint, text);
create function public.admin_use_mileage(p_user_id uuid, p_amount integer, p_payment_amount bigint,
                                         p_memo text default null, p_kind text default 'membership')
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  v_rate numeric := public.mileage_rate(p_kind);
  v_max integer;
  v_by text;
  v_label text := case when v_rate < 0.10 then '153마켓 용품' else '수강료·운동복·락카' end;
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
  v_max := public.mileage_max_use_rate(p_user_id, p_payment_amount, v_rate);
  if p_amount > v_max then
    raise exception '% 결제에는 최대 %점까지 쓸 수 있어요 (보유 점수와 결제 금액의 %%% 중 작은 쪽)',
      v_label, v_max, (v_rate * 100)::int;
  end if;
  select coalesce(nullif(btrim(name), ''), nullif(btrim(nickname), ''), '관리자') into v_by from public.profiles where user_id = auth.uid();
  insert into public.mileage_ledger (user_id, amount, kind, reason, idem_key, ref_id)
  values (p_user_id, -p_amount, 'adjust',
          '데스크 결제 할인 사용 · ' || v_label || ' · 결제 ' || to_char(p_payment_amount, 'FM999,999,999') || '원'
            || coalesce(' · ' || nullif(btrim(p_memo), ''), '') || ' · ' || coalesce(v_by, '관리자'),
          'desk:' || gen_random_uuid(), null);
  return jsonb_build_object('success', true, 'balance', public.mileage_balance(p_user_id),
                            'rate', v_rate, 'max_use', v_max);
end $function$;
revoke all on function public.admin_use_mileage(uuid, integer, bigint, text, text) from public, anon;
grant execute on function public.admin_use_mileage(uuid, integer, bigint, text, text) to authenticated, service_role;

-- 마켓 주문 결제 확인 때 마일리지(주문 금액의 5%까지) 같이 쓰기 · 취소/되돌리기 땐 돌려 드림
alter table public.market_orders add column if not exists mileage_used integer not null default 0;

alter function public.market_admin_order_set(uuid, text, text, text) rename to _market_admin_order_set_core;
revoke all on function public._market_admin_order_set_core(uuid, text, text, text) from public, anon, authenticated;

create function public.market_admin_order_set(p_id uuid, p_status text default null, p_memo text default null,
                                              p_reason text default null, p_mileage integer default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  v_scope text := public._goods_staff_scope();
  v_o     public.market_orders;
  v_from  text;
  v_m     integer := coalesce(p_mileage, 0);
  v_max   integer;
  v_res   jsonb;
begin
  select * into v_o from public.market_orders o where o.id = p_id for update;
  if v_o.id is null or (v_scope <> '*' and v_o.branch_name <> v_scope) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', '주문을 찾을 수 없어요');
  end if;
  v_from := v_o.status;

  if v_m <> 0 then
    if not (v_from = 'applied' and p_status = 'paid') then
      return jsonb_build_object('ok', false, 'code', 'MILEAGE_STEP', 'message', '마일리지는 결제 확인할 때만 쓸 수 있어요');
    end if;
    if v_o.user_id is null then
      return jsonb_build_object('ok', false, 'code', 'MILEAGE_NO_MEMBER', 'message', '앱 회원 주문만 마일리지를 쓸 수 있어요');
    end if;
    if v_m < 0 or v_m % 1000 <> 0 then
      return jsonb_build_object('ok', false, 'code', 'MILEAGE_UNIT', 'message', '1,000점 단위로 입력해 주세요');
    end if;
    v_max := public.mileage_max_use_rate(v_o.user_id, v_o.amount, public.mileage_rate('market'));
    if v_m > v_max then
      return jsonb_build_object('ok', false, 'code', 'MILEAGE_MAX', 'max_use', v_max,
        'message', '153마켓 용품은 결제 금액의 5%까지 쓸 수 있어요 · 이번 주문은 최대 '
                   || to_char(v_max, 'FM999,999,999') || '점');
    end if;
  end if;

  v_res := public._market_admin_order_set_core(p_id, p_status, p_memo, p_reason);
  if not coalesce((v_res ->> 'ok')::boolean, false) then
    return v_res;
  end if;

  select * into v_o from public.market_orders o where o.id = p_id;

  if v_m > 0 and v_from = 'applied' and v_o.status = 'paid' then
    insert into public.mileage_ledger (user_id, amount, kind, reason, idem_key, ref_id)
    values (v_o.user_id, -v_m, 'adjust',
            '153마켓 결제 할인 사용 · ' || v_o.order_no || ' · 결제 ' || to_char(v_o.amount, 'FM999,999,999') || '원',
            'market-use:' || v_o.id || ':' || gen_random_uuid(), null);
    update public.market_orders set mileage_used = v_m where id = v_o.id returning * into v_o;
  elsif v_o.mileage_used > 0 and v_o.status in ('applied', 'canceled') and v_from <> v_o.status then
    insert into public.mileage_ledger (user_id, amount, kind, reason, idem_key, ref_id)
    values (v_o.user_id, v_o.mileage_used, 'adjust',
            '153마켓 ' || case when v_o.status = 'canceled' then '주문 취소' else '결제 되돌리기' end
              || ' · 마일리지 돌려 드림 · ' || v_o.order_no,
            'market-back:' || v_o.id || ':' || gen_random_uuid(), null);
    update public.market_orders set mileage_used = 0 where id = v_o.id returning * into v_o;
  end if;

  return v_res || jsonb_build_object('mileage_used', v_o.mileage_used,
                                     'pay_amount', v_o.amount - v_o.mileage_used);
end $function$;
revoke all on function public.market_admin_order_set(uuid, text, text, text, integer) from public, anon;
grant execute on function public.market_admin_order_set(uuid, text, text, text, integer) to authenticated, service_role;

-- 회원 마켓 화면에 할인 한도 안내용
create or replace function public.market_mileage_info(p_amount bigint default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  return jsonb_build_object('rate', public.mileage_rate('market'),
                            'balance', public.mileage_balance(v_uid),
                            'max_use', case when p_amount is null then null
                                            else public.mileage_max_use_rate(v_uid, p_amount, public.mileage_rate('market')) end);
end $$;
revoke all on function public.market_mileage_info(bigint) from public, anon;
grant execute on function public.market_mileage_info(bigint) to authenticated, service_role;
