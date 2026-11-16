import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OpsCleanEntry } from "./OpsClean";

const DAY = "2026-11-17";
type Row = { id: string; zone: string; title: string; min: number; state: string | null; note: string | null };
type Run = { started_at: string | null; finished_at: string | null; note: string | null; finished_by_name: string | null } | null;

/** 서버가 주는 모양 그대로(ops_clean_day) — 가짜 서버가 들고 있는 하루 */
const makeServer = (opts: { manage?: boolean; mine?: boolean } = {}) => {
  const rows: Row[] = [
    { id: "i1", zone: "start", title: "창문 열기 · 로봇청소기 켜기", min: 2, state: null, note: null },
    { id: "i2", zone: "women", title: "여자 샤워실", min: 2, state: null, note: null },
    { id: "i3", zone: "ring", title: "링 땀 자국 닦기", min: 4, state: null, note: null },
  ];
  let run: Run = null;
  const calls: Array<[string, Record<string, unknown> | undefined]> = [];
  let failCheck: string | null = null;
  const day = () => ({
    on: true,
    branch: "예시 지점",
    branches: [{ branch: "예시 지점", manage: !!opts.manage, mine: true }],
    manage: !!opts.manage,
    me: "u1",
    date: DAY,
    today: DAY,
    closed: false,
    slots: [
      {
        slot: "open",
        label: "오픈",
        time: "11:00",
        budget: 50,
        mine: opts.mine ?? true,
        people: ["예시 코치 A"],
        run,
        items: rows.map((r) => ({
          id: r.id,
          zone: r.zone,
          title: r.title,
          min: r.min,
          done_text: "끝난 상태 글",
          how: "방법 글",
          caution: null,
          mission: false,
          monthly: false,
          state: r.state,
          note: r.note,
          at: r.state ? `${DAY}T02:10:00+00:00` : null,
          by_name: r.state ? "예시 코치 A" : null,
        })),
        handover: [{ kind: "sum", date: "2026-11-16", slot: "close", label: "마감", time: "22:50", done: 5, due: 5, finished: true }],
      },
    ],
  });
  const rpc = (name: string, args?: Record<string, unknown>) => {
    calls.push([name, args]);
    if (name === "ops_clean_day") return Promise.resolve({ data: day(), error: null });
    if (name === "ops_clean_check") {
      if (failCheck) return Promise.resolve({ data: null, error: { message: failCheck } });
      const r = rows.find((x) => x.id === args?.p_item);
      if (r) {
        r.state = (args?.p_state as string) || null;
        r.note = r.state === "hold" || r.state === "issue" ? ((args?.p_note as string | null) ?? null) : null;
        if (r.state && !run) run = { started_at: `${DAY}T02:01:00+00:00`, finished_at: null, note: null, finished_by_name: null };
      }
      return Promise.resolve({ data: null, error: null });
    }
    if (name === "ops_clean_start") {
      run = run ?? { started_at: `${DAY}T02:01:00+00:00`, finished_at: null, note: null, finished_by_name: null };
      return Promise.resolve({ data: null, error: null });
    }
    if (name === "ops_clean_finish") {
      run = { started_at: run?.started_at ?? `${DAY}T02:01:00+00:00`, finished_at: `${DAY}T02:41:00+00:00`, note: (args?.p_note as string | null) ?? null, finished_by_name: "예시 코치 A" };
      return Promise.resolve({ data: null, error: null });
    }
    return Promise.resolve({ data: null, error: { code: "PGRST202", message: "Could not find the function" } });
  };
  return { rpc, calls, rows, setFail: (m: string | null) => (failCheck = m), of: (name: string) => calls.filter((c) => c[0] === name) };
};

const Where = () => {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname + loc.search}</p>;
};
const wrap = (ui: ReactNode, at = "/office?tab=work") => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[at]}>
        {ui}
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};
const use = (rpc: (name: string, args?: Record<string, unknown>) => unknown) => vi.mocked(supabase.rpc).mockImplementation(rpc as never);
const box = (id: string) => within(document.getElementById(`clean-item-${id}`) as HTMLElement).getByRole("checkbox");

beforeEach(() => {
  vi.mocked(supabase.rpc).mockReset();
  vi.mocked(toast).mockClear();
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
});

describe("오늘 청소 입구 — 서버에 이어진 화면", () => {
  it("띠 → 누르면 전체 화면 → 체크는 서버에 그 항목 · 그날 · 상태로 간다", async () => {
    const sv = makeServer();
    use(sv.rpc);
    wrap(<OpsCleanEntry enabled tab="office" />);
    fireEvent.click(await screen.findByRole("button", { name: "오픈 11:00 청소 열기" }));
    expect(await screen.findByRole("dialog", { name: "오늘 청소" })).toBeTruthy();
    expect(sv.of("ops_clean_day")[0][1]).toEqual({ p_branch: null, p_date: null });
    expect(screen.getByText("어젯밤 마감 5/5 · 끝")).toBeTruthy();

    fireEvent.click(box("i1"));
    // 서버 답을 기다리지 않고 화면에 먼저
    await waitFor(() => expect(box("i1").getAttribute("aria-checked")).toBe("true"));
    await waitFor(() => expect(sv.of("ops_clean_check")).toHaveLength(1));
    expect(sv.of("ops_clean_check")[0][1]).toEqual({ p_item: "i1", p_date: DAY, p_state: "done", p_note: null });
    // 다시 읽은 뒤에도 그대로 · 이름은 서버 것
    await waitFor(() => expect(within(document.getElementById("clean-item-i1") as HTMLElement).getByText(/예시 코치 A/)).toBeTruthy());

    // 풀기는 빈 상태로
    fireEvent.click(box("i1"));
    await waitFor(() => expect(sv.of("ops_clean_check")).toHaveLength(2));
    expect(sv.of("ops_clean_check")[1][1]).toEqual({ p_item: "i1", p_date: DAY, p_state: "", p_note: null });
  });

  it("보류 · 시작 · 끝내기 — 지점 · 날짜 · 시간대가 함께 간다", async () => {
    const sv = makeServer();
    use(sv.rpc);
    wrap(<OpsCleanEntry enabled tab="work" />);
    fireEvent.click(await screen.findByRole("button", { name: "오픈 11:00 청소 열기" }));
    fireEvent.click(await screen.findByRole("button", { name: "청소 시작" }));
    await waitFor(() => expect(sv.of("ops_clean_start")).toHaveLength(1));
    expect(sv.of("ops_clean_start")[0][1]).toEqual({ p_branch: "예시 지점", p_date: DAY, p_slot: "open" });

    fireEvent.click(screen.getByRole("button", { name: "여자 샤워실 — 방법 · 보류 · 문제" }));
    fireEvent.click(screen.getByRole("button", { name: "보류" }));
    fireEvent.click(screen.getByRole("button", { name: "회원 사용 중" }));
    await waitFor(() => expect(sv.of("ops_clean_check")).toHaveLength(1));
    expect(sv.of("ops_clean_check")[0][1]).toEqual({ p_item: "i2", p_date: DAY, p_state: "hold", p_note: "회원 사용 중" });

    fireEvent.click(box("i1"));
    fireEvent.click(box("i3"));
    fireEvent.click(await screen.findByRole("button", { name: "청소 끝내기" }));
    fireEvent.change(screen.getByLabelText("다음 근무자에게 한마디"), { target: { value: "샴푸 채워 주세요" } });
    fireEvent.click(screen.getByRole("button", { name: "끝내기" }));
    await waitFor(() => expect(sv.of("ops_clean_finish")).toHaveLength(1));
    expect(sv.of("ops_clean_finish")[0][1]).toEqual({ p_branch: "예시 지점", p_date: DAY, p_slot: "open", p_note: "샴푸 채워 주세요" });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("청소를 끝냈어요"));
    expect(await screen.findByText("청소 끝")).toBeTruthy();
  });

  it("서버가 막으면 그 말을 보여 주고 체크를 되돌린다", async () => {
    const sv = makeServer();
    sv.setFail("그 시간 근무자만 체크할 수 있어요");
    use(sv.rpc);
    wrap(<OpsCleanEntry enabled tab="work" />);
    fireEvent.click(await screen.findByRole("button", { name: "오픈 11:00 청소 열기" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "링 땀 자국 닦기" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("그 시간 근무자만 체크할 수 있어요"));
    await waitFor(() => expect(box("i3").getAttribute("aria-checked")).toBe("false"));
  });

  it("링크 /office?clean=open — 읽은 뒤 바로 열고 주소에서 지운다", async () => {
    const sv = makeServer();
    use(sv.rpc);
    wrap(<OpsCleanEntry enabled tab="office" />, "/office?clean=open&cd=2026-11-10");
    expect(await screen.findByRole("dialog", { name: "오늘 청소" })).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/office"));
    // 코치님은 오늘 것만 — 날짜를 넘기는 단추가 없고 지난 날을 묻지도 않는다
    expect(screen.queryByRole("button", { name: "앞 날" })).toBeNull();
    expect(sv.of("ops_clean_day").every((c) => c[1]?.p_date === null)).toBe(true);
  });

  it("관리자 — 알림 링크의 날짜로 열고 날짜를 넘길 수 있다 · 근무 · 일정 탭이 아니면 띠는 없다", async () => {
    const sv = makeServer({ manage: true, mine: false });
    use(sv.rpc);
    wrap(<OpsCleanEntry enabled tab="strategy" />, "/office?tab=strategy&clean=open&cd=2026-11-14");
    expect(await screen.findByRole("dialog")).toBeTruthy();
    await waitFor(() => expect(sv.of("ops_clean_day").some((c) => c[1]?.p_date === "2026-11-14")).toBe(true));
    expect(screen.getByRole("button", { name: "앞 날" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "오픈 11:00 청소 열기" })).toBeNull();
    expect(screen.getByTestId("where").textContent).toBe("/office?tab=strategy");
  });

  it("서버에 함수가 없거나 · 볼 청소가 없는 계정이면 아무것도 그리지 않는다", async () => {
    use(() => Promise.resolve({ data: null, error: { code: "PGRST202", message: "Could not find the function public.ops_clean_day" } }));
    const a = wrap(<OpsCleanEntry enabled tab="work" />, "/office?tab=work&clean=1");
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/office?tab=work"));
    expect(screen.queryByText("오늘 청소")).toBeNull();
    a.unmount();

    use(() => Promise.resolve({ data: { on: false }, error: null }));
    wrap(<OpsCleanEntry enabled tab="work" />);
    await waitFor(() => expect(vi.mocked(supabase.rpc)).toHaveBeenCalled());
    expect(screen.queryByText("오늘 청소")).toBeNull();
  });

  it("아직 누구인지 모를 때는 서버를 부르지 않는다", () => {
    use(() => Promise.resolve({ data: null, error: null }));
    wrap(<OpsCleanEntry enabled={false} tab="work" />);
    expect(vi.mocked(supabase.rpc)).not.toHaveBeenCalled();
  });
});

describe("오늘 청소 예시 — /office?cleandemo=", () => {
  it("서버를 부르지 않고 · 코치 ↔ 관리자 화면을 바꿔 볼 수 있다", async () => {
    use(() => Promise.resolve({ data: null, error: null }));
    wrap(<OpsCleanEntry enabled={false} tab="office" />, "/office?cleandemo=coach");
    expect(screen.getByText("오늘 청소 예시")).toBeTruthy();
    expect(screen.getAllByText("시작")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "관리자 화면" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/office?cleandemo=manager"));
    expect(screen.getByText("· 예시 코치 A")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /저녁 19:50 청소 열기/ }));
    expect(await screen.findByRole("dialog", { name: "오늘 청소" })).toBeTruthy();
    expect(screen.getByText("예시")).toBeTruthy();
    expect(vi.mocked(supabase.rpc)).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    fireEvent.click(screen.getByRole("button", { name: "예시 끄기" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/office"));
  });
});
