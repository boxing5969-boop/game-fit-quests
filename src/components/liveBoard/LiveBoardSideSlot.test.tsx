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

describe("라이브보드 2번 화면 오른쪽 칸 — 사전예약 동안은 플리스 · 끝나면 오늘의 1분", () => {
  it("사전예약이 열린 동안은 켠 지점 TV 도 플리스 안내만 — 시간이 지나도 번갈아 바뀌지 않는다 (2026-11-17 대표님 「폴리스집업 그대로」)", async () => {
    getGoodsCampaign.mockResolvedValue(OPEN);
    const first = show(SUNREUNG);
    await waitFor(() => expect(goods()).toBeInTheDocument());
    expect(shown(goods())).toBe(true);
    expect(growth()).toBeNull();
    first.unmount();
    now = 40_000;
    show(SUNREUNG);
    await waitFor(() => expect(goods()).toBeInTheDocument());
    expect(growth()).toBeNull();
  });

  it("TV 플리스 칸에 남은 날(D-8 · 오늘 마감)을 쓰지 않는다 — 신청 마감 날짜 · 남은 벌 수만 (2026-11-18 대표님)", async () => {
    getGoodsCampaign.mockResolvedValue({ ...OPEN, closes_at: "2026-11-26T23:59:59+09:00" });
    // 예전 화면이면 'D-8' 이 나오던 날 · '오늘 마감' 이 나오던 날
    for (const at of ["2026-11-18T10:00:00+09:00", "2026-11-26T10:00:00+09:00"]) {
      now = Date.parse(at);
      const view = show(SUNREUNG);
      await waitFor(() => expect(goods()).toBeInTheDocument());
      const board = goods()!.closest("aside")!;
      expect(board).toHaveTextContent("11월 26일(목)까지");
      expect(board).toHaveTextContent("남은 38벌");
      expect(board.textContent).not.toMatch(/D-\d|D-day|오늘 마감|일 남/);
      view.unmount();
    }
  });

  it("사전예약 정보를 읽는 동안은 칸을 그리지 않는다 — 「오늘의 1분」이 잠깐 비쳤다가 바뀌지 않게", async () => {
    let resolve: (v: unknown) => void = () => undefined;
    getGoodsCampaign.mockReturnValue(new Promise((r) => (resolve = r)));
    const { container } = show(SUNREUNG);
    await waitFor(() => expect(getGoodsCampaign).toHaveBeenCalledTimes(1));
    expect(container).toBeEmptyDOMElement();
    resolve(OPEN);
    await waitFor(() => expect(goods()).toBeInTheDocument());
    expect(growth()).toBeNull();
  });

  it("사전예약이 닫혔으면 켠 지점 TV 는 「오늘의 1분」이 그 칸을 이어받는다", async () => {
    getGoodsCampaign.mockResolvedValue({ ...OPEN, open: false });
    show(SUNREUNG);
    await waitFor(() => expect(growth()).toBeInTheDocument());
    expect(shown(growth())).toBe(true);
    expect(growth()).toHaveTextContent("잽은 돌아오는 것까지예요");
    expect(goods()).toBeNull();
  });

  it("선착순이 다 차도 「오늘의 1분」이 이어받는다", async () => {
    getGoodsCampaign.mockResolvedValue({ ...OPEN, stock_left: 0, sold_out: true });
    show(SUNREUNG);
    await waitFor(() => expect(growth()).toBeInTheDocument());
    expect(goods()).toBeNull();
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
    // 한 번 더 물어본 뒤(retry 1 · 약 1초) 「오늘의 1분」으로
    await waitFor(() => expect(growth()).toBeInTheDocument(), { timeout: 4000 });
    expect(shown(growth())).toBe(true);
  });
});
