

# 153 자가 도전 + 코치 백업 + 40레벨 확장 구현 계획

이 업데이트는 기존 코드베이스를 유지하면서 3가지 핵심 시스템을 추가합니다.

---

## 요약

| 영역 | 작업 |
|------|------|
| 자가 도전 모드 | 원탭 시작/종료, 자동 XP/세션 기록, 보너스 구조 |
| 코치 백업 모드 | 오늘 방문자 큐, 원탭 완료/부분/보완, 퀵 태그 |
| 40레벨 데이터 | 전체 레벨 콘텐츠 + 통합 데이터 모델 |
| iPhone UX | spring 전환, 바텀시트, 안전영역, 프리미엄 느낌 |
| 가이드 확장 | 6개 FAQ 추가 |

---

## Phase 1: 데이터 레이어

### 1A. 40레벨 통합 데이터 (`src/data/allLevelsData.ts`)

새 파일 생성. 기존 `whiteLevelData.ts`, `whiteLevel1Data.ts`, `whiteLevel2Data.ts`는 유지.

```text
interface UnifiedLevel {
  globalLevel: number        // 1~40
  league: "white"|"blue"|"red"|"black"
  levelInLeague: number      // 1~10
  title: string
  shortGoal: string
  valueGained: string[]
  routineA: RoutineBlock[]
  routineB: RoutineBlock[]
  homeMissionOptions: HomeMission[]
  checklistFocus: string[]
  progressionConfig: {
    minXp: number
    minSessions: number
    minDays: number
    minMinutes: number
    checklistPassCount: number
    mandatoryItems: number[]
    additionalRules?: Record<string, any>
  }
  coachTags: string[]
  learningModules: LearningModule[]
  illustrationMeta: { title: string; brief: string; prompt: string }
  completionMode: "self_or_coach" | "coach_required" | "admin_required"
}
```

40개 레벨 전체 콘텐츠를 프롬프트에 명시된 제목/테마 기반으로 생성. White 1-3은 상세 루틴 포함, 4-10은 간결한 루틴, Blue/Red/Black은 테마 중심 구조.

### 1B. levelRuleEngine.ts 확장

- `LEVEL_RULES`를 40레벨로 확장 (allLevelsData에서 progressionConfig 참조)
- 기존 white-1, white-2 규칙 유지

### 1C. 자가 도전 / 코치 백업 상태 모델

`useLocalProgress.ts`에 추가:

```text
interface DailyParticipation {
  date: string
  levelId: string
  mode: "self_challenge" | "coach_backup" | "partial" | "needs_review"
  startedAt: string | null
  finishedAt: string | null
  actualMinutes: number
  xpAwarded: number
  bonusXp: number          // 자가 도전 보너스
  coachStatus: string | null
  coachTags: string[]
  selfChallengeStreak: number
}
```

localStorage에 `daily-participation` 키로 저장. 기존 `white-lv1-progress` 키와 병행.

---

## Phase 2: 자가 도전 모드 (회원)

### 핵심 원칙
- 운동 중 폰 조작 최소화 (시작 1탭 + 종료 1탭)
- 기존 SessionRunner의 블록별 체크 → 선택사항으로 변경 (V1에서 블록 체크 불필요)

### 구현

**새 컴포넌트: `SelfChallengeFlow.tsx`**
- 시작 화면: 오늘 추천 루틴 표시 + "도전 시작" 대형 버튼
- 진행 중: 경과 시간만 표시 (블록 체크 없음)
- 종료: "도전 완료" 버튼 → 자동 시간 계산 → 결과 화면
- 결과: XP + 보너스 XP + 세션 인정 여부 + 다음 추천

**보상 구조:**
- 세션 완료(45분+): 레벨 XP + 인정 세션 (자가/코치 동일)
- 자가 도전 보너스: +20 총 XP, 자가 도전 연속 기록
- 코치 백업: 동일 레벨 진행, 보너스 없음

**HomePage 업데이트:**
- "오늘의 추천 루틴" 카드 추가
- "자가 도전 시작" CTA → SelfChallengeFlow로 전환
- 완료 후 결과 요약 표시
- 자가 도전 보너스 설명 마이크로카피

**영향 파일:**
- `src/pages/HomePage.tsx` — CTA 변경, 추천 루틴 카드
- `src/components/WhiteLeagueTab.tsx` — SelfChallengeFlow 연동
- `src/hooks/useLocalProgress.ts` — 일일 참여 기록 추가
- `src/components/SessionRunner.tsx` — 블록 체크를 선택사항으로 변경

---

## Phase 3: 코치 백업 모드

### 구현

**새 컴포넌트: `DailyOperationsBoard.tsx`**
- 오늘 방문자/참여자 목록
- 자가 도전 완료자 = 녹색 표시
- 미처리 회원 = 원탭 처리 큐

**원탭 액션:**
- 완료 / 부분 완료 / 보완 필요 / 레벨업 체크 예정

**퀵 태그 선택 (선택사항):**
- 가드, 잽, 스텝, 체력, 자세 복구, 더블 잽, 콤비, 거리, 타이밍, 설명력

**대시보드 메트릭:**
- 오늘 방문자 수, 자가 도전 완료, 코치 처리, 부분 완료, 미처리
- 자가 도전 참여율

**영향 파일:**
- `src/pages/BranchManagerHome.tsx` — 새 탭 "오늘 운영" 추가 (기존 members/inbox/level_review 유지)
- `src/pages/MemberDetailPage.tsx` — 자가 도전 이력, 코치 태그 이력 추가

---

## Phase 4: iPhone 네이티브 UX

### 구현

**새 파일: `src/lib/transitions.ts`**
- spring 기반 타이밍 함수
- CSS 변수로 전환 시간 관리

**Tailwind 확장 (`tailwind.config.ts`):**
- `animate-slide-in-right`, `animate-slide-out-left` 추가
- spring 느낌의 cubic-bezier 이징

**바텀시트 패턴:**
- 기존 Drawer 컴포넌트 활용하여 iOS 스타일 rounded corners + spring detent 느낌

**마이크로 인터랙션:**
- 버튼 press: `active:scale-[0.96]` (이미 적용됨)
- XP 획득 애니메이션
- 탭 전환: 부드러운 fade

**영향 파일:**
- `tailwind.config.ts` — 새 애니메이션 추가
- `src/index.css` — safe-area 변수, spring 이징
- 각 페이지 — 전환 클래스 적용

---

## Phase 5: 가이드 + 예외 처리

### 가이드 확장
`src/pages/GuidePage.tsx`에 6개 FAQ 추가:
1. 왜 이 프로그램은 필수인가요?
2. 왜 자가 도전이 더 좋은 보상을 받나요?
3. 왜 코치 백업이 있나요?
4. 왜 화이트 1~3은 쉬우면서도 반복적인가요?
5. 왜 레벨업은 공정하게 같고, 보너스는 다를 수 있나요?
6. 왜 1~40 전체가 연결된 성장 경로인가요?

### 예외 큐
코치 대시보드에 예외 필터 추가:
- 45분 미달 종료
- 종료 없는 시작
- 반복적 초단시간 패턴
- 당일 미처리 회원

---

## 스키마 변경

**이번 단계: 없음 (localStorage 우선)**

기존 합의대로 localStorage로 먼저 구현. 향후 Supabase 마이그레이션 시:
- `training_sessions` 테이블
- `daily_participation` 테이블
- `self_challenge_metrics` 테이블

---

## 유지되는 기존 시스템

- 모든 기존 라우트 유지
- BottomNav 7탭 유지
- 기존 미션/비디오/승인 플로우 유지
- 기존 XP 랭킹 시스템 유지
- 기존 RLS/역할 구조 유지
- 기존 가이드 페이지 유지
- whiteLevelData.ts, whiteLevel1Data.ts, whiteLevel2Data.ts 유지

---

## 파일 변경 요약

| 작업 | 파일 |
|------|------|
| 새 생성 | `src/data/allLevelsData.ts` (40레벨) |
| 새 생성 | `src/components/SelfChallengeFlow.tsx` |
| 새 생성 | `src/components/DailyOperationsBoard.tsx` |
| 확장 | `src/data/levelRuleEngine.ts` |
| 확장 | `src/hooks/useLocalProgress.ts` |
| 확장 | `src/pages/HomePage.tsx` |
| 확장 | `src/components/WhiteLeagueTab.tsx` |
| 확장 | `src/pages/BranchManagerHome.tsx` |
| 확장 | `src/pages/MemberDetailPage.tsx` |
| 확장 | `src/pages/GuidePage.tsx` |
| 확장 | `src/pages/RankUpPage.tsx` |
| 확장 | `tailwind.config.ts` |
| 리팩터 | `src/components/SessionRunner.tsx` (블록 체크 선택사항화) |

---

## 구현 순서

1. `allLevelsData.ts` — 40레벨 데이터 구조
2. `levelRuleEngine.ts` 확장
3. `useLocalProgress.ts` — 자가 도전 / 일일 참여 모델
4. `SelfChallengeFlow.tsx` — 원탭 시작/종료
5. `HomePage.tsx` — 추천 루틴 + 자가 도전 CTA
6. `DailyOperationsBoard.tsx` — 코치 운영 보드
7. `BranchManagerHome.tsx` — 운영 탭 통합
8. iPhone UX 전환 + 애니메이션
9. 가이드 FAQ 확장
10. `RankUpPage.tsx` — 40레벨 상태 표시

