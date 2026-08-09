-- =====================================================================
-- pt-consult-app / DISASTER-RECOVERY SCHEMA DUMP -- 01_tables.sql
-- =====================================================================
-- 이 파일은 pg_dump 산출물이 아니라 **재구성(reconstructed) 덤프**다.
-- 라이브 DB 의 information_schema.columns + pg_constraint(pg_get_constraintdef)
-- 를 읽어 손으로 CREATE TABLE 문으로 되살린 것이다.
--
--   생성일       : 2026-08-09  (3차. 지문·얼굴 로그인(WebAuthn 패스키) 반영 후 재생성)
--   소스 프로젝트: Supabase project ref  tbxdrfowanyksgdicryl
--   대상 범위    : schema public, 테이블명 'pt_%' 전부 (11개) + dashboard_users
--   데이터       : 없음. 스키마(DDL) 전용. row 데이터는 일절 포함하지 않는다.
--
-- 복원 순서: 01_tables -> 02_indexes -> 03_functions -> 04_grants_rls -> 05_cron
--
-- 주의 1) 아래 테이블 중 pt_passes / pt_sessions 는 이 앱 밖(153OS 경영리포트)
--        테이블을 FK 로 참조한다: branches, profiles, members, memberships, staff.
--        빈 DB 에 복원하려면 그 테이블들이 먼저 있어야 한다.
--        (없으면 해당 FK 줄을 주석 처리하고 나중에 ALTER TABLE 로 붙일 것)
-- 주의 2) id 컬럼은 원본이 nextval('..._id_seq') 형태다. 아래에서는 bigserial 로
--        적어 동일한 이름의 시퀀스가 자동 생성되게 했다. 결과 스키마는 동일하다.
-- 주의 3) pt_admin_secret 은 **구조만** 여기 있다. secret 값은 절대 포함하지 않는다.
--        복원 후 운영자가 직접 값을 넣어야 앱이 동작한다.
-- 주의 4) dashboard_users 는 이름이 pt_ 로 시작하지 않지만 PT앱 로그인 경로
--        (dashboard_login -> pt_access)가 이 테이블에 의존하므로 함께 넣었다.
--        03_functions.sql 의 dashboard_* 4개 함수와 짝이다.
-- 주의 5) **외부 의존 테이블 public.bot_admin_secret** -- 이 파일에는 CREATE 문이 없다.
--        PT앱 소유가 아니라 톡톡 리포트 봇 계열이 쓰는 시크릿 1행 테이블이다.
--        그런데 2026-08-08(2차)부터 dashboard_approve / dashboard_users_list 가
--        _bot_admin_ok(p_secret) -> bot_admin_secret 을 읽는다. 즉 이 테이블이
--        없으면 대시보드 계정관리가 죽는다. 구조는 pt_admin_secret 과 동일:
--          (id integer NOT NULL DEFAULT 1, secret text NOT NULL,
--           PRIMARY KEY (id), CHECK (id = 1))
--        값은 여기 없다. 복원 시 운영자가 직접 넣어야 한다.
-- 주의 6) 2026-08-08 2차 추가분: pt_tg_invites (아래 7번). 코치 텔레그램 초대링크가
--        "시크릿 파생 고정 코드"에서 "1회용 + 만료 + 코치 지정" 으로 바뀌면서 생겼다.
-- 주의 7) 2026-08-09 3차 추가분: pt_webauthn_creds / pt_wa_challenges (아래 8·9번).
--        지문·얼굴 로그인(WebAuthn 패스키)용이다. **비밀번호도 개인키도 저장하지 않는다.**
--        기기 보안칩이 개인키를 갖고, DB 에는 공개키(public_key jsonb)만 온다.
--        아래 8번 테이블의 **행은 절대 백업 문서·리포트에 옮겨 적지 않는다**
--        (cred_id 와 공개키는 자격증명 식별 정보다). 구조만 남긴다.
--        번호가 밀려서 dashboard_users 는 8 -> 10, pt_passes 9 -> 11,
--        pt_sessions 10 -> 12 로 바뀌었다. 내용은 그대로다.
-- =====================================================================

-- 필요 확장 (pt_passes.id, pt_sessions.id 의 gen_random_uuid(),
--            코치 비밀번호 crypt()/gen_salt() 에 필요)
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ---------------------------------------------------------------------
-- 1. pt_admin_secret  -- 앱 전체의 마스터 시크릿 1행 보관소
--    (모든 pt_* RPC 가 p_secret 파라미터를 이 테이블 값과 대조한다)
-- ---------------------------------------------------------------------
CREATE TABLE public.pt_admin_secret (
  id          integer                  NOT NULL DEFAULT 1,
  secret      text                     NOT NULL,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pt_admin_secret_pkey    PRIMARY KEY (id),
  CONSTRAINT pt_admin_secret_one_row CHECK ((id = 1))
);
-- 값 주입은 수동. 예:
--   INSERT INTO public.pt_admin_secret (id, secret) VALUES (1, '<운영 시크릿>');


-- ---------------------------------------------------------------------
-- 2. pt_coaches  -- 코치 계정 (자체 로그인: login_id + bcrypt pw_hash)
-- ---------------------------------------------------------------------
CREATE TABLE public.pt_coaches (
  id             bigserial                NOT NULL,
  branch         text                     NOT NULL DEFAULT 'sunreung'::text,
  name           text                     NOT NULL,
  title          text,
  phone          text,
  intro          text,
  photo_url      text,
  active         boolean                  NOT NULL DEFAULT true,
  sort_order     integer                  NOT NULL DEFAULT 0,
  created_at     timestamp with time zone NOT NULL DEFAULT now(),
  login_id       text,
  pw_hash        text,
  last_login_at  timestamp with time zone,
  approved       boolean                  NOT NULL DEFAULT true,
  signup_at      timestamp with time zone,
  fail_count     integer                  NOT NULL DEFAULT 0,
  locked_until   timestamp with time zone,
  CONSTRAINT pt_coaches_pkey         PRIMARY KEY (id),
  CONSTRAINT pt_coaches_login_id_key UNIQUE (login_id)
);


-- ---------------------------------------------------------------------
-- 3. pt_consults  -- 공개 상담 신청서 (pt_submit 으로 anon 이 INSERT)
-- ---------------------------------------------------------------------
CREATE TABLE public.pt_consults (
  id             bigserial                NOT NULL,
  branch         text                     NOT NULL DEFAULT 'sunreung'::text,
  name           text                     NOT NULL,
  phone          text                     NOT NULL,
  gender         text,
  age_band       text,
  goal           text,
  fitness_level  text,
  experience     text,
  injury         text,
  pref_days      text,
  pref_time      text,
  interest       text,
  source         text,
  note           text,
  status         text                     NOT NULL DEFAULT 'new'::text,
  coach_id       bigint,
  admin_memo     text,
  created_at     timestamp with time zone NOT NULL DEFAULT now(),
  updated_at     timestamp with time zone NOT NULL DEFAULT now(),
  partner_name   text,
  partner_phone  text,
  consent_at     timestamp with time zone,
  consent_health boolean                  NOT NULL DEFAULT false,
  purged_at      timestamp with time zone,
  notified_at    timestamp with time zone,
  CONSTRAINT pt_consults_pkey          PRIMARY KEY (id),
  CONSTRAINT pt_consults_status_chk    CHECK ((status = ANY (ARRAY['new'::text, 'contacted'::text, 'consulted'::text, 'joined'::text, 'hold'::text]))),
  CONSTRAINT pt_consults_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.pt_coaches(id) ON DELETE SET NULL
);


-- ---------------------------------------------------------------------
-- 4. pt_members  -- PT 등록 회원 (경영리포트 memberships 에서 매일 자동 임포트)
--    os_membership_id = 153OS memberships.id (교차 프로젝트 논리 FK, 제약 없음)
-- ---------------------------------------------------------------------
CREATE TABLE public.pt_members (
  id               bigserial                NOT NULL,
  branch           text                     NOT NULL DEFAULT 'sunreung'::text,
  coach_id         bigint,
  consult_id       bigint,
  name             text                     NOT NULL,
  phone            text,
  product          text,
  total_sessions   integer                  NOT NULL DEFAULT 0,
  used_sessions    integer                  NOT NULL DEFAULT 0,
  start_date       date,
  end_date         date,
  status           text                     NOT NULL DEFAULT 'active'::text,
  memo             text,
  created_at       timestamp with time zone NOT NULL DEFAULT now(),
  updated_at       timestamp with time zone NOT NULL DEFAULT now(),
  os_membership_id uuid,
  deleted_at       timestamp with time zone,
  purged_at        timestamp with time zone,
  purge_key        text,
  manual_edited    boolean                  NOT NULL DEFAULT false,
  CONSTRAINT pt_members_pkey            PRIMARY KEY (id),
  CONSTRAINT pt_members_sessions_chk    CHECK (((used_sessions >= 0) AND (total_sessions >= 0))),
  CONSTRAINT pt_members_status_chk      CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'done'::text, 'canceled'::text]))),
  CONSTRAINT pt_members_coach_id_fkey   FOREIGN KEY (coach_id)   REFERENCES public.pt_coaches(id)  ON DELETE SET NULL,
  CONSTRAINT pt_members_consult_id_fkey FOREIGN KEY (consult_id) REFERENCES public.pt_consults(id) ON DELETE SET NULL
);
-- purge_key     : 2026-08-08 추가. 파기(pt_member_purge) 시 전화번호를 되돌릴 수 없게
--                 _pt_phone_key() = hmac(phone, pt_admin_secret.secret, sha256) 로 바꿔
--                 남기는 tombstone 키. 평문 번호는 'ERASED-<id>' 로 지워지지만 이 키가
--                 남아 있어야 매일 새벽 자동 임포트가 파기된 사람을 되살리지 않는다.
--                 pt_admin_secret 값이 바뀌면 기존 purge_key 는 전부 무효가 된다.
-- manual_edited : 2026-08-08 추가. pt_member_upsert 로 사람이 회원을 수정하면 true.
--                 true 인 행은 pt_import_from_os 가 name/phone/product 를 덮어쓰지
--                 않는다 (수기 수정 보호). 회차는 greatest() 라 원래부터 안 줄어든다.


-- ---------------------------------------------------------------------
-- 5. pt_logs  -- 회차별 수업 일지 (pt_log_add 가 회차 차감과 동시에 INSERT)
-- ---------------------------------------------------------------------
CREATE TABLE public.pt_logs (
  id            bigserial                NOT NULL,
  member_id     bigint                   NOT NULL,
  coach_id      bigint,
  branch        text                     NOT NULL DEFAULT 'sunreung'::text,
  session_no    integer,
  session_date  date                     NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Seoul'::text))::date,
  duration_min  integer,
  content       text,
  condition     text,
  next_plan     text,
  weight_kg     numeric(5,1),
  body_fat      numeric(4,1),
  created_at    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pt_logs_pkey           PRIMARY KEY (id),
  CONSTRAINT pt_logs_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.pt_members(id) ON DELETE CASCADE,
  CONSTRAINT pt_logs_coach_id_fkey  FOREIGN KEY (coach_id)  REFERENCES public.pt_coaches(id) ON DELETE SET NULL
);


-- ---------------------------------------------------------------------
-- 6. pt_tg_recipients  -- 신규 상담 텔레그램 알림 수신자
-- ---------------------------------------------------------------------
CREATE TABLE public.pt_tg_recipients (
  id          bigserial                NOT NULL,
  branch      text                     NOT NULL DEFAULT 'sunreung'::text,
  chat_id     text                     NOT NULL,
  label       text                     NOT NULL DEFAULT ''::text,
  active      boolean                  NOT NULL DEFAULT true,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  coach_id    bigint,
  CONSTRAINT pt_tg_recipients_pkey               PRIMARY KEY (id),
  CONSTRAINT pt_tg_recipients_branch_chat_id_key UNIQUE (branch, chat_id),
  CONSTRAINT pt_tg_recipients_coach_id_fkey      FOREIGN KEY (coach_id) REFERENCES public.pt_coaches(id) ON DELETE SET NULL
);


-- ---------------------------------------------------------------------
-- 7. pt_tg_invites  -- 코치 텔레그램 1회용 초대코드  (2026-08-08 2차 신규)
--    이전에는 초대 링크가 "시크릿에서 파생한 고정 코드" 하나였다. 유출되면
--    영구히 아무나 봇에 붙을 수 있었다. 이제 발급할 때마다 랜덤 코드를 만들고
--    기본 24시간(최대 168h)만 살아 있으며, 한 번 쓰면 used_at 이 박혀 끝난다.
--    코드 생성/검증/소진은 pt_join_issue / pt_join_peek / pt_join_consume 셋이 한다.
--    (main.ts 의 /api/join/* + /api/tg/joinlink 와 짝이다 -- 반드시 함께 배포)
--
--    code       : PK. 랜덤 14자 [a-z0-9]. 텔레그램 start 파라미터로 그대로 실린다.
--    coach_id   : NULL 이면 "코치 미지정" 초대. 값이 있으면 그 코치 전용.
--    expires_at : 발급 시각 + p_hours. pt_join_peek 이 now() 와 비교.
--    used_at    : 소진 시각. NOT NULL 이 되는 순간 그 코드는 죽는다 (1회용).
--    used_chat  : 소진한 텔레그램 chat_id (앞 40자). 감사용.
--    ※ 정리(GC) 는 크론이 아니라 pt_join_issue 안에서 한다 -- 발급할 때마다
--      같은 지점의 "만료 7일 초과" / "사용 7일 초과" 행을 DELETE 한다.
-- ---------------------------------------------------------------------
CREATE TABLE public.pt_tg_invites (
  code        text                     NOT NULL,
  branch      text                     NOT NULL,
  coach_id    bigint,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  expires_at  timestamp with time zone NOT NULL,
  used_at     timestamp with time zone,
  used_chat   text,
  CONSTRAINT pt_tg_invites_pkey          PRIMARY KEY (code),
  CONSTRAINT pt_tg_invites_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.pt_coaches(id) ON DELETE SET NULL
);


-- =====================================================================
-- 2026-08-09 신규 -- 지문·얼굴 로그인(WebAuthn 패스키) 2테이블
-- 개인키는 여기 오지 않는다. 사용자 기기 보안칩에만 있고, 서버는 공개키로
-- 서명을 검증만 한다. 아래 두 테이블에는 비밀번호가 일절 저장되지 않는다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 8. pt_webauthn_creds  -- 등록된 기기(패스키) 공개키 보관  (2026-08-09 신규)
--    user_key 규칙 : 관장/관리자 'u:<아이디 소문자>' , 코치 'c:<pt_coaches.id>'
--                    (문자열이라 FK 가 없다. 계정 유효성은 pt_wa_get 이 조회 시점에
--                     pt_coaches / dashboard_users 를 다시 읽어 판정한다)
--    cred_id      : 인증기가 발급한 credential id (base64url). UNIQUE.
--    public_key   : COSE 공개키를 jsonb 로 저장. **개인키는 없다.**
--    sign_count   : 인증기 서명 카운터. pt_wa_touch 가 greatest() 로만 올린다
--                   (역행하면 복제 기기 의심 -> 서버가 거부).
--    label        : 사용자가 붙인 기기 이름. 40자로 잘린다.
--    ★ 이 테이블의 행은 백업 문서에 절대 옮겨 적지 않는다 (자격증명 식별자·공개키).
-- ---------------------------------------------------------------------
CREATE TABLE public.pt_webauthn_creds (
  id            bigserial                NOT NULL,
  user_key      text                     NOT NULL,
  branch        text                     NOT NULL DEFAULT 'sunreung'::text,
  cred_id       text                     NOT NULL,
  public_key    jsonb                    NOT NULL,
  sign_count    bigint                   NOT NULL DEFAULT 0,
  label         text,
  created_at    timestamp with time zone NOT NULL DEFAULT now(),
  last_used_at  timestamp with time zone,
  CONSTRAINT pt_webauthn_creds_pkey        PRIMARY KEY (id),
  CONSTRAINT pt_webauthn_creds_cred_id_key UNIQUE (cred_id)
);
-- 기기 대수 제한(1인 5대)은 제약이 아니라 pt_wa_register 안의 count 검사다.
-- FK 없음: user_key 가 두 종류 계정 테이블을 가리키는 다형 키이기 때문이다.


-- ---------------------------------------------------------------------
-- 9. pt_wa_challenges  -- 1회용 로그인/등록 챌린지  (2026-08-09 신규)
--    challenge 가 PK 다. base64url 로 인코딩된 32바이트 난수.
--    purpose   : 'login' | 'register'  (pt_wa_challenge_new 가 이 둘만 받는다)
--    user_key  : register 때만 채워진다. login 은 NULL (누가 올지 모르므로).
--    expires_at: 발급 + 3분. pt_wa_challenge_take 가 DELETE ... RETURNING 으로
--                가져가므로 **한 번 쓰면 사라진다**(재사용 차단).
--    청소      : pt_wa_challenge_new 가 호출될 때마다 10분 지난 행을 DELETE 한다.
--                별도 크론 없음.
--    CHECK 제약 없음 -- purpose 검증은 함수가 한다 (운영 실측 그대로).
-- ---------------------------------------------------------------------
CREATE TABLE public.pt_wa_challenges (
  challenge   text                     NOT NULL,
  purpose     text                     NOT NULL,
  user_key    text,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  expires_at  timestamp with time zone NOT NULL,
  CONSTRAINT pt_wa_challenges_pkey PRIMARY KEY (challenge)
);


-- ---------------------------------------------------------------------
-- 10. dashboard_users  -- 대시보드/PT앱 로그인 계정 (자체 인증, Supabase Auth 아님)
--    PK 는 id 가 아니라 username 이다. 시퀀스 없음.
--    2026-08-08 추가 컬럼: pt_access, fail_count, locked_until
-- ---------------------------------------------------------------------
CREATE TABLE public.dashboard_users (
  username      text                     NOT NULL,
  pw_hash       text                     NOT NULL,
  branch        text                     NOT NULL,
  role          text                     NOT NULL DEFAULT 'manager'::text,
  approved      boolean                  NOT NULL DEFAULT false,
  created_at    timestamp with time zone NOT NULL DEFAULT now(),
  pt_access     boolean                  NOT NULL DEFAULT false,
  fail_count    integer                  NOT NULL DEFAULT 0,
  locked_until  timestamp with time zone,
  CONSTRAINT dashboard_users_pkey PRIMARY KEY (username)
);
-- pt_access    : 2026-08-08 추가. PT 상담앱에 들어올 수 있는 계정인지를 가르는 스위치.
--                기본 false = 대시보드 계정이라고 해서 PT앱까지 열리지 않는다.
--                dashboard_login 이 성공 응답에 pt_access 를 실어 보내고,
--                main.ts 가 그 값으로 PT앱 진입을 막는다.
-- fail_count   : 2026-08-08 추가. 비밀번호 연속 실패 횟수.
-- locked_until : 2026-08-08 추가. 5회 실패 시 now() + 10분. pt_coach_login 과 동일 정책.
--                ★ 2026-08-08 2차 수정: 잠금이 만료되면 fail_count 를 0 부터 다시 센다.
--                  (1차 덤프 시점에는 리셋 분기가 없어서, 10분이 지나 잠금이 풀려도
--                   fail_count 가 5 로 남아 있다가 1회만 틀리면 즉시 재잠금됐다.)
-- role         : 'owner' | 'manager' 등. dashboard_approve 는 role='owner' 를 건드리지 않는다.


-- =====================================================================
-- 아래 2개(pt_passes, pt_sessions)는 153OS(경영리포트) 쪽 스키마에 속하며
-- pt-consult-app 의 어떤 RPC 도 이 테이블을 읽거나 쓰지 않는다.
-- 이름이 pt_ 로 시작해 범위에 걸린 것뿐이다. 복원 시 판단해서 쓸 것.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 11. pt_passes  (153OS 소속. branches / profiles 필요)
-- ---------------------------------------------------------------------
CREATE TABLE public.pt_passes (
  id              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  branch_id       uuid                     NOT NULL,
  member_name     text                     NOT NULL,
  total_sessions  integer                  NOT NULL,
  used_sessions   integer                  NOT NULL DEFAULT 0,
  no_shows        integer                  NOT NULL DEFAULT 0,
  payment_method  text,
  amount          bigint                   NOT NULL DEFAULT 0,
  is_new          boolean                  NOT NULL DEFAULT true,
  reg_date        date                     NOT NULL DEFAULT CURRENT_DATE,
  status          text                     NOT NULL DEFAULT 'active'::text,
  created_by      uuid,
  created_at      timestamp with time zone NOT NULL DEFAULT now(),
  updated_at      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pt_passes_pkey                PRIMARY KEY (id),
  CONSTRAINT pt_passes_amount_check        CHECK ((amount >= 0)),
  CONSTRAINT pt_passes_no_shows_check      CHECK ((no_shows >= 0)),
  CONSTRAINT pt_passes_used_sessions_check CHECK ((used_sessions >= 0)),
  CONSTRAINT pt_passes_branch_id_fkey      FOREIGN KEY (branch_id)  REFERENCES public.branches(id) ON DELETE CASCADE,
  CONSTRAINT pt_passes_created_by_fkey     FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL
);


-- ---------------------------------------------------------------------
-- 12. pt_sessions  (153OS 소속. branches / staff / members / memberships 필요)
-- ---------------------------------------------------------------------
CREATE TABLE public.pt_sessions (
  id             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  member_id      uuid                     NOT NULL,
  coach_id       uuid,
  branch_id      uuid                     NOT NULL,
  membership_id  uuid,
  session_date   date                     NOT NULL,
  start_time     time without time zone   NOT NULL,
  duration_min   integer                  NOT NULL DEFAULT 60,
  status         text                     NOT NULL DEFAULT 'scheduled'::text,
  note           text,
  created_at     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pt_sessions_pkey              PRIMARY KEY (id),
  CONSTRAINT pt_sessions_status_check      CHECK ((status = ANY (ARRAY['scheduled'::text, 'completed'::text, 'no_show'::text, 'canceled'::text]))),
  CONSTRAINT pt_sessions_branch_id_fkey    FOREIGN KEY (branch_id)     REFERENCES public.branches(id)    ON DELETE CASCADE,
  CONSTRAINT pt_sessions_coach_id_fkey     FOREIGN KEY (coach_id)      REFERENCES public.staff(id)       ON DELETE SET NULL,
  CONSTRAINT pt_sessions_member_id_fkey    FOREIGN KEY (member_id)     REFERENCES public.members(id)     ON DELETE CASCADE,
  CONSTRAINT pt_sessions_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES public.memberships(id) ON DELETE SET NULL
);


-- ---------------------------------------------------------------------
-- 트리거: pt_* 테이블에는 사용자 트리거가 하나도 없다.
-- updated_at 은 트리거가 아니라 각 RPC 안에서 명시적으로 갱신한다.
-- ---------------------------------------------------------------------
-- (끝)
