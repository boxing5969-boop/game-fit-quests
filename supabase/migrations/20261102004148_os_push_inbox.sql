-- 153OS 앱 알림 → 마이복서153 알림함 (2026-11-02 대표님 「둘 다 차례로」 — 153OS 33단계 공지 · 푸시를 앱에)
--   Edge Function os-push-pull(크론 매분 · x-auto-key)이 153OS outbox 를 받아 이 함수로 넣는다.
--   · os_push_inbox — 153OS 받는 사람 줄(app_push_recipients.id)마다 한 번만 받았다는 기록. ack 가 실패해 같은 줄이
--     다시 와도 알림을 두 번 넣지 않는다. 직접 읽기 · 쓰기 막음(서버 키만).
--   · os_push_receive(p_rows) — 처음 보는 줄만 notifications 에 한 번에(문장 하나) 넣는다 → 기존 트리거
--     notifications_push_after_insert 가 휴대폰 알림을 켠 회원 몫을 push-send 한 번으로 보낸다.
--     앱에 없는 계정 줄은 넣지 않고 받은 것으로만 친다. 돌려주는 ack = 153OS 에 '받았다'고 알릴 줄 모두.
--   새 표 1 · 새 함수 1 — 기존 함수 · 표는 바꾸지 않는다. 크론은 따로(20261102004149_os_push_pull_cron.sql — 앱 화면이 main 에 올라간 뒤 켠다).

create table if not exists public.os_push_inbox (
  recipient_id uuid primary key,            -- 153OS app_push_recipients.id
  message_id uuid,                          -- 153OS app_push_messages.id
  user_id uuid,                             -- 앱 계정 (앱에 없는 계정이면 null — 넣지 않고 받기만)
  kind text,                                -- info · ad
  received_at timestamptz not null default now()
);
create index if not exists os_push_inbox_received_idx on public.os_push_inbox (received_at desc);
alter table public.os_push_inbox enable row level security;
revoke all on table public.os_push_inbox from anon, authenticated;
grant all on table public.os_push_inbox to service_role;

create or replace function public.os_push_receive(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_re constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_ack uuid[];
  v_inserted int := 0;
  v_dup int := 0;
  v_skipped int := 0;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    return jsonb_build_object('ack', '[]'::jsonb, 'inserted', 0, 'dup', 0, 'skipped', 0);
  end if;

  create temporary table if not exists _os_push_in (
    rid uuid primary key, mid uuid, uid uuid, kind text, title text, body text, link text
  ) on commit drop;
  truncate _os_push_in;

  insert into _os_push_in (rid, mid, uid, kind, title, body, link)
  select distinct on (lower(e->>'recipient_id'))
         (e->>'recipient_id')::uuid,
         case when coalesce(e->>'message_id', '') ~ v_re then (e->>'message_id')::uuid end,
         case when coalesce(e->>'user_id', '') ~ v_re then (e->>'user_id')::uuid end,
         case when e->>'kind' = 'ad' then 'ad' else 'info' end,
         left(coalesce(nullif(btrim(e->>'title'), ''), '153복싱짐 소식'), 120),
         left(coalesce(e->>'body', ''), 1500),
         -- 앱 안 경로만(os-push-pull logic.ts mapOsLink 가 만든 것) — push-send safePath 와 같은 모양
         case when coalesce(e->>'link', '') ~ '^/[^/\\\s][^\\\s]{0,298}$' then e->>'link' end
    from jsonb_array_elements(p_rows) e
   where jsonb_typeof(e) = 'object' and coalesce(e->>'recipient_id', '') ~ v_re
   order by lower(e->>'recipient_id');

  select coalesce(array_agg(rid), '{}') into v_ack from _os_push_in;

  -- 앱에 없는 계정 → 넣지 않고 받은 것으로만
  update _os_push_in i set uid = null where i.uid is not null and not exists (select 1 from auth.users u where u.id = i.uid);

  -- 처음 보는 줄만(겹쳐 돈 다른 실행이 먼저 넣은 줄은 on conflict 가 기다렸다가 건너뛴다) → 그 줄만 알림함에.
  -- 알림은 문장 하나로 넣는다 → 트리거(문장마다)가 push-send 를 한 번만 부른다
  with fresh as (
    insert into public.os_push_inbox (recipient_id, message_id, user_id, kind)
    select rid, mid, uid, kind from _os_push_in
    on conflict (recipient_id) do nothing
    returning recipient_id, user_id
  ), mark as (
    update _os_push_in i set kind = 'fresh:' || i.kind from fresh f where f.recipient_id = i.rid returning i.rid
  )
  insert into public.notifications (user_id, title, body, link)
  select i.uid, i.title, i.body, i.link
    from _os_push_in i join fresh f on f.recipient_id = i.rid
   where f.user_id is not null;
  get diagnostics v_inserted = row_count;

  select count(*) filter (where kind not like 'fresh:%'),
         count(*) filter (where kind like 'fresh:%' and uid is null)
    into v_dup, v_skipped
    from _os_push_in;

  return jsonb_build_object('ack', to_jsonb(v_ack), 'inserted', v_inserted, 'dup', v_dup, 'skipped', v_skipped);
end;
$$;

revoke all on function public.os_push_receive(jsonb) from public, anon, authenticated;
grant execute on function public.os_push_receive(jsonb) to service_role;
