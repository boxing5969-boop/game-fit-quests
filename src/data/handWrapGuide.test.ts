import { describe, expect, it } from "vitest";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  HANDWRAP_DEFAULT_HAND,
  HANDWRAP_DEFAULT_STEP_RATE,
  HANDWRAP_KEY_POINTS,
  HANDWRAP_MISTAKES,
  HANDWRAP_NUMBERED_STEPS,
  HANDWRAP_STEPS,
  HANDWRAP_STEP_SPEEDS,
  HANDWRAP_VIEW_NOTE,
  handWrapStepLabel,
  handWrapStepParam,
  mirrorArrows,
} from "./handWrapGuide";

const BANNED = ["벨트", "계급", "자동 가산점", "무조건", "확정 혜택"];
const PUBLIC = join(__dirname, "..", "..", "public");
const stepText = (i: number) => {
  const s = HANDWRAP_STEPS[i];
  return [s.title, s.short, s.dir, ...s.how, s.tip ?? ""].join(" ");
};
const file = (url: string) => join(PUBLIC, url.split("?")[0]);

describe("붕대 감기 — 코팅 설명서와 같은 12단계 그림 애니메이션 (2026-10-30)", () => {
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

  it("손마다 애니메이션 · 끝 장면 · 작은 그림이 public 에 있고 가볍다 (거울로 뒤집지 않고 따로 만든 왼손)", () => {
    HANDWRAP_STEPS.forEach((s, i) => {
      const id = `step${String(i + 1).padStart(2, "0")}`;
      for (const [hand, suffix] of [["right", ""], ["left", "_l"]] as const) {
        const m = s.media[hand];
        // 주소 끝 ?v= 는 다시 만든 판 표시(폰 캐시 넘기기) — 파일은 같은 자리
        expect(m.clip.split("?")[0]).toBe(`/handwrap/steps/${id}${suffix}.mp4`);
        expect(m.image.split("?")[0]).toBe(`/handwrap/steps/${id}${suffix}.webp`);
        expect(m.thumb.split("?")[0]).toBe(`/handwrap/steps/${id}${suffix}_s.webp`);
        for (const url of [m.clip, m.image, m.thumb]) {
          expect(existsSync(file(url)), url).toBe(true);
          expect(statSync(file(url)).size, url).toBeLessThan(400 * 1024);
        }
        expect(statSync(file(m.thumb)).size).toBeLessThan(20 * 1024);
      }
    });
    // 예전 9단계 뒤에 붙을 파일이 없다
    expect(existsSync(join(PUBLIC, "handwrap/steps/step14.mp4"))).toBe(false);
  });

  it("기본 손은 오른손 · 보는 방향 글 · 대각선 화살표는 오른손 기준(왼손이면 뒤집기)", () => {
    expect(HANDWRAP_DEFAULT_HAND).toBe("right");
    expect(HANDWRAP_VIEW_NOTE.right).toContain("엄지가 왼쪽");
    expect(HANDWRAP_VIEW_NOTE.left).toContain("엄지가 오른쪽");
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

  it("속도 — 기본 보통 · 더 천천히 둘", () => {
    expect(HANDWRAP_STEP_SPEEDS.map((s) => s.rate)).toEqual([0.5, 0.75, 1]);
    expect(HANDWRAP_STEP_SPEEDS.some((s) => s.rate === HANDWRAP_DEFAULT_STEP_RATE)).toBe(true);
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
    const all = JSON.stringify([HANDWRAP_STEPS, HANDWRAP_MISTAKES, HANDWRAP_KEY_POINTS, HANDWRAP_STEP_SPEEDS, HANDWRAP_VIEW_NOTE]);
    for (const w of BANNED) expect(all.includes(w), w).toBe(false);
  });
});
