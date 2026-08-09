-- =====================================================================
-- pt-consult-app / DISASTER-RECOVERY SCHEMA DUMP -- 04_grants_rls.sql
-- =====================================================================
--   생성일       : 2026-08-08  (2차. 같은 날 추가 마이그레이션 3건 반영 후 재생성)
--   소스 프로젝트: Supabase project ref  tbxdrfowanyksgdicryl
--   출처         : pg_class(relrowsecurity/relforcerowsecurity), pg_policy,
--                  pg_class.relacl, pg_proc.proacl
--
--   실행 순서: 01_tables -> 02_indexes -> 03_functions -> **04_grants_rls** -> 05_cron
--
-- ---------------------------------------------------------------------
-- 이 앱의 보안 모델 (한 줄 요약)
-- ---------------------------------------------------------------------
--   pt_* 테이블 9개 + dashboard_users 전부 RLS ON + **정책 0개**  ==>
--   anon/authenticated 는 테이블에 직접 접근할 수 없다(전면 차단).
--   모든 읽기·쓰기는 SECURITY DEFINER RPC 를 통해서만 일어나고,
--   그 RPC 는 p_secret 을 시크릿 테이블과 대조한다.
--   즉 "정책이 없다"가 버그가 아니라 **의도된 deny-all 설계**다.
--   복원 시 RLS 를 켜는 것을 절대 빠뜨리지 말 것 -- 빠뜨리면 anon 이
--   PostgREST 로 pt_consults(개인정보)를 통째로 읽게 된다.
--
-- ---------------------------------------------------------------------
-- 2026-08-08 (2차) 이 파일에서 달라진 것
-- ---------------------------------------------------------------------
--   1. 신규 테이블 pt_tg_invites : RLS ON, 정책 0, anon/authenticated 권한 0,
--      service_role 만 ALL.  (다른 pt_* 테이블과 동일 정책)
--   2. 신규 함수 3개 pt_join_issue / pt_join_peek / pt_join_consume :
--      anon + authenticated + service_role EXECUTE.
--   3. 신규 헬퍼 _bot_admin_ok : postgres 만. anon/authenticated 에 주지 않는다.
--   4. dashboard_approve / dashboard_users_list 는 **시그니처가 바뀌었다**
--      (p_secret 추가). 아래 GRANT 는 새 시그니처 기준이다. 옛 시그니처
--      dashboard_approve(text,boolean) / dashboard_users_list() 는 DROP 됐다.
--   5. ★ pt_member_profile / pt_member_attendance 의 anon/authenticated
--      EXECUTE 가 **회수(REVOKE)** 됐다. 아래 (E) 1번 항목 참고.
-- =====================================================================


-- ---------------------------------------------------------------------
-- (A) RLS 상태 -- 실측값
-- ---------------------------------------------------------------------
--   relname            | relrowsecurity | relforcerowsecurity | policies
--   -------------------+----------------+---------------------+---------
--   dashboard_users    | true           | false               | 0
--   pt_admin_secret    | true           | false               | 0
--   pt_coaches         | true           | false               | 0
--   pt_consults        | true           | false               | 0
--   pt_logs            | true           | false               | 0
--   pt_members         | true           | false               | 0
--   pt_passes          | true           | false               | 0
--   pt_sessions        | true           | false               | 0
--   pt_tg_invites      | true           | false               | 0   ★신규
--   pt_tg_recipients   | true           | false               | 0

ALTER TABLE public.pt_admin_secret  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pt_coaches       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pt_consults      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pt_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pt_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pt_passes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pt_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pt_tg_invites    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pt_tg_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_users  ENABLE ROW LEVEL SECURITY;

-- FORCE ROW LEVEL SECURITY 는 어느 테이블에도 걸려 있지 않다(테이블 소유자 예외 유지).


-- ---------------------------------------------------------------------
-- (B) 정책(POLICY) -- **없음**
-- ---------------------------------------------------------------------
--   select count(*) from pg_policy p join pg_class c on c.oid=p.polrelid
--    where c.relname like 'pt\_%' or c.relname='dashboard_users'
--   --> 0 rows. (2026-08-08 2차 재확인)
--
--   pt_passes / pt_sessions 는 153OS 소속 테이블인데도 정책이 0개다.
--   153OS CRM 이 이 두 테이블을 클라이언트에서 직접 조회하려 한다면 지금은
--   빈 결과만 나온다. (아래 "이상 징후" 참고)


-- ---------------------------------------------------------------------
-- (C) 테이블 GRANT -- 실측값 (pg_class.relacl)
-- ---------------------------------------------------------------------
--   ACL 문자: a=INSERT r=SELECT w=UPDATE d=DELETE D=TRUNCATE x=REFERENCES
--             t=TRIGGER m=MAINTAIN(PG17+)
--
--   테이블            | postgres | anon      | authenticated | service_role
--   ------------------+----------+-----------+---------------+--------------
--   pt_admin_secret   | ALL      | (없음)    | (없음)        | rDxtm  (읽기만)
--   pt_coaches        | ALL      | (없음)    | (없음)        | ALL
--   pt_consults       | ALL      | (없음)    | (없음)        | ALL
--   pt_logs           | ALL      | (없음)    | (없음)        | ALL
--   pt_members        | ALL      | (없음)    | (없음)        | ALL
--   pt_passes         | ALL      | (없음)    | (없음)        | ALL
--   pt_sessions       | ALL      | (없음)    | (없음)        | ALL
--   pt_tg_invites     | ALL      | (없음)    | (없음)        | ALL   ★신규
--   pt_tg_recipients  | ALL      | (없음)    | (없음)        | ALL
--   dashboard_users   | ALL      | rDxtm     | ALL           | Dxtm  (★ SELECT 없음)
--
--   ※ Supabase 신규 테이블에 service_role 권한이 자동으로 붙지 않는 경우가 있다.
--     붙지 않으면 워커/엣지함수가 "permission denied for table ..." 로 죽는다.
--     복원 후 아래를 반드시 실행할 것.

GRANT ALL ON TABLE public.pt_coaches       TO service_role;
GRANT ALL ON TABLE public.pt_consults      TO service_role;
GRANT ALL ON TABLE public.pt_logs          TO service_role;
GRANT ALL ON TABLE public.pt_members       TO service_role;
GRANT ALL ON TABLE public.pt_passes        TO service_role;
GRANT ALL ON TABLE public.pt_sessions      TO service_role;
GRANT ALL ON TABLE public.pt_tg_invites    TO service_role;
GRANT ALL ON TABLE public.pt_tg_recipients TO service_role;

-- pt_admin_secret 은 의도적으로 읽기 전용에 가깝게 유지한다 (운영 실측과 동일)
GRANT SELECT, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.pt_admin_secret TO service_role;

-- dashboard_users -- 운영 실측 그대로. RLS ON + 정책 0 이므로 anon/authenticated 의
-- 이 권한은 실제로는 아무것도 열지 않는다(RLS 가 먼저 막는다). service_role 에는
-- SELECT/INSERT/UPDATE/DELETE 가 아예 없다 -- 그래서 dashboard_* 함수가 전부
-- SECURITY DEFINER 로 되어 있는 것이다. 함부로 GRANT 를 넓히지 말 것.
GRANT SELECT, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.dashboard_users TO anon;
GRANT ALL                                   ON TABLE public.dashboard_users TO authenticated;
GRANT REFERENCES, TRIGGER, TRUNCATE         ON TABLE public.dashboard_users TO service_role;

-- anon / authenticated 에게는 pt_* 테이블 권한을 주지 않는다. (아래는 방어적 REVOKE)
REVOKE ALL ON TABLE public.pt_admin_secret,  public.pt_coaches,   public.pt_consults,
                    public.pt_logs,          public.pt_members,   public.pt_passes,
                    public.pt_sessions,      public.pt_tg_invites, public.pt_tg_recipients
  FROM anon, authenticated;


-- ---------------------------------------------------------------------
-- (D) 함수 EXECUTE GRANT -- 실측값 (pg_proc.proacl)
-- ---------------------------------------------------------------------
-- 앱은 anon 키로 RPC 를 호출하므로 anon 에게 EXECUTE 가 있어야 동작한다.
-- 방어선은 EXECUTE 권한이 아니라 함수 안의 _pt_admin_ok(p_secret) 검사다.
--
-- 내부 헬퍼 7개: anon/authenticated 에게 EXECUTE 를 주지 않는다 (중요).
--   _pt_admin_ok        : postgres 만
--   _pt_is_pt_product   : postgres 만
--   _pt_name_phone      : postgres 만
--   _pt_member_in_scope : postgres 만
--   _pt_phone_key       : postgres 만   (HMAC 키로 시크릿을 읽는다)
--   _bot_admin_ok       : postgres 만   (2026-08-08 2차 신규)
--   _pt_branch_id       : postgres, service_role

REVOKE ALL ON FUNCTION public._pt_admin_ok(text)                              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._pt_is_pt_product(text)                         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._pt_name_phone(uuid, text)                      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._pt_member_in_scope(bigint, text, bigint)       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._pt_phone_key(text)                             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._bot_admin_ok(text)                             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._pt_branch_id(text)                             FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._pt_branch_id(text)                          TO service_role;

-- pt_auto_import_all(): 크론(postgres)만 호출한다. 외부 노출 없음.
REVOKE ALL ON FUNCTION public.pt_auto_import_all()                            FROM PUBLIC, anon, authenticated, service_role;

-- ★ 2026-08-08 2차: 개인정보를 통째로 반환하는 2개는 anon/authenticated 에서 회수했다.
--   pt_member_profile    : postgres 만 (서버 main.ts 가 postgres 경로로만 호출)
--   pt_member_attendance : postgres + service_role
--   앱 화면은 pt_member_card / pt_attend_card 래퍼(스코프 검사 포함)를 거쳐야 한다.
REVOKE ALL ON FUNCTION public.pt_member_profile(text, bigint, text)           FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.pt_member_attendance(text, bigint, integer)     FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pt_member_attendance(text, bigint, integer)  TO service_role;

-- 공개 RPC -- anon + authenticated (+ 일부 service_role). 운영 실측과 동일.
GRANT EXECUTE ON FUNCTION public.pt_attend_card(text, bigint, integer, text, bigint)                                                 TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_coach_approve(text, bigint, boolean)                                                             TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_coach_delete(text, bigint, text)                                                                 TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_coach_home(text, text, bigint)                                                                   TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_coach_list(text, text)                                                                           TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_coach_login(text, text)                                                                          TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_coach_set_login(text, bigint, text, text)                                                        TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_coach_signup(text, text, text, text, text, text)                                                 TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_coach_upsert(text, text, bigint, text, text, text, text, text, boolean, integer)                 TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_consult_notified(text, bigint)                                                                   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pt_consult_purge(text, bigint, text)                                                                TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pt_counts(text, text)                                                                               TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_datacenter(text, text, bigint, text)                                                             TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pt_import_from_os(text, text, boolean)                                                              TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_join_consume(text, text, text, text)                                                             TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_join_issue(text, text, bigint, integer)                                                          TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_join_peek(text, text, text)                                                                      TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_list(text, text, text, text, integer, integer, bigint)                                           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pt_log_add(text, bigint, bigint, date, integer, text, text, text, numeric, numeric, text, bigint)   TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_log_list(text, bigint, text, bigint, integer)                                                    TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_member_card(text, bigint, text, text, bigint)                                                    TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_member_delete(text, bigint, text)                                                                TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_member_list(text, text, bigint, text, text)                                                      TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_member_purge(text, bigint, text)                                                                 TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pt_member_upsert(text, text, bigint, text, text, text, integer, integer, bigint, date, text, text, bigint, bigint) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_public_coaches(text)                                                                             TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_submit(text, jsonb)                                                                              TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_tg_add(text, text, text, text, bigint)                                                           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pt_tg_del(text, bigint, text)                                                                       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pt_tg_link(text, bigint, bigint, text)                                                              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pt_tg_list(text, text)                                                                              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pt_tg_targets(text, text)                                                                           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pt_tg_toggle(text, bigint, boolean, text)                                                           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pt_update(text, bigint, text, text, bigint, text, bigint)                                           TO anon, authenticated, service_role;

-- dashboard_* 4개 (PT앱 로그인 권한이 여기에 걸려 있다)
-- ★ approve / users_list 는 2026-08-08 2차에 시그니처가 바뀌었다. 옛 시그니처를 먼저 지운다.
DROP FUNCTION IF EXISTS public.dashboard_approve(text, boolean);
DROP FUNCTION IF EXISTS public.dashboard_users_list();
GRANT EXECUTE ON FUNCTION public.dashboard_login(text, text)                                                                         TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_signup(text, text, text)                                                                  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_approve(text, boolean, text)                                                              TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_users_list(text)                                                                          TO anon, authenticated, service_role;

-- PUBLIC(=X) 엔트리에 대하여:
--   위 함수들은 아래 4개만 빼고 전부 PUBLIC 에도 EXECUTE 가 있다 (Supabase 기본값).
--     pt_coach_set_login   -- 누군가 수동으로 REVOKE PUBLIC 한 흔적
--     pt_member_profile    -- 2026-08-08 2차 REVOKE
--     pt_member_attendance -- 2026-08-08 2차 REVOKE
--     pt_auto_import_all / 내부 헬퍼 7개 -- 애초에 postgres 전용
--   PUBLIC EXECUTE 를 조이고 싶다면 아래를 실행한다 (현재 운영값과는 달라진다).
--     -- REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;


-- ---------------------------------------------------------------------
-- (E) 이상 징후 / 검토 필요 -- 복원 시 그대로 두되 인지할 것
-- ---------------------------------------------------------------------
-- 1. [1차 대비 개선됨] pt_member_profile / pt_member_attendance 의 anon EXECUTE 회수.
--      1차 덤프 때는 anon 키만 알면 회원 상세(이름·전화·메모·출석 이력)를
--      스코프 검사 없이 뽑을 수 있었다. 이제 postgres/service_role 전용이며
--      화면은 pt_member_card / pt_attend_card 래퍼를 거친다. 되돌리지 말 것.
-- 2. [1차 대비 개선됨] dashboard_approve / dashboard_users_list 에 시크릿 게이트 추가.
--      1차 때는 인증이 아예 없어서 anon 키만 알면 계정 목록을 읽고 가입을
--      승인할 수 있었다. 이제 _bot_admin_ok(p_secret) 를 통과해야 한다.
--      ★ 호출하는 쪽(톡톡 리포트 대시보드 앱)도 함께 고쳐졌다.
--        이 함수만 옛 버전으로 되돌리면 대시보드 계정관리 화면이 깨진다.
-- 3. 두 종류의 인증이 한 곳에 섞여 있다.
--      pt_submit / pt_coach_login / pt_coach_signup / pt_public_coaches /
--      dashboard_login / dashboard_signup 은 p_secret 없이 anon 이 호출 가능한
--      "진짜 공개" RPC 다. (설계상 맞음)
--      나머지는 전부 p_secret 필수인데, 그 시크릿이 프런트엔드(브라우저)에
--      들어가 있다면 사실상 공개 상태가 된다. 시크릿은 서버(Deno main.ts)에만
--      두고 브라우저로 내려보내지 말 것.
-- 4. pt_coach_login / pt_coach_signup 은 p_secret 없이 anon 이 호출한다.
--      pt_coach_signup 은 시간당 10건 rate limit, pt_coach_login 은 5회 실패 시
--      10분 잠금이 유일한 방어다. 지점 구분 없는 전역 카운터임에 유의.
-- 5. service_role EXECUTE 가 없는 RPC 가 여전히 있다:
--      pt_consult_notified / pt_consult_purge / pt_datacenter / pt_list /
--      pt_member_purge / pt_tg_* 6종.
--      서버가 service_role 키로 이 RPC 를 호출하려 하면 실패한다.
--      (현재는 anon 키로 호출 중이라 문제가 없는 것)
-- 6. pt_join_* 3개는 anon 에도 EXECUTE 가 열려 있다. 방어선은 _pt_admin_ok(p_secret)
--      하나뿐이다. 초대코드 발급(pt_join_issue)은 반드시 서버에서만 호출할 것 --
--      시크릿이 브라우저로 새면 누구나 무제한으로 유효한 초대링크를 찍어낼 수 있다.
-- 7. pt_passes / pt_sessions 는 RLS ON + 정책 0 + anon/authenticated 권한 0.
--      153OS CRM 화면이 이 테이블을 직접 조회한다면 항상 빈 결과다.
--      실제로 미사용 테이블일 가능성이 높다(README 참고).
-- 8. dashboard_users 는 service_role 에 SELECT 조차 없다. 워커에서 이 테이블을
--      직접 읽으려 하면 "permission denied" 가 난다. 반드시 dashboard_* RPC 를 쓸 것.
-- 9. bot_admin_secret (외부 테이블) 은 anon 에 SELECT(r) 가 붙어 있다. RLS ON +
--      정책 0 이라 실제로는 읽히지 않지만, 이 앱 소유가 아니므로 여기서 손대지 않는다.
--      톡톡 봇 쪽 백업/점검에서 다룰 것.
-- (끝)
