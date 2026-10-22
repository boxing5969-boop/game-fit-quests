-- 내 성별 · 출생 연도 · 체지방률 — 홈 '153과 함께하며' 정확도 올리기 (2026-10-22 대표님)
--   "고객 데이터를 상세하게 기록할수록 정확도는 올라간다고 해 · 아무런 정보를 입력 안 한 회원님들은
--    출석 기록으로만 평균치를 내 줘 · 남자 여자"
--   (앱: lib/fitnessProfile153 · hooks/useMyBodyInfo · components/profile/BodyInfoSheet · components/home/HealthGainsCard)
--
--   · 기존 표 · 함수는 바꾸지 않는다 — 새 표 2개 + 새 함수 2개만 (미리보기 단계 규칙: 새 함수 · 새 칸 추가만).
--     member_body_logs 는 '키나 몸무게 중 하나는 있어야' 해서 체지방률은 따로 하루 한 줄로 둔다.
--   · 성별 · 출생 연도는 회원이 넣은 값이 먼저, 없으면 profiles.gender · birth_date(지점 등록 정보)를 읽기만 한다
--     (profiles 는 동기화가 덮어쓸 수 있어 여기 쓰지 않는다).
--   · 본인만 읽고 지운다(RLS) — 쓰기는 save_my_fitness_extra 로만. '신체 정보 지우기'가 두 표도 같이 지운다.

create table if not exists public.member_fitness_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  gender text,
  birth_year smallint,
  updated_at timestamptz not null default now(),
  constraint member_fitness_profile_gender check (gender is null or gender in ('남', '여')),
  constraint member_fitness_profile_birth_year check (birth_year is null or birth_year between 1930 and 2020)
);

alter table public.member_fitness_profile enable row level security;
drop policy if exists member_fitness_profile_own_select on public.member_fitness_profile;
create policy member_fitness_profile_own_select on public.member_fitness_profile
  for select to authenticated using (user_id = auth.uid());
drop policy if exists member_fitness_profile_own_delete on public.member_fitness_profile;
create policy member_fitness_profile_own_delete on public.member_fitness_profile
  for delete to authenticated using (user_id = auth.uid());
revoke all on public.member_fitness_profile from anon, authenticated;
grant select, delete on public.member_fitness_profile to authenticated;

create table if not exists public.member_body_fat_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_on date not null,
  body_fat_pct numeric(4,1) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_body_fat_logs_range check (body_fat_pct between 3 and 60),
  constraint member_body_fat_logs_one_per_day unique (user_id, measured_on)
);

alter table public.member_body_fat_logs enable row level security;
drop policy if exists member_body_fat_logs_own_select on public.member_body_fat_logs;
create policy member_body_fat_logs_own_select on public.member_body_fat_logs
  for select to authenticated using (user_id = auth.uid());
drop policy if exists member_body_fat_logs_own_delete on public.member_body_fat_logs;
create policy member_body_fat_logs_own_delete on public.member_body_fat_logs
  for delete to authenticated using (user_id = auth.uid());
revoke all on public.member_body_fat_logs from anon, authenticated;
grant select, delete on public.member_body_fat_logs to authenticated;

-- 성별 · 출생 연도(내가 넣은 값 → 지점 등록 정보) + 체지방률(가장 최근 · 처음)
create or replace function public.get_my_fitness_extra()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_my_gender text;
  v_my_birth smallint;
  v_pg text;
  v_pb text;
  v_gender text;
  v_gender_src text;
  v_birth int;
  v_birth_src text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;

  select f.gender, f.birth_year into v_my_gender, v_my_birth
    from public.member_fitness_profile f where f.user_id = v_uid;
  select lower(btrim(coalesce(p.gender, ''))), btrim(coalesce(p.birth_date, '')) into v_pg, v_pb
    from public.profiles p where p.user_id = v_uid;

  if v_my_gender is not null then
    v_gender := v_my_gender; v_gender_src := 'me';
  elsif v_pg in ('남', '남자', '남성', 'm', 'male') then
    v_gender := '남'; v_gender_src := 'gym';
  elsif v_pg in ('여', '여자', '여성', 'f', 'female') then
    v_gender := '여'; v_gender_src := 'gym';
  end if;

  if v_my_birth is not null then
    v_birth := v_my_birth; v_birth_src := 'me';
  elsif v_pb ~ '^(19|20)[0-9]{2}' then
    v_birth := substr(v_pb, 1, 4)::int; v_birth_src := 'gym';
  end if;
  if v_birth is not null and (v_birth < 1930 or v_birth > extract(year from now() at time zone 'Asia/Seoul')::int - 5) then
    v_birth := null; v_birth_src := null;
  end if;

  return jsonb_build_object(
    'gender', v_gender,
    'gender_source', v_gender_src,
    'birth_year', v_birth,
    'birth_source', v_birth_src,
    'body_fat_pct', (select b.body_fat_pct from public.member_body_fat_logs b where b.user_id = v_uid order by b.measured_on desc limit 1),
    'body_fat_on', (select b.measured_on from public.member_body_fat_logs b where b.user_id = v_uid order by b.measured_on desc limit 1),
    'first_body_fat_pct', (select b.body_fat_pct from public.member_body_fat_logs b where b.user_id = v_uid order by b.measured_on asc limit 1),
    'first_body_fat_on', (select b.measured_on from public.member_body_fat_logs b where b.user_id = v_uid order by b.measured_on asc limit 1),
    'body_fat_count', (select count(*)::int from public.member_body_fat_logs b where b.user_id = v_uid)
  );
end;
$$;
revoke all on function public.get_my_fitness_extra() from public, anon;
grant execute on function public.get_my_fitness_extra() to authenticated;

-- 넣기 · 고치기 — 비운 칸(null)은 그대로 둔다. 체지방률은 오늘(KST) 한 줄 (같은 날 다시 넣으면 고친다)
create or replace function public.save_my_fitness_extra(p_gender text, p_birth_year integer, p_body_fat_pct numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_g text := nullif(btrim(coalesce(p_gender, '')), '');
  v_f numeric(4,1) := round(p_body_fat_pct, 1);
  v_max_year int := extract(year from now() at time zone 'Asia/Seoul')::int - 5;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if v_g is null and p_birth_year is null and v_f is null then raise exception 'fitness_extra_empty' using errcode = '22023'; end if;
  if v_g is not null and v_g not in ('남', '여') then raise exception 'fitness_gender_value' using errcode = '22023'; end if;
  if p_birth_year is not null and (p_birth_year < 1930 or p_birth_year > least(2020, v_max_year)) then
    raise exception 'fitness_birth_year_range' using errcode = '22023';
  end if;
  if v_f is not null and (v_f < 3 or v_f > 60) then raise exception 'body_fat_range' using errcode = '22023'; end if;

  if v_g is not null or p_birth_year is not null then
    insert into public.member_fitness_profile (user_id, gender, birth_year)
    values (v_uid, v_g, p_birth_year::smallint)
    on conflict (user_id) do update
       set gender = coalesce(excluded.gender, member_fitness_profile.gender),
           birth_year = coalesce(excluded.birth_year, member_fitness_profile.birth_year),
           updated_at = now();
  end if;

  if v_f is not null then
    insert into public.member_body_fat_logs (user_id, measured_on, body_fat_pct)
    values (v_uid, v_today, v_f)
    on conflict (user_id, measured_on) do update
       set body_fat_pct = excluded.body_fat_pct, updated_at = now();
  end if;

  return public.get_my_fitness_extra();
end;
$$;
revoke all on function public.save_my_fitness_extra(text, integer, numeric) from public, anon;
grant execute on function public.save_my_fitness_extra(text, integer, numeric) to authenticated;
