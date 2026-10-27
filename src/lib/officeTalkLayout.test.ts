import { describe, expect, it } from "vitest";
import { TALK_GAP, TALK_LIFTED_H, TALK_TAB, layoutTalk, sameTalkLayout, type TalkBox } from "./officeTalkLayout";

const W = 390;

/** 배치 결과로 말풍선 사각형(이름표 · 꼬리 자리 포함)을 다시 그린다 */
const rectOf = (b: TalkBox, p: NonNullable<ReturnType<typeof layoutTalk>[string]>) => {
  const left = b.ax - b.w / 2 + p.dx;
  const bottom = b.ay - TALK_GAP + p.dy;
  const h = p.lifted ? Math.min(TALK_LIFTED_H, b.h) : b.h;
  return {
    l: left,
    r: left + b.w,
    t: bottom - h - (p.lifted ? TALK_TAB : 0),
    b: bottom + (p.lifted ? 0 : TALK_GAP),
  };
};

const overlaps = (a: ReturnType<typeof rectOf>, b: ReturnType<typeof rectOf>) =>
  a.l < b.r - 0.01 && b.l < a.r - 0.01 && a.t < b.b - 0.01 && b.t < a.b - 0.01;

describe("officeTalkLayout — 회의실 말풍선 자리", () => {
  it("혼자 말하면 머리 바로 위 (꼬리 가운데)", () => {
    const out = layoutTalk([{ id: "a", ax: 196, ay: 104, w: 120, h: 40, at: 1 }], W);
    expect(out.a).toEqual({ dx: 0, dy: 0, lifted: false, tail: 0 });
  });

  it("옆자리 두 사람 — 최근 말은 제자리, 먼저 한 말은 위로 올라가 한 줄 (겹치지 않음)", () => {
    const boxes: TalkBox[] = [
      { id: "old", ax: 154, ay: 104, w: 130, h: 40, at: 1 },
      { id: "new", ax: 196, ay: 104, w: 130, h: 40, at: 2 },
    ];
    const out = layoutTalk(boxes, W);
    expect(out.new).toMatchObject({ dx: 0, dy: 0, lifted: false });
    expect(out.old?.lifted).toBe(true);
    expect(out.old!.dy).toBeLessThan(0);
    expect(overlaps(rectOf(boxes[0], out.old!), rectOf(boxes[1], out.new!))).toBe(false);
  });

  it("짧은 말 둘은 옆으로 비켜 같은 줄에 (꼬리는 각자 머리 위)", () => {
    const boxes: TalkBox[] = [
      { id: "a", ax: 154, ay: 104, w: 46, h: 25, at: 1 },
      { id: "b", ax: 196, ay: 104, w: 46, h: 25, at: 2 },
    ];
    const out = layoutTalk(boxes, W);
    expect(out.a?.lifted).toBe(false);
    expect(out.b?.lifted).toBe(false);
    expect(overlaps(rectOf(boxes[0], out.a!), rectOf(boxes[1], out.b!))).toBe(false);
    // 꼬리는 말풍선 안에서 각자 머리를 가리킨다
    for (const [bx, p] of [
      [boxes[0], out.a!],
      [boxes[1], out.b!],
    ] as const) {
      const left = bx.ax - bx.w / 2 + p.dx;
      expect(left + bx.w / 2 + p.tail).toBeCloseTo(bx.ax, 5);
    }
  });

  it("멀리 앉은 두 사람은 둘 다 제자리", () => {
    const out = layoutTalk(
      [
        { id: "a", ax: 70, ay: 104, w: 110, h: 40, at: 1 },
        { id: "b", ax: 320, ay: 104, w: 110, h: 40, at: 2 },
      ],
      W,
    );
    expect(out.a).toEqual({ dx: 0, dy: 0, lifted: false, tail: 0 });
    expect(out.b).toEqual({ dx: 0, dy: 0, lifted: false, tail: 0 });
  });

  it("가장자리 사람 — 말풍선은 창 안으로 들어오고 꼬리가 머리 쪽으로", () => {
    const out = layoutTalk([{ id: "a", ax: 30, ay: 104, w: 130, h: 40, at: 1 }], W);
    const p = out.a!;
    expect(30 - 65 + p.dx).toBeGreaterThanOrEqual(4);
    expect(p.tail).toBeLessThan(0);
    expect(p.lifted).toBe(false);
  });

  it("위에 자리가 없으면 먼저 한 말은 숨긴다", () => {
    const out = layoutTalk(
      [
        { id: "old", ax: 154, ay: 60, w: 130, h: 40, at: 1 },
        { id: "new", ax: 196, ay: 60, w: 130, h: 40, at: 2 },
      ],
      W,
    );
    expect(out.new?.lifted).toBe(false);
    expect(out.old).toBeNull();
  });

  it("다섯 자리 모두 말해도 보이는 말풍선끼리는 겹치지 않는다", () => {
    const xs = [110, 154, 196, 238, 282];
    const boxes: TalkBox[] = xs.map((ax, i) => ({ id: `p${i}`, ax, ay: 104, w: 100 + i * 8, h: i % 2 ? 40 : 25, at: i }));
    const out = layoutTalk(boxes, W);
    const shown = boxes.filter((b) => out[b.id]).map((b) => rectOf(b, out[b.id]!));
    expect(shown.length).toBeGreaterThanOrEqual(2);
    expect(out.p4?.lifted).toBe(false); // 가장 최근 말은 머리 위
    for (let i = 0; i < shown.length; i++) {
      expect(shown[i].t).toBeGreaterThanOrEqual(4 - 0.01);
      expect(shown[i].l).toBeGreaterThanOrEqual(4 - 0.01);
      expect(shown[i].r).toBeLessThanOrEqual(W - 4 + 0.01);
      for (let j = i + 1; j < shown.length; j++) expect(overlaps(shown[i], shown[j])).toBe(false);
    }
  });

  it("옆옆자리(85px)는 둘 다 머리 위에 나란히 — 꼬리는 각자", () => {
    const boxes: TalkBox[] = [
      { id: "old", ax: 153, ay: 120, w: 136, h: 42, at: 1 },
      { id: "new", ax: 238, ay: 120, w: 136, h: 59, at: 2 },
    ];
    const out = layoutTalk(boxes, W, 26);
    expect(out.new?.lifted).toBe(false);
    expect(out.old?.lifted).toBe(false);
    expect(overlaps(rectOf(boxes[0], out.old!), rectOf(boxes[1], out.new!))).toBe(false);
  });

  it("바로 옆자리 — 세 줄 말풍선 + 올라간 한 줄이 머리 위 105px 안에 들어간다 (회의 화면 앞줄 기준)", () => {
    const boxes: TalkBox[] = [
      { id: "old", ax: 196, ay: 105, w: 136, h: 42, at: 1 },
      { id: "new", ax: 238, ay: 105, w: 136, h: 59, at: 2 },
    ];
    const out = layoutTalk(boxes, W, 26);
    expect(out.new?.lifted).toBe(false);
    expect(out.old?.lifted).toBe(true);
  });

  it("sameTalkLayout — 반 픽셀 안쪽 차이는 같다고 본다", () => {
    const a = { x: { dx: 1, dy: -30, lifted: true, tail: 0 }, y: null };
    expect(sameTalkLayout(a, { x: { dx: 1.2, dy: -30.3, lifted: true, tail: 0 }, y: null })).toBe(true);
    expect(sameTalkLayout(a, { x: { dx: 1, dy: -30, lifted: false, tail: 0 }, y: null })).toBe(false);
    expect(sameTalkLayout(a, { x: { dx: 1, dy: -30, lifted: true, tail: 0 } })).toBe(false);
  });
});
