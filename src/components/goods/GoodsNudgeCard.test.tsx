import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GoodsNudgeCard from "./GoodsNudgeCard";

const { getGoodsCampaign, getGoodsMyPage } = vi.hoisted(() => ({
  getGoodsCampaign: vi.fn(),
  getGoodsMyPage: vi.fn(),
}));
vi.mock("@/services/goodsService", () => ({ getGoodsCampaign, getGoodsMyPage }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u-nudge" } }) }));
vi.mock("@/lib/docCache", () => ({ leaveApp: vi.fn(() => Promise.resolve()) }));

// 마감이 몇 분 뒤 — 예전 화면이면 '오늘 마감' 이 나오던 때
const campaign = () => ({
  ok: true,
  slug: "fleece-2026",
  title: "153 플리스 집업",
  price: 25000,
  list_price: null,
  colors: [],
  sizes: ["M", "L"],
  max_qty: 3,
  opens_at: "2026-11-12T00:00:00+09:00",
  closes_at: new Date(Date.now() + 5 * 60_000).toISOString(),
  open: true,
  branches: ["153복싱짐 선릉역점"],
  stock_limit: 50,
  stock_used: 6,
  stock_left: 44,
  sold_out: false,
});

const show = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GoodsNudgeCard />
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  getGoodsCampaign.mockReset().mockResolvedValue(campaign());
  getGoodsMyPage.mockReset().mockResolvedValue({ ok: true, me: null, orders: [] });
});

describe("홈 플리스 안내 카드 — 남은 날(D-8 · 오늘 마감)은 말하지 않는다 (2026-11-18 대표님 「몇일남았다는말은 하지말자」)", () => {
  it("아직 신청 전 — 가격 · 남은 벌 수만", async () => {
    show();
    const card = (await screen.findByText("153 플리스 집업 · 원가 판매")).closest("button")!;
    expect(card).toHaveTextContent("25,000원 · 남은 44벌");
    expect(card.textContent).not.toMatch(/D-\d|D-day|오늘 마감|일 남/);
  });

  it("신청했고 결제 전 — 마감 날짜까지 결제 안내 · 남은 날 없이", async () => {
    getGoodsMyPage.mockResolvedValue({
      ok: true,
      me: null,
      orders: [{ id: "o-1", order_no: "FL-1", status: "applied", branch_name: "153복싱짐 선릉역점" }],
    });
    show();
    const card = (await screen.findByText("플리스 집업 신청 완료 · 결제 전")).closest("button")!;
    expect(card).toHaveTextContent(/\d+월 \d+일\(.\)까지 선릉역점 데스크에서 결제해 주세요/);
    expect(card.textContent).not.toMatch(/D-\d|D-day|오늘 마감|일 남/);
  });
});
