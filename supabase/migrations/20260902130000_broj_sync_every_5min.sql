-- 브로제이 출석 동기화 주기를 10분 → 5분으로 단축.
--
-- 배경 (2026-09-02, 대표님 요청):
--   회원이 입구에서 얼굴을 찍어도 라이브보드에 뜨기까지 최대 10분이 걸렸다.
--   브로제이는 실시간 웹훅을 주지 않으므로 우리가 주기적으로 당겨오는 수밖에 없고,
--   그 주기가 곧 체감 지연이다. (앱 DB 에 들어간 뒤로는 Realtime 이라 1초 이내)
--
--   5분으로 줄이면 체감 지연 평균 2.5분 / 최대 5분.
--   함수 자체는 source_ref 유니크 upsert 라 같은 구간을 다시 훑어도 안전하고,
--   실행 시간도 1초 미만이라 겹칠 일이 없다.
--
-- 주의: cron.alter_job 은 command 를 건드리지 않는다 — 스케줄만 바꾼다.
do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'sync-broj-checkins';
  if v_jobid is null then
    raise notice 'sync-broj-checkins 크론이 없어 건너뜀';
  else
    perform cron.alter_job(job_id := v_jobid, schedule := '*/5 * * * *');
  end if;
end $$;
