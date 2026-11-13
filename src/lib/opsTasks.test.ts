import { describe, expect, it } from "vitest";
import {
  TASKS_OFF,
  TASK_GUIDE,
  boardChips,
  dueByDay,
  dueLabel,
  dutyLine,
  emptyTaskDraft,
  fromLine,
  groupTasks,
  isAssignedToMe,
  nextStatus,
  normalizeBoard,
  normalizeTasksDay,
  quickDues,
  taskDraftError,
  taskPayload,
  type OpsTask,
} from "./opsTasks";

// 지어낸 사람 · 지어낸 일만
const task = (p: Partial<OpsTask> & { id: string }): OpsTask => ({
  title: "할 일",
  memo: null,
  kind: "mine",
  effect: 2,
  due_on: null,
  status: "todo",
  source: "self",
  preset_id: null,
  reply: null,
  created_by: "me",
  created_by_name: null,
  done_at: null,
  updated_at: "",
  ...p,
});

describe("할 일 — 서버 값 읽기 (ops_tasks_day · ops_task_board)", () => {
  it("모르는 값은 비운 값으로 · 3-4 칸(assigned · team)", () => {
    const d = normalizeTasksDay({
      branch: "선릉",
      manage: true,
      me: "m1",
      date: "2026-11-16",
      today: "2026-11-16",
      tasks: [
        { id: "t1", title: "체험 상담", status: "doing", source: "assigned", created_by: "boss", created_by_name: "지점장A", due_on: "2026-11-17", effect: 9 },
        { id: "t2" },
        { id: "t3", title: "청소 확인", status: "weird", kind: "delegate" },
      ],
      duties: [{ id: "d1", title: "샤워실 청소", slot: "open", time: "11:00:00", mine: true, people: ["코치가", 3], checked: false }],
      presets: [{ id: "p1", title: "수업 15분 전 준비", effect: 3 }, { id: "p2" }],
      prefs: { manual_version: "v1" },
      assigned: [{ id: "a1", title: "운동복 정리", status: "done", user_id: "c1", user_name: "코치가", reply: "끝냈어요" }, { id: "a2", title: "x" }],
      team: [{ user_id: "c1", name: "코치가" }, { name: "이름만" }],
      focus: ["t1"],
    });
    expect(d.available).toBe(true);
    expect(d.tasks).toHaveLength(2);
    expect(d.tasks[0]).toMatchObject({ status: "doing", source: "assigned", created_by_name: "지점장A", effect: 3, due_on: "2026-11-17" });
    expect(d.tasks[1]).toMatchObject({ status: "todo", kind: "delegate" });
    expect(d.duties[0]).toMatchObject({ time: "11:00", people: ["코치가"], mine: true });
    expect(d.presets).toEqual([{ id: "p1", title: "수업 15분 전 준비", effect: 3 }]);
    expect(d.manualVersion).toBe("v1");
    expect(d.assigned).toHaveLength(1);
    expect(d.team).toEqual([{ user_id: "c1", name: "코치가" }]);
    expect(normalizeTasksDay(null)).toBe(TASKS_OFF);
    // 3-4 적용 전 DB — assigned · team 칸이 없어도 빈 목록
    expect(normalizeTasksDay({ branch: "b", tasks: [] }).assigned).toEqual([]);
  });

  it("팀 숫자 — 작성률(focus_days)은 읽지 않는다 · 고정 업무 0 이면 없음", () => {
    const b = normalizeBoard({
      from: "2026-11-16",
      to: "2026-11-22",
      people: [{ user_id: "c1", name: "코치가", open: 2, doing: 1, done_week: 3, overdue: 1, assigned_open: 1, shift_weekdays: 7, focus_days: 2 }],
      duties: { due: 0, done: 0 },
    });
    expect(b?.people[0]).toEqual({ user_id: "c1", name: "코치가", open: 2, doing: 1, done_week: 3, overdue: 1, assigned_open: 1, shift_weekdays: 7 });
    expect(b?.duties).toBeNull();
    expect(Object.keys(b?.people[0] ?? {})).not.toContain("focus_days");
  });
});

describe("할 일 — 상태 · 마감 · 묶기", () => {
  it("동그라미 — 파랑 → 노랑 → 회색 → 파랑", () => {
    expect(nextStatus("todo")).toBe("doing");
    expect(nextStatus("doing")).toBe("done");
    expect(nextStatus("done")).toBe("todo");
  });

  it("마감 한 줄 — 오늘 · 내일 · 요일 · 지난 마감은 날짜만", () => {
    const today = "2026-11-16"; // 월
    expect(dueLabel(null, today)).toBeNull();
    expect(dueLabel("2026-11-16", today)).toEqual({ text: "오늘까지", tone: "today" });
    expect(dueLabel("2026-11-17", today)).toEqual({ text: "내일까지", tone: "soon" });
    expect(dueLabel("2026-11-20", today)).toEqual({ text: "11/20(금)까지", tone: "soon" });
    expect(dueLabel("2026-12-01", today)).toEqual({ text: "12/1(화)까지", tone: "later" });
    expect(dueLabel("2026-11-12", today)).toEqual({ text: "11/12까지", tone: "past" });
  });

  it("마감 빨리 고르기 — 금요일(금 · 토 · 일이면 다음 주 금)", () => {
    expect(quickDues("2026-11-16").map((q) => [q.label, q.date])).toEqual([
      ["오늘", "2026-11-16"],
      ["내일", "2026-11-17"],
      ["금요일", "2026-11-20"],
    ]);
    // 목요일 — 내일이 금요일이면 한 번만
    expect(quickDues("2026-11-19").map((q) => q.label)).toEqual(["오늘", "내일"]);
    expect(quickDues("2026-11-20").find((q) => q.key === "fri")).toEqual({ key: "fri", label: "다음 주 금", date: "2026-11-27" });
    expect(quickDues("2026-11-22").find((q) => q.key === "fri")?.date).toBe("2026-11-27");
  });

  it("묶기 · 달력 마감 점(안 끝낸 일만) · 맡긴 분 한 줄", () => {
    const list = [
      task({ id: "a", status: "done", due_on: "2026-11-16" }),
      task({ id: "b", status: "doing", due_on: "2026-11-17" }),
      task({ id: "c", due_on: "2026-11-17" }),
      task({ id: "d" }),
    ];
    const g = groupTasks(list);
    expect(g.doing.map((t) => t.id)).toEqual(["b"]);
    expect(g.todo.map((t) => t.id)).toEqual(["c", "d"]);
    expect(g.done.map((t) => t.id)).toEqual(["a"]);
    const m = dueByDay(list);
    expect([...m.keys()]).toEqual(["2026-11-17"]);
    expect(m.get("2026-11-17")?.map((t) => t.id)).toEqual(["b", "c"]);
    const got = task({ id: "x", source: "assigned", created_by: "boss", created_by_name: "지점장A" });
    expect(fromLine(got)).toBe("지점장A님이 맡김");
    expect(fromLine(task({ id: "y" }))).toBeNull();
    expect(isAssignedToMe(got, "me")).toBe(true);
    // 대표님이 자기에게 넣은 일은 받은 일이 아니다
    expect(isAssignedToMe(task({ id: "z", source: "assigned", created_by: "me" }), "me")).toBe(false);
  });
});

describe("할 일 — 넣기 · 고치기 (서버 ops_task_save 와 같은 말)", () => {
  const today = "2026-11-16";
  it("검사", () => {
    const d = emptyTaskDraft();
    expect(taskDraftError(d, today)).toBe("할 일을 적어 주세요");
    expect(taskDraftError({ ...d, title: "가".repeat(61) }, today)).toBe("할 일은 60자까지예요");
    expect(taskDraftError({ ...d, title: "상담", memo: "나".repeat(301) }, today)).toBe("메모는 300자까지예요");
    expect(taskDraftError({ ...d, title: "상담", due: "2026-10-15" }, today)).toBe("기한을 다시 골라 주세요");
    expect(taskDraftError({ ...d, title: "상담", due: "2027-11-18" }, today)).toBe("기한을 다시 골라 주세요");
    expect(taskDraftError({ ...d, title: "상담", due: "2026-10-16" }, today)).toBeNull();
  });

  it("보낼 값 — 새 일 · 맡기기 · 고칠 때는 종류 · 효과 점수 그대로", () => {
    const d = { ...emptyTaskDraft(), title: "  체험 상담 ", memo: " ", due: "2026-11-17" };
    expect(taskPayload(d, "선릉")).toEqual({ title: "체험 상담", memo: null, due_on: "2026-11-17", branch: "선릉" });
    expect(taskPayload({ ...d, userId: "c1" }, "선릉")).toMatchObject({ user_id: "c1", branch: "선릉" });
    expect(taskPayload({ ...d, presetId: "p1" }, "선릉")).toMatchObject({ preset_id: "p1" });
    expect(taskPayload(d, "선릉", { id: "t1", kind: "delegate", effect: 3 })).toEqual({
      title: "체험 상담",
      memo: null,
      due_on: "2026-11-17",
      id: "t1",
      kind: "delegate",
      effect: 3,
    });
  });
});

describe("지점 관리자 — 이번 주 팀", () => {
  it("0 은 빼고 · 마감 지남 · 쉬는 날 없음", () => {
    expect(boardChips({ user_id: "c", name: "코치가", open: 0, doing: 0, done_week: 0, overdue: 0, assigned_open: 0, shift_weekdays: 5 })).toEqual({ chips: [], flags: [] });
    expect(boardChips({ user_id: "c", name: "코치가", open: 2, doing: 1, done_week: 4, overdue: 1, assigned_open: 1, shift_weekdays: 7 })).toEqual({
      chips: ["하는 중 1", "할 일 2", "이번 주 끝 4"],
      flags: ["마감 지남 1", "쉬는 날 없음"],
    });
    expect(dutyLine({ due: 15, done: 12 })).toBe("고정 업무 체크 12 / 15");
    expect(dutyLine(null)).toBeNull();
  });

  it("처음 안내는 3장 · 「중요한 일 3개」 말이 없다(대표님 결정 7)", () => {
    expect(TASK_GUIDE).toHaveLength(3);
    expect(TASK_GUIDE.map((g) => g.title + g.body).join(" ")).not.toMatch(/중요한 일 3개|작성률/);
  });
});
