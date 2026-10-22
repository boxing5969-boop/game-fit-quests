import { describe, expect, it } from "vitest";
import {
  BODY_FAT_MAX_PP,
  LIFE_GAIN_CAP_DAYS,
  activeMonths,
  cardioDoseWeeks,
  formatLifeGain,
  formatPct,
  formatWeeks,
  healthGains,
  lifeGainHours,
  muscleDoseWeeks,
  nextPunchGoal,
  perVisit,
  previewGains,
  saturatingPct,
  strengthWeeks,
  valueFeedback,
  valueTotals,
  visitsLast28,
} from "./healthGains153";

const d = (day: string, minutes = 66) => ({ day, minutes });

describe("건강 수명 — 운동 1시간 ≈ 7시간 (최대 약 3.2년)", () => {
  it("운동 시간 × 7", () => {
    expect(lifeGainHours(60)).toBe(7);
    expect(lifeGainHours(7278)).toBeCloseTo(849.1, 1); // 121.3시간 → 약 35일
    expect(formatLifeGain(lifeGainHours(7278))).toBe("35일");
  });
  it("글자 — 하루 전엔 시간 · 1년 넘으면 년 · 상한", () => {
    expect(formatLifeGain(7.7)).toBe("7시간");
    expect(formatLifeGain(24 * 400)).toBe("1년");
    expect(lifeGainHours(10_000_000)).toBe(LIFE_GAIN_CAP_DAYS * 24);
    expect(formatLifeGain(lifeGainHours(10_000_000))).toBe("3.2년");
    expect(lifeGainHours(Number.NaN)).toBe(0);
    expect(lifeGainHours(-5)).toBe(0);
  });
});

describe("심폐지구력 · 근력 — 쌓인 주에 따라 상한까지 천천히", () => {
  it("0주 0 · 8주 약 63% · 상한을 넘지 않는다", () => {
    expect(saturatingPct(15, 0)).toBe(0);
    expect(saturatingPct(15, 8)).toBeCloseTo(9.48, 1);
    expect(saturatingPct(15, 1000)).toBeLessThanOrEqual(15);
    expect(formatPct(13.2)).toBe("13");
    expect(formatPct(1.76)).toBe("1.7");
    expect(formatPct(0)).toBe("0");
  });
  it("근력 — 한 주에 2번 이상 온 주만 (같은 날 두 번은 한 번)", () => {
    // 10/19(월) 주: 19 · 21 → 1주 · 10/26 주: 26 하루(두 줄) → 안 셈
    expect(strengthWeeks([d("2026-10-19"), d("2026-10-21"), d("2026-10-26"), d("2026-10-26")])).toBe(1);
    expect(strengthWeeks([])).toBe(0);
  });
});

describe("행복도 — 한 달에 4번 이상 온 달마다 1.5일", () => {
  it("꾸준히 운동한 달만 센다", () => {
    const sep = ["01", "03", "05", "07"].map((x) => d(`2026-09-${x}`));
    const oct = ["01", "03", "05"].map((x) => d(`2026-10-${x}`));
    expect(activeMonths([...sep, ...oct])).toBe(1);
    expect(healthGains([...sep, ...oct], 7 * 66).moodDays).toBe(2); // 1.5 → 2 (반올림)
  });
});

describe("healthGains — 네 가지 + 153 PB 실측", () => {
  it("빈 기록이면 모두 0 · PB 없음", () => {
    const g = healthGains([], 0, null);
    expect(g).toMatchObject({ lifeHours: 0, lifeLabel: "0시간", cardioWeeks: 0, cardioDose: 0, cardioPct: 0, strengthWeeks: 0, muscleDose: 0, endurancePct: 0, strengthPct: 0, fitnessPct: 0, bodyFatPp: 0, activeMonths: 0, moodDays: 0, pbFasterPct: null });
  });
  it("PB — 첫 완주보다 빨라진 비율", () => {
    const rec = (score_ms: number, measured_at: string) => ({ division: "open", score_ms, measured_at, finished: true });
    const g = healthGains([d("2026-10-01")], 66, [rec(1_200_000, "2026-10-01"), rec(1_136_800, "2026-10-15")]);
    expect(g.pbFasterPct).toBeCloseTo(5.27, 1);
  });
  it("두 번 온 주 · 권장량 채운 주가 쌓이면 심폐 · 근력이 오른다", () => {
    const days = [];
    for (let w = 0; w < 12; w++) {
      const mon = new Date(Date.UTC(2026, 6, 6) + w * 7 * 86400000);
      days.push(d(mon.toISOString().slice(0, 10)), d(new Date(mon.getTime() + 2 * 86400000).toISOString().slice(0, 10)));
    }
    const g = healthGains(days, days.length * 66);
    expect(g.cardioWeeks).toBe(12);
    expect(g.strengthWeeks).toBe(12);
    expect(g.cardioDose).toBeCloseTo(12, 5);
    expect(g.muscleDose).toBe(12);
    expect(g.cardioPct).toBeGreaterThan(10);
    expect(g.cardioPct).toBeLessThan(15);
    // 근지구력 최대 10% · 근력 최대 8% — 12주면 상한의 약 78%
    expect(g.endurancePct).toBeGreaterThan(7);
    expect(g.endurancePct).toBeLessThan(10);
    expect(g.strengthPct).toBeGreaterThan(6);
    expect(g.strengthPct).toBeLessThan(8);
    expect(g.fitnessPct).toBeCloseTo((g.cardioPct + g.endurancePct + g.strengthPct) / 3, 6);
    expect(g.bodyFatPp).toBeGreaterThan(1.5);
    expect(g.bodyFatPp).toBeLessThan(BODY_FAT_MAX_PP);
  });
});

describe("용량 주 — 주 1번만 와도 쌓인다 (2026-10-22 대표님: 주 2회 · 1회 회원도 가치를 느끼게)", () => {
  it("66분 1번 = 심폐 0.8주 · 근육 0.5주, 2번 = 1주 (넘치지 않는다)", () => {
    expect(cardioDoseWeeks([d("2026-10-19")])).toBeCloseTo(0.7956, 3);
    expect(muscleDoseWeeks([d("2026-10-19")])).toBe(0.5);
    expect(cardioDoseWeeks([d("2026-10-19"), d("2026-10-21"), d("2026-10-23")])).toBe(1);
    expect(muscleDoseWeeks([d("2026-10-19"), d("2026-10-21"), d("2026-10-23")])).toBe(1);
    // 한 번 길게(3시간) 오면 심폐는 한 주를 채운다
    expect(cardioDoseWeeks([d("2026-10-19", 180)])).toBe(1);
  });
  it("12주 동안 주 1번 — 꽉 찬 주는 0이어도 심폐 · 근력이 0이 아니다", () => {
    const days = [];
    for (let w = 0; w < 12; w++) days.push(d(new Date(Date.UTC(2026, 6, 6) + w * 7 * 86400000).toISOString().slice(0, 10)));
    const g = healthGains(days, days.length * 66);
    expect(g.cardioWeeks).toBe(0);
    expect(g.strengthWeeks).toBe(0);
    expect(g.cardioPct).toBeGreaterThan(9);
    expect(g.endurancePct).toBeGreaterThan(5);
    expect(g.strengthPct).toBeGreaterThan(4);
    expect(formatWeeks(g.cardioDose)).toBe("9.5");
  });
});

describe("지금까지 얻은 것 · 한 번 올 때마다", () => {
  it("펀치(잽+스트레이트) · 칼로리 · 지방(7,700kcal = 1kg)", () => {
    // 10번 × 66분, 65kg — 한 번 397.8 MET·분 × 65 / 60 = 431kcal
    const t = valueTotals(10, 660, 65);
    expect(t.punches).toBe(3500);
    expect(t.kcal).toBe(4300);
    expect(t.fatKg).toBe(0.5);
  });
  it("한 번 올 때마다 — 내 평균 시간 기준 · 기록이 없으면 66분", () => {
    expect(perVisit(0, 0, 65)).toEqual({ minutes: 66, punches: 350, kcal: 430, lifeHours: 7.7 });
    const p = perVisit(4, 4 * 96, 75); // 한 번 96분
    expect(p.minutes).toBe(96);
    expect(p.punches).toBe(520); // 90분 복싱 × 350/60 = 525 → 520
    expect(p.lifeHours).toBe(11.2);
  });
});

describe("오삼코치 피드백 — 잘한 것 먼저 · 다음 한 걸음", () => {
  const per = { minutes: 66, punches: 350, kcal: 430, lifeHours: 7.7 };
  const base = { total: 0, totalMinutes: 0, monthMinutes: 0, lastMonthMinutes: 0, per, punches: 0 };
  it("최근 4주 · 오늘 포함 28일", () => {
    expect(visitsLast28([d("2026-10-22"), d("2026-09-25"), d("2026-09-24")], "2026-10-22")).toBe(2);
    expect(visitsLast28([], "bad")).toBe(0);
  });
  it("다음 펀치 목표", () => {
    expect(nextPunchGoal(0)).toBe(1000);
    expect(nextPunchGoal(3500)).toBe(4000);
    expect(nextPunchGoal(12_300)).toBe(20_000);
    expect(nextPunchGoal(150_000)).toBe(200_000);
  });
  it("첫 운동 전 — 한 번에 쌓이는 것 · 주 1번이면 시작", () => {
    const f = valueFeedback({ ...base, days: [], today: "2026-10-22" });
    expect(f[0].text).toContain("350");
    expect(f.length).toBe(2);
  });
  it("주 1번 회원 — 탓하지 않고 '한 번만 더'", () => {
    const days = ["2026-10-01", "2026-10-08", "2026-10-15", "2026-10-21"].map((x) => d(x));
    const f = valueFeedback({ ...base, days, today: "2026-10-22", total: 4, totalMinutes: 264, monthMinutes: 264, lastMonthMinutes: 0, punches: 1400 });
    expect(f[0].text).toContain("주 1번도 헛되지 않아요");
    expect(f[1].text).toContain("한 번만 더 오면");
    expect(f.every((x) => !/줄었|부족|손해/.test(x.text))).toBe(true);
    expect(f.length).toBeLessThanOrEqual(3);
  });
  it("지난달보다 늘었으면 + · 아직이면 몇 번이면 넘는지 (4번 이내만)", () => {
    const days = [d("2026-10-20"), d("2026-10-21")];
    const up = valueFeedback({ ...base, days, today: "2026-10-22", total: 2, totalMinutes: 132, monthMinutes: 600, lastMonthMinutes: 300, punches: 700 });
    expect(up.some((x) => x.text.includes("지난달보다 5시간 더"))).toBe(true);
    const near = valueFeedback({ ...base, days, today: "2026-10-22", total: 2, totalMinutes: 132, monthMinutes: 132, lastMonthMinutes: 264, punches: 700 });
    expect(near.some((x) => x.text.includes("3번만 더 오면 지난달 기록"))).toBe(true);
    const far = valueFeedback({ ...base, days, today: "2026-10-22", total: 2, totalMinutes: 132, monthMinutes: 132, lastMonthMinutes: 2000, punches: 700 });
    expect(far.some((x) => x.text.includes("지난달"))).toBe(false);
  });
});

describe("첫 운동 전 미리 보기 — 주 2번 · 8주", () => {
  it("상한의 약 63%", () => {
    const g = previewGains();
    expect(g.cardioPct).toBeCloseTo(15 * (1 - Math.exp(-1)), 3);
    expect(g.bodyFatPp).toBeCloseTo(2 * (1 - Math.exp(-1)), 3);
    expect(g.lifeHours).toBeCloseTo(16 * 66 / 60 * 7, 3);
  });
});
