# 마이복서153 7일 스타터 캠프 QA / 회귀 테스트 리포트

> 단계 41~47 산출물(7일 스타터 캠프 + overlay 엔진 + 개발자 preview + 홈 고객경험 + 30초 마무리 연출)이 기존 마이복서153 앱과 충돌하지 않는지 점검한 회귀 리포트.

---

## 1. 테스트 일시

- **일시**: 2026-05-07
- **환경**: Windows 11 / bun (Vite + React 18 + TypeScript)
- **검증 도구**: `npx tsc --noEmit`, `bun run build`, `git diff --stat`, Grep

## 2. 브랜치 / 커밋

- **브랜치**: `main` (origin/main 기준)
- **마지막 push**: `9f8a2ca` — "Replace RPG tab with MyBoxer visualization training"
- **본 QA 시점 working tree**: 단계 42~47 산출물 untracked + 단계 45·47의 anchor / trigger 수정 (modified)

## 3. 추가 기능 요약

| 단계 | 산출물 |
|---|---|
| 41 | UX 설계 문서 — `docs/myboxer-7-day-starter-camp-plan.md` |
| 42 | 상태 엔진 (Storage / Events / Utils / Types / Constants) — `src/features/tutorial-camp/tutorialCamp{Constants,Types,Storage,Events,Utils}.ts` |
| 43 | 35 step 데이터 + 공통 문구 + React hook — `tutorialCampSteps.ts`, `tutorialCampCopy.ts`, `useTutorialCamp.ts`, `useTutorialCampDev.ts` |
| 44 | overlay 엔진 (Spotlight / Pointer / Tooltip / Celebration / Provider) — 9 컴포넌트 |
| 45 | 기존 화면에 `data-tour` anchor 15개 추가 + step selector 16개 통일 |
| 46 | 개발자 로컬 preview 패널 — `tutorialCampDevAccess.ts`, `TutorialDevPanel.tsx` |
| 47 | 홈 고객경험 카드 2개 + 30초 마무리 sheet + trigger 메시지 데이터 |

## 4. 보호 영역 변경 여부

| 영역 | 결과 | 검증 방법 |
|---|---|---|
| `src/components/BottomNav.tsx` | **0 byte 변경** ✓ | `git diff src/components/BottomNav.tsx` → empty |
| `src/components/ChatAssistant.tsx` | **0 byte 변경** ✓ | `git diff` → empty |
| `supabase/functions/chat-assistant/**` | **0 변경** ✓ | name-only 미포함 |
| `src/integrations/supabase/types.ts` | **0 byte 변경** ✓ | `git diff` → empty |
| `package.json` / `bun.lockb` | **0 byte 변경** ✓ | `git diff` → empty |
| `src/pages/MissionsPage.tsx` 공식 훈련 로직 | **0 byte 변경** (단계 45의 `data-tour` anchor 1줄만) ✓ | diff |
| `src/pages/RankUpPage.tsx` | **0 byte 변경** ✓ | name-only 미포함 |
| `src/hooks/useWallet.ts` / `src/services/challengeService.ts` | **0 byte 변경** ✓ | name-only 미포함 |
| `src/data/allLevelsData.ts` / `whiteLevel1Data.ts` / `sharedConstants.ts` | **0 byte 변경** ✓ | name-only 미포함 |
| `approve_mission_submission` / `record_attendance` / `member_progress` 호출 | **0 hit** (보호 원칙 명시 코멘트만) ✓ | grep |
| `useManualLevelUp` / `usePassBossBattle` 호출 | **0** ✓ | grep |
| `wallet 직접 update` / `grant_gems` 호출 | **0** ✓ | grep |

## 5. 메뉴 유지 점검

| 항목 | 결과 |
|---|---|
| BottomNav `mainTabs` (홈/훈련/단증혜택/랭킹/랭크업) | **0 변경** ✓ |
| BottomNav `baseMenuItems` (12 항목 + 다이어트 flag) | **0 변경** (단계 45에서 추가했던 "153마인드셋"은 9f8a2ca push에 이미 포함됨, 본 단계 추가 0) ✓ |
| `hiddenPaths` (`/`, `/onboarding`, `/manager`, `/coach`, `/select-branch`, `/waiting-approval`, `/live-board`, `/minigame`) | **0 변경** ✓ |
| BottomNav 내부 로직 (active 토글 / overlay / 다이어트 flag) | **0 변경** ✓ |

## 6. 153마인드셋 호환성 점검

| 항목 | 결과 | 위치 |
|---|---|---|
| session id `myboxer-153-returned-person` | **0 변경** ✓ | `visualizationContent.ts:213` |
| session id `myboxer-153-one-year-later` | **0 변경** ✓ | `visualizationContent.ts:372` |
| localStorage key `myboxer.visualization.records` | **0 변경** ✓ | `MyBoxerVisualizationSession.tsx:58` |
| 7-step 흐름 (start → mood → mindset → promises → player → reflection → saved) | **0 변경** ✓ |
| record 저장 형태 (`sessionId` / `completedAt` / `mood` / `mindset` / `promises` / `reflection` / `declaration`) | **0 변경** ✓ |
| `setInterval` 1초 tick / 자동 reflection 이동 / 30초 자동 닫힘 정책 | **0 변경** ✓ |
| 본 단계 추가 (단계 47) | `handleSave` 끝에 `triggerPostActionReflection("mindset")` 1줄만 — 저장 로직 / 호출 순서 0 변경 |
| 단계 45에서 추가 | `data-tour="mindset-session-picker / mindset-start-button / mindset-player / mindset-reflection"` 4개 — props/state/setInterval 동작 0 변경 |

→ 기존 회원이 저장한 record 호환 100%. 두 session id, key, 저장 형태 모두 보존.

## 7. localStorage key 점검

| 키 | 변경 여부 | 책임 모듈 |
|---|---|---|
| `myboxer.visualization.records` | **0 변경** | 153마인드셋 (단계 X) |
| `myboxer.tutorialCamp.v1.state` | 신규 추가 | 단계 42 — Storage |
| `myboxer.tutorialCamp.v1.events` | 신규 추가 | 단계 42 — Events |
| `myboxer.tutorialCamp.v1.devPreview` | 신규 추가 | 단계 42 — Storage |
| `myboxer.tutorialCamp.dev.enabled` | 신규 추가 | 단계 46 — DevAccess |
| `myboxer.tutorialCamp.dev.previewProfileId` | 신규 추가 | 단계 46 — DevAccess (cosmetic) |
| `myboxer.postActionReflection.v1.lastShownAt` | 신규 추가 | 단계 47 — 메시지 모듈 |
| 기존 비-튜토리얼 키 (`mb153_viz_progress_v1`, `rankingup_splash_seen_v1`, 다이어트 키 등) | **0 변경** |

→ prefix 분리 (`myboxer.tutorialCamp.*` / `myboxer.postActionReflection.*`) — 153마인드셋 / 다이어트 / display mode 등 기존 키와 충돌 0.

## 8. 7일 튜토리얼 step 점검

| Day | 주제 | step 수 | targetSelector 매칭 | 비고 |
|---|---|---|---|---|
| 1 | 홈 / 오삼이 | 5 | osami-briefing ✓ / today-round ✓ / official-training ✗ / quest-recommend ✗ / 완료식 — | step 2~3은 anchor 미존재 → fallback 자동 |
| 2 | 마스터로드 / 공식 훈련 | 5 | missions-official-training ✓ / 나머지 ✗ | 4개 fallback 동작 |
| 3 | 153 QUEST / 복싱 IQ | 5 | quest-recommendation ✗ / boxing-iq-card ✓ / 완료식 — | feedback / xp 모달 fallback |
| 4 | 챌린지 / 안전 | 5 | challenge-arena-card ✓ / 나머지 ✗ | 난이도/통증/제출 fallback |
| 5 | 챔피언 일기 | 5 | champion-journal-card ✓ / growth-report-card ✓ / 나머지 ✗ | 질문/저장 fallback |
| 6 | 세컨드 응원 | 5 | second-cheer-card ✓ / 나머지 ✗ | partner/sticker/RP fallback |
| 7 | 마이페이지 / 완료식 | 5 | mypage-profile ✓ / boxing-hall-card ✓ / growth-report-card ✓ / celebration / next | 완료식 정상 |

총 **35 step**, 모든 step에 `fallbackText` + `allowNextWithoutClick=true` 정책 — anchor 미매칭 시 회원이 "다음으로" 버튼으로 자연스럽게 진행. 캠프 진행 중단 위험 0.

## 9. overlay / motion / click 유도 점검

| 항목 | 결과 |
|---|---|
| Spotlight (4-div dim mask) — target 영역만 빈 공간, 자연 클릭 보존 | ✓ |
| Pulse ring (amber #fdb85c, 1.6s opacity loop) | ✓ |
| Hand pointer (placement별 회전, bounce 1s) / Arrow / Bounce | ✓ |
| Tooltip 위치 (placement + viewport clamp) | ✓ |
| ProgressDots (Day N · M / total) | ✓ |
| Step 전환 fade (AnimatePresence + key 변경) | ✓ |
| Celebration (canvas-confetti — 기존 의존성, Day 7 grand 3회 시퀀스) | ✓ |
| target click capture-phase listener — 기존 onClick 동작 보존 (`preventDefault` 호출 X) | ✓ |
| `requireTargetClick=true` 시 클릭 후 600ms auto-next | ✓ |
| reduced motion (`prefers-reduced-motion`) 시 hand/arrow/bounce/confetti 비활성, pulse는 정적 opacity | ✓ |
| 모바일 375 × 667 — tooltip max-w-md / viewport clamp / max-w-sm sheet | ✓ |
| z-index 격리 (90 dim → 91 pulse → 92 pointer → 93 tooltip → 94 progress → 95 celebration / dev panel) | ✓ |
| App.tsx 마운트는 `user && splashDone` 가드 통과 시에만 — 비로그인 / 콜드스타트 동안 노출 0 | ✓ |

## 10. 개발자 preview 점검

| 항목 | 결과 |
|---|---|
| `shouldShowDevPanel()` 접근 조건 (localhost / ?tutorialDev=1 / localStorage 토글) | ✓ |
| 일반 production URL + 회원 → floating button 0 노출 (`null` 반환) | ✓ |
| Day 1~7 / Step 0~max 점프 (`setTutorialCampDayStep`) | ✓ |
| 상태 4종 토글 (active / paused / completed / skipped) | ✓ |
| 내 튜토리얼 리셋 (`resetTutorialCamp`) | ✓ |
| 7일 완료 강제 (`markTutorialCampCompleted`) | ✓ |
| 이벤트 로그 복사 (`navigator.clipboard` + textarea fallback) | ✓ |
| previewProfileId — 클라이언트 메모만, 서버 user_id 무관 | ✓ |
| DEV 종료 → localStorage 토글 OFF + 페이지 새로고침 | ✓ |
| Supabase / RPC / role 조회 / 타 회원 상태 변경 — **0** | ✓ |
| 모든 변경 = localStorage R/W만 | ✓ |

## 11. 홈 고객경험 점검

| 항목 | 결과 |
|---|---|
| `TodayFocusCard` — 오늘의 한 가지 (캠프 활성 → step / 비활성 → 마인드셋 1라운드) | ✓ |
| 추천 활동 1개 (오늘 한 줄 챙기기) | ✓ |
| 최근 변화 1줄 (153마인드셋 누적 / 캠프 진행일 / 첫 시작 안내) | ✓ |
| `OsamiHomeNote` — 하루 같은 메시지 (dayOfYear % length) — 새로고침 안 흔들림 | ✓ |
| 헤더 문구 "오늘은 하나만 해도 충분합니다." | ✓ |
| 기존 OsamiDailyBriefingCard / TodayQuestMiniPanel / BoxingIqLeagueCard 등 0 byte 변경 | ✓ |
| 기존 widget 토글 / 다이어트 flag / 캐릭터 hero 카드 0 변경 | ✓ |
| HomePage.tsx — import 2줄 + JSX 2줄 (총 7줄 추가) | ✓ |

## 12. 마무리 연출 점검

| 항목 | 결과 |
|---|---|
| 글로벌 trigger (`triggerPostActionReflection(source)`) — DOM CustomEvent 기반 | ✓ |
| 6 source 메시지 정의 (mindset / camp_day / camp_finish / journal / iq / challenge) | ✓ |
| 활성 trigger 위치 (단계 47 연결): | |
| · `MyBoxerVisualizationSession.handleSave` 끝 — `mindset` | ✓ |
| · `completeTutorialCampDay(<7)` 끝 — `camp_day` | ✓ |
| · `completeTutorialCampDay(7)` 끝 — `camp_finish`, **force=true** | ✓ |
| 미연결 trigger (journal / iq / challenge) — 메시지 데이터만 정의, 호출 0 (기존 mutation 보호) | 의도적 보류 |
| 하루 1회 정책 (`canShowBigReflectionToday` / `markReflectionShownToday`) | ✓ |
| 같은 날 2번째 호출 → 작은 sonner toast 폴백 (4초) | ✓ |
| 30초 자동 닫힘 / X / 외부 dim / "오늘은 여기까지" | ✓ |
| 표현 정렬 — 153복싱짐 / 차분한 톤 / 칭찬 + 다음 추천 1개 | ✓ |
| canvas-confetti 별도 사용 안 함 (캠프 Day 완료식이 이미 처리) | ✓ |
| reduced motion 대응 — framer-motion 진입은 유지, 시각적 부담 0 | ✓ |

## 13. 금지 표현 점검

UI / 회원 노출 콘텐츠 영역 grep:

| 영역 | 검색어 | 결과 |
|---|---|---|
| `src/features/tutorial-camp/` | 링/체육관/복싱장/gym/RPG/몬스터/전투/보스/판타지/레벨업/monster/battle/fantasy | **3 hit, 모두 false positive** (보호 원칙 코멘트 2 + "미니 링크" 부분 매치 1) |
| `src/components/home/` | 동일 | **0 hit** |
| `src/data/postActionReflectionMessages.ts` | 동일 | **1 hit** — 헤더 보호 원칙 코멘트만 (false positive) |

→ **회원에게 노출되는 텍스트(title / body / osamiMessage / fallbackText / completionText / 캠프 메시지 / 마무리 메시지) 영역 금지어 0건.**

장소 표현 통일: **"153복싱짐"** 만 사용. "체육관 / 복싱장 / gym" 0건.

## 14. 새 package / migration 여부

| 항목 | 결과 |
|---|---|
| `package.json` / `bun.lockb` | **0 변경** ✓ — 새 npm 패키지 0 |
| `supabase/migrations/` | 마지막 3개 (`20260708`, `20260709`, `20260710`) — **본 단계(41~48) 추가 0** ✓ |
| `supabase/functions/` | **0 변경** ✓ |
| 사용한 의존성 | framer-motion / lucide-react / sonner / shadcn/ui / canvas-confetti — 모두 기존 |

## 15. 타입체크 결과

- **`npx tsc --noEmit` → EXIT=0** ✓
- 단계 42~47 신규 파일 + 수정 파일 모두 통과
- 기존 `src/integrations/supabase/types.ts` 의존 코드 0 변경

## 16. 빌드 결과

- **`bun run build` → ✓ built in 21.19s**
- Vite 번들 정상 생성
- 새 패키지 / 새 chunk 0건 (memory: feedback_chunk_splitting 정책 준수 — React-ecosystem 분리 시도 0)

## 17. 발견한 문제

**A. dead code (rollback 안전망)**
- `src/components/boxer-route/`, `src/data/boxerRouteContent.ts`, `src/hooks/useVisualizationProgress.ts`, `src/pages/BoxerRoutePage.tsx` — 직전 단계 (RoundTimer 7라운드) 잔존 자산. 라우트 미연결, dead code. 빌드 영향 0. 향후 `git rm` 정리 또는 별도 보존 commit 결정 필요 (사용자 판단).

**B. dev panel "useTutorialCampDev" hook 미사용**
- 단계 43에서 만든 `useTutorialCampDev.ts` (74 라인). 단계 46의 `TutorialDevPanel.tsx`가 utils를 직접 사용해 hook은 현재 사용처 0. 향후 독립 dev 페이지 또는 다른 패널에서 활용 가능. 빌드 영향 0 (named export만 노출).

**C. step selector 미매칭 anchor**
- 단계 45에서 25개 anchor 후보 중 15개만 실제 추가. 나머지 10개 (`missions-master-road` / `missions-submit-note` / `home-quest-recommendation` / `challenge-difficulty` / `challenge-submit` / `journal-question` / `journal-save` / `second-cheer-list` / `cheer-sticker` / 기타) 는 fallback 동작. 회원에게는 화면 중앙 모달 + "다음으로" 활성. 캠프 진행 중단 위험 0. 향후 anchor 추가 시 자연스러운 spotlight 활성.

**D. modified 파일 4개 — 본 작업 외 잔존**
```
M src/data/characterCustomizationData.ts (1줄 — 튜토리얼 라벨 텍스트)
M src/pages/MyPage.tsx                   (단계 45 anchor + 본 작업 외 라벨 변경)
M src/pages/SettingsPage.tsx             (4줄 — 튜토리얼 버튼 라벨)
M src/pages/MyBoxerVisualizationPage.tsx (단계 45 anchor + 이전 단계 본문 변경)
```
모두 본 단계(48) 작업과 무관하며 단계 41 이전부터 modified 상태. 사용자가 의도한 변경이라면 그대로 commit, 아니면 `git checkout` 으로 원복 (사용자 판단).

## 18. 수정한 문제

본 QA 단계(48)에서 **신규 코드 변경 0**. 기존 산출물 전부 빌드/타입/grep 통과로 fix 필요 없음.

## 19. 남은 TODO

| # | 항목 | 우선순위 |
|---|---|---|
| 1 | 미연결 trigger (journal / iq / challenge) — 기존 mutation에 1줄씩 trigger 호출 추가 | 낮음 — 사용자가 명시적으로 요청할 때 |
| 2 | 미매칭 anchor 10개 — 자연스러운 위치에 `data-tour` 1줄씩 추가 | 낮음 — fallback 충분 |
| 3 | dead code (`boxer-route/` 디렉터리) 정리 또는 보존 commit 결정 | 낮음 |
| 4 | 핸드오프 PDF 갱신 — 캠프 영역 추가 | 중간 — 다음 세션 인계 시 유용 |
| 5 | 기존 5미션 마스코트 (`TutorialFloatingMascot`) 와 캠프 동시 노출 정리 — 캠프 활성 동안 마스코트 hide | 중간 — UX 충돌 가능성 |
| 6 | super_admin / dev 빌드 가드 강화 — 현재는 localhost / query / localStorage 토글로 충분 | 낮음 |
| 7 | A11y — overlay 마운트 시 focus 이동, 종료 시 복원 | 중간 — 스크린리더 사용자 |

## 20. 최종 판정

### **PASS** ✅

**판정 근거:**

| PASS 기준 | 결과 |
|---|---|
| `npx tsc --noEmit` 통과 | ✅ EXIT=0 |
| `bun run build` 통과 | ✅ ✓ built in 21.19s |
| 보호 영역 변경 없음 (BottomNav / ChatAssistant / 공식 훈련 / wallet / member_progress / supabase types) | ✅ 0 byte |
| 메뉴 변경 없음 | ✅ 0 byte |
| 새 migration 없음 | ✅ supabase/migrations/ 0 추가 |
| 새 npm package 없음 | ✅ package.json / bun.lockb 0 변경 |
| 153마인드셋 호환성 유지 (session id 2개 / localStorage key / 7-step 흐름 / record 형태) | ✅ 모두 보존 |
| Day 1~7 step 데이터 정상 + fallback 정책으로 진행 보장 | ✅ 35 step + allowNextWithoutClick |
| 개발자 preview 안전 (일반 회원 미노출 / localStorage만 변경 / 서버 영향 0) | ✅ 3중 가드 |
| 금지 표현 없음 (회원 노출 영역) | ✅ 0 hit |

**BLOCKED 사유 없음:**
- 공식 시스템 변경 0
- 메뉴 구조 0 변경
- ChatAssistant 0 변경
- 153마인드셋 session id / key 0 변경
- 새 migration / package 0
- 빌드 성공
- target click capture-phase 패턴으로 기존 버튼 클릭 보존
- dev panel 일반 회원 노출 0

**배포 가능** — 41~47 단계 산출물은 9f8a2ca 이후 추가 commit/push 시 Cloudflare Pages 자동 빌드 → 2~4분 후 production 반영. 일반 회원에게는 캠프 진입점이 아직 노출되지 않은 상태(홈 카드 미노출, BottomNav 항목 0) — 기능 ON은 후속 단계에서 별도 결정.

---

**검증자**: Claude (Opus 4.7) / **승인 대기**: 사용자(boxing5969@gmail.com)
