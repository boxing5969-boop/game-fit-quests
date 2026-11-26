/**
 * 받은 153 — 「돌려줬어요」 · 「응원 보내기」 · 「153 돌려주기」 (2026-11-26 대표님 「돌려줬어요를 눌러도 반응없어」)
 *   서버 답(get_my_received_153)을 바꿔 가며 단추가 맞는지 · 누르면 반응이 있는지 본다. 지어낸 이름.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ senders: [] as unknown[], toggle: vi.fn(async () => ({ reacted: true })), toast: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("sonner", () => ({ toast: Object.assign(h.toast, { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/services/communityFeedService", () => ({
  getMyReceived153: vi.fn(async () => ({ success: true, days: 7, total: h.senders.length, today: 0, senders: h.senders })),
  toggle153: h.toggle,
}));

import Received153Sheet from "./Received153Sheet";

const sender = (nickname: string, extra: Record<string, unknown>) => ({
  userId: `u-${nickname}`,
  nickname,
  avatarUrl: null,
  isStaff: false,
  staffTitle: null,
  branch: "153복싱짐 선릉역점",
  league: "black",
  level: 10,
  count: 1,
  lastAt: "2026-11-25T14:32:48Z",
  returnTarget: { type: "journal", id: `j-${nickname}`, at: "2026-11-20T08:29:35Z" },
  returned: false,
  ...extra,
});

const renderSheet = (onCheer = vi.fn()) => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Received153Sheet open onClose={() => undefined} onCheer={onCheer} />
    </QueryClientProvider>,
  );
  return onCheer;
};

afterEach(() => {
  cleanup();
  h.toggle.mockClear();
  h.toast.mockClear();
});

describe("받은 153 시트 단추", () => {
  it("받기 전에 그 카드에 153 을 줬으면(cardHas153) — 「돌려줬어요」가 아니라 「응원 보내기」, 누르면 응원 창", async () => {
    h.senders = [sender("하늘", { returned: false, cardHas153: true })];
    const onCheer = renderSheet();
    fireEvent.click(await screen.findByRole("button", { name: "응원 보내기" }));
    expect(onCheer).toHaveBeenCalledWith(expect.objectContaining({ user_id: "u-하늘", nickname: "하늘" }));
    expect(screen.queryByText("돌려줬어요")).toBeNull();
    expect(h.toggle).not.toHaveBeenCalled();
  });

  it("받은 뒤에 돌려줬으면 「돌려줬어요」 — 누르면 이미 돌려줬다고 알려 준다(153 은 다시 안 누름)", async () => {
    h.senders = [sender("바다", { returned: true, cardHas153: true })];
    renderSheet();
    const btn = await screen.findByRole("button", { name: /돌려줬어요/ });
    fireEvent.click(btn);
    expect(h.toast).toHaveBeenCalledWith("바다님께 이미 153을 돌려줬어요");
    expect(h.toggle).not.toHaveBeenCalled();
  });

  it("아직이면 「153 돌려주기」 — 누르면 그 카드에 153", async () => {
    h.senders = [sender("나무", { returned: false, cardHas153: false })];
    renderSheet();
    fireEvent.click(await screen.findByRole("button", { name: "153 돌려주기" }));
    await vi.waitFor(() => expect(h.toggle).toHaveBeenCalledWith("journal", "j-나무"));
  });

  it("옛 서버(cardHas153 없음) — 예전처럼 returned 로만", async () => {
    h.senders = [sender("구름", { returned: true })];
    renderSheet();
    expect(await screen.findByRole("button", { name: /돌려줬어요/ })).toBeTruthy();
  });
});
