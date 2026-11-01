-- 153OS 앱 알림 받기 크론 (2026-11-02) — 매분 Edge Function os-push-pull (x-auto-key).
--   함수 배포 · 시험(dry_run · probe_user) 뒤, 앱 화면(공지사항 · 우리 지점 · 1:1 문의)이 main 에 올라간 뒤에 켠다
--   (알림 링크 /notices · /branch · /inquiries 가 앱에 있어야 해서).
--   끄기: select cron.unschedule('os-push-pull');

select cron.unschedule('os-push-pull') where exists (select 1 from cron.job where jobname = 'os-push-pull');
select cron.schedule(
  'os-push-pull',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://whnczhxyjmyywhlfbgsd.supabase.co/functions/v1/os-push-pull',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-auto-key', (select value from public.internal_sync_config where key = 'auto_sync_key')
    ),
    body := jsonb_build_object('source', 'cron'),
    timeout_milliseconds := 60000
  );
  $$
);
