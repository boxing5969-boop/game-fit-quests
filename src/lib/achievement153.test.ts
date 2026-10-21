import {
  BASIS_MINUTES,
  CLASS_BASIS,
  ROPE_MINUTES,
  bodyErrorText,
  bodyInputError,
  classesForRecommended,
  daysThisWeek,
  exerciseHours,
  formatHours,
  kcalPerHour,
  kcalTotal,
  moveTotals,
  normalizeBodyInfo,
  parseBodyNumber,
  parseMinutes,
  pbView,
  punchPerSession,
  punchTotal,
  recommendedWeeks,
  roundApprox,
  sessionMet,
  sessionMetMinutes,
  sessionMinutesOr60,
  sessionTotalMinutes,
  spokenDuration,
  validSessionMinutes,
  weekMonday,
  weightLost,
} from "./achievement153";

describe("기준 — 줄넘기 2분 × 3라운드 + 복싱 60분 (대표님 확정)", () => {
  it("복싱 5.8 × 60분 + 줄넘기 8.3 × 6분 = 397.8 MET·분 · 한 번 66분", () => {
    expect(BASIS_MINUTES).toBe(60);
    expect(ROPE_MINUTES).toBe(6);
    expect(sessionMetMinutes(null)).toBe(397.8);
    expect(sessionTotalMinutes(null)).toBe(66);
    expect(sessionMet(null)).toBeCloseTo(6.027, 3);
  });
  it("권장량 — 복싱 60분이면 주 2번 · 90분 1번 · 30분 3번 · 20분 4번", () => {
    expect(classesForRecommended(null)).toBe(2);
    expect(classesForRecommended(90)).toBe(1);
    expect(classesForRecommended(30)).toBe(3);
    expect(classesForRecommended(20)).toBe(4);
  });
  it("한 번 기준 — 잽 200 · 스트레이트 150 · 스텝 300 (복싱 60분) · 줄넘기 600 (2분 × 3R) · 스쿼트 없음", () => {
    expect(Object.fromEntries(CLASS_BASIS.map((b) => [b.key, b.per]))).toEqual({ jab: 200, straight: 150, step: 300, rope: 600 });
    expect(CLASS_BASIS.some((b) => b.label.includes("스쿼트"))).toBe(false);
  });
  it("복싱 시간 — 20~240분 정수만, 아니면 60분", () => {
    expect(sessionMinutesOr60(null)).toBe(60);
    expect(sessionMinutesOr60(90)).toBe(90);
    expect(sessionMinutesOr60(19)).toBe(60);
    expect(sessionMinutesOr60(241)).toBe(60);
    expect(sessionMinutesOr60(45.5)).toBe(60);
    expect(validSessionMinutes(240)).toBe(true);
  });
});

describe("지금까지 — 출석 수 × 기준 (펀치 · 스텝은 복싱 시간에 맞춰, 줄넘기는 늘 3라운드)", () => {
  it("37번 · 복싱 60분", () => {
    const m = Object.fromEntries(moveTotals(37).map((x) => [x.key, x.total]));
    expect(m).toEqual({ jab: 7400, straight: 5550, step: 11100, rope: 22200 });
    // 큰 숫자 = 보이는 칸(내림)의 합 → 7,400 + 5,500
    expect(punchTotal(37)).toBe(12900);
    expect(punchPerSession(null)).toBe(350);
    expect(exerciseHours(37)).toBe(40.7);
  });
  it("37번 · 복싱 90분 — 펀치 · 스텝은 1.5배, 줄넘기는 그대로", () => {
    const mv = moveTotals(37, 90);
    expect(mv.find((x) => x.key === "jab")).toMatchObject({ perSession: 300, total: 11100 });
    expect(mv.find((x) => x.key === "step")?.perSession).toBe(450);
    expect(mv.find((x) => x.key === "rope")).toMatchObject({ perSession: 600, total: 22200 });
    expect(punchTotal(37, 90)).toBe(11100 + 8300);
    expect(punchPerSession(90)).toBe(525);
    expect(exerciseHours(37, 90)).toBe(59.2);
  });
  it("큰 숫자와 칸 숫자가 늘 맞는다 (1~400번)", () => {
    for (let c = 1; c <= 400; c++) {
      const tiles = moveTotals(c).filter((x) => x.key === "jab" || x.key === "straight").reduce((a, x) => a + roundApprox(x.total), 0);
      expect(punchTotal(c)).toBe(tiles);
    }
  });
  it("시간 표시 — 소수 한 자리까지 · 정수는 그대로", () => {
    expect(formatHours(exerciseHours(4))).toBe("4.4");
    expect(formatHours(exerciseHours(37))).toBe("40.7");
    expect(formatHours(exerciseHours(10))).toBe("11");
    expect(formatHours(exerciseHours(2000))).toBe("2,200");
    expect(formatHours(Number.NaN)).toBe("0");
  });
  it("0 · 음수 · NaN 은 0", () => {
    expect(punchTotal(0)).toBe(0);
    expect(punchTotal(-3)).toBe(0);
    expect(punchTotal(Number.NaN)).toBe(0);
    expect(exerciseHours(0)).toBe(0);
  });
  it("추정은 내림 — 1,000 미만 10 · 10만 미만 100 · 그 위 1,000", () => {
    expect(roundApprox(391.77)).toBe(390);
    expect(roundApprox(12950)).toBe(12900);
    expect(roundApprox(5550)).toBe(5500);
    expect(roundApprox(123456)).toBe(123000);
    expect(roundApprox(-5)).toBe(0);
  });
});

describe("칼로리 — MET × 몸무게 × 시간", () => {
  it("몸무게 없으면 65kg — 1시간 약 390kcal", () => {
    expect(kcalPerHour(null)).toBeCloseTo(391.77, 1);
    expect(kcalPerHour(10)).toBeCloseTo(391.77, 1); // 말이 안 되는 값도 65kg
    expect(roundApprox(kcalTotal(37, null))).toBe(15900);
  });
  it("내 몸무게 · 내 복싱 시간 · 지금까지", () => {
    expect(kcalPerHour(80)).toBeCloseTo(482.18, 1);
    expect(kcalTotal(6, 80)).toBeCloseTo(3182.4, 1);
    expect(kcalTotal(6, 80, 90)).toBeCloseTo(4574.4, 1);
    expect(kcalTotal(0, 80)).toBe(0);
  });
});

describe("권장 운동량 — 한 주(월~일)에 2번 이상", () => {
  it("월요일 계산 — 일요일은 앞 주", () => {
    expect(weekMonday("2026-10-21")).toBe("2026-10-19"); // 수
    expect(weekMonday("2026-10-25")).toBe("2026-10-19"); // 일
    expect(weekMonday("2026-10-26")).toBe("2026-10-26"); // 월
    expect(weekMonday("2026-03-01")).toBe("2026-02-23"); // 달 넘김
    expect(weekMonday("bad")).toBeNull();
  });
  it("주 수 세기 — 같은 날 두 번은 한 번 · 복싱 시간에 따라 필요한 횟수가 다르다", () => {
    const days = ["2026-10-19", "2026-10-25", "2026-10-12", "2026-10-12", "2026-10-05", "2026-10-06", "2026-10-07"];
    expect(recommendedWeeks(days)).toBe(2);
    expect(recommendedWeeks(days, 90)).toBe(3); // 복싱 90분이면 한 번으로 채움
    expect(recommendedWeeks(days, 30)).toBe(1); // 30분이면 3번 필요
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
    expect(normalizeBodyInfo({ session_minutes: 90 }).sessionMinutes).toBe(90);
    expect(normalizeBodyInfo({ session_minutes: 999 }).sessionMinutes).toBeNull();
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
    expect(bodyInputError(null, null, 90)).toBeNull();
    expect(bodyInputError(null, null, 10)).toContain("20~240분");
    expect(bodyInputError(null, null, Number.NaN)).toContain("20~240분");
    expect(parseMinutes("")).toBeNull();
    expect(parseMinutes("90")).toBe(90);
    expect(Number.isNaN(parseMinutes("9.5") as number)).toBe(true);
    expect(bodyInputError(90, null)).toContain("키는");
    expect(bodyInputError(null, 300)).toContain("몸무게는");
    expect(bodyInputError(Number.NaN, 70)).toContain("키는");
    expect(bodyInputError(172.5, null)).toBeNull();
    expect(bodyInputError(null, 68.4)).toBeNull();
  });
  it("서버 오류 한 줄", () => {
    expect(bodyErrorText({ message: "body_weight_range" })).toContain("몸무게");
    expect(bodyErrorText({ message: "session_minutes_range" })).toContain("복싱 시간");
    expect(bodyErrorText(new Error("boom"))).toContain("저장하지 못했어요");
  });
});

describe("153 PB — 완주 기록만", () => {
  const rec = (division: string, score_ms: number, measured_at: string, finished = true) => ({ division, score_ms, measured_at, finished });
  it("오픈 완주가 있으면 오픈 · 첫 기록보다 빨라진 시간", () => {
    const v = pbView([rec("open", 1_200_000, "2026-10-01"), rec("open", 1_136_800, "2026-10-15"), rec("starter", 600_000, "2026-09-01")]);
    expect(v).toEqual({ division: "open", bestMs: 1_136_800, improvedMs: 63_200, finishedCount: 2 });
    expect(spokenDuration(63_200)).toBe("1분 3초");
  });
  it("오픈은 못 끝냈으면 스타터 · 기록 하나면 빨라진 시간 없음", () => {
    const v = pbView([rec("open", 1_600_000, "2026-10-01", false), rec("starter", 700_000, "2026-09-01")]);
    expect(v).toEqual({ division: "starter", bestMs: 700_000, improvedMs: null, finishedCount: 1 });
  });
  it("완주가 없으면 null · 느려졌으면 빨라진 시간 없음", () => {
    expect(pbView([rec("open", 1_600_000, "2026-10-01", false)])).toBeNull();
    expect(pbView(undefined)).toBeNull();
    expect(pbView([rec("open", 1_000_000, "2026-10-01"), rec("open", 1_100_000, "2026-10-08")])?.improvedMs).toBeNull();
    expect(spokenDuration(45_000)).toBe("45초");
    expect(spokenDuration(120_000)).toBe("2분");
  });
});
