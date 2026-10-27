-- 신체 정보 공개 · 비공개 (2026-10-28 01:1x 대표님 "회원이 신체정보탭에 선택할수있게하자 신체정보는 공유하고 싶지않은 회원님들이
--   신체정보 공개 비공개 버튼 만들고 비공개 버튼 누르면 아무도 본인외에는 아무도 못보는걸로")
--
--   · member_body_privacy — 회원이 '내 신체 정보'에서 고른 값(기본 공개). 비공개면 본인 말고는 아무도 못 본다(대표님 · 지점장 · 코치 모두).
--   · 비공개로 가리는 것
--       - 회원이 넣은 키 · 몸무게 · 하루 운동 시간 — get_member_body_info 는 {private:true} 만 준다(회원 상세 '내정보')
--       - 넣었는지 여부 — get_body_info_entered 의 넣음(rows) · 안 넣음(missing) 어디에도 나오지 않는다(회원관리 필터)
--       - 회원이 넣은 악력 · 허리둘레 · 안정시 심박(source 'me')과 몸무게 — get_my_fitness_profile 지도진 보기 · member_fitness_measures 읽기 권한
--     성별 · 출생 연도 · 체지방률은 처음부터 본인만 본다(get_my_fitness_extra — 바꾸지 않음).
--   · 코치님이 잰 153 PB 공식 기록 · 코치님이 잰 측정(source 'coach')은 그대로 지도진이 본다 — 코치님의 측정이라서.
-- DB 의 지금 정의(10/28 01:1x KST 에 읽음) 위에 고쳤다.

-- 1) 고른 값
create table if not exists public.member_body_privacy (
  user_id uuid primary key references auth.users(id) on delete cascade,
  private boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.member_body_privacy enable row level security;
-- 정책 없음 — 아래 함수로만 읽고 쓴다

create or replace function public._body_info_private(_uid uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce((select b.private from public.member_body_privacy b where b.user_id = _uid), false);
$function$;
revoke all on function public._body_info_private(uuid) from public, anon;
grant execute on function public._body_info_private(uuid) to authenticated;   -- 읽기 권한(RLS) 식에서 쓴다

create or replace function public.set_my_body_info_private(p_private boolean)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  insert into public.member_body_privacy (user_id, private, updated_at)
  values (v_uid, coalesce(p_private, false), now())
  on conflict (user_id) do update set private = excluded.private, updated_at = now();
  return jsonb_build_object('private', coalesce(p_private, false));
end $function$;
revoke all on function public.set_my_body_info_private(boolean) from public, anon;
grant execute on function public.set_my_body_info_private(boolean) to authenticated;

-- 2) 내 신체 정보 — 고른 값도 같이
create or replace function public.get_my_body_info()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  return public.member_body_info_for(v_uid, null) || jsonb_build_object('private', public._body_info_private(v_uid));
end;
$function$;

-- 3) 회원 상세 '내정보'(관리자 · 지점장) — 비공개면 값 없이 {private:true}
create or replace function public.get_member_body_info(p_user_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  v_since timestamptz;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_user_id is null then raise exception 'member_required' using errcode = '22023'; end if;
  if p_user_id <> v_me
     and not (public.has_role(v_me, 'super_admin') or public.has_role(v_me, 'admin') or public.is_same_branch(p_user_id)) then
    raise exception '지점장 · 관리자만 볼 수 있어요' using errcode = '42501';
  end if;
  if p_user_id = v_me then
    return public.member_body_info_for(v_me, null) || jsonb_build_object('private', public._body_info_private(v_me));
  end if;
  -- 회원이 비공개로 했으면 아무 값도 주지 않는다 (2026-10-28)
  if public._body_info_private(p_user_id) then
    return jsonb_build_object('private', true, 'count', 0);
  end if;
  select (value->>'since')::timestamptz into v_since from public.app_settings where key = 'body_info_staff_since';
  return public.member_body_info_for(p_user_id, coalesce(v_since, 'infinity'::timestamptz)) || jsonb_build_object('private', false);
end;
$function$;

-- 4) 회원관리 넣음 · 안 넣음 — 비공개 회원은 어디에도 넣지 않는다
create or replace function public.get_body_info_entered()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_me uuid := auth.uid();
  v_all boolean;
  v_branch text;
  v_since timestamptz;
  v_rows jsonb;
  v_missing jsonb;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  v_all := public.has_role(v_me, 'super_admin') or public.has_role(v_me, 'admin');
  if not v_all then
    if not public.has_role(v_me, 'branch_manager') then
      raise exception '지점장 · 관리자만 볼 수 있어요' using errcode = '42501';
    end if;
    select p.branch_name into v_branch from public.profiles p where p.user_id = v_me;
    if v_branch is null then
      return jsonb_build_object('rows', '[]'::jsonb, 'missing', '[]'::jsonb);
    end if;
  end if;

  select (s.value->>'since')::timestamptz into v_since from public.app_settings s where s.key = 'body_info_staff_since';
  v_since := coalesce(v_since, 'infinity'::timestamptz);

  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', x.user_id,
           'at', x.at,
           'height', x.has_h,
           'weight', x.has_w
         ) order by x.at desc), '[]'::jsonb)
    into v_rows
    from (
      select l.user_id,
             max(l.updated_at) as at,
             bool_or(l.height_cm is not null) as has_h,
             bool_or(l.weight_kg is not null) as has_w
        from public.member_body_logs l
        join public.profiles p on p.user_id = l.user_id
       where l.updated_at >= v_since
         and (l.height_cm is not null or l.weight_kg is not null)
         and (v_all or p.branch_name = v_branch)
         and not public._body_info_private(l.user_id)
       group by l.user_id
    ) x;

  -- 안 넣은 회원 — 앱에 들어온 적 있는 승인된 일반 회원만 (2026-10-28) · 비공개로 한 회원은 빼고
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', y.user_id,
           'came_at', y.came_at
         ) order by y.came_at desc nulls last), '[]'::jsonb)
    into v_missing
    from (
      select p.user_id,
             (select max(a.checked_in_at) from public.attendance_logs a
               where a.user_id = p.user_id and not coalesce(a.is_duplicate, false)) as came_at
        from auth.users au
        join public.profiles p on p.user_id = au.id
       where au.last_sign_in_at is not null
         and p.merged_into is null
         and coalesce(p.is_approved, false)
         and not coalesce(p.is_staff, false)
         and not coalesce(p.is_test_account, false)
         and (v_all or p.branch_name = v_branch)
         and public._dm_kind(p.user_id) = 'member'
         and not public._body_info_private(p.user_id)
         and not exists (select 1 from public.member_body_logs l
                          where l.user_id = p.user_id and l.updated_at >= v_since
                            and (l.height_cm is not null or l.weight_kg is not null))
    ) y;

  return jsonb_build_object('rows', v_rows, 'missing', v_missing);
end $function$;

-- 5) 153 체력 프로필 — 지도진이 볼 때 회원이 비공개면 회원이 넣은 측정(source 'me')과 몸무게는 빼고, 코치님 측정 · 153 PB 는 그대로
create or replace function public.get_my_fitness_profile(p_user_id uuid default null::uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
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
  v_hide boolean;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if v_user <> v_uid and not public.can_measure_test153(v_user) then
    raise exception 'fitness_profile_forbidden' using errcode = '42501';
  end if;
  -- 지도진이 보는데 회원이 신체 정보를 비공개로 했으면 회원이 넣은 값은 빼고 (2026-10-28)
  v_hide := v_user <> v_uid and public._body_info_private(v_user);

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

  if not v_hide then
    select b.weight_kg into v_weight
      from public.member_body_logs b
     where b.user_id = v_user and b.weight_kg is not null
     order by b.measured_on desc limit 1;
  end if;

  select m.value, m.measured_on, m.source into v_grip_kg, v_grip_on, v_grip_src
    from public.member_fitness_measures m
   where m.user_id = v_user and m.kind = 'grip_kg' and (not v_hide or m.source = 'coach')
   order by m.measured_on desc, (m.source = 'coach') desc limit 1;
  select m.value, m.measured_on into v_grip_first_kg, v_grip_first_on
    from public.member_fitness_measures m
   where m.user_id = v_user and m.kind = 'grip_kg' and (not v_hide or m.source = 'coach')
   order by m.measured_on asc, (m.source = 'coach') desc limit 1;
  select m.value, m.measured_on into v_waist, v_waist_on
    from public.member_fitness_measures m
   where m.user_id = v_user and m.kind = 'waist_cm' and (not v_hide or m.source = 'coach')
   order by m.measured_on desc, (m.source = 'coach') desc limit 1;
  select m.value, m.measured_on into v_hr, v_hr_on
    from public.member_fitness_measures m
   where m.user_id = v_user and m.kind = 'rest_hr' and (not v_hide or m.source = 'coach')
   order by m.measured_on desc, (m.source = 'coach') desc limit 1;
  select count(*)::int into v_measure_count
    from public.member_fitness_measures m where m.user_id = v_user and (not v_hide or m.source = 'coach');

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
$function$;

-- 6) 측정 기록 직접 읽기 — 지도진은 회원이 비공개면 코치님 측정만
alter policy member_fitness_measures_read on public.member_fitness_measures
  using ((user_id = (select auth.uid()))
         or (public.can_measure_test153(user_id) and (source = 'coach' or not public._body_info_private(user_id))));
