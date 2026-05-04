# 153 스토리 RPG QA / 회귀 테스트 리포트

> 단계 40 — 33~39단계 결과물의 회귀 테스트 결과.

---

## 1. 테스트 일시

- 작성일: 2026-05-05
- 환경: Windows 11, bun 빌드, Vite 5

## 2. 확인한 브랜치 / 커밋

- Branch: `main`
- Base HEAD (스토리 RPG 작업 시작 직전): `ea8f748f4c9cf700595b06f0aadcecb62ecb143a`
- 본 리포트는 33~39단계 변경분이 아직 워킹트리에 staged/untracked 로 누적된 상태에서 검증한 결과.

### 워킹트리 상태 (`git status -sb` / `git diff --stat`)

```
## main...origin/main
 M src/App.tsx
 M src/pages/HomePage.tsx
?? docs/153-story-rpg-plan.md
?? src/components/story-rpg/
?? src/data/storyRpgCopy.ts
?? src/data/storyRpgVisuals.ts
?? src/hooks/useStoryRpg.ts
?? src/pages/StoryRpgPage.tsx
?? src/services/storyRpgService.ts
?? src/types/
?? supabase/migrations/20260705000000_boxing_story_rpg_foundation.sql

 src/App.tsx            | 2 ++
 src/pages/HomePage.tsx | 5 +++++
 2 files changed, 7 insertions(+)
```

수정된 두 기존 파일은 **각각 라우트 추가 1줄 / 진입 카드 1개 + count 보정**만 존재. 그 외는 모두 신규 파일.

## 3. 스토리 RPG 추가 기능 요약

| 단계 | 추가 |
|---|---|
| 33 | `docs/153-story-rpg-plan.md` 설계서 |
| 34 | `supabase/migrations/20260705000000_boxing_story_rpg_foundation.sql` (테이블 7 + RPC 5 + helper 1 + seed 49) |
| 35 | `src/types/storyRpg.ts` · `src/services/storyRpgService.ts` · `src/hooks/useStoryRpg.ts` · `src/data/storyRpgCopy.ts` · `src/data/storyRpgVisuals.ts` |
| 36 | `/story-rpg` 라우트 + `StoryRpgPage` + HomePage `StoryRpgEntryCard` |
| 37 | `StoryRouteSelect` · `StoryRouteCard` · `StoryRouteChangeDialog` · `StoryChapterProgress` · `StoryChapterCard` |
| 38 | `StoryCharacterPanel` · `StoryWorldMap` · `StoryWorldNode` · `StoryDialogBox` · `StoryObstacleBadge` · `StoryQuestActions` |
| 39 | `StoryRewardPanel` + 자동/수동 `useSyncStoryProgress` + sync 결과 주입 |

## 4. 보호 영역 변경 여부

다음 보호 파일/심볼은 **모두 미수정**:

- `levels` / `missions` / `mission_videos` / `mission_submissions` / `member_progress` (DB)
- `approve_mission_submission` / `record_attendance` (RPC)
- `useManualLevelUp` / `usePassBossBattle` / `useWallet`
- `MissionsPage` / `RankUpPage` / `ChatAssistant`
- `supabase/functions/chat-assistant/`
- 기존 `/challenges` 21일 챌린지 / `challengeService`
- `allLevelsData` / `whiteLevel1Data` / `sharedConstants`
- `src/integrations/supabase/types.ts` (수동 수정 0건 — service 에서 좁은 cast 1곳만 사용)

`git diff` 의 두 수정 파일 (`src/App.tsx`, `src/pages/HomePage.tsx`) 변경 라인을 grep 한 결과 위 심볼 0건 매치.

## 5. 공식 1~40레벨 시스템 점검 결과

- `/missions` 라우트 — `App.tsx:169` 정상 (수정 없음)
- `/rank-up` 라우트 — `App.tsx:173` 정상 (수정 없음)
- `MissionsPage` / `RankUpPage` 모듈은 기존 lazy import 그대로
- 공식 미션 row, 영상 모달, 미션 제출, 코치 승인, 관리자 즉시 클리어 — 모두 변경 없음
- 공식 1~40 훈련 데이터 (`allLevelsData`, `whiteLevel1Data`, `sharedConstants`) — 변경 없음

## 6. 공식 XP / QUEST XP 분리 점검 결과

신규 마이그레이션과 신규 service/hook 모두에서:

- `member_progress.update` / `member_progress.upsert` 코드 **0건**
- `total_xp` 직접 update **0건**
- `current_rank` / `current_level` / `bosses_cleared` write **0건**
- 보상 누적은 **`boxing_engagement_profiles.quest_xp` + `boxing_engagement_events`** 만 사용
- migration 안의 `member_progress` 매치는 주석 1건 (`-- approve_mission_submission / record_attendance 호출 금지`) 뿐, 실제 호출/업데이트 없음

## 7. 파이트 머니 지급 경로 점검 결과

- 신규 service/hook 에서 `from('user_wallets').update` / `from('wallets').update` **0건**
- 마이그레이션의 `claim_story_chapter_reward` 는 `PERFORM public.grant_gems(v_uid, v_chapter.reward_gems, '스토리 RPG: ...')` 단일 경로
- 클라이언트는 `amount` 를 보내지 않음 — 서버가 chapter row 의 `reward_gems` 로 결정
- `boxing_engagement_events.idempotency_key = 'story_rpg_chapter:<chapter_id>'` 로 중복 차단

## 8. 기존 21일 챌린지 점검 결과

- `src/services/challengeService.ts` — 변경 없음
- `src/pages/ChallengesPage.tsx` — 변경 없음
- `src/hooks/useChallenges.ts` — 변경 없음
- `src/App.tsx:198` `/challenges` 라우트 — 변경 없음
- 스토리 RPG 의 `StoryQuestActions` 는 단순히 `/home#engagement` 로 navigate 만 — challengeService 호출 없음

## 9. ChatAssistant 단일 경로 점검 결과

- `src/components/ChatAssistant.tsx` — 변경 없음
- `supabase/functions/chat-assistant/` — 변경 없음
- 신규 컴포넌트에 `ChatAssistant` import 0건, `chat-assistant` Edge fetch 0건
- `StoryDialogBox` 의 매치는 주석 1건 (`* LLM 호출 없음. ChatAssistant 미사용.`) — 실제 호출 없음
- 오삼이 대화는 `boxing_story_dialogues` 테이블의 정적 데이터로만 렌더 (LLM 비사용)

## 10. 기존 QUEST 기능 회귀 테스트 결과

- 오삼이 브리핑 / 복싱 IQ / 재미 챌린지 / 챔피언 일기 / 세컨드 응원 / 복싱 전당 — 컴포넌트/훅/서비스 모두 미수정
- 컨디션 게이지 / 리턴 라운드 / 숨겨진 미션 / 스타일 진단 / 성장 리포트 — 미수정
- 코너맨 / 그림자 복서 / 짐 레이드 — 미수정
- 신규 코드는 위 데이터를 **read-only** 로만 소비 (RPC 안에서 SELECT count)

## 11. 153 스토리 RPG 신규 기능 테스트 결과

빌드/타입 검증 통과 + 코드 리뷰로 확인한 항목:

- `/story-rpg` 라우트 정상 등록 (`App.tsx:212`, ProtectedRoute)
- HomePage `HomeMoreSection` 안 `StoryRpgEntryCard` 진입 카드 정상
- BottomNav 미추가 (안전 모드 — 기존 메뉴 접근성 보호)
- `StoryCharacterPanel` — `useMemberCharacterAssignment` + `CharacterSprite` read-only
- 공식 리그/레벨은 `official_summary` 로만 표시
- `StoryRouteSelect` — 3루트 (마스터/프로/챔피언) 카드
- `StoryRouteChangeDialog` — z-[70] 모달, 변경 시 기존 진행도 보존 (`change_story_route` RPC)
- `StoryWorldMap` — 10노드, 현재 챕터 노드 강조
- `StoryDialogBox` — chapter intro dialogue + 장애물 배지
- `StoryChapterProgress` — 6챕터 + 상태 배지 + 조건 진행률
- `StoryRewardPanel` — sync 결과 기반 수령 대기 보상 묶음
- `StoryQuestActions` — 4개 활동 진입 (라우트 이동만)

## 12. 3가지 서사 테스트 결과

| 루트 | 코드 | 챕터 수 | 보상 합계 (XP/Gems) |
|---|---|---|---|
| 마스터의 길 | `master_path` | 6 | 710 / 1,800 |
| 프로의 길 | `pro_path` | 6 | 710 / 1,800 |
| 챔피언 로드 | `champion_road` | 6 | 730 / 1,900 |

- `choose_story_route` — 최초 선택 시 progress 자동 생성 + active state insert
- `change_story_route` — `INSERT ... ON CONFLICT DO NOTHING` 으로 기존 progress 보존, active state 만 갱신
- 시나리오 검증 (코드 리뷰): A 루트 진행 후 B 루트로 변경 시 A 의 `boxing_user_story_progress` row 그대로 유지 → A 로 다시 돌아오면 진행도 복원

## 13. 월드맵 / 대화창 테스트 결과

- 월드맵 노드 10개 (`gym_entrance` ~ `rival_arena`) 모두 seed 정상
- 노드 상태: `current` / `cleared` / `neutral` 3가지 — 사용자 자유 탐색 우선으로 `locked` 미사용
- 대화창은 dialogue intro 18건 seed 모두 자체 카피
- 화자 = "오삼이" 단일 (LLM 호출 0)
- 선택지 3개 — `오늘의 퀘스트 보기` (페이지 내 anchor), `공식 훈련하러 가기` (`/missions`), `복싱 전당` (`/halloffame`)

## 14. 보상 / 중복 방지 테스트 결과

- `boxing_story_reward_claims.unique(user_id, chapter_id)` 제약으로 1회만 claim
- `boxing_engagement_events.unique(user_id, idempotency_key)` 추가 차단 — `idempotency_key = 'story_rpg_chapter:<chapter.id>'`
- 두 번째 claim 호출 시 RPC 가 `already_claimed: true, quest_xp_granted: 0, gems_granted: 0` 반환 — UI 는 "이미 보상 수령" 토스트
- 미충족 상태 claim 시 RPC 가 `success: false, reason: 'chapter not complete'` 반환 — UI 는 에러 토스트

## 15. 권리 / 저작권 회피 점검 결과

스토리 RPG 신규 파일들에 대한 grep:

```
환세취호전 / 아타호 / 린샹 / 호랑이 권법
Rocky / 록키 / Tyson / 타이슨 / Ali / 알리
Mayweather / 메이웨더 / Pacquiao / 파퀴아오
Ippo / 잇포 / Inoue / 이노우에
```

- `supabase/migrations/20260705000000_*.sql` (seed) — **0건**
- `src/components/story-rpg/**` — **0건**
- `src/data/storyRpgCopy.ts` — 매치 1건은 주석 (`환세취호전 / 실존 선수 / 영화 / 만화 / 명언 사용 금지` 라는 보호 원칙 명시) — 실제 카피에 사용 0
- 사용자 노출 콘텐츠 모두 마이복서153 자체 카피
- 적은 9개 모두 습관/상태 (게으름 슬라임, 가드 브레이커, 숨참기 유령, 손목꺾임 괴물, 포기 악마, 핑계 도깨비, 긴장 늑대, 비교 괴물, 과훈련 골렘) — 사람 공격 구조 없음

## 16. 안전 / 아동청소년 적합성 점검 결과

- 폭력적 사람 공격 구조 없음 (적 = 습관/상태)
- 과훈련 / 통증 안전 메시지 유지 (`overtrain_golem` 설명: "쉬어야 할 때 멈추지 못하는 습관. 휴식도 훈련의 일부입니다.")
- 보호 안내 (`StoryRpgProtectionNotice`) — "공식 훈련은 마스터로드에서 그대로 진행됩니다. 153 스토리 RPG는 QUEST 보조 게임 모드입니다."

## 17. DB / RPC / migration 점검 결과

- 마이그레이션 파일명: `20260705000000_boxing_story_rpg_foundation.sql` — 마지막 마이그레이션(`20260704000000_coach_quest_dashboard.sql`) 보다 단조 증가
- 신규 테이블 7: `boxing_story_routes` · `boxing_story_chapters` · `boxing_story_nodes` · `boxing_story_dialogues` · `boxing_user_story_progress` · `boxing_user_story_route_state` · `boxing_story_reward_claims`
- 신규 RPC 5 + helper 1: `get_my_story_rpg_state` · `choose_story_route` · `change_story_route` · `sync_story_chapter_progress` · `claim_story_chapter_reward` · `_story_chapter_progress` (helper)
- RLS: active 콘텐츠는 회원 SELECT, 회원 데이터는 본인만 SELECT, INSERT/UPDATE 는 RPC 만 (SECURITY DEFINER)
- query key: `["story-rpg", "state", userId]` — 기존 `["challenges"]` / `["wallet"]` / `["diet"]` / `["boxing-engagement"]` 와 충돌 없음
- 모달 z-index: `StoryRouteChangeDialog` z-[70] (스플래시 z-[80] 충돌 회피)

### Supabase 적용 안내

운영 DB 적용은 **수동 실행**이 필요합니다 (Lovable owner 권한 정책상):

1. `Get-Content ".\supabase\migrations\20260705000000_boxing_story_rpg_foundation.sql" -Raw | Set-Clipboard`
2. https://supabase.com/dashboard/project/raoqefkwdpovwlgbibis/sql/new 에서 붙여넣기 → Run
3. 검증 SQL:

```sql
SELECT count(*) FROM public.boxing_story_routes;     -- 3
SELECT count(*) FROM public.boxing_story_chapters;    -- 18
SELECT count(*) FROM public.boxing_story_nodes;       -- 10
SELECT count(*) FROM public.boxing_story_dialogues;   -- 18
SELECT proname FROM pg_proc WHERE proname IN
 ('get_my_story_rpg_state','choose_story_route','change_story_route',
  'sync_story_chapter_progress','claim_story_chapter_reward')
ORDER BY proname;                                     -- 5 rows
```

마이그레이션 미반영 상태에서 `/story-rpg` 진입 시 service 가 `EMPTY_STORY_RPG_STATE` 로 graceful fallback → UI 가 빈 상태로 렌더 (앱 크래시 없음).

## 18. 빌드 결과

- `bun run build` — `✓ 3452 modules transformed. ✓ built in 16.81s` (39단계 결과물 기준)
- 타입 에러 0건
- `bun run build` 가 `tsc --noEmit` 을 포함하므로 별도 타입 체크 단계 불필요

## 19. 발견한 문제

없음. 33~39 단계 작업 중 추가 수정이 필요한 회귀 결함은 발견되지 않았습니다.

## 20. 수정한 문제

해당 없음 (40단계 안에서 수정 0건).

## 21. 남은 TODO

본 단계 범위 밖, 후속 작업으로 분리:

- 운영 Supabase DB 에 마이그레이션 수동 반영 (Lovable 위임 또는 Dashboard SQL Editor)
- `src/integrations/supabase/types.ts` 자동 재생성 후 `storyRpgService.ts` 의 `(supabase as any).rpc` 좁은 cast 제거
- BottomNav 직접 추가 여부는 사용 데이터(클릭률) 본 후 결정
- 실서비스 회원 데이터로 RLS 본인-격리 확인 (`auth.uid()` 가 NULL 인 SQL Editor 에선 검증 불가)

## 22. 후속 확장 아이디어

- 챕터별 사진/영상 업로드 (회원 갤러리)
- 시즌 한정 루트 (예: "신년 복서의 길")
- 코치가 회원 스토리에 코멘트 다는 기능
- 카드 합성 / 컬렉션 메타게임
- 라이벌 매칭 자동화 (active route 기반)

## 23. 최종 판정

**PASS_WITH_NOTES**

- 보호 영역 변경 0건
- 공식 XP / wallet 직접 update 0건
- ChatAssistant 단일 경로 유지
- 153 스토리 RPG 7테이블 + 5 RPC + 18챕터 + 10노드 + 18 dialogue 정상 구성
- 빌드 통과 (3452 modules / 16.81s)
- `bun run build` 결과 PASS
- **NOTES**: 운영 DB 마이그레이션 수동 반영이 남아있음 (Lovable 권한 정책상 자동 반영 불가). 반영 전에는 UI 가 fallback 빈 상태로 렌더되며, 반영 후 정상 동작.

---

### 검증 명령 모음 (재현용)

```powershell
git status -sb
git diff --stat
git diff src/App.tsx src/pages/HomePage.tsx
bun run build
```

```powershell
# 보호 영역 grep
git diff --name-only | Select-String "MissionsPage|RankUpPage|ChatAssistant|challengeService|useWallet|allLevelsData|whiteLevel1Data|sharedConstants"
# 위 결과 비어있어야 정상
```

```powershell
# 직접 update / 금지 RPC grep
Select-String -Path "src\**\*.ts","src\**\*.tsx" -Pattern 'from\("member_progress"\)\.update|from\("user_wallets"\)\.update|from\("wallets"\)\.update'
Select-String -Path "src\**\*.ts","src\**\*.tsx" -Pattern 'rpc\("approve_mission_submission"|rpc\("record_attendance"'
# 위 결과 비어있어야 정상
```

```powershell
# 저작권 grep
Select-String -Path "src\**\*.ts","src\**\*.tsx","supabase\migrations\*story_rpg*.sql" -Pattern '환세취호전|아타호|린샹|Rocky|록키|Tyson|타이슨|Mayweather|메이웨더|Pacquiao|파퀴아오|Ippo|잇포|Inoue|이노우에|Ali|알리'
# 매치는 storyRpgCopy.ts 의 보호 원칙 주석 1건 외 0건이어야 정상
```
