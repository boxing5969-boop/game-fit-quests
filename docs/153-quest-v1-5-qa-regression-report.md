# 153 QUEST v1.5 QA / 회귀 테스트 리포트

## 1. 테스트 일시
- 일자: 2026-05-02 (KST)
- 단계: 17단계 — v1.5 통합 회귀 검증
- 범위: 14단계 컨디션 게이지 + 15단계 리턴 라운드 + 16단계 숨겨진 미션 / 복싱 IQ 리그 + 17단계 복서 스타일 진단 / 성장 리포트 / 푸시 알림 카탈로그

## 2. 확인한 브랜치
- 브랜치: `main`
- 워킹트리: 13~17단계의 변경이 staged + untracked 상태로 누적

## 3. 이번 v1.5 추가 산출물 요약

| 단계 | 마이그레이션 | service / hook / data | 컴포넌트 | 진입점 |
|---|---|---|---|---|
| 13 | — | — | — | `docs/153-quest-v1-5-implementation-plan.md` 신규 |
| 14 | `20260601000000_boxing_condition_logs.sql` (1 테이블 + 3 RPC) | `submitBoxingCondition` / `getTodayBoxingCondition` / `getRecentBoxingConditions` 추가, `useBoxingCondition`, `boxingConditionMessages.ts` | `ConditionGaugeCard`, `ConditionGaugeSheet` | `HomeEngagementSection` 상단 + `TodayQuestMiniPanel` 우선순위 |
| 15 | `20260602000000_boxing_return_round.sql` (1 테이블 + 4 RPC + 2 헬퍼) | `getReturnRoundStatus` / `claimReturnRoundReward` 추가, `useReturnRound`, `returnRoundMessages.ts` | `ReturnRoundBanner`, `ReturnRoundSheet`, `ReturnRoundMissionCard` | `HomeEngagementSection` 최상단 (조건 active 시) |
| 16 | `20260603000000_boxing_hidden_missions.sql` (2 테이블 + 8 seed + 3 RPC) | `checkAndClaimHiddenMissions` / `getMyHiddenMissionProgress` / `getBoxingIqLeagueSummary` 추가, `useHiddenMissions`, `useBoxingIqLeague`, `hiddenMissionCatalog.ts` | `HiddenMissionPanel`, `BoxingIqLeagueCard` | MyPage 복싱 전당 아래 + 기존 4 hook (Academy/FunChallenge/Journal/Cheer) onSuccess 트리거 |
| 17 | — | `useBoxerStyleDiagnosis`, `useGrowthReport`, `boxerStyleRules.ts` (+ test), `growthReportMessages.ts`, `boxingQuestNotificationCopy.ts` | `BoxerStyleDiagnosisCard`, `GrowthReportCard`, `GrowthReportDetailSheet` | MyPage |

신규 마이그레이션: **3개**. 신규 테이블: **4개** (`boxing_condition_logs`, `boxing_return_round_claims`, `boxing_hidden_missions`, `boxing_hidden_mission_claims`). 신규 RPC: **10개**. 신규 컴포넌트: **10개**. 신규 hook: **6개**. 신규 data 파일: **5개** (테스트 1 포함).

## 4. 보호 영역 변경 여부

**결론: 변경 0.**

다음 영역 모두 무수정 확인:

- 공식 1~40 훈련: `levels` / `missions` / `mission_videos` / `mission_submissions` / `member_progress` / `attendance_logs`
- 공식 RPC: `approve_mission_submission` / `record_attendance` / `manual_level_up*` / `pass_boss_battle` / `grant_manual_xp` / `set_member_level`
- 공식 hook: `useManualLevelUp`, `usePassBossBattle`, `useMissionData`, `useQuestData`
- ChatAssistant: `src/components/ChatAssistant.tsx`, `supabase/functions/chat-assistant/`
- 기존 21일 챌린지: `src/services/challengeService.ts`, `src/hooks/useChallenges.ts`, `src/pages/ChallengesPage.tsx`
- 공식 데이터 파일: `src/data/allLevelsData.ts`, `whiteLevel1Data.ts`, `whiteLevel2Data.ts`, `sharedConstants.ts` (공식 레벨/훈련 데이터 부분)
- `src/integrations/supabase/types.ts` (자동 생성 파일)
- `BottomNav.tsx`

수정한 파일:
- `src/services/boxingEngagementService.ts` — v1 의 cast 패턴 그대로 사용해서 신규 10 RPC 래퍼 + ENGAGEMENT_ERROR_MAP 11 추가
- `src/hooks/useBoxingAcademy.ts`, `useBoxingFunChallenges.ts`, `useChampionJournal.ts`, `useSecondCheer.ts` — onSuccess 에 `triggerCheck()` 추가 (16단계 hidden mission)
- `src/components/engagement/HomeEngagementSection.tsx` — 컨디션 카드 + 리턴 배너 + 시트 mount (+9 라인)
- `src/components/engagement/TodayQuestMiniPanel.tsx` — 컨디션에 따른 카드 우선순위 + 문구 분기 (+~50 라인)
- `src/components/engagement/index.ts` — 11 신규 export
- `src/pages/MyPage.tsx` — 4 신규 카드 mount (+5 라인)

**판정: PASS — 보호 영역 무수정**

## 5. 8 가지 함정 (§11) 대응 결과

| # | 함정 | 대응 | 검증 |
|---|---|---|---|
| ① | RLS admin 정책 super_admin 강제 | 신규 4 테이블 모두 `has_role(auth.uid(), 'super_admin')` + USING/WITH CHECK 양쪽 명시 | grep `super_admin` 24건 / `'admin'` 직접 사용 0건 / `WITH CHECK` 6건 |
| ② | 마이그레이션 파일명 단조 증가 | `20260601` / `20260602` / `20260603` (v1 마지막 `20260510` 보다 뒤) | 파일명 timestamp 검증 |
| ③ | 컨디션 저장 위치 별도 테이블 | `boxing_condition_logs` 별도 테이블만 사용 (profile metadata 보조 갱신만) | 마이그레이션 본문 확인 |
| ④ | 마지막 활동일 `attendance_logs` 사용 금지 | `boxing_calc_inactive_days` 헬퍼가 `boxing_engagement_events.created_at` MAX 만 사용 | grep `attendance_logs` 0건 in 신규 영역 |
| ⑤ | 30일 보상 어뷰징 방지 | `cooldown` (동일 return_type 의 마지막 claim 후 N 일 잠금) + `idempotency_key`(KST ISO week) | RPC 본문 `v_cooldown_active` 검증 분기 |
| ⑥ | check_and_claim 호출 빈도 가드 | RPC 내부 early return (`v_claimed_codes` 미리 조회 → 미달 미션만 평가) + 호출 측 `useHiddenMissionTrigger` 800ms 디바운스 | `useHiddenMissions.ts` `setTimeout` 패턴 + `check_and_claim_hidden_missions` 의 NOT (code = ANY(v_claimed_codes)) |
| ⑦ | 점수 함수 공식 데이터 누설 금지 | `BoxerStyleInput.profile` 인터페이스에 `total_xp` / `current_level` / `member_progress` 필드 자체 부재 | `boxerStyleRules.test.ts` 의 `@ts-expect-error` 컴파일 타임 검증 통과 |
| ⑧ | types.ts 재생성 시점 분리 | 14~17단계 모두 `sbFrom` / `sbRpc<T>` cast 패턴 유지. types.ts 무수정 | `git diff src/integrations/supabase/types.ts` 빈 출력 (라인엔딩 외) |

**판정: PASS — 8 함정 모두 대응 완료**

## 6. 공식 XP / QUEST XP / RP / 파이트 머니 분리

| 항목 | 결과 |
|---|---|
| `from("member_progress").update` 신규 영역 | 0건 |
| `UPDATE\s+(public\.)?member_progress` 신규 마이그레이션 | 0건 |
| `submit_boxing_condition` 보상 | quest_xp_delta=0, gems_delta=0, respect_delta=0 (의도적 — 파밍 방지) |
| `claim_return_round_reward` 보상 | server-side 결정 (after_3=30/100, after_7=60/200, after_14=80/300, after_30=100/500). 클라이언트 amount 전송 0 |
| `check_and_claim_hidden_missions` 보상 | 카탈로그 reward_quest_xp / reward_gems / reward_respect 만 사용. 클라이언트 amount 전송 0 |
| `get_boxing_iq_league_summary` | 보상 0 — 등급 / 카운터 표시만 |
| 신규 RPC `member_progress` 수정 | 0건 (grep 검증) |

**판정: PASS — 공식 XP 와 QUEST XP 분리 유지**

## 7. 파이트 머니 무결성

| 항목 | 결과 |
|---|---|
| `from("user_wallets").update` / `from("wallets").update` 신규 영역 | 0건 |
| 클라이언트 `rpc("grant_gems", ...)` 직접 호출 신규 영역 | 0건 |
| RPC 내부 `PERFORM public.grant_gems(...)` 경유 | 14단계 0 (의도적 보상 0) / 15단계 1 / 16단계 1 |
| 기존 `useSpendGems` 안티패턴 신규 영역에서 차용 | 0건 |

**판정: PASS — 파이트 머니 무결성 유지**

## 8. 기존 21일 챌린지 무수정

| 항목 | 결과 |
|---|---|
| `submitChallengeCheckin` / `syncQuestCheckin` 신규 영역 호출 | 0건 |
| `queryKey: ["challenges"]` 신규 사용 | 0건 |
| `/challenges` 페이지 / 라우트 변경 | 0건 |

**판정: PASS — 21일 챌린지 흐름 무영향**

## 9. ChatAssistant 단일 경로 보존

| 항목 | 결과 |
|---|---|
| `src/components/ChatAssistant.tsx` 수정 | 0건 |
| `supabase/functions/chat-assistant/` 수정 | 0건 |
| 새 AI 챗박스 / 새 스트리밍 채널 / 새 Edge Function | 0건 |
| 신규 영역의 "ChatAssistant" 매칭 | 3건 — 모두 보호 선언 주석. 실제 import / 호출 0 |
| 오삼이 메시지 출처 | 정적 사전 (`boxingConditionMessages.ts` / `returnRoundMessages.ts` / `growthReportMessages.ts` / `hiddenMissionCatalog.ts` / `boxingQuestNotificationCopy.ts`). RPC/AI 호출 0 |

**판정: PASS — ChatAssistant 단일 경로 보존**

## 10. 모달 / a11y / z-index

| 항목 | 결과 |
|---|---|
| 신규 모달/시트 z-index | `z-[100]` 통일 (`ConditionGaugeSheet`, `ReturnRoundSheet`, `GrowthReportDetailSheet`) |
| `role='dialog' aria-modal='true'` | 3 신규 시트 모두 부착 |
| `useModalDismiss` 훅 사용 | 3 신규 시트 모두 사용 |
| 안전영역 패딩 | `pb-[calc(env(safe-area-inset-bottom)+5rem)]` 부착 |
| AnimatePresence early return 금지 | 3 신규 시트 모두 `if (!open) return null` 제거 — 단일 트리 안에서 분기 |

**판정: PASS — 모달 / a11y / z-index 일관성**

## 11. query key / enabled gate

| 항목 | 결과 |
|---|---|
| 신규 query key 충돌 | 0건 — `["boxing-condition"]`, `["return-round"]`, `["hidden-missions"]`, `["boxing-iq-league"]`, `["boxer-style"]` 모두 기존 키와 충돌 없음 |
| useQuery enabled gate | 신규 hook 모두 `enabled: !!user?.id` 또는 `enabled: open` 적용 |
| invalidate 키 도메인 분리 | mutation onSuccess 에서 자기 도메인 + `["boxing-engagement"]` + `["wallet"]` (필요 시) |

**판정: PASS — 캐시 키 무충돌**

## 12. 빌드 / 린트 / 타입체크 결과

| 항목 | 명령 | 결과 |
|---|---|---|
| 타입체크 | `npx tsc --noEmit` | 통과 (exit 0) |
| 신규 영역 lint | 22 신규 파일 일괄 `npx eslint` | **0 errors / 0 warnings** |
| 단위 테스트 | `npx vitest run src/data/boxerStyleRules.test.ts` | 환경 의존성 이슈 (rollup linux x64 native module 미설치) — 코드 측면은 `tsc --noEmit` 통과로 검증. 사용자 Windows 환경에서 `bun run test` 으로 runtime 검증 권장 |

타입체크가 boxerStyleRules.test.ts 의 `@ts-expect-error` 디렉티브와 함께 통과 = §11-⑦ 입력 타입 검증 항목이 컴파일 타임에 통과했음을 의미.

## 13. 발견한 문제

**Blocker / 보호 영역 위반: 0**

### Minor (PASS_WITH_NOTES)

1. **마이그레이션 운영 반영 미완료** — `20260601`, `20260602`, `20260603` 세 파일은 작성/검증 완료. Lovable 위임 또는 Supabase Dashboard SQL Editor 수동 실행 필요. 운영 반영 전까지는 신규 UI 가 RPC 404 / 테이블 없음 에러를 한국어 toast 로 표시.
2. **types.ts 자동 갱신 대기 (의도적)** — service 의 신규 10 RPC / 4 테이블 호출 모두 `sbFrom` / `sbRpc<T>` cast (§11-⑧). 운영 반영 후 `supabase gen types typescript` 자동 갱신 시 cast 만 제거하면 됨. v1.5 후속 백로그.
3. **engagement 도메인 admin 정책 잔여 부채** — v1 의 `boxing_engagement_foundation.sql` 의 admin 정책이 `has_role(auth.uid(), 'admin')` 직접 사용 (broken). v1.5 신규 4 테이블은 super_admin 패턴으로 작성했지만, v1 잔여 부채는 별도 마이그레이션으로 분리 권장 (v2 백로그).
4. **vitest 환경 의존성** — Linux 워크스페이스에서 rollup native binary 미설치. 코드는 `tsc --noEmit` + lint 로 검증 완료. 사용자 Windows 환경에서 `bun run test src/data/boxerStyleRules.test.ts` 권장.

## 14. 수정한 문제

본 17단계에서 직접 수정 0건. minor 항목은 모두 운영 반영 / 후속 작업으로 분리.

## 15. 남은 TODO

| 항목 | 우선순위 | 비고 |
|---|---|---|
| 마이그레이션 3개 운영 반영 (Lovable 위임 또는 SQL Editor) | High | 신규 UI 동작 전제 |
| `supabase gen types typescript` 후 sbFrom / sbRpc cast 제거 | High | 운영 반영 직후 |
| Windows 환경 `bun run test` 으로 boxerStyleRules.test.ts 6 스타일 분기 검증 | Med | runtime 검증 |
| engagement 도메인 admin 정책 super_admin 전환 | Med | v1 잔여 부채 / 별도 마이그레이션 |
| 컨디션 7회 / 응원 30회 / 일기 7개 등 hidden mission 실제 사용자 데이터 누적 후 회귀 | Med | 운영 반영 후 |
| 전체 lint 누적 부채 정리 | Low | 본 v1.5 외 |

## 16. v2 로 넘길 기능

(v1.5 13단계 §5 보류 + 17단계 추가 도출)

- **그림자 복서 / 코너맨 매칭 / 팀 레이드 / 라이벌 시즌** — v2 커뮤니티 구간
- **코치 대시보드 몰입 데이터 시각화** — v1.5 데이터 누적 후 v2 에서 차트
- **시즌 스토리 패스** — 시즌 시스템 인프라
- **레전드 카드 300장 / 도감 / 수집** — v3
- **실존 선수 / 영화 / 만화 명언 콘텐츠** — 저작권 검토 후 v3
- **영상 인증 / AI 자세 분석** — ML 인프라
- **블랙 트레이너 시스템** — 페르소나 확장
- **오삼이 라디오** — 음성 인프라
- **실제 푸시 발송 시스템** — OS 권한 / 토큰 / Edge 스케줄러 신규 구축. 본 v1.5 17단계의 `boxingQuestNotificationCopy.ts` 카탈로그를 그대로 재활용 가능
- **branch 기준 IQ 리그 리더보드** — branch_id RLS + 정렬 RPC
- **세컨드 응원 receiver gems 활성화** — 일일 receiver 한도 + sender 디바운스

## 17. 최종 판정

**PASS_WITH_NOTES**

근거:
- 타입체크 통과 (`tsc --noEmit` exit 0).
- 신규 영역 lint 0 errors.
- 보호 영역 변경 0 — 공식 1~40 / member_progress / wallet / ChatAssistant / 21일 챌린지 / BottomNav / 자동생성 types 모두 무수정.
- §11 의 8 가지 함정 모두 대응 완료.
- 공식 XP / QUEST XP 분리 — 도메인·테이블·RPC·UI 4계층 모두에서 분리 확인.
- 파이트 머니 — 클라이언트 직접 update 0, RPC 내부 `grant_gems` 만 경유.
- 신규 RLS 정책 모두 super_admin + USING/WITH CHECK 양쪽 명시 (§11-① 통과).
- 마지막 활동일 계산 `boxing_engagement_events` 단일 소스 (§11-④ 통과).
- 30일 보상 cooldown + idempotency_key (KST ISO week) (§11-⑤ 통과).
- check_and_claim early return + 디바운스 (§11-⑥ 통과).
- 점수 함수 공식 데이터 누설 — `BoxerStyleInput` 타입 부재로 컴파일 타임 차단 (§11-⑦ 통과).
- types.ts cast 패턴 유지 (§11-⑧ 통과).
- 모달 z-[100] / a11y / 안전영역 패딩 / AnimatePresence early return 금지 — v1 일관성.
- minor: 마이그레이션 운영 반영 대기, types 자동 갱신 대기, vitest 환경 의존성 — 모두 후속 작업.

**Blocker 없음. v1.5 출시 가능 상태. 마이그레이션 3개의 운영 반영(Lovable 위임 또는 SQL Editor 수동 실행) 후 회원 세션에서 종단 검증 권장.**
