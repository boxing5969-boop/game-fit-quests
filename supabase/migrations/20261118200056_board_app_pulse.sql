-- 라이브보드 TV 2번 「마이복서153 가치 전달」 화면의 숫자 (2026-11-18 대표님 「사이니지에 현재 시상식 … 한줄로 작게 만들어주고
-- 마이복서153 가치전달하는 영상을 돌리자 1분 간격으로」)
--
--   board_app_pulse(지점, TV 열쇠) — TV 는 로그인이 없다. 열쇠는 다른 board_* 와 같은 _board_branch_ok.
--   돌려주는 것(모두 합계 — 사람 이름 · 아이디는 내보내지 않는다):
--     · 지난 28일 이 지점 회원님(순위에 드는 회원 — 코치님 · 운영진 · 체험 · 합쳐진 계정 빼고)의
--       운동한 회원 수 · 출석한 날 수 · 운동 시간(분 — 날마다 첫 출석 하나, 운동 달력 _cal_minutes_between 과 같은 셈) ·
--       레벨업 · 운동으로 쌓인 마일리지(수상자 축하 board_launch_awards 와 같은 kind)
--     · 규칙: 마일리지(app_settings.mileage_rules) · 리그마다 한 레벨 출석 수(get_levelup_rules)
--     · 이 지점에서 켠 기능: 운동 약속(+ 다시 시작 보너스 · 코치 한마디) · 153 마켓(+ 상품 수) · 날씨 도장
--   화면은 숫자가 작으면(회원 10명 아래 등) 그리지 않는다(src/lib/appValueReel.ts) — 여기는 센 값을 그대로.
--   새 함수 하나 — 표 · 다른 함수 · 권한은 그대로. 줄을 지우는 문장이 없다.
--   volatile(다른 board_* 와 같이) — _board_branch_ok 가 대기 열쇠로 처음 연 TV 의 열쇠를 저장한다.
--   stable 이면 API 가 읽기 전용으로 불러, 그 TV 의 첫 부름이 이 함수일 때 막힌다.
create or replace function public.board_app_pulse(p_branch text, p_key text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_name text := public._board_branch_ok(p_branch, p_key);
  v_since timestamptz := now() - interval '28 days';
  v_ids uuid[] := '{}'::uuid[];
  v_members integer := 0;
  v_visits integer := 0;
  v_minutes bigint := 0;
  v_level_ups integer := 0;
  v_points bigint := 0;
  v_rules jsonb;
  v_levels jsonb := '[]'::jsonb;
  v_promise jsonb;
  v_promise_on boolean := false;
  v_bonus integer;
  v_weather_on boolean := false;
  v_market_on boolean := false;
  v_market_count integer := 0;
begin
  if v_name is null then
    return null;
  end if;

  select coalesce(array_agg(p.user_id), '{}'::uuid[]) into v_ids
    from public.profiles p
   where p.branch_name = v_name
     and public._is_rankable_member(p.user_id);

  select count(distinct d.user_id), count(*), coalesce(sum(public.workout_minutes(d.checked_in_at, d.ended_at)), 0)
    into v_members, v_visits, v_minutes
    from (
      select distinct on (a.user_id, (a.checked_in_at at time zone 'Asia/Seoul')::date)
             a.user_id, a.checked_in_at, a.ended_at
        from public.attendance_logs a
       where a.user_id = any (v_ids)
         and not coalesce(a.is_duplicate, false)
         and a.checked_in_at is not null
         and a.checked_in_at >= v_since
       order by a.user_id, (a.checked_in_at at time zone 'Asia/Seoul')::date, a.checked_in_at
    ) d;

  select count(*) filter (where l.kind = 'level_up' and l.amount > 0),
         coalesce(sum(l.amount) filter (
           where l.kind in ('attendance', 'level_up', 'milestone', 'record', 'title_match', 'pt') and l.amount > 0), 0)
    into v_level_ups, v_points
    from public.mileage_ledger l
   where l.user_id = any (v_ids)
     and l.created_at >= v_since;

  select s.value::jsonb into v_rules from public.app_settings s where s.key = 'mileage_rules';
  v_rules := coalesce(v_rules, '{}'::jsonb);

  begin
    select coalesce(jsonb_agg(jsonb_build_object(
             'rank', r ->> 'rank',
             'visits', case when (r ->> 'visitsPerLevel') ~ '^\d{1,3}$' then (r ->> 'visitsPerLevel')::int end,
             'auto', coalesce(r ->> 'autoAdvance', 'false') = 'true',
             'first', case when (r ->> 'firstLevel') ~ '^\d{1,2}$' then (r ->> 'firstLevel')::int end,
             'last', case when (r ->> 'lastLevel') ~ '^\d{1,2}$' then (r ->> 'lastLevel')::int end)
             order by case when (r ->> 'firstLevel') ~ '^\d{1,2}$' then (r ->> 'firstLevel')::int end), '[]'::jsonb)
      into v_levels
      from jsonb_array_elements(public.get_levelup_rules()) r;
  exception when others then
    v_levels := '[]'::jsonb;
  end;

  select s.value::jsonb into v_promise from public.app_settings s where s.key = 'promise_pilot';
  v_promise_on := exists (
    select 1 from jsonb_array_elements_text(coalesce(v_promise -> 'branches', '[]'::jsonb)) b where b = v_name);
  v_bonus := case when v_promise_on and (v_promise ->> 'return_bonus') ~ '^\d{1,6}$'
                  then (v_promise ->> 'return_bonus')::int end;

  v_weather_on := exists (
    select 1
      from jsonb_array_elements(coalesce(
             (select s.value::jsonb -> 'sites' from public.app_settings s where s.key = 'weather_sites'),
             '[]'::jsonb)) w
     where w ->> 'branch' = v_name);

  begin
    v_market_on := coalesce(public._market_branch_on(v_name), false);
    if v_market_on then
      select count(*) into v_market_count
        from public.market_products p
       where p.is_active
         and not coalesce(p.sold_out, false)
         and (p.branches is null or v_name = any (p.branches));
    end if;
  exception when others then
    v_market_on := false;
    v_market_count := 0;
  end;

  return jsonb_build_object(
    'branch', v_name,
    'days', 28,
    'members', v_members,
    'visits', v_visits,
    'minutes', v_minutes,
    'level_ups', v_level_ups,
    'points', v_points,
    'rules', jsonb_build_object(
      'mileage', jsonb_build_object(
        'enabled', coalesce(v_rules ->> 'enabled', 'false') = 'true',
        'attendance', case when (v_rules ->> 'attendance') ~ '^\d{1,7}$' then (v_rules ->> 'attendance')::int end,
        'level_up', case when (v_rules ->> 'level_up') ~ '^\d{1,7}$' then (v_rules ->> 'level_up')::int end,
        'title_match', case when (v_rules ->> 'title_match') ~ '^\d{1,7}$' then (v_rules ->> 'title_match')::int end,
        'record', case when (v_rules ->> 'record') ~ '^\d{1,7}$' then (v_rules ->> 'record')::int end),
      'levels', v_levels),
    'features', jsonb_build_object(
      'promise', v_promise_on,
      'return_bonus', v_bonus,
      'weather', v_weather_on,
      'market', v_market_on and v_market_count > 0,
      'market_count', v_market_count));
end;
$function$;

revoke all on function public.board_app_pulse(text, text) from public;
grant execute on function public.board_app_pulse(text, text) to anon, authenticated, service_role;
