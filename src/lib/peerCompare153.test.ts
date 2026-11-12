import { describe, expect, it } from "vitest";
import { NFA_BODY_FAT, NFA_GRIP_KG, NORM_PERCENTILES, type NormRow } from "@/data/nfaNorms";
import {
  LEAN_FLOOR_PCT,
  ageBand,
  ageOn,
  bandLabel,
  buildPeerCompare,
  gainParts,
  gainText,
  gapText,
  groupMean,
  inviteText,
  metricValueText,
  percentileBelow,
  peerStanding,
  rankText,
  standingShort,
  topText,
  valueText,
} from "@/lib/peerCompare153";

const BANDS = ["19-24", "25-29", "30-34", "35-39", "40-44", "45-49", "50-54", "55-59", "60-64", "65-69", "70-74", "75-79", "80-84", "85+"];

describe("기준표 (국민체력100 백분위) — 옮겨 적은 숫자 검사", () => {
  const tables: [string, readonly NormRow[]][] = [
    ["체지방률 남", NFA_BODY_FAT.남],
    ["체지방률 여", NFA_BODY_FAT.여],
    ["악력 남", NFA_GRIP_KG.남],
    ["악력 여", NFA_GRIP_KG.여],
  ];
  it.each(tables)("%s — 나이대 14개 · 백분위 19개가 커지는 순서", (_name, rows) => {
    expect(rows.map((r) => r.band)).toEqual(BANDS);
    for (const r of rows) {
      expect(r.p).toHaveLength(NORM_PERCENTILES.length);
      for (let i = 1; i < r.p.length; i++) expect(r.p[i]).toBeGreaterThan(r.p[i - 1]);
    }
  });
  it.each(tables)("%s — 평균 ≈ 50번째 · 표준편차 ≈ (95번째 − 5번째) ÷ 3.29", (_name, rows) => {
    for (const r of rows) {
      expect(Math.abs(r.mean - r.p[9])).toBeLessThanOrEqual(0.12 * r.sd + 0.6);
      const sdFromSpread = (r.p[18] - r.p[0]) / 3.29;
      expect(sdFromSpread / r.sd).toBeGreaterThan(0.75);
      expect(sdFromSpread / r.sd).toBeLessThan(1.3);
      expect(r.n).toBeGreaterThan(1000);
    }
  });
});

describe("나이대", () => {
  it("만 19세부터 · 5살씩 · 85세 이상", () => {
    expect(ageBand(18)).toBeNull();
    expect(ageBand(19)).toBe("19-24");
    expect(ageBand(24)).toBe("19-24");
    expect(ageBand(25)).toBe("25-29");
    expect(ageBand(34)).toBe("30-34");
    expect(ageBand(35)).toBe("35-39");
    expect(ageBand(64)).toBe("60-64");
    expect(ageBand(84)).toBe("80-84");
    expect(ageBand(85)).toBe("85+");
    expect(ageBand(101)).toBe("85+");
    expect(ageBand(Number.NaN)).toBeNull();
  });
  it("같은 나이 평균 — 내 값이 없어도", () => {
    expect(groupMean("bodyFat", "남", "30-34")).toBe(22.6);
    expect(groupMean("grip", "여", "40-44")).toBe(24.3);
    expect(metricValueText("grip", 42)).toBe("42kg");
    expect(metricValueText("bodyFat", 22.6)).toBe("22.6%");
  });
  it("이름표", () => {
    expect(bandLabel("30-34")).toBe("30대 초반");
    expect(bandLabel("45-49")).toBe("40대 후반");
    expect(bandLabel("19-24")).toBe("19~24세");
    expect(bandLabel("85+")).toBe("85세 이상");
  });
  it("그날 나이 = 그해 − 출생 연도 (날짜가 없으면 오늘)", () => {
    expect(ageOn(1990, "2026-03-01", "2026-11-12")).toBe(36);
    expect(ageOn(1990, "2024-12-31", "2026-11-12")).toBe(34);
    expect(ageOn(1990, null, "2026-11-12")).toBe(36);
  });
});

describe("백분위", () => {
  const p = NFA_GRIP_KG.남[2].p; // 30~34세 남성 악력
  it("표에 있는 값은 그 백분위 그대로", () => {
    expect(percentileBelow(p[9], p)).toBeCloseTo(50, 6);
    expect(percentileBelow(p[0], p)).toBeCloseTo(5, 6);
    expect(percentileBelow(p[18], p)).toBeCloseTo(95, 6);
  });
  it("사이는 직선으로", () => {
    expect(percentileBelow((p[9] + p[10]) / 2, p)).toBeCloseTo(52.5, 6);
  });
  it("양 끝은 늘이되 0.5~99.5 안", () => {
    const lo = percentileBelow(p[0] - 1, p);
    expect(lo).toBeLessThan(5);
    expect(lo).toBeGreaterThanOrEqual(0.5);
    expect(percentileBelow(0, p)).toBe(0.5);
    const hi = percentileBelow(p[18] + 1, p);
    expect(hi).toBeGreaterThan(95);
    expect(percentileBelow(200, p)).toBe(99.5);
  });
});

describe("같은 나이 안 위치", () => {
  it("악력 — 높을수록 앞: 30~34세 남성 70번째 값이면 상위 30%", () => {
    const s = peerStanding("grip", 46.0, "남", 32)!;
    expect(s.band).toBe("30-34");
    expect(s.topPct).toBe(30);
    expect(s.atOrAboveAvg).toBe(true);
    expect(s.gapToAvg).toBeNull();
    expect(topText(s)).toBe("상위 30%");
    expect(rankText(s)).toBe("100명 중 30번째");
    expect(s.barMe).toBeCloseTo(70, 6);
  });
  it("체지방률 — 낮을수록 앞: 30~34세 남성 30번째 값이면 상위 30%", () => {
    const s = peerStanding("bodyFat", 18.9, "남", 32)!;
    expect(s.topPct).toBe(30);
    expect(s.atOrAboveAvg).toBe(true);
  });
  it("평균보다 못하면 순위 대신 평균까지 남은 차이 (올림)", () => {
    const s = peerStanding("bodyFat", 25.7, "남", 32)!;
    expect(s.topPct).toBe(70);
    expect(s.atOrAboveAvg).toBe(false);
    expect(s.gapToAvg).toBe(3.1); // 25.7 − 평균 22.6
    const g = peerStanding("grip", 40.0, "여", 41)!; // 40~44세 여성 평균 24.3 → 앞
    expect(g.atOrAboveAvg).toBe(true);
    const w = peerStanding("grip", 20.0, "여", 41)!;
    expect(w.atOrAboveAvg).toBe(false);
    expect(w.gapToAvg).toBe(4.3);
  });
  it("5% 안 · 끝 순위는 1~99", () => {
    const s = peerStanding("grip", 70, "남", 30)!;
    expect(s.topPct).toBe(1);
    expect(topText(s)).toBe("상위 5% 안");
    expect(rankText(s)).toBe("100명 중 5번째 안");
    const w = peerStanding("grip", 5, "남", 30)!;
    expect(w.topPct).toBe(99);
  });
  it("체지방률 권장 범위 아래 끝 이하 — 아주 낮은 편 (남 7% · 여 16%)", () => {
    expect(peerStanding("bodyFat", LEAN_FLOOR_PCT.남, "남", 30)!.veryLean).toBe(true);
    expect(peerStanding("bodyFat", 7.1, "남", 30)!.veryLean).toBe(false);
    expect(peerStanding("bodyFat", 16, "여", 30)!.veryLean).toBe(true);
    expect(peerStanding("bodyFat", 16.1, "여", 30)!.veryLean).toBe(false);
    expect(peerStanding("grip", 5, "여", 30)!.veryLean).toBe(false);
  });
  it("만 19세 아래 · 이상한 값은 null", () => {
    expect(peerStanding("grip", 40, "남", 17)).toBeNull();
    expect(peerStanding("grip", Number.NaN, "남", 30)).toBeNull();
    expect(peerStanding("grip", 0, "남", 30)).toBeNull();
  });
});

describe("내 기록 → 비교 카드", () => {
  const today = "2026-11-12";
  it("성별 · 출생 연도가 없으면 비교하지 않고 넣을 것을 알려 준다", () => {
    const c = buildPeerCompare({ gender: null, birthYear: null, bodyFat: { pct: 21, on: today, firstPct: null, firstOn: null }, grip: null, today });
    expect(c.canCompare).toBe(false);
    expect(c.metrics).toHaveLength(0);
    expect(c.missing).toEqual(["gender", "age", "grip"]);
    expect(inviteText(c)).toBe("성별 · 출생 연도를 넣으면 같은 나이 한국인과 비교해 드려요");
    expect(inviteText(buildPeerCompare({ gender: "남", birthYear: null, today }))).toBe("출생 연도를 넣으면 같은 나이 한국인과 비교해 드려요");
    expect(inviteText(buildPeerCompare({ gender: null, birthYear: 1990, today }))).toBe("성별을 넣으면 같은 나이 한국인과 비교해 드려요");
  });
  it("만 19세 아래는 카드를 그리지 않는다", () => {
    const c = buildPeerCompare({ gender: "여", birthYear: 2010, grip: { kg: 25, on: today, firstKg: null, firstOn: null }, today });
    expect(c.tooYoung).toBe(true);
    expect(c.canCompare).toBe(false);
    expect(inviteText(c)).toBeNull();
  });
  it("지표가 하나도 없으면 체지방률 · 악력을 권한다", () => {
    const c = buildPeerCompare({ gender: "남", birthYear: 1994, today });
    expect(c.canCompare).toBe(true);
    expect(c.groupLabel).toBe("30대 초반 남성");
    expect(c.hero).toBeNull();
    expect(inviteText(c)).toBe("체지방률(인바디) · 악력을 넣으면 같은 나이 100명 중 몇 번째인지 알려 드려요");
  });
  it("주인공 = 더 앞선 지표 · 남은 지표 권유", () => {
    const c = buildPeerCompare({
      gender: "남",
      birthYear: 1994,
      bodyFat: { pct: 25.7, on: "2026-11-01", firstPct: null, firstOn: null }, // 상위 70%
      grip: { kg: 46, on: "2026-11-05", firstKg: null, firstOn: null }, // 상위 30%
      today,
    });
    expect(c.metrics.map((m) => m.key)).toEqual(["bodyFat", "grip"]);
    expect(c.hero?.key).toBe("grip");
    expect(standingShort(c.metrics[0])).toBe("평균까지 3.1%p");
    expect(standingShort(c.metrics[1])).toBe("상위 30%");
    expect(valueText(c.metrics[1])).toBe("46kg");
    expect(gapText(c.metrics[1])).toBe("");
    expect(inviteText(c)).toBeNull();
    const one = buildPeerCompare({ gender: "남", birthYear: 1994, bodyFat: { pct: 20, on: today, firstPct: null, firstOn: null }, today });
    expect(inviteText(one)).toBe("악력도 재서 넣으면 같이 비교해 드려요");
    const fatLeft = buildPeerCompare({ gender: "남", birthYear: 1994, grip: { kg: 40, on: today, firstKg: null, firstOn: null }, today });
    expect(inviteText(fatLeft)).toBe("체지방률(인바디)도 넣으면 같이 비교해 드려요");
  });
  it("아주 낮은 체지방률은 다른 지표가 있으면 주인공에서 뒤로", () => {
    const c = buildPeerCompare({
      gender: "여",
      birthYear: 1996,
      bodyFat: { pct: 15, on: today, firstPct: null, firstOn: null },
      grip: { kg: 22, on: today, firstKg: null, firstOn: null },
      today,
    });
    expect(c.hero?.key).toBe("grip");
    expect(standingShort(c.metrics[0])).toBe("아주 낮은 편");
  });
  it("처음보다 — 값도 좋아지고 순위도 오르면 계단 (처음 순위는 그날 나이로)", () => {
    // 1997년생 남성: 처음 2025-12-20(28세 · 20대 후반) 24.7% → 지금 2026-11-01(29세) 20.1%
    const c = buildPeerCompare({
      gender: "남",
      birthYear: 1997,
      bodyFat: { pct: 20.1, on: "2026-11-01", firstPct: 24.7, firstOn: "2025-12-20" },
      today,
    });
    const fat = c.metrics[0];
    expect(fat.first?.standing.band).toBe("25-29"); // 2025년 28세
    expect(fat.first?.standing.topPct).toBe(75);
    expect(fat.now.topPct).toBe(50);
    expect(fat.rankGain).toBe(25);
    expect(gainText(fat)).toBe("처음보다 25계단 올라왔어요 · 처음엔 상위 75%");
    expect(gainParts(fat)).toEqual({ main: "처음보다 25계단 올라왔어요", sub: "처음엔 상위 75%" });
  });
  it("나이대가 바뀌어도 그날 나이로 — 순위가 그대로거나 값이 나빠지면 말하지 않는다", () => {
    // 악력이 줄었으면 계단 없음
    const worse = buildPeerCompare({ gender: "남", birthYear: 1990, grip: { kg: 40, on: "2026-11-01", firstKg: 44, firstOn: "2026-05-01" }, today });
    expect(worse.metrics[0].first).not.toBeNull();
    expect(worse.metrics[0].rankGain).toBeNull();
    expect(gainText(worse.metrics[0])).toBeNull();
    // 같은 날 처음 = 마지막이면 처음 비교 없음
    const same = buildPeerCompare({ gender: "남", birthYear: 1990, grip: { kg: 44, on: "2026-11-01", firstKg: 44, firstOn: "2026-11-01" }, today });
    expect(same.metrics[0].first).toBeNull();
    // 나이대가 넘어가며(34 → 35세) 기준이 바뀌어도 값이 좋아지고 순위가 오르면 계단
    const cross = buildPeerCompare({ gender: "남", birthYear: 1991, grip: { kg: 47, on: "2026-10-01", firstKg: 43, firstOn: "2025-09-01" }, today });
    const g = cross.metrics[0];
    expect(g.first?.standing.band).toBe("30-34");
    expect(g.now.band).toBe("35-39");
    expect(g.rankGain).toBeGreaterThan(0);
  });
});
