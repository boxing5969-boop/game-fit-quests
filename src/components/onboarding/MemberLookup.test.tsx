import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

import MemberLookup from "./MemberLookup";
import { peekLinkTicket, peekLookupRequest, saveLookupRequest } from "@/lib/memberEntry";

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

  it("찾으면 이어받기 표를 두고 로그인 방법을 고르게 한다", async () => {
    invoke.mockResolvedValue({ data: { ok: true, status: "existing", ticket: "abc.def" } });
    const { onKakao } = setup();
    await screen.findByText("기록을 찾았어요");
    expect(invoke).toHaveBeenCalledWith("claim-member-account", {
      body: { action: "check", phone: "01012345678", name: "홍길동", birthDate: "19990315", ticket: true },
    });
    expect(peekLinkTicket()).toBe("abc.def");
    fireEvent.click(screen.getByRole("button", { name: /카카오로 이어받기/ }));
    expect(onKakao).toHaveBeenCalled();
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

  it("정보가 다르면 확인 방법과 데스크 부탁을 보여 준다", async () => {
    invoke.mockResolvedValue({ data: { ok: false, status: "mismatch", error: "체육관에 등록된 회원 정보와 달라요." } });
    setup();
    await screen.findByText("등록된 정보와 달라요");
    expect(screen.getByRole("button", { name: "데스크에 확인 부탁하기" })).toBeTruthy();
  });

  it("잠금처럼 다른 결과는 서버 안내를 그대로 보여 준다", async () => {
    invoke.mockResolvedValue({ data: { ok: false, status: "locked", error: "확인 시도가 너무 많아요." } });
    setup();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("너무 많아요"));
  });
});

describe("데스크 확인 대기", () => {
  beforeEach(() => {
    localStorage.clear();
    invoke.mockReset();
  });

  it("부탁하면 열쇠를 이 기기에 두고 확인 대기 화면을 보여 준다", async () => {
    invoke.mockImplementation(async (fn: string, opts: { body: Record<string, unknown> }) => {
      if (fn === "claim-member-account") return { data: { ok: true, status: "new" } };
      if (opts.body.op === "create") return { data: { ok: true, key: "k".repeat(43) } };
      return { data: { ok: true, status: "pending", branch: "153복싱짐 선릉역점", created_at: new Date().toISOString() } };
    });
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "데스크에 확인 부탁하기" }));
    fireEvent.click(screen.getByRole("button", { name: "선릉역점" }));
    fireEvent.change(screen.getByLabelText("남길 말 (선택)"), { target: { value: "예전 번호로 등록" } });
    fireEvent.click(screen.getByRole("button", { name: "확인 부탁하기" }));
    await screen.findByText("확인 대기 중");
    expect(invoke).toHaveBeenCalledWith("member-lookup-request", {
      body: { op: "create", name: "홍길동", phone: "01012345678", birthDate: "19990315", branch: "153복싱짐 선릉역점", memo: "예전 번호로 등록" },
    });
    expect(peekLookupRequest()?.key).toBe("k".repeat(43));
    expect(screen.getByText("선릉역점에서 확인하고 있어요")).toBeTruthy();
  });

  it("지점이 연결하면 앱을 다시 열었을 때 표를 받아 카카오로 이어받게 한다", async () => {
    saveLookupRequest({ key: "k".repeat(43), name: "홍길동", branch: "153복싱짐 선릉역점" });
    invoke.mockResolvedValue({ data: { ok: true, status: "found", ticket: "t.sig", branch: "153복싱짐 선릉역점" } });
    const onKakao = vi.fn(async () => {});
    render(
      <MemoryRouter>
        <MemberLookup onBack={() => {}} onLogin={() => {}} onKakao={onKakao} kakaoBusy={false} />
      </MemoryRouter>,
    );
    await screen.findByText("기록을 찾았어요");
    expect(peekLinkTicket()).toBe("t.sig");
    expect(screen.queryByRole("button", { name: "아이디 · 비밀번호 만들기" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /카카오로 이어받기/ }));
    expect(onKakao).toHaveBeenCalled();
  });

  it("명단에 없다고 답하면 지점의 답과 신규 가입을 보여 준다", async () => {
    saveLookupRequest({ key: "k".repeat(43), name: "홍길동", branch: "153복싱짐 칠금점" });
    invoke.mockResolvedValue({ data: { ok: true, status: "not_member", reply: "신규 가입으로 해 주세요", branch: "153복싱짐 칠금점" } });
    render(
      <MemoryRouter>
        <MemberLookup onBack={() => {}} onLogin={() => {}} onKakao={async () => {}} kakaoBusy={false} />
      </MemoryRouter>,
    );
    await screen.findByText("명단에 없다고 해요");
    expect(screen.getByText("신규 가입으로 해 주세요")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "다른 정보로 다시 찾기" }));
    expect(peekLookupRequest()).toBeNull();
    expect(screen.getByText("기록 찾기")).toBeTruthy();
  });

  it("없어진 요청이면 잊고 기록 찾기로 돌아간다", async () => {
    saveLookupRequest({ key: "k".repeat(43), name: "홍길동", branch: "153복싱짐 선릉역점" });
    invoke.mockResolvedValue({ data: { ok: false, status: "gone" } });
    render(
      <MemoryRouter>
        <MemberLookup onBack={() => {}} onLogin={() => {}} onKakao={async () => {}} kakaoBusy={false} />
      </MemoryRouter>,
    );
    await screen.findByText("기록 찾기");
    expect(peekLookupRequest()).toBeNull();
  });
});
