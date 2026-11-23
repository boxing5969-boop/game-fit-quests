-- 2026-11-23 마켓 주문 JSON 에 쓴 마일리지(mileage_used) — 운영진 주문함 · 회원 내 주문에 '마일리지 n점 할인' 표시용
create or replace function public._market_order_json(o market_orders, _staff boolean)
 returns jsonb
 language sql
 stable
 set search_path to 'public'
as $function$
  select jsonb_build_object(
           'id', o.id, 'order_no', o.order_no, 'product_id', o.product_id, 'product_name', o.product_name,
           'option', o.option, 'qty', o.qty, 'unit_price', o.unit_price, 'amount', o.amount,
           'mileage_used', coalesce(o.mileage_used, 0),
           'status', o.status, 'note', o.note, 'created_at', o.created_at, 'paid_at', o.paid_at,
           'ordered_at', o.ordered_at, 'arrived_at', o.arrived_at, 'delivered_at', o.delivered_at,
           'canceled_at', o.canceled_at, 'cancel_reason', o.cancel_reason
         )
      || case when _staff then jsonb_build_object(
           'member_name', o.member_name, 'branch', o.branch_name, 'staff_memo', o.staff_memo
         ) else '{}'::jsonb end
$function$;
