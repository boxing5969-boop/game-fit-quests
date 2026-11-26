-- 🥊 레벨업 안내(새 튜토리얼) — 회원마다 '본 안내' 기록 (2026-11-27 대표님 「듀토리얼 지금은 너무 복잡한데 이거 업데이트 하자 …
--    7일 캠프는 이제 빼자 레벨업 시스템에 대해서 동기부여 해주자 어떻게 레벨이 올라가는지 왜 하는지 알려주는 듀토리얼으로」)
--
-- 옛 오삼 5단계 가이드 · 7일 캠프는 이 기기(localStorage)에만 남아서, 폰을 바꾸거나 앱을 지우면 다시 떴고 몇 명이 끝까지 봤는지도 몰랐다.
-- 이제 안내마다 계정에 한 줄 — 한 번 본 회원에게는 다시 저절로 뜨지 않고(다른 기기에서도), 어디까지 봤는지로 끝까지 본 비율을 잰다.
--   · member_guides — (회원, 안내 이름) 한 줄 · 처음 · 마지막 연 시각 · 끝까지 본 시각 · 건너뛴 시각 · 가장 멀리 본 화면 · 연 횟수
--     화면은 직접 쓰지 못하고 아래 두 함수로만 (자기 줄 읽기만 허용)
--   · member_guide_status(안내) — 내 기록 { seen, done, skipped, max_step, opens }
--   · member_guide_mark(안내, 'open' | 'done' | 'skip', 화면 번호) — 열 때 · 닫을 때 한 번씩. 끝까지 본 뒤에는 '건너뜀'으로 바뀌지 않는다
--   안내 이름: 'level' (레벨업 안내) — 영문 소문자 · 숫자 · _ 32자까지
-- 보상 · 지갑과는 상관없다 (기록만).

create table if not exists public.member_guides (
  user_id uuid not null references auth.users(id) on delete cascade,
  guide text not null check (guide ~ '^[a-z0-9_]{1,32}$'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  done_at timestamptz,
  skipped_at timestamptz,
  max_step integer not null default 0 check (max_step between 0 and 20),
  opens integer not null default 0 check (opens >= 0),
  primary key (user_id, guide)
);

alter table public.member_guides enable row level security;

drop policy if exists member_guides_own_select on public.member_guides;
create policy member_guides_own_select on public.member_guides
  for select to authenticated using (user_id = auth.uid());

revoke all on public.member_guides from anon, authenticated;
grant select on public.member_guides to authenticated;

create or replace function public.member_guide_status(p_guide text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object(
        'seen', true,
        'done', g.done_at is not null,
        'skipped', g.skipped_at is not null,
        'max_step', g.max_step,
        'opens', g.opens)
       from public.member_guides g
      where g.user_id = auth.uid() and g.guide = p_guide),
    jsonb_build_object('seen', false, 'done', false, 'skipped', false, 'max_step', 0, 'opens', 0)
  );
$$;

create or replace function public.member_guide_mark(p_guide text, p_event text, p_step integer default 0)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_step integer := greatest(0, least(coalesce(p_step, 0), 20));
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;
  if p_guide is null or p_guide !~ '^[a-z0-9_]{1,32}$' then
    return jsonb_build_object('ok', false, 'reason', 'bad_guide');
  end if;
  if p_event is null or p_event not in ('open', 'done', 'skip') then
    return jsonb_build_object('ok', false, 'reason', 'bad_event');
  end if;

  insert into public.member_guides as g (user_id, guide, max_step, opens, done_at, skipped_at)
  values (
    v_uid, p_guide, v_step,
    case when p_event = 'open' then 1 else 0 end,
    case when p_event = 'done' then now() end,
    case when p_event = 'skip' then now() end
  )
  on conflict (user_id, guide) do update set
    last_seen_at = now(),
    opens = g.opens + case when p_event = 'open' then 1 else 0 end,
    max_step = greatest(g.max_step, excluded.max_step),
    done_at = case when p_event = 'done' then coalesce(g.done_at, now()) else g.done_at end,
    skipped_at = case
      when p_event = 'skip' and g.done_at is null then coalesce(g.skipped_at, now())
      else g.skipped_at
    end;

  return public.member_guide_status(p_guide) || jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.member_guide_status(text) from public, anon;
revoke all on function public.member_guide_mark(text, text, integer) from public, anon;
grant execute on function public.member_guide_status(text) to authenticated;
grant execute on function public.member_guide_mark(text, text, integer) to authenticated;
