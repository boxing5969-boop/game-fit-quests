-- 🧭 153 회원 성향 검사 · 코치용 지도 카드 1단계 (2026-11-25 대표님 「회원님들도 mbti 검사를 통해 유료급으로 최고 성능 프름프트 사용해서
--    만들자 코치님들이 회원님들의 성격 성향을 빠르게 파악하여 거기에 맞게 지도할수있도록」 → 「다음가자」)
--
--   새 표 1 · 새 함수만 (기존 것은 그대로 · 줄을 지우는 문장 없음):
--     member_style_profiles     회원마다 한 줄 — 답(answers) · 동의 시각 · 오삼코치 지도 카드(card · 점수 scores) · 지우기 = removed_at + 내용 비움
--     member_style_me()                 본인 — 답 · 카드 · 상태
--     member_style_save(p_answers)      본인 — 답 저장(키 모양 · 값 범위 검사) · 처음 한 번 챔피언 머니 3,000 · 카드는 비워서 다시 만들게
--     member_style_clear()              본인 — 답 · 카드 비움(동의 거둠)
--     member_style_for_coach(p_user)    그 회원 지점 지도진 · 대표님 — 지도 카드 · 점수 · 고른 답(원문 답은 안 줌)
--     member_style_branch(p_branch)     지도진 — 우리 지점 검사한 회원 목록(이름 · 한 줄)
--     member_style_set_card(...)        서버 키(Edge Function member-style)만 — 카드 · 점수 저장
--   보이는 범위: 답 원문 = 본인만 · 지도 카드 = 본인(일부) · 그 지점 지도진 · 대표님. 평가 · 등급에 쓰지 않는다(화면 안내).

create table if not exists public.member_style_profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  answers     jsonb not null default '{}'::jsonb,
  version     smallint not null default 1,
  consent_at  timestamptz,
  scores      jsonb,
  card        jsonb,
  card_at     timestamptz,
  card_model  text,
  rewarded_at timestamptz,
  removed_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.member_style_profiles enable row level security;
revoke all on public.member_style_profiles from anon, authenticated;

create or replace function public._member_style_json(p public.member_style_profiles, p_full boolean)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'answers', case when p_full then p.answers else null end,
    'scores', p.scores,
    'card', p.card,
    'card_at', p.card_at,
    'consent_at', p.consent_at,
    'updated_at', p.updated_at,
    'version', p.version
  );
$$;
revoke all on function public._member_style_json(public.member_style_profiles, boolean) from public, anon, authenticated;

create or replace function public.member_style_me()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare v_uid uuid := auth.uid(); p public.member_style_profiles;
begin
  if v_uid is null or not public._is_active_member(v_uid) then
    return jsonb_build_object('on', false);
  end if;
  select * into p from public.member_style_profiles where user_id = v_uid and removed_at is null and consent_at is not null;
  if not found then
    return jsonb_build_object('on', true, 'profile', null);
  end if;
  return jsonb_build_object('on', true, 'profile', public._member_style_json(p, true));
end;
$$;

create or replace function public.member_style_save(p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  k text; v jsonb; n int := 0;
  v_rewarded timestamptz;
begin
  if v_uid is null then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  if not public._is_active_member(v_uid) then raise exception '승인된 회원만 검사할 수 있어요' using errcode = '42501'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then raise exception '답 모양이 틀렸어요' using errcode = '22023'; end if;
  for k, v in select * from jsonb_each(p_answers) loop
    n := n + 1;
    if k !~ '^[a-z][a-z0-9_]{0,15}$' then raise exception '답 모양이 틀렸어요' using errcode = '22023'; end if;
    if jsonb_typeof(v) = 'number' then
      if (v::text)::numeric not in (1, 2, 3, 4, 5) then raise exception '답 모양이 틀렸어요' using errcode = '22023'; end if;
    elsif jsonb_typeof(v) = 'string' then
      if char_length(v #>> '{}') > 20 then raise exception '답 모양이 틀렸어요' using errcode = '22023'; end if;
    else
      raise exception '답 모양이 틀렸어요' using errcode = '22023';
    end if;
  end loop;
  if n < 30 or n > 60 then raise exception '모든 문항에 답해 주세요' using errcode = '22023'; end if;

  insert into public.member_style_profiles as m (user_id, answers, consent_at, scores, card, card_at, card_model, removed_at, updated_at)
  values (v_uid, p_answers, now(), null, null, null, null, null, now())
  on conflict (user_id) do update
    set answers = excluded.answers, consent_at = now(), scores = null, card = null, card_at = null,
        card_model = null, removed_at = null, updated_at = now()
  returning m.rewarded_at into v_rewarded;

  if v_rewarded is null then
    perform public.grant_gems(v_uid, 3000, '성향 검사 완료 보상');
    update public.member_style_profiles set rewarded_at = now() where user_id = v_uid;
    return jsonb_build_object('ok', true, 'reward', 3000);
  end if;
  return jsonb_build_object('ok', true, 'reward', 0);
end;
$$;

create or replace function public.member_style_clear()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  update public.member_style_profiles
     set answers = '{}'::jsonb, scores = null, card = null, card_at = null, card_model = null,
         consent_at = null, removed_at = now(), updated_at = now()
   where user_id = v_uid and removed_at is null;
  return jsonb_build_object('ok', true);
end;
$$;

-- 보는 사람: 대표님 · 관리자(_strategy_hq) 또는 그 회원 지점의 지도진(_strategy_branch_staff)
create or replace function public._member_style_can_view(p_viewer uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select p_viewer is not null and p_viewer <> p_user and (
    public._strategy_hq(p_viewer)
    or exists (
      select 1 from public.profiles m
       where m.user_id = p_user
         and m.branch_name is not null
         and p_viewer in (select s.user_id from public._strategy_branch_staff(m.branch_name) s)
    )
  );
$$;
revoke all on function public._member_style_can_view(uuid, uuid) from public, anon, authenticated;

create or replace function public.member_style_for_coach(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare v_uid uuid := auth.uid(); p public.member_style_profiles;
begin
  if not public._member_style_can_view(v_uid, p_user) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  select * into p from public.member_style_profiles where user_id = p_user and removed_at is null and consent_at is not null;
  if not found then
    return jsonb_build_object('ok', true, 'profile', null);
  end if;
  return jsonb_build_object('ok', true, 'profile', public._member_style_json(p, false));
end;
$$;

create or replace function public.member_style_branch(p_branch text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare v_uid uuid := auth.uid(); v_branch text;
begin
  if v_uid is null or not public._strategy_staff(v_uid) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if public._strategy_hq(v_uid) then
    v_branch := coalesce(nullif(trim(p_branch), ''), (select branch_name from public.profiles where user_id = v_uid));
  else
    v_branch := (select branch_name from public.profiles where user_id = v_uid);
  end if;
  return jsonb_build_object('ok', true, 'branch', v_branch, 'rows', coalesce((
    select jsonb_agg(jsonb_build_object(
             'user_id', m.user_id,
             'name', coalesce(nullif(pr.nickname, ''), pr.name, '회원'),
             'one_line', m.card ->> 'one_line',
             'card', m.card is not null,
             'updated_at', m.updated_at) order by m.updated_at desc)
      from public.member_style_profiles m
      join public.profiles pr on pr.user_id = m.user_id
     where m.removed_at is null and m.consent_at is not null and pr.branch_name = v_branch
  ), '[]'::jsonb));
end;
$$;

create or replace function public.member_style_set_card(p_user uuid, p_updated_at timestamptz, p_scores jsonb, p_card jsonb, p_model text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_card is null or jsonb_typeof(p_card) <> 'object' or char_length(p_card::text) > 6000 then return false; end if;
  -- 그사이 답을 다시 냈으면(updated_at 이 바뀜) 쓰지 않는다
  update public.member_style_profiles
     set scores = p_scores, card = p_card, card_at = now(), card_model = left(p_model, 60)
   where user_id = p_user and removed_at is null and consent_at is not null and updated_at = p_updated_at;
  return found;
end;
$$;

revoke all on function public.member_style_me() from public, anon;
revoke all on function public.member_style_save(jsonb) from public, anon;
revoke all on function public.member_style_clear() from public, anon;
revoke all on function public.member_style_for_coach(uuid) from public, anon;
revoke all on function public.member_style_branch(text) from public, anon;
grant execute on function public.member_style_me() to authenticated;
grant execute on function public.member_style_save(jsonb) to authenticated;
grant execute on function public.member_style_clear() to authenticated;
grant execute on function public.member_style_for_coach(uuid) to authenticated;
grant execute on function public.member_style_branch(text) to authenticated;
revoke all on function public.member_style_set_card(uuid, timestamptz, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.member_style_set_card(uuid, timestamptz, jsonb, jsonb, text) to service_role;
