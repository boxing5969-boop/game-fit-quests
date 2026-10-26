-- 🛒 앱 결제 장바구니 · 락카/운동복 끝나는 날 (2026-10-26 대표님 보고서 「앱 결제 장바구니 · 수강권/락카/운동복 남은 기간」,
--    10/27 "답했어 나머진 니추천대로")
--
--  · 수강권을 고르면 운동복 · 락카도 같은 개월로 담아(줄일 수 있게) 결제선생 링크 1개로 결제한다 — 링크 하나에 50원.
--    수강권 없이 락카 · 운동복만 연장하는 결제도 링크 1개. 가격 = 한 달 10,000원 × 개월(렌탈 상품 가격 그대로).
--  · 주문 한 건(payment_orders)에 항목(payment_order_items)이 여러 줄. 예전 주문(항목 없음)은 예전 그대로 처리한다.
--  · 결제가 끝나면(payssam-callback → apply_payment_order) 항목마다 반영:
--      수강권 = membership_end 에 일수 더하기(예전과 같음), 운동복 = sportswear_end, 락카 = locker_end — 남은 기간 뒤로 이어 붙인다.
--      누적 결제액(payment_total)에는 수강권 금액만 더한다. 취소(revert_payment_order)는 같은 일을 거꾸로.
--  · 결제 알림(notify_payment_orders)에 항목별 금액 — 브로제이에도 항목별로 넣으시게.
--  · 락카 · 운동복 · 수강권이 끝나기 7일 전 · 1일 전에 회원 휴대폰 알림(remind_pass_ends, 매일 10:05).
--  · 락카 · 운동복 끝나는 날은 회원이 직접 못 바꾼다(guard) — 결제 반영 또는 운영진(set_member_rental_ends).
--  이 파일은 새 표 · 새 칸 · 새 함수 + 알림/보호 함수에 줄 더하기만 한다(예전 주문 · 예전 결제 동작은 그대로).

-- 1) 락카 · 운동복 끝나는 날 ─────────────────────────────────────────────
alter table public.profiles add column if not exists locker_end date;
alter table public.profiles add column if not exists sportswear_end date;
comment on column public.profiles.locker_end is '락카 이용 끝나는 날 — 앱 결제(락카 개월) 때 남은 기간 뒤로 이어 붙인다. 번호는 locker_label (2026-10-27)';
comment on column public.profiles.sportswear_end is '운동복 이용 끝나는 날 — 앱 결제(운동복 개월) 때 남은 기간 뒤로 이어 붙인다 (2026-10-27)';

-- 2) 같은 장바구니 링크 다시 쓰기 (24시간 안) ───────────────────────────────
alter table public.payment_orders add column if not exists cart_key text;
comment on column public.payment_orders.cart_key is '같은 회원 · 같은 장바구니 표시 — 24시간 안에 다시 누르면 새 링크(50원)를 만들지 않고 아까 링크를 연다 (2026-10-27)';
create index if not exists idx_payment_orders_cart_key on public.payment_orders (user_id, cart_key, created_at desc) where cart_key is not null;

-- 3) 주문 항목 ───────────────────────────────────────────────────────────
create table if not exists public.payment_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.payment_orders(id) on delete cascade,
  kind text not null check (kind in ('membership', 'sportswear', 'locker')),
  product_id uuid references public.membership_products(id) on delete set null,
  product_name text not null,
  months integer not null default 0 check (months between 0 and 24),
  unit_price bigint not null default 0,
  list_amount bigint not null check (list_amount >= 0),
  mileage_used integer not null default 0 check (mileage_used >= 0),
  amount bigint not null check (amount >= 0),
  duration_days integer not null default 0 check (duration_days >= 0),
  prev_end date,
  start_date date,
  end_date date,
  applied_at timestamptz,
  reverted_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.payment_order_items is '앱 결제 주문 항목 — 수강권 · 운동복 · 락카 한 줄씩. 결제 후 반영한 시작 · 끝나는 날을 남긴다 (2026-10-27)';
create index if not exists idx_payment_order_items_order on public.payment_order_items (order_id);

alter table public.payment_order_items enable row level security;
revoke all on public.payment_order_items from anon;
grant select on public.payment_order_items to authenticated;

drop policy if exists "own order items select" on public.payment_order_items;
create policy "own order items select" on public.payment_order_items
  for select to authenticated
  using (exists (select 1 from public.payment_orders o where o.id = order_id and o.user_id = (select auth.uid())));

drop policy if exists "staff order items select" on public.payment_order_items;
create policy "staff order items select" on public.payment_order_items
  for select to authenticated
  using (exists (
    select 1 from public.payment_orders o
     where o.id = order_id
       and (public.has_role((select auth.uid()), 'admin') or public.has_role((select auth.uid()), 'super_admin') or public.is_same_branch(o.user_id))
  ));

-- 4) 결제 반영 · 되돌리기 (결제선생 콜백이 서버 키로만 부른다) ─────────────────
create or replace function public.apply_payment_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.payment_orders%rowtype;
  v_it public.payment_order_items%rowtype;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_cur date;
  v_base date;
  v_end date;
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
      -- 남아 있으면 그 뒤로, 끝났으면 오늘부터 (예전 수강권 연장과 같은 식)
      v_base := case when v_cur is not null and v_cur > v_today then v_cur else v_today end;
      v_end := v_base + v_it.duration_days;
      if v_it.kind = 'membership' then
        update public.profiles set membership_end = v_end where user_id = v_order.user_id;
      elsif v_it.kind = 'locker' then
        update public.profiles set locker_end = v_end where user_id = v_order.user_id;
      else
        update public.profiles set sportswear_end = v_end where user_id = v_order.user_id;
      end if;
      update public.payment_order_items
         set prev_end = v_cur,
             start_date = case when v_cur is not null and v_cur > v_today then v_cur + 1 else v_today end,
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

  return jsonb_build_object('ok', true, 'applied', v_applied, 'membership_paid', v_mem_paid);
end;
$$;

create or replace function public.revert_payment_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.payment_orders%rowtype;
  v_it public.payment_order_items%rowtype;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_cur date;
  v_back date;
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
        v_back := v_cur - v_it.duration_days;
        -- 되돌린 날이 오늘보다 과거면 없는 것으로 (예전 취소와 같음)
        if v_back <= v_today then v_back := null; end if;
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
$$;

revoke all on function public.apply_payment_order(uuid) from public, anon, authenticated;
revoke all on function public.revert_payment_order(uuid) from public, anon, authenticated;

-- 5) 운영진이 락카 · 운동복 끝나는 날 넣기 (회원 상세 '수강' 칸) ───────────────
--    권한은 락카 번호(set_member_locker)와 같다: 관리자 = 전체, 지점장 · 코치 = 같은 지점 회원.
create or replace function public.set_member_rental_ends(p_user_id uuid, p_locker_end date, p_sportswear_end date)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _me uuid := auth.uid();
  _my_branch text;
  _my_staff boolean;
  _target_branch text;
begin
  if _me is null then raise exception '로그인이 필요합니다'; end if;
  select branch_name into _target_branch from public.profiles where user_id = p_user_id;
  if not found then raise exception '회원을 찾을 수 없습니다'; end if;
  if not (public.has_role(_me, 'super_admin') or public.has_role(_me, 'admin')) then
    select branch_name, coalesce(is_staff, false) into _my_branch, _my_staff from public.profiles where user_id = _me;
    if not (public.has_role(_me, 'branch_manager') or public.has_role(_me, 'coach') or _my_staff) then
      raise exception '지도진만 락카 · 운동복 기간을 넣을 수 있습니다';
    end if;
    if coalesce(_my_branch, '') = '' or _my_branch is distinct from _target_branch then
      raise exception '같은 지점 회원만 넣을 수 있습니다';
    end if;
  end if;
  if p_locker_end is not null and (p_locker_end < date '2020-01-01' or p_locker_end > date '2040-12-31') then
    raise exception '락카 끝나는 날을 확인해 주세요';
  end if;
  if p_sportswear_end is not null and (p_sportswear_end < date '2020-01-01' or p_sportswear_end > date '2040-12-31') then
    raise exception '운동복 끝나는 날을 확인해 주세요';
  end if;
  perform set_config('app.rental_update', '1', true);
  update public.profiles
     set locker_end = p_locker_end,
         sportswear_end = p_sportswear_end
   where user_id = p_user_id;
  perform set_config('app.rental_update', '', true);
  return jsonb_build_object('success', true, 'locker_end', p_locker_end, 'sportswear_end', p_sportswear_end);
end;
$$;
revoke all on function public.set_member_rental_ends(uuid, date, date) from public, anon;
grant execute on function public.set_member_rental_ends(uuid, date, date) to authenticated;

-- 6) 회원이 직접 못 바꾸게 — 운영 DB 의 지금 정의(20261026231125 merged_into 줄까지) 위에 락카 · 운동복 끝나는 날만 더한다
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then return new; end if;
  if new.is_test_account is distinct from old.is_test_account
     and not (public.has_role(auth.uid(), 'super_admin') or public.has_role(auth.uid(), 'admin')) then
    raise exception '체험용 계정 표시는 관리자만 바꿀 수 있습니다';
  end if;
  -- 2026-10-13: 지점장은 자기 소속 지점을 직접 바꿀 수 없다 — 같은 지점 판정(is_same_branch)으로
  -- 회원 정보·수강권 신청·병원 서류 접근이 갈린다. 지점장 이동은 본사(관리자)가 처리한다.
  if new.user_id = auth.uid()
     and public.has_role(auth.uid(), 'branch_manager')
     and not (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin'))
     and coalesce(btrim(old.branch_name), '') <> ''
     and new.branch_name is distinct from old.branch_name then
    raise exception '지점장 계정의 소속 지점은 전체관리자만 바꿀 수 있습니다';
  end if;
  if public.has_role(auth.uid(), 'admin')
     or public.has_role(auth.uid(), 'super_admin')
     or public.has_role(auth.uid(), 'branch_manager') then
    return new;
  end if;
  if new.is_approved is distinct from old.is_approved
     and coalesce(new.is_approved, false) = true then
    raise exception '승인 상태는 직접 변경할 수 없습니다';
  end if;
  if new.is_staff is distinct from old.is_staff
     or new.staff_title is distinct from old.staff_title
     or new.staff_source is distinct from old.staff_source
     or new.membership_end is distinct from old.membership_end
     or new.payment_total is distinct from old.payment_total
     or new.must_change_credentials is distinct from old.must_change_credentials
     or new.pt_until is distinct from old.pt_until
     or new.pt_ticket is distinct from old.pt_ticket
     or new.pt_remaining is distinct from old.pt_remaining
     or new.pt_end_date is distinct from old.pt_end_date
     or new.pt_checked_at is distinct from old.pt_checked_at
     -- 2026-10-26: 쓰지 않는 예전 계정 표시도 지점장·관리자만
     or new.merged_into is distinct from old.merged_into then
    raise exception '이 항목은 직접 변경할 수 없습니다';
  end if;
  -- 2026-10-27: 락카 · 운동복 끝나는 날은 결제 반영(서버 키) 또는 set_member_rental_ends(지도진 확인) 안에서만
  if (new.locker_end is distinct from old.locker_end
      or new.sportswear_end is distinct from old.sportswear_end)
     and coalesce(current_setting('app.rental_update', true), '') <> '1' then
    raise exception '락카 · 운동복 기간은 데스크에서 바꿔 드려요';
  end if;
  -- 락카는 set_member_locker(지도진 확인) 안에서만 바뀐다 — 그 함수가 이 거래에만 표시를 켠다
  if (new.locker_label is distinct from old.locker_label
      or new.locker_updated_at is distinct from old.locker_updated_at
      or new.locker_updated_by is distinct from old.locker_updated_by)
     and coalesce(current_setting('app.locker_update', true), '') <> '1' then
    raise exception '락카 번호는 데스크에서 바꿔 드려요';
  end if;
  if coalesce(btrim(old.branch_name), '') <> ''
     and new.branch_name is distinct from old.branch_name then
    raise exception '소속 지점은 직접 바꿀 수 없습니다. 설정의 지점 이전 요청을 이용해 주세요';
  end if;
  if new.nickname is distinct from old.nickname
     and char_length(btrim(coalesce(new.nickname, ''))) > 12 then
    raise exception '닉네임은 12자 이내로 정해 주세요';
  end if;
  if old.phone_number is not null and new.phone_number is distinct from old.phone_number then
    raise exception '전화번호는 직접 변경할 수 없습니다. 지점에 문의해 주세요';
  end if;
  if old.gym_reg_date is not null and new.gym_reg_date is distinct from old.gym_reg_date then
    raise exception '등록일은 직접 변경할 수 없습니다';
  end if;
  return new;
end;
$function$;

-- 7) 결제 알림에 항목별 금액 — 운영 DB 의 지금 정의(20261001123928) 위에 본문만 바꾼다
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

    -- 장바구니 주문(2026-10-27): "주5회 기간권 3개월 540,000 · 운동복 3개월 30,000 · 락카 3개월 30,000 = 600,000원"
    select string_agg(i.product_name || ' ' || to_char(i.list_amount, 'FM999,999,999,990'), ' · '
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
$$;

revoke all on function public.notify_payment_orders() from public, anon, authenticated;

-- 8) 끝나기 7일 전 · 1일 전 알림 (수강권 · 락카 · 운동복) ───────────────────────
create table if not exists public.pass_end_reminders (
  user_id uuid not null,
  kind text not null check (kind in ('membership', 'locker', 'sportswear')),
  end_date date not null,
  days_before integer not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, end_date, days_before)
);
alter table public.pass_end_reminders enable row level security;
revoke all on public.pass_end_reminders from anon, authenticated;
comment on table public.pass_end_reminders is '수강권 · 락카 · 운동복 끝나기 전 알림 보낸 기록 — 같은 끝나는 날 · 같은 날짜 전 알림은 한 번 (2026-10-27)';

create or replace function public.remind_pass_ends()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  r record;
  v_done integer := 0;
  v_what text;
  v_when text;
  v_how text;
begin
  if not pg_try_advisory_xact_lock(hashtext('remind_pass_ends')) then
    return 0;
  end if;

  for r in
    select p.user_id, p.branch_name, k.kind, k.end_date, (k.end_date - v_today) as d
      from public.profiles p
      cross join lateral (values
        ('membership'::text, p.membership_end),
        ('locker'::text, p.locker_end),
        ('sportswear'::text, p.sportswear_end)
      ) as k(kind, end_date)
     where k.end_date is not null
       and (k.end_date - v_today) in (7, 1)
       and p.is_approved = true
       and p.is_staff is not true
       and p.merged_into is null
       and coalesce(p.is_test_account, false) = false
       -- 앱을 쓰는 회원에게만 (120일 안에 로그인)
       and exists (select 1 from auth.users u where u.id = p.user_id and u.last_sign_in_at > now() - interval '120 days')
       and not exists (
         select 1 from public.pass_end_reminders x
          where x.user_id = p.user_id and x.kind = k.kind and x.end_date = k.end_date and x.days_before = (k.end_date - v_today)
       )
     limit 500
  loop
    v_what := case r.kind when 'membership' then '수강권' when 'locker' then '락카' else '운동복' end;
    v_when := case r.d when 1 then '내일' else '7일 뒤' end;
    v_how := case
      when r.branch_name = '153복싱짐 칠금점' then '데스크에서 연장해 주세요'
      else '앱 수강권 탭에서 바로 연장할 수 있어요'
    end;
    insert into public.notifications (user_id, title, body, link)
    values (
      r.user_id,
      -- 받침 있으면 '이'(수강권이 · 운동복이), 없으면 '가'(락카가)
      '🔔 ' || v_what || (case when r.kind = 'locker' then '가 ' else '이 ' end) || v_when || ' 끝나요',
      to_char(r.end_date, 'FMMM"월" FMDD"일"') || '까지예요 · ' || v_how || ' (이미 연장하셨다면 넘기셔도 돼요)',
      '/membership'
    );
    insert into public.pass_end_reminders (user_id, kind, end_date, days_before)
    values (r.user_id, r.kind, r.end_date, r.d)
    on conflict do nothing;
    v_done := v_done + 1;
  end loop;
  return v_done;
end;
$$;
revoke all on function public.remind_pass_ends() from public, anon, authenticated;

-- 매일 10:05 KST (01:05 UTC) — 같은 이름이면 덮어쓴다
select cron.schedule('remind-pass-ends', '5 1 * * *', $cron$select public.remind_pass_ends()$cron$);
