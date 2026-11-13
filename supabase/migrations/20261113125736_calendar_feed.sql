-- 📅 캘린더 3-1단계 — 구독 주소: 휴대폰 · 구글 · 네이버 캘린더에서 153 일정이 저절로
--   (2026-11-13 대표님 「추천대로 3-1부터」 — 「캘린더 3단계 보고서」 https://claude.ai/artifact/5EMvfMwaXakid7SzKg1NKK)
--
--   주소 하나를 휴대폰(아이폰) · 구글 캘린더에 한 번 넣으면 그 앱이 몇 시간마다 다시 읽어 153 일정이 늘 보인다.
--   알림 · 위젯 · 워치는 그 캘린더 앱 것을 그대로 쓴다(네이버 · 구글 기능을 그 앱 안에서 쓰는 셈).
--     · 코치진 주소(kind staff) = 내 일정(ops_plans) · 「근무」 시간표 · 내 지점들 153 일정 · 사무실 정기 회의
--     · 회원 주소(kind member) = 운동 약속(매주 · 휴관일은 빼고) · 내 지점 153 일정(승급 심사는 타이틀 레벨만) · D-day
--     · 지점 공개 주소 = 그 지점 153 일정(승급 심사 빼고) — 사람 정보가 없는 공지 달력
--   주소 = Edge Function calendar-feed/<토큰>.ics · 지점은 calendar-feed/branch/<지점 코드>.ics
--   토큰 = 무작위 64자(사람 · 종류마다 살아 있는 것 하나) · 다시 만들면 옛 주소는 끊긴다.
--   끊긴 주소 · 없는 주소 · 권한이 없어진 사람(그만둔 코치 · 승인이 풀린 회원)의 주소 = 빈 달력(Edge Function 이 200 + 일정 없음).
--     404 면 구글 · 아이폰이 지난번에 받은 일정을 계속 보여 준다(새 일정만 안 온다) — 비워야 그 캘린더에서도 사라진다.
--   주소 하나가 하루 1,440번 넘게 읽히면 그날은 {"limited":true} → Edge Function 429(캘린더는 지난 일정 그대로).
--   사람 이름은 넣지 않는다 — PT 는 'PT 수업', 개인 일정은 '개인 일정', 메모 · 회원 이름 없음.
--   새 표 1 · 새 함수만 — 기존 표 · 함수 그대로 · 표는 RLS + 함수로만 · 출석 표 트리거 없음.
--   끄기: 사람마다 my_calendar_feed_off · 모두 = update public.calendar_feed_tokens set revoked_at = now() where revoked_at is null;

-- 1) 표 — 구독 주소 토큰
create table if not exists public.calendar_feed_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null check (kind in ('staff', 'member')),
  token text not null unique check (token ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  last_fetched_at timestamptz,
  fetch_count integer not null default 0,
  fetch_day date,
  fetch_day_count integer not null default 0,
  revoked_at timestamptz
);
create unique index if not exists calendar_feed_tokens_live on public.calendar_feed_tokens (user_id, kind) where revoked_at is null;
create index if not exists calendar_feed_tokens_user on public.calendar_feed_tokens (user_id, created_at);
alter table public.calendar_feed_tokens enable row level security;
revoke all on public.calendar_feed_tokens from anon, authenticated;
comment on table public.calendar_feed_tokens is '캘린더 3-1 — 휴대폰 · 구글 캘린더 구독 주소 토큰. 화면은 my_calendar_feed* 함수로만, 읽기는 Edge Function calendar-feed(service_role).';

-- 2) 안쪽 함수 (화면에서 부르지 않음)

-- 그 종류의 주소를 가질 수 있나 — 회원 = 승인된 회원(또는 운영진) · 코치진 = 「일정」 탭을 쓰는 분(_ops_plan_branches)
create or replace function public._calendar_feed_can(_uid uuid, _kind text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select _uid is not null and case _kind
    when 'member' then public._is_active_member(_uid)
    when 'staff' then exists (select 1 from public._ops_plan_branches(_uid))
    else false
  end
$$;

-- '153복싱짐 선릉역점' → '선릉역점'
create or replace function public._calendar_feed_short(_branch text)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select nullif(btrim(regexp_replace(coalesce(_branch, ''), '^153복싱짐\s*', '')), '')
$$;

-- 153 일정 (휴관 · 단축 운영 · 이벤트 · 대회 · 승급 심사 · 특강 · 153 일정) — 화면 calendarEvents 와 같은 이름표
create or replace function public._calendar_feed_branch_events(_branches text[], _with_exam boolean, _from date, _to date, _with_branch boolean)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'uid', 'event-' || e.id,
           'title', (case when e.is_exam then '승급 심사'
                          else case e.kind when 'closed' then '휴관' when 'short' then '단축 운영' when 'event' then '이벤트'
                                           when 'match' then '대회' when 'class' then '특강' else '153 일정' end end)
                    || coalesce(' · ' || nullif(btrim(e.title), ''), '')
                    || case when _with_branch then coalesce(' · ' || public._calendar_feed_short(e.branch_name), '') else '' end,
           'day', e.start_on,
           'end_day', e.end_on,
           'busy', false,
           'location', e.branch_name,
           'updated', e.updated_at)
         order by e.start_on, e.created_at), '[]'::jsonb)
    from public.branch_calendar_events e
   where e.branch_name = any (_branches) and e.removed_at is null
     and (_with_exam or not e.is_exam)
     and e.end_on >= _from and e.start_on <= _to
$$;

-- 코치진 주소 자료
create or replace function public._calendar_feed_staff(_uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_branches text[];
  v_multi boolean;
  v_plans jsonb;
  v_shifts jsonb;
  v_events jsonb;
  v_meetings jsonb;
begin
  select coalesce(array_agg(distinct b.branch_name), '{}') into v_branches from public._ops_plan_branches(_uid) b;
  v_multi := cardinality(v_branches) > 1;

  -- ① 내 일정 — 반복은 매주(이 날만 빼기 = EXDATE) · 여러 날 시각 일정은 날마다 같은 시각 · PT 는 이름 없이 · 개인 일정은 제목 없이
  select coalesce(jsonb_agg(jsonb_build_object(
           'uid', 'plan-' || p.id,
           'title', case p.kind
                      when 'pt' then 'PT 수업'
                      when 'personal' then '개인 일정'
                      else (case p.kind when 'class' then '수업' when 'work' then '업무' when 'out' then '외부' when 'off' then '휴무' else '일정' end)
                           || coalesce(' · ' || nullif(btrim(p.title), ''), '')
                    end,
           'day', p.start_on,
           'end_day', p.end_on,
           'start', case when p.all_day then null else to_char(p.start_time, 'HH24:MI') end,
           'end', case when p.all_day then null else to_char(p.end_time, 'HH24:MI') end,
           'weekly', case when cardinality(p.repeat_weekdays) > 0 then to_jsonb(p.repeat_weekdays) end,
           'until', p.until_on,
           'exdates', case when cardinality(p.repeat_weekdays) > 0 then to_jsonb(p.skip_dates) else '[]'::jsonb end,
           'busy', not p.all_day and p.kind <> 'off',
           'updated', p.updated_at)
         order by p.start_on, p.created_at), '[]'::jsonb)
    into v_plans
    from public.ops_plans p
   where p.user_id = _uid and p.deleted_at is null
     and p.start_on <= v_today + 365
     and case when cardinality(p.repeat_weekdays) > 0 then coalesce(p.until_on, v_today) >= v_today - 30
              else p.end_on >= v_today - 30 end;

  -- ② 「근무」 시간표 — 지난 7일 ~ 앞 60일 (쉰 날 · 대타 넘김/받음은 _ops_duty_segments 가 이미 반영)
  select coalesce(jsonb_agg(jsonb_build_object(
           'uid', 'shift-' || s.id || '-' || to_char(d.d, 'YYYYMMDD') || '-' || to_char(g.start_time, 'HH24MI'),
           'title', '근무' || case when v_multi then coalesce(' · ' || public._calendar_feed_short(s.branch_name), '') else '' end,
           'day', d.d::date,
           'end_day', d.d::date,
           'start', to_char(g.start_time, 'HH24:MI'),
           'end', to_char(g.end_time, 'HH24:MI'),
           'busy', true,
           'location', s.branch_name)
         order by d.d, g.start_time), '[]'::jsonb)
    into v_shifts
    from public.ops_staff s
   cross join generate_series(v_today - 7, v_today + 60, interval '1 day') d(d)
   cross join lateral public._ops_duty_segments(s.id, d.d::date) g
   where s.user_id = _uid and s.active and g.end_time > g.start_time;

  -- ③ 153 일정 — 「일정」 탭을 쓰는 지점들 (코치진은 승급 심사도)
  v_events := public._calendar_feed_branch_events(v_branches, true, v_today - 30, v_today + 365, v_multi);

  -- ④ 사무실 정기 회의 — 지점 회의실을 쓰는 분 (매주 · 한 번 · 다음 한 번 쉬기 = EXDATE) · 길이는 1시간으로
  select coalesce(jsonb_agg(jsonb_build_object(
           'uid', 'meeting-' || o.id,
           'title', '회의 · ' || coalesce(nullif(btrim(o.title), ''), '정기 회의'),
           'day', case when cardinality(o.weekdays) > 0 then greatest((o.created_at at time zone 'Asia/Seoul')::date, v_today - 30) else o.once_on end,
           'end_day', case when cardinality(o.weekdays) > 0 then greatest((o.created_at at time zone 'Asia/Seoul')::date, v_today - 30) else o.once_on end,
           'start', to_char(o.at_time, 'HH24:MI'),
           'end', to_char(case when o.at_time >= time '23:00' then time '23:59' else o.at_time + interval '1 hour' end, 'HH24:MI'),
           'weekly', case when cardinality(o.weekdays) > 0 then to_jsonb(o.weekdays) end,
           'exdates', case when o.skip_at is not null then jsonb_build_array((o.skip_at at time zone 'Asia/Seoul')::date) else '[]'::jsonb end,
           'busy', true,
           'location', o.branch_name,
           'url', o.video_url,
           'updated', o.updated_at)
         order by o.at_time), '[]'::jsonb)
    into v_meetings
    from public.office_schedules o
   where o.branch_name = any (v_branches)
     and public._office_role(_uid, o.branch_name) is not null
     and o.active and o.canceled_at is null
     and (cardinality(o.weekdays) > 0 or o.once_on >= v_today - 30);

  return jsonb_build_object(
    'kind', 'staff',
    'name', '153 운영본부 일정',
    'events', v_plans || v_shifts || v_events || v_meetings);
end
$$;

-- 회원 주소 자료
create or replace function public._calendar_feed_member(_uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_branch text;
  v_promise jsonb := '[]'::jsonb;
  v_events jsonb;
  v_ddays jsonb;
  r record;
begin
  select p.branch_name into v_branch from public.profiles p where p.user_id = _uid;

  -- ① 운동 약속 — 매주 · 그 지점 휴관일(약속 요일에 걸친 날)은 EXDATE
  for r in
    select mp.weekdays, mp.time_slot, coalesce(mp.remind, '08:30') as remind, mp.notify, mp.started_on, mp.updated_at, mp.branch_name
      from public.member_promises mp
     where mp.user_id = _uid and mp.stopped_at is null and cardinality(mp.weekdays) > 0
  loop
    v_promise := jsonb_build_array(jsonb_build_object(
      'uid', 'promise-' || left(md5(_uid::text || ':promise'), 16),
      'promise', jsonb_build_object('weekdays', to_jsonb(r.weekdays), 'slot', r.time_slot, 'remind', r.remind, 'notify', coalesce(r.notify, true)),
      'day', greatest(r.started_on, v_today - 30),
      'exdates', coalesce((
        select jsonb_agg(distinct d.d::date order by d.d::date)
          from public.branch_calendar_events e
         cross join generate_series(greatest(e.start_on, v_today - 30), least(e.end_on, v_today + 365), interval '1 day') d(d)
         where e.branch_name = coalesce(r.branch_name, v_branch) and e.removed_at is null and e.kind = 'closed' and not e.is_exam
           and extract(dow from d.d)::smallint = any (r.weekdays)), '[]'::jsonb),
      'busy', false,
      'location', coalesce(r.branch_name, v_branch),
      'updated', r.updated_at));
  end loop;

  -- ② 내 지점 153 일정 (승급 심사는 타이틀 레벨 회원에게만 — 앱 달력과 같은 규칙)
  v_events := case when v_branch is null then '[]'::jsonb
                   else public._calendar_feed_branch_events(array[v_branch], public._cal_title_level(_uid), v_today - 30, v_today + 365, false) end;

  -- ③ D-day — 목표일 · 153 PB 다시 재는 날 · 153 기념일 · 타이틀매치 다시 도전 (승급 심사는 ②에 있음 · 지난 날은 안 넣음)
  select coalesce(jsonb_agg(jsonb_build_object(
           'uid', 'dday-' || (x ->> 'kind') || '-' || coalesce(x ->> 'id', x ->> 'day'),
           'title', case x ->> 'kind'
                      when 'goal' then '목표일 · ' || coalesce(nullif(btrim(x ->> 'title'), ''), '내 목표')
                      when 'pb' then '153 PB 다시 재는 날'
                      when 'anniv' then case when x ->> 'basis' = 'reg' then '153 ' || (x ->> 'years') || '주년'
                                             else '첫 도장 ' || (x ->> 'years') || '주년' end
                      when 'retry' then '타이틀매치 다시 도전할 수 있는 날'
                      else 'D-day' end,
           'day', (x ->> 'day')::date,
           'end_day', (x ->> 'day')::date,
           'busy', false)), '[]'::jsonb)
    into v_ddays
    from jsonb_array_elements(public._cal_ddays(_uid)) x
   where x ->> 'kind' in ('goal', 'pb', 'anniv', 'retry') and (x ->> 'day') is not null and (x ->> 'day')::date >= v_today;

  return jsonb_build_object(
    'kind', 'member',
    'name', '153 운동 달력',
    'events', v_promise || v_events || v_ddays);
end
$$;

-- 3) 화면 — 내 구독 주소 (만들지 않고 지금 상태만)
create or replace function public.my_calendar_feed(p_kind text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_token text;
  v_created timestamptz;
  v_fetched timestamptz;
  v_count integer;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('staff', 'member') then
    raise exception '주소 종류를 다시 골라 주세요';
  end if;
  if not public._calendar_feed_can(v_me, p_kind) then
    return jsonb_build_object('can', false, 'on', false);
  end if;
  select t.token, t.created_at, t.last_fetched_at, t.fetch_count
    into v_token, v_created, v_fetched, v_count
    from public.calendar_feed_tokens t
   where t.user_id = v_me and t.kind = p_kind and t.revoked_at is null;
  return jsonb_build_object(
    'can', true,
    'on', v_token is not null,
    'kind', p_kind,
    'token', v_token,
    'created_at', v_created,
    'last_fetched_at', v_fetched,
    'fetch_count', coalesce(v_count, 0));
end
$$;

-- 주소 만들기 (있으면 그대로 · p_rotate = 새 주소, 옛 주소는 끊김) — 하루 10번까지
create or replace function public.my_calendar_feed_on(p_kind text, p_rotate boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_token text;
  v_created timestamptz;
  v_fetched timestamptz;
  v_count integer;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('staff', 'member') then
    raise exception '주소 종류를 다시 골라 주세요';
  end if;
  if not public._calendar_feed_can(v_me, p_kind) then
    raise exception '이 계정은 아직 주소를 만들 수 없어요' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('calendar_feed:' || v_me::text || ':' || p_kind));
  if coalesce(p_rotate, false) then
    update public.calendar_feed_tokens set revoked_at = now()
     where user_id = v_me and kind = p_kind and revoked_at is null;
  end if;
  select t.token, t.created_at, t.last_fetched_at, t.fetch_count
    into v_token, v_created, v_fetched, v_count
    from public.calendar_feed_tokens t
   where t.user_id = v_me and t.kind = p_kind and t.revoked_at is null;
  if v_token is null then
    if (select count(*) from public.calendar_feed_tokens t where t.user_id = v_me and t.created_at > now() - interval '1 day') >= 10 then
      raise exception '오늘은 주소를 많이 만들었어요 — 내일 다시 해 주세요';
    end if;
    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    insert into public.calendar_feed_tokens (user_id, kind, token) values (v_me, p_kind, v_token)
    returning created_at into v_created;
    v_fetched := null;
    v_count := 0;
  end if;
  return jsonb_build_object(
    'can', true,
    'on', true,
    'kind', p_kind,
    'token', v_token,
    'created_at', v_created,
    'last_fetched_at', v_fetched,
    'fetch_count', coalesce(v_count, 0));
end
$$;

-- 주소 끊기 — 그 주소를 넣어 둔 캘린더는 다음에 읽을 때부터 비어 있다
create or replace function public.my_calendar_feed_off(p_kind text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('staff', 'member') then
    raise exception '주소 종류를 다시 골라 주세요';
  end if;
  update public.calendar_feed_tokens set revoked_at = now()
   where user_id = v_me and kind = p_kind and revoked_at is null;
  return jsonb_build_object('can', public._calendar_feed_can(v_me, p_kind), 'on', false, 'kind', p_kind);
end
$$;

-- 4) Edge Function calendar-feed 만 (service_role) — 토큰 → 일정 자료 (읽은 시각 · 횟수를 남긴다)
create or replace function public.calendar_feed_data(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_uid uuid;
  v_kind text;
  v_day_count integer;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  update public.calendar_feed_tokens
     set last_fetched_at = now(),
         fetch_count = fetch_count + 1,
         fetch_day = v_today,
         fetch_day_count = case when fetch_day = v_today then fetch_day_count + 1 else 1 end
   where token = p_token and revoked_at is null
  returning user_id, kind, fetch_day_count into v_uid, v_kind, v_day_count;
  if v_uid is null then
    return null;
  end if;
  -- 하루 상한 (휴대폰 · 태블릿 · 컴퓨터 · 구글이 같이 읽어도 넉넉한 수) — 넘으면 오늘은 쉼
  if v_day_count > 1440 then
    return jsonb_build_object('limited', true);
  end if;
  if not public._calendar_feed_can(v_uid, v_kind) then
    return null;
  end if;
  if v_kind = 'staff' then
    return public._calendar_feed_staff(v_uid);
  end if;
  return public._calendar_feed_member(v_uid);
end
$$;

-- 지점 공개 주소 — 앱에 보이는 지점의 153 일정 (승급 심사 빼고 · 사람 정보 없음)
create or replace function public.calendar_feed_branch(p_code text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
           'kind', 'branch',
           'name', b.name || ' 일정',
           'events', public._calendar_feed_branch_events(array[b.name], false,
                       (now() at time zone 'Asia/Seoul')::date - 30, (now() at time zone 'Asia/Seoul')::date + 365, false))
    from public.branches b
   where p_code is not null and p_code ~ '^[a-z0-9-]{2,40}$' and b.code = p_code and b.is_visible
   limit 1
$$;

-- 5) 권한 — 화면은 my_calendar_feed* 셋만 · 나머지는 service_role(Edge Function)만
revoke all on function public._calendar_feed_can(uuid, text) from public, anon, authenticated;
revoke all on function public._calendar_feed_short(text) from public, anon, authenticated;
revoke all on function public._calendar_feed_branch_events(text[], boolean, date, date, boolean) from public, anon, authenticated;
revoke all on function public._calendar_feed_staff(uuid) from public, anon, authenticated;
revoke all on function public._calendar_feed_member(uuid) from public, anon, authenticated;
revoke all on function public.calendar_feed_data(text) from public, anon, authenticated;
revoke all on function public.calendar_feed_branch(text) from public, anon, authenticated;
grant execute on function public.calendar_feed_data(text) to service_role;
grant execute on function public.calendar_feed_branch(text) to service_role;
revoke all on function public.my_calendar_feed(text) from public, anon;
revoke all on function public.my_calendar_feed_on(text, boolean) from public, anon;
revoke all on function public.my_calendar_feed_off(text) from public, anon;
grant execute on function public.my_calendar_feed(text) to authenticated;
grant execute on function public.my_calendar_feed_on(text, boolean) to authenticated;
grant execute on function public.my_calendar_feed_off(text) to authenticated;
