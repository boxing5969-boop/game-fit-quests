# 153 QUEST v1.5 구현 계획

> 작성: 13단계 (설계 단계)
> 코드 / 마이그레이션 / RPC / 컴포넌트 변경 0 — 본 문서만 신규 추가.
> 14~17단계 코드 AI 가 시작 전에 반드시 읽어야 할 v1.5 헌법.

---

## 0. 본 문서의 목적

v1 은 "오삼이 브리핑 / 복싱 IQ / 재미 챌린지 / 챔피언 일기 / 세컨드 응원 / 복싱 전당" 까지 출시한 상태(`docs/153-quest-v1-qa-regression-report.md` PASS_WITH_NOTES). v1.5 는 그 위에 **유지율 강화**(컨디션, 리턴 라운드, 숨겨진 미션, 복싱 IQ 리그, 복서 스타일 진단, 성장 리포트)를 얹는 단계다.

본 문서는:
- v1.5 의 **범위를 확정**하고
- 어떤 기능을 v2 이후로 **보류**할지 명시하고
- v1 점검 과정에서 발견한 **8 가지 함정**을 14~17 단계 코드 AI 가 동일하게 밟지 않도록 박아둔다.

---

## 1. v1 상태 요약

### 1-1. v1 까지 출시된 기능

| 도메인 | 컴포넌트 / 파일 | 비고 |
|---|---|---|
| 오삼이 일일 브리핑 | `OsamiDailyBriefingCard` | KST 일자 시드 결정성 |
| 보조 퀘스트 미니 패널 | `TodayQuestMiniPanel` | 3카드 (IQ / 챌린지 / 일기) + 세컨드 응원 외부 카드 |
| 복싱 IQ 퀴즈 | `BoxingAcademyQuizModal` | seed 8 문제 / 정답·오답·이미보상 3분기 / 재도전 |
| 재미 챌린지 아레나 | `FunChallengeArenaSheet` + `FunChallengeCard` + `SafetyCheckPanel` | seed 8 챌린지 / 부위별 통증 체크 |
| 챔피언 일기 | `ChampionJournalSheet` | 8 prompt 칩 / first_of_day 분기 |
| 세컨드 응원 | `SecondCheerSheet` + `CheerStickerPicker` | 10 스티커 / 같은 지점 후보 / 자기 자신 차단 |
| 나만의 복싱 전당 | `BoxingHallSummaryCard` + `BoxingHallStatTile` + `LeagueStoryBadge` + `OsamiHallComment` | MyPage 5줄 추가 |

### 1-2. v1 의 핵심 분리 원칙 (계속 유지)

1. 공식 1~40 레벨 시스템(`levels` / `missions` / `mission_videos` / `mission_submissions` / `member_progress` / `approve_mission_submission` / `record_attendance` / `useManualLevelUp` / `usePassBossBattle` / `ChatAssistant` / 21일 챌린지)은 **절대 수정하지 않는다**.
2. QUEST XP / RP / 파이트 머니는 별도 도메인(`boxing_engagement_*`)에서 관리한다.
3. 파이트 머니 변동은 **무조건 `grant_gems` RPC 경유** — wallet 직접 update 0건.
4. 클라이언트는 보상 amount 를 보내지 않는다 — 서버 RPC 가 row 와 내부 규칙으로 결정.
5. 모든 보상 이벤트는 `boxing_engagement_events.unique(user_id, idempotency_key)` 로 중복 차단.

### 1-3. v1 누적 자산 (v1.5 가 그대로 활용)

| 자산 | 위치 |
|---|---|
| profile 테이블 | `boxing_engagement_profiles` (quest_xp / respect_points / 8 카운터 + streak 2 + last_daily_briefing_date + metadata jsonb) |
| 이벤트 원장 | `boxing_engagement_events` (idempotency_key UNIQUE) |
| 퀴즈 | `boxing_quiz_questions` / `boxing_quiz_attempts` |
| 챌린지 | `boxing_fun_challenges` / `boxing_fun_challenge_attempts` |
| 응원 | `boxing_cheers` |
| 일기 | `champion_journal_entries` |
| service 헬퍼 | `sbFrom` / `sbRpc<T>` cast 격리 (types.ts 미반영) |
| 한국어 에러 | `ENGAGEMENT_ERROR_MAP` (10 종) |
| 정적 사전 | `osamiEngagementMessages.ts` / `boxingQuestNarratives.ts` |

---

## 2. v1.5 목표

회원이 **더 오래 머무르게 만드는 유지율 강화 레이어**를 추가한다. 구체적으로:

1. **오늘의 컨디션에 맞춰 앱이 반응**하게 만든다 (컨디션 게이지)
2. **쉬었다 돌아온 회원을 혼내지 않고 살린다** (리턴 라운드)
3. **예상치 못한 좋은 행동을 발견·보상**한다 (숨겨진 미션)
4. **퀴즈를 계속 풀 이유를 만든다** (복싱 IQ 리그)
5. **"나는 어떤 복서인가?"를 보여준다** (복서 스타일 진단)
6. **학부모/코치가 보기 좋은 요약을 제공**한다 (성장 리포트)
7. **푸시 알림 문구를 data 파일로 정리**한다 (알림 인프라는 v2 이후)

핵심 톤:
- "혼내지 않는다"
- "공식 = 진지한 성장 / QUEST = 즐거운 성장 / v1.5 = 다정한 회복"

---

## 3. 공식 1~40 레벨 보호 원칙

v1 보호 원칙(§1-2) 그대로 유지 + v1.5 추가 강화:

| # | 원칙 |
|---|---|
| 1 | **공식 1~40 훈련 리스트는 v1.5 에서도 수정하지 않는다.** `src/data/allLevelsData.ts`, `whiteLevel1Data.ts`, `sharedConstants.ts` 안의 공식 레벨/훈련 데이터 무수정. |
| 2 | **`levels` / `missions` / `mission_videos` / `mission_submissions` / `member_progress` 테이블 무수정.** SELECT 만 허용. |
| 3 | **`approve_mission_submission` / `record_attendance` 호출 0건.** 신규 영역 grep 0. |
| 4 | **`useManualLevelUp` / `usePassBossBattle` import 0건.** 신규 영역 grep 0. |
| 5 | **공식 XP 와 QUEST XP 는 합치지 않는다.** `member_progress.total_xp` 직접 변경 0. QUEST XP 는 `boxing_engagement_profiles.quest_xp` 로만 누적. |
| 6 | **컨디션 / 리턴 라운드 / 숨겨진 미션 / IQ 리그 / 스타일 진단 / 성장 리포트는 모두 보조 시스템.** 공식 레벨업, 공식 승급, 보스전 조건에 영향 0. |
| 7 | **파이트 머니는 RPC 내부 `grant_gems` 만 경유.** `from("user_wallets").update` / `from("wallets").update` 신규 0건. `useSpendGems` 의 기존 안티패턴은 v1.5 도메인에서 차용 금지. |
| 8 | **`ChatAssistant` 단일 경로 유지.** 새 AI 챗박스 / 새 스트리밍 채널 / 새 Edge Function 0건. 오삼이 메시지는 정적 사전. |
| 9 | **기존 `/challenges` 21일 챌린지 무수정.** `challengeService.submitChallengeCheckin` / `syncQuestCheckin` / `queryKey: ["challenges"]` 신규 호출 0건. |
| 10 | **`src/integrations/supabase/types.ts` 직접 수정 금지.** 자동 생성 파일. 신규 RPC/테이블은 v1 의 `sbFrom` / `sbRpc<T>` cast 패턴 그대로 사용. |

---

## 4. v1.5 구현 기능 목록

7 기능 / 4 단계로 구성.

### 4-1. 컨디션 게이지 (14단계)

| 항목 | 내용 |
|---|---|
| 기능명 | 컨디션 게이지 (Daily Condition Gauge) |
| 목적 | 회원이 오늘의 상태를 선택하고, 그 상태에 맞게 보조 퀘스트 추천 문구·우선순위가 바뀌게 한다 |
| 사용자 가치 | "앱이 내 상태를 알아준다" — 피곤·통증 시 강행 안 하고, 좋을 때 도전형 추천 |
| 필요한 DB/RPC | 신규 테이블 `boxing_condition_logs` + RPC `submit_boxing_condition` (보상 0) |
| 필요한 컴포넌트 | `ConditionGaugeCard` / `ConditionGaugeSheet` / `useBoxingCondition` / `boxingConditionMessages.ts` |
| 기존 시스템 영향 | `HomeEngagementSection` 상단에 카드 1개 추가 / `TodayQuestMiniPanel` 카드 우선순위만 조정 |
| 공식 레벨 영향 여부 | **없음** (보상 0, member_progress 무수정) |
| 구현 단계 | 14단계 |
| 위험도 | 낮음 |
| 보류 조건 | profile.metadata 직접 update 강행 시 RLS deny 가능 → 별도 테이블 강제 (§11-③) |

### 4-2. 리턴 라운드 (15단계)

| 항목 | 내용 |
|---|---|
| 기능명 | 리턴 라운드 (Return Round) |
| 목적 | 3 / 7 / 14 / 30 일 미접속 회원이 돌아왔을 때 부담 없는 복귀 퀘스트 + 보상 제공 |
| 사용자 가치 | "혼내지 않는 복귀" — "돌아온 것 자체가 오늘의 승리입니다" |
| 필요한 DB/RPC | 신규 테이블 `boxing_return_round_claims` + RPC `get_return_round_status` / `claim_return_round_reward` |
| 필요한 컴포넌트 | `ReturnRoundBanner` / `ReturnRoundSheet` / `ReturnRoundMissionCard` / `useReturnRound` / `returnRoundMessages.ts` |
| 기존 시스템 영향 | `HomeEngagementSection` 상단 배너 (조건 active 일 때만) |
| 공식 레벨 영향 여부 | **없음** — QUEST XP / 파이트 머니만 지급. `record_attendance` 호출 0 |
| 구현 단계 | 15단계 |
| 위험도 | **중간** |
| 보류 조건 | 마지막 활동일 계산 시 `attendance_logs` 사용 강행 시 (§11-④) / 30일 보상 +500 어뷰징 (§11-⑤) |

### 4-3. 숨겨진 미션 (16단계)

| 항목 | 내용 |
|---|---|
| 기능명 | 숨겨진 미션 (Hidden Missions) |
| 목적 | 응원·일기·퀴즈·챌린지·복귀·정리정돈 같은 좋은 행동을 발견·보상 |
| 사용자 가치 | "예상하지 못한 보상" — 게임성·수집욕 강화 |
| 필요한 DB/RPC | 신규 테이블 `boxing_hidden_missions` (8 seed) + `boxing_hidden_mission_claims` + RPC `check_and_claim_hidden_missions` |
| 필요한 컴포넌트 | `HiddenMissionToast` / `HiddenMissionPanel` / `useHiddenMissions` / `hiddenMissionCatalog.ts` |
| 기존 시스템 영향 | 퀴즈/챌린지/일기/응원 mutation onSuccess 에서 RPC 1회 호출 + toast 표시 |
| 공식 레벨 영향 여부 | **없음** — 공식 missions 와 분리. QUEST XP / RP / 파이트 머니만 지급 |
| 구현 단계 | 16단계 |
| 위험도 | **중간** |
| 보류 조건 | check_and_claim 호출 빈도 가드 미설정 시 DB 부하 (§11-⑥) |

### 4-4. 복싱 IQ 리그 (16단계)

| 항목 | 내용 |
|---|---|
| 기능명 | 복싱 IQ 리그 (Boxing IQ League) |
| 목적 | 퀴즈 정답 수 / 정답률 / 연속 정답 / 주간 참여를 요약 — 퀴즈 지속 동기 |
| 사용자 가치 | "내 IQ 등급을 보여준다" — 입문생 → 연구생 → 박사 후보 → 링 전술가 → IQ 마스터 |
| 필요한 DB/RPC | 신규 RPC `get_boxing_iq_league_summary` (기존 `boxing_quiz_attempts` + `boxing_engagement_profiles` 집계) — 신규 테이블 0 |
| 필요한 컴포넌트 | `BoxingIqLeagueCard` / `useBoxingIqLeague` |
| 기존 시스템 영향 | MyPage 복싱 전당 안에 요약 타일 추가 (또는 Home 보조 카드) |
| 공식 레벨 영향 여부 | **없음** — 공식 레벨/리그와 분리. 표시만 |
| 구현 단계 | 16단계 |
| 위험도 | 낮음 |
| 보류 조건 | branch 리더보드는 v1.5 에서는 설계만 / 구현 보류 |

### 4-5. 복서 스타일 진단 (17단계)

| 항목 | 내용 |
|---|---|
| 기능명 | 복서 스타일 진단 (Boxer Style Diagnosis) |
| 목적 | 회원 활동 패턴으로 6 스타일 표시 — 스피드/파워/테크니션/인내형/가드/세컨드형 |
| 사용자 가치 | "나는 어떤 복서인가?" — 정체성 강화, 다음 행동 유도 |
| 필요한 DB/RPC | **신규 0** — `boxerStyleRules.ts` 순수 함수 + 기존 데이터 합산 |
| 필요한 컴포넌트 | `BoxerStyleDiagnosisCard` / `useBoxerStyleDiagnosis` / `boxerStyleRules.ts` |
| 기존 시스템 영향 | MyPage 표시 전용 |
| 공식 레벨 영향 여부 | **없음** — 점수 계산 input 에서 `member_progress` 필드 자체 제외 (§11-⑦) |
| 구현 단계 | 17단계 |
| 위험도 | 낮음 |
| 보류 조건 | 점수 함수에 공식 데이터 누설 시 (§11-⑦) |

### 4-6. 성장 리포트 (17단계)

| 항목 | 내용 |
|---|---|
| 기능명 | 성장 리포트 (Growth Report) |
| 목적 | 회원/학부모/코치가 보기 좋은 요약 — 공식 성장 + QUEST 성장 분리 표시 |
| 사용자 가치 | "이번 기간 가장 눈에 띄는 성장은 꾸준함입니다" — 학부모 설득 자료 |
| 필요한 DB/RPC | **신규 0** — 기존 `member_progress`(읽기) + `boxing_engagement_profiles` + 관련 카운터 합산 |
| 필요한 컴포넌트 | `GrowthReportCard` / `GrowthReportDetailSheet` / `useGrowthReport` / `growthReportMessages.ts` |
| 기존 시스템 영향 | MyPage 의 `BoxingHallSummaryCard` 아래 카드 추가 |
| 공식 레벨 영향 여부 | **없음** — `member_progress` 는 SELECT 만 |
| 구현 단계 | 17단계 |
| 위험도 | 낮음 |
| 보류 조건 | "공식 승급 심사 결과처럼" 표현 시 / PDF 생성은 v2 이후 |

### 4-7. 푸시 알림 문구 data 파일 (17단계)

| 항목 | 내용 |
|---|---|
| 기능명 | 푸시 알림 문구 카탈로그 |
| 목적 | 8 카테고리 (app_open / quiz_available / challenge_available / return_round / journal_reminder / cheer_received / hidden_mission_claimed / weekly_report_ready) 문구 정리 |
| 사용자 가치 | (간접) v2 푸시 인프라 작업 시 즉시 사용 가능한 문구 라이브러리 |
| 필요한 DB/RPC | **0** |
| 필요한 컴포넌트 | `boxingQuestNotificationCopy.ts` data 파일만 |
| 기존 시스템 영향 | 0 — UI 진입점 0 |
| 공식 레벨 영향 여부 | **없음** |
| 구현 단계 | 17단계 |
| 위험도 | 매우 낮음 |
| 보류 조건 | 실제 push 발송 시스템 신규 구축 시 (절대 v1.5 에서 만들지 말 것) |

---

## 5. v1.5 보류 기능 목록 (v2 이후로 넘김)

| 기능 | 보류 사유 |
|---|---|
| 그림자 복서 | 코너맨/라이벌 시즌과 묶여야 의미. v2 커뮤니티 구간 |
| 코너맨 매칭 | 회원-회원 매칭 알고리즘 + 동의 흐름 필요. v2 |
| 팀 레이드 / 짐 레이드 | 그룹 활동 인프라(채팅/알림) 필요. v2 |
| 코치 대시보드 몰입 데이터 확장 | 본 v1.5 데이터 누적 후 v2 에서 시각화 |
| 라이벌 매칭 / 라이벌 시즌 | 매칭 알고리즘 + 동의. v2 |
| 시즌 스토리 패스 | 시즌 시스템 인프라 필요. v2 |
| 레전드 카드 300장 | 카드 / 도감 / 수집 시스템 인프라 필요. v3 |
| 실존 선수 / 영화 / 만화 명언 콘텐츠 | 저작권 검토 필요. v3 |
| 영상 인증 / AI 자세 분석 | ML 인프라 + 코치 검수 흐름. v3 |
| 블랙 트레이너 시스템 | 페르소나 확장. v2 후반 |
| 오삼이 라디오 | 음성 인프라 + 콘텐츠 라이브러리. v3 |
| **실제 푸시 발송 시스템** | OS 권한 / 토큰 관리 / Edge 스케줄러. v2 (인프라 단계) |
| **branch 기준 IQ 리그 리더보드** | branch_id RLS + 정렬 RPC. v1.5 에서는 설계만 |
| **세컨드 응원 receiver gems 활성화** | 일일 receiver 한도 + sender 디바운스 정의 후. v1.5 후반 또는 v2 |
| **types.ts 자동 재생성 + sbFrom / sbRpc cast 제거** | 17단계 QA 종료 이후로 미룸 (§11-⑧) |

---

## 6. 기능별 데이터 요구사항

### 6-1. 컨디션 게이지

신규 테이블 `boxing_condition_logs`:
```
id              uuid PK default gen_random_uuid()
user_id         uuid not null references auth.users(id) on delete cascade
condition_type  text not null  -- great|normal|tired|pain|short_time
energy_level    integer
pain_area       text[]
note            text
selected_at     timestamptz not null default now()
created_at      timestamptz not null default now()
```

CHECK 제약: `condition_type IN ('great','normal','tired','pain','short_time')`.

인덱스: `(user_id, created_at DESC)`.

### 6-2. 리턴 라운드

신규 테이블 `boxing_return_round_claims`:
```
id                  uuid PK default gen_random_uuid()
user_id             uuid not null references auth.users(id) on delete cascade
return_type         text not null  -- after_3_days|after_7_days|after_14_days|after_30_days
inactive_days       integer not null
mission_code        text not null
quest_xp_granted    integer not null default 0
gems_granted        integer not null default 0
claimed_at          timestamptz not null default now()
metadata            jsonb not null default '{}'::jsonb
```

중복 차단: `boxing_engagement_events.idempotency_key = 'return-round:{return_type}:{KST_ISO_WEEK}'` 활용 (§11-⑤).

마지막 활동일 계산: **`boxing_engagement_events` 의 created_at MAX 만 사용** (§11-④). `attendance_logs` 사용 금지.

### 6-3. 숨겨진 미션

신규 테이블 `boxing_hidden_missions`:
```
id                  uuid PK default gen_random_uuid()
code                text not null unique
title               text not null
description         text not null
trigger_type        text not null
reward_quest_xp     integer not null default 0
reward_gems         integer not null default 0
reward_respect      integer not null default 0
active              boolean not null default true
sort_order          integer not null default 0
metadata            jsonb not null default '{}'::jsonb
created_at          timestamptz not null default now()
```

신규 테이블 `boxing_hidden_mission_claims`:
```
id                  uuid PK default gen_random_uuid()
user_id             uuid not null references auth.users(id) on delete cascade
mission_id          uuid not null references boxing_hidden_missions(id) on delete cascade
quest_xp_granted    integer not null default 0
gems_granted        integer not null default 0
respect_granted     integer not null default 0
claimed_at          timestamptz not null default now()
metadata            jsonb not null default '{}'::jsonb
UNIQUE (user_id, mission_id)
```

8 seed: `first_cheer` / `comeback_record` / `quiz_streak_3` / `journal_7` / `challenge_5` / `respect_30` / `balanced_boxer` / `condition_7`.

### 6-4. 복싱 IQ 리그

**신규 테이블 0**. 기존 데이터에서 집계:
- `boxing_quiz_attempts` (정답 수 / 시도 수 / 이번 주 정답)
- `boxing_engagement_profiles.current_quiz_streak` / `best_quiz_streak`

IQ 등급 함수 (서버 RPC 또는 클라이언트 순수 함수):
- 0~9: 복싱 입문생
- 10~29: 복싱 연구생
- 30~79: 복싱 박사 후보
- 80~149: 링 전술가
- 150+: 복싱 IQ 마스터

### 6-5. 복서 스타일 진단

**신규 테이블 0**. `boxerStyleRules.ts` 순수 함수.

input 타입 (공식 데이터 누설 금지 §11-⑦):
```ts
interface BoxerStyleInput {
  profile: {
    quiz_correct_count: number;
    quiz_attempt_count: number;
    challenge_clear_count: number;
    cheer_sent_count: number;
    cheer_received_count: number;
    journal_count: number;
    current_quiz_streak: number;
    best_quiz_streak: number;
  };
  challengeAttempts: Array<{ category: FunChallengeCategory; status: string }>;
  conditionLogs: Array<{ condition_type: string }>;
  hiddenMissionClaims: Array<{ code: string }>;
  // ⚠ member_progress / total_xp / current_level 절대 포함 금지
}

interface BoxerStyleDiagnosis {
  primaryStyle: BoxerStyle;
  secondaryStyle: BoxerStyle | null;
  confidence: number; // 0~100
  reason: string;
  nextSuggestion: string;
  scores: Record<BoxerStyle, number>;
}
```

데이터 부족 시 `primaryStyle = 'rookie_under_analysis'` 로 fallback.

### 6-6. 성장 리포트

**신규 테이블 0**. 기존 데이터 합산:

| 영역 | 출처 | 권한 |
|---|---|---|
| 공식 (읽기 전용) | `member_progress` | SELECT 만 |
| 공식 (읽기 전용) | `attendance_logs` (연속 출석) | SELECT 만 |
| QUEST | `boxing_engagement_profiles` | RPC |
| QUEST | `boxing_quiz_attempts` / `boxing_fun_challenge_attempts` | RPC |
| QUEST | `champion_journal_entries` / `boxing_cheers` | RPC |
| QUEST v1.5 | `boxing_condition_logs` / `boxing_hidden_mission_claims` | RPC |

### 6-7. 푸시 알림 문구

**DB 0**. `src/data/boxingQuestNotificationCopy.ts` 단일 파일.

```ts
export const BOXING_QUEST_NOTIFICATION_COPY = {
  app_open: ["오늘의 라운드가 열렸습니다. 오삼이가 기다리고 있어요.", ...],
  quiz_available: ["복싱 IQ 1문제가 준비됐습니다. 알고 치는 펀치는 더 강합니다.", ...],
  return_round: ["돌아온 것을 환영합니다. 오늘은 가볍게 다시 시작해요.", ...],
  cheer_received: ["응원이 도착했습니다. 링 위에서 혼자가 아닙니다.", ...],
  weekly_report_ready: ["이번 주 성장 리포트가 준비됐습니다.", ...],
  // ...
} as const;
```

---

## 7. 기능별 UI 삽입 위치

| 기능 | 위치 | 삽입 방식 |
|---|---|---|
| 컨디션 게이지 | `HomeEngagementSection` 최상단 또는 `OsamiDailyBriefingCard` 안 | `<ConditionGaugeCard />` 1줄 추가 |
| 리턴 라운드 배너 | `HomeEngagementSection` 최상단 (조건 active 시만) | `{returnRound.active && <ReturnRoundBanner />}` |
| 숨겨진 미션 toast | mutation onSuccess 글로벌 toast | `useHiddenMissions().checkAndClaim()` 호출 후 toast |
| 숨겨진 미션 패널 | MyPage 복싱 전당 안에 작은 카드 (또는 Home 보조) | `<HiddenMissionPanel />` |
| 복싱 IQ 리그 카드 | MyPage 복싱 전당 안 (우선) | `<BoxingIqLeagueCard />` |
| 복서 스타일 진단 카드 | MyPage `BoxingHallSummaryCard` 아래 | `<BoxerStyleDiagnosisCard />` |
| 성장 리포트 카드 | MyPage `BoxerStyleDiagnosisCard` 아래 | `<GrowthReportCard />` + 상세 시트 버튼 |

**HomePage / MyPage 직접 수정 라인 수 제한**:
- HomePage: 14 / 15 단계 합쳐 +3 줄 이내 (`HomeEngagementSection` 가 자체 관리)
- MyPage: 16 / 17 단계 합쳐 +5 줄 이내

---

## 8. 공식 XP / QUEST XP / RP / 파이트 머니 분리 방식

| 자산 | 정체 | 누적 위치 | 변경 경로 |
|---|---|---|---|
| 공식 XP | `total_xp` | `member_progress` | 코치 승인 / 보스전 / 승급 — v1.5 신규 코드는 **읽기만** |
| QUEST XP | 보조 경험치 | `boxing_engagement_profiles.quest_xp` + `boxing_engagement_events.quest_xp_delta` | SECURITY DEFINER RPC 만 |
| RP (Respect Points) | 응원·기여 점수 | `boxing_engagement_profiles.respect_points` + `boxing_engagement_events.respect_delta` | SECURITY DEFINER RPC 만 |
| 파이트 머니 | gems | `user_wallets.gems_balance` | **`grant_gems(_user_id, _amount, _reason)` RPC 만** — 클라이언트 직접 update 절대 금지 |

v1.5 신규 RPC 4 개 (`submit_boxing_condition` / `claim_return_round_reward` / `check_and_claim_hidden_missions` / `get_boxing_iq_league_summary`) 의 보상 흐름:

1. `auth.uid()` NULL 검증
2. row 검증 + 자격 검증 + 멱등성 검증
3. `boxing_engagement_profiles` 업데이트 (quest_xp / respect_points 누적)
4. `boxing_engagement_events` insert (idempotency_key 포함)
5. gems 지급은 **`PERFORM public.grant_gems(v_uid, v_gems, v_reason);`** 으로만
6. `member_progress` / `user_wallets` / `mission_submissions` / `attendance_logs` 직접 UPDATE 0

표시용 안내 문구 (모든 v1.5 카드/시트에 1회 노출):
> "QUEST 보상은 공식 레벨 XP 와 분리된 보조 경험치 / 가상 통화입니다."

---

## 9. 예상 신규 테이블 또는 RPC

### 9-1. 신규 테이블 (4개)

| 테이블 | 단계 | 용도 |
|---|---|---|
| `boxing_condition_logs` | 14 | 회원 컨디션 기록 |
| `boxing_return_round_claims` | 15 | 복귀 라운드 보상 claim |
| `boxing_hidden_missions` | 16 | 숨겨진 미션 카탈로그 (8 seed) |
| `boxing_hidden_mission_claims` | 16 | 숨겨진 미션 claim |

### 9-2. 신규 RPC (5개)

| RPC | 단계 | 보상 | 비고 |
|---|---|---|---|
| `submit_boxing_condition(p_condition_type, p_energy_level, p_pain_area, p_note)` | 14 | **0** (파밍 방지) | 컨디션 저장 + briefing 메시지 갱신 |
| `get_return_round_status()` | 15 | 0 | 마지막 활동일 계산 + 복귀 미션 추천 |
| `claim_return_round_reward(p_mission_code)` | 15 | QUEST XP / gems | idempotency_key 로 중복 차단 |
| `check_and_claim_hidden_missions()` | 16 | QUEST XP / gems / RP | early return 가드 (§11-⑥) |
| `get_boxing_iq_league_summary()` | 16 | 0 (요약) | 등급 + 카운터 반환 |

### 9-3. 신규 마이그레이션 파일명

마지막 v1 마이그레이션은 `20260510000000_fix_admin_rls_with_check.sql`. 단조 증가 보장:

| 단계 | 파일명 (작업일 기준) |
|---|---|
| 14 | `20260601000000_boxing_condition_logs.sql` |
| 15 | `20260602000000_boxing_return_round.sql` |
| 16 | `20260603000000_boxing_hidden_missions.sql` |

17 단계는 신규 마이그레이션 없음 (순수 함수 + 표시 + data 파일).

### 9-4. RLS 정책 패턴 (§11-① 적용)

**신규 4 테이블 모두 super_admin 패턴 사용** (admin 직접 체크 금지):

```sql
ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;

-- 본인 SELECT
CREATE POLICY "{table}_select_self_or_admin"
  ON public.{table} FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_branch_manager_of(auth.uid(), user_id)
  );

-- 회원 직접 INSERT/UPDATE/DELETE 정책 미생성 (RLS enabled = deny by default)
-- 변경은 SECURITY DEFINER RPC 만 수행

-- super_admin 전체 관리 (USING + WITH CHECK 양쪽 명시)
CREATE POLICY "{table}_super_admin_manage"
  ON public.{table} FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
```

`boxing_hidden_missions` (카탈로그) 만 회원 SELECT active=true 정책 추가.

---

## 10. 기존 파일과 충돌 가능성

### 10-1. 직접 수정이 필요한 기존 파일 (예상 라인 수)

| 파일 | 단계 | 수정 라인 | 사유 |
|---|---|---|---|
| `src/components/engagement/HomeEngagementSection.tsx` | 14, 15 | +4~6 | 컨디션 카드 + 리턴 배너 mount |
| `src/components/engagement/TodayQuestMiniPanel.tsx` | 14 | +5~10 | 컨디션에 따른 카드 우선순위 |
| `src/services/boxingEngagementService.ts` | 14, 15, 16 | +200~400 | 신규 5 RPC 래퍼 + ENGAGEMENT_ERROR_MAP 확장 |
| `src/components/engagement/BoxingHallSummaryCard.tsx` | 16, 17 | +5~15 | IQ 리그 / 스타일 / 리포트 진입 |
| `src/pages/HomePage.tsx` | 14~15 | +0~3 | 가능하면 0 (HomeEngagementSection 자체 관리) |
| `src/pages/MyPage.tsx` | 16~17 | +3~5 | 신규 카드 mount |
| 기존 모달 4종 onSuccess | 16 | +1~3 ea | `useHiddenMissions().checkAndClaim()` 호출 |

### 10-2. 절대 수정 금지 (§3 보호 영역)

```
src/data/allLevelsData.ts
src/data/whiteLevel1Data.ts
src/data/whiteLevel2Data.ts
src/data/sharedConstants.ts (공식 레벨/훈련 데이터 부분)
src/components/ChatAssistant.tsx
supabase/functions/chat-assistant/
src/hooks/useMissionData.ts
src/hooks/useQuestData.ts
src/services/challengeService.ts
src/integrations/supabase/types.ts (자동 생성)
src/pages/MissionsPage.tsx
src/pages/RankUpPage.tsx
공식 1~40 미션 흐름 일체
기존 21일 챌린지 흐름 일체
```

### 10-3. query key 충돌 검사

기존 (v1):
```
["boxing-engagement", ...]
["boxing-academy", ...]
["boxing-fun-challenges", ...]
["champion-journal", ...]
["second-cheer", ...]
["wallet"] / ["member-wallet"]
["challenges"] (21일)
["diet", ...]
["character-presets"] / ["character-assignment"] / ["character-assignments-all"]
["owned-customizations"]
```

v1.5 신규 (모두 충돌 없음 ✓):
```
["boxing-condition", user?.id]
["return-round", user?.id]
["hidden-missions", user?.id]
["boxing-iq-league", user?.id]
["boxer-style", user?.id]
["growth-report", user?.id]
```

신규 mutation onSuccess invalidate:
```
["boxing-engagement"]
["boxing-condition"]
["return-round"]
["hidden-missions"]
["boxing-iq-league"]
["wallet"]
```

---

## 11. 충돌 방지 전략 — v1 점검에서 발견한 8 함정

> **본 §11 은 14~17 단계 코드 AI 가 작업 시작 전 가장 먼저 읽어야 할 섹션이다.** v1 PDF 의 충돌 사례 10건과 v1.5 사전 점검에서 발견한 항목을 통합.

### ① RLS admin 정책 패턴 (super_admin 강제)

**증상**: v1 의 `Admins manage X FOR ALL USING (has_role(auth.uid(), 'admin'))` 정책이 운영에서 **항상 false** (admin role 보유자 0명, super_admin 으로 마이그레이션됨). 추가로 WITH CHECK 누락 시 INSERT 자동 거부.

**v1 인용**: `20260510000000_fix_admin_rls_with_check.sql` 가 7 테이블 + storage.objects 의 정책을 super_admin + USING/WITH CHECK 양쪽으로 보수.

**v1.5 의 함정**: `boxing_engagement_foundation.sql` 의 engagement 도메인 admin 정책들도 `has_role(auth.uid(), 'admin')` 직접 체크 (broken). v1 사용자 흐름은 SECURITY DEFINER RPC 가 RLS 우회하여 OK 지만, **신규 4 테이블(`boxing_condition_logs` / `boxing_return_round_claims` / `boxing_hidden_missions` / `boxing_hidden_mission_claims`) 의 admin 정책에 같은 패턴을 그대로 복사하면 안 된다.**

**대응**:
- §9-4 의 super_admin 패턴 사용
- USING + WITH CHECK 양쪽 명시
- 회원 직접 INSERT/UPDATE/DELETE 정책 미생성 (deny by default)

### ② 마이그레이션 파일명 단조 증가

**v1 마지막**: `20260510000000_fix_admin_rls_with_check.sql`

**v1.5 권장 파일명** (작업일 기준):
- 14: `20260601000000_boxing_condition_logs.sql`
- 15: `20260602000000_boxing_return_round.sql`
- 16: `20260603000000_boxing_hidden_missions.sql`

**금지**: 같은 timestamp 두 번 사용 / 임의 timestamp 가 마지막 v1 보다 작은 경우.

### ③ 컨디션 저장 위치 — 별도 테이블 강제

**함정**: 14단계 계획에 "profile.metadata.last_condition 저장 OR 별도 테이블 OR 둘 다" 모호.

**문제**:
- `boxing_engagement_profiles` 는 회원 직접 INSERT/UPDATE 정책 부재 (deny by default)
- profile 직접 update 는 SECURITY DEFINER RPC 만 가능
- 하루 여러 번 컨디션 변경 시 이력 보존 필요
- 17단계 "컨디션 7회 기록" 숨겨진 미션은 이력 카운트 필요

**대응**: **`boxing_condition_logs` 별도 테이블만 사용**. profile.metadata 동시 갱신은 RPC 내부에서만 옵션 (필수 아님).

### ④ 마지막 활동일 계산 — `attendance_logs` 사용 금지

**함정**: 15단계 계획의 마지막 활동일 후보에 `attendance_logs` 가 있음.

**문제**:
- `attendance_logs` 는 공식 `record_attendance` 흐름과 결합
- 보호 영역 SELECT 만 허용이지만, 코드 AI 가 실수로 INSERT/UPDATE 호출 시 무결성 깨짐

**대응**:
- **`boxing_engagement_events.created_at` MAX 만 단일 소스로 사용**
- 모든 v1 활동(퀴즈/챌린지/일기/응원)이 이미 events 에 기록됨 → 충분
- 14단계 컨디션 저장도 events 에 기록 (event_type='condition_logged') → return round 가 자동 인식

### ⑤ 30일 복귀 보상 어뷰징 방지

**함정**: 계획대로면 31일 비활동 → 1일 복귀 → +500 → 다시 31일 비활동 → +500 무한 반복.

**대응** (셋 중 하나 또는 조합):
- **30일 쿨다운**: 동일 `return_type` 의 마지막 claim 후 30일 이내 재발급 금지
- **`boxing_engagement_events.idempotency_key` 패턴**: `return-round:after_30_days:2026-W23` (KST ISO week) — 같은 주 내 중복 차단
- **보상 하향**: `+500` → `+250` 으로 절반

권장: **쿨다운 + idempotency 둘 다 적용**. 보상은 계획값 유지.

### ⑥ check_and_claim_hidden_missions 호출 빈도 가드

**함정**: 매 mutation onSuccess 마다 호출 → DB 부하.

**대응**:
- RPC 내부 **early return**: 회원이 이미 claim 한 mission_id 목록 먼저 조회 → 미달 미션만 평가
- 호출 측 **mutation 디바운스**: React Query mutation 의 onSuccess 에서 `setTimeout(check, 500)` (5초 권장)
- 또는 **이벤트 타입별 부분 평가**: 응원 mutation → cheer 관련 미션만 평가, 퀴즈 mutation → quiz 관련만 평가
- React Query staleTime: `["hidden-missions"]` 60s 이상

### ⑦ 복서 스타일 점수 함수에 공식 데이터 누설 금지

**함정**: 코드 AI 가 실수로 `member_progress.total_xp` 등을 점수 계산에 가산 → "QUEST 가 공식 레벨에 영향 준다"로 오해 / 보호 원칙 위반 가시성 깨짐.

**대응** (입력 타입 자체로 차단):
- `BoxerStyleInput` 인터페이스에 `member_progress` / `total_xp` / `current_level` 필드 자체 부재 (§6-5 참조)
- 표시용 컨텍스트(현재 리그·레벨 표시)는 별도 `displayContext` 인자로 분리 — 점수 함수는 이걸 받지 않는다
- `boxerStyleRules.test.ts` 단위 테스트로 input 타입에 공식 필드 부재 검증 (선택)

### ⑧ types.ts 자동 재생성 시점 분리

**함정**: 14~17 단계 작업 중 `supabase gen types typescript` 실행 시, 신규 4 테이블 + 5 RPC 가 typed 로 잡히지 않은 코드와 충돌.

**대응**:
- **v1.5 14~17 단계 진행 중에는 types.ts 재생성 금지**
- 신규 RPC/테이블은 v1 의 `sbFrom("table_name")` / `sbRpc<T>("rpc_name", args)` cast 패턴 그대로 사용
- 17단계 QA 종료 + 운영 반영 완료 이후로 cast 제거 작업 분리 (별도 백로그)

### 추가 보강 — 재발 방지 (v1 PDF 충돌 사례 인용)

| 항목 | 인용 | v1.5 적용 |
|---|---|---|
| 모달 disabled 사유 | v1 #3 | 신규 모달도 사유 텍스트 분기 + cursor-not-allowed/opacity-60 |
| useQuery enabled gate | v1 #4 | 신규 hook 모두 `enabled: !!user?.id` (또는 `enabled: open`) 의무화 |
| AnimatePresence early return | v1 #5 | 신규 시트도 `if (!open) return null` 금지 — 단일 트리 안에서 분기 |
| 단일 AnimatePresence 트리 | v1 #6 | 결과 분기는 트리 안에서 conditional render |
| useMemo deps stabilize | v1 #7 | `pain_check_required ?? []` 같은 패턴 useMemo 로 안정화 |
| index 클램프 | v1 #8 | 캐러셀/리스트 인덱스는 `Math.min(i, len-1)` |
| react-refresh 코멘트 | v1 #9 | 컴포넌트 + 상수 동시 export 시 `// eslint-disable-next-line react-refresh/only-export-components` |
| 운영 owner=Lovable 권한 | v1 #10 | 신규 마이그레이션은 Lovable 위임 또는 Dashboard SQL Editor 수동 실행 |
| 모달 z-index | v1 | **`z-[100]` 통일** (v1.5 계획안의 z-[70] 이상은 최소치, 일관성 위해 100) |
| a11y | v1 | `role='dialog'` + `aria-modal='true'` + `useModalDismiss` 훅 의무화 |
| 안전영역 패딩 | v1 | `pb-[calc(env(safe-area-inset-bottom)+5rem)]` |

### ENGAGEMENT_ERROR_MAP 확장 (서비스 레이어)

`src/services/boxingEngagementService.ts` 의 `ENGAGEMENT_ERROR_MAP` 에 v1.5 신규 RPC 에러 한국어 매핑 추가:

```ts
{ match: "condition_type required", ko: "컨디션을 선택해주세요." },
{ match: "invalid condition_type",  ko: "올바르지 않은 컨디션입니다." },
{ match: "no return round available", ko: "복귀 라운드 조건이 아닙니다." },
{ match: "return round already claimed", ko: "오늘은 이미 복귀 보상을 받았습니다." },
{ match: "return round on cooldown", ko: "이번 복귀 보상은 다음 주기에 다시 열립니다." },
{ match: "hidden mission not eligible", ko: "아직 조건이 충족되지 않은 숨겨진 미션입니다." },
{ match: "hidden mission already claimed", ko: "이미 받은 숨겨진 미션입니다." },
{ match: "mission_code required", ko: "복귀 미션을 선택해주세요." },
```

---

## 12. 단계별 구현 순서

```
13단계 (현재): docs/153-quest-v1-5-implementation-plan.md  ← 본 문서
        │
        ▼
14단계: 컨디션 게이지 MVP
        ├─ 마이그레이션: 20260601000000_boxing_condition_logs.sql
        ├─ service: submitBoxingCondition / getRecentBoxingConditions
        ├─ hook: useBoxingCondition
        ├─ 컴포넌트: ConditionGaugeCard / ConditionGaugeSheet
        ├─ data: boxingConditionMessages.ts
        ├─ 진입점: HomeEngagementSection 상단 + TodayQuestMiniPanel 우선순위
        └─ 검증: bun run build / 신규 영역 lint / grep 보호 영역 0건
        │
        ▼
15단계: 리턴 라운드 MVP
        ├─ 마이그레이션: 20260602000000_boxing_return_round.sql
        ├─ service: getReturnRoundStatus / claimReturnRoundReward
        ├─ hook: useReturnRound
        ├─ 컴포넌트: ReturnRoundBanner / ReturnRoundSheet / ReturnRoundMissionCard
        ├─ data: returnRoundMessages.ts
        ├─ 진입점: HomeEngagementSection 상단 (조건 active 시만)
        └─ 검증: bun run build / lint / grep / 30일 쿨다운 동작
        │
        ▼
16단계: 숨겨진 미션 + 복싱 IQ 리그 MVP
        ├─ 마이그레이션: 20260603000000_boxing_hidden_missions.sql (8 seed 포함)
        ├─ service: checkAndClaimHiddenMissions / getBoxingIqLeagueSummary
        ├─ hook: useHiddenMissions / useBoxingIqLeague
        ├─ 컴포넌트: HiddenMissionToast / HiddenMissionPanel / BoxingIqLeagueCard
        ├─ data: hiddenMissionCatalog.ts (클라이언트 카탈로그 매핑)
        ├─ 진입점: 4 모달 onSuccess + MyPage 복싱 전당
        └─ 검증: bun run build / lint / grep / check_and_claim early return / 디바운스
        │
        ▼
17단계: 복서 스타일 진단 + 성장 리포트 + v1.5 QA
        ├─ 마이그레이션: 0
        ├─ data: boxerStyleRules.ts / growthReportMessages.ts / boxingQuestNotificationCopy.ts
        ├─ hook: useBoxerStyleDiagnosis / useGrowthReport
        ├─ 컴포넌트: BoxerStyleDiagnosisCard / GrowthReportCard / GrowthReportDetailSheet
        ├─ 진입점: MyPage BoxingHallSummaryCard 아래
        ├─ 단위 테스트: boxerStyleRules.test.ts (input 타입 검증 / 결정성 / 6 스타일 분기)
        ├─ docs: 153-quest-v1-5-qa-regression-report.md
        └─ 최종 판정: PASS / PASS_WITH_NOTES / BLOCKED
```

각 단계 종료 시:
- `bun run build` ✓
- `npx eslint <신규 영역 만>` 0 errors
- 보호 영역 grep 0 건
- `git add` / `git commit -m "[v1.5/N] ..."` (변경 사유 + 영향 파일 요약 3줄)

---

## 13. QA 체크리스트 (각 단계 + 17단계 통합)

### 13-1. 보호 영역 무수정 (모든 단계 공통)

| 항목 | 검증 방법 |
|---|---|
| 공식 1~40 훈련 리스트 | `git diff HEAD -- src/data/allLevelsData.ts src/data/whiteLevel1Data.ts src/data/sharedConstants.ts` 빈 출력 |
| `levels` / `missions` / `mission_videos` / `mission_submissions` | 신규 마이그레이션 grep `(ALTER\|UPDATE\|DELETE)\s+(TABLE\s+)?(public\.)?(levels\|missions\|mission_videos\|mission_submissions)` 0건 |
| `member_progress` UPDATE | `from\(["']member_progress["']\)\.update` 신규 영역 0건 / `UPDATE\s+(public\.)?member_progress` 신규 마이그레이션 0건 |
| `approve_mission_submission` / `record_attendance` | `rpc\(["'](approve_mission_submission\|record_attendance)["']` 신규 영역 0건 |
| `useManualLevelUp` / `usePassBossBattle` | import / 호출 신규 영역 0건 |
| ChatAssistant | `src/components/ChatAssistant.tsx` 와 `supabase/functions/chat-assistant/` 무수정 |
| 기존 21일 챌린지 | `submitChallengeCheckin` / `syncQuestCheckin` / `queryKey: \["challenges"` 신규 영역 0건 |
| `src/integrations/supabase/types.ts` | 무수정 (자동 생성) |

### 13-2. 파이트 머니 무결성

| 항목 | 검증 방법 |
|---|---|
| `from("user_wallets").update` / `from("wallets").update` 신규 영역 | grep 0건 |
| 모든 gems 변동이 RPC 내부 `grant_gems` 만 경유 | 신규 마이그레이션에 `PERFORM public.grant_gems(...)` 패턴만 |
| 클라이언트 `rpc("grant_gems", ...)` 직접 호출 신규 영역 | grep 0건 |

### 13-3. 모달 / a11y / z-index

| 항목 | 검증 방법 |
|---|---|
| 신규 모달 z-index | `z-[100]` 통일 (BottomNav z-50 위) |
| `role='dialog' aria-modal='true'` | 신규 모달/시트 모두 부착 |
| `useModalDismiss` 훅 | 신규 모달/시트 사용 |
| 안전영역 패딩 | `pb-[calc(env(safe-area-inset-bottom)+5rem)]` 부착 |
| AnimatePresence early return | 신규 모달에서 `if (!open) return null` 금지 |

### 13-4. query key / enabled gate

| 항목 | 검증 방법 |
|---|---|
| 신규 query key 충돌 | §10-3 표 대조 |
| useQuery enabled gate | 신규 hook 모두 `enabled: !!user?.id` 또는 `enabled: open` |
| invalidate 키 도메인 분리 | mutation onSuccess 가 `["boxing-engagement"]` 외에 자기 도메인 + `["wallet"]` |

### 13-5. 빌드 / 린트

| 항목 | 명령 | 합격 기준 |
|---|---|---|
| 프로덕션 빌드 | `bun run build` | `✓ built in ...` |
| 신규 영역 lint | `npx eslint <신규 파일 경로 들>` | 0 errors (warnings 허용 — react-refresh / exhaustive-deps minor) |
| 단위 테스트 (17단계만) | `bun run test` | 신규 `boxerStyleRules.test.ts` 통과 |

### 13-6. 17단계 통합 grep (재차)

```bash
# 보호 영역 0건이어야 함 (신규 영역만)
grep -rn 'from("member_progress").update'
grep -rn "from('member_progress').update"
grep -rn 'from("user_wallets").update'
grep -rn "from('user_wallets').update"
grep -rn 'from("wallets").update'
grep -rn "from('wallets').update"
grep -rn 'rpc("approve_mission_submission"'
grep -rn "rpc('approve_mission_submission'"
grep -rn 'rpc("record_attendance"'
grep -rn "rpc('record_attendance'"
grep -rn 'submitChallengeCheckin'
grep -rn 'syncQuestCheckin'
grep -rn 'queryKey: \["challenges"'
grep -rn "queryKey: \['challenges'"
```

기존 코드에 원래 있던 패턴은 §13-1 의 v1 QA 리포트 라인 51 표 인용으로 화이트리스트 (`useMissionData.ts:100` / `useQuestData.ts:123` / `MissionsPage.tsx:222` / `MemberPreviewPage.tsx:68` / `MemberDetailPage.tsx:124` / `ApprovalInbox.tsx:251/280`).

신규 영역(14~17단계 추가/수정 파일) 에 위 패턴이 발견되면 **차단**.

---

## 14. v2 로 넘길 백로그

§5 의 보류 기능 + 본 v1.5 후속 작업:

| 우선순위 | 항목 | 사유 |
|---|---|---|
| High | 실제 푸시 발송 시스템 인프라 | OS 권한 / 토큰 / Edge 스케줄러 — v2 인프라 |
| High | `types.ts` 자동 재생성 + sbFrom / sbRpc cast 제거 | 17단계 QA 종료 후 |
| High | engagement 도메인 admin 정책 super_admin 전환 | v1 잔여 부채 — 별도 마이그레이션으로 분리 |
| Med | branch 기준 IQ 리그 리더보드 | branch_id RLS + 정렬 RPC |
| Med | 세컨드 응원 receiver gems 활성화 | 일일 receiver 한도 + sender 디바운스 |
| Med | 코너맨 매칭 / 그림자 복서 / 팀 레이드 | v2 커뮤니티 구간 |
| Med | 코치 대시보드 몰입 데이터 시각화 | v1.5 데이터 누적 후 |
| Low | 시즌 스토리 패스 | 시즌 인프라 |
| Low | 레전드 카드 300장 / 도감 / 수집 | v3 |
| Low | 실존 선수 / 영화 / 만화 명언 콘텐츠 | 저작권 검토 후 |
| Low | 영상 인증 / AI 자세 분석 | ML 인프라 |

---

## 15. 본 13단계 결과

| 항목 | 값 |
|---|---|
| 생성 문서 | `docs/153-quest-v1-5-implementation-plan.md` (본 문서) |
| 코드 변경 | **0** |
| 마이그레이션 추가 | **0** |
| RPC 추가 | **0** |
| 컴포넌트 추가 | **0** |
| 보호 영역 변경 | **0** |
| `bun run build` | 미수행 (코드 변경 0) |

### v1.5 에서 구현할 기능 (확정)

1. 컨디션 게이지 (14단계)
2. 리턴 라운드 (15단계)
3. 숨겨진 미션 (16단계)
4. 복싱 IQ 리그 (16단계)
5. 복서 스타일 진단 (17단계)
6. 성장 리포트 (17단계)
7. 푸시 알림 문구 data 파일 (17단계)

### v1.5 에서 보류할 기능

- 그림자 복서 / 코너맨 매칭 / 팀 레이드 / 코치 대시보드 / 시즌 스토리 패스 / 레전드 카드 / 실존 선수 콘텐츠 / 영상 인증 / AI 자세 분석 / 라이벌 매칭 / 블랙 트레이너 / 오삼이 라디오
- 실제 푸시 발송 시스템
- branch 기준 IQ 리그 리더보드
- 세컨드 응원 receiver gems 활성화
- types.ts 자동 재생성

### 충돌 위험 상위 5

1. **§11-① RLS admin 정책**: 신규 4 테이블이 `has_role(... 'admin')` 패턴 그대로 복사 시 broken. → super_admin + USING/WITH CHECK 강제
2. **§11-④ 마지막 활동일 계산**: `attendance_logs` 사용 시 보호 영역 위반 가능. → `boxing_engagement_events` 단일 소스
3. **§11-⑤ 30일 보상 어뷰징**: 무한 반복 가능. → 쿨다운 + idempotency_key
4. **§11-⑥ check_and_claim 호출 빈도**: DB 부하. → RPC 내부 early return + 호출 측 디바운스
5. **§11-⑦ 스타일 점수 함수에 공식 데이터 누설**: → `BoxerStyleInput` 타입에 `member_progress` 필드 자체 부재

### 다음 14단계에서 시작할 기능

**컨디션 게이지 MVP**

시작 전 사전 체크:
- [ ] v1 마이그레이션 3개 (`20260508000000`, `20260509000000`, `20260510000000`) 운영 DB 반영 확인
- [ ] `bun run build` 클린 통과 상태 확인
- [ ] `git status` 깨끗
- [ ] 본 문서 §11 (8 함정) 숙지

---

## 부록 A. 참고 문서

- `docs/153-quest-full-engagement-roadmap.md` — 전체 백로그 / 로드맵
- `docs/153-quest-xp-reward-separation-design.md` — XP / 보상 분리 설계
- `docs/153-quest-v1-qa-regression-report.md` — v1 QA 회귀 리포트 (PASS_WITH_NOTES)
- `docs/153_quest_v1_handoff.pdf` — v1 → 13단계 인수인계 PDF (충돌 사례 10건 + 권장/비권장)
- `CLAUDE.md` — 프로젝트 절대 규칙

## 부록 B. 14~17 단계 코드 AI 가 매 작업 시작 시 5분 내 확인할 것

1. 본 문서 §3 (보호 원칙 10) 통독
2. 본 문서 §11 (8 함정) 통독
3. 해당 단계의 §6 (데이터 요구사항) + §7 (UI 위치) + §9 (신규 자산) 읽기
4. 마이그레이션 파일명 §9-3 표대로
5. RLS 정책 §9-4 super_admin 패턴
6. query key §10-3 표 대조
7. ENGAGEMENT_ERROR_MAP 확장 §11 끝부분
8. 작업 종료 시 §13 QA 체크리스트 통과
