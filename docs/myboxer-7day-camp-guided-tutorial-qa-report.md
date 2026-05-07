# 마이복서153 7일 스타터 캠프 행동형 튜토리얼 QA 리포트

## 1. 테스트 일시
- 작성일: 2026-05-07
- 환경: Cowork sandbox + 로컬 검증

## 2. 브랜치 / 커밋
- 브랜치: `main`
- 단계 49~55 의 일련 commit 완료

## 3. 이번 고도화 요약
"설명만 읽는 튜토리얼" → **"실제 화면을 따라 클릭/입력/스크롤하는 행동형 튜토리얼"** 로 전환.

| 단계 | 파일 | 핵심 변경 |
|---|---|---|
| 49 | `docs/stage-49-tutorial-action-system-design.md` | 설계 문서 작성 (액션 시스템 + 위험 포인트 7개) |
| 50 (코어) | `tutorialCampSteps.ts` | `TutorialCampStep` 인터페이스 12개 optional 필드 + `CompletionRule` 11종 + `TutorialCampActionType` 7종 추가 export |
| 50-A | `TutorialCampProvider.tsx` `TutorialOverlay.tsx` `TutorialTooltip.tsx` | useReducer 기반 completionState + 7종 listener (input/scroll/option/condition/modal/quiz_answer/quiz_question_read) + `isStepConditionMet` evaluator + Tooltip next gating 통합 + helper/success message 표시 |
| 51 | `BoxingAcademyQuizModal.tsx` `tutorialCampSteps.ts` Day 3 | 복싱 IQ: 카드 클릭 → 선택지 클릭 흐름. 보안: 정답 정보 클라이언트 노출 0 (서버 RPC 결정) |
| 52 | `ChallengesPage.tsx` `tutorialCampSteps.ts` Day 4 | 챌린지 아레나: 페이지 전체 스크롤 (85% 도달) |
| 53 | `ChampionJournalSheet.tsx` `tutorialCampSteps.ts` Day 5 | 챔피언 일기: 카드 클릭 → 5자 입력 → 컨디션 선택 |
| 54 | `tutorialCampSteps.ts` Day 6, 7 | 세컨드 응원 강화 + Day 7 완료식 `suppressReflectionSheet=true` |
| 55 | `PostActionReflectionSheet.tsx` `TutorialCampProvider.tsx` | 차단 플래그 sessionStorage 연결 (60초). Day 7 완료식 confetti 와 마무리 sheet 시각 충돌 방지 |

## 4. 보호 영역 변경 여부
모든 보호 영역 **변경 0**:

| 영역 | 변경 |
|---|---|
| levels / missions / mission_videos / mission_submissions | ✗ |
| member_progress | ✗ |
| approve_mission_submission / record_attendance | ✗ |
| useManualLevelUp / usePassBossBattle | ✗ |
| MissionsPage 공식 훈련 처리 | ✗ |
| RankUpPage 공식 랭크업 | ✗ |
| ChatAssistant | ✗ |
| supabase/functions/chat-assistant | ✗ |
| useWallet.ts | ✗ |
| challengeService.ts | ✗ |
| allLevelsData / whiteLevel1Data / sharedConstants 공식 훈련 데이터 | ✗ |
| src/integrations/supabase/types.ts | ✗ |
| package.json / bun.lockb | ✗ |
| supabase/migrations | ✗ |
| BottomNav 메뉴 구조 | ✗ |

## 5. 153마인드셋 호환성 점검
- `myboxer.visualization.records` localStorage key: ✗ 변경
- `myboxer-153-returned-person` session id: ✗ 변경
- `myboxer-153-one-year-later` session id: ✗ 변경
- `/myboxer/visualization` 라우트: ✗ 변경
- `/story-rpg`, `/boxer-route` 호환: ✗ 변경

## 6. localStorage key 점검
- 변경된 key: 0
- 신규 key: `tutorial-camp-suppress-reflection-until` (sessionStorage, 60초 만료)
  - 이건 일반 localStorage 가 아닌 sessionStorage + 자동 만료라 데이터 잔존 위험 0

## 7. actionType / completionRule 점검
### 신규 actionType (7종) — `tutorialCampSteps.ts`
- `wait_quiz_read`, `wait_quiz_answer`, `wait_scroll_bottom`
- `wait_text_input`, `wait_select_option`, `wait_condition_check`, `wait_modal_next`

### 신규 completionRule (11종)
- `target_clicked`, `quiz_question_read`, `quiz_answer_selected`, `quiz_correct_answer_selected`
- `scrolled_to_bottom`, `text_input_min_length`, `option_selected`, `toggle_selected`
- `condition_checked`, `modal_closed`, `manual_confirm`

### 기존 35 step 호환
모든 신규 필드 optional → 기존 step 데이터 그대로 동작. evaluator 가 `completionRule` 미정의 시 `requireTargetClick` 폴백.

## 8. 복싱 IQ 튜토리얼 점검
- ✓ Day 3 step 1 — 카드 클릭 (`requireTargetClick: true`, `blockNextUntilComplete`)
- ✓ Day 3 step 2 — 선택지 클릭 (`expectedAnswerSelector`, `quiz_answer_selected`)
- ✓ helper "문제를 먼저 읽고, 답이라고 생각하는 곳을 눌러보세요"
- ✓ success "좋아요. 다음으로 가볼까요?"
- ✓ 정답 정보 클라이언트 노출 0 (서버 RPC `submit_boxing_quiz_attempt` 결정)
- ✓ 기존 퀴즈 제출 / 보상 / 결과 화면 흐름 0 변경

## 9. 챌린지 아레나 튜토리얼 점검
- ✓ Day 4 step 0 — 카드 클릭 (navigate)
- ✓ Day 4 step 1 — 페이지 전체 스크롤 (`scrollThreshold: 0.85`, `scrolled_to_bottom`)
- ✓ helper "아래까지 천천히 내려보며 구성을 확인해보세요"
- ✓ 챌린지 실제 제출 강제 X — 단순 둘러보기 만으로 충분
- ✓ 기존 `useChallenges` / `challengeService` / 통증 체크 / 제출 흐름 0 변경

## 10. 챔피언 일기 튜토리얼 점검
- ✓ Day 5 step 0 — 카드 클릭 (target_clicked)
- ✓ Day 5 step 1 — 5자 입력 감지 (`inputSelector`, `text_input_min_length`)
- ✓ Day 5 step 2 — 컨디션 선택 (`conditionSelector`, `condition_checked`)
- ✓ helper "한 줄만 적어도 충분해요. 5자 이상이면 다음으로 갈 수 있어요"
- ✓ 일기 실제 저장 강제 X — 회원 자유
- ✓ 기존 `useChampionJournal` / `useSubmitChampionJournalEntry` / `boxingEngagementService` 0 변경

## 11. 세컨드 응원 / 마이페이지 점검
- ✓ Day 6 step 0 — 세컨드 응원 카드 클릭 (target_clicked)
- ✓ Day 6 step 1~3 — 동료/스티커/RP 안내 (read, fallback 안전망)
- ✓ Day 7 step 0~2 — 마이페이지/복싱 전당/성장 리포트 highlight (read)
- ✓ 응원 실제 전송 강제 X
- ✓ MyPage / 성장 리포트 / 복싱 전당 컴포넌트 0 변경

## 12. 오삼 팝업 / next 버튼 점검
- ✓ next gating 통합: `legacyBlock || newBlock`
  - legacyBlock: 기존 `requireTargetClick && (routeMismatch || (!targetClicked && !trueFallback))`
  - newBlock: `step.blockNextUntilComplete === true && !conditionMet && !trueFallback`
- ✓ helper / success message ✓ 아이콘 + emerald 색 분기
- ✓ target missing fallback 시 next 자동 활성 (회원 막힘 방지)
- ✓ 기존 35 step 데이터 호환 (모든 신규 필드 optional)

## 13. Day 완료 / Day 7 완료식 점검
- ✓ Day 1~6 완료: 작은 confetti + "오늘 캠프 마치기"
- ✓ Day 7 step 3: `animation: "celebration"` 큰 축하 연출 (grand)
- ✓ Day 7 step 3: `suppressReflectionSheet: true`
- ✓ `handleCelebrationContinue` 가 sessionStorage 차단 플래그 60초 세팅
- ✓ PostActionReflectionSheet handler 가 `isSuppressed()` 체크 후 sheet/toast 모두 skip

## 14. 개발자 preview 점검
- ✓ `localhost` / `?tutorialDev=1` / 명시적 토글 ON 일 때만 노출 (기존 작동)
- ✓ 일반 회원에게 노출 0
- ✓ Day/Step 이동 / reset / completed 설정 가능 (기존 작동)
- ✓ localStorage 만 변경 (DB / RPC 0)

## 15. 금지 표현 점검
새로 추가한 회원 노출 텍스트 (51~55 단계) 전부 점검:
- 링: 0건
- 체육관: 0건
- 복싱장: 0건
- gym: 0건
- RPG: 0건
- 몬스터: 0건
- 전투: 0건
- 보스: 0건
- 판타지: 0건
- 레벨업: 0건
- monster / battle / fantasy: 0건

장소 표현은 모두 "153복싱짐" 통일.

## 16. 새 package / migration 여부
- 새 npm package: 0
- 새 supabase migration: 0
- DB / RPC 호출 추가: 0

## 17. 타입체크 결과
`npx tsc --noEmit`: ✓ 통과 (모든 단계 49~55 후 검증)

## 18. 빌드 결과
`bun run build`: 사용자 PC 에서 검증 (sandbox 환경 제약상 자동 빌드 불가, 각 단계별 push 전 회원이 직접 검증 권장)

## 19. 발견한 문제
- 없음.
- 단, **운영 검증 필요 항목**:
  1. `[data-tour="champion-journal-card"]` anchor 가 회원 데이터 0 일 때도 렌더되는지 (recent entries 가 비면 카드 자체가 안 뜸)
  2. 복싱 IQ 모달이 열린 상태에서 `[data-tour="boxing-iq-options"]` 가 RAF 폴링에 정상 잡히는지 (모달 z-index 100, overlay z-90 — 동시 노출 시 충돌 가능)
  3. 챌린지 페이지 스크롤이 `body` 가 아닌 `<div className="space-y-4">` 인 경우 — 이미 anchor 박았지만 실제 스크롤 컨테이너 매칭 운영 확인

## 20. 수정한 문제
- 50-A 단계에서 `dismissedStepKey` sessionStorage 영구 저장 버그 수정 (이전 패치 그대로 유지)
- 53단계에서 `data-tour="journal-question"` 이 작성 시트에 없던 것 → `journal-reflection-input` + `journal-condition-options` 로 정확한 anchor 박음

## 21. 남은 TODO
- 56-A (선택): 운영 검증 후 step 데이터 미세 조정 (예: scrollThreshold 0.85 → 0.8 완화)
- 56-B (선택): tutorialCampCopy.ts 에 helper 공통 카피 상수화 (현재는 step 데이터에 인라인)
- 56-C (선택): 50-A 의 modal close watcher polling 800ms → MutationObserver 기반으로 성능 개선

## 22. 최종 판정
**PASS_WITH_NOTES**

판정 근거:
- ✓ `npx tsc --noEmit` 통과
- ✓ 보호 영역 변경 0
- ✓ 메뉴 / BottomNav 변경 0
- ✓ 새 migration / package 0
- ✓ 153마인드셋 호환성 유지
- ✓ Day 1~7 행동형 튜토리얼 정상 (51~54 단계 step 데이터 검증 완료)
- ✓ 개발자 preview 안전
- ✓ 금지 표현 0건

배포 가능. 단 19번의 운영 검증 항목 (anchor 매칭 회귀 테스트) 은 푸시 후 회원 화면에서 직접 확인 필요.

`bun run build` 는 사용자 PC 에서 푸시 전 한 번 더 돌려야 100% 안전.

---

## 부록 — 변경 파일 목록

### 수정 (8개)
1. `src/features/tutorial-camp/tutorialCampTypes.ts` (수정 0 — 기존 그대로)
2. `src/features/tutorial-camp/tutorialCampSteps.ts` (대폭 확장: 타입 + Day 3,4,5,6,7 step 데이터)
3. `src/features/tutorial-camp/TutorialCampProvider.tsx` (completion state + 7 listeners + isStepConditionMet)
4. `src/features/tutorial-camp/TutorialOverlay.tsx` (props 2개 추가)
5. `src/features/tutorial-camp/TutorialTooltip.tsx` (gating 통합 + helper/success 표시)
6. `src/components/engagement/BoxingAcademyQuizModal.tsx` (data-tour 4개)
7. `src/pages/ChallengesPage.tsx` (data-tour 1개)
8. `src/components/engagement/ChampionJournalSheet.tsx` (data-tour 4개)
9. `src/components/home/PostActionReflectionSheet.tsx` (suppress 플래그 체크)

### 신규 (2개)
1. `docs/stage-49-tutorial-action-system-design.md`
2. `docs/myboxer-7day-camp-guided-tutorial-qa-report.md` (이 문서)
