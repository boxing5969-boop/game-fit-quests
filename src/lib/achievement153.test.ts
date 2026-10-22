import { describe, expect, it } from "vitest";
import {
  BASIS_MINUTES,
  CLASS_BASIS,
  DEFAULT_SESSION_MINUTES,
  ROPE_MINUTES,
  boxingMinutes,
  bodyErrorText,
  bodyInputError,
  classesForRecommended,
  dayMetMinutes,
  daysThisWeek,
  formatHours,
  kcalPerHour,
  kcalTotal,
  minutesToHours,
  moveTotals,
  normalizeBodyInfo,
  parseBodyNumber,
  pbView,
  punchPerSession,
  punchTotal,
  recommendedWeeks,
  roundApprox,
  spokenDuration,
  weekMonday,
  weightLost,
} from "./achievement153";

describe("기준 — 줄넘기 2분 × 3라운드 + 복싱 60분 = 기본 66분 (서버 workout_default_minutes 와 같아야)", () => {
  it("기본 66분 · 하루 397.8 MET·분 · 권장량은 주 2번 (오래 한 하루면 1번)", () => {
    expect(BASIS_MINUTES).toBe(60);
    expect(ROPE_MINUTES).toBe(6);
    expect(DEFAULT_SESSION_MINUTES).toBe(66);
    expect(dayMetMinutes(66)).toBe(397.8);
    expect(dayMetMinutes(86)).toBe(513.8);
    expect(dayMetMinutes(4)).toBe(33.2);
    expect(dayMetMinutes(Number.NaN)).toBe(0);
    expect(classesForRecommended()).toBe(2);
  });
  it("한 번 기준 — 잽 200 · 스트레이트 150 · 스텝 300 (복싱 60분) · 줄넘기 600 (2분 × 3R) · 스쿼트 없음", () => {
    expect(Object.fromEntries(CLASS_BASIS.map((b) => [b.key, b.per]))).toEqual({ jab: 200, straight: 150, step: 300, rope: 600 });
    expect(CLASS_BASIS.some((b) => b.label.includes("스쿼트"))).toBe(false);
  });
});

describe("지금까지 — 운동한 시간(서버 분)으로 추정", () => {
  it("37번 · 모두 기본 66분 (2,442분)", () => {
    expect(boxingMinutes(37, 2442)).toBe(2220);
    const m = Object.fromEntries(moveTotals(37, 2442).map((x) => [x.key, x.total]));
    expect(m).toEqual({ jab: 7400, straight: 5550, step: 11100, rope: 22200 });
    // 큰 숫자 = 보이는 칸(내림)의 합 → 7,400 + 5,500
    expect(punchTotal(37, 2442)).toBe(12900);
    expect(punchPerSession(37, 2442)).toBe(350);
    expect(minutesToHours(2442)).toBe("40.7");
  });
  it("한 번 두 번째 체크로 120분 — 펀치 · 스텝은 늘고 줄넘기는 출석마다 그대로", () => {
    const total = 36 * 66 + 120;
    const mv = Object.fromEntries(moveTotals(37, total).map((x) => [x.key, x]));
    expect(mv.jab.total).toBeCloseTo(7580, 5);
    expect(mv.jab.perSession).toBe(205);
    expect(mv.rope.total).toBe(22200);
  });
  it("큰 숫자와 칸 숫자가 늘 맞는다 (1~400번)", () => {
    for (let c = 1; c <= 400; c++) {
      const t = c * 66 + (c % 7) * 13;
      const tiles = moveTotals(c, t).filter((x) => x.key === "jab" || x.key === "straight").reduce((a, x) => a + roundApprox(x.total), 0);
      expect(punchTotal(c, t)).toBe(tiles);
    }
  });
  it("0 · 음수 · NaN 은 0 · 출석 0이면 한 번 기준 그대로", () => {
    expect(punchTotal(0, 0)).toBe(0);
    expect(punchTotal(-3, -10)).toBe(0);
    expect(punchTotal(Number.NaN, Number.NaN)).toBe(0);
    expect(moveTotals(0, 0).find((x) => x.key === "jab")?.perSession).toBe(200);
  });
  it("시간 표시 · 추정 내림", () => {
    expect(minutesToHours(264)).toBe("4.4");
    expect(minutesToHours(660)).toBe("11");
    expect(minutesToHours(132000)).toBe("2,200");
    expect(minutesToHours(Number.NaN)).toBe("0");
    expect(formatHours(40.66)).toBe("40.7");
    expect(roundApprox(391.77)).toBe(390);
    expect(roundApprox(12950)).toBe(12900);
    expect(roundApprox(123456)).toBe(123000);
    expect(roundApprox(-5)).toBe(0);
  });
});

describe("칼로리 — MET × 몸무게 × 시간", () => {
  it("몸무게 없으면 65kg — 1시간 약 390kcal · 37번 약 15,900kcal", () => {
    expect(kcalPerHour(37, 2442, null)).toBeCloseTo(391.77, 1);
    expect(kcalPerHour(0, 0, null)).toBeCloseTo(391.77, 1); // 기록 없으면 기본 하루 기준
    expect(kcalPerHour(37, 2442, 10)).toBeCloseTo(391.77, 1); // 말이 안 되는 값도 65kg
    expect(roundApprox(kcalTotal(37, 2442, null))).toBe(15900);
  });
  it("내 몸무게 · 오래 한 날", () => {
    expect(kcalTotal(6, 396, 80)).toBeCloseTo(3182.4, 1);
    expect(kcalTotal(0, 0, 80)).toBe(0);
    // 오래 하면 복싱 비중이 커져 1시간 평균은 조금 내려간다(줄넘기가 더 센 운동) — 그래도 지금까지 칼로리는 늘어난다
    expect(kcalTotal(1, 180, 65)).toBeGreaterThan(kcalTotal(1, 66, 65));
  });
});

describe("권장 운동량 — 한 주(월~일) 500 MET·분 이상", () => {
  it("월요일 계산 — 일요일은 앞 주", () => {
    expect(weekMonday("2026-10-21")).toBe("2026-10-19"); // 수
    expect(weekMonday("2026-10-25")).toBe("2026-10-19"); // 일
    expect(weekMonday("2026-10-26")).toBe("2026-10-26"); // 월
    expect(weekMonday("2026-03-01")).toBe("2026-02-23"); // 달 넘김
    expect(weekMonday("bad")).toBeNull();
  });
  it("주 수 세기 — 기본 하루 2번이면 채움 · 같은 날 두 줄은 한 번 · 100분 하루면 한 번으로도", () => {
    const days = [
      { day: "2026-10-19", minutes: 66 },
      { day: "2026-10-25", minutes: 66 },
      { day: "2026-10-12", minutes: 66 },
      { day: "2026-10-12", minutes: 66 },
      { day: "2026-10-05", minutes: 100 },
    ];
    expect(recommendedWeeks(days)).toBe(2);
    expect(recommendedWeeks([])).toBe(0);
  });
  it("이번 주에 온 날", () => {
    expect(daysThisWeek(["2026-10-19", "2026-10-21", "2026-10-18"], "2026-10-22")).toBe(2);
    expect(daysThisWeek([], "2026-10-22")).toBe(0);
  });
});

describe("신체 정보", () => {
  it("서버 값 읽기 — 문자 숫자도", () => {
    const b = normalizeBodyInfo({ height_cm: "172.3", weight_kg: 69.5, weight_on: "2026-10-21", first_weight_kg: 72.4, first_weight_on: "2026-09-21", count: 2 });
    expect(b.heightCm).toBe(172.3);
    expect(b.weightKg).toBe(69.5);
    expect(normalizeBodyInfo(null).count).toBe(0);
    expect(normalizeBodyInfo({}).sessionMinutes).toBeNull();
  });
  it("줄었을 때만 — 늘었거나 같은 날이면 없음", () => {
    const base = normalizeBodyInfo({ weight_kg: 69.5, weight_on: "2026-10-21", first_weight_kg: 72.4, first_weight_on: "2026-09-21", count: 2 });
    expect(weightLost(base)).toBe(2.9);
    expect(weightLost({ ...base, weightKg: 73 })).toBeNull();
    expect(weightLost({ ...base, weightKg: 72.4 })).toBeNull();
    expect(weightLost({ ...base, firstWeightOn: "2026-10-21" })).toBeNull();
    expect(weightLost(null)).toBeNull();
  });
  it("입력 확인", () => {
    expect(parseBodyNumber("")).toBeNull();
    expect(parseBodyNumber("68,4")).toBe(68.4);
    expect(Number.isNaN(parseBodyNumber("6.8.4") as number)).toBe(true);
    expect(Number.isNaN(parseBodyNumber("68.45") as number)).toBe(true);
    expect(bodyInputError(null, null)).toContain("하나는");
    expect(bodyInputError(90, null)).toContain("키는");
    expect(bodyInputError(null, 300)).toContain("몸무게는");
    expect(bodyInputError(Number.NaN, 70)).toContain("키는");
    expect(bodyInputError(172.5, null)).toBeNull();
    expect(bodyInputError(null, 68.4)).toBeNull();
  });
  it("서버 오류 한 줄", () => {
    expect(bodyErrorText({ message: "body_weight_range" })).toContain("몸무게");
    expect(bodyErrorText(new Error("boom"))).toContain("저장하지 못했어요");
  });
});

describe("153 PB — 완주 기록만", () => {
  const rec = (division: string, score_ms: number, measured_at: string, finished = true) => ({ division, score_ms, measured_at, finished });
  it("오픈 완주가 있으면 오픈 · 첫 기록보다 빨라진 시간", () => {
    const v = pbView([rec("open", 1_200_000, "2026-10-01"), rec("open", 1_136_800, "2026-10-15"), rec("starter", 600_000, "2026-09-01")]);
    expect(v).toEqual({ division: "open", bestMs: 1_136_800, improvedMs: 63_200, firstMs: 1_200_000, finishedCount: 2 });
    expect(spokenDuration(63_200)).toBe("1분 3초");
  });
  it("오픈은 못 끝냈으면 스타터 · 기록 하나면 빨라진 시간 없음", () => {
    const v = pbView([rec("open", 1_600_000, "2026-10-01", false), rec("starter", 700_000, "2026-09-01")]);
    expect(v).toEqual({ division: "starter", bestMs: 700_000, improvedMs: null, firstMs: 700_000, finishedCount: 1 });
  });
  it("완주가 없으면 null · 느려졌으면 빨라진 시간 없음", () => {
    expect(pbView([rec("open", 1_600_000, "2026-10-01", false)])).toBeNull();
    expect(pbView(undefined)).toBeNull();
    expect(pbView([rec("open", 1_000_000, "2026-10-01"), rec("open", 1_100_000, "2026-10-08")])?.improvedMs).toBeNull();
    expect(spokenDuration(45_000)).toBe("45초");
    expect(spokenDuration(120_000)).toBe("2분");
  });
});
