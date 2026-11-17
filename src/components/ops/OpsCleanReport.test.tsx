import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// 화면 조각만 그린다 — 서버는 쓰지 않는다
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { toast } from "sonner";
import OpsCleanReport, { type CleanReportActions } from "./OpsCleanReport";
import OpsCleanSheet from "./OpsCleanSheet";
import { openIssues, slotItems, type CleanReport } from "@/lib/opsCleanReport";
import { applyReportDemo, buildCleanReportSample } from "@/lib/opsCleanReportSample";
import { buildCleanSample } from "@/lib/opsCleanSample";

const TUE = "2026-11-17";

const Harness = ({ onOpenDay, spy }: { onOpenDay?: (d: string, s: string) => void; spy?: (r: CleanReport) => void }) => {
  const [rep, setRep] = useState<CleanReport>(() => buildCleanReportSample(TUE, "12:30"));
  const [weeks, setWeeks] = useState(2);
  const apply = (a: Parameters<typeof applyReportDemo>[1]) =>
    setRep((r) => {
      const next = applyReportDemo(r, a, "2026-11-17T04:00:00Z");
      spy?.(next);
      return next;
    });
  const actions: CleanReportActions = {
    resolve: (itemId, date, note, done) => {
      apply({ type: "resolve", itemId, date, note });
      done();
    },
    saveItem: (payload, done) => {
      apply({ type: "item", payload });
      done();
    },
    order: (slotId, ids) => apply({ type: "order", slotId, ids }),
    saveSlot: (payload, done) => {
      apply({ type: "slot", payload });
      done();
    },
    busy: false,
  };
  return <OpsCleanReport rep={rep} weeks={weeks} onWeeks={setWeeks} onClose={() => {}} onOpenDay={onOpenDay} actions={actions} demo />;
};

beforeEach(() => {
  vi.mocked(toast).mockClear();
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
});

describe("청소 현황", () => {
  it("주마다 칸 · 문제 · 항목별 걸린 시간", () => {
    render(<Harness />);
    expect(screen.getByRole("dialog", { name: "청소 현황" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "이번 주 청소" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "지난주 청소" })).toBeTruthy();
    const issues = screen.getByRole("region", { name: "청소 문제" });
    expect(within(issues).getAllByRole("button", { name: "처리했어요" })).toHaveLength(2);
    expect(within(issues).getByRole("button", { name: /처리한 문제 1/ })).toBeTruthy();
    const times = screen.getByRole("region", { name: "항목별 걸린 시간" });
    expect(within(times).getAllByText("목표보다 오래").length).toBeGreaterThan(0);
  });

  it("칸을 누르면 7일 안은 그날 목록 · 그 앞은 한 줄", () => {
    const open = vi.fn();
    render(<Harness onOpenDay={open} />);
    fireEvent.click(screen.getAllByRole("button", { name: /^11\/16\(월\) 오픈/ })[0]);
    expect(open).toHaveBeenCalledWith("2026-11-16", "open");
    fireEvent.click(screen.getByRole("button", { name: "4주" }));
    fireEvent.click(screen.getAllByRole("button", { name: /^10\/27\(화\) 오픈/ })[0]);
    expect(open).toHaveBeenCalledTimes(1);
    expect(vi.mocked(toast).mock.calls[0][0]).toMatch(/^10\/27\(화\) 오픈 · 완료/);
  });

  it("문제 처리 → 처리한 문제로", () => {
    let last: CleanReport | null = null;
    render(<Harness spy={(r) => (last = r)} />);
    const issues = screen.getByRole("region", { name: "청소 문제" });
    fireEvent.click(within(issues).getAllByRole("button", { name: "처리했어요" })[0]);
    const sheet = screen.getByRole("dialog", { name: "문제 처리" });
    fireEvent.click(within(sheet).getByRole("button", { name: "고쳤어요" }));
    fireEvent.click(within(sheet).getAllByRole("button", { name: "처리했어요" }).pop()!);
    expect(openIssues(last!)).toHaveLength(1);
    expect(last!.issues.some((i) => i.resolveNote === "고쳤어요")).toBe(true);
  });

  it("고치기 — 항목 더하기 · 검사 말 · 위아래 · 시간대 알림 끄기", async () => {
    let last: CleanReport | null = null;
    render(<Harness spy={(r) => (last = r)} />);
    fireEvent.click(screen.getAllByRole("button", { name: "항목 · 시간대 고치기" })[0]);
    const edit = await screen.findByRole("dialog", { name: "청소 항목 고치기" });
    // 요일마다 목표 분
    expect(within(edit).getByText("월 40분")).toBeTruthy();
    // 항목 더하기 — 이름 없이 → 검사 말
    fireEvent.click(within(edit).getByRole("button", { name: "항목 더하기" }));
    const add = screen.getByRole("dialog", { name: "항목 더하기" });
    fireEvent.click(within(add).getByRole("button", { name: "더하기" }));
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("항목 이름을 적어 주세요");
    fireEvent.change(within(add).getByLabelText("항목 이름"), { target: { value: "거울 닦기" } });
    fireEvent.click(within(add).getByRole("button", { name: "여자 구역" }));
    fireEvent.click(within(add).getByRole("button", { name: "더하기" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "항목 더하기" })).toBeNull());
    const open = last!.slots[0];
    const items = slotItems(last!, open.id);
    const k = items.findIndex((i) => i.title === "거울 닦기");
    expect(items[k - 1].zone).toBe("women");
    // 위로 — 여자 구역 안에서
    fireEvent.click(within(edit).getByRole("button", { name: "거울 닦기 위로" }));
    const moved = slotItems(last!, open.id);
    expect(moved.findIndex((i) => i.title === "거울 닦기")).toBe(k - 1);
    // 시간대 — 미완료 알림 끄기
    fireEvent.click(within(edit).getByRole("button", { name: /50분 안에/ }));
    const ss = screen.getByRole("dialog", { name: "시간대 고치기" });
    fireEvent.click(within(ss).getByRole("switch", { name: /안 끝나면 대표님 · 지점장님께 알림/ }));
    fireEvent.click(within(ss).getByRole("button", { name: "저장" }));
    expect(last!.slots[0].alertMin).toBeNull();
  });
});

describe("청소 시트 — 현황 단추 · 처리됨", () => {
  it("관리자에게 현황 단추 · 처리한 문제는 '처리됨'", () => {
    const day = buildCleanSample(TUE, "manager");
    const slot = day.slots[0];
    const issueItem = slot.items[3];
    const withIssue = {
      ...day,
      slots: [{ ...slot, items: slot.items.map((i) => (i.id === issueItem.id ? { ...i, state: "issue" as const, note: "휴지 없음", resolved: true, resolveNote: "채웠어요" } : i)) }, ...day.slots.slice(1)],
    };
    const report = vi.fn();
    render(
      <OpsCleanSheet
        day={withIssue}
        slotKey={slot.slot}
        onSlot={() => {}}
        onClose={() => {}}
        actions={{ check: vi.fn(), start: vi.fn(), finish: vi.fn(), busy: false }}
        onReport={report}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "청소 현황" }));
    expect(report).toHaveBeenCalled();
    expect(screen.getByText(/휴지 없음 · 처리됨 · 채웠어요/)).toBeTruthy();
  });
});
