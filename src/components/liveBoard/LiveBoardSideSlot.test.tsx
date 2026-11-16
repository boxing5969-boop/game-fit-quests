import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LiveBoardSideSlot from "./LiveBoardSideSlot";

const { getGoodsCampaign } = vi.hoisted(() => ({ getGoodsCampaign: vi.fn() }));
vi.mock("@/services/goodsService", () => ({ getGoodsCampaign }));
vi.mock("@/lib/attendanceCheer", () => ({ kstToday: () => "2026-11-18" }));

const OPEN = {
  ok: true,
  slug: "fleece",
  title: "153 플리스 집업",
  price: 25000,
  colors: [],
  sizes: ["M", "L"],
  max_qty: 3,
  opens_at: "2026-11-12T00:00:00+09:00",
  closes_at: "2099-01-01T00:00:00+09:00",
  open: true,
  branches: [],
  stock_limit: 50,
  stock_left: 38,
  sold_out: false,
};
const SUNREUNG = "153복싱짐 선릉역점";

const show = (branch: string) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LiveBoardSideSlot branchName={branch} />
    </QueryClientProvider>,
  );
};
const growth = () => screen.queryByRole("complementary", { name: "오늘의 1분 성장", hidden: true });
const goods = () => screen.queryByText("153 플리스 집업");
/** 보이는 쪽인가 — 안 보이는 쪽은 감싼 칸이 hidden */
const shown = (el: HTMLElement | null) => !!el && !el.closest(".hidden");

let now = 0;
beforeEach(() => {
  now = 0;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  getGoodsCampaign.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("라이브보드 2번 화면 오른쪽 칸 — 사전예약 안내 ↔ 오늘의 1분", () => {
  it("사전예약이 닫혔으면 켠 지점 TV 는 「오늘의 1분」이 그 칸을 이어받는다", async () => {
    getGoodsCampaign.mockResolvedValue({ ...OPEN, open: false });
    show(SUNREUNG);
    await waitFor(() => expect(growth()).toBeInTheDocument());
    expect(shown(growth())).toBe(true);
    expect(growth()).toHaveTextContent("잽은 돌아오는 것까지예요");
    expect(goods()).toBeNull();
  });

  it("둘 다 있으면 번갈아 — 두 쪽 모두 그려 둔 채 한쪽만 보인다 (40초마다)", async () => {
    getGoodsCampaign.mockResolvedValue(OPEN);
    const first = show(SUNREUNG);
    await waitFor(() => expect(goods()).toBeInTheDocument());
    await waitFor(() => expect(growth()).toBeInTheDocument());
    expect([shown(growth()), shown(goods())]).toEqual([true, false]);
    first.unmount();
    now = 40_000;
    show(SUNREUNG);
    await waitFor(() => expect(goods()).toBeInTheDocument());
    await waitFor(() => expect(growth()).toBeInTheDocument());
    expect([shown(growth()), shown(goods())]).toEqual([false, true]);
  });

  it("켜지 않은 지점 TV — 사전예약만(예전 그대로) · 둘 다 없으면 칸이 없다", async () => {
    getGoodsCampaign.mockResolvedValue(OPEN);
    const a = show("153복싱짐 칠금점");
    await waitFor(() => expect(goods()).toBeInTheDocument());
    expect(shown(goods())).toBe(true);
    expect(growth()).toBeNull();
    a.unmount();
    getGoodsCampaign.mockResolvedValue(null);
    const b = show("153복싱짐 칠금점");
    await waitFor(() => expect(getGoodsCampaign).toHaveBeenCalledTimes(2));
    expect(b.container).toBeEmptyDOMElement();
  });

  it("서버에 닿지 않아도(사전예약 정보를 못 읽어도) 「오늘의 1분」은 나온다 — 글은 앱에 들어 있다", async () => {
    getGoodsCampaign.mockRejectedValue(new Error("offline"));
    show(SUNREUNG);
    await waitFor(() => expect(growth()).toBeInTheDocument());
    expect(shown(growth())).toBe(true);
  });
});
