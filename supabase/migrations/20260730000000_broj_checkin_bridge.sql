-- ============================================================
-- 브로제이 출입 → 마이복서153 라이브보드 자동 표시 (브리지)
--
-- 흐름:
--   브로제이 오픈API → 153OS(CRM) attendance_logs   [워커가 담당, 완료]
--   153OS attendance_logs → 앱 attendance_logs      [이 마이그레이션 + sync-broj-checkins]
--   앱 attendance_logs → LiveBoardPage              [기존 화면, 수정 불필요]
--
-- 원칙:
--   - method='broj' / xp_granted=0 로 기록한다. XP 는 앱 QR 체크인(qr-checkin)에서만 지급.
--   - qr-checkin Edge Function 과 XP·스트릭 로직은 일절 건드리지 않는다.
--   - 전화번호(숫자만)로 앱 회원을 찾고, 없으면 건너뛴다(계정을 임의 생성하지 않는다).
--   - source_ref 유니크로 같은 출입기록이 두 번 들어오지 않는다(재실행 안전).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ── 1) 출처 추적 컬럼 ────────────────────────────────────────
-- 'broj:<attendance_id>' 형태. QR 체크인 행은 NULL 이라 영향 없음.
ALTER TABLE public.attendance_logs
  ADD COLUMN IF NOT EXISTS source_ref text;

-- ⚠️ 부분 인덱스(WHERE source_ref IS NOT NULL)로 만들면 ON CONFLICT 추론에 쓸 수 없다.
--    일반 유니크 인덱스로 둔다 — Postgres 는 유니크 인덱스에서 NULL 중복을 허용하므로
--    source_ref 가 NULL 인 기존 QR 체크인 행에는 아무 제약이 걸리지 않는다.
CREATE UNIQUE INDEX IF NOT EXISTS attendance_logs_source_ref_uniq
  ON public.attendance_logs (source_ref);

COMMENT ON COLUMN public.attendance_logs.source_ref IS
  '외부 출처 기록 ID. 브로제이 출입은 broj:<attendance_id>. QR 체크인은 NULL.';

-- ── 2) 실행 이력 ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.broj_checkin_runs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ok         boolean NOT NULL DEFAULT false,
  scanned    integer DEFAULT 0,   -- CRM 에서 읽은 출입 건수
  inserted   integer DEFAULT 0,   -- 앱에 새로 기록한 건수
  skipped    integer DEFAULT 0,   -- 이미 있던 건수
  unmatched  integer DEFAULT 0,   -- 앱 회원을 못 찾은 건수(미가입자)
  error      text,
  ran_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.broj_checkin_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.broj_checkin_runs FROM PUBLIC, anon;

DROP POLICY IF EXISTS broj_checkin_runs_admin_read ON public.broj_checkin_runs;
CREATE POLICY broj_checkin_runs_admin_read ON public.broj_checkin_runs
  FOR SELECT TO authenticated
  USING (has_role((select auth.uid()), 'super_admin'::app_role)
      OR has_role((select auth.uid()), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_broj_checkin_runs_ran_at
  ON public.broj_checkin_runs (ran_at DESC);

-- ── 3) 스케줄 ───────────────────────────────────────────────
-- 체육관 운영시간(KST 06:00~24:00 = UTC 21:00~15:00)에 10분마다.
-- 내부키(internal_sync_config.auto_sync_key)로 자기 프로젝트 함수만 호출 — 외부 비밀키는 크론에 노출되지 않는다.
DO $$ BEGIN PERFORM cron.unschedule('sync-broj-checkins'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule('sync-broj-checkins', '*/10 * * * *', $job$
  SELECT net.http_post(
    url := 'https://whnczhxyjmyywhlfbgsd.supabase.co/functions/v1/sync-broj-checkins',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-auto-key', (SELECT value FROM public.internal_sync_config WHERE key = 'auto_sync_key')
    ),
    body := jsonb_build_object('days', 2),  -- 2일 창: 어제분(00:05 CRM 유입)도 포착
    timeout_milliseconds := 120000
  );
$job$);
