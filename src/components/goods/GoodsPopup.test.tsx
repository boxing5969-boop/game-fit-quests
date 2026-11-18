import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GoodsPopup from "./GoodsPopup";
import { GOODS_POPUP_TIMING, goodsPopupSessionKey, goodsPopupTodayKey } from "@/lib/goodsPreorder";

const { getGoodsCampaign, getGoodsMyPage, leaveApp, auth } = vi.hoisted(() => ({
  getGoodsCampaign: vi.fn(),
  getGoodsMyPage: vi.fn(),
  leaveApp: vi.fn(() => Promise.resolve()),
  auth: { user: { id: "u-0" } as { id: string } | null, profile: { branch_name: "153복싱짐 선릉역점" } as { branch_name: string } | null },
}));
vi.mock("@/services/goodsService", () => ({ getGoodsCampaign, getGoodsMyPage }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/hooks/useOnboardingState", () => ({ useOnboardingState: () => ({ onboardingDone: true }) }));
vi.mock("@/lib/docCache", () => ({ leaveApp }));

const SLUG = "fleece-2026";
const OPEN = {
  ok: true,
  slug: SLUG,
  title: "153 플리스 집업",
  price: 25000,
  list_price: null,
  colors: [
    { key: "white", label: "흰색 인쇄" },
    { key: "gray", label: "진회색 인쇄" },
  ],
  sizes: ["M", "L", "XL", "2XL"],
  max_qty: 3,
  opens_at: "2026-11-12T00:00:00+09:00",
  closes_at: "2099-11-26T23:59:59+09:00",
  open: true,
  branches: ["153복싱짐 선릉역점", "153복싱짐 역삼점", "153복싱짐 잠실점", "153복싱짐 칠금점"],
  stock_limit: 50,
  stock_used: 6,
  stock_left: 44,
  sold_out: false,
};
const order = (status: string) => ({ id: `o-${status}`, order_no: "FL-1", status, branch_name: "153복싱짐 선릉역점" });

const show = (path = "/home") => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <GoodsPopup />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};
const dialog = () => screen.queryByRole("dialog");
/**
 * 팝업이 뜰 수 있는 시간보다 넉넉히 기다린 뒤 안 떴는지 본다 — act 를 여러 번 나눠 기다린다
 * (act 한 번 안에서는 서버 값이 화면에 그려지는 것이 act 끝까지 미뤄져, 팝업 타이머가 그 뒤에야 돈다).
 */
const settle = async () => {
  for (let i = 0; i < 4; i += 1) await act(() => new Promise((r) => setTimeout(r, 40)));
};

let seq = 0;
const saved = { ...GOODS_POPUP_TIMING };
beforeEach(() => {
  // 계정마다 기억 칸이 다르다 — 시험마다 새 계정(같은 파일 안 기억이 섞이지 않게)
  auth.user = { id: `u-${++seq}` };
  auth.profile = { branch_name: "153복싱짐 선릉역점" };
  window.localStorage.clear();
  window.sessionStorage.clear();
  getGoodsCampaign.mockReset().mockResolvedValue(OPEN);
  getGoodsMyPage.mockReset().mockResolvedValue({ ok: true, me: null, orders: [] });
  leaveApp.mockClear();
  Object.assign(GOODS_POPUP_TIMING, { firstCheckMs: 5, waitMs: 10, waitTries: 40 });
});
afterEach(() => {
  Object.assign(GOODS_POPUP_TIMING, saved);
  document.body.querySelectorAll("[data-other]").forEach((el) => el.remove());
});

describe("홈 플리스 집업 팝업 (2026-11-18 대표님 「팝업창하나띄워죠 · 오늘하루동안 뜨지않게하기 버튼도」)", () => {
  it("아직 신청 전인 분께 뜬다 — 가격 · 153 이익 0원 · 남은 벌 수 · 결제는 지점 데스크 · 샘플", async () => {
    show();
    const d = await screen.findByRole("dialog");
    expect(d).toHaveTextContent("153이 남기지 않는 옷이에요");
    expect(d).toHaveTextContent("25,000원");
    expect(d).toHaveTextContent("153 이익 0원");
    expect(d).toHaveTextContent("인쇄 색 흰색 · 진회색 중 고르기");
    expect(d).toHaveTextContent("선릉역점에서 사이즈별 샘플 입어 보기");
    expect(d).toHaveTextContent("결제는 신청 뒤 선릉역점 데스크에서");
    expect(d).toHaveTextContent("남은 44벌");
    expect(d).toHaveTextContent("AI 예시 이미지");
    // 브랜드 기준 — 긴 줄표 · 금칙 없이
    expect(d.textContent).not.toMatch(/—|프리미엄|최고|국가대표|보장/);
  });

  it("남은 날(D-8 · 오늘 마감)은 말하지 않는다 — 마감 날짜 · 남은 벌 수만 (2026-11-18 대표님 「몇일남았다는말은 하지말자」)", async () => {
    // 마감이 몇 분 뒤 — 예전 화면이면 '오늘 마감' 이 나오던 때
    getGoodsCampaign.mockResolvedValue({ ...OPEN, closes_at: new Date(Date.now() + 5 * 60_000).toISOString() });
    show();
    const d = await screen.findByRole("dialog");
    expect(d).toHaveTextContent("연말 원가 판매");
    expect(d).toHaveTextContent(/신청 마감 \d+월 \d+일/);
    expect(d).toHaveTextContent("남은 44벌");
    expect(d.textContent).not.toMatch(/D-\d|D-day|오늘 마감|일 남/);
  });

  it("「오늘 하루 보지 않기」 — 오늘 날짜 칸에 기억하고 닫힌다 · 다시 열어도 오늘은 안 뜬다", async () => {
    const first = show();
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "오늘 하루 보지 않기" }));
    expect(dialog()).toBeNull();
    const id = auth.user!.id;
    expect(window.localStorage.getItem(goodsPopupTodayKey(SLUG, id))).toBe("1");
    expect(window.sessionStorage.getItem(goodsPopupSessionKey(SLUG, id))).toBeNull();
    first.unmount();
    show();
    await settle();
    expect(dialog()).toBeNull();
  });

  it("「닫기」 · 바깥 누르기 — 이번에 앱을 연 동안만 (오늘 날짜 칸은 그대로)", async () => {
    const first = show();
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(dialog()).toBeNull();
    const id = auth.user!.id;
    expect(window.sessionStorage.getItem(goodsPopupSessionKey(SLUG, id))).toBe("1");
    expect(window.localStorage.getItem(goodsPopupTodayKey(SLUG, id))).toBeNull();
    first.unmount();
    show();
    await settle();
    expect(dialog()).toBeNull();

    // 다른 계정 — 바깥(어두운 바탕)을 눌러도 닫기와 같다
    auth.user = { id: `u-${++seq}` };
    show();
    const d = await screen.findByRole("dialog");
    fireEvent.click(d.parentElement!);
    expect(dialog()).toBeNull();
    expect(window.sessionStorage.getItem(goodsPopupSessionKey(SLUG, auth.user.id))).toBe("1");
  });

  it("「자세히 보고 신청하기」 — 오늘은 다시 안 띄우고 상세페이지로", async () => {
    show();
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "자세히 보고 신청하기" }));
    expect(leaveApp).toHaveBeenCalledWith("/goods/fleece/?from=app");
    expect(window.localStorage.getItem(goodsPopupTodayKey(SLUG, auth.user!.id))).toBe("1");
    expect(dialog()).toBeNull();
  });

  it("이미 신청한 분(결제 전 · 결제 완료 · 받음)에게는 안 뜬다 — 취소만 있으면 뜬다", async () => {
    for (const st of ["applied", "paid", "delivered"]) {
      auth.user = { id: `u-${++seq}` };
      getGoodsMyPage.mockResolvedValue({ ok: true, me: null, orders: [order("canceled"), order(st)] });
      const v = show();
      await waitFor(() => expect(getGoodsMyPage).toHaveBeenCalled());
      await settle();
      expect(dialog()).toBeNull();
      v.unmount();
      getGoodsMyPage.mockClear();
    }
    auth.user = { id: `u-${++seq}` };
    getGoodsMyPage.mockResolvedValue({ ok: true, me: null, orders: [order("canceled")] });
    show();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("선착순이 다 차거나 마감이면 안 뜬다 · 서버가 실패해도 조용히 안 뜬다", async () => {
    getGoodsCampaign.mockResolvedValue({ ...OPEN, stock_left: 0, sold_out: true });
    const a = show();
    await waitFor(() => expect(getGoodsCampaign).toHaveBeenCalled());
    await settle();
    expect(dialog()).toBeNull();
    a.unmount();

    auth.user = { id: `u-${++seq}` };
    getGoodsCampaign.mockResolvedValue({ ...OPEN, open: false });
    const b = show();
    await waitFor(() => expect(getGoodsCampaign).toHaveBeenCalledTimes(2));
    await settle();
    expect(dialog()).toBeNull();
    b.unmount();

    auth.user = { id: `u-${++seq}` };
    getGoodsCampaign.mockRejectedValue(new Error("no function"));
    show();
    await waitFor(() => expect(getGoodsCampaign).toHaveBeenCalledTimes(3));
    await settle();
    expect(dialog()).toBeNull();
  });

  it("다른 창이 떠 있으면 닫힐 때까지 기다렸다가 뜬다 — 두 겹으로 쌓이지 않게", async () => {
    const other = document.createElement("div");
    other.setAttribute("role", "dialog");
    other.setAttribute("data-other", "1");
    document.body.appendChild(other);
    show();
    await waitFor(() => expect(getGoodsMyPage).toHaveBeenCalled());
    await settle();
    expect(screen.getAllByRole("dialog")).toHaveLength(1); // 다른 창 하나뿐
    other.remove();
    const d = await screen.findByRole("dialog");
    expect(d).toHaveTextContent("153 플리스 집업");
  });

  it("다른 지점 회원 — 그 지점 데스크 결제 · 샘플 줄 없음", async () => {
    auth.profile = { branch_name: "153복싱짐 칠금점" };
    show();
    const d = await screen.findByRole("dialog");
    expect(d).toHaveTextContent("결제는 신청 뒤 칠금점 데스크에서");
    expect(d).not.toHaveTextContent("샘플");
  });

  it("미리 보기 ?goodspop=1 — 이미 신청했거나 오늘 닫은 계정도 한 번 뜬다(신청을 받는 중일 때만)", async () => {
    const id = auth.user!.id;
    window.localStorage.setItem(goodsPopupTodayKey(SLUG, id), "1");
    getGoodsMyPage.mockResolvedValue({ ok: true, me: null, orders: [order("paid")] });
    const v = show("/home?goodspop=1");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    v.unmount();

    auth.user = { id: `u-${++seq}` };
    getGoodsCampaign.mockResolvedValue({ ...OPEN, sold_out: true, stock_left: 0 });
    show("/home?goodspop=1");
    await waitFor(() => expect(getGoodsCampaign).toHaveBeenCalledTimes(2));
    await settle();
    expect(dialog()).toBeNull();
  });

  it("로그인 전이면 서버를 부르지 않고 안 뜬다", async () => {
    auth.user = null;
    show();
    await settle();
    expect(getGoodsCampaign).not.toHaveBeenCalled();
    expect(dialog()).toBeNull();
  });
});
