-- 🧭 관장님 리드 가이드 · 관장님 이해 카드 — 성향 2단계 (2026-11-26 대표님 「관장님들은 코치님들을 어떻게 리드하는 것이 좋을지 알려 주자 ·
--    코치님들도 관장님의 성향을 알고 서로 오해 없이 이해할 수 있도록」)
--   코치 성향 카드(coach_mind_profiles · 20261105124544_coach_mind.sql)를 그대로 쓴다 — 관장님(대표님 · 지점장님 · 관장님)도 같은 카드를 쓴다.
--   · 관장님 이해 카드(team_card) = 관장님 본인 카드 → 오삼코치(Edge Function coach-lead action team)가 만든 글. 본인이 share_team 을 켜야
--     그 지점 지도진(대표님 카드는 모든 지점)에게 보인다. 만들고 먼저 본인이 읽어 본 뒤 켠다(기본 꺼짐).
--   · 리드 가이드(coach_lead_cards) = 관장님 카드 + 코치님 카드 → 그 관장님만 본다. 대표님은 카드를 원래 다 보므로 늘 ·
--     지점장님 · 관장님은 코치님이 share_lead 를 켰을 때만(카드 내용이 담긴 글이라 — 기본 꺼짐 · 끄면 바로 안 보인다).
--   · 카드를 고치면(updated_at) 그 뒤로는 '다시 만들기'를 권한다(stale) · 카드를 지우면(consent_at 없음) 두 글 모두 안 보인다.
--   · 평가 · 급여 · 근무에 쓰지 않는다는 약속은 그대로. 지우는 문장 없음 · 기존 함수 · 표는 그대로(칸만 더함).

alter table public.coach_mind_profiles
  add column if not exists share_lead boolean not null default false,
  add column if not exists share_team boolean not null default false,
  add column if not exists team_card jsonb,
  add column if not exists team_card_at timestamptz;

create table if not exists public.coach_lead_cards (
  leader_id uuid not null references auth.users(id) on delete cascade,
  coach_id uuid not null references auth.users(id) on delete cascade,
  branch_name text,
  body jsonb not null,
  leader_at timestamptz not null,
  coach_at timestamptz not null,
  model text,
  created_at timestamptz not null default now(),
  primary key (leader_id, coach_id)
);
alter table public.coach_lead_cards enable row level security;
revoke all on public.coach_lead_cards from anon, authenticated;

-- 이 사람이 '이끄는 분'인가 + 그 사람의 공개 이해 카드
create or replace function public._coach_lead_team_view(r public.coach_mind_profiles)
returns jsonb language sql stable set search_path = public as $$
  select case when r.consent_at is not null and r.team_card is not null and r.team_card_at >= r.updated_at
              then r.team_card end;
$$;
revoke all on function public._coach_lead_team_view(public.coach_mind_profiles) from public, anon, authenticated;

create or replace function public.coach_lead_state(p_branch text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_direct boolean;
  v_hq boolean;
  r_me public.coach_mind_profiles;
  v_leaders jsonb;
  v_coaches jsonb := '[]'::jsonb;
begin
  if not public._strategy_staff(v_uid) then return jsonb_build_object('staff', false); end if;
  v_branch := public._strategy_scope(v_uid, p_branch);
  v_direct := public._strategy_can_direct(v_uid);
  v_hq := public._strategy_hq(v_uid);
  select * into r_me from public.coach_mind_profiles where coach_id = v_uid;

  -- 관장님 이해 카드 — 그 지점의 이끄는 분 + 대표님, 본인이 켠 것만
  select coalesce(jsonb_agg(jsonb_build_object('person', public._strategy_display(m.coach_id),
                                               'card', public._coach_lead_team_view(m),
                                               'card_at', m.team_card_at)
                            order by public._strategy_hq(m.coach_id) desc, m.team_card_at desc), '[]'::jsonb)
    into v_leaders
    from public.coach_mind_profiles m
   where m.coach_id <> v_uid
     and m.share_team
     and public._coach_lead_team_view(m) is not null
     and public._strategy_can_direct(m.coach_id)
     and (public._strategy_hq(m.coach_id) or m.coach_id in (select s.user_id from public._strategy_branch_staff(v_branch) s));

  -- 리드 가이드 — 관장님만, 그 지점 코치님마다
  if v_direct then
    select coalesce(jsonb_agg(x.o order by x.has_mind desc, x.nm), '[]'::jsonb) into v_coaches
      from (
        select (m.consent_at is not null) as has_mind,
               coalesce((public._strategy_display(s.user_id))->>'name', '') as nm,
               jsonb_build_object(
                 'person', public._strategy_display(s.user_id),
                 'has_mind', m.consent_at is not null,
                 'allowed', m.consent_at is not null and (v_hq or m.share_lead),
                 'guide', case when m.consent_at is not null and (v_hq or m.share_lead) and r_me.consent_at is not null then c.body end,
                 'guide_at', case when m.consent_at is not null and (v_hq or m.share_lead) and r_me.consent_at is not null then c.created_at end,
                 'stale', c.body is not null and (c.leader_at < r_me.updated_at or c.coach_at < m.updated_at)
               ) as o
          from public._strategy_branch_staff(v_branch) s
          left join public.coach_mind_profiles m on m.coach_id = s.user_id
          left join public.coach_lead_cards c on c.leader_id = v_uid and c.coach_id = s.user_id
         where s.user_id <> v_uid and not public._strategy_hq(s.user_id)
      ) x;
  end if;

  return jsonb_build_object(
    'staff', true,
    'branch', v_branch,
    'can_direct', v_direct,
    'hq', v_hq,
    'ai', exists (select 1 from public.internal_sync_config c where c.key = 'coach_feedback_ai' and c.value = 'on'),
    'me', jsonb_build_object(
      'has_mind', r_me.consent_at is not null,
      'share_lead', coalesce(r_me.share_lead, false),
      'share_team', coalesce(r_me.share_team, false),
      'team_card', case when r_me.consent_at is not null then r_me.team_card end,
      'team_card_at', case when r_me.consent_at is not null then r_me.team_card_at end,
      'team_stale', r_me.team_card is not null and r_me.team_card_at < r_me.updated_at),
    'leaders', v_leaders,
    'coaches', v_coaches
  );
end $$;
revoke all on function public.coach_lead_state(text) from public, anon;
grant execute on function public.coach_lead_state(text) to authenticated;

-- 허락 스위치 — null 은 그대로. 이해 카드 보여 주기는 이끄는 분만 · 카드가 있어야
create or replace function public.coach_lead_share_set(p_lead boolean default null, p_team boolean default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); r public.coach_mind_profiles;
begin
  if not public._strategy_staff(v_uid) then raise exception '코치진만 쓸 수 있어요'; end if;
  select * into r from public.coach_mind_profiles where coach_id = v_uid for update;
  if r.coach_id is null or r.consent_at is null then raise exception '성향 카드를 먼저 저장해 주세요'; end if;
  if p_team is true then
    if not public._strategy_can_direct(v_uid) then raise exception '이해 카드는 관장님만 보여 줄 수 있어요'; end if;
    if public._coach_lead_team_view(r) is null then raise exception '이해 카드를 먼저 만들어 주세요'; end if;
  end if;
  update public.coach_mind_profiles
     set share_lead = coalesce(p_lead, share_lead),
         share_team = coalesce(p_team, share_team)
   where coach_id = v_uid
   returning * into r;
  return jsonb_build_object('share_lead', r.share_lead, 'share_team', r.share_team);
end $$;
revoke all on function public.coach_lead_share_set(boolean, boolean) from public, anon;
grant execute on function public.coach_lead_share_set(boolean, boolean) to authenticated;
