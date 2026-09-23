-- 런칭 이벤트 시작일 설정 (2026-09-23)
--
-- 대표님 지시: 이벤트는 10월 1일부터. 시작일은 앱(설정 화면)에서 바꿀 수 있게.
--
-- 1) app_settings — 앱이 읽는 공개 설정. TV(anon)도 읽어야 해서 SELECT 는 누구나. 비밀은 절대 넣지 않는다
--    (비밀은 internal_sync_config). 쓰기는 set_app_setting RPC(super_admin·admin)로만.
--    launch_event = {"start_date": "2026-10-01", "end_date": null}  (KST 날짜, end_date 는 그날까지 포함)
-- 2) get_launch_event_window() — 설정에서 기간을 읽어 since/until(timestamptz)과 상태(upcoming/active/ended)를 돌려준다.
-- 3) _king_scores(category, since, until) — until 이 있으면 그 전까지만 센다 (종료된 이벤트는 결과가 고정된다).
-- 4) get_launch_event_board — 이벤트 기간으로 계산. 시작 전엔 빈 보드 + 상태, 종료 후엔 최종 결과.
-- 5) get_153_king_board / summary — p_period 에 'event' 추가 (앱 킹 보드의 "이벤트" 탭).

-- ─────────────────────────────────────────────────────────────
-- 1) 공개 설정 테이블
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
comment on table public.app_settings is '앱 공개 설정(누구나 읽음, 관리자만 RPC 로 씀). 비밀 금지 — 비밀은 internal_sync_config.';
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
grant select on public.app_settings to anon, authenticated;
drop policy if exists "app_settings_public_read" on public.app_settings;
create policy "app_settings_public_read" on public.app_settings for select to anon, authenticated using (true);

insert into public.app_settings (key, value)
values ('launch_event', jsonb_build_object('start_date', '2026-10-01', 'end_date', null))
on conflict (key) do nothing;

create or replace function public.set_app_setting(_key text, _value jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if not (public.has_role(v_uid, 'super_admin') or public.has_role(v_uid, 'admin')) then
    raise exception '권한이 없습니다';
  end if;
  if _key is null or btrim(_key) = '' then raise exception 'key required'; end if;
  -- launch_event 는 형식을 검사한다: start_date 필수(YYYY-MM-DD), end_date 는 없거나 start 이후
  if _key = 'launch_event' then
    if (_value ->> 'start_date') is null or (_value ->> 'start_date')::date is null then
      raise exception '시작일이 필요합니다';
    end if;
    if (_value ->> 'end_date') is not null and (_value ->> 'end_date')::date < (_value ->> 'start_date')::date then
      raise exception '종료일은 시작일 이후여야 합니다';
    end if;
  end if;
  insert into public.app_settings (key, value, updated_at, updated_by)
  values (_key, _value, now(), v_uid)
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by;
  return jsonb_build_object('ok', true, 'key', _key, 'value', _value);
end;
$$;
revoke all on function public.set_app_setting(text, jsonb) from public, anon;
grant execute on function public.set_app_setting(text, jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2) 이벤트 기간
create or replace function public.get_launch_event_window()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cfg jsonb;
  v_start date;
  v_end date;
  v_since timestamptz;
  v_until timestamptz;
  v_now_kst date := (now() at time zone 'Asia/Seoul')::date;
  v_status text;
begin
  select value into v_cfg from public.app_settings where key = 'launch_event';
  v_start := coalesce((v_cfg ->> 'start_date')::date, date '2026-10-01');
  v_end := (v_cfg ->> 'end_date')::date;
  v_since := (v_start::timestamp) at time zone 'Asia/Seoul';
  v_until := case when v_end is null then null else ((v_end + 1)::timestamp) at time zone 'Asia/Seoul' end;
  v_status := case
    when v_now_kst < v_start then 'upcoming'
    when v_end is not null and v_now_kst > v_end then 'ended'
    else 'active' end;
  return jsonb_build_object(
    'start_date', v_start, 'end_date', v_end,
    'since', v_since, 'until', v_until,
    'status', v_status,
    'days_until_start', greatest(0, v_start - v_now_kst),
    'days_left', case when v_end is null then null else greatest(0, v_end - v_now_kst) end
  );
end;
$$;
revoke all on function public.get_launch_event_window() from public;
grant execute on function public.get_launch_event_window() to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3) 점수 — until 상한 추가
drop function if exists public._king_scores(text, timestamptz);
create or replace function public._king_scores(p_category text, p_since timestamptz, p_until timestamptz default null)
returns table (user_id uuid, score numeric, tie_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_sql text;
begin
  -- $1 = since, $2 = until(null 이면 상한 없음)
  v_sql := case p_category
    when 'attendance' then $q$
      select a.user_id,
             count(distinct (a.checked_in_at at time zone 'Asia/Seoul')::date)::numeric,
             max(a.checked_in_at)
        from public.attendance_logs a
       where coalesce(a.is_duplicate, false) = false and a.checked_in_at >= $1 and ($2 is null or a.checked_in_at < $2)
       group by a.user_id $q$
    when 'early_bird' then $q$
      select a.user_id, count(*)::numeric, max(a.checked_in_at)
        from public.attendance_logs a
       where coalesce(a.is_duplicate, false) = false and a.checked_in_at >= $1 and ($2 is null or a.checked_in_at < $2)
         and extract(hour from a.checked_in_at at time zone 'Asia/Seoul') < 9
       group by a.user_id $q$
    when 'streak' then $q$
      with days as (
        select distinct a.user_id, (a.checked_in_at at time zone 'Asia/Seoul')::date as d
          from public.attendance_logs a
         where coalesce(a.is_duplicate, false) = false
           and a.checked_in_at >= now() - interval '400 days'
           and ($2 is null or a.checked_in_at < $2)),
      runs as (
        select user_id, d, d - (row_number() over (partition by user_id order by d))::int as grp from days),
      agg as (
        select user_id, grp, count(*)::numeric as len, max(d) as last_d, min(d) as first_d
          from runs group by user_id, grp)
      select user_id, len, (first_d::timestamp at time zone 'Asia/Seoul')
        from agg
       where last_d >= (least(coalesce($2, now()), now()) at time zone 'Asia/Seoul')::date - 1 $q$
    when 'levelup' then $q$
      select x.user_id, count(*)::numeric, max(x.created_at)
        from public.xp_logs x
       where x.reason like '레벨업%' and x.created_at >= $1 and ($2 is null or x.created_at < $2)
       group by x.user_id $q$
    when 'burpee' then $q$
      select a.user_id, sum(a.submitted_value)::numeric, max(a.created_at)
        from public.boxing_fun_challenge_attempts a
        join public.boxing_fun_challenges c on c.id = a.challenge_id
       where c.category = 'burpee' and a.status <> 'rejected' and a.created_at >= $1 and ($2 is null or a.created_at < $2)
       group by a.user_id $q$
    when 'fitness' then $q$
      select a.user_id, count(*)::numeric, max(a.created_at)
        from public.boxing_fun_challenge_attempts a
        join public.boxing_fun_challenges c on c.id = a.challenge_id
       where a.status = 'completed'
         and c.category in ('squat', 'pushup', 'sandbag', 'jump_rope', 'burpee', 'jab', 'one_two', 'combo', 'guard')
         and a.created_at >= $1 and ($2 is null or a.created_at < $2)
       group by a.user_id $q$
    when 'app' then $q$
      with ev as (
        select x.user_id, x.created_at as ts from public.xp_logs x
         where x.reason = '출석 체크' and x.created_at >= $1
        union all
        select a.user_id, a.checked_in_at from public.attendance_logs a
         where a.method = 'qr_manual' and coalesce(a.is_duplicate, false) = false and a.checked_in_at >= $1
        union all
        select a.user_id, a.ended_at from public.attendance_logs a
         where a.ended_at is not null and coalesce(a.is_duplicate, false) = false and a.ended_at >= $1
        union all
        select f.user_id, f.created_at from public.boxing_fun_challenge_attempts f where f.created_at >= $1
        union all
        select qz.user_id, qz.created_at from public.boxing_quiz_attempts qz where qz.created_at >= $1
        union all
        select j.user_id, j.created_at from public.champion_journal_entries j where j.created_at >= $1
        union all
        select jc.commenter_user_id, jc.created_at from public.champion_journal_comments jc where jc.created_at >= $1
        union all
        select ch.sender_user_id, ch.created_at from public.boxing_cheers ch where ch.created_at >= $1
        union all
        select g.user_id, g.created_at from public.boxing_gear_posts g where g.created_at >= $1
        union all
        select l.liker_id, l.created_at from public.nickname_likes l where l.created_at >= $1
      )
      select ev.user_id, count(*)::numeric, max(ev.ts) from ev
       where ev.user_id is not null and ($2 is null or ev.ts < $2) group by ev.user_id $q$
    when 'nickname' then $q$
      select l.target_id, count(*)::numeric, max(l.created_at)
        from public.nickname_likes l
       where l.created_at >= $1 and ($2 is null or l.created_at < $2)
       group by l.target_id $q$
    else null
  end;
  if v_sql is null then
    raise exception 'invalid category';
  end if;
  return query execute v_sql using p_since, p_until;
end;
$$;
revoke all on function public._king_scores(text, timestamptz, timestamptz) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4) TV2 런칭 이벤트 보드 — 이벤트 기간 + 상태
create or replace function public.get_launch_event_board(p_branch text, p_limit integer default 5)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_win jsonb := public.get_launch_event_window();
  v_since timestamptz := (v_win ->> 'since')::timestamptz;
  v_until timestamptz := (v_win ->> 'until')::timestamptz;
  v_status text := v_win ->> 'status';
  v_limit integer := greatest(1, least(coalesce(p_limit, 5), 20));
  v_cat text;
  v_items jsonb := '[]'::jsonb;
  v_rows jsonb;
  v_total integer;
begin
  if coalesce(btrim(p_branch), '') = '' then
    raise exception 'branch required';
  end if;
  foreach v_cat in array array['attendance', 'app', 'nickname'] loop
    if v_status = 'upcoming' then
      v_rows := '[]'::jsonb; v_total := 0;
    else
      with ranked as (
        select s.user_id, s.score,
               coalesce(nullif(p.nickname, ''), nullif(p.name, ''), '익명 복서') as display_name,
               row_number() over (order by s.score desc, s.tie_at asc nulls last, s.user_id) as rnk
          from public._king_scores(v_cat, v_since, v_until) s
          join public.profiles p on p.user_id = s.user_id
         where s.score > 0
           and coalesce(p.is_staff, false) = false
           and p.branch_name = p_branch
      )
      select coalesce((select jsonb_agg(jsonb_build_object('rank', r.rnk, 'display_name', r.display_name, 'score', r.score) order by r.rnk)
                         from (select * from ranked order by rnk limit v_limit) r), '[]'::jsonb),
             (select count(*) from ranked)
        into v_rows, v_total;
    end if;
    v_items := v_items || jsonb_build_object('category', v_cat, 'board', v_rows, 'total', v_total);
  end loop;
  return jsonb_build_object('branch', p_branch, 'period', 'event', 'items', v_items) || v_win;
end;
$$;
revoke all on function public.get_launch_event_board(text, integer) from public;
grant execute on function public.get_launch_event_board(text, integer) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5) 앱 킹 보드 — 'event' 기간
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
  v_until timestamptz := null;
  v_win jsonb := null;
  v_branch text;
  v_scope text := coalesce(p_scope, 'branch');
  v_limit integer := greatest(1, least(coalesce(p_limit, 10), 50));
  v_out jsonb;
begin
  if v_uid is null then
    raise exception 'auth required';
  end if;
  if p_category not in ('attendance', 'streak', 'early_bird', 'levelup', 'burpee', 'fitness', 'app', 'nickname') then
    raise exception 'invalid category';
  end if;
  if p_period not in ('weekly', 'monthly', 'event') then
    raise exception 'invalid period';
  end if;
  if v_scope not in ('branch', 'all') then
    raise exception 'invalid scope';
  end if;

  if p_period = 'event' then
    v_win := public.get_launch_event_window();
    v_since := (v_win ->> 'since')::timestamptz;
    v_until := (v_win ->> 'until')::timestamptz;
  else
    v_since := case when p_period = 'weekly'
      then (date_trunc('week',  now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul'
      else (date_trunc('month', now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul' end;
  end if;

  select p.branch_name into v_branch from public.profiles p where p.user_id = v_uid;
  if v_scope = 'branch' and coalesce(v_branch, '') = '' then
    v_scope := 'all';
  end if;

  if p_period = 'event' and (v_win ->> 'status') = 'upcoming' then
    v_out := jsonb_build_object('board', '[]'::jsonb, 'me', null, 'total', 0);
  else
    with ranked as (
      select s.user_id, s.score,
             coalesce(nullif(p.nickname, ''), nullif(p.name, ''), '익명 복서') as display_name,
             coalesce(p.branch_name, '미지정') as branch_name,
             row_number() over (order by s.score desc, s.tie_at asc nulls last, s.user_id) as rnk
        from public._king_scores(p_category, v_since, v_until) s
        join public.profiles p on p.user_id = s.user_id
       where s.score > 0
         and coalesce(p.is_staff, false) = false
         and (v_scope = 'all' or p.branch_name = v_branch)
    )
    select jsonb_build_object(
      'board', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'rank', r.rnk, 'user_id', r.user_id, 'display_name', r.display_name,
                 'branch_name', r.branch_name, 'score', r.score, 'is_me', r.user_id = v_uid)
               order by r.rnk)
          from (select * from ranked order by rnk limit v_limit) r), '[]'::jsonb),
      'me', (select jsonb_build_object('rank', r.rnk, 'score', r.score) from ranked r where r.user_id = v_uid),
      'total', (select count(*) from ranked)
    ) into v_out;
  end if;

  return jsonb_build_object(
    'category', p_category, 'period', p_period, 'scope', v_scope,
    'since', v_since, 'until', v_until, 'branch', v_branch, 'event', v_win
  ) || coalesce(v_out, '{}'::jsonb);
end;
$$;
revoke all on function public.get_153_king_board(text, text, text, integer) from public, anon;
grant execute on function public.get_153_king_board(text, text, text, integer) to authenticated;

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
  foreach v_cat in array array['attendance', 'streak', 'early_bird', 'levelup', 'burpee', 'fitness', 'app', 'nickname'] loop
    v_board := public.get_153_king_board(v_cat, p_period, p_scope, 1);
    v_items := v_items || jsonb_build_object(
      'category', v_cat,
      'king', v_board -> 'board' -> 0,
      'me', v_board -> 'me',
      'total', v_board -> 'total'
    );
  end loop;
  return jsonb_build_object(
    'period', p_period, 'scope', v_board ->> 'scope', 'since', v_board -> 'since',
    'event', v_board -> 'event', 'items', v_items
  );
end;
$$;
revoke all on function public.get_153_king_summary(text, text) from public, anon;
grant execute on function public.get_153_king_summary(text, text) to authenticated;
