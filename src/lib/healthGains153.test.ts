import { describe, expect, it } from "vitest";
import {
  LIFE_GAIN_CAP_DAYS,
  activeMonths,
  formatLifeGain,
  formatPct,
  healthGains,
  lifeGainHours,
  saturatingPct,
  strengthWeeks,
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
    expect(g).toMatchObject({ lifeHours: 0, lifeLabel: "0시간", cardioWeeks: 0, cardioPct: 0, strengthWeeks: 0, strengthPct: 0, activeMonths: 0, moodDays: 0, pbFasterPct: null });
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
    expect(g.cardioPct).toBeGreaterThan(10);
    expect(g.cardioPct).toBeLessThan(15);
    expect(g.strengthPct).toBeGreaterThan(7);
    expect(g.strengthPct).toBeLessThan(10);
  });
});
