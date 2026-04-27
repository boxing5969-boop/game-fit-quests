-- ──────────────────────────────────────────────────────────────────
-- 153 다이어트 — 퀘스트 완료 이벤트 로그 (diet_quest_events)
--
-- 목적:
--   회원이 일일 미션을 완료할 때마다 1행씩 적재되는 이벤트 스토어.
--   기존 diet_daily_logs 는 "오늘의 마지막 상태" 만 저장하므로(컬럼 토글),
--   "언제·어떻게·얼마나 빠르게 완료했는지" 시계열 분석은 불가능.
--   본 테이블이 그 갭을 채워:
--     · 실제 완료 시점(completed_at) 기록 → 타이밍 등급(perfect/good/late) 산출
--     · 출처(source_kind) 분리 → habit 토글 / 사진 인증 / 수동 / 복귀 / 시스템 자동
--     · 점수 가산 로그 → base + bonus 분리 보존 → 후처리·랭킹 일관 계산 가능
--     · meta jsonb → 미래 확장(스파링 종류, 식단 카테고리 등) heap 없이 흡수
--
-- 보존 정책: 회원당 21일 × 평균 8 미션 ≈ 170행. 영구 보관 부담 없음.
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.diet_quest_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL,
  log_date      date NOT NULL,
  day_number    int  NOT NULL,
  mission_id    text NOT NULL,
  mission_label text NOT NULL,
  source_kind   text NOT NULL CHECK (source_kind IN ('habit','photo','manual','comeback','system')),
  meal_slot     text NULL,
  completed_at  timestamptz NOT NULL DEFAULT now(),
  timing_grade  text NOT NULL CHECK (timing_grade IN ('perfect','good','late')),
  base_score    int  NOT NULL DEFAULT 0,
  timing_bonus  int  NOT NULL DEFAULT 0,
  total_score   int  NOT NULL DEFAULT 0,
  meta          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── 인덱스 ────────────────────────────────────────────────────────
-- 회원 일자별 조회 (오늘 기록·주간 합산 용)
CREATE INDEX IF NOT EXISTS idx_diet_quest_events_user_date
  ON public.diet_quest_events (user_id, log_date);

-- enrollment 단위 조회 (21일 누적·코치 인박스 용)
CREATE INDEX IF NOT EXISTS idx_diet_quest_events_enrollment_date
  ON public.diet_quest_events (enrollment_id, log_date);

-- ── RLS ───────────────────────────────────────────────────────────
ALTER TABLE public.diet_quest_events ENABLE ROW LEVEL SECURITY;

-- 본인 + 지점 매니저 + super_admin 만 읽기
DROP POLICY IF EXISTS diet_quest_events_read ON public.diet_quest_events;
CREATE POLICY diet_quest_events_read
  ON public.diet_quest_events FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_branch_manager_of(auth.uid(), user_id)
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- 본인만 직접 INSERT (system source 도 RPC 경유 권장이지만 클라이언트 직삽입 허용)
DROP POLICY IF EXISTS diet_quest_events_insert_own ON public.diet_quest_events;
CREATE POLICY diet_quest_events_insert_own
  ON public.diet_quest_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 본인 + 매니저 + super_admin 이 UPDATE 가능 (코치 보정 케이스 허용)
DROP POLICY IF EXISTS diet_quest_events_update ON public.diet_quest_events;
CREATE POLICY diet_quest_events_update
  ON public.diet_quest_events FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_branch_manager_of(auth.uid(), user_id)
    OR public.has_role(auth.uid(), 'super_admin')
  );

COMMENT ON TABLE  public.diet_quest_events IS '153 다이어트 — 일일 미션 완료 이벤트 로그(시계열). 점수·타이밍·출처 분리 보존.';
COMMENT ON COLUMN public.diet_quest_events.source_kind  IS 'habit(체크박스) | photo(사진 인증) | manual(직접 추가) | comeback(복귀 미션) | system(자동)';
COMMENT ON COLUMN public.diet_quest_events.timing_grade IS 'perfect(시간 안) | good(약간 늦음) | late(임계 초과). 산출 로직은 점수 엔진 참조.';
COMMENT ON COLUMN public.diet_quest_events.total_score  IS 'base_score + timing_bonus. 후처리 랭킹은 이 컬럼 합산.';
