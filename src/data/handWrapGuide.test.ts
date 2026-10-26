import { describe, expect, it } from "vitest";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  HANDWRAP_ANGLES,
  HANDWRAP_DEFAULT_STEP_RATE,
  HANDWRAP_KEY_POINTS,
  HANDWRAP_MISTAKES,
  HANDWRAP_STEPS,
  HANDWRAP_STEP_SPEEDS,
  HANDWRAP_VIEW_NOTE,
  handWrapAngleIndex,
  mirrorArrows,
} from "./handWrapGuide";

const BANNED = ["벨트", "계급", "자동 가산점", "무조건", "확정 혜택"];
const PUBLIC = join(__dirname, "..", "..", "public");

describe("붕대 감기 — 대표님 영상 2각도 · 사진 10장 (2026-10-20)", () => {
  it("각도 3개 — 내 눈으로(앞에서 찍은 영상 180도) · 옆에서 · 앞에서, 영상·첫 화면 파일이 public 에 있다 (Cloudflare 한 파일 25MB 안)", () => {
    expect(HANDWRAP_ANGLES.map((a) => a.label)).toEqual(["내 눈으로", "옆에서", "앞에서"]);
    expect(HANDWRAP_ANGLES[0].rotate180).toBe(true);
    expect(HANDWRAP_ANGLES[0].videoUrl).toBe(HANDWRAP_ANGLES[2].videoUrl);
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

  it("단계 영상 10개 — 실제로 감는 장면 반복 영상 · 포스터가 public 에 있고 가볍다 (2026-10-27 다시)", () => {
    HANDWRAP_STEPS.forEach((s, i) => {
      const id = `step${String(i + 1).padStart(2, "0")}`;
      // 주소 끝 ?v= 는 다시 만든 판 표시(폰 캐시 넘기기) — 파일은 같은 자리
      expect(s.clip.split("?")[0]).toBe(`/handwrap/steps/${id}.mp4`);
      expect(s.image.split("?")[0]).toBe(`/handwrap/steps/${id}.webp`);
      for (const url of [s.clip, s.image]) {
        const f = join(PUBLIC, url.split("?")[0]);
        expect(existsSync(f), url).toBe(true);
        expect(statSync(f).size, url).toBeLessThan(600 * 1024);
      }
      expect(HANDWRAP_VIEW_NOTE[s.view].left).toBeTruthy();
      expect(HANDWRAP_VIEW_NOTE[s.view].right).toContain("거울");
      expect(s.dir.trim().length).toBeGreaterThan(5);
    });
    // 5단계(주먹 확인)만 옆에서, 나머지는 내 손을 내려다보는 방향
    expect(HANDWRAP_STEPS.map((s) => s.view)).toEqual(["mine", "mine", "mine", "mine", "side", "mine", "mine", "mine", "mine", "mine"]);
  });

  it("속도 — 기본 천천히 0.6 · 아주 천천히 · 원래 속도 / 오른손(거울)이면 대각선 화살표도 뒤집는다", () => {
    expect(HANDWRAP_STEP_SPEEDS.map((s) => s.rate)).toEqual([0.4, 0.6, 1]);
    expect(HANDWRAP_STEP_SPEEDS.some((s) => s.rate === HANDWRAP_DEFAULT_STEP_RATE)).toBe(true);
    expect(mirrorArrows("올라가(↗) 내려와(↘) ↖ ↙ → ↑")).toBe("올라가(↖) 내려와(↙) ↗ ↘ → ↑");
  });

  it("감는 방향이 글에도 있다 — 손등에서 새끼 → 엄지 쪽 · 올라가는 대각선 ↗ · 내려가는 대각선 ↘", () => {
    const all = HANDWRAP_STEPS.map((s) => `${s.desc} ${s.tip ?? ""}`).join(" ");
    expect(all).toContain("새끼 → 엄지");
    expect(HANDWRAP_STEPS[2].desc).toContain("↗");
    expect(HANDWRAP_STEPS[3].desc).toContain("↘");
    expect(HANDWRAP_STEPS[3].desc).toContain("X자");
  });

  it("영상과 같은 순서 — 엄지 고리로 시작해 주먹 확인으로 끝난다 · 벨크로는 손목 바깥쪽", () => {
    expect(HANDWRAP_STEPS[0].title).toContain("엄지");
    expect(HANDWRAP_STEPS[HANDWRAP_STEPS.length - 1].title).toContain("주먹");
    expect(HANDWRAP_STEPS.some((s) => s.desc.includes("손목 바깥쪽"))).toBe(true);
    expect(HANDWRAP_KEY_POINTS[0]).toContain("엄지");
  });

  it("금지 문구가 없다", () => {
    const all = JSON.stringify([HANDWRAP_ANGLES, HANDWRAP_STEPS, HANDWRAP_MISTAKES, HANDWRAP_KEY_POINTS, HANDWRAP_STEP_SPEEDS, HANDWRAP_VIEW_NOTE]);
    for (const w of BANNED) expect(all.includes(w), w).toBe(false);
  });
});
