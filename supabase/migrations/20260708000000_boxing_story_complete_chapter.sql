-- ============================================================
-- 153 스토리 RPG — complete_chapter RPC (Stage 47A-fix)
-- ============================================================
-- 목적: Stage 45 (20260707000000) 누락 RPC 추가.
--   챕터 마지막 씬 도달 시 호출되어:
--     1. boxing_user_scene_progress.completed_chapter_codes 에 chapter.code 추가 (중복 방지)
--     2. boxing_story_chapters.reward_quest_xp → boxing_user_player_stats.story_xp 누적
--     3. boxing_story_chapters.reward_gems   → boxing_user_player_stats.ring_coins 누적
--     4. reward_card_code 가 있으면 boxing_story_inventory UPSERT
--     5. current_scene_index 0 으로 리셋 (다음 챕터 진입 시 0 부터)
-- 멱등성: 이미 chapter_code 가 completed 에 있으면 already_completed=true, 보상 0 반환
--
-- 보호 원칙:
--   · levels / missions / member_progress 미수정.
--   · 공식 XP 미지급 (story_xp / ring_coins 만 — 게임 내부 화폐).
--   · wallet 직접 update 0건. 카드 보상은 boxing_story_inventory UPSERT 만.
-- ============================================================

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

  -- 멱등성 체크 (UPSERT 직전 상태 기반)
  IF v_progress.completed_chapter_codes ? v_chapter.code THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'chapter_code', v_chapter.code,
      'chapter_title', v_chapter.title,
      'story_xp_granted', 0,
      'ring_coins_granted', 0,
      'card_added', false,
      'card_code', NULL,
      'reward_title', NULL
    );
  END IF;

  -- 1. completed_chapter_codes 에 추가 + scene index 리셋
  UPDATE public.boxing_user_scene_progress
     SET completed_chapter_codes = completed_chapter_codes || to_jsonb(v_chapter.code),
         current_scene_index = 0,
         last_played_at = now()
   WHERE id = v_progress.id;

  -- 2/3. story_xp + ring_coins 지급 (게임 내부 화폐 — member_progress / wallet 무관)
  v_xp_granted := COALESCE(v_chapter.reward_quest_xp, 0);
  v_coins_granted := COALESCE(v_chapter.reward_gems, 0);

  UPDATE public.boxing_user_player_stats
     SET story_xp = story_xp + v_xp_granted,
         ring_coins = ring_coins + v_coins_granted,
         last_played_at = now()
   WHERE user_id = v_uid;

  -- 4. reward_card_code 가 있으면 인벤토리 추가 (claim_card_reward 와 동일 패턴)
  IF v_chapter.reward_card_code IS NOT NULL THEN
    INSERT INTO public.boxing_story_inventory (user_id, card_code, count, metadata)
    VALUES (v_uid, v_chapter.reward_card_code, 1,
            jsonb_build_object('source', 'chapter_clear', 'chapter_code', v_chapter.code))
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

-- 검증 쿼리 (Dashboard SQL Editor 에서 직접 돌려보기):
-- 1) SELECT proname FROM pg_proc WHERE proname = 'complete_chapter';
--    -> 1 row 기대
-- 2) SELECT public.complete_chapter('<route_id>', '<chapter_id>');
--    -> 첫 호출: success=true, already_completed=false, story_xp_granted=N
--    -> 두 번째: success=true, already_completed=true, story_xp_granted=0
