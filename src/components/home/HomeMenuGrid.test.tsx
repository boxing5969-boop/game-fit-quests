import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ role: "super_admin" as string }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u-test" }, profile: { diet_program_enabled: false }, role: auth.role }),
}));
vi.mock("@/hooks/useDm", () => ({
  useDmSummary: () => ({ data: { badge: 0, enabled: true, kind: auth.role === "member" ? "member" : "hq" } }),
}));
vi.mock("@/services/strategyService", () => ({ useStrategyBadge: () => ({ data: 0 }) }));
vi.mock("@/services/officeService", () => ({ useOfficeMe: () => ({ data: { offices: [] } }) }));
// DB 함수가 아직 없는 상태 — 이 기기에만 저장되어야 한다
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST202", message: "not found" } }) },
}));
vi.mock("sonner", () => {
  const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
  return { toast };
});

import HomeMenuGrid from "./HomeMenuGrid";

const renderGrid = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/home"]}>
        <HomeMenuGrid />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const saved = () => JSON.parse(localStorage.getItem("153menu:layout:u-test") ?? "null");

beforeEach(() => {
  localStorage.clear();
  auth.role = "super_admin";
});
afterEach(() => {
  document.body.removeAttribute("data-menu-dragging");
});

describe("전체 메뉴 편집 — 아이폰처럼 옮기고 빼고 바로가기 넣기", () => {
  it("처음에는 기본 메뉴 그대로 · 편집을 누르면 빼기 단추와 '바로가기' 칸", () => {
    renderGrid();
    expect(screen.getByText("로드맵")).toBeInTheDocument();
    expect(screen.queryByLabelText("로드맵 빼기")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "편집" }));
    expect(screen.getByLabelText("로드맵 빼기")).toBeInTheDocument();
    expect(screen.getByText("바로가기", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "완료" })).toBeInTheDocument();
  });

  it("빼면 칸이 없어지고 이 기기에 저장 · 처음대로로 돌아온다", async () => {
    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: "편집" }));
    fireEvent.click(screen.getByLabelText("로드맵 빼기"));
    await waitFor(() => expect(screen.queryByText("로드맵")).toBeNull());
    const layout = saved();
    expect(layout?.entries?.some((e: { id?: string }) => e.id === "/rank-up")).toBe(false);
    expect(layout?.known).toContain("/rank-up");
    fireEvent.click(screen.getByRole("button", { name: /처음대로/ }));
    await waitFor(() => expect(screen.getByText("로드맵")).toBeInTheDocument());
    expect(saved()?.entries).toBeUndefined();
  });

  it("내 정보 폴더의 '추가'로 라이브보드를 넣으면 폴더 안에 바로 보인다", async () => {
    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: /^내 정보 —/ }));
    const panel = await screen.findByRole("group", { name: "내 정보" });
    fireEvent.click(within(panel).getByText("추가"));
    const dialog = await screen.findByRole("dialog", { name: "바로가기 추가" });
    fireEvent.change(within(dialog).getByLabelText("넣을 화면 찾기"), { target: { value: "라이브" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /라이브보드 — 내 정보에 넣기/ }));
    await waitFor(() =>
      expect(within(screen.getByRole("group", { name: "내 정보" })).getByText("라이브보드")).toBeInTheDocument(),
    );
    const me = saved()?.entries?.find((e: { folder?: string }) => e.folder === "me");
    expect(me?.items?.map((i: { id: string }) => i.id)).toContain("/manager/live-board");
  });

  it("회원에게는 운영진 화면이 바로가기 목록에도 없다", async () => {
    auth.role = "member";
    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: /^내 정보 —/ }));
    const panel = await screen.findByRole("group", { name: "내 정보" });
    fireEvent.click(within(panel).getByText("추가"));
    const dialog = await screen.findByRole("dialog", { name: "바로가기 추가" });
    fireEvent.change(within(dialog).getByLabelText("넣을 화면 찾기"), { target: { value: "라이브보드" } });
    expect(within(dialog).queryByText("라이브보드")).toBeNull();
  });

  it("편집 중 칸을 누르면 이름을 바꿀 수 있다", async () => {
    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: "편집" }));
    fireEvent.click(screen.getByRole("button", { name: /^로드맵 — 끌어서 옮기기/ }));
    const dialog = await screen.findByRole("dialog", { name: "메뉴 고치기" });
    fireEvent.change(within(dialog).getByLabelText("이름"), { target: { value: "레벨 지도" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));
    await waitFor(() => expect(screen.getByText("레벨 지도")).toBeInTheDocument());
    expect(saved()?.entries?.find((e: { id?: string }) => e.id === "/rank-up")?.label).toBe("레벨 지도");
  });

  it("보통 화면에서 길게 누르면 편집 모드가 되고, 손을 떼도 칸이 열리지 않는다", async () => {
    vi.useFakeTimers();
    try {
      renderGrid();
      const tile = screen.getByRole("button", { name: "로드맵" });
      fireEvent.pointerDown(tile, { pointerId: 1, pointerType: "touch", clientX: 10, clientY: 10, button: 0 });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      fireEvent.pointerUp(window, { pointerId: 1, pointerType: "touch", clientX: 10, clientY: 10 });
      fireEvent.click(tile);
      expect(screen.getByRole("button", { name: "완료" })).toBeInTheDocument();
      expect(screen.queryByRole("dialog", { name: "메뉴 고치기" })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
