-- ✅ 캘린더 3-4단계 — 할 일 · 습관 (2026-11-14 대표님 「진행」 · 「캘린더 3단계 보고서」 https://claude.ai/artifact/5EMvfMwaXakid7SzKg1NKK)
--   작업판 myboxer:ops-schedule 이어받음(11/08 「153 계획 시스템 보고서」 https://claude.ai/artifact/EuQAL1HpGefZk8Nwd8GrBf 2단계 화면).
--
--   코치 · 지점장 · 대표님 — 「일정」 탭 「할 일」 보기(11/08 DB 20261108230818_ops_tasks.sql 그대로 쓰고 세 곳만 덧댄다)
--     ① _ops_task_notify — 할 일 알림(맡김 · 질문 · 끝)도 3-3 _ops_plan_notify 로: 밤 10시 ~ 아침 8시는 알림함에만 ·
--        링크 /office?tab=plan&todo=1 (할 일 보기로 바로 — 예전엔 /office?tab=plan)
--     ② ops_tasks_day — 'assigned'(내가 맡긴 일: 상태 · 답장 · 받은 분 — 지점 관리자만) · 'team'(맡길 수 있는 그 지점 팀) 칸 더하기
--     ③ ops_plan_brief_tick — 아침 8시 브리핑에 「할 일 n」(오늘까지 마감 · 안 끝낸 것) · 「고정 업무 n」(그날 그 시각 근무자) ·
--        첫 일정에 고정 업무 시각도 · 할 일 · 고정 업무만 있는 날의 링크 = 할 일 보기
--     「중요한 일 3개」(ops_daily_focus · ops_focus_set) · 작성률은 대표님 결정 7(계속 미루기)대로 화면이 안 쓴다 — 표 · 함수는 그대로.
--
--   회원 — 운동 달력 나만의 체크 (2-1 member_check_items 위에)
--     ④ member_check_items.week_goal — '주 n번'(1 ~ 6 · 아무 요일이나 — 그래서 weekdays 는 비움). 주 n번 체크는 그날의 금색 별에
--        세지 않는다(화면 lib/calendarChecks dayChecks flex · 서버 _cal_check_count 같은 식) — 주에 n번 채우는 것이 목표라서.
--        set_my_check_goal 새 함수 · set_my_check_item 덧대기(요일을 고르면 주 n번을 비움) · _my_check_items · get_my_calendar 에 week_goal.
--     ⑤ get_my_habits — 나만의 체크마다 이번 주 채운 수 / 이번 주 목표 · 지금 이어 가는 주 · 가장 길게 이어 간 주
--        (주 = 한국 시각 월 ~ 일 · 목표 = 주 n번, 없으면 고른 요일 수(매일 = 7) · 만든 주와 이번 주는 남은 날만큼으로 줄여서 ·
--         이번 주는 채우면 셈에 들고 아직이면 지난주까지로 · 104주까지). 달성률 % · 빠진 날은 어디에도 없다(회원 감정 설계).
--     ⑥ member_todos 새 표 — 마감 있는 할 일(30자 · 마감일 · 끝낸 날 · 빼기 = removed_at) · 안 끝낸 것 10개까지 ·
--        set_my_todo · set_my_todo_done · remove_my_todo · get_my_calendar 에 보이는 날짜의 할 일('todos').
--        마감이 지난 할 일은 화면이 '다음에 해도 돼요' 칸으로 옮긴다(지났다 · 밀렸다는 말 없음).
--
--   지킬 것: 새 표는 RLS 켜고 anon · authenticated 직접 읽기 · 쓰기 막음 → 함수로만(SECURITY DEFINER · search_path public).
--   덧댄 함수는 운영 지금 정의(= 저장소 파일 · 2026-11-14 md5 확인) 위에 · 이름 · 인자 · 권한 그대로. 출석 표 트리거 없음.

-- ═══════════════════════════ 1) 표 · 칸 ═══════════════════════════
alter table public.member_check_items add column if not exists week_goal smallint;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'member_check_items_week_goal_chk') then
    alter table public.member_check_items
      add constraint member_check_items_week_goal_chk check (week_goal is null or (week_goal between 1 and 6 and weekdays is null));
  end if;
end $$;
comment on column public.member_check_items.week_goal is '캘린더 3-4 — 주 n번(1 ~ 6) · 아무 요일이나(weekdays 비움) · 금색 별에 세지 않음(_cal_check_count). null = 요일(weekdays) 또는 매일';

create table if not exists public.member_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  due_on date not null,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz,
  constraint member_todos_title_chk check (char_length(title) between 1 and 30)
);
create index if not exists member_todos_user_idx on public.member_todos (user_id, due_on) where removed_at is null;
alter table public.member_todos enable row level security;
revoke all on table public.member_todos from anon, authenticated;
comment on table public.member_todos is '캘린더 3-4 — 회원 마감 있는 할 일(30자 · 마감일 · 끝낸 날) · 안 끝낸 것 10개까지 · 빼기 = removed_at. 함수로만(get_my_habits · get_my_calendar · set_my_todo · set_my_todo_done · remove_my_todo).';


-- ═══════════════════════════ 2) 회원 — 나만의 체크 덧대기 (운영 지금 정의 위에) ═══════════════════════════

-- ④ 지금 나만의 체크 목록에 week_goal
create or replace function public._my_check_items(_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.id, 'label', i.label, 'target', i.target, 'unit', i.unit,
           'weekdays', to_jsonb(i.weekdays), 'week_goal', i.week_goal,
           'created_on', (i.created_at at time zone 'Asia/Seoul')::date,
           'archived_on', null)
         order by i.created_at), '[]'::jsonb)
    from public.member_check_items i
   where i.user_id = _uid and i.archived_at is null
$$;


-- ④ 요일을 고르면 주 n번을 비운다 (그 밖은 2-1 그대로)
create or replace function public.set_my_check_item(
  p_id uuid default null,
  p_label text default null,
  p_target integer default null,
  p_unit text default null,
  p_weekdays integer[] default null)
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
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public._is_active_member(v_me) then
    raise exception '승인된 회원만 쓸 수 있어요' using errcode = '42501';
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
  if v_unit is not null and v_unit not in ('번', '분', '라운드', '세트', 'km', '개') then
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
    -- 동시에 두 번 눌러도 3개를 넘지 않게
    perform pg_advisory_xact_lock(hashtext('member-check-items:' || v_me::text));
    select count(*)::integer into v_n from public.member_check_items where user_id = v_me and archived_at is null;
    if v_n >= 3 then
      raise exception '나만의 체크는 3개까지 만들 수 있어요';
    end if;
    insert into public.member_check_items (user_id, label, target, unit, weekdays)
    values (v_me, v_label, p_target, v_unit, v_days);
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


-- ④ ⑥ 달력 — 항목에 week_goal · 보이는 날짜의 할 일 'todos' (그 밖은 2-4 그대로)
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
  v_todos jsonb;
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

  -- (3-4) 보이는 날짜가 마감인 할 일 (뺀 것 빼고)
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'due_on', t.due_on, 'done', t.done_at is not null)
         order by t.due_on, t.created_at), '[]'::jsonb)
    into v_todos
    from public.member_todos t
   where t.user_id = v_me and t.removed_at is null and t.due_on between p_from and p_to;

  return jsonb_build_object(
    'on', true,
    'today', (now() at time zone 'Asia/Seoul')::date,
    'items', v_items,
    'todos', v_todos,
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


-- ④ 그날 체크 수(저녁 독려 · 주간 돌아보기의 금색 별) — 주 n번 체크는 세지 않는다 (그 밖은 2-2 그대로)
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
      public._cal_closed_on(b.branch, _day) as closed,
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
  ), d as (
    select coalesce((select m.done from public.member_check_days m where m.user_id = _uid and m.day = _day), '{}'::uuid[]) as done
  )
  select
    ((case when x.closed and not x.gym then 0 else 1 end) + 2 + (select count(*) from items))::integer as total,
    (x.gym::integer + x.cheer::integer + x.line::integer
      + (select count(*) from items, d where items.id = any (d.done)))::integer as done
    from x
$$;


-- ═══════════════════════════ 3) 회원 — 새 함수 ═══════════════════════════

-- ④ 주 n번 — 정하기 · 비우기 (요일 대신 아무 날이나 n번 · 정하면 요일은 비운다)
create or replace function public.set_my_check_goal(p_id uuid, p_goal integer default null)
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
  if not public._is_active_member(v_me) then
    raise exception '승인된 회원만 쓸 수 있어요' using errcode = '42501';
  end if;
  if p_goal is not null and (p_goal < 1 or p_goal > 6) then
    raise exception '주 1번부터 6번까지 골라 주세요';
  end if;
  update public.member_check_items
     set week_goal = p_goal::smallint,
         weekdays = case when p_goal is not null then null else weekdays end,
         updated_at = now()
   where id = p_id and user_id = v_me and archived_at is null;
  if not found then
    raise exception '체크를 찾을 수 없어요';
  end if;
  return jsonb_build_object('items', public._my_check_items(v_me));
end
$$;

-- ⑥ 안쪽 함수 — 지금 할 일 (안 끝낸 것 모두 + 끝낸 지 7일 안)
create or replace function public._my_todos(_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id, 'title', t.title, 'due_on', t.due_on,
           'done_on', (t.done_at at time zone 'Asia/Seoul')::date,
           'created_on', (t.created_at at time zone 'Asia/Seoul')::date)
         order by (t.done_at is not null), t.due_on, t.created_at), '[]'::jsonb)
    from public.member_todos t
   where t.user_id = _uid and t.removed_at is null
     and (t.done_at is null or t.done_at >= now() - interval '7 days')
$$;

-- ⑥ 할 일 넣기 · 고치기 — 30자 · 마감일(오늘 ~ 1년 · 고칠 때 마감일을 그대로 두면 지난 날이어도 됨) · 안 끝낸 것 10개까지
create or replace function public.set_my_todo(p_id uuid default null, p_title text default null, p_due date default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_title text := nullif(btrim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g')), '');
  v_row public.member_todos%rowtype;
  v_n integer;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public._is_active_member(v_me) then
    raise exception '승인된 회원만 쓸 수 있어요' using errcode = '42501';
  end if;
  if v_title is null then
    raise exception '할 일을 적어 주세요';
  end if;
  if char_length(v_title) > 30 then
    raise exception '할 일은 30자 안으로 적어 주세요';
  end if;
  if p_due is null then
    raise exception '마감일을 골라 주세요';
  end if;

  if p_id is null then
    if p_due < v_today or p_due > v_today + 365 then
      raise exception '마감일은 오늘부터 1년 안으로 골라 주세요';
    end if;
    -- 동시에 두 번 눌러도 10개를 넘지 않게
    perform pg_advisory_xact_lock(hashtext('member-todos:' || v_me::text));
    select count(*)::integer into v_n
      from public.member_todos where user_id = v_me and removed_at is null and done_at is null;
    if v_n >= 10 then
      raise exception '할 일은 10개까지 둘 수 있어요';
    end if;
    insert into public.member_todos (user_id, title, due_on) values (v_me, v_title, p_due);
  else
    select * into v_row from public.member_todos where id = p_id and user_id = v_me and removed_at is null for update;
    if not found then
      raise exception '할 일을 찾을 수 없어요';
    end if;
    if p_due is distinct from v_row.due_on and (p_due < v_today or p_due > v_today + 365) then
      raise exception '마감일은 오늘부터 1년 안으로 골라 주세요';
    end if;
    update public.member_todos set title = v_title, due_on = p_due, updated_at = now() where id = p_id;
  end if;
  return jsonb_build_object('todos', public._my_todos(v_me));
end
$$;

-- ⑥ 할 일 끝냈어요 · 되돌리기
create or replace function public.set_my_todo_done(p_id uuid, p_done boolean default true)
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
  if not public._is_active_member(v_me) then
    raise exception '승인된 회원만 쓸 수 있어요' using errcode = '42501';
  end if;
  update public.member_todos
     set done_at = case when coalesce(p_done, true) then coalesce(done_at, now()) else null end,
         updated_at = now()
   where id = p_id and user_id = v_me and removed_at is null;
  if not found then
    raise exception '할 일을 찾을 수 없어요';
  end if;
  return jsonb_build_object('todos', public._my_todos(v_me));
end
$$;

-- ⑥ 할 일 빼기 — 지우지 않고 removed_at
create or replace function public.remove_my_todo(p_id uuid)
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
  update public.member_todos
     set removed_at = now(), updated_at = now()
   where id = p_id and user_id = v_me and removed_at is null;
  if not found then
    raise exception '할 일을 찾을 수 없어요';
  end if;
  return jsonb_build_object('todos', public._my_todos(v_me));
end
$$;

-- ⑤ 나만의 체크 시트 — 체크마다 이번 주 · 이어 가는 주 · 가장 길게 이어 간 주 + 할 일
--   주 = 한국 시각 월 ~ 일. 그 주 목표 = least(목표, 그 주에 체크할 수 있는 날 — 만든 날부터 · 고른 요일만 · 이번 주는 남은 날 포함).
--   채운 주 = 그 주 체크 수 ≥ 그 주 목표. 이번 주는 채우면 이어 가는 주에 들고, 아직이면 지난주까지로 센다(끝나지 않은 주라서).
--   화면 lib/memberHabits.ts 의 weekGoalOf · streakWeeks 와 같은 식.
create or replace function public.get_my_habits()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_mon date := (now() at time zone 'Asia/Seoul')::date - (extract(isodow from (now() at time zone 'Asia/Seoul')::date)::int - 1);
  v_items jsonb := '[]'::jsonb;
  r record;
  w date;
  v_goal integer;
  v_avail integer;
  v_gw integer;
  v_done integer;
  v_met boolean;
  v_run integer;
  v_best integer;
  v_now integer;
  v_this_done integer;
  v_this_goal integer;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public._is_active_member(v_me) then
    return jsonb_build_object('on', false);
  end if;

  for r in
    select i.id, i.label, i.target, i.unit, i.weekdays, i.week_goal,
           (i.created_at at time zone 'Asia/Seoul')::date as c_on
      from public.member_check_items i
     where i.user_id = v_me and i.archived_at is null
     order by i.created_at
  loop
    v_goal := coalesce(r.week_goal::integer, coalesce(cardinality(r.weekdays), 7));
    v_run := 0;
    v_best := 0;
    v_now := 0;
    v_this_done := 0;
    v_this_goal := 0;
    w := greatest(r.c_on - (extract(isodow from r.c_on)::int - 1), v_mon - 7 * 103);
    while w <= v_mon loop
      select count(*)::integer into v_avail
        from generate_series(greatest(w, r.c_on)::timestamp, (w + 6)::timestamp, interval '1 day') g
       where r.weekdays is null or extract(dow from g)::smallint = any (r.weekdays);
      v_gw := least(v_goal, v_avail);
      select count(*)::integer into v_done
        from public.member_check_days m
       where m.user_id = v_me
         and m.day between greatest(w, r.c_on) and least(w + 6, v_today)
         and r.id = any (m.done);
      v_met := v_gw > 0 and v_done >= v_gw;
      if w = v_mon then
        v_this_done := v_done;
        v_this_goal := v_gw;
        if v_met then
          v_run := v_run + 1;
        end if;
        v_now := v_run;
      elsif v_met then
        v_run := v_run + 1;
      else
        v_run := 0;
      end if;
      v_best := greatest(v_best, v_run);
      w := w + 7;
    end loop;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id', r.id, 'label', r.label, 'target', r.target, 'unit', r.unit,
      'weekdays', to_jsonb(r.weekdays), 'week_goal', r.week_goal, 'goal', v_goal,
      'created_on', r.c_on,
      'week', jsonb_build_object('done', v_this_done, 'goal', v_this_goal),
      'now_weeks', v_now, 'best_weeks', v_best));
  end loop;

  return jsonb_build_object(
    'on', true,
    'today', v_today,
    'monday', v_mon,
    'items', v_items,
    'todos', public._my_todos(v_me));
end
$$;


-- ═══════════════════════════ 4) 코치 · 지점장 · 대표님 — 할 일 덧대기 (운영 지금 정의 위에) ═══════════════════════════

-- ① 할 일 알림 — 3-3 _ops_plan_notify 로(밤 10시 ~ 아침 8시는 알림함에만 · 할 일 보기 링크)
create or replace function public._ops_task_notify(_to uuid, _title text, _body text)
returns void language sql security definer set search_path = public as $$
  select public._ops_plan_notify(_to, _title, _body, '/office?tab=plan&todo=1');
$$;


-- ② 맡긴 일 · 팀 칸 (그 밖은 11/08 그대로)
create or replace function public.ops_tasks_day(p_branch text, p_date date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_date date := coalesce(p_date, (now() at time zone 'Asia/Seoul')::date);
  v_branch text := nullif(btrim(coalesce(p_branch, '')), '');
  v_branches jsonb;
  v_all boolean;
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('branch', b.branch_name, 'manage', b.manage, 'mine', b.mine)
                            order by b.mine desc, b.branch_name), '[]'::jsonb)
    into v_branches from public._ops_plan_branches(v_uid) b;
  if jsonb_array_length(v_branches) = 0 then raise exception '할 일은 코치님 · 지점장님 · 대표님만 쓸 수 있어요'; end if;
  if v_branch is null or not exists (select 1 from jsonb_array_elements(v_branches) e where e->>'branch' = v_branch) then
    v_branch := coalesce(
      (select e->>'branch' from jsonb_array_elements(v_branches) e
        where e->>'branch' = (select p.branch_name from public.profiles p where p.user_id = v_uid) limit 1),
      v_branches->0->>'branch');
  end if;
  v_all := public._ops_plan_can_view_all(v_uid, v_branch);

  return jsonb_build_object(
    'branch', v_branch,
    'branches', v_branches,
    'manage', v_all,
    'hq', public._strategy_hq(v_uid),
    'me', v_uid,
    'date', v_date,
    'today', v_today,
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'title', t.title, 'memo', t.memo, 'kind', t.kind, 'effect', t.effect,
               'due_on', t.due_on, 'status', t.status, 'source', t.source, 'preset_id', t.preset_id,
               'reply', t.reply, 'created_by', t.created_by,
               'created_by_name', case when t.created_by = v_uid then null else public._ops_task_name(t.created_by, t.branch_name) end,
               'done_at', t.done_at, 'updated_at', t.updated_at)
             order by (t.status = 'done'), t.due_on nulls last, t.effect desc, t.created_at)
        from public.ops_tasks t
       where t.user_id = v_uid and t.branch_name = v_branch and t.deleted_at is null
         and (t.status <> 'done' or t.done_at >= now() - interval '36 hours')), '[]'::jsonb),
    'focus', coalesce((select to_jsonb(f.task_ids) from public.ops_daily_focus f
                        where f.user_id = v_uid and f.work_date = v_date), '[]'::jsonb),
    'duties', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'title', p.title, 'slot', p.duty_slot, 'time', to_char(p.duty_time, 'HH24:MI'),
               'mine', exists (select 1 from public._ops_duty_people(p.id, v_date) d where d.user_id = v_uid),
               'people', (select coalesce(jsonb_agg(public._ops_task_name(d.user_id, v_branch)), '[]'::jsonb)
                            from public._ops_duty_people(p.id, v_date) d),
               'checked', c.preset_id is not null,
               'checked_at', c.checked_at,
               'checked_by_name', case when c.checked_by is null then null else public._ops_task_name(c.checked_by, v_branch) end)
             order by p.duty_time, p.sort, p.created_at)
        from public.ops_task_presets p
        left join public.ops_duty_checks c on c.preset_id = p.id and c.work_date = v_date
       where p.kind = 'duty' and p.active and p.branch_name = v_branch
         and (v_all or exists (select 1 from public._ops_duty_people(p.id, v_date) d where d.user_id = v_uid))), '[]'::jsonb),
    'presets', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'effect', p.effect, 'due_rule', p.due_rule,
                                          'branch', p.branch_name)
             order by p.sort, p.created_at)
        from public.ops_task_presets p
       where p.kind = 'focus' and p.active and (p.branch_name is null or p.branch_name = v_branch)), '[]'::jsonb),
    'prefs', coalesce((select jsonb_build_object('focus_slot', x.focus_slot, 'manual_version', x.manual_version,
                                                 'manual_read_at', x.manual_read_at)
                         from public.ops_task_prefs x where x.user_id = v_uid), '{}'::jsonb),
    -- (3-4) 내가 맡긴 일 — 받은 분 · 상태 · 답장 (지점 관리자만 · 안 끝낸 것 + 끝낸 지 7일 안)
    'assigned', case when v_all then coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'title', t.title, 'memo', t.memo, 'due_on', t.due_on, 'status', t.status,
               'reply', t.reply, 'user_id', t.user_id, 'user_name', public._ops_task_name(t.user_id, t.branch_name),
               'done_at', t.done_at, 'updated_at', t.updated_at)
             order by (t.status = 'done'), t.due_on nulls last, t.created_at)
        from public.ops_tasks t
       where t.created_by = v_uid and t.user_id <> v_uid and t.branch_name = v_branch and t.deleted_at is null
         and (t.status <> 'done' or t.done_at >= now() - interval '7 days')), '[]'::jsonb) else '[]'::jsonb end,
    -- (3-4) 맡길 수 있는 사람 — 그 지점 팀(나 빼고 · 지점 관리자만)
    'team', case when v_all then coalesce((
      select jsonb_agg(jsonb_build_object('user_id', tm.user_id, 'name', public._ops_task_name(tm.user_id, v_branch))
             order by public._ops_task_name(tm.user_id, v_branch))
        from public._ops_plan_team(v_branch) tm
       where tm.user_id <> v_uid), '[]'::jsonb) else '[]'::jsonb end
  );
end $$;


-- ③ 아침 8시 브리핑 — 할 일 · 고정 업무 (그 밖은 3-3 그대로)
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
  ), todos as (
    -- (3-4) 오늘까지 마감인 안 끝낸 할 일
    select t.user_id, count(*)::int as n
      from public.ops_tasks t
     where t.deleted_at is null and t.status <> 'done' and t.due_on is not null and t.due_on <= v_today
     group by t.user_id
  ), duties as (
    -- (3-4) 그날 그 시각 근무자의 고정 업무(오픈 · 마감)
    select d.user_id, count(*)::int as n, min(p.duty_time) as first_at
      from public.ops_task_presets p
     cross join lateral public._ops_duty_people(p.id, v_today) d
     where p.kind = 'duty' and p.active
     group by d.user_id
  ), people as (
    select user_id from plans union select user_id from meet_staff
    union select user_id from todos union select user_id from duties
  ), rows as (
    select u.user_id,
           (select count(*) from plans x where x.user_id = u.user_id and x.kind = 'class')::int as c_class,
           (select count(*) from plans x where x.user_id = u.user_id and x.kind = 'pt')::int as c_pt,
           (select count(*) from plans x where x.user_id = u.user_id and x.kind = 'work')::int as c_work,
           (select count(*) from plans x where x.user_id = u.user_id and x.kind = 'out')::int as c_out,
           (select min(x.start_time) from plans x where x.user_id = u.user_id and not x.all_day) as first_at,
           coalesce((select ms.n from meet_staff ms where ms.user_id = u.user_id), 0) as c_meet,
           coalesce((select t.n from todos t where t.user_id = u.user_id), 0) as c_todo,
           coalesce((select du.n from duties du where du.user_id = u.user_id), 0) as c_duty,
           (select du.first_at from duties du where du.user_id = u.user_id) as duty_at
      from people u
     where coalesce((select pp.brief_on from public.ops_plan_prefs pp where pp.user_id = u.user_id), true)
       and exists (select 1 from public._ops_plan_branches(u.user_id))
  ), ins as (
    insert into public.ops_plan_notices (kind, user_id, plan_id, occ_date, minutes)
    select 'brief', r.user_id, null, v_today, null from rows r
     where r.c_class + r.c_pt + r.c_work + r.c_out + r.c_meet + r.c_todo + r.c_duty > 0
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
           case when r.c_todo > 0 then '할 일 ' || r.c_todo end,
           case when r.c_duty > 0 then '고정 업무 ' || r.c_duty end,
           case when coalesce(r.first_at, r.duty_at) is not null then '첫 일정 ' || to_char(least(r.first_at, r.duty_at), 'HH24:MI') end),
         case when r.c_class + r.c_pt + r.c_work + r.c_out + r.c_meet = 0 then '/office?tab=plan&todo=1'
              else '/office?tab=plan&d=' || to_char(v_today, 'YYYY-MM-DD') end
    from rows r join ins on ins.user_id = r.user_id;
  get diagnostics v_n = row_count;
  return jsonb_build_object('sent', v_n);
end
$$;


-- ═══════════════════════════ 실행 권한 ═══════════════════════════
-- 덧댄 함수(_my_check_items · get_my_calendar · set_my_check_item · _cal_check_count · _ops_task_notify · ops_tasks_day ·
-- ops_plan_brief_tick)는 create or replace 라 권한이 그대로다. 새 함수만 맞춘다(Supabase 기본 권한으로 anon 이 부를 수 있는 틈을 안 남기게).
revoke all on function public._my_todos(uuid) from public, anon, authenticated;
revoke all on function public.set_my_check_goal(uuid, integer) from public, anon;
revoke all on function public.set_my_todo(uuid, text, date) from public, anon;
revoke all on function public.set_my_todo_done(uuid, boolean) from public, anon;
revoke all on function public.remove_my_todo(uuid) from public, anon;
revoke all on function public.get_my_habits() from public, anon;
grant execute on function public.set_my_check_goal(uuid, integer) to authenticated;
grant execute on function public.set_my_todo(uuid, text, date) to authenticated;
grant execute on function public.set_my_todo_done(uuid, boolean) to authenticated;
grant execute on function public.remove_my_todo(uuid) to authenticated;
grant execute on function public.get_my_habits() to authenticated;
