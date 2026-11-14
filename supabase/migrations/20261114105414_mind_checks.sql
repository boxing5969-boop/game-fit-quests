-- 🧠 마음 능력치 — 4주마다 2분 '마음 체크' (2026-11-14 대표님 「마이복서 153 정신적인 향상도 넣자 · 운동을 통한 자신감 힘 ·
--    과학적이고 설득력이 정말 중요해 — 사람들이 이거 신뢰할 수 있는 데이터인가 생각하기 때문에」)
--
--   지어낸 숫자 없이, 회원이 직접 답한 검증된 심리 척도 세 가지로만 잰다 (문항 · 출처는 src/data/mindScales.ts 한 곳):
--     · 자신감     = 로젠버그 자존감 척도 RSES 10문항(4점) — 공개 저작물(메릴랜드대 사회학과), 한국판 전병재(1974)
--     · 힘(활력)   = RAND 36문항 건강조사 1.0 의 활력(energy/fatigue) 4문항(6점) — RAND 공개 문항(허락 없이 사용)
--     · 운동 습관  = 습관 자동성 지수 SRBAI 4문항(7점) — Gardner 외 2012(IJBNPA, CC BY)
--   점수는 모두 0~100 (자신감 · 습관 = 가능한 범위 중 몇 % · 활력 = RAND 채점 그대로). 계산은 이 파일의 _mind_score_* 한 곳 —
--   화면(lib/mind153)은 같은 식으로 시험만 한다.
--
--   민감정보(건강에 관한 정보, 개인정보보호법 23조)로 보고 따로 동의(mind_settings.consent_at)를 받아야 저장한다 · 만 14세 이상만.
--   답 · 점수는 본인만 본다 — 코치 · 지점장 · 대표도 못 본다. 153 전체 평균(_mind_brand)은 4주 넘게 두 번 잰 회원이 20명 넘을 때만,
--   이름 없는 숫자로(코치 · 운영진 · 합쳐진 옛 계정 빼고).
--   다시 재기: 4주(28일) 뒤가 기본 · 2주(14일) 안에 다시 하면 마지막 기록을 고쳐 쓴다(같은 시기 기록이 두 줄이 되지 않게).
--   지우기 = 내용 비우기(mind_clear — 답 · 점수를 null + cleared_at, 동의도 거둠). 표는 anon · authenticated 모두 막고 함수로만.
--   알림: 마지막 체크 28일 뒤 한 번 '마음 체크할 때예요'(예약 mind-remind 매일 12:20 KST · 알림 끄기 = mind_remind_set(false)).

create table if not exists public.mind_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  consent_at timestamptz,
  consent_ver smallint,
  adult_self boolean,
  remind boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.mind_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  taken_at timestamptz not null default now(),
  taken_on date not null default ((now() at time zone 'Asia/Seoul')::date),
  ver smallint not null default 1,
  conf_ans smallint[],
  vital_ans smallint[],
  habit_ans smallint[],
  conf numeric(4,1),
  vital numeric(4,1),
  habit numeric(4,1),
  reminded_at timestamptz,
  cleared_at timestamptz,
  constraint mind_checks_conf_len check (conf_ans is null or array_length(conf_ans, 1) = 10),
  constraint mind_checks_vital_len check (vital_ans is null or array_length(vital_ans, 1) = 4),
  constraint mind_checks_habit_len check (habit_ans is null or array_length(habit_ans, 1) = 4),
  constraint mind_checks_score_rng check (
    (conf is null or conf between 0 and 100) and (vital is null or vital between 0 and 100) and (habit is null or habit between 0 and 100)
  )
);
create index if not exists mind_checks_user_taken on public.mind_checks (user_id, taken_at desc);

alter table public.mind_settings enable row level security;
alter table public.mind_checks enable row level security;
revoke all on public.mind_settings from anon, authenticated;
revoke all on public.mind_checks from anon, authenticated;

-- ─── 점수 (0~100, 소수 한 자리) ───────────────────────────────────────────────

-- 자신감 — RSES 1~4 · 역채점 2 · 5 · 6 · 8 · 9 (5 − 답) · 합 10~40 → (합 − 10) / 30 × 100
create or replace function public._mind_score_conf(a int[])
returns numeric
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when a is null or array_length(a, 1) is distinct from 10
      or exists (select 1 from unnest(a) x where x is null or x < 1 or x > 4) then null
    else round((((a[1] + (5 - a[2]) + a[3] + a[4] + (5 - a[5]) + (5 - a[6]) + a[7] + (5 - a[8]) + (5 - a[9]) + a[10]) - 10)::numeric / 30) * 100, 1)
  end
$$;

-- 힘(활력) — RAND-36 23 · 27(좋은 쪽 문항: 1 항상 → 100 … 6 전혀 → 0) · 29 · 31(힘든 쪽: 1 → 0 … 6 → 100) 의 평균
create or replace function public._mind_score_vital(a int[])
returns numeric
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when a is null or array_length(a, 1) is distinct from 4
      or exists (select 1 from unnest(a) x where x is null or x < 1 or x > 6) then null
    else round((((6 - a[1]) * 20 + (6 - a[2]) * 20 + (a[3] - 1) * 20 + (a[4] - 1) * 20)::numeric / 4), 1)
  end
$$;

-- 운동 습관 — SRBAI 1~7 · 합 4~28 → (합 − 4) / 24 × 100
create or replace function public._mind_score_habit(a int[])
returns numeric
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when a is null or array_length(a, 1) is distinct from 4
      or exists (select 1 from unnest(a) x where x is null or x < 1 or x > 7) then null
    else round((((a[1] + a[2] + a[3] + a[4]) - 4)::numeric / 24) * 100, 1)
  end
$$;

-- ─── 나이 (만 14세 확인) — 생년월일(글자) → 없으면 내 신체 정보의 출생 연도(해 차이) ─────────────────
create or replace function public._mind_age(p_uid uuid)
returns int
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_bd text;
  v_date date;
  v_year int;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  select nullif(trim(p.birth_date), '') into v_bd from public.profiles p where p.user_id = p_uid;
  if v_bd is not null then
    begin
      if v_bd ~ '^\d{4}-\d{2}-\d{2}$' then
        v_date := to_date(v_bd, 'YYYY-MM-DD');
      elsif v_bd ~ '^\d{8}$' then
        v_date := to_date(v_bd, 'YYYYMMDD');
      end if;
    exception when others then
      v_date := null;
    end;
    if v_date is not null and v_date <= v_today and v_date > date '1900-01-01' then
      return extract(year from age(v_today, v_date))::int;
    end if;
  end if;
  select f.birth_year into v_year from public.member_fitness_profile f where f.user_id = p_uid;
  if v_year is not null and v_year between 1900 and extract(year from v_today)::int then
    -- 해 차이 — 생일 전이면 만 나이보다 1 많다 (14세 확인은 14 미만만 막고, 14는 본인 확인을 같이 본다)
    return extract(year from v_today)::int - v_year;
  end if;
  return null;
end;
$$;

-- ─── 153 전체 평균 — 4주(21일↑) 넘게 두 번 잰 회원 20명 넘을 때만 ─────────────────────────────
create or replace function public._mind_brand()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with c as (
    select m.user_id, m.taken_at, m.conf, m.vital, m.habit,
           first_value(m.taken_at) over w as f_at,
           first_value(m.conf) over w as f_conf,
           first_value(m.vital) over w as f_vital,
           first_value(m.habit) over w as f_habit,
           row_number() over (partition by m.user_id order by m.taken_at desc) as rn_desc
      from public.mind_checks m
      join public.profiles p on p.user_id = m.user_id
     where m.cleared_at is null
       and m.conf is not null and m.vital is not null and m.habit is not null
       and coalesce(p.is_staff, false) = false
       and p.merged_into is null
       and not exists (
         select 1 from public.user_roles r
          where r.user_id = m.user_id and r.role::text in ('super_admin', 'admin', 'branch_manager', 'coach')
       )
    window w as (partition by m.user_id order by m.taken_at)
  ), pairs as (
    select conf - f_conf as d_conf, vital - f_vital as d_vital, habit - f_habit as d_habit,
           extract(epoch from (taken_at - f_at)) / 86400.0 as days
      from c
     where rn_desc = 1 and taken_at - f_at >= interval '21 days'
  )
  select case when count(*) >= 20 then jsonb_build_object(
           'ready', true,
           'n', count(*),
           'conf', round(avg(d_conf), 1),
           'vital', round(avg(d_vital), 1),
           'habit', round(avg(d_habit), 1),
           'days', round(avg(days)),
           'up10', round(100.0 * count(*) filter (where greatest(d_conf, d_vital, d_habit) >= 10) / count(*)))
         else jsonb_build_object('ready', false) end
    from pairs
$$;

-- ─── 내 상태 — 동의 · 알림 · 기록(지운 것 빼고, 오래된 것부터 36개) · 153 전체 평균 ─────────────────
create or replace function public.mind_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_set public.mind_settings%rowtype;
  v_checks jsonb;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  select * into v_set from public.mind_settings where user_id = v_uid;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'taken_at', c.taken_at, 'taken_on', c.taken_on, 'ver', c.ver,
           'conf', c.conf, 'vital', c.vital, 'habit', c.habit) order by c.taken_at), '[]'::jsonb)
    into v_checks
    from (
      select * from public.mind_checks
       where user_id = v_uid and cleared_at is null
       order by taken_at desc
       limit 36
    ) c;
  return jsonb_build_object(
    'active', public._is_active_member(v_uid),
    'consent', v_set.consent_at is not null,
    'consent_at', v_set.consent_at,
    'remind', coalesce(v_set.remind, true),
    'age', public._mind_age(v_uid),
    'checks', v_checks,
    'brand', public._mind_brand()
  );
end;
$$;

-- ─── 동의 — 켜기(만 14세 확인) · 끄기 = 지우기 ──────────────────────────────────────────────
create or replace function public.mind_clear()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_n int;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  update public.mind_checks
     set conf_ans = null, vital_ans = null, habit_ans = null,
         conf = null, vital = null, habit = null,
         cleared_at = now()
   where user_id = v_uid and cleared_at is null;
  get diagnostics v_n = row_count;
  update public.mind_settings
     set consent_at = null, consent_ver = null, adult_self = null, updated_at = now()
   where user_id = v_uid;
  return jsonb_build_object('cleared', v_n, 'state', public.mind_state());
end;
$$;

create or replace function public.mind_consent(p_on boolean, p_adult boolean default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_age int;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  if not coalesce(p_on, false) then
    return public.mind_clear();
  end if;
  if not public._is_active_member(v_uid) then
    raise exception '승인된 회원만 쓸 수 있어요' using errcode = '42501';
  end if;
  v_age := public._mind_age(v_uid);
  if v_age is not null and v_age < 14 then
    raise exception '마음 체크는 만 14세 이상만 쓸 수 있어요' using errcode = '22023';
  end if;
  if not coalesce(p_adult, false) then
    raise exception '만 14세 이상인지 확인해 주세요' using errcode = '22023';
  end if;
  insert into public.mind_settings as s (user_id, consent_at, consent_ver, adult_self, updated_at)
  values (v_uid, now(), 1, true, now())
  on conflict (user_id) do update
    set consent_at = now(), consent_ver = 1, adult_self = true, updated_at = now();
  return public.mind_state();
end;
$$;

-- ─── 알림 켜고 끄기 ─────────────────────────────────────────────────────────────────
create or replace function public.mind_remind_set(p_on boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  insert into public.mind_settings as s (user_id, remind, updated_at)
  values (v_uid, coalesce(p_on, true), now())
  on conflict (user_id) do update set remind = coalesce(p_on, true), updated_at = now();
  return public.mind_state();
end;
$$;

-- ─── 저장 — 답 검사 · 점수 · 2주 안이면 마지막 기록 고쳐 쓰기 ─────────────────────────────────
create or replace function public.mind_check_save(p_conf int[], p_vital int[], p_habit int[])
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_consent timestamptz;
  v_conf numeric;
  v_vital numeric;
  v_habit numeric;
  v_prev record;
  v_id uuid;
  v_replaced boolean := false;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  if not public._is_active_member(v_uid) then
    raise exception '승인된 회원만 쓸 수 있어요' using errcode = '42501';
  end if;
  select consent_at into v_consent from public.mind_settings where user_id = v_uid;
  if v_consent is null then
    raise exception '먼저 마음 체크 안내에 동의해 주세요' using errcode = '42501';
  end if;

  v_conf := public._mind_score_conf(p_conf);
  v_vital := public._mind_score_vital(p_vital);
  v_habit := public._mind_score_habit(p_habit);
  if v_conf is null then
    raise exception '자신감 문항(10개) 답을 확인해 주세요' using errcode = '22023';
  end if;
  if v_vital is null then
    raise exception '힘(활력) 문항(4개) 답을 확인해 주세요' using errcode = '22023';
  end if;
  if v_habit is null then
    raise exception '운동 습관 문항(4개) 답을 확인해 주세요' using errcode = '22023';
  end if;

  select id, taken_at into v_prev
    from public.mind_checks
   where user_id = v_uid and cleared_at is null
   order by taken_at desc
   limit 1;

  if v_prev.id is not null and v_prev.taken_at > now() - interval '14 days' then
    update public.mind_checks
       set conf_ans = p_conf::smallint[], vital_ans = p_vital::smallint[], habit_ans = p_habit::smallint[],
           conf = v_conf, vital = v_vital, habit = v_habit,
           taken_at = now(), taken_on = (now() at time zone 'Asia/Seoul')::date, ver = 1, reminded_at = null
     where id = v_prev.id
    returning id into v_id;
    v_replaced := true;
  else
    insert into public.mind_checks (user_id, conf_ans, vital_ans, habit_ans, conf, vital, habit)
    values (v_uid, p_conf::smallint[], p_vital::smallint[], p_habit::smallint[], v_conf, v_vital, v_habit)
    returning id into v_id;
  end if;

  return jsonb_build_object(
    'id', v_id,
    'replaced', v_replaced,
    'conf', v_conf,
    'vital', v_vital,
    'habit', v_habit,
    'state', public.mind_state()
  );
end;
$$;

-- ─── 28일 알림 — 마지막 체크마다 한 번 (예약 mind-remind) ───────────────────────────────────────
create or replace function public._mind_remind_tick()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  v_n int := 0;
begin
  for r in
    select distinct on (c.user_id) c.id, c.user_id, c.taken_at, c.reminded_at
      from public.mind_checks c
      join public.mind_settings s on s.user_id = c.user_id and s.consent_at is not null and s.remind
     where c.cleared_at is null
     order by c.user_id, c.taken_at desc
  loop
    continue when r.reminded_at is not null or r.taken_at > now() - interval '28 days';
    continue when not public._is_active_member(r.user_id);
    insert into public.notifications (user_id, title, body, link)
    values (r.user_id, '🧠 마음 체크할 때예요',
            '4주 전보다 자신감 · 힘(활력)이 얼마나 달라졌는지 2분이면 볼 수 있어요',
            '/mypage/attendance?mind=1');
    update public.mind_checks set reminded_at = now() where id = r.id;
    v_n := v_n + 1;
    exit when v_n >= 300;
  end loop;
  return v_n;
end;
$$;

-- ─── 권한 — 화면은 이름 없는 함수 다섯만 ───────────────────────────────────────────────────
revoke all on function public._mind_score_conf(int[]) from public, anon, authenticated;
revoke all on function public._mind_score_vital(int[]) from public, anon, authenticated;
revoke all on function public._mind_score_habit(int[]) from public, anon, authenticated;
revoke all on function public._mind_age(uuid) from public, anon, authenticated;
revoke all on function public._mind_brand() from public, anon, authenticated;
revoke all on function public._mind_remind_tick() from public, anon, authenticated;
revoke all on function public.mind_state() from public, anon;
revoke all on function public.mind_clear() from public, anon;
revoke all on function public.mind_consent(boolean, boolean) from public, anon;
revoke all on function public.mind_remind_set(boolean) from public, anon;
revoke all on function public.mind_check_save(int[], int[], int[]) from public, anon;
grant execute on function public.mind_state() to authenticated;
grant execute on function public.mind_clear() to authenticated;
grant execute on function public.mind_consent(boolean, boolean) to authenticated;
grant execute on function public.mind_remind_set(boolean) to authenticated;
grant execute on function public.mind_check_save(int[], int[], int[]) to authenticated;

-- ─── 예약 — 매일 12:20 KST (03:20 UTC) · 같은 이름이면 바꾼다 · 끄기 = select cron.unschedule('mind-remind'); ───
select cron.schedule('mind-remind', '20 3 * * *', $$select public._mind_remind_tick()$$);
