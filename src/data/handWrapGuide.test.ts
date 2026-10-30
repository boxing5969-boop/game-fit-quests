import { describe, expect, it } from "vitest";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  HANDWRAP_DEFAULT_HAND,
  HANDWRAP_KEY_POINTS,
  HANDWRAP_MISTAKES,
  HANDWRAP_NUMBERED_STEPS,
  HANDWRAP_STEPS,
  HANDWRAP_VIEW_NOTE,
  handWrapStepLabel,
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
const file = (url: string) => join(PUBLIC, url.split("?")[0]);

describe("붕대 감기 — 코팅 설명서와 같은 12단계 사진 설명서 (2026-10-30)", () => {
  it("12단계 + 완성 — 마지막 칸만 완성, 번호는 1~12", () => {
    expect(HANDWRAP_STEPS).toHaveLength(13);
    expect(HANDWRAP_NUMBERED_STEPS).toBe(12);
    expect(HANDWRAP_STEPS.filter((s) => s.final)).toHaveLength(1);
    expect(HANDWRAP_STEPS[12].final).toBe(true);
    expect(handWrapStepLabel(0)).toBe("1단계");
    expect(handWrapStepLabel(11)).toBe("12단계");
    expect(handWrapStepLabel(12)).toBe("완성");
  });

  it("코팅 설명서 글과 같은 순서", () => {
    expect(HANDWRAP_STEPS.map((s) => s.sheet)).toEqual([
      "엄지손가락에 걸어주세요",
      "손목을 지나 손등 위 바퀴",
      "손등을 지나 정권부위로",
      "정권부위 위 바퀴",
      "다시 손목으로",
      "한바퀴 감고",
      "새끼와 엄지 사이 통과",
      "통과한 붕대를 손가락 사이로",
      "넘어와 손목 감고",
      "새끼와 엄지 통과",
      "한번 더 동일",
      "새끼와 엄지 통과",
      "완성된 모습",
    ]);
  });

  it("단계마다 제목 · 짧은 글 · 시작/끝 · 자세한 설명 · 방향", () => {
    for (const s of HANDWRAP_STEPS) {
      expect(s.title.trim().length).toBeGreaterThan(1);
      expect(s.short.trim().length).toBeGreaterThan(5);
      expect(s.from.trim()).toBeTruthy();
      expect(s.to.trim()).toBeTruthy();
      expect(s.how.length).toBeGreaterThanOrEqual(2);
      for (const h of s.how) expect(h.trim().length).toBeGreaterThan(5);
      expect(s.dir.trim().length).toBeGreaterThan(5);
    }
  });

  it("사진(4:3)이 public 에 있고 가볍다 · 완성은 사진 3장 · 예전 그림 애니메이션 파일은 없다", () => {
    const urls = HANDWRAP_STEPS.flatMap((s) => [s.image, ...(s.extras ?? []).map((e) => e.image)]);
    expect(urls).toHaveLength(15);
    expect(new Set(urls).size).toBe(15);
    for (const url of urls) {
      // 주소 끝 ?v= 는 다시 만든 판 표시(폰 캐시 넘기기) — 파일은 같은 자리
      expect(url.split("?")[0]).toMatch(/^\/handwrap\/photos\/p\d{2}\.webp$/);
      expect(existsSync(file(url)), url).toBe(true);
      expect(statSync(file(url)).size, url).toBeLessThan(200 * 1024);
    }
    expect(HANDWRAP_STEPS[12].extras?.map((e) => e.label)).toEqual(["주먹 쥔 모습", "손가락 편 모습"]);
    expect(existsSync(join(PUBLIC, "handwrap/steps/step01.mp4"))).toBe(false);
  });

  it("방향 표시 — 좌표는 사진 안(0~100) · 길은 두 점 이상 · 12단계는 시작이 있고 · 완성은 확인할 곳만 · 글은 짧게", () => {
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
      if (!s.final) {
        expect(g.segs.length, `${i + 1}단계 길`).toBeGreaterThan(0);
        expect(g.start, `${i + 1}단계 시작`).toBeTruthy();
      }
    });
    // 길 토막이 이어진다 — 앞 토막 끝 = 다음 토막 시작 (손등 ↔ 손바닥으로 넘어가는 곳은 조금 떨어져도 된다)
    for (const s of HANDWRAP_STEPS) {
      for (let k = 1; k < s.guide.segs.length; k++) {
        const prev = s.guide.segs[k - 1].pts;
        const a = prev[prev.length - 1];
        const b = s.guide.segs[k].pts[0];
        expect(Math.hypot(a[0] - b[0], a[1] - b[1]), s.title).toBeLessThan(8);
      }
    }
    const fin = HANDWRAP_STEPS[12].guide;
    expect(fin.segs).toHaveLength(0);
    expect(fin.marks?.every((m) => m.kind === "check")).toBe(true);
  });

  it("기본 손은 오른손 · 보는 방향 글 · 대각선 화살표는 오른손 기준(왼손이면 뒤집기)", () => {
    expect(HANDWRAP_DEFAULT_HAND).toBe("right");
    expect(HANDWRAP_VIEW_NOTE.right).toContain("엄지가 왼쪽");
    expect(HANDWRAP_VIEW_NOTE.left).toContain("거울");
    expect(mirrorArrows("올라가(↗) 내려와(↘) ↖ ↙ → ↑")).toBe("올라가(↖) 내려와(↙) ↗ ↘ → ↑");
  });

  it("상세 주소 ?step=N — 1~13만 (13 = 완성)", () => {
    expect(handWrapStepParam("1")).toBe(0);
    expect(handWrapStepParam("12")).toBe(11);
    expect(handWrapStepParam("13")).toBe(12);
    expect(handWrapStepParam("0")).toBeNull();
    expect(handWrapStepParam("14")).toBeNull();
    expect(handWrapStepParam("2.5")).toBeNull();
    expect(handWrapStepParam("abc")).toBeNull();
    expect(handWrapStepParam(null)).toBeNull();
  });

  it("감는 방향이 글에도 있다 — 손등에서 엄지 → 새끼 · 올라가는 ↗ · 내려가는 ↘ · 손등 X자 · 손가락 사이 · 벨크로 손목 바깥쪽", () => {
    const all = HANDWRAP_STEPS.map((_, i) => stepText(i)).join(" ");
    expect(all).toContain("엄지 쪽 → 새끼 쪽");
    expect(all).not.toContain("새끼 → 엄지");
    expect(stepText(2)).toContain("↗");
    expect(stepText(4)).toContain("↘");
    expect(stepText(4)).toContain("X자");
    expect(stepText(6)).toContain("새끼손가락과 약지 사이");
    expect(stepText(7)).toContain("엄지와 검지 사이");
    expect(stepText(11)).toContain("손목 바깥쪽");
    expect(HANDWRAP_STEPS[0].title).toContain("엄지");
    expect(HANDWRAP_KEY_POINTS[0]).toContain("엄지");
  });

  it("금지 문구가 없다", () => {
    const all = JSON.stringify([HANDWRAP_STEPS, HANDWRAP_MISTAKES, HANDWRAP_KEY_POINTS, HANDWRAP_VIEW_NOTE]);
    for (const w of BANNED) expect(all.includes(w), w).toBe(false);
  });
});
