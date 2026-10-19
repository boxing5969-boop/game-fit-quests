-- 153마인드셋 — 검수 반영 (2026-10-19 대표님: "최고성능으로 검수하자")
--   1) 잠깐 해 보고 나온 기록(대본 60% 미만이면서 3분 미만)은 이번 주 · 연속 · 세션별 횟수 · 총합에 세지 않는다
--      (예전: 2초 만에 닫아도 '이번 주 목표 달성' · 연속 일수가 올라갔다)
--   2) 또렷함 변화는 처음 3번 평균 → 최근 3번 평균, 6번 쌓인 뒤부터 (예전: 처음 5 · 최근 5가 겹쳐서 3~5번이면 늘 같은 숫자)
--   3) log_mindset_session_v2 — 기기에서 만든 기록 번호(client_id)로 같은 기록을 두 번 넣지 않는다.
--      인터넷이 끊겨 기기에만 남은 기록 · 개편 전 기기 기록을 나중에 계정에 올릴 때 쓴다 (p_at = 기기에서 한 시각)
--   예전 log_mindset_session 은 그대로 둔다 (캐시된 옛 화면 호환)

alter table public.mindset_sessions add column if not exists client_id text;
alter table public.mindset_sessions add column if not exists logged_at timestamptz not null default now();
create unique index if not exists mindset_sessions_user_client_uidx
  on public.mindset_sessions (user_id, client_id) where client_id is not null;

create or replace function public.get_my_mindset_stats()
returns jsonb
language plpgsql
stable security definer
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
  v_cue text;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;

  -- 세는 기록 = 대본 60% 이상 갔거나(completed) 3분 넘게 한 것
  select count(*), coalesce(sum(duration_sec), 0) / 60
    into v_total, v_minutes
    from public.mindset_sessions
   where user_id = v_uid and (completed or duration_sec >= 180);

  select count(*) into v_week
    from public.mindset_sessions
   where user_id = v_uid and (completed or duration_sec >= 180)
     and (created_at at time zone 'Asia/Seoul')::date >= v_week_start;

  select exists (
    select 1 from public.mindset_sessions
     where user_id = v_uid and (completed or duration_sec >= 180)
       and (created_at at time zone 'Asia/Seoul')::date = v_today
  ) into v_done_today;

  v_day := case when v_done_today then v_today else v_today - 1 end;
  loop
    exit when not exists (
      select 1 from public.mindset_sessions
       where user_id = v_uid and (completed or duration_sec >= 180)
         and (created_at at time zone 'Asia/Seoul')::date = v_day
    );
    v_streak := v_streak + 1;
    v_day := v_day - 1;
    exit when v_streak > 400;
  end loop;

  -- 또렷함 — 점수는 짧게 한 날 것도 그대로 쓴다. 처음 3번 vs 최근 3번 (6번부터)
  select count(*) into v_rated from public.mindset_sessions where user_id = v_uid and vividness is not null;
  if v_rated >= 6 then
    select avg(vividness) into v_vivid_recent from (
      select vividness from public.mindset_sessions where user_id = v_uid and vividness is not null order by created_at desc limit 3
    ) t;
    select avg(vividness) into v_vivid_first from (
      select vividness from public.mindset_sessions where user_id = v_uid and vividness is not null order by created_at asc limit 3
    ) t;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'session_id', r.session_id, 'created_at', r.created_at, 'duration_sec', r.duration_sec,
           'completed', r.completed,
           'vividness', r.vividness, 'control', r.control, 'mood_before', r.mood_before, 'mood_after', r.mood_after,
           'note', r.note) order by r.created_at desc), '[]'::jsonb)
    into v_recent
    from (select * from public.mindset_sessions where user_id = v_uid order by created_at desc limit 12) r;

  select coalesce(jsonb_object_agg(session_id, n), '{}'::jsonb) into v_by
    from (
      select session_id, count(*) as n from public.mindset_sessions
       where user_id = v_uid and (completed or duration_sec >= 180)
       group by session_id
    ) t;

  select goal, cue into v_goal, v_cue from public.mindset_profiles where user_id = v_uid;

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
    'goal', v_goal,
    'cue', v_cue
  );
end $function$;

create or replace function public.log_mindset_session_v2(
  p_client_id text,
  p_at timestamptz,
  p_session_id text,
  p_duration_sec integer,
  p_completed boolean default true,
  p_mood_before integer default null,
  p_mood_after integer default null,
  p_vividness integer default null,
  p_control integer default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_cid text := nullif(left(btrim(coalesce(p_client_id, '')), 120), '');
  v_sid text := left(btrim(coalesce(p_session_id, '')), 60);
  v_at timestamptz;
  v_day date;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if char_length(v_sid) = 0 then raise exception '세션이 없어요'; end if;

  -- 같은 기록(같은 번호)은 한 번만
  if v_cid is not null and exists (select 1 from public.mindset_sessions where user_id = v_uid and client_id = v_cid) then
    return public.get_my_mindset_stats();
  end if;

  -- 기기에서 한 시각 — 미래이거나 400일보다 오래되면 지금으로
  v_at := case
    when p_at is null or p_at > now() + interval '5 minutes' or p_at < now() - interval '400 days' then now()
    else least(p_at, now())
  end;

  -- 개편 전 기기 기록을 옮길 때: 같은 세션이 같은 무렵(±3분)에 이미 있으면 건너뛴다 (예전 함수로 이미 올라간 기록과 겹치지 않게)
  if v_cid like 'legacy-%' and exists (
       select 1 from public.mindset_sessions
        where user_id = v_uid and session_id = v_sid
          and created_at between v_at - interval '3 minutes' and v_at + interval '3 minutes') then
    return public.get_my_mindset_stats();
  end if;

  v_day := (v_at at time zone 'Asia/Seoul')::date;
  if (select count(*) from public.mindset_sessions
       where user_id = v_uid and (created_at at time zone 'Asia/Seoul')::date = v_day) >= 30 then
    raise exception '오늘은 기록을 충분히 남겼어요. 내일 또 해요';
  end if;
  if (select count(*) from public.mindset_sessions where user_id = v_uid and logged_at > now() - interval '1 day') >= 250 then
    raise exception '기록을 한꺼번에 너무 많이 올렸어요. 내일 이어서 올라가요';
  end if;

  insert into public.mindset_sessions (
    user_id, session_id, duration_sec, completed, mood_before, mood_after, vividness, control, note,
    created_at, client_id, logged_at
  ) values (
    v_uid, v_sid, least(greatest(coalesce(p_duration_sec, 0), 0), 3600), coalesce(p_completed, true),
    case when p_mood_before between 1 and 5 then p_mood_before end,
    case when p_mood_after between 1 and 5 then p_mood_after end,
    case when p_vividness between 1 and 5 then p_vividness end,
    case when p_control between 1 and 5 then p_control end,
    nullif(left(btrim(coalesce(p_note, '')), 300), ''),
    v_at, v_cid, now()
  )
  on conflict do nothing;

  return public.get_my_mindset_stats();
end $function$;

revoke all on function public.log_mindset_session_v2(text, timestamptz, text, integer, boolean, integer, integer, integer, integer, text) from public, anon;
grant execute on function public.log_mindset_session_v2(text, timestamptz, text, integer, boolean, integer, integer, integer, integer, text) to authenticated;
