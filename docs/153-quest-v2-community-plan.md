# 153 QUEST v2 커뮤니티 강화 구현 계획

> 작성: 18단계 (설계 단계)
> 코드 / 마이그레이션 / RPC / 컴포넌트 변경 0 — 본 문서만 신규 추가.
> 19~23단계 코드 AI 가 시작 전에 반드시 읽어야 할 v2 헌법.

---

## 0. 본 문서의 목적

v1.5 (컨디션 / 리턴 라운드 / 숨겨진 미션 / IQ 리그 / 스타일 진단 / 성장 리포트) 까지 출시 완료(`docs/153-quest-v1-5-qa-regression-report.md` PASS_WITH_NOTES). v2 는 그 위에 **커뮤니티 강화**(코너맨 / 그림자 복서 / 짐 레이드 / 코치 대시보드 확장)를 얹는 단계다.

본 문서는:
- v2 의 **범위를 확정**하고
- 어떤 기능을 v2.5 / v3 이후로 **보류**할지 명시하고
- v1 / v1.5 점검 + v2 사전 분석에서 발견한 **15 가지 함정**을 19~23 단계 코드 AI 가 동일하게 밟지 않도록 박아둔다.

---

## 1. v1 / v1.5 상태 요약

### 1-1. v1 (출시 완료)

| 도메인 | 자산 |
|---|---|
| 오삼이 일일 브리핑 | `OsamiDailyBriefingCard` |
| 보조 퀘스트 미니 패널 | `TodayQuestMiniPanel` (3카드) |
| 복싱 IQ 퀴즈 | `BoxingAcademyQuizModal` + 8 seed |
| 재미 챌린지 아레나 | `FunChallengeArenaSheet` + 8 seed |
| 챔피언 일기 | `ChampionJournalSheet` |
| 세컨드 응원 | `SecondCheerSheet` + 10 sticker |
| 나만의 복싱 전당 | `BoxingHallSummaryCard` |

### 1-2. v1.5 (출시 완료)

| 도메인 | 자산 |
|---|---|
| 컨디션 게이지 | `ConditionGaugeCard` + `ConditionGaugeSheet` (5 type) |
| 리턴 라운드 | `ReturnRoundBanner` + `ReturnRoundSheet` (3/7/14/30일) |
| 숨겨진 미션 | `HiddenMissionPanel` + 8 seed |
| 복싱 IQ 리그 | `BoxingIqLeagueCard` (5 등급) |
| 복서 스타일 진단 | `BoxerStyleDiagnosisCard` (6 스타일) |
| 성장 리포트 | `GrowthReportCard` + `GrowthReportDetailSheet` |
| 푸시 알림 카탈로그 | `boxingQuestNotificationCopy.ts` (8 카테고리) |

### 1-3. v1 / v1.5 의 핵심 분리 원칙 (v2 도 그대로 유지)

1. 공식 1~40 레벨 시스템(`levels` / `missions` / `mission_videos` / `mission_submissions` / `member_progress` / `approve_mission_submission` / `record_attendance` / `useManualLevelUp` / `usePassBossBattle` / `ChatAssistant` / 21일 챌린지)은 **절대 수정하지 않는다**.
2. QUEST XP / RP / 파이트 머니는 별도 도메인(`boxing_engagement_*`)에서 관리한다.
3. 파이트 머니 변동은 **무조건 `grant_gems` RPC 경유** — wallet 직접 update 0건.
4. 클라이언트는 보상 amount 를 보내지 않는다 — 서버 RPC 가 row 와 내부 규칙으로 결정.
5. 모든 보상 이벤트는 `boxing_engagement_events.unique(user_id, idempotency_key)` 로 중복 차단.

### 1-4. v1 / v1.5 누적 자산 (v2 가 그대로 활용)

| 자산 | 위치 | v2 활용 |
|---|---|---|
| profile 테이블 | `boxing_engagement_profiles` | 코너맨/그림자/짐 레이드 모두 누적 카운터 활용 |
| 이벤트 원장 | `boxing_engagement_events` | v2 모든 보상 이벤트 idempotency_key 중복 차단 |
| 핵심 RPC | `ensure_boxing_engagement_profile` / `grant_gems` / `has_role` / `is_branch_manager_of` | 신규 v2 RPC 의존성 |
| 활동 데이터 | quiz_attempts / fun_challenge_attempts / cheers / journal_entries / condition_logs / hidden_mission_claims / return_round_claims | 그림자 복서 비교 / 짐 레이드 contribute |
| service 헬퍼 | `sbFrom` / `sbRpc<T>` cast 격리 | v2 신규 RPC 도 동일 패턴 |
| 한국어 에러 | `ENGAGEMENT_ERROR_MAP` | v2 도 추가 매핑 |
| 정적 사전 | `osamiEngagementMessages` / `boxingQuestNarratives` / 컨디션/리턴/스타일/리포트 messages | 신규 v2 메시지도 정적 사전 |

---

## 2. v2 목표

회원과 회원, 회원과 코치, 회원과 지점이 **연결되는 커뮤니티 레이어**를 추가한다. v1.5 까지가 "혼자 즐기는 RPG" 였다면 v2 는 "함께 가는 RPG" 다.

핵심 톤:
- "혼자 강해지는 복서보다 함께 오래 가는 복서가 더 강합니다"
- "남과 경쟁이 아니라 어제의 나와 경쟁합니다"
- "지점이 함께 깨는 목표"

구체적으로:
1. **코너맨 매칭** — 회원 2명이 서로 잡아주는 가벼운 1:1 관계
2. **그림자 복서** — 30일 전 나의 기록과 현재 비교
3. **팀 / 짐 레이드** — 지점 전체 누적 목표
4. **코치 대시보드 QUEST 확장** — 코치가 누가 몰입중/이탈위험인지 본다

---

## 3. 공식 1~40 레벨 보호 원칙

v1 / v1.5 보호 원칙 그대로 유지 + v2 추가 강화:

| # | 원칙 |
|---|---|
| 1 | 공식 1~40 훈련 리스트는 v2 에서도 수정하지 않는다. `src/data/allLevelsData.ts`, `whiteLevel1Data.ts`, `sharedConstants.ts` 안의 공식 데이터 무수정. |
| 2 | `levels` / `missions` / `mission_videos` / `mission_submissions` / `member_progress` 테이블 무수정. SELECT 만 허용. |
| 3 | `approve_mission_submission` / `record_attendance` 호출 0건. |
| 4 | `useManualLevelUp` / `usePassBossBattle` import 0건. |
| 5 | 공식 XP 와 QUEST XP 는 합치지 않는다. `member_progress.total_xp` 직접 변경 0. |
| 6 | 코너맨 / 그림자 / 짐 레이드 / 코치 대시보드는 모두 보조 시스템. 공식 레벨업 / 승급 / 보스전 조건에 영향 0. |
| 7 | 파이트 머니는 RPC 내부 `grant_gems` 만 경유. wallet 직접 update 0. |
| 8 | `ChatAssistant` 단일 경로 유지. 새 AI 챗박스 0. 모든 메시지는 정적 사전. |
| 9 | 기존 `/challenges` 21일 챌린지 무수정. `submitChallengeCheckin` / `syncQuestCheckin` / `queryKey: ["challenges"]` 신규 호출 0. |
| 10 | `src/integrations/supabase/types.ts` 직접 수정 금지 (자동 생성 파일). 신규 RPC/테이블은 v1 의 `sbFrom` / `sbRpc<T>` cast 패턴 그대로. |
| 11 | **실존 복서 / 영화 / 만화 / 실제 명언 / 경기 영상은 seed 데이터에 직접 넣지 않는다** (저작권). v2 신규 메시지/카드/문구 모두 자체 제작 톤. |
| 12 | 코치 대시보드 신규 영역에서도 공식 미션 승인 / wallet 직접 update / 공식 XP 지급 0. 표시·모니터링·읽기 전용. |

---

## 4. v2 구현 기능 목록

### 4-1. 코너맨 매칭 (19단계)

| 항목 | 내용 |
|---|---|
| 기능명 | 코너맨 매칭 (Cornerman Pair) |
| 목적 | 회원 2명이 서로 코너맨이 되어 매일 활동을 응원·격려한다 |
| 사용자 가치 | "혼자 안 가는 사람" 의 이탈 방지 + 1:1 약한 사회적 압력 (적정 강도) |
| 필요한 DB | 신규 테이블 2개 (`boxing_cornerman_pairs`, `boxing_cornerman_daily_syncs`) |
| 필요한 RPC | 6개 — `get_cornerman_candidates` / `request_cornerman_pair` / `respond_cornerman_pair` / `end_cornerman_pair` / `get_my_cornerman_status` / `claim_cornerman_daily_bonus` |
| 필요한 컴포넌트 | `CornermanCard`, `CornermanSheet`, `CornermanCandidateList`, `CornermanStatusPanel`, `useCornerman`, `cornermanMessages.ts` |
| 기존 시스템 영향 | MyPage 또는 HomeEngagementSection 에 카드 1개 mount (+3~5 라인) |
| 공식 레벨 영향 여부 | **없음** — QUEST XP / RP / 파이트 머니만 |
| 구현 단계 | 19단계 |
| 위험도 | **중간** |
| 보류 조건 | 어뷰징 방지 4중 검증 미설정 시 (§11-⑨~⑪) |

### 4-2. 그림자 복서 (20단계)

| 항목 | 내용 |
|---|---|
| 기능명 | 그림자 복서 (Shadow Boxer) |
| 목적 | 30일 전 나의 QUEST 활동 기록과 현재 비교 — "어제의 나를 이긴" 성장 경험 |
| 사용자 가치 | 남과 비교 부담 없이 성장감 — 초보도 기쁨 |
| 필요한 DB | 신규 테이블 1개 (`boxing_shadow_boxer_claims`) |
| 필요한 RPC | 2개 — `get_shadow_boxer_snapshot` / `claim_shadow_boxer_reward` |
| 필요한 컴포넌트 | `ShadowBoxerCard`, `ShadowBoxerSheet`, `ShadowMetricRow`, `useShadowBoxer`, `shadowBoxerMessages.ts` |
| 기존 시스템 영향 | MyPage 의 `BoxingHallSummaryCard` 또는 `BoxerStyleDiagnosisCard` 아래 카드 1개 mount |
| 공식 레벨 영향 여부 | **없음** — `BoxerStyleInput` 처럼 입력 타입에 공식 데이터 부재 강제 (§11-⑫) |
| 구현 단계 | 20단계 |
| 위험도 | 낮음 |
| 보류 조건 | 30일 미만 가입자 fallback 미설정 시 (§11-⑫) |

### 4-3. 팀 레이드 / 짐 레이드 (21단계)

| 항목 | 내용 |
|---|---|
| 기능명 | 짐 레이드 (Gym Raid) |
| 목적 | 같은 지점 전체 회원이 함께 누적 목표 (예: 잽 10,000 회) 를 달성 |
| 사용자 가치 | "내 한 라운드가 지점 목표에 더해진다" — 동료 의식 + 현장 분위기 |
| 필요한 DB | 신규 테이블 3개 (`boxing_gym_raids`, `boxing_gym_raid_contributions`, `boxing_gym_raid_reward_claims`) + 1~3 seed raid |
| 필요한 RPC | 3개 — `get_active_gym_raids` / `contribute_to_gym_raid` / `claim_gym_raid_reward` |
| 필요한 컴포넌트 | `GymRaidCard`, `GymRaidSheet`, `GymRaidContributionList`, `useGymRaid`, `gymRaidMessages.ts` |
| 기존 시스템 영향 | HomeEngagementSection / MyPage 카드 1개 + 4 기존 hook (Academy/FunChallenge/Journal/Cheer) 의 onSuccess 에 contribute trigger 추가 |
| 공식 레벨 영향 여부 | **없음** — 기존 `/challenges` 와 완전 분리. 자체 도메인 |
| 구현 단계 | 21단계 |
| 위험도 | **중간** |
| 보류 조건 | source 검증 / status 자동 ended / 호출 빈도 가드 미설정 시 (§11-⑬~⑭) |

### 4-4. 코치 대시보드 QUEST 확장 (22단계)

| 항목 | 내용 |
|---|---|
| 기능명 | 코치 대시보드 QUEST 데이터 확장 |
| 목적 | 코치가 회원의 QUEST 활동, 복귀 위험, 칭찬 대상, 코너맨/짐 레이드 기여를 본다 |
| 사용자 가치 | "오늘 누구에게 한마디 해야 하는지" 가 한눈에. 코치 → 회원 1:1 메시지 효과 극대화 |
| 필요한 DB | **신규 테이블 0** — 기존 데이터 집계만 |
| 필요한 RPC | 1개 — `get_coach_quest_dashboard(p_branch_name)` |
| 필요한 컴포넌트 | `QuestCoachSummaryPanel`, `QuestAtRiskMembersPanel`, `QuestPraiseTargetsPanel`, `QuestCommunityPanel`, `useCoachQuestDashboard` (모두 `src/components/engagement/coach/` 신규 디렉토리) |
| 기존 시스템 영향 | `CoachDashboard.tsx` (40KB 대형 파일) 에 import 1줄 + mount 1줄. 본체 무수정. 옵션으로 `BranchManagerHome.tsx` 도 |
| 공식 레벨 영향 여부 | **없음** — `member_progress` 는 SELECT 만 |
| 구현 단계 | 22단계 |
| 위험도 | **중간** |
| 보류 조건 | RPC 내부 권한 검증 / 민감정보 화이트리스트 미설정 시 (§11-⑮) |

---

## 5. v2 보류 기능 목록 (v2.5 / v3 이후)

| 기능 | 보류 사유 | 단계 |
|---|---|---|
| 라이벌 매칭 4주 시즌 | 매칭 알고리즘 + 시즌 시스템 | v2.5 |
| 시즌 스토리 패스 | 시즌 인프라 (start/end + 보상 트리거) | v2.5 |
| 카드 수집 300장 | 카드 / 도감 / 인벤토리 시스템 인프라 | v3 |
| 레전드 콘텐츠 | 실존 인물 / 영화 / 만화 — 저작권 검토 필요 | v3 |
| 명장면 영상 제출 | 회원 영상 업로드 + 코치 검수 워크플로우 | v3 |
| AI 자세 분석 | ML 인프라 + 영상 처리 | v3 |
| 블랙 트레이너 시스템 | 페르소나 확장 + 메시지 톤 시스템 | v2.5 후반 |
| 오삼이 라디오 | 음성 인프라 + 콘텐츠 라이브러리 | v3 |
| 코너맨 N:N (그룹 코너) | 1:1 안정화 후 | v2.5 |
| 짐 레이드 어드민 콘솔 | 관장이 직접 raid 생성/종료 — UI 인프라 | v2.5 |
| 그림자 복서 푸시 (실제) | OS 권한 / 토큰 — v1.5 푸시 카탈로그 그대로 활용 | v3 인프라 |

---

## 6. 기능별 사용자 가치

### 6-1. 코너맨 — "1:1 약한 압력 + 따뜻함"

- 평일에 "코너맨이 오늘 안 왔다" 알림이 보임 → 회원이 한 번 더 들어와 응원
- 둘 다 활동 시 보너스 → 가벼운 게임화
- 1:1 관계라 그룹 채팅 부담 없음

### 6-2. 그림자 복서 — "초보의 첫 성공 경험"

- 가입 30일 후 처음 보는 카드: "30일 전의 당신을 이겼습니다"
- 남과 비교 무관 → 부담 0
- 매월 1회 claim → 월간 ritual

### 6-3. 짐 레이드 — "내 한 라운드가 지점에 더해진다"

- 카운터 옆 TV / 짐 SNS 에 "오늘 우리 지점 잽 9,237 / 10,000" 표시 가능 (운영자가 활용)
- 회원 1명이 잽 30회 = 지점 누적 30+1
- 100% 달성 시 보상 → 짐 전체 축제

### 6-4. 코치 대시보드 — "오늘 누구에게 한마디"

- 칭찬 대상 1명 / 위험 회원 1명만 픽 → 5분 안에 메시지 한 통
- 회원 입장에서 "코치님이 나를 본다" 강력한 동기

---

## 7. 기능별 DB / RPC 후보

### 7-1. 코너맨 (19단계)

신규 테이블 `boxing_cornerman_pairs`:
```
id              uuid PK default gen_random_uuid()
requester_user_id uuid not null references auth.users(id) on delete cascade
receiver_user_id  uuid not null references auth.users(id) on delete cascade
status          text not null default 'pending'
                  CHECK (status IN ('pending','active','declined','ended','expired'))
branch_name     text
requested_at    timestamptz not null default now()
accepted_at     timestamptz
ended_at        timestamptz
metadata        jsonb not null default '{}'::jsonb
created_at      timestamptz not null default now()
CHECK (requester_user_id <> receiver_user_id)
```

신규 테이블 `boxing_cornerman_daily_syncs`:
```
id              uuid PK default gen_random_uuid()
pair_id         uuid not null references boxing_cornerman_pairs(id) on delete cascade
user_a_id       uuid not null
user_b_id       uuid not null
sync_date       date not null default current_date
user_a_completed boolean not null default false
user_b_completed boolean not null default false
bonus_claimed   boolean not null default false
quest_xp_granted integer not null default 0
gems_granted    integer not null default 0
respect_granted integer not null default 0
created_at      timestamptz not null default now()
updated_at      timestamptz not null default now()
UNIQUE (pair_id, sync_date)
```

신규 RPC 6개 — §4-1 표 참조. 어뷰징 방지 §11-⑨~⑪ 적용 필수.

### 7-2. 그림자 복서 (20단계)

신규 테이블 `boxing_shadow_boxer_claims`:
```
id              uuid PK default gen_random_uuid()
user_id         uuid not null references auth.users(id) on delete cascade
comparison_window text not null default '30d'
shadow_score    numeric not null default 0
current_score   numeric not null default 0
improved        boolean not null default false
quest_xp_granted integer not null default 0
gems_granted    integer not null default 0
claimed_at      timestamptz not null default now()
metadata        jsonb not null default '{}'::jsonb
```

idempotency: `boxing_engagement_events.idempotency_key = 'shadow_boxer:{window}:{KST_yyyy-mm}'` (월 1회)

신규 RPC 2개 — §4-2 표 참조.

비교 metric:
- quiz_correct_count
- challenge_clear_count
- journal_count
- cheer_sent_count
- respect_points
- quest_xp
- return_round_count (있으면)
- hidden_mission_count (있으면)

`get_shadow_boxer_snapshot` 반환 schema (§4-2 의 RPC 1):
```json
{
  "ready": true,
  "window_days": 30,
  "shadow_period": "60~31일 전",
  "current_period": "최근 30일",
  "shadow_score": 120,
  "current_score": 180,
  "improved": true,
  "growth_rate": 50,
  "metrics": [
    {"key":"quiz","label":"복싱 IQ","shadow":8,"current":15,"improved":true}
  ],
  "message": "..."
}
```

### 7-3. 짐 레이드 (21단계)

신규 테이블 `boxing_gym_raids`:
```
id              uuid PK default gen_random_uuid()
branch_name     text not null
title           text not null
description     text not null
raid_type       text not null
                  CHECK (raid_type IN
                    ('quiz_correct','challenge_clear','cheer_sent','journal_write','quest_xp','respect_points'))
target_value    numeric not null
current_value   numeric not null default 0
start_date      date not null
end_date        date not null
status          text not null default 'active'
                  CHECK (status IN ('draft','active','completed','ended'))
reward_quest_xp integer not null default 0
reward_gems     integer not null default 0
metadata        jsonb not null default '{}'::jsonb
created_at      timestamptz not null default now()
updated_at      timestamptz not null default now()
```

신규 테이블 `boxing_gym_raid_contributions`:
```
id              uuid PK default gen_random_uuid()
raid_id         uuid not null references boxing_gym_raids(id) on delete cascade
user_id         uuid not null references auth.users(id) on delete cascade
contribution_value numeric not null default 0
contribution_type  text not null
source_type     text
source_id       uuid
contributed_at  timestamptz not null default now()
metadata        jsonb not null default '{}'::jsonb
UNIQUE (raid_id, user_id, source_type, source_id)
```

신규 테이블 `boxing_gym_raid_reward_claims`:
```
id              uuid PK default gen_random_uuid()
raid_id         uuid not null references boxing_gym_raids(id) on delete cascade
user_id         uuid not null references auth.users(id) on delete cascade
quest_xp_granted integer not null default 0
gems_granted    integer not null default 0
claimed_at      timestamptz not null default now()
UNIQUE (raid_id, user_id)
```

신규 RPC 3개 — §4-3 표 참조.

Seed raid 3개 (지점별 자동 생성 또는 super_admin 수동):
1. **복싱 IQ 300문제 레이드** — `quiz_correct` / target=300 / 14일 / +100 XP, +300 GEM
2. **챌린지 200라운드 레이드** — `challenge_clear` / target=200 / 14일 / +150 XP, +500 GEM
3. **세컨드 응원 500회 레이드** — `cheer_sent` / target=500 / 30일 / +50 RP, +300 GEM

### 7-4. 코치 대시보드 QUEST (22단계)

**신규 테이블 0**. 신규 RPC 1개:

`get_coach_quest_dashboard(p_branch_name text default null)` 반환 schema:
```json
{
  "summary": {
    "total_members": 50,
    "active_quest_members_7d": 38,
    "quiz_attempts_7d": 245,
    "challenge_clears_7d": 89,
    "journals_7d": 64,
    "cheers_7d": 152,
    "return_round_candidates": 5,
    "cornerman_active_pairs": 12,
    "gym_raid_progress": [...]
  },
  "at_risk_members": [
    {
      "user_id": "...",
      "display_name": "홍길동",
      "current_rank": "white",
      "current_level": 3,
      "last_activity_at": "2026-04-20T...",
      "inactive_days": 12,
      "suggested_action": "리턴 라운드 권장"
    }
  ],
  "praise_targets": [
    {
      "user_id": "...",
      "display_name": "김파이터",
      "reason": "복싱 IQ 3연속 정답 + 일기 7회 누적",
      "metric": "quiz_streak=3, journal=7",
      "current_rank": "blue",
      "current_level": 5
    }
  ],
  "community": {
    "active_cornerman_pairs": 12,
    "cheers_sent_7d": 152,
    "top_respect_members": [...],
    "gym_raid_top_contributors": [...]
  }
}
```

**민감정보 화이트리스트** (반환 컬럼에 포함 금지):
- `phone_number`, `email`, `birth_date`, `address`, `parent_phone` 등

### 7-5. 신규 마이그레이션 파일명

마지막 v1.5 마이그레이션은 `20260603000000_boxing_hidden_missions.sql`. 단조 증가:

| 단계 | 파일명 |
|---|---|
| 19 | `20260701000000_boxing_cornerman.sql` |
| 20 | `20260702000000_boxing_shadow_boxer.sql` |
| 21 | `20260703000000_boxing_gym_raids.sql` |
| 22 | `20260704000000_coach_quest_dashboard.sql` (RPC 만) |

23단계는 마이그레이션 0 (QA 만).

### 7-6. RLS 정책 패턴 (모든 신규 6 테이블)

§11-① 강제 — `super_admin` + USING/WITH CHECK 양쪽 명시:

```sql
ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;

-- 본인 SELECT (코너맨 pair 는 양쪽 user 모두)
CREATE POLICY "{table}_select_self_or_admin"
  ON public.{table} FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()  -- 또는 requester=auth.uid() OR receiver=auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_branch_manager_of(auth.uid(), user_id)
  );

-- super_admin 관리
CREATE POLICY "{table}_super_admin_manage"
  ON public.{table} FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
```

회원 직접 INSERT/UPDATE 정책 미생성 → SECURITY DEFINER RPC 만 변경 권한.

`boxing_gym_raids` (카탈로그) 만 `active=true` 회원 SELECT 추가.

---

## 8. 기능별 UI 삽입 위치

| 기능 | 위치 | 삽입 방식 | 라인 수 |
|---|---|---|---|
| 코너맨 카드 | MyPage 또는 HomeEngagementSection | `<CornermanCard />` | +1~2 |
| 그림자 복서 카드 | MyPage 의 `BoxerStyleDiagnosisCard` 아래 | `<ShadowBoxerCard />` | +1 |
| 짐 레이드 카드 | HomeEngagementSection (배너 아래) 또는 MyPage | `<GymRaidCard />` | +1~2 |
| 코치 QUEST 패널 | `CoachDashboard.tsx` 본체 끝부분 (혹은 새 탭) | `<QuestCoachSummaryPanel />` 등 4개 | +5~10 |

**HomePage / MyPage / CoachDashboard 직접 수정 라인 수 제한**:
- HomePage: 19~21 단계 합쳐 +0~3 줄 이내 (가능하면 `HomeEngagementSection` 자체 관리)
- MyPage: 19~20 단계 합쳐 +3~5 줄 이내
- CoachDashboard: 22 단계 +5~10 줄 이내 (본체 로직 무수정)
- BranchManagerHome: 22 단계 옵션, +0~5 줄 이내

---

## 9. 공식 XP / QUEST XP / RP / 파이트 머니 분리 방식

| 자산 | 정체 | 누적 위치 | 변경 경로 | v2 활용 |
|---|---|---|---|---|
| 공식 XP | `total_xp` | `member_progress` | 코치 승인 / 보스전 / 승급 — v2 신규 코드 **읽기만** | 코치 대시보드 SELECT 만 |
| QUEST XP | 보조 경험치 | `boxing_engagement_profiles.quest_xp` + `boxing_engagement_events.quest_xp_delta` | SECURITY DEFINER RPC 만 | 코너맨 보너스 / 그림자 보상 / 짐 레이드 보상 |
| RP | 응원·기여 점수 | `boxing_engagement_profiles.respect_points` + `boxing_engagement_events.respect_delta` | SECURITY DEFINER RPC 만 | 코너맨 보너스 / 짐 레이드 응원 |
| 파이트 머니 | gems | `user_wallets.gems_balance` | **`grant_gems(_user_id, _amount, _reason)` RPC 만** — 클라이언트 직접 update 절대 금지 | 코너맨/그림자/짐 레이드 보상 |

v2 신규 12 RPC 모두 보상 흐름:
1. `auth.uid()` NULL 검증
2. row 검증 + 자격 검증 + 멱등성 검증
3. `boxing_engagement_profiles` 업데이트 (quest_xp / respect_points 누적)
4. `boxing_engagement_events` insert (idempotency_key 포함)
5. gems 지급은 **`PERFORM public.grant_gems(v_uid, v_gems, v_reason);`** 으로만
6. `member_progress` / `user_wallets` 직접 UPDATE 0

표시용 안내 문구 (모든 v2 카드/시트에 1회 노출):
> "이 보상은 공식 레벨 XP 와 분리된 보조 경험치 / 가상 통화입니다."
> "코너맨 / 그림자 복서 / 짐 레이드는 공식 승급 조건이 아닌 커뮤니티 기능입니다."

---

## 10. 기존 파일과 충돌 가능성

### 10-1. 직접 수정이 필요한 기존 파일 (예상 라인 수)

| 파일 | 단계 | 수정 라인 | 사유 |
|---|---|---|---|
| `src/components/engagement/HomeEngagementSection.tsx` | 19, 21 | +4~6 | 코너맨 카드 + 짐 레이드 카드 mount |
| `src/services/boxingEngagementService.ts` | 19, 20, 21, 22 | +400~600 | 신규 12 RPC 래퍼 + ENGAGEMENT_ERROR_MAP 확장 |
| `src/components/engagement/index.ts` | 19, 20, 21 | +6~10 | 신규 컴포넌트 export |
| `src/pages/MyPage.tsx` | 19, 20 | +2~4 | 코너맨/그림자 카드 mount |
| `src/pages/HomePage.tsx` | 19~21 | +0~3 | 가능하면 0 |
| `src/pages/CoachDashboard.tsx` | 22 | +5~10 | QUEST 패널 mount (본체 로직 무수정) |
| `src/pages/BranchManagerHome.tsx` | 22 | +0~5 | 옵션 — 관장 화면에도 mount |
| 기존 4 hook (Academy/FunChallenge/Journal/Cheer) | 21 | +1~3 ea | onSuccess 에 `triggerGymRaidContribute()` 추가 |

### 10-2. 절대 수정 금지 (§3 보호 영역)

```
src/data/allLevelsData.ts
src/data/whiteLevel1Data.ts
src/data/whiteLevel2Data.ts
src/data/sharedConstants.ts (공식 데이터 부분)
src/components/ChatAssistant.tsx
supabase/functions/chat-assistant/
src/hooks/useMissionData.ts
src/hooks/useQuestData.ts
src/hooks/useWallet.ts
src/services/challengeService.ts
src/integrations/supabase/types.ts (자동 생성)
src/pages/MissionsPage.tsx
src/pages/RankUpPage.tsx
src/pages/ChallengesPage.tsx
src/components/AtRiskMembersPanel.tsx (기존 — Quest 신규 영역과 분리)
공식 1~40 미션 흐름 일체
기존 21일 챌린지 흐름 일체
```

### 10-3. query key 충돌 검사

기존 (v1 + v1.5):
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
["boxing-condition", ...]
["return-round", ...]
["hidden-missions", ...]
["boxing-iq-league", ...]
["boxer-style", ...]
["growth-report", ...]
```

v2 신규 (모두 충돌 없음 ✓):
```
["cornerman", user?.id]
["cornerman", "candidates", user?.id]
["shadow-boxer", user?.id]
["gym-raid", user?.id]
["coach-quest-dashboard", branchName, user?.id]
```

신규 mutation onSuccess invalidate:
```
["boxing-engagement"]
["cornerman"]
["shadow-boxer"]
["gym-raid"]
["coach-quest-dashboard"]
["wallet"]
```

### 10-4. 컴포넌트 이름 충돌 검사

| 신규 컴포넌트 | 기존 유사 이름 | 충돌? |
|---|---|---|
| `CornermanCard` | `SecondCheerCard` | 분리 — 도메인 다름 ✓ |
| `ShadowBoxerCard` | `BoxerStyleDiagnosisCard` | 분리 ✓ |
| `GymRaidCard` | (없음) | 신규 ✓ |
| `QuestAtRiskMembersPanel` | **기존 `AtRiskMembersPanel.tsx`** | **위험** — 위치 분리 (`engagement/coach/`) + Quest 프리픽스로 회피 |
| `QuestCoachSummaryPanel` | (없음) | 신규 ✓ |

---

## 11. 충돌 방지 전략 — 15 가지 함정

> **본 §11 은 19~23 단계 코드 AI 가 작업 시작 전 가장 먼저 읽어야 할 섹션이다.**

### v1.5 에서 검증된 8 함정 (그대로 유지)

#### ① RLS admin 정책 — super_admin 강제

신규 6 테이블 모두 `has_role(auth.uid(), 'super_admin')` + USING/WITH CHECK 양쪽 명시. `'admin'` 직접 사용 금지 (운영 admin role 보유자 0명, 항상 false).

#### ② 마이그레이션 파일명 단조 증가

v1.5 마지막 `20260603000000_*` 다음 → `20260701000000~` 부터 (§7-5 표).

#### ③ 보상 RPC 의 `boxing_engagement_events` idempotency_key 패턴

모든 v2 보상 이벤트에 unique idempotency_key 부여:
- 코너맨 일일 보너스: `cornerman_bonus:{pair_id}:{KST_date}`
- 그림자 복서: `shadow_boxer:{window}:{KST_yyyy-mm}`
- 짐 레이드 contribute: `gym_raid:{raid_id}:{source_type}:{source_id}`
- 짐 레이드 보상: `gym_raid_reward:{raid_id}:{user_id}`

#### ④ 활동 검증 데이터 단일 소스

코너맨 일일 동기화 / 짐 레이드 contribute 의 활동 진실성은 **`boxing_engagement_events`** 단일 소스로만 (이미 v1.5 에서 검증). `attendance_logs` 등 공식 영역 SELECT 0.

#### ⑤ 어뷰징 방지 — 일일/월간 한도 + idempotency

코너맨 일일 보너스 = 하루 1회. 그림자 복서 = 월 1회. 짐 레이드 보상 = raid 당 1회 (`UNIQUE (raid_id, user_id)`).

#### ⑥ 호출 빈도 가드 — early return + 디바운스

`contribute_to_gym_raid` RPC 내부 early return (이미 contribute 한 source 재시도 시 `UNIQUE` 충돌로 자동 ignore). 호출 측 (4 hook 의 onSuccess) 에 `useGymRaidContributeTrigger()` 800ms 디바운스 (v1.5 `useHiddenMissionTrigger` 패턴 그대로 복제).

#### ⑦ 점수 함수 공식 데이터 누설 금지

그림자 복서의 비교 metric 입력 타입에 `member_progress` / `total_xp` / `current_level` 부재 — TypeScript 컴파일 타임 차단 (v1.5 `BoxerStyleInput` 패턴):

```ts
interface ShadowBoxerInput {
  profile: { /* boxing_engagement_profiles 의 필드만 */ };
  // ⚠ member_progress / total_xp / current_level 절대 포함 금지
}
```

#### ⑧ types.ts 재생성 시점 분리

19~23 단계 진행 중 `types.ts` 재생성 금지. 신규 12 RPC 모두 `sbFrom("...")` / `sbRpc<T>("...", args)` cast 패턴 그대로. 23단계 QA 종료 + 운영 반영 완료 이후 owner 권한 (Lovable) 위임으로 별도 PR.

### v2 추가 7 함정

#### ⑨ 코너맨 active pair 1개 제한 — RPC 양면 검증

DB UNIQUE 만으로는 불충분. `request_cornerman_pair` / `respond_cornerman_pair` RPC 내부에서 **양쪽 user 모두** active pair 가 없는지 검사:

```sql
IF EXISTS (
  SELECT 1 FROM boxing_cornerman_pairs
  WHERE status = 'active'
    AND (requester_user_id IN (v_uid, p_receiver_user_id)
         OR receiver_user_id IN (v_uid, p_receiver_user_id))
) THEN
  RAISE EXCEPTION 'cornerman pair already exists';
END IF;
```

#### ⑩ 코너맨 pending 7일 자동 만료

수락 안 하면 영원히 pending 으로 남아 받는 사람의 다음 코너맨 매칭을 막을 위험. `request_cornerman_pair` 또는 `get_cornerman_candidates` 호출 시 **lazy update**:

```sql
UPDATE boxing_cornerman_pairs
SET status = 'expired'
WHERE status = 'pending'
  AND requested_at < now() - interval '7 days';
```

(별도 cron 인프라 신규 구축 금지 — lazy 방식)

#### ⑪ 코너맨 일일 보너스 어뷰징 방지

둘이 짜고 매일 +200 GEM 어뷰징 가능성. 4중 검증:
1. **같은 지점 회원만** 매칭 가능 (`request_cornerman_pair` 에서 `branch_name` 체크)
2. **각자 진짜 활동** 했는지 — `boxing_engagement_events.action != 'condition_logged'` (컨디션은 보상 0이라 어뷰징 가능, 진짜 활동만 카운트). 권장 대상: `quiz_first_correct`, `quiz_retry_correct`, `fun_challenge_completed`, `journal_first_of_day`, `cheer_sent`, `return_round_claimed`, `hidden_mission_claimed`
3. **하루 1번** (`UNIQUE (pair_id, sync_date)`)
4. **active pair** 만 (status check)

#### ⑫ 그림자 복서 30일 미만 가입자 fallback

신규 가입 회원은 30일 전 데이터가 없음 → `ready: false` + "분석 준비 중" 메시지:

```sql
IF v_kst_join_date > now() - interval '30 days' THEN
  RETURN jsonb_build_object(
    'ready', false,
    'reason', '가입 30일 후부터 비교가 가능합니다.',
    'message', '아직 그림자 복서가 도착하지 않았습니다.'
  );
END IF;
```

#### ⑬ 짐 레이드 contribute source 검증

다른 사람의 quiz_attempt 를 자기 contribution 으로 등록하는 어뷰징 가능. RPC 내부 검증:

```sql
-- source_type='boxing_quiz' 인 경우 본인 attempt 인지 확인
IF p_source_type = 'boxing_quiz_attempt' THEN
  IF NOT EXISTS (SELECT 1 FROM boxing_quiz_attempts
                 WHERE id = p_source_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'invalid source';
  END IF;
END IF;
```

각 source_type 별로 검증.

#### ⑭ 짐 레이드 status 자동 ended (lazy)

`end_date` 지난 raid 의 status 가 `active` 로 남으면 contribute 계속 발생. cron 없이 lazy update:

```sql
-- get_active_gym_raids RPC 첫 부분에 lazy expire
UPDATE boxing_gym_raids
SET status = 'ended'
WHERE status = 'active'
  AND end_date < (now() AT TIME ZONE 'Asia/Seoul')::date;
```

또한 `current_value >= target_value` 시점에 `completed` 자동 전환:

```sql
-- contribute_to_gym_raid 의 끝부분에
UPDATE boxing_gym_raids
SET status = 'completed'
WHERE id = p_raid_id
  AND status = 'active'
  AND current_value >= target_value;
```

#### ⑮ 코치 대시보드 — 권한 RPC 내부 검증 + N+1 회피

**클라이언트 권한 체크만 믿지 마라.** `get_coach_quest_dashboard` RPC 첫 줄에서:

```sql
IF NOT (
  public.has_role(v_uid, 'super_admin')
  OR public.has_role(v_uid, 'branch_manager')
  OR public.has_role(v_uid, 'coach')
) THEN
  RAISE EXCEPTION 'insufficient permissions';
END IF;

-- branch_manager / coach 는 자신의 branch_name 만
IF NOT public.has_role(v_uid, 'super_admin') THEN
  IF p_branch_name IS NULL OR p_branch_name <> v_my_branch THEN
    RAISE EXCEPTION 'branch scope mismatch';
  END IF;
END IF;
```

**N+1 회피**: 회원 1000명 지점에서도 단일 쿼리. `LATERAL JOIN` 또는 단일 CTE + window function. 회원 한 명씩 SELECT 루프 절대 금지.

**민감정보 화이트리스트**: 반환 컬럼에 `phone_number`, `email`, `birth_date`, `address`, `parent_phone` 등 절대 포함 금지. v1 의 `get_second_cheer_candidates` 패턴 참조.

### 추가 보강 — v1.5 에서 검증된 일관성 패턴

| 항목 | 인용 | v2 적용 |
|---|---|---|
| 모달 z-index | v1.5 | `z-[100]` 통일 (계획안의 z-[70]은 최소치, 일관성 위해 100) |
| a11y | v1.5 | `role='dialog'` + `aria-modal='true'` + `useModalDismiss` 훅 |
| 안전영역 패딩 | v1.5 | `pb-[calc(env(safe-area-inset-bottom)+5rem)]` |
| AnimatePresence early return 금지 | v1.5 | `if (!open) return null` 금지 — 단일 트리 안에서 분기 |
| useQuery enabled gate | v1.5 #4 | 신규 hook 모두 `enabled: !!user?.id` (또는 `enabled: open`) |
| useMemo deps stabilize | v1.5 #7 | reference 새로 생기는 prop 은 useMemo 로 안정화 |
| react-refresh 코멘트 | v1.5 #9 | 컴포넌트 + 상수 동시 export 시 eslint-disable 주석 |
| 운영 owner=Lovable 권한 | v1 #10 | 신규 마이그레이션은 Lovable 위임 또는 Dashboard SQL Editor 수동 (UTF-8 인코딩 명시) |

### ENGAGEMENT_ERROR_MAP 확장 (서비스 레이어)

`src/services/boxingEngagementService.ts` 의 `ENGAGEMENT_ERROR_MAP` 에 v2 신규 RPC 에러 한국어 매핑 추가:

```ts
// v2 19단계 — 코너맨
{ match: "cornerman pair already exists", ko: "이미 코너맨이 있습니다." },
{ match: "cornerman request already pending", ko: "이미 보낸 요청이 처리 대기 중입니다." },
{ match: "cornerman not your pair", ko: "본인의 코너맨이 아닙니다." },
{ match: "cornerman branch mismatch", ko: "같은 지점 회원만 코너맨이 될 수 있습니다." },
{ match: "cornerman bonus not eligible", ko: "오늘 코너 보너스 조건이 아닙니다." },
{ match: "cornerman bonus already claimed", ko: "오늘 코너 보너스는 이미 받았습니다." },

// v2 20단계 — 그림자 복서
{ match: "shadow boxer not ready", ko: "아직 비교할 데이터가 부족합니다." },
{ match: "shadow boxer reward already claimed", ko: "이번 달 그림자 보상은 이미 받았습니다." },
{ match: "shadow boxer not improved", ko: "이번 라운드는 데이터로 저장되었습니다." },

// v2 21단계 — 짐 레이드
{ match: "gym raid not found", ko: "해당 짐 레이드를 찾을 수 없습니다." },
{ match: "gym raid not active", ko: "이미 끝난 짐 레이드입니다." },
{ match: "gym raid invalid source", ko: "기여 인증 정보가 올바르지 않습니다." },
{ match: "gym raid not completed", ko: "짐 레이드 목표가 아직 달성되지 않았습니다." },
{ match: "gym raid no contribution", ko: "기여 기록이 없어 보상을 받을 수 없습니다." },
{ match: "gym raid reward already claimed", ko: "이미 받은 짐 레이드 보상입니다." },

// v2 22단계 — 코치 대시보드
{ match: "insufficient permissions", ko: "이 화면을 볼 권한이 없습니다." },
{ match: "branch scope mismatch", ko: "본인 지점만 조회할 수 있습니다." },
```

---

## 12. 단계별 구현 순서

```
18단계 (현재): docs/153-quest-v2-community-plan.md ← 본 문서
        │
        ▼
19단계: 코너맨 매칭 MVP
        ├─ 마이그레이션: 20260701000000_boxing_cornerman.sql
        ├─ service: 6 RPC 래퍼
        ├─ hook: useCornerman
        ├─ 컴포넌트: CornermanCard / CornermanSheet / CornermanCandidateList / CornermanStatusPanel
        ├─ data: cornermanMessages.ts
        ├─ 진입점: HomeEngagementSection 또는 MyPage
        └─ 검증: bun run build / 신규 영역 lint / grep
        │
        ▼
20단계: 그림자 복서 MVP
        ├─ 마이그레이션: 20260702000000_boxing_shadow_boxer.sql
        ├─ service: 2 RPC 래퍼
        ├─ hook: useShadowBoxer
        ├─ 컴포넌트: ShadowBoxerCard / ShadowBoxerSheet / ShadowMetricRow
        ├─ data: shadowBoxerMessages.ts
        ├─ 진입점: MyPage 의 BoxerStyleDiagnosisCard 아래
        └─ 검증
        │
        ▼
21단계: 팀 / 짐 레이드 MVP
        ├─ 마이그레이션: 20260703000000_boxing_gym_raids.sql (3 테이블 + 3 seed)
        ├─ service: 3 RPC 래퍼
        ├─ hook: useGymRaid + useGymRaidContributeTrigger (디바운스)
        ├─ 컴포넌트: GymRaidCard / GymRaidSheet / GymRaidContributionList
        ├─ data: gymRaidMessages.ts
        ├─ 4 기존 hook 의 onSuccess 에 contribute trigger 추가
        ├─ 진입점: HomeEngagementSection 또는 MyPage
        └─ 검증
        │
        ▼
22단계: 코치 대시보드 QUEST 데이터 확장
        ├─ 마이그레이션: 20260704000000_coach_quest_dashboard.sql (RPC 만)
        ├─ service: 1 RPC 래퍼
        ├─ hook: useCoachQuestDashboard
        ├─ 컴포넌트: src/components/engagement/coach/ 디렉토리 신규
        │           QuestCoachSummaryPanel / QuestAtRiskMembersPanel /
        │           QuestPraiseTargetsPanel / QuestCommunityPanel
        ├─ 진입점: CoachDashboard.tsx (옵션 BranchManagerHome)
        └─ 검증
        │
        ▼
23단계: v2 QA / 회귀 테스트 / 배포
        ├─ 마이그레이션: 0
        ├─ docs: 153-quest-v2-qa-regression-report.md
        ├─ 보호 영역 grep / 빌드 / lint
        └─ 최종 판정: PASS / PASS_WITH_NOTES / BLOCKED
```

각 단계 종료 시:
- `bun run build` ✓
- `npx eslint <신규 영역만>` 0 errors
- 보호 영역 grep 0 건
- `git add` / `git commit -m "[v2/N] ..."` (3줄 요약)
- 마이그레이션 단계는 운영 반영 (Lovable 위임 또는 SQL Editor + UTF-8 인코딩 명시)

---

## 13. QA 체크리스트 (각 단계 + 23단계 통합)

### 13-1. 보호 영역 무수정 (모든 단계 공통)

| 항목 | 검증 방법 |
|---|---|
| 공식 1~40 훈련 리스트 | `git diff HEAD -- src/data/allLevelsData.ts src/data/whiteLevel1Data.ts src/data/sharedConstants.ts` 빈 출력 |
| `levels` / `missions` / `mission_videos` / `mission_submissions` | 신규 마이그레이션 grep 0건 |
| `member_progress` UPDATE | `from\(["']member_progress["']\)\.update` 신규 영역 0건 |
| `approve_mission_submission` / `record_attendance` | `rpc\(["'](approve_mission_submission\|record_attendance)["']` 신규 영역 0건 |
| `useManualLevelUp` / `usePassBossBattle` | import / 호출 신규 영역 0건 |
| ChatAssistant | `src/components/ChatAssistant.tsx` 와 `supabase/functions/chat-assistant/` 무수정 |
| 기존 21일 챌린지 | `submitChallengeCheckin` / `syncQuestCheckin` / `queryKey: \["challenges"` 신규 영역 0건 |
| 기존 `AtRiskMembersPanel.tsx` | 무수정 (264줄 그대로) |
| `src/integrations/supabase/types.ts` | 무수정 (자동 생성) |

### 13-2. 파이트 머니 무결성

| 항목 | 검증 방법 |
|---|---|
| `from("user_wallets").update` / `from("wallets").update` 신규 영역 | grep 0건 |
| 모든 gems 변동이 RPC 내부 `grant_gems` 만 경유 | 신규 마이그레이션에 `PERFORM public.grant_gems(...)` 패턴만 |
| 클라이언트 `rpc("grant_gems", ...)` 직접 호출 신규 영역 | grep 0건 |

### 13-3. 어뷰징 방지

| 항목 | 검증 방법 |
|---|---|
| 코너맨 일일 보너스 4중 검증 (§11-⑪) | RPC 본문 4개 분기 검사 |
| 코너맨 pending 7일 만료 (§11-⑩) | RPC 내부 lazy update SQL 확인 |
| 그림자 복서 월 1회 한도 (§11-⑤) | idempotency_key `shadow_boxer:{window}:{KST_yyyy-mm}` |
| 짐 레이드 contribute UNIQUE (§11-⑬) | `UNIQUE (raid_id, user_id, source_type, source_id)` |
| 짐 레이드 보상 1회 (§11-⑤) | `UNIQUE (raid_id, user_id)` |
| 짐 레이드 status 자동 ended/completed (§11-⑭) | get_active / contribute RPC 의 lazy UPDATE |

### 13-4. 모달 / a11y / z-index / enabled gate

| 항목 | 검증 방법 |
|---|---|
| 신규 모달 z-index | `z-[100]` 통일 |
| `role='dialog' aria-modal='true'` | 신규 모달/시트 모두 부착 |
| `useModalDismiss` 훅 사용 | 신규 모달/시트 모두 사용 |
| 안전영역 패딩 | `pb-[calc(env(safe-area-inset-bottom)+5rem)]` |
| useQuery enabled gate | 신규 hook 모두 `enabled: !!user?.id` (또는 `enabled: open`) |
| 신규 query key 충돌 | §10-3 표 대조 |

### 13-5. 빌드 / 린트

| 항목 | 명령 | 합격 기준 |
|---|---|---|
| 프로덕션 빌드 | `bun run build` | `✓ built in ...` |
| 신규 영역 lint | `npx eslint <신규 파일 경로 들>` | 0 errors |

### 13-6. 코치 대시보드 권한 / 개인정보

| 항목 | 검증 방법 |
|---|---|
| 클라이언트 권한 체크 | `useCoachQuestDashboard` 훅 안에 `role` / `is_branch_manager_of` 검증 |
| RPC 내부 권한 체크 (§11-⑮) | `get_coach_quest_dashboard` 첫 줄에 RAISE EXCEPTION |
| 민감정보 화이트리스트 | 반환 schema 에 phone/email/birth_date 부재 (RPC SELECT 컬럼 직접 검사) |
| 일반 회원 차단 | useCoachQuestDashboard 훅 / RPC 모두 `member` role 호출 시 에러 |

### 13-7. 23단계 통합 grep

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
```

신규 영역 (19~22 단계 추가/수정 파일) 에 위 패턴 발견되면 **차단**.

---

## 14. v2.5 / v3 백로그

§5 의 보류 기능 + v2 후속 작업:

| 우선순위 | 항목 | 사유 |
|---|---|---|
| High | 코너맨 N:N (소그룹) 또는 코너맨 그룹 채팅 | 1:1 안정화 후 확장 |
| High | 짐 레이드 어드민 콘솔 | 관장이 직접 raid 생성/종료 — UI 인프라 |
| High | types.ts 자동 재생성 + sbFrom / sbRpc cast 제거 | 23단계 QA 종료 후 |
| Med | 라이벌 매칭 4주 시즌 | 매칭 알고리즘 + 시즌 시스템 |
| Med | 시즌 스토리 패스 MVP | 시즌 인프라 (start/end + 보상 트리거) |
| Med | 카드 수집 시스템 MVP | 카드 / 도감 / 인벤토리 |
| Med | 그림자 복서 7일 / 90일 비교 추가 | 30일 안정화 후 |
| Low | 레전드 콘텐츠 (실존 인물) | 저작권 검토 |
| Low | 명장면 영상 제출 | 회원 영상 + 코치 검수 |
| Low | AI 자세 분석 | ML 인프라 |
| Low | 블랙 트레이너 시스템 | 페르소나 확장 |
| Low | 오삼이 라디오 | 음성 인프라 |

---

## 15. 본 18단계 결과

| 항목 | 값 |
|---|---|
| 생성 문서 | `docs/153-quest-v2-community-plan.md` (본 문서) |
| 코드 변경 | **0** |
| 마이그레이션 추가 | **0** |
| RPC 추가 | **0** |
| 컴포넌트 추가 | **0** |
| 보호 영역 변경 | **0** |
| `bun run build` | 미수행 (코드 변경 0) |

### v2 에서 구현할 기능 (확정)

1. 코너맨 매칭 (19단계)
2. 그림자 복서 (20단계)
3. 짐 레이드 (21단계)
4. 코치 대시보드 QUEST 확장 (22단계)
5. v2 QA / 배포 (23단계)

### v2 에서 보류할 기능

- 라이벌 매칭 4주 시즌 / 시즌 스토리 패스 / 카드 수집 300장 / 레전드 콘텐츠 / 명장면 영상 제출 / AI 자세 분석 / 블랙 트레이너 시스템 / 오삼이 라디오 / 코너맨 N:N / 짐 레이드 어드민 콘솔 / 그림자 복서 7일·90일 / 실제 푸시 발송

### 충돌 위험 상위 5

1. **§11-⑨ 코너맨 active pair 1개 제한** — DB UNIQUE 만 의존 시 race condition. RPC 양면 검증 강제.
2. **§11-⑪ 코너맨 일일 보너스 어뷰징** — 4중 검증 누락 시 무한 GEM 펌프. 같은 지점 + 진짜 활동 + 1일 1회 + active pair 모두 강제.
3. **§11-⑬ 짐 레이드 contribute source 검증** — 다른 사람 source 자기 것으로 등록 가능. RPC 내부 `user_id = auth.uid()` 검증 강제.
4. **§11-⑮ 코치 대시보드 권한** — 클라이언트만 믿으면 일반 회원이 다른 회원 정보 조회 가능. RPC 내부 권한 + 민감정보 화이트리스트 강제.
5. **§11-⑫ 그림자 복서 30일 미만 fallback** — 미설정 시 신규 가입자에게 잘못된 비교 결과 노출.

### 다음 19단계에서 시작할 기능

**코너맨 매칭 MVP**

시작 전 사전 체크:
- [ ] HEAD = `9882a9c` (v1.5 출시 후 안정 상태) 확인
- [ ] v1.5 마이그레이션 3개 운영 반영 확인 (이미 검증됨)
- [ ] `bun run build` 클린 통과 상태 확인
- [ ] 본 문서 §11 (15 함정) 통독

---

## 부록 A. 참고 문서

- `docs/153-quest-full-engagement-roadmap.md` — 전체 백로그 / 로드맵
- `docs/153-quest-xp-reward-separation-design.md` — XP / 보상 분리 설계
- `docs/153-quest-v1-qa-regression-report.md` — v1 QA 회귀 리포트
- `docs/153-quest-v1-5-implementation-plan.md` — v1.5 구현 계획
- `docs/153-quest-v1-5-qa-regression-report.md` — v1.5 QA 회귀 리포트 (PASS_WITH_NOTES)
- `docs/153_quest_v1_handoff.pdf` — v1 → 13단계 인수인계 PDF
- `CLAUDE.md` — 프로젝트 절대 규칙

## 부록 B. 19~23 단계 코드 AI 가 매 작업 시작 시 5분 내 확인할 것

1. 본 문서 §3 (보호 원칙 12) 통독
2. 본 문서 §11 (15 함정) 통독
3. 해당 단계의 §7 (DB/RPC) + §8 (UI 위치) + §10 (충돌) 읽기
4. 마이그레이션 파일명 §7-5 표대로 (`20260701~`)
5. RLS 정책 §7-6 super_admin 패턴 + USING/WITH CHECK
6. query key §10-3 표 대조
7. ENGAGEMENT_ERROR_MAP 확장 §11 끝부분
8. 작업 종료 시 §13 QA 체크리스트 통과
