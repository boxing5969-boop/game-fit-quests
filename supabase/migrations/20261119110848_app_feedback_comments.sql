-- 오류 신고 댓글 · 내 신고 (2026-11-11 대표님 「마이복서 153 오류신고에 댓글 남길수있게해줘」 → 2026-11-19 다시 만들어 올림 · 대표님 「올리지」)
--
--   · 신고 하나 아래에서 운영진(전체관리자 · 관리자 = _is_hq_user)과 신고한 회원이 댓글을 주고받는다. 다른 회원은 못 본다.
--   · 운영진이 쓰면 → 신고한 회원에게 알림('/feedback?mine=1&id=<신고>' — 오류 신고 「내 신고」 탭에서 그 신고가 열린다)
--     회원이 쓰면  → 전체관리자(super_admin) + 그 신고를 처리했거나 댓글을 단 운영진에게 알림('/feedback?inbox=1&id=<신고>')
--     밤 10시 ~ 아침 8시(한국)는 알림함에만(pushed_at — 휴대폰 알림 없음)
--   · 운영진이 '새 신고'에 답글을 남기면 그 신고는 '확인함'이 된다(회원 화면 '확인 중').
--   · 회원은 신고를 보내기만 하고 다시 볼 곳이 없었다 → 「내 신고」(get_my_app_feedback): 내가 보낸 신고 · 처리 상태 · 새 답글.
--   · 지우기는 줄을 남긴다(removed_at · 글 비움) — 목록 · 숫자에서 빠진다. 줄을 지우는 문장은 없다.
--   · 표는 직접 읽기·쓰기 막음 — 아래 함수로만. 하루 한도: 회원 20개 · 운영진 100개(지운 댓글도 센다).
--   · 새 표 1 · 새 칸 1(app_feedback.member_read_at) · 새 함수 5(안쪽 1) · 바꾼 함수 1
--     (get_app_feedback_inbox — 운영 지금 정의 위에 댓글 수 · 마지막 댓글 · 회원 답글 대기 칸만 더함, 기존 칸 그대로).

create table if not exists public.app_feedback_comments (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.app_feedback(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  is_staff boolean not null default false,
  body text not null default '',
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references auth.users(id) on delete set null,
  constraint app_feedback_comments_body_chk check (
    char_length(body) <= 1000 and (removed_at is not null or char_length(btrim(body)) >= 1)
  )
);
create index if not exists app_feedback_comments_feedback_idx on public.app_feedback_comments (feedback_id, created_at);
create index if not exists app_feedback_comments_user_idx on public.app_feedback_comments (user_id, created_at desc);
alter table public.app_feedback_comments enable row level security;
revoke all on table public.app_feedback_comments from anon, authenticated;

-- 회원이 「내 신고」에서 그 신고의 댓글을 마지막으로 본 때 (새 답글 표시용)
alter table public.app_feedback add column if not exists member_read_at timestamptz;

-- 안쪽: 알림 한 통 — 밤 10시 ~ 아침 8시(한국)는 알림함에만
create or replace function public._app_feedback_notify(p_to uuid, p_title text, p_body text, p_link text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_h int := extract(hour from now() at time zone 'Asia/Seoul')::int;
begin
  if p_to is null then return; end if;
  insert into public.notifications (user_id, title, body, link, pushed_at)
  values (p_to, left(p_title, 120), left(coalesce(p_body, ''), 200), p_link, case when v_h >= 22 or v_h < 8 then now() end);
end;
$$;
revoke all on function public._app_feedback_notify(uuid, text, text, text) from public, anon, authenticated;

-- ① 댓글 목록 — 신고한 회원 또는 운영진만. 신고한 회원이 열면 '읽음'으로 남긴다.
create or replace function public.get_app_feedback_thread(p_feedback uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_hq boolean;
begin
  if v_uid is null then raise exception 'forbidden' using errcode = '42501'; end if;
  select f.user_id into v_owner from public.app_feedback f where f.id = p_feedback;
  if v_owner is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_hq := public._is_hq_user(v_uid);
  if v_owner <> v_uid and not v_hq then raise exception 'forbidden' using errcode = '42501'; end if;

  if v_owner = v_uid then
    update public.app_feedback set member_read_at = now() where id = p_feedback;
  end if;

  return json_build_object(
    'feedback_id', p_feedback,
    'comments', coalesce((
      select json_agg(x order by x.created_at)
      from (
        select
          c.id,
          c.body,
          c.created_at,
          c.is_staff,
          (c.user_id = v_uid) as mine,
          coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.nickname), ''), case when c.is_staff then '운영진' else '회원' end) as author_name,
          p.avatar_url as author_avatar
        from public.app_feedback_comments c
        left join public.profiles p on p.user_id = c.user_id
        where c.feedback_id = p_feedback and c.removed_at is null
        order by c.created_at
        limit 200
      ) x
    ), '[]'::json)
  );
end;
$$;
revoke all on function public.get_app_feedback_thread(uuid) from public, anon;
grant execute on function public.get_app_feedback_thread(uuid) to authenticated;

-- ② 댓글 쓰기 — 상대에게 알림
create or replace function public.add_app_feedback_comment(p_feedback uuid, p_body text)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_fb public.app_feedback%rowtype;
  v_hq boolean;
  v_text text := btrim(coalesce(p_body, ''));
  v_id uuid;
  v_at timestamptz;
  v_name text;
  v_to record;
begin
  if v_uid is null then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_fb from public.app_feedback where id = p_feedback;
  if v_fb.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_hq := public._is_hq_user(v_uid);
  if v_fb.user_id <> v_uid and not v_hq then raise exception 'forbidden' using errcode = '42501'; end if;
  if char_length(v_text) < 1 then return json_build_object('ok', false, 'error', 'empty'); end if;
  v_text := left(v_text, 1000);

  if (select count(*) from public.app_feedback_comments c
       where c.user_id = v_uid and c.created_at > now() - interval '1 day') >= (case when v_hq then 100 else 20 end) then
    return json_build_object('ok', false, 'error', 'too_many');
  end if;

  insert into public.app_feedback_comments (feedback_id, user_id, is_staff, body)
  values (p_feedback, v_uid, v_hq, v_text)
  returning id, created_at into v_id, v_at;

  if v_hq then
    -- 운영진이 새 신고에 답글 → '확인함'
    if v_fb.status = 'new' then
      update public.app_feedback set status = 'seen', handled_by = v_uid, handled_at = now()
       where id = p_feedback and status = 'new';
    end if;
    -- 운영진 → 신고한 회원
    if v_fb.user_id <> v_uid then
      perform public._app_feedback_notify(
        v_fb.user_id,
        case when v_fb.category = '제안' then '💬 보낸 제안에 답글이 왔어요' else '💬 ' || v_fb.category || ' 신고에 답글이 왔어요' end,
        left(v_text, 120),
        '/feedback?mine=1&id=' || p_feedback
      );
    end if;
  else
    -- 회원 → 전체관리자 + 이 신고를 처리했거나 댓글을 단 운영진
    select coalesce(nullif(btrim(nickname), ''), nullif(btrim(name), ''), '회원') into v_name
      from public.profiles where user_id = v_uid;
    for v_to in
      select distinct t.uid from (
        select ur.user_id as uid from public.user_roles ur where ur.role = 'super_admin'
        union
        select v_fb.handled_by
        union
        select c.user_id from public.app_feedback_comments c
         where c.feedback_id = p_feedback and c.is_staff and c.removed_at is null
      ) t
      where t.uid is not null and t.uid <> v_uid and public._is_hq_user(t.uid)
    loop
      perform public._app_feedback_notify(
        v_to.uid,
        case when v_fb.category = '제안' then '💬 제안에 회원 답글' else '💬 ' || v_fb.category || ' 신고에 회원 답글' end,
        coalesce(v_name, '회원') || ': ' || left(v_text, 120),
        '/feedback?inbox=1&id=' || p_feedback
      );
    end loop;
  end if;

  return json_build_object('ok', true, 'id', v_id, 'created_at', v_at);
end;
$$;
revoke all on function public.add_app_feedback_comment(uuid, text) from public, anon;
grant execute on function public.add_app_feedback_comment(uuid, text) to authenticated;

-- ③ 댓글 지우기 — 쓴 사람 또는 운영진 · 줄은 남기고 글을 비운다
create or replace function public.remove_app_feedback_comment(p_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.app_feedback_comments c
     set removed_at = now(), removed_by = v_uid, body = ''
   where c.id = p_id
     and c.removed_at is null
     and (c.user_id = v_uid or public._is_hq_user(v_uid));
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  return json_build_object('ok', true, 'id', p_id);
end;
$$;
revoke all on function public.remove_app_feedback_comment(uuid) from public, anon;
grant execute on function public.remove_app_feedback_comment(uuid) to authenticated;

-- ④ 내 신고 — 내가 보낸 신고 · 처리 상태 · 댓글 수 · 새 답글(운영진 댓글 중 아직 안 본 것)
create or replace function public.get_my_app_feedback(p_limit int default 30)
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'forbidden' using errcode = '42501'; end if;
  return (
    with mine as (
      select
        f.id, f.category, f.content, f.status, f.created_at, f.handled_at,
        (select count(*) from public.app_feedback_comments c
          where c.feedback_id = f.id and c.removed_at is null) as comment_count,
        (select count(*) from public.app_feedback_comments c
          where c.feedback_id = f.id and c.removed_at is null and c.is_staff and c.user_id <> v_uid
            and c.created_at > coalesce(f.member_read_at, '-infinity'::timestamptz)) as unread,
        (select max(c.created_at) from public.app_feedback_comments c
          where c.feedback_id = f.id and c.removed_at is null) as last_comment_at
      from public.app_feedback f
      where f.user_id = v_uid
      order by f.created_at desc
      limit greatest(1, least(coalesce(p_limit, 30), 100))
    )
    select json_build_object(
      'unread', coalesce((select sum(unread) from mine), 0),
      'items', coalesce((select json_agg(m order by m.created_at desc) from mine m), '[]'::json)
    )
  );
end;
$$;
revoke all on function public.get_my_app_feedback(int) from public, anon;
grant execute on function public.get_my_app_feedback(int) to authenticated;

-- ⑤ 받은 신고함 — 운영 지금 정의 그대로 + comment_count · last_comment_at · last_comment_staff · counts.waiting(마지막 댓글이 회원 것)
create or replace function public.get_app_feedback_inbox(p_limit integer default 100)
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public._is_hq_user(v_uid) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return json_build_object(
    'counts', (
      select json_build_object(
        'new', count(*) filter (where f.status = 'new'),
        'seen', count(*) filter (where f.status = 'seen'),
        'fixed', count(*) filter (where f.status = 'fixed'),
        'all', count(*),
        'waiting', count(*) filter (where lc.is_staff is false)
      )
      from public.app_feedback f
      left join lateral (
        select c.is_staff from public.app_feedback_comments c
         where c.feedback_id = f.id and c.removed_at is null
         order by c.created_at desc limit 1
      ) lc on true
    ),
    'items', coalesce((
      select json_agg(x order by x.created_at desc)
      from (
        select
          f.id,
          f.category,
          f.content,
          f.status,
          f.page_path,
          f.device_info,
          f.created_at,
          f.handled_at,
          f.user_id,
          coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.nickname), ''), '회원') as member_name,
          nullif(btrim(p.nickname), '') as member_nickname,
          p.branch_name as member_branch,
          p.avatar_url as member_avatar,
          coalesce(nullif(btrim(h.name), ''), nullif(btrim(h.nickname), '')) as handled_by_name,
          coalesce(cs.n, 0) as comment_count,
          cs.last_at as last_comment_at,
          lc.is_staff as last_comment_staff
        from public.app_feedback f
        left join public.profiles p on p.user_id = f.user_id
        left join public.profiles h on h.user_id = f.handled_by
        left join lateral (
          select count(*)::int as n, max(c.created_at) as last_at
            from public.app_feedback_comments c
           where c.feedback_id = f.id and c.removed_at is null
        ) cs on true
        left join lateral (
          select c.is_staff from public.app_feedback_comments c
           where c.feedback_id = f.id and c.removed_at is null
           order by c.created_at desc limit 1
        ) lc on true
        order by f.created_at desc
        limit greatest(1, least(coalesce(p_limit, 100), 300))
      ) x
    ), '[]'::json)
  );
end;
$$;
revoke all on function public.get_app_feedback_inbox(int) from public, anon;
grant execute on function public.get_app_feedback_inbox(int) to authenticated;
