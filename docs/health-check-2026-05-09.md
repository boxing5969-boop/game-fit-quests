# 마이복서153 — 자동 점검 리포트

**일시**: 2026-05-09
**범위**: build / typecheck / lint / 코드 냄새 / 튜토리얼 selector / 번들 크기
**원칙**: 점검만, 수정 X — 깨어나서 검토 후 fix 결정

---

## 1. 요약 (TL;DR)

| 항목 | 결과 | 상태 |
|---|---|---|
| `bun run build` | exit 0, 25초, 75% 이미지 압축 | ✅ |
| `npx tsc --noEmit` | exit 0, 에러 0 | ✅ |
| `npx eslint src/` | 201 errors / 40 warnings | ⚠️ |
| 보호 영역 침범 | 없음 (HomePage / MissionsPage 변경은 사용자 명시 동의) | ✅ |
| 튜토리얼 selector 매칭 | 13개 의심 (대부분 false positive 가능) | ⚠️ |
| 큰 번들 chunk | index.js 564KB / charts.js 499KB / qr.js 359KB | ⚠️ |

**즉시 수정 권장 (우선순위 P0)**: react-hooks/rules-of-hooks 위반 2건. 런타임 크래시 위험.
**수정 권장 (P1)**: ExtendHome.tsx + StoryWorldOverview.tsx 의 조건부 useMemo.
**나머지 errors**: 대부분 `no-explicit-any` (186건) — production 영향 없음, 타입 안정성만 약함.

---

## 2. 빌드

```
✓ 3459 modules transformed.
✓ built in 25s
💰 total savings = 21,449.74kB / 28,758.53kB ≈ 75% (이미지 압축)
```

✅ 정상.

### 큰 JS 번들 (gzip 전)

| 파일 | 크기 | 메모 |
|---|---|---|
| `dist/assets/index-*.js` | 564 KB | main 번들 — 코드 스플리팅 더 가능 |
| `dist/assets/charts-*.js` | 499 KB | recharts — 사용 페이지에서만 lazy-load 검토 |
| `dist/assets/qr-*.js` | 359 KB | html5-qrcode — QRScannerModal 만 사용. lazy 가능 |
| `dist/assets/supabase-*.js` | 210 KB | 정상 |
| `dist/assets/MinigamePage-*.js` | 190 KB | 라우트 분리됨 |

> **개선 후보**: qr / charts 를 dynamic import 로 lazy-load 하면 first paint 200~400KB 절감 가능.

---

## 3. 타입체크 (`npx tsc --noEmit`)

✅ **에러 0건**. 깨끗한 상태.

---

## 4. ESLint (`npx eslint src --ext .ts,.tsx`)

총 **201 errors / 40 warnings**.

### Rule 별 카운트

| Rule | 횟수 | 등급 |
|---|---|---|
| `@typescript-eslint/no-explicit-any` | **186** | 낮음 — 타입 안정성 |
| `react-hooks/exhaustive-deps` | 15 | 중간 — stale closure 위험 |
| `react-refresh/only-export-components` | 11 | 낮음 — HMR 만 영향 |
| `no-console` (unused disable) | 14 | 정리 가능 |
| `no-empty` | 9 | 낮음 — 의도된 catch 누락 |
| `react-hooks/rules-of-hooks` | **2** | **높음 (런타임 크래시 가능)** |
| `prefer-const` | 2 | 낮음 |
| `@typescript-eslint/no-empty-object-type` | 2 | 낮음 |

### P0 — react-hooks/rules-of-hooks (즉시 수정 권장)

조건부 hook 호출은 React 가 dev 모드에서 throw + production 에서 hook 순서 mismatch 로 크래시 가능.

| 파일 | 위치 | 내용 |
|---|---|---|
| [src/components/diet/post/ExtendHome.tsx](src/components/diet/post/ExtendHome.tsx#L78) | 78:24 | `useMemo` 가 early return 후 호출됨 |
| [src/components/story-rpg/StoryWorldOverview.tsx](src/components/story-rpg/StoryWorldOverview.tsx#L78) | 78:24 | 동일 패턴 |

**fix 방법**: early return 을 useMemo 호출 뒤로 옮기거나, useMemo 안에서 조건 분기.

### P1 — react-hooks/exhaustive-deps (15건)

대부분 [src/pages/StoryRpgPage.tsx](src/pages/StoryRpgPage.tsx) — `routes`, `allChapters` 가 logical OR 로 매번 새 참조. 재mount 폭증 가능. useMemo 로 wrap 권장.

### P2 — no-explicit-any (186건)

대부분 보호 영역 / supabase types 우회용. **production 동작 영향 없음**. 시간 있을 때 단계적으로 generic 으로 교체.

집중 분포:
- [src/pages/SettingsPage.tsx](src/pages/SettingsPage.tsx) — 9건 (profile / progress 우회)
- [src/pages/MissionsPage.tsx](src/pages/MissionsPage.tsx) — 9건
- [src/pages/HomePage.tsx](src/pages/HomePage.tsx) — 8건

### P3 — no-console (unused disable directives)

이미 console 호출이 제거되었는데 `// eslint-disable-next-line no-console` 주석만 남아있음. 라인 정리 가능.

```
src/pages/diet/DietPostProgramPage.tsx:65, 69
src/pages/diet/DietTrackerPage.tsx:210
src/services/challengeService.ts:162, 195, 218
```

### P3 — no-empty (9건, 대부분 minigame)

`catch {}` 빈 블록. silent failure 의도된 곳이지만 lint 가 거슬리면 `catch { /* noop */ }` 주석 추가 권장.

```
src/features/minigame/components/GameScreen.tsx:147
src/features/minigame/components/MittDrillScreen.tsx:199, 320, 335
src/features/minigame/lib/defenseStorage.ts:72, 77
src/features/minigame/lib/mittDrillConfig.ts:122, 132, 211
```

---

## 5. console.* 사용처 (38건, 17 파일)

production 에 console 출력이 남아있는 파일. 대부분 dev 디버그용:

| 파일 | 카운트 |
|---|---|
| [src/services/storyRpgService.ts](src/services/storyRpgService.ts) | 6 |
| [src/components/QRScannerModal.tsx](src/components/QRScannerModal.tsx) | 5 |
| [src/services/challengeService.ts](src/services/challengeService.ts) | 4 |
| [src/hooks/useTutorialState.ts](src/hooks/useTutorialState.ts) | 4 |
| [src/hooks/useActivitySession.ts](src/hooks/useActivitySession.ts) | 3 |
| 기타 12 파일 | 1~2건씩 |

> 운영 디버그가 필요하면 그대로, 아니면 logger 로 추상화 권장.

---

## 6. TODO / FIXME / HACK (1건)

| 파일 | 위치 |
|---|---|
| [src/components/license/BoxerLicenseCard.tsx](src/components/license/BoxerLicenseCard.tsx) | 1건 |

내용 확인 후 처리 또는 정리 권장.

---

## 7. 튜토리얼 selector 매칭 점검

7일 캠프 / OSAM 5단계 가이드 selectors 28개 중 **13개 의심**.

대부분 **false positive 가능** — JSX 의 동적 attribute (`data-tour={\`white-league-tab-${tab.key}\`}`) 는 단순 grep 으로 매칭 안 됨. 실제 매칭은 런타임에 해결.

### 의심 selector 목록

```
data-tour="challenge-safety-check"     — Day 4 캠프 step
data-tour="challenge-submit"           — Day 4 캠프 step
data-tour="cheer-sticker"              — Day 6 캠프 step
data-tour="home-quest-recommendation"  — Day 3 캠프 step
data-tour="missions-league-header-white" — 신규 추가, 매칭됨 (false positive)
data-tour="quest-mini-academy"         — 동적 prop 일 가능성
data-tour="quest-mini-challenge"
data-tour="quest-mini-journal"
data-tour="second-cheer-list"          — Day 6 캠프
data-tour="white-league-tab-check"     — 동적 (`tab-${tab.key}`) — false positive
data-tour="white-league-tab-learn"     — 동적 — false positive
data-tour="white-league-tab-session"   — 동적 — false positive
data-tutorial-target="qr-checkin-button" — TodayActionCard 의 dataTour prop
```

**검증 방법**: 직접 해당 화면 진입 후 spotlight 가 표시되는지 확인.

> **권장 동작**: Day 4 (challenge), Day 6 (cheer) 의 selector 들이 실제로 코드에 없을 수도 있음. 회원이 실제 그 step 진입 시 fallback 모드로 대응되긴 하지만, 정확한 spotlight 위해 anchor 추가 검토.

---

## 8. Git 상태

### 추적 안 되는 파일 (untracked)

```
docs/ai-coding-handoff.html
docs/ai-coding-handoff.pdf
docs/myboxer-7-day-tutorial-plan.md
docs/myboxer-7day-camp-handoff.html
docs/myboxer-7day-camp-handoff.pdf
docs/myboxer-coding-handoff.html
docs/myboxer-coding-handoff.pdf
src/components/boxer-route/         (디렉토리)
src/data/boxerRouteContent.ts
src/hooks/useVisualizationProgress.ts
```

> docs/* PDF/HTML 은 commit 안 됨 — 의도된 것이라면 그대로, 보관 원하면 `git add docs/*.md docs/*.html docs/*.pdf` 후 commit.
> `src/components/boxer-route/`, `src/data/boxerRouteContent.ts`, `src/hooks/useVisualizationProgress.ts` 는 미사용 신규 코드 — 다른 변경에서 시작했다가 합치지 않은 듯. 사용 여부 검토 후 commit 또는 삭제.

### 최근 commit 10개

```
d85f667 feat(tutorial): step 4 — QR 카메라 켜면 자동 완료
7c98405 feat(tutorial): step 3 cascade ② — Lv.1 detail 3탭
7a8e4aa feat(tutorial): step 3 cascade ① — 올리그 + Lv.1 카드 강조
832d211 fix(settings): '오삼 5단계 가이드' 버튼 — local state 도 reset
ced7feb feat(missions): 라벨 변경 — 올리그 / 복싱 컨텐츠 / 화이트 리그 컨텐츠 영상
252c50a feat(guide): step 2 진행 시 6 탭 cascade
0215331 fix(settings): '오삼 5단계 가이드' 버튼 환영 모달 차단
a6f3bd0 feat(tutorial): step 2 안내 강화 '👆 여기를 클릭하세요'
17de07b feat(tutorial): 신규 회원 흐름 통합
e6a8985 feat(home/missions): 153 마인드셋 라벨 + 마스터 카드 훈련 탭 이전
```

✅ 보호 영역 침범 없음 (사용자 동의 후 변경된 파일만).

---

## 9. 권장 fix 우선순위 (깨어났을 때)

### 즉시 (P0) — 2건, 5분 작업

1. **react-hooks/rules-of-hooks** 2건 fix:
   - [src/components/diet/post/ExtendHome.tsx:78](src/components/diet/post/ExtendHome.tsx#L78)
   - [src/components/story-rpg/StoryWorldOverview.tsx:78](src/components/story-rpg/StoryWorldOverview.tsx#L78)
   - early return 을 useMemo 뒤로 이동

### 곧 (P1) — 30분 작업

2. **react-hooks/exhaustive-deps** 15건 — 특히 [StoryRpgPage.tsx](src/pages/StoryRpgPage.tsx) 의 `routes`, `allChapters` useMemo wrap
3. **no-empty** 9건 (minigame) — `catch { /* noop */ }` 으로 정리
4. **prefer-const** 2건 — let → const

### 시간 있을 때 (P2~P3)

5. **no-explicit-any** 186건 — 단계적으로 generic 으로 (한 번에 X)
6. **번들 코드 스플리팅** — qr / charts 를 dynamic import
7. **boxer-route 미사용 파일** 처리 (commit or delete)
8. **console.* 정리** — logger 추상화 또는 production 제거
9. **튜토리얼 selector 검증** — Day 4 / 6 캠프 step 실제 anchor 확인

### 회원 영향

- **현재 production 정상 동작** — build / typecheck 깨끗
- P0 두 건은 dev 모드에서 console error 발생 가능, 회원 영향 X (production strict-mode off 로 추정)
- 그 외는 모두 코드 위생 / 빌드 최적화 — 즉시 영향 없음

---

## 10. 자동 점검 한계

이 리포트가 검출 못 하는 항목:
- 브라우저 런타임 에러 / network 4xx-5xx
- 회원 흐름 회귀 (오삼 가이드 step cascade 가 실제로 작동하는지 등)
- 이미지/PNG 자체 결함 (이전 osami_smile 잔여물 같은 건 manual 검수 필요)
- DB / RPC 동작 (server-side)

> production smoke test (홈 진입 → 오삼 가이드 1~5단계 → 7일 캠프 Day 1) 한 번 돌려보는 게 가장 확실.

---

리포트 끝.
