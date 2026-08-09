-- =====================================================================
-- pt-consult-app / DISASTER-RECOVERY SCHEMA DUMP -- 02_indexes.sql
-- =====================================================================
--   생성일       : 2026-08-09  (3차. 지문·얼굴 로그인(WebAuthn 패스키) 반영 후 재생성)
--   소스 프로젝트: Supabase project ref  tbxdrfowanyksgdicryl
--   추출 쿼리    : select indexdef from pg_indexes
--                  where schemaname='public'
--                    and (tablename like 'pt\_%' or tablename='dashboard_users')
--   실측 개수    : 34개 (제약 자동생성 15 + 보조 19)
--
--   ※ 2026-08-09 3차 변경분 -- 인덱스 3개 증가 (전부 신규 2테이블 소속)
--     신규(제약 자동생성): pt_webauthn_creds_pkey (id)
--                          pt_webauthn_creds_cred_id_key (cred_id) UNIQUE
--                          pt_wa_challenges_pkey (challenge)
--     신규(보조)        : pt_webauthn_creds_user_idx (user_key)
--     그 외 기존 인덱스는 2차 덤프와 동일하다 (1건도 바뀌지 않았다).
--
--   ※ pt_wa_challenges 에는 보조 인덱스가 없다. PK(challenge) 단건 조회만 하고,
--     GC(만료 10분 초과 DELETE)는 3분짜리 짧은 수명 테이블이라 seq scan 으로 충분하다.
--     챌린지가 쌓여 느려진다면 pt_wa_challenges(expires_at) 인덱스를 검토할 것.
--
--   ※ pt_members.purge_key / manual_edited, dashboard_users.pt_access 에는
--     인덱스가 없다 (purge_key 는 임포트 루프에서 seq scan 으로 대조된다 --
--     회원 수가 커지면 pt_members(purge_key) 부분 인덱스를 검토할 것).
--
-- 01_tables.sql 을 먼저 실행한 뒤 이 파일을 실행한다.
--
-- 주의: PRIMARY KEY / UNIQUE 제약이 자동 생성하는 인덱스는
--       01_tables.sql 에서 이미 만들어진다. 아래에서는 참고용으로 남겨두되
--       전부 주석 처리했다. 실제로 실행해야 하는 것은 "보조 인덱스" 절뿐이다.
-- =====================================================================


-- ---------------------------------------------------------------------
-- (A) 제약이 자동 생성하는 인덱스 -- 실행 불필요 (참고용, 주석)
-- ---------------------------------------------------------------------
-- CREATE UNIQUE INDEX pt_admin_secret_pkey ON public.pt_admin_secret USING btree (id);
-- CREATE UNIQUE INDEX pt_coaches_pkey ON public.pt_coaches USING btree (id);
-- CREATE UNIQUE INDEX pt_coaches_login_id_key ON public.pt_coaches USING btree (login_id);
-- CREATE UNIQUE INDEX pt_consults_pkey ON public.pt_consults USING btree (id);
-- CREATE UNIQUE INDEX pt_logs_pkey ON public.pt_logs USING btree (id);
-- CREATE UNIQUE INDEX pt_members_pkey ON public.pt_members USING btree (id);
-- CREATE UNIQUE INDEX pt_passes_pkey ON public.pt_passes USING btree (id);
-- CREATE UNIQUE INDEX pt_sessions_pkey ON public.pt_sessions USING btree (id);
-- CREATE UNIQUE INDEX pt_tg_invites_pkey ON public.pt_tg_invites USING btree (code);
-- CREATE UNIQUE INDEX pt_tg_recipients_pkey ON public.pt_tg_recipients USING btree (id);
-- CREATE UNIQUE INDEX pt_tg_recipients_branch_chat_id_key ON public.pt_tg_recipients USING btree (branch, chat_id);
-- CREATE UNIQUE INDEX pt_wa_challenges_pkey ON public.pt_wa_challenges USING btree (challenge);          -- ★2026-08-09 신규
-- CREATE UNIQUE INDEX pt_webauthn_creds_pkey ON public.pt_webauthn_creds USING btree (id);               -- ★2026-08-09 신규
-- CREATE UNIQUE INDEX pt_webauthn_creds_cred_id_key ON public.pt_webauthn_creds USING btree (cred_id);   -- ★2026-08-09 신규
-- CREATE UNIQUE INDEX dashboard_users_pkey ON public.dashboard_users USING btree (username);


-- ---------------------------------------------------------------------
-- (B) 보조 인덱스 -- 이 절을 실행한다
-- ---------------------------------------------------------------------

-- pt_coaches
CREATE INDEX pt_coaches_branch_idx ON public.pt_coaches USING btree (branch, active, sort_order);

-- pt_consults
CREATE INDEX pt_consults_branch_created_idx ON public.pt_consults USING btree (branch, created_at DESC);
CREATE INDEX pt_consults_coach_id_idx ON public.pt_consults USING btree (coach_id);
CREATE INDEX pt_consults_phone_created_idx ON public.pt_consults USING btree (phone, created_at DESC);
CREATE INDEX pt_consults_status_idx ON public.pt_consults USING btree (branch, status);

-- pt_logs
CREATE INDEX pt_logs_branch_date_idx ON public.pt_logs USING btree (branch, session_date DESC);
CREATE INDEX pt_logs_coach_date_idx ON public.pt_logs USING btree (coach_id, session_date DESC);
CREATE INDEX pt_logs_member_date_idx ON public.pt_logs USING btree (member_id, session_date DESC);

-- pt_members
CREATE INDEX pt_members_alive_idx ON public.pt_members USING btree (branch, status) WHERE (deleted_at IS NULL);
CREATE INDEX pt_members_branch_coach_idx ON public.pt_members USING btree (branch, coach_id, status);
CREATE UNIQUE INDEX pt_members_consult_uidx ON public.pt_members USING btree (consult_id) WHERE ((consult_id IS NOT NULL) AND (deleted_at IS NULL));
CREATE UNIQUE INDEX pt_members_os_mid_uidx ON public.pt_members USING btree (os_membership_id) WHERE (os_membership_id IS NOT NULL);
CREATE INDEX pt_members_phone_idx ON public.pt_members USING btree (phone);

-- pt_tg_invites  (2026-08-08 2차 신규)
--   조회 패턴은 code(PK) 단건 조회가 대부분이고, 이 인덱스는 pt_join_issue 안의
--   지점별 GC(만료·사용 7일 초과 DELETE)를 위한 것이다.
CREATE INDEX pt_tg_invites_branch_idx ON public.pt_tg_invites USING btree (branch, expires_at DESC);

-- pt_webauthn_creds  (2026-08-09 3차 신규)
--   로그인 경로는 cred_id(UNIQUE)로 들어온다. 이 인덱스는 그게 아니라
--   pt_wa_list(내 기기 목록) / pt_wa_register(5대 제한 count) / pt_wa_del 이
--   user_key 로 훑는 것을 받쳐준다.
CREATE INDEX pt_webauthn_creds_user_idx ON public.pt_webauthn_creds USING btree (user_key);

-- pt_passes (153OS 소속)
CREATE INDEX pt_passes_branch_idx ON public.pt_passes USING btree (branch_id, status, created_at DESC);

-- pt_sessions (153OS 소속)
CREATE INDEX idx_pt_sessions_coach ON public.pt_sessions USING btree (coach_id);
CREATE INDEX idx_pt_sessions_date ON public.pt_sessions USING btree (branch_id, session_date);
CREATE INDEX idx_pt_sessions_member ON public.pt_sessions USING btree (member_id);

-- pt_wa_challenges : 보조 인덱스 없음 (PK(challenge) 뿐. 위 ※ 참고)
-- pt_tg_recipients : 보조 인덱스 없음 (PK + UNIQUE(branch, chat_id) 뿐)
-- pt_admin_secret  : 보조 인덱스 없음 (1행 테이블)
-- dashboard_users  : 보조 인덱스 없음 (PK(username) 뿐)
--                    ※ dashboard_login 은 lower(username) 로 조회하는데 인덱스는
--                      username 원문 PK 뿐이라 인덱스를 타지 못한다. 계정 수가
--                      적어 현재는 문제가 없다. 커지면 lower(username) 함수 인덱스 검토.
--                    ※ pt_wa_get 도 같은 lower(username) 조회를 한다 (같은 한계).

-- (끝)
