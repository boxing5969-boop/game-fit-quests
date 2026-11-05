-- 153OS 앱 알림 자리표 {마일리지} → 받는 사람의 지금 마일리지 잔액 (2026-11-05)
--
-- 대표님: "마이복서 153 링크 수강권탭 주면서 마일리지 얼마있고 마일리지로 할인 받을수있다고 해줘"
--         · "다음부턴 마일리지대로" — 153OS 만료 안내(만료 7일 전 · 1일 전) 앱 알림에 그때 잔액을 넣는다.
--   153OS 는 회원 마일리지를 모른다(마일리지 원장은 이 DB) → 153OS 가 글에 {마일리지} 를 적어 보내고,
--   os_push_receive 가 알림함에 넣는 순간 그 회원의 mileage_balance 로 바꾼다(예: '20,000점').
--   알림함 · 휴대폰 알림(notifications 트리거 → push-send) 둘 다 바뀐 글을 쓴다. 자리표가 없는 알림은 예전 그대로.
--
-- 바꾼 곳: 마지막 insert 의 title · body 두 칸만. 나머지는 운영 DB 의 지금 정의 그대로
--   (2026-11-03 링크 검사 고침 20261103123928 포함 — pg_get_functiondef 로 읽어 그 위에 고침).
-- 되돌리기: 20261103123928_os_push_receive_link_fix.sql 의 정의를 다시 실행 (자리표만 안 바뀜).

CREATE OR REPLACE FUNCTION public.os_push_receive(p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  select i.uid,
         -- 153OS 자리표 {마일리지} → 이 회원의 지금 잔액 '20,000점' (2026-11-05 만료 안내 · 자리표가 없으면 그대로)
         case when strpos(i.title, '{마일리지}') > 0
              then replace(i.title, '{마일리지}', to_char(public.mileage_balance(i.uid), 'FM999,999,990') || '점')
              else i.title end,
         case when strpos(i.body, '{마일리지}') > 0
              then replace(i.body, '{마일리지}', to_char(public.mileage_balance(i.uid), 'FM999,999,990') || '점')
              else i.body end,
         i.link
    from _os_push_in i join fresh f on f.recipient_id = i.rid
   where f.user_id is not null;
  get diagnostics v_inserted = row_count;

  select count(*) filter (where kind not like 'fresh:%'),
         count(*) filter (where kind like 'fresh:%' and uid is null)
    into v_dup, v_skipped
    from _os_push_in;

  return jsonb_build_object('ack', to_jsonb(v_ack), 'inserted', v_inserted, 'dup', v_dup, 'skipped', v_skipped);
end;
$function$;
