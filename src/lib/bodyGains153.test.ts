import { describe, expect, it } from "vitest";
import {
  SURE_BODY_FAT_PP,
  SURE_GRIP_KG,
  SURE_PB_PCT,
  bodyGainRows,
  estPctText,
  estPctValue,
  type BodyGainsInput,
  type GainKey,
  type GainRow,
} from "@/lib/bodyGains153";
import { cardioEstimate } from "@/lib/fitnessAge153";
import { healthGains, previewGains, type HealthDay } from "@/lib/healthGains153";
import type { DivisionProfile, ProfileRecord, Test153Areas } from "@/lib/test153Profile";

/** 2026-09-07(월)부터 주 2번(월 · 수) 66분 — weeks 주 */
function twiceAWeek(weeks: number, start = Date.UTC(2026, 8, 7)): HealthDay[] {
  const out: HealthDay[] = [];
  for (let w = 0; w < weeks; w++) {
    for (const k of [0, 2]) out.push({ day: new Date(start + (w * 7 + k) * 86_400_000).toISOString().slice(0, 10), minutes: 66 });
  }
  return out;
}
const DAYS = twiceAWeek(10); // 09-07 ~ 11-11
const G = healthGains(DAYS, DAYS.length * 66);
const base = (extra: Partial<BodyGainsInput> = {}): BodyGainsInput => ({ gains: G, days: DAYS, ...extra });
const row = (rows: GainRow[], key: GainKey) => rows.find((r) => r.key === key);
const allText = (rows: GainRow[]) => rows.map((r) => [r.label, r.value, r.numbers ?? "", ...r.basis.map((b) => `${b.k} ${b.v}`)].join(" ")).join(" ");
/** 잘한 것만 — 나빠진 것 · 못한 것을 말하는 낱말이 없어야 한다 */
const NEGATIVE = /나빠|못 했|못했|실패|부족|뒤처|늙|떨어졌/;

const areas = (runAvgMs: number | null, upperPerMin: number | null, legsPerMin: number | null = null): Test153Areas => ({
  cardio: runAvgMs == null ? null : { runAvgMs, paceKeepPct: 95, runsMs: [] },
  legs: legsPerMin == null ? null : { reps: 0, ms: 0, perMin: legsPerMin },
  upper: upperPerMin == null ? null : { reps: 0, ms: 0, perMin: upperPerMin },
  boxing: null,
  rhythm: null,
  doneSegments: 16,
});
const rec = (id: string, measuredAt: string, a: Test153Areas): ProfileRecord => ({
  id,
  measuredAt,
  scoreMs: 1_200_000,
  totalMs: 1_200_000,
  finished: true,
  remainingReps: 0,
  areas: a,
  coachName: null,
});
const division = (first: ProfileRecord, latest: ProfileRecord): DivisionProfile => ({
  division: "open",
  count: 2,
  first,
  pb: latest,
  latest,
  prev: first,
  improvedMs: null,
  improvedPct: null,
});
const pbRec = (score_ms: number, measured_at: string, finished = true) => ({ division: "open", score_ms, finished, measured_at });

describe("estPctText — 추정은 정수(1 아래만 소수 한 자리) · 내림", () => {
  it("13.7 → 13 · 0.46 → 0.4 · 0 → 0", () => {
    expect(estPctText(13.7)).toBe("13");
    expect(estPctText(1)).toBe("1");
    expect(estPctText(0.46)).toBe("0.4");
    expect(estPctText(0)).toBe("0");
    expect(estPctText(Number.NaN)).toBe("0");
  });
});

describe("추정만 있을 때 — 줄 다섯 · 이름표 추정 · 무슨 기준인지", () => {
  it("성별 · 나이도 모르면 — 숫자 대신 무엇을 기준으로 한 %인지 · 넣으면 숫자로", () => {
    const rows = bodyGainRows(base());
    expect(rows.map((r) => r.key)).toEqual(["cardio", "endurance", "strength", "fitness", "bodyFat"]);
    expect(rows.every((r) => r.source === "estimate")).toBe(true);
    expect(row(rows, "cardio")?.numbers).toBe("최대산소섭취량 기준");
    expect(row(rows, "cardio")?.basis.some((b) => b.k === "숫자" && b.v.includes("성별 · 출생 연도"))).toBe(true);
    expect(row(rows, "endurance")?.numbers).toBe("팔굽혀펴기 · 윗몸일으키기 횟수 기준");
    expect(row(rows, "strength")?.numbers).toBe("악력(쥐는 힘) 기준");
    expect(row(rows, "fitness")?.numbers).toBe("심폐 · 근지구력 · 근력 세 가지 평균");
    expect(row(rows, "bodyFat")?.numbers).toBe("인바디 체지방률 기준");
    // 추정 % 는 정수 — 소수점은 실제보다 정확해 보여서
    expect(row(rows, "cardio")?.value).toMatch(/^\+\d+%$/);
    expect(row(rows, "bodyFat")?.value).toMatch(/^-\d\.\d%p$|^-\d%p$/);
    expect(rows.every((r) => !r.sure && !r.steady)).toBe(true);
  });

  it("기준 글 — 연구 이름 · 숫자 · 153 가정이 늘 같이 있다", () => {
    const rows = bodyGainRows(base());
    const cardio = row(rows, "cardio")!.basis.map((b) => b.v).join(" ");
    expect(cardio).toMatch(/Milanović 외 2015/);
    expect(cardio).toMatch(/\+4\.9/);
    expect(cardio).toMatch(/28개 실험 723명/);
    expect(cardio).toMatch(/153이 정한 계산식/);
    expect(row(rows, "endurance")!.basis.map((b) => b.v).join(" ")).toMatch(/28\.5 → 30\.2개/);
    expect(row(rows, "strength")!.basis.map((b) => b.v).join(" ")).toMatch(/보수적으로 잡은 153 가정/);
    expect(row(rows, "bodyFat")!.basis.map((b) => b.v).join(" ")).toMatch(/Jayedi 외 2024/);
    // 운동한 주분 = healthGains 와 같은 숫자
    expect(row(rows, "cardio")!.basis.find((b) => b.k === "153 계산")?.v).toMatch(/^운동한 10주분 → 지금 \+\d+%/);
    expect(allText(rows)).not.toMatch(NEGATIVE);
  });

  it("최대산소섭취량 — 지금 = '같은 나이와 비교'의 추정과 같은 숫자 · 처음 = 지금 ÷ (1 + 좋아진 %)", () => {
    const cardio = cardioEstimate({ sex: "여", age: 32, active: true })!;
    const rows = bodyGainRows(base({ cardio, sex: "여", band: cardio.band }));
    const r = row(rows, "cardio")!;
    const m = /^최대산소섭취량 ([\d.]+) → ([\d.]+) · \+([\d.]+)$/.exec(r.numbers ?? "");
    expect(m).not.toBeNull();
    const [start, now, diff] = [Number(m![1]), Number(m![2]), Number(m![3])];
    expect(now).toBeCloseTo(Math.round(cardio.est * 10) / 10, 5);
    // 화면 % 와 맞게 — 보이는 % 로 처음을 만든다 (회원이 직접 나눠 봐도 맞는다)
    expect(((now / start - 1) * 100)).toBeCloseTo(estPctValue(G.cardioPct), 0);
    expect(r.value).toBe(`+${estPctValue(G.cardioPct)}%`);
    expect(diff).toBeCloseTo(now - start, 0);
    expect(r.basis.some((b) => b.k === "지금 숫자" && b.v.includes("같은 나이와 비교"))).toBe(true);
  });

  it("65세 넘어 심폐 기준표가 없으면 — 넣으라고 하지 않고 %로만이라고", () => {
    const rows = bodyGainRows(base({ cardio: null, sex: "남", band: "65-69" }));
    expect(row(rows, "cardio")?.basis.find((b) => b.k === "숫자")?.v).toMatch(/64세까지/);
  });

  it("성별 · 나이를 알면 — 근력 · 체지방률을 같은 나이 평균으로 바꾼 숫자", () => {
    const rows = bodyGainRows(base({ sex: "남", band: "30-34" }));
    expect(row(rows, "strength")?.numbers).toMatch(/^같은 나이 평균 [\d.]+kg이라면 \+[\d.]+kg$/);
    expect(row(rows, "bodyFat")?.numbers).toMatch(/^같은 나이 평균 [\d.]+%라면 → [\d.]+%$/);
    expect(row(rows, "strength")?.basis.find((b) => b.k === "평균이라면")?.v).toMatch(/국민체력100 30대 초반 남성/);
  });
});

describe("실측 — 두 번 넘게 잰 기록 · 확실한 변화 · 유지 · 나빠졌으면 그리지 않음", () => {
  const grip = (firstValue: number, value: number) => ({ firstValue, firstOn: "2026-09-10", value, on: "2026-11-10" });

  it(`악력 ${SURE_GRIP_KG}kg 넘게 늘면 — 확실한 변화(금색)`, () => {
    const r = row(bodyGainRows(base({ grip: grip(32, 38) })), "strength")!;
    expect(r.source).toBe("measured");
    expect(r.value).toBe("+18%");
    expect(r.numbers).toBe("악력 32 → 38kg · +6kg");
    expect(r.sure).toBe(true);
    expect(r.gold).toBe(true);
    expect(r.basis.find((b) => b.k === "잰 기록")?.v).toBe("악력 9월 10일 32kg → 11월 10일 38kg");
    expect(r.basis.find((b) => b.k === "확실한 변화")?.v).toMatch(/Bohannon 2019/);
  });

  it("오차 안에서 늘면 — 숫자는 보여 주되 확실한 변화는 아님", () => {
    const r = row(bodyGainRows(base({ grip: grip(32, 35) })), "strength")!;
    expect(r.value).toBe("+9.3%");
    expect(r.sure).toBe(false);
    expect(r.gold).toBe(false);
  });

  it("잰 기록이 좋아지지 않았으면 추정으로 덮지 않는다 — 오차 안이면 '유지' · 그보다 나빠지면 줄을 빼요", () => {
    const steady = row(bodyGainRows(base({ grip: grip(35, 33) })), "strength")!;
    expect(steady).toMatchObject({ source: "measured", value: "유지", numbers: "악력 최근 33kg", steady: true, ratio: null });
    expect(row(bodyGainRows(base({ grip: grip(35, 29) })), "strength")).toBeUndefined();
  });

  it(`체지방률 ${SURE_BODY_FAT_PP}%p 넘게 내려가면 — 확실한 변화 · %p 설명`, () => {
    const r = row(bodyGainRows(base({ bodyFat: { firstValue: 26.1, firstOn: "2026-09-01", value: 23, on: "2026-11-02" } })), "bodyFat")!;
    expect(r).toMatchObject({ source: "measured", value: "-3.1%p", numbers: "체지방률 26.1% → 23%", sure: true, gold: true });
    expect(r.basis.find((b) => b.k === "%p")?.v).toMatch(/26\.1%에서 23%가 되면 3\.1%p/);
    expect(r.basis.find((b) => b.k === "확실한 변화")?.v).toMatch(/Siedler 외 2021/);
    const small = row(bodyGainRows(base({ bodyFat: { firstValue: 26.1, firstOn: "2026-09-01", value: 24.9, on: "2026-11-02" } })), "bodyFat")!;
    expect(small.sure).toBe(false);
    expect(row(bodyGainRows(base({ bodyFat: { firstValue: 24, firstOn: "2026-09-01", value: 25, on: "2026-11-02" } })), "bodyFat")?.value).toBe("유지");
    expect(row(bodyGainRows(base({ bodyFat: { firstValue: 22, firstOn: "2026-09-01", value: 25, on: "2026-11-02" } })), "bodyFat")).toBeUndefined();
  });

  it("몸무게 — 줄었을 때만 한 줄 (늘면 근육인지 지방인지 몰라서 말하지 않아요)", () => {
    const lost = row(bodyGainRows(base({ weight: { firstValue: 72.4, firstOn: "2026-09-01", value: 69.3, on: "2026-11-02" } })), "weight")!;
    expect(lost).toMatchObject({ source: "measured", value: "-3.1kg", numbers: "몸무게 72.4 → 69.3kg", ratio: null });
    expect(row(bodyGainRows(base({ weight: { firstValue: 69, firstOn: "2026-09-01", value: 70, on: "2026-11-02" } })), "weight")).toBeUndefined();
    expect(row(bodyGainRows(base({ weight: { firstValue: 69, firstOn: "2026-11-02", value: 68, on: "2026-11-02" } })), "weight")).toBeUndefined();
  });
});

describe("잰 값이 하나 — 그 값을 기준으로 처음 → 지금 (값 % 는 그대로)", () => {
  it("악력 — 잰 날까지 운동한 만큼을 빼 처음을, 그 뒤만큼을 더해 지금을", () => {
    const r = row(bodyGainRows(base({ grip: { value: 30, on: "2026-10-01" } })), "strength")!;
    expect(r.source).toBe("estimate");
    expect(r.value).toBe(`+${estPctText(G.strengthPct)}%`);
    const m = /^악력 ([\d.]+) → ([\d.]+)kg · \+([\d.]+)kg$/.exec(r.numbers ?? "");
    expect(m).not.toBeNull();
    const [start, now] = [Number(m![1]), Number(m![2])];
    expect(start).toBeLessThan(30);
    expect(now).toBeGreaterThan(30);
    expect((now / start - 1) * 100).toBeCloseTo(estPctValue(G.strengthPct), 0);
    expect(r.basis.find((b) => b.k === "기준 값")?.v).toMatch(/^10월 1일에 잰 30kg/);
  });

  it("체지방률 — 처음 = 잰 값 + 그때까지 · 지금 = 잰 값 − 그 뒤", () => {
    const r = row(bodyFatOnly({ value: 25, on: "2026-10-01" }), "bodyFat")!;
    const m = /^체지방률 ([\d.]+)% → ([\d.]+)%$/.exec(r.numbers ?? "");
    expect(m).not.toBeNull();
    const [start, now] = [Number(m![1]), Number(m![2])];
    expect(start).toBeGreaterThan(25);
    expect(now).toBeLessThan(25);
    expect(start - now).toBeCloseTo(Math.floor(G.bodyFatPp * 10) / 10, 5);
    expect(r.value).toBe(`-${(Math.floor(G.bodyFatPp * 10) / 10).toLocaleString("ko-KR")}%p`);
  });

  it("처음 운동하기 전에 잰 값이면 — 처음 = 그 값", () => {
    const r = row(bodyGainRows(base({ grip: { value: 30, on: "2026-09-01" } })), "strength")!;
    expect(r.numbers).toMatch(/^악력 30 → /);
  });
});

function bodyFatOnly(bodyFat: { value: number; on: string }) {
  return bodyGainRows(base({ bodyFat }));
}

describe("153 PB — 체력 줄은 총 시간 · 심폐 · 근지구력 줄은 구간", () => {
  it(`첫 완주보다 ${SURE_PB_PCT}% 넘게 빨라지면 확실한 변화 — 최고 기록은 아래 카드가 보여 줘서 여기서는 첫 기록 · 줄어든 시간만`, () => {
    const rows = bodyGainRows(base({ pbRecords: [pbRec(1_350_000, "2026-10-01T10:00:00Z"), pbRec(1_185_000, "2026-11-12T10:00:00Z")] }));
    const r = row(rows, "fitness")!;
    expect(r).toMatchObject({ source: "measured", value: "12% 빨라짐", sure: true, gold: true });
    expect(r.numbers).toBe("153 PB 첫 완주 22:30.0보다 2분 45초 단축");
    expect(r.numbers).not.toMatch(/19:45/);
    expect(r.basis.find((b) => b.k === "잰 기록")?.v).toBe("153 PB(오픈) 첫 완주 10월 1일 22:30.0 → 최고 11월 12일 19:45.0 · 완주 2번");
    expect(r.basis.find((b) => b.k === "확실한 변화")?.v).toMatch(/Engel 외 2019/);
  });

  it("조금 빨라졌으면 확실한 변화는 아님 · 거의 같으면 유지 · 완주가 하나면 추정 그대로", () => {
    const small = row(bodyGainRows(base({ pbRecords: [pbRec(1_200_000, "2026-10-01"), pbRec(1_140_000, "2026-11-12")] })), "fitness")!;
    expect(small).toMatchObject({ value: "5% 빨라짐", sure: false });
    const same = row(bodyGainRows(base({ pbRecords: [pbRec(1_200_000, "2026-10-01"), pbRec(1_200_400, "2026-11-12")] })), "fitness")!;
    expect(same).toMatchObject({ source: "measured", value: "유지", steady: true });
    expect(same.numbers).toBe("153 PB 완주 2번 · 첫 기록과 비슷해요");
    const once = row(bodyGainRows(base({ pbRecords: [pbRec(1_200_000, "2026-10-01"), pbRec(1_600_000, "2026-11-12", false)] })), "fitness")!;
    expect(once.source).toBe("estimate");
  });

  it("셀트런 평균이 빨라지면 심폐지구력이 실측 · 푸시업 · 싯업이 늘면 근지구력이 실측", () => {
    const div = division(rec("a", "2026-10-01T10:00:00Z", areas(31_200, 32)), rec("b", "2026-11-12T10:00:00Z", areas(28_900, 36.5)));
    const rows = bodyGainRows(base({ pbDivision: div }));
    expect(row(rows, "cardio")).toMatchObject({ source: "measured", value: "7.3% 빨라짐", numbers: "셀트런 평균 31.2 → 28.9초 · 2.3초 단축" });
    expect(row(rows, "endurance")).toMatchObject({ source: "measured", value: "+14%", numbers: "푸시업 · 싯업 1분에 32 → 36.5개" });
    expect(row(rows, "cardio")?.basis.find((b) => b.k === "잰 기록")?.v).toBe("153 PB 셀트런 평균 — 10월 1일 31.2초 → 11월 12일 28.9초");
  });

  it("푸시업 · 싯업 구간이 없으면 스쿼트 · 런지 · 구간이 많이 느려졌으면 그 줄을 빼요", () => {
    const legs = division(rec("a", "2026-10-01", areas(null, null, 40)), rec("b", "2026-11-12", areas(null, null, 44)));
    expect(row(bodyGainRows(base({ pbDivision: legs })), "endurance")?.numbers).toBe("스쿼트 · 런지 1분에 40 → 44개");
    const slower = division(rec("a", "2026-10-01", areas(30_000, null)), rec("b", "2026-11-12", areas(34_000, null)));
    const rows = bodyGainRows(base({ pbDivision: slower }));
    expect(row(rows, "cardio")).toBeUndefined();
    expect(row(rows, "endurance")?.source).toBe("estimate");
    const bitSlower = division(rec("a", "2026-10-01", areas(30_000, null)), rec("b", "2026-11-12", areas(31_000, null)));
    expect(row(bodyGainRows(base({ pbDivision: bitSlower })), "cardio")).toMatchObject({ value: "유지", numbers: "최근 셀트런 평균 31초", steady: true });
  });
});

describe("첫 운동 전 미리 보기 — 주 2번씩 8주면", () => {
  it("추정만 · 숫자 줄 없음 · 잰 기록은 쓰지 않음", () => {
    const rows = bodyGainRows({
      gains: previewGains(),
      days: [],
      preview: true,
      grip: { firstValue: 30, firstOn: "2026-09-01", value: 40, on: "2026-11-01" },
      weight: { firstValue: 72, firstOn: "2026-09-01", value: 70, on: "2026-11-01" },
    });
    expect(rows.map((r) => r.key)).toEqual(["cardio", "endurance", "strength", "fitness", "bodyFat"]);
    expect(rows.every((r) => r.source === "estimate" && r.numbers == null)).toBe(true);
    expect(row(rows, "cardio")?.basis.find((b) => b.k === "153 계산")?.v).toMatch(/^주 2번씩 8주면 \+9%/);
    expect(allText(rows)).not.toMatch(NEGATIVE);
  });
});
