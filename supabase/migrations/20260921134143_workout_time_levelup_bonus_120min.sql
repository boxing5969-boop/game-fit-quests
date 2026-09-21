-- 운동시간 승급 보너스 (2026-09-21 대표님 결정: 1.25배, 상한 120분).
--
-- 왜 "요건을 깎기" 가 아니라 "진행을 더 쌓기" 인가:
--   출석 요건이 정수(화이트 3 · 블루 5 · 레드 8 · 블랙 20)라서 0.5회를 깎을 수 없다.
--   한 회를 깎으면 화이트는 33% 빨라지는데 블랙은 5% 빨라진다 — 같은 "한 회"가
--   리그마다 여섯 배 다른 의미가 된다. 그래서 한 번 출석이 시간에 따라
--   1.0 ~ 1.25 회로 쌓이게 하고, 요건은 그대로 둔다.
--
-- 1.25배가 만드는 실제 효과 (120분씩 꾸준히 하는 회원):
--   화이트 3회 → 3회   (0%   — 신입은 기본 속도로 배운다. 예외 규칙 없이 자동으로 이렇게 된다)
--   블루   5회 → 4회   (20%)
--   레드   8회 → 7회   (12.5%)
--   블랙  20회 → 16회  (20%. 단 레벨마다 45일 연한은 그대로 — 블랙의 권위를 지킨다)
--
-- 상한을 120분으로 둔 이유: 대표님 표현대로 "1시간 하신 분도 2시간 하신 분도" 있는데,
-- 90분에서 끊으면 2시간 하신 분이 90분과 같아진다. 120분이면 그분들이 정확히 커버되고,
-- 그 이상은 더 안 쌓이므로 라운지에 눌러앉을 유인도 생기지 않는다.
--
-- 소급 적용 위험 없음: 지금까지 종료를 누른 회원이 0명이라 기존 출석 12,910건은
-- 전부 1.0 으로 계산된다. 이 규칙을 넣어도 과거 기록으로 갑자기 승급하는 회원이 없다.

/** 출석 1회가 쌓이는 진행량. 50분=1.00, 120분 이상=1.25 (그 사이는 비례).
    numeric 을 쓰는 이유 — 4회 × 1.25 가 정확히 5.00 이 되어야 블루가 4회에 열린다. */
create or replace function public.workout_progress(p_minutes integer)
returns numeric
language sql immutable
as $$
  select 1.0 + (least(greatest(coalesce(p_minutes, 50), 50), 120) - 50)::numeric / 280;
$$;

comment on function public.workout_progress(integer) is
  '운동시간 → 출석 진행량(1.00~1.25). 승급 판정의 유일한 보너스 출처.';

-- XP 상한도 120분으로 맞춘다. 숫자가 두 개면 회원에게 설명이 안 된다.
-- 10분당 1 XP, 최대 12.
create or replace function public.workout_xp(p_minutes integer)
returns integer
language sql immutable
as $$
  select greatest(0, least(coalesce(p_minutes, 0), 120) / 10);
$$;

comment on function public.workout_xp(integer) is
  '운동시간 XP. 10분당 1, 120분 상한(최대 12).';

grant execute on function public.workout_progress(integer) to anon, authenticated;

-- ── auto_advance_from_attendance 의 집계 블록만 교체한다 ────────────────────
-- 함수 본문이 130줄이라 손으로 옮기면 오타가 난다. 기존 본문을 읽어 해당 블록만
-- 치환하고 다시 심는다. 찾지 못하면 예외를 던져 아무것도 바꾸지 않는다.
do $outer$
declare
  _src text;
  _old text;
  _new text;
begin
  select p.prosrc into _src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'auto_advance_from_attendance';

  if _src is null then
    raise exception 'GUARD FAIL: auto_advance_from_attendance 가 없다';
  end if;

  _old := $blk$    select count(*) into _visits
    from attendance_logs
    where user_id = _user_id
      and coalesce(is_duplicate, false) = false
      and checked_in_at >= coalesce(_p.level_started_at, now() - interval '3650 days');$blk$;

  _new := $blk$    -- 출석 "횟수" 가 아니라 "진행량" 을 센다.
    -- 운동시간이 길면 한 번이 최대 1.25회로 쌓인다(workout_progress).
    -- floor 를 쓰는 이유: 요건을 실제로 다 채워야 열린다. 4.75 는 5회가 아니다.
    select floor(coalesce(sum(
             public.workout_progress(
               public.workout_minutes(a.checked_in_at, a.ended_at))), 0))::int
      into _visits
    from attendance_logs a
    where a.user_id = _user_id
      and coalesce(a.is_duplicate, false) = false
      and a.checked_in_at >= coalesce(_p.level_started_at, now() - interval '3650 days');$blk$;

  if position(_old in _src) = 0 then
    raise exception 'GUARD FAIL: 기존 집계 블록을 찾지 못했다 — 함수가 그사이 바뀌었다';
  end if;

  execute format(
    'create or replace function public.auto_advance_from_attendance(_user_id uuid) '
    'returns jsonb language plpgsql security definer set search_path = public as %L',
    replace(_src, _old, _new));
end;
$outer$;
