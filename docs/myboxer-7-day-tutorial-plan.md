# 마이복서153 7일 스타터 캠프 구현 계획 (단계 41 — 설계 문서)

> **본 문서는 설계 명세이며 코드/DB/RPC/컴포넌트 구현을 포함하지 않는다.**
> 다음 단계(42)에서 본 명세를 기반으로 마이그레이션과 컴포넌트를 만든다.

---

## 1. 기능 목적

신규 회원이 가입 직후 7일 동안 **하루 한 영역씩** 마이복서153 앱의 핵심 기능을 손으로 직접 만져보며 익히게 한다. 단순 안내 텍스트가 아니라 **실제 화면 요소를 하이라이트** 하고, 사용자가 그 영역을 직접 탭/이동/완료해야 다음으로 넘어가는 **행동 기반 온보딩**.

도달 목표(7일 끝):
- BottomNav의 5개 주요 탭 + 전체 메뉴를 모두 한 번 이상 방문해 본 적 있음
- 마스터로드(공식 훈련) / 153 QUEST / 복싱 IQ / 챌린지 아레나 / 챔피언 일기 / 세컨드 응원 / 복싱 전당이 무엇인지 한 줄로 설명 가능
- 통증 체크/안전 가이드의 존재를 인지함
- 첫 7일 끝나면 회원이 "이 앱은 어떻게 쓰는 거지" 라는 질문을 더 이상 하지 않는 상태로 만든다

비목표 (이번에 하지 않는 것):
- 공식 훈련/레벨/승급 시스템 보강
- 마스터로드 콘텐츠 확장
- 새 BottomNav 항목 추가
- ChatAssistant LLM 응답 개선

---

## 2. 기존 시스템 보호 원칙

| 영역 | 정책 |
|---|---|
| `levels` / `missions` / `mission_videos` / `mission_submissions` / `member_progress` | **테이블/컬럼 미수정.** 7일 캠프 진행 상태는 별도 테이블 또는 별도 컬럼만 사용. |
| `approve_mission_submission` / `record_attendance` | **호출 금지.** 7일 캠프는 출석/제출 기록을 만들지 않는다. |
| `useManualLevelUp` / `usePassBossBattle` | **호출 금지.** 캠프 완료가 공식 레벨/승급에 영향 0. |
| `MissionsPage` 공식 훈련 로직 / `RankUpPage` 랭크업 로직 | **로직 미수정.** 추가는 페이지 안에 비침투형 anchor div(`data-tour="..."`)만. |
| `ChatAssistant` / `supabase/functions/chat-assistant` / `systemPrompt153` | **0 byte 변경.** 오삼이 튜토리얼 대사는 정적 메시지 상수로만. |
| `/challenges` 21일 챌린지 / `challengeService` / `useWallet` | **호출 금지.** 21일 챌린지와 7일 캠프는 별개 시스템. |
| `allLevelsData` / `whiteLevel1Data` / `sharedConstants` 공식 훈련 데이터 | **참조만, 수정 0.** |
| 파이트 머니 (`real_gems`) | **wallet 직접 update 금지.** 캠프 보상 지급은 `grant_gems` RPC 경유만 허용. |
| 공식 XP | **미지급.** 캠프 보상은 quest XP / 파이트 머니 소량 / 배지로 한정. |

---

## 3. 현재 메뉴 유지 원칙

[BottomNav.tsx](../src/components/BottomNav.tsx) 의 메인 5탭(`/home`, `/missions`, `/cert-benefits`, `/halloffame`, `/rank-up`) + 전체 메뉴 12~13개 항목은 **수정 0건**.

7일 캠프의 진입점은 BottomNav가 아니라:
1. **홈 상단의 작은 진행 카드** (`<HomePage>` 안에 비침투형 카드 추가) — 신규 회원 1~7일 차에만 노출.
2. **MyPage 안의 작은 카드** (선택 사항, "튜토리얼 다시 보기" 진입점).
3. **글로벌 floating coach bubble** — 기존 `TutorialFloatingMascot` 와 다른 영역에 위치, z-index 분리.

→ **새 라우트 `/starter-camp` 1개만 추가**. BottomNav에는 노출하지 않음 (홈 카드/마이페이지에서 진입).

---

## 4. 7일 튜토리얼 전체 흐름

```
회원가입 + 지점 승인 완료
        │
        ▼
첫 로그인 → 홈 진입
        │
        ▼
홈 상단에 "스타터 캠프 Day 1" 카드 표시 ◀── 자동 시작 X, 사용자가 카드 탭으로 시작
        │
        ▼
   ┌────────────────────────────────────┐
   │ Day 1: 홈 / 오늘의 라운드 / 오삼이      │
   │ Day 2: 마스터로드 / 공식 훈련         │
   │ Day 3: 153 QUEST / 복싱 IQ          │
   │ Day 4: 챌린지 아레나 / 통증 체크       │
   │ Day 5: 챔피언 일기 / 나의 기록        │
   │ Day 6: 세컨드 응원 / 커뮤니티         │
   │ Day 7: 마이페이지 / 복싱 전당 / 수여식  │
   └────────────────────────────────────┘
        │
        ▼
Day N 마지막 step 완료 → "오늘 캠프 끝! 내일 다시 오세요" 메시지
                                     │
                                     ▼
                          다음 날(자정 이후) 홈 진입 → Day N+1 카드 활성
        │
        ▼
Day 7 모든 step 완료 → 작은 수여식 (confetti + 마스코트 절 + 종료 배지)
        │
        ▼
스타터 캠프 영구 완료 (홈 카드 사라짐, MyPage 에 "Day 1~7 다시 보기" 만 남음)
```

핵심 시간 규칙:
- **하루 1 Day가 원칙**. Day N 완료 후 같은 날에는 Day N+1 진입 불가 (다음날 자정 이후 활성).
- 단, **회원이 명시적으로 "한 번에 끝까지 해보기" 선택** 시 연속 진행 허용 (스킵 정책 §13 참조).
- 회원이 며칠 비워도 진행 상태는 보존되며, 돌아오면 마지막 미완료 Day 부터 재개.

---

## 5. Day별 교육 목표 (4~7 step / Day)

### Day 1 — 홈 / 오늘의 라운드 / 오삼이 소개 (5 step)
| # | 교육 목표 | 화면 | 사용자 행동 |
|---|---|---|---|
| 1.1 | 오삼이가 매일 메시지를 준다는 것 | `OsamiDailyBriefingCard` (HomePage 상단) | "오늘의 메시지 보기" 탭 |
| 1.2 | 오늘의 퀘스트 위치 인지 | `TodayQuestMiniPanel` | 카드 영역 한 번 탭 |
| 1.3 | 홈에서 시작하는 것이 정상이다 | BottomNav `/home` 아이콘 | 홈 아이콘 탭 (이미 홈이라 highlight) |
| 1.4 | 153이 무엇인지 알 권리 | "153이란?" 메뉴 항목 → `/about/153` | 페이지 1번 방문 |
| 1.5 | Day 1 완료 (작은 confetti) | 모달 | "내일 다시 오세요" 닫기 |

### Day 2 — 마스터로드 / 공식 훈련 확인 (6 step)
| # | 교육 목표 | 화면 | 사용자 행동 |
|---|---|---|---|
| 2.1 | 메인 훈련 탭 위치 | BottomNav 훈련 (글러브 아이콘) | 탭 클릭 → `/missions` |
| 2.2 | 마스터로드의 의미 (공식 훈련 트랙) | `/master-track` 진입 카드 | "마스터 로드 보기" 탭 |
| 2.3 | 단증/단계 구조 | `MasterTrackPage` 단계 카드 | 첫 단계 카드 탭 (정보만 — 제출 X) |
| 2.4 | 영상 시청 vs 제출의 차이 | 공식 훈련 영상 안내 영역 | 정보 카드 닫기 |
| 2.5 | 단증혜택 메뉴 인지 | BottomNav `/cert-benefits` | 페이지 1번 방문 |
| 2.6 | Day 2 완료 | 모달 | 닫기 |

### Day 3 — 153 QUEST / 복싱 IQ (5 step)
| # | 교육 목표 | 화면 | 사용자 행동 |
|---|---|---|---|
| 3.1 | "복싱 트레이닝" = 153 QUEST 미니게임 | 전체 메뉴 → `/minigame` | 메뉴 항목 탭 |
| 3.2 | 미니게임 종류 인지 | `MinigamePage` 미니게임 리스트 | 한 게임 카드 탭 (정보만) |
| 3.3 | 복싱 IQ 리그 위치 (홈) | `BoxingIqLeagueCard` | 카드 영역 탭 |
| 3.4 | 퀴즈는 안전 / 부담 없음 | `BoxingAcademyQuizModal` 안내 | 모달 1회 열어 보고 닫기 |
| 3.5 | Day 3 완료 | 모달 | 닫기 |

### Day 4 — 챌린지 아레나 / 통증 체크 / 안전 (6 step)
| # | 교육 목표 | 화면 | 사용자 행동 |
|---|---|---|---|
| 4.1 | 챌린지 아레나 = 재미 챌린지 | `FunChallengeCard` (홈 engagement) | 카드 탭 → 아레나 sheet 열기 |
| 4.2 | 챌린지 아레나는 21일 챌린지와 별개 | sheet 안 안내 영역 | 안내 1회 읽고 닫기 |
| 4.3 | 통증 체크의 중요성 | `ConditionGaugeCard` | 카드 탭 → 게이지 sheet 열기 |
| 4.4 | 부상 시 코치/관장에게 알려야 함 | `SafetyCheckPanel` | 안내 1회 읽기 |
| 4.5 | 가이드 메뉴 안에 안전 가이드 있음 | `/guide/safety` 페이지 | 1회 방문 |
| 4.6 | Day 4 완료 | 모달 | 닫기 |

### Day 5 — 챔피언 일기 / 나의 기록 (5 step)
| # | 교육 목표 | 화면 | 사용자 행동 |
|---|---|---|---|
| 5.1 | 챔피언 일기 = 매일 한 줄 기록 | `ChampionJournalCard` | 카드 탭 |
| 5.2 | 일기는 본인만 볼 수 있음 (안심) | `ChampionJournalSheet` 안내 | 안내 1회 읽기 |
| 5.3 | 성장 리포트 위치 | `GrowthReportCard` | 카드 탭 |
| 5.4 | 보상 메뉴 = 모은 파이트 머니 사용처 | 전체 메뉴 → `/rewards` | 1회 방문 |
| 5.5 | Day 5 완료 | 모달 | 닫기 |

### Day 6 — 세컨드 응원 / 커뮤니티 (5 step)
| # | 교육 목표 | 화면 | 사용자 행동 |
|---|---|---|---|
| 6.1 | 세컨드 = 다른 회원을 응원하는 시스템 | `SecondCheerCard` | 카드 탭 → cheer sheet |
| 6.2 | 코너맨 후보 = 함께 훈련할 사람 | `CornermanCard` | 카드 탭 |
| 6.3 | 그림자 복서 = 자기 기록과의 비교 | `ShadowBoxerCard` | 카드 탭 |
| 6.4 | 지점 레이드 = 지점 단합 이벤트 | `GymRaidCard` | 카드 탭 |
| 6.5 | Day 6 완료 | 모달 | 닫기 |

### Day 7 — 마이페이지 / 복싱 전당 / 성장 리포트 / 수여식 (7 step)
| # | 교육 목표 | 화면 | 사용자 행동 |
|---|---|---|---|
| 7.1 | 내정보 메뉴 위치 | 전체 메뉴 → `/mypage` | 1회 방문 |
| 7.2 | 마이페이지 안 캐릭터 / 단증 / 통계 | `MyPage` 섹션들 | 스크롤 끝까지 |
| 7.3 | 캐릭터 스튜디오 = 외형 커스터마이즈 | `/character-studio` | 1회 방문 |
| 7.4 | 복싱 전당 (HoF) = 우수 회원 명예 | `/halloffame` | 1회 방문 |
| 7.5 | 랭크업 페이지 = 로드맵 + 가치맵 | `/rank-up` | 1회 방문 |
| 7.6 | 설정 메뉴 (알림 / 로그아웃) 위치 | `/settings` | 1회 방문 |
| 7.7 | **수여식** — confetti + 오삼이 절 + "스타터 캠프 수료" 배지 | 풀스크린 모달 | "감사합니다" 버튼 |

총 step 수: 5 + 6 + 5 + 6 + 5 + 5 + 7 = **39 step**.

---

## 6. Step 데이터 구조

각 step은 정적 TS 상수 (`src/data/starterCampSteps.ts`) 로 정의. DB seed 불필요.

```ts
type StarterCampStep = {
  // 식별
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  step_index: number;          // day 안 0..N
  step_code: string;            // "day1.osami_briefing" 등 영구 식별자

  // 표시
  title: string;                // 헤더 한 줄
  body: string;                 // 본문 1~2 문장
  osami_line: string;           // 오삼이 정적 대사 (LLM 호출 X)

  // 타깃팅
  target_selector: string | null;
    // CSS 셀렉터 (ex. `[data-tour="osami-daily"]`).
    // null 이면 화면 가운데 모달만 띄움 (스포트라이트 X).
  required_route: string | null;
    // 이 route 가 아니면 "이 페이지로 이동" CTA 만 보이고 진행 차단.
    // null = 어디서든 진행 가능.

  // 사용자 행동
  action_type:
    | "tap_target"        // target 영역 탭하면 자동 다음
    | "visit_route"       // required_route 에 1회 방문 = 다음
    | "click_cta"         // 모달의 "확인" CTA 누르면 다음
    | "open_sheet"        // 특정 sheet/modal 열렸다가 닫히면 다음 (DOM observer)
    | "scroll_to_end";    // 페이지 스크롤 끝까지 = 다음
  required_click: boolean;
    // true: 사용자가 직접 누르거나 방문해야 함
    // false: body 만 읽고 "확인" 으로 통과 가능 (Day 1.1 처럼 부담 적은 step)

  // 완료 판정
  completion_condition:
    | { kind: "click"; selector: string }
    | { kind: "route_visited"; path: string }
    | { kind: "sheet_dismissed"; sheet_id: string }
    | { kind: "scroll_end" }
    | { kind: "manual_confirm" };

  // 모션
  animation: {
    spotlight: boolean;           // target 외부 어둡게
    pulsing_ring: boolean;        // target 둘레 amber 펄스
    floating_pointer: boolean;    // 손가락/화살표 떠있음
    arrow_bounce: boolean;        // 위에서 화살표 ↓ 깡총
    transition: "fade" | "slide" | "none";
    completion_confetti: boolean; // step 완료 시 컨페티 (Day 마지막 step만 true)
  };

  // 폴백
  fallback_behavior:
    | "skip_silently"   // target 셀렉터 매칭 실패 시 step 자동 스킵 + 로그
    | "block_with_cta"  // 매칭 실패해도 모달은 띄우고 CTA "건너뛰기" 제공
    | "abort_day";      // 이 step 실패 시 Day 자체 일시중단 → 사용자에게 안내
  reduced_motion_variant?: {
    // 브라우저 prefers-reduced-motion: reduce 일 때
    spotlight: boolean;
    pulsing_ring: boolean;
    floating_pointer: false;      // 강제 false
    arrow_bounce: false;          // 강제 false
    transition: "fade";
    completion_confetti: false;
  };
};
```

Day 메타 (Day 단위 보상/완료 메시지):

```ts
type StarterCampDay = {
  day: 1..7;
  title: string;
  subtitle: string;
  step_codes: string[];
  reward: {
    quest_xp?: number;        // 5~20
    fight_money?: number;     // 0~50 (RPC grant_gems 경유)
    badge_code?: string;      // 'starter_day1' 등 — 표시만, 공식 단증 X
  };
  closing_message: string;    // "오늘 캠프 끝! 내일 다시 오세요"
};
```

---

## 7. 하이라이트 / 모션 / 클릭 유도 UX

### 7.1 스포트라이트
- 풀스크린 `<svg>` mask 한 장. target 영역 사각형(8px radius)만 투명, 나머지 `rgba(0,0,0,0.55)`.
- 스크롤되어도 target 위치 추적 (rAF + getBoundingClientRect).
- target 가려지면 `scrollIntoView({ block: "center" })` 자동 호출.

### 7.2 펄스 링
- target 외곽 +6px amber `box-shadow` 펄스 (CSS keyframes, 1.6s).
- pulse 색은 spec amber `#fdb85c` (스토리 RPG 와 톤 통일).

### 7.3 떠있는 손가락 포인터
- target 우측 또는 하단에 SVG 손가락 1개. 위/아래 4px 떠있기 (1s loop, framer-motion).
- 모션 reduced 시 정적 화살표로 대체.

### 7.4 화살표 바운스
- 손가락 대신 ↓ 또는 ← 화살표. floating_pointer 와 동시에 켜지지 않음 (둘 중 하나).

### 7.5 step 전환
- 다음 step 진입 시 0.25s fade in / out. slide(20px) 옵션도 step 메타로 선택 가능.

### 7.6 step / Day 완료 컨페티
- `canvas-confetti` (이미 의존성에 포함됨 — 신규 패키지 X).
- step 단위 컨페티는 Day 마지막 step만. Day 7 마지막은 더 큰 시퀀스 (3회 발사).

### 7.7 reduced motion
- `window.matchMedia("(prefers-reduced-motion: reduce)").matches` 시 모든 모션 제거.
- 컨페티는 정적 텍스트 "🎉 완료!" 로 대체.

### 7.8 부드러운 톤
- 미완료 시 메시지: "괜찮아요, 천천히 해도 돼요." / "다음에 다시 도와드릴게요."
- 강요/실패 단어 금지 ("실패", "놓침", "다시 해야 함" 등).

---

## 8. 개발자 / 관리자 수동 체험 기능

### 8.1 권한
- `super_admin` 전용. `/admin/starter-camp-debug` 또는 `SuperAdminDashboard` 안 패널.
- 일반 회원/코치/지점장에게는 라우트/UI 자체가 노출되지 않음.

### 8.2 가능한 동작
| 동작 | 설명 |
|---|---|
| 조회 | 특정 user_id 의 현재 day / step / 시작/완료 일시 |
| 초기화 | 진행 0 으로 (Day 1.1 부터 다시) |
| 점프 | 임의 day×step 으로 이동 |
| 완료 처리 | 영구 완료 마크 (수여식 보상 지급은 1회만) |
| 비활성화 | 회원이 캠프 자체를 보지 않게 (skipped 상태) |

### 8.3 권한 검증 — 클라이언트만 믿지 않음
- 모든 admin 작업은 RPC 경유.
- RPC 내부 첫 줄에 `IF NOT public.has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'forbidden'; END IF;`.
- 민감 정보(전화번호 / 이메일 등)는 응답에 포함하지 않음 — `user_id` + 캠프 진행 상태만.

### 8.4 감사 로그
- `boxing_starter_camp_admin_log` 테이블에 `(actor_id, target_user_id, action, created_at)` 기록.
- 관리자 본인이 자기 진행 초기화도 로그 남김.

---

## 9. DB / RPC 후보 (마이그레이션 1개로 묶음 권장)

마이그레이션 파일: `supabase/migrations/20260711000000_boxing_starter_camp.sql` (단조 증가).

### 9.1 새 테이블
```sql
public.boxing_starter_camp_progress (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_day smallint NOT NULL DEFAULT 1,                  -- 1..7
  current_step_index smallint NOT NULL DEFAULT 0,           -- day 안 step
  completed_days jsonb NOT NULL DEFAULT '[]'::jsonb,        -- e.g. ["day1","day2"]
  completed_steps jsonb NOT NULL DEFAULT '[]'::jsonb,       -- ["day1.osami_briefing", ...]
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','skipped','completed')),
  started_at timestamptz,
  last_active_at timestamptz,
  finished_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

```sql
public.boxing_starter_camp_admin_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

RLS: `progress` 는 SELECT/UPDATE self + super_admin. `admin_log` 는 super_admin SELECT 만.

### 9.2 RPC 후보 (모두 SECURITY DEFINER + search_path 'public')

| RPC | 인자 | 역할 |
|---|---|---|
| `start_starter_camp()` | — | 본인 row UPSERT, status='active', started_at=now(). 이미 completed 면 no-op. |
| `complete_starter_camp_step(p_step_code text)` | step code | step 추가 + step_index 증가 + Day 마지막 step 이면 day_complete 호출. |
| `complete_starter_camp_day(p_day smallint)` | day | completed_days 에 추가 + 보상 지급(`grant_starter_camp_reward` 내부 호출) + current_day +1. |
| `skip_starter_camp()` | — | status='skipped'. 보상 0. |
| `resume_starter_camp()` | — | status='active' 복귀. 마지막 미완료 day 부터. |
| `grant_starter_camp_reward(p_day smallint)` (private) | day | quest_xp / fight_money 지급. fight_money 는 `grant_gems` RPC 경유. **공식 XP 0**. |
| `admin_get_starter_camp(p_user_id uuid)` | user_id | super_admin 전용. progress 행 반환. |
| `admin_set_starter_camp(p_user_id, p_day, p_step, p_status)` | … | super_admin 전용. 강제 점프/초기화. log 기록. |

### 9.3 보존
- 위 어떤 RPC도 `member_progress` / `mission_submissions` / `levels` / `wallet` 직접 update 0.
- fight_money 지급은 반드시 `PERFORM public.grant_gems(...)` 만.

---

## 10. UI 컴포넌트 후보

신규 디렉터리: `src/components/starter-camp/` (기존 `src/components/tutorial/` 와 분리).

| 컴포넌트 | 역할 |
|---|---|
| `StarterCampOverlay.tsx` | 풀스크린 spotlight + 카드 + CTA. Day×step 단위 마운트. |
| `StarterCampHomeCard.tsx` | 홈 상단에 표시되는 진행 카드 ("Day 3 / 7"). |
| `StarterCampMyPageCard.tsx` | MyPage 안 "다시 보기" 카드. |
| `StarterCampDayCompleteModal.tsx` | Day 완료 시 "내일 다시 오세요" 모달 + 보상 chip. |
| `StarterCampGraduationModal.tsx` | Day 7 수여식 풀스크린. |
| `StarterCampSpotlight.tsx` | SVG mask 스포트라이트 컴포넌트. |
| `StarterCampPointer.tsx` | 떠있는 손가락 / 화살표. |
| `StarterCampOsamiBubble.tsx` | 우상단 작은 오삼이 + 정적 대사 말풍선. |
| `StarterCampDebugPanel.tsx` | super_admin 전용. SuperAdminDashboard 안 또는 별도 라우트. |

신규 hook (`src/hooks/`):
| Hook | 역할 |
|---|---|
| `useStarterCampState.ts` | progress 행 read + invalidate. |
| `useStarterCampActions.ts` | start / completeStep / completeDay / skip / resume mutations. |
| `useStarterCampOverlay.ts` | 현재 활성 step 계산 + target 해상 + 완료 감지 (action_type 별). |
| `useTargetRect.ts` | rAF 기반 target 좌표 추적 (스포트라이트용). |

신규 service: `src/services/starterCampService.ts` — RPC 래퍼.

신규 라우트: `/starter-camp` (선택, MyPage 카드에서 진입 시 진행 요약/재시작 화면).

---

## 11. 기존 화면에 추가할 `data-tour` anchor 후보

> **anchor 만 추가. 기존 컴포넌트의 props/state/로직은 0 byte 변경.**

| 페이지 / 컴포넌트 | anchor | 사용 step |
|---|---|---|
| `OsamiDailyBriefingCard` | `data-tour="osami-daily-briefing"` | 1.1 |
| `TodayQuestMiniPanel` | `data-tour="today-quest"` | 1.2 |
| `BottomNav` 홈 버튼 | `data-tour="nav-home"` | 1.3 |
| `BottomNav` 훈련 버튼 | `data-tour="nav-missions"` | 2.1 |
| `MasterTrackPage` 첫 단계 카드 | `data-tour="master-track-first-stage"` | 2.3 |
| `BottomNav` 단증혜택 버튼 | `data-tour="nav-cert"` | 2.5 |
| 전체 메뉴 `/minigame` 항목 | `data-tour="menu-minigame"` | 3.1 |
| `MinigamePage` 게임 카드 첫 항목 | `data-tour="minigame-first"` | 3.2 |
| `BoxingIqLeagueCard` | `data-tour="boxing-iq-league"` | 3.3 |
| `FunChallengeCard` | `data-tour="fun-challenge"` | 4.1 |
| `ConditionGaugeCard` | `data-tour="condition-gauge"` | 4.3 |
| `SafetyCheckPanel` | `data-tour="safety-panel"` | 4.4 |
| 전체 메뉴 `/guide` 항목 | `data-tour="menu-guide"` | 4.5 |
| `ChampionJournalCard` | `data-tour="champion-journal"` | 5.1 |
| `GrowthReportCard` | `data-tour="growth-report"` | 5.3 |
| 전체 메뉴 `/rewards` 항목 | `data-tour="menu-rewards"` | 5.4 |
| `SecondCheerCard` | `data-tour="second-cheer"` | 6.1 |
| `CornermanCard` | `data-tour="cornerman"` | 6.2 |
| `ShadowBoxerCard` | `data-tour="shadow-boxer"` | 6.3 |
| `GymRaidCard` | `data-tour="gym-raid"` | 6.4 |
| 전체 메뉴 `/mypage` 항목 | `data-tour="menu-mypage"` | 7.1 |
| `MyPage` 캐릭터 섹션 | `data-tour="mypage-character"` | 7.2 |
| `BottomNav` 랭킹 / 랭크업 | `data-tour="nav-halloffame"`, `data-tour="nav-rankup"` | 7.4, 7.5 |

> 약 25개 anchor. 모두 비침투형 — `<div data-tour="..." />` 만 추가하거나 기존 div의 `data-tour` 속성 한 줄 추가.

---

## 12. 보상 정책

### 12.1 보상 종류 (한정)
| 보상 | 허용 여부 |
|---|---|
| Quest XP (`profiles.quest_xp` 또는 별도 컬럼) | ✅ Day 당 5~20 |
| 파이트 머니 (`real_gems`, `grant_gems` RPC 경유) | ✅ Day 당 0~50, 7일 누적 ≤ 200 |
| Day 완료 배지 (`starter_day1`..`starter_day7`) | ✅ 표시만, 공식 단증 X |
| 수료 배지 (`starter_camp_graduate`) | ✅ Day 7 수료식 1회 |
| 공식 XP / 레벨 / 단증 / 출석 카운트 | ❌ |
| 공식 미션 제출 / 코치 승인 카운트 | ❌ |

### 12.2 권장 수치 (수정 가능 — 운영 측 협의)
```
Day 1: quest_xp +5,  fight_money +10
Day 2: quest_xp +10, fight_money +15
Day 3: quest_xp +10, fight_money +20
Day 4: quest_xp +10, fight_money +20
Day 5: quest_xp +15, fight_money +25
Day 6: quest_xp +15, fight_money +30
Day 7: quest_xp +20, fight_money +50, badge "starter_camp_graduate"
─────────────────────────────────────────
누적: quest_xp +85, fight_money +170
```

### 12.3 멱등성
- `complete_starter_camp_day(p_day)` 는 이미 completed_days 에 있으면 no-op (보상 0).
- `grant_gems` 호출 시 `idempotency_key='starter_camp_day:<day>:<user_id>'` 사용 권장.

---

## 13. 스킵 / 재개 정책

### 13.1 스킵
- 회원이 어느 step 에서든 "건너뛰기" 버튼 → step 단위 skip OR Day 단위 skip OR 전체 skip 선택 가능.
- 전체 skip 시 status='skipped', 홈 카드 사라짐. **보상 0**.
- 부드러운 문구: "괜찮아요. 다음에 다시 시작할 수 있어요."

### 13.2 재개
- MyPage "스타터 캠프 다시 시작" 카드 항상 노출.
- 재개 시 마지막 미완료 day×step 부터 (`current_day` / `current_step_index` 보존).
- 보상은 이미 받은 day는 재지급 X (멱등성).

### 13.3 하루에 여러 Day 진행
- 기본은 하루 1 Day 제한 (24시간 cooldown — 이전 Day finished_at 기준).
- 회원이 명시적으로 "한 번에 끝까지 해보기" 토글 ON 시 cooldown 해제. 보상은 동일 지급.

### 13.4 며칠 비움
- last_active_at 7일 초과 → 홈 카드 문구 부드럽게 변경: "오삼이가 기다리고 있어요". 페널티 0.

---

## 14. 충돌 위험

### 14.1 기존 `TutorialFloatingMascot` 와의 충돌 (높음)
- 현재 [App.tsx:230](../src/App.tsx#L230) 에 `<TutorialFloatingMascotWithDetect />` 가 user 가 splashDone 이면 항상 마운트됨.
- 기존 시스템:
  - [src/components/tutorial/TutorialFloatingMascot.tsx](../src/components/tutorial/TutorialFloatingMascot.tsx) — 행동기반 미션 5개
  - [src/hooks/useTutorialState.ts](../src/hooks/useTutorialState.ts) / `useTutorialAutoDetect.ts` / `useTutorialVisitTracker.ts`
  - 마이그레이션: `20260420130000_tutorial_and_unlock_rpcs.sql`, `20260420140000_tutorial_state_columns.sql`, `20260422000000_tutorial_induction_ceremony.sql`, `20260423000000_tutorial_started_at.sql`
- 둘 다 활성화되면 **마스코트가 두 개** 떠 화면을 가림.
- z-index 경쟁, 동시 모달 가능성.

### 14.2 ChatAssistant 플로팅 버튼과의 충돌 (중)
- [App.tsx:228](../src/App.tsx#L228) `<ChatAssistant />` 도 floating. 우하단.
- 7일 캠프 오버레이가 풀스크린 모달일 때 ChatAssistant 클릭이 살아있으면 안 됨.

### 14.3 AppLaunchSplash 와의 충돌 (낮음)
- 콜드 스타트 splash 끝나기 전 캠프 카드가 보이면 어색.
- splashDone 이후에만 캠프 카드 마운트 — `useAppLaunchSplash` 의 splashDone 플래그 사용.

### 14.4 BottomNav 변경 압력 (높음)
- 캠프 진행 중에는 BottomNav 위에 step 인디케이터 띄우고 싶은 유혹이 있을 수 있음 — 하지만 **금지**.
- 진행 인디케이터는 캠프 오버레이 자체 안에만.

### 14.5 마이그레이션 timestamp 충돌 (낮음)
- 최신 마이그레이션: `20260710000000_boxing_battle_balance.sql`.
- 캠프 마이그레이션은 `20260711000000_*` 이상으로.

### 14.6 보상 중복 지급 (중)
- complete_day RPC 가 멱등성 없으면 회원이 재시도로 fight_money 무한 획득 가능.
- 반드시 `completed_days` jsonb 에 day 코드 존재 여부 체크 후 지급.

### 14.7 reduced motion 미지원 (중)
- 모션 강제 시 일부 회원(어지러움 / 낮은 기기) 이탈. prefers-reduced-motion 분기 필수.

### 14.8 target 셀렉터 깨짐 (높음)
- 향후 컴포넌트 리팩터로 `data-tour` 셀렉터가 사라지면 step 진행 불가.
- fallback `skip_silently` 기본값 + 운영 측 알림(콘솔 warn) 필요.

---

## 15. 충돌 방지 전략

| 위험 | 대응 |
|---|---|
| 14.1 기존 마스코트 | (a) 캠프 오버레이 활성 동안 `TutorialFloatingMascot` 자동 hide (state 공유), (b) 또는 신규 회원 7일 동안은 기존 마스코트 자체 비활성. **권장: (b) — 7일 캠프가 신규 회원의 1차 안내 채널**. 기존 마스코트는 "튜토리얼 다시 보기" 위치로 이동. |
| 14.2 ChatAssistant | 캠프 오버레이 풀스크린일 때 z-index 격상 + ChatAssistant pointer-events: none. 닫히면 복원. |
| 14.3 Splash | 캠프 카드/오버레이는 `splashDone === true` 일 때만 마운트. |
| 14.4 BottomNav 압력 | BottomNav 영역에 absolute overlay 금지. 진행 인디케이터는 오버레이 카드 내부 progress bar 만. |
| 14.5 timestamp | `20260711000000_boxing_starter_camp.sql` 사용. |
| 14.6 보상 중복 | RPC 안 멱등성 가드 + grant_gems idempotency_key. |
| 14.7 reduced motion | `useReducedMotion()` 훅 기반 step 메타 분기. |
| 14.8 셀렉터 깨짐 | (a) `data-tour` anchor 는 운영 환경에서도 유지(빌드 후 자동 제거 X), (b) 모든 step 에 `fallback_behavior: "skip_silently"` 기본, (c) target 미발견 시 dev 콘솔에 "starter-camp: target 'xxx' not found" warn, (d) 운영 측 점검용 admin 진단 페이지에 "셀렉터 검증" 버튼 (모든 step target 한 번씩 검증). |

---

## 16. 구현 순서 (다음 단계 = 42)

| 순서 | 작업 | 파일 |
|---|---|---|
| 1 | 마이그레이션 작성 + Supabase Dashboard 적용 | `supabase/migrations/20260711000000_boxing_starter_camp.sql` |
| 2 | 타입 정의 | `src/types/starterCamp.ts` |
| 3 | 정적 step 데이터 (39 step) | `src/data/starterCampSteps.ts` |
| 4 | service / hooks | `src/services/starterCampService.ts`, `src/hooks/useStarterCamp*.ts` |
| 5 | spotlight + pointer 컴포넌트 (leaf) | `StarterCampSpotlight`, `StarterCampPointer`, `StarterCampOsamiBubble` |
| 6 | overlay 합성 | `StarterCampOverlay` |
| 7 | 진입 카드 | `StarterCampHomeCard`, `StarterCampMyPageCard` |
| 8 | Day complete / Graduation 모달 | `StarterCampDayCompleteModal`, `StarterCampGraduationModal` |
| 9 | 기존 페이지에 `data-tour` anchor 25개 추가 (1줄씩) | HomePage / MissionsPage / MyPage / engagement 컴포넌트 들 |
| 10 | App.tsx 에 overlay 마운트 + 기존 마스코트 7일간 hide 로직 | `src/App.tsx` (작은 변경) |
| 11 | super_admin 디버그 패널 | `StarterCampDebugPanel` (SuperAdminDashboard 안 탭 또는 `/admin/starter-camp`) |
| 12 | reduced-motion / fallback 검증 | `useReducedMotion`, target 검증 admin tool |
| 13 | tsc / build / grep 자기검열 | — |
| 14 | 운영 SQL Editor 적용 + 손스모크 | — |

마이그레이션 timestamp: **20260711000000** (현재 최신 20260710000000 다음 단조 증가).

---

## 17. QA 체크리스트

### 17.1 보호 영역
- [ ] `levels` / `missions` / `mission_videos` / `mission_submissions` / `member_progress` 컬럼 변경 0건 (`git diff supabase/migrations` 로 확인).
- [ ] `MissionsPage.tsx` / `RankUpPage.tsx` 의 공식 훈련 로직 변경 0건 (data-tour anchor 1줄 추가만 허용).
- [ ] `ChatAssistant.tsx` / `supabase/functions/chat-assistant/**` 변경 0건.
- [ ] `useWallet.ts` / `challengeService.ts` / `allLevelsData.ts` / `whiteLevel1Data.ts` 변경 0건.
- [ ] `BottomNav.tsx` 변경 0건 (data-tour anchor 추가만 허용).

### 17.2 기능
- [ ] 신규 회원 가입 후 첫 홈 진입 시 Day 1 카드 표시.
- [ ] Day 1 → Day 2 자동 cooldown (다음날 자정 이후 활성).
- [ ] "한 번에 끝까지 해보기" 토글 시 cooldown 해제.
- [ ] 각 step 의 target 셀렉터 매칭 — 25개 anchor 모두 발견.
- [ ] 셀렉터 미발견 시 step 자동 skip (콘솔 warn 1회).
- [ ] step 진행 중 페이지 새로고침 후 같은 step 으로 복귀.
- [ ] 스킵 후 MyPage 에서 재시작 가능.
- [ ] Day 7 마지막 step 완료 시 confetti + 수료 배지.
- [ ] 기존 `TutorialFloatingMascot` 캠프 활성 동안 화면에 동시 노출 안 됨.

### 17.3 보상
- [ ] Day 완료 1회만 보상 지급 (재호출 시 0).
- [ ] fight_money 지급은 `grant_gems` RPC 경유 — wallet 직접 update 0.
- [ ] 공식 XP / 레벨 / 단증 변경 0.
- [ ] `mission_submissions` insert 0건 (캠프 진행 중).

### 17.4 권한
- [ ] super_admin 만 `/admin/starter-camp-debug` 접근.
- [ ] admin RPC 가 일반 회원 호출 시 `forbidden` raise.
- [ ] admin 작업이 `boxing_starter_camp_admin_log` 에 기록됨.
- [ ] 응답에 민감정보(전화/이메일) 미포함.

### 17.5 UX
- [ ] prefers-reduced-motion 시 손가락/화살표/컨페티 비활성.
- [ ] 모바일 375×667 에서 spotlight 정확히 target 위에.
- [ ] target 화면 밖일 때 자동 scrollIntoView.
- [ ] 강제/실패 단어 미사용 (문구 검수).
- [ ] Day 7 수여식이 작은 의식 같은 느낌 (3회 confetti + 오삼이 절).

### 17.6 빌드 / 검증
- [ ] `npx tsc --noEmit` EXIT=0
- [ ] `bun run build` ✓ built
- [ ] grep 자기검열: ChatAssistant / chat-assistant / approve_mission / record_attendance / member_progress / wallet 직접 update 모두 0건 in `src/components/starter-camp/` 및 `src/services/starterCampService.ts`.
- [ ] 새 npm 패키지 0개 (canvas-confetti / framer-motion 기존 활용).
- [ ] 새 마이그레이션 1개 (20260711000000).

---

## 부록 A. 본 문서가 참조한 핵심 코드 위치

| 파일 | 본 설계에서의 역할 |
|---|---|
| [src/App.tsx](../src/App.tsx) | overlay 마운트 위치 / splashDone 게이트 / 기존 마스코트 마운트 라인 230 |
| [src/components/BottomNav.tsx](../src/components/BottomNav.tsx) | 미수정. data-tour anchor 추가 후보 |
| [src/components/engagement/](../src/components/engagement/) | 25개 anchor 후보가 거의 모두 여기 |
| [src/components/tutorial/TutorialFloatingMascot.tsx](../src/components/tutorial/TutorialFloatingMascot.tsx) | 충돌 영역 — 7일간 비활성 처리 대상 |
| [src/hooks/useTutorialState.ts](../src/hooks/useTutorialState.ts) | 기존 5미션 튜토리얼 상태 — **참조만, 캠프와 별도 컬럼** |
| `supabase/migrations/20260710000000_boxing_battle_balance.sql` | 직전 마이그레이션 — timestamp 단조 증가 기준 |

---

**문서 끝.** 본 명세 외 코드 변경 0건. 다음 단계(42)에서 본 명세를 그대로 구현.
