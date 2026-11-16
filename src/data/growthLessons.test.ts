import { describe, expect, it } from "vitest";
import {
  GROWTH_CORNERS,
  GROWTH_MONTHS,
  LEGACY_LESSONS,
  addDays,
  cornerOf,
  growthDayLabel,
  loadGrowthLessons,
  loadGrowthMonth,
  monthsFor,
  recentLessons,
  todayLesson,
  weekdayOf,
  type GrowthLesson,
} from "./growthLessons";

const mk = (id: string, from: string, days?: number): GrowthLesson => ({
  id,
  from,
  theme: id,
  title: id,
  hook: id,
  story: [id],
  directions: [{ title: id, body: id }],
  pledge: id,
  ...(days ? { days } : {}),
});

/** 그날부터 n일의 날짜 (YYYY-MM-DD) */
const daysFrom = (start: string, n: number): string[] => Array.from({ length: n }, (_, i) => addDays(start, i));

// 시험은 모든 달 파일을 다 받아서 본다 (앱은 필요한 달만 받는다)
const MONTHS = await Promise.all(GROWTH_MONTHS.map(async (m) => [m, await loadGrowthMonth(m)] as const));
const DAILY = MONTHS.flatMap(([, list]) => [...list]);
const ALL: readonly GrowthLesson[] = [...DAILY, ...LEGACY_LESSONS];
const LAST_DAY = DAILY.map((l) => l.from).sort().at(-1)!;

const textOf = (l: GrowthLesson): string =>
  [
    l.theme,
    l.title,
    l.hook,
    l.quiz?.q ?? "",
    ...l.story,
    ...l.directions.flatMap((d) => [d.title, d.body]),
    l.pledge,
    l.coach ?? "",
    ...(l.sources ?? []).map((s) => s.name),
  ].join("\n");
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
    for (const l of ALL) {
      expect(l.story.length).toBeGreaterThan(0);
      expect(l.directions.length).toBeGreaterThan(0);
      expect(l.pledge.length).toBeGreaterThan(0);
      expect(/^\d{4}-\d{2}-\d{2}$/.test(l.from)).toBe(true);
    }
  });

  it("id 는 모든 달에서 하나뿐이고, 읽음 기록의 열쇠 모양이다 (소문자 · 숫자 · 줄표 40자 안)", () => {
    const ids = ALL.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    // 서버 growth_mark 가 받는 모양과 같다
    for (const id of ids) expect(id).toMatch(/^[a-z0-9][a-z0-9-]{1,39}$/);
  });
});

describe("달마다 파일 — 필요한 달만 받는다", () => {
  it("달 파일 이름은 YYYY-MM · 그 달 날짜의 글만 · 날짜는 겹치지 않고 이른 날부터", () => {
    expect(GROWTH_MONTHS.length).toBeGreaterThan(0);
    for (const [month, list] of MONTHS) {
      expect(month).toMatch(/^20\d{2}-(0[1-9]|1[0-2])$/);
      expect(list.length).toBeGreaterThan(0);
      const days = list.map((l) => l.from);
      for (const l of list) {
        expect(l.from.startsWith(`${month}-`)).toBe(true);
        expect(l.days).toBe(1);
      }
      expect(new Set(days).size).toBe(days.length);
      expect([...days].sort()).toEqual(days);
    }
    expect([...GROWTH_MONTHS].sort()).toEqual([...GROWTH_MONTHS]);
  });

  it("빈 날이 없다 — 달 안에서 날짜가 이어지고 그 달 말일까지, 달과 달도 이어진다", () => {
    MONTHS.forEach(([month, list], i) => {
      const days = list.map((l) => l.from);
      for (let k = 1; k < days.length; k++) expect(days[k]).toBe(addDays(days[k - 1], 1));
      const [y, m] = month.split("-").map(Number);
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      expect(days.at(-1)).toBe(`${month}-${String(lastDay).padStart(2, "0")}`);
      // 첫 달(11월 16일 시작)이 아니면 1일부터 — 앞 달 마지막 글 바로 다음 날
      if (i > 0) {
        expect(days[0]).toBe(`${month}-01`);
        expect(days[0]).toBe(addDays(MONTHS[i - 1][1].at(-1)!.from, 1));
      }
    });
  });

  it("오늘이 든 달까지의 최근 두 달만 — 앞으로 올 달은 받지 않는다", () => {
    const months = ["2026-11", "2026-12", "2027-01"];
    expect(monthsFor("2026-10-31", months)).toEqual([]);
    expect(monthsFor("2026-11-30", months)).toEqual(["2026-11"]);
    expect(monthsFor("2026-12-01", months)).toEqual(["2026-11", "2026-12"]);
    expect(monthsFor("2027-01-15", months)).toEqual(["2026-12", "2027-01"]);
    // 새 달 글이 아직 없으면 — 있는 달 가운데 최근 두 달
    expect(monthsFor("2027-03-02", months)).toEqual(["2026-12", "2027-01"]);
  });

  it("없는 달은 빈 목록 · 받은 글에는 날마다 글이 생기기 전의 글도 들어 있다", async () => {
    expect(await loadGrowthMonth("1999-01")).toEqual([]);
    const before = await loadGrowthLessons("2026-10-30");
    expect(before.map((l) => l.id)).toEqual(LEGACY_LESSONS.map((l) => l.id));
    const nov = await loadGrowthLessons("2026-11-17");
    expect(nov.some((l) => l.id === "ox-ring-square")).toBe(true);
    expect(nov.some((l) => l.id === "show-first")).toBe(true);
  });
});

describe("날마다 글 — 2026년 11월 16일부터 날마다 다른 글", () => {
  const days = daysFrom("2026-11-16", 15);

  it("11/16 ~ 11/30 은 그날의 글이 나온다 (15편 · 모두 다른 글)", async () => {
    const shown = await Promise.all(days.map(async (d) => todayLesson(d, await loadGrowthLessons(d))));
    shown.forEach((l, i) => {
      expect(l?.from).toBe(days[i]);
      expect(l?.days).toBe(1);
    });
    expect(new Set(shown.map((l) => l?.id)).size).toBe(15);
  });

  it("그 전날까지는 예전 교육 그대로", async () => {
    expect(todayLesson("2026-11-15", await loadGrowthLessons("2026-11-15"))?.id).toBe("show-first");
  });

  it("글의 코너 = 그 요일의 코너", () => {
    for (const l of DAILY) expect(l.theme).toBe(GROWTH_CORNERS[weekdayOf(l.from)]);
    expect(GROWTH_CORNERS).toHaveLength(7);
    expect(weekdayOf("2026-11-16")).toBe(1); // 월요일
    expect(cornerOf("2026-11-17")).toBe("복싱 상식 O/X");
  });

  it("마지막 글 다음 날부터도 — 요일 코너가 맞고, 어제와 다른 글이 나온다", async () => {
    const after = daysFrom(addDays(LAST_DAY, 1), 28);
    let prev = todayLesson(LAST_DAY, await loadGrowthLessons(LAST_DAY))?.id;
    const shown: (string | undefined)[] = [];
    for (const d of after) {
      const l = todayLesson(d, await loadGrowthLessons(d));
      expect(l?.days).toBe(1);
      expect(weekdayOf(l!.from)).toBe(weekdayOf(d));
      expect(l?.id).not.toBe(prev);
      prev = l?.id;
      shown.push(l?.id);
    }
    // 같은 요일 글은 주마다 돌아가며 — 한 주 뒤 같은 요일에는 다른 글
    expect(shown[0]).not.toBe(shown[7]);
  });
});

describe("지난 글 — 어제부터 7일", () => {
  it("가까운 날부터 · 오늘 글은 빼고 · 날마다 글만", async () => {
    const lessons = await loadGrowthLessons("2026-11-20");
    const list = recentLessons("2026-11-20", lessons);
    expect(list.map((r) => r.day)).toEqual(["2026-11-19", "2026-11-18", "2026-11-17", "2026-11-16"]);
    expect(list.map((r) => r.lesson.id)).toEqual(["mood-1039", "jab-return", "ox-ring-square", "habit-66days"]);
    // 날마다 글이 시작한 날에는 지난 글이 없다 (그 전 글은 날마다 글이 아니다)
    expect(recentLessons("2026-11-16", lessons)).toEqual([]);
    expect(recentLessons("2026-11-30", await loadGrowthLessons("2026-11-30"))).toHaveLength(7);
  });

  it("새 글이 없는 날이 끼어도 — 같은 글은 한 번만, 오늘 글은 없다", async () => {
    const today = addDays(LAST_DAY, 3);
    const lessons = await loadGrowthLessons(today);
    const now = todayLesson(today, lessons);
    const list = recentLessons(today, lessons);
    const ids = list.map((r) => r.lesson.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(now?.id);
    for (const r of list) expect(r.day < today).toBe(true);
    expect([...list.map((r) => r.day)].sort().reverse()).toEqual(list.map((r) => r.day));
  });

  it("날짜 글 — 11/16(월) · 달이 넘어가도", () => {
    expect(growthDayLabel("2026-11-16")).toBe("11/16(월)");
    expect(growthDayLabel("2026-12-01")).toBe("12/1(화)");
    expect(addDays("2026-12-01", -1)).toBe("2026-11-30");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
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
    // 본문 = (O/X 문제 +) 이야기
    const body = bare((l.quiz?.q ?? "") + l.story.join(""));
    expect(body).toBeGreaterThanOrEqual(150);
    expect(body).toBeLessThanOrEqual(250);
    // 오늘 하나는 1개 · 한 줄
    expect(l.directions).toHaveLength(1);
    expect([...l.directions[0].title].length).toBeLessThanOrEqual(14);
    expect([...l.directions[0].body].length).toBeLessThanOrEqual(60);
    expect([...l.pledge].length).toBeLessThanOrEqual(30);
    // (2단계) 코치 「오늘의 한마디」 — 수업에서 말하는 한 문장 · 40자 안
    expect((l.coach ?? "").trim().length).toBeGreaterThan(0);
    expect([...(l.coach ?? "")].length).toBeLessThanOrEqual(40);
    expect(textOf(l)).not.toMatch(BANNED);
    if (NEEDS_SOURCE.has(l.theme)) expect((l.sources ?? []).length).toBeGreaterThan(0);
    for (const s of l.sources ?? []) {
      expect(s.name.trim().length).toBeGreaterThan(0);
      if (s.url) expect(s.url).toMatch(/^https:\/\//);
    }
  });

  it("O/X 코너 글에는 문제가 있고, 이야기는 정답으로 시작한다", () => {
    const ox = DAILY.filter((l) => l.theme === "복싱 상식 O/X");
    expect(ox.length).toBeGreaterThan(0);
    for (const l of ox) expect(l.quiz).toBeTruthy();
    for (const l of ALL.filter((x) => x.quiz)) {
      const q = l.quiz!;
      expect(["O", "X"]).toContain(q.answer);
      // 문제 문장만 — "문제." · "(O / X)" 는 화면이 붙인다
      expect(q.q).not.toMatch(/^문제|\(O ?\/ ?X\)/);
      expect([...q.q].length).toBeGreaterThanOrEqual(8);
      expect([...q.q].length).toBeLessThanOrEqual(50);
      expect(l.story[0].startsWith(`정답은 ${q.answer}예요.`)).toBe(true);
      // 코치 한마디 · TV 는 답을 말하지 않는다 — 답은 앱 홈에서
      expect(l.coach ?? "").not.toMatch(/정답은|[OX]예요/);
      if (l.coach) expect(l.coach).toContain("앱");
    }
  });
});
