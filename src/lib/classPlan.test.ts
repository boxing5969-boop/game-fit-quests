import { describe, expect, it } from "vitest";
import { isClassPlan, onlyClassLogs, planHour, planOverdue, planSnapshot, plansAwaitingFeedback, plansForBoard } from "./classPlan";
import type { StrategyItem } from "@/services/strategyService";

const item = (p: Partial<StrategyItem> & Pick<StrategyItem, "id">): StrategyItem =>
  ({
    kind: "class_log",
    title: "",
    body: "",
    data: {},
    principle_no: null,
    starred: false,
    event_date: "2026-11-13",
    target_user_ids: null,
    created_at: "2026-11-13T01:00:00Z",
    updated_at: "2026-11-13T01:00:00Z",
    author: { user_id: "u", name: "코치", title: "코치", avatar_url: null },
    mine: false,
    my_ack: null,
    targets: 0,
    acked: 0,
    applied: 0,
    comments: 0,
    ...p,
  }) as StrategyItem;

describe("코치님 수업안 (내 수업 짜기)", () => {
  it("수업안 = 수업 기록 중 stage 'plan' — 프로그램 · 그냥 수업 기록은 아님", () => {
    expect(isClassPlan(item({ id: "a", data: { stage: "plan" } }))).toBe(true);
    expect(isClassPlan(item({ id: "b" }))).toBe(false);
    expect(isClassPlan(item({ id: "c", kind: "program", data: { stage: "plan" } }))).toBe(false);
    expect(onlyClassLogs([item({ id: "a", data: { stage: "plan" } }), item({ id: "b" })]).map((i) => i.id)).toEqual(["b"]);
  });

  it("수업 시간 글 → 기록의 시 (5~23시, 못 읽으면 지금 시)", () => {
    expect(planHour("19:00", 9)).toBe(19);
    expect(planHour("7시", 9)).toBe(7);
    expect(planHour(" 21 ", 9)).toBe(21);
    expect(planHour("새벽", 9)).toBe(9);
    expect(planHour("03:00", 9)).toBe(9);
    expect(planHour(null, 12)).toBe(12);
  });

  it("기록으로 넘길 모양 — 이름 · 시간 · 블록 · 합계", () => {
    const s = planSnapshot(
      item({
        id: "a",
        title: "위빙 수업 — 기본 그룹",
        data: { stage: "plan", slot: " 19:00 ", blocks: [{ kind: "warmup", title: "십자 스텝", minutes: 8 }, { kind: "skill", title: "위빙", minutes: 15 }] },
      }),
    );
    expect(s).toEqual({
      title: "위빙 수업 — 기본 그룹",
      slot: "19:00",
      blocks: [
        { kind: "warmup", title: "십자 스텝", minutes: 8 },
        { kind: "skill", title: "위빙", minutes: 15 },
      ],
      total_min: 23,
    });
    expect(planSnapshot(item({ id: "b", data: { stage: "plan" } })).blocks).toEqual([]);
  });

  it("오늘 프로그램 칸 — 내 것(지난 기록 전 포함) 먼저, 다른 코치님 것은 오늘 · 앞으로만, 날짜 · 시간 순", () => {
    const today = "2026-11-13";
    const rows = [
      item({ id: "mine-later", mine: true, event_date: "2026-11-14", data: { stage: "plan", slot: "19:00" } }),
      item({ id: "mine-past", mine: true, event_date: "2026-11-12", data: { stage: "plan" } }),
      item({ id: "mine-today-pm", mine: true, data: { stage: "plan", slot: "20:00" } }),
      item({ id: "mine-today-am", mine: true, data: { stage: "plan", slot: "07:00" } }),
      item({ id: "other-past", event_date: "2026-11-12", data: { stage: "plan" } }),
      item({ id: "other-today", data: { stage: "plan", slot: "19:00" } }),
      item({ id: "log", mine: true }),
    ];
    const { mine, others } = plansForBoard(rows, today);
    expect(mine.map((i) => i.id)).toEqual(["mine-past", "mine-today-am", "mine-today-pm", "mine-later"]);
    expect(others.map((i) => i.id)).toEqual(["other-today"]);
    expect(planOverdue(rows[1], today)).toBe(true);
    expect(planOverdue(rows[2], today)).toBe(false);
  });

  it("대표님 · 지점장님 점 — 오늘 다른 코치님 수업안 중 피드백이 없는 것만", () => {
    const today = "2026-11-13";
    const rows = [
      item({ id: "a", data: { stage: "plan" } }),
      item({ id: "b", data: { stage: "plan" }, comments: 1 }),
      item({ id: "c", data: { stage: "plan" }, mine: true }),
      item({ id: "d", data: { stage: "plan" }, event_date: "2026-11-14" }),
      item({ id: "e" }),
    ];
    expect(plansAwaitingFeedback(rows, today)).toBe(1);
  });
});
