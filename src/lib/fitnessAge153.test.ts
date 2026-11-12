import { describe, expect, it } from "vitest";
import { NFA_VO2MAX, NORM_PERCENTILES } from "@/data/nfaNorms";
import { KNHANES_AEROBIC_PCT, KNHANES_BANDS, knhanesBand, knhanesBandLabel } from "@/data/knhanesActivity";
import {
  FITNESS_AGE_MIN,
  LEE2022,
  activityStatus,
  addDays,
  bodyInviteText,
  buildBodyCompare,
  cardioEstimate,
  cardioNextStep,
  cardioShort,
  daysBetween,
  fitnessAgeOf,
  fitnessPartChips,
  goalProgressText,
  koreaActivePct,
  koreaGroupLabel,
  peopleOf100,
  weeksMetText,
} from "@/lib/fitnessAge153";
import { buildPeerCompare } from "@/lib/peerCompare153";

const today = "2026-11-12"; // 목요일 — 이번 주 월요일 11-09, 4주 = 10-19 · 10-26 · 11-02 · 11-09
const visit = (day: string, minutes = 66) => ({ day, minutes });
/** 4주 동안 주 2번 (기본 66분) */
const TWICE_A_WEEK = ["2026-10-20", "2026-10-22", "2026-10-27", "2026-10-29", "2026-11-03", "2026-11-05", "2026-11-10", "2026-11-11"].map((d) => visit(d));
/** 4주 동안 주 1번 */
const ONCE_A_WEEK = ["2026-10-20", "2026-10-27", "2026-11-03", "2026-11-10"].map((d) => visit(d));

describe("기준표 — 심폐 체력(표 7) · 국민건강영양조사", () => {
  it.each([["남"], ["여"]] as const)("심폐 %s — 19~64세 9칸 · 백분위가 커지는 순서 · 평균 = 50번째", (sex) => {
    const rows = NFA_VO2MAX[sex];
    expect(rows.map((r) => r.band)).toEqual(["19-24", "25-29", "30-34", "35-39", "40-44", "45-49", "50-54", "55-59", "60-64"]);
    for (const r of rows) {
      expect(r.p).toHaveLength(NORM_PERCENTILES.length);
      for (let i = 1; i < r.p.length; i++) expect(r.p[i]).toBeGreaterThan(r.p[i - 1]);
      expect(r.mean).toBe(r.p[9]);
      expect(Math.abs(r.sd - (r.p[18] - r.p[0]) / 3.29)).toBeLessThan(0.06);
      expect(r.n).toBeGreaterThan(3000);
    }
    // 나이 들수록 가운데 값이 낮아진다 (한 번도 올라가지 않음)
    for (let i = 1; i < rows.length; i++) expect(rows[i].p[9]).toBeLessThanOrEqual(rows[i - 1].p[9]);
  });
  it("국민건강영양조사 2025 실천율 — 나이대 6칸 · 0~100 · 전체는 남녀 사이", () => {
    for (const b of KNHANES_BANDS) {
      const m = KNHANES_AEROBIC_PCT.남[b];
      const f = KNHANES_AEROBIC_PCT.여[b];
      const all = KNHANES_AEROBIC_PCT.전체[b];
      for (const v of [m, f, all]) {
        expect(v).toBeGreaterThan(0);
        expect(v).toBeLessThan(100);
      }
      expect(all).toBeGreaterThanOrEqual(Math.min(m, f) - 0.5);
      expect(all).toBeLessThanOrEqual(Math.max(m, f) + 0.5);
    }
  });
  it("나이 → 나이대 · 이름표", () => {
    expect(knhanesBand(18)).toBeNull();
    expect(knhanesBand(19)).toBe("19-29");
    expect(knhanesBand(29)).toBe("19-29");
    expect(knhanesBand(30)).toBe("30-39");
    expect(knhanesBand(69)).toBe("60-69");
    expect(knhanesBand(70)).toBe("70+");
    expect(knhanesBandLabel("19-29")).toBe("19~29세");
    expect(knhanesBandLabel("40-49")).toBe("40대");
    expect(knhanesBandLabel("70+")).toBe("70대 이상");
    expect(koreaActivePct("여", 32)).toBe(45.6);
    expect(koreaActivePct("남", 25)).toBe(64.6);
    expect(koreaActivePct(null, 45)).toBe(47.9);
    expect(koreaActivePct("여", 18)).toBeNull();
    expect(koreaGroupLabel("여", 32)).toBe("30대 여성");
    expect(koreaGroupLabel(null, 32)).toBe("30대");
  });
});

describe("날짜", () => {
  it("더하기 · 사이", () => {
    expect(addDays("2026-11-12", -3)).toBe("2026-11-09");
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(daysBetween("2026-06-01", "2026-11-12")).toBe(164);
  });
});

describe("권장 운동량 — 지난 4주 중 3주", () => {
  it("주 2번이면 4주 모두 채움 → 권장 운동량을 채우는 사람", () => {
    const a = activityStatus(TWICE_A_WEEK, today);
    expect(a.weeks.map((w) => w.monday)).toEqual(["2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09"]);
    expect(a.weeks.every((w) => w.done)).toBe(true);
    expect(a.weeks[0].met).toBe(795.6);
    expect(a.weeksMet).toBe(4);
    expect(a.active).toBe(true);
    expect(a.thisWeekDone).toBe(true);
    expect(a.thisWeekVisitsLeft).toBe(0);
    expect(weeksMetText(a)).toBe("4주 중 4주");
  });
  it("주 1번(397.8)은 한 주도 못 채움 · 이번 주 1번 더", () => {
    const a = activityStatus(ONCE_A_WEEK, today);
    expect(a.weeksMet).toBe(0);
    expect(a.active).toBe(false);
    expect(a.thisWeekVisitsLeft).toBe(1);
  });
  it("이번 주에 아직 안 왔으면 2번 · 긴 하루(두 번째 체크 120분)는 한 번에 채운다", () => {
    expect(activityStatus([], today).thisWeekVisitsLeft).toBe(2);
    const long = activityStatus([visit("2026-11-10", 120)], today);
    expect(long.weeks[3].met).toBeCloseTo(5.8 * 114 + 8.3 * 6, 6);
    expect(long.thisWeekDone).toBe(true);
  });
  it("3주만 채워도 된다 · 2주는 아직 · 오늘 뒤 · 4주 앞 날짜는 안 센다 · 같은 날은 가장 긴 것 하나", () => {
    const three = activityStatus(TWICE_A_WEEK.filter((d) => d.day >= "2026-10-26"), today);
    expect(three.weeksMet).toBe(3);
    expect(three.active).toBe(true);
    const two = activityStatus(TWICE_A_WEEK.filter((d) => d.day >= "2026-11-02"), today);
    expect(two.active).toBe(false);
    const noisy = activityStatus(
      [...ONCE_A_WEEK, visit("2026-11-10", 30), visit("2026-11-14"), visit("2026-10-18"), visit("2026-10-18")],
      today,
    );
    expect(noisy.weeks[3].met).toBe(397.8);
    expect(noisy.weeksMet).toBe(0);
  });
});

describe("심폐 체력 추정 — 같은 나이 가운데 값 + 보통 사람과의 차이", () => {
  it("30대 초반 여성 · 권장 운동량을 채움 · 다른 정보 없음 → 가운데 + 3.513 × (1 − 45.6%)", () => {
    const c = cardioEstimate({ sex: "여", age: 32, active: true })!;
    expect(c.band).toBe("30-34");
    expect(c.median).toBe(32.4);
    expect(c.activePct).toBe(45.6);
    expect(c.parts.activity).toBeCloseTo(3.513 * 0.544, 6);
    expect(c.parts.bodyFat).toBeNull();
    expect(c.parts.restHr).toBeNull();
    expect(c.est).toBeCloseTo(34.311, 3);
    expect(c.topRaw).toBeCloseTo(31.57, 1);
    expect(c.topPct).toBe(35); // 5% 단위 올림
    expect(c.atOrAboveAvg).toBe(true);
    expect(c.barAvg).toBe(50);
    expect(cardioShort(c)).toBe("상위 35%");
    expect(cardioNextStep(c, true)).toBeNull();
  });
  it("못 채우면 −3.513 × 45.6% → 가운데 아래 · 다음 한 걸음", () => {
    const c = cardioEstimate({ sex: "여", age: 32, active: false })!;
    expect(c.delta).toBeCloseTo(-3.513 * 0.456, 6);
    expect(c.atOrAboveAvg).toBe(false);
    expect(cardioShort(c)).toBe("다음 목표");
    expect(cardioNextStep(c, false)).toBe("주 2번씩, 4주 중 3주를 채우면 평균을 넘어요");
    const heavy = cardioEstimate({ sex: "여", age: 32, active: false, bodyFatPct: 40 })!;
    expect(cardioNextStep(heavy, false)).toBe("주 2번씩, 4주 중 3주를 채우면 평균에 가까워져요");
    const activeHeavy = cardioEstimate({ sex: "여", age: 32, active: true, bodyFatPct: 40 })!;
    expect(activeHeavy.atOrAboveAvg).toBe(false);
    expect(cardioNextStep(activeHeavy, true)).toBe("체지방률을 6.2%p 내리면 평균을 넘어요");
  });
  it("40대 후반 남성 · 채움 · 체지방률 18% · 안정시 심박 62 — 세 몫을 더한다", () => {
    const c = cardioEstimate({ sex: "남", age: 45, active: true, bodyFatPct: 18, restHr: 62 })!;
    expect(c.median).toBe(37.3);
    expect(c.bodyFatRef).toBe(23.0);
    expect(c.parts.activity).toBeCloseTo(1.7565, 6);
    expect(c.parts.bodyFat).toBeCloseTo(2.055, 6);
    expect(c.parts.restHr).toBeCloseTo(0.384, 6);
    expect(c.est).toBeCloseTo(41.4955, 4);
    expect(c.topPct).toBe(15);
  });
  it("체지방률은 남 7% · 여 16% 아래면 그 값으로 · 이상한 값은 넣지 않은 것으로", () => {
    const lean = cardioEstimate({ sex: "남", age: 30, active: true, bodyFatPct: 5 })!;
    expect(lean.parts.bodyFat).toBeCloseTo(-LEE2022.bodyFat * (7 - 22.2), 6);
    expect(cardioEstimate({ sex: "남", age: 30, active: true, bodyFatPct: 80 })!.parts.bodyFat).toBeNull();
    expect(cardioEstimate({ sex: "남", age: 30, active: true, restHr: 20 })!.parts.restHr).toBeNull();
  });
  it("19세 아래 · 65세 이상은 기준표가 없어 null", () => {
    expect(cardioEstimate({ sex: "남", age: 18, active: true })).toBeNull();
    expect(cardioEstimate({ sex: "여", age: 65, active: true })).toBeNull();
    expect(cardioEstimate({ sex: "여", age: 64, active: true })).not.toBeNull();
  });
});

describe("체력 나이 — 나이 − 차이 ÷ 0.308", () => {
  it("30대 초반 여성 · 채움 → 6.2살 젊음 → 내림 6살 · 체력 나이 26", () => {
    const f = fitnessAgeOf(32, cardioEstimate({ sex: "여", age: 32, active: true })!);
    expect(f.youngerRaw).toBeCloseTo(6.2048, 3);
    expect(f.younger).toBe(6);
    expect(f.fitnessAge).toBe(26);
    expect(f.floored).toBe(false);
    expect(fitnessPartChips(f)).toEqual([{ key: "activity", text: "153 운동 −6살" }]);
  });
  it("세 몫 이름표 — 젊게 만든 몫만", () => {
    const f = fitnessAgeOf(45, cardioEstimate({ sex: "남", age: 45, active: true, bodyFatPct: 18, restHr: 62 })!);
    expect(f.younger).toBe(13);
    expect(f.fitnessAge).toBe(32);
    expect(fitnessPartChips(f).map((c) => c.text)).toEqual(["153 운동 −5살", "체지방률 −6살", "안정시 심박 −1살"]);
    const mixed = fitnessAgeOf(32, cardioEstimate({ sex: "여", age: 32, active: true, bodyFatPct: 31 })!);
    expect(mixed.parts.find((p) => p.key === "bodyFat")!.years).toBeLessThan(0);
    expect(fitnessPartChips(mixed).map((c) => c.key)).toEqual(["activity"]);
  });
  it("20세 아래로는 말하지 않는다", () => {
    const f = fitnessAgeOf(24, cardioEstimate({ sex: "남", age: 24, active: true, bodyFatPct: 10, restHr: 55 })!);
    expect(f.floored).toBe(true);
    expect(f.fitnessAge).toBe(FITNESS_AGE_MIN);
    expect(f.younger).toBe(4);
  });
  it("못 채우면 나이 든 쪽 (젊음 0 이하)", () => {
    const f = fitnessAgeOf(32, cardioEstimate({ sex: "여", age: 32, active: false })!);
    expect(f.younger).toBeLessThan(1);
  });
});

describe("카드 한 장 — buildBodyCompare", () => {
  it("성별을 모르면 체력 나이 대신 권유 · 같은 나이 한국인 운동 비율은 나이만으로", () => {
    const c = buildBodyCompare({ gender: null, birthYear: 1994, days: TWICE_A_WEEK, today });
    expect(c.peer.canCompare).toBe(false);
    expect(c.cardio).toBeNull();
    expect(c.hero).toBeNull();
    expect(c.activity.active).toBe(true);
    expect(c.activePct).toBe(54.2);
    expect(c.activeGroupLabel).toBe("30대");
    expect(peopleOf100(c.activePct!)).toBe("100명 중 54명");
    expect(c.invite).toBe("성별을 넣으면 체력 나이를 알려 드려요");
    expect(buildBodyCompare({ gender: null, birthYear: null, days: [], today }).invite).toBe("성별 · 출생 연도를 넣으면 체력 나이를 알려 드려요");
  });
  it("성별 · 나이 · 권장 운동량 → 주인공 = 체력 나이 · 체지방률을 넣으면 더 정확해져요", () => {
    const c = buildBodyCompare({ gender: "여", birthYear: 1994, days: TWICE_A_WEEK, today });
    expect(c.hero).toEqual({ kind: "fitnessAge" });
    expect(c.fitness?.fitnessAge).toBe(26);
    expect(c.activePct).toBe(45.6);
    expect(c.goalYears).toBeNull();
    expect(c.invite).toBe("체지방률(인바디)을 넣으면 체력 나이가 더 정확해져요");
  });
  it("아직 못 채우고 잰 값도 없으면 주인공 = 다음 목표(채우면 6살 젊은 체력)", () => {
    const c = buildBodyCompare({ gender: "여", birthYear: 1994, days: ONCE_A_WEEK, today });
    expect(c.hero).toEqual({ kind: "goal" });
    expect(c.goalYears).toBe(6);
    expect(goalProgressText(c.activity)).toBe("이번 주부터 시작해요 · 이번 주 1번 더");
  });
  it("못 채웠어도 잰 값이 있으면 그 지표가 주인공 · 체지방률 · 악력이 다 있으면 권유 없음", () => {
    const c = buildBodyCompare({
      gender: "남",
      birthYear: 1994,
      days: ONCE_A_WEEK,
      bodyFat: { pct: 25.7, on: "2026-11-01", firstPct: null, firstOn: null },
      grip: { kg: 46, on: "2026-11-05", firstKg: null, firstOn: null },
      today,
    });
    expect(c.hero?.kind).toBe("metric");
    expect(c.hero?.kind === "metric" && c.hero.metric.key).toBe("grip");
    expect(c.invite).toBeNull();
  });
  it("처음보다 — 첫 4주는 주 1번 → 지금 주 2번: 처음엔 38세 → 지금 26세", () => {
    const first = ["2026-06-01", "2026-06-08", "2026-06-15", "2026-06-22"].map((d) => visit(d));
    const c = buildBodyCompare({ gender: "여", birthYear: 1994, days: [...first, ...TWICE_A_WEEK], firstDay: "2026-06-01", today });
    expect(c.fitness?.fitnessAge).toBe(26);
    expect(c.fitnessFirst).toEqual({ fitnessAge: 38, gain: 12 });
    // 처음부터 주 2번이었으면 그대로 — 말하지 않는다
    const steady = ["2026-06-01", "2026-06-03", "2026-06-08", "2026-06-10", "2026-06-15", "2026-06-17", "2026-06-22", "2026-06-24"].map((d) => visit(d));
    expect(buildBodyCompare({ gender: "여", birthYear: 1994, days: [...steady, ...TWICE_A_WEEK], firstDay: "2026-06-01", today }).fitnessFirst).toBeNull();
    // 첫 출석 8주가 안 지났으면 말하지 않는다
    expect(buildBodyCompare({ gender: "여", birthYear: 1994, days: TWICE_A_WEEK, firstDay: "2026-10-20", today }).fitnessFirst).toBeNull();
  });
  it("체지방률이 처음보다 내려가도 처음보다 젊어진다", () => {
    const c = buildBodyCompare({
      gender: "남",
      birthYear: 1990,
      days: TWICE_A_WEEK,
      firstDay: "2026-03-02",
      bodyFat: { pct: 19, on: "2026-11-01", firstPct: 25, firstOn: "2026-03-05" },
      today,
    });
    // 처음 4주는 출석이 없어(기록 없음) 못 채움 + 체지방률 25 → 지금 채움 + 19
    expect(c.fitnessFirst).not.toBeNull();
    expect(c.fitnessFirst!.gain).toBeGreaterThan(10);
  });
  it("65세 이상은 심폐 기준표가 없어 예전 비교 그대로 · 19세 아래는 카드 없음", () => {
    const old = buildBodyCompare({ gender: "여", birthYear: 1958, days: TWICE_A_WEEK, today });
    expect(old.cardio).toBeNull();
    expect(old.hero).toBeNull();
    expect(old.activePct).toBe(40.9);
    expect(old.invite).toBe("체지방률(인바디) · 악력을 넣으면 같은 나이 100명 중 몇 번째인지 알려 드려요");
    const young = buildBodyCompare({ gender: "남", birthYear: 2010, days: TWICE_A_WEEK, today });
    expect(young.peer.tooYoung).toBe(true);
    expect(young.invite).toBeNull();
  });
  it("권유 글 차례 — 체지방률 먼저 · 다음 악력", () => {
    const fatOnly = buildPeerCompare({ gender: "남", birthYear: 1994, bodyFat: { pct: 20, on: today, firstPct: null, firstOn: null }, today });
    expect(bodyInviteText(fatOnly)).toBe("악력도 재서 넣으면 근력도 같이 비교해 드려요");
    const gripOnly = buildPeerCompare({ gender: "남", birthYear: 1994, grip: { kg: 40, on: today, firstKg: null, firstOn: null }, today });
    expect(bodyInviteText(gripOnly)).toBe("체지방률(인바디)을 넣으면 체력 나이가 더 정확해져요");
  });
  it("다음 목표 한 줄", () => {
    const two = activityStatus(TWICE_A_WEEK.filter((d) => d.day >= "2026-11-02"), today);
    expect(goalProgressText(two)).toBe("지금 4주 중 2주 채웠어요 · 이번 주는 채웠어요");
    const one = activityStatus([visit("2026-10-27"), visit("2026-10-29"), visit("2026-11-10")], today);
    expect(goalProgressText(one)).toBe("지금 4주 중 1주 채웠어요 · 이번 주 1번 더");
  });
});
