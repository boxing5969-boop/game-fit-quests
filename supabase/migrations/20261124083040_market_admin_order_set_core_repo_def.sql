-- 저장소 기록용(2026-11-24 · DB 어긋남 점검 빨간불 고치기): 20261123121514_mileage_market_rate_5pct.sql 이
-- market_admin_order_set(uuid, text, text, text) 을 _market_admin_order_set_core 로 이름만 바꿔서(alter function … rename)
-- 저장소에 그 이름의 정의가 없었다 → 점검이 「저장소에 정의가 없는 DB 함수」로 잡았다.
-- 본문은 20261117013411_market153.sql 의 원래 본문 그대로(운영 DB 본문 지문 f196527825782567f9887533abd3e731 와 같음).
-- 동작은 바뀌지 않는다(같은 본문 create or replace · 권한도 그대로 막음).
create or replace function public._market_admin_order_set_core(
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

revoke all on function public._market_admin_order_set_core(uuid, text, text, text) from public, anon, authenticated;
