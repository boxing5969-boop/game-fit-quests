import type { QueryClient } from "@tanstack/react-query";
import { TITLE_VIDEOS_KEY } from "@/hooks/useTitleMatchVideos";
import { SEARCH_VIDEOS_KEY } from "@/hooks/useAppSearch";

/**
 * 미션·미션 영상이 바뀐 뒤 캐시 비우기 (2026-10-01 검수).
 * 코치가 영상 주소를 고치면 ["missions"] 만 비워져, 같은 영상을 읽는 레벨 연습(level-videos)·오늘의 수업·
 * 타이틀매치·검색·라이브러리 화면은 최대 5분 동안 옛 영상을 보여 줬다 — 읽는 쪽 키를 한 곳에서 전부 비운다.
 */
export const MISSION_VIDEO_QUERY_KEYS: readonly (readonly unknown[])[] = [
  ["missions"],
  ["level-videos"],
  ["level-videos-by-ids"],
  ["boxing-library"],
  TITLE_VIDEOS_KEY,
  SEARCH_VIDEOS_KEY,
];

export function invalidateMissionVideoQueries(qc: QueryClient) {
  for (const key of MISSION_VIDEO_QUERY_KEYS) {
    void qc.invalidateQueries({ queryKey: key as unknown[] });
  }
}
