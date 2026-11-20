-- 수강권 시작일 고르기 (2026-11-20 대표님: "회원님들이 수강권 결제할때 시작일을 지정할수있게하자.
--   미리등록하려는분들도있고 신규인데 다음주부터 하고싶은 사람도 있으니까")
--
-- 결제 확인 창에서 회원이 시작일을 고른다(기본 = 이어서, 30일 안). payssam-create-bill 이 고른 날을 항목마다
-- payment_order_items.start_date 에 두고(기본 시작일이면 비움), 결제가 끝나면 이 파일의 apply_payment_order 가 그날부터 반영한다.
--
--   · _pass_period (새 안쪽 함수) — 한 항목의 이용 기간. 화면 src/lib/cartPricing.ts itemPeriod 와 같은 식(시험 passPeriod.cases.json).
--       기본 시작일 = 지금 것이 오늘까지라도 남아 있으면 끝난 다음 날, 없거나 끝났으면 오늘(한국 날짜)
--       시작일 = 기본 시작일과 고른 날 중 늦은 날 (그사이 데스크가 기간을 늘렸으면 그 뒤로 밀린다)
--       끝나는 날 = 시작일 + N개월 − 1일 — 브로제이(데스크 · 출입문)와 같은 식 (11/27 시작 1개월 → 12/26까지)
--         (예전: 시작 기준일 + 상품 일수 — 1개월 30일 · 5개월 150일이라 브로제이와 하루씩 어긋났다)
--         날 단위 상품(28일 아래 · 개월 없음)은 시작일 + 일수 − 1일
--   · apply_payment_order — 위 식으로 반영 · 답에 membership_start · membership_end (payssam-callback 이 153OS 이용권을 같은 날로 옮긴다)
--   · revert_payment_order — 이 항목이 늘린 날만큼 되돌린다(고른 시작일 사이 빈 날까지) · 되돌린 날이 오늘이면 오늘까지 남긴다
--       (예전: 상품 일수만큼 · 오늘이 되면 없앴다 — 오늘 끝나는 수강권을 미리 결제하고 취소하면 오늘 하루가 사라졌다)
--   · notify_payment_orders — 데스크 알림에 항목마다 기간 "(11/27~12/26)" (브로제이에 같은 날로 넣게) ·
--       결제 직후 항목 반영이 끝나기 전에는 5분까지 기다린다 (기간이 빠진 알림이 가지 않게)
--
-- 기존 표 · 권한은 그대로(세 함수는 서버 키만 — authenticated · anon 실행 없음). 줄을 지우는 문장 없음.
-- 153OS 쪽(app_set_paid_membership_start)은 docs/os153/20261120234555_app_set_paid_membership_start.sql.

-- ── 한 항목의 이용 기간 ───────────────────────────────────────────────────────
create or replace function public._pass_period(
  p_cur date,      -- 지금 끝나는 날 (없으면 null)
  p_today date,    -- 한국 날짜 오늘
  p_start date,    -- 고른 시작일 (기본이면 null)
  p_months integer,
  p_days integer
)
returns table(start_on date, end_on date)
language sql
immutable
set search_path to 'public'
as $function$
  with b as (
    select case when p_cur is not null and p_cur >= p_today then p_cur + 1 else p_today end as cont
  ), s as (
    select greatest(b.cont, coalesce(p_start, b.cont)) as st from b
  )
  select s.st,
         case
           when coalesce(p_months, 0) > 0 and coalesce(p_days, 0) >= 28
             then (s.st + make_interval(months => p_months))::date - 1
           else s.st + greatest(coalesce(p_days, 0), 1) - 1
         end
    from s;
$function$;

revoke all on function public._pass_period(date, date, date, integer, integer) from public, anon, authenticated;
grant execute on function public._pass_period(date, date, date, integer, integer) to service_role;

-- ── 결제 반영 ────────────────────────────────────────────────────────────────
create or replace function public.apply_payment_order(p_order_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_order public.payment_orders%rowtype;
  v_it public.payment_order_items%rowtype;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_cur date;
  v_start date;
  v_end date;
  v_mem_start date;
  v_mem_end date;
  v_mem_paid bigint := 0;
  v_applied integer := 0;
begin
  select * into v_order from public.payment_orders where id = p_order_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_order'); end if;
  if v_order.status <> 'paid' then return jsonb_build_object('ok', false, 'reason', 'not_paid'); end if;

  perform 1 from public.profiles where user_id = v_order.user_id for update;

  for v_it in
    select * from public.payment_order_items
     where order_id = p_order_id and applied_at is null
     order by case kind when 'membership' then 0 when 'locker' then 1 else 2 end, created_at
  loop
    if v_it.duration_days > 0 then
      select case v_it.kind when 'membership' then membership_end when 'locker' then locker_end else sportswear_end end
        into v_cur
        from public.profiles where user_id = v_order.user_id;
      -- 기본 = 이어서(남아 있으면 끝난 다음 날, 끝났으면 오늘) · 고른 시작일(v_it.start_date)이 더 늦으면 그날 (2026-11-20)
      --   끝나는 날 = 시작일 + N개월 − 1일 (브로제이와 같은 식) — 늘 지금 끝나는 날보다 뒤다
      select pp.start_on, pp.end_on into v_start, v_end
        from public._pass_period(v_cur, v_today, v_it.start_date, v_it.months, v_it.duration_days) pp;
      if v_it.kind = 'membership' then
        update public.profiles set membership_end = v_end where user_id = v_order.user_id;
        if v_mem_start is null then v_mem_start := v_start; v_mem_end := v_end; end if;
      elsif v_it.kind = 'locker' then
        update public.profiles set locker_end = v_end where user_id = v_order.user_id;
      else
        update public.profiles set sportswear_end = v_end where user_id = v_order.user_id;
      end if;
      update public.payment_order_items
         set prev_end = v_cur,
             start_date = v_start,
             end_date = v_end,
             applied_at = now()
       where id = v_it.id;
    else
      update public.payment_order_items set applied_at = now() where id = v_it.id;
    end if;
    if v_it.kind = 'membership' then v_mem_paid := v_mem_paid + v_it.amount; end if;
    v_applied := v_applied + 1;
  end loop;

  -- 누적 결제액은 수강권 금액만 · 결제가 끝나면 가입 승인 (예전 콜백과 같음)
  update public.profiles
     set payment_total = case when v_mem_paid > 0 then coalesce(payment_total, 0) + v_mem_paid else payment_total end,
         is_approved = true
   where user_id = v_order.user_id;

  return jsonb_build_object(
    'ok', true, 'applied', v_applied, 'membership_paid', v_mem_paid,
    'membership_start', v_mem_start, 'membership_end', v_mem_end
  );
end;
$function$;

-- ── 결제 취소 되돌리기 ───────────────────────────────────────────────────────
create or replace function public.revert_payment_order(p_order_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_order public.payment_orders%rowtype;
  v_it public.payment_order_items%rowtype;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_cur date;
  v_back date;
  v_day date;
  v_shift integer;
  v_mem_paid bigint := 0;
  v_reverted integer := 0;
begin
  select * into v_order from public.payment_orders where id = p_order_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_order'); end if;

  perform 1 from public.profiles where user_id = v_order.user_id for update;

  for v_it in
    select * from public.payment_order_items
     where order_id = p_order_id and applied_at is not null and reverted_at is null
  loop
    if v_it.duration_days > 0 then
      select case v_it.kind when 'membership' then membership_end when 'locker' then locker_end else sportswear_end end
        into v_cur
        from public.profiles where user_id = v_order.user_id;
      if v_cur is not null then
        -- 이 항목이 늘린 날 = 이 항목의 끝 − (그때 끝나는 날, 이미 끝났으면 반영한 날의 전날) — 고른 시작일 사이 빈 날까지 (2026-11-20)
        --   끝나는 날을 모르는 항목(반영 기록이 없는 옛 줄)은 예전처럼 상품 일수만큼
        if v_it.end_date is not null then
          v_day := (v_it.applied_at at time zone 'Asia/Seoul')::date;
          v_shift := v_it.end_date
                     - (case when v_it.prev_end is not null and v_it.prev_end >= v_day then v_it.prev_end else v_day - 1 end);
        else
          v_shift := v_it.duration_days;
        end if;
        v_back := v_cur - greatest(v_shift, 0);
        -- 되돌린 날이 지났으면 없는 것으로 · 오늘이면 오늘까지 (원래 오늘 끝나던 수강권)
        if v_back < v_today then v_back := null; end if;
        if v_it.kind = 'membership' then
          update public.profiles set membership_end = v_back where user_id = v_order.user_id;
        elsif v_it.kind = 'locker' then
          update public.profiles set locker_end = v_back where user_id = v_order.user_id;
        else
          update public.profiles set sportswear_end = v_back where user_id = v_order.user_id;
        end if;
      end if;
    end if;
    if v_it.kind = 'membership' then v_mem_paid := v_mem_paid + v_it.amount; end if;
    update public.payment_order_items set reverted_at = now() where id = v_it.id;
    v_reverted := v_reverted + 1;
  end loop;

  if v_mem_paid > 0 then
    update public.profiles
       set payment_total = nullif(greatest(0, coalesce(payment_total, 0) - v_mem_paid), 0)
     where user_id = v_order.user_id;
  end if;

  return jsonb_build_object('ok', true, 'reverted', v_reverted, 'membership_paid', v_mem_paid);
end;
$function$;

-- ── 데스크 알림 (브로제이 입력) ──────────────────────────────────────────────
create or replace function public.notify_payment_orders()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  v_done integer := 0;
  v_n integer;
  v_title text;
  v_body text;
  v_member text;
  v_phone4 text;
  v_items text;
  v_mileage integer;
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
         -- 결제 직후 항목 반영(apply_payment_order)이 끝나야 기간이 나온다 — 반영 전이면 5분까지 기다린다 (2026-11-20)
         and (
           not exists (select 1 from public.payment_order_items i where i.order_id = o.id and i.applied_at is null)
           or coalesce(o.paid_at, o.created_at) < now() - interval '5 minutes'
         )
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

    -- 장바구니 주문(2026-10-27): "주5회 기간권 3개월 540,000 (11/27~2/26) · 운동복 3개월 30,000 (11/27~2/26) = 570,000원"
    --   항목마다 기간 (2026-11-20 시작일 고르기 — 데스크가 브로제이에 같은 날로 넣게)
    select string_agg(
             i.product_name || ' ' || to_char(i.list_amount, 'FM999,999,999,990')
             || case
                  when i.start_date is not null and i.end_date is not null
                    then ' (' || to_char(i.start_date, 'FMMM/FMDD') || '~' || to_char(i.end_date, 'FMMM/FMDD') || ')'
                  when i.start_date is not null
                    then ' (' || to_char(i.start_date, 'FMMM/FMDD') || '~)'
                  else ''
                end,
             ' · '
             order by case i.kind when 'membership' then 0 when 'sportswear' then 1 else 2 end),
           coalesce(sum(i.mileage_used), 0)
      into v_items, v_mileage
      from public.payment_order_items i
     where i.order_id = r.id;

    v_title := case r.kind
      when 'paid' then '💳 앱 결제 완료 — 브로제이 입력해 주세요'
      else '↩️ 앱 결제 취소 — 브로제이에서 환불 처리해 주세요'
    end;
    v_body := concat_ws(' · ',
      nullif(btrim(r.branch_name), ''),
      v_member,
      case
        when v_items is not null then
          v_items
          || case when v_mileage > 0 then ' · 마일리지 -' || to_char(v_mileage, 'FM999,999,990') else '' end
          || ' = ' || to_char(coalesce(r.amount, 0), 'FM999,999,999,990') || '원'
        else
          concat_ws(' · ', nullif(btrim(r.product_name), ''), to_char(coalesce(r.amount, 0), 'FM999,999,999,990') || '원')
      end,
      to_char(coalesce(r.paid_at, now()) at time zone 'Asia/Seoul', 'MM/DD HH24:MI')
    );

    insert into public.notifications (user_id, title, body, link)
    -- 누르면 회원 상세 '수강' 탭(전체관리자) — 지점장은 화면이 개요로 돌려 준다 (2026-10-27)
    select rcpt.user_id, v_title, v_body, '/manager/member/' || r.user_id::text || '?tab=pass'
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
$function$;
