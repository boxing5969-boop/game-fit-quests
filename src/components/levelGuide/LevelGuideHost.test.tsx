import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 레벨업 안내 — 언제 띄우나 · 기록 · 편지 순서 (2026-11-27 새 튜토리얼)

const state = vi.hoisted(() => ({
  role: "member" as string,
  realRole: "member" as string,
  staff: false,
  progress: { current_rank: "white", current_level: 2, bosses_cleared: 0 } as Record<string, unknown> | null,
  status: { seen: false, done: false, skipped: false, maxStep: 0, opens: 0 } as Record<string, unknown> | null,
  statusError: false,
  marks: [] as [string, string, number][],
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u-guide" },
    profile: { name: "민수", nickname: null, is_staff: state.staff },
    progress: state.progress,
    role: state.role,
    realRole: state.realRole,
  }),
}));

vi.mock("@/lib/staffDisplay", () => ({ isStaffProfile: (p: { is_staff?: boolean } | null) => !!p?.is_staff }));

vi.mock("@/services/levelGuideService", () => ({
  GUIDE_STATUS_KEY: ["153guide", "status"],
  markGuide: vi.fn(async (g: string, e: string, s: number) => {
    state.marks.push([g, e, s]);
    return null;
  }),
  useGuideStatus: (_uid: string | null, _g: string, enabled: boolean) =>
    !enabled
      ? { data: undefined, isError: false }
      : state.statusError
        ? { data: undefined, isError: true }
        : { data: state.status ?? undefined, isError: false },
}));

// 창 속은 시트 시험(화면)에서 — 여기서는 열림 · 닫힘만
vi.mock("./LevelGuideSheet", () => ({
  default: ({ open, name, onClose }: { open: boolean; name: string | null; onClose: (r: { finished: boolean; step: number; pushAsked: boolean }) => void }) =>
    open ? (
      <div role="dialog" aria-label="레벨업 안내">
        <span>{name}</span>
        <button onClick={() => onClose({ finished: true, step: 4, pushAsked: false })}>끝까지</button>
        <button onClick={() => onClose({ finished: false, step: 1, pushAsked: false })}>건너뛰기</button>
      </div>
    ) : null,
}));

import LevelGuideHost from "./LevelGuideHost";
import { getGuideGate, openLevelGuide } from "@/lib/levelGuide";

const Where = () => {
  const loc = useLocation();
  return <span data-testid="where">{loc.pathname + loc.search}</span>;
};

const mount = (path = "/home") =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <LevelGuideHost />
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(state, {
    role: "member",
    realRole: "member",
    staff: false,
    progress: { current_rank: "white", current_level: 2, bosses_cleared: 0 },
    status: { seen: false, done: false, skipped: false, maxStep: 0, opens: 0 },
    statusError: false,
    marks: [],
  });
  localStorage.clear();
  sessionStorage.clear();
  document.body.style.overflow = "";
});

afterEach(() => {
  vi.useRealTimers();
});

const wait = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

describe("레벨업 안내 — 저절로 띄우기", () => {
  it("처음 보는 회원 — 홈에서 1.2초 뒤 · 열 때 기록 · 끝까지 보면 done · 편지는 다음 접속에(shown)", async () => {
    mount();
    expect(getGuideGate()).toBe("due");
    expect(screen.queryByRole("dialog")).toBeNull();
    await wait(1300);
    expect(screen.getByRole("dialog", { name: "레벨업 안내" })).toBeInTheDocument();
    expect(screen.getByText("민수")).toBeInTheDocument();
    expect(getGuideGate()).toBe("showing");
    expect(state.marks).toEqual([["level", "open", 0]]);
    fireEvent.click(screen.getByText("끝까지"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(state.marks).toContainEqual(["level", "done", 4]);
    expect(getGuideGate()).toBe("shown");
    expect(localStorage.getItem("153guide:level:seen:u-guide")).toBe("1");
    expect(sessionStorage.getItem("153guide:level:shown:u-guide")).toBe("1");
  });

  it("건너뛰면 skip 과 본 데까지", async () => {
    mount();
    await wait(1300);
    fireEvent.click(screen.getByText("건너뛰기"));
    expect(state.marks).toContainEqual(["level", "skip", 1]);
  });

  it("이미 본 회원 — 안 띄우고 편지는 그대로(clear)", async () => {
    state.status = { seen: true, done: true, skipped: false, maxStep: 4, opens: 1 };
    mount();
    await wait(3000);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(getGuideGate()).toBe("clear");
    expect(state.marks).toEqual([]);
  });

  it("홈이 아니면 기다린다 (편지도 기다림)", async () => {
    mount("/missions");
    await wait(3000);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(getGuideGate()).toBe("due");
  });

  it("다른 창이 떠 있으면(스크롤 잠금) 닫힐 때까지 기다린다", async () => {
    document.body.style.overflow = "hidden";
    mount();
    await wait(4000);
    expect(screen.queryByRole("dialog")).toBeNull();
    document.body.style.overflow = "";
    await wait(1600);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("서버를 못 읽으면 이 기기 기록으로 — 본 적 없으면 띄우고, 있으면 안 띄운다", async () => {
    state.statusError = true;
    const a = mount();
    await wait(1300);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    a.unmount();
    sessionStorage.clear();
    localStorage.setItem("153guide:level:seen:u-guide", "1");
    mount();
    await wait(3000);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("이번 접속에 이미 띄웠으면 다시 안 띄운다", async () => {
    sessionStorage.setItem("153guide:level:shown:u-guide", "1");
    mount();
    await wait(3000);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(getGuideGate()).toBe("shown");
  });
});

describe("대상 아님 — 지도진 · 관리자 · 마스터", () => {
  it("코치님 — 저절로 안 띄우고 편지와 상관없음(idle)", async () => {
    state.staff = true;
    state.role = "coach";
    mount();
    await wait(3000);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(getGuideGate()).toBe("idle");
  });

  it("관리자가 '회원으로 보기' 중이어도 저절로는 안 띄운다", async () => {
    state.role = "member";
    state.realRole = "super_admin";
    mount();
    await wait(3000);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(getGuideGate()).toBe("idle");
  });

  it("레벨 40 마스터 — 올라갈 레벨이 없어 안 띄운다", async () => {
    state.progress = { current_rank: "black", current_level: 10, bosses_cleared: 4 };
    mount();
    await wait(3000);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("다시 보기", () => {
  it("설정 · 내정보 · 레벨 카드 ? — 이미 본 회원도 열린다 (열기 기록)", async () => {
    state.status = { seen: true, done: true, skipped: false, maxStep: 4, opens: 1 };
    mount();
    await wait(100);
    act(() => openLevelGuide("settings"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(state.marks).toEqual([["level", "open", 0]]);
  });

  it("운영진 미리 보기 — 열리지만 기록은 남기지 않는다", async () => {
    state.staff = true;
    state.role = "coach";
    mount();
    act(() => openLevelGuide("rule"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByText("끝까지"));
    expect(state.marks).toEqual([]);
  });

  it("주소 ?guide=level — 열고 주소에서는 지운다", async () => {
    state.status = { seen: true, done: true, skipped: false, maxStep: 4, opens: 1 };
    mount("/home?guide=level&lvdemo=4");
    await wait(50);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("where").textContent).toBe("/home?lvdemo=4");
  });
});
