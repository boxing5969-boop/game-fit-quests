// 레벨별 영상 마스터 — 관장님이 올린 훈련 영상(missions + mission_videos)을
// 해당 레벨에서 "집에서 예습하는 영상 마스터" 목록으로 제공한다.
// 시청 완료 체크는 로컬(기기)에 저장 — 서버 스키마 변경 없이 동작.
import { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LevelVideo {
  id: string;
  title: string;
  description: string | null;
  keyPoints: string[];
  videoUrl: string;
  posterUrl: string | null;
  sortOrder: number;
}

/** 유튜브 URL → embed/썸네일에 쓰는 video id */
export const youtubeId = (url: string): string | null => {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
};

export const youtubeThumb = (url: string): string | null => {
  const id = youtubeId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
};

/** 제목의 "[복싱/줄넘기] 좌우 리듬ㅣ설명" → { tag:'줄넘기', name:'좌우 리듬', sub:'설명' } */
export const parseVideoTitle = (raw: string) => {
  const tagMatch = raw.match(/^\[[^/\]]*\/?([^\]]*)\]\s*/);
  const tag = tagMatch ? tagMatch[1].trim() : "";
  const rest = raw.replace(/^\[[^\]]*\]\s*/, "");
  const [name, ...subParts] = rest.split("ㅣ");
  return { tag, name: name.trim(), sub: subParts.join("ㅣ").trim() };
};

export const useLevelVideos = (league: string, levelNumber: number) =>
  useQuery({
    queryKey: ["level-videos", league, levelNumber],
    enabled: !!league && levelNumber > 0,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<LevelVideo[]> => {
      const { data, error } = await supabase
        .from("missions")
        .select("id, title, description, key_point_1, key_point_2, key_point_3, sort_order, mission_videos(video_url, poster_url), levels!inner(rank_name, level_number)")
        .eq("is_active", true)
        .eq("levels.rank_name", league as never)
        .eq("levels.level_number", levelNumber)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return ((data || []) as unknown as Array<{
        id: string; title: string; description: string | null;
        key_point_1: string | null; key_point_2: string | null; key_point_3: string | null;
        sort_order: number | null;
        mission_videos: Array<{ video_url: string | null; poster_url: string | null }> | null;
      }>)
        .map((m) => {
          const v = m.mission_videos?.[0];
          return {
            id: m.id,
            title: m.title,
            description: m.description,
            keyPoints: [m.key_point_1, m.key_point_2, m.key_point_3].filter(Boolean) as string[],
            videoUrl: v?.video_url || "",
            posterUrl: v?.poster_url || null,
            sortOrder: m.sort_order ?? 0,
          };
        })
        .filter((v) => !!v.videoUrl);
    },
  });

/** 시청 완료 체크 — 기기 로컬 저장 (레벨별) */
const WATCH_KEY = "153_video_watched";
const loadWatched = (): Record<string, true> => {
  try {
    return JSON.parse(localStorage.getItem(WATCH_KEY) || "{}");
  } catch {
    return {};
  }
};

export const useWatchedVideos = () => {
  const [watched, setWatched] = useState<Record<string, true>>(loadWatched);
  const toggle = useCallback((id: string) => {
    setWatched((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      localStorage.setItem(WATCH_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  const countFor = useCallback(
    (ids: string[]) => ids.filter((id) => watched[id]).length,
    [watched],
  );
  return useMemo(() => ({ watched, toggle, countFor }), [watched, toggle, countFor]);
};
