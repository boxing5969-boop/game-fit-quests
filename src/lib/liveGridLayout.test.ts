import { describe, expect, it } from "vitest";
import { blockedCells, computeGridLayout } from "./liveGridLayout";

// 1번 화면 카드 자리 — 1888 × 520 쯤, 카드 기본 높이 116 (폭 300 기준)
const W = 1888;
const H = 520;
const CARD_H = 116;

describe("라이브보드 그리드 — 떠 있는 QR 카드 피하기 (2026-10-28)", () => {
  it("비울 자리가 없으면 예전과 같다", () => {
    const a = computeGridLayout(13, W, H, CARD_H);
    const b = computeGridLayout(13, W, H, CARD_H, null);
    expect(a).toEqual(b);
    expect(a.blocked).toEqual([]);
    expect(a.cols * a.rows).toBeGreaterThanOrEqual(13);
  });

  it("오른쪽 아래를 비우면 그 구석 칸은 쓰지 않고, 남은 칸에 모두 들어간다", () => {
    const reserve = { w: 620, h: 300 };
    const l = computeGridLayout(13, W, H, CARD_H, reserve);
    expect(l.blocked.length).toBeGreaterThan(0);
    expect(l.cols * l.rows - l.blocked.length).toBeGreaterThanOrEqual(13);
    // 비운 칸은 모두 오른쪽 아래 구석이다
    for (const i of l.blocked) {
      expect(i % l.cols).toBeGreaterThanOrEqual(1);
      expect(Math.floor(i / l.cols)).toBeGreaterThanOrEqual(1);
    }
  });

  it("사람이 많아 최소 크기로 넘길 때도 한 화면에 들어가는 수는 비운 칸만큼 줄어든다", () => {
    const reserve = { w: 620, h: 300 };
    const plain = computeGridLayout(60, W, H, CARD_H);
    const avoid = computeGridLayout(60, W, H, CARD_H, reserve);
    expect(avoid.pageSize).toBe(plain.pageSize - avoid.blocked.length);
  });

  it("칸이 비울 자리에 걸리는지 — 가운데 정렬된 칸 모음 기준", () => {
    // 3칸 × 2줄, 칸 폭 300 · 높이 116, 가로 1000 → 왼쪽 여백 (1000 - 920) / 2 = 40
    expect(blockedCells(3, 2, 1, 1000, CARD_H, 242, { w: 100, h: 100 })).toEqual([5]);
    expect(blockedCells(3, 2, 1, 1000, CARD_H, 242, { w: 0, h: 100 })).toEqual([]);
  });
});
