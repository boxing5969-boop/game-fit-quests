import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HABITS_OFF,
  LATER_HINT,
  LATER_TITLE,
  MEMBER_BANNED,
  TODO_EMPTY,
  TODO_EXAMPLES,
  applyTodoDone,
  flexChipLabel,
  fullGoalOf,
  mondayOfYmd,
  normalizeCalTodos,
  normalizeHabits,
  scheduleLabel,
  streakLine,
  streakWeeks,
  todoDueLabel,
  todoError,
  todoGroups,
  todoPayload,
  todoQuickDues,
  todosOn,
  weekDoneOf,
  weekGoalHint,
  weekGoalOf,
  weekLine,
  type MemberTodo,
} from "./memberHabits";

// 지어낸 자료만
describe("습관 — 서버 값 읽기 (get_my_habits)", () => {
  it("꺼짐 · 모르는 값", () => {
    expect(normalizeHabits(null)).toBe(HABITS_OFF);
    expect(normalizeHabits({ on: false })).toBe(HABITS_OFF);
    const h = normalizeHabits({
      on: true,
      today: "2026-11-18",
      monday: "2026-11-16",
      items: [
        { id: "a", label: "줄넘기", target: 10, unit: "분", weekdays: null, week_goal: 3, goal: 3, created_on: "2026-11-01", week: { done: 2, goal: 3 }, now_weeks: 2, best_weeks: 4 },
        { id: "b", label: "섀도", weekdays: [5, 1, 3, 3, 8], week_goal: 9, goal: 3, created_on: "2026-11-01" },
        { id: "c" },
      ],
      todos: [{ id: "t1", title: "등록 상담", due_on: "2026-11-20", done_on: null, created_on: "2026-11-15" }, { id: "t2" }],
    });
    expect(h.items).toHaveLength(2);
    expect(h.items[0]).toMatchObject({ weekGoal: 3, week: { done: 2, goal: 3 }, nowWeeks: 2, bestWeeks: 4 });
    expect(h.items[1]).toMatchObject({ weekdays: [1, 3, 5], weekGoal: null, week: { done: 0, goal: 0 }, nowWeeks: 0 });
    expect(h.todos).toEqual([{ id: "t1", title: "등록 상담", dueOn: "2026-11-20", doneOn: null, createdOn: "2026-11-15" }]);
  });
});

describe("습관 — 주 계산 (서버 get_my_habits · 로컬 SQL 시험 3번 묶음과 같은 경우)", () => {
  it("월요일 · 한 주 목표", () => {
    expect(mondayOfYmd("2026-11-18")).toBe("2026-11-16"); // 수
    expect(mondayOfYmd("2026-11-22")).toBe("2026-11-16"); // 일
    expect(mondayOfYmd("2026-11-16")).toBe("2026-11-16");
    expect(fullGoalOf({ weekdays: null, weekGoal: 3 })).toBe(3);
    expect(fullGoalOf({ weekdays: [1, 3, 5], weekGoal: null })).toBe(3);
    expect(fullGoalOf({ weekdays: null, weekGoal: null })).toBe(7);
  });

  it("그 주 목표 — 만든 주는 남은 날만큼 · 고른 요일만", () => {
    // 월 · 수 · 금 · 화요일에 만든 주 → 수 · 금 2번
    expect(weekGoalOf({ weekdays: [1, 3, 5], weekGoal: null, createdOn: "2026-10-13" }, "2026-10-12")).toBe(2);
    expect(weekGoalOf({ weekdays: [1, 3, 5], weekGoal: null, createdOn: "2026-10-13" }, "2026-10-19")).toBe(3);
    // 주 5번 · 금요일에 만든 주 → 금 · 토 · 일 3번
    expect(weekGoalOf({ weekdays: null, weekGoal: 5, createdOn: "2026-11-20" }, "2026-11-16")).toBe(3);
    // 매일 · 일요일에 만든 주 → 1번
    expect(weekGoalOf({ weekdays: null, weekGoal: null, createdOn: "2026-11-22" }, "2026-11-16")).toBe(1);
    // 월요일만 · 화요일에 만든 주 → 0 (그 주는 셈에 안 듦)
    expect(weekGoalOf({ weekdays: [1], weekGoal: null, createdOn: "2026-11-17" }, "2026-11-16")).toBe(0);
  });

  it("이어 가는 주 · 가장 길게 — Y · Z · D 와 같은 경우", () => {
    // Y: ✓ · 없음 · ✓ · ✓ · ✓ · 이번 주 아직 → 3 · 3 / 이번 주 채움 → 4 · 4
    expect(streakWeeks([true, false, true, true, true, false])).toEqual({ now: 3, best: 3 });
    expect(streakWeeks([true, false, true, true, true, true])).toEqual({ now: 4, best: 4 });
    // Z: ✓ · ✓ · 월만 · ✓ · ✓ · 이번 주 아직 → 2 · 2
    expect(streakWeeks([true, true, false, true, true, false])).toEqual({ now: 2, best: 2 });
    // D: 지난주 ✓ · 이번 주 아직 → 1 · 1
    expect(streakWeeks([true, false])).toEqual({ now: 1, best: 1 });
    // 길게 이어 갔다가 지난주 쉼 · 이번 주 아직 → 지금 0 · 가장 길게 5
    expect(streakWeeks([true, true, true, true, true, false, false])).toEqual({ now: 0, best: 5 });
    expect(streakWeeks([])).toEqual({ now: 0, best: 0 });
    expect(streakWeeks([false])).toEqual({ now: 0, best: 0 });
  });

  it("그 주 채운 수 — 오늘까지만 셈", () => {
    const days = new Map([
      ["2026-11-16", { done: ["a"] }],
      ["2026-11-17", { done: ["b"] }],
      ["2026-11-18", { done: ["a", "b"] }],
      ["2026-11-20", { done: ["a"] }],
    ]);
    expect(weekDoneOf("a", days, "2026-11-16", "2026-11-18")).toBe(2);
    expect(weekDoneOf("a", days, "2026-11-16", "2026-11-22")).toBe(3);
    expect(weekDoneOf("b", days, "2026-11-16", "2026-11-16")).toBe(0);
  });
});

describe("습관 — 글 (채운 것 · 이어 간 것 · 다음 한 걸음만)", () => {
  it("언제 · 이번 주 · 이어 간 주 · 칩", () => {
    expect(scheduleLabel({ weekdays: null, weekGoal: 3 })).toBe("주 3번 · 아무 날이나");
    expect(scheduleLabel({ weekdays: [1, 3, 5], weekGoal: null })).toBe("매주 월 · 수 · 금");
    expect(scheduleLabel({ weekdays: null, weekGoal: null })).toBe("매일");
    expect(weekLine({ done: 2, goal: 3 })).toBe("이번 주 2/3번");
    expect(weekLine({ done: 3, goal: 3 })).toBe("이번 주 채웠어요");
    expect(weekLine({ done: 0, goal: 0 })).toBeNull();
    expect(streakLine(3, 3)).toBe("3주째 이어 가요");
    expect(streakLine(2, 5)).toBe("2주째 이어 가요 · 가장 길게 5주");
    expect(streakLine(0, 4)).toBe("가장 길게 4주 이어 갔어요");
    expect(streakLine(1, 1)).toBeNull();
    expect(flexChipLabel("줄넘기 10분", 2, 3)).toBe("줄넘기 10분 · 2/3");
    expect(flexChipLabel("줄넘기 10분", 3, 3)).toBe("줄넘기 10분 · 이번 주 채움");
    expect(weekGoalHint(1)).toBe("일주일에 한 번, 편한 날 체크해요");
    expect(weekGoalHint(4)).toBe("일주일에 4번, 편한 날 체크해요");
  });
});

describe("마감 있는 할 일", () => {
  const today = "2026-11-18"; // 수
  const todo = (p: Partial<MemberTodo> & { id: string }): MemberTodo => ({ title: "할 일", dueOn: today, doneOn: null, createdOn: "2026-11-10", ...p });

  it("묶기 — 앞으로(마감 빠른 순) · 다음에 해도 돼요 · 끝냈어요(최근 먼저)", () => {
    const g = todoGroups(
      [
        todo({ id: "a", dueOn: "2026-11-25" }),
        todo({ id: "b", dueOn: "2026-11-18" }),
        todo({ id: "c", dueOn: "2026-11-15" }),
        todo({ id: "d", dueOn: "2026-11-16", doneOn: "2026-11-16" }),
        todo({ id: "e", dueOn: "2026-11-17", doneOn: "2026-11-17" }),
      ],
      today,
    );
    expect(g.upcoming.map((t) => t.id)).toEqual(["b", "a"]);
    expect(g.later.map((t) => t.id)).toEqual(["c"]);
    expect(g.done.map((t) => t.id)).toEqual(["e", "d"]);
  });

  it("마감 한 줄 · 빨리 고르기(이번 주 일요일 · 토/일이면 다음 주)", () => {
    expect(todoDueLabel("2026-11-18", today)).toBe("오늘까지");
    expect(todoDueLabel("2026-11-19", today)).toBe("내일까지");
    expect(todoDueLabel("2026-11-22", today)).toBe("11/22(일)까지");
    expect(todoDueLabel("2026-11-15", today)).toBe("11/15(일)까지");
    expect(todoQuickDues(today).map((q) => [q.label, q.date])).toEqual([
      ["오늘", "2026-11-18"],
      ["내일", "2026-11-19"],
      ["이번 주 일요일", "2026-11-22"],
    ]);
    expect(todoQuickDues("2026-11-21").find((q) => q.key === "sun")).toEqual({ key: "sun", label: "다음 주 일요일", date: "2026-11-29" });
    expect(todoQuickDues("2026-11-22").find((q) => q.key === "sun")?.date).toBe("2026-11-29");
  });

  it("검사 — 서버(set_my_todo)와 같은 말 · 고칠 때 마감을 그대로 두면 지난 날도 됨", () => {
    expect(todoError(" ", today, today)).toBe("할 일을 적어 주세요");
    expect(todoError("가".repeat(31), today, today)).toBe("할 일은 30자 안으로 적어 주세요");
    expect(todoError("상담", null, today)).toBe("마감일을 골라 주세요");
    expect(todoError("상담", "2026-11-17", today)).toBe("마감일은 오늘부터 1년 안으로 골라 주세요");
    expect(todoError("상담", "2027-11-19", today)).toBe("마감일은 오늘부터 1년 안으로 골라 주세요");
    expect(todoError("상담", "2027-11-18", today)).toBeNull();
    expect(todoError("상담", "2026-11-10", today, "2026-11-10")).toBeNull();
    expect(todoError("상담", "2026-11-11", today, "2026-11-10")).toBe("마감일은 오늘부터 1년 안으로 골라 주세요");
    expect(todoPayload("  수강권   연장 ", "2026-11-20")).toEqual({ p_id: null, p_title: "수강권 연장", p_due: "2026-11-20" });
  });

  it("끝냈어요 · 되돌리기 · 달력 할 일", () => {
    const h = { ...HABITS_OFF, on: true, todos: [todo({ id: "a" })] };
    expect(applyTodoDone(h, "a", true, today).todos[0].doneOn).toBe(today);
    expect(applyTodoDone(applyTodoDone(h, "a", true, today), "a", false, today).todos[0].doneOn).toBeNull();
    const cal = normalizeCalTodos([{ id: "x", title: "등록", due_on: "2026-11-18", done: true }, { id: "y", title: "z" }]);
    expect(cal).toEqual([{ id: "x", title: "등록", dueOn: "2026-11-18", done: true }]);
    expect(todosOn(cal, "2026-11-18")).toHaveLength(1);
    expect(todosOn(cal, "2026-11-19")).toHaveLength(0);
  });
});

describe("회원 화면 글 — 쓰지 않는 낱말 (못 · 빠진 · 밀린 · 실패)", () => {
  const hasBanned = (s: string) => MEMBER_BANNED.some((w) => s.includes(w));

  it("lib 글을 넓게 돌려 봐도 없다", () => {
    const out: string[] = [LATER_TITLE, LATER_HINT, TODO_EMPTY, ...TODO_EXAMPLES];
    for (let n = 1; n <= 6; n++) out.push(scheduleLabel({ weekdays: null, weekGoal: n }), weekGoalHint(n));
    out.push(scheduleLabel({ weekdays: [1, 3], weekGoal: null }), scheduleLabel({ weekdays: null, weekGoal: null }));
    for (let g = 0; g <= 7; g++) for (let d = 0; d <= 8; d++) out.push(weekLine({ done: d, goal: g }) ?? "", flexChipLabel("잽", d, g));
    for (let a = 0; a <= 6; a++) for (let b = 0; b <= 8; b++) out.push(streakLine(a, b) ?? "");
    for (let k = -10; k <= 10; k++) {
      const d = new Date(Date.UTC(2026, 10, 18 + k)).toISOString().slice(0, 10);
      out.push(todoDueLabel(d, "2026-11-18"));
    }
    out.push(...todoQuickDues("2026-11-18").map((q) => q.label), ...todoQuickDues("2026-11-21").map((q) => q.label));
    expect(out.filter(hasBanned)).toEqual([]);
  });

  it("회원 화면 파일(주석 빼고)에도 없다", () => {
    const strip = (src: string) =>
      src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .filter((l) => !l.includes("export const MEMBER_BANNED"))
        .map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1"))
        .join("\n");
    // (3-5) 내 일정 · 찾기 · 보일 것 · 목록 · 한 해 · 음력 · 달력 카드 · 날씨 도장도
    for (const f of [
      "src/components/attendance/CheckItemsSheet.tsx",
      "src/components/attendance/CalendarChecks.tsx",
      "src/lib/memberHabits.ts",
      "src/components/attendance/WorkoutCalendar.tsx",
      "src/components/attendance/MyEventSheet.tsx",
      "src/components/attendance/CalendarSearchSheet.tsx",
      "src/components/attendance/CalendarViewSheet.tsx",
      "src/components/attendance/CalendarListView.tsx",
      "src/components/attendance/CalendarYearView.tsx",
      "src/lib/memberEvents.ts",
      "src/lib/calendarViews.ts",
      "src/lib/lunar.ts",
      "src/lib/calendarWeather.ts",
    ]) {
      const code = strip(readFileSync(resolve(process.cwd(), f), "utf8"));
      const hits = MEMBER_BANNED.filter((w) => w !== "못" && code.includes(w));
      // '못' 은 단어 사이에 들어가는 글자라 문장 단위로 본다 — 화면 글(따옴표 · JSX 글)만
      const texts = [...code.matchAll(/["'`]([^"'`\n]*[가-힣][^"'`\n]*)["'`]|>([^<>{}\n]*[가-힣][^<>{}\n]*)</g)].map((m) => m[1] ?? m[2] ?? "");
      expect({ f, hits, mot: texts.filter((t) => t.includes("못")) }).toEqual({ f, hits: [], mot: [] });
    }
  });
});
