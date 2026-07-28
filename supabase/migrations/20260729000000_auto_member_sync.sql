-- ============================================================
-- 브로제이 → CRM(153OS) → 마이복서153 회원 자동 동기화
-- (2026-07-29 운영DB 적용·실행 검증 완료)
--
-- 구조:
--   브로제이 오픈API → 153OS(CRM) : 기존 워커가 담당(외부 레포)
--   153OS → 앱                    : sync-members-to-app Edge Function (기존)
--   자동 실행                      : pg_cron → auto-sync-members → sync-members-to-app
--
-- 보안 설계: 외부 비밀키(SYNC_KEY / OS_SERVICE_KEY)는 Edge Function 시크릿에만 존재.
--            크론은 DB에 생성된 내부키(internal_sync_config)로 자기 프로젝트 함수만 호출.
--            → 마이그레이션 파일이나 크론 정의에 비밀키가 남지 않는다.
--
-- 스케줄:
--   sync-new-members  */30 * * * *   신규 회원만 (force=false, limit 200)
--   sync-members-full 10 20 * * *    전체 갱신 (force=true, limit 1000) = 05:10 KST
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 내부 호출 키
CREATE TABLE IF NOT EXISTS public.internal_sync_config (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.internal_sync_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.internal_sync_config FROM PUBLIC, anon, authenticated;

INSERT INTO public.internal_sync_config (key, value)
VALUES ('auto_sync_key', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;

-- 실행 이력
CREATE TABLE IF NOT EXISTS public.member_sync_runs (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode     text NOT NULL,
  ok       boolean NOT NULL DEFAULT false,
  scanned  integer DEFAULT 0,
  created  integer DEFAULT 0,
  updated  integer DEFAULT 0,
  linked   integer DEFAULT 0,
  failed   integer DEFAULT 0,
  error    text,
  ran_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_sync_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_sync_runs FROM PUBLIC, anon;

DROP POLICY IF EXISTS member_sync_runs_admin_read ON public.member_sync_runs;
CREATE POLICY member_sync_runs_admin_read ON public.member_sync_runs
  FOR SELECT TO authenticated
  USING (has_role((select auth.uid()), 'super_admin'::app_role) OR has_role((select auth.uid()), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_member_sync_runs_ran_at ON public.member_sync_runs (ran_at DESC);

-- 스케줄 (재실행 안전)
DO $$ BEGIN PERFORM cron.unschedule('sync-new-members'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('sync-members-full'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule('sync-new-members', '*/30 * * * *', $job$
  SELECT net.http_post(
    url := 'https://whnczhxyjmyywhlfbgsd.supabase.co/functions/v1/auto-sync-members',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-auto-key', (SELECT value FROM public.internal_sync_config WHERE key = 'auto_sync_key')
    ),
    body := jsonb_build_object('force', false, 'limit', 200),
    timeout_milliseconds := 120000
  );
$job$);

SELECT cron.schedule('sync-members-full', '10 20 * * *', $job$
  SELECT net.http_post(
    url := 'https://whnczhxyjmyywhlfbgsd.supabase.co/functions/v1/auto-sync-members',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-auto-key', (SELECT value FROM public.internal_sync_config WHERE key = 'auto_sync_key')
    ),
    body := jsonb_build_object('force', true, 'limit', 1000),
    timeout_milliseconds := 150000
  );
$job$);
