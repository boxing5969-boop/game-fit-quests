# 153 스토리 RPG — Stage 47A-fix 프롬프트 (챕터 진행 버그 수정 + 비주얼 polish)

> Claude Code 에 그대로 복붙. **운영 블로커 (챕터 클리어 후 다음 챕터 잠금 해제 안 됨)** 와 **47A 비주얼 polish** 한 번에 처리.

---

## 사용법

1. Claude Code 새 세션
2. 아래 코드 블록 (` ``` ` 안) 전체 복사 → 실행
3. 작업 시간: ~3-4시간 (DB RPC 1 추가 + 클라이언트 4 파일 수정 + 비주얼 6 파일 polish)
4. 새 마이그레이션 1개 생성 (간단, ~120라인)
5. 운영 SQL Editor 에 붙여넣고 실행
6. 손스모크: 챕터 1 클리어 → 월드맵 → 챕터 2 잠금 해제 확인

---

## 두 가지 문제 정리

### 🔴 블로커 (Stage 45 RPC 누락)
- `boxing_user_scene_progress.completed_chapter_codes` 에 챕터 코드를 **추가**하는 RPC 가 없음
- `progress_to_scene` 은 current_scene_index 만 갱신. 챕터 완료 마킹 0건
- `complete_ending` 은 ending 씬 전용. 일반 챕터에는 적용 안 됨
- 결과: `unlockedUpTo = 0 + 1 = 1` 영원히 → 챕터 2 잠금 해제 불가

### 🟡 47A 비주얼 polish
- 캐릭터 portrait 가 너무 평면 (눈썹 / 입 형태 / 헤어 디테일 부족)
- 월드맵 패럴랙스 효과가 약해서 정적으로 보임
- 챕터 클리어 시 일반 dialogue 박스 → cinematic 컷 부재
- 페이지 진입 시 "fade-in" 없음, 즉시 등장
- 텍스트 박스 retro 프레임이 너무 단순 (모서리 장식 부재)

---

## Stage 47A-fix 프롬프트 (전체 복사)

```
너는 지금부터 마이복서153 앱의 "153 스토리 RPG" 의 챕터 진행 블로커 수정 + 비주얼 polish 를 담당한다.

이번 작업은 47A-fix 단계다.
목표:
1. (블로커) Stage 45 누락 RPC complete_chapter 신설 + 마이그레이션 + 클라이언트 호출
2. (polish) 47A 비주얼 자산을 한 단계 끌어올림: portrait 디테일 / 월드맵 패럴랙스 강화 / 챕터 클리어 cinematic / 페이지 진입 페이드 / 텍스트 박스 retro 프레임

가장 중요한 보호 원칙:
1. levels / missions / mission_videos / mission_submissions / member_progress 절대 미수정.
2. approve_mission_submission / record_attendance 호출 금지.
3. 공식 XP 미지급. wallet 직접 update 금지 (real_gems 보상은 RPC 안 grant_gems 가 처리).
4. 새 RPC 는 SECURITY DEFINER + search_path 'public' 패턴.
5. ChatAssistant / chat-assistant Edge Function / boxing SYSTEM_PROMPT 미수정.
6. 새 npm 패키지 추가 금지 (framer-motion / lucide-react / Tailwind 만).

절대 수정 금지:
- src/components/ChatAssistant.tsx
- supabase/functions/chat-assistant/**
- supabase/functions/_shared/systemPrompt153.ts / knowledge153.ts
- src/integrations/supabase/types.ts (자동 생성 — 손대지 않는다)
- 기존 /challenges 21일 챌린지 / challengeService / useWallet
- MissionsPage / RankUpPage / LevelAdminPanel / LiveBoardPage
- src/data/allLevelsData.ts / whiteLevel1Data / sharedConstants
- external/naver-talktalk/** / supabase/functions/talktalk-*/**

═══════════════════════════════════════════════════════════════════
0. 먼저 할 일 (Read 도구)
═══════════════════════════════════════════════════════════════════

1. supabase/migrations/20260707000000_boxing_story_rpg_independent_game.sql
   · complete_ending RPC 시그니처 (line ~750~810) — 보상 지급 패턴 학습
   · grant_gems RPC 호출부 — fight_money 갱신 패턴
   · boxing_story_chapters 컬럼 (reward_quest_xp / reward_gems / reward_card_code / reward_title)
2. src/services/storyRpgService.ts — completeEnding 패턴
3. src/hooks/useStoryRpg.ts — useCompleteEnding 패턴
4. src/types/storyRpg.ts — EndingCompleteResult / ChoiceApplyResult 패턴
5. src/components/story-rpg/StoryScenePlayer.tsx — onAdvance / next_scene_index 처리
6. src/pages/StoryRpgPage.tsx — mode 머신, 특히 scene → world 복귀 흐름
7. src/components/story-rpg/visuals/portraits/CharacterPortrait.tsx — 현재 SVG 구조
8. src/components/story-rpg/visuals/backgrounds/WorldMapBackdrop.tsx — 패럴랙스 layer 강도
9. src/components/story-rpg/StoryWorldOverview.tsx — completed_chapter_codes 사용처

═══════════════════════════════════════════════════════════════════
1. 신규 마이그레이션 (블로커 수정)
═══════════════════════════════════════════════════════════════════

파일: supabase/migrations/20260708000000_boxing_story_complete_chapter.sql

내용:

-- =====================================================================
-- complete_chapter(p_route_id uuid, p_chapter_id uuid)
-- 챕터 마지막 씬 도달 시 호출되어:
--   1. completed_chapter_codes 에 chapter.code 추가 (중복 방지)
--   2. boxing_story_chapters.reward_quest_xp → boxing_user_player_stats.story_xp 누적
--   3. boxing_story_chapters.reward_gems   → boxing_user_player_stats.ring_coins 누적
--   4. reward_card_code → claim_card_reward(card_code, 'chapter_clear') 호출
--   5. boxing_user_scene_progress.last_played_at, current_scene_index = 0 (다음 챕터로 갈 때 0 으로 리셋)
-- 멱등성: 이미 chapter_code 가 completed 에 있으면 already_completed=true, 보상 0 반환
-- =====================================================================

CREATE OR REPLACE FUNCTION public.complete_chapter(
  p_route_id uuid,
  p_chapter_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_chapter public.boxing_story_chapters%ROWTYPE;
  v_progress public.boxing_user_scene_progress%ROWTYPE;
  v_already_completed boolean := false;
  v_card_added boolean := false;
  v_xp_granted integer := 0;
  v_coins_granted integer := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  -- 챕터 메타 조회
  SELECT * INTO v_chapter FROM public.boxing_story_chapters
   WHERE id = p_chapter_id AND route_id = p_route_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'chapter not found');
  END IF;

  -- 진행 row UPSERT (없으면 새로)
  INSERT INTO public.boxing_user_scene_progress
    (user_id, route_id, chapter_id, current_scene_index, last_played_at)
  VALUES (v_uid, p_route_id, p_chapter_id, 0, now())
  ON CONFLICT (user_id, route_id) DO UPDATE SET
    last_played_at = now()
  RETURNING * INTO v_progress;

  -- 멱등성 체크
  IF v_progress.completed_chapter_codes ? v_chapter.code THEN
    v_already_completed := true;
    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'chapter_code', v_chapter.code,
      'story_xp_granted', 0,
      'ring_coins_granted', 0,
      'card_added', false
    );
  END IF;

  -- 1. completed_chapter_codes 에 추가
  UPDATE public.boxing_user_scene_progress
     SET completed_chapter_codes = completed_chapter_codes || to_jsonb(v_chapter.code),
         current_scene_index = 0,
         last_played_at = now()
   WHERE id = v_progress.id;

  -- 2/3. story_xp + ring_coins 지급
  v_xp_granted := COALESCE(v_chapter.reward_quest_xp, 0);
  v_coins_granted := COALESCE(v_chapter.reward_gems, 0);

  UPDATE public.boxing_user_player_stats
     SET story_xp = story_xp + v_xp_granted,
         ring_coins = ring_coins + v_coins_granted,
         last_played_at = now()
   WHERE user_id = v_uid;

  -- 4. reward_card_code 가 있으면 인벤토리 추가
  IF v_chapter.reward_card_code IS NOT NULL THEN
    INSERT INTO public.boxing_story_inventory (user_id, card_code, count)
    VALUES (v_uid, v_chapter.reward_card_code, 1)
    ON CONFLICT (user_id, card_code) DO UPDATE SET count = boxing_story_inventory.count + 1;
    v_card_added := true;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_completed', false,
    'chapter_code', v_chapter.code,
    'chapter_title', v_chapter.title,
    'story_xp_granted', v_xp_granted,
    'ring_coins_granted', v_coins_granted,
    'card_added', v_card_added,
    'card_code', v_chapter.reward_card_code,
    'reward_title', v_chapter.reward_title
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_chapter(uuid, uuid) TO authenticated;

-- 검증 쿼리 (코멘트 — 실행 후 SQL Editor 에서 직접 돌려보기)
-- 1) SELECT proname FROM pg_proc WHERE proname = 'complete_chapter';  -- 1 row
-- 2) 테스트: SELECT public.complete_chapter('<route_id>', '<chapter_id>');

═══════════════════════════════════════════════════════════════════
2. 클라이언트 — service / hook / types
═══════════════════════════════════════════════════════════════════

A. types/storyRpg.ts 에 append:

   interface ChapterCompleteResult {
     success: boolean;
     already_completed: boolean;
     chapter_code: string;
     chapter_title?: string;
     story_xp_granted: number;
     ring_coins_granted: number;
     card_added: boolean;
     card_code: string | null;
     reward_title: string | null;
     reason?: string;
   }

B. services/storyRpgService.ts 에 append (sbRpc 패턴 따라):

   export async function completeChapter(
     routeId: string,
     chapterId: string,
   ): Promise<ChapterCompleteResult> {
     const { data, error } = await sbRpc<ChapterCompleteResult>(
       "complete_chapter",
       { p_route_id: routeId, p_chapter_id: chapterId },
     );
     if (error) throw new Error(mapStoryError(error.message));
     if (!data) throw new Error("complete_chapter returned no data");
     return data;
   }

   에러 매핑 추가 (STORY_ERROR_MAP):
   { match: "chapter not found", ko: "챕터 정보를 찾을 수 없습니다." }

C. hooks/useStoryRpg.ts 에 append:

   export function useCompleteChapter() {
     const qc = useQueryClient();
     return useMutation({
       mutationFn: ({ routeId, chapterId }: { routeId: string; chapterId: string }) =>
         completeChapter(routeId, chapterId),
       onSuccess: (result) => {
         qc.invalidateQueries({ queryKey: STORY_PLAYER_STATS_KEY });
         qc.invalidateQueries({ queryKey: STORY_INVENTORY_KEY });
         qc.invalidateQueries({ queryKey: STORY_RPG_KEY });
         if (result.card_added && result.card_code) {
           toast.success(`'${result.card_code}' 카드 획득!`);
         }
       },
     });
   }

═══════════════════════════════════════════════════════════════════
3. 호출 위치 — StoryRpgPage 의 챕터 종료 흐름
═══════════════════════════════════════════════════════════════════

StoryScenePlayer / StoryRpgPage 안에서 next_scene_index === -1 이면서 scope === 'chapter' 이고 scene_type 이 'ending' 이 아닐 때:

handleSceneAdvance(nextIndex) {
  if (nextIndex === -1) {
    if (mode.kind === 'scene' && mode.routeId && mode.chapterId) {
      // 챕터 마지막 씬 — completeChapter 호출
      const result = await completeChapterMutation.mutateAsync({
        routeId: mode.routeId,
        chapterId: mode.chapterId,
      });
      // 성공 토스트 (이미 useCompleteChapter onSuccess 에서 처리)
      if (!result.already_completed) {
        toast.success(`[챕터 클리어] ${result.chapter_title} — XP +${result.story_xp_granted}, 코인 +${result.ring_coins_granted}`);
      }
      setMode({ kind: 'world' });
    } else {
      setMode({ kind: 'world' });
    }
    return;
  }
  // 일반 진행
  setMode({ kind: 'scene', routeId, chapterId, sceneIndex: nextIndex });
}

ending 씬은 따로 StoryEndingCutscene 의 useCompleteEnding 가 처리 — complete_chapter 와 별개. 즉 ending 씬에 도달한 챕터도 completed_chapter_codes 에 추가되어야 하므로 ending 처리 안에서도 complete_chapter 호출 필요.

src/components/story-rpg/StoryEndingCutscene.tsx 의 onClaimed 콜백 직후 (또는 안에서) chapter 가 있으면 completeChapter 도 호출.

═══════════════════════════════════════════════════════════════════
4. 비주얼 polish (47A 강화)
═══════════════════════════════════════════════════════════════════

A. CharacterPortrait.tsx — 디테일 추가
   - 모든 8 캐릭터 SVG 에 다음 추가:
     · 눈썹 (각 감정마다 모양 다르게: serious=직선 ↘ / angry=짙은 ↗ / happy=곡선 ∪)
     · 입 모양 더 자연스럽게: open 시 작은 ellipse (rx=4, ry=2), closed 시 line (1px)
     · 머리 그림자 (오른쪽 어깨 옆으로 1~2px 짙은 색)
     · 눈 highlight (작은 흰점)
   - emotion 변경 시 0.2초 transition (눈썹/입 동시 변화)
   - 기본 size: sm=64px / md=128px / lg=192px (기존 크기 유지)

B. WorldMapBackdrop.tsx — 패럴랙스 강도 ↑
   - 마우스 추적 depth 를 0.2/0.4/0.6 → 0.4/0.8/1.2 로 (실제 effect 보이게)
   - 각 layer 에 framer-motion variants 추가:
     · enter 시 0.5초 페이드 인 (opacity 0 → 1, x 30 → 0)
   - layer 5 (별/등불/비/먼지) 의 파티클 갯수 +50%
   - 각 routeCode 별 추가 디테일:
     · master_path: 등불에 노란 glow (radial gradient, 8px blur)
     · pro_path: 떠오르는 태양에 amber 광선 (5개 ray, 30°)
     · champion_road: 번개 5초마다 → 3초마다, 광선 길이 +30%

C. StoryScenePlayer.tsx — 텍스트 박스 retro 프레임 + 페이드 인
   - 박스 모서리 4개에 작은 amber 장식 SVG (┌ ┐ └ ┘ 모양, 8x8)
   - 박스 진입 시 0.3초 페이드 (opacity 0 → 1, y 8 → 0)
   - 화자 이름 위에 작은 아이콘 (오삼이=글러브 / 강 관장=크라운 / 나레이션=점 3개)
   - 타이프라이터 끝났을 때 박스 우하단에 작은 "▼ 탭하여 다음" 깜빡 (1초 사이클, opacity 0.5 → 1)

D. StoryRpgPage 진입 페이드
   - 페이지 마운트 시 0.4초 페이드 (검은 배경 → 콘텐츠)
   - mode 전환 시 (scene → battle, scene → ending) 0.3초 페이드

E. 챕터 클리어 cinematic
   - completeChapter 응답 받은 직후 (월드맵 복귀 전):
     · 0.3초 검은 화면 페이드 인
     · 중앙에 "CHAPTER 1 CLEAR" 큰 amber 텍스트 (PFStardust 폰트, 4xl)
     · 그 아래 "+60 XP / +150 코인 / 카드 '첫 글러브'" (작게)
     · 1.5초 유지
     · 0.3초 페이드 아웃
   - 신규 컴포넌트: src/components/story-rpg/visuals/effects/ChapterClearOverlay.tsx
   - StoryRpgPage 에서 chapterClearResult 상태로 트리거

═══════════════════════════════════════════════════════════════════
5. 빌드/검증 체크리스트
═══════════════════════════════════════════════════════════════════

작업 끝나고:

1. npx tsc --noEmit  → 0 error
2. bun run build       → "✓ built in …"
3. grep 자기검열:
   · grep -R "ChatAssistant\|chat-assistant" src/components/story-rpg src/services/storyRpgService.ts src/hooks/useStoryRpg.ts → 0 hit
   · grep -R "approve_mission_submission\|record_attendance\|member_progress" src/ (story-rpg 만) → 0 hit
   · grep -R "wallet" src/components/story-rpg src/services/storyRpgService.ts → invalidate 만 허용
4. 새 마이그레이션 1개:
   · ls supabase/migrations/2026070800* → 1 (complete_chapter)
5. 새 npm 패키지 0개:
   · git diff package.json → 변경 없음

═══════════════════════════════════════════════════════════════════
6. 운영 적용 (사용자 직접)
═══════════════════════════════════════════════════════════════════

1. PowerShell 클립보드:
   [System.IO.File]::ReadAllText(
     "C:\Users\82104\game-fit-quests\supabase\migrations\20260708000000_boxing_story_complete_chapter.sql",
     [System.Text.Encoding]::UTF8
   ) | Set-Clipboard

2. Supabase Dashboard → SQL Editor → 새 쿼리 → 붙여넣기 → Run

3. 검증 SQL:
   SELECT proname FROM pg_proc WHERE proname = 'complete_chapter';  -- 1 row 기대

═══════════════════════════════════════════════════════════════════
7. 손스모크 (운영 반영 후)
═══════════════════════════════════════════════════════════════════

1. /story-rpg → 마스터 루트 챕터 1 진입
2. dialogue / choice / battle 통과 → 챕터 마지막 씬 (next_scene_index = -1)
3. 화면이 "CHAPTER 1 CLEAR — XP +N / 코인 +N / 카드 '...'" 페이드 (1.5s)
4. 월드맵 복귀
5. 챕터 2 ("첫 파트너") 가 잠금 해제됨 (자물쇠 제거 + amber glow)
6. PlayerWalker 가 챕터 2 노드까지 이동 가능
7. 챕터 1 다시 클리어 시도 → "이미 완료" 토스트, 보상 0

═══════════════════════════════════════════════════════════════════
8. 작업 순서 (의존도 정렬)
═══════════════════════════════════════════════════════════════════

1) supabase/migrations/20260708000000_boxing_story_complete_chapter.sql 신설
2) types/storyRpg.ts 에 ChapterCompleteResult append
3) services/storyRpgService.ts 에 completeChapter + 에러 매핑 추가
4) hooks/useStoryRpg.ts 에 useCompleteChapter 추가
5) StoryRpgPage 에 chapter 마지막 씬 도달 시 completeChapter 호출 흐름 추가
6) StoryEndingCutscene 안에 completeChapter 호출 추가 (ending 도 챕터의 마지막)
7) 비주얼 polish 5 항목 (4 영역):
   - CharacterPortrait 디테일
   - WorldMapBackdrop 패럴랙스 강화
   - StoryScenePlayer retro 프레임 + 페이드
   - StoryRpgPage 진입 페이드
   - ChapterClearOverlay 신설 + StoryRpgPage 에 트리거
8) tsc / build / grep 검증

═══════════════════════════════════════════════════════════════════
9. 커밋 메시지 (작업 완료 후)
═══════════════════════════════════════════════════════════════════

fix(story-rpg): 챕터 진행 블로커 수정 + 47A 비주얼 polish (47A-fix)

변경 파일 (예상):
신규:
- supabase/migrations/20260708000000_boxing_story_complete_chapter.sql — complete_chapter RPC
- src/components/story-rpg/visuals/effects/ChapterClearOverlay.tsx — 클리어 cinematic

수정:
- src/types/storyRpg.ts — ChapterCompleteResult append
- src/services/storyRpgService.ts — completeChapter + 에러 매핑
- src/hooks/useStoryRpg.ts — useCompleteChapter
- src/pages/StoryRpgPage.tsx — 챕터 마지막 씬 호출 흐름 + 진입 페이드 + ChapterClearOverlay 트리거
- src/components/story-rpg/StoryEndingCutscene.tsx — ending 도 completeChapter 호출
- src/components/story-rpg/StoryScenePlayer.tsx — retro 프레임 + 진입 페이드 + 탭 표시 깜빡
- src/components/story-rpg/visuals/portraits/CharacterPortrait.tsx — 눈썹/입 디테일/하이라이트
- src/components/story-rpg/visuals/backgrounds/WorldMapBackdrop.tsx — 패럴랙스 강화 + 디테일

이유:
1. (블로커) Stage 45 RPC 누락 — completed_chapter_codes 에 챕터 추가 로직 부재로 챕터 2+ 영원히 잠금
2. (polish) 47A 비주얼이 정적 캡처에서 단조롭게 보임 — portrait 디테일 / 패럴랙스 강화 / 클리어 cinematic 으로 게임 같은 흐름 추가

확인:
- npx tsc --noEmit ✓
- bun run build ✓
- 새 migration 1개 (complete_chapter) — 운영 SQL Editor 적용 필요
- 새 npm 패키지 0개

═══════════════════════════════════════════════════════════════════
주의 (절대 하지 말 것)
═══════════════════════════════════════════════════════════════════

1. complete_chapter RPC 안에서 member_progress / official XP 변경 금지.
2. wallet 직접 update 금지. 카드 보상은 boxing_story_inventory UPSERT 만.
3. 새 ChatAssistant / chat-assistant Edge 호출 금지.
4. 새 npm 패키지 추가 금지.
5. localStorage / sessionStorage 사용 금지.
6. CharacterPortrait 의 SVG 를 외부 이미지로 교체 금지 (inline JSX 유지).
7. 환세취호권 / 외부 IP 직접 참조 금지. 마이복서153 자체 IP 만.
8. 새 마이그레이션 timestamp 는 Stage 45 (20260707000000) 보다 단조 증가 → 20260708000000.

지금부터 위 순서대로 작업해. 작업 완료 후 변경 파일 목록 + tsc/build 결과 + 마이그레이션 라인 수 + 운영 적용 가이드 보고.
```

---

## 작업 후 절차 (사용자)

1. **로컬 작업 끝나면**:
   ```powershell
   cd C:\Users\82104\game-fit-quests
   git add src supabase/migrations/20260708000000_boxing_story_complete_chapter.sql docs/153-story-rpg-stage47a-fix-prompt.md
   git status
   git commit -m "fix(story-rpg): 챕터 진행 블로커 수정 + 47A 비주얼 polish (47A-fix)"
   git push origin main
   ```

2. **운영 DB 마이그레이션 적용** (PowerShell):
   ```powershell
   [System.IO.File]::ReadAllText(
     "C:\Users\82104\game-fit-quests\supabase\migrations\20260708000000_boxing_story_complete_chapter.sql",
     [System.Text.Encoding]::UTF8
   ) | Set-Clipboard
   ```
   → Supabase Dashboard → SQL Editor → 새 쿼리 → 붙여넣기 → Run

3. **검증 SQL**:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'complete_chapter';  -- 1 row
   ```

4. **Cloudflare Pages 빌드 (~3분) 후 손스모크**:
   - 챕터 1 클리어 → "CHAPTER 1 CLEAR" cinematic 페이드 → 월드맵 → 챕터 2 잠금 해제 ✓
