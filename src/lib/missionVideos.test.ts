import { describe, expect, it } from "vitest";
import { extraVariantLabels, overlayVariants, primaryMissionVideo, sortMissionVideos, videoVariants } from "./missionVideos";

const live = { video_url: "https://x/live.mp4", poster_url: "https://x/live.jpg", label: null, sort_order: 0, created_at: "2026-10-01T12:24:34Z" };
const anime = { video_url: "https://x/anime.mp4", poster_url: "https://x/anime.jpg", label: "애니메이션", sort_order: 1, created_at: "2026-10-01T13:15:00Z" };

describe("미션 영상 순서", () => {
  it("DB 가 애니를 먼저 돌려줘도 대표는 실사 (sort_order 0)", () => {
    expect(primaryMissionVideo([anime, live])?.video_url).toBe("https://x/live.mp4");
    expect(sortMissionVideos([anime, live]).map((r) => r.video_url)).toEqual(["https://x/live.mp4", "https://x/anime.mp4"]);
  });
  it("sort_order 가 같으면 먼저 올린 영상이 대표 · 시각도 없으면 받은 순서", () => {
    const a = { ...live, sort_order: 0, created_at: "2026-10-02T00:00:00Z" };
    const b = { ...anime, sort_order: 0, created_at: "2026-10-01T00:00:00Z" };
    expect(primaryMissionVideo([a, b])?.video_url).toBe("https://x/anime.mp4");
    const c = { video_url: "u1", poster_url: null };
    const d = { video_url: "u2", poster_url: null };
    expect(primaryMissionVideo([c, d])?.video_url).toBe("u1");
  });
  it("주소 없는 영상은 건너뛴다 · 비면 null", () => {
    expect(primaryMissionVideo([{ video_url: "  ", poster_url: null }, live])?.video_url).toBe("https://x/live.mp4");
    expect(primaryMissionVideo([])).toBeNull();
    expect(primaryMissionVideo(null)).toBeNull();
  });
});

describe("플레이어 영상 목록", () => {
  it("실사 | 애니메이션 — 대표 이름표가 비면 '실사'", () => {
    const v = videoVariants([anime, live]);
    expect(v.map((x) => x.label)).toEqual(["실사", "애니메이션"]);
    expect(v[1]).toEqual({ label: "애니메이션", videoUrl: "https://x/anime.mp4", posterUrl: "https://x/anime.jpg" });
    expect(extraVariantLabels(v)).toEqual(["애니메이션"]);
  });
  it("영상이 하나면 목록도 하나 (선택 칸이 안 뜬다)", () => {
    expect(videoVariants([live])).toHaveLength(1);
    expect(extraVariantLabels(videoVariants([live]))).toEqual([]);
  });
  it("같은 주소가 두 번 붙어 있으면 한 번만 · 이름표 없는 두 번째는 '영상 2'", () => {
    const dup = { ...live, sort_order: 2 };
    const other = { video_url: "https://x/side.mp4", poster_url: null, sort_order: 3 };
    expect(videoVariants([live, dup, other]).map((x) => x.label)).toEqual(["실사", "영상 2"]);
  });
});

describe("어두운 영상 모달용 모양", () => {
  it("{ label, url } 로 바꾸고 주소 정리 함수를 버전마다 건다", () => {
    const v = videoVariants([anime, live]);
    expect(overlayVariants(v)).toEqual([
      { label: "실사", url: "https://x/live.mp4" },
      { label: "애니메이션", url: "https://x/anime.mp4" },
    ]);
    expect(overlayVariants(v, (u) => u.toUpperCase()).map((x) => x.url)).toEqual(["HTTPS://X/LIVE.MP4", "HTTPS://X/ANIME.MP4"]);
  });
});
