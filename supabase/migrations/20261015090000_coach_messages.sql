-- 🥊 오삼코치 메시지 기반 (2026-10-15 대표님: "일곱가지 니가 제안하는대로 시작해보자")
--
-- 설계 문서 "마이복서153 AI 코치 설계 · API 크레딧 운용 계획" 1부 — 데이터와 시스템 구조.
--   밤 02:00   coach-build (엣지 함수): coach_targets() 로 대상과 사실(facts)을 받아 coach_messages 에 기본 문구로 넣고 Haiku 5.5 배치를 보낸다.
--   15분마다   coach-collect (엣지 함수, 진행 중인 배치가 있을 때만): 결과를 검사해 통과한 AI 문구로 바꾼다. 실패·탈락은 기본 문구 그대로.
--   5분마다    coach_dispatch() (SQL): 승인된 아침 메시지(오늘의 목표·복귀 응원)를 보낼 시각에 알림함으로 → 기존 푸시 트리거가 휴대폰으로.
--   출석 순간  attendance_base_xp_trg: 그날 승인된 '출석 칭찬'이 있으면 기존 출석 알림 본문을 그 문장으로 바꿔 보낸다 (알림은 한 번만).
--
-- 안전장치
--   · coach_config.enabled = false 면 아무것도 만들지도 보내지도 않는다.
--   · review_required = true (파일럿 + 2주): 코치·대표님이 승인한 메시지만 나간다.
--   · audience = 'pilot': coach_pilot 명단만 (선릉 직원·코치 7명 + 자원 회원 20명). 'branches': 시범 지점(pilot_branch_names) 회원 전체.
--   · AI 에 보내는 것: 직접 고른 닉네임(실명·전화번호와 같으면 안 보냄), 리그·레벨, 출석 숫자, 상태, 고른 동작과 코치 포인트.
--     실명·전화·생일·결제·건강 메모·통증 부위는 보내지 않는다 (컨디션은 'low_condition' 상태 하나로만).
--   · 아침 메시지는 하루 한 사람 한 개 — 복귀 응원 날에는 오늘의 목표를 보내지 않는다.
--   · 오늘의 목표는 마지막 출석이 daily_goal_max_absent_days(기본 7일) 안인 회원만 — 오래 쉰 회원은 7·14·30일째 복귀 응원만 받는다.
--   · 숫자는 get_level_cycle_progress(내 카드)와 같은 식으로 계산한다 (그 RPC 는 로그인 사용자만 불러 여기서 같은 식을 쓴다).

-- ───────────── 설정 (한 줄) ─────────────
create table if not exists public.coach_config (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  audience text not null default 'pilot' check (audience in ('pilot', 'branches')),
  review_required boolean not null default true,
  morning_hour smallint not null default 8 check (morning_hour between 5 and 11),
  daily_goal_max_absent_days smallint not null default 7 check (daily_goal_max_absent_days between 1 and 30),
  updated_at timestamptz not null default now()
);
insert into public.coach_config (id) values (true) on conflict (id) do nothing;

-- ───────────── 파일럿 명단 ─────────────
create table if not exists public.coach_pilot (
  user_id uuid primary key,
  note text,
  added_at timestamptz not null default now()
);

-- ───────────── 배치 기록 ─────────────
create table if not exists public.coach_batches (
  id text primary key,                         -- msgbatch_…
  for_date date not null,
  model text not null,
  request_count integer not null default 0,
  status text not null default 'in_progress' check (status in ('in_progress', 'ended', 'failed', 'abandoned')),
  counts jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  checked_at timestamptz,
  collected_at timestamptz
);

-- ───────────── 메시지 ─────────────
create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  branch_name text,
  kind text not null check (kind in ('daily_goal', 'attendance_praise', 'comeback', 'weekly_review', 'coach_briefing')),
  for_date date not null,                      -- KST 날짜
  send_at timestamptz,                         -- null = 조건부 (출석 칭찬: 출석하면)
  status text not null default 'generating'
    check (status in ('generating', 'ready', 'approved', 'sent', 'skipped', 'expired')),
  title text not null,
  body text not null,
  detail text not null,
  source text not null default 'fallback' check (source in ('ai', 'fallback', 'edited')),
  fallback jsonb not null,                     -- 기본 문구 {title, body, detail} — 검수 화면에서 비교
  facts jsonb not null default '{}'::jsonb,    -- AI 에 보낸 사실 (숫자 검사·검수용)
  check_reason text,                           -- AI 문구를 버린 이유 (number_30, banned_sales …)
  batch_id text,
  model text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  notification_id uuid,
  sent_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind, for_date)
);
create index if not exists coach_messages_approved_idx on public.coach_messages (send_at) where status = 'approved';
create index if not exists coach_messages_date_idx on public.coach_messages (for_date, branch_name);
create index if not exists coach_messages_batch_idx on public.coach_messages (batch_id) where batch_id is not null;
create index if not exists coach_messages_user_idx on public.coach_messages (user_id, for_date desc);

-- RLS — 쓰기는 함수·서비스 롤만. 읽기: 회원은 자기에게 '보낸' 메시지만, 관리자는 전부.
alter table public.coach_config enable row level security;
alter table public.coach_pilot enable row level security;
alter table public.coach_batches enable row level security;
alter table public.coach_messages enable row level security;
revoke all on public.coach_config, public.coach_pilot, public.coach_batches, public.coach_messages from anon;

create policy coach_config_admin_read on public.coach_config for select to authenticated
  using (public.has_role((select auth.uid()), 'super_admin') or public.has_role((select auth.uid()), 'admin'));
create policy coach_pilot_admin_read on public.coach_pilot for select to authenticated
  using (public.has_role((select auth.uid()), 'super_admin') or public.has_role((select auth.uid()), 'admin'));
create policy coach_batches_admin_read on public.coach_batches for select to authenticated
  using (public.has_role((select auth.uid()), 'super_admin') or public.has_role((select auth.uid()), 'admin'));
create policy coach_messages_own_sent_read on public.coach_messages for select to authenticated
  using (user_id = (select auth.uid()) and status = 'sent');
create policy coach_messages_admin_read on public.coach_messages for select to authenticated
  using (public.has_role((select auth.uid()), 'super_admin') or public.has_role((select auth.uid()), 'admin'));

-- ───────────── 대상과 사실 ─────────────
-- 한 사람에게 아침 메시지 하나(daily_goal 또는 comeback) + 출석 칭찬 하나(attendance_praise, 출석하면 나감).
create or replace function public.coach_targets(_for_date date)
returns table (user_id uuid, branch_name text, kind text, send_at timestamptz, facts jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c public.coach_config%rowtype;
  _day0 timestamptz := (_for_date::timestamp at time zone 'Asia/Seoul');   -- 그날 0시 (KST)
  _morning timestamptz;
begin
  select * into c from public.coach_config where id;
  if not found or not c.enabled then return; end if;
  _morning := ((_for_date + make_time(c.morning_hour, 0, 0)) at time zone 'Asia/Seoul');

  return query
  with pop as (
    select p.user_id as uid, p.branch_name as branch, p.membership_end, p.fitness_goal, p.is_staff,
           (cp.user_id is not null) as in_pilot,
           -- 직접 고른 닉네임만 (자동 계정은 닉네임 = 실명 또는 전화번호)
           case when btrim(p.nickname) <> '' and btrim(p.nickname) <> btrim(p.name)
                     and btrim(p.nickname) !~ '^[0-9 +-]+$'
                then left(btrim(p.nickname), 20) end as nick
      from public.profiles p
      left join public.coach_pilot cp on cp.user_id = p.user_id
     where cp.user_id is not null
        or (c.audience = 'branches'
            and p.branch_name = any (public.pilot_branch_names())
            and not p.is_staff
            and not p.is_test_account
            and not exists (select 1 from public.user_roles r
                             where r.user_id = p.user_id
                               and r.role in ('super_admin', 'admin', 'branch_manager', 'coach')))
  ),
  att as (
    select a.user_id as uid,
           min((a.checked_in_at at time zone 'Asia/Seoul')::date) as first_day,
           max((a.checked_in_at at time zone 'Asia/Seoul')::date) as last_day,
           count(*) filter (where a.checked_in_at >= _day0 - interval '7 days') as d7,
           count(*) filter (where a.checked_in_at >= _day0 - interval '14 days'
                              and a.checked_in_at <  _day0 - interval '7 days') as p7,
           count(*) filter (where a.checked_in_at >= _day0 - interval '30 days') as d30
      from public.attendance_logs a
     where a.user_id in (select pop.uid from pop)
       and coalesce(a.is_duplicate, false) = false
       and a.checked_in_at < _day0
     group by a.user_id
  ),
  -- 내 카드(get_level_cycle_progress)와 같은 식: 레벨 시작 뒤 출석 × 운동시간 가중(1.0~1.25)
  prog as (
    select mp.user_id as uid, mp.current_rank as rnk, mp.current_level as lvl,
           coalesce(mp.overall_level, mp.current_level) as glevel,
           public.level_visit_requirement(mp.current_rank) as req,
           public.level_auto_advances(mp.current_rank) as auto_adv,
           coalesce((select sum(public.workout_progress(public.workout_minutes(a.checked_in_at, a.ended_at)))
                       from public.attendance_logs a
                      where a.user_id = mp.user_id
                        and coalesce(a.is_duplicate, false) = false
                        and a.checked_in_at >= coalesce(mp.level_started_at, now() - interval '3650 days')), 0) as progress
      from public.member_progress mp
     where mp.user_id in (select pop.uid from pop)
  ),
  -- 전날(KST) 컨디션 기록에 통증·피곤함·낮은 에너지 (부위·메모는 쓰지 않는다)
  cond as (
    select distinct on (b.user_id) b.user_id as uid,
           (b.condition_type in ('pain', 'tired') or coalesce(b.energy_level, 5) <= 2) as low
      from public.boxing_condition_logs b
     where b.user_id in (select pop.uid from pop)
       and b.selected_at >= _day0 - interval '1 day' and b.selected_at < _day0
     order by b.user_id, b.selected_at desc
  ),
  -- 홀딩·연기 중(또는 신청 중)이면 복귀 응원을 보내지 않는다
  hold as (
    select distinct r.user_id as uid
      from public.membership_requests r
     where r.user_id in (select pop.uid from pop)
       and r.type in ('hold', 'postpone')
       and (r.status = 'pending'
            or (r.status = 'approved'
                and coalesce(r.processed_at, r.created_at) >= _day0 - make_interval(days => coalesce(r.hold_days, 0) + 7)))
  ),
  -- 최근 3일 오늘의 목표 (같은 말·같은 동작 반복 방지)
  recent as (
    select m.user_id as uid,
           jsonb_agg(m.body order by m.for_date desc) as bodies,
           array_agg(m.facts #>> '{drill,name}') filter (where m.facts #>> '{drill,name}' is not null) as drills
      from public.coach_messages m
     where m.user_id in (select pop.uid from pop)
       and m.kind = 'daily_goal' and m.for_date >= _for_date - 3 and m.for_date < _for_date
     group by m.user_id
  ),
  base as (
    select pop.*, att.first_day, att.last_day,
           coalesce(att.d7, 0)::int as d7, coalesce(att.p7, 0)::int as p7, coalesce(att.d30, 0)::int as d30,
           (_for_date - att.last_day) as absent_days,
           prog.uid is not null as has_prog, prog.rnk, prog.lvl, prog.glevel, prog.req, prog.auto_adv,
           case when prog.uid is not null
                then greatest(0, ceil(prog.req - least(prog.progress, prog.req::numeric)))::int end as remaining,
           case when prog.uid is not null
                then greatest(0, ceil(prog.req - least(prog.progress + 1, prog.req::numeric)))::int end as remaining_after,
           coalesce(cond.low, false) as low_cond,
           hold.uid is not null as on_hold,
           coalesce(recent.bodies, '[]'::jsonb) as bodies,
           coalesce(recent.drills, '{}'::text[]) as drills
      from pop
      left join att    on att.uid = pop.uid
      left join prog   on prog.uid = pop.uid
      left join cond   on cond.uid = pop.uid
      left join hold   on hold.uid = pop.uid
      left join recent on recent.uid = pop.uid
  ),
  st as (
    select b.*,
           case
             when b.low_cond then 'low_condition'
             when b.has_prog and b.lvl = 10 and b.rnk::text <> 'black' then 'title_match'
             when b.has_prog and b.auto_adv and b.lvl < 10 and b.remaining between 1 and 2 then 'near_levelup'
             when b.first_day is null or b.first_day >= _for_date - 14 then 'new'
             when b.d7 < b.p7 then 'slump'
             else 'steady'
           end as state,
           case
             when b.absent_days in (7, 14, 30)
                  and b.membership_end is not null and b.membership_end >= _for_date
                  and not b.on_hold then 'comeback'
             when b.in_pilot then 'daily_goal'
             when b.absent_days is not null and b.absent_days <= c.daily_goal_max_absent_days then 'daily_goal'
           end as morning_kind,
           case b.rnk::text when 'white' then '화이트' when 'blue' then '블루'
                            when 'red' then '레드' when 'black' then '블랙' end as league_kr,
           case
             when b.fitness_goal ~ '선수|대회|시합|프로' then '선수 준비'
             when b.fitness_goal ~ '체력' then '체력'
             when b.fitness_goal ~ '스트레스' then '스트레스 해소'
             when b.fitness_goal ~ '취미|재미|즐' then '취미'
             when b.fitness_goal ~ '자세|기술|기본' then '복싱 기술'
           end as goal_cat       -- 다이어트·체중 목표는 보내지 않는다 (먼저 꺼내지 않는 규칙)
      from base b
  ),
  -- 오늘의 목표 동작: 레벨 이하 동작 중 레벨에 가장 가까운 6개에서 날마다 돌려 고른다 (최근 3일 동작 제외)
  pick as (
    select s.uid, d.name as drill_name, d.point as drill_point
      from st s
      left join lateral (
        select t.name,
               t.cues ->> ((abs(hashtext(s.uid::text || _for_date::text || 'cue')::bigint)
                            % greatest(jsonb_array_length(t.cues), 1))::int) as point
          from (
            select x.name, x.cues,
                   row_number() over (order by x.level_min desc, x.sort_order, x.name) as rn,
                   count(*) over () as n
              from (
                select e.name, e.cues, e.level_min, e.sort_order
                  from public.training_exercises e
                 where e.is_active
                   and e.level_min is not null
                   and e.level_min <= greatest(1, coalesce(s.glevel, 1))
                   and e.category not in ('워밍업', '줄넘기', '쿨다운', '컨디셔닝', '회복', '준비', '코칭')
                   and jsonb_typeof(e.cues) = 'array' and jsonb_array_length(e.cues) > 0
                   and not (e.name = any (s.drills))
                 order by e.level_min desc, e.sort_order, e.name
                 limit 6
              ) x
          ) t
         where t.rn = 1 + (abs(hashtext(s.uid::text || _for_date::text)::bigint) % t.n)
      ) d on true
     where s.morning_kind = 'daily_goal'
  ),
  fx as (
    select s.*, pk.drill_name, pk.drill_point,
           jsonb_build_object(
             'nickname', s.nick,
             'branch', s.branch,
             'league', s.league_kr,
             'level', s.glevel,
             'level_label', case when s.has_prog then s.league_kr || ' L' || s.lvl end,
             'state', s.state,
             'attend_7d', s.d7,
             'attend_prev_7d', s.p7,
             'attend_30d', s.d30,
             'absent_days', s.absent_days,
             'remaining', s.remaining,
             'remaining_after_today', s.remaining_after,
             'goal', s.goal_cat
           ) as common
      from st s
      left join pick pk on pk.uid = s.uid
     where s.morning_kind is not null
  )
  -- 아침 메시지
  select f.uid, f.branch, f.morning_kind, _morning,
         f.common || jsonb_build_object(
           'kind', f.morning_kind,
           'drill', case when f.morning_kind = 'daily_goal' and f.drill_name is not null
                         then jsonb_build_object('name', f.drill_name, 'point', f.drill_point) end,
           'recent', case when f.morning_kind = 'daily_goal' then f.bodies else '[]'::jsonb end)
    from fx f
  union all
  -- 출석 칭찬 (출석 알림을 받는 회원만: 직원 아님 + 진행도 있음)
  select f.uid, f.branch, 'attendance_praise', null::timestamptz,
         f.common || jsonb_build_object('kind', 'attendance_praise', 'drill', null, 'recent', '[]'::jsonb)
    from fx f
   where not f.is_staff and f.has_prog;
end;
$$;

-- ───────────── 배치 결과 반영 (coach-collect 가 한 번에) ─────────────
-- _rows: [{id, title?, body?, detail?, source?, status, check_reason?}] — 아직 generating 인 것만 바꾼다
create or replace function public.coach_apply_results(_rows jsonb)
returns integer
language sql
security definer
set search_path = public
as $$
  with r as (
    select (x ->> 'id')::uuid as id,
           nullif(x ->> 'title', '') as title, nullif(x ->> 'body', '') as body, nullif(x ->> 'detail', '') as detail,
           nullif(x ->> 'source', '') as source, x ->> 'status' as status, nullif(x ->> 'check_reason', '') as reason,
           nullif(x ->> 'model', '') as model
      from jsonb_array_elements(coalesce(_rows, '[]'::jsonb)) x
  ), u as (
    update public.coach_messages m
       set title = coalesce(r.title, m.title),
           body = coalesce(r.body, m.body),
           detail = coalesce(r.detail, m.detail),
           source = coalesce(r.source, m.source),
           model = coalesce(r.model, m.model),
           status = r.status,
           check_reason = r.reason,
           updated_at = now()
      from r
     where m.id = r.id and m.status = 'generating'
    returning 1
  )
  select count(*)::int from u;
$$;

-- ───────────── 보내기 (5분마다) ─────────────
-- 승인된 아침 메시지를 보낼 시각에 알림함으로 (21시 전까지만). 22시가 지나면 그날 못 보낸 것은 expired.
create or replace function public.coach_dispatch()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _now timestamptz := now();
  _today date := (now() at time zone 'Asia/Seoul')::date;
  _morning_cut timestamptz := ((_today + time '21:00') at time zone 'Asia/Seoul');
  _day_cut timestamptz := ((_today + time '22:00') at time zone 'Asia/Seoul');
  _sent int := 0;
  _expired int := 0;
begin
  if not exists (select 1 from public.coach_config where id and enabled) then
    return jsonb_build_object('skipped', 'disabled');
  end if;

  with due as (
    select m.id as mid, gen_random_uuid() as nid, m.user_id, m.title, m.body
      from public.coach_messages m
     where m.status = 'approved'
       and m.kind in ('daily_goal', 'comeback')
       and m.for_date = _today
       and m.send_at <= _now
       and _now < _morning_cut
     order by m.send_at, m.id
     limit 1000
     for update of m skip locked
  ), ins as (
    insert into public.notifications (id, user_id, title, body, link)
    select d.nid, d.user_id, d.title, d.body, '/character-studio?coach=' || d.mid
      from due d
    returning id
  ), upd as (
    update public.coach_messages m
       set status = 'sent', sent_at = _now, notification_id = d.nid, updated_at = _now
      from due d
     where m.id = d.mid
       and d.nid in (select ins.id from ins)
    returning 1
  )
  select count(*) into _sent from upd;

  update public.coach_messages
     set status = 'expired', updated_at = _now
   where status in ('generating', 'ready', 'approved')
     and (for_date < _today or (for_date = _today and _now >= _day_cut));
  get diagnostics _expired = row_count;

  return jsonb_build_object('sent', _sent, 'expired', _expired);
end;
$$;

revoke all on function public.coach_targets(date) from public, anon, authenticated;
revoke all on function public.coach_apply_results(jsonb) from public, anon, authenticated;
revoke all on function public.coach_dispatch() from public, anon, authenticated;
grant execute on function public.coach_targets(date) to service_role;
grant execute on function public.coach_apply_results(jsonb) to service_role;
grant execute on function public.coach_dispatch() to service_role;

-- ───────────── 출석 칭찬: 출석 알림 한 번에 ─────────────
-- 기존 attendance_base_xp_trg 와 같고, 출석 알림 부분만 바뀐다:
--   그날 승인된 오삼코치 칭찬이 있으면 → 같은 제목 + 칭찬 문장 본문 + 내 카드 링크로 한 번 보낸다.
--   없거나 어떤 오류가 나도 → 원래 알림 그대로 (출석 기록·보상은 영향 없음).
create or replace function public.attendance_base_xp_trg()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  _base  int;
  _staff boolean;
  _rank  text;
  _level int;
  _rank_kr text;
  _coach_id uuid;
  _coach_body text;
  _nid uuid;
  _coach_done boolean := false;
begin
  if new.user_id is null then return null; end if;
  if new.checked_in_at is null or new.checked_in_at < now() - interval '3 days' then return null; end if;
  -- 중복 출석(짧은 간격 재태깅)은 보상 대상이 아니다
  if coalesce(new.is_duplicate, false) then return null; end if;

  select coalesce(is_staff, false) into _staff from public.profiles where user_id = new.user_id;
  if coalesce(_staff, false) then return null; end if;
  if not exists (select 1 from public.member_progress where user_id = new.user_id) then return null; end if;

  -- 챔피언 머니 +100: KST 기준 하루 1회 (XP 와 별개로 지급) + 출석 알림(웹푸시)
  if not exists (
    select 1 from public.wallet_transactions
     where user_id = new.user_id
       and reason = '체육관 출석 보상'
       and (created_at at time zone 'Asia/Seoul')::date
           = (new.checked_in_at at time zone 'Asia/Seoul')::date
  ) then
    perform public.grant_gems(new.user_id, 100, '체육관 출석 보상');

    -- 🥊 오삼코치 출석 칭찬 (2026-10-15)
    begin
      select m.id, m.body into _coach_id, _coach_body
        from public.coach_messages m
       where m.user_id = new.user_id
         and m.kind = 'attendance_praise'
         and m.for_date = (new.checked_in_at at time zone 'Asia/Seoul')::date
         and m.status = 'approved'
       limit 1
       for update skip locked;
      if _coach_id is not null then
        _nid := gen_random_uuid();
        insert into public.notifications (id, user_id, title, body, link)
        values (_nid, new.user_id, '오늘 출석 완료! 🥊 챔피언 머니 +100', _coach_body,
                '/character-studio?coach=' || _coach_id);
        update public.coach_messages
           set status = 'sent', sent_at = now(), notification_id = _nid, updated_at = now()
         where id = _coach_id;
        _coach_done := true;
      end if;
    exception when others then
      _coach_done := false;
    end;

    if not _coach_done then
      select mp.current_rank::text, mp.current_level into _rank, _level
        from public.member_progress mp where mp.user_id = new.user_id;
      _rank_kr := case _rank when 'white' then '화이트' when 'blue' then '블루'
                             when 'red' then '레드' when 'black' then '블랙' else coalesce(_rank,'') end;
      perform public.create_notification(
        new.user_id,
        '오늘 출석 완료! 🥊 챔피언 머니 +100',
        '현재 ' || _rank_kr || ' 리그 Lv.' || coalesce(_level, 1) ||
        ' — 홈에서 내 카드와 이번 주 순위를 확인하세요');
    end if;
  end if;

  -- 기본 운동 XP (기존 로직 그대로: 행당 1회, xp_granted 가드)
  if coalesce(new.xp_granted, 0) > 0 then return null; end if;

  _base := public.workout_xp(public.workout_default_minutes());
  if _base <= 0 then return null; end if;

  insert into public.xp_logs (user_id, amount, reason)
  values (new.user_id, _base, '운동 출석 (기본 ' || public.workout_default_minutes() || '분)');
  update public.member_progress set total_xp = total_xp + _base where user_id = new.user_id;
  update public.attendance_logs set xp_granted = _base where id = new.id;
  return null;
end;
$function$;

-- ───────────── 예약 작업 ─────────────
-- 02:00 KST(= 17:00 UTC) 만들기 · 15분마다 거두기(진행 중인 배치가 있을 때만) · 5분마다 보내기
-- (같은 이름으로 cron.schedule 을 다시 부르면 그 작업이 바뀐다)
select cron.schedule('coach-build', '0 17 * * *', $$
  select net.http_post(
    url := 'https://whnczhxyjmyywhlfbgsd.supabase.co/functions/v1/coach-build',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-auto-key', (select value from public.internal_sync_config where key = 'auto_sync_key')),
    body := jsonb_build_object('source', 'cron'),
    timeout_milliseconds := 120000)
  where exists (select 1 from public.coach_config where id and enabled);
$$);

select cron.schedule('coach-collect', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://whnczhxyjmyywhlfbgsd.supabase.co/functions/v1/coach-collect',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-auto-key', (select value from public.internal_sync_config where key = 'auto_sync_key')),
    body := jsonb_build_object('source', 'cron'),
    timeout_milliseconds := 120000)
  where exists (select 1 from public.coach_batches where status = 'in_progress')
     or exists (select 1 from public.coach_messages where status = 'generating');
$$);

select cron.schedule('coach-dispatch', '*/5 * * * *', $$ select public.coach_dispatch(); $$);

comment on table public.coach_messages is '오삼코치가 먼저 보내는 메시지 — 밤 배치 초안 → 검사 → (검수) → 알림함. 쓰기는 함수·서비스 롤만.';
comment on table public.coach_config is '오삼코치 메시지 설정 한 줄 — enabled·audience(pilot|branches)·review_required·아침 시각.';
comment on table public.coach_pilot is '오삼코치 파일럿 명단 — 선릉 직원·코치 7명 + 자원 회원 20명 (2026-10-22~).';
