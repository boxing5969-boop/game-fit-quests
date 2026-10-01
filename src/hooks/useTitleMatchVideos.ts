/**
 * 🏆 타이틀매치 영상 — 네 리그의 Lv.10 미션 영상을 한 번에 읽는다 (2026-10-01).
 *
 * 관장님이 코치 화면 → 🎯 미션에서 'OO Lv.10' 미션에 영상을 넣으면 타이틀매치 메뉴에 바로 나온다.
 * 워밍업 참고 영상(category='warmup')은 뺀다 — 내 레벨 연습(useLevelVideos)과 같은 기준.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TITLE_LEVEL_IN_LEAGUE, toTitleVideos, type TitleVideo } from "@/lib/titleMatch";

/** 쿼리키 — 다른 화면 캐시와 겹치지 않게 153title: 로 시작 */
export const TITLE_VIDEOS_KEY = ["153title:videos"] as const;

export const useTitleMatchVideos = () =>
  useQuery({
    queryKey: TITLE_VIDEOS_KEY,
    // 새로 올린 영상이 금방 보이게 짧게 둔다 (가벼운 조회)
    staleTime: 60_000,
    queryFn: async (): Promise<TitleVideo[]> => {
      const { data, error } = await supabase
        .from("missions")
        .select(
          "id, title, description, key_point_1, key_point_2, key_point_3, sort_order, mission_videos(video_url, poster_url), levels!inner(rank_name, level_number)",
        )
        .eq("is_active", true)
        .neq("category", "warmup")
        .eq("levels.level_number", TITLE_LEVEL_IN_LEAGUE)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return toTitleVideos(data);
    },
  });
