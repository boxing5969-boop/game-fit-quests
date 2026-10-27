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
  handWrapStepParam,
  mirrorArrows,
  type GuidePt,
} from "./handWrapGuide";

const BANNED = ["벨트", "계급", "자동 가산점", "무조건", "확정 혜택"];
const PUBLIC = join(__dirname, "..", "..", "public");
const stepText = (i: number) => {
  const s = HANDWRAP_STEPS[i];
  return [s.title, s.short, s.dir, ...s.how, s.tip ?? ""].join(" ");
};

describe("붕대 감기 — 대표님 영상 · 9단계 설명서 (2026-10-27)", () => {
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

  it("9단계 — 제목 · 짧은 글 · 시작/끝 · 자세한 설명이 있고, '큰 영상으로 보기' 초가 그 영상 길이 안", () => {
    expect(HANDWRAP_STEPS).toHaveLength(9);
    for (const s of HANDWRAP_STEPS) {
      expect(s.title.trim().length).toBeGreaterThan(1);
      expect(s.short.trim().length).toBeGreaterThan(5);
      expect(s.from.trim()).toBeTruthy();
      expect(s.to.trim()).toBeTruthy();
      expect(s.how.length).toBeGreaterThanOrEqual(2);
      for (const h of s.how) expect(h.trim().length).toBeGreaterThan(5);
      const angle = HANDWRAP_ANGLES[handWrapAngleIndex(s.video.angle)];
      expect(angle.key).toBe(s.video.angle);
      expect(s.video.at).toBeGreaterThanOrEqual(0);
      expect(s.video.at).toBeLessThan(angle.seconds);
    }
    // 사진은 서로 다르다
    expect(new Set(HANDWRAP_STEPS.map((s) => s.image)).size).toBe(9);
  });

  it("움직이는 사진 9개 · 끝 장면 사진 · 작은 사진이 public 에 있고 가볍다 (예전 10번째 파일은 없다)", () => {
    HANDWRAP_STEPS.forEach((s, i) => {
      const id = `step${String(i + 1).padStart(2, "0")}`;
      // 주소 끝 ?v= 는 다시 만든 판 표시(폰 캐시 넘기기) — 파일은 같은 자리
      expect(s.clip.split("?")[0]).toBe(`/handwrap/steps/${id}.mp4`);
      expect(s.image.split("?")[0]).toBe(`/handwrap/steps/${id}.webp`);
      expect(s.thumb.split("?")[0]).toBe(`/handwrap/steps/${id}_s.webp`);
      for (const url of [s.clip, s.image, s.thumb]) {
        const f = join(PUBLIC, url.split("?")[0]);
        expect(existsSync(f), url).toBe(true);
        expect(statSync(f).size, url).toBeLessThan(600 * 1024);
      }
      expect(statSync(join(PUBLIC, s.thumb.split("?")[0])).size).toBeLessThan(40 * 1024);
      expect(HANDWRAP_VIEW_NOTE[s.view].left).toBeTruthy();
      expect(HANDWRAP_VIEW_NOTE[s.view].right).toContain("거울");
      expect(s.dir.trim().length).toBeGreaterThan(5);
    });
    expect(existsSync(join(PUBLIC, "handwrap/steps/step10.mp4"))).toBe(false);
    // 8단계(벨크로 — 손목 바깥쪽이 잘 보임)만 옆에서, 나머지는 내 손을 내려다보는 방향
    expect(HANDWRAP_STEPS.map((s) => s.view)).toEqual(["mine", "mine", "mine", "mine", "mine", "mine", "mine", "side", "mine"]);
  });

  it("방향 표시 — 좌표는 사진 안(0~100) · 길은 두 점 이상 · 9단계 말고는 시작이 있고, 시작/끝 글이 짧다", () => {
    const inside = (p: GuidePt) => p[0] >= 0 && p[0] <= 100 && p[1] >= 0 && p[1] <= 100;
    HANDWRAP_STEPS.forEach((s, i) => {
      const g = s.guide;
      for (const seg of [...g.segs, ...(g.ghost ?? [])]) {
        expect(seg.pts.length, `${i + 1}단계`).toBeGreaterThanOrEqual(2);
        for (const p of seg.pts) expect(inside(p), `${i + 1}단계 ${p}`).toBe(true);
      }
      for (const pin of [g.start, g.end, ...(g.marks ?? [])]) {
        if (!pin) continue;
        expect(inside(pin.at), `${i + 1}단계 ${pin.label}`).toBe(true);
        if (pin.lab) expect(inside(pin.lab)).toBe(true);
        expect(pin.label.length, pin.label).toBeLessThanOrEqual(12);
      }
      // 마지막(주먹 확인)은 확인할 곳만, 나머지는 길이 있다
      if (i < HANDWRAP_STEPS.length - 1) expect(g.segs.length).toBeGreaterThan(0);
      if (i < 7) expect(g.start, `${i + 1}단계 시작`).toBeTruthy();
    });
    // 길 토막이 이어진다 — 앞 토막 끝 = 다음 토막 시작
    for (const s of HANDWRAP_STEPS) {
      for (let k = 1; k < s.guide.segs.length; k++) {
        const prev = s.guide.segs[k - 1].pts;
        const cur = s.guide.segs[k].pts;
        const a = prev[prev.length - 1];
        const b = cur[0];
        expect(Math.hypot(a[0] - b[0], a[1] - b[1]), s.title).toBeLessThan(1.5);
      }
    }
    expect(HANDWRAP_STEPS[8].guide.marks?.every((m) => m.kind === "check")).toBe(true);
  });

  it("상세 주소 ?step=N — 1~9만", () => {
    expect(handWrapStepParam("1")).toBe(0);
    expect(handWrapStepParam("9")).toBe(8);
    expect(handWrapStepParam("0")).toBeNull();
    expect(handWrapStepParam("10")).toBeNull();
    expect(handWrapStepParam("2.5")).toBeNull();
    expect(handWrapStepParam("abc")).toBeNull();
    expect(handWrapStepParam(null)).toBeNull();
  });

  it("속도 — 기본 천천히 0.6 · 아주 천천히 · 원래 속도 / 오른손(거울)이면 대각선 화살표도 뒤집는다", () => {
    expect(HANDWRAP_STEP_SPEEDS.map((s) => s.rate)).toEqual([0.4, 0.6, 1]);
    expect(HANDWRAP_STEP_SPEEDS.some((s) => s.rate === HANDWRAP_DEFAULT_STEP_RATE)).toBe(true);
    expect(mirrorArrows("올라가(↗) 내려와(↘) ↖ ↙ → ↑")).toBe("올라가(↖) 내려와(↙) ↗ ↘ → ↑");
  });

  it("감는 방향이 글에도 있다 — 손등에서 새끼 → 엄지 쪽 · 올라가는 대각선 ↗ · 내려가는 대각선 ↘ · 손등 X자", () => {
    const all = HANDWRAP_STEPS.map((_, i) => stepText(i)).join(" ");
    expect(all).toContain("새끼 → 엄지");
    expect(stepText(2)).toContain("↗");
    expect(stepText(4)).toContain("↘");
    expect(stepText(4)).toContain("X자");
  });

  it("영상과 같은 순서 — 엄지 고리로 시작해 주먹 확인으로 끝난다 · 손가락 사이 · 벨크로는 손목 바깥쪽", () => {
    expect(HANDWRAP_STEPS[0].title).toContain("엄지");
    expect(HANDWRAP_STEPS[HANDWRAP_STEPS.length - 1].title).toContain("주먹");
    expect(stepText(5)).toContain("손가락 사이");
    expect(stepText(7)).toContain("손목 바깥쪽");
    expect(HANDWRAP_KEY_POINTS[0]).toContain("엄지");
    // 영상 순서대로 — '큰 영상으로 보기' 초가 앞 단계보다 늦다 (옆에서 찍은 8단계 빼고)
    const mine = HANDWRAP_STEPS.filter((s) => s.video.angle === "mine").map((s) => s.video.at);
    expect([...mine].sort((a, b) => a - b)).toEqual(mine);
  });

  it("금지 문구가 없다", () => {
    const all = JSON.stringify([HANDWRAP_ANGLES, HANDWRAP_STEPS, HANDWRAP_MISTAKES, HANDWRAP_KEY_POINTS, HANDWRAP_STEP_SPEEDS, HANDWRAP_VIEW_NOTE]);
    for (const w of BANNED) expect(all.includes(w), w).toBe(false);
  });
});
