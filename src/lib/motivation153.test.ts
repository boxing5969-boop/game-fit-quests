import { describe, expect, it } from "vitest";
import {
  MOTIVATION_OFF,
  celebrationProgress,
  daysBetween,
  earlyLetter,
  isBehind,
  lastVisitLabel,
  motivationLetter,
  nextCelebration,
  nextEarlyStep,
  normalizeMotivation,
  normalizeWatchlist,
  starterLetter,
  starterView,
} from "./motivation153";

const server = (over: Record<string, unknown> = {}) => ({
  on: true,
  today: "2026-11-20",
  total: 3,
  first_day: "2026-11-10",
  starter: { days: 28, goal: 8, mileage: 3000, count: 3, active: true, ends_on: "2026-12-07", done_at: null, done_mileage: null },
  early: { steps: [5, 10, 20, 30], next: 5, prev: 0 },
  unseen: null,
  ...over,
});

describe("normalizeMotivation", () => {
  it("꺼진 지점 · 이상한 값은 꺼진 것으로", () => {
    expect(normalizeMotivation({ on: false })).toEqual(MOTIVATION_OFF);
    expect(normalizeMotivation(null)).toEqual(MOTIVATION_OFF);
    expect(normalizeMotivation("x")).toEqual(MOTIVATION_OFF);
  });

  it("서버 값을 그대로 읽는다", () => {
    const m = normalizeMotivation(server());
    expect(m.on).toBe(true);
    expect(m.starter).toMatchObject({ goal: 8, count: 3, active: true, endsOn: "2026-12-07", mileage: 3000, doneAt: null });
    expect(m.early).toEqual({ steps: [5, 10, 20, 30], next: 5, prev: 0 });
    expect(m.unseen).toBeNull();
  });

  it("안 본 축하 — 첫 4주 달성 · 이른 축하", () => {
    const m = normalizeMotivation(server({ unseen: { starter: true, early: 5, mileage: 3000 } }));
    expect(m.unseen).toEqual({ starter: true, early: 5, mileage: 3000 });
    expect(normalizeMotivation(server({ unseen: { starter: false, early: null, mileage: 0 } })).unseen).toBeNull();
  });
});

describe("starterView — 홈 첫 4주 칸", () => {
  it("남은 날 · 남은 횟수 · 마일리지", () => {
    const v = starterView(normalizeMotivation(server()), "2026-11-20");
    expect(v).toMatchObject({ show: true, done: false, count: 3, goal: 8, daysLeft: 18, mileage: 3000 });
    expect(v.hint).toBe("5번 더 오면 마일리지 +3,000점");
  });

  it("마지막 날은 1일 남음 · 지나면 안 그린다", () => {
    expect(starterView(normalizeMotivation(server()), "2026-12-07").daysLeft).toBe(1);
    expect(starterView(normalizeMotivation(server()), "2026-12-08").show).toBe(false);
    expect(starterView(normalizeMotivation(server({ starter: { ...server().starter, active: false } })), "2026-11-20").show).toBe(false);
    expect(starterView(MOTIVATION_OFF, "2026-11-20").show).toBe(false);
  });

  it("남은 날보다 남은 횟수가 많으면 못 한다고 하지 않는다", () => {
    const v = starterView(normalizeMotivation(server({ starter: { ...server().starter, count: 1, ends_on: "2026-11-23" } })), "2026-11-20");
    expect(v.hint).toBe("오늘 한 번이 다음 축하를 당겨요");
  });

  it("다 채우면 — 드렸으면 '드렸어요', 아직이면 '곧'", () => {
    const done = { ...server().starter, count: 9, done_at: "2026-11-25T01:00:00Z", done_mileage: 3000 };
    const v = starterView(normalizeMotivation(server({ starter: done })), "2026-11-26");
    expect(v).toMatchObject({ done: true, count: 8, rewarded: true });
    expect(v.hint).toBe("마일리지 +3,000점을 드렸어요");
    const soon = starterView(normalizeMotivation(server({ starter: { ...done, done_at: null } })), "2026-11-26");
    expect(soon.hint).toBe("마일리지 +3,000점이 곧 들어와요");
    const free = starterView(normalizeMotivation(server({ starter: { ...done, mileage: 0, done_at: null, done_mileage: null } })), "2026-11-26");
    expect(free.hint).toBe("153이 습관이 되기 시작했어요");
  });
});

describe("nextCelebration — 5 · 10 · 20 · 30 다음은 50번마다", () => {
  it("켠 지점 회원은 이른 축하가 먼저", () => {
    const m = normalizeMotivation(server({ total: 7, early: { steps: [5, 10, 20, 30], next: 10, prev: 5 } }));
    const t = nextCelebration(7, m, { next: 50, step: 50 });
    expect(t).toEqual({ next: 10, prev: 5, early: true });
    expect(celebrationProgress(7, t)).toMatchObject({ left: 3, ratio: 0.4 });
  });

  it("이른 축하가 끝났거나 꺼진 지점은 기존 50번마다", () => {
    const after = normalizeMotivation(server({ total: 31, early: { steps: [5, 10, 20, 30], next: null, prev: null } }));
    expect(nextCelebration(31, after, { next: 50, step: 50 })).toEqual({ next: 50, prev: 0, early: false });
    expect(nextCelebration(120, MOTIVATION_OFF, { next: 150, step: 50 })).toEqual({ next: 150, prev: 100, early: false });
    expect(nextCelebration(120, null)).toEqual({ next: 150, prev: 100, early: false });
    const p = celebrationProgress(120, nextCelebration(120, null));
    expect(p).toMatchObject({ left: 30, ratio: 0.4 });
  });

  it("서버 다음 값이 이미 지난 값이면 total 로 다시 센다", () => {
    const stale = normalizeMotivation(server({ total: 5, early: { steps: [5, 10, 20, 30], next: 5, prev: 0 } }));
    expect(nextCelebration(5, stale, { next: 50, step: 50 })).toEqual({ next: 50, prev: 0, early: false });
  });
});

describe("편지", () => {
  it("이른 축하 다음 단계", () => {
    expect(nextEarlyStep(5)).toBe(10);
    expect(nextEarlyStep(20)).toBe(30);
    expect(nextEarlyStep(30)).toBe(50);
  });

  it("이른 축하 편지 — 선물 없이 다음 단계를 말한다", () => {
    const l = earlyLetter("민준", 10);
    expect(l.title).toBe("출석 10번째를 채운\n민준님께");
    expect(l.body).toContain("이제 153이 민준님의 일정이 됐어요");
    expect(l.body).toContain("다음 20번째에서 또 축하할게요");
    expect(l.body).not.toContain("마일리지");
    expect(earlyLetter("", 30).body).toContain("다음 50번째");
    expect(earlyLetter("", 5).title).toContain("복서님께");
  });

  it("첫 4주 편지 — 마일리지가 있을 때만 선물 줄", () => {
    expect(starterLetter("서연", 8, 3000).body).toContain("마일리지 +3,000점");
    expect(starterLetter("서연", 8, 0).body).not.toContain("마일리지");
  });

  it("안 본 축하 → 첫 4주 달성이 먼저", () => {
    const both = normalizeMotivation(server({ unseen: { starter: true, early: 5, mileage: 3000 }, starter: { ...server().starter, done_mileage: 3000 } }));
    expect(motivationLetter("A", both)?.eyebrow).toBe("First 4 Weeks at 153");
    const early = normalizeMotivation(server({ unseen: { starter: false, early: 20, mileage: 0 } }));
    expect(motivationLetter("A", early)?.title).toContain("출석 20번째");
    expect(motivationLetter("A", normalizeMotivation(server()))).toBeNull();
  });

  it("편지에 긴 줄표 · 국가대표 같은 금칙 말이 없다", () => {
    const all = [earlyLetter("A", 5), earlyLetter("A", 10), earlyLetter("A", 20), earlyLetter("A", 30), starterLetter("A", 8, 3000)];
    for (const l of all) {
      const text = `${l.title}\n${l.body}`;
      expect(text).not.toMatch(/국가대표|벨트|계급/);
      expect(text).not.toContain("—");
    }
  });
});

describe("코치 화면 첫 4주 신규", () => {
  const raw = {
    on: true,
    branch: "153복싱짐 선릉역점",
    goal: 8,
    days: 28,
    today: "2026-11-20",
    rows: [
      { user_id: "a", name: "에이", real_name: "회원A", avatar_url: null, first_day: "2026-11-10", day: 11, count: 2, last_day: "2026-11-14", expected: 3, done: false },
      { user_id: "b", name: "비", first_day: "2026-11-01", day: 20, count: 8, last_day: "2026-11-20", expected: 5, done: true },
      { user_id: "", name: "빈 줄" },
    ],
  };

  it("읽기 · 빈 줄 버리기", () => {
    const w = normalizeWatchlist(raw);
    expect(w.on).toBe(true);
    expect(w.rows).toHaveLength(2);
    expect(w.rows[0]).toMatchObject({ userId: "a", name: "에이", realName: "회원A", count: 2, expected: 3, done: false });
    expect(normalizeWatchlist(null)).toMatchObject({ on: false, rows: [] });
  });

  it("뒤처짐 · 마지막 출석", () => {
    const w = normalizeWatchlist(raw);
    expect(isBehind(w.rows[0])).toBe(true);
    expect(isBehind(w.rows[1])).toBe(false);
    expect(lastVisitLabel("2026-11-20", "2026-11-20")).toBe("오늘 왔어요");
    expect(lastVisitLabel("2026-11-19", "2026-11-20")).toBe("어제 왔어요");
    expect(lastVisitLabel("2026-11-14", "2026-11-20")).toBe("6일 전에 왔어요");
    expect(daysBetween("2026-11-30", "2026-12-02")).toBe(2);
  });
});
