-- 오류 신고 받은함 (2026-10-18 대표님: "앱 불편·오류 신고 … 회원님들이 보낸 신고 자세히 볼 수 있게 · 알림에서도 클릭하면 그 메뉴로 바로").
--   · 화면: src/pages/FeedbackPage.tsx — 본사(super_admin·admin)에게 '받은 신고' 탭. /feedback?inbox=1&id=<신고> 로 바로 열린다.
--   · 상태: new(새 신고) → seen(확인함) → fixed(고쳤어요). 누가·언제 바꿨는지 handled_by · handled_at.
--   · 알림: 신고가 들어오면 대표님(super_admin)에게 가는 알림에 바로 가기 링크를 넣는다 (예전엔 링크가 없어 눌러도 그대로였다).
--     닉네임이 빈 글자('')인 회원은 ": 내용" 처럼 이름이 빠져 보였다 → 이름 → '회원' 순으로 채운다.

alter table public.app_feedback
  add column if not exists handled_by uuid,
  add column if not exists handled_at timestamptz;

create index if not exists app_feedback_created_idx on public.app_feedback (created_at desc);

create or replace function public._is_hq_user(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = p_user and role in ('super_admin', 'admin'));
$$;
revoke all on function public._is_hq_user(uuid) from public, anon;
grant execute on function public._is_hq_user(uuid) to authenticated;

-- 받은 신고 목록 — 보낸 회원(이름·닉네임·지점·사진) + 처리한 사람까지 한 번에
create or replace function public.get_app_feedback_inbox(p_limit int default 100)
returns json
language plpgsql
stable
security definer
set search_path = public
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
        'all', count(*)
      ) from public.app_feedback f
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
          coalesce(nullif(btrim(h.name), ''), nullif(btrim(h.nickname), '')) as handled_by_name
        from public.app_feedback f
        left join public.profiles p on p.user_id = f.user_id
        left join public.profiles h on h.user_id = f.handled_by
        order by f.created_at desc
        limit greatest(1, least(coalesce(p_limit, 100), 300))
      ) x
    ), '[]'::json)
  );
end;
$$;
revoke all on function public.get_app_feedback_inbox(int) from public, anon;
grant execute on function public.get_app_feedback_inbox(int) to authenticated;

-- 상태 바꾸기 — 확인함 · 고쳤어요 · 다시 새 신고로
create or replace function public.set_app_feedback_status(p_id uuid, p_status text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public._is_hq_user(v_uid) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_status not in ('new', 'seen', 'fixed') then
    raise exception 'bad_status' using errcode = '22023';
  end if;

  update public.app_feedback
     set status = p_status,
         handled_by = case when p_status = 'new' then null else v_uid end,
         handled_at = case when p_status = 'new' then null else now() end
   where id = p_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return json_build_object('ok', true, 'id', p_id, 'status', p_status);
end;
$$;
revoke all on function public.set_app_feedback_status(uuid, text) from public, anon;
grant execute on function public.set_app_feedback_status(uuid, text) to authenticated;

-- 신고 알림 — 바로 가기 링크 + 이름 채우기
create or replace function public.notify_app_feedback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _nick text;
  _admin record;
begin
  select coalesce(nullif(btrim(nickname), ''), nullif(btrim(name), ''))
    into _nick
    from public.profiles where user_id = new.user_id;
  for _admin in
    select distinct ur.user_id from public.user_roles ur where ur.role = 'super_admin'
  loop
    insert into public.notifications (user_id, title, body, link)
    values (
      _admin.user_id,
      '📮 앱 ' || new.category || ' 신고',
      coalesce(_nick, '회원') || ': ' || left(new.content, 120),
      '/feedback?inbox=1&id=' || new.id
    );
  end loop;
  return new;
end;
$$;

-- 지난 신고 알림에도 바로 가기 링크를 채우고, 빠졌던 이름을 넣는다 (같은 신고 = 같은 제목 · 5초 안)
update public.notifications n
   set link = '/feedback?inbox=1&id=' || f.id,
       body = case
                when n.body like ': %'
                  then coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '회원') || n.body
                else n.body
              end
  from public.app_feedback f
  left join public.profiles p on p.user_id = f.user_id
 where n.link is null
   and n.title = '📮 앱 ' || f.category || ' 신고'
   and abs(extract(epoch from (n.created_at - f.created_at))) < 5;
