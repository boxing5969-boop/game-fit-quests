-- =====================================================================
-- pt-consult-app / DISASTER-RECOVERY SCHEMA DUMP -- 01_tables.sql
-- =====================================================================
-- 이 파일은 pg_dump 산출물이 아니라 **재구성(reconstructed) 덤프**다.
-- 라이브 DB 의 information_schema.columns + pg_constraint(pg_get_constraintdef)
-- 를 읽어 손으로 CREATE TABLE 문으로 되살린 것이다.
--
--   생성일       : 2026-08-08  (오늘 마이그레이션 5건 반영 후 재생성)
--   소스 프로젝트: Supabase project ref  tbxdrfowanyksgdicryl
--   대상 범위    : schema public, 테이블명 'pt_%' 전부 (8개) + dashboard_users
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
-- 7. dashboard_users  -- 대시보드/PT앱 로그인 계정 (자체 인증, Supabase Auth 아님)
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
--                주의) dashboard_login 은 잠금이 만료돼도 fail_count 를 리셋하지 않는다.
--                (pt_coach_login 에는 있는 리셋 분기가 여기엔 없다 -- 실측값 그대로 둠)
-- role         : 'owner' | 'manager' 등. dashboard_approve 는 role='owner' 를 건드리지 않는다.


-- =====================================================================
-- 아래 2개(pt_passes, pt_sessions)는 153OS(경영리포트) 쪽 스키마에 속하며
-- pt-consult-app 의 어떤 RPC 도 이 테이블을 읽거나 쓰지 않는다.
-- 이름이 pt_ 로 시작해 범위에 걸린 것뿐이다. 복원 시 판단해서 쓸 것.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 8. pt_passes  (153OS 소속. branches / profiles 필요)
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
-- 9. pt_sessions  (153OS 소속. branches / staff / members / memberships 필요)
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
