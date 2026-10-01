/**
 * 🔍 앱 기능 검색 — 검색할 거리 모으기 (2026-10-01).
 *
 * 기능 바로가기(코드 안 목록) + 153 영상(missions) + 일차별 수업(level_lesson_days) 를 한 목록으로 만든다.
 * 영상·수업은 처음 검색 화면을 열 때 한 번 읽고 10분 동안 그대로 쓴다 (쿼리키 "153search:" 로 시작).
 * 지도진 전용 · 다이어트 · 메시지 항목은 볼 수 있는 계정에만 넣는다.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDmSummary } from "@/hooks/useDm";
import { useLessonDays } from "@/hooks/useLessonDays";
import { youtubeThumb } from "@/hooks/useLevelVideos";
import { isManagerRole } from "@/lib/rankLabels";
import { levelShort, resolveDay } from "@/lib/lessonDays";
import {
  MISSION_VIDEO_EMBED,
  overlayVariants,
  primaryMissionVideo,
  videoVariants,
  type MissionVideoRow,
} from "@/lib/missionVideos";
import {
  FEATURES,
  lessonEntry,
  videoEntry,
  visibleFor,
  type SearchEntry,
  type VideoSource,
} from "@/lib/appSearch";

export const SEARCH_VIDEOS_KEY = ["153search:videos"] as const;

type MissionRow = {
  id: string;
  title: string;
  description: string | null;
  key_point_1: string | null;
  key_point_2: string | null;
  key_point_3: string | null;
  category: string | null;
  mission_videos: MissionVideoRow[] | null;
  levels: { rank_name: string | null; level_number: number | null } | null;
};

async function fetchSearchVideos(): Promise<VideoSource[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("missions")
    .select(
      `id, title, description, key_point_1, key_point_2, key_point_3, category, sort_order, ${MISSION_VIDEO_EMBED}, levels(rank_name, level_number)`,
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as MissionRow[])
    .map((m) => {
      // 대표 영상 (버전이 여러 개면 sort_order 0) + 실사 · 애니메이션 같은 버전들
      const v = primaryMissionVideo(m.mission_videos);
      const url = v?.video_url?.trim() ?? "";
      return {
        id: m.id,
        title: m.title,
        description: m.description,
        keyPoints: [m.key_point_1, m.key_point_2, m.key_point_3].filter((x): x is string => !!x),
        videoUrl: url,
        thumb: v?.poster_url || youtubeThumb(url),
        category: m.category,
        rank: m.levels?.rank_name ?? null,
        level: m.levels?.level_number ?? null,
        variants: overlayVariants(videoVariants(m.mission_videos)),
      };
    })
    .filter((v) => !!v.videoUrl);
}

export function useAppSearchEntries(enabled = true) {
  const { role, profile } = useAuth();
  const { data: dm } = useDmSummary();
  const videos = useQuery({
    queryKey: SEARCH_VIDEOS_KEY,
    enabled,
    staleTime: 10 * 60_000,
    queryFn: fetchSearchVideos,
  });
  const lessons = useLessonDays(enabled);

  const viewer = useMemo(
    () => ({
      staff: isManagerRole(role ?? null),
      diet: !!profile?.diet_program_enabled,
      dm: dm?.enabled !== false,
    }),
    [role, profile?.diet_program_enabled, dm?.enabled],
  );

  const entries = useMemo<SearchEntry[]>(() => {
    const out: SearchEntry[] = FEATURES.filter((e) => visibleFor(e, viewer));
    for (const v of videos.data ?? []) out.push(videoEntry(v));
    const byDayNo = lessons.byDayNo;
    for (const d of lessons.data ?? []) {
      out.push(
        lessonEntry({
          dayNo: d.dayNo,
          level: d.level,
          title: d.title,
          goal: d.goal,
          stepNames: resolveDay(d, byDayNo).steps.map((s) => s.name),
          levelLabel: levelShort(d.level),
        }),
      );
    }
    return out;
  }, [viewer, videos.data, lessons.data, lessons.byDayNo]);

  return {
    entries,
    /** 영상·수업을 아직 읽는 중 (기능 바로가기는 바로 찾을 수 있다) */
    loadingContent: videos.isLoading || lessons.isLoading,
  };
}
