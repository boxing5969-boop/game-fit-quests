# 49단계 — 튜토리얼 액션 시스템 고도화 설계

## 1. 현재 구조 분석

### 1.1 TutorialCampStep (`tutorialCampSteps.ts`)
현재 step 은 12개 필드:
- `day`, `step`, `route`, `targetKey`
- `targetSelector` (CSS 셀렉터, 빈 문자열이면 중앙 모달)
- `title`, `body`, `osamiMessage`
- `actionType`: `"read" | "click" | "navigate" | "open" | "complete"`
- `requireTargetClick` (true 면 target 직접 클릭만 통과)
- `allowNextWithoutClick` (건너뛰기 노출 여부)
- `animation`: `"spotlight" | "pulse" | "hand" | "arrow" | "bounce" | "confetti" | "celebration"`
- `placement`, `fallbackText`, `completionText`

총 35 step (Day 1~7 × 5).

### 1.2 Provider 동작 (`TutorialCampProvider.tsx`)
- `useTutorialCamp` + `useLocation` 매칭
- target click capture-phase listener → `setTargetClicked(true)` + (`requireTargetClick=true` 면) 600ms 후 자동 next
- celebration/confetti 분기 → `TutorialCelebration`
- 그 외 → `TutorialOverlay`

### 1.3 Tooltip next 버튼 gating (`TutorialTooltip.tsx`)
- `blockNext = step.requireTargetClick && (!routeMatch || (!targetClicked && !trueFallback))`
- target missing fallback (route 같지만 element 없음) 은 안전망으로 next 활성화

### 1.4 호환성 보호
- `myboxer.visualization.records` localStorage key: 변경 불가 (153마인드셋)
- session id `myboxer-153-returned-person`, `myboxer-153-one-year-later`: 변경 불가
- BottomNav 메뉴: 변경 불가
- 보호 영역 (MissionsPage 공식훈련, RankUpPage, ChatAssistant, useWallet, challengeService 등): 변경 불가

---

## 2. 새 actionType 정의

기존 5종 + 신규 7종 (모두 optional 필드와 함께 사용):

| actionType | 의미 | 완료 조건 |
|---|---|---|
| `read` (기존) | 읽기만 | 즉시 next 가능 |
| `click` (기존) | target 클릭 | targetClicked |
| `navigate` (기존) | 라우트 이동 | route match |
| `open` (기존) | 모달 열기 | modal 감지 또는 click |
| `complete` (기존) | Day 완료 | Day completion |
| **`wait_quiz_read`** | 문제 읽기 | 짧은 지연 또는 chip 클릭 |
| **`wait_quiz_answer`** | 정답 선택 | quiz_answer_selected (옵션: correct only) |
| **`wait_scroll_bottom`** | 스크롤 하단 도달 | scrollContainer 의 90% 이상 |
| **`wait_text_input`** | 텍스트 입력 | inputSelector 의 value.length ≥ minTextLength |
| **`wait_select_option`** | 옵션 선택 | optionSelector 클릭 또는 select 변경 |
| **`wait_condition_check`** | 컨디션 선택 | conditionSelector 클릭 |
| **`wait_modal_next`** | 모달 닫힘 | DOM 에서 modal element 제거 감지 |

---

## 3. 새 completionRule 정의

step 의 `completionRule` 필드로 명시 (없으면 기존 `requireTargetClick` 로직 fallback):

```ts
type CompletionRule =
  | "target_clicked"
  | "quiz_question_read"
  | "quiz_answer_selected"
  | "quiz_correct_answer_selected"
  | "scrolled_to_bottom"
  | "text_input_min_length"
  | "option_selected"
  | "toggle_selected"
  | "condition_checked"
  | "modal_closed"
  | "manual_confirm";
```

### completionRule evaluator 알고리즘

```ts
function isStepConditionMet(step, state) {
  // 1) 명시적 completionRule 있으면 그것 우선
  if (step.completionRule) {
    switch (step.completionRule) {
      case "target_clicked": return state.targetClicked;
      case "quiz_correct_answer_selected": return state.quizCorrectAnswerSelected;
      case "quiz_answer_selected": return state.quizAnswerSelected;
      case "scrolled_to_bottom": return state.scrolledToBottom;
      case "text_input_min_length": return state.textInputSatisfied;
      case "option_selected": return state.optionSelected;
      case "condition_checked": return state.conditionChecked;
      case "modal_closed": return state.modalClosed;
      case "manual_confirm": return true; // 다음 버튼만 누르면 됨
      default: return state.targetClicked;
    }
  }
  // 2) 기존 호환: requireTargetClick 만 보던 시절
  if (step.requireTargetClick) return state.targetClicked;
  return true;
}
```

---

## 4. 새 step 필드 (모두 optional)

```ts
interface TutorialCampStep {
  // ... 기존 12 필드 ...

  // 신규 (optional, 기존 step 에 영향 0)
  completionRule?: CompletionRule;
  blockNextUntilComplete?: boolean;       // 기본 false (기존 호환)
  autoAdvance?: boolean;                  // 조건 충족 시 자동 다음 (기본 false)

  // 입력/스크롤/선택 관련
  inputSelector?: string;
  minTextLength?: number;                 // 기본 5
  scrollContainerSelector?: string;       // 기본: window
  scrollThreshold?: number;               // 기본 0.85
  optionSelector?: string;                // 다중 옵션 (복수 element)
  conditionSelector?: string;             // 컨디션 토글
  expectedAnswerSelector?: string;        // 정답 element 식별
  expectedAnswerValue?: string;           // data-tutorial-answer-value 매칭

  // UX 보강
  helperMessage?: string;                 // 조건 미충족 시 안내
  successMessage?: string;                // 조건 충족 시 안내
  wrongAnswerMessage?: string;            // 오답 시 부드러운 재안내
}
```

---

## 5. next 버튼 gating 규칙 (통합)

```
nextDisabled = (
  step.blockNextUntilComplete === true &&
  !isStepConditionMet(step, state) &&
  !trueFallback                    // target missing 시 안전망
);
```

기존 `requireTargetClick` step 도 동일 함수에서 처리.
`actionType === "complete"` 는 별도 — Day 완료 버튼.

---

## 6. helper / success message UX

| 상황 | 메시지 예시 |
|---|---|
| target 안 눌렀을 때 | "반짝이는 곳을 눌러보세요." |
| 문제 안 읽었을 때 | "문제를 먼저 읽어보세요." |
| 정답 안 골랐을 때 | "정답이라고 생각하는 답을 눌러보세요." |
| 오답 선택 시 | "괜찮아요. 다시 한번 문제를 보고 골라볼까요?" |
| 스크롤 미달 | "아래까지 천천히 확인해보세요." |
| 입력 부족 | "한 줄만 적어도 충분해요." |
| 컨디션 미선택 | "컨디션을 하나 선택하면 다음으로 갈 수 있어요." |
| 충족 | "좋아요. 다음으로 가볼까요?" |

---

## 7. event listener 관리 원칙

### 7.1 click listener
- target element 에 capture-phase 부착
- step 변경 또는 unmount 시 cleanup
- 같은 step 중복 등록 방지 (refs)

### 7.2 input listener
- inputSelector element 의 `input` event
- value.length ≥ minTextLength 시 satisfied
- value 가 다시 줄어들면 unsatisfied (회원이 지웠을 경우)

### 7.3 scroll listener
- scrollContainerSelector → window 또는 element
- `(scrollTop + clientHeight) / scrollHeight >= threshold` 시 만족
- passive listener 사용 (성능)

### 7.4 modal close watcher
- MutationObserver 또는 폴링 (RAF)
- target modal 이 DOM 에서 제거되면 만족

### 7.5 cleanup 보장
- 모든 listener `useEffect` return 에서 removeEventListener
- step 변경 시 모든 state reset

---

## 8. 회원 노출 금지어 점검

이번 설계에서 **새로 추가하는** 회원 노출 텍스트:
- helper/success/wrongAnswer 메시지 — 모두 점검 통과 (링/체육관/복싱장/gym/RPG/몬스터/전투/보스/판타지/레벨업/monster/battle/fantasy 0건)
- 장소 표현 "153복싱짐" 통일 — OK

내부 코드 식별자 (`actionType`, `completionRule` enum, `box ing-iq-card` 등 data-tour) 는 회원 노출 X.

---

## 9. 50단계 구현 범위 (다음 단계)

50단계에서 실제로 코드 변경할 파일:
- `tutorialCampTypes.ts` — `TutorialCampStep` 인터페이스 확장 (모두 optional)
- `tutorialCampSteps.ts` — `CompletionRule` 타입 export (step 데이터는 51~54 단계에서)
- `useTutorialCamp.ts` — completion state ref 노출 (선택)
- `TutorialCampProvider.tsx` — completion state machine + listeners
- `TutorialOverlay.tsx` — props 확장
- `TutorialTooltip.tsx` — gating + helperMessage 표시

**51~54 단계**에서:
- 실제 step 데이터 업데이트 (각 화면별 흐름)
- 화면별 `data-tour` / `data-tutorial-*` anchor 추가

---

## 10. 위험 포인트 (구현 전 인지 필요)

### 10.1 정답 식별 보안
복싱 IQ 의 "정답" 정보가 클라이언트에 노출돼 있으면, 튜토리얼이 정답을 미리 알 수 있어 **부정 행위 우려**. 권장:
- 튜토리얼 전용 seed 문제 (예: 첫 회원이 보는 고정 question) 만 사용
- 또는 **"선택지 하나를 누르면 OK"** 방식으로 정답 강제 안 함 (안전한 기본값)

### 10.2 모달 열림/닫힘 감지
챌린지 아레나/챔피언 일기 모달이 다양한 라이브러리 (Sheet, Dialog, Drawer) 로 구현된 경우 selector 가 라이브러리마다 다름. step 데이터에 `modalSelector` 명시 필수.

### 10.3 BottomNav 버튼 가림
tooltip + spotlight 가 BottomNav 위에 떠도 BottomNav 자체 클릭은 가능해야 함 (라우트 이동 못 하면 막힘). 현재 `pointer-events: none` 영역과 spotlight cutout 검증 필요.

### 10.4 PostActionReflectionSheet 충돌
Day 완료 celebration 후 30초 마무리 sheet 가 자동 트리거되면 시각적으로 겹침. step `metadata.suppressReflectionSheet: true` 같은 플래그로 제어 권장.

### 10.5 153마인드셋 호환성
`myboxer.visualization.records` key, `myboxer-153-returned-person` session id 절대 미변경 — 본 작업 범위에 영향 없으나 step 추가 시 **import 경로/key 우연 변경** 주의.

### 10.6 회원 정답 미공개 컨텐츠 보호
정답 정보가 있는 컴포넌트에 `data-tutorial-correct="true"` 같은 attribute 를 박으면 HTML 인스펙터로 정답 노출. **클라이언트에 정답을 박지 말고**, 단순 "선택지 클릭" 만 감지하라.

### 10.7 스크롤 컨테이너 식별
챌린지 아레나가 모달 안에 있으면 스크롤 컨테이너는 `body` 가 아닌 모달 내부 div. `scrollContainerSelector` 잘못 지정 시 영원히 미달.

---

## 11. QA 체크리스트 (56단계용)

### 핵심 흐름
- [ ] Day 1 첫 인사 → next 클릭 가능
- [ ] Day 3 복싱 IQ 카드 → 문제 → 정답 선택 → next 활성화
- [ ] Day 4 챌린지 아레나 → 스크롤 하단 → next 활성화
- [ ] Day 5 챔피언 일기 → 질문 + 5자 입력 + 컨디션 → next 활성화
- [ ] Day 6 세컨드 응원 → 카드 확인 → next 활성화
- [ ] Day 7 마이페이지/성장 리포트 → 완료식
- [ ] target missing fallback 정상
- [ ] previous 버튼 정상
- [ ] Day cooldown 정상
- [ ] pause/resume 정상

### 보호 영역
- [ ] `git diff --stat` 에서 보호 파일 변경 0
- [ ] `data-tour` / `data-tutorial-*` 외 로직 수정 0
- [ ] 새 npm package 0
- [ ] 새 supabase migration 0
- [ ] localStorage key 변경 0
- [ ] BottomNav 메뉴 변경 0

### 성능
- [ ] event listener cleanup OK (devtools Memory 점검)
- [ ] scroll listener passive
- [ ] step 변경 시 stale state 없음

### 빌드
- [ ] `npx tsc --noEmit` ✓
- [ ] `bun run build` ✓
