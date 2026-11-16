import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ value: { user: { id: "u1" } as { id: string } | null, profile: { is_staff: true } as Record<string, unknown> | null, realRole: "member" as string | null } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth.value }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));

import { supabase } from "@/integrations/supabase/client";
import HomeCleanCard from "./HomeCleanCard";

const DAY = "2026-11-17";
const slot = (key: string, label: string, time: string, over: Record<string, unknown> = {}) => ({
  slot: key,
  label,
  time,
  budget: key === "open" ? 50 : 10,
  mine: true,
  people: [],
  run: null,
  items: [
    { id: `${key}-1`, zone: "hall", title: "휴지통 비우기", min: 2, state: null },
    { id: `${key}-2`, zone: "mission", title: "거울 닦기", min: 12, mission: true, state: null },
  ],
  handover: [],
  ...over,
});
const day = (slots: unknown[], over: Record<string, unknown> = {}) => ({ on: true, branch: "예시 지점", branches: [], manage: false, me: "u1", date: DAY, today: DAY, closed: false, days: [1, 2, 3, 4, 5], slots, ...over });

const Where = () => <p data-testid="where">{useLocation().pathname + useLocation().search}</p>;
const wrap = (ui: ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/home"]}>
        {ui}
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
const answer = (data: unknown, error: unknown = null) => vi.mocked(supabase.rpc).mockImplementation((() => Promise.resolve({ data, error })) as never);

beforeEach(() => {
  vi.mocked(supabase.rpc).mockReset();
  auth.value = { user: { id: "u1" }, profile: { is_staff: true }, realRole: "member" };
});

describe("홈 「오늘 청소」 한 줄", () => {
  it("오늘 내 차례가 남은 코치님 — 시간대 · 개수 · 목표 분 · 미션, 누르면 운영본부에서 그 화면", async () => {
    answer(day([slot("open", "오픈", "11:00")]));
    wrap(<HomeCleanCard />);
    expect(await screen.findByText("오늘 청소 · 오픈 11:00")).toBeTruthy();
    expect(screen.getByText("2개 · 14분 · 미션 거울 닦기")).toBeTruthy();
    expect(screen.getByText("시작")).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByTestId("where").textContent).toBe("/office?clean=open");
  });

  it("하던 것이 있으면 그것부터 — 어디까지 · 끝낼 시각", async () => {
    const doing = slot("evening", "저녁", "19:50", {
      run: { started_at: `${DAY}T10:51:00+00:00`, finished_at: null, note: null, finished_by_name: null },
      items: [
        { id: "e1", zone: "laundry", title: "빨래통 비우기", min: 4, state: "done" },
        { id: "e2", zone: "hall", title: "종이컵 보충", min: 1, state: null },
      ],
    });
    answer(day([slot("open", "오픈", "11:00"), doing]));
    wrap(<HomeCleanCard />);
    expect(await screen.findByText("오늘 청소 · 저녁 19:50")).toBeTruthy();
    expect(screen.getByText("1 / 2 · 20:00까지")).toBeTruthy();
    expect(screen.getByText("이어서")).toBeTruthy();
  });

  it("다 끝냈거나 · 내 차례가 아니거나 · 휴관일이면 안 그린다", async () => {
    const finished = slot("open", "오픈", "11:00", { run: { started_at: `${DAY}T02:01:00+00:00`, finished_at: `${DAY}T02:48:00+00:00`, note: null, finished_by_name: null } });
    for (const d of [day([finished]), day([slot("open", "오픈", "11:00", { mine: false })], { manage: true }), day([slot("open", "오픈", "11:00")], { closed: true }), { on: false }]) {
      answer(d);
      const r = wrap(<HomeCleanCard />);
      await waitFor(() => expect(vi.mocked(supabase.rpc)).toHaveBeenCalled());
      await waitFor(() => expect(screen.queryByText(/오늘 청소/)).toBeNull());
      r.unmount();
      vi.mocked(supabase.rpc).mockReset();
    }
  });

  it("서버에 함수가 없으면 안 그린다 · 회원은 서버를 부르지도 않는다", async () => {
    answer(null, { code: "PGRST202", message: "Could not find the function public.ops_clean_day" });
    const r = wrap(<HomeCleanCard />);
    await waitFor(() => expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith("ops_clean_day", { p_branch: null, p_date: null }));
    expect(screen.queryByText(/오늘 청소/)).toBeNull();
    r.unmount();

    vi.mocked(supabase.rpc).mockReset();
    auth.value = { user: { id: "m1" }, profile: { is_staff: false }, realRole: "member" };
    wrap(<HomeCleanCard />);
    expect(vi.mocked(supabase.rpc)).not.toHaveBeenCalled();
    expect(screen.queryByText(/오늘 청소/)).toBeNull();
  });
});
