-- 내 신체 정보 (키 · 몸무게) — 회원 본인만 (2026-10-21 대표님: "본인이 신체정보 넣을 수 있게 하자, 키와 몸무게")
--   내정보 '지금까지 이룬 것' 카드가 칼로리를 내 몸무게로 계산하고, 몸무게가 처음보다 줄었을 때만 그 변화를 보여 준다
--   (앱: lib/achievement153 · hooks/useMyBodyInfo · components/profile/AchievementCard).
--   · 하루(KST) 한 줄 — 같은 날 다시 넣으면 고친다. 비운 칸은 그날 이미 넣은 값을 지우지 않는다.
--   · 본인만 읽고 쓴다 — 코치 · 관리자 화면에는 없다. 쓰기는 아래 함수로만.
--   · '신체 정보 지우기' = 내 기록 전부 삭제 (본인 줄만 지울 수 있는 RLS — 앱이 바로 지운다).

create table if not exists public.member_body_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_on date not null,
  height_cm numeric(4,1),
  weight_kg numeric(4,1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_body_logs_height_range check (height_cm is null or height_cm between 100 and 230),
  constraint member_body_logs_weight_range check (weight_kg is null or weight_kg between 25 and 250),
  constraint member_body_logs_some_value check (height_cm is not null or weight_kg is not null),
  constraint member_body_logs_one_per_day unique (user_id, measured_on)
);

alter table public.member_body_logs enable row level security;
drop policy if exists member_body_logs_own_select on public.member_body_logs;
create policy member_body_logs_own_select on public.member_body_logs
  for select to authenticated using (user_id = auth.uid());
drop policy if exists member_body_logs_own_delete on public.member_body_logs;
create policy member_body_logs_own_delete on public.member_body_logs
  for delete to authenticated using (user_id = auth.uid());
-- 기본 권한(TRUNCATE 등)까지 걷어 내고 읽기 · 본인 줄 지우기만 남긴다
revoke all on public.member_body_logs from anon, authenticated;
grant select, delete on public.member_body_logs to authenticated;

-- 지금 값(가장 최근에 넣은 키 · 몸무게) + 처음 넣은 몸무게
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
    'count', (select count(*)::int from public.member_body_logs b where b.user_id = v_uid)
  );
end;
$$;
revoke all on function public.get_my_body_info() from public, anon;
grant execute on function public.get_my_body_info() to authenticated;

-- 오늘(KST) 값 넣기 · 고치기 — 비운 칸(null)은 오늘 이미 넣은 값을 그대로 둔다
create or replace function public.save_my_body_info(p_height_cm numeric, p_weight_kg numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_h numeric(4,1) := round(p_height_cm, 1);
  v_w numeric(4,1) := round(p_weight_kg, 1);
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if v_h is null and v_w is null then raise exception 'body_info_empty' using errcode = '22023'; end if;
  if v_h is not null and (v_h < 100 or v_h > 230) then raise exception 'body_height_range' using errcode = '22023'; end if;
  if v_w is not null and (v_w < 25 or v_w > 250) then raise exception 'body_weight_range' using errcode = '22023'; end if;

  insert into public.member_body_logs (user_id, measured_on, height_cm, weight_kg)
  values (v_uid, v_today, v_h, v_w)
  on conflict (user_id, measured_on) do update
     set height_cm = coalesce(excluded.height_cm, member_body_logs.height_cm),
         weight_kg = coalesce(excluded.weight_kg, member_body_logs.weight_kg),
         updated_at = now();

  return public.get_my_body_info();
end;
$$;
revoke all on function public.save_my_body_info(numeric, numeric) from public, anon;
grant execute on function public.save_my_body_info(numeric, numeric) to authenticated;
