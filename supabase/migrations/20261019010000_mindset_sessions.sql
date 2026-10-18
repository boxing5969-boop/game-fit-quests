-- 153마인드셋 기록 (2026-10-19 대표님: "시각화 훈련 — 성공한 앱을 벤치마킹해서 경쟁이 될 정도로 업그레이드")
--   예전에는 이 기기(localStorage)에만 남아서 연속 기록·통계를 볼 수 없었다 → 계정에 남긴다.
--   · mindset_sessions: 세션 한 번 = 한 줄 (몇 초 했는지 · 끝까지 했는지 · 전/후 기분 · 선명도 · 조절감 · 한 줄 메모)
--     선명도·조절감은 스포츠 심상 연구에서 쓰는 '심상 능력' 자기 평가(VMIQ 계열)를 1~5로 줄인 것.
--   · mindset_profiles: 내 목표 한 문장 — 대본에 {goal} 로 들어간다.
--   · 본인만 본다(메모는 개인적인 글). 쓰기는 함수로만.

create table if not exists public.mindset_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null check (char_length(session_id) between 1 and 60),
  duration_sec integer not null check (duration_sec between 0 and 3600),
  completed boolean not null default true,
  mood_before smallint check (mood_before between 1 and 5),
  mood_after smallint check (mood_after between 1 and 5),
  vividness smallint check (vividness between 1 and 5),
  control smallint check (control between 1 and 5),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists mindset_sessions_user_idx on public.mindset_sessions (user_id, created_at desc);
alter table public.mindset_sessions enable row level security;
do $$ begin
  create policy "mindset sessions own" on public.mindset_sessions for select to authenticated
    using (user_id = (select auth.uid()));
exception when duplicate_object then null; end $$;

create table if not exists public.mindset_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal text check (char_length(goal) <= 60),
  updated_at timestamptz not null default now()
);
alter table public.mindset_profiles enable row level security;
do $$ begin
  create policy "mindset profiles own" on public.mindset_profiles for select to authenticated
    using (user_id = (select auth.uid()));
exception when duplicate_object then null; end $$;

/** 내 마인드셋 통계 — 연속 일수 · 오늘 했는지 · 이번 주 · 전체 · 선명도 변화 · 최근 기록 · 내 목표 */
create or replace function public.get_my_mindset_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_week_start date := v_today - ((extract(isodow from v_today)::int) - 1);
  v_streak int := 0;
  v_day date;
  v_total int;
  v_minutes int;
  v_week int;
  v_done_today boolean;
  v_vivid_recent numeric;
  v_vivid_first numeric;
  v_rated int;
  v_recent jsonb;
  v_goal text;
  v_by jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;

  select count(*), coalesce(sum(duration_sec), 0) / 60
    into v_total, v_minutes
    from public.mindset_sessions where user_id = v_uid;

  select count(*) into v_week
    from public.mindset_sessions
   where user_id = v_uid and (created_at at time zone 'Asia/Seoul')::date >= v_week_start;

  select exists (select 1 from public.mindset_sessions where user_id = v_uid and (created_at at time zone 'Asia/Seoul')::date = v_today)
    into v_done_today;

  -- 연속 일수: 오늘(안 했으면 어제)부터 거꾸로 하루도 안 빠진 날 수
  v_day := case when v_done_today then v_today else v_today - 1 end;
  loop
    exit when not exists (
      select 1 from public.mindset_sessions
       where user_id = v_uid and (created_at at time zone 'Asia/Seoul')::date = v_day
    );
    v_streak := v_streak + 1;
    v_day := v_day - 1;
    exit when v_streak > 400;
  end loop;

  select count(*) into v_rated from public.mindset_sessions where user_id = v_uid and vividness is not null;
  select avg(vividness) into v_vivid_recent from (
    select vividness from public.mindset_sessions where user_id = v_uid and vividness is not null order by created_at desc limit 5
  ) t;
  select avg(vividness) into v_vivid_first from (
    select vividness from public.mindset_sessions where user_id = v_uid and vividness is not null order by created_at asc limit 5
  ) t;

  select coalesce(jsonb_agg(jsonb_build_object(
           'session_id', r.session_id, 'created_at', r.created_at, 'duration_sec', r.duration_sec,
           'vividness', r.vividness, 'control', r.control, 'mood_before', r.mood_before, 'mood_after', r.mood_after,
           'note', r.note) order by r.created_at desc), '[]'::jsonb)
    into v_recent
    from (select * from public.mindset_sessions where user_id = v_uid order by created_at desc limit 12) r;

  select coalesce(jsonb_object_agg(session_id, n), '{}'::jsonb) into v_by
    from (select session_id, count(*) as n from public.mindset_sessions where user_id = v_uid group by session_id) t;

  select goal into v_goal from public.mindset_profiles where user_id = v_uid;

  return jsonb_build_object(
    'streak', v_streak,
    'done_today', v_done_today,
    'week_count', v_week,
    'total_sessions', v_total,
    'total_minutes', v_minutes,
    'rated', v_rated,
    'vivid_recent', round(coalesce(v_vivid_recent, 0), 1),
    'vivid_first', round(coalesce(v_vivid_first, 0), 1),
    'by_session', v_by,
    'recent', v_recent,
    'goal', v_goal
  );
end $function$;
revoke all on function public.get_my_mindset_stats() from public, anon;
grant execute on function public.get_my_mindset_stats() to authenticated;

/** 세션 기록 — 하루 30번까지 (같은 세션을 몇 초만 틀고 끄는 것도 남지만 통계는 끝까지 한 것 위주로 본다) */
create or replace function public.log_mindset_session(
  p_session_id text,
  p_duration_sec integer,
  p_completed boolean default true,
  p_mood_before integer default null,
  p_mood_after integer default null,
  p_vividness integer default null,
  p_control integer default null,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_today_count int;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if p_session_id is null or char_length(btrim(p_session_id)) = 0 then raise exception '세션이 없어요'; end if;
  select count(*) into v_today_count from public.mindset_sessions
   where user_id = v_uid and created_at > now() - interval '1 day';
  if v_today_count >= 30 then raise exception '오늘은 기록을 충분히 남겼어요. 내일 또 해요'; end if;

  insert into public.mindset_sessions (user_id, session_id, duration_sec, completed, mood_before, mood_after, vividness, control, note)
  values (
    v_uid, left(btrim(p_session_id), 60), least(greatest(coalesce(p_duration_sec, 0), 0), 3600), coalesce(p_completed, true),
    case when p_mood_before between 1 and 5 then p_mood_before end,
    case when p_mood_after between 1 and 5 then p_mood_after end,
    case when p_vividness between 1 and 5 then p_vividness end,
    case when p_control between 1 and 5 then p_control end,
    nullif(left(btrim(coalesce(p_note, '')), 300), '')
  );
  return public.get_my_mindset_stats();
end $function$;
revoke all on function public.log_mindset_session(text, integer, boolean, integer, integer, integer, integer, text) from public, anon;
grant execute on function public.log_mindset_session(text, integer, boolean, integer, integer, integer, integer, text) to authenticated;

/** 내 목표 한 문장 (60자) — 비우면 지운다 */
create or replace function public.set_mindset_goal(p_goal text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_goal text := nullif(left(btrim(coalesce(p_goal, '')), 60), '');
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  insert into public.mindset_profiles (user_id, goal, updated_at) values (v_uid, v_goal, now())
  on conflict (user_id) do update set goal = excluded.goal, updated_at = now();
  return jsonb_build_object('goal', v_goal);
end $function$;
revoke all on function public.set_mindset_goal(text) from public, anon;
grant execute on function public.set_mindset_goal(text) to authenticated;
