import { describe, expect, it } from "vitest";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  HANDWRAP_ANGLES,
  HANDWRAP_KEY_POINTS,
  HANDWRAP_MISTAKES,
  HANDWRAP_STEPS,
  handWrapAngleIndex,
} from "./handWrapGuide";

const BANNED = ["벨트", "계급", "자동 가산점", "무조건", "확정 혜택"];
const PUBLIC = join(__dirname, "..", "..", "public");

describe("붕대 감기 — 대표님 영상 2각도 · 사진 10장 (2026-10-20)", () => {
  it("각도 2개 — 옆에서 · 앞에서, 영상·첫 화면 파일이 public 에 있다 (Cloudflare 한 파일 25MB 안)", () => {
    expect(HANDWRAP_ANGLES.map((a) => a.label)).toEqual(["옆에서", "앞에서"]);
    for (const a of HANDWRAP_ANGLES) {
      for (const url of [a.videoUrl, a.posterUrl]) {
        expect(url.startsWith("/handwrap/")).toBe(true);
        const f = join(PUBLIC, url);
        expect(existsSync(f), url).toBe(true);
        expect(statSync(f).size).toBeLessThan(25 * 1024 * 1024);
      }
    }
  });

  it("사진 10장 — 제목·설명이 있고, '이 장면 영상으로 보기' 초가 그 영상 길이 안", () => {
    expect(HANDWRAP_STEPS).toHaveLength(10);
    for (const s of HANDWRAP_STEPS) {
      expect(s.title.trim().length).toBeGreaterThan(1);
      expect(s.desc.trim().length).toBeGreaterThan(5);
      expect(s.image).toBeTruthy();
      const angle = HANDWRAP_ANGLES[handWrapAngleIndex(s.video.angle)];
      expect(angle.key).toBe(s.video.angle);
      expect(s.video.at).toBeGreaterThanOrEqual(0);
      expect(s.video.at).toBeLessThan(angle.seconds);
    }
    // 사진은 서로 다르다
    expect(new Set(HANDWRAP_STEPS.map((s) => s.image)).size).toBe(10);
  });

  it("영상과 같은 순서 — 엄지 고리로 시작해 주먹 확인으로 끝난다 · 벨크로는 손목 바깥쪽", () => {
    expect(HANDWRAP_STEPS[0].title).toContain("엄지");
    expect(HANDWRAP_STEPS[HANDWRAP_STEPS.length - 1].title).toContain("주먹");
    expect(HANDWRAP_STEPS.some((s) => s.desc.includes("손목 바깥쪽"))).toBe(true);
    expect(HANDWRAP_KEY_POINTS[0]).toContain("엄지");
  });

  it("금지 문구가 없다", () => {
    const all = JSON.stringify([HANDWRAP_ANGLES, HANDWRAP_STEPS, HANDWRAP_MISTAKES, HANDWRAP_KEY_POINTS]);
    for (const w of BANNED) expect(all.includes(w), w).toBe(false);
  });
});
