-- 유효회원 전체 메시지 (2026-10-15 대표님: "유효회원 전체한테 앱에서 메시지 보내는 기능 — 나와 지점장만")
--   유효회원 = 가입 승인 · 지도진/테스트 계정 아님 · 수강권 종료일(membership_end) 또는 PT 기간(pt_until)이 오늘(KST) 이후
--   보내기 = 알림함(🔔)에 넣고, 휴대폰 알림을 켠 회원에게는 푸시도 간다 (notifications 의 기존 트리거).
--   보낼 수 있는 사람: 전체관리자(모든 지점 또는 한 지점) · 지점장(자기 지점만). 코치는 못 보낸다.
--   보낸 기록은 member_broadcasts 에 남긴다 (누가·언제·몇 명). 같은 제목을 10분 안에 또 보내면 막는다(두 번 누름 방지).

create table if not exists public.member_broadcasts (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null,
  branch_name text,            -- null = 켜진 지점 전체
  title text not null,
  body text,
  link text,
  recipients integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists member_broadcasts_created_idx on public.member_broadcasts (created_at desc);
alter table public.member_broadcasts enable row level security;
do $$ begin
  create policy "broadcast history for managers" on public.member_broadcasts for select to authenticated
    using (
      public.has_role((select auth.uid()), 'super_admin'::app_role)
      or public.has_role((select auth.uid()), 'admin'::app_role)
      or (public.has_role((select auth.uid()), 'branch_manager'::app_role)
          and branch_name = (select p.branch_name from public.profiles p where p.user_id = (select auth.uid())))
    );
exception when duplicate_object then null; end $$;

/** 보낼 수 있는지 + 실제 대상 지점 (null = 전체). 안 되면 예외 */
create or replace function public._broadcast_scope(p_branch text)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  v_my_branch text;
  v_branch text := nullif(btrim(coalesce(p_branch, '')), '');
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  if public.has_role(auth.uid(), 'super_admin'::app_role) or public.has_role(auth.uid(), 'admin'::app_role) then
    return v_branch;
  end if;
  if public.has_role(auth.uid(), 'branch_manager'::app_role) then
    select branch_name into v_my_branch from public.profiles where user_id = auth.uid();
    if v_my_branch is null then raise exception '내 지점이 정해져 있지 않아요'; end if;
    if v_branch is not null and v_branch <> v_my_branch then raise exception '지점장은 우리 지점 회원에게만 보낼 수 있어요'; end if;
    return v_my_branch;
  end if;
  raise exception '전체 메시지는 대표님·지점장만 보낼 수 있어요';
end $$;
revoke all on function public._broadcast_scope(text) from public, anon;

/** 유효회원 id 목록 */
create or replace function public._broadcast_targets(p_branch text)
returns table(user_id uuid) language sql stable security definer set search_path = public as $$
  select p.user_id
    from public.profiles p
   where p.is_approved = true
     and coalesce(p.is_staff, false) = false
     and not coalesce(p.is_test_account, false)
     and (p.membership_end >= (now() at time zone 'Asia/Seoul')::date
          or p.pt_until >= (now() at time zone 'Asia/Seoul')::date)
     and (case when p_branch is null then public.is_branch_visible(p.branch_name) else p.branch_name = p_branch end)
     and not exists (select 1 from public.user_roles ur
                      where ur.user_id = p.user_id and ur.role in ('super_admin', 'admin', 'branch_manager', 'coach'));
$$;
revoke all on function public._broadcast_targets(text) from public, anon, authenticated;

/** 보내기 전 '몇 명에게 가요' 미리 보기 */
create or replace function public.count_broadcast_targets(p_branch text default null)
returns integer language plpgsql stable security definer set search_path = public as $$
declare v_scope text;
begin
  v_scope := public._broadcast_scope(p_branch);
  return (select count(*)::int from public._broadcast_targets(v_scope));
end $$;
revoke all on function public.count_broadcast_targets(text) from public, anon;
grant execute on function public.count_broadcast_targets(text) to authenticated;

/** 보내기 — 돌려주는 값 = 받은 회원 수 */
create or replace function public.send_member_broadcast(p_branch text, p_title text, p_body text default null, p_link text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_scope text;
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_link text := nullif(btrim(coalesce(p_link, '')), '');
  v_count integer;
begin
  v_scope := public._broadcast_scope(p_branch);
  if char_length(v_title) = 0 then raise exception '제목을 입력해 주세요'; end if;
  if char_length(v_title) > 100 then raise exception '제목은 100자까지예요'; end if;
  if v_body is not null and char_length(v_body) > 1000 then raise exception '내용은 1,000자까지예요'; end if;
  if v_link is not null and not (char_length(v_link) <= 300 and v_link ~ '^/([^/\\[:space:]][^\\[:space:]]*)?$') then
    raise exception '열 화면 주소가 잘못됐어요';
  end if;
  if exists (select 1 from public.member_broadcasts b
              where b.sender_id = auth.uid() and b.title = v_title
                and b.branch_name is not distinct from v_scope
                and b.created_at > now() - interval '10 minutes') then
    raise exception '같은 메시지를 방금 보냈어요 (10분 뒤에 다시 보낼 수 있어요)';
  end if;

  insert into public.notifications (user_id, title, body, link)
  select t.user_id, v_title, v_body, v_link from public._broadcast_targets(v_scope) t;
  get diagnostics v_count = row_count;

  insert into public.member_broadcasts (sender_id, branch_name, title, body, link, recipients)
  values (auth.uid(), v_scope, v_title, v_body, v_link, v_count);
  return v_count;
end $$;
revoke all on function public.send_member_broadcast(text, text, text, text) from public, anon;
grant execute on function public.send_member_broadcast(text, text, text, text) to authenticated;
