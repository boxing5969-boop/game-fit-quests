-- 마일리지 적립이 출석 기록·레벨 승인을 절대 막지 않게 (2026-09-28, 20260928123751_app_mileage 보강)
--
-- 트리거 안에서 무엇이 실패해도(설정값 형식 오류 · 동시 삭제 등) 출석 행·레벨 변경은 그대로 저장되고
-- 적립만 건너뛴다(경고 로그). 출입 동기화 · QR 출석 · 레벨 승인이 마일리지 때문에 멈추는 일을 막는다.
-- 금액은 숫자형만 읽고(500.0 같은 표기도 정수로), 0 ~ 100,000 범위로 자른다.

create or replace function public.mileage_rule(_kind text)
returns integer
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce((
    select case
             when jsonb_typeof(s.value -> 'enabled') is distinct from 'boolean' then 0
             when not (s.value ->> 'enabled')::boolean then 0
             when jsonb_typeof(s.value -> _kind) is distinct from 'number' then 0
             else least(greatest(trunc((s.value ->> _kind)::numeric), 0), 100000)::integer
           end
      from public.app_settings s where s.key = 'mileage_rules'), 0);
$function$;

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
  begin
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
  exception when others then
    -- 적립 실패가 출석 저장을 막으면 안 된다 — 경고만 남기고 넘어간다.
    raise warning 'mileage_on_attendance skipped: % (%)', sqlerrm, sqlstate;
  end;
  return null;
end;
$function$;

create or replace function public.mileage_on_progress()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  _amt integer;
begin
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
  exception when others then
    -- 적립 실패가 레벨 승인·타이틀매치 결과 저장을 막으면 안 된다 — 경고만 남기고 넘어간다.
    raise warning 'mileage_on_progress skipped: % (%)', sqlerrm, sqlstate;
  end;
  return null;
end;
$function$;

revoke all on function public.mileage_rule(text) from public, anon, authenticated;
revoke all on function public.mileage_on_attendance() from public, anon, authenticated;
revoke all on function public.mileage_on_progress() from public, anon, authenticated;