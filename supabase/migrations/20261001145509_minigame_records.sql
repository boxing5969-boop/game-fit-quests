-- 🥊 복싱 트레이닝 기록·랭킹 (2026-10-01 대표님: "랭킹도 연동 안 되어 있고")
--
-- 앱 코드(features/minigame/lib/saveScore.ts · UnifiedLeaderboard)는 처음부터 minigame_records 를 썼지만
-- 운영 DB 에 표가 없어서 점수가 저장되지 않고 랭킹이 비어 있었다. 코드가 기대하는 모양 그대로 만든다.
--   · 한 판 = 한 행 (speed 반응속도 · mitt 미트 드릴 · defense 디펜스 러시)
--   · 회원은 자기 기록만 넣고 고친다 (player_name 닉네임 백필). 지우기는 없음.
--   · 랭킹 읽기는 로그인한 회원 모두 — 닉네임·점수만 들어 있는 체육관 안 순위표
--   · XP·젬은 여기서 지급하지 않는다 (xp_earned 는 기록용 숫자일 뿐 — 지갑은 RPC 로만)
--
-- 랭킹은 get_minigame_leaderboard() 가 "회원마다 최고 기록 하나" 로 뽑아 준다 (예전엔 한 사람이 100행을
-- 다 차지해 20명이 안 보일 수 있었다). 이름은 저장값이 아니라 지금 프로필 닉네임을 쓴다 (바꾸면 바로 반영).

create table if not exists public.minigame_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  player_name text not null default '회원',
  game_type text not null check (game_type in ('speed', 'mitt', 'defense')),
  score integer not null default 0,
  avg_reaction_ms integer,
  best_reaction_ms integer,
  accuracy integer,
  total_punches integer,
  combo_peak integer,
  tier text,
  xp_earned integer not null default 0,
  played_at timestamptz not null default now()
);
comment on table public.minigame_records is '복싱 트레이닝(미니게임) 한 판 기록 — 랭킹 재료 (2026-10-01)';

create index if not exists minigame_records_game_score_idx
  on public.minigame_records (game_type, score desc, played_at desc);
create index if not exists minigame_records_user_game_idx
  on public.minigame_records (user_id, game_type, score desc);

alter table public.minigame_records enable row level security;

do $pol$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'minigame_records' and policyname = 'minigame_records_select_members') then
    create policy minigame_records_select_members on public.minigame_records
      for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'minigame_records' and policyname = 'minigame_records_insert_own') then
    create policy minigame_records_insert_own on public.minigame_records
      for insert to authenticated with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'minigame_records' and policyname = 'minigame_records_update_own') then
    create policy minigame_records_update_own on public.minigame_records
      for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end
$pol$;

grant select, insert, update on public.minigame_records to authenticated;
revoke all on public.minigame_records from anon;

-- 랭킹: 회원마다 최고 기록 하나씩, 점수 순 (같으면 먼저 낸 사람). p_since 가 있으면 그 뒤 기록만.
create or replace function public.get_minigame_leaderboard(
  p_game text,
  p_since timestamptz default null,
  p_limit integer default 50
)
returns table (
  rank integer,
  user_id uuid,
  player_name text,
  score integer,
  avg_reaction_ms integer,
  accuracy integer,
  combo_peak integer,
  tier text,
  played_at timestamptz,
  is_me boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with best as (
    select distinct on (r.user_id)
           r.user_id, r.player_name, r.score, r.avg_reaction_ms, r.accuracy, r.combo_peak, r.tier, r.played_at
      from public.minigame_records r
     where r.game_type = p_game
       and (p_since is null or r.played_at >= p_since)
     order by r.user_id, r.score desc, r.played_at desc
  )
  select (row_number() over (order by b.score desc, b.played_at asc))::integer as rank,
         b.user_id,
         coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), nullif(btrim(b.player_name), ''), '회원') as player_name,
         b.score, b.avg_reaction_ms, b.accuracy, b.combo_peak, b.tier, b.played_at,
         (b.user_id = auth.uid()) as is_me
    from best b
    left join public.profiles p on p.user_id = b.user_id
   order by b.score desc, b.played_at asc
   limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

-- 내 순위 (순위표 밖에 있어도 보여 주려고)
create or replace function public.get_minigame_my_rank(
  p_game text,
  p_since timestamptz default null
)
returns table (
  rank integer,
  score integer,
  played_at timestamptz,
  total_players integer
)
language sql
stable
security definer
set search_path = public
as $$
  with best as (
    select distinct on (r.user_id) r.user_id, r.score, r.played_at
      from public.minigame_records r
     where r.game_type = p_game
       and (p_since is null or r.played_at >= p_since)
     order by r.user_id, r.score desc, r.played_at desc
  ),
  ranked as (
    select b.user_id, b.score, b.played_at,
           (row_number() over (order by b.score desc, b.played_at asc))::integer as rank,
           (count(*) over ())::integer as total_players
      from best b
  )
  select rk.rank, rk.score, rk.played_at, rk.total_players
    from ranked rk
   where rk.user_id = auth.uid();
$$;

revoke all on function public.get_minigame_leaderboard(text, timestamptz, integer) from public, anon;
grant execute on function public.get_minigame_leaderboard(text, timestamptz, integer) to authenticated;
revoke all on function public.get_minigame_my_rank(text, timestamptz) from public, anon;
grant execute on function public.get_minigame_my_rank(text, timestamptz) to authenticated;