-- 기록 확인 대기 — 「다니고 있어요」에서 명단을 못 찾은 회원의 데스크 확인 요청 (2026-11-22 대표님 「확인대기 가자」)
--
-- 흐름: 회원(로그인 전) → Edge Function member-lookup-request(create) 가 이 표에 한 줄 + 대표님 · 그 지점 지점장 알림
--   → 지점장 · 코치가 「가입 승인」 칸에서 회원을 찾아(member_lookup_candidates) 본인 확인 뒤 연결(member_lookup_resolve 'found')
--   → 회원 기기가 status 로 물으면 Edge Function 이 10분 이어받기 표(_shared/linkTicket.ts)를 주고, 카카오로 들어오면 기록이 합쳐진다.
-- 회원 쪽에는 이름 · 레벨 같은 회원 정보가 가지 않는다(상태 · 지점의 짧은 답만). 요청 열쇠는 해시만 저장한다.
-- 기존 표 · 함수는 건드리지 않는다. 줄을 지우는 문장 없음.

create table if not exists public.member_lookup_requests (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  branch_name     text not null,
  name            text not null check (char_length(name) between 1 and 40),
  phone           text not null check (phone ~ '^0[0-9]{9,10}$'),
  birth_date      date,
  memo            text check (memo is null or char_length(memo) <= 200),
  key_hash        text not null unique,
  ip_hash         text,
  status          text not null default 'pending' check (status in ('pending', 'found', 'not_member', 'closed')),
  target_user_id  uuid references auth.users(id) on delete set null,
  reply           text check (reply is null or char_length(reply) <= 200),
  resolved_by     uuid references auth.users(id) on delete set null,
  resolved_at     timestamptz,
  seen_at         timestamptz
);

create index if not exists member_lookup_requests_branch_idx on public.member_lookup_requests (branch_name, status, created_at desc);
create index if not exists member_lookup_requests_phone_idx on public.member_lookup_requests (phone, created_at desc);
create index if not exists member_lookup_requests_ip_idx on public.member_lookup_requests (ip_hash, created_at desc);

alter table public.member_lookup_requests enable row level security;
revoke all on public.member_lookup_requests from anon, authenticated;

-- 요청이 들어오면 대표님 · 관리자 · 그 지점 지점장께 알림(밤 10시 ~ 아침 7시는 알림함에만 — _market_notify 와 같은 규칙)
create or replace function public._member_lookup_notify(p_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.member_lookup_requests%rowtype;
  v_h int := extract(hour from now() at time zone 'Asia/Seoul')::int;
  v_n int := 0;
  v_uid uuid;
begin
  select * into r from public.member_lookup_requests where id = p_id;
  if not found then return 0; end if;
  for v_uid in
    select ur.user_id from public.user_roles ur where ur.role::text in ('super_admin', 'admin')
    union
    select p.user_id from public.profiles p
     where p.branch_name = r.branch_name and p.user_id is not null
       and public.has_role(p.user_id, 'branch_manager')
  loop
    insert into public.notifications (user_id, title, body, link, pushed_at)
    values (v_uid,
            '🔎 기록 확인 요청 · ' || left(r.name, 20),
            left(regexp_replace(r.branch_name, '^153복싱짐\s*', '') || ' · 「다니고 있어요」에서 명단을 못 찾았어요. 본인 확인 뒤 연결해 주세요', 300),
            '/manager?tab=inbox',
            case when v_h >= 22 or v_h < 7 then now() end);
    v_n := v_n + 1;
  end loop;
  return v_n;
exception when others then
  return v_n;
end $$;

revoke all on function public._member_lookup_notify(uuid) from public, anon, authenticated;
grant execute on function public._member_lookup_notify(uuid) to service_role;

-- 운영진이 볼 요청 — 확인 기다림 전부 + 처리한 지 14일 안의 것. 범위 = _goods_staff_scope(대표님 · 관리자 = 전 지점)
create or replace function public.member_lookup_requests_list()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_scope text := public._goods_staff_scope();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', r.id,
             'created_at', r.created_at,
             'branch_name', r.branch_name,
             'name', r.name,
             'phone', r.phone,
             'birth_date', r.birth_date,
             'memo', r.memo,
             'status', r.status,
             'reply', r.reply,
             'resolved_at', r.resolved_at,
             'seen_at', r.seen_at,
             'resolver', (select coalesce(nullif(p.name, ''), p.nickname) from public.profiles p where p.user_id = r.resolved_by),
             'target_name', (select p.name from public.profiles p where p.user_id = r.target_user_id)
           ) order by (r.status = 'pending') desc, r.created_at desc)
      from public.member_lookup_requests r
     where (v_scope = '*' or r.branch_name = v_scope)
       and (r.status = 'pending' or r.resolved_at > now() - interval '14 days')
  ), '[]'::jsonb);
end $$;

revoke all on function public.member_lookup_requests_list() from public, anon;
grant execute on function public.member_lookup_requests_list() to authenticated;

-- 연결할 수 있는 회원 찾기 — 아직 넘겨받지 않았고 한 번도 로그인하지 않은 체육관 회원 계정만(셀프 넘겨받기와 같은 대상).
--   요청한 이름 · 번호 끝 4자리 · 생년월일 중 하나라도 같으면 후보. p_q 를 주면 그 이름(일부)으로도 찾는다.
create or replace function public.member_lookup_candidates(p_id uuid, p_q text default null)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_scope text := public._goods_staff_scope();
  r public.member_lookup_requests%rowtype;
  v_name text;
  v_q text := nullif(regexp_replace(coalesce(p_q, ''), '\s', '', 'g'), '');
begin
  select * into r from public.member_lookup_requests where id = p_id;
  if not found or (v_scope <> '*' and r.branch_name <> v_scope) then
    raise exception '요청을 찾을 수 없어요' using errcode = 'P0002';
  end if;
  if v_q is not null and char_length(v_q) > 20 then v_q := left(v_q, 20); end if;
  v_name := regexp_replace(lower(r.name), '\s', '', 'g');
  return coalesce((
    select jsonb_agg(c order by c->>'score' desc, c->>'name')
      from (
        select jsonb_build_object(
                 'user_id', p.user_id,
                 'name', p.name,
                 'phone', p.phone_number,
                 'birth_date', p.birth_date,
                 'branch_name', p.branch_name,
                 'membership_end', p.membership_end,
                 'score', (case when regexp_replace(lower(coalesce(p.name, '')), '\s', '', 'g') = v_name then 4 else 0 end)
                        + (case when right(p.phone_number, 4) = right(r.phone, 4) then 2 else 0 end)
                        + (case when r.birth_date is not null and regexp_replace(coalesce(p.birth_date, ''), '[^0-9]', '', 'g') = to_char(r.birth_date, 'YYYYMMDD') then 2 else 0 end)
               ) c
          from public.profiles p
          join auth.users au on au.id = p.user_id
         where p.must_change_credentials is true
           and p.merged_into is null
           and coalesce(p.is_staff, false) = false
           and p.phone_number is not null
           and au.last_sign_in_at is null
           and (v_scope = '*' or p.branch_name = v_scope)
           and (
             regexp_replace(lower(coalesce(p.name, '')), '\s', '', 'g') = v_name
             or right(p.phone_number, 4) = right(r.phone, 4)
             or (r.birth_date is not null and regexp_replace(coalesce(p.birth_date, ''), '[^0-9]', '', 'g') = to_char(r.birth_date, 'YYYYMMDD'))
             or (v_q is not null and regexp_replace(lower(coalesce(p.name, '')), '\s', '', 'g') like '%' || lower(v_q) || '%')
           )
         limit 12
      ) s
  ), '[]'::jsonb);
end $$;

revoke all on function public.member_lookup_candidates(uuid, text) from public, anon;
grant execute on function public.member_lookup_candidates(uuid, text) to authenticated;

-- 처리 — found(그 회원 계정으로 연결 · 본인 확인 뒤) · not_member(명단에 없어요 → 신규 가입 안내) · closed(데스크에서 직접 처리)
create or replace function public.member_lookup_resolve(p_id uuid, p_status text, p_target uuid default null, p_reply text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_scope text := public._goods_staff_scope();
  r public.member_lookup_requests%rowtype;
  v_reply text := nullif(btrim(coalesce(p_reply, '')), '');
  v_ok boolean;
begin
  select * into r from public.member_lookup_requests where id = p_id for update;
  if not found or (v_scope <> '*' and r.branch_name <> v_scope) then
    raise exception '요청을 찾을 수 없어요' using errcode = 'P0002';
  end if;
  if p_status not in ('found', 'not_member', 'closed') then
    raise exception '처리 방법을 골라 주세요' using errcode = '22023';
  end if;
  if v_reply is not null and char_length(v_reply) > 200 then
    raise exception '답은 200자까지예요' using errcode = '22023';
  end if;
  if p_status = 'found' then
    if p_target is null then
      raise exception '연결할 회원을 골라 주세요' using errcode = '22023';
    end if;
    select exists (
      select 1 from public.profiles p join auth.users au on au.id = p.user_id
       where p.user_id = p_target
         and p.must_change_credentials is true
         and p.merged_into is null
         and coalesce(p.is_staff, false) = false
         and p.phone_number is not null
         and au.last_sign_in_at is null
         and (v_scope = '*' or p.branch_name = v_scope)
    ) into v_ok;
    if not v_ok then
      raise exception '이 회원은 연결할 수 없어요 (이미 앱을 쓰고 있거나 다른 지점이에요)' using errcode = '22023';
    end if;
  end if;
  update public.member_lookup_requests
     set status = p_status,
         target_user_id = case when p_status = 'found' then p_target end,
         reply = v_reply,
         resolved_by = v_uid,
         resolved_at = now(),
         seen_at = null
   where id = p_id;
  return jsonb_build_object('ok', true, 'status', p_status);
end $$;

revoke all on function public.member_lookup_resolve(uuid, text, uuid, text) from public, anon;
grant execute on function public.member_lookup_resolve(uuid, text, uuid, text) to authenticated;
