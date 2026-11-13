-- 📅 운동 달력 2-4단계 — 일요일 주간 돌아보기 · 운동 짝꿍과 같이 약속(쌍도장)
--   (+ 화면만: 이번 달 운동 카드 이미지 · 나의 153 앨범 · 재등록 즈음 '153과 함께한 시간' — DB 변경 없음)
--   (2026-11-13 대표님 「시작하자」 — 「운동 달력 2단계 보고서」 https://claude.ai/artifact/H8kmEW8aUrsLG92MRWB68b 2-4)
--
--   감정 설계(CLAUDE.md 「회원 감정 설계 기준」 — 한 달 · 재등록 = 확신 · 안 오는 날 = 그리움(죄책감 금지)):
--     · 일요일 주간 돌아보기 = 일요일 저녁 한 번(recap_at 19:30 ~ quiet_after 21:00) 이번 주(월~일) 운동 시간 · 지킨 약속 ·
--       금색 별 + 다음 주 약속 한 줄. 잘한 것만 — 이번 주 한 번도 안 온 회원에게는 보내지 않는다.
--       받는 회원 = 약속 시범 지점(promise_pilot.branches)의 승인된 회원(_promise_member) · 끈 회원(weekly_recap false) 빼고.
--       알림 링크 '/home?cal=그 일요일'. 운동 시간 = get_attendance_history 와 같은 식(날마다 첫 출석 · workout_minutes).
--     · 운동 짝꿍과 같이 약속 = 지금 이어진 운동 짝꿍(boxing_cornerman_pairs active · 한 명)의 약속 요일 · 시간대를 내 달력 자료에 —
--       같은 요일로 약속하면 서로 보인다(화면). 보이는 날짜 중 둘 다 출석한 날 = 쌍도장(together). 짝꿍 알림은 없다.
--   · 새 칸 2(member_calendar_prefs weekly_recap · last_recap_on) · 새 함수. 고친 함수(이름 · 인자 · 권한 그대로):
--     get_my_calendar(+ recap · partner) · calendar_tick(+ ④ 주간 돌아보기). 기존 표 · 제약 · 다른 함수는 그대로.
--   · 출석 표에는 트리거를 달지 않는다(보호 영역).
--   · 끄기: 주간 돌아보기 = 회원마다 set_my_weekly_recap(false) · 모두 = promise_pilot.branches 에서 지점 빼기(약속도 같이 꺼짐).

-- 1) 설정 — 주간 돌아보기 시각 (있는 값은 그대로 두고 빈 칸만)
update public.app_settings
   set value = jsonb_build_object(
                 'note_stage24', '운동 달력 2-4단계 (2026-11-13). recap_at = 일요일 주간 돌아보기 알림 시각(quiet_after 전까지) · 약속 시범 지점의 승인된 회원 중 이번 주 한 번이라도 온 회원 · 끈 회원 빼고 · 일요일마다 한 번.',
                 'recap_at', '19:30'
               ) || coalesce(value, '{}'::jsonb),
       updated_at = now()
 where key = 'calendar_notice'
   and not (coalesce(value, '{}'::jsonb) ? 'note_stage24');

-- 2) 칸 — 주간 돌아보기 알림(기본 켬 · 끈 회원만 false) · 마지막으로 보낸 일요일
alter table public.member_calendar_prefs add column if not exists weekly_recap boolean not null default true;
alter table public.member_calendar_prefs add column if not exists last_recap_on date;
comment on column public.member_calendar_prefs.weekly_recap is '일요일 주간 돌아보기 알림(2-4단계) — 기본 켬, 끈 회원만 false. set_my_weekly_recap.';
comment on column public.member_calendar_prefs.last_recap_on is '주간 돌아보기를 마지막으로 보낸 일요일 — 일요일마다 한 번(calendar_tick).';

-- 3) 안쪽 함수 (화면에서 부르지 않음)

-- 그 기간 운동 시간(분) — 날마다 첫 출석 하나 · get_attendance_history 와 같은 식(workout_minutes)
create or replace function public._cal_minutes_between(_uid uuid, _from date, _to date)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(sum(public.workout_minutes(d.at, d.ended_at)), 0)::integer
    from (
      select distinct on ((a.checked_in_at at time zone 'Asia/Seoul')::date)
             a.checked_in_at as at, a.ended_at
        from public.attendance_logs a
       where a.user_id = _uid and not coalesce(a.is_duplicate, false) and a.checked_in_at is not null
         and a.checked_in_at >= (_from::timestamp at time zone 'Asia/Seoul')
         and a.checked_in_at < ((_to + 1)::timestamp at time zone 'Asia/Seoul')
       order by (a.checked_in_at at time zone 'Asia/Seoul')::date, a.checked_in_at
    ) d
$$;

-- '2시간 10분' · '3시간' · '45분' (화면 durationLabel 과 같은 말)
create or replace function public._cal_duration_label(_min integer)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select case when x.h > 0 and x.r > 0 then x.h || '시간 ' || x.r || '분'
              when x.h > 0 then x.h || '시간'
              else x.r || '분' end
    from (select greatest(coalesce(_min, 0), 0) / 60 as h, greatest(coalesce(_min, 0), 0) % 60 as r) x
$$;

-- '월 · 수' · '평일' · '매일' (화면 weekdaysLabel 과 같은 말 · 월요일부터 · 0 = 일요일)
create or replace function public._cal_days_label(_days smallint[])
returns text
language sql
immutable
set search_path to 'public'
as $$
  select case
           when c.n = 7 then '매일'
           when c.n = 5 and _days @> array[1, 2, 3, 4, 5]::smallint[] then '평일'
           else (select string_agg(w.label, ' · ' order by w.ord)
                   from (values (1, '월', 1), (2, '화', 2), (3, '수', 3), (4, '목', 4), (5, '금', 5), (6, '토', 6), (0, '일', 7)) w(d, label, ord)
                  where w.d::smallint = any (_days))
         end
    from (select count(distinct x) as n from unnest(coalesce(_days, '{}'::smallint[])) x where x between 0 and 6) c
$$;

-- 지금 이어진 운동 짝꿍 (한 명) — 없으면 null
create or replace function public._cal_partner_of(_uid uuid)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select case when cp.requester_user_id = _uid then cp.receiver_user_id else cp.requester_user_id end
    from public.boxing_cornerman_pairs cp
   where cp.status = 'active' and (cp.requester_user_id = _uid or cp.receiver_user_id = _uid)
   order by cp.accepted_at desc nulls last, cp.created_at desc
   limit 1
$$;

-- 운동 짝꿍 (get_my_calendar) — 이름 · 짝꿍의 지금 약속(요일 · 시간대) · 보이는 날짜 중 둘 다 출석한 날(쌍도장) · 없으면 null
create or replace function public._cal_partner_json(_uid uuid, _from date, _to date)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with pp as (
    select public._cal_partner_of(_uid) as pid
  ), b as (
    select (_from::timestamp at time zone 'Asia/Seoul') as f, ((_to + 1)::timestamp at time zone 'Asia/Seoul') as t
  )
  select jsonb_build_object(
           'name', coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '짝꿍'),
           'days', coalesce((select to_jsonb(mp.weekdays) from public.member_promises mp
                              where mp.user_id = pp.pid and mp.stopped_at is null), '[]'::jsonb),
           'slot', (select mp.time_slot from public.member_promises mp where mp.user_id = pp.pid and mp.stopped_at is null),
           'together', coalesce((
             select jsonb_agg(x.d order by x.d)
               from (
                 select (a.checked_in_at at time zone 'Asia/Seoul')::date as d
                   from public.attendance_logs a, b
                  where a.user_id = _uid and not coalesce(a.is_duplicate, false)
                    and a.checked_in_at >= b.f and a.checked_in_at < b.t
                 intersect
                 select (a2.checked_in_at at time zone 'Asia/Seoul')::date
                   from public.attendance_logs a2, b
                  where a2.user_id = pp.pid and not coalesce(a2.is_duplicate, false)
                    and a2.checked_in_at >= b.f and a2.checked_in_at < b.t
               ) x), '[]'::jsonb))
    from pp
    join public.profiles p on p.user_id = pp.pid
   where pp.pid is not null and public._is_active_member(pp.pid)
$$;

-- 그 주(월~그날) 돌아보기 — 운동 시간 · 지킨 약속 · 금색 별 + 다음 주 약속 한 줄 (잘한 것만 · 그 주에 안 왔으면 null)
--   글은 화면 lib/calendarTogether.ts weekRecapLines 와 같은 말
create or replace function public._cal_week_recap(_uid uuid, _day date)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_mon date := _day - (extract(isodow from _day)::integer - 1);
  v_min integer;
  v_days smallint[];
  v_slot text;
  v_started date;
  v_kept integer := 0;
  v_stars integer := 0;
  v_total integer;
  v_done integer;
  v_facts text[] := '{}';
  v_label text;
  v_next text;
  d date;
begin
  if _uid is null or _day is null then
    return null;
  end if;
  if not exists (
    select 1 from public.attendance_logs a
     where a.user_id = _uid and not coalesce(a.is_duplicate, false)
       and a.checked_in_at >= (v_mon::timestamp at time zone 'Asia/Seoul')
       and a.checked_in_at < ((_day + 1)::timestamp at time zone 'Asia/Seoul')
  ) then
    return null;
  end if;
  v_min := public._cal_minutes_between(_uid, v_mon, _day);

  select mp.weekdays, mp.time_slot, mp.started_on into v_days, v_slot, v_started
    from public.member_promises mp
   where mp.user_id = _uid and mp.stopped_at is null;

  for d in select g::date from generate_series(v_mon::timestamp, _day::timestamp, interval '1 day') g loop
    select c.total, c.done into v_total, v_done from public._cal_check_count(_uid, d) c;
    if coalesce(v_total, 0) > 0 and v_done >= v_total then
      v_stars := v_stars + 1;
    end if;
    -- 지킨 약속 = 약속한 요일에 출석한 날 (휴관일에 온 날도 센다 — 온 것은 잘한 것)
    if v_days is not null and d >= v_started and extract(dow from d)::smallint = any (v_days)
       and exists (select 1 from public.attendance_logs a
                    where a.user_id = _uid and not coalesce(a.is_duplicate, false)
                      and a.checked_in_at >= (d::timestamp at time zone 'Asia/Seoul')
                      and a.checked_in_at < ((d + 1)::timestamp at time zone 'Asia/Seoul')) then
      v_kept := v_kept + 1;
    end if;
  end loop;

  if v_kept > 0 then
    v_facts := v_facts || ('약속 ' || v_kept || '번 지켰어요');
  end if;
  if v_stars > 0 then
    v_facts := v_facts || ('금색 별 ' || v_stars || '개');
  end if;
  if v_days is not null then
    v_label := public._cal_days_label(v_days);
    v_next := case when v_label = '매일' and v_slot is null then '다음 주도 매일 만나요'
                   else '다음 주도 ' || v_label || coalesce(' ' || public._promise_slot_label(v_slot), '') || '에 만나요' end;
  else
    v_next := '다음 주도 체육관에서 만나요';
  end if;

  return jsonb_build_object(
    'from', v_mon,
    'to', _day,
    'minutes', v_min,
    'kept', v_kept,
    'stars', v_stars,
    'title', '이번 주 ' || public._cal_duration_label(v_min) || ' 운동했어요',
    'body', case when cardinality(v_facts) > 0 then array_to_string(v_facts, ' · ') || '. ' || v_next else v_next end);
end
$$;

-- 4) 주간 돌아보기 알림 켜기 · 끄기 (회원마다 · 기본 켬)
create or replace function public.set_my_weekly_recap(p_on boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_on boolean;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public._is_active_member(v_me) then
    raise exception '승인된 회원만 쓸 수 있어요' using errcode = '42501';
  end if;
  insert into public.member_calendar_prefs as m (user_id, weekly_recap)
  values (v_me, coalesce(p_on, true))
  on conflict (user_id) do update
     set weekly_recap = excluded.weekly_recap, updated_at = now()
  returning m.weekly_recap into v_on;
  return jsonb_build_object(
    'on', v_on,
    'at', coalesce(public._cal_conf() ->> 'recap_at', '19:30'),
    'sends', public._promise_member(v_me) is not null);
end
$$;

-- 5) 회원 화면 — 보이는 날짜(63일까지)의 체크 · 한 줄 · 스티커 · 153 일정 · 저요 한 모집 · 저녁 독려
--    + (2-3) 그날 한 일(acts) · 코치 한마디(notes) · 기념일(anniv) · 153 D-day(ddays — 보이는 날짜와 상관없이 다가오는 것)
--    + (2-4) 주간 돌아보기 알림(recap — 켬/끔 · 시각 · 이 회원에게 가는지) · 운동 짝꿍(partner — 약속 요일 · 둘 다 온 날)
create or replace function public.get_my_calendar(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
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
           'weekdays', to_jsonb(i.weekdays),
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
             'visibility', coalesce(j.visibility, 'branch'), 'at', j.created_at) as entry
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

  select cp.evening_nudge, cp.weekly_recap into v_nudge, v_recap from public.member_calendar_prefs cp where cp.user_id = v_me;

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

  return jsonb_build_object(
    'on', true,
    'today', (now() at time zone 'Asia/Seoul')::date,
    'items', v_items,
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
$$;

-- 6) 10분마다 — 153 일정 알림 (승급 심사는 타이틀 레벨 회원에게만) · 저녁 독려 (2-3 그대로) + (2-4) ④ 일요일 주간 돌아보기
create or replace function public.calendar_tick()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  k jsonb := public._cal_conf();
  v_now timestamptz := now();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_hm text := to_char(now() at time zone 'Asia/Seoul', 'HH24:MI');
  v_morning text := coalesce(k ->> 'event_morning', '08:30');
  v_eve text := coalesce(k ->> 'event_eve', '19:00');
  v_nudge text := coalesce(k ->> 'nudge_at', '20:00');
  v_quiet text := coalesce(k ->> 'quiet_after', '21:00');
  v_recap text := coalesce(k ->> 'recap_at', '19:30');
  r record;
  v_n integer;
  v_events integer := 0;
  v_sent integer := 0;
  v_total integer;
  v_done integer;
  v_uids uuid[] := '{}';
  v_titles text[] := '{}';
  v_bodies text[] := '{}';
  v_rc jsonb;
  v_ru uuid[] := '{}';
  v_rt text[] := '{}';
  v_rb text[] := '{}';
begin
  -- ① · ② 153 일정 — 일정마다 한 번 · 그 지점 알림 받는 회원 모두에게 한 문장으로 (승급 심사는 타이틀 레벨 회원만)
  if v_hm < v_quiet then
    for r in
      select e.id, e.branch_name, case when e.is_exam then 'exam' else e.kind end as kind, e.is_exam,
             e.title, e.start_on, e.end_on, false as eve
        from public.branch_calendar_events e
       where e.removed_at is null and e.notify_morning and e.morning_sent_at is null
         and e.start_on = v_today and v_hm >= v_morning
      union all
      select e.id, e.branch_name, case when e.is_exam then 'exam' else e.kind end as kind, e.is_exam,
             e.title, e.start_on, e.end_on, true as eve
        from public.branch_calendar_events e
       where e.removed_at is null and e.notify_eve and e.eve_sent_at is null
         and e.start_on = v_today + 1 and v_hm >= v_eve
    loop
      if r.eve then
        update public.branch_calendar_events set eve_sent_at = v_now where id = r.id and eve_sent_at is null;
      else
        update public.branch_calendar_events set morning_sent_at = v_now where id = r.id and morning_sent_at is null;
      end if;
      continue when not found;

      insert into public.notifications (user_id, title, body, link)
      select a.user_id,
             public._cal_event_notice_title(r.kind, r.eve),
             r.title || case when r.end_on > r.start_on then ' · ' || public._cal_day_label(r.end_on) || '까지' else '' end,
             '/home'
        from public._cal_event_audience(r.branch_name) a
       where not r.is_exam or public._cal_title_level(a.user_id);
      get diagnostics v_n = row_count;

      if r.eve then
        update public.branch_calendar_events set eve_sent_n = v_n where id = r.id;
      else
        update public.branch_calendar_events set morning_sent_n = v_n where id = r.id;
      end if;
      v_events := v_events + 1;
      v_sent := v_sent + v_n;
    end loop;
  end if;

  -- ③ 저녁 독려 — 켠 회원만 · 하루 한 번 살펴보고 · 채운 것이 있고 아직 남았을 때만 (못한 것은 말하지 않는다)
  if v_hm >= v_nudge and v_hm < v_quiet then
    for r in
      select cp.user_id
        from public.member_calendar_prefs cp
       where cp.evening_nudge
         and cp.last_nudge_on is distinct from v_today
         and public._is_active_member(cp.user_id)
       for update of cp skip locked
    loop
      update public.member_calendar_prefs set last_nudge_on = v_today where user_id = r.user_id;
      select x.total, x.done into v_total, v_done from public._cal_check_count(r.user_id, v_today) x;
      continue when coalesce(v_done, 0) < 1 or v_done >= v_total;
      v_uids := v_uids || r.user_id;
      v_titles := v_titles || ('오늘 ' || v_done || '개 채웠어요');
      v_bodies := v_bodies || (case when v_total - v_done = 1 then '하나 더 채우면 금색 별이에요'
                                    else (v_total - v_done) || '개 더 채우면 금색 별이에요' end);
    end loop;
    if cardinality(v_uids) > 0 then
      insert into public.notifications (user_id, title, body, link)
      select u, t, b, '/home' from unnest(v_uids, v_titles, v_bodies) as x(u, t, b);
    end if;
  end if;

  -- ④ 일요일 주간 돌아보기 — 약속 시범 지점 회원 · 이번 주 한 번이라도 온 회원 · 끈 회원 빼고 · 일요일마다 한 번 (잘한 것만)
  if extract(isodow from (now() at time zone 'Asia/Seoul')) = 7 and v_hm >= v_recap and v_hm < v_quiet then
    for r in
      select p.user_id
        from public.profiles p
       where coalesce(p.is_approved, false)
         and public._promise_member(p.user_id) is not null
         and exists (select 1 from public.attendance_logs a
                      where a.user_id = p.user_id and not coalesce(a.is_duplicate, false)
                        and a.checked_in_at >= ((v_today - 6)::timestamp at time zone 'Asia/Seoul')
                        and a.checked_in_at < ((v_today + 1)::timestamp at time zone 'Asia/Seoul'))
         and not exists (select 1 from public.member_calendar_prefs cp
                          where cp.user_id = p.user_id and (not cp.weekly_recap or cp.last_recap_on = v_today))
    loop
      -- 먼저 표시하고 보낸다 — 두 바퀴가 겹쳐도 한 번
      insert into public.member_calendar_prefs as m (user_id, last_recap_on)
      values (r.user_id, v_today)
      on conflict (user_id) do update
         set last_recap_on = excluded.last_recap_on, updated_at = now()
       where m.weekly_recap and m.last_recap_on is distinct from excluded.last_recap_on;
      continue when not found;
      v_rc := public._cal_week_recap(r.user_id, v_today);
      continue when v_rc is null;
      v_ru := v_ru || r.user_id;
      v_rt := v_rt || (v_rc ->> 'title');
      v_rb := v_rb || (v_rc ->> 'body');
    end loop;
    if cardinality(v_ru) > 0 then
      insert into public.notifications (user_id, title, body, link)
      select u, tt, bb, '/home?cal=' || to_char(v_today, 'YYYY-MM-DD') from unnest(v_ru, v_rt, v_rb) as x(u, tt, bb);
    end if;
  end if;

  return jsonb_build_object('events', v_events, 'event_sent', v_sent, 'nudge', cardinality(v_uids), 'recap', cardinality(v_ru), 'hm', v_hm);
end
$$;

-- 7) 권한 — 화면은 set_my_weekly_recap 를 새로
revoke all on function public._cal_minutes_between(uuid, date, date) from public, anon, authenticated;
revoke all on function public._cal_duration_label(integer) from public, anon, authenticated;
revoke all on function public._cal_days_label(smallint[]) from public, anon, authenticated;
revoke all on function public._cal_partner_of(uuid) from public, anon, authenticated;
revoke all on function public._cal_partner_json(uuid, date, date) from public, anon, authenticated;
revoke all on function public._cal_week_recap(uuid, date) from public, anon, authenticated;
revoke all on function public.set_my_weekly_recap(boolean) from public, anon;
grant execute on function public.set_my_weekly_recap(boolean) to authenticated;
