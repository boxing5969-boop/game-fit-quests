import { describe, expect, it } from "vitest";

import {
  EXAMPLES_UNTIL_POSTS,
  PARTNER_CALL_EXAMPLES,
  examplesFor,
  examplesForDay,
  kstDayKey,
  showPartnerExamples,
} from "./partnerCallExamples";

describe("showPartnerExamples", () => {
  it("모집이 5개가 될 때까지만", () => {
    expect(showPartnerExamples(0)).toBe(true);
    expect(showPartnerExamples(EXAMPLES_UNTIL_POSTS - 1)).toBe(true);
    expect(showPartnerExamples(EXAMPLES_UNTIL_POSTS)).toBe(false);
  });
  it("서버가 알려 주지 않으면 안 보인다", () => {
    expect(showPartnerExamples(undefined)).toBe(false);
    expect(showPartnerExamples(null)).toBe(false);
  });
});

describe("examplesForDay", () => {
  it("같은 날에는 같은 순서, 겹치지 않게", () => {
    const a = examplesForDay(4, "2026-10-28");
    expect(a).toEqual(examplesForDay(4, "2026-10-28"));
    expect(new Set(a.map((x) => x.id)).size).toBe(4);
  });
  it("날마다 앞에 오는 예시가 바뀐다", () => {
    const firsts = new Set(["2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"].map((d) => examplesForDay(1, d)[0].id));
    expect(firsts.size).toBeGreaterThan(1);
  });
  it("있는 것보다 많이 달라고 해도 넘치지 않는다", () => {
    expect(examplesForDay(99, "2026-10-28")).toHaveLength(PARTNER_CALL_EXAMPLES.length);
  });
  it("예시는 미트 · 같이 운동만 (회원이 고를 수 있는 종류)", () => {
    expect(PARTNER_CALL_EXAMPLES.every((x) => x.purpose === "mitt" || x.purpose === "together")).toBe(true);
  });
});

describe("examplesFor", () => {
  const day = "2026-10-28";
  it("지금 올릴 수 있는 예시가 앞에 (저녁 6시 — 오후 6~9시 예시 먼저)", () => {
    const four = examplesFor(4, { now: 18, atGym: false, day });
    expect(four.map((x) => x.hour).sort()).toEqual([18, 19, 20, 21]);
  });
  it("체육관에 없으면 '지금' 예시는 빼요", () => {
    const all = examplesFor(99, { now: 9, atGym: false, day });
    expect(all.some((x) => x.hour == null)).toBe(false);
    expect(all).toHaveLength(PARTNER_CALL_EXAMPLES.length - 1);
  });
  it("체육관에 있으면 '지금' 예시도 앞쪽에", () => {
    const four = examplesFor(4, { now: 18, atGym: true, day });
    expect(four.some((x) => x.hour == null)).toBe(true);
  });
  it("지난 시간 예시는 뒤로 (밤 11시에도 비지 않게)", () => {
    const late = examplesFor(3, { now: 23, atGym: false, day });
    expect(late).toHaveLength(3);
  });
});

describe("kstDayKey", () => {
  it("한국 날짜", () => {
    expect(kstDayKey(new Date("2026-10-28T15:30:00Z"))).toBe("2026-10-29");
  });
});
