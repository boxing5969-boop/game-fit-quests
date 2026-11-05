-- 커뮤니티 댓글에 답글 (2026-11-05 대표님 "내가 댓글 남기면 답글 못 남겨?" → 「진행하자」)
--
-- · champion_journal_comments.parent_id — 맨 위 댓글(한 단계만). 답글에 단 답글도 같은 맨 위 댓글 밑으로 간다.
-- · champion_journal_comments.reply_to_user_id — 답글을 받은 사람(누른 댓글 · 답글의 주인).
-- · 답글이 달린 댓글을 지우면 그 밑 답글도 함께 지워진다(인스타그램 · 유튜브처럼) — 화면에서 먼저 묻는다.
-- · add_journal_reply(댓글, 내용) — 새 함수. 예전 add_journal_comment 는 그대로(맨 위 댓글).
-- · list_journal_comments_v2 — 예전 칸 + parent_id · reply_to_user_id · reply_to_name. 예전 list_journal_comments 는 그대로.
-- · 댓글 알림 트리거 _community_comment_notify — 답글이면 받은 사람에게 「○○님이 답글을 남겼어요」,
--   글쓴이에게는 예전처럼 「댓글을 남겼어요」(답글을 이미 받은 사람이면 한 번만). 스위치 · 조용한 시간 · 하루 3번 · 회원 설정은 그대로.

alter table public.champion_journal_comments
  add column if not exists parent_id uuid references public.champion_journal_comments(id) on delete cascade,
  add column if not exists reply_to_user_id uuid references auth.users(id) on delete set null;

create index if not exists champion_journal_comments_parent_idx
  on public.champion_journal_comments (parent_id)
  where parent_id is not null;

-- 답글 달기
create or replace function public.add_journal_reply(p_comment_id uuid, p_content text)
 returns table(success boolean, comment_id uuid, message text)
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_viewer uuid := auth.uid();
  v_clean text;
  v_entry uuid;
  v_top uuid;
  v_to uuid;
  v_id uuid;
begin
  if v_viewer is null then raise exception 'auth required'; end if;
  if not public._is_active_member(v_viewer) then raise exception '승인된 회원만 쓸 수 있어요' using errcode = '42501'; end if;
  v_clean := btrim(coalesce(p_content, ''));
  if char_length(v_clean) < 1 then raise exception '댓글 내용을 입력해주세요.'; end if;
  if char_length(v_clean) > 500 then raise exception '댓글은 500자 이하로 작성해주세요.'; end if;
  select c.entry_id, coalesce(c.parent_id, c.id), c.commenter_user_id
    into v_entry, v_top, v_to
    from public.champion_journal_comments c
   where c.id = p_comment_id;
  if v_entry is null then raise exception '답글을 달 댓글을 찾을 수 없어요.'; end if;
  if not public.community_can_view_entry(v_viewer, v_entry) then
    raise exception '이 글에는 댓글을 남길 수 없습니다.';
  end if;
  insert into public.champion_journal_comments (entry_id, commenter_user_id, content, parent_id, reply_to_user_id)
  values (v_entry, v_viewer, v_clean, v_top, v_to)
  returning id into v_id;
  return query select true, v_id, '답글이 등록되었습니다.'::text;
end $function$;

revoke all on function public.add_journal_reply(uuid, text) from public, anon;
grant execute on function public.add_journal_reply(uuid, text) to authenticated, service_role;

-- 댓글 목록 (답글 칸 포함)
create or replace function public.list_journal_comments_v2(p_entry_id uuid)
 returns table(id uuid, entry_id uuid, commenter_user_id uuid, commenter_name text, content text, created_at timestamp with time zone, is_mine boolean, parent_id uuid, reply_to_user_id uuid, reply_to_name text)
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare v_viewer uuid := auth.uid();
begin
  if v_viewer is null then raise exception 'auth required'; end if;
  if not public._is_active_member(v_viewer) then raise exception '승인된 회원만 쓸 수 있어요' using errcode = '42501'; end if;
  if not exists (select 1 from public.champion_journal_entries e where e.id = p_entry_id) then
    raise exception 'entry not found';
  end if;
  if not public.community_can_view_entry(v_viewer, p_entry_id) then
    raise exception 'not authorized to view comments for this entry';
  end if;
  return query
  select c.id, c.entry_id, c.commenter_user_id,
         coalesce(nullif(p.nickname, ''), nullif(p.name, ''), '회원') as commenter_name,
         c.content, c.created_at, (c.commenter_user_id = v_viewer) as is_mine,
         c.parent_id, c.reply_to_user_id,
         case when c.reply_to_user_id is null then null
              else coalesce(nullif(rp.nickname, ''), nullif(rp.name, ''), '회원') end as reply_to_name
    from public.champion_journal_comments c
    left join public.profiles p on p.user_id = c.commenter_user_id
    left join public.profiles rp on rp.user_id = c.reply_to_user_id
   where c.entry_id = p_entry_id
   order by c.created_at asc;
end $function$;

revoke all on function public.list_journal_comments_v2(uuid) from public, anon;
grant execute on function public.list_journal_comments_v2(uuid) to authenticated, service_role;

-- 댓글 · 답글 알림 (DB 의 2026-10-27 정의 위에 — 답글 갈래만 더함)
create or replace function public._community_comment_notify()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_owner uuid;
  v_name text;
  v_body text;
  v_link text;
  v_to uuid;
  v_push boolean;
  v_nid uuid;
begin
  if public._community_notify_since() is null then
    return null;
  end if;
  select e.user_id into v_owner from public.champion_journal_entries e where e.id = new.entry_id;
  if v_owner is null then
    return null;
  end if;
  select coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '동료')
    into v_name from public.profiles p where p.user_id = new.commenter_user_id;
  v_body := '“' || left(new.content, 60) || case when char_length(new.content) > 60 then '…' else '' end || '”';
  v_link := '/myboxer/community?entry=' || new.entry_id;

  -- 답글: 답글을 받은 사람에게 (2026-11-05)
  if new.parent_id is not null then
    v_to := coalesce(new.reply_to_user_id,
                     (select c.commenter_user_id from public.champion_journal_comments c where c.id = new.parent_id));
    if v_to is not null and v_to <> new.commenter_user_id
       and coalesce((select p.cheer_notify from public.profiles p where p.user_id = v_to), true)
       and public.community_can_view_entry(v_to, new.entry_id) then
      v_push := public._community_push_ok(v_to);
      v_nid := gen_random_uuid();
      insert into public.notifications (id, user_id, title, body, link, pushed_at)
      values (
        v_nid, v_to,
        '💬 ' || coalesce(v_name, '동료') || '님이 답글을 남겼어요',
        v_body, v_link,
        case when v_push then null else now() end
      );
      insert into public.community_notify_log (user_id, day, kind, pushed, notification_id)
      values (v_to, (now() at time zone 'Asia/Seoul')::date, 'comment', v_push, v_nid);
    end if;
  end if;

  -- 글쓴이에게 (예전 그대로 · 답글을 이미 받은 사람이면 한 번만)
  if v_owner = new.commenter_user_id or v_owner = v_to then
    return null;
  end if;
  if not coalesce((select p.cheer_notify from public.profiles p where p.user_id = v_owner), true) then
    return null;
  end if;
  v_push := public._community_push_ok(v_owner);
  v_nid := gen_random_uuid();
  insert into public.notifications (id, user_id, title, body, link, pushed_at)
  values (
    v_nid, v_owner,
    '💬 ' || coalesce(v_name, '동료') || '님이 댓글을 남겼어요',
    v_body, v_link,
    case when v_push then null else now() end
  );
  insert into public.community_notify_log (user_id, day, kind, pushed, notification_id)
  values (v_owner, (now() at time zone 'Asia/Seoul')::date, 'comment', v_push, v_nid);
  return null;
exception when others then
  -- 알림이 안 돼도 댓글은 절대 막지 않는다
  return null;
end $function$;
