-- ✅ 나만의 체크 — 업무 체크 (2026-11-26 대표님 「마이복서 153 스케줄러 나만의 체크리스트 만들기 — 운동 체크리스트도 있지만 업무 체크 리스트도 만들수있게 해줘」 · 계획 보고 뒤 「다음가자」)
--   member_check_items.kind = 'workout'(지금까지 만든 것 · 기본) | 'work'(업무).
--   · 운동 체크 3개 · 업무 체크 5개까지(따로 센다) · 단위: 운동 번/분/라운드/세트/km/개 · 업무 건/통/개/번/분/시간
--   · 금색 별 · 저녁 체크 알림 · 일요일 돌아보기(_cal_check_count)는 지금처럼 운동 체크만 센다 — 업무는 그날 카드에 따로(화면 lib/calendarChecks.ts).
--   · 고친 함수 — 모두 운영 DB 의 지금 정의(저장소 마지막 정의와 지문 같음 확인) 위에 이번 것만:
--       set_my_check_item  : p_kind 를 더함(옛 5개 인자 부름 = 운동 그대로) · 고칠 때는 만든 종류 그대로
--       _my_check_items    : 'kind'
--       get_my_calendar    : 체크 항목에 'kind' (3-5 날씨 판 위 · 그 밖은 그대로)
--       _cal_check_count   : 업무 체크는 세지 않음(kind = 'workout')

-- ═══════════════════════════ 1) 종류 칸 · 단위 제약 ═══════════════════════════
alter table public.member_check_items add column if not exists kind text not null default 'workout';
alter table public.member_check_items drop constraint if exists member_check_items_kind_chk;
alter table public.member_check_items add constraint member_check_items_kind_chk check (kind in ('workout', 'work'));
alter table public.member_check_items drop constraint if exists member_check_items_unit_chk;
alter table public.member_check_items add constraint member_check_items_unit_chk check (
  unit is null
  or (kind = 'workout' and unit = any (array['번', '분', '라운드', '세트', 'km', '개']))
  or (kind = 'work' and unit = any (array['건', '통', '개', '번', '분', '시간'])));
comment on column public.member_check_items.kind is
  '나만의 체크 종류 — workout(운동 · 3개까지 · 금색 별에 셈) · work(업무 · 5개까지 · 금색 별에 안 셈) (2026-11-26)';


-- ═══════════════════════════ 2) 만들기 · 고치기 — p_kind (운동 3개 · 업무 5개 · 단위는 종류마다) ═══════════════════════════
-- 인자가 하나 늘어 옛 함수를 지우고 다시 만든다(같은 이름 두 개면 앱 부름이 어느 것인지 못 고른다).
-- 옛 화면은 p_kind 없이 부른다 → 만들면 운동 · 고치면 만든 종류 그대로.
drop function if exists public.set_my_check_item(uuid, text, integer, text, integer[]);
create or replace function public.set_my_check_item(
  p_id uuid default null,
  p_label text default null,
  p_target integer default null,
  p_unit text default null,
  p_weekdays integer[] default null,
  p_kind text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_label text := nullif(btrim(regexp_replace(coalesce(p_label, ''), '\s+', ' ', 'g')), '');
  v_unit text := case when p_target is null then null else nullif(btrim(coalesce(p_unit, '')), '') end;
  v_days smallint[];
  v_n integer;
  v_kind text;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public._is_active_member(v_me) then
    raise exception '승인된 회원만 쓸 수 있어요' using errcode = '42501';
  end if;
  if p_kind is not null and p_kind not in ('workout', 'work') then
    raise exception '체크 종류를 다시 골라 주세요';
  end if;
  -- 만들 때는 고른 종류(없으면 운동) · 고칠 때는 만든 종류 그대로
  if p_id is null then
    v_kind := coalesce(p_kind, 'workout');
  else
    select i.kind into v_kind
      from public.member_check_items i
     where i.id = p_id and i.user_id = v_me and i.archived_at is null;
    if v_kind is null then
      raise exception '체크를 찾지 못했어요';
    end if;
  end if;
  if v_label is null then
    raise exception '체크 이름을 적어 주세요';
  end if;
  if char_length(v_label) > 20 then
    raise exception '체크 이름은 20자 안으로 적어 주세요';
  end if;
  if p_target is not null and (p_target < 1 or p_target > 9999) then
    raise exception '목표 숫자는 1부터 9,999까지 적어 주세요';
  end if;
  if v_unit is not null and not (
       (v_kind = 'workout' and v_unit in ('번', '분', '라운드', '세트', 'km', '개'))
    or (v_kind = 'work' and v_unit in ('건', '통', '개', '번', '분', '시간'))) then
    raise exception '단위를 다시 골라 주세요';
  end if;
  if p_weekdays is not null then
    if exists (select 1 from unnest(p_weekdays) d where d is null or d < 0 or d > 6) then
      raise exception '요일을 다시 골라 주세요';
    end if;
    select coalesce(array_agg(x order by x), '{}'::smallint[]) into v_days
      from (select distinct d::smallint as x from unnest(p_weekdays) d) s;
    if cardinality(v_days) = 0 then
      raise exception '요일을 하나 이상 골라 주세요';
    end if;
    if cardinality(v_days) = 7 then
      v_days := null;
    end if;
  end if;

  if p_id is null then
    -- 동시에 두 번 눌러도 운동 3개 · 업무 5개를 넘지 않게
    perform pg_advisory_xact_lock(hashtext('member-check-items:' || v_me::text));
    select count(*)::integer into v_n
      from public.member_check_items
     where user_id = v_me and archived_at is null and kind = v_kind;
    if v_kind = 'work' and v_n >= 5 then
      raise exception '업무 체크는 5개까지 만들 수 있어요';
    end if;
    if v_kind = 'workout' and v_n >= 3 then
      raise exception '운동 체크는 3개까지 만들 수 있어요';
    end if;
    insert into public.member_check_items (user_id, label, target, unit, weekdays, kind)
    values (v_me, v_label, p_target, v_unit, v_days, v_kind);
  else
    update public.member_check_items
       set label = v_label, target = p_target, unit = v_unit, weekdays = v_days,
           week_goal = case when v_days is not null then null else week_goal end, updated_at = now()
     where id = p_id and user_id = v_me and archived_at is null;
    if not found then
      raise exception '체크를 찾지 못했어요';
    end if;
  end if;
  return jsonb_build_object('items', public._my_check_items(v_me));
end
$$;
revoke all on function public.set_my_check_item(uuid, text, integer, text, integer[], text) from public, anon;
grant execute on function public.set_my_check_item(uuid, text, integer, text, integer[], text) to authenticated;


-- ═══════════════════════════ 3) 지금 목록에 'kind' (3-4 판 위) ═══════════════════════════
create or replace function public._my_check_items(_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.id, 'label', i.label, 'target', i.target, 'unit', i.unit,
           'weekdays', to_jsonb(i.weekdays), 'week_goal', i.week_goal, 'kind', i.kind,
           'created_on', (i.created_at at time zone 'Asia/Seoul')::date,
           'archived_on', null)
         order by i.created_at), '[]'::jsonb)
    from public.member_check_items i
   where i.user_id = _uid and i.archived_at is null
$$;

revoke all on function public._my_check_items(uuid) from public, anon, authenticated;


-- ═══════════════════════════ 4) 달력 — 체크 항목에 'kind' (3-5 날씨 판 위 · 그 밖은 그대로) ═══════════════════════════
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
           'weekdays', to_jsonb(i.weekdays), 'week_goal', i.week_goal, 'kind', i.kind,
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



-- ═══════════════════════════ 5) 그날 체크 세기 — 업무 체크는 빼고(금색 별 · 저녁 체크 알림 · 일요일 돌아보기) (1분 성장 판 위) ═══════════════════════════
create or replace function public._cal_check_count(_uid uuid, _day date)
returns table(total integer, done integer)
language sql
stable
security definer
set search_path to 'public'
as $$
  with b as (
    select (_day::timestamp at time zone 'Asia/Seoul') as f,
           ((_day + 1)::timestamp at time zone 'Asia/Seoul') as t,
           (select p.branch_name from public.profiles p where p.user_id = _uid) as branch
  ), x as (
    select
      exists (select 1 from public.attendance_logs a
               where a.user_id = _uid and not coalesce(a.is_duplicate, false)
                 and a.checked_in_at >= b.f and a.checked_in_at < b.t) as gym,
      (public._cal_closed_on(b.branch, _day) or public._cal_rest_on(_uid, _day)) as closed,
      (exists (select 1 from public.boxing_cheers c
                where c.sender_user_id = _uid and c.created_at >= b.f and c.created_at < b.t)
       or exists (select 1 from public.community_reactions r
                   where r.user_id = _uid and r.created_at >= b.f and r.created_at < b.t)) as cheer,
      exists (select 1 from public.champion_journal_entries j
               where j.user_id = _uid and coalesce(j.kind, 'journal') = 'journal'
                 and j.created_at >= b.f and j.created_at < b.t) as line
      from b
  ), items as (
    select i.id
      from public.member_check_items i
     where i.user_id = _uid
       and (i.created_at at time zone 'Asia/Seoul')::date <= _day
       and (i.archived_at is null or (i.archived_at at time zone 'Asia/Seoul')::date > _day)
       and (i.weekdays is null or extract(dow from _day)::smallint = any (i.weekdays))
       and i.week_goal is null
       and i.kind = 'workout'
  ), d as (
    select coalesce((select m.done from public.member_check_days m where m.user_id = _uid and m.day = _day), '{}'::uuid[]) as done
  ), g as (
    select public._growth_check_on(_uid, _day) as on_check,
           exists (select 1 from public.growth_read_days r where r.user_id = _uid and r.day = _day) as read
  )
  select
    ((case when x.closed and not x.gym then 0 else 1 end) + 2 + (select count(*) from items)
      + (case when g.on_check then 1 else 0 end))::integer as total,
    (x.gym::integer + x.cheer::integer + x.line::integer
      + (select count(*) from items, d where items.id = any (d.done))
      + (case when g.on_check and g.read then 1 else 0 end))::integer as done
    from x, g
$$;

revoke all on function public._cal_check_count(uuid, date) from public, anon, authenticated;
