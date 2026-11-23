import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

import MemberLookup from "./MemberLookup";
import { peekLinkTicket } from "@/lib/memberEntry";

const SignupProbe = () => {
  const loc = useLocation();
  return <p>SIGNUP {JSON.stringify(loc.state)}</p>;
};

function setup(onKakao = vi.fn(async () => {}), onLogin = vi.fn()) {
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<MemberLookup onBack={() => {}} onLogin={onLogin} onKakao={onKakao} kakaoBusy={false} />} />
        <Route path="/signup" element={<SignupProbe />} />
      </Routes>
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("이름(실명)"), { target: { value: "홍길동 " } });
  fireEvent.change(screen.getByLabelText("등록한 전화번호"), { target: { value: "01012345678" } });
  fireEvent.change(screen.getByLabelText("생년월일"), { target: { value: "1999-03-15" } });
  fireEvent.click(screen.getByRole("button", { name: /내 기록 찾기/ }));
  return { onKakao, onLogin };
}

describe("기록 찾기 (첫 화면 「다니고 있어요」)", () => {
  beforeEach(() => {
    localStorage.clear();
    invoke.mockReset();
  });

  it("찾으면 로그인 방법을 고르게 하고, 표는 「카카오로 이어받기」를 누를 때만 기기에 둔다", async () => {
    invoke.mockResolvedValue({ data: { ok: true, status: "existing", ticket: "abc.def" } });
    const { onKakao } = setup();
    await screen.findByText("기록을 찾았어요");
    expect(invoke).toHaveBeenCalledWith("claim-member-account", {
      body: { action: "check", phone: "01012345678", name: "홍길동", birthDate: "19990315", ticket: true },
    });
    // 찾기만 하고 떠나면 공용 기기에 표가 남지 않아야 한다(2026-11-23 점검)
    expect(peekLinkTicket()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /카카오로 이어받기/ }));
    expect(peekLinkTicket()).toBe("abc.def");
    expect(onKakao).toHaveBeenCalled();
  });

  it("찾은 화면에서 뒤로 가면 표를 지운다", async () => {
    invoke.mockResolvedValue({ data: { ok: true, status: "existing", ticket: "abc.def" } });
    setup();
    await screen.findByText("기록을 찾았어요");
    fireEvent.click(screen.getByRole("button", { name: /카카오로 이어받기/ }));
    expect(peekLinkTicket()).toBe("abc.def");
    fireEvent.click(screen.getByRole("button", { name: "뒤로" }));
    await screen.findByText("기록 찾기");
    expect(peekLinkTicket()).toBeNull();
  });

  it("아이디로 만들면 넣은 정보를 가입 화면에 넘기고 표는 지운다", async () => {
    invoke.mockResolvedValue({ data: { ok: true, status: "existing", ticket: "abc.def" } });
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "아이디 · 비밀번호 만들기" }));
    await screen.findByText(/SIGNUP/);
    expect(screen.getByText(/SIGNUP/).textContent).toContain('"phone":"01012345678"');
    expect(peekLinkTicket()).toBeNull();
  });

  it("명단에 없으면 다시 넣기 · 신규 가입을 보여 준다", async () => {
    invoke.mockResolvedValue({ data: { ok: true, status: "new" } });
    setup();
    await screen.findByText("명단에서 못 찾았어요");
    expect(screen.getByRole("button", { name: "처음이에요 · 신규 가입" })).toBeTruthy();
    expect(peekLinkTicket()).toBeNull();
  });

  it("이미 앱을 쓰는 번호는 로그인으로 보낸다", async () => {
    invoke.mockResolvedValue({ data: { ok: false, status: "registered", error: "x" } });
    const { onLogin } = setup();
    fireEvent.click(await screen.findByRole("button", { name: "로그인하러 가기" }));
    expect(onLogin).toHaveBeenCalled();
  });

  it("정보가 다르면 서버 안내를 그대로 보여 준다", async () => {
    invoke.mockResolvedValue({ data: { ok: false, status: "mismatch", error: "체육관에 등록된 회원 정보와 달라요." } });
    setup();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("등록된 회원 정보와 달라요"));
  });
});
