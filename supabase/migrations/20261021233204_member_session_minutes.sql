-- 한 번 운동 시간(평균) — 회원 본인이 넣는다 (2026-10-21 대표님: "운동 시간 평균도 입력할 수 있게 해 줘,
--   더 많이 하는 회원도 있으니까 기준은 60분으로")
--   '지금까지 이룬 것' 카드가 출석 1번 = 이 시간만큼 운동한 것으로 보고 펀치 · 칼로리 · 운동한 시간을 계산한다
--   (안 넣으면 60분). 본인만 읽고 쓴다 — 코치 · 관리자 화면에는 없다.
--   · member_workout_settings: 사람마다 한 줄 (session_minutes 20~240분)
--   · save_my_fitness_info(키, 몸무게, 운동 시간): 앱이 쓰는 저장 함수 하나 — 비운 칸(null)은 그대로 둔다
--   · save_my_body_info 는 save_my_fitness_info 로 넘긴다 (범위 확인 전에 numeric(4,1) 로 바꾸다 넘치던 것도 같이 고침)
--   · get_my_body_info 에 session_minutes 를 더한다 (나머지는 그대로)

create table if not exists public.member_workout_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_minutes smallint not null,
  updated_at timestamptz not null default now(),
  constraint member_workout_settings_minutes_range check (session_minutes between 20 and 240)
);

alter table public.member_workout_settings enable row level security;
drop policy if exists member_workout_settings_own_select on public.member_workout_settings;
create policy member_workout_settings_own_select on public.member_workout_settings
  for select to authenticated using (user_id = auth.uid());
drop policy if exists member_workout_settings_own_delete on public.member_workout_settings;
create policy member_workout_settings_own_delete on public.member_workout_settings
  for delete to authenticated using (user_id = auth.uid());
revoke all on public.member_workout_settings from anon, authenticated;
grant select, delete on public.member_workout_settings to authenticated;

-- 지금 값 + 처음 넣은 몸무게 + 한 번 운동 시간
create or replace function public.get_my_body_info()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  return jsonb_build_object(
    'height_cm', (select b.height_cm from public.member_body_logs b where b.user_id = v_uid and b.height_cm is not null order by b.measured_on desc limit 1),
    'height_on', (select b.measured_on from public.member_body_logs b where b.user_id = v_uid and b.height_cm is not null order by b.measured_on desc limit 1),
    'weight_kg', (select b.weight_kg from public.member_body_logs b where b.user_id = v_uid and b.weight_kg is not null order by b.measured_on desc limit 1),
    'weight_on', (select b.measured_on from public.member_body_logs b where b.user_id = v_uid and b.weight_kg is not null order by b.measured_on desc limit 1),
    'first_weight_kg', (select b.weight_kg from public.member_body_logs b where b.user_id = v_uid and b.weight_kg is not null order by b.measured_on asc limit 1),
    'first_weight_on', (select b.measured_on from public.member_body_logs b where b.user_id = v_uid and b.weight_kg is not null order by b.measured_on asc limit 1),
    'count', (select count(*)::int from public.member_body_logs b where b.user_id = v_uid),
    'session_minutes', (select s.session_minutes from public.member_workout_settings s where s.user_id = v_uid)
  );
end;
$$;
revoke all on function public.get_my_body_info() from public, anon;
grant execute on function public.get_my_body_info() to authenticated;

-- 키 · 몸무게(오늘 KST 한 줄) · 한 번 운동 시간 — 넣은 것만 바꾼다
create or replace function public.save_my_fitness_info(p_height_cm numeric, p_weight_kg numeric, p_session_minutes int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_h numeric := round(p_height_cm, 1);
  v_w numeric := round(p_weight_kg, 1);
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if v_h is null and v_w is null and p_session_minutes is null then raise exception 'body_info_empty' using errcode = '22023'; end if;
  if v_h is not null and (v_h < 100 or v_h > 230) then raise exception 'body_height_range' using errcode = '22023'; end if;
  if v_w is not null and (v_w < 25 or v_w > 250) then raise exception 'body_weight_range' using errcode = '22023'; end if;
  if p_session_minutes is not null and (p_session_minutes < 20 or p_session_minutes > 240) then
    raise exception 'session_minutes_range' using errcode = '22023';
  end if;

  if v_h is not null or v_w is not null then
    insert into public.member_body_logs (user_id, measured_on, height_cm, weight_kg)
    values (v_uid, v_today, v_h, v_w)
    on conflict (user_id, measured_on) do update
       set height_cm = coalesce(excluded.height_cm, member_body_logs.height_cm),
           weight_kg = coalesce(excluded.weight_kg, member_body_logs.weight_kg),
           updated_at = now();
  end if;

  if p_session_minutes is not null then
    insert into public.member_workout_settings (user_id, session_minutes)
    values (v_uid, p_session_minutes)
    on conflict (user_id) do update set session_minutes = excluded.session_minutes, updated_at = now();
  end if;

  return public.get_my_body_info();
end;
$$;
revoke all on function public.save_my_fitness_info(numeric, numeric, int) from public, anon;
grant execute on function public.save_my_fitness_info(numeric, numeric, int) to authenticated;

-- 예전 이름 — 키 · 몸무게만 (앱은 save_my_fitness_info 를 쓴다)
create or replace function public.save_my_body_info(p_height_cm numeric, p_weight_kg numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_height_cm is null and p_weight_kg is null then raise exception 'body_info_empty' using errcode = '22023'; end if;
  return public.save_my_fitness_info(p_height_cm, p_weight_kg, null);
end;
$$;
revoke all on function public.save_my_body_info(numeric, numeric) from public, anon;
grant execute on function public.save_my_body_info(numeric, numeric) to authenticated;
