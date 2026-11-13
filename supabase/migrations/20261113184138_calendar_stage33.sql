-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 📅 캘린더 3-3단계 — 운영본부 함께 쓰기: 초대 · 응답 · 시간 찾기 · 팀 바쁨 · 캘린더 켜고 끄기 · 부재중 · 집중 시간 ·
--    시간 인사이트 · 회의 링크 · 첨부 (2026-11-13 대표님 「남은거 진행하자」 · 「캘린더 3단계 보고서」
--    https://claude.ai/artifact/5EMvfMwaXakid7SzKg1NKK 3-3 칸)
--
--   ① ops_plans 칸 더하기 — meet_url(줌 · 구글 미트 · 사무실 _office_video_url 과 같은 규칙) · focus(집중 시간 — 시각 일정만) ·
--      attachments(비공개 저장소 ops-plan-files 의 파일 5개까지 {path, name, size, type}).
--   ② ops_plan_guests — 초대(그 지점 팀 _ops_plan_team 만 · 20명까지) · 응답 yes / no / maybe(비면 아직) · 메모 60자 ·
--      새 시간 제안 · 휴무라 저절로 '아니요'(auto) · 빠진 손님은 removed_at(남겨 둔다) · '바뀌었어요' 알림은 10분에 한 번.
--   ③ ops_plan_prefs 칸 더하기 — cals_off(꺼 둔 캘린더 · 기기 말고 DB) · remind_default(초대받은 일정 · 새 일정 기본 알림).
--   ④ 저장 ops_plan_save — 새 키 meet_url · focus · attachments · guests(안 보낸 예전 화면은 그대로 둔다) · 초대 · 빠짐 ·
--      시간이 바뀌면 답을 다시 · 휴무 일정을 넣으면 그 기간 초대에 저절로 '아니요'(_ops_plan_off_decline).
--      응답 ops_plan_respond · 시간 찾기 ops_plan_find_times · 설정 ops_plan_prefs_save · 시간 인사이트 ops_plan_insights.
--   ⑤ 읽기 ops_plans_range — 초대받은 일정 · team(초대할 수 있는 사람) · busy(팀원 바쁜 시간 — 제목 없이 · 7일 안 범위) ·
--      invites(답할 초대) · prefs(꺼 둔 캘린더 · 기본 알림). _ops_plan_json = 회의 링크 · 첨부 · 손님 · 내 답 · 만든 사람.
--   ⑥ 알림 — 일정 알림(ops_plan_remind_tick)에 참석 · 아마 손님(기본 알림 분) · 아침 브리핑에 참석하는 초대 · 지우면 손님에게
--      '취소됐어요' · 집중 시간 동안 이 앱 알림은 알림함에만(notifications BEFORE INSERT 트리거 — 실패해도 알림은 그대로 들어간다).
--   ⑦ 첨부 저장소 ops-plan-files(비공개 · 10MB · 사진 · PDF) — 넣기 = 내 폴더 + 「일정」 탭을 쓰는 분 · 읽기 = 내 폴더 또는
--      그 파일이 붙은 일정의 만든 사람 · 손님 · 그 지점 관리자. 바꾸기 · 빼기 정책은 없다(일정에서 빼도 파일은 남는다).
--      정책이 부르는 함수 둘은 authenticated 가 실행할 수 있고 오류를 내지 않는다(다른 저장소 올리기가 막히지 않게).
--   ⑧ 휴대폰 캘린더 구독(_calendar_feed_staff) — 참석 · 아마로 답한 초대도 내 캘린더에.
--
--   보이는 범위(대표님 결정 4): 코치님 = 내 일정 + 초대받은 일정 + 팀원은 '바쁨'만(제목 없이 · 「근무」 탭 시간표 · 쉰 날은 안 보냄).
--   기존 표 · 함수의 이름 · 인자 · 권한은 그대로. 새 표는 RLS 켜고 anon · authenticated 직접 읽기 · 쓰기 막음 → 함수로만.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

-- ── ① 칸 ─────────────────────────────────────────────────────────────────────────────────────
alter table public.ops_plans add column if not exists meet_url text;
alter table public.ops_plans add column if not exists focus boolean not null default false;
alter table public.ops_plans add column if not exists attachments jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.ops_plans'::regclass and conname = 'ops_plans_meet_url_check') then
    alter table public.ops_plans add constraint ops_plans_meet_url_check
      check (meet_url is null or (char_length(meet_url) <= 500 and meet_url ~ '^https://'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.ops_plans'::regclass and conname = 'ops_plans_focus_check') then
    alter table public.ops_plans add constraint ops_plans_focus_check check (not focus or not all_day);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.ops_plans'::regclass and conname = 'ops_plans_attachments_check') then
    alter table public.ops_plans add constraint ops_plans_attachments_check
      check (jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 5);
  end if;
end $$;

create index if not exists ops_plans_focus_idx on public.ops_plans (user_id) where focus and deleted_at is null;

comment on column public.ops_plans.meet_url is '캘린더 3-3 — 줌 · 구글 미트 링크(_office_video_url 로 고른 https 주소)';
comment on column public.ops_plans.focus is '캘린더 3-3 — 집중 시간: 이 일정 동안 만든 사람의 앱 알림은 알림함에만(휴대폰 알림 없이)';
comment on column public.ops_plans.attachments is '캘린더 3-3 — 첨부 [{path, name, size, type}] 5개까지 · 파일은 비공개 저장소 ops-plan-files/<만든 사람>/…';

-- ── ② 손님 ───────────────────────────────────────────────────────────────────────────────────
create table if not exists public.ops_plan_guests (
  plan_id uuid not null references public.ops_plans (id),
  user_id uuid not null,
  response text check (response in ('yes', 'no', 'maybe')),
  note text check (note is null or char_length(note) <= 60),
  proposed_on date,
  proposed_start time,
  proposed_end time,
  auto boolean not null default false,
  invited_by uuid,
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  removed_at timestamptz,
  changed_notified_at timestamptz,
  primary key (plan_id, user_id),
  constraint ops_plan_guests_proposed_check check (
    (proposed_on is not null or (proposed_start is null and proposed_end is null))
    and ((proposed_start is null) = (proposed_end is null))
    and (proposed_end is null or proposed_end > proposed_start))
);
create index if not exists ops_plan_guests_user_idx on public.ops_plan_guests (user_id) where removed_at is null;
alter table public.ops_plan_guests enable row level security;
revoke all on public.ops_plan_guests from anon, authenticated;
comment on table public.ops_plan_guests is '캘린더 3-3 — 일정 초대(그 지점 팀만) · 응답 · 메모 · 새 시간 제안 · 휴무라 저절로 아니요(auto) · 빠지면 removed_at';

-- ── ③ 설정 칸 ────────────────────────────────────────────────────────────────────────────────
alter table public.ops_plan_prefs add column if not exists cals_off text[] not null default '{team}';
alter table public.ops_plan_prefs add column if not exists remind_default smallint[] not null default '{10}';
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.ops_plan_prefs'::regclass and conname = 'ops_plan_prefs_cals_check') then
    alter table public.ops_plan_prefs add constraint ops_plan_prefs_cals_check
      check (cardinality(cals_off) <= 8 and cals_off <@ '{mine,invited,team,work,events,meetings,pt,todo}'::text[]);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.ops_plan_prefs'::regclass and conname = 'ops_plan_prefs_remind_check') then
    alter table public.ops_plan_prefs add constraint ops_plan_prefs_remind_check
      check (cardinality(remind_default) <= 4 and remind_default <@ '{0,5,10,15,30,60,120,1440}'::smallint[]);
  end if;
end $$;
comment on column public.ops_plan_prefs.cals_off is '캘린더 3-3 — 꺼 둔 캘린더(mine 내 일정 · invited 초대 · team 팀 바쁨 · work 근무 · events 153 일정 · meetings 회의 · pt · todo) — 처음엔 팀만 꺼짐';
comment on column public.ops_plan_prefs.remind_default is '캘린더 3-3 — 기본 알림(분 전) · 새 일정 시트의 처음 값 · 참석하는 초대의 알림';

-- ── ④ 안쪽 함수 ──────────────────────────────────────────────────────────────────────────────
-- "11월 17일 (화)"
create or replace function public._ops_plan_day_label(_d date)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select extract(month from _d)::int || '월 ' || extract(day from _d)::int || '일 ('
         || (array['일', '월', '화', '수', '목', '금', '토'])[extract(dow from _d)::int + 1] || ')'
$$;

-- 알림 글의 때 — "11월 17일 (화) 19:00~20:00" · "11월 10일 (화) – 11월 12일 (목) 하루 종일" · "11월 17일 (화)부터 매주 화 · 목 19:00~20:00"
create or replace function public._ops_plan_when(pl public.ops_plans)
returns text
language sql
stable
set search_path to 'public'
as $$
  select case
           when pl.rrule is not null or cardinality(pl.repeat_weekdays) > 0 then
             public._ops_plan_day_label(pl.start_on) || '부터 '
             || case when cardinality(pl.repeat_weekdays) > 0
                     then '매주 ' || (select string_agg((array['일', '월', '화', '수', '목', '금', '토'])[d + 1], ' · ' order by (d + 6) % 7)
                                       from unnest(pl.repeat_weekdays) d)
                     else '반복' end
           when pl.end_on > pl.start_on then public._ops_plan_day_label(pl.start_on) || ' – ' || public._ops_plan_day_label(pl.end_on)
           else public._ops_plan_day_label(pl.start_on)
         end
         || ' ' || case when pl.all_day then '하루 종일' else to_char(pl.start_time, 'HH24:MI') || '~' || to_char(pl.end_time, 'HH24:MI') end
$$;

-- 범위 안에서 이 일정이 있는 날들 (= _ops_plan_on 과 같은 뜻 · 규칙은 한 번만 읽는다)
create or replace function public._ops_plan_days(pl public.ops_plans, _from date, _to date)
returns setof date
language plpgsql
stable
set search_path to 'public'
as $$
declare
  r jsonb := public._ops_plan_rule(pl.rrule, pl.repeat_weekdays, pl.start_on);
  a date;
  b date;
begin
  if r is null then
    a := greatest(pl.start_on, _from);
    b := least(pl.end_on, _to);
    if a > b then return; end if;
    return query select g::date from generate_series(a, b, interval '1 day') g;
    return;
  end if;
  a := greatest(pl.start_on, _from);
  b := least(coalesce(pl.until_on, _to), _to);
  if a > b then return; end if;
  return query
    select g::date from generate_series(a, b, interval '1 day') g
     where not (g::date = any (pl.skip_dates)) and public._ops_recur_match(r, pl.start_on, g::date);
end
$$;

-- 그날부터 이 일정이 처음 있는 날 (400일 안 · 없으면 null)
create or replace function public._ops_plan_next_on(pl public.ops_plans, _from date)
returns date
language plpgsql
stable
set search_path to 'public'
as $$
declare
  r jsonb := public._ops_plan_rule(pl.rrule, pl.repeat_weekdays, pl.start_on);
  d date;
  i int;
begin
  if r is null then
    return case when pl.end_on >= _from then greatest(pl.start_on, _from) end;
  end if;
  d := greatest(pl.start_on, _from);
  for i in 0..400 loop
    if pl.until_on is not null and d + i > pl.until_on then return null; end if;
    if not ((d + i) = any (pl.skip_dates)) and public._ops_recur_match(r, pl.start_on, d + i) then return d + i; end if;
  end loop;
  return null;
end
$$;

-- 알림 한 통 — 밤 10시 ~ 아침 8시는 알림함에만(pushed_at · 3-2 일정 알림과 같은 결)
create or replace function public._ops_plan_notify(_user uuid, _title text, _body text, _link text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_h int := extract(hour from now() at time zone 'Asia/Seoul')::int;
begin
  if _user is null then return; end if;
  insert into public.notifications (user_id, title, body, link, pushed_at)
  values (_user, left(_title, 120), left(coalesce(_body, ''), 300), _link, case when v_h >= 22 or v_h < 8 then now() end);
end
$$;

-- 손님 목록 (초대한 순서 · 이름 = 닉네임 없으면 이름)
create or replace function public._ops_plan_guests_json(_plan uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', g.user_id,
           'name', coalesce(public._strategy_display(g.user_id) ->> 'name', '팀원'),
           'response', g.response, 'note', g.note, 'auto', g.auto,
           'proposed_on', g.proposed_on,
           'proposed_start', to_char(g.proposed_start, 'HH24:MI'), 'proposed_end', to_char(g.proposed_end, 'HH24:MI'),
           'responded_at', g.responded_at)
         order by g.invited_at, g.user_id), '[]'::jsonb)
    from public.ops_plan_guests g
   where g.plan_id = _plan and g.removed_at is null
$$;

-- 그날 그 시간에 그 사람이 「일정」에 넣은 휴무가 있나 (하루 종일 휴무 = 그날 내내 · _s 가 비면 그날 아무 휴무나)
--   「근무」 탭의 쉰 날은 보지 않는다(코치님 근무 자료는 본인 · 관리자만 — 10/29)
create or replace function public._ops_plan_off_on(_user uuid, _d date, _s time, _e time)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.ops_plans o
     where o.user_id = _user and o.kind = 'off' and o.deleted_at is null
       and o.start_on <= _d and (o.end_on >= _d or o.rrule is not null or cardinality(o.repeat_weekdays) > 0)
       and public._ops_plan_on(o, _d)
       and (o.all_day or _s is null or (o.start_time < _e and o.end_time > _s)))
$$;

-- 한 번 하는 일정이 그 사람의 휴무와 겹치나 (반복 일정은 회차마다 답이 따로 없어 저절로 아니요를 하지 않는다 · 지난 일정 빼고)
create or replace function public._ops_plan_overlaps_off(_pl public.ops_plans, _user uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare d date;
begin
  if _pl.rrule is not null or cardinality(_pl.repeat_weekdays) > 0 or _pl.kind = 'off' then return false; end if;
  if _pl.end_on < (now() at time zone 'Asia/Seoul')::date then return false; end if;
  for d in select g::date from generate_series(_pl.start_on, _pl.end_on, interval '1 day') g loop
    if public._ops_plan_off_on(_user, d,
                               case when _pl.all_day then null else _pl.start_time end,
                               case when _pl.all_day then null else _pl.end_time end) then
      return true;
    end if;
  end loop;
  return false;
end
$$;

-- 손님 맞추기 — 빠진 사람 · 새로 온 사람 · 그대로인 사람(시간이 바뀌면 답을 다시) · 나뉜 새 줄(_orig)의 손님은 '바뀌었어요'
create or replace function public._ops_plan_guests_apply(_pl public.ops_plans, _guests uuid[], _actor uuid, _orig uuid,
                                                         _time boolean, _info boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_owner text := coalesce(public._strategy_display(_pl.user_id) ->> 'name', '코치');
  v_label text := coalesce(nullif(btrim(_pl.title), ''), public._ops_plan_kind_label(_pl.kind));
  v_when text := public._ops_plan_when(_pl);
  v_link text := '/office?tab=plan&d='
                 || to_char(coalesce(public._ops_plan_next_on(_pl, (now() at time zone 'Asia/Seoul')::date), _pl.start_on), 'YYYY-MM-DD')
                 || '&plan=' || _pl.id;
  v_prev uuid[] := '{}';
  g public.ops_plan_guests%rowtype;
  u uuid;
  v_off boolean;
begin
  _guests := coalesce(_guests, '{}');
  -- 빠진 손님 — 줄은 남기고 removed_at
  for g in select * from public.ops_plan_guests x where x.plan_id = _pl.id and x.removed_at is null and not (x.user_id = any (_guests)) loop
    update public.ops_plan_guests set removed_at = now() where plan_id = _pl.id and user_id = g.user_id;
    perform public._ops_plan_notify(g.user_id, '🗓 일정 초대가 취소됐어요', v_owner || '님 · ' || v_label || ' · ' || v_when, '/office?tab=plan');
  end loop;
  if _orig is not null then
    select coalesce(array_agg(x.user_id), '{}') into v_prev from public.ops_plan_guests x where x.plan_id = _orig and x.removed_at is null;
  end if;
  foreach u in array _guests loop
    v_off := public._ops_plan_overlaps_off(_pl, u);
    select * into g from public.ops_plan_guests x where x.plan_id = _pl.id and x.user_id = u;
    if found and g.removed_at is null then
      if _time then
        update public.ops_plan_guests
           set response = case when v_off then 'no' end, auto = v_off, note = case when v_off then '휴무예요' end,
               proposed_on = null, proposed_start = null, proposed_end = null,
               responded_at = case when v_off then now() end
         where plan_id = _pl.id and user_id = u;
      end if;
      if (_time or _info) and (g.changed_notified_at is null or g.changed_notified_at < now() - interval '10 minutes') then
        update public.ops_plan_guests set changed_notified_at = now() where plan_id = _pl.id and user_id = u;
        perform public._ops_plan_notify(u, '🗓 일정이 바뀌었어요',
          v_owner || '님 · ' || v_label || ' · ' || v_when || case when _time and not v_off then ' · 다시 답해 주세요' else '' end, v_link);
      end if;
    else
      insert into public.ops_plan_guests (plan_id, user_id, response, note, auto, invited_by, invited_at, responded_at,
                                          removed_at, changed_notified_at, proposed_on, proposed_start, proposed_end)
      values (_pl.id, u, case when v_off then 'no' end, case when v_off then '휴무예요' end, v_off, _actor, now(),
              case when v_off then now() end, null, case when u = any (v_prev) then now() end, null, null, null)
      on conflict (plan_id, user_id) do update
         set response = excluded.response, note = excluded.note, auto = excluded.auto, invited_by = excluded.invited_by,
             invited_at = excluded.invited_at, responded_at = excluded.responded_at, removed_at = null,
             changed_notified_at = excluded.changed_notified_at, proposed_on = null, proposed_start = null, proposed_end = null;
      if v_off then
        perform public._ops_plan_notify(_pl.user_id,
          '❌ ' || coalesce(public._strategy_display(u) ->> 'name', '팀원') || '님은 그날 휴무예요',
          v_label || ' · ' || v_when || ' · 저절로 ''아니요''로 답했어요', v_link);
      elsif u = any (v_prev) then
        perform public._ops_plan_notify(u, '🗓 일정이 바뀌었어요', v_owner || '님 · ' || v_label || ' · ' || v_when || ' · 다시 답해 주세요', v_link);
      else
        perform public._ops_plan_notify(u, '📅 ' || v_owner || '님이 일정에 초대했어요', v_label || ' · ' || v_when, v_link);
      end if;
    end if;
  end loop;
end
$$;

-- 휴무 일정을 넣으면 — 그 기간에 겹치는 초대(한 번 하는 일정 · 앞으로)에 저절로 '아니요' + 만든 분께 알림
create or replace function public._ops_plan_off_decline(_off public.ops_plans)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r public.ops_plans%rowtype;
  v_n int := 0;
  v_name text := coalesce(public._strategy_display(_off.user_id) ->> 'name', '팀원');
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if _off.kind <> 'off' or _off.deleted_at is not null then return 0; end if;
  for r in
    select pl.* from public.ops_plan_guests g join public.ops_plans pl on pl.id = g.plan_id
     where g.user_id = _off.user_id and g.removed_at is null and g.response is distinct from 'no'
       and pl.deleted_at is null and pl.user_id <> _off.user_id
       and pl.rrule is null and cardinality(pl.repeat_weekdays) = 0 and pl.end_on >= v_today
       and public._ops_plan_overlaps_off(pl, _off.user_id)
  loop
    update public.ops_plan_guests
       set response = 'no', auto = true, note = '휴무예요', responded_at = now(),
           proposed_on = null, proposed_start = null, proposed_end = null
     where plan_id = r.id and user_id = _off.user_id;
    perform public._ops_plan_notify(r.user_id, '❌ ' || v_name || '님은 그날 휴무예요',
      coalesce(nullif(btrim(r.title), ''), public._ops_plan_kind_label(r.kind)) || ' · ' || public._ops_plan_when(r) || ' · 저절로 ''아니요''로 답했어요',
      '/office?tab=plan&d=' || to_char(greatest(r.start_on, v_today), 'YYYY-MM-DD') || '&plan=' || r.id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end
$$;

-- 지우면 손님에게 '취소됐어요' — one = 그날만 · following = 그날부터 · all = 전체 (앞으로 있는 일정만)
create or replace function public._ops_plan_guests_cancel(_pl public.ops_plans, _d date, _scope text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_owner text := coalesce(public._strategy_display(_pl.user_id) ->> 'name', '코치');
  v_label text := coalesce(nullif(btrim(_pl.title), ''), public._ops_plan_kind_label(_pl.kind));
  v_body text;
  g record;
begin
  if _scope = 'one' and (_d is null or _d < v_today) then return; end if;
  if _scope <> 'one' and public._ops_plan_next_on(_pl, greatest(coalesce(_d, v_today), v_today)) is null then return; end if;
  v_body := v_owner || '님 · ' || v_label || ' · '
            || case _scope when 'one' then public._ops_plan_day_label(_d) || '만'
                           when 'following' then public._ops_plan_day_label(greatest(_d, v_today)) || '부터'
                           else public._ops_plan_when(_pl) end;
  for g in select x.user_id from public.ops_plan_guests x where x.plan_id = _pl.id and x.removed_at is null loop
    perform public._ops_plan_notify(g.user_id, '🗓 일정이 취소됐어요', v_body, '/office?tab=plan');
  end loop;
end
$$;

-- 팀원 바쁜 시간 — 「일정」에 넣은 시각 일정(휴무 포함) · 하루 종일 휴무 · 외부 + 참석 · 아마로 답한 초대. 제목 · 종류 없이.
--   「근무」 탭 시간표 · 쉰 날은 넣지 않는다(코치님 근무 자료는 본인 · 관리자만 — 10/29)
create or replace function public._ops_plan_busy(_users uuid[], _from date, _to date)
returns table (user_id uuid, d date, s time, e time, all_day boolean)
language sql
stable
security definer
set search_path to 'public'
as $$
  select pl.user_id, dd.d,
         case when pl.all_day then null else pl.start_time end,
         case when pl.all_day then null else pl.end_time end,
         pl.all_day
    from public.ops_plans pl
   cross join lateral public._ops_plan_days(pl, _from, _to) dd(d)
   where pl.user_id = any (_users) and pl.deleted_at is null and pl.start_on <= _to
     and (case when pl.rrule is null and cardinality(pl.repeat_weekdays) = 0 then pl.end_on >= _from
               else coalesce(pl.until_on, 'infinity'::date) >= _from end)
     and (not pl.all_day or pl.kind in ('off', 'out'))
  union all
  select g.user_id, dd.d,
         case when pl.all_day then null else pl.start_time end,
         case when pl.all_day then null else pl.end_time end,
         pl.all_day
    from public.ops_plan_guests g
    join public.ops_plans pl on pl.id = g.plan_id
   cross join lateral public._ops_plan_days(pl, _from, _to) dd(d)
   where g.user_id = any (_users) and g.removed_at is null and g.response in ('yes', 'maybe')
     and pl.deleted_at is null and pl.start_on <= _to
     and (case when pl.rrule is null and cardinality(pl.repeat_weekdays) = 0 then pl.end_on >= _from
               else coalesce(pl.until_on, 'infinity'::date) >= _from end)
     and (not pl.all_day or pl.kind in ('off', 'out'))
$$;

-- 첨부 저장소 정책이 부르는 함수 — authenticated 가 실행 · 오류 없이 참/거짓만
create or replace function public._ops_plan_can_upload()
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  return auth.uid() is not null and exists (select 1 from public._ops_plan_branches(auth.uid()));
exception when others then
  return false;
end
$$;

create or replace function public._ops_plan_file_can_read(_name text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_folder text := split_part(coalesce(_name, ''), '/', 1);
begin
  if v_uid is null or v_folder = '' then return false; end if;
  if v_folder = v_uid::text then return true; end if;
  if v_folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  return exists (
    select 1 from public.ops_plans pl
     where pl.user_id = v_folder::uuid and pl.deleted_at is null
       and pl.attachments @> jsonb_build_array(jsonb_build_object('path', _name))
       and (exists (select 1 from public.ops_plan_guests g where g.plan_id = pl.id and g.user_id = v_uid and g.removed_at is null)
            or (not pl.private and public._ops_plan_can_view_all(v_uid, pl.branch_name))));
exception when others then
  return false;
end
$$;

-- ── ⑤ 읽기 ───────────────────────────────────────────────────────────────────────────────────
-- 일정 한 줄 (보는 사람 기준) — 3-2 + 회의 링크 · 집중 · 첨부 · 손님(만든 사람 · 손님 · 관리자) · 초대받았나 · 내 답 · 만든 사람 이름
create or replace function public._ops_plan_json(pl public.ops_plans, _viewer uuid)
returns jsonb
language plpgsql
stable
set search_path to 'public'
as $$
declare
  v_mine boolean := pl.user_id = _viewer;
  v_open boolean := pl.user_id = _viewer or not pl.private;
  v_resp text;
  v_guest boolean;
  v_full boolean;
begin
  select g.response, true into v_resp, v_guest
    from public.ops_plan_guests g where g.plan_id = pl.id and g.user_id = _viewer and g.removed_at is null;
  v_guest := coalesce(v_guest, false);
  v_full := v_mine or v_guest or (not pl.private and public._ops_plan_can_view_all(_viewer, pl.branch_name));
  return jsonb_build_object(
    'id', pl.id, 'user_id', pl.user_id, 'branch', pl.branch_name, 'kind', pl.kind,
    'title', case when v_open then pl.title end,
    'memo', case when v_open then pl.memo end,
    'location', case when v_open then pl.location end,
    'masked', pl.private and not v_mine, 'private', pl.private,
    'start_on', pl.start_on, 'end_on', pl.end_on,
    'repeat_weekdays', to_jsonb(pl.repeat_weekdays), 'until_on', pl.until_on, 'skip_dates', to_jsonb(pl.skip_dates),
    'rrule', pl.rrule, 'color', pl.color,
    'reminders', case when v_mine then to_jsonb(pl.reminders) else '[]'::jsonb end,
    'series_id', pl.series_id,
    'all_day', pl.all_day,
    'start_time', to_char(pl.start_time, 'HH24:MI'), 'end_time', to_char(pl.end_time, 'HH24:MI'),
    'mine', v_mine, 'updated_at', pl.updated_at,
    'meet_url', case when v_open then pl.meet_url end,
    'focus', v_mine and pl.focus,
    'attachments', case when v_full then pl.attachments else '[]'::jsonb end,
    'guests', case when v_full then public._ops_plan_guests_json(pl.id) else '[]'::jsonb end,
    'invited', v_guest,
    'my_response', v_resp,
    'owner_name', case when not v_mine then coalesce(public._strategy_display(pl.user_id) ->> 'name', '코치') end);
end
$$;

-- 「일정」 탭 모든 보기의 읽기 — 3-2 + 초대받은 일정 · team · busy · invites · prefs(꺼 둔 캘린더 · 기본 알림)
create or replace function public.ops_plans_range(p_branch text, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_branch text := nullif(btrim(coalesce(p_branch, '')), '');
  v_from date := coalesce(p_from, (now() at time zone 'Asia/Seoul')::date);
  v_to date := coalesce(p_to, coalesce(p_from, (now() at time zone 'Asia/Seoul')::date) + 6);
  v_all boolean;
  v_staff boolean;
  v_branches jsonb;
  v_ids uuid[];
  v_team uuid[];
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if v_to < v_from then raise exception '날짜를 다시 골라 주세요'; end if;
  if v_to > v_from + 400 then v_to := v_from + 400; end if;
  select coalesce(jsonb_agg(jsonb_build_object('branch', b.branch_name, 'manage', b.manage, 'mine', b.mine)
                            order by b.mine desc, b.branch_name), '[]'::jsonb)
    into v_branches from public._ops_plan_branches(v_uid) b;
  if jsonb_array_length(v_branches) = 0 then raise exception '일정은 코치님 · 지점장님 · 대표님만 쓸 수 있어요'; end if;
  if v_branch is null or not exists (select 1 from jsonb_array_elements(v_branches) e where e ->> 'branch' = v_branch) then
    v_branch := coalesce(
      (select e ->> 'branch' from jsonb_array_elements(v_branches) e
        where e ->> 'branch' = (select p.branch_name from public.profiles p where p.user_id = v_uid) limit 1),
      v_branches -> 0 ->> 'branch');
  end if;
  v_all := public._ops_plan_can_view_all(v_uid, v_branch);
  v_staff := v_all or exists (select 1 from public._strategy_branch_staff(v_branch) s where s.user_id = v_uid);
  select coalesce(array_agg(distinct t.user_id), '{}') into v_team from public._ops_plan_team(v_branch) t;

  if v_all then
    select coalesce(array_agg(distinct u), '{}') into v_ids from (
      select t.user_id as u from public._ops_plan_team(v_branch) t
      union
      select pl.user_id from public.ops_plans pl
       where pl.branch_name = v_branch and pl.deleted_at is null and pl.start_on <= v_to
         and (case when pl.rrule is null and cardinality(pl.repeat_weekdays) = 0 then pl.end_on >= v_from
                   else coalesce(pl.until_on, 'infinity'::date) >= v_from end)
    ) z;
  else
    v_ids := array[v_uid];
  end if;

  return jsonb_build_object(
    'branch', v_branch,
    'branches', v_branches,
    'manage', v_all,
    'hq', public._strategy_hq(v_uid),
    'me', v_uid,
    'from', v_from,
    'to', v_to,
    'today', v_today,
    'now_hm', to_char(now() at time zone 'Asia/Seoul', 'HH24:MI'),
    'members', coalesce((
      select jsonb_agg(m.j order by m.rank, m.j ->> 'name')
        from (
          select jsonb_build_object('key', u::text, 'user_id', u,
                                    'name', coalesce(d ->> 'name', '코치'), 'title', coalesce(d ->> 'title', '코치'),
                                    'me', u = v_uid, 'no_app', false) as j,
                 case when d ->> 'title' = '대표' then 0 when d ->> 'title' in ('지점장', '관장') then 1 else 2 end as rank
            from (select u, public._strategy_display(u) as d from unnest(v_ids) as u) dd
          union all
          select jsonb_build_object('key', 'staff:' || s.id, 'user_id', null, 'name', s.name, 'title', '근무자',
                                    'me', false, 'no_app', true), 3
            from public.ops_staff s
           where v_all and s.branch_name = v_branch and s.active and s.user_id is null
        ) m), '[]'::jsonb),
    'plans', coalesce((
      select jsonb_agg(public._ops_plan_json(pl, v_uid) order by pl.start_on, pl.start_time nulls first)
        from public.ops_plans pl
       where pl.deleted_at is null and pl.start_on <= v_to
         and (case when pl.rrule is null and cardinality(pl.repeat_weekdays) = 0 then pl.end_on >= v_from
                   else coalesce(pl.until_on, 'infinity'::date) >= v_from end)
         and (pl.user_id = any (v_ids)
              or exists (select 1 from public.ops_plan_guests g where g.plan_id = pl.id and g.user_id = v_uid and g.removed_at is null))), '[]'::jsonb),
    'shifts', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', coalesce(s.user_id::text, 'staff:' || s.id), 'branch', s.branch_name, 'weekday', r.weekday,
               'start_time', to_char(r.start_time, 'HH24:MI'), 'end_time', to_char(r.end_time, 'HH24:MI'),
               'valid_from', r.valid_from, 'valid_to', r.valid_to, 'staff_start', s.start_date, 'staff_end', s.end_date)
             order by r.weekday, r.start_time)
        from public.ops_shift_rules r join public.ops_staff s on s.id = r.staff_id
       where s.active
         and (s.user_id = any (v_ids) or (v_all and s.user_id is null and s.branch_name = v_branch))
         and r.valid_from <= v_to and (r.valid_to is null or r.valid_to >= v_from)), '[]'::jsonb),
    'offs', coalesce((
      select jsonb_agg(jsonb_build_object('key', coalesce(s.user_id::text, 'staff:' || s.id), 'branch', s.branch_name,
                                          'date', e.work_date) order by e.work_date)
        from public.ops_day_entries e join public.ops_staff s on s.id = e.staff_id
       where e.kind = 'off' and e.status = 'approved' and e.work_date between v_from and v_to
         and (s.user_id = any (v_ids) or (v_all and s.user_id is null and s.branch_name = v_branch))), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(r.j order by r.at desc)
        from (
          select jsonb_build_object(
                   'id', pl.id, 'user_id', pl.user_id, 'branch', pl.branch_name, 'kind', pl.kind,
                   'title', case when not pl.private then pl.title end,
                   'action', case when pl.deleted_at is not null then 'removed'
                                  when pl.updated_at > pl.created_at + interval '1 minute' then 'edit' else 'new' end,
                   'at', greatest(pl.updated_at, coalesce(pl.deleted_at, pl.updated_at)),
                   'start_on', pl.start_on, 'end_on', pl.end_on, 'repeat_weekdays', to_jsonb(pl.repeat_weekdays),
                   'rrule', pl.rrule, 'until_on', pl.until_on,
                   'all_day', pl.all_day,
                   'start_time', to_char(pl.start_time, 'HH24:MI'), 'end_time', to_char(pl.end_time, 'HH24:MI')) as j,
                 greatest(pl.updated_at, coalesce(pl.deleted_at, pl.updated_at)) as at
            from public.ops_plans pl
           where v_all and pl.user_id = any (v_ids) and pl.user_id <> v_uid
             and greatest(pl.updated_at, coalesce(pl.deleted_at, pl.updated_at)) > now() - interval '7 days'
           order by 2 desc
           limit 8
        ) r), '[]'::jsonb),
    'prefs', (select jsonb_build_object('brief_on', coalesce(pp.brief_on, true),
                                        'cals_off', to_jsonb(coalesce(pp.cals_off, '{team}'::text[])),
                                        'remind_default', to_jsonb(coalesce(pp.remind_default, '{10}'::smallint[])))
                from (select 1) one left join public.ops_plan_prefs pp on pp.user_id = v_uid),
    'birthdays', case when v_staff and v_to - v_from <= 62 then public._ops_plan_birthdays(v_branch, v_from, v_to) else '[]'::jsonb end,
    -- 3-3 — 초대할 수 있는 사람(그 지점 팀) · 팀원 바쁜 시간(제목 없이 · 7일 안 범위) · 답할 초대
    'team', coalesce((
      select jsonb_agg(t.j order by t.rank, t.j ->> 'name')
        from (
          select jsonb_build_object('user_id', u, 'name', coalesce(d ->> 'name', '코치'), 'title', coalesce(d ->> 'title', '코치'),
                                    'me', u = v_uid) as j,
                 case when d ->> 'title' = '대표' then 0 when d ->> 'title' in ('지점장', '관장') then 1 else 2 end as rank
            from (select u, public._strategy_display(u) as d from unnest(v_team) as u) dd
        ) t), '[]'::jsonb),
    'busy', case when v_to - v_from <= 6 then coalesce((
      select jsonb_agg(jsonb_build_object('user_id', b.user_id, 'date', b.d,
                                          'start', to_char(b.s, 'HH24:MI'), 'end', to_char(b.e, 'HH24:MI'), 'all_day', b.all_day)
             order by b.user_id, b.d, b.s nulls first)
        from public._ops_plan_busy(array_remove(v_team, v_uid), v_from, v_to) b), '[]'::jsonb) else '[]'::jsonb end,
    'invites', coalesce((
      select jsonb_agg(x.j || jsonb_build_object('next_on', x.n) order by x.n)
        from (
          select public._ops_plan_json(pl, v_uid) as j, public._ops_plan_next_on(pl, v_today) as n
            from public.ops_plan_guests g join public.ops_plans pl on pl.id = g.plan_id
           where g.user_id = v_uid and g.removed_at is null and g.response is null and pl.deleted_at is null
             and (case when pl.rrule is null and cardinality(pl.repeat_weekdays) = 0 then pl.end_on >= v_today
                       else coalesce(pl.until_on, 'infinity'::date) >= v_today end)
           order by pl.start_on
           limit 20
        ) x where x.n is not null), '[]'::jsonb));
end
$$;

-- ── ④ 저장 (3-2 + 회의 링크 · 집중 · 첨부 · 손님) ──────────────────────────────────────────────
create or replace function public.ops_plan_save(p jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_only date := nullif(p ->> 'only_date', '')::date;
  v_scope text := coalesce(nullif(p ->> 'scope', ''), case when nullif(p ->> 'only_date', '') is not null then 'one' else 'all' end);
  v_row public.ops_plans%rowtype;
  v_branch text := nullif(btrim(coalesce(p ->> 'branch', '')), '');
  v_kind text := p ->> 'kind';
  v_title text := nullif(btrim(coalesce(p ->> 'title', '')), '');
  v_memo text := nullif(btrim(coalesce(p ->> 'memo', '')), '');
  v_start date := nullif(p ->> 'start_on', '')::date;
  v_end date := nullif(p ->> 'end_on', '')::date;
  v_days smallint[];
  v_until date := nullif(p ->> 'until_on', '')::date;
  v_all_day boolean := coalesce((p ->> 'all_day')::boolean, false);
  v_st time := nullif(p ->> 'start_time', '')::time;
  v_et time := nullif(p ->> 'end_time', '')::time;
  v_private boolean := coalesce((p ->> 'private')::boolean, false);
  v_rule_in text;
  v_r jsonb;
  v_rrule text;
  v_color text;
  v_loc text;
  v_rem smallint[];
  v_series uuid;
  v_skip date[];
  -- 3-3
  v_meet text;
  v_focus boolean;
  v_att jsonb;
  v_el jsonb;
  v_meta jsonb;
  v_guests uuid[];
  v_before uuid[] := '{}';
  v_orig uuid;
  v_time_changed boolean := false;
  v_info_changed boolean := false;
  v_new public.ops_plans%rowtype;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if v_scope not in ('one', 'following', 'all') then raise exception '바꿀 범위를 다시 골라 주세요'; end if;
  if v_kind is null or v_kind not in ('class', 'pt', 'work', 'out', 'off', 'personal') then raise exception '일정 종류를 골라 주세요'; end if;
  if v_start is null then raise exception '날짜를 골라 주세요'; end if;
  if v_start < v_today - 62 or v_start > v_today + 400 then raise exception '날짜를 다시 골라 주세요'; end if;
  if char_length(coalesce(v_title, '')) > 40 then raise exception '제목은 40자까지예요'; end if;
  if char_length(coalesce(v_memo, '')) > 300 then raise exception '메모는 300자까지예요'; end if;

  -- 고칠 일정 — 새 칸을 안 보낸 예전 화면은 그 칸을 그대로 둔다
  if v_id is not null then
    select * into v_row from public.ops_plans where id = v_id and deleted_at is null for update;
    if not found then raise exception '일정을 찾을 수 없어요'; end if;
    if v_row.user_id <> v_uid then raise exception '내 일정만 고칠 수 있어요'; end if;
    v_branch := coalesce(v_branch, v_row.branch_name);
    select coalesce(array_agg(g.user_id order by g.invited_at), '{}') into v_before
      from public.ops_plan_guests g where g.plan_id = v_id and g.removed_at is null;
  end if;
  if v_id is null or v_only is null then v_scope := 'all'; end if;

  v_color := case when p ? 'color' then nullif(btrim(coalesce(p ->> 'color', '')), '') else v_row.color end;
  if v_color is not null and v_color not in ('tomato', 'flamingo', 'tangerine', 'banana', 'sage', 'basil',
                                            'peacock', 'blueberry', 'lavender', 'grape', 'graphite', 'mint') then
    raise exception '색을 다시 골라 주세요';
  end if;
  v_loc := case when p ? 'location' then nullif(btrim(coalesce(p ->> 'location', '')), '') else v_row.location end;
  if char_length(coalesce(v_loc, '')) > 80 then raise exception '장소는 80자까지예요'; end if;
  if p ? 'reminders' then
    if jsonb_typeof(p -> 'reminders') is distinct from 'array'
       or exists (select 1 from jsonb_array_elements_text(p -> 'reminders') x where x !~ '^\d{1,4}$') then
      raise exception '알림을 다시 골라 주세요';
    end if;
    select coalesce(array_agg(distinct x::smallint order by x::smallint), '{}') into v_rem from jsonb_array_elements_text(p -> 'reminders') x;
  else
    v_rem := coalesce(v_row.reminders, '{}');
  end if;

  -- 3-3 회의 링크 · 집중 시간 · 첨부 · 손님
  v_meet := case when p ? 'meet_url' then public._office_video_url(p ->> 'meet_url') else v_row.meet_url end;
  v_focus := case when p ? 'focus' then coalesce((p ->> 'focus')::boolean, false) else coalesce(v_row.focus, false) end;
  if p ? 'attachments' then
    if jsonb_typeof(p -> 'attachments') is distinct from 'array' then raise exception '첨부를 다시 골라 주세요'; end if;
    if jsonb_array_length(p -> 'attachments') > 5 then raise exception '첨부는 5개까지예요'; end if;
    v_att := '[]'::jsonb;
    for v_el in select x from jsonb_array_elements(p -> 'attachments') x loop
      if jsonb_typeof(v_el) is distinct from 'object'
         or coalesce(v_el ->> 'path', '') !~ ('^' || v_uid::text || '/[A-Za-z0-9._-]{1,120}$') then
        raise exception '첨부 파일을 다시 올려 주세요';
      end if;
      select o.metadata into v_meta from storage.objects o where o.bucket_id = 'ops-plan-files' and o.name = v_el ->> 'path';
      if not found then raise exception '첨부 파일을 다시 올려 주세요'; end if;
      if v_att @> jsonb_build_array(jsonb_build_object('path', v_el ->> 'path')) then continue; end if;
      v_att := v_att || jsonb_build_array(jsonb_build_object(
        'path', v_el ->> 'path',
        'name', left(coalesce(nullif(btrim(v_el ->> 'name'), ''), '첨부 파일'), 80),
        'size', coalesce(nullif(v_meta ->> 'size', '')::bigint, 0),
        'type', coalesce(v_meta ->> 'mimetype', '')));
    end loop;
  else
    v_att := coalesce(v_row.attachments, '[]'::jsonb);
  end if;
  if p ? 'guests' then
    if jsonb_typeof(p -> 'guests') is distinct from 'array'
       or exists (select 1 from jsonb_array_elements_text(p -> 'guests') x
                   where x !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') then
      raise exception '초대할 사람을 다시 골라 주세요';
    end if;
    select coalesce(array_agg(distinct x::uuid), '{}') into v_guests
      from jsonb_array_elements_text(p -> 'guests') x where x::uuid <> v_uid;
  else
    v_guests := v_before;
  end if;

  -- 반복 규칙 — rrule 이 오면 그것 · 없으면 예전 요일들(매주) · '이 일정만'은 한 번 하는 일정
  select coalesce(array_agg(distinct d::smallint order by d::smallint), '{}') into v_days
    from jsonb_array_elements_text(case when jsonb_typeof(p -> 'repeat_weekdays') = 'array' then p -> 'repeat_weekdays' else '[]'::jsonb end) d
   where d ~ '^[0-6]$';
  v_rule_in := case when p ? 'rrule' then nullif(btrim(coalesce(p ->> 'rrule', '')), '') end;
  if v_rule_in is null and cardinality(v_days) > 0 then
    v_rule_in := 'FREQ=WEEKLY;BYDAY=' || (select string_agg((array['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'])[d + 1], ',' order by (d + 6) % 7)
                                            from unnest(v_days) d);
  end if;
  if v_scope = 'one' then v_rule_in := null; end if;

  if v_rule_in is not null then
    v_r := public._ops_rrule_fill(public._ops_rrule_parse(v_rule_in), v_start);
    if v_until is null and (v_r ->> 'until') is not null then v_until := (v_r ->> 'until')::date; end if;
    v_r := jsonb_set(v_r, '{until}', 'null'::jsonb);
    v_start := public._ops_recur_first(v_r, v_start);
    if v_start is null then raise exception '이 반복으로는 잡히는 날이 없어요'; end if;
    v_end := v_start;
    if (v_r ->> 'count') is not null then
      v_until := public._ops_recur_until(v_r, v_start);
      if v_until is null then raise exception '반복 횟수를 줄여 주세요 — 10년 안에서 반복해요'; end if;
    end if;
    if v_until is not null and v_until < v_start then raise exception '반복이 끝나는 날이 시작보다 빨라요'; end if;
    v_rrule := public._ops_rrule_text(v_r);
    v_days := case when v_r ->> 'freq' = 'WEEKLY'
                   then (select array_agg(x::smallint order by x::smallint) from jsonb_array_elements_text(v_r -> 'byday') x)
                   else '{}' end;
  else
    v_rrule := null;
    v_days := '{}';
    v_until := null;
    v_end := coalesce(v_end, v_start);
    if v_end < v_start then raise exception '끝나는 날이 시작보다 빨라요'; end if;
    if v_end > v_start + 62 then raise exception '여러 날 일정은 두 달까지예요'; end if;
  end if;

  if v_all_day then
    v_st := null; v_et := null; v_rem := '{}'; v_focus := false;
  elsif v_st is null or v_et is null or v_et <= v_st then
    raise exception '시작 · 끝 시각을 확인해 주세요';
  end if;
  if cardinality(v_rem) > 4 or not (v_rem <@ '{0,5,10,15,30,60,120,1440}'::smallint[]) then raise exception '알림을 다시 골라 주세요'; end if;
  if v_kind <> 'personal' then v_private := false; end if;

  if v_branch is null or not exists (select 1 from public._ops_plan_branches(v_uid) b where b.branch_name = v_branch and (b.mine or b.manage)) then
    raise exception '이 지점에는 일정을 넣을 수 없어요';
  end if;

  -- 손님 검사 — 20명까지 · 휴무 · '시간만' 개인 일정은 안 됨 · 새로 부르는 사람은 그 지점 팀만
  if cardinality(v_guests) > 20 then raise exception '초대는 20명까지예요'; end if;
  if cardinality(v_guests) > 0 then
    if v_kind = 'off' then raise exception '휴무 일정에는 초대할 수 없어요'; end if;
    if v_private then raise exception '시간만 보이는 개인 일정에는 초대할 수 없어요'; end if;
    if exists (select 1 from unnest(v_guests) u
                where not (u = any (v_before))
                  and not exists (select 1 from public._ops_plan_team(v_branch) t where t.user_id = u)) then
      raise exception '같은 지점 팀만 초대할 수 있어요';
    end if;
  end if;

  if v_id is not null and v_scope = 'one' then
    -- 이 일정만 — 반복에서 그날을 빼고, 같은 묶음으로 한 번 하는 일정을 새로
    if v_row.rrule is null and cardinality(v_row.repeat_weekdays) = 0 then raise exception '반복 일정만 하루씩 바꿀 수 있어요'; end if;
    if cardinality(v_row.skip_dates) >= 120 then raise exception '빼는 날이 너무 많아요 — 반복을 새로 잡아 주세요'; end if;
    update public.ops_plans
       set skip_dates = (select array_agg(distinct x order by x) from unnest(skip_dates || v_only) x), updated_at = now()
     where id = v_id;
    v_series := coalesce(v_row.series_id, v_row.id);
    v_orig := v_row.id;
    v_id := null;
  elsif v_id is not null and v_scope = 'following'
        and (v_row.rrule is not null or cardinality(v_row.repeat_weekdays) > 0) and v_only > v_row.start_on then
    -- 이후 모두 — 원래 반복은 그 전날까지(횟수는 풀고 끝나는 날로), 같은 묶음으로 새 반복
    update public.ops_plans
       set until_on = least(coalesce(until_on, 'infinity'::date), v_only - 1),
           rrule = case when rrule is null then null else regexp_replace(rrule, ';COUNT=\d+', '') end,
           skip_dates = coalesce((select array_agg(x order by x) from unnest(skip_dates) x where x < v_only), '{}'),
           updated_at = now()
     where id = v_id;
    v_series := coalesce(v_row.series_id, v_row.id);
    v_skip := coalesce((select array_agg(x order by x) from unnest(v_row.skip_dates) x where x >= v_start), '{}');
    v_orig := v_row.id;
    v_id := null;
  end if;

  if v_id is null then
    if (select count(*) from public.ops_plans
         where user_id = v_uid and deleted_at is null
           and (case when rrule is null and cardinality(repeat_weekdays) = 0 then end_on else coalesce(until_on, 'infinity'::date) end) >= v_today) >= 300 then
      raise exception '앞으로 잡힌 일정이 너무 많아요 — 지난 일정은 지워 주세요';
    end if;
    insert into public.ops_plans (branch_name, user_id, kind, title, memo, start_on, end_on, repeat_weekdays, until_on, skip_dates,
                                  all_day, start_time, end_time, private, created_by, rrule, color, location, reminders, series_id,
                                  meet_url, focus, attachments)
    values (v_branch, v_uid, v_kind, v_title, v_memo, v_start, v_end, v_days, v_until,
            case when v_rrule is not null then coalesce(v_skip, '{}') else '{}' end,
            v_all_day, v_st, v_et, v_private, v_uid, v_rrule, v_color, v_loc, v_rem, v_series,
            v_meet, v_focus, v_att)
    returning id into v_id;
  else
    v_time_changed := (v_row.start_on, v_row.end_on, v_row.all_day, v_row.start_time, v_row.end_time, coalesce(v_row.rrule, ''), v_row.until_on)
                      is distinct from (v_start, v_end, v_all_day, v_st, v_et, coalesce(v_rrule, ''), v_until);
    v_info_changed := (v_row.title, v_row.location, v_row.meet_url, v_row.kind) is distinct from (v_title, v_loc, v_meet, v_kind);
    update public.ops_plans
       set branch_name = v_branch, kind = v_kind, title = v_title, memo = v_memo,
           start_on = v_start, end_on = v_end, repeat_weekdays = v_days, until_on = v_until, rrule = v_rrule,
           skip_dates = case when v_rrule is not null
                             then coalesce((select array_agg(x order by x) from unnest(skip_dates) x where x >= v_start), '{}')
                             else '{}' end,
           all_day = v_all_day, start_time = v_st, end_time = v_et, private = v_private,
           color = v_color, location = v_loc, reminders = v_rem, updated_at = now(),
           meet_url = v_meet, focus = v_focus, attachments = v_att
     where id = v_id;
  end if;

  select * into v_new from public.ops_plans where id = v_id;
  if cardinality(v_guests) > 0 or cardinality(v_before) > 0 then
    perform public._ops_plan_guests_apply(v_new, v_guests, v_uid, v_orig, v_time_changed, v_info_changed);
  end if;
  if v_kind = 'off' then perform public._ops_plan_off_decline(v_new); end if;
  return v_id;
end
$$;

-- 초대 응답 — 참석 · 못 가요 · 아마 + 메모 60자 + 새 시간 제안(그날 · 시각) → 만든 분께 알림(같은 답을 다시 누르면 알림 없음)
create or replace function public.ops_plan_respond(p_plan uuid, p_response text, p_note text default null,
                                                   p_on date default null, p_start time default null, p_end time default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_g public.ops_plan_guests%rowtype;
  v_pl public.ops_plans%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_name text;
  v_label text;
  v_title text;
  v_body text;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select * into v_g from public.ops_plan_guests where plan_id = p_plan and user_id = v_uid and removed_at is null for update;
  if not found then raise exception '초대를 찾을 수 없어요'; end if;
  select * into v_pl from public.ops_plans where id = p_plan and deleted_at is null;
  if not found then raise exception '초대를 찾을 수 없어요'; end if;
  if p_response is null or p_response not in ('yes', 'no', 'maybe') then raise exception '답을 다시 골라 주세요'; end if;
  if char_length(coalesce(v_note, '')) > 60 then raise exception '메모는 60자까지예요'; end if;
  if p_on is not null then
    if p_on < v_today or p_on > v_today + 400 then raise exception '제안 시간을 확인해 주세요'; end if;
    if v_pl.all_day then
      if p_start is not null or p_end is not null then raise exception '제안 시간을 확인해 주세요'; end if;
    elsif p_start is null or p_end is null or p_end <= p_start then
      raise exception '제안 시간을 확인해 주세요';
    end if;
  elsif p_start is not null or p_end is not null then
    raise exception '제안 시간을 확인해 주세요';
  end if;

  update public.ops_plan_guests
     set response = p_response, note = v_note, auto = false, responded_at = now(),
         proposed_on = p_on, proposed_start = p_start, proposed_end = p_end
   where plan_id = p_plan and user_id = v_uid;

  if (v_g.response, v_g.note, v_g.proposed_on, v_g.proposed_start, v_g.proposed_end)
     is distinct from (p_response, v_note, p_on, p_start, p_end) then
    v_name := coalesce(public._strategy_display(v_uid) ->> 'name', '팀원');
    v_label := coalesce(nullif(btrim(v_pl.title), ''), public._ops_plan_kind_label(v_pl.kind));
    v_title := case when p_on is not null then '🕐 ' || v_name || '님이 다른 시간을 제안했어요'
                    when p_response = 'yes' then '✅ ' || v_name || '님이 참석해요'
                    when p_response = 'maybe' then '🤔 ' || v_name || '님이 아마 갈게요'
                    else '❌ ' || v_name || '님이 못 가요' end;
    v_body := v_label || ' · ' || public._ops_plan_when(v_pl)
              || case when p_on is not null
                      then ' → ' || public._ops_plan_day_label(p_on)
                           || case when p_start is not null then ' ' || to_char(p_start, 'HH24:MI') || '~' || to_char(p_end, 'HH24:MI') else '' end
                      else '' end
              || coalesce(' · "' || v_note || '"', '');
    perform public._ops_plan_notify(v_pl.user_id, v_title, v_body,
      '/office?tab=plan&d=' || to_char(coalesce(public._ops_plan_next_on(v_pl, v_today), v_pl.start_on), 'YYYY-MM-DD') || '&plan=' || v_pl.id);
  end if;
  return jsonb_build_object('response', p_response, 'note', v_note, 'proposed_on', p_on,
                            'proposed_start', to_char(p_start, 'HH24:MI'), 'proposed_end', to_char(p_end, 'HH24:MI'));
end
$$;

-- 시간 찾기 — 나 + 1 ~ 5명 · 30 / 60 / 90분 · 오늘(또는 고른 날)부터 7일 · 30분 간격 · 근무 시간 안(「근무」 탭 시간표가 있는 분은
--   그날 근무 칸 하나 안에 · 없는 분은 9시 ~ 22시) · 일정 · 참석하는 초대와 안 겹치는 칸 3개(날이 다르면 먼저 — 하루에 하나씩, 모자라면 같은 날 더)
create or replace function public.ops_plan_find_times(p_branch text, p_users uuid[], p_minutes integer, p_from date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_local timestamp := now() at time zone 'Asia/Seoul';
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_now_min int := extract(hour from now() at time zone 'Asia/Seoul')::int * 60 + extract(minute from now() at time zone 'Asia/Seoul')::int;
  v_branch text := nullif(btrim(coalesce(p_branch, '')), '');
  v_people uuid[];
  v_from date;
  v_free jsonb := '[]'::jsonb;
  v_pick jsonb := '[]'::jsonb;
  v_days date[] := '{}';
  rec record;
  x jsonb;
  v_ok boolean;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if v_branch is null or not exists (select 1 from public._ops_plan_branches(v_uid) b where b.branch_name = v_branch and (b.mine or b.manage)) then
    raise exception '이 지점에서는 시간을 찾을 수 없어요';
  end if;
  if p_minutes is null or p_minutes not in (30, 60, 90) then raise exception '시간 길이를 다시 골라 주세요'; end if;
  select coalesce(array_agg(distinct u), '{}') into v_people from unnest(coalesce(p_users, '{}'::uuid[])) u where u is not null and u <> v_uid;
  if cardinality(v_people) < 1 or cardinality(v_people) > 5 then raise exception '함께할 사람을 1 ~ 5명 골라 주세요'; end if;
  if exists (select 1 from unnest(v_people) u where not exists (select 1 from public._ops_plan_team(v_branch) t where t.user_id = u)) then
    raise exception '같은 지점 팀만 고를 수 있어요';
  end if;
  v_people := v_people || v_uid;
  v_from := least(greatest(coalesce(p_from, v_today), v_today), v_today + 60);

  for rec in
    with days as (
      select (v_from + i) as d from generate_series(0, 6) i
    ), cand as (
      select dd.d, 360 + 30 * k as s, 360 + 30 * k + p_minutes as e
        from days dd cross join generate_series(0, (1440 - 360 - p_minutes) / 30) k
       where dd.d > v_today or 360 + 30 * k >= v_now_min + 30
    ), shift_people as (
      select distinct s.user_id as u, s.id as staff_id
        from public.ops_staff s
       where s.user_id = any (v_people) and s.branch_name = v_branch and s.active
         and exists (select 1 from public.ops_shift_rules r where r.staff_id = s.id)
    ), win as (
      select sp.u, dd.d,
             (extract(epoch from g.start_time) / 60)::int as ws,
             (extract(epoch from g.end_time) / 60)::int as we
        from shift_people sp cross join days dd
       cross join lateral public._ops_duty_segments(sp.staff_id, dd.d) g
      union all
      select pp.u, dd.d, 540, 1320
        from unnest(v_people) pp(u) cross join days dd
       where not exists (select 1 from shift_people sp where sp.u = pp.u)
    ), busy as (
      select b.user_id as u, b.d,
             case when b.all_day then 0 else (extract(epoch from b.s) / 60)::int end as bs,
             case when b.all_day then 1440 else (extract(epoch from b.e) / 60)::int end as be
        from public._ops_plan_busy(v_people, v_from, v_from + 6) b
    )
    select c.d, c.s, c.e
      from cand c
     where not exists (
       select 1 from unnest(v_people) pp(u)
        where not exists (select 1 from win w where w.u = pp.u and w.d = c.d and w.ws <= c.s and c.e <= w.we)
           or exists (select 1 from busy b where b.u = pp.u and b.d = c.d and b.bs < c.e and b.be > c.s))
     order by c.d, c.s
     limit 400
  loop
    v_free := v_free || jsonb_build_array(jsonb_build_object('d', rec.d, 's', rec.s, 'e', rec.e));
  end loop;

  -- 날마다 가장 이른 칸 하나씩(3일까지) → 모자라면 남은 칸 중 안 겹치는 것
  for x in select value from jsonb_array_elements(v_free) loop
    exit when jsonb_array_length(v_pick) >= 3;
    if not ((x ->> 'd')::date = any (v_days)) then
      v_pick := v_pick || jsonb_build_array(x);
      v_days := v_days || (x ->> 'd')::date;
    end if;
  end loop;
  for x in select value from jsonb_array_elements(v_free) loop
    exit when jsonb_array_length(v_pick) >= 3;
    select not exists (select 1 from jsonb_array_elements(v_pick) y
                        where y ->> 'd' = x ->> 'd' and (y ->> 's')::int < (x ->> 'e')::int and (y ->> 'e')::int > (x ->> 's')::int)
      into v_ok;
    if v_ok then v_pick := v_pick || jsonb_build_array(x); end if;
  end loop;

  return jsonb_build_object(
    'minutes', p_minutes,
    'from', v_from,
    'to', v_from + 6,
    'checked_at', to_char(v_local, 'HH24:MI'),
    'slots', coalesce((
      select jsonb_agg(jsonb_build_object(
               'date', (y ->> 'd')::date,
               'start', lpad(((y ->> 's')::int / 60)::text, 2, '0') || ':' || lpad(((y ->> 's')::int % 60)::text, 2, '0'),
               'end', lpad(((y ->> 'e')::int / 60)::text, 2, '0') || ':' || lpad(((y ->> 'e')::int % 60)::text, 2, '0'))
             order by (y ->> 'd')::date, (y ->> 's')::int)
        from jsonb_array_elements(v_pick) y), '[]'::jsonb),
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', u, 'name', coalesce(public._strategy_display(u) ->> 'name', '팀원'), 'me', u = v_uid,
               'window', case when exists (select 1 from public.ops_staff s
                                            where s.user_id = u and s.branch_name = v_branch and s.active
                                              and exists (select 1 from public.ops_shift_rules r where r.staff_id = s.id))
                              then 'shift' else 'default' end)
             order by (u = v_uid) desc)
        from unnest(v_people) u), '[]'::jsonb));
end
$$;

-- 설정 — 아침 브리핑 · 꺼 둔 캘린더 · 기본 알림 (보낸 키만 바꾼다)
create or replace function public.ops_plan_prefs_save(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_cur public.ops_plan_prefs%rowtype;
  v_brief boolean;
  v_off text[];
  v_rem smallint[];
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if not exists (select 1 from public._ops_plan_branches(v_uid)) then raise exception '일정은 코치님 · 지점장님 · 대표님만 쓸 수 있어요'; end if;
  if p is null or jsonb_typeof(p) is distinct from 'object' then raise exception '설정을 다시 골라 주세요'; end if;
  select * into v_cur from public.ops_plan_prefs where user_id = v_uid;
  v_brief := case when p ? 'brief_on' then coalesce((p ->> 'brief_on')::boolean, true) else coalesce(v_cur.brief_on, true) end;
  if p ? 'cals_off' then
    if jsonb_typeof(p -> 'cals_off') is distinct from 'array'
       or exists (select 1 from jsonb_array_elements_text(p -> 'cals_off') x
                   where x not in ('mine', 'invited', 'team', 'work', 'events', 'meetings', 'pt', 'todo')) then
      raise exception '캘린더를 다시 골라 주세요';
    end if;
    select coalesce(array_agg(distinct x order by x), '{}') into v_off from jsonb_array_elements_text(p -> 'cals_off') x;
  else
    v_off := coalesce(v_cur.cals_off, '{team}');
  end if;
  if p ? 'remind_default' then
    if jsonb_typeof(p -> 'remind_default') is distinct from 'array'
       or exists (select 1 from jsonb_array_elements_text(p -> 'remind_default') x where x !~ '^\d{1,4}$') then
      raise exception '기본 알림을 다시 골라 주세요';
    end if;
    select coalesce(array_agg(distinct x::smallint order by x::smallint), '{}') into v_rem from jsonb_array_elements_text(p -> 'remind_default') x;
    if cardinality(v_rem) > 4 or not (v_rem <@ '{0,5,10,15,30,60,120,1440}'::smallint[]) then raise exception '기본 알림을 다시 골라 주세요'; end if;
  else
    v_rem := coalesce(v_cur.remind_default, '{10}');
  end if;
  insert into public.ops_plan_prefs (user_id, brief_on, cals_off, remind_default, updated_at)
  values (v_uid, v_brief, v_off, v_rem, now())
  on conflict (user_id) do update
     set brief_on = excluded.brief_on, cals_off = excluded.cals_off, remind_default = excluded.remind_default, updated_at = now();
  return jsonb_build_object('brief_on', v_brief, 'cals_off', to_jsonb(v_off), 'remind_default', to_jsonb(v_rem));
end
$$;

-- 시간 인사이트 — 그 주(월~일) 수업 · PT · 업무 · 회의 · 외부 · 근무 시간(분). 코치님 = 나만 · 대표님 · 그 지점 관리자 = 팀(시간만)
--   회의 = 손님이 있는(참석 · 아마) 일정 + 사무실 정기 회의(1시간) · 하루 종일 일정 · 개인 · 휴무는 빼고
create or replace function public.ops_plan_insights(p_branch text, p_monday date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_branch text := nullif(btrim(coalesce(p_branch, '')), '');
  v_mon date;
  v_all boolean;
  v_ids uuid[];
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if v_branch is null or not exists (select 1 from public._ops_plan_branches(v_uid) b where b.branch_name = v_branch) then
    raise exception '일정은 코치님 · 지점장님 · 대표님만 쓸 수 있어요';
  end if;
  v_mon := coalesce(p_monday, v_today);
  v_mon := v_mon - (extract(isodow from v_mon)::int - 1);
  if v_mon < v_today - 400 or v_mon > v_today + 400 then raise exception '날짜를 다시 골라 주세요'; end if;
  v_all := public._ops_plan_can_view_all(v_uid, v_branch);
  if v_all then
    select coalesce(array_agg(distinct t.user_id), '{}') into v_ids from public._ops_plan_team(v_branch) t;
  else
    v_ids := array[v_uid];
  end if;

  return jsonb_build_object(
    'branch', v_branch,
    'monday', v_mon,
    'manage', v_all,
    'rows', coalesce((
      with occ as (
        select pl.user_id as u, pl.kind, pl.start_time, pl.end_time,
               exists (select 1 from public.ops_plan_guests g
                        where g.plan_id = pl.id and g.removed_at is null and g.response in ('yes', 'maybe')) as shared
          from public.ops_plans pl
         cross join lateral public._ops_plan_days(pl, v_mon, v_mon + 6) dd(d)
         where pl.user_id = any (v_ids) and pl.deleted_at is null and not pl.all_day and pl.start_on <= v_mon + 6
           and (case when pl.rrule is null and cardinality(pl.repeat_weekdays) = 0 then pl.end_on >= v_mon
                     else coalesce(pl.until_on, 'infinity'::date) >= v_mon end)
        union all
        select g.user_id, pl.kind, pl.start_time, pl.end_time, true
          from public.ops_plan_guests g
          join public.ops_plans pl on pl.id = g.plan_id
         cross join lateral public._ops_plan_days(pl, v_mon, v_mon + 6) dd(d)
         where g.user_id = any (v_ids) and g.removed_at is null and g.response in ('yes', 'maybe')
           and pl.deleted_at is null and not pl.all_day and pl.start_on <= v_mon + 6
           and (case when pl.rrule is null and cardinality(pl.repeat_weekdays) = 0 then pl.end_on >= v_mon
                     else coalesce(pl.until_on, 'infinity'::date) >= v_mon end)
      ), cat as (
        select o.u,
               case when o.kind = 'class' then 'class' when o.kind = 'pt' then 'pt' when o.shared then 'meeting'
                    when o.kind = 'work' then 'work' when o.kind = 'out' then 'out' end as c,
               (extract(epoch from (o.end_time - o.start_time)) / 60)::int as m
          from occ o
      ), meet as (
        select uu.u, 60 * count(*)::int as m
          from unnest(v_ids) uu(u)
          join public.office_schedules os on os.branch_name = v_branch and os.active and os.canceled_at is null
         cross join generate_series(v_mon, v_mon + 6, interval '1 day') dd(d)
         where public._office_role(uu.u, v_branch) is not null
           and ((cardinality(os.weekdays) > 0 and extract(dow from dd.d)::smallint = any (os.weekdays)
                 and dd.d::date >= (os.created_at at time zone 'Asia/Seoul')::date
                 and dd.d::date is distinct from (os.skip_at at time zone 'Asia/Seoul')::date)
                or (cardinality(os.weekdays) = 0 and os.once_on = dd.d::date))
         group by uu.u
      ), shift as (
        select s.user_id as u, sum(extract(epoch from (g.end_time - g.start_time)) / 60)::int as m
          from public.ops_staff s
         cross join generate_series(v_mon, v_mon + 6, interval '1 day') dd(d)
         cross join lateral public._ops_duty_segments(s.id, dd.d::date) g
         where s.user_id = any (v_ids) and s.active and g.end_time > g.start_time
         group by s.user_id
      )
      select jsonb_agg(jsonb_build_object(
               'user_id', x.u, 'name', coalesce(x.d ->> 'name', '코치'), 'title', coalesce(x.d ->> 'title', '코치'), 'me', x.u = v_uid,
               'class', coalesce((select sum(c.m) from cat c where c.u = x.u and c.c = 'class'), 0),
               'pt', coalesce((select sum(c.m) from cat c where c.u = x.u and c.c = 'pt'), 0),
               'work', coalesce((select sum(c.m) from cat c where c.u = x.u and c.c = 'work'), 0),
               'out', coalesce((select sum(c.m) from cat c where c.u = x.u and c.c = 'out'), 0),
               'meeting', coalesce((select sum(c.m) from cat c where c.u = x.u and c.c = 'meeting'), 0)
                          + coalesce((select mm.m from meet mm where mm.u = x.u), 0),
               'shift', coalesce((select sh.m from shift sh where sh.u = x.u), 0))
             order by (x.u = v_uid) desc, x.d ->> 'name')
        from (select u, public._strategy_display(u) as d from unnest(v_ids) as u) x), '[]'::jsonb));
end
$$;

-- 지우기 세 범위 (3-2) + 손님에게 '취소됐어요'
create or replace function public.ops_plan_remove_scope(p_id uuid, p_scope text, p_date date)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.ops_plans%rowtype;
  v_scope text := coalesce(nullif(p_scope, ''), 'all');
  v_rep boolean;
  v_key uuid;
  v_n int;
  r public.ops_plans%rowtype;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if v_scope not in ('one', 'following', 'all') then raise exception '지울 범위를 다시 골라 주세요'; end if;
  select * into v_row from public.ops_plans where id = p_id and deleted_at is null for update;
  if not found then raise exception '일정을 찾을 수 없어요'; end if;
  if v_row.user_id <> v_uid then raise exception '내 일정만 지울 수 있어요'; end if;
  v_rep := v_row.rrule is not null or cardinality(v_row.repeat_weekdays) > 0;
  if v_rep and v_scope = 'one' then
    perform public.ops_plan_skip(p_id, p_date);
    perform public._ops_plan_guests_cancel(v_row, p_date, 'one');
    return 1;
  end if;
  if v_rep and v_scope = 'following' and p_date is not null and p_date > v_row.start_on then
    perform public._ops_plan_guests_cancel(v_row, p_date, 'following');
    update public.ops_plans
       set until_on = least(coalesce(until_on, 'infinity'::date), p_date - 1),
           rrule = case when rrule is null then null else regexp_replace(rrule, ';COUNT=\d+', '') end,
           skip_dates = coalesce((select array_agg(x order by x) from unnest(skip_dates) x where x < p_date), '{}'),
           updated_at = now()
     where id = p_id;
    return 1;
  end if;
  v_key := coalesce(v_row.series_id, v_row.id);
  for r in
    select * from public.ops_plans
     where user_id = v_uid and deleted_at is null
       and (id = p_id or (v_rep and (id = v_key or series_id = v_key)))
  loop
    perform public._ops_plan_guests_cancel(r, null, 'all');
  end loop;
  update public.ops_plans
     set deleted_at = now(), updated_at = now()
   where user_id = v_uid and deleted_at is null
     and (id = p_id or (v_rep and (id = v_key or series_id = v_key)));
  get diagnostics v_n = row_count;
  return v_n;
end
$$;

-- 검색 (3-2) + 초대받은 일정
create or replace function public.ops_plan_search(p_q text, p_branch text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_q text := left(btrim(coalesce(p_q, '')), 40);
  v_like text;
  v_branch text := nullif(btrim(coalesce(p_branch, '')), '');
  v_all boolean := false;
  v_ids uuid[] := '{}';
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if not exists (select 1 from public._ops_plan_branches(v_uid)) then raise exception '일정은 코치님 · 지점장님 · 대표님만 쓸 수 있어요'; end if;
  if v_q = '' then return '[]'::jsonb; end if;
  v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  if v_branch is not null and public._ops_plan_can_view_all(v_uid, v_branch)
     and exists (select 1 from public._ops_plan_branches(v_uid) b where b.branch_name = v_branch) then
    v_all := true;
    select coalesce(array_agg(t.user_id), '{}') into v_ids from public._ops_plan_team(v_branch) t;
  end if;
  return coalesce((
    select jsonb_agg(x.j order by x.at desc)
      from (select public._ops_plan_json(s, v_uid) as j, s.start_on as at
              from public.ops_plans s
             where s.deleted_at is null
               and (s.user_id = v_uid
                    or exists (select 1 from public.ops_plan_guests g where g.plan_id = s.id and g.user_id = v_uid and g.removed_at is null)
                    or (v_all and s.branch_name = v_branch and s.user_id = any (v_ids) and not s.private))
               and (s.title ilike v_like or s.memo ilike v_like or s.location ilike v_like)
             order by s.start_on desc
             limit 50) x), '[]'::jsonb);
end
$$;

-- ── ⑥ 알림 ───────────────────────────────────────────────────────────────────────────────────
-- 매분 — 시작 n분 전 알림 (3-2) + 참석 · 아마로 답한 손님(그 사람 기본 알림 · 없으면 10분 전)
create or replace function public.ops_plan_remind_tick(p_at timestamp default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_now timestamptz := now();
  v_local timestamp := coalesce(p_at, now() at time zone 'Asia/Seoul');
  v_today date := coalesce(p_at, now() at time zone 'Asia/Seoul')::date;
  v_hm int := extract(hour from coalesce(p_at, now() at time zone 'Asia/Seoul'))::int * 60
              + extract(minute from coalesce(p_at, now() at time zone 'Asia/Seoul'))::int;
  v_quiet boolean;
  v_n int := 0;
begin
  v_quiet := v_hm < 480 or v_hm >= 1320;
  with cand as (
    select pl.id, pl.user_id as rcpt, pl.branch_name, pl.kind, pl.title, pl.location, pl.start_time, pl.end_time,
           d.d::date as occ, m.m as mins, (d.d::date + pl.start_time) as occ_at
      from public.ops_plans pl
     cross join generate_series(v_today, v_today + 1, interval '1 day') d(d)
     cross join lateral unnest(pl.reminders) m(m)
     where pl.deleted_at is null and not pl.all_day and cardinality(pl.reminders) > 0
       and pl.start_on <= v_today + 1
       and public._ops_plan_on(pl, d.d::date)
    union all
    select pl.id, g.user_id, pl.branch_name, pl.kind, pl.title, pl.location, pl.start_time, pl.end_time,
           d.d::date, m.m, (d.d::date + pl.start_time)
      from public.ops_plan_guests g
      join public.ops_plans pl on pl.id = g.plan_id
     cross join generate_series(v_today, v_today + 1, interval '1 day') d(d)
     cross join lateral unnest(coalesce((select pp.remind_default from public.ops_plan_prefs pp where pp.user_id = g.user_id),
                                        '{10}'::smallint[])) m(m)
     where g.removed_at is null and g.response in ('yes', 'maybe')
       and pl.deleted_at is null and not pl.all_day and pl.start_on <= v_today + 1
       and public._ops_plan_on(pl, d.d::date)
  ), due as (
    select c.* from cand c
     where c.occ_at - make_interval(mins => c.mins) <= v_local
       and c.occ_at - make_interval(mins => c.mins) > v_local - interval '10 minutes'
       and c.occ_at >= v_local - interval '1 minute'
       and exists (select 1 from public._ops_plan_branches(c.rcpt) b where b.branch_name = c.branch_name)
  ), ins as (
    insert into public.ops_plan_notices (kind, user_id, plan_id, occ_date, minutes)
    select 'remind', due.rcpt, due.id, due.occ, due.mins from due
    on conflict do nothing
    returning user_id, plan_id, occ_date, minutes
  )
  insert into public.notifications (user_id, title, body, link, pushed_at)
  select due.rcpt,
         '⏰ ' || coalesce(nullif(btrim(due.title), ''), public._ops_plan_kind_label(due.kind)) || ' · ' ||
           case when v_local - (due.occ_at - make_interval(mins => due.mins)) > interval '2 minutes'
                then case when due.occ_at - v_local <= interval '1 minute' then '곧 시작해요'
                          else ceil(extract(epoch from (due.occ_at - v_local)) / 60)::int || '분 뒤' end
                else case due.mins when 0 then '지금 시작해요' when 60 then '1시간 전' when 120 then '2시간 전'
                                   when 1440 then '내일 ' || to_char(due.start_time, 'HH24:MI')
                                   else due.mins || '분 전' end
           end,
         to_char(due.start_time, 'HH24:MI') || '~' || to_char(due.end_time, 'HH24:MI')
           || coalesce(' · ' || nullif(btrim(due.location), ''), ''),
         '/office?tab=plan&d=' || to_char(due.occ, 'YYYY-MM-DD'),
         case when v_quiet then v_now end
    from ins
    join due on due.rcpt = ins.user_id and due.id = ins.plan_id and due.occ = ins.occ_date and due.mins = ins.minutes;
  get diagnostics v_n = row_count;
  return jsonb_build_object('sent', v_n, 'quiet', v_quiet, 'at', to_char(v_local, 'HH24:MI'));
end
$$;

-- 아침 8시 브리핑 (3-2) + 참석 · 아마로 답한 초대
create or replace function public.ops_plan_brief_tick(p_at timestamp default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_today date := coalesce(p_at, now() at time zone 'Asia/Seoul')::date;
  v_hm int := extract(hour from coalesce(p_at, now() at time zone 'Asia/Seoul'))::int * 60
              + extract(minute from coalesce(p_at, now() at time zone 'Asia/Seoul'))::int;
  v_dow int := extract(dow from coalesce(p_at, now() at time zone 'Asia/Seoul')::date)::int;
  v_n int := 0;
begin
  if v_hm < 480 or v_hm >= 540 then return jsonb_build_object('sent', 0, 'skip', 'time'); end if;
  with plans as (
    select pl.user_id, pl.kind, pl.start_time, pl.all_day
      from public.ops_plans pl
     where pl.deleted_at is null and pl.kind in ('class', 'pt', 'work', 'out')
       and pl.start_on <= v_today
       and (pl.end_on >= v_today or pl.rrule is not null or cardinality(pl.repeat_weekdays) > 0)
       and public._ops_plan_on(pl, v_today)
    union all
    select g.user_id, pl.kind, pl.start_time, pl.all_day
      from public.ops_plan_guests g
      join public.ops_plans pl on pl.id = g.plan_id
     where g.removed_at is null and g.response in ('yes', 'maybe')
       and pl.deleted_at is null and pl.kind in ('class', 'pt', 'work', 'out')
       and pl.start_on <= v_today
       and (pl.end_on >= v_today or pl.rrule is not null or cardinality(pl.repeat_weekdays) > 0)
       and public._ops_plan_on(pl, v_today)
  ), working as (
    select distinct s.user_id, s.branch_name
      from public.ops_staff s
     cross join lateral public._ops_duty_segments(s.id, v_today) g
     where s.active and s.user_id is not null
  ), meet as (
    select mp.branch_name, count(*)::int as n
      from public.member_promises mp
     where mp.stopped_at is null and v_dow = any (mp.weekdays) and mp.started_on <= v_today
       and public._promise_branch_on(mp.branch_name) and not public._cal_closed_on(mp.branch_name, v_today)
       and public._promise_member(mp.user_id) is not null
     group by mp.branch_name
  ), meet_staff as (
    select w.user_id, sum(m.n)::int as n from working w join meet m on m.branch_name = w.branch_name group by w.user_id
  ), people as (
    select user_id from plans union select user_id from meet_staff
  ), rows as (
    select u.user_id,
           (select count(*) from plans x where x.user_id = u.user_id and x.kind = 'class')::int as c_class,
           (select count(*) from plans x where x.user_id = u.user_id and x.kind = 'pt')::int as c_pt,
           (select count(*) from plans x where x.user_id = u.user_id and x.kind = 'work')::int as c_work,
           (select count(*) from plans x where x.user_id = u.user_id and x.kind = 'out')::int as c_out,
           (select min(x.start_time) from plans x where x.user_id = u.user_id and not x.all_day) as first_at,
           coalesce((select ms.n from meet_staff ms where ms.user_id = u.user_id), 0) as c_meet
      from people u
     where coalesce((select pp.brief_on from public.ops_plan_prefs pp where pp.user_id = u.user_id), true)
       and exists (select 1 from public._ops_plan_branches(u.user_id))
  ), ins as (
    insert into public.ops_plan_notices (kind, user_id, plan_id, occ_date, minutes)
    select 'brief', r.user_id, null, v_today, null from rows r
     where r.c_class + r.c_pt + r.c_work + r.c_out + r.c_meet > 0
    on conflict do nothing
    returning user_id
  )
  insert into public.notifications (user_id, title, body, link)
  select r.user_id,
         '📅 오늘 일정',
         concat_ws(' · ',
           case when r.c_class > 0 then '수업 ' || r.c_class end,
           case when r.c_pt > 0 then 'PT ' || r.c_pt end,
           case when r.c_work > 0 then '업무 ' || r.c_work end,
           case when r.c_out > 0 then '외부 ' || r.c_out end,
           case when r.c_meet > 0 then '약속한 회원 ' || r.c_meet || '명' end,
           case when r.first_at is not null then '첫 일정 ' || to_char(r.first_at, 'HH24:MI') end),
         '/office?tab=plan&d=' || to_char(v_today, 'YYYY-MM-DD')
    from rows r join ins on ins.user_id = r.user_id;
  get diagnostics v_n = row_count;
  return jsonb_build_object('sent', v_n);
end
$$;

-- 집중 시간 — 그 사람의 집중 일정이 지금 진행 중이면 새 알림은 알림함에만(휴대폰 알림 없이)
--   알림이 들어가는 일을 절대 막지 않는다(무슨 오류든 그대로 둔다)
create or replace function public._ops_focus_quiet()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_local timestamp := now() at time zone 'Asia/Seoul';
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_t time := (now() at time zone 'Asia/Seoul')::time;
begin
  if new.pushed_at is not null or new.user_id is null then return new; end if;
  if exists (
    select 1 from public.ops_plans pl
     where pl.user_id = new.user_id and pl.focus and pl.deleted_at is null and not pl.all_day
       and pl.start_on <= v_today
       and (pl.end_on >= v_today or pl.rrule is not null or cardinality(pl.repeat_weekdays) > 0)
       and pl.start_time <= v_t and pl.end_time > v_t
       and public._ops_plan_on(pl, v_today)) then
    new.pushed_at := now();
  end if;
  return new;
exception when others then
  return new;
end
$$;

create or replace trigger notifications_focus_quiet
  before insert on public.notifications
  for each row execute function public._ops_focus_quiet();

-- ── ⑦ 첨부 저장소 ────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ops-plan-files', 'ops-plan-files', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do nothing;

do $$
begin
  create policy "ops plan files own insert" on storage.objects for insert to authenticated
    with check (bucket_id = 'ops-plan-files'
                and (storage.foldername(name))[1] = (auth.uid())::text
                and public._ops_plan_can_upload());
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "ops plan files read" on storage.objects for select to authenticated
    using (bucket_id = 'ops-plan-files' and public._ops_plan_file_can_read(name));
exception when duplicate_object then null;
end $$;

-- ── ⑧ 휴대폰 캘린더 구독(3-1 · 3-2) + 참석 · 아마로 답한 초대 ─────────────────────────────────────
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

  -- ① 내 일정 + 참석 · 아마로 답한 초대 — 반복은 rrule(3-2 · 횟수는 계산해 둔 끝나는 날로) 또는 예전 매주 · 이 날만 빼기 = EXDATE ·
  --    여러 날 시각 일정은 날마다 같은 시각 · PT 는 이름 없이 · 개인 일정은 제목 없이 · 장소는 PT · 개인 일정만 빼고
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
           'weekly', case when p.rrule is null and cardinality(p.repeat_weekdays) > 0 then to_jsonb(p.repeat_weekdays) end,
           'rrule', case when p.rrule is not null then regexp_replace(p.rrule, ';COUNT=\d+', '') end,
           'until', p.until_on,
           'exdates', case when p.rrule is not null or cardinality(p.repeat_weekdays) > 0 then to_jsonb(p.skip_dates) else '[]'::jsonb end,
           'location', case when p.kind in ('pt', 'personal') then null else nullif(btrim(p.location), '') end,
           'busy', not p.all_day and p.kind <> 'off',
           'updated', p.updated_at)
         order by p.start_on, p.created_at), '[]'::jsonb)
    into v_plans
    from public.ops_plans p
   where p.deleted_at is null
     and (p.user_id = _uid
          or exists (select 1 from public.ops_plan_guests g
                      where g.plan_id = p.id and g.user_id = _uid and g.removed_at is null and g.response in ('yes', 'maybe')))
     and p.start_on <= v_today + 365
     and case when p.rrule is not null or cardinality(p.repeat_weekdays) > 0 then coalesce(p.until_on, v_today) >= v_today - 30
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

-- ── 권한 ─────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public._ops_plan_day_label(date) from public, anon, authenticated;
revoke execute on function public._ops_plan_when(public.ops_plans) from public, anon, authenticated;
revoke execute on function public._ops_plan_days(public.ops_plans, date, date) from public, anon, authenticated;
revoke execute on function public._ops_plan_next_on(public.ops_plans, date) from public, anon, authenticated;
revoke execute on function public._ops_plan_notify(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public._ops_plan_guests_json(uuid) from public, anon, authenticated;
revoke execute on function public._ops_plan_off_on(uuid, date, time, time) from public, anon, authenticated;
revoke execute on function public._ops_plan_overlaps_off(public.ops_plans, uuid) from public, anon, authenticated;
revoke execute on function public._ops_plan_guests_apply(public.ops_plans, uuid[], uuid, uuid, boolean, boolean) from public, anon, authenticated;
revoke execute on function public._ops_plan_off_decline(public.ops_plans) from public, anon, authenticated;
revoke execute on function public._ops_plan_guests_cancel(public.ops_plans, date, text) from public, anon, authenticated;
revoke execute on function public._ops_plan_busy(uuid[], date, date) from public, anon, authenticated;
revoke execute on function public._ops_plan_json(public.ops_plans, uuid) from public, anon, authenticated;
revoke execute on function public._ops_focus_quiet() from public, anon, authenticated;
revoke execute on function public._calendar_feed_staff(uuid) from public, anon, authenticated;
-- 저장소 정책이 부르는 두 함수 — authenticated 만 (anon 은 이 정책을 거치지 않는다)
revoke execute on function public._ops_plan_can_upload() from public, anon;
revoke execute on function public._ops_plan_file_can_read(text) from public, anon;
grant execute on function public._ops_plan_can_upload() to authenticated, service_role;
grant execute on function public._ops_plan_file_can_read(text) to authenticated, service_role;

revoke execute on function public.ops_plans_range(text, date, date) from public, anon;
revoke execute on function public.ops_plan_save(jsonb) from public, anon;
revoke execute on function public.ops_plan_respond(uuid, text, text, date, time, time) from public, anon;
revoke execute on function public.ops_plan_find_times(text, uuid[], integer, date) from public, anon;
revoke execute on function public.ops_plan_prefs_save(jsonb) from public, anon;
revoke execute on function public.ops_plan_insights(text, date) from public, anon;
revoke execute on function public.ops_plan_remove_scope(uuid, text, date) from public, anon;
revoke execute on function public.ops_plan_search(text, text) from public, anon;
grant execute on function public.ops_plans_range(text, date, date) to authenticated;
grant execute on function public.ops_plan_save(jsonb) to authenticated;
grant execute on function public.ops_plan_respond(uuid, text, text, date, time, time) to authenticated;
grant execute on function public.ops_plan_find_times(text, uuid[], integer, date) to authenticated;
grant execute on function public.ops_plan_prefs_save(jsonb) to authenticated;
grant execute on function public.ops_plan_insights(text, date) to authenticated;
grant execute on function public.ops_plan_remove_scope(uuid, text, date) to authenticated;
grant execute on function public.ops_plan_search(text, text) to authenticated;

revoke execute on function public.ops_plan_remind_tick(timestamp) from public, anon, authenticated;
revoke execute on function public.ops_plan_brief_tick(timestamp) from public, anon, authenticated;

grant execute on function public._ops_plan_day_label(date) to service_role;
grant execute on function public._ops_plan_when(public.ops_plans) to service_role;
grant execute on function public._ops_plan_days(public.ops_plans, date, date) to service_role;
grant execute on function public._ops_plan_next_on(public.ops_plans, date) to service_role;
grant execute on function public._ops_plan_notify(uuid, text, text, text) to service_role;
grant execute on function public._ops_plan_guests_json(uuid) to service_role;
grant execute on function public._ops_plan_off_on(uuid, date, time, time) to service_role;
grant execute on function public._ops_plan_overlaps_off(public.ops_plans, uuid) to service_role;
grant execute on function public._ops_plan_guests_apply(public.ops_plans, uuid[], uuid, uuid, boolean, boolean) to service_role;
grant execute on function public._ops_plan_off_decline(public.ops_plans) to service_role;
grant execute on function public._ops_plan_guests_cancel(public.ops_plans, date, text) to service_role;
grant execute on function public._ops_plan_busy(uuid[], date, date) to service_role;
grant execute on function public._ops_plan_json(public.ops_plans, uuid) to service_role;
grant execute on function public._calendar_feed_staff(uuid) to service_role;
grant execute on function public.ops_plan_remind_tick(timestamp) to service_role;
grant execute on function public.ops_plan_brief_tick(timestamp) to service_role;
