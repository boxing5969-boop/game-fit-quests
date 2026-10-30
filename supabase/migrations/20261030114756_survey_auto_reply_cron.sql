-- 만족도 조사 자동 답변 크론 (2026-10-30) — 15분마다 Edge Function survey-auto-reply (x-auto-key). 함수 배포·시험(dry_run) 뒤에 켠다.

select cron.unschedule('survey-auto-reply') where exists (select 1 from cron.job where jobname = 'survey-auto-reply');
select cron.schedule(
  'survey-auto-reply',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://whnczhxyjmyywhlfbgsd.supabase.co/functions/v1/survey-auto-reply',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-auto-key', (select value from public.internal_sync_config where key = 'auto_sync_key')
    ),
    body := jsonb_build_object('source', 'cron'),
    timeout_milliseconds := 60000
  );
  $$
);
