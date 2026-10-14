-- 회원 설문(만족도 조사·고객의 소리) 앱 안으로 (2026-10-15 대표님: "일일경영리포트에서 QR로 하는 설문·만족도 조사를 앱에 넣어줘")
-- 응답 자체는 지금처럼 일일경영리포트(153-boxing-os) 쪽에 저장된다 — 앱은 같은 공개 경로로 제출만 한다.
-- 이 DB 에는 ① 지점별 설문 주소(slug) ② 참여 보상 기록만 둔다. 답변 내용은 여기 남기지 않는다(익명 유지).
-- 새 지점 설문을 열려면: 경영리포트 CRM 에서 QR/의견함을 만들고 branch_survey_links 에 한 줄 추가.
-- 적용: mcp apply_migration 으로 2026-10-15 운영 반영 완료. 이 파일은 기록용.

create table if not exists public.branch_survey_links (
  branch_name   text primary key,
  feedback_slug text,   -- 경영리포트 '고객의 소리함' 채널 slug  (/f/:slug)
  survey_slug   text,   -- 경영리포트 만족도 조사 QR slug       (/s/:slug)
  updated_at    timestamptz not null default now()
);
alter table public.branch_survey_links enable row level security;
revoke all on public.branch_survey_links from anon;
create policy branch_survey_links_read on public.branch_survey_links
  for select to authenticated using (true);

insert into public.branch_survey_links (branch_name, feedback_slug, survey_slug)
values ('153복싱짐 선릉역점', 'b152a5224334', 'f48237446ee13d295a')
on conflict (branch_name) do update set feedback_slug = excluded.feedback_slug,
  survey_slug = excluded.survey_slug, updated_at = now();

-- 참여 보상: 만족도 조사 +300 · 고객의 소리 +100 — 종류별 KST 기준 한 달 한 번. 지도진·관리 계정 제외.
create table if not exists public.survey_rewards (
  user_id    uuid not null,
  kind       text not null check (kind in ('satisfaction', 'feedback')),
  month      date not null,
  amount     integer not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, kind, month)
);
alter table public.survey_rewards enable row level security;
revoke all on public.survey_rewards from anon;
create policy survey_rewards_own_read on public.survey_rewards
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.claim_survey_reward(p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _month date := date_trunc('month', (now() at time zone 'Asia/Seoul'))::date;
  _amount integer;
begin
  if _uid is null then raise exception 'Not authorized'; end if;
  if p_kind not in ('satisfaction', 'feedback') then
    return jsonb_build_object('granted', false, 'reason', 'bad_kind');
  end if;
  if exists (select 1 from profiles where user_id = _uid and is_staff is true)
     or exists (select 1 from user_roles where user_id = _uid
                  and role in ('super_admin', 'admin', 'branch_manager', 'coach')) then
    return jsonb_build_object('granted', false, 'reason', 'staff');
  end if;
  _amount := case p_kind when 'satisfaction' then 300 else 100 end;
  insert into survey_rewards (user_id, kind, month, amount)
  values (_uid, p_kind, _month, _amount)
  on conflict do nothing;
  if not found then
    return jsonb_build_object('granted', false, 'reason', 'already', 'amount', _amount);
  end if;
  perform public.grant_gems(_uid, _amount,
    case p_kind when 'satisfaction' then '만족도 조사 참여 보상' else '고객의 소리 참여 보상' end);
  return jsonb_build_object('granted', true, 'amount', _amount);
end;
$$;
revoke all on function public.claim_survey_reward(text) from public, anon;
grant execute on function public.claim_survey_reward(text) to authenticated;

create or replace function public.get_my_survey_rewards()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'satisfaction', exists (select 1 from survey_rewards where user_id = auth.uid() and kind = 'satisfaction'
                              and month = date_trunc('month', (now() at time zone 'Asia/Seoul'))::date),
    'feedback',     exists (select 1 from survey_rewards where user_id = auth.uid() and kind = 'feedback'
                              and month = date_trunc('month', (now() at time zone 'Asia/Seoul'))::date)
  )
$$;
revoke all on function public.get_my_survey_rewards() from public, anon;
grant execute on function public.get_my_survey_rewards() to authenticated;
