-- =====================================================================
-- 47A-fix-3 — get_my_story_rpg_state RPC 를 Stage 45 신규 테이블과 동기화
-- =====================================================================
-- 원인:
--   · 기존 RPC 는 구 테이블 (boxing_user_story_route_state / boxing_user_story_progress
--     / boxing_story_reward_claims) 만 SELECT
--   · Stage 45 에서 만든 신규 boxing_user_scene_progress (completed_chapter_codes 포함) /
--     boxing_user_player_stats / boxing_story_ending_claims 와 단절
--   · → 클라이언트의 progress.completed_chapter_codes 영원히 빈 배열
--   · → unlockedUpTo 가 항상 1 → 챕터 2+ 잠금 해제 불가
--
-- 수정:
--   · active_route_id: boxing_user_player_stats.active_route_code → routes.id
--   · progress: boxing_user_scene_progress (완전 신규 schema)
--   · reward_claims: boxing_story_ending_claims (Stage 45 신규)
--   · routes / chapters / nodes / dialogues / official_summary 는 변경 없음
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_my_story_rpg_state()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_active_route_id uuid;
  v_active_route_code text;
  v_routes jsonb;
  v_chapters jsonb;
  v_nodes jsonb;
  v_dialogues jsonb;
  v_progress jsonb;
  v_claims jsonb;
  v_official jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  -- ✨ active route — Stage 45 의 boxing_user_player_stats 에서
  SELECT active_route_code INTO v_active_route_code
  FROM public.boxing_user_player_stats
  WHERE user_id = v_uid;

  IF v_active_route_code IS NOT NULL THEN
    SELECT id INTO v_active_route_id
    FROM public.boxing_story_routes
    WHERE code = v_active_route_code;
  END IF;

  -- 마스터/시드 데이터 (변동 없음)
  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.sort_order), '[]'::jsonb)
  INTO v_routes
  FROM public.boxing_story_routes r WHERE r.active = true;

  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.chapter_number), '[]'::jsonb)
  INTO v_chapters
  FROM public.boxing_story_chapters c WHERE c.active = true;

  SELECT COALESCE(jsonb_agg(to_jsonb(n) ORDER BY n.sort_order), '[]'::jsonb)
  INTO v_nodes
  FROM public.boxing_story_nodes n WHERE n.active = true;

  SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.sort_order), '[]'::jsonb)
  INTO v_dialogues
  FROM public.boxing_story_dialogues d WHERE d.active = true;

  -- ✨ 사용자 progress — Stage 45 의 boxing_user_scene_progress (completed_chapter_codes 포함)
  SELECT COALESCE(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
  INTO v_progress
  FROM public.boxing_user_scene_progress p WHERE p.user_id = v_uid;

  -- ✨ 엔딩 보상 — Stage 45 의 boxing_story_ending_claims
  SELECT COALESCE(jsonb_agg(to_jsonb(ec)), '[]'::jsonb)
  INTO v_claims
  FROM public.boxing_story_ending_claims ec WHERE ec.user_id = v_uid;

  -- 공식 read-only summary (member_progress 미수정 — SELECT only)
  SELECT to_jsonb(mp) INTO v_official
  FROM public.member_progress mp WHERE mp.user_id = v_uid;

  RETURN jsonb_build_object(
    'success', true,
    'active_route_id', v_active_route_id,
    'active_route_code', v_active_route_code,
    'routes', v_routes,
    'chapters', v_chapters,
    'nodes', v_nodes,
    'dialogues', v_dialogues,
    'progress', v_progress,
    'reward_claims', v_claims,
    'official_summary', v_official
  );
END;
$function$;
