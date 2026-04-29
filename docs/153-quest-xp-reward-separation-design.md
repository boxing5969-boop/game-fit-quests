# 153 QUEST 공식 XP / QUEST XP / 보상 분리 설계

> 본 문서는 **3단계 — 보상 재화 분리 설계**다.
> 코드·마이그레이션·RPC·React 컴포넌트 변경 없음. 본 문서 1개만 신규 작성.
> 선행 문서: [`docs/153-quest-full-engagement-roadmap.md`](./153-quest-full-engagement-roadmap.md) (2단계 백로그/로드맵).

---

## 1. 목적

### 왜 공식 XP와 QUEST XP를 분리해야 하는가

153 랭킹업 시스템은 **복싱 지도자 성장 1~40레벨**을 핵심 자산으로 한다. 코치 승인 + 미션 제출 + 보스전을 통해 적립되는 공식 XP는 회원의 진짜 실력 누적이다. 이 위에 "재미·몰입·커뮤니티"를 얹는 153 QUEST 보조 레이어가 같은 XP 풀을 공유하면 두 가지 사고가 일어난다.

- **공식 등급 오염**: 퀴즈 정답·재미 챌린지·응원 등으로 공식 레벨이 올라가면 "코치 인증 = 진짜 실력" 약속이 깨진다.
- **무제한 파밍 가능성**: 클라이언트에서 보상 amount를 임의 전달하거나 wallet을 직접 update하면 무한 지급이 가능해진다.

### 보조 몰입 기능이 공식 승급 조건을 오염시키지 않아야 한다

- 1~40레벨 = 코치가 보증하는 진짜 실력 트랙
- 153 QUEST = 즐겁게 매일 들어오는 몰입 트랙
- 두 트랙은 **테이블·RPC·UI·랭킹**까지 완전 분리

---

## 2. 현재 공식 성장 시스템 요약

| 영역 | 구현 위치 | 비고 |
|---|---|---|
| 공식 레벨 | `levels` 테이블 (Lv 1~40 + 마스터트랙 Lv 41~50 + HoF Lv 99) | 별도 프로젝트로 후속 업그레이드 — 본 작업 미터치 |
| 공식 리그 | white(1~10) / blue(11~20) / red(21~30) / black(31~40) | `member_progress.current_rank` |
| 공식 XP | `xp_logs` + `member_progress.total_xp` | `grant_manual_xp`, `approve_mission_submission`, `pass_boss_battle`, `record_attendance` 만 변경 |
| 공식 미션 | `missions` + `mission_videos` + `mission_submissions` | [src/pages/MissionsPage.tsx](../src/pages/MissionsPage.tsx) |
| 미션 제출 | `useSubmitMission` → `mission_submissions` insert (status='pending') | 본 작업 미터치 |
| 코치 승인 | `useApproveMission` → `approve_mission_submission` RPC → XP+젬 자동 지급 | 본 작업 미터치 |
| 보스전 | `useSubmitQuest`(boss_battle) + `usePassBossBattle` → `pass_boss_battle` RPC | 본 작업 미터치 |
| 승급 | 보스전 클리어 시 다음 리그로 자동 전환 | 본 작업 미터치 |
| 파이트 머니 지급 | `grant_gems(_user_id uuid, _amount integer, _reason text)` SECURITY DEFINER RPC ([20260414105245](../supabase/migrations/20260414105245_bcb175c2-a47c-48e8-a5e7-44a136b2169d.sql) L166) | 신규 보상도 이 RPC 경유 |
| 지갑 | `user_wallets {user_id, gems_balance, total_earned, total_spent}` | 잔액은 RPC만 변경 (직접 update 금지) |

---

## 3. 보상 재화 정의 (4종)

### A. 공식 XP

| 항목 | 정의 |
|---|---|
| 목적 | 1~40레벨, 승급, 보스전, 공식 성장 |
| 저장 위치 | 기존 `xp_logs` + `member_progress.total_xp` |
| 지급 경로 | 기존 공식 미션 제출 / 코치 승인 / 출석 / 보스전 흐름 |
| 본 업데이트 직접 수정 | **❌ 금지** |
| 퀴즈/재미 챌린지/응원/일기로 지급 | **❌ 금지** |

### B. QUEST XP

| 항목 | 정의 |
|---|---|
| 목적 | 퀴즈, 재미 챌린지, 응원, 챔피언 일기 등 몰입 활동 보조 성장 |
| 공식 레벨 영향 | **❌ 없음** (`member_progress` 미참조·미수정) |
| 저장 위치 | 신규 `boxing_engagement_events` + `boxing_engagement_profiles.quest_xp_total` |
| 화면 표시 | "QUEST XP" 또는 "퀘스트 XP" — 공식 XP와 시각적 구분(배지·색·아이콘) |
| 활용 | QUEST 자체 랭킹·QUEST 칭호·복싱 전당 요약 카드 |

### C. 파이트 머니 (gems)

| 항목 | 정의 |
|---|---|
| 목적 | 캐릭터 꾸미기·프로필 프레임·응원 스티커·카드팩·재도전권 등 앱 내 보상 포인트 |
| 저장 위치 | 기존 `user_wallets` |
| 지급 경로 | **`grant_gems` RPC만** (또는 신규 SECURITY DEFINER RPC가 내부에서 grant_gems 호출) |
| 직접 update | **❌ 금지** (`useSpendGems` 의 직접 update 패턴 답습 금지) |
| 클라이언트 amount 전달 | **❌ 금지** — 보상 액수는 서버 코드 안 상수표 |

### D. RP (Respect Point)

| 항목 | 정의 |
|---|---|
| 목적 | 응원·박수·매너·커뮤니티 활동 인정 |
| 공식 레벨 영향 | **❌ 없음** |
| 저장 위치 | 신규 `boxing_engagement_profiles.rp_total` (또는 별도 `rp_logs`) |
| 활용 | 응원 랭킹·매너 랭킹·코너맨 시스템(v2) |
| 적립 사례 | 응원 보낸 사람 +5 RP, 박수 보낸 사람 +1 RP, 일기 작성 +0 (XP·gems만) |

---

## 4. 공식 XP / QUEST XP / 파이트 머니 / RP 비교표

| 비교 기준 | 공식 XP | QUEST XP | 파이트 머니 | RP |
|---|---|---|---|---|
| 목적 | 진짜 실력 누적 | 몰입 보조 | 앱 내 구매 | 매너·커뮤니티 |
| 저장 위치 | `member_progress.total_xp` + `xp_logs` | `boxing_engagement_events` 합산 | `user_wallets.gems_balance` | `boxing_engagement_profiles.rp_total` |
| 지급 조건 | 코치 승인·보스전·출석·grant_manual_xp | 퀴즈·재미 챌린지·일기·이벤트 | 신규 RPC가 내부에서 grant_gems | 응원 보내기·박수 |
| 중복 지급 방지 | 기존 흐름 (mission_submissions·boss_battle 단일성) | `idempotency_key` UNIQUE | 동일 idempotency_key 기준 | 일일 한도 + 자기 자신 금지 |
| 공식 레벨 영향 | ✅ 있음 (코어) | ❌ 없음 | ❌ 없음 | ❌ 없음 |
| 사용처 | 레벨업·승급·랭킹 | QUEST 랭킹·칭호·전당 | 꾸미기·프레임·스티커·카드팩·재도전권 | 응원·매너 랭킹 |
| UI 표시 위치 | HomePage 헤더 (메인) | HomePage 보조 바 + MyPage 전당 | RewardsPage / 상점 | MyPage / 응원 카드 |
| 보안 요구사항 | 기존 SECURITY DEFINER + 코치 승인 | RPC 내 amount 상수 + idempotency | RPC 경유만 (직접 update X) | 일일 한도 + dedup |

---

## 5. 금지되는 위험 구조

| # | 금지 시나리오 | 사유 |
|---|---|---|
| 1 | 퀴즈 정답으로 `member_progress.total_xp` 증가 | 공식 등급 오염 |
| 2 | 재미 챌린지 완료로 공식 `current_level` 변경 | 공식 승급 룰 파괴 |
| 3 | 클라이언트에서 `user_wallets` 직접 update | 잔액 무결성 깨짐, 무한 파밍 가능 |
| 4 | 클라이언트에서 reward amount 임의 전달 | 무제한 보상 지급 |
| 5 | 기존 `/challenges` 21일 챌린지와 새 복싱 챌린지 query key 충돌 (`["challenges"]` 재사용) | 캐시 무효화 시 두 도메인 모두 갱신 → 잘못된 데이터 |
| 6 | 기존 ChatAssistant 대신 새 AI 챗봇 생성 | CLAUDE.md 절대 규칙 위반 |
| 7 | 실존 복서·영화·만화 콘텐츠를 seed에 바로 삽입 | 권리 침해 위험 |
| 8 | `levels` / `missions` 데이터를 보조 기능과 섞어 INSERT | 공식 데이터 오염 |
| 9 | 공식 미션 status enum / 컬럼명 변경 | 코치 승인 흐름 깨짐 |
| 10 | 보상 RPC를 `SECURITY INVOKER` 로 작성 | 권한 가드 우회 |

---

## 6. 권장 신규 도메인명

| 영역 | 네이밍 |
|---|---|
| DB 접두어 (1순위) | `boxing_engagement_*` |
| DB 접두어 (선택) | `boxing_academy_*` (퀴즈 한정) / `boxing_fun_*` (챌린지 한정) |
| Query key prefix | `["boxing-engagement", ...]` / `["boxing-academy", ...]` / `["boxing-fun-challenges", ...]` / `["champion-journal", ...]` / `["boxing-cheers", ...]` |
| 서비스 파일 | `src/services/boxingEngagementService.ts` |
| 훅 | `useBoxingEngagement` / `useBoxingAcademy` / `useBoxingFunChallenges` / `useChampionJournal` / `useBoxingCheers` |
| 컴포넌트 폴더 | `src/components/engagement/` |
| 데이터/콘텐츠 | `src/data/engagement/` (퀴즈 seed·재미 챌린지 메타) |
| 메시지 helper | `src/lib/engagement/engagementMessageHelper.ts` (오삼이 정적 메시지) |

---

## 7. 신규 DB 설계 초안 (마이그레이션 작성 X)

### 7-1. boxing_engagement_profiles

| 항목 | 내용 |
|---|---|
| 목적 | 회원당 1행 — QUEST XP·RP 누적 + 일일 카운터 |
| 주요 컬럼 | `user_id` (PK, FK auth.users), `quest_xp_total`, `rp_total`, `daily_counters jsonb`, `season_started_at`, `created_at`, `updated_at` |
| 공식 분리 | `member_progress` 미참조. 별도 테이블 — 공식 XP·level·rank 컬럼 없음 |
| RLS | SELECT 본인+매니저+super_admin / INSERT 본인 / UPDATE 본인+매니저+super_admin |
| 중복 방지 | `user_id` PK 단일 행 보장 |
| 확장 | season_quest_xp / 매주 재집계 / 시즌 패스 연동 |

### 7-2. boxing_engagement_events

| 항목 | 내용 |
|---|---|
| 목적 | 모든 QUEST 활동의 시계열 이벤트 로그 |
| 주요 컬럼 | `id` PK, `user_id`, `event_type` (CHECK: `quiz`·`fun_challenge`·`journal`·`cheer_send`·`cheer_receive`·`bonus`), `quest_xp_delta`, `rp_delta`, `gems_delta`, `idempotency_key`, `meta jsonb`, `awarded_at`, `created_at` |
| 공식 분리 | 공식 RPC 미호출. gems_delta 가 양수일 때 RPC 안에서 `grant_gems` 트리거 |
| RLS | 본인 SELECT / INSERT 는 RPC 경유만 (직접 INSERT 정책 거부) |
| 중복 방지 | `UNIQUE(user_id, idempotency_key)` |
| 확장 | 주간/월간 집계 view, 랭킹 산정 |

### 7-3. boxing_quiz_questions

| 항목 | 내용 |
|---|---|
| 목적 | 자체 제작 퀴즈 seed (OX·객관식·상황) |
| 주요 컬럼 | `id`, `category`, `level_band` (white/blue/red/black/all), `format` (ox/multi/scenario), `question`, `choices jsonb`, `correct_index`, `explain`, `is_published`, `rights_status` (default `original_safe`), `created_at` |
| 공식 분리 | `missions` 무관 — 별도 도메인 |
| RLS | 모두 SELECT (공개 자료) / INSERT/UPDATE 는 admin/super_admin |
| 중복 방지 | `id` PK |
| 확장 | 다국어 컬럼, 이미지 첨부, 영상 링크(`rights_review_required` 클리어 후) |

### 7-4. boxing_quiz_attempts

| 항목 | 내용 |
|---|---|
| 목적 | 회원이 퀴즈 푼 기록 |
| 주요 컬럼 | `id`, `user_id`, `question_id` FK, `selected_index`, `is_correct`, `attempt_no` (1=최초/2+=재도전), `combo_count`, `quest_xp_awarded`, `gems_awarded`, `idempotency_key`, `attempted_at` |
| 공식 분리 | 공식 mission_submissions 와 분리. 코치 승인 무관 — 자동 채점 |
| RLS | 본인 SELECT/INSERT 는 RPC 경유 / 매니저 SELECT |
| 중복 방지 | `UNIQUE(user_id, question_id, attempt_no)` + `UNIQUE(user_id, idempotency_key)` |
| 확장 | 시즌 IQ 리그, 정답률 통계 |

### 7-5. boxing_fun_challenges

| 항목 | 내용 |
|---|---|
| 목적 | 재미 챌린지 카탈로그 (스쿼트·푸시업·잽·줄넘기·개인 등) |
| 주요 컬럼 | `id`, `code` (예: `squat_30`), `title`, `description`, `difficulty` (entry/normal/advanced), `quest_xp_reward`, `gems_reward`, `daily_cap`, `cooldown_hours`, `safety_review` (default `original_safe`), `is_published`, `created_at` |
| 공식 분리 | 기존 `challenges` (21일) 와 분리 — 별도 테이블 |
| RLS | 모두 SELECT / 관리자만 INSERT/UPDATE |
| 중복 방지 | `code` UNIQUE |
| 확장 | 친구 챌린지·팀 챌린지·시즌 챌린지 메타 |

### 7-6. boxing_fun_challenge_attempts

| 항목 | 내용 |
|---|---|
| 목적 | 재미 챌린지 시도 기록 |
| 주요 컬럼 | `id`, `user_id`, `challenge_id` FK, `score` (셀프 카운트·시간 등), `pain_check` (boolean — 통증 체크), `quest_xp_awarded`, `gems_awarded`, `idempotency_key`, `attempted_at` |
| 공식 분리 | 공식 미션 흐름 무관, 자동 보상 |
| RLS | 본인 SELECT / INSERT 는 RPC 경유 / 매니저 SELECT |
| 중복 방지 | `UNIQUE(user_id, idempotency_key)` + `daily_cap` 서버 검증 |
| 확장 | 친구 매칭, 팀 점수, 시즌 랭킹 |

### 7-7. boxing_cheers

| 항목 | 내용 |
|---|---|
| 목적 | 회원-회원 응원/박수 기록 |
| 주요 컬럼 | `id`, `sender_id`, `recipient_id`, `kind` (`clap`/`sticker`), `template_code`, `created_at` |
| 공식 분리 | 자체 도메인 |
| RLS | 본인 SELECT (sender 또는 recipient) / INSERT 는 RPC 경유 |
| 중복 방지 | `UNIQUE(sender_id, recipient_id, kind, date_trunc('day', created_at))` 또는 RPC 안 일일 한도. 자기 자신 거부 |
| 확장 | 응원 랭킹, 매너 점수 |

### 7-8. champion_journal_entries

| 항목 | 내용 |
|---|---|
| 목적 | 챔피언 일기 (1줄 회고 + 사진) |
| 주요 컬럼 | `id`, `user_id`, `entry_date` (KST), `mood`, `text`, `photo_url`, `quest_xp_awarded`, `gems_awarded`, `idempotency_key`, `created_at` |
| 공식 분리 | 공식 데이터 무관 |
| RLS | 본인만 SELECT/INSERT/UPDATE |
| 중복 방지 | `UNIQUE(user_id, entry_date)` — 하루 1행. `entry_date` 가 오늘 KST 일 때만 보상 |
| 확장 | 90일 회고 모음, 사진 갤러리 |

---

## 8. 보상 RPC 설계 초안 (구현 X)

### 공통 패턴

- 모두 `SECURITY DEFINER` + `SET search_path = public`
- 본인 / `is_branch_manager_of(auth.uid(), _user)` / `has_role(auth.uid(), 'super_admin')` 권한 가드
- 보상 액수는 **서버 함수 안 상수표** 사용 — 클라이언트 amount 전달 X
- `idempotency_key` UNIQUE 로 중복 차단
- 파이트 머니가 양수면 함수 안에서 `grant_gems(_user_id, _amount, _reason)` 호출
- QUEST XP / RP 는 함수 안에서 `boxing_engagement_events` insert + `boxing_engagement_profiles` UPDATE

### 8-1. submit_boxing_quiz_attempt

| 항목 | 내용 |
|---|---|
| 입력 | `_question_id uuid`, `_selected_index int`, `_idempotency_key text` |
| 서버 검증 | (1) `_question_id` 존재·is_published. (2) 같은 idempotency_key 중복 거부. (3) 같은 question_id 의 본인 attempt_no 카운트로 attempt_no 결정. |
| 지급 | 최초 정답 = QUEST XP +30 / 파이트 머니 +100. 재도전 정답 = +10 / +30. 콤보(3연속) +50 / +150. 오답 = 0. |
| 중복 방지 | `UNIQUE(user_id, question_id, attempt_no)` + idempotency_key |
| 공식 XP 미수정 | `member_progress` / `xp_logs` 미참조 |
| 파이트 머니 | 함수 안에서 `grant_gems(user_id, gems_award, 'quiz')` |
| 반환값 | `{success, is_correct, attempt_no, quest_xp_awarded, gems_awarded, combo_count}` |

### 8-2. submit_boxing_fun_challenge_attempt

| 항목 | 내용 |
|---|---|
| 입력 | `_challenge_id uuid`, `_score int`, `_pain_check boolean`, `_idempotency_key text` |
| 서버 검증 | (1) `_pain_check=false` 면 거부. (2) 일일 시도 수 ≥ daily_cap 이면 보상 0. (3) 직전 시도 후 cooldown_hours 미경과면 거부. (4) idempotency_key 중복 거부. |
| 지급 | 난이도 + 베스트 스코어 가산. entry: QUEST XP 50~100 / 파이트 머니 100~300. normal: 100~200 / 300~700. advanced: 200~400 / 700~1200. |
| 중복 방지 | idempotency_key + 일일 한도 + 쿨타임 |
| 공식 XP 미수정 | `member_progress` 미참조 |
| 파이트 머니 | `grant_gems(user_id, gems_award, 'fun_challenge:<code>')` |
| 반환값 | `{success, daily_count, quest_xp_awarded, gems_awarded, best_score}` |

### 8-3. submit_champion_journal_entry

| 항목 | 내용 |
|---|---|
| 입력 | `_text text`, `_mood text`, `_photo_url text NULL`, `_idempotency_key text` |
| 서버 검증 | (1) 오늘 KST 기준 본인 entry 가 이미 있으면 보상 0 (UPDATE 만 허용). (2) text 길이 1~500자. (3) idempotency_key 중복 거부. |
| 지급 | 하루 최초 작성 = QUEST XP +20 / 파이트 머니 +50. 같은 날 수정/추가 = 0. |
| 중복 방지 | `UNIQUE(user_id, entry_date)` |
| 공식 XP 미수정 | 무관 |
| 파이트 머니 | `grant_gems(user_id, 50, 'journal_first_today')` |
| 반환값 | `{success, entry_id, is_first_today, quest_xp_awarded, gems_awarded}` |

### 8-4. send_boxing_cheer

| 항목 | 내용 |
|---|---|
| 입력 | `_recipient_id uuid`, `_kind text` (clap/sticker), `_template_code text NULL`, `_idempotency_key text` |
| 서버 검증 | (1) `_recipient_id = auth.uid()` 면 거부 (자기 자신 응원 금지). (2) 같은 sender→recipient→kind→오늘 1회만 (일일 한도). (3) 일일 보낸 응원 총합 한도(예: 20). (4) idempotency_key 중복 거부. |
| 지급 (sender) | RP +5 |
| 지급 (recipient) | 파이트 머니 +10~30 (kind별 상수) — `grant_gems(recipient, 10, 'cheer_received')` |
| 중복 방지 | UNIQUE(sender_id, recipient_id, kind, date_trunc('day', created_at)) |
| 공식 XP 미수정 | 무관 |
| 반환값 | `{success, sender_rp_awarded, recipient_gems_awarded}` |

### 8-5. claim_boxing_engagement_reward

| 항목 | 내용 |
|---|---|
| 입력 | `_reason_code text`, `_idempotency_key text` |
| 서버 검증 | reason_code별 보상 상수표 안에서만 지급. idempotency_key UNIQUE. |
| 지급 | reason_code 별 사전 정의 (예: `daily_login_bonus` = QUEST XP +5 / gems +10) |
| 중복 방지 | idempotency_key + reason_code별 일일 한도 |
| 공식 XP 미수정 | 무관 |
| 반환값 | `{success, quest_xp_awarded, gems_awarded, rp_awarded}` |

### 8-6. get_my_boxing_engagement_summary

| 항목 | 내용 |
|---|---|
| 입력 | (없음) |
| 서버 검증 | auth.uid() 본인만 |
| 반환값 | `{quest_xp_total, rp_total, gems_balance(읽기), today_quiz_count, today_challenge_count, today_journal_done, today_cheers_sent}` |
| 공식 XP 미수정 | 읽기만 |

---

## 9. 보상 중복 방지 설계

| 메커니즘 | 적용 대상 | 구현 방식 |
|---|---|---|
| `idempotency_key` UNIQUE | 모든 RPC 보상 이벤트 | `boxing_engagement_events.idempotency_key` `UNIQUE(user_id, idempotency_key)` |
| 같은 퀴즈 최초 정답 1회만 정식 보상 | 퀴즈 | `attempt_no=1 AND is_correct=true` 조건일 때만 풀 보상 |
| 오답 후 재도전 정답 축소 | 퀴즈 | `attempt_no >= 2` 면 보상 1/3 |
| 같은 재미 챌린지 하루 최대 3회 | 일반 챌린지 | RPC 안 `count(*) WHERE date_trunc('day', attempted_at)=today` ≥ daily_cap → 보상 0 |
| 고강도 챌린지 하루 최대 1회 | 고강도 | `daily_cap=1` + `cooldown_hours=24` |
| 챔피언 일기 하루 최초 1회만 | 일기 | `UNIQUE(user_id, entry_date)` + `is_first_today` 분기 |
| 응원 보상 일일 제한 | 응원 | sender 일일 보낸 수 ≤ 20, recipient 일일 받은 보상 ≤ 5회 |
| 같은 대상 반복 응원 파밍 방지 | 응원 | `UNIQUE(sender, recipient, kind, day)` |
| 자기 자신 응원 금지 | 응원 | `sender_id = recipient_id` 거부 |

---

## 10. 보상 금액 설계 초안

### 퀴즈

| 시도 | QUEST XP | 파이트 머니 |
|---|---|---|
| 최초 정답 (attempt_no=1, correct) | +30 | +100 |
| 오답 후 재도전 정답 (attempt_no≥2, correct) | +10 | +30 |
| 3문제 연속 정답 보너스 | +50 (가산) | +150 (가산) |
| 오답 | 0 | 0 |

### 재미 챌린지

| 난이도 | QUEST XP | 파이트 머니 |
|---|---|---|
| 입문 (entry) | +50 ~ +100 | +100 ~ +300 |
| 일반 (normal) | +100 ~ +200 | +300 ~ +700 |
| 고급 (advanced) | +200 ~ +400 | +700 ~ +1200 |

### 챔피언 일기

| 행동 | QUEST XP | 파이트 머니 |
|---|---|---|
| 하루 최초 작성 | +20 | +50 |
| 같은 날 수정 | 0 | 0 |

### 응원

| 주체 | 보상 |
|---|---|
| 보낸 사람 (sender) | RP +5 |
| 받은 사람 (recipient) | 파이트 머니 +10 ~ +30 (kind별) |
| 일일 한도 | sender 20회 / recipient 5회 / 자기 자신 0회 |

---

## 11. UI 표시 방식

| 페이지 | 영역 | 노출 |
|---|---|---|
| **HomePage** | 헤더 직후 | 오삼이 오늘의 브리핑 카드 + 오늘의 보조 퀘스트 (메인 1 + 서브 2~3) |
| **MyPage** | 하단 추가 섹션 | 나만의 복싱 전당 요약 (QUEST XP / RP / 칭호 / 일기 카운트) |
| **RewardsPage** / **CharacterStudioPage** | 상점 영역 | 파이트 머니 사용처 (프레임·스킨·스티커·재도전권·카드팩) |
| **MissionsPage** | 하단 보조 카드만 | 공식 훈련 리스트 그대로 유지. 보조 진입 카드("복싱 IQ 퀴즈" 링크 등)만 추가 |
| **ChallengesPage** | 별도 탭 또는 신규 라우트 | 21일 챌린지(기존) ↔ 재미 챌린지(신규) 명확 분리. `/fun-challenges` 또는 SubNav 분기 |

---

## 12. ChatAssistant와 오삼이 메시지 분리

| 메시지 종류 | 채널 | 구현 |
|---|---|---|
| 동적 대화 (자유 질문·답변) | **기존 ChatAssistant** | `src/components/ChatAssistant.tsx` + `chat-assistant` Edge Function 단일 경로. 신규 챗박스 절대 추가 X |
| 정적 브리핑 (오늘 한마디) | 정적 카드 | HomePage 카드 — `engagementMessageHelper.ts` 풀에서 일자 시드로 결정적 선택 |
| 정적 칭찬 (퀘스트 완료 시) | 토스트 | `questMessageEngine.ts` 패턴 또는 `engagementMessageHelper.ts` 안 새 type |
| 정적 퀴즈 피드백 (정답/오답) | 모달 | `engagementMessageHelper.ts` 안 별도 풀 — `quizCorrect`, `quizWrong`, `quizCombo3` 등 |
| 페르소나별 톤 분기 (White/Blue/Red/Black) | 정적 카드 | seed = userId + KST date + persona 로 결정적 메시지 선택 |

> **원칙**: 새 AI 챗봇 절대 X. 모든 신규 메시지는 정적 풀에서 선택.

---

## 13. 권리 / 안전 원칙

| 권리 라벨 | 처리 |
|---|---|
| `original_safe` | MVP seed 즉시 사용 |
| `public_reference_needs_review` | 역사적 사실 참고 가능, 문구 검토 필요 |
| `rights_review_required` | 실존 선수·영화·만화·명언·영상 — **MVP seed 진입 금지**, 권리 확인 후 v3 |
| `unsafe_or_high_risk` | 부상 위험. **safety_review_required** + 코치 감독 또는 안전 변환 |

| 안전 원칙 |
|---|
| MVP seed 는 **자체 제작 콘텐츠만** 사용 |
| 실존 선수 / 영화 / 만화 / 명언 / 영상은 **rights_review_required** 라벨로 보류 |
| 위험 동작은 **safety_review_required** 라벨로 코치 감독 또는 대체 미션 전환 |
| 명장면 챌린지는 [선행 문서 9번 안전 변환표](./153-quest-full-engagement-roadmap.md#9-명장면-챌린지-안전-변환표) 적용 후만 구현 |
| 챌린지 시도 전 `pain_check` 필수, 거부 시 보상 0 |

---

## 14. 4단계 DB 구현 전 체크리스트

- [ ] **기존 마이그레이션 마지막 파일 확인** — 직전: `20260507000000_diet_early_start_post_program.sql`. 신규는 `20260508000000_*` 또는 그 이상 단조 증가.
- [ ] **`grant_gems` RPC 시그니처 확인** — `grant_gems(_user_id uuid, _amount integer, _reason text DEFAULT '링젬 지급')` ([20260414105245](../supabase/migrations/20260414105245_bcb175c2-a47c-48e8-a5e7-44a136b2169d.sql) L166). SECURITY DEFINER.
- [ ] **`has_role` / `is_branch_manager_of` 사용법 확인** — `has_role(_user_id uuid, _role app_role)` / `is_branch_manager_of(_manager_id uuid, _member_id uuid)`. 두 함수 모두 신규 RPC 권한 가드에서 그대로 호출.
- [ ] **`user_wallets` 실제 테이블명 확인** — [src/hooks/useWallet.ts](../src/hooks/useWallet.ts) L13 = `user_wallets` (✅ 컬럼: `user_id`, `gems_balance`, `total_earned`, `total_spent`).
- [ ] **RLS 패턴 확인** — `ENABLE ROW LEVEL SECURITY` + `DROP POLICY IF EXISTS` 후 `CREATE POLICY` 멱등 패턴. SELECT(본인+매니저+super_admin) / INSERT(본인 또는 RPC 경유) / UPDATE(본인+매니저+super_admin).
- [ ] **`auth.uid()` SQL Editor 테스트 주의** — Editor 에서 NULL. 테스트 쿼리는 명시적 user_id 사용.
- [ ] **공식 `member_progress` 수정 금지** — 어떤 신규 RPC도 `member_progress` UPDATE 금지.
- [ ] **공식 XP 지급 금지** — `xp_logs` INSERT 금지. `grant_manual_xp` 호출 금지.
- [ ] **새 테이블만 추가** — 기존 테이블에 컬럼 추가도 본 단계에선 금지. 모든 신규 데이터는 별도 테이블.
- [ ] **기존 테이블 destructive 변경 금지** — DROP COLUMN / DROP TABLE / ALTER TYPE 절대 금지.
- [ ] **클라이언트 amount 전달 금지 검증** — 모든 신규 RPC 의 입력 파라미터에 `_amount` / `_quest_xp` / `_gems` 를 받지 않도록 확인.
- [ ] **idempotency_key 컬럼 모든 attempts/events 테이블에 포함** + UNIQUE 인덱스.
- [ ] **자기 자신 응원 거부 / sender = recipient 가드** RPC 안에서.
- [ ] **`pain_check=true` 검증** 고강도 챌린지 RPC 안.
- [ ] **`useSpendGems` 의 직접 update 패턴 답습 금지** — 신규 모든 보상은 `grant_gems` 또는 신규 SECURITY DEFINER RPC 경유.

---

## 부록 — 1단계 / 2단계 문서와의 관계

| 단계 | 문서 | 역할 |
|---|---|---|
| 1단계 | (대화 안 분석) 안전 진단 / 충돌 분석 / 작업 계획 | 보호 영역 / 충돌 위험 / 구현 순서 식별 |
| 2단계 | [`153-quest-full-engagement-roadmap.md`](./153-quest-full-engagement-roadmap.md) | 전체 아이디어 백로그 / v1~v3 로드맵 |
| **3단계** | **본 문서** | **공식 XP / QUEST XP / 파이트 머니 / RP 분리 설계** |
| 4단계 (예정) | (생성 X — 다음 지시 시) | v1.1 마이그레이션 1건 + cacheKeys 모듈 + grant 로직 1건 |
