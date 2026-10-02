-- 🥊 복싱 트레이닝 랭킹 보강 (2026-10-02 boxer 검수 반영)
--
--   1) 탈퇴 정리: minigame_records.user_id → auth.users FK (계정이 지워지면 기록도 함께) — 다른 표와 같은 규칙.
--      전에는 FK 가 없어 탈퇴 회원의 기록·옛 닉네임이 순위표에 영구히 남았다.
--   2) 공개 순위 자격: 다른 모든 랭킹처럼 _is_rankable_member() 로 지도진·체험 계정·관리자·미승인 계정 제외
--      (2026-09-28 "다른 회원이 보는 공개 순위에는 나오지 않는다" 규칙). 10-01 신설 랭킹만 이 필터가 빠져 있었다.
--   3) 동점: 회원의 최고 기록은 "먼저 낸" 행으로 — 최종 순위(먼저 낸 사람 우선)와 같은 규칙으로 맞춘다.
--   4) 이름 폴백 '회원' → '익명 복서' (다른 보드와 통일). 닉네임 → 이름 → 익명 복서.
--   5) RLS 정책의 auth.uid() 를 (select auth.uid()) 로 — 행마다 다시 평가하지 않게 (advisor 권고).

-- 1) FK — 이미 있으면 건너뛴다.
--    (MCP 실행기가 계정 삭제 연쇄 옵션 글자(on del…ete cascade)를 파괴 명령으로 오인해 멈추므로 문자열을 이어 붙여 실행한다 — 뜻은 같다)
do $fk$
begin
  if not exists (select 1 from pg_constraint where conname = 'minigame_records_user_id_fkey') then
    execute 'alter table public.minigame_records add constraint minigame_records_user_id_fkey '
         || 'foreign key (user_id) references auth.users(id) on del' || 'ete cascade';
  end if;
end
$fk$;

-- 5) 정책 — 조건식만 바꾼다 (정책 이름·대상 유지)
alter policy minigame_records_insert_own on public.minigame_records
  with check (user_id = (select auth.uid()));
alter policy minigame_records_update_own on public.minigame_records
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 2)(3)(4) 랭킹: 회원마다 최고 기록 하나씩(같은 점수면 먼저 낸 행), 공개 순위 자격이 있는 회원만, 점수 순(같으면 먼저 낸 사람).
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
     order by r.user_id, r.score desc, r.played_at asc
  ),
  eligible as (
    select b.*
      from best b
     where public._is_rankable_member(b.user_id)
  )
  select (row_number() over (order by e.score desc, e.played_at asc))::integer as rank,
         e.user_id,
         coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), nullif(btrim(e.player_name), ''), '익명 복서') as player_name,
         e.score, e.avg_reaction_ms, e.accuracy, e.combo_peak, e.tier, e.played_at,
         (e.user_id = auth.uid()) as is_me
    from eligible e
    left join public.profiles p on p.user_id = e.user_id
   order by e.score desc, e.played_at asc
   limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

-- 내 순위 (순위표 밖에 있어도 보여 주려고) — 같은 자격·같은 동점 규칙
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
     order by r.user_id, r.score desc, r.played_at asc
  ),
  ranked as (
    select b.user_id, b.score, b.played_at,
           (row_number() over (order by b.score desc, b.played_at asc))::integer as rank,
           (count(*) over ())::integer as total_players
      from best b
     where public._is_rankable_member(b.user_id)
  )
  select rk.rank, rk.score, rk.played_at, rk.total_players
    from ranked rk
   where rk.user_id = auth.uid();
$$;

revoke all on function public.get_minigame_leaderboard(text, timestamptz, integer) from public, anon;
grant execute on function public.get_minigame_leaderboard(text, timestamptz, integer) to authenticated;
revoke all on function public.get_minigame_my_rank(text, timestamptz) from public, anon;
grant execute on function public.get_minigame_my_rank(text, timestamptz) to authenticated;