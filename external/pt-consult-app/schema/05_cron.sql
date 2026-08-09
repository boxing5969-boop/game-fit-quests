-- =====================================================================
-- pt-consult-app / DISASTER-RECOVERY SCHEMA DUMP -- 05_cron.sql
-- =====================================================================
--   생성일       : 2026-08-08  (오늘 마이그레이션 5건 반영 후 재생성)
--   재확인       : 2026-08-09  (3차 덤프 시 cron.job 재조회 -- **변경 없음**.
--                  잡은 여전히 pt-daily-import 1개뿐이고 스케줄·명령·active 모두 동일.
--                  지문·얼굴 로그인(패스키)은 크론을 추가하지 않았다. 챌린지 청소는
--                  pt_wa_challenge_new 가 호출될 때마다 인라인으로 한다.)
--   소스 프로젝트: Supabase project ref  tbxdrfowanyksgdicryl
--   추출 쿼리    : select jobid, jobname, schedule, command, nodename, nodeport,
--                         database, username, active from cron.job
--
--   실행 순서: 01_tables -> 02_indexes -> 03_functions -> 04_grants_rls -> **05_cron**
--   (03_functions 가 먼저 있어야 pt_auto_import_all() 를 스케줄할 수 있다)
-- =====================================================================

-- pg_cron 확장은 **설치되어 있다**.
-- (설치된 확장 전체: pg_cron, pg_net, pg_stat_statements, pgcrypto, plpgsql,
--                    supabase_vault, uuid-ossp)
CREATE EXTENSION IF NOT EXISTS pg_cron;


-- ---------------------------------------------------------------------
-- 등록된 크론 잡 -- 전체 목록 (DB 전체에 단 1개뿐이며, 그 1개가 pt 잡이다)
-- ---------------------------------------------------------------------
--  jobid | jobname         | schedule   | command                            | active
--  ------+-----------------+------------+------------------------------------+-------
--    1   | pt-daily-import | 0 16 * * * | select public.pt_auto_import_all(); | true
--
--  nodename=localhost  nodeport=5432  database=postgres  username=postgres
--
-- ★ 스케줄은 **UTC 기준**이다. pg_cron 은 서버 타임존(Supabase = UTC)으로 돈다.
--    0 16 * * *  (UTC 16:00)  ==  한국시간(KST, UTC+9) **매일 새벽 01:00**.
--    "매일 새벽 1시 자동 임포트"가 의도된 동작이다.
--    복원 대상 DB 의 타임존이 UTC 가 아니라면 시각을 반드시 다시 계산할 것.
--
-- 이 잡이 하는 일:
--   pt_auto_import_all() -> pt_members/pt_coaches 에 존재하는 모든 branch 값을
--   모아 각 지점마다 pt_import_from_os(secret, branch, include_expired=true) 실행.
--   즉 153OS(경영리포트) memberships 에서 PT 상품 회원을 pt_members 로 동기화.
--
-- ★ 2026-08-08 변경 -- 실패 처리 방식이 바뀌었다 (중요)
--   이전: 한 지점이라도 실패하면 raise exception -> **트랜잭션 전체 롤백**.
--         즉 지점 하나가 깨지면 그날 전 지점 동기화가 통째로 날아갔다.
--   현재: 지점별 begin/exception 블록으로 격리한다. 실패한 지점은 결과 배열에
--         {ok:false, branch, error} 로 기록되고, 성공한 지점의 반영은 **살아남는다**.
--         또 _pt_branch_id(branch) 가 null 인 지점(경영리포트에 매핑되지 않는
--         지점 문자열)은 아예 루프에서 제외한다.
--   반환값: {ok, branches, succeeded, failed, results[]}
--           ok 는 failed=0 일 때만 true. 잡 자체는 예외를 던지지 않으므로
--           cron.job_run_details 에는 "성공"으로 남는다.
--   ==> 실패 감시는 job_run_details 만으로는 부족하다. 반환 JSON 의 failed 를
--       봐야 한다. 아래 확인 쿼리를 쓸 것.

-- 복원 시 실행:
SELECT cron.schedule('pt-daily-import', '0 16 * * *', 'select public.pt_auto_import_all();');

-- 참고: 재실행/변경 시 중복 등록을 피하려면 먼저 해제한다.
--   SELECT cron.unschedule('pt-daily-import');
-- 실행 이력 확인:
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
-- 지점별 실패 확인 (return_message 안의 JSON 을 본다):
--   SELECT start_time, status, return_message
--     FROM cron.job_run_details WHERE jobid = 1
--    ORDER BY start_time DESC LIMIT 5;

-- (끝)
