-- 앱 마일리지 (2026-09-28, 대표님 지시)
-- 출석(하루 1번 인정 출석) 500 · 레벨업 500 · 레벨 10 타이틀매치 통과 5,000.
-- 브로제이 공개 API 에는 마일리지 적립 기능이 없어(잔액 조회만 가능) 앱에 먼저 쌓는다.
-- 브로제이가 적립 API 를 열면 broj_synced_at 이 비어 있는 내역을 넘긴다.
--  · 금액·사용 여부는 app_settings.mileage_rules 한 곳에서 정한다(설정 화면 · 관리자, set_app_setting).
--  · 켠 시각(since) 이후의 출석·레벨업만 쌓는다(소급 없음). 지도진(is_staff)은 제외.
--  · 레벨업·타이틀매치는 레벨 심사 기록(level_status)이 방금 승인/통과로 바뀐 경우만 인정한다 —
--    관리자 레벨 보정·계정 병합처럼 기록 없이 레벨만 바뀌는 경우엔 쌓지 않는다.
--  · 같은 날 출석 · 같은 레벨 · 같은 리그 타이틀매치는 한 번만(idem_key 유니크).

create table if not exists public.mileage_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  kind text not null check (kind in ('attendance', 'level_up', 'title_match', 'adjust')),
  reason text not null,
  idem_key text not null unique,
  ref_id uuid,
  created_at timestamptz not null default now(),
  broj_synced_at timestamptz
);
create index if not exists mileage_ledger_user_idx on public.mileage_ledger (user_id, created_at desc);
alter table public.mileage_ledger enable row level security;
revoke all on table public.mileage_ledger from anon, authenticated;
grant select on table public.mileage_ledger to authenticated;
drop policy if exists "own mileage read" on public.mileage_ledger;
create policy "own mileage read" on public.mileage_ledger
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "staff mileage read" on public.mileage_ledger;
create policy "staff mileage read" on public.mileage_ledger
  for select to authenticated
  using (public.has_role((select auth.uid()), 'super_admin') or public.has_role((select auth.uid()), 'admin')
         or public.is_same_branch(user_id));

insert into public.app_settings (key, value, updated_at)
values ('mileage_rules',
        jsonb_build_object('enabled', true, 'attendance', 500, 'level_up', 500, 'title_match', 5000,
                           'since', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
        now())
on conflict (key) do nothing;

-- 현재 규칙 금액 (꺼져 있으면 0)
create or replace function public.mileage_rule(_kind text)
returns integer
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce((
    select case when coalesce((s.value ->> 'enabled')::boolean, false)
                then coalesce((s.value ->> _kind)::integer, 0) else 0 end
      from public.app_settings s where s.key = 'mileage_rules'), 0);
$function$;

-- 적립 (중복 키면 무시). 트리거·서버 함수만 부른다.
create or replace function public.grant_mileage(_user_id uuid, _kind text, _amount integer, _reason text,
                                                _idem_key text, _ref_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if _user_id is null or coalesce(_amount, 0) = 0 or coalesce(_idem_key, '') = '' then
    return false;
  end if;
  if exists (select 1 from public.profiles where user_id = _user_id and coalesce(is_staff, false)) then
    return false;
  end if;
  insert into public.mileage_ledger (user_id, amount, kind, reason, idem_key, ref_id)
  values (_user_id, _amount, _kind, _reason, _idem_key, _ref_id)
  on conflict (idem_key) do nothing;
  return found;
end;
$function$;

create or replace function public.mileage_league_ko(_rank text)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $function$
  select case _rank when 'white' then '화이트' when 'blue' then '블루' when 'red' then '레드'
                    when 'black' then '블랙' else coalesce(_rank, '') end;
$function$;

-- ① 출석: 그날 인정 출석(is_duplicate=false) 행이 들어올 때 하루 한 번
create or replace function public.mileage_on_attendance()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  _amt integer;
  _since timestamptz;
  _day date;
begin
  if new.user_id is null or coalesce(new.is_duplicate, false) or new.checked_in_at is null then
    return null;
  end if;
  select (value ->> 'since')::timestamptz into _since from public.app_settings where key = 'mileage_rules';
  if _since is null or new.checked_in_at < _since or new.checked_in_at > now() + interval '1 day' then
    return null;
  end if;
  if not exists (select 1 from public.member_progress where user_id = new.user_id) then
    return null;
  end if;
  _amt := public.mileage_rule('attendance');
  if _amt <= 0 then
    return null;
  end if;
  _day := (new.checked_in_at at time zone 'Asia/Seoul')::date;
  perform public.grant_mileage(new.user_id, 'attendance', _amt,
    '출석 (' || to_char(_day, 'MM.DD') || ')',
    'attendance:' || new.user_id::text || ':' || _day::text, new.id);
  return null;
end;
$function$;

drop trigger if exists mileage_on_attendance on public.attendance_logs;
create trigger mileage_on_attendance
  after insert on public.attendance_logs
  for each row execute function public.mileage_on_attendance();

-- ② 레벨업 · ③ 타이틀매치: member_progress 가 바뀔 때, 방금 승인/통과된 심사 기록이 있어야 인정
create or replace function public.mileage_on_progress()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  _amt integer;
begin
  -- 타이틀매치 통과 — 보스(타이틀매치) 1회 증가 + 그 리그 L10 심사가 방금 통과(boss_cleared)
  if new.bosses_cleared = old.bosses_cleared + 1
     and exists (select 1 from public.level_status ls
                  where ls.user_id = new.user_id and ls.rank_name = old.current_rank and ls.level_number = 10
                    and ls.status = 'boss_cleared' and ls.completed_at >= now() - interval '5 minutes') then
    _amt := public.mileage_rule('title_match');
    if _amt > 0 then
      perform public.grant_mileage(new.user_id, 'title_match', _amt,
        '타이틀매치 승급 (' || public.mileage_league_ko(old.current_rank::text) || ' 리그 L10)',
        'title:' || new.user_id::text || ':' || old.current_rank::text, null);
    end if;
    return null;
  end if;

  -- 레벨업 — 같은 리그에서 한 단계 + 그 레벨 심사가 방금 승인(approved)
  if new.current_rank = old.current_rank and new.current_level = old.current_level + 1
     and exists (select 1 from public.level_status ls
                  where ls.user_id = new.user_id and ls.rank_name = old.current_rank
                    and ls.level_number = old.current_level
                    and ls.status in ('approved', 'boss_cleared')
                    and ls.completed_at >= now() - interval '5 minutes') then
    _amt := public.mileage_rule('level_up');
    if _amt > 0 then
      perform public.grant_mileage(new.user_id, 'level_up', _amt,
        '레벨업 (' || public.mileage_league_ko(new.current_rank::text) || ' L' || new.current_level || ')',
        'level:' || new.user_id::text || ':' || new.current_rank::text || ':' || new.current_level, null);
    end if;
  end if;
  return null;
end;
$function$;

drop trigger if exists mileage_on_progress on public.member_progress;
create trigger mileage_on_progress
  after update of current_rank, current_level, bosses_cleared on public.member_progress
  for each row
  when (new.current_rank is distinct from old.current_rank
        or new.current_level is distinct from old.current_level
        or new.bosses_cleared is distinct from old.bosses_cleared)
  execute function public.mileage_on_progress();

-- 회원 앱: 내 마일리지 잔액·최근 내역·규칙
create or replace function public.get_my_mileage(p_limit integer default 20)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select jsonb_build_object(
    'balance', coalesce((select sum(m.amount) from public.mileage_ledger m where m.user_id = auth.uid()), 0),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('amount', x.amount, 'kind', x.kind, 'reason', x.reason, 'at', x.created_at)
                       order by x.created_at desc)
        from (select m.amount, m.kind, m.reason, m.created_at
                from public.mileage_ledger m
               where m.user_id = auth.uid()
               order by m.created_at desc
               limit greatest(1, least(coalesce(p_limit, 20), 100))) x), '[]'::jsonb),
    'rules', (select s.value - 'since' from public.app_settings s where s.key = 'mileage_rules')
  );
$function$;

revoke all on function public.mileage_rule(text) from public, anon, authenticated;
revoke all on function public.grant_mileage(uuid, text, integer, text, text, uuid) from public, anon, authenticated;
revoke all on function public.mileage_on_attendance() from public, anon, authenticated;
revoke all on function public.mileage_on_progress() from public, anon, authenticated;
revoke all on function public.get_my_mileage(integer) from public, anon;
grant execute on function public.get_my_mileage(integer) to authenticated;

-- 설정 저장(set_app_setting)에 마일리지 규칙 추가 — 관리자만, 형식 검사, 적립 시작 시각은 서버가 정한다.
create or replace function public.set_app_setting(_key text, _value jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_aud text;
  v_field text;
  v_letter jsonb;
  v_prev jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if not (public.has_role(v_uid, 'super_admin') or public.has_role(v_uid, 'admin')) then
    raise exception '권한이 없습니다';
  end if;
  -- app_settings 는 TV(anon)도 읽는다 → 정해진 키만 쓴다.
  if _key is null or _key not in ('launch_event', 'welcome_letters', 'mileage_rules') then
    raise exception '알 수 없는 설정입니다';
  end if;
  if _value is null or jsonb_typeof(_value) <> 'object' then
    raise exception '설정 형식이 올바르지 않습니다';
  end if;

  if _key = 'launch_event' then
    -- start_date 필수(YYYY-MM-DD), end_date 는 없거나 start 이후
    if (_value ->> 'start_date') is null or (_value ->> 'start_date')::date is null then
      raise exception '시작일이 필요합니다';
    end if;
    if (_value ->> 'end_date') is not null and (_value ->> 'end_date')::date < (_value ->> 'start_date')::date then
      raise exception '종료일은 시작일 이후여야 합니다';
    end if;
  elsif _key = 'welcome_letters' then
    -- { member?: {title, body, sign, cta}, coach?: {...} } — 빠진 대상은 앱 기본 편지를 쓴다.
    for v_aud in select jsonb_object_keys(_value) loop
      if v_aud not in ('member', 'coach') then
        raise exception '편지 대상은 회원(member)·코치(coach)만 가능합니다';
      end if;
      v_letter := _value -> v_aud;
      if jsonb_typeof(v_letter) <> 'object' then
        raise exception '편지 형식이 올바르지 않습니다';
      end if;
      for v_field in select jsonb_object_keys(v_letter) loop
        if v_field not in ('title', 'body', 'sign', 'cta') then
          raise exception '알 수 없는 편지 항목입니다: %', v_field;
        end if;
        if jsonb_typeof(v_letter -> v_field) <> 'string' then
          raise exception '편지 항목은 글자로 입력해 주세요: %', v_field;
        end if;
      end loop;
      if btrim(coalesce(v_letter ->> 'body', '')) = '' then
        raise exception '편지 본문을 입력해 주세요';
      end if;
      if char_length(coalesce(v_letter ->> 'title', '')) > 80
         or char_length(coalesce(v_letter ->> 'body', '')) > 3000
         or char_length(coalesce(v_letter ->> 'sign', '')) > 80
         or char_length(coalesce(v_letter ->> 'cta', '')) > 30 then
        raise exception '편지가 너무 깁니다 (제목 80자 · 본문 3000자 · 서명 80자 · 버튼 30자 이내)';
      end if;
    end loop;
  elsif _key = 'mileage_rules' then
    -- { enabled: bool, attendance: 정수, level_up: 정수, title_match: 정수 } — since 는 서버가 정한다.
    for v_field in select jsonb_object_keys(_value) loop
      if v_field not in ('enabled', 'attendance', 'level_up', 'title_match', 'since') then
        raise exception '알 수 없는 마일리지 항목입니다: %', v_field;
      end if;
    end loop;
    if jsonb_typeof(_value -> 'enabled') is distinct from 'boolean' then
      raise exception '마일리지 적립 사용 여부를 정해 주세요';
    end if;
    foreach v_field in array array['attendance', 'level_up', 'title_match'] loop
      if jsonb_typeof(_value -> v_field) is distinct from 'number'
         or (_value ->> v_field)::numeric <> trunc((_value ->> v_field)::numeric)
         or (_value ->> v_field)::numeric < 0
         or (_value ->> v_field)::numeric > 100000 then
        raise exception '마일리지는 0 ~ 100,000 사이의 정수로 입력해 주세요 (%)', v_field;
      end if;
    end loop;
    -- 켜져 있던 동안의 시작 시각은 유지하고, 꺼져 있다가 켜면 지금부터 적립한다(소급 없음).
    select s.value into v_prev from public.app_settings s where s.key = 'mileage_rules';
    _value := (_value - 'since') || jsonb_build_object('since',
      coalesce(case when coalesce((v_prev ->> 'enabled')::boolean, false) then v_prev ->> 'since' end,
               to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')));
  end if;

  insert into public.app_settings (key, value, updated_at, updated_by)
  values (_key, _value, now(), v_uid)
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by;
  return jsonb_build_object('ok', true, 'key', _key, 'value', _value);
end;
$function$;