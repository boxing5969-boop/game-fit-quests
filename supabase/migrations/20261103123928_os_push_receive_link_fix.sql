-- os_push_receive 링크 검사식 고침 (2026-11-03 · 153OS 38단계 검수 — 대표님 「다음작업과 최고성능 검수하자」)
--   문제: PostgreSQL 정규식의 반복 횟수는 255까지다. 링크 검사 '^/…{0,298}$' 가 줄마다 'invalid repetition count(s)'
--         오류를 내서, 153OS 앱 알림(공지 알림 · 푸시메시지 · 문의 답장 알림)이 한 줄도 알림함에 못 들어온다
--         (os-push-pull receive_failed → ack 없음 → 153OS 에서 24시간 뒤 만료). 11/03 까지 보낸 알림은 0건이라 잃은 것은 없다.
--   고침: 모양은 '*' 로, 길이(2~300자)는 char_length 로 따로 — 뜻은 그대로(앱 안 경로 · 빈칸 · 역슬래시 · '//' 시작 막기).
--   나머지 본문은 운영 DB 지금 정의(20261102004148 — pg_get_functiondef md5 0a3e8ec2…)와 같다. 표 · 권한 · 크론은 그대로.
--   시험: 앱에 없는 계정 한 줄로 실제 호출(아무것도 넣지 않고 skipped 1 · ack 1) — 적용 기록 참고.

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
         -- 앱 안 경로만(os-push-pull logic.ts mapOsLink 가 만든 것) — push-send safePath 와 같은 모양 · 300자까지.
         --   PostgreSQL 정규식 반복은 255까지라 길이는 char_length 로 따로 본다(2026-11-03 고침 — 예전 '{0,298}' 은 줄마다 오류)
         case when char_length(coalesce(e->>'link', '')) between 2 and 300
                   and coalesce(e->>'link', '') ~ '^/[^/\\\s][^\\\s]*$' then e->>'link' end
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
