import { describe, expect, it } from "vitest";
import { GRID_HEIGHT_PX, MIN_EVENT_PX, hmMin, layoutDay, minHm, movedTimes, resizedEnd, slotAt, snapMin } from "./opsTimeGrid";

const ev = (id: string, start: string, end: string) => ({ id, start, end });
const lay = (rows: ReturnType<typeof ev>[]) => layoutDay(rows, (r) => r);

describe("시간축 놓기", () => {
  it("겹치지 않으면 한 칸 · 겹치면 나란히 · 묶음이 끝나면 다시 한 칸", () => {
    const out = lay([ev("a", "09:00", "10:00"), ev("b", "09:30", "11:00"), ev("c", "10:00", "10:30"), ev("d", "12:00", "13:00")]);
    const by = Object.fromEntries(out.map((p) => [p.item.id, p]));
    expect(by.a.cols).toBe(2);
    expect(by.b.cols).toBe(2);
    expect(by.a.col).toBe(0);
    expect(by.b.col).toBe(1);
    expect(by.c.col).toBe(0); // a 가 끝난 자리
    expect(by.d.cols).toBe(1);
    expect(by.a.top).toBe((9 * 60 - 6 * 60) * 0.8);
    expect(by.a.height).toBe(48);
  });
  it("06:00 앞 일정은 맨 위 15분짜리 · 짧은 일정은 누르기 쉬운 높이", () => {
    const [early] = lay([ev("e", "05:00", "05:30")]);
    expect(early.top).toBe(0);
    expect(early.early).toBe(true);
    expect(early.height).toBe(MIN_EVENT_PX);
    const [cross] = lay([ev("x", "05:30", "07:00")]);
    expect(cross.top).toBe(0);
    expect(cross.height).toBe(60 * 0.8);
  });
  it("끝이 시작보다 빠르면 15분 · 시간축 높이 = 18시간", () => {
    const [z] = lay([ev("z", "10:00", "09:00")]);
    expect(z.endMin - z.startMin).toBe(15);
    expect(GRID_HEIGHT_PX).toBe(18 * 48);
  });
});

describe("끌기 · 늘리기 · 빈 칸", () => {
  it("15분 단위 · 길이 그대로 · 하루 안", () => {
    expect(movedTimes(19 * 60, 20 * 60, 37)).toEqual({ start: 19 * 60 + 30, end: 20 * 60 + 30 });
    expect(movedTimes(23 * 60, 24 * 60, 120)).toEqual({ start: 23 * 60, end: 24 * 60 });
    expect(movedTimes(1 * 60, 2 * 60, -300)).toEqual({ start: 0, end: 60 });
  });
  it("늘리기 — 15분 아래로는 안 줄고 24:00 까지", () => {
    expect(resizedEnd(600, 660, -100)).toBe(615);
    expect(resizedEnd(600, 660, 22)).toBe(675);
    expect(resizedEnd(1380, 1410, 200)).toBe(1440);
  });
  it("시각 글자", () => {
    expect(minHm(1440)).toBe("23:59");
    expect(minHm(605)).toBe("10:05");
    expect(hmMin("07:30")).toBe(450);
    expect(hmMin(null)).toBeNull();
    expect(snapMin(52)).toBe(45);
  });
  it("빈 칸 = 누른 15분부터 1시간 · 끝은 24:00 넘지 않게", () => {
    expect(slotAt((10 * 60 - 6 * 60) * 0.8 + 5)).toEqual({ start: "10:00", end: "11:00" });
    expect(slotAt(GRID_HEIGHT_PX - 1)).toEqual({ start: "23:45", end: "23:59" });
  });
});
