import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u-social" },
    profile: { name: "", phone_number: null },
    role: "member",
    refreshProfile: vi.fn(async () => {}),
    refreshProgress: vi.fn(async () => {}),
  }),
}));
vi.mock("@/components/InviteRewardBridge", () => ({ runInviteClaim: vi.fn(async () => {}) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import LinkAccountPrompt from "./LinkAccountPrompt";
import { peekLinkTicket, saveLinkTicket } from "@/lib/memberEntry";

function setup(path = "/home") {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <LinkAccountPrompt />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// 2026-11-23 보안 점검: 번호만으로 합치지 않기 · 공용 기기 표는 묻고 합치기
describe("회원 등록 확인 (소셜 첫 로그인)", () => {
  beforeEach(() => {
    localStorage.clear();
    invoke.mockReset();
  });

  it("기기에 남은 표는 묻지 않고 합치지 않는다 — 「아니에요」면 표를 지운다", async () => {
    saveLinkTicket("abc.def");
    setup();
    await screen.findByText("찾은 기록을 이 계정으로 옮길까요?");
    expect(invoke).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "아니에요" }));
    expect(peekLinkTicket()).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("「네, 내 기록이에요」를 눌러야 그 표로 합친다", async () => {
    saveLinkTicket("abc.def");
    invoke.mockResolvedValue({ data: { matched: true, ok: true } });
    setup("/login");
    fireEvent.click(await screen.findByRole("button", { name: /네, 내 기록이에요/ }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("link-imported-by-phone", { body: { ticket: "abc.def" } }));
    expect(peekLinkTicket()).toBeNull();
  });

  it("직접 넣으면 이름 · 번호 · 생년월일로 확인한 뒤 받은 표로만 합친다(번호를 그대로 보내지 않음)", async () => {
    invoke.mockImplementation(async (fn: string) =>
      fn === "claim-member-account" ? { data: { ok: true, status: "existing", ticket: "bound.sig" } } : { data: { matched: true, ok: true } },
    );
    setup();
    fireEvent.change(await screen.findByLabelText("이름(실명)"), { target: { value: "홍길동" } });
    fireEvent.change(screen.getByLabelText("체육관에 등록한 전화번호"), { target: { value: "01012345678" } });
    fireEvent.change(screen.getByLabelText("생년월일"), { target: { value: "19990315" } });
    fireEvent.click(screen.getByRole("button", { name: "기존 회원 연동하기" }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("link-imported-by-phone", { body: { ticket: "bound.sig" } }));
    expect(invoke).toHaveBeenNthCalledWith(1, "claim-member-account", {
      body: { action: "check", phone: "01012345678", name: "홍길동", birthDate: "19990315", ticket: true },
    });
    for (const call of invoke.mock.calls) {
      if (call[0] === "link-imported-by-phone") expect((call[1] as { body: Record<string, unknown> }).body.phone).toBeUndefined();
    }
  });

  it("정보가 다르면 서버 안내를 보여 주고 합치지 않는다", async () => {
    invoke.mockResolvedValue({ data: { ok: false, status: "mismatch", error: "체육관에 등록된 회원 정보와 달라요." } });
    setup();
    fireEvent.change(await screen.findByLabelText("이름(실명)"), { target: { value: "홍길동" } });
    fireEvent.change(screen.getByLabelText("체육관에 등록한 전화번호"), { target: { value: "01012345678" } });
    fireEvent.change(screen.getByLabelText("생년월일"), { target: { value: "19990315" } });
    fireEvent.click(screen.getByRole("button", { name: "기존 회원 연동하기" }));
    await screen.findByText(/등록된 회원 정보와 달라요/);
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
