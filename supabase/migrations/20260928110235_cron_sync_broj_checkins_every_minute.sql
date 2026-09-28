-- 2026-09-28 대표님 승인: 얼굴 인식(브로제이) 출석 → 앱 동기화 주기 5분 → 1분.
-- 라이브보드에 이름이 뜨기까지 앱 쪽 대기(최대 5분, 평균 약 4.7분)를 줄인다. 한 번 실행에 약 2초라 1분 주기로 겹치지 않는다.
-- 출석·XP·자동 승급 규칙과 함수 본문(sync-broj-checkins)은 그대로 — 실행 간격만 바꾼다.
select cron.alter_job(
  job_id   := (select jobid from cron.job where jobname = 'sync-broj-checkins'),
  schedule := '* * * * *'
);