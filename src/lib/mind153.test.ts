import { describe, expect, it } from "vitest";
import { MIND_ITEM_TOTAL, MIND_SCALE, MIND_SCALES, MIND_VERSION } from "@/data/mindScales";
import {
  HABIT_DAYS,
  MEANINGFUL_CHANGE,
  MIND_HOW,
  MIND_RESEARCH,
  MIND_STEPS,
  RECHECK_DAYS,
  addDays,
  answeredAll,
  brandLine,
  buildMindView,
  changeText,
  dateKo,
  daysBetween,
  emptyMindAnswers,
  habitDaysText,
  heroLine,
  nextStepText,
  normalizeMindState,
  scoreConf,
  scoreHabit,
  scoreText,
  scoreVital,
  type MindCheck,
} from "./mind153";

const ck = (takenOn: string, conf: number, vital: number, habit: number): MindCheck => ({
  id: takenOn,
  takenAt: `${takenOn}T12:00:00+09:00`,
  takenOn,
  conf,
  vital,
  habit,
});

describe("문항 — 검증된 척도 그대로", () => {
  it("자신감 10 · 힘(활력) 4 · 운동 습관 4 = 18문항, 한 줄로 이어 묻는다", () => {
    expect(MIND_VERSION).toBe(1);
    expect(MIND_SCALE.conf.items).toHaveLength(10);
    expect(MIND_SCALE.vital.items).toHaveLength(4);
    expect(MIND_SCALE.habit.items).toHaveLength(4);
    expect(MIND_ITEM_TOTAL).toBe(18);
    expect(MIND_STEPS).toHaveLength(18);
    expect(MIND_STEPS[0]).toEqual({ key: "conf", index: 0 });
    expect(MIND_STEPS[17]).toEqual({ key: "habit", index: 3 });
  });

  it("역채점 문항이 서버(_mind_score_*)와 같은 자리 — RSES 2 · 5 · 6 · 8 · 9, RAND 29 · 31", () => {
    const rev = (k: "conf" | "vital" | "habit") => MIND_SCALE[k].items.flatMap((it, i) => (it.reverse ? [i + 1] : []));
    expect(rev("conf")).toEqual([2, 5, 6, 8, 9]);
    expect(rev("vital")).toEqual([3, 4]);
    expect(rev("habit")).toEqual([]);
  });

  it("보기 번호 = 척도 원래 번호 (RSES 1~4 · RAND 1 항상 ~ 6 전혀 · SRBAI 1~7)", () => {
    expect(MIND_SCALE.conf.options.map((o) => o.v)).toEqual([1, 2, 3, 4]);
    expect(MIND_SCALE.vital.options.map((o) => o.v)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(MIND_SCALE.vital.options[0].label).toBe("항상");
    expect(MIND_SCALE.vital.options[5].label).toBe("전혀");
    expect(MIND_SCALE.habit.options.map((o) => o.v)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("점수 — 서버와 같은 식 (로컬 Postgres 시험과 같은 숫자)", () => {
  it("자신감 RSES → 0~100", () => {
    expect(scoreConf([4, 1, 4, 4, 1, 1, 4, 1, 1, 4])).toBe(100);
    expect(scoreConf([1, 4, 1, 1, 4, 4, 1, 4, 4, 1])).toBe(0);
    expect(scoreConf([3, 3, 3, 3, 3, 3, 3, 3, 3, 3])).toBe(50);
    expect(scoreConf([3, 2, 3, 3, 2, 2, 3, 3, 2, 3])).toBe(63.3);
    expect(scoreConf([4, 1, 3, 3, 2, 2, 3, 3, 2, 3])).toBe(70);
    expect(scoreConf([4, 1, 4, 3, 2, 1, 4, 2, 1, 4])).toBe(90);
  });

  it("힘(활력) RAND-36 → 0~100", () => {
    expect(scoreVital([1, 1, 6, 6])).toBe(100);
    expect(scoreVital([6, 6, 1, 1])).toBe(0);
    expect(scoreVital([3, 2, 4, 3])).toBe(60);
    expect(scoreVital([2, 2, 4, 4])).toBe(70);
    expect(scoreVital([2, 1, 5, 4])).toBe(80);
  });

  it("운동 습관 SRBAI → 0~100", () => {
    expect(scoreHabit([7, 7, 7, 7])).toBe(100);
    expect(scoreHabit([1, 1, 1, 1])).toBe(0);
    expect(scoreHabit([4, 5, 3, 2])).toBe(41.7);
    expect(scoreHabit([5, 5, 4, 3])).toBe(54.2);
    expect(scoreHabit([6, 6, 5, 5])).toBe(75);
  });

  it("개수 · 범위가 틀리면 null", () => {
    expect(scoreConf([3, 3, 3])).toBeNull();
    expect(scoreConf([3, 3, 3, 3, 3, 3, 3, 3, 3, 5])).toBeNull();
    expect(scoreVital([0, 1, 2, 3])).toBeNull();
    expect(scoreVital([1, 2, 3, 7])).toBeNull();
    expect(scoreHabit([1, 2, 3, 8])).toBeNull();
    expect(scoreHabit([1.5, 2, 3, 4])).toBeNull();
  });

  it("빈 답 · 다 답함", () => {
    const a = emptyMindAnswers();
    expect(answeredAll(a)).toBe(false);
    a.conf = a.conf.map(() => 3);
    a.vital = a.vital.map(() => 3);
    a.habit = a.habit.map(() => 4);
    expect(answeredAll(a)).toBe(true);
  });
});

describe("서버 JSON 다듬기", () => {
  it("모자란 줄은 버리고 오래된 것부터 · 숫자 글자도 받는다", () => {
    const s = normalizeMindState({
      active: true,
      consent: true,
      remind: false,
      age: "35",
      checks: [
        { id: "b", taken_at: "2026-11-14T10:00:00+09:00", taken_on: "2026-11-14", conf: "70.0", vital: 60, habit: 50 },
        { id: "a", taken_at: "2026-10-10T10:00:00+09:00", taken_on: "2026-10-10", conf: 60, vital: 50, habit: 40 },
        { id: "x", taken_at: "2026-10-01T10:00:00+09:00", taken_on: "2026-10-01", conf: null, vital: 50, habit: 40 },
        { id: "y", taken_on: "10/01", conf: 1, vital: 1, habit: 1 },
      ],
      brand: { ready: false, n: 5 },
    });
    expect(s.checks.map((c) => c.id)).toEqual(["a", "b"]);
    expect(s.checks[1].conf).toBe(70);
    expect(s.remind).toBe(false);
    expect(s.age).toBe(35);
    expect(s.brand).toEqual({ ready: false });
  });

  it("빈 값이면 처음 상태", () => {
    const s = normalizeMindState(null);
    expect(s).toMatchObject({ active: false, consent: false, remind: true, age: null, checks: [], brand: { ready: false } });
  });
});

describe("화면 한 장 — 주인공 · 줄 · 다음 체크", () => {
  const today = "2026-11-14";

  it("기록이 없으면 안내", () => {
    const v = buildMindView([], today);
    expect(v.hero).toEqual({ kind: "invite" });
    expect(v.rows).toHaveLength(0);
    expect(v.due).toBeNull();
    expect(nextStepText(v)).toBe("4주마다 2분이면 돼요");
  });

  it("첫 기록 — 처음 값 없음 · 다음 체크는 28일 뒤 · 2주 안이면 고쳐 쓴다", () => {
    const v = buildMindView([ck("2026-11-11", 56.7, 45, 33.3)], today);
    expect(v.hero).toEqual({ kind: "first", on: "2026-11-11" });
    expect(v.rows.map((r) => r.first)).toEqual([null, null, null]);
    expect(v.rows.every((r) => r.change == null)).toBe(true);
    expect(v.due).toEqual({ on: "2026-12-09", daysLeft: 25, isDue: false });
    expect(v.replaces).toBe(true);
    expect(nextStepText(v)).toBe("다음 체크 12월 9일 · 25일 남았어요");
    expect(heroLine(v.hero)).toMatch(/4주 뒤 다시 재면/);
  });

  it("두 번 이상 — 가장 많이 오른 것이 주인공 · 10점 이상이면 의미 있는 변화", () => {
    const v = buildMindView([ck("2026-09-14", 56.7, 45, 33.3), ck("2026-10-13", 63.3, 55, 50), ck("2026-11-12", 70, 60, 58.3)], today);
    expect(v.hero).toMatchObject({ kind: "growth", key: "habit", change: 25, first: 33.3, now: 58.3, meaningful: true, days: 59 });
    expect(v.rows.find((r) => r.key === "conf")).toMatchObject({ first: 56.7, now: 70, change: 13.3, meaningful: true });
    expect(v.rows.find((r) => r.key === "vital")).toMatchObject({ change: 15, meaningful: true });
    expect(heroLine(v.hero)).toBe("처음 33 → 지금 58 · 의미 있는 변화(10점 이상)예요");
    expect(heroLine(v.hero, false)).toBe("처음 잰 날보다 의미 있는 변화(10점 이상)예요");
    expect(v.replaces).toBe(true);
    expect(v.habitDays).toEqual({ since: 61, toGo: 5 });
    expect(habitDaysText(v)).toBe("첫 체크 뒤 61일 · 습관 66일까지 5일");
  });

  it("조금 오른 것만 있으면 '조금씩' — 10점 아래", () => {
    const v = buildMindView([ck("2026-10-01", 60, 60, 60), ck("2026-11-01", 63.3, 55, 58)], today);
    expect(v.hero).toMatchObject({ kind: "growth", key: "conf", meaningful: false });
    expect(heroLine(v.hero)).toMatch(/조금씩 오르고 있어요/);
    // 내려간 것은 숫자로 말하지 않는다
    expect(v.rows.find((r) => r.key === "vital")?.change).toBeNull();
    expect(v.rows.find((r) => r.key === "habit")?.change).toBeNull();
  });

  it("모두 그대로이거나 내려가면 — 흐름을 같이 보는 말 (내려간 숫자 없음)", () => {
    const v = buildMindView([ck("2026-09-01", 70, 70, 70), ck("2026-10-01", 66.7, 60, 70)], today);
    expect(v.hero).toEqual({ kind: "steady", on: "2026-10-01" });
    expect(v.rows.every((r) => r.change == null && !r.meaningful)).toBe(true);
    expect(heroLine(v.hero)).toMatch(/흔들려요/);
    expect(v.due).toEqual({ on: "2026-10-29", daysLeft: -16, isDue: true });
    expect(nextStepText(v)).toBe("4주가 지났어요 — 다시 재면 변화가 보여요");
    expect(v.replaces).toBe(false);
  });

  it("같은 만큼 오르면 자신감 → 힘(활력) → 습관 순서로 주인공", () => {
    const v = buildMindView([ck("2026-09-01", 50, 50, 50), ck("2026-10-10", 60, 60, 55)], today);
    expect(v.hero).toMatchObject({ kind: "growth", key: "conf", change: 10 });
  });

  it("66일을 지나면 지났다고", () => {
    const v = buildMindView([ck("2026-08-01", 50, 50, 50)], today);
    expect(v.habitDays).toEqual({ since: 105, toGo: 0 });
    expect(habitDaysText(v)).toBe("첫 체크 뒤 105일 — 습관 66일을 지났어요");
  });

  it("아주 낮은 자신감 · 활력 — 조용한 안내", () => {
    const v = buildMindView([ck("2026-11-10", 16.7, 15, 50)], today);
    expect(v.lowConf).toBe(true);
    expect(v.lowVital).toBe(true);
    const ok = buildMindView([ck("2026-11-10", 50, 50, 50)], today);
    expect(ok.lowConf || ok.lowVital).toBe(false);
  });
});

describe("문구 · 날짜", () => {
  it("숫자 · 날짜", () => {
    expect(scoreText(63.3)).toBe("63");
    expect(scoreText(66.7)).toBe("67");
    expect(changeText(13.3)).toBe("+13");
    expect(changeText(0.4)).toBe("+1");
    expect(dateKo("2026-12-09")).toBe("12월 9일");
    expect(addDays("2026-11-14", RECHECK_DAYS)).toBe("2026-12-12");
    expect(daysBetween("2026-11-14", "2026-12-12")).toBe(28);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
  });

  it("153 전체 평균은 준비됐을 때만 · 비교군 없다고 밝힌다", () => {
    expect(brandLine({ ready: false })).toBeNull();
    expect(brandLine({ ready: true, n: 24, conf: 6.2, vital: 11.4, habit: -1, days: 35, up10: 58 })).toBe(
      "4주 넘게 두 번 잰 153 회원 24명 — 평균 자신감 +6 · 힘(활력) +11 · 운동 습관 −1 · 58%가 하나 이상 10점 넘게 올랐어요 (비교군 없는 설문 결과)",
    );
  });

  it("기준 숫자 — 의미 있는 변화 10 · 다시 재기 28일 · 습관 66일", () => {
    expect(MEANINGFUL_CHANGE).toBe(10);
    expect(RECHECK_DAYS).toBe(28);
    expect(HABIT_DAYS).toBe(66);
  });

  it("연구 · 계산법 — 척도마다 출처가 있고, 못한 것을 탓하는 말이 없다", () => {
    for (const s of MIND_SCALES) {
      expect(MIND_RESEARCH.some((r) => r.key === s.key)).toBe(true);
      expect(MIND_HOW.some((h) => h.k === s.label)).toBe(true);
      expect(s.source.length).toBeGreaterThan(5);
    }
    const all = [...MIND_RESEARCH.map((r) => `${r.body} ${r.cite}`), ...MIND_HOW.map((h) => h.v)].join(" ");
    expect(all).not.toMatch(/늙|게으|부족해요|실패했|못 했/);
    // 근거 숫자가 원 논문 그대로 들어가 있다
    expect(all).toMatch(/113개 연구/);
    expect(all).toMatch(/7,050명/);
    expect(all).toMatch(/18~254일/);
    expect(all).toMatch(/12만 8천 명/);
    expect(all).toMatch(/4\.82/);
  });
});
