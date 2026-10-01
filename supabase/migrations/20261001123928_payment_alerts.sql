-- 💳 앱 결제 알림 (2026-10-01 대표님: "결제를 했으면 바로바로 알아야 — 브로제이 입력")
--
-- 결제 코드(payssam-*)와 결제 표(payment_orders)는 건드리지 않는다. 1분마다 결제 기록을 읽기만 해서
--   · 새로 결제 완료(paid)된 주문
--   · 결제됐다가 취소(canceled)된 주문
-- 을 본사(super_admin) + 그 지점 지점장(branch_manager)에게 알림함(notifications)으로 넣는다.
-- → 휴대폰 알림을 켠 사람은 휴대폰으로도 바로 울린다 (notifications 저장 트리거 → push-send).
-- 카카오 알림톡은 템플릿 검수가 끝나면 같은 기록(payment_alert_log)의 kakao_* 칸을 보고 붙인다.
--
-- 한 주문·한 종류(결제/취소)는 한 번만 알린다 — payment_alert_log 의 (order_id, kind) 기본키.
-- 7일 넘은 결제는 알리지 않는다 (기능을 켜는 순간 옛 주문이 한꺼번에 울리지 않게).
-- 알림 내용: 지점 · 회원 이름(전화 끝 4자리) · 상품 · 금액 · 결제 시각, 누르면 그 회원 상세 화면.

create table if not exists public.payment_alert_log (
  order_id uuid not null,
  kind text not null check (kind in ('paid', 'canceled')),
  alerted_at timestamptz not null default now(),
  recipients integer not null default 0,
  kakao_status text,
  kakao_sent_at timestamptz,
  primary key (order_id, kind)
);
alter table public.payment_alert_log enable row level security;
revoke all on public.payment_alert_log from anon, authenticated;
comment on table public.payment_alert_log is '앱 결제 알림 보낸 기록 — 주문·종류(결제/취소)마다 한 번 (2026-10-01)';

create or replace function public.notify_payment_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_done integer := 0;
  v_n integer;
  v_title text;
  v_body text;
  v_member text;
  v_phone4 text;
begin
  -- 1분 점검이 겹쳐 돌아도 같은 주문을 두 번 알리지 않게 한 번에 하나만
  if not pg_try_advisory_xact_lock(hashtext('notify_payment_orders')) then
    return 0;
  end if;

  for r in
    select q.* from (
      select o.id, o.user_id, o.branch_name, o.product_name, o.amount, o.paid_at, 'paid'::text as kind
        from public.payment_orders o
       where o.status = 'paid'
         and coalesce(o.paid_at, o.created_at) > now() - interval '7 days'
         and not exists (select 1 from public.payment_alert_log l where l.order_id = o.id and l.kind = 'paid')
      union all
      select o.id, o.user_id, o.branch_name, o.product_name, o.amount, o.paid_at, 'canceled'::text
        from public.payment_orders o
       where o.status = 'canceled'
         and exists (select 1 from public.payment_alert_log l where l.order_id = o.id and l.kind = 'paid')
         and not exists (select 1 from public.payment_alert_log l where l.order_id = o.id and l.kind = 'canceled')
    ) q
    order by q.paid_at nulls last
    limit 50
  loop
    v_member := null;
    v_phone4 := null;
    select coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.nickname), '')),
           right(regexp_replace(coalesce(p.phone_number, ''), '\D', '', 'g'), 4)
      into v_member, v_phone4
      from public.profiles p
     where p.user_id = r.user_id;
    v_member := coalesce(v_member, '회원') || case when coalesce(v_phone4, '') <> '' then '(' || v_phone4 || ')' else '' end;

    v_title := case r.kind
      when 'paid' then '💳 앱 결제 완료 — 브로제이 입력해 주세요'
      else '↩️ 앱 결제 취소 — 브로제이에서 환불 처리해 주세요'
    end;
    v_body := concat_ws(' · ',
      nullif(btrim(r.branch_name), ''),
      v_member,
      nullif(btrim(r.product_name), ''),
      to_char(coalesce(r.amount, 0), 'FM999,999,999,990') || '원',
      to_char(coalesce(r.paid_at, now()) at time zone 'Asia/Seoul', 'MM/DD HH24:MI')
    );

    insert into public.notifications (user_id, title, body, link)
    select rcpt.user_id, v_title, v_body, '/manager/member/' || r.user_id::text
      from (
        select ur.user_id
          from public.user_roles ur
         where ur.role = 'super_admin'
        union
        select ur.user_id
          from public.user_roles ur
          join public.profiles pm on pm.user_id = ur.user_id
         where ur.role = 'branch_manager'
           and pm.branch_name is not null
           and pm.branch_name = r.branch_name
      ) rcpt;
    get diagnostics v_n = row_count;

    insert into public.payment_alert_log (order_id, kind, recipients)
    values (r.id, r.kind, v_n)
    on conflict (order_id, kind) do nothing;
    v_done := v_done + 1;
  end loop;
  return v_done;
end;
$$;

revoke all on function public.notify_payment_orders() from public, anon, authenticated;

-- 1분마다 (같은 이름이면 덮어쓴다)
select cron.schedule('payment-alerts', '* * * * *', $cron$select public.notify_payment_orders()$cron$);