-- 153 챌린지 킹 보드 — 동점 규칙 (2026-09-23)
-- 왕좌는 한 명. 동점이면 먼저 달성한 사람이 앞선다(마지막으로 점수를 올린 시각이 이른 쪽).
-- 연속출석왕은 연속이 먼저 시작된 사람이 앞선다. row_number 로 순위를 유일하게 만든다.
create or replace function public.get_153_king_board(
  p_category text,
  p_period text default 'weekly',
  p_scope text default 'branch',
  p_limit integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_since timestamptz;
  v_branch text;
  v_scope text := coalesce(p_scope, 'branch');
  v_limit integer := greatest(1, least(coalesce(p_limit, 10), 50));
  v_score_sql text;
  v_out jsonb;
begin
  if v_uid is null then
    raise exception 'auth required';
  end if;
  if p_category not in ('attendance', 'streak', 'early_bird', 'levelup', 'burpee', 'fitness') then
    raise exception 'invalid category';
  end if;
  if p_period not in ('weekly', 'monthly') then
    raise exception 'invalid period';
  end if;
  if v_scope not in ('branch', 'all') then
    raise exception 'invalid scope';
  end if;

  -- KST 기준 이번 주 월요일 0시 / 이번 달 1일 0시
  v_since := case when p_period = 'weekly'
    then (date_trunc('week',  now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul'
    else (date_trunc('month', now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul' end;

  select p.branch_name into v_branch from public.profiles p where p.user_id = v_uid;
  if v_scope = 'branch' and coalesce(v_branch, '') = '' then
    v_scope := 'all';
  end if;

  -- 각 점수 쿼리는 (user_id, score, tie_at) 를 돌려준다. tie_at = 동점 정렬용 시각(이른 쪽이 앞).
  v_score_sql := case p_category
    when 'attendance' then $q$
      select a.user_id,
             count(distinct (a.checked_in_at at time zone 'Asia/Seoul')::date)::numeric as score,
             max(a.checked_in_at) as tie_at
        from public.attendance_logs a
       where coalesce(a.is_duplicate, false) = false and a.checked_in_at >= $1
       group by a.user_id $q$
    when 'early_bird' then $q$
      select a.user_id, count(*)::numeric as score, max(a.checked_in_at) as tie_at
        from public.attendance_logs a
       where coalesce(a.is_duplicate, false) = false and a.checked_in_at >= $1
         and extract(hour from a.checked_in_at at time zone 'Asia/Seoul') < 9
       group by a.user_id $q$
    when 'streak' then $q$
      with days as (
        select distinct a.user_id, (a.checked_in_at at time zone 'Asia/Seoul')::date as d
          from public.attendance_logs a
         where coalesce(a.is_duplicate, false) = false
           and a.checked_in_at >= now() - interval '400 days'),
      runs as (
        select user_id, d, d - (row_number() over (partition by user_id order by d))::int as grp from days),
      agg as (
        select user_id, grp, count(*)::numeric as len, max(d) as last_d, min(d) as first_d
          from runs group by user_id, grp)
      select user_id, len as score, (first_d::timestamp at time zone 'Asia/Seoul') as tie_at
        from agg
       where last_d >= ((now() at time zone 'Asia/Seoul')::date - 1) $q$
    when 'levelup' then $q$
      select x.user_id, count(*)::numeric as score, max(x.created_at) as tie_at
        from public.xp_logs x
       where x.reason like '레벨업%' and x.created_at >= $1
       group by x.user_id $q$
    when 'burpee' then $q$
      select a.user_id, sum(a.submitted_value)::numeric as score, max(a.created_at) as tie_at
        from public.boxing_fun_challenge_attempts a
        join public.boxing_fun_challenges c on c.id = a.challenge_id
       where c.category = 'burpee' and a.status <> 'rejected' and a.created_at >= $1
       group by a.user_id $q$
    else $q$
      select a.user_id, count(*)::numeric as score, max(a.created_at) as tie_at
        from public.boxing_fun_challenge_attempts a
        join public.boxing_fun_challenges c on c.id = a.challenge_id
       where a.status = 'completed'
         and c.category in ('squat', 'pushup', 'sandbag', 'jump_rope', 'burpee', 'jab', 'one_two', 'combo', 'guard')
         and a.created_at >= $1
       group by a.user_id $q$
  end;

  execute format($f$
    with scores as (%s),
    ranked as (
      select s.user_id, s.score,
             coalesce(nullif(p.nickname, ''), nullif(p.name, ''), '익명 복서') as display_name,
             coalesce(p.branch_name, '미지정') as branch_name,
             row_number() over (order by s.score desc, s.tie_at asc nulls last, s.user_id) as rnk
        from scores s
        join public.profiles p on p.user_id = s.user_id
       where s.score > 0
         and coalesce(p.is_staff, false) = false
         and ($3 = 'all' or p.branch_name = $4)
    )
    select jsonb_build_object(
      'board', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'rank', r.rnk, 'user_id', r.user_id, 'display_name', r.display_name,
                 'branch_name', r.branch_name, 'score', r.score, 'is_me', r.user_id = $2)
               order by r.rnk)
          from (select * from ranked order by rnk limit %s) r), '[]'::jsonb),
      'me', (select jsonb_build_object('rank', r.rnk, 'score', r.score) from ranked r where r.user_id = $2),
      'total', (select count(*) from ranked)
    )
  $f$, v_score_sql, v_limit)
  into v_out
  using v_since, v_uid, v_scope, v_branch;

  return jsonb_build_object(
    'category', p_category, 'period', p_period, 'scope', v_scope,
    'since', v_since, 'branch', v_branch
  ) || coalesce(v_out, '{}'::jsonb);
end;
$$;
