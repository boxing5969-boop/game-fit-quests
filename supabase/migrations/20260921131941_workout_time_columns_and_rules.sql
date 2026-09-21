-- 운동시간 기록 — 기초 구조와 판정 규칙.
--
-- 설계 배경 (2026-09-21 대표님 결정):
--   · 시작 = 얼굴 인식 출석 시각. 회원이 시작 버튼을 누를 일이 없다(잊어도 안 놓친다).
--   · 종료 = 회원이 앱에서 직접 누름. 대다수(96.6%)는 안 누를 것을 전제로 한다.
--   · 확인된 사실: 브로제이 얼굴 인식기는 ENTRY 만 보낸다(14,300건 중 퇴장 0건).
--     그래서 퇴장은 앱에서 받는 수밖에 없다.
--   · 랭킹 욕심 있는 10~20% 를 위한 선택 기능. 나머지는 50분 기본값을 받는다.
--
-- 기존 파이프라인 영향 없음:
--   sync-broj-checkins 는 upsert(onConflict=source_ref, ignoreDuplicates=true) 로
--   이미 있는 행을 갱신하지 않는다 → 아래 컬럼이 동기화로 지워지지 않는다.

alter table public.attendance_logs
  add column if not exists ended_at timestamptz,
  add column if not exists ended_source text,
  add column if not exists at_gym_verified boolean;

comment on column public.attendance_logs.ended_at is
  '회원이 앱에서 누른 운동 종료 시각. NULL = 안 누름(50분 기본값으로 본다).';
comment on column public.attendance_logs.ended_source is
  '종료 경로: member_app | auto_midnight. 누가 닫았는지 구분용.';
comment on column public.attendance_logs.at_gym_verified is
  '종료 시각에 위치가 지점 근처였는지. 표시용 배지일 뿐 — 이 값으로 기록을 막지 않는다.';

-- 종료 누른 행만 빠르게 찾는다(자정 마감 배치·랭킹 집계용).
create index if not exists idx_attendance_open_session
  on public.attendance_logs (user_id, checked_in_at)
  where ended_at is null;

-- ── 판정 규칙을 한 곳에 모은다 ──────────────────────────────────────────────
-- 규칙이 흩어지면 화면·랭킹·리포트가 서로 다른 숫자를 말하게 된다.

-- 한 타임(수업 1회) = 50분. 종료를 안 눌렀거나 값을 믿을 수 없을 때의 기본값.
create or replace function public.workout_default_minutes()
returns integer language sql immutable as $$ select 50 $$;

/** 운동시간(분) 판정.
    · 종료 안 누름            → 50분 (한 타임)
    · 시각 역전(기기 오차)    → 50분
    · 4시간 초과              → 50분 (신뢰 불가. 아침에 왔다 저녁에 또 온 경우가 실제로 있다)
    · 그 밖에                 → 실제 시간, 단 바닥은 50분
      바닥을 두는 이유: 종료를 누른 사람이 안 누른 사람보다 불리해지면
      아무도 누르지 않는다. 눌러서 손해 보는 일은 없어야 한다. */
create or replace function public.workout_minutes(
  p_started timestamptz,
  p_ended   timestamptz
) returns integer
language sql immutable
as $$
  select case
    when p_started is null then public.workout_default_minutes()
    when p_ended   is null then public.workout_default_minutes()
    when p_ended  <= p_started then public.workout_default_minutes()
    when p_ended - p_started > interval '4 hours' then public.workout_default_minutes()
    else greatest(
      public.workout_default_minutes(),
      ceil(extract(epoch from (p_ended - p_started)) / 60.0)::int
    )
  end;
$$;

/** 운동시간 XP — 10분당 1 XP, 90분에서 끊는다(최대 9).
    90분 상한을 두는 이유: 시간으로 보상하면 라운지에 앉아만 있어도 쌓인다.
    상한이 있으면 그 이상 머무는 데 보상이 없어 눌러앉을 이유가 사라진다.
    승급 보상(+50 XP)과의 균형: 화이트 3회 출석 = 1레벨이므로 참여 보상이
    승급 보상을 넘지 않는다. */
create or replace function public.workout_xp(p_minutes integer)
returns integer
language sql immutable
as $$
  select greatest(0, least(coalesce(p_minutes, 0), 90) / 10);
$$;

comment on function public.workout_minutes(timestamptz, timestamptz) is
  '운동시간 판정의 유일한 출처. 화면·랭킹·리포트가 모두 이 함수를 쓴다.';
comment on function public.workout_xp(integer) is
  '운동시간 XP. 10분당 1, 90분 상한(최대 9).';

grant execute on function public.workout_default_minutes() to anon, authenticated;
grant execute on function public.workout_minutes(timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.workout_xp(integer) to anon, authenticated;
