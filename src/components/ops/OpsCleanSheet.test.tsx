import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// 화면 조각만 그린다 — 서버는 쓰지 않는다
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { toast } from "sonner";
import OpsCleanSheet, { type CleanSheetActions } from "./OpsCleanSheet";
import { CleanStrip } from "./OpsClean";
import { slotCounts, type CleanDay } from "@/lib/opsClean";
import { applyCleanDemo, buildCleanSample, type CleanDemoWho } from "@/lib/opsCleanSample";

const TUE = "2026-11-17";
const row = (code: string, slot = "open") => document.getElementById(`clean-item-demo-${slot}-${code}`) as HTMLElement;
const box = (code: string, slot = "open") => within(row(code, slot)).getByRole("checkbox");

/** 예시 자료로 눌러 보는 틀 — 예시 화면(OpsClean DemoEntry)과 같은 방식 */
const Harness = ({ who, slot = "open", spy }: { who: CleanDemoWho; slot?: string; spy?: Partial<CleanSheetActions> }) => {
  const [day, setDay] = useState<CleanDay>(() => buildCleanSample(TUE, who));
  const [key, setKey] = useState(slot);
  const actions: CleanSheetActions = {
    check: (itemId, state, note, at) => {
      spy?.check?.(itemId, state, note, at);
      setDay((d) => applyCleanDemo(d, { type: "check", itemId, state, note }, at));
    },
    start: (s, at) => {
      spy?.start?.(s, at);
      setDay((d) => applyCleanDemo(d, { type: "start", slot: s }, at));
    },
    finish: (s, note, at, done) => {
      spy?.finish?.(s, note, at, done);
      setDay((d) => applyCleanDemo(d, { type: "finish", slot: s, note }, at));
      done();
    },
    busy: false,
  };
  return <OpsCleanSheet day={day} slotKey={key} onSlot={setKey} onClose={() => {}} actions={actions} demo />;
};

beforeEach(() => {
  vi.mocked(toast).mockClear();
  vi.mocked(toast.error).mockClear();
});

describe("오늘 청소 — 코치 화면", () => {
  it("시작 전 — 끝낼 시각 · 청소 시작 · 인수인계 · 동선 순서, '전체 완료' 단추는 없다", () => {
    const start = vi.fn();
    render(<Harness who="coach" spy={{ start }} />);
    expect(screen.getByText("끝낼 시각 11:50")).toBeTruthy();
    expect(screen.getByText("인수인계")).toBeTruthy();
    expect(screen.getByText("어젯밤 마감 4/5 · 끝")).toBeTruthy();
    expect(screen.getByText("화요일 미션")).toBeTruthy();
    expect(screen.getAllByRole("checkbox")).toHaveLength(13);
    const heads = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(heads).toEqual(["인수인계", "시작", "화요일 미션", "여자 구역", "남자 구역", "링", "입구", "홀", "마무리"]);
    // 한 번에 다 끝내는 단추는 없다 · 시작 전에는 아래 단추도 없다
    expect(screen.queryByRole("button", { name: /전체 완료|모두 완료|한 번에/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "청소 끝내기" })).toBeNull();
    expect(screen.queryByRole("button", { name: /남았어요/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "청소 시작" }));
    expect(start).toHaveBeenCalledWith("open", expect.any(String));
    expect(screen.queryByRole("button", { name: "청소 시작" })).toBeNull();
    expect(screen.getByRole("button", { name: /아직 13개 남았어요/ })).toBeTruthy();
  });

  it("체크 — 누르면 완료 · 다시 누르면 풀기 (처음 체크가 시작)", () => {
    const check = vi.fn();
    render(<Harness who="coach" spy={{ check }} />);
    fireEvent.click(box("ring"));
    expect(check).toHaveBeenLastCalledWith("demo-open-ring", "done", null, expect.any(String));
    expect(box("ring").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("button", { name: /아직 12개 남았어요/ })).toBeTruthy();
    fireEvent.click(box("ring"));
    expect(check).toHaveBeenLastCalledWith("demo-open-ring", null, null, expect.any(String));
    expect(box("ring").getAttribute("aria-checked")).toBe("false");
  });

  it("보류 — › → 보류 → 이유를 누르면 바로 남는다", () => {
    const check = vi.fn();
    render(<Harness who="coach" spy={{ check }} />);
    fireEvent.click(screen.getByRole("button", { name: "여자 샤워실 — 방법 · 보류 · 문제" }));
    expect(screen.getByText("끝난 상태")).toBeTruthy();
    expect(screen.getByText("배수구 거름망 → 바닥 헹구기 → 샴푸·바디워시 확인 → 물기 밀기")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "보류" }));
    fireEvent.click(screen.getByRole("button", { name: "회원 사용 중" }));
    expect(check).toHaveBeenLastCalledWith("demo-open-women_shower", "hold", "회원 사용 중", expect.any(String));
    expect(within(row("women_shower")).getByText("보류 · 회원 사용 중")).toBeTruthy();
    expect(box("women_shower").getAttribute("aria-checked")).toBe("false");
  });

  it("문제 — 한 줄이 없으면 막고, 적으면 남는다", () => {
    const check = vi.fn();
    render(<Harness who="coach" spy={{ check }} />);
    fireEvent.click(screen.getByRole("button", { name: "여자 화장실 — 방법 · 보류 · 문제" }));
    fireEvent.click(screen.getByRole("button", { name: "문제" }));
    fireEvent.click(screen.getByRole("button", { name: "문제 알리기" }));
    expect(toast.error).toHaveBeenCalledWith("무엇이 문제인지 한 줄 적어 주세요");
    expect(check).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("문제 내용"), { target: { value: "  휴지가   떨어졌어요 " } });
    fireEvent.click(screen.getByRole("button", { name: "문제 알리기" }));
    expect(check).toHaveBeenLastCalledWith("demo-open-women_toilet", "issue", "휴지가 떨어졌어요", expect.any(String));
    expect(within(row("women_toilet")).getByText("문제 · 휴지가 떨어졌어요")).toBeTruthy();
  });

  it("끝내기 — 남은 것이 있으면 알려 주고, 모두 정하면 걸린 시간 · 한마디 → 끝", () => {
    const finish = vi.fn();
    render(<Harness who="coach" slot="evening" spy={{ finish }} />);
    fireEvent.click(box("laundry", "evening"));
    fireEvent.click(screen.getByRole("button", { name: /아직 1개 남았어요/ }));
    expect(toast).toHaveBeenCalledWith("아직 체크하지 않은 항목이 1개 있어요");
    expect(finish).not.toHaveBeenCalled();
    fireEvent.click(box("bins", "evening"));
    fireEvent.click(screen.getByRole("button", { name: "청소 끝내기" }));
    expect(screen.getByText("걸린 시간")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("다음 근무자에게 한마디"), { target: { value: "종이컵 한 줄 남았어요" } });
    fireEvent.click(screen.getByRole("button", { name: "끝내기" }));
    expect(finish).toHaveBeenCalledWith("evening", "종이컵 한 줄 남았어요", expect.any(String), expect.any(Function));
    const hero = within(screen.getByLabelText("남은 시간과 진행"));
    expect(hero.getByText("청소 끝")).toBeTruthy();
    expect(hero.getByText("종이컵 한 줄 남았어요")).toBeTruthy();
    expect(screen.getByRole("button", { name: "한마디 남기기 · 고치기" })).toBeTruthy();
  });

  it("시간대 칩 — 누르면 그 시간대로", () => {
    render(<Harness who="coach" />);
    fireEvent.click(screen.getByRole("tab", { name: /마감/ }));
    expect(screen.getByText("끝낼 시각 23:00")).toBeTruthy();
    expect(screen.getAllByRole("checkbox")).toHaveLength(5);
  });
});

describe("오늘 청소 — 관리자 화면", () => {
  it("끝난 오픈 — 걸린 시간 · 보류 · 한마디 · 시작 단추 없음", () => {
    render(<Harness who="manager" />);
    expect(screen.getByText("청소 끝")).toBeTruthy();
    expect(screen.getByText("47")).toBeTruthy();
    expect(screen.getByText("완료 12 · 보류 1 · 예시 코치 A · 11:48")).toBeTruthy();
    expect(screen.getByText("여자 샤워실은 회원이 계셔서 보류했어요")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "청소 시작" })).toBeNull();
    expect(screen.getByText("대신 체크하면 내 이름으로 남아요")).toBeTruthy();
  });

  it("시작 전인 마감 — 관리자에게는 시작 단추가 없다(그 시간대 근무자만)", () => {
    render(<Harness who="manager" slot="close" />);
    expect(screen.getByText("끝낼 시각 23:00")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "청소 시작" })).toBeNull();
    // 뒤 시간대는 앞 시간대가 남긴 것을 본다
    expect(screen.getByText("오늘 저녁 1/2")).toBeTruthy();
    expect(screen.getByText("오늘 오픈 12/13 · 끝")).toBeTruthy();
  });
});

describe("운영본부 띠", () => {
  const coach = buildCleanSample(TUE, "coach");
  const manager = buildCleanSample(TUE, "manager");

  it("코치 — 내 차례(안 끝난 것) 한 줄씩 · 누르면 그 시간대", () => {
    const onOpen = vi.fn();
    render(<CleanStrip day={coach} wide={false} onOpen={onOpen} />);
    expect(screen.getByText("오늘 청소")).toBeTruthy();
    expect(screen.getAllByText("시작")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "저녁 19:50 청소 열기" }));
    expect(onOpen).toHaveBeenCalledWith("evening");
  });

  it("코치 — 다 끝낸 시간대는 다른 탭에서 빠지고 근무 · 일정 탭에서는 남는다", () => {
    let d = coach;
    for (const s of d.slots) {
      for (const i of s.items) d = applyCleanDemo(d, { type: "check", itemId: i.id, state: "done", note: null }, "2026-11-17T02:10:00.000Z");
      d = applyCleanDemo(d, { type: "finish", slot: s.slot, note: null }, "2026-11-17T02:40:00.000Z");
    }
    expect(d.slots.every((s) => slotCounts(s).left === 0)).toBe(true);
    const { container, rerender } = render(<CleanStrip day={d} wide={false} onOpen={() => {}} />);
    expect(container.textContent).toBe("");
    rerender(<CleanStrip day={d} wide onOpen={() => {}} />);
    expect(screen.getAllByText(/^끝 · \d+분$/)).toHaveLength(3);
  });

  it("관리자 — 근무 · 일정 탭에서 세 시간대 · 누가 · 어디까지", () => {
    const { container, rerender } = render(<CleanStrip day={manager} wide={false} onOpen={() => {}} />);
    expect(container.textContent).toBe("");
    rerender(<CleanStrip day={manager} wide onOpen={() => {}} />);
    expect(screen.getByText("끝 · 47분")).toBeTruthy();
    expect(screen.getByText("1 / 2")).toBeTruthy();
    expect(screen.getByText("시작 전")).toBeTruthy();
    expect(screen.getByText("· 예시 코치 A")).toBeTruthy();
    expect(screen.getByText("완료 12 · 보류 1")).toBeTruthy();
  });

  it("관리자 — 청소가 없는 날은 지난 기록으로 가는 한 줄", () => {
    const onOpen = vi.fn();
    render(<CleanStrip day={{ ...manager, slots: [], closed: true }} wide onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /오늘은 휴관일이에요/ }));
    expect(onOpen).toHaveBeenCalledWith(null);
  });
});
