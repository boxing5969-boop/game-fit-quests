-- 153 챌린지 킹 보드 (2026-09-23)
--
-- 대표님 지시: "153챌린지에 출석왕·버피왕·체력왕 등등 — 글보다 버튼, 누르면 설명".
-- 회원끼리 겨루는 6개 왕좌. 점수 계산은 전부 서버(이 함수)에서 — 화면은 숫자를 만들지 않는다.
--   attendance : 출석왕     — 기간 내 출석 일수 (attendance_logs 비중복, KST 날짜 distinct)
--   streak     : 연속출석왕 — 지금 이어지고 있는 연속 출석 일수 (어제까지 이어졌으면 유지; 기간과 무관)
--   early_bird : 얼리버드왕 — 기간 내 오전 9시 전 출석 횟수
--   levelup    : 레벨업왕   — 기간 내 레벨업 횟수 (xp_logs '레벨업%')
--   burpee     : 버피왕     — 기간 내 아레나 버피 챌린지 총 개수 (통증 체크 실패 rejected 제외)
--   fitness    : 체력왕     — 기간 내 아레나 체력 종목 클리어 라운드 수
-- 기간: weekly = KST 이번 주 월요일 0시부터, monthly = KST 이번 달 1일 0시부터.
-- 범위: branch = 내 지점(프로필 branch_name), all = 전 지점. 지도진(is_staff)은 순위에서 뺀다.
-- 동점은 같은 순위(rank()). 표시 이름은 기존 153 챌린지 랭킹과 같은 규칙(닉네임 → 이름 → 익명 복서).

-- 1) 아레나에 버피 챌린지 추가 — 카테고리 제약에 'burpee' 허용
alter table public.boxing_fun_challenges drop constraint if exists boxing_fun_challenges_category_chk;
alter table public.boxing_fun_challenges add constraint boxing_fun_challenges_category_chk
  check (category = any (array['jab','one_two','squat','pushup','sandbag','jump_rope','guard','combo','community','recovery','burpee']));

insert into public.boxing_fun_challenges
  (code, title, description, category, target_metric, duration_seconds, difficulty_targets, rewards_by_difficulty,
   pain_check_required, high_intensity, safety_note, active, sort_order)
values
  ('burpee_blast', '버피 폭발 챌린지',
   '60초 동안 버피! 가슴은 바닥에, 점프는 가볍게. 개수보다 정확한 자세가 먼저입니다. 기록은 153 챌린지 버피왕 순위에 바로 반영돼요.',
   'burpee', 'count', 60,
   '{"beginner": 8, "normal": 15, "advanced": 25}'::jsonb,
   '{"beginner": {"gems": 300, "quest_xp": 120}, "normal": {"gems": 700, "quest_xp": 220}, "advanced": {"gems": 1400, "quest_xp": 400}}'::jsonb,
   array['knee', 'wrist', 'back'], true,
   '고강도 챌린지 · 보상은 하루 1회. 무릎·손목·허리에 통증이 오면 즉시 멈추세요.',
   true, 9)
on conflict (code) do nothing;

-- 2) 왕 보드 — 한 카테고리의 순위표 + 내 순위 + 참가자 수
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

  v_score_sql := case p_category
    when 'attendance' then $q$
      select a.user_id, count(distinct (a.checked_in_at at time zone 'Asia/Seoul')::date)::numeric as score
        from public.attendance_logs a
       where coalesce(a.is_duplicate, false) = false and a.checked_in_at >= $1
       group by a.user_id $q$
    when 'early_bird' then $q$
      select a.user_id, count(*)::numeric as score
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
        select user_id, grp, count(*)::numeric as len, max(d) as last_d from runs group by user_id, grp)
      select user_id, len as score
        from agg
       where last_d >= ((now() at time zone 'Asia/Seoul')::date - 1) $q$
    when 'levelup' then $q$
      select x.user_id, count(*)::numeric as score
        from public.xp_logs x
       where x.reason like '레벨업%' and x.created_at >= $1
       group by x.user_id $q$
    when 'burpee' then $q$
      select a.user_id, sum(a.submitted_value)::numeric as score
        from public.boxing_fun_challenge_attempts a
        join public.boxing_fun_challenges c on c.id = a.challenge_id
       where c.category = 'burpee' and a.status <> 'rejected' and a.created_at >= $1
       group by a.user_id $q$
    else $q$
      select a.user_id, count(*)::numeric as score
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
             rank() over (order by s.score desc) as rnk
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
               order by r.rnk, r.user_id)
          from (select * from ranked order by rnk, user_id limit %s) r), '[]'::jsonb),
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

revoke all on function public.get_153_king_board(text, text, text, integer) from public, anon;
grant execute on function public.get_153_king_board(text, text, text, integer) to authenticated;

-- 3) 요약 — 6개 왕좌의 현재 왕 + 내 순위를 한 번에 (버튼 그리드용)
create or replace function public.get_153_king_summary(
  p_period text default 'weekly',
  p_scope text default 'branch'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cat text;
  v_board jsonb;
  v_items jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;
  foreach v_cat in array array['attendance', 'streak', 'early_bird', 'levelup', 'burpee', 'fitness'] loop
    v_board := public.get_153_king_board(v_cat, p_period, p_scope, 1);
    v_items := v_items || jsonb_build_object(
      'category', v_cat,
      'king', v_board -> 'board' -> 0,
      'me', v_board -> 'me',
      'total', v_board -> 'total'
    );
  end loop;
  return jsonb_build_object('period', p_period, 'scope', v_board ->> 'scope', 'since', v_board -> 'since', 'items', v_items);
end;
$$;

revoke all on function public.get_153_king_summary(text, text) from public, anon;
grant execute on function public.get_153_king_summary(text, text) to authenticated;
