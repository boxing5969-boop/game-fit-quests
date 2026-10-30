-- 만족도 조사 답변 달기 (2026-10-30 대표님: "만족도 조사 설문조사에도 답변을 달 수 있도록 하자" → 누가 보나요? "쓴 사람이 확인할 수 있게")
--
--   · 만족도 조사 응답은 일일경영리포트(153OS)에 익명으로 저장된다 — 그대로 둔다(본사 화면도 계속 익명).
--   · 앱에서 낸 설문은 '보낸 사람 표'(survey_receipts)에 응답 번호(153OS survey_responses.id)와 보낸 회원만 남긴다.
--     답한 내용은 여기 남기지 않는다(예전처럼 153OS 에만).
--   · 본사(전체관리자 · 관리자)가 받은 설문함에서 답변을 쓰면 survey_replies 에 저장 → 보낸 회원이 앱에서 보낸 설문이면
--     그 회원에게만 알림 + 설문 화면 '내가 보낸 설문'에 보인다. QR 로 낸 설문 · 예전 설문은 보낸 사람을 몰라 저장만 된다.
--   · 표 두 개는 직접 읽기·쓰기 막음 — 아래 함수로만.
--   · 새 표 2 · 새 함수 5 — 기존 함수는 바꾸지 않는다.

create table if not exists public.survey_receipts (
  response_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  branch_name text,
  survey_title text,
  submitted_at timestamptz not null default now()
);
create index if not exists survey_receipts_user_idx on public.survey_receipts (user_id, submitted_at desc);
alter table public.survey_receipts enable row level security;
revoke all on table public.survey_receipts from anon, authenticated;

create table if not exists public.survey_replies (
  response_id uuid primary key,
  reply text not null check (char_length(reply) between 1 and 1000),
  replied_by uuid references auth.users(id) on delete set null,
  replied_at timestamptz not null default now(),
  read_at timestamptz
);
alter table public.survey_replies enable row level security;
revoke all on table public.survey_replies from anon, authenticated;

-- ① 회원: 앱에서 만족도 조사를 낸 직후 — 이 응답을 내가 보냈다고 남긴다 (먼저 남긴 사람만)
create or replace function public.record_my_survey_receipt(p_response_id uuid, p_title text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if p_response_id is null then return jsonb_build_object('ok', false); end if;
  insert into public.survey_receipts (response_id, user_id, branch_name, survey_title)
  select p_response_id, v_uid, p.branch_name, nullif(left(trim(coalesce(p_title, '')), 80), '')
    from public.profiles p where p.user_id = v_uid
  on conflict (response_id) do nothing;
  return jsonb_build_object('ok', true);
end;
$$;

-- ② 본사: 답변 쓰기 · 고치기 · 지우기(빈 글) — 앱에서 보낸 설문이면 보낸 회원에게 알림
create or replace function public.reply_survey_response(p_response_id uuid, p_reply text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_text text := left(trim(coalesce(p_reply, '')), 1000);
  v_to uuid;
  v_title text;
begin
  if v_uid is null or not (public.has_role(v_uid, 'super_admin') or public.has_role(v_uid, 'admin')) then
    raise exception '본사만 답변을 달 수 있어요';
  end if;
  if p_response_id is null then raise exception '설문을 찾을 수 없어요'; end if;

  if v_text = '' then
    delete from public.survey_replies where response_id = p_response_id;
    return jsonb_build_object('ok', true, 'deleted', true, 'delivered', false);
  end if;

  insert into public.survey_replies (response_id, reply, replied_by, replied_at, read_at)
  values (p_response_id, v_text, v_uid, now(), null)
  on conflict (response_id) do update
    set reply = excluded.reply, replied_by = excluded.replied_by, replied_at = now(), read_at = null;

  select r.user_id, coalesce(r.survey_title, '만족도 조사') into v_to, v_title
    from public.survey_receipts r where r.response_id = p_response_id;
  if v_to is not null then
    insert into public.notifications (user_id, title, body, link)
    values (v_to, '💬 만족도 조사에 답변이 왔어요', left(v_text, 120), '/survey?mine=1');
  end if;

  return jsonb_build_object('ok', true, 'deleted', false, 'delivered', v_to is not null);
end;
$$;

-- ③ 본사: 받은 설문함에 보일 답변 — 응답 번호 여러 개를 한 번에 (앱에서 보냈는지 · 회원이 읽었는지도)
create or replace function public.get_survey_replies(p_ids uuid[])
returns table (response_id uuid, reply text, replied_at timestamptz, read_at timestamptz, from_app boolean)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not (public.has_role(v_uid, 'super_admin') or public.has_role(v_uid, 'admin')) then
    return;
  end if;
  return query
    select i.id, s.reply, s.replied_at, s.read_at, (r.response_id is not null)
      from unnest(coalesce(p_ids, '{}'::uuid[])) as i(id)
      left join public.survey_replies s on s.response_id = i.id
      left join public.survey_receipts r on r.response_id = i.id;
end;
$$;

-- ④ 회원: 내가 앱에서 보낸 만족도 조사 + 받은 답변 (최근 20개)
create or replace function public.get_my_survey_receipts()
returns table (response_id uuid, survey_title text, submitted_at timestamptz, reply text, replied_at timestamptz, read_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $$
  select r.response_id, coalesce(r.survey_title, '만족도 조사'), r.submitted_at, s.reply, s.replied_at, s.read_at
    from public.survey_receipts r
    left join public.survey_replies s on s.response_id = r.response_id
   where r.user_id = auth.uid()
   order by r.submitted_at desc
   limit 20;
$$;

-- ⑤ 회원: 받은 답변을 읽음으로
create or replace function public.mark_my_survey_replies_read()
returns integer
language sql
security definer
set search_path to 'public'
as $$
  with u as (
    update public.survey_replies s
       set read_at = now()
      from public.survey_receipts r
     where r.response_id = s.response_id and r.user_id = auth.uid() and s.read_at is null
    returning 1
  )
  select count(*)::int from u;
$$;

revoke all on function public.record_my_survey_receipt(uuid, text) from public, anon;
revoke all on function public.reply_survey_response(uuid, text) from public, anon;
revoke all on function public.get_survey_replies(uuid[]) from public, anon;
revoke all on function public.get_my_survey_receipts() from public, anon;
revoke all on function public.mark_my_survey_replies_read() from public, anon;
grant execute on function public.record_my_survey_receipt(uuid, text) to authenticated;
grant execute on function public.reply_survey_response(uuid, text) to authenticated;
grant execute on function public.get_survey_replies(uuid[]) to authenticated;
grant execute on function public.get_my_survey_receipts() to authenticated;
grant execute on function public.mark_my_survey_replies_read() to authenticated;
