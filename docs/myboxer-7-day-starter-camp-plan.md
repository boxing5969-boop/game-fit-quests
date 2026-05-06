# 마이복서153 7일 스타터 캠프 — UX 설계 문서 (단계 41)

> **본 문서는 설계 명세이며 코드/DB/RPC/컴포넌트 구현을 포함하지 않는다.**
> 다음 단계(42~48)에서 본 명세를 기반으로 컴포넌트와 정적 데이터만 만든다 (DB/RPC 0).

회원 화면 이름: **오삼이와 함께하는 7일 입문 캠프**
내부 시스템명: **MyBoxer Tutorial Camp**

---

## 1. 7일 스타터 캠프 전체 목적

신규 회원이 가입 직후 7일 동안 **하루 한 영역씩** 마이복서153 앱의 핵심 사용법을 손으로 직접 만져보며 익힌다. 텍스트만 읽는 방식이 아니라, **실제 화면 요소를 하이라이트** 하고 사용자가 해당 부분을 클릭하거나 이동해야 다음 단계로 진행된다.

도달 목표(7일 끝):
- BottomNav 5개 메인 탭 + 전체 메뉴 13개 항목을 모두 한 번 이상 만져봤음.
- 마스터로드 / 153 QUEST / 복싱 IQ / 챌린지 아레나 / 챔피언 일기 / 세컨드 응원 / 마이페이지 각각이 무엇인지 한 줄로 설명 가능.
- 안전 가이드의 존재를 인지함.
- 7일 끝나면 "이 앱 어떻게 쓰는 거지?" 라는 질문을 더 이상 하지 않는다.

비목표 (이번 단계 + 후속 단계 모두):
- 공식 훈련 / 레벨 / 승급 시스템 변경 0
- 마스터로드 콘텐츠 확장 0
- BottomNav 새 항목 추가 0
- DB / Supabase / RPC / migration 0
- 153마인드셋(`/myboxer/visualization`) 흐름 / id / localStorage 키 변경 0

---

## 2. 기존 시스템 보호 원칙

| 영역 | 정책 |
|---|---|
| `levels` / `missions` / `mission_videos` / `mission_submissions` / `member_progress` | 테이블/컬럼/RPC 호출 0. 캠프 진행 상태는 localStorage 단독 |
| `approve_mission_submission` / `record_attendance` | 호출 금지 |
| `useManualLevelUp` / `usePassBossBattle` | 호출 금지. 캠프가 공식 레벨/승급에 영향 0 |
| `MissionsPage.tsx` / `RankUpPage.tsx` 공식 훈련 로직 | 로직 변경 0. `data-tour` anchor 한 줄 추가만 허용 |
| `ChatAssistant` / `supabase/functions/chat-assistant` / `systemPrompt153` / `knowledge153` | 0 byte 변경. 오삼이 캠프 대사는 정적 상수만 |
| `useWallet` / `challengeService` / `allLevelsData` / `whiteLevel1Data` / `sharedConstants` | 호출 금지, 수정 금지 |
| `src/integrations/supabase/types.ts` | 자동 생성 — 직접 수정 0 |
| **153마인드셋 (`/myboxer/visualization`)** | session id `myboxer-153-returned-person` / `myboxer-153-one-year-later`, localStorage key `myboxer.visualization.records`, 7-step 흐름 모두 **0 변경** |
| 파이트 머니 (`real_gems`) | wallet 직접 update 0. 캠프는 wallet 미사용 |
| 공식 XP | 미지급. 캠프 보상은 클라이언트 cosmetic만 (배지 표시 / 칭호 텍스트) |

---

## 3. 현재 메뉴 유지 원칙

[BottomNav.tsx](../src/components/BottomNav.tsx) 의 mainTabs 5개 + baseMenuItems 13개 항목 — **0 byte 변경**.

캠프 진입점은 BottomNav가 아니라:
1. **홈 상단의 "오늘의 캠프 카드"** (HomePage 안에 비침투형 카드, 캠프 활성 회원만 표시).
2. **마이페이지의 "캠프 다시 보기" 카드** (이미 완료한 회원도 재시청 가능).
3. **글로벌 floating coach bubble** (선택, 캠프 활성 동안만).

→ **새 라우트 0개**. 캠프는 모든 단계가 기존 페이지 위 overlay로 진행 — `/home`, `/missions`, `/minigame`, `/challenges`, `/myboxer/visualization`, `/mypage` 등 기존 라우트 위에 overlay만.

---

## 4. localStorage 기반 진행 상태 설계

### 4.1 키 (제안 — 변경 가능)

| 키 | 용도 | 형태 |
|---|---|---|
| `myboxer.tutorialCamp.v1.state` | 캠프 진행 상태 (현재 day/step, 완료 day 목록, started/finished 시각) | object |
| `myboxer.tutorialCamp.v1.events` | step 단위 통과 이벤트 로그 (디버깅 + 진행 분석) | array |
| `myboxer.tutorialCamp.v1.devPreview` | 개발자 preview 모드 — 임의 day/step 점프 (UI 안 노출) | object |

> ⚠️ **기존 `myboxer.visualization.records` 키는 그대로**. 153마인드셋 기록과 캠프 진행은 완전히 분리.

### 4.2 state 형태

```ts
interface TutorialCampState {
  status: "pending" | "active" | "skipped" | "completed";
  startedAt: string | null;            // ISO. 캠프 시작 시점
  finishedAt: string | null;           // Day 7 완료 시점
  currentDay: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  currentStepIndex: number;            // 해당 day 안 step (0..N)
  completedDays: number[];             // [1, 2, 3, ...] 누적
  completedSteps: string[];            // ["day1.home_today", ...] 영구 식별자
  lastActiveAt: string | null;         // 마지막 진입 시각 (cooldown 계산용)
  schemaVersion: 1;                    // 미래 마이그레이션 대비
}
```

기본값:
```ts
{
  status: "pending",
  startedAt: null,
  finishedAt: null,
  currentDay: 1,
  currentStepIndex: 0,
  completedDays: [],
  completedSteps: [],
  lastActiveAt: null,
  schemaVersion: 1,
}
```

### 4.3 events 형태

```ts
interface TutorialCampEvent {
  ts: string;                          // ISO
  type: "start" | "step_view" | "step_complete" | "day_complete"
       | "skip" | "resume" | "fallback_skip" | "finish";
  day?: number;
  stepCode?: string;                   // 영구 식별자
  reason?: string;                     // skip / fallback 사유
}
```

events는 길이 상한 200 (FIFO). 운영 디버깅 용도.

### 4.4 devPreview 형태

```ts
interface TutorialCampDevPreview {
  enabled: boolean;
  forceDay?: number;
  forceStepIndex?: number;
  bypassCooldown?: boolean;            // 24h 제한 무시
  bypassRouteCheck?: boolean;          // route mismatch 시에도 step 표시
}
```

회원 UI에 절대 노출 안 함. 콘솔 명령(`window.__myboxer_camp.preview(...)`) 또는 `?camp=dev` 쿼리스트링으로만 활성.

### 4.5 안전망

- 모든 `JSON.parse` 는 try/catch.
- 깨진 데이터 → 기본값으로 폴백.
- QuotaExceeded 시 조용히 무시 (회원 경험 흐트러뜨리지 않음).
- SSR-safe (`typeof window === "undefined"` 체크).

---

## 5. Day별 교육 목표

각 Day는 4~7 step으로 구성. 하루 1 Day 원칙 (24h cooldown), 회원 토글로 연속 진행 허용.

### Day 1 — 홈 / 오늘의 라운드 / 오삼이 (5 step)
| # | 교육 목표 | 화면 / 영역 | 사용자 행동 |
|---|---|---|---|
| 1.1 | 오삼이가 매일 메시지를 준다는 것 | `OsamiDailyBriefingCard` | 카드 영역 1회 탭 |
| 1.2 | 오늘의 퀘스트 위치 인지 | `TodayQuestMiniPanel` | 카드 영역 1회 탭 |
| 1.3 | 홈이 출발점이라는 감각 | BottomNav 홈 아이콘 | 홈 아이콘 한 번 (이미 홈일 때는 펄스로 안내) |
| 1.4 | 153이 무엇인지 알 권리 | `/about/153` | 페이지 1회 방문 |
| 1.5 | Day 1 완료 마이크로 의식 | 모달 | "내일 다시 오세요" 닫기 |

### Day 2 — 공식 훈련 / 마스터로드 (6 step)
| # | 교육 목표 | 화면 | 사용자 행동 |
|---|---|---|---|
| 2.1 | 메인 훈련 탭 위치 | BottomNav 훈련 (글러브) | 탭 → `/missions` |
| 2.2 | 마스터로드 = 공식 훈련 트랙 | `/master-track` 진입 | 카드 1회 탭 |
| 2.3 | 단증/단계 구조 (정보만) | MasterTrackPage 첫 단계 카드 | 카드 1회 탭 (제출 X) |
| 2.4 | 영상 시청 vs 제출의 차이 | 영상 안내 영역 | 정보 카드 닫기 |
| 2.5 | 단증혜택 메뉴 인지 | BottomNav 단증혜택 | 페이지 1회 방문 |
| 2.6 | Day 2 완료 | 모달 | 닫기 |

### Day 3 — 153 QUEST / 복싱 IQ (5 step)
| # | 교육 목표 | 화면 | 사용자 행동 |
|---|---|---|---|
| 3.1 | "복싱 트레이닝" = 153 QUEST | 전체 메뉴 → `/minigame` | 메뉴 항목 탭 |
| 3.2 | 미니게임 종류 인지 | MinigamePage 게임 카드 | 한 카드 탭 (정보만) |
| 3.3 | 복싱 IQ 리그 위치 (홈) | `BoxingIqLeagueCard` | 카드 영역 탭 |
| 3.4 | 퀴즈는 안전 / 부담 없음 | `BoxingAcademyQuizModal` | 1회 열어 보고 닫기 |
| 3.5 | Day 3 완료 | 모달 | 닫기 |

### Day 4 — 챌린지 / 안전 체크 (6 step)
| # | 교육 목표 | 화면 | 사용자 행동 |
|---|---|---|---|
| 4.1 | 챌린지 아레나 = 재미 챌린지 | `FunChallengeCard` | 카드 탭 → 아레나 sheet |
| 4.2 | 챌린지 아레나는 21일 챌린지와 별개 | sheet 안내 | 1회 읽기 |
| 4.3 | 통증 체크의 중요성 | `ConditionGaugeCard` | 카드 탭 → 게이지 sheet |
| 4.4 | 부상 시 코치/관장에게 알린다 | `SafetyCheckPanel` | 안내 1회 읽기 |
| 4.5 | 가이드 메뉴 안 안전 가이드 | `/guide/safety` | 1회 방문 |
| 4.6 | Day 4 완료 | 모달 | 닫기 |

### Day 5 — 챔피언 일기 / 나의 기록 (5 step)
| # | 교육 목표 | 화면 | 사용자 행동 |
|---|---|---|---|
| 5.1 | 챔피언 일기 = 매일 한 줄 기록 | `ChampionJournalCard` | 카드 탭 |
| 5.2 | 일기는 본인만 본다 (안심) | `ChampionJournalSheet` | 안내 1회 읽기 |
| 5.3 | 성장 리포트 위치 | `GrowthReportCard` | 카드 탭 |
| 5.4 | 보상 메뉴 = 모은 파이트 머니 사용처 | 전체 메뉴 → `/rewards` | 1회 방문 |
| 5.5 | Day 5 완료 | 모달 | 닫기 |

### Day 6 — 세컨드 응원 / 동료 연결 (5 step)
| # | 교육 목표 | 화면 | 사용자 행동 |
|---|---|---|---|
| 6.1 | 세컨드 = 다른 회원 응원 시스템 | `SecondCheerCard` | 카드 탭 → cheer sheet |
| 6.2 | 코너맨 후보 = 함께 훈련할 사람 | `CornermanCard` | 카드 탭 |
| 6.3 | 그림자 복서 = 자기 기록과 비교 | `ShadowBoxerCard` | 카드 탭 |
| 6.4 | 지점 단합 이벤트 | `GymRaidCard` | 카드 탭 |
| 6.5 | Day 6 완료 | 모달 | 닫기 |

### Day 7 — 마이페이지 / 성장 / 완료식 (7 step)
| # | 교육 목표 | 화면 | 사용자 행동 |
|---|---|---|---|
| 7.1 | 내정보 메뉴 위치 | 전체 메뉴 → `/mypage` | 1회 방문 |
| 7.2 | 마이페이지 안 캐릭터 / 단증 / 통계 | `MyPage` 섹션 | 스크롤 끝까지 |
| 7.3 | 캐릭터 스튜디오 = 외형 커스터마이즈 | `/character-studio` | 1회 방문 |
| 7.4 | 랭킹 위치 | `/halloffame` | 1회 방문 |
| 7.5 | 랭크업 페이지 = 로드맵 + 가치맵 | `/rank-up` | 1회 방문 |
| 7.6 | 설정 메뉴 (알림 / 로그아웃) | `/settings` | 1회 방문 |
| 7.7 | **완료식** — confetti + 오삼이 절 + "복싱인이 되어가는 사람" 칭호 (cosmetic) | 풀스크린 모달 | "감사합니다" 버튼 |

총 step 수: 5 + 6 + 5 + 6 + 5 + 5 + 7 = **39 step**.

---

## 6. Step 데이터 구조

각 step은 정적 TS 상수 (`src/data/tutorialCampSteps.ts`) 로 정의. DB seed 0.

```ts
interface TutorialCampStep {
  // 식별
  day: number;                 // 1..7
  step: number;                // 해당 day 안 0..N

  // 위치
  route: string;               // "/home" 등. 이 route 가 아니면 진행 차단 + "이 페이지로 이동" CTA
  targetKey: string;           // 영구 식별자 (코드용). e.g. "day1.home_osami_briefing"
  targetSelector: string;      // CSS 셀렉터 (data-tour anchor)
                               // null/빈 문자열이면 화면 가운데 모달만

  // 표시
  title: string;               // 헤더 한 줄
  body: string;                // 본문 1~2 문장
  osamiMessage: string;        // 오삼이 정적 대사 (LLM 호출 0)

  // 동작
  actionType: "read" | "click" | "navigate" | "open" | "complete";
    // read     — body 만 읽고 "확인"으로 통과
    // click    — target 영역 탭 = 다음
    // navigate — required route 로 이동 = 다음
    // open     — 특정 sheet/modal 열렸다가 닫히면 다음 (DOM observer)
    // complete — 페이지 스크롤 끝까지 또는 명시적 행동 = 다음
  requireTargetClick: boolean;
    // true  — target 직접 클릭 강제
    // false — body 만 읽고 "다음" 가능 (부담 적은 step)
  allowNextWithoutClick: boolean;
    // true  — "건너뛰기" 미니 링크 노출 (회원 자율 통과)
    // false — 진짜로 행동해야 통과 (특정 step 만 — 가급적 적게)

  // 모션
  animation:
    | "spotlight"     // target 외부 어둡게
    | "pulse"         // target 둘레 amber 펄스
    | "hand"          // 떠있는 손가락
    | "arrow"         // ↓ 화살표 깡총
    | "bounce"        // 카드 자체 위아래 미세
    | "confetti"      // step 완료 컨페티
    | "celebration";  // Day 7 마지막 — 큰 시퀀스
  placement: "top" | "bottom" | "left" | "right" | "center";
    // 안내 카드(말풍선) 위치 — target 기준 또는 center

  // 폴백 / 완료 문구
  fallbackText: string;        // target 못 찾았을 때 회원에게 보일 문구
  completionText: string;      // step 통과 직후 1~2초 잠깐 노출되는 한 줄
}
```

Day 메타 (Day 단위 진행 + 완료식):

```ts
interface TutorialCampDay {
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  title: string;
  subtitle: string;
  stepKeys: string[];                  // 위 step 의 targetKey 배열
  closingMessage: string;              // "오늘 캠프 끝! 내일 다시 오세요"
  cosmeticReward?: {                   // localStorage cosmetic only — wallet/XP 0
    badgeCode?: string;                // "starter_day1" 등 (표시만)
    titleCode?: string;                // Day 7: "복싱인이 되어가는 사람"
  };
}
```

---

## 7. data-tour target 설계

> **anchor 만 추가. 기존 컴포넌트 props/state/로직 0 변경.**

추가 방식: 기존 `<div>` 또는 카드 wrapper에 `data-tour="..."` 속성 한 줄. JSX 1줄 변경 = 1 anchor.

| 페이지 / 컴포넌트 | anchor | 사용 step |
|---|---|---|
| `OsamiDailyBriefingCard` | `data-tour="osami-daily-briefing"` | 1.1 |
| `TodayQuestMiniPanel` | `data-tour="today-quest"` | 1.2 |
| `BottomNav` 홈 / 훈련 / 단증혜택 / 랭킹 / 랭크업 | `data-tour="nav-home"` 등 5개 | 1.3, 2.1, 2.5, 7.4, 7.5 |
| MasterTrackPage 첫 단계 카드 | `data-tour="master-track-first-stage"` | 2.3 |
| 전체 메뉴 `/minigame` | `data-tour="menu-minigame"` | 3.1 |
| MinigamePage 게임 카드 첫 항목 | `data-tour="minigame-first"` | 3.2 |
| `BoxingIqLeagueCard` | `data-tour="boxing-iq-league"` | 3.3 |
| `FunChallengeCard` | `data-tour="fun-challenge"` | 4.1 |
| `ConditionGaugeCard` | `data-tour="condition-gauge"` | 4.3 |
| `SafetyCheckPanel` | `data-tour="safety-panel"` | 4.4 |
| 전체 메뉴 `/guide` | `data-tour="menu-guide"` | 4.5 |
| `ChampionJournalCard` | `data-tour="champion-journal"` | 5.1 |
| `GrowthReportCard` | `data-tour="growth-report"` | 5.3 |
| 전체 메뉴 `/rewards` | `data-tour="menu-rewards"` | 5.4 |
| `SecondCheerCard` / `CornermanCard` / `ShadowBoxerCard` / `GymRaidCard` | 각 `data-tour="..."` | 6.1~6.4 |
| 전체 메뉴 `/mypage` / `/character-studio` / `/settings` | 각 `data-tour="menu-..."` | 7.1, 7.3, 7.6 |
| MyPage 캐릭터 섹션 | `data-tour="mypage-character"` | 7.2 |

총 **약 25개 anchor**. 각 anchor 추가 = 1 JSX 줄 (`data-tour="..."`).

---

## 8. overlay / spotlight / hand pointer / motion UX

### 8.1 spotlight
- 풀스크린 `<svg>` mask 한 장. target 영역 사각형(8px radius)만 투명.
- 외부 `rgba(0,0,0,0.55)` 오버레이.
- 스크롤되어도 target 위치 추적 (rAF + getBoundingClientRect).
- target 화면 밖 → `scrollIntoView({ block: "center" })` 자동.

### 8.2 pulse ring
- target 외곽 +6px amber `box-shadow` 펄스 (CSS keyframes 1.6s).
- 색: `#fdb85c` (153마인드셋과 톤 통일).

### 8.3 hand pointer
- target 우측 또는 하단에 SVG 손가락 1개.
- 위/아래 4px 떠있기 (1s loop, framer-motion).
- `prefers-reduced-motion` 시 정적 화살표로 대체.

### 8.4 arrow / bounce
- 손가락 대신 ↓ 또는 ← 화살표.
- bounce는 카드 자체가 미세하게 위아래 (회원 시선 유도).
- hand 와 arrow / bounce 는 동시 적용 안 함 (택1).

### 8.5 step 전환
- 0.25s fade in/out. 옵션으로 slide(20px).
- AnimatePresence + framer-motion variants.

### 8.6 confetti / celebration
- `canvas-confetti` (이미 의존성에 포함 — 새 패키지 0).
- step 단위 confetti는 Day 마지막 step만.
- Day 7 마지막은 큰 시퀀스 (3회 발사 + 오삼이 절 + 칭호 페이드).

### 8.7 reduced motion
- `window.matchMedia("(prefers-reduced-motion: reduce)").matches` 시:
  - hand / arrow / bounce 비활성
  - confetti는 정적 텍스트 "🎉 완료!" 로 대체
  - spotlight + pulse는 유지 (가독성용)

### 8.8 톤
- 미완료 시: "괜찮아요, 천천히 해도 돼요." / "다음에 다시 도와드릴게요."
- "실패", "놓침", "다시 해야 함" 등 강요 단어 0.

---

## 9. target click required 설계

step 의 `requireTargetClick` 와 `allowNextWithoutClick` 조합:

| requireTargetClick | allowNextWithoutClick | 동작 | 사용 시나리오 |
|---|---|---|---|
| true | false | target 직접 클릭만 통과 | 핵심 행동 학습 (예: 1.3 홈 아이콘) |
| true | true | target 클릭 권장, "건너뛰기" 옵션 | 대부분 step (회원 자율) |
| false | true | body 읽고 "다음" 통과 | 정보성 step (예: 4.4 안전 안내) |
| false | false | 시간 기반 자동 통과 (3초 read) | Day 마무리 모달 |

**권장 비율**: 39 step 중 약 60%는 `true/true` (자율), 30%는 `false/true` (정보), 10% 만 `true/false` (강제).

---

## 10. target missing fallback 설계

### 10.1 target 발견 실패 시 흐름
1. 마운트 후 200ms 동안 selector 매칭 시도 (rAF + retry).
2. 그래도 못 찾으면 **fallback 모드** 진입:
   - `targetSelector` 지운 채 화면 중앙 모달만 표시.
   - 본문에 step 의 `fallbackText` 추가 노출 — "이 영역은 다음 화면 업데이트에 추가됩니다."
   - 회원에게 "건너뛰기" CTA 항상 노출.
3. events 로그에 `fallback_skip` 기록.
4. dev 콘솔에 `[tutorial-camp] target "xxx" not found in route "/yyy"` warn 1회.

### 10.2 운영 측 점검 도구
개발자 preview 모드 안에 "target 검증" 버튼 — 모든 step 의 `targetSelector` 를 현재 라우트에서 1회씩 검사 + 결과 콘솔 출력.

### 10.3 fallback 유형
- `skip_silently` (기본) — fallback 모달 + 자동 다음
- `block_with_cta` — fallback 모달 + 회원이 직접 닫아야 다음
- `abort_day` — Day 자체 일시중단 + 회원에게 안내

대부분 step 은 `skip_silently`. 핵심 step (Day 7 완료식) 만 `block_with_cta`.

---

## 11. 개발자 로컬 preview 기능 설계

### 11.1 활성 방법 (회원 노출 0)
1. URL 쿼리 `?camp=dev` (1회 방문 시 localStorage `myboxer.tutorialCamp.v1.devPreview.enabled = true`)
2. 콘솔 명령:
   ```js
   window.__myboxer_camp.preview({ forceDay: 3, forceStepIndex: 2 });
   window.__myboxer_camp.reset();
   window.__myboxer_camp.list();    // 모든 step 목록
   window.__myboxer_camp.events();  // 최근 이벤트 로그
   ```
3. super_admin role 일 때만 콘솔 노출 (선택 — 보수적으로는 항상 미노출, dev 빌드만)

### 11.2 가능한 동작
- 임의 day/step 점프
- 24h cooldown 무시
- route mismatch 무시 (다른 라우트에서도 현 step overlay 강제 표시)
- 진행 0 으로 reset
- 강제 완료 처리 (Day 7 완료식 미리 보기)

### 11.3 일반 회원 노출 차단
- UI 어디에도 토글 버튼 0
- `?camp=dev` 진입했어도 `process.env.NODE_ENV !== "production"` 또는 super_admin role 만 활성
- 활성 시 화면 우상단에 작은 "DEV PREVIEW" 배지 표시 (실수 방지)

---

## 12. 스킵 / 재개 / 다시 보기 정책

### 12.1 스킵
- 회원이 어느 step 에서든 "건너뛰기" 버튼 → 3 옵션:
  1. 이 step 만 건너뛰기
  2. 오늘 Day 전체 건너뛰기
  3. 캠프 자체 끝내기 (status = "skipped")
- 부드러운 문구: "괜찮아요. 다음에 다시 시작할 수 있어요."
- 보상 0 (캠프 보상 자체가 cosmetic 이라 부담 0).

### 12.2 재개
- MyPage "캠프 다시 시작" 카드 항상 노출 (skipped/completed 모두).
- 재개 시 마지막 미완료 day×step 부터 (`currentDay` / `currentStepIndex` 보존).
- 이미 completed 된 day 는 보너스 confetti 없음 (멱등성).

### 12.3 다시 보기
- completed 회원: "Day 1 부터 다시 보기" / "특정 Day 만 다시 보기" 옵션.
- 다시 보기 시 새 진행 상태 만들지 않고 read-only 모드 (events 로그 0).
- 회원이 익히 알고 있는 영역 빠르게 스킵 가능.

### 12.4 하루 1 Day 제한
- 기본: 이전 Day finished_at 기준 24h cooldown.
- 회원 토글 "한 번에 끝까지 해보기" → cooldown 해제 (cosmetic 차이 0).

### 12.5 며칠 비움
- `lastActiveAt` 7일 초과 → 홈 카드 문구 부드럽게 변경: "오삼이가 기다리고 있어요". 페널티 0.

---

## 13. Day 7 완료식

7.7 마지막 step. 풀스크린 모달.

### 13.1 시퀀스 (총 6~8초)
1. 0.0s: 검은 페이드 인 (0.3s)
2. 0.3s: 오삼이 SVG 등장 (천천히 fade + 위에서 내려옴)
3. 0.8s: 오삼이 절 모션 (head down → up, framer-motion)
4. 1.5s: "복싱인이 되어가는 사람" 칭호 텍스트 페이드 (amber 글로우)
5. 2.0s: 첫 번째 confetti 발사 (amber + yellow + rose)
6. 3.0s: 두 번째 confetti 발사
7. 4.0s: 세 번째 confetti 발사 + 작은 종소리 시각 효과 (✦ 별 3개)
8. 5.0s: 본문 — "7일 동안 153복싱짐과 함께 와줘서 고맙습니다."
9. 6.0s: "감사합니다" CTA 활성

### 13.2 보상 (cosmetic only, wallet/XP 0)
- localStorage 기록: `state.completedAt = ISO`, `state.status = "completed"`
- cosmetic badge `starter_day1`..`starter_day7` 7개 누적 (마이페이지에 표시 가능, 후속 단계)
- cosmetic title `"복싱인이 되어가는 사람"` (마이페이지 칭호 영역에 표시 가능, 후속 단계)
- **공식 XP / 레벨 / 단증 / 출석 / wallet 0건 변동**

### 13.3 이후
- 홈 카드 사라짐.
- MyPage 에 "다시 보기" 카드만 남음.
- 캠프 events 로그는 그대로 (조회만 가능).

---

## 14. 홈 고객경험 개선 방향

### 14.1 캠프 활성 회원 (status="active")
- 홈 최상단(`OsamiDailyBriefingCard` 위 또는 옆) 에 작은 카드:
  ```
  [오삼이 SVG sm] 오삼이와 함께하는 7일 입문 캠프
                Day 3 / 7 · 다음 단계: "153 QUEST 살펴보기"
                [계속하기 →]
  ```
- 카드 크기 작게 (max-h ~80px), 기존 홈 영역 시각적 침범 0.
- 24h cooldown 안 끝났으면 "오늘 캠프 끝! 내일 다시 오세요" 톤으로 변경.

### 14.2 캠프 미시작 회원 (status="pending")
- 가입 후 첫 홈 진입 시 위 카드가 "Day 1 시작하기" 형태로 노출.
- 회원이 명시적으로 카드 탭으로 시작 (자동 진입 X).

### 14.3 캠프 완료 / 스킵 회원
- 카드 미노출. 홈 본래 모습 유지.
- MyPage 에 "다시 보기" 카드만.

### 14.4 시각화 / 컴포넌트 침범 0
- HomePage 의 기존 컴포넌트 props/state/로직 0 변경.
- 신규 카드는 별도 컴포넌트 (`StarterCampHomeCard`) — HomePage 안에 1줄 import + JSX 1줄 추가.

---

## 15. 운동 후 30초 마무리 연출 방향

### 15.1 목적
회원이 훈련 후 화면을 바로 닫지 않고 30초 동안 마음 정돈하는 마이크로 의식. 153마인드셋의 짧은 호흡 같은 느낌이지만 캠프 진행 중인 회원에게만 선택적으로.

### 15.2 트리거
- MissionsPage / MasterTrackPage 에서 영상 시청 완료 직후 (기존 mission 제출/공식 흐름 0 변경)
- 또는 `/myboxer/visualization` 153마인드셋 세션 직후
- 캠프 활성 회원 + Day 1~6 진행 중일 때만 (Day 7 완료 후 비활성)

### 15.3 30초 시퀀스
1. 0~5s: "오늘도 153복싱짐에 와줘서 고맙습니다."
2. 5~15s: 호흡 1회 가이드 (들이쉬기 4 / 멈춤 2 / 내쉬기 6)
3. 15~25s: "오늘의 한 줄을 챔피언 일기에 남길까요?" 옵션 카드 (탭 시 `/champion-journal` 또는 `ChampionJournalSheet` 열기)
4. 25~30s: 자동 fade out

### 15.4 회원 권한
- 항상 X 버튼으로 즉시 닫기 가능
- localStorage `myboxer.tutorialCamp.v1.state.afterTrainingShownDates` (배열, 날짜 기준 중복 방지)
- 하루 1회만 노출. 회원이 닫아도 카운트.

### 15.5 표현
- "수고하셨습니다 / 오늘도 좋은 훈련이었습니다 / 153복싱짐에 와줘서 고맙습니다."
- 게임 / 경쟁 / 압박 단어 0.

### 15.6 153마인드셋과의 관계
- 30초 마무리 연출은 **캠프 전용**이고, 153마인드셋은 **본격 3분 시각화**.
- 둘은 별개 컴포넌트, localStorage 키, 흐름.
- 30초 끝에서 "더 깊게 — 153마인드셋 3분" CTA로 자연스럽게 연결 가능.

---

## 16. 표현 금지어 가이드

### 16.1 절대 사용 금지 (회원 노출 텍스트)
- 링 / 체육관 / 복싱장 / gym / Gym / GYM
- RPG / 몬스터 / 전투 / 보스 / 판타지 / 레벨업 / monster / battle / fantasy
- "실패", "놓침", "탈락", "벌점" 등 부정 단어
- "퀘스트 클리어", "보스 처치", "점수 +N" 등 게임 잔재

### 16.2 통일 표현
- 장소: **153복싱짐** (오직 이것)
- 회원 호칭: "당신" 또는 "회원님" (혼용 금지 — Day 안에서는 한 가지로 통일)
- 행동: "오늘도 153복싱짐으로 돌아왔다" 톤 (시각화 세션과 톤 일치)
- 칭호: "복싱인이 되어가는 사람" / "오늘도 돌아온 사람"

### 16.3 자동 검증 (QA grep)
```
grep -R "링|체육관|복싱장|gym|Gym|GYM|RPG|몬스터|전투|보스|판타지|레벨업" \
  src/components/tutorial-camp src/data/tutorialCampSteps.ts \
  src/features/tutorial-camp
→ 0 hit 기대
```

### 16.4 153마인드셋 톤과의 정렬
[src/features/myboxer-visualization/visualizationContent.ts](../src/features/myboxer-visualization/visualizationContent.ts) 의 mood/mindset/promise 옵션과 톤 통일. 회원이 캠프 → 153마인드셋 진입했을 때 동일한 화자(오삼이) 와 동일한 톤이 이어지도록.

---

## 17. QA 체크리스트

### 17.1 빌드 / 타입
- [ ] `npx tsc --noEmit` EXIT=0
- [ ] `bun run build` "✓ built" 확인
- [ ] 새 npm 패키지 0 (`git diff package.json bun.lockb` 변경 0)
- [ ] 새 마이그레이션 0 (`supabase/migrations/` 변경 0)

### 17.2 보호 영역 변경 0
- [ ] `levels` / `missions` / `mission_videos` / `mission_submissions` / `member_progress` 0 변경
- [ ] `MissionsPage.tsx` / `RankUpPage.tsx` 공식 훈련 로직 0 변경 (data-tour anchor 1줄 추가만 허용)
- [ ] `ChatAssistant.tsx` / `supabase/functions/chat-assistant/**` 0 byte 변경
- [ ] `useWallet.ts` / `challengeService.ts` / `allLevelsData.ts` / `whiteLevel1Data.ts` 0 byte 변경
- [ ] `BottomNav.tsx` 0 byte 변경
- [ ] `src/integrations/supabase/types.ts` 0 변경
- [ ] `src/features/myboxer-visualization/**` 0 변경 (153마인드셋 보존)

### 17.3 localStorage 정책
- [ ] 신규 키 prefix `myboxer.tutorialCamp.v1.*` 만 사용
- [ ] 기존 `myboxer.visualization.records` 키 0 변경
- [ ] try/catch + 기본값 폴백 + QuotaExceeded 안전망 모든 read/write에 적용

### 17.4 캠프 흐름
- [ ] 신규 회원 첫 홈 진입 시 Day 1 카드 표시
- [ ] Day 1 → Day 2 cooldown (24h) 정상 동작
- [ ] "한 번에 끝까지 해보기" 토글 시 cooldown 해제
- [ ] target 셀렉터 25개 모두 매칭 (fallback 0)
- [ ] target 매칭 실패 시 fallback 모달 + 다음 step 자동
- [ ] 페이지 새로고침 후 같은 step 으로 복귀
- [ ] 스킵 후 MyPage 에서 재시작 가능
- [ ] Day 7 마지막 step → 완료식 시퀀스 + 칭호 cosmetic 저장

### 17.5 표현
- [ ] grep "링|체육관|복싱장|gym|RPG|몬스터|전투|보스" → 0 hit (캠프 영역 + 본 단계에서 추가한 anchor 영역)
- [ ] 모든 장소 "153복싱짐"
- [ ] 강요/실패/벌점 단어 0
- [ ] 153마인드셋과 톤 정렬

### 17.6 모바일 / 접근성
- [ ] 375 × 667 (iPhone SE) 에서 spotlight 정확히 target 위
- [ ] target 화면 밖일 때 자동 scrollIntoView
- [ ] `prefers-reduced-motion` 시 hand/arrow/bounce/confetti 비활성
- [ ] 스크린리더 — overlay 마운트 시 focus 이동, 닫을 때 복원

### 17.7 153마인드셋 호환성
- [ ] `/myboxer/visualization` 직접 접근 시 캠프 overlay 0 (153마인드셋 단독)
- [ ] `myboxer.visualization.records` 키 형태 0 변경
- [ ] session id `myboxer-153-returned-person` / `myboxer-153-one-year-later` 0 변경
- [ ] 153마인드셋 7-step 흐름 0 변경

### 17.8 개발자 preview
- [ ] 일반 회원이 콘솔 명령 사용 시 noop
- [ ] super_admin / dev 빌드만 활성
- [ ] 활성 시 "DEV PREVIEW" 배지 노출

---

## 부록 A. 본 문서가 참조한 핵심 코드 위치

| 파일 | 본 설계에서의 역할 |
|---|---|
| [src/App.tsx](../src/App.tsx) | overlay 마운트 위치 / splashDone 게이트 |
| [src/components/BottomNav.tsx](../src/components/BottomNav.tsx) | **0 변경**. data-tour anchor 1~5줄 추가만 |
| [src/components/engagement/](../src/components/engagement/) | 25개 anchor 후보 대부분 여기 |
| [src/components/tutorial/TutorialFloatingMascot.tsx](../src/components/tutorial/TutorialFloatingMascot.tsx) | 기존 5미션 마스코트 — 캠프 활성 동안 비활성 처리 (충돌 방지) |
| [src/features/myboxer-visualization/](../src/features/myboxer-visualization/) | 153마인드셋 — 0 변경 영역 |
| [docs/myboxer-coding-handoff.pdf](myboxer-coding-handoff.pdf) | 핸드오프 문서 — 보호 영역 / 톤 / 라우트 표 |

---

## 부록 B. 구현 단계 (42 ~ 48)

> 각 단계는 작은 분량으로 끊어서 commit/push. 전체 한 번에 풀 구현 X.

### 단계 42 — 정적 데이터 + 타입 + localStorage hook
- 신규 파일:
  - `src/features/tutorial-camp/types.ts`
  - `src/features/tutorial-camp/tutorialCampSteps.ts` (39 step 정적 상수)
  - `src/features/tutorial-camp/tutorialCampDays.ts` (Day 메타 7개)
  - `src/features/tutorial-camp/useTutorialCampState.ts`
  - `src/features/tutorial-camp/useTutorialCampActions.ts`
- 변경 0: 다른 파일 0 byte
- 검증: tsc / build / grep

### 단계 43 — overlay leaf 컴포넌트 (모션 단위)
- 신규 파일:
  - `src/features/tutorial-camp/CampSpotlight.tsx`
  - `src/features/tutorial-camp/CampPointer.tsx` (hand / arrow)
  - `src/features/tutorial-camp/CampPulseRing.tsx`
  - `src/features/tutorial-camp/CampOsamiBubble.tsx` (정적 대사)
  - `src/features/tutorial-camp/useTargetRect.ts` (rAF 기반)
  - `src/features/tutorial-camp/useReducedMotion.ts`

### 단계 44 — overlay 합성 + 진입 카드
- 신규 파일:
  - `src/features/tutorial-camp/TutorialCampOverlay.tsx` (전체 합성)
  - `src/features/tutorial-camp/StarterCampHomeCard.tsx` (홈 진입 카드)
  - `src/features/tutorial-camp/StarterCampMyPageCard.tsx`
- App.tsx에 overlay 1줄 mount (splashDone 게이트)
- HomePage / MyPage 에 카드 1줄씩 import + JSX 1줄 추가

### 단계 45 — Day 7 완료식 + 칭호 cosmetic
- 신규 파일:
  - `src/features/tutorial-camp/Day7CelebrationModal.tsx`
  - `src/features/tutorial-camp/StarterCampBadge.tsx` (cosmetic 표시)
- canvas-confetti 활용 (이미 의존성)

### 단계 46 — data-tour anchor 25개 추가
- 기존 파일에 `data-tour="..."` 1줄씩만 추가:
  - HomePage / MissionsPage / MyPage / engagement/* / BottomNav 등
- 기존 props/state/로직 0 변경
- target 검증: 모든 selector 매칭 확인

### 단계 47 — 30초 마무리 연출 + 기존 5미션 마스코트 비활성
- 신규 파일:
  - `src/features/tutorial-camp/AfterTraining30sCard.tsx`
- 기존 `TutorialFloatingMascot` — 캠프 활성 동안 hide (state 공유 또는 wrapper 1줄)
- 153마인드셋 종료 후 30초 카드 옵션 노출

### 단계 48 — 개발자 preview + QA + 핸드오프 PDF 갱신
- 신규 파일:
  - `src/features/tutorial-camp/devPreview.ts`
- `?camp=dev` 쿼리 + super_admin 가드
- 17.x QA 체크리스트 100% 통과
- `docs/myboxer-coding-handoff.pdf` 갱신 (캠프 영역 추가)

---

**문서 끝.** 본 명세 외 코드 변경 0건. 다음 단계(42)부터 본 명세를 단계 단위로 구현.
