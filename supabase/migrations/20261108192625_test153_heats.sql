-- 153 PB 히트(최대 4명) — 라이브보드 2단계 (2026-11-08 대표님 「2단계넘어가자」 · 보고서 「153 PB 라이브보드 설계」 2단계)
--   코치 측정 화면이 1~4명을 한 번에 시작하고(히트), 사람마다 '다음 구간'을 누른다. 완주하면 측정 화면이
--   save_test153_record 로 공식 기록(구간 16개)을 저장하고, 여기에 그 기록을 잇는다.
--   TV 는 공개 채널(test153-live:<지점 이름>)로 시각만 받고(이름 없음), 닉네임 · 지난번 기록(고스트)은
--   board_test153_live 로만 읽는다 — TV 열쇠 _board_branch_ok (라이브보드 회원 정보 잠그기 규칙 그대로).
--   새 표 2 · 새 함수 3 — 기존 표 · 함수 · 트리거는 그대로(미리보기 단계 규칙).
--
--   test153_heats        히트 한 번. id 는 측정 기기가 만든 uuid — 인터넷이 잠깐 끊겨도 시작하고 나중에 같은 id 로 맞춘다.
--   test153_heat_lanes   참가자 한 명(레인 1~4) — 구간을 끝낸 시각(시작부터 누적 ms) · 멈춘 시각 · 상태 · 저장한 공식 기록.
--   test153_heat_save(p_heat jsonb)       측정 기기 → 서버(바뀔 때마다 통째로). 돌려줌: 레인마다 지난번의 나(고스트) · 첫 도전인지.
--   board_test153_live(p_branch, p_key)   TV: 이 지점에서 지금 달리는 히트의 닉네임 · 리그 · 고스트.
--   _test153_ghost(user, division, before) 그 시각 전 같은 부문 공식 최고 기록(완주면 구간 누적 시각 16개).

create table if not exists public.test153_heats (
  id          uuid primary key,
  branch_name text not null,
  created_by  uuid not null,
  start_at    timestamptz not null,
  status      text not null default 'running' check (status in ('running', 'done', 'void')),
  ended_at    timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists test153_heats_branch_idx on public.test153_heats (branch_name, start_at desc);

create table if not exists public.test153_heat_lanes (
  heat_id    uuid not null references public.test153_heats (id),
  lane       smallint not null check (lane between 1 and 4),
  user_id    uuid not null,
  division   text not null check (division in ('starter', 'open')),
  gender     text check (gender in ('남', '여')),
  marks_ms   integer[] not null default '{}',
  stopped_ms integer,
  state      text not null default 'running'
             check (state in ('running', 'finished', 'capped', 'stopped', 'saved', 'dropped')),
  record_id  uuid references public.test153_records (id),
  score_ms   integer,
  is_pb      boolean,
  prev_pb_ms integer,
  updated_at timestamptz not null default now(),
  primary key (heat_id, lane)
);
create index if not exists test153_heat_lanes_user_idx on public.test153_heat_lanes (user_id);

-- 직접 읽기 · 쓰기 없음 — 함수로만
alter table public.test153_heats enable row level security;
alter table public.test153_heat_lanes enable row level security;
revoke all on table public.test153_heats from anon, authenticated;
revoke all on table public.test153_heat_lanes from anon, authenticated;

-- 지난번의 나 — p_before 전에 잰 같은 부문 공식 최고 기록 (없으면 null)
create or replace function public._test153_ghost(p_user uuid, p_division text, p_before timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  r     record;
  v_cum jsonb;
begin
  select t.score_ms, t.finished, t.remaining_reps, t.splits_ms, t.measured_at
    into r
    from public.test153_records t
   where t.user_id = p_user and t.division = p_division and t.official and t.measured_at < p_before
   order by t.score_ms asc, t.measured_at asc
   limit 1;
  if not found then
    return null;
  end if;
  -- 구간이 16개 다 있는 완주 기록만 구간 누적 시각을 준다 (총 시간만 넣은 기록은 cum 없음)
  if r.finished and coalesce(array_length(r.splits_ms, 1), 0) = 16 then
    select jsonb_agg(q.c order by q.i) into v_cum
      from (select u.i, sum(u.x) over (order by u.i) as c
              from unnest(r.splits_ms) with ordinality as u(x, i)) q;
  end if;
  return jsonb_build_object('ms', r.score_ms, 'finished', r.finished, 'remaining', r.remaining_reps,
                            'cum', v_cum, 'at', r.measured_at);
end $function$;

-- 측정 기기 → 서버. p_heat = {id, branch, start_ms, status, lanes:[{lane, user_id, division, gender, marks, stopped_ms, state, record_id}]}
--   marks = 시작부터 구간을 끝낸 시각(누적 ms, 16개까지) · 레인 검사를 다 통과해야 쓴다 · 빠진 레인은 dropped.
--   공식 기록은 save_test153_record 가 따로 저장한다 — 여기서는 그 기록 id 를 잇고 점수 · 개인 최고 여부를 기록에서 읽는다.
create or replace function public.test153_heat_save(p_heat jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid     uuid := auth.uid();
  v_id      uuid;
  v_start   timestamptz;
  v_status  text := coalesce(nullif(p_heat ->> 'status', ''), 'running');
  v_branch  text;
  v_owner   uuid;
  v_admin   boolean;
  v_lanes   jsonb := p_heat -> 'lanes';
  v_l       jsonb;
  v_n       int;
  v_user    uuid;
  v_div     text;
  v_gender  text;
  v_marks   int[];
  v_stopped int;
  v_state   text;
  v_rec     uuid;
  v_score   int;
  v_at      timestamptz;
  v_prev    int;
  v_seen    int[] := '{}';
  v_i       int;
  v_out     jsonb;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  begin
    v_id := (p_heat ->> 'id')::uuid;
    v_start := to_timestamp(((p_heat ->> 'start_ms')::bigint)::double precision / 1000.0);
  exception when others then
    raise exception '측정 정보가 잘못됐어요';
  end;
  if v_id is null or v_start is null then
    raise exception '측정 정보가 잘못됐어요';
  end if;
  if v_start < now() - interval '1 day' or v_start > now() + interval '10 minutes' then
    raise exception '시작 시각이 잘못됐어요';
  end if;
  if v_status not in ('running', 'done', 'void') then
    raise exception '측정 상태가 잘못됐어요';
  end if;
  if jsonb_typeof(v_lanes) is distinct from 'array' or jsonb_array_length(v_lanes) not between 1 and 4 then
    raise exception '참가자는 1~4명이에요';
  end if;

  select b.name into v_branch
    from public.branches b
   where b.name = p_heat ->> 'branch' or (b.code is not null and b.code = p_heat ->> 'branch')
   limit 1;
  if v_branch is null then
    raise exception '지점을 찾을 수 없어요';
  end if;

  v_admin := public.has_role(v_uid, 'super_admin') or public.has_role(v_uid, 'admin');
  select h.created_by, h.start_at into v_owner, v_at from public.test153_heats h where h.id = v_id;
  if found then
    if v_owner <> v_uid and not v_admin then
      raise exception '다른 코치님이 시작한 측정이에요' using errcode = '42501';
    end if;
    v_start := v_at; -- 시작 시각 · 지점은 처음 저장한 값 그대로
  end if;

  -- 1) 레인 검사 — 하나라도 틀리면 아무것도 쓰지 않는다
  for v_l in select x from jsonb_array_elements(v_lanes) as e(x) loop
    begin
      v_n := (v_l ->> 'lane')::int;
      v_user := (v_l ->> 'user_id')::uuid;
    exception when others then
      raise exception '참가자 정보가 잘못됐어요';
    end;
    if v_n is null or v_n not between 1 and 4 or v_n = any (v_seen) then
      raise exception '레인 번호가 잘못됐어요';
    end if;
    v_seen := v_seen || v_n;
    if v_user is null or not public.can_measure_test153(v_user) then
      raise exception '측정 권한이 없어요 (같은 지점 코치·지점장만)' using errcode = '42501';
    end if;
    if coalesce(v_l ->> 'division', '') not in ('starter', 'open') then
      raise exception '부문이 잘못됐어요';
    end if;
    if nullif(v_l ->> 'gender', '') is not null and v_l ->> 'gender' not in ('남', '여') then
      raise exception '성별이 잘못됐어요';
    end if;
    if coalesce(v_l ->> 'state', 'running') not in ('running', 'finished', 'capped', 'stopped', 'saved', 'dropped') then
      raise exception '참가자 상태가 잘못됐어요';
    end if;
    if jsonb_typeof(coalesce(v_l -> 'marks', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(v_l -> 'marks', '[]'::jsonb)) > 16 then
      raise exception '구간 기록이 잘못됐어요';
    end if;
  end loop;

  -- 2) 히트
  insert into public.test153_heats (id, branch_name, created_by, start_at, status, ended_at)
  values (v_id, v_branch, v_uid, v_start, v_status, case when v_status = 'running' then null else now() end)
  on conflict (id) do update
     set status     = excluded.status,
         ended_at   = case when excluded.status = 'running' then null
                           else coalesce(public.test153_heats.ended_at, now()) end,
         updated_at = now();

  -- 3) 레인
  for v_l in select x from jsonb_array_elements(v_lanes) as e(x) loop
    v_n := (v_l ->> 'lane')::int;
    v_user := (v_l ->> 'user_id')::uuid;
    v_div := v_l ->> 'division';
    v_gender := nullif(v_l ->> 'gender', '');
    v_state := coalesce(nullif(v_l ->> 'state', ''), 'running');
    begin
      select coalesce(array_agg(m.e::int order by m.o), '{}') into v_marks
        from jsonb_array_elements_text(coalesce(v_l -> 'marks', '[]'::jsonb)) with ordinality as m(e, o);
      v_stopped := nullif(v_l ->> 'stopped_ms', '')::int;
      v_rec := nullif(v_l ->> 'record_id', '')::uuid;
    exception when others then
      raise exception '구간 기록이 잘못됐어요';
    end;
    -- 시각은 0 ~ 30분 · 늘 앞 구간보다 뒤
    for v_i in 1 .. coalesce(array_length(v_marks, 1), 0) loop
      if v_marks[v_i] is null or v_marks[v_i] < 0 or v_marks[v_i] > 1800000
         or (v_i > 1 and v_marks[v_i] < v_marks[v_i - 1]) then
        raise exception '구간 시각이 잘못됐어요';
      end if;
    end loop;
    if v_stopped is not null and (v_stopped < 0 or v_stopped > 1800000) then
      raise exception '멈춘 시각이 잘못됐어요';
    end if;

    -- 저장한 공식 기록 — 그 회원 · 그 부문 기록만 잇는다. 점수 · 개인 최고 여부는 기록에서
    v_score := null;
    v_prev := null;
    if v_rec is not null then
      select r.score_ms, r.measured_at into v_score, v_at
        from public.test153_records r
       where r.id = v_rec and r.user_id = v_user and r.division = v_div;
      if not found then
        raise exception '공식 기록을 찾을 수 없어요';
      end if;
      select min(r.score_ms) into v_prev
        from public.test153_records r
       where r.user_id = v_user and r.division = v_div and r.official and r.measured_at < v_at;
    end if;

    insert into public.test153_heat_lanes (heat_id, lane, user_id, division, gender, marks_ms, stopped_ms, state,
                                           record_id, score_ms, is_pb, prev_pb_ms, updated_at)
    values (v_id, v_n, v_user, v_div, v_gender, v_marks, v_stopped, v_state,
            v_rec, v_score, case when v_rec is null then null else (v_prev is null or v_score < v_prev) end, v_prev, now())
    on conflict (heat_id, lane) do update
       set user_id    = excluded.user_id,
           division   = excluded.division,
           gender     = excluded.gender,
           marks_ms   = excluded.marks_ms,
           stopped_ms = excluded.stopped_ms,
           state      = excluded.state,
           record_id  = excluded.record_id,
           score_ms   = excluded.score_ms,
           is_pb      = excluded.is_pb,
           prev_pb_ms = excluded.prev_pb_ms,
           updated_at = now();
  end loop;

  -- 기기에서 뺀 참가자
  update public.test153_heat_lanes l
     set state = 'dropped', updated_at = now()
   where l.heat_id = v_id and not (l.lane = any (v_seen)) and l.state <> 'dropped';

  select coalesce(jsonb_agg(jsonb_build_object(
           'lane', l.lane,
           'ghost', public._test153_ghost(l.user_id, l.division, v_start),
           'first', not exists (select 1 from public.test153_records r
                                 where r.user_id = l.user_id and r.division = l.division
                                   and r.official and r.measured_at < v_start)
         ) order by l.lane), '[]'::jsonb)
    into v_out
    from public.test153_heat_lanes l
   where l.heat_id = v_id and l.state <> 'dropped';

  return jsonb_build_object('id', v_id, 'branch', v_branch, 'status', v_status, 'lanes', v_out);
end $function$;

-- TV: 이 지점에서 지금 달리는 히트(시작 45분 안) — 닉네임만(없으면 '153 복서') · 실명 · 전화번호 · user_id 없음
create or replace function public.board_test153_live(p_branch text, p_key text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_name text := public._board_branch_ok(p_branch, p_key);
  v_out  jsonb;
begin
  if v_name is null then
    return null;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', h.id,
           'start_ms', floor(extract(epoch from h.start_at) * 1000)::bigint,
           'lanes', (
             select coalesce(jsonb_agg(jsonb_build_object(
                      'lane', l.lane,
                      'name', coalesce(nullif(btrim(p.nickname), ''), '153 복서'),
                      'league', mp.current_rank::text,
                      'level', mp.current_level,
                      'staff', case
                                 when coalesce(p.is_staff, false) then coalesce(nullif(btrim(p.staff_title), ''), '코치')
                                 when exists (select 1 from public.user_roles ur
                                               where ur.user_id = l.user_id and ur.role = 'coach') then '코치'
                                 when exists (select 1 from public.user_roles ur
                                               where ur.user_id = l.user_id
                                                 and ur.role in ('super_admin', 'admin', 'branch_manager')) then '운영진'
                               end,
                      'division', l.division,
                      'ghost', public._test153_ghost(l.user_id, l.division, h.start_at),
                      'first', not exists (select 1 from public.test153_records r
                                            where r.user_id = l.user_id and r.division = l.division
                                              and r.official and r.measured_at < h.start_at)
                    ) order by l.lane), '[]'::jsonb)
               from public.test153_heat_lanes l
               join public.profiles p on p.user_id = l.user_id
               left join public.member_progress mp on mp.user_id = l.user_id
              where l.heat_id = h.id and l.state <> 'dropped')
         ) order by h.start_at), '[]'::jsonb)
    into v_out
    from public.test153_heats h
   where h.branch_name = v_name and h.status = 'running' and h.start_at > now() - interval '45 minutes';
  return jsonb_build_object('branch', v_name, 'heats', v_out, 'at', now());
end $function$;

revoke all on function public._test153_ghost(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.test153_heat_save(jsonb) from public, anon;
grant execute on function public.test153_heat_save(jsonb) to authenticated, service_role;
revoke all on function public.board_test153_live(text, text) from public;
grant execute on function public.board_test153_live(text, text) to anon, authenticated, service_role;
