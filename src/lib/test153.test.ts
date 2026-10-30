import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { buildSegments, stationReps, TEST153_RUN_GUIDE, TEST153_STATIONS } from "./test153";

const PUBLIC = join(__dirname, "..", "..", "public");

describe("153 PB 탭 — 코스 지도 · 종목 카드 (2026-10-30 「153 PB 탭 디자인 보고서」)", () => {
  it("종목 8개 · 16구간", () => {
    expect(TEST153_STATIONS).toHaveLength(8);
    expect(buildSegments("open")).toHaveLength(16);
  });

  it("코스 지도 이름은 5글자 이하 — 좁은 폰 한 칸(13px)에 들어간다", () => {
    for (const s of TEST153_STATIONS) {
      expect(s.mapName.trim().length, s.name).toBeGreaterThan(0);
      expect(s.mapName.length, s.mapName).toBeLessThanOrEqual(5);
    }
    expect(new Set(TEST153_STATIONS.map((s) => s.mapName)).size).toBe(8);
  });

  it("종목 카드 — 종목마다 시범 영상 · 포스터가 public 에 있고 인정 기준 한 줄이 있다", () => {
    for (const s of TEST153_STATIONS) {
      expect(s.video, s.name).toBeTruthy();
      expect(existsSync(join(PUBLIC, s.video!.src)), s.video!.src).toBe(true);
      expect(existsSync(join(PUBLIC, s.video!.poster)), s.video!.poster).toBe(true);
      expect(s.standard.trim().length).toBeGreaterThan(5);
      expect(stationReps(s, "starter")).toBe(Math.ceil(s.open / 2));
    }
    expect(TEST153_RUN_GUIDE.standard.trim().length).toBeGreaterThan(5);
  });
});
