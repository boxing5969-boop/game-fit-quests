-- 지도진 명단 동기화 크론 (2026-09-23)
--
-- 153OS staff_work_profiles(활성 지도진) → 앱 profiles.is_staff / staff_title / membership_end(무제한).
-- 에지 함수 sync-staff-to-app 를 매시 25분에 부른다. 인증 키는 auto-sync-members 와 같은
-- internal_sync_config.auto_sync_key 를 실행 시점에 읽는다 — 이 파일에 비밀은 없다.
-- 재적용 안전: 같은 이름의 작업이 있으면 먼저 내린다.
select cron.unschedule(jobid) from cron.job where jobname = 'sync-staff-to-app';

select cron.schedule(
  'sync-staff-to-app',
  '25 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://whnczhxyjmyywhlfbgsd.supabase.co/functions/v1/sync-staff-to-app',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-auto-key', (SELECT value FROM public.internal_sync_config WHERE key = 'auto_sync_key')
    ),
    body := jsonb_build_object('source', 'cron'),
    timeout_milliseconds := 60000
  );
  $$
);
