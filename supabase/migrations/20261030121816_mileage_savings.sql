-- 마일리지로 아낀 금액 (2026-10-30 대표님: "배달의 민족이나 플랫폼들도 구독 요금제 쓰는 회원님들에게 지금까지 총 얼마를 할인받았는지
--   보여 주잖아 — 시각적으로 마일리지 할인을 받은 회원님들은 얼마를 할인받았는지 보여 줘")
--   · 정본 = mileage_ledger: 앱 결제 할인 'order-use:<주문>'(취소되면 'order-refund:<주문>' 이 돌려준다 → 그 주문은 빼기)
--     + 데스크 결제 할인 'desk:<…>'(admin_use_mileage). 1점 = 1원.
--   · 본인 것만. 새 함수 1 — 기존 함수는 바꾸지 않는다.

create or replace function public.get_my_mileage_savings()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with l as (
    select amount, idem_key, created_at
      from public.mileage_ledger
     where user_id = auth.uid()
       and (idem_key like 'order-use:%' or idem_key like 'order-refund:%' or idem_key like 'desk:%')
  ),
  refunded as (
    select substr(idem_key, 14) as order_id from l where idem_key like 'order-refund:%'
  ),
  uses as (
    select -amount as amt, created_at, case when idem_key like 'desk:%' then 'desk' else 'app' end as via
      from l
     where amount < 0
       and (idem_key like 'desk:%'
            or (idem_key like 'order-use:%' and substr(idem_key, 11) not in (select order_id from refunded)))
  )
  select jsonb_build_object(
    'total', coalesce(sum(amt), 0),
    'count', count(*),
    'app', coalesce(sum(amt) filter (where via = 'app'), 0),
    'desk', coalesce(sum(amt) filter (where via = 'desk'), 0),
    'first_at', min(created_at),
    'last_at', max(created_at)
  )
  from uses;
$$;

revoke all on function public.get_my_mileage_savings() from public, anon;
grant execute on function public.get_my_mileage_savings() to authenticated;
