-- 운동시간 규칙 상수 조회 (2026-09-22)
--
-- 가이드 "레벨 40까지 가는 길" 페이지가 쓴다. 숫자를 프론트에 박지 않고 서버 함수에서 읽어
-- 승급 판정(workout_progress · workout_xp · workout_default_minutes)과 어긋나지 않게 한다.
--   · defaultMinutes  — 종료를 안 누르면 기록되는 분 (workout_default_minutes)
--   · bonusCapMinutes — 진행량이 더 오르지 않는 첫 분. workout_progress 정의가 바뀌면 자동으로 따라간다.
--   · maxProgress     — 한 번 출석의 최대 진행량 (지금 1.25)
--   · xpDefault/xpMax — 기본 XP · 최대 XP
--   · maxSessionHours — 이보다 길면 기본값으로 기록 (workout_minutes 의 interval '4 hours' 와 같아야 한다)

create or replace function public.get_workout_rules()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with cap as (
    select min(m) as minutes
      from generate_series(public.workout_default_minutes(), 600) as m
     where public.workout_progress(m) >= public.workout_progress(600)
  )
  select jsonb_build_object(
    'defaultMinutes',  public.workout_default_minutes(),
    'bonusCapMinutes', (select minutes from cap),
    'maxProgress',     public.workout_progress(600),
    'xpDefault',       public.workout_xp(public.workout_default_minutes()),
    'xpMax',           public.workout_xp(600),
    'maxSessionHours', 4
  );
$$;
revoke all on function public.get_workout_rules() from public;
grant execute on function public.get_workout_rules() to anon, authenticated;
