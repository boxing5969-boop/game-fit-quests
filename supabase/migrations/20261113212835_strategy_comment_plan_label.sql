-- 코치님 수업안(「내 수업 짜기」)에 남긴 피드백 알림 제목 — '💬 수업안에 피드백' (2026-11-13 대표님 「적용해」)
--   수업안 = 수업 기록(kind 'class_log') 중 data.stage = 'plan' (화면 src/lib/classPlan.ts) — 예전에는 수업 기록과 같은 '💬 수업 기록에 피드백'
--   바뀌는 곳은 알림 제목 한 줄뿐 — 권한 · 지점 확인 · 1000자 · 읽음 표시 · 받는 사람(글쓴이) · 본문 · 링크는 20261016030000_strategy_room.sql 그대로
--   운영 정의(md5 e50137d0…)를 읽고 그 위에 고침

create or replace function public.strategy_comment_add(p_item uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); i public.strategy_items%rowtype; v_id uuid; v_body text := btrim(coalesce(p_body, '')); v_me jsonb;
begin
  select * into i from public.strategy_items where id = p_item and deleted_at is null;
  if i.id is null then raise exception '글을 찾을 수 없어요'; end if;
  if public._strategy_scope(v_uid, i.branch_name) <> i.branch_name then raise exception '다른 지점 글이에요'; end if;
  if char_length(v_body) = 0 then raise exception '댓글을 써 주세요'; end if;
  if char_length(v_body) > 1000 then raise exception '댓글은 1000자까지예요'; end if;
  insert into public.strategy_comments (item_id, author_id, body) values (p_item, v_uid, v_body) returning id into v_id;
  insert into public.strategy_acks (item_id, user_id, read_at) values (p_item, v_uid, now()) on conflict do nothing;
  if i.author_id <> v_uid then
    v_me := public._strategy_display(v_uid);
    insert into public.notifications (user_id, title, body, link)
    values (i.author_id,
            case when i.kind = 'class_log' and i.data ->> 'stage' = 'plan' then '💬 수업안에 피드백'
                 when i.kind = 'class_log' then '💬 수업 기록에 피드백'
                 else '💬 댓글' end
              || ' · ' || coalesce(v_me ->> 'name', '') || ' ' || coalesce(v_me ->> 'title', ''),
            left(v_body, 120), '/messages?tab=strategy');
  end if;
  return v_id;
end $$;

revoke all on function public.strategy_comment_add(uuid, text) from public, anon;
grant execute on function public.strategy_comment_add(uuid, text) to authenticated;
