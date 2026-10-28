import { describe, expect, it } from "vitest";

import { defaultHour, formatHour, hourChips, kstHour, laterHours } from "./partnerCallTime";

describe("formatHour", () => {
  it("오전 · 낮 · 오후", () => {
    expect(formatHour(7)).toBe("오전 7시");
    expect(formatHour(12)).toBe("낮 12시");
    expect(formatHour(21)).toBe("오후 9시");
  });
});

describe("hourChips", () => {
  it("평소 시간 앞뒤 1시간 (아직 안 지났을 때)", () => {
    expect(hourChips(19, 10)).toEqual([18, 19, 20]);
  });
  it("지난 시간은 빼고 뒤로 채워요", () => {
    expect(hourChips(19, 19)).toEqual([19, 20, 21]);
    expect(hourChips(19, 20)).toEqual([20, 21, 22]);
  });
  it("평소 시간이 다 지났으면 지금부터 세 칸", () => {
    expect(hourChips(7, 15)).toEqual([15, 16, 17]);
  });
  it("평소 시간을 모르면 지금부터 세 칸", () => {
    expect(hourChips(null, 18)).toEqual([18, 19, 20]);
    expect(hourChips(undefined, 22)).toEqual([22, 23]);
  });
  it("새벽에는 오전 5시부터", () => {
    expect(hourChips(null, 2)).toEqual([5, 6, 7]);
    expect(hourChips(5, 1)).toEqual([5, 6, 7]);
  });
  it("오후 11시가 끝", () => {
    expect(hourChips(23, 21)).toEqual([21, 22, 23]);
    expect(hourChips(23, 23)).toEqual([23]);
  });
});

describe("defaultHour", () => {
  it("평소 시간이 칩에 있으면 그것", () => {
    expect(defaultHour(19, 10)).toBe(19);
  });
  it("평소 시간이 지났으면 첫 칩", () => {
    expect(defaultHour(19, 20)).toBe(20);
    expect(defaultHour(null, 18)).toBe(18);
  });
});

describe("laterHours", () => {
  it("지금부터 23시까지", () => {
    expect(laterHours(21)).toEqual([21, 22, 23]);
    expect(laterHours(3)[0]).toBe(5);
  });
});

describe("kstHour", () => {
  it("UTC 를 한국 시간으로", () => {
    expect(kstHour(new Date("2026-10-28T07:50:00Z"))).toBe(16);
    expect(kstHour(new Date("2026-10-28T15:10:00Z"))).toBe(0);
  });
});
