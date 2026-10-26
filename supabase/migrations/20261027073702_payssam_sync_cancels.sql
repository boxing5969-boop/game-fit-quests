-- 결제선생 관리자에서 취소한 결제 → 앱 · 153OS 되돌리기 (2026-10-27 대표님 시험 결제에서 드러남)
--   결제선생은 관리자 화면에서 승인 취소를 해도 콜백(payssam-callback, apprState=C)을 보내지 않는다
--   (9/18 첫 시험 결제 취소 · 10/27 장바구니 218,000원 취소 모두 승인 콜백 F 만 왔다).
--   Edge Function payssam-sync-cancels 가 '결제 완료' 주문을 결제선생 /bill/read 로 다시 조회해 apprState=C 면
--   주문 canceled → 항목 되돌리기(revert_payment_order) → 마일리지 돌려주기(트리거) → 153OS app_refund_paid_membership.
--   · 30분마다: 결제한 지 7일 안의 주문 (대부분의 취소는 결제 직후)
--   · 매일 05:20 KST: 400일 안의 주문 (수강 중 환불)
--   인증은 sync-rental-ends 와 같은 x-auto-key(internal_sync_config.auto_sync_key). 같은 이름이면 덮어쓴다.
select cron.schedule(
  'payssam-sync-cancels',
  '*/30 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://whnczhxyjmyywhlfbgsd.supabase.co/functions/v1/payssam-sync-cancels',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-auto-key', (SELECT value FROM public.internal_sync_config WHERE key = 'auto_sync_key')
    ),
    body := jsonb_build_object('source', 'cron', 'days', 7),
    timeout_milliseconds := 60000
  );
  $cron$
);

select cron.schedule(
  'payssam-sync-cancels-daily',
  '20 20 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://whnczhxyjmyywhlfbgsd.supabase.co/functions/v1/payssam-sync-cancels',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-auto-key', (SELECT value FROM public.internal_sync_config WHERE key = 'auto_sync_key')
    ),
    body := jsonb_build_object('source', 'cron-daily', 'days', 400),
    timeout_milliseconds := 120000
  );
  $cron$
);
