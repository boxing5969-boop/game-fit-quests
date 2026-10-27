-- 지점 회의실 정기 회의 예약 (2026-10-27 대표님 "다음 작업 진행하자" — 지점 회의실 다음 단계 목록의 '정기 회의 예약')
--   매주 같은 요일 · 시간(또는 한 번만) 회의를 잡아 두면
--     ① 시작 N분 전(안 함 · 5 · 10 · 30 · 60) 지점 지도진 + 대표님 휴대폰에 '10분 뒤 지점 회의가 있어요'
--     ② 시작 시각에 회의가 저절로 열리고 '지금 지점 회의가 열렸어요' (회의 열기와 같은 알림 · 링크 /office/room)
--     ③ 아무도 들어오지 않은 정기 회의는 1시간 뒤 저절로 닫는다
--   · 이미 열린 회의가 있으면 새로 열지 않는다(먼저 연 회의로 한다). 6시간 넘게 열려 있던 회의(끝내기를 잊은 회의)는 닫고 연다.
--   · 잡기 · 고치기 · 취소 · 다음 한 번 쉬기 = 대표님 · 지점장(_office_role 'host'), 보기 = 그 지점 지도진 + 대표님.
--     '지도진에게 알리기'를 켜면 잡혔어요 · 바뀌었어요 · 쉬어요 · 취소됐어요 알림이 한 번 간다.
--     취소한 예약은 지우지 않고 active=false · canceled_at · canceled_by 로 남긴다.
--   · 줌 · 구글 미트 링크를 넣어 두면 열린 회의에 그대로 들어간다(가맹 관장님 주간 줌처럼 바깥 분과 함께하는 회의).
--   · office_me 의 offices[].next — 홈 「회의실 참석」 카드 '다음 회의' · office_state 의 meeting.scheduled ·
--     office_meetings_list 의 scheduled — 정기 회의로 열린 회의 (나머지는 지금 정의 그대로).
--   시각은 모두 한국 시간(Asia/Seoul, 서머타임 없음). 매분 cron 'office-schedule-tick'.

-- 1) 표 ─────────────────────────────────────────────────────────────

create table if not exists public.office_schedules (
  id            uuid primary key default gen_random_uuid(),
  branch_name   text not null references public.office_branches(branch_name) on delete cascade,
  title         text not null,
  agenda        text[] not null default '{}',
  weekdays      smallint[] not null default '{}',   -- 0=일 … 6=토 (매주). 비어 있으면 once_on 하루만
  once_on       date,                               -- 한 번만 하는 회의 날짜
  at_time       time not null,                      -- 시작 시각 (분까지)
  remind_min    smallint not null default 10,
  video_url     text,
  active        boolean not null default true,      -- 한 번만 하는 회의는 열린 뒤 false
  next_at       timestamptz,                        -- 다음 시작 시각 (저장 · cron 이 유지)
  skip_at       timestamptz,                        -- 이 시작 시각은 쉰다 (= next_at 일 때만 뜻이 있다)
  reminded_for  timestamptz,                        -- 이 시작 시각의 미리 알림을 보냈다
  opened_for    timestamptz,                        -- 이 시작 시각을 처리했다 (열었거나 건너뜀)
  last_meeting_id uuid,
  created_by    uuid not null,
  created_at    timestamptz not null default now(),
  updated_by    uuid,
  updated_at    timestamptz not null default now(),
  canceled_at   timestamptz,                        -- 취소한 때 (지우지 않고 남긴다)
  canceled_by   uuid,
  constraint office_schedules_title check (char_length(btrim(title)) between 1 and 80),
  constraint office_schedules_when check ((cardinality(weekdays) > 0) <> (once_on is not null)),
  constraint office_schedules_remind check (remind_min in (0, 5, 10, 30, 60))
);
create index if not exists office_schedules_due_idx on public.office_schedules (next_at) where active;
create index if not exists office_schedules_branch_idx on public.office_schedules (branch_name) where active;
alter table public.office_schedules add column if not exists canceled_at timestamptz;
alter table public.office_schedules add column if not exists canceled_by uuid;
alter table public.office_schedules enable row level security;  -- 정책 없음: 읽기 · 쓰기는 아래 함수로만
revoke all on public.office_schedules from anon, authenticated;

-- 정기 회의로 열린 회의 (예약을 지워도 남도록 FK 없이)
alter table public.office_meetings add column if not exists schedule_id uuid;

-- 2) 시각 도우미 ─────────────────────────────────────────────────────

-- 다음 시작 시각: 매주 = _after 이후 첫 요일 · 시간, 한 번 = 그날 그 시간(지났으면 null)
create or replace function public._office_next_at(_weekdays smallint[], _once_on date, _at time, _after timestamptz)
returns timestamptz
language sql stable
set search_path = public
as $$
  select case
    when _once_on is not null then
      case when ((_once_on + _at) at time zone 'Asia/Seoul') >= _after then ((_once_on + _at) at time zone 'Asia/Seoul') end
    when coalesce(cardinality(_weekdays), 0) = 0 then null
    else (select min((d.day + _at) at time zone 'Asia/Seoul')
            from (select ((_after at time zone 'Asia/Seoul')::date + k) as day from generate_series(0, 7) as k) d
           where extract(dow from d.day)::smallint = any(_weekdays)
             and ((d.day + _at) at time zone 'Asia/Seoul') >= _after)
  end;
$$;

-- '오전 10:00' · '오후 3:05' (화면 officeTime 과 같은 모양)
create or replace function public._office_clock(_at time)
returns text
language sql immutable
set search_path = public
as $$
  select case when extract(hour from _at) < 12 then '오전 ' else '오후 ' end
      || (case when extract(hour from _at)::int % 12 = 0 then 12 else extract(hour from _at)::int % 12 end)::text
      || ':' || lpad(extract(minute from _at)::int::text, 2, '0');
$$;

-- '10월 28일 (화)'
create or replace function public._office_day_label(_d date)
returns text
language sql immutable
set search_path = public
as $$
  select extract(month from _d)::int || '월 ' || extract(day from _d)::int || '일 ('
      || (array['일', '월', '화', '수', '목', '금', '토'])[extract(dow from _d)::int + 1] || ')';
$$;

-- 한 시각 → '10월 28일 (화) 오전 10:00'
create or replace function public._office_at_label(_ts timestamptz)
returns text
language sql stable
set search_path = public
as $$
  select public._office_day_label((_ts at time zone 'Asia/Seoul')::date) || ' '
      || public._office_clock((_ts at time zone 'Asia/Seoul')::time);
$$;

-- 예약 → '매주 월 · 수 오전 10:00' · '평일 오전 9:30' · '매일 …' · '10월 28일 (화) 오후 3:00' (화면 officeSchedule.ts 와 같은 글)
create or replace function public._office_schedule_when(_weekdays smallint[], _once_on date, _at time)
returns text
language sql immutable
set search_path = public
as $$
  select case
    when _once_on is not null then public._office_day_label(_once_on) || ' '
    when cardinality(_weekdays) = 7 then '매일 '
    when _weekdays = '{1,2,3,4,5}'::smallint[] then '평일 '
    else '매주 ' || (select string_agg((array['일', '월', '화', '수', '목', '금', '토'])[d + 1], ' · ' order by (d + 6) % 7)
                       from unnest(_weekdays) as d) || ' '
  end || public._office_clock(_at);
$$;

-- 지점의 다음 회의 (쉬는 회의는 그다음으로) — 홈 카드
create or replace function public._office_next_schedule(_branch text)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object('id', x.id, 'title', x.title, 'at', x.at)
    from (select s.id, s.title,
                 case when s.skip_at is not null and s.skip_at = s.next_at
                      then public._office_next_at(s.weekdays, s.once_on, s.at_time, s.next_at + interval '1 minute')
                      else s.next_at end as at
            from public.office_schedules s
           where s.branch_name = _branch and s.active and s.next_at is not null) x
   where x.at is not null
   order by x.at
   limit 1;
$$;

-- 지점 지도진 + 대표님께 알림 한 줄 (_except = 보낸 사람)
create or replace function public._office_notify_people(_branch text, _title text, _body text, _link text, _except uuid default null)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare n integer;
begin
  insert into public.notifications (user_id, title, body, link)
  select pp.user_id, left(_title, 80), left(coalesce(_body, ''), 150), _link
    from public._office_people(_branch) pp
   where _except is null or pp.user_id <> _except;
  get diagnostics n = row_count;
  return n;
end $$;

-- 3) 보기 — 그 지점 지도진 + 대표님 ─────────────────────────────────

create or replace function public.office_schedule_list(p_branch text default null)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_branch text;
begin
  v_branch := public._office_scope(v_uid, p_branch);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', s.id,
             'title', s.title,
             'agenda', to_jsonb(s.agenda),
             'weekdays', to_jsonb(s.weekdays),
             'once_on', s.once_on,
             'at', to_char(s.at_time, 'HH24:MI'),
             'remind_min', s.remind_min,
             'video_url', s.video_url,
             'next_at', s.next_at,
             'skip_next', s.skip_at is not null and s.skip_at = s.next_at,
             'then_at', case when s.skip_at is not null and s.skip_at = s.next_at
                             then public._office_next_at(s.weekdays, s.once_on, s.at_time, s.next_at + interval '1 minute') end,
             'created_by', public._office_display(s.created_by))
           order by s.next_at nulls last, s.created_at)
      from public.office_schedules s
     where s.branch_name = v_branch and s.active), '[]'::jsonb);
end $$;

-- 4) 잡기 · 고치기 — 대표님 · 지점장 ─────────────────────────────────

create or replace function public.office_schedule_save(
  p_title text,
  p_at text,
  p_id uuid default null,
  p_branch text default null,
  p_agenda text[] default '{}',
  p_weekdays integer[] default '{}',
  p_once_on date default null,
  p_remind_min integer default 10,
  p_video_url text default null,
  p_notify boolean default false
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid(); v_branch text; v_old public.office_schedules;
  v_title text := btrim(coalesce(p_title, '')); v_agenda text[]; v_days smallint[]; v_at time;
  v_url text; v_next timestamptz; v_id uuid; v_remind integer := coalesce(p_remind_min, 10);
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if p_id is not null then
    select * into v_old from public.office_schedules where id = p_id and active for update;
    if v_old.id is null then raise exception '예약을 찾을 수 없어요 — 이미 취소했거나 끝난 회의예요'; end if;
    v_branch := v_old.branch_name;
  else
    v_branch := public._office_scope(v_uid, p_branch);
  end if;
  if public._office_role(v_uid, v_branch) is distinct from 'host' then
    raise exception '회의 예약은 대표님 · 지점장님이 해요';
  end if;

  if v_title = '' then raise exception '회의 이름을 적어 주세요'; end if;
  if char_length(v_title) > 80 then raise exception '회의 이름은 80자까지 적을 수 있어요'; end if;
  select coalesce(array_agg(q.v order by q.ord), '{}') into v_agenda
    from (select left(btrim(x), 60) as v, ord
            from unnest(coalesce(p_agenda, '{}')) with ordinality as t(x, ord)
           where btrim(coalesce(x, '')) <> ''
           order by ord limit 5) q;

  if p_once_on is not null then
    v_days := '{}';
    if p_once_on < v_today then raise exception '지난 날짜예요 — 날짜를 바꿔 주세요'; end if;
    if p_once_on > v_today + 366 then raise exception '1년 안의 날짜로 잡아 주세요'; end if;
  else
    select coalesce(array_agg(distinct d::smallint order by d::smallint), '{}') into v_days
      from unnest(coalesce(p_weekdays, '{}')) as d
     where d between 0 and 6;
    if cardinality(v_days) = 0 then raise exception '요일을 하나 이상 골라 주세요'; end if;
  end if;

  if coalesce(btrim(p_at), '') !~ '^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' then
    raise exception '시간을 골라 주세요';
  end if;
  v_at := btrim(p_at)::time;
  v_at := make_time(extract(hour from v_at)::int, extract(minute from v_at)::int, 0);
  if v_remind not in (0, 5, 10, 30, 60) then
    raise exception '알림은 안 함 · 5분 · 10분 · 30분 · 1시간 전 중에서 골라 주세요';
  end if;
  v_url := public._office_video_url(p_video_url);
  v_next := public._office_next_at(v_days, p_once_on, v_at, now());
  if v_next is null then raise exception '이미 지난 시간이에요 — 날짜나 시간을 바꿔 주세요'; end if;

  if p_id is null then
    if (select count(*) from public.office_schedules where branch_name = v_branch and active) >= 10 then
      raise exception '정기 회의는 지점마다 10개까지 잡을 수 있어요';
    end if;
    insert into public.office_schedules (branch_name, title, agenda, weekdays, once_on, at_time, remind_min, video_url, next_at, created_by)
    values (v_branch, v_title, v_agenda, v_days, p_once_on, v_at, v_remind, v_url, v_next, v_uid)
    returning id into v_id;
  else
    update public.office_schedules set
      title = v_title, agenda = v_agenda, weekdays = v_days, once_on = p_once_on, at_time = v_at,
      remind_min = v_remind, video_url = v_url, next_at = v_next,
      skip_at = case when skip_at = v_next then skip_at end,           -- 시간이 바뀌면 '쉬기'는 풀린다
      reminded_for = case when reminded_for = v_next then reminded_for end,
      updated_by = v_uid, updated_at = now()
    where id = p_id
    returning id into v_id;
  end if;

  if coalesce(p_notify, false) then
    perform public._office_notify_people(
      v_branch,
      case when p_id is null then '지점 회의가 잡혔어요' else '지점 회의가 바뀌었어요' end,
      public._office_schedule_when(v_days, p_once_on, v_at) || ' · ' || v_title,
      '/office', v_uid);
    -- 곧 시작하는 회의면 이 알림이 미리 알림을 대신한다 (몇 초 사이에 두 번 울리지 않게)
    if v_remind > 0 and v_next - make_interval(mins => v_remind) <= now() then
      update public.office_schedules set reminded_for = v_next where id = v_id;
    end if;
  end if;
  perform public._office_ping(v_branch, 'schedule');
  return v_id;
end $$;

-- 5) 다음 한 번 쉬기 · 취소 — 대표님 · 지점장 ─────────────────────

create or replace function public.office_schedule_skip(p_id uuid, p_skip boolean, p_notify boolean default false)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); s public.office_schedules; v_skip boolean := coalesce(p_skip, false);
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into s from public.office_schedules where id = p_id and active for update;
  if s.id is null then raise exception '예약을 찾을 수 없어요 — 이미 취소했거나 끝난 회의예요'; end if;
  if public._office_role(v_uid, s.branch_name) is distinct from 'host' then
    raise exception '회의 예약은 대표님 · 지점장님이 바꿔요';
  end if;
  if s.once_on is not null then raise exception '한 번만 하는 회의는 쉬기 대신 취소해 주세요'; end if;
  if s.next_at is null then raise exception '다음 회의가 없어요'; end if;

  if (s.skip_at is not distinct from s.next_at) is distinct from v_skip then
    update public.office_schedules
       set skip_at = case when v_skip then s.next_at end, updated_by = v_uid, updated_at = now()
     where id = s.id;
    if coalesce(p_notify, false) then
      perform public._office_notify_people(
        s.branch_name,
        case when v_skip then '이번 지점 회의는 쉬어요' else '쉬기로 한 지점 회의를 다시 해요' end,
        public._office_at_label(s.next_at) || ' · ' || s.title,
        '/office', v_uid);
    end if;
    perform public._office_ping(s.branch_name, 'schedule');
  end if;
  return jsonb_build_object(
    'skip_at', case when v_skip then s.next_at end,
    'then_at', public._office_next_at(s.weekdays, s.once_on, s.at_time, s.next_at + interval '1 minute'));
end $$;

create or replace function public.office_schedule_cancel(p_id uuid, p_notify boolean default false)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); s public.office_schedules;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into s from public.office_schedules where id = p_id for update;
  if s.id is null or not s.active then return; end if; -- 이미 취소했거나 끝난 회의
  if public._office_role(v_uid, s.branch_name) is distinct from 'host' then
    raise exception '회의 예약은 대표님 · 지점장님이 취소해요';
  end if;
  update public.office_schedules
     set active = false, canceled_at = now(), canceled_by = v_uid, updated_by = v_uid, updated_at = now()
   where id = s.id;
  if coalesce(p_notify, false) and s.next_at is not null then
    perform public._office_notify_people(
      s.branch_name, '지점 회의가 취소됐어요',
      public._office_schedule_when(s.weekdays, s.once_on, s.at_time) || ' · ' || s.title,
      '/office', v_uid);
  end if;
  perform public._office_ping(s.branch_name, 'schedule');
end $$;

-- 지금 열기 — 정기 회의를 시작 시각 전에 (모여서 일찍 시작할 때). 1시간 안의 차례는 이걸로 한 것으로 친다.
create or replace function public.office_schedule_open_now(p_id uuid)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); s public.office_schedules; v_id uuid; v_me jsonb; v_who text;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into s from public.office_schedules where id = p_id and active for update;
  if s.id is null then raise exception '예약을 찾을 수 없어요 — 이미 취소했거나 끝난 회의예요'; end if;
  if public._office_role(v_uid, s.branch_name) is distinct from 'host' then
    raise exception '회의는 대표님 · 지점장님이 열 수 있어요';
  end if;
  if exists (select 1 from public.office_meetings where branch_name = s.branch_name and closed_at is null) then
    raise exception '이미 열린 회의가 있어요';
  end if;

  insert into public.office_meetings (branch_name, title, agenda, opened_by, video_url, schedule_id)
  values (s.branch_name, s.title, s.agenda, v_uid, s.video_url, s.id)
  returning id into v_id;
  insert into public.office_meeting_attendees (meeting_id, user_id) values (v_id, v_uid);
  v_me := public._office_display(v_uid);
  v_who := btrim(coalesce(v_me ->> 'name', '') || ' ' || coalesce(v_me ->> 'title', ''));
  insert into public.office_messages (meeting_id, author_id, kind, body)
  values (v_id, v_uid, 'system', v_who || '님이 회의를 열었어요');
  perform public._office_notify_people(
    s.branch_name, '지금 지점 회의가 열렸어요',
    s.title || ' · ' || v_who || case when s.video_url is not null then ' · 화상회의 링크 있음' else '' end,
    '/office/room', v_uid);

  if s.next_at is not null and s.next_at <= now() + interval '60 minutes' then
    update public.office_schedules set
      opened_for = s.next_at, reminded_for = s.next_at, last_meeting_id = v_id, skip_at = null,
      next_at = public._office_next_at(s.weekdays, s.once_on, s.at_time, greatest(s.next_at + interval '1 minute', now())),
      active = s.once_on is null
    where id = s.id;
  else
    update public.office_schedules set last_meeting_id = v_id where id = s.id;
  end if;
  perform public._office_ping(s.branch_name, 'meeting');
  perform public._office_ping(s.branch_name, 'schedule');
  return v_id;
exception when unique_violation then
  raise exception '이미 열린 회의가 있어요';
end $$;

-- 6) 매분 — 미리 알림 · 시작 시각에 열기 · 아무도 안 온 정기 회의 닫기 ──

-- 정기 회의 열기 (cron 전용). 열린 회의가 있으면 null — 6시간 넘게 열린 회의는 닫고 연다.
create or replace function public._office_open_scheduled(s public.office_schedules)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare v_open public.office_meetings; v_id uuid;
begin
  select * into v_open from public.office_meetings
   where branch_name = s.branch_name and closed_at is null
   for update;
  if v_open.id is not null then
    if v_open.opened_at > now() - interval '6 hours' then
      return null; -- 먼저 연 회의로 한다
    end if;
    insert into public.office_messages (meeting_id, author_id, kind, body)
    values (v_open.id, v_open.opened_by, 'system', '정기 회의 시간이 되어 이 회의는 닫았어요');
    update public.office_meetings set closed_at = now() where id = v_open.id;
    update public.office_meeting_attendees set left_at = now() where meeting_id = v_open.id and left_at is null;
  end if;

  insert into public.office_meetings (branch_name, title, agenda, opened_by, video_url, schedule_id)
  values (s.branch_name, s.title, s.agenda, s.created_by, s.video_url, s.id)
  returning id into v_id;
  insert into public.office_messages (meeting_id, author_id, kind, body)
  values (v_id, s.created_by, 'system', '정기 회의 시간이 되어 회의가 열렸어요');
  perform public._office_notify_people(
    s.branch_name, '지금 지점 회의가 열렸어요',
    s.title || ' · 정기 회의' || case when s.video_url is not null then ' · 화상회의 링크 있음' else '' end,
    '/office/room');
  perform public._office_ping(s.branch_name, 'meeting');
  return v_id;
exception when unique_violation then
  return null; -- 같은 순간 누가 회의를 열었다
end $$;

create or replace function public.office_schedule_tick()
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  s public.office_schedules; m public.office_meetings; v_now timestamptz := now(); v_id uuid; v_min integer;
  v_reminded integer := 0; v_opened integer := 0; v_skipped integer := 0; v_closed integer := 0;
begin
  for s in
    select * from public.office_schedules
     where active and next_at is not null
       and next_at - make_interval(mins => remind_min::integer) <= v_now
     order by next_at
     for update skip locked
  loop
    if s.next_at > v_now then
      -- ① 미리 알림 (쉬는 회의 · 꺼진 회의실은 보내지 않는다)
      if s.remind_min > 0 and s.reminded_for is distinct from s.next_at and s.skip_at is distinct from s.next_at
         and exists (select 1 from public.office_branches b where b.branch_name = s.branch_name and b.enabled) then
        v_min := greatest(1, ceil(extract(epoch from (s.next_at - v_now)) / 60.0)::integer);
        perform public._office_notify_people(
          s.branch_name,
          case when v_min >= 60 and v_min % 60 = 0 then (v_min / 60) || '시간 뒤 지점 회의가 있어요'
               else v_min || '분 뒤 지점 회의가 있어요' end,
          s.title || ' · ' || public._office_clock((s.next_at at time zone 'Asia/Seoul')::time)
            || case when s.video_url is not null then ' · 화상회의 링크 있음' else '' end,
          '/office');
        update public.office_schedules set reminded_for = s.next_at where id = s.id;
        v_reminded := v_reminded + 1;
      end if;
      continue;
    end if;

    -- ② 시작 시각 — 쉬는 회의 · 꺼진 회의실 · 30분 넘게 늦은 차례(cron 이 멈췄던 때)는 열지 않고 다음 차례로
    v_id := null;
    if s.skip_at is distinct from s.next_at and v_now - s.next_at <= interval '30 minutes'
       and exists (select 1 from public.office_branches b where b.branch_name = s.branch_name and b.enabled) then
      v_id := public._office_open_scheduled(s);
    end if;
    if v_id is null then v_skipped := v_skipped + 1; else v_opened := v_opened + 1; end if;
    update public.office_schedules set
      opened_for = s.next_at,
      last_meeting_id = coalesce(v_id, last_meeting_id),
      skip_at = null,
      next_at = public._office_next_at(s.weekdays, s.once_on, s.at_time, greatest(s.next_at + interval '1 minute', v_now)),
      active = s.once_on is null
    where id = s.id;
    perform public._office_ping(s.branch_name, 'schedule');
  end loop;

  -- ③ 정기 회의로 열렸는데 1시간 동안 아무도 안 들어온 회의는 닫는다
  for m in
    select om.* from public.office_meetings om
     where om.closed_at is null and om.schedule_id is not null
       and om.opened_at < v_now - interval '60 minutes'
       and not exists (select 1 from public.office_meeting_attendees a where a.meeting_id = om.id)
     for update of om skip locked
  loop
    insert into public.office_messages (meeting_id, author_id, kind, body)
    values (m.id, m.opened_by, 'system', '1시간 동안 아무도 들어오지 않아 회의를 닫았어요');
    update public.office_meetings set closed_at = v_now where id = m.id;
    perform public._office_ping(m.branch_name, 'meeting');
    v_closed := v_closed + 1;
  end loop;

  return jsonb_build_object('reminded', v_reminded, 'opened', v_opened, 'skipped', v_skipped, 'closed', v_closed);
end $$;

-- 7) 기존 함수에 한 칸씩 (지금 DB 정의 위에 — 나머지는 그대로) ─────────

-- 홈 「회의실 참석」 카드 — offices[].next = 다음 회의 {id, title, at}
create or replace function public.office_me()
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('offices', '[]'::jsonb); end if;
  return jsonb_build_object(
    'me', v_uid,
    'offices', coalesce((
      select jsonb_agg(jsonb_build_object(
               'branch', b.branch_name,
               'label', btrim(replace(b.branch_name, '153복싱짐', '')),
               'topic', b.topic,
               'role', public._office_role(v_uid, b.branch_name),
               'meeting', (select jsonb_build_object('id', m.id, 'title', m.title, 'opened_at', m.opened_at)
                             from public.office_meetings m
                            where m.branch_name = b.branch_name and m.closed_at is null),
               'next', public._office_next_schedule(b.branch_name))
             order by b.branch_name)
        from public.office_branches b
       where b.enabled and public._office_role(v_uid, b.branch_name) is not null), '[]'::jsonb));
end $$;

-- 회의실 — meeting.scheduled (정기 회의로 열린 회의)
create or replace function public.office_state(p_branch text default null)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_branch text; v_meeting public.office_meetings;
begin
  v_branch := public._office_scope(v_uid, p_branch);
  if v_branch is null then raise exception '켜진 지점 회의실이 없어요'; end if;
  perform public._office_assign_seats(v_branch);
  select * into v_meeting from public.office_meetings where branch_name = v_branch and closed_at is null;

  return jsonb_build_object(
    'branch', v_branch,
    'label', btrim(replace(v_branch, '153복싱짐', '')),
    'topic', (select topic from public.office_branches where branch_name = v_branch),
    'me', v_uid,
    'role', public._office_role(v_uid, v_branch),
    'branches', case when public._strategy_hq(v_uid)
                     then coalesce((select jsonb_agg(b.branch_name order by b.branch_name) from public.office_branches b where b.enabled), '[]'::jsonb)
                     else jsonb_build_array(v_branch) end,
    'people', coalesce((
      select jsonb_agg(public._office_display(pp.user_id) || jsonb_build_object(
               'hq', pp.hq,
               'host', public._office_role(pp.user_id, v_branch) = 'host',
               'seat', case when pp.hq then 'boss'
                            else (select os.seat from public.office_seats os where os.branch_name = v_branch and os.user_id = pp.user_id) end,
               'status', coalesce((select st.status from public.office_status st
                                    where st.user_id = pp.user_id and st.updated_at > now() - interval '3 hours'), 'on'),
               'style', (select cp.parts_json ->> 'style'
                           from public.member_character_assignments a
                           join public.character_presets cp on cp.id = a.preset_id
                          where a.user_id = pp.user_id and a.is_active
                          order by a.updated_at desc nulls last limit 1))
             order by pp.hq desc, (select coalesce(nullif(btrim(p.name), ''), p.nickname) from public.profiles p where p.user_id = pp.user_id))
        from public._office_people(v_branch) pp), '[]'::jsonb),
    -- 회의 열 때 미리 채울 지난번 링크 (회의를 여는 대표님 · 지점장에게만)
    'last_video_url', case when public._office_role(v_uid, v_branch) = 'host' then
      (select om.video_url from public.office_meetings om
        where om.branch_name = v_branch and om.video_url is not null
        order by om.opened_at desc limit 1) end,
    'meeting', case when v_meeting.id is null then null else jsonb_build_object(
      'id', v_meeting.id,
      'title', v_meeting.title,
      'agenda', to_jsonb(v_meeting.agenda),
      'opened_at', v_meeting.opened_at,
      'opened_by', public._office_display(v_meeting.opened_by),
      'video_url', v_meeting.video_url,
      'scheduled', v_meeting.schedule_id is not null,
      'attendees', coalesce((
        select jsonb_agg(jsonb_build_object('user_id', a.user_id, 'first_joined_at', a.first_joined_at,
                                            'last_joined_at', a.last_joined_at, 'in_room', a.left_at is null)
                         order by a.first_joined_at)
          from public.office_meeting_attendees a where a.meeting_id = v_meeting.id), '[]'::jsonb)) end
  );
end $$;

-- 지난 회의록 — scheduled
create or replace function public.office_meetings_list(p_branch text default null, p_limit integer default 20)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_branch text; v_limit integer := greatest(1, least(coalesce(p_limit, 20), 60));
begin
  v_branch := public._office_scope(v_uid, p_branch);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', m.id, 'title', m.title, 'opened_at', m.opened_at, 'closed_at', m.closed_at,
             'opened_by', public._office_display(m.opened_by),
             'scheduled', m.schedule_id is not null,
             'attendees', (select count(*) from public.office_meeting_attendees a where a.meeting_id = m.id),
             'decisions', (select count(*) from public.office_messages om where om.meeting_id = m.id and om.kind = 'decision' and om.deleted_at is null),
             'messages', (select count(*) from public.office_messages om where om.meeting_id = m.id and om.kind <> 'system' and om.deleted_at is null))
           order by m.opened_at desc)
      from (select * from public.office_meetings where branch_name = v_branch order by opened_at desc limit v_limit) m), '[]'::jsonb);
end $$;

-- 8) 권한 · 매분 예약 ───────────────────────────────────────────────

revoke all on function public._office_next_at(smallint[], date, time, timestamptz) from public, anon, authenticated;
revoke all on function public._office_clock(time) from public, anon, authenticated;
revoke all on function public._office_day_label(date) from public, anon, authenticated;
revoke all on function public._office_at_label(timestamptz) from public, anon, authenticated;
revoke all on function public._office_schedule_when(smallint[], date, time) from public, anon, authenticated;
revoke all on function public._office_next_schedule(text) from public, anon, authenticated;
revoke all on function public._office_notify_people(text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public._office_open_scheduled(public.office_schedules) from public, anon, authenticated;
revoke all on function public.office_schedule_tick() from public, anon, authenticated;

revoke all on function public.office_schedule_list(text) from public, anon;
revoke all on function public.office_schedule_save(text, text, uuid, text, text[], integer[], date, integer, text, boolean) from public, anon;
revoke all on function public.office_schedule_skip(uuid, boolean, boolean) from public, anon;
revoke all on function public.office_schedule_cancel(uuid, boolean) from public, anon;
revoke all on function public.office_schedule_open_now(uuid) from public, anon;
grant execute on function public.office_schedule_list(text) to authenticated;
grant execute on function public.office_schedule_save(text, text, uuid, text, text[], integer[], date, integer, text, boolean) to authenticated;
grant execute on function public.office_schedule_skip(uuid, boolean, boolean) to authenticated;
grant execute on function public.office_schedule_cancel(uuid, boolean) to authenticated;
grant execute on function public.office_schedule_open_now(uuid) to authenticated;

-- 같은 이름이면 덮어쓴다
select cron.schedule('office-schedule-tick', '* * * * *', $cron$select public.office_schedule_tick()$cron$);
