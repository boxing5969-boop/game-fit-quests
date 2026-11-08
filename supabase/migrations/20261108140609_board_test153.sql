-- 153 PB 라이브보드 — TV 2번 「기록 보드」 읽기 (2026-11-08 대표님 「다음진행 추천대로」 · 보고서 「153 PB 라이브보드 설계」 1단계)
--   TV 는 로그인하지 않는다 → 다른 board_* 함수와 같은 길: _board_branch_ok(지점, 열쇠) 를 통과해야 읽는다.
--   돌려주는 것(jsonb 하나):
--     rank     — 부문별 TOP 10 (open_m · open_f · starter_m · starter_f) · 전 지점(is_branch_visible) · 사람마다 부문별 최고 기록 1개
--                (순위 규칙은 get_test153_ranking_v2 와 같다 — 체험용 계정만 빼고 코치님 · 운영진도 오르고 staff 칸에 직함)
--     improved — 이번 달(KST) 개인 최고를 가장 많이 줄인 3명 (이번 달 최고 기록 vs 그 기록 전의 최고 기록)
--     records  — 153 레코드 중 153 PB 것(최초 153 PB 완주 · 최초 153 PB 1위 남/여) — 회원만 새겨지는 기존 규칙 그대로 읽기만
--     recent   — 이 지점에서 오늘 잰 공식 기록 최대 4개 (첫 기록인지 · 그때 개인 최고였는지)
--     totals   — 전체 공식 기록 수 · 사람 수 · 이번 달 기록 수 (빈 랭킹 안내용)
--   이름은 닉네임만(없으면 '153 복서') — 실명 · 전화번호 · user_id 는 내보내지 않는다.
--   새 함수만 추가 — 기존 함수 · 표 · 트리거는 그대로(미리보기 단계 규칙).
create or replace function public.board_test153(p_branch text, p_key text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_name   text := public._board_branch_ok(p_branch, p_key);
  v_month  timestamptz := date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  v_today  timestamptz := ((now() at time zone 'Asia/Seoul')::date)::timestamp at time zone 'Asia/Seoul';
  v_rank   jsonb;
  v_imp    jsonb;
  v_rec    jsonb;
  v_recent jsonb;
  v_totals jsonb;
begin
  if v_name is null then
    return null;
  end if;

  -- 부문별 TOP 10
  with recs as (
    select r.user_id, r.division, r.gender, r.score_ms, r.finished, r.remaining_reps, r.measured_at
      from public.test153_records r
     where r.official and public.test153_rankable(r.user_id)
  ), best as (
    select distinct on (b.user_id, b.division) b.*
      from recs b
     order by b.user_id, b.division, b.score_ms asc, b.measured_at asc
  ), ranked as (
    select b.*,
           coalesce(nullif(btrim(p.nickname), ''), '153 복서') as nick,
           regexp_replace(coalesce(p.branch_name, ''), '^153복싱짐\s*', '') as home,
           mp.current_rank::text as league,
           mp.current_level as lvl,
           case
             when coalesce(p.is_staff, false) then coalesce(nullif(btrim(p.staff_title), ''), '코치')
             when exists (select 1 from public.user_roles ur where ur.user_id = b.user_id and ur.role = 'coach') then '코치'
             when exists (select 1 from public.user_roles ur
                           where ur.user_id = b.user_id and ur.role in ('super_admin', 'admin', 'branch_manager')) then '운영진'
           end as staff,
           row_number() over (partition by b.division, b.gender order by b.score_ms asc, b.measured_at asc) as pos
      from best b
      join public.profiles p on p.user_id = b.user_id
      left join public.member_progress mp on mp.user_id = b.user_id
     where public.is_branch_visible(p.branch_name)
       and b.gender in ('남', '여')
  )
  select coalesce(jsonb_object_agg(t.k, t.items), '{}'::jsonb) into v_rank
    from (
      select x.division || '_' || case x.gender when '남' then 'm' else 'f' end as k,
             jsonb_agg(jsonb_build_object(
               'pos', x.pos, 'name', x.nick, 'branch', x.home,
               'score_ms', x.score_ms, 'finished', x.finished, 'remaining', x.remaining_reps,
               'league', x.league, 'level', x.lvl, 'staff', x.staff, 'at', x.measured_at
             ) order by x.pos) as items
        from ranked x
       where x.pos <= 10
       group by x.division, x.gender
    ) t;

  -- 이번 달 가장 많이 당긴 사람 (이번 달 최고 기록 vs 그 기록보다 앞선 최고 기록)
  with recs as (
    select r.user_id, r.division, r.score_ms, r.measured_at
      from public.test153_records r
     where r.official and public.test153_rankable(r.user_id)
  ), mbest as (
    select distinct on (m.user_id, m.division) m.*
      from recs m
     where m.measured_at >= v_month
     order by m.user_id, m.division, m.score_ms asc, m.measured_at asc
  ), imp as (
    select m.user_id, m.division, m.score_ms as best_ms,
           (select min(r2.score_ms) from recs r2
             where r2.user_id = m.user_id and r2.division = m.division and r2.measured_at < m.measured_at) as prior_ms
      from mbest m
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', coalesce(nullif(btrim(p.nickname), ''), '153 복서'),
           'division', i.division, 'delta_ms', i.prior_ms - i.best_ms, 'best_ms', i.best_ms
         ) order by i.prior_ms - i.best_ms desc), '[]'::jsonb) into v_imp
    from (select * from imp where prior_ms is not null and prior_ms > best_ms
           order by prior_ms - best_ms desc limit 3) i
    join public.profiles p on p.user_id = i.user_id
   where public.is_branch_visible(p.branch_name);

  -- 153 레코드 (153 PB 것만) — 새기는 규칙은 기존 그대로, 여기서는 읽기만
  select coalesce(jsonb_agg(jsonb_build_object(
           'key', r.record_key, 'label', public.record_153_label(r.record_key),
           'name', coalesce(nullif(btrim(p.nickname), ''), '153 복서'),
           'value', r.value, 'at', r.achieved_at
         ) order by r.achieved_at), '[]'::jsonb) into v_rec
    from public.records_153 r
    left join public.profiles p on p.user_id = r.user_id
   where r.record_key in ('first_test153', 'first_test153_top_m', 'first_test153_top_f')
     and r.user_id is not null;

  -- 이 지점 오늘 기록 (최근 4개)
  with recs as (
    select r.user_id, r.division, r.score_ms, r.finished, r.remaining_reps, r.measured_at, r.branch_name
      from public.test153_records r
     where r.official and public.test153_rankable(r.user_id)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', z.nick, 'division', z.division, 'score_ms', z.score_ms, 'finished', z.finished,
           'remaining', z.remaining_reps, 'first', z.is_first, 'pb', z.is_pb, 'at', z.measured_at
         ) order by z.measured_at desc), '[]'::jsonb) into v_recent
    from (
      select r.*,
             coalesce(nullif(btrim(p.nickname), ''), '153 복서') as nick,
             not exists (select 1 from recs r0
                          where r0.user_id = r.user_id and r0.division = r.division and r0.measured_at < r.measured_at) as is_first,
             coalesce(r.score_ms < (select min(r0.score_ms) from recs r0
                                     where r0.user_id = r.user_id and r0.division = r.division and r0.measured_at < r.measured_at),
                      true) as is_pb
        from recs r
        join public.profiles p on p.user_id = r.user_id
       where r.branch_name = v_name and r.measured_at >= v_today
       order by r.measured_at desc
       limit 4
    ) z;

  select jsonb_build_object(
           'records', count(*),
           'people', count(distinct r.user_id),
           'month', count(*) filter (where r.measured_at >= v_month)
         ) into v_totals
    from public.test153_records r
   where r.official and public.test153_rankable(r.user_id);

  return jsonb_build_object(
    'branch', v_name,
    'rank', v_rank,
    'improved', v_imp,
    'records', v_rec,
    'recent', v_recent,
    'totals', v_totals,
    'at', now()
  );
end
$function$;

revoke all on function public.board_test153(text, text) from public;
grant execute on function public.board_test153(text, text) to anon, authenticated, service_role;

comment on function public.board_test153(text, text) is
  '153 PB 라이브보드 TV 2번(기록 보드) 읽기 — board_* 규칙(_board_branch_ok 열쇠) · 닉네임만 · 2026-11-08';
