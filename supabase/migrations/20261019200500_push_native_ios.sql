-- 📲 아이폰 앱(App Store '마이복서153') 휴대폰 알림 — 애플 푸시(APNs) 기기 주소도 같은 표에 담는다 (2026-10-19 대표님: 애플스토어 등록)
--
-- 아이폰 앱은 웹 푸시(서비스워커)를 못 쓴다 → 앱이 받은 애플 기기 토큰을 'apns:<토큰>' 주소로 push_subscriptions 에 넣는다.
--   · kind      'web'(기존 웹 푸시) | 'apns'(아이폰 앱)
--   · apns_env  'production'(App Store·TestFlight) | 'sandbox'(Xcode 개발 빌드)
-- 같은 표라서 알림 켠 보상·XP·앱왕 점수·전략 회의실 '알림 켬' 표시가 그대로 아이폰 앱에도 적용된다.
-- 발송은 push-send 가 kind 를 보고 나눈다 (apns.ts). 키는 internal_sync_config.apns_key (애플 개발자 › Keys 의 .p8).
-- 지우기·끄기는 기존 push_unsubscribe('apns:<토큰>') 그대로.

alter table public.push_subscriptions add column if not exists kind text not null default 'web';
alter table public.push_subscriptions add column if not exists apns_env text;

do $c$
begin
  alter table public.push_subscriptions drop constraint if exists push_subscriptions_kind_ok;
  alter table public.push_subscriptions add constraint push_subscriptions_kind_ok check (
    kind in ('web', 'apns') and (apns_env is null or apns_env in ('production', 'sandbox'))
  );

  alter table public.push_subscriptions drop constraint if exists push_subscriptions_endpoint_ok;
  alter table public.push_subscriptions add constraint push_subscriptions_endpoint_ok check (
    char_length(endpoint) <= 1000
    and (
      (kind = 'web' and endpoint ~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/')
      or (kind = 'apns' and endpoint ~ '^apns:[0-9a-f]{64,200}$')
    )
  );

  alter table public.push_subscriptions drop constraint if exists push_subscriptions_keys_ok;
  alter table public.push_subscriptions add constraint push_subscriptions_keys_ok check (
    kind = 'apns'
    or (p256dh ~ '^[A-Za-z0-9_=-]{80,100}$' and auth ~ '^[A-Za-z0-9_=-]{16,32}$')
  );
end
$c$;

comment on column public.push_subscriptions.kind is 'web = 웹 푸시 · apns = 아이폰 앱(App Store) 애플 푸시 (2026-10-19)';
comment on column public.push_subscriptions.apns_env is '아이폰 앱 토큰 환경 — production(App Store·TestFlight) | sandbox(개발 빌드)';

-- 아이폰 앱이 부르는 함수 — 기기 토큰(16진수) 등록. 같은 기기는 지금 로그인한 사람 것으로 옮긴다.
create or replace function public.push_subscribe_native(p_token text, p_device text default null, p_env text default 'production')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_token text := lower(coalesce(p_token, ''));
  v_env text := case when p_env = 'sandbox' then 'sandbox' else 'production' end;
  v_devices integer;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if v_token !~ '^[0-9a-f]{64,200}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_token');
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, device_label, kind, apns_env)
  values (v_uid, 'apns:' || v_token, '', '', left(coalesce(p_device, '아이폰 앱'), 60), 'apns', v_env)
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        device_label = excluded.device_label,
        kind = 'apns',
        apns_env = excluded.apns_env,
        last_seen_at = now(),
        fail_count = 0,
        active = true;

  -- 한 사람 기기는 최근 10대까지만 켜 둔다 (push_subscribe 와 같은 규칙)
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

revoke all on function public.push_subscribe_native(text, text, text) from public, anon;
grant execute on function public.push_subscribe_native(text, text, text) to authenticated;
