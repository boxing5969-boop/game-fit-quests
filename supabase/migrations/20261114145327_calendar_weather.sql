-- 캘린더 3-5 날씨 도장 (2026-11-14 대표님 「기상청 api도 비용이 안드는거면 진행하자」 · 공공데이터포털 키 = Edge Function 시크릿 KMA_SERVICE_KEY, 대표님이 넣음)
--   · 기상청 초단기실황(지점 격자 · 매시) · 단기예보(오늘 ~ 사흘 뒤) · 지상(종관, ASOS) 일자료(가까운 관측소 · 어제까지)
--     → Edge Function kma-weather(예약 매시 45분 · x-auto-key) → branch_weather_hours · branch_weather_days
--   · 회원 운동 달력: get_my_calendar 에 weather(내 지점 · 보이는 날짜) — 출석한 날이 비 · 눈 · 폭염 · 한파면 도장('비 오는 날도 왔어요'),
--     그날 카드에 오늘 · 앞날 예보 한 줄. 판정은 _branch_weather_json 한 곳(화면 lib/calendarWeather 와 같은 말):
--       눈   = ASOS 신적설 > 0 · 일기현상 눈 갈래, 또는 실황 강수 형태 2(비/눈) · 3(눈) · 6(빗방울눈날림) · 7(눈날림)
--       비   = ASOS 일강수량 또는 실황 1시간 강수량 합 ≥ rain_mm(1mm)
--       한파 = 최저 ≤ cold_c(-12℃ — 기상청 한파 일수 기준) · 폭염 = 최고 ≥ heat_c(33℃ — 기상청 폭염 일수 기준)
--       한 날에 겹치면 눈 > 비 > 한파 > 폭염. ASOS 와 실황 중 어느 하나라도 맞으면 도장(칭찬은 너그럽게 · 한 번 찍힌 도장이 다음 날 사라지지 않게)
--   · 표는 RLS · anon/authenticated 막음 — 쓰기는 Edge Function(서버 키), 읽기는 함수로만.

-- ═══════════════════════════ 1) 설정 — 지점마다 격자 · 관측소 ═══════════════════════════
insert into public.app_settings (key, value)
values ('weather_sites', jsonb_build_object(
  'note', '캘린더 3-5 날씨 도장 (2026-11-14). sites = 날씨를 받는 지점 — nx · ny = 기상청 동네예보 격자(위도 · 경도를 기상청 격자 변환식으로, place 기준) · stn = 지상(종관, ASOS) 관측소(서울 108 · 충주 127) · rain_mm · heat_c · cold_c = 도장 기준(비 mm 이상 · 폭염 최고 ℃ 이상 · 한파 최저 ℃ 이하). 지점을 더하려면 한 줄 — 다음 시각(매시 45분)부터 받는다.',
  'sites', jsonb_build_array(
    jsonb_build_object('branch', '153복싱짐 선릉역점', 'place', '선릉역', 'nx', 61, 'ny', 125, 'stn', 108, 'stn_name', '서울'),
    jsonb_build_object('branch', '153복싱짐 역삼점', 'place', '역삼동', 'nx', 61, 'ny', 125, 'stn', 108, 'stn_name', '서울'),
    jsonb_build_object('branch', '153복싱짐 잠실점', 'place', '잠실역', 'nx', 62, 'ny', 126, 'stn', 108, 'stn_name', '서울'),
    jsonb_build_object('branch', '153복싱짐 칠금점', 'place', '충주 칠금동', 'nx', 76, 'ny', 114, 'stn', 127, 'stn_name', '충주')),
  'rain_mm', 1,
  'heat_c', 33,
  'cold_c', -12))
on conflict (key) do nothing;

-- ═══════════════════════════ 2) 표 ═══════════════════════════
create table if not exists public.branch_weather_hours (
  branch_name text not null,
  obs_at timestamptz not null,
  t1h numeric(4,1),
  rn1 numeric(6,1),
  pty smallint,
  reh smallint,
  wsd numeric(4,1),
  fetched_at timestamptz not null default now(),
  primary key (branch_name, obs_at)
);
alter table public.branch_weather_hours enable row level security;
revoke all on table public.branch_weather_hours from anon, authenticated;
comment on table public.branch_weather_hours is '캘린더 3-5 날씨 — 기상청 초단기실황(지점 격자의 정시 관측: t1h 기온 · rn1 1시간 강수량 mm · pty 강수 형태 0 없음 · 1 비 · 2 비/눈 · 3 눈 · 5 빗방울 · 6 빗방울눈날림 · 7 눈날림 · reh 습도 · wsd 풍속). Edge Function kma-weather 가 매시 넣는다.';

create table if not exists public.branch_weather_days (
  branch_name text not null,
  day date not null,
  obs_stn smallint,
  obs_tmin numeric(4,1),
  obs_tmax numeric(4,1),
  obs_rain numeric(6,1),
  obs_snow numeric(5,1),
  obs_snow_day boolean,
  obs_at timestamptz,
  fc_tmin numeric(4,1),
  fc_tmax numeric(4,1),
  fc_pop smallint,
  fc_pty smallint,
  fc_sky smallint,
  fc_snow boolean,
  fc_base text,
  fc_at timestamptz,
  primary key (branch_name, day)
);
alter table public.branch_weather_days enable row level security;
revoke all on table public.branch_weather_days from anon, authenticated;
comment on table public.branch_weather_days is '캘린더 3-5 날씨 — 날마다 obs_*(ASOS 일자료: 최저 · 최고 · 일강수량 · 신적설 · 눈 온 날, 어제까지) · fc_*(단기예보: 최저 · 최고 · 강수확률 · 강수 형태 0 · 1 비 · 2 비/눈 · 3 눈 · 4 소나기 · 하늘 1 맑음 · 3 구름많음 · 4 흐림 · fc_base = 발표 날짜시각). Edge Function kma-weather 가 넣는다.';

-- ═══════════════════════════ 3) 판정 — 지점 · 날짜 범위의 날씨 (회원 달력이 읽는다) ═══════════════════════════
create or replace function public._branch_weather_json(_branch text, _from date, _to date)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with c as (
    select coalesce((s.v ->> 'rain_mm')::numeric, 1) as rain_mm,
           coalesce((s.v ->> 'heat_c')::numeric, 33) as heat_c,
           coalesce((s.v ->> 'cold_c')::numeric, -12) as cold_c,
           (now() at time zone 'Asia/Seoul')::date as today
      from (select (select a.value from public.app_settings a where a.key = 'weather_sites') as v) s
  ), h as (
    select (x.obs_at at time zone 'Asia/Seoul')::date as day,
           min(x.t1h) as tmin,
           max(x.t1h) as tmax,
           sum(greatest(coalesce(x.rn1, 0), 0)) as rain,
           coalesce(bool_or(x.pty in (2, 3, 6, 7)), false) as snow
      from public.branch_weather_hours x
     where x.branch_name = _branch
       and x.obs_at >= (_from::timestamp at time zone 'Asia/Seoul')
       and x.obs_at < ((_to + 1)::timestamp at time zone 'Asia/Seoul')
     group by 1
  ), w as (
    select d.*
      from public.branch_weather_days d
     where d.branch_name = _branch and d.day between _from and _to
  ), j as (
    select coalesce(w.day, h.day) as day,
           w.obs_at is not null as has_obs,
           h.day is not null as has_now,
           w.obs_tmin, w.obs_tmax, w.obs_rain, w.obs_snow_day,
           w.fc_at, w.fc_tmin, w.fc_tmax, w.fc_pop, w.fc_pty, w.fc_sky, w.fc_snow,
           h.tmin as now_tmin, h.tmax as now_tmax, h.rain as now_rain, h.snow as now_snow
      from w
      full join h on h.day = w.day
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'day', j.day,
           'kind', case
                     when j.day > c.today or not (j.has_obs or j.has_now) then null
                     when coalesce(j.obs_snow_day, false) or coalesce(j.now_snow, false) then 'snow'
                     when greatest(coalesce(j.obs_rain, 0), coalesce(j.now_rain, 0)) >= c.rain_mm then 'rain'
                     when least(j.obs_tmin, j.now_tmin) <= c.cold_c then 'cold'
                     when greatest(j.obs_tmax, j.now_tmax) >= c.heat_c then 'heat'
                   end,
           'rain', case when j.day > c.today or not (j.has_obs or j.has_now) then null
                        else round(greatest(coalesce(j.obs_rain, 0), coalesce(j.now_rain, 0)), 1) end,
           'tmin', case when j.day > c.today then null else least(j.obs_tmin, j.now_tmin) end,
           'tmax', case when j.day > c.today then null else greatest(j.obs_tmax, j.now_tmax) end,
           'fc', case when j.fc_at is null or j.day < c.today then null
                      else jsonb_build_object(
                        'tmin', case when j.day = c.today then least(j.fc_tmin, j.now_tmin) else j.fc_tmin end,
                        'tmax', case when j.day = c.today then greatest(j.fc_tmax, j.now_tmax) else j.fc_tmax end,
                        'pop', j.fc_pop, 'pty', j.fc_pty, 'sky', j.fc_sky, 'snow', coalesce(j.fc_snow, false)) end)
         order by j.day), '[]'::jsonb)
    from j cross join c
   where j.day between _from and _to
     and (j.has_obs or j.has_now or (j.fc_at is not null and j.day >= c.today))
$$;
revoke all on function public._branch_weather_json(text, date, date) from public, anon, authenticated;

-- ═══════════════════════════ 4) 덧대기 — get_my_calendar 에 weather (3-5 운영 정의 위 · 그 밖은 그대로) ═══════════════════════════
-- (3-5 날씨) weather — 내 지점 날씨(_branch_weather_json · 3-5 정의에서 이 한 줄만 더함)
CREATE OR REPLACE FUNCTION public.get_my_calendar(p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_me uuid := auth.uid();
  v_from timestamptz;
  v_to timestamptz;
  v_items jsonb;
  v_days jsonb;
  v_branch text;
  v_events jsonb;
  v_calls jsonb;
  v_nudge boolean;
  v_acts jsonb;
  v_notes jsonb;
  v_anniv jsonb;
  v_recap boolean;
  v_todos jsonb;
  v_mine jsonb;
  v_off text[];
  v_theme text;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public._is_active_member(v_me) then
    return jsonb_build_object('on', false);
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 62 then
    raise exception '날짜를 다시 골라 주세요';
  end if;
  v_from := (p_from::timestamp at time zone 'Asia/Seoul');
  v_to := ((p_to + 1)::timestamp at time zone 'Asia/Seoul');

  -- 이 날짜들에 있던 항목(그 뒤에 뺀 것 포함 — 그날의 체크를 세려고)
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.id, 'label', i.label, 'target', i.target, 'unit', i.unit,
           'weekdays', to_jsonb(i.weekdays), 'week_goal', i.week_goal,
           'created_on', (i.created_at at time zone 'Asia/Seoul')::date,
           'archived_on', (i.archived_at at time zone 'Asia/Seoul')::date)
         order by i.created_at), '[]'::jsonb)
    into v_items
    from public.member_check_items i
   where i.user_id = v_me
     and i.created_at < v_to
     and (i.archived_at is null or i.archived_at >= v_from);

  with d as (
    select g::date as day from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') g
  ), ch as (
    select distinct (c.created_at at time zone 'Asia/Seoul')::date as day
      from public.boxing_cheers c
     where c.sender_user_id = v_me and c.created_at >= v_from and c.created_at < v_to
  ), rx as (
    select distinct (r.created_at at time zone 'Asia/Seoul')::date as day
      from public.community_reactions r
     where r.user_id = v_me and r.created_at >= v_from and r.created_at < v_to
  ), jr as (
    select distinct on ((j.created_at at time zone 'Asia/Seoul')::date)
           (j.created_at at time zone 'Asia/Seoul')::date as day,
           jsonb_build_object(
             'id', j.id, 'content', j.content, 'mood', j.mood, 'photo_url', j.photo_url,
             'visibility', coalesce(j.visibility, 'branch'), 'at', j.created_at,
             'photos', coalesce(j.metadata -> 'photos', case when j.photo_url is not null then jsonb_build_array(j.photo_url) else '[]'::jsonb end)) as entry
      from public.champion_journal_entries j
     where j.user_id = v_me
       and coalesce(j.kind, 'journal') = 'journal'
       and j.created_at >= v_from and j.created_at < v_to
     order by (j.created_at at time zone 'Asia/Seoul')::date, j.created_at desc
  ), md as (
    select m.day, m.done, m.sticker
      from public.member_check_days m
     where m.user_id = v_me and m.day between p_from and p_to
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'day', d.day,
           'cheer', ch.day is not null,
           'give153', rx.day is not null,
           'journal', jr.entry,
           'done', coalesce(to_jsonb(md.done), '[]'::jsonb),
           'sticker', md.sticker)
         order by d.day), '[]'::jsonb)
    into v_days
    from d
    left join ch on ch.day = d.day
    left join rx on rx.day = d.day
    left join jr on jr.day = d.day
    left join md on md.day = d.day
   where ch.day is not null or rx.day is not null or jr.day is not null or md.day is not null;

  -- (2-2) 내 지점 153 일정 — 이 날짜들에 걸친 것 (2-3 승급 심사 = kind exam)
  select p.branch_name into v_branch from public.profiles p where p.user_id = v_me;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id, 'kind', case when e.is_exam then 'exam' else e.kind end,
           'title', e.title, 'start_on', e.start_on, 'end_on', e.end_on)
         order by e.start_on, e.created_at), '[]'::jsonb)
    into v_events
    from public.branch_calendar_events e
   where v_branch is not null and e.branch_name = v_branch and e.removed_at is null
     and e.start_on <= p_to and e.end_on >= p_from;

  -- (2-2) 내가 올렸거나 저요 한 운동 모집 (내리지 않은 것)
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'day', c.call_date, 'hour', c.slot_hour, 'purpose', c.purpose,
           'mine', c.user_id = v_me,
           'host', coalesce(nullif(btrim(hp.nickname), ''), nullif(btrim(hp.name), ''), '동료'),
           'joiners', (select count(*) from public.boxing_partner_call_joins j where j.call_id = c.id),
           'done', exists (select 1 from public.boxing_partner_call_done dn where dn.call_id = c.id and dn.user_id = v_me),
           'now', c.expires_at is not null)
         order by c.call_date, c.slot_hour nulls first, c.created_at), '[]'::jsonb)
    into v_calls
    from public.boxing_partner_calls c
    left join public.profiles hp on hp.user_id = c.user_id
   where c.status = 'open'
     and c.call_date between p_from and p_to
     and (c.user_id = v_me
          or exists (select 1 from public.boxing_partner_call_joins j where j.call_id = c.id and j.user_id = v_me));

  select cp.evening_nudge, cp.weekly_recap, cp.cals_off, cp.theme into v_nudge, v_recap, v_off, v_theme
    from public.member_calendar_prefs cp where cp.user_id = v_me;

  -- (2-3) 그날 한 일 — PT 수업 · 153 PB · 타이틀매치 · 레벨업 (DB 에 이미 있는 기록만)
  with pt as (
    select distinct on (s.session_date)
           s.session_date as day,
           jsonb_build_object(
             'day', s.session_date, 'kind', 'pt',
             'coach', coalesce(nullif(btrim(cp.name), ''), nullif(btrim(cp.nickname), ''), nullif(btrim(st.name), ''))) as j,
           4 as ord
      from public.ops_pt_sessions s
      left join public.ops_staff st on st.id = s.coach_staff_id
      left join public.profiles cp on cp.user_id = st.user_id
     where s.member_user_id = v_me and s.kind = 'lesson' and s.status = 'open'
       and s.session_date between p_from and p_to
     order by s.session_date, s.created_at
  ), pb as (
    select (t.measured_at at time zone 'Asia/Seoul')::date as day,
           jsonb_build_object(
             'day', (t.measured_at at time zone 'Asia/Seoul')::date, 'kind', 'pb', 'division', t.division,
             'first', not exists (
               select 1 from public.test153_records t2
                where t2.user_id = v_me and t2.official and t2.division = t.division
                  and (t2.measured_at < t.measured_at or (t2.measured_at = t.measured_at and t2.id < t.id))),
             'best', not exists (
               select 1 from public.test153_records t3
                where t3.user_id = v_me and t3.official and t3.division = t.division
                  and (t3.measured_at < t.measured_at or (t3.measured_at = t.measured_at and t3.id < t.id))
                  and t3.score_ms <= t.score_ms)) as j,
           3 as ord
      from public.test153_records t
     where t.user_id = v_me and t.official and t.measured_at >= v_from and t.measured_at < v_to
  ), tm as (
    select (a.recorded_at at time zone 'Asia/Seoul')::date as day,
           jsonb_build_object(
             'day', (a.recorded_at at time zone 'Asia/Seoul')::date, 'kind', 'title',
             'passed', coalesce(a.passed, false), 'rank', c.rank_name::text) as j,
           1 as ord
      from public.title_match_attempts a
      left join public.title_match_challenges c on c.id = a.challenge_id
     where a.user_id = v_me and a.recorded_at >= v_from and a.recorded_at < v_to
  ), lv as (
    select (h.created_at at time zone 'Asia/Seoul')::date as day,
           jsonb_build_object(
             'day', (h.created_at at time zone 'Asia/Seoul')::date, 'kind', 'level',
             'level', least(40, max((case h.rank_name::text when 'white' then 0 when 'blue' then 1 when 'red' then 2 else 3 end) * 10
                                    + h.level_number + 1))) as j,
           2 as ord
      from public.level_status_history h
     where h.user_id = v_me and h.new_status::text = 'approved'
       and h.created_at >= v_from and h.created_at < v_to
     group by (h.created_at at time zone 'Asia/Seoul')::date
  ), all_acts as (
    select day, j, ord from pt
    union all select day, j, ord from pb
    union all select day, j, ord from tm
    union all select day, j, ord from lv
  )
  select coalesce(jsonb_agg(j order by day, ord), '[]'::jsonb) into v_acts from all_acts;

  -- (2-3) 코치 한마디 — 이 날짜들
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', n.id, 'day', n.day,
           'who', public._cal_staff_who(n.coach_user_id),
           'title', public._cal_staff_title(n.coach_user_id),
           'body', n.body, 'at', n.updated_at)
         order by n.day, n.created_at), '[]'::jsonb)
    into v_notes
    from public.coach_day_notes n
   where n.member_user_id = v_me and n.removed_at is null and n.day between p_from and p_to;

  -- (2-3) 153 기념일 — 이 날짜들에 든 n주년
  select coalesce(jsonb_agg(jsonb_build_object(
           'day', (a.day + make_interval(years => g))::date, 'years', g, 'basis', a.basis)
         order by g), '[]'::jsonb)
    into v_anniv
    from public._cal_anchor(v_me) a, generate_series(1, 80) g
   where (a.day + make_interval(years => g))::date between p_from and p_to;

  -- (3-4) 보이는 날짜가 마감인 할 일 (뺀 것 빼고)
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'due_on', t.due_on, 'done', t.done_at is not null)
         order by t.due_on, t.created_at), '[]'::jsonb)
    into v_todos
    from public.member_todos t
   where t.user_id = v_me and t.removed_at is null and t.due_on between p_from and p_to;

  -- (3-5) 보이는 날짜에 걸친 내 일정 · 기념일 (반복 · 음력은 화면이 날마다 펼친다)
  select coalesce(jsonb_agg(public._my_cal_event_json(e) order by e.start_on, e.start_time nulls first, e.created_at), '[]'::jsonb)
    into v_mine
    from public.member_calendar_events e
   where e.user_id = v_me and e.removed_at is null
     and (case when cardinality(e.occ_dates) > 0 then exists (select 1 from unnest(e.occ_dates) x where x between p_from and p_to)
               when e.rrule is null then e.start_on <= p_to and e.end_on >= p_from
               else e.start_on <= p_to and coalesce(e.until_on, 'infinity'::date) >= p_from end);

  return jsonb_build_object(
    'on', true,
    'today', (now() at time zone 'Asia/Seoul')::date,
    'items', v_items,
    'todos', v_todos,
    'mine', v_mine,
    'birthday', public._birth_mmdd((select p.birth_date from public.profiles p where p.user_id = v_me)),
    'league', (select mp.current_rank::text from public.member_progress mp where mp.user_id = v_me limit 1),
    'view', jsonb_build_object('cals_off', to_jsonb(coalesce(v_off, '{}'::text[])), 'theme', v_theme),
    'weather', public._branch_weather_json(v_branch, p_from, p_to),
    'days', v_days,
    'events', v_events,
    'calls', v_calls,
    'nudge', jsonb_build_object('on', coalesce(v_nudge, false), 'at', coalesce(public._cal_conf() ->> 'nudge_at', '20:00')),
    'acts', v_acts,
    'notes', v_notes,
    'anniv', v_anniv,
    'ddays', public._cal_ddays(v_me),
    'recap', jsonb_build_object(
      'on', coalesce(v_recap, true),
      'at', coalesce(public._cal_conf() ->> 'recap_at', '19:30'),
      'sends', public._promise_member(v_me) is not null),
    'partner', public._cal_partner_json(v_me, p_from, p_to));
end
$function$;

-- ═══════════════════════════ 5) 예약 — 매시 45분 (실황은 정시 자료가 40분쯤 나온다) ═══════════════════════════
select cron.schedule(
  'kma-weather',
  '45 * * * *',
  $cron$
  select net.http_post(
    url := 'https://whnczhxyjmyywhlfbgsd.supabase.co/functions/v1/kma-weather',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-auto-key', (select value from public.internal_sync_config where key = 'auto_sync_key')),
    body := jsonb_build_object('source', 'cron'),
    timeout_milliseconds := 120000);
  $cron$
);
-- 끄기: select cron.unschedule('kma-weather');
