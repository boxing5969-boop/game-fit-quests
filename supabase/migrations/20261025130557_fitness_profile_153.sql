-- 153 체력 프로필 1단계 '내 체력 보기' (2026-10-25 대표님 — 「153 PB 체력 프로필 · 몰입 기능 설계 보고서」)
--   153 PB 공식 기록(test153_records)의 16구간을 영역 5개(심폐 · 하체 · 상체·코어 · 복싱 · 리듬)로 묶어
--   내 신체 정보 시트 맨 위 '153 체력 프로필' 카드와 코치 측정 화면 '이번 결과 한 장'에 보여 준다.
--   (앱: lib/test153Profile · services/test153Service · hooks/useMyBodyInfo · components/profile/BodyInfoSheet ·
--        components/test153/Test153MeasurePanel)
--
--   · 기존 표 · 함수는 바꾸지 않는다 — 새 표 1개 + 새 함수 3개 (미리보기 단계 규칙: 새 함수 · 새 칸 추가만).
--     save_test153_record 는 그대로 — 악력은 공식 기록 저장 직후 save_fitness_measure 로 따로 보낸다.
--   · member_fitness_measures: 악력(kg) · 허리둘레(cm) · 안정시 심박(회/분)을 날짜별로, 누가 쟀는지(coach / me) 함께.
--     읽기 = 본인 · 같은 지점 코치 · 지점장 · 관리자(can_measure_test153). 지우기 = 본인('신체 정보 지우기'). 쓰기는 함수로만.
--   · 백분위 · 체력 나이는 2단계 — get_my_fitness_profile 에 키만 두고 null.
--   · TV(board_*)에는 아무것도 내보내지 않는다. 건강 정보라 본인과 지도진만 본다.

create table if not exists public.member_fitness_measures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_on date not null,
  kind text not null,
  value numeric(5,1) not null,
  source text not null,
  coach_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_fitness_measures_kind check (kind in ('grip_kg', 'waist_cm', 'rest_hr')),
  constraint member_fitness_measures_source check (source in ('coach', 'me')),
  constraint member_fitness_measures_range check (
    (kind = 'grip_kg' and value between 5 and 90)
    or (kind = 'waist_cm' and value between 50 and 150)
    or (kind = 'rest_hr' and value between 35 and 120)
  ),
  constraint member_fitness_measures_one_per_day unique (user_id, measured_on, kind, source)
);

create index if not exists member_fitness_measures_user_kind_idx
  on public.member_fitness_measures (user_id, kind, measured_on desc);

alter table public.member_fitness_measures enable row level security;
do $$ begin
  create policy member_fitness_measures_read on public.member_fitness_measures
    for select to authenticated
    using (user_id = (select auth.uid()) or public.can_measure_test153(user_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy member_fitness_measures_own_delete on public.member_fitness_measures
    for delete to authenticated using (user_id = (select auth.uid()));
exception when duplicate_object then null; end $$;
revoke all on public.member_fitness_measures from anon, authenticated;
grant select, delete on public.member_fitness_measures to authenticated;

-- 16구간 → 영역 5개. 구간 순서 = src/lib/test153.ts buildSegments (1부터 세면 홀수 = 셀트런, 짝수 = 스테이션)
--   스테이션 순서 · 오픈 개수: 복서 버피 30 · 원·투·쓰리 스텝 10 · 스쿼트 50 · 푸시업 30 · 복서 스텝 콤비 10 ·
--   복서 싯업 40 · 런지 40 · 줄넘기 200. 스타터 = 절반(올림), 셀트런 거리는 같다.
--   끝내지 못한 구간이 들어간 영역은 null — 타임캡 기록의 마지막 구간은 하던 구간이라 끝낸 구간에서 뺀다.
--   cardio  = 셀트런 평균(ms) · 페이스 유지율(앞 두 셀트런 평균 ÷ 마지막 두 셀트런 평균 × 100, 100에 가까울수록 끝까지 유지)
--   legs    = 스쿼트 + 런지, 1분당 개수     upper = 푸시업 + 복서 싯업, 1분당 개수
--   boxing  = 복서 버피 + 원·투·쓰리 스텝 + 복서 스텝 콤비 시간 합(ms)     rhythm = 줄넘기, 1분당 개수
create or replace function public.test153_areas(p_splits integer[], p_division text, p_finished boolean default true)
returns jsonb language plpgsql immutable set search_path = public as $$
declare
  v_len int := coalesce(array_length(p_splits, 1), 0);
  v_done int;
  v_open int[] := array[30, 10, 50, 30, 10, 40, 40, 200];
  v_reps int[];
  v_runs int[];
  v_cardio jsonb;
  v_legs jsonb;
  v_upper jsonb;
  v_boxing jsonb;
  v_rhythm jsonb;
  v_ms bigint;
  v_n int;
begin
  if v_len = 0 or v_len > 16 or p_division is null or p_division not in ('starter', 'open') then
    return null;
  end if;
  if exists (select 1 from unnest(p_splits) s where s is null or s < 0) then
    return null;
  end if;

  v_done := case when coalesce(p_finished, false) and v_len = 16 then 16 else v_len - 1 end;
  v_reps := case when p_division = 'starter'
                 then array(select ceil(t.r / 2.0)::int from unnest(v_open) with ordinality as t(r, i) order by t.i)
                 else v_open end;

  -- 심폐지구력: 셀트런 8번 (1 · 3 · … · 15번 구간)
  if v_done >= 15 then
    v_runs := array[p_splits[1], p_splits[3], p_splits[5], p_splits[7], p_splits[9], p_splits[11], p_splits[13], p_splits[15]];
    v_cardio := jsonb_build_object(
      'run_avg_ms', round((select avg(x) from unnest(v_runs) as x))::int,
      'pace_keep_pct', round(((p_splits[1] + p_splits[3]) / 2.0) / nullif((p_splits[13] + p_splits[15]) / 2.0, 0) * 100, 1),
      'runs_ms', to_jsonb(v_runs)
    );
  end if;

  -- 하체 근지구력: 스쿼트(6번) + 런지(14번)
  if v_done >= 14 then
    v_ms := p_splits[6]::bigint + p_splits[14];
    v_n := v_reps[3] + v_reps[7];
    v_legs := jsonb_build_object('reps', v_n, 'ms', v_ms, 'per_min', round(v_n / nullif(v_ms / 60000.0, 0), 1));
  end if;

  -- 상체 · 코어 근지구력: 푸시업(8번) + 복서 싯업(12번)
  if v_done >= 12 then
    v_ms := p_splits[8]::bigint + p_splits[12];
    v_n := v_reps[4] + v_reps[6];
    v_upper := jsonb_build_object('reps', v_n, 'ms', v_ms, 'per_min', round(v_n / nullif(v_ms / 60000.0, 0), 1));
  end if;

  -- 복싱 순발력 · 민첩성: 복서 버피(2번) + 원·투·쓰리 스텝(4번) + 복서 스텝 콤비(10번) — 시간 합
  if v_done >= 10 then
    v_boxing := jsonb_build_object('ms', p_splits[2]::bigint + p_splits[4] + p_splits[10]);
  end if;

  -- 리듬 · 협응: 줄넘기(16번)
  if v_done >= 16 then
    v_ms := p_splits[16];
    v_n := v_reps[8];
    v_rhythm := jsonb_build_object('reps', v_n, 'ms', v_ms, 'per_min', round(v_n / nullif(v_ms / 60000.0, 0), 1));
  end if;

  return jsonb_build_object(
    'cardio', v_cardio,
    'legs', v_legs,
    'upper', v_upper,
    'boxing', v_boxing,
    'rhythm', v_rhythm,
    'done_segments', v_done
  );
end;
$$;
revoke all on function public.test153_areas(integer[], text, boolean) from public, anon;
grant execute on function public.test153_areas(integer[], text, boolean) to authenticated;

-- 측정값 저장 — 본인이면 source 'me', 같은 지점 코치 · 지점장 · 관리자(can_measure_test153)면 'coach'.
--   p_user_id 가 null 이면 본인. 오늘(KST) 한 줄 — 같은 날 같은 사람이 다시 넣으면 고친다.
create or replace function public.save_fitness_measure(p_user_id uuid, p_kind text, p_value numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid := coalesce(p_user_id, auth.uid());
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_value numeric(5,1) := round(p_value, 1);
  v_source text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if v_target = v_uid then
    v_source := 'me';
  elsif public.can_measure_test153(v_target) then
    v_source := 'coach';
  else
    raise exception 'fitness_measure_forbidden' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('grip_kg', 'waist_cm', 'rest_hr') then
    raise exception 'fitness_measure_kind' using errcode = '22023';
  end if;
  if v_value is null
     or (p_kind = 'grip_kg' and (v_value < 5 or v_value > 90))
     or (p_kind = 'waist_cm' and (v_value < 50 or v_value > 150))
     or (p_kind = 'rest_hr' and (v_value < 35 or v_value > 120)) then
    raise exception 'fitness_measure_range' using errcode = '22023';
  end if;

  insert into public.member_fitness_measures (user_id, measured_on, kind, value, source, coach_id)
  values (v_target, v_today, p_kind, v_value, v_source, case when v_source = 'coach' then v_uid end)
  on conflict (user_id, measured_on, kind, source) do update
     set value = excluded.value, coach_id = excluded.coach_id, updated_at = now();

  return jsonb_build_object('kind', p_kind, 'value', v_value, 'source', v_source, 'measured_on', v_today);
end;
$$;
revoke all on function public.save_fitness_measure(uuid, text, numeric) from public, anon;
grant execute on function public.save_fitness_measure(uuid, text, numeric) to authenticated;

-- 153 체력 프로필 — 본인 또는 can_measure_test153(같은 지점 지도진 · 관리자)만
--   divisions.<open|starter> = { count, first, pb, latest, prev, improved_ms, improved_pct }
--     기록마다 id · measured_at · score_ms · total_ms · finished · remaining_reps · splits_ms · areas(test153_areas)
--     improved_* = 첫 기록 → PB (둘 다 완주이고 줄었을 때만)
--   primary = 가장 최근에 잰 부문 · next_test_on = 마지막 측정(KST) + 42일 (6주 시즌)
--   grip(악력 · 몸무게 대비 %) · waist · rest_hr = 가장 최근 값 (같은 날이면 코치 값)
--   percentile · fitness_age = 2단계에서 채운다 (지금은 null)
create or replace function public.get_my_fitness_profile(p_user_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_user uuid := coalesce(p_user_id, auth.uid());
  v_divs jsonb := '{}'::jsonb;
  v_primary text;
  v_last timestamptz;
  d text;
  v_count int;
  v_first jsonb;
  v_pb jsonb;
  v_latest jsonb;
  v_prev jsonb;
  v_improved_ms int;
  v_improved_pct numeric;
  v_weight numeric;
  v_grip_kg numeric; v_grip_on date; v_grip_src text;
  v_grip_first_kg numeric; v_grip_first_on date;
  v_waist numeric; v_waist_on date;
  v_hr numeric; v_hr_on date;
  v_measure_count int;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if v_user <> v_uid and not public.can_measure_test153(v_user) then
    raise exception 'fitness_profile_forbidden' using errcode = '42501';
  end if;

  foreach d in array array['open', 'starter'] loop
    select count(*)::int into v_count
      from public.test153_records r
     where r.user_id = v_user and r.division = d and r.official;
    continue when v_count = 0;

    select jsonb_build_object('id', r.id, 'measured_at', r.measured_at, 'score_ms', r.score_ms, 'total_ms', r.total_ms,
                              'finished', r.finished, 'remaining_reps', r.remaining_reps, 'splits_ms', to_jsonb(r.splits_ms),
                              'areas', public.test153_areas(r.splits_ms, r.division, r.finished))
      into v_first
      from public.test153_records r
     where r.user_id = v_user and r.division = d and r.official
     order by r.measured_at asc, r.id asc limit 1;

    select jsonb_build_object('id', r.id, 'measured_at', r.measured_at, 'score_ms', r.score_ms, 'total_ms', r.total_ms,
                              'finished', r.finished, 'remaining_reps', r.remaining_reps, 'splits_ms', to_jsonb(r.splits_ms),
                              'areas', public.test153_areas(r.splits_ms, r.division, r.finished))
      into v_pb
      from public.test153_records r
     where r.user_id = v_user and r.division = d and r.official
     order by r.score_ms asc, r.measured_at asc limit 1;

    select jsonb_build_object('id', r.id, 'measured_at', r.measured_at, 'score_ms', r.score_ms, 'total_ms', r.total_ms,
                              'finished', r.finished, 'remaining_reps', r.remaining_reps, 'splits_ms', to_jsonb(r.splits_ms),
                              'areas', public.test153_areas(r.splits_ms, r.division, r.finished),
                              'coach_name', coalesce(nullif(btrim(c.name), ''), nullif(btrim(c.nickname), ''), '코치'))
      into v_latest
      from public.test153_records r
      left join public.profiles c on c.user_id = r.coach_id
     where r.user_id = v_user and r.division = d and r.official
     order by r.measured_at desc, r.id desc limit 1;

    v_prev := null;
    select jsonb_build_object('id', r.id, 'measured_at', r.measured_at, 'score_ms', r.score_ms, 'total_ms', r.total_ms,
                              'finished', r.finished, 'remaining_reps', r.remaining_reps, 'splits_ms', to_jsonb(r.splits_ms),
                              'areas', public.test153_areas(r.splits_ms, r.division, r.finished))
      into v_prev
      from public.test153_records r
     where r.user_id = v_user and r.division = d and r.official
     order by r.measured_at desc, r.id desc offset 1 limit 1;

    v_improved_ms := null;
    v_improved_pct := null;
    if (v_first->>'finished')::boolean and (v_pb->>'finished')::boolean and (v_pb->>'id') <> (v_first->>'id') then
      v_improved_ms := (v_first->>'score_ms')::int - (v_pb->>'score_ms')::int;
      if v_improved_ms > 0 then
        v_improved_pct := round(v_improved_ms * 100.0 / (v_first->>'score_ms')::int, 1);
      else
        v_improved_ms := null;
      end if;
    end if;

    v_divs := v_divs || jsonb_build_object(d, jsonb_build_object(
      'count', v_count,
      'first', v_first,
      'pb', v_pb,
      'latest', v_latest,
      'prev', v_prev,
      'improved_ms', v_improved_ms,
      'improved_pct', v_improved_pct
    ));
  end loop;

  select r.division, r.measured_at into v_primary, v_last
    from public.test153_records r
   where r.user_id = v_user and r.official
   order by r.measured_at desc limit 1;

  select b.weight_kg into v_weight
    from public.member_body_logs b
   where b.user_id = v_user and b.weight_kg is not null
   order by b.measured_on desc limit 1;

  select m.value, m.measured_on, m.source into v_grip_kg, v_grip_on, v_grip_src
    from public.member_fitness_measures m
   where m.user_id = v_user and m.kind = 'grip_kg'
   order by m.measured_on desc, (m.source = 'coach') desc limit 1;
  select m.value, m.measured_on into v_grip_first_kg, v_grip_first_on
    from public.member_fitness_measures m
   where m.user_id = v_user and m.kind = 'grip_kg'
   order by m.measured_on asc, (m.source = 'coach') desc limit 1;
  select m.value, m.measured_on into v_waist, v_waist_on
    from public.member_fitness_measures m
   where m.user_id = v_user and m.kind = 'waist_cm'
   order by m.measured_on desc, (m.source = 'coach') desc limit 1;
  select m.value, m.measured_on into v_hr, v_hr_on
    from public.member_fitness_measures m
   where m.user_id = v_user and m.kind = 'rest_hr'
   order by m.measured_on desc, (m.source = 'coach') desc limit 1;
  select count(*)::int into v_measure_count
    from public.member_fitness_measures m where m.user_id = v_user;

  return jsonb_build_object(
    'has_records', v_primary is not null,
    'primary', v_primary,
    'divisions', v_divs,
    'last_measured_at', v_last,
    'next_test_on', case when v_last is null then null else (v_last at time zone 'Asia/Seoul')::date + 42 end,
    'grip', case when v_grip_kg is null then null else jsonb_build_object(
      'kg', v_grip_kg,
      'on', v_grip_on,
      'source', v_grip_src,
      'weight_kg', v_weight,
      'rel_pct', case when v_weight > 0 then round(v_grip_kg * 100.0 / v_weight, 1) end,
      'first_kg', v_grip_first_kg,
      'first_on', v_grip_first_on
    ) end,
    'waist', case when v_waist is null then null else jsonb_build_object('cm', v_waist, 'on', v_waist_on) end,
    'rest_hr', case when v_hr is null then null else jsonb_build_object('bpm', v_hr, 'on', v_hr_on) end,
    'measure_count', v_measure_count,
    'percentile', null,
    'fitness_age', null
  );
end;
$$;
revoke all on function public.get_my_fitness_profile(uuid) from public, anon;
grant execute on function public.get_my_fitness_profile(uuid) to authenticated;
