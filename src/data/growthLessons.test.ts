import { describe, expect, it } from "vitest";
import { GROWTH_CORNERS, GROWTH_LESSONS, todayLesson, weekdayOf, type GrowthLesson } from "./growthLessons";

const mk = (id: string, from: string): GrowthLesson => ({
  id,
  from,
  theme: id,
  title: id,
  hook: id,
  story: [id],
  directions: [{ title: id, body: id }],
  pledge: id,
});

/** 그날부터 n일의 날짜 (YYYY-MM-DD) */
const daysFrom = (start: string, n: number): string[] =>
  Array.from({ length: n }, (_, i) => new Date(Date.parse(`${start}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10));

const DAILY = GROWTH_LESSONS.filter((l) => l.days === 1);
const textOf = (l: GrowthLesson): string =>
  [l.theme, l.title, l.hook, ...l.story, ...l.directions.flatMap((d) => [d.title, d.body]), l.pledge, ...(l.sources ?? []).map((s) => s.name)].join("\n");
const bare = (s: string): number => [...s.replace(/\s/g, "")].length;

describe("오늘의 1분 성장 교육 — 어떤 교육을 보여 줄지", () => {
  it("시작 전이면 없음 · 시작한 날부터 가장 최근 교육", () => {
    const list = [mk("a", "2026-10-27")];
    expect(todayLesson("2026-10-26", list)).toBeNull();
    expect(todayLesson("2026-10-27", list)?.id).toBe("a");
    expect(todayLesson("2026-12-01", list)?.id).toBe("a");
  });

  it("새 교육은 7일 동안 오늘의 교육 · 그 뒤로는 날마다 돌아가며", () => {
    const list = [mk("new", "2026-11-03"), mk("old", "2026-10-27")];
    expect(todayLesson("2026-11-02", list)?.id).toBe("old");
    expect(todayLesson("2026-11-03", list)?.id).toBe("new");
    expect(todayLesson("2026-11-09", list)?.id).toBe("new");
    const after = ["2026-11-10", "2026-11-11", "2026-11-12"].map((d) => todayLesson(d, list)?.id);
    expect(new Set(after)).toEqual(new Set(["new", "old"]));
  });

  it("교육마다 이야기 · 방향 · 다짐이 있다", () => {
    for (const l of GROWTH_LESSONS) {
      expect(l.story.length).toBeGreaterThan(0);
      expect(l.directions.length).toBeGreaterThan(0);
      expect(l.pledge.length).toBeGreaterThan(0);
      expect(/^\d{4}-\d{2}-\d{2}$/.test(l.from)).toBe(true);
    }
  });

  it("id 는 겹치지 않는다 (이 기기의 '오늘 하나' 기록 이름)", () => {
    const ids = GROWTH_LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("날마다 글 — 2026년 11월 16일부터 날마다 다른 글", () => {
  const days = daysFrom("2026-11-16", 15);

  it("11/16 ~ 11/30 은 그날의 글이 나온다 (15편 · 모두 다른 글)", () => {
    const shown = days.map((d) => todayLesson(d));
    shown.forEach((l, i) => {
      expect(l?.from).toBe(days[i]);
      expect(l?.days).toBe(1);
    });
    expect(new Set(shown.map((l) => l?.id)).size).toBe(15);
  });

  it("그 전날까지는 예전 교육 그대로", () => {
    expect(todayLesson("2026-11-15")?.id).toBe("show-first");
  });

  it("글의 코너 = 그 요일의 코너", () => {
    for (const l of DAILY) expect(l.theme).toBe(GROWTH_CORNERS[weekdayOf(l.from)]);
    expect(GROWTH_CORNERS).toHaveLength(7);
    expect(weekdayOf("2026-11-16")).toBe(1); // 월요일
  });

  it("날마다 글이 끝난 뒤에도 — 요일 코너가 맞고, 어제와 다른 글이 나온다", () => {
    const after = daysFrom("2026-12-01", 28);
    let prev = todayLesson("2026-11-30")?.id;
    for (const d of after) {
      const l = todayLesson(d);
      expect(l?.days).toBe(1);
      expect(weekdayOf(l!.from)).toBe(weekdayOf(d));
      expect(l?.id).not.toBe(prev);
      prev = l?.id;
    }
    // 같은 요일 글은 주마다 돌아가며 — 화요일 두 편이 번갈아
    expect(todayLesson("2026-12-01")?.id).not.toBe(todayLesson("2026-12-08")?.id);
  });
});

describe("날마다 글 — 글 규격", () => {
  // 153 브랜드 기준: 회원 글에 쓰지 않는 낱말 · 긴 줄표
  const BANNED =
    /국가대표|태릉|선수 ?출신|프로 ?출신|엘리트|메달|최고|프리미엄|압도적|무조건|보장|확정 ?혜택|벨트|계급|잽부터|끝까지 ?붙|정성을 다|고객 만족|가족 같은|믿고 맡겨|년 전통|오삼코치|오사미|—/;
  /** 사실을 다루는 코너 — 출처가 꼭 있어야 한다 */
  const NEEDS_SOURCE = new Set(["복싱 상식 O/X", "몸이 받는 선물", "링 위의 이야기"]);

  it.each(DAILY.map((l) => [l.from, l] as const))("%s", (_from, l) => {
    expect([...l.title].length).toBeLessThanOrEqual(18);
    expect([...l.hook].length).toBeLessThanOrEqual(30);
    const body = bare(l.story.join(""));
    expect(body).toBeGreaterThanOrEqual(150);
    expect(body).toBeLessThanOrEqual(250);
    // 오늘 하나는 1개 · 한 줄
    expect(l.directions).toHaveLength(1);
    expect([...l.directions[0].title].length).toBeLessThanOrEqual(14);
    expect([...l.directions[0].body].length).toBeLessThanOrEqual(60);
    expect([...l.pledge].length).toBeLessThanOrEqual(30);
    expect(textOf(l)).not.toMatch(BANNED);
    if (NEEDS_SOURCE.has(l.theme)) expect((l.sources ?? []).length).toBeGreaterThan(0);
    for (const s of l.sources ?? []) {
      expect(s.name.trim().length).toBeGreaterThan(0);
      if (s.url) expect(s.url).toMatch(/^https:\/\//);
    }
  });

  it("O/X 글은 문제로 시작하고 정답을 말한다", () => {
    for (const l of DAILY.filter((x) => x.theme === "복싱 상식 O/X")) {
      expect(l.story[0]).toMatch(/^문제\. .+\(O \/ X\)$/);
      expect(l.story[1]).toMatch(/^정답은 [OX]예요\./);
    }
  });
});
