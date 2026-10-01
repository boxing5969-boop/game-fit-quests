-- 📲 휴대폰 알림(웹 푸시) (2026-10-01 대표님)
--
-- 알림함(notifications)에 새 알림이 들어오면, 휴대폰 알림을 켠 회원에게는 휴대폰으로도 바로 보낸다.
--   1) push_subscriptions — 회원 기기(브라우저)별 구독. 화면에서 직접 읽고 쓰지 못하고 아래 함수로만 다룬다.
--      알림을 끈 기기·사라진 구독은 행을 지우지 않고 active = false 로 꺼 둔다 (다시 켜면 그 행을 되살린다).
--      주소는 브라우저 회사 푸시 서버(구글·애플·모질라·MS)만 받는다 — 서버가 아무 주소로나 요청을 보내지 않게.
--   2) push_subscribe / push_unsubscribe / get_push_public_key / send_test_push — 앱이 부르는 함수 (로그인 회원)
--   3) push_claim_notifications / push_report — 발송 함수(push-send)만 부른다 (service_role)
--   4) notifications 저장 직후 트리거 → push-send 호출 (휴대폰 알림을 켠 회원 몫이 있을 때만).
--      휴대폰 발송이 실패해도 알림 저장(공지 발송)은 절대 막지 않는다.
--   5) 지점장이 넣는 알림은 자기 지점 회원에게만 — 이제 휴대폰으로까지 나가니 범위를 좁힌다 (본사는 그대로 전체).
--   6) push_send_key — push-send 내부 인증 키. DB 안에서 만들고 밖으로 꺼내지 않는다.

-- 1) 구독 ─────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_label text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_success_at timestamptz,
  fail_count integer not null default 0,
  active boolean not null default true
);
alter table public.push_subscriptions add column if not exists active boolean not null default true;
-- 주소·키 모양 검사 (표가 먼저 있어도 붙도록 따로 · 없을 때만)
do $c$
begin
  if not exists (select 1 from pg_constraint where conname = 'push_subscriptions_endpoint_ok') then
    alter table public.push_subscriptions add constraint push_subscriptions_endpoint_ok check (
      char_length(endpoint) <= 1000
      and endpoint ~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/'
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'push_subscriptions_keys_ok') then
    alter table public.push_subscriptions add constraint push_subscriptions_keys_ok check (
      p256dh ~ '^[A-Za-z0-9_=-]{80,100}$' and auth ~ '^[A-Za-z0-9_=-]{16,32}$'
    );
  end if;
end
$c$;
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
comment on table public.push_subscriptions is '휴대폰 알림(웹 푸시) 기기별 구독 — 함수로만 다룬다 (2026-10-01)';

alter table public.notifications add column if not exists pushed_at timestamptz;
comment on column public.notifications.pushed_at is '휴대폰 알림으로 보낸 시각 (한 번만 보낸다, 2026-10-01)';

-- 6) 내부 키 (없을 때만 만든다)
insert into public.internal_sync_config (key, value)
values ('push_send_key', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

-- 2) 앱이 부르는 함수 ──────────────────────────────────
create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_device text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_devices integer;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if p_endpoint is null or char_length(p_endpoint) > 1000
     or p_endpoint !~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/' then
    return jsonb_build_object('ok', false, 'error', 'unsupported_endpoint');
  end if;
  if coalesce(p_p256dh, '') !~ '^[A-Za-z0-9_=-]{80,100}$' or coalesce(p_auth, '') !~ '^[A-Za-z0-9_=-]{16,32}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_keys');
  end if;

  -- 같은 기기(주소)는 지금 로그인한 사람 것으로 옮긴다 — 한 폰에서 계정을 바꿔 쓰면 앞사람 알림이 오지 않게
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, device_label)
  values (v_uid, p_endpoint, p_p256dh, p_auth, left(p_device, 60))
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        device_label = excluded.device_label,
        last_seen_at = now(),
        fail_count = 0,
        active = true;

  -- 한 사람 기기는 최근 10대까지만 켜 둔다
  update public.push_subscriptions
     set active = false
   where id in (
     select id from public.push_subscriptions
      where user_id = v_uid and active
      order by last_seen_at desc
      offset 10
   );

  select count(*) into v_devices from public.push_subscriptions where user_id = v_uid and active;
  return jsonb_build_object('ok', true, 'devices', v_devices);
end;
$$;

create or replace function public.push_unsubscribe(p_endpoint text)
returns integer
language sql
security definer
set search_path = public
as $$
  with off as (
    update public.push_subscriptions
       set active = false
     where endpoint = p_endpoint and user_id = auth.uid() and active
    returning 1
  )
  select count(*)::int from off;
$$;

create or replace function public.get_push_public_key()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then null
    else (select (value::jsonb ->> 'publicKey') from public.internal_sync_config where key = 'push_vapid')
  end;
$$;

create or replace function public.send_test_push()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_devices integer;
  v_last timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  select count(*) into v_devices from public.push_subscriptions where user_id = v_uid and active;
  if v_devices = 0 then
    return jsonb_build_object('ok', false, 'error', 'no_subscription');
  end if;
  select max(created_at) into v_last
    from public.notifications
   where user_id = v_uid and title = '🔔 휴대폰 알림 테스트';
  if v_last is not null and v_last > now() - interval '30 seconds' then
    return jsonb_build_object('ok', false, 'error', 'too_soon');
  end if;
  insert into public.notifications (user_id, title, body, link)
  values (v_uid, '🔔 휴대폰 알림 테스트', '알림이 잘 켜졌어요! 공지 · 이벤트 소식을 이렇게 바로 알려 드릴게요.', '/notifications');
  return jsonb_build_object('ok', true, 'devices', v_devices);
end;
$$;

revoke all on function public.push_subscribe(text, text, text, text) from public, anon;
revoke all on function public.push_unsubscribe(text) from public, anon;
revoke all on function public.get_push_public_key() from public, anon;
revoke all on function public.send_test_push() from public, anon;
grant execute on function public.push_subscribe(text, text, text, text) to authenticated;
grant execute on function public.push_unsubscribe(text) to authenticated;
grant execute on function public.get_push_public_key() to authenticated;
grant execute on function public.send_test_push() to authenticated;

-- 3) 발송 함수만 부르는 것 ─────────────────────────────
create or replace function public.push_claim_notifications(p_ids uuid[])
returns table (id uuid, user_id uuid, title text, body text, link text)
language sql
security definer
set search_path = public
as $$
  update public.notifications n
     set pushed_at = now()
   where n.id = any (p_ids)
     and n.pushed_at is null
     and n.created_at > now() - interval '30 minutes'
  returning n.id, n.user_id, n.title, n.body, n.link;
$$;

create or replace function public.push_report(p_ok uuid[], p_gone uuid[], p_failed uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.push_subscriptions
     set last_success_at = now(), fail_count = 0
   where id = any (coalesce(p_ok, '{}'::uuid[]));
  update public.push_subscriptions
     set active = false
   where id = any (coalesce(p_gone, '{}'::uuid[]));
  update public.push_subscriptions
     set fail_count = fail_count + 1,
         active = active and fail_count + 1 < 20
   where id = any (coalesce(p_failed, '{}'::uuid[]));
$$;

revoke all on function public.push_claim_notifications(uuid[]) from public, anon, authenticated;
revoke all on function public.push_report(uuid[], uuid[], uuid[]) from public, anon, authenticated;
grant execute on function public.push_claim_notifications(uuid[]) to service_role;
grant execute on function public.push_report(uuid[], uuid[], uuid[]) to service_role;

-- 4) 알림 저장 직후 → 휴대폰으로 ──────────────────────
create or replace function public._push_notifications_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_key text;
begin
  select array_agg(n.id) into v_ids
    from new_rows n
   where exists (select 1 from public.push_subscriptions s where s.user_id = n.user_id and s.active);
  if v_ids is null then
    return null;
  end if;
  select value into v_key from public.internal_sync_config where key = 'push_send_key';
  if v_key is null then
    return null;
  end if;
  perform net.http_post(
    url := 'https://whnczhxyjmyywhlfbgsd.supabase.co/functions/v1/push-send',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-key', v_key),
    body := jsonb_build_object('action', 'send', 'ids', to_jsonb(v_ids)),
    timeout_milliseconds := 20000
  );
  return null;
exception when others then
  -- 휴대폰 발송이 안 돼도 알림 저장(공지 발송)은 절대 막지 않는다
  return null;
end;
$$;

revoke all on function public._push_notifications_after_insert() from public, anon, authenticated;

create or replace trigger notifications_push_after_insert
  after insert on public.notifications
  referencing new table as new_rows
  for each statement
  execute function public._push_notifications_after_insert();

-- 5) 지점장은 자기 지점 회원에게만 알림을 넣는다 ─────────
alter policy "Managers create notifications" on public.notifications
  to authenticated
  with check (
    has_role((select auth.uid()), 'super_admin'::app_role)
    or (select auth.uid()) = user_id
    or (
      has_role((select auth.uid()), 'branch_manager'::app_role)
      and exists (
        select 1
          from public.profiles target
          join public.profiles me on me.user_id = (select auth.uid())
         where target.user_id = notifications.user_id
           and target.branch_name is not null
           and target.branch_name = me.branch_name
      )
    )
  );