import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

import AppValueReel from "./AppValueReel";
import LaunchEventBoard from "./LaunchEventBoard";
import { NOTICE_TAB_MS } from "@/lib/gymNotices";

// 지어낸 숫자 · 이름만 (저장소가 공개)
const SUNREUNG = "153복싱짐 선릉역점";
const CHILGEUM = "153복싱짐 칠금점";
const pulseOf = (branch: string) => ({
  branch,
  days: 28,
  members: 120,
  visits: 900,
  minutes: 61_234,
  level_ups: 88,
  points: 352_100,
  rules: {
    mileage: { enabled: true, attendance: 300, level_up: 300, title_match: 2500, record: 10000 },
    levels: [{ rank: "white", visits: 3, auto: true, first: 1, last: 10 }],
  },
  features: { promise: true, return_bonus: 5000, weather: true, market: true, market_count: 60 },
});
const endedOf = (branch: string) => ({
  branch,
  since: "2026-10-01",
  period: "",
  items: [],
  start_date: "2026-10-01",
  end_date: "2026-11-09",
  status: "ended",
  days_until_start: 0,
  days_left: 0,
});

const answer = (branch: string) =>
  rpc.mockImplementation(async (name: string) => {
    if (name === "get_launch_event_board") return { data: endedOf(branch), error: null };
    if (name === "board_app_pulse") return { data: pulseOf(branch), error: null };
    return { data: null, error: { message: `no ${name}` } };
  });

const wrap = (ui: ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

// 2026-11-26 (KST) 안에서 18분의 배수인 시각을 0분으로 — 짝수 분 = 마이복서153 · 홀수 분 = 체육관 공지사항 ·
// 가치 전달 아홉 장면이 그 시각에 첫 장면(기록)부터 시작한다(두 분에 한 장면 → 18분 · 1분에 한 장면 → 9분)
const CYCLE = NOTICE_TAB_MS * 18;
const DAY0 = Math.ceil(Date.UTC(2026, 10, 25, 15, 0, 0) / CYCLE) * CYCLE;
let now = DAY0;
beforeEach(() => {
  rpc.mockReset();
  now = DAY0;
  vi.spyOn(Date, "now").mockImplementation(() => now);
});
afterEach(() => vi.restoreAllMocks());

const selectedTab = () => screen.getAllByRole("tab").find((t) => t.getAttribute("aria-selected") === "true")?.textContent ?? "";

describe("TV 2번 「마이복서153」 ↔ 「체육관 공지사항」 탭", () => {
  it("짝수 분 — 가치 전달 장면 · 머리에 두 탭(마이복서153 이 지금 탭)", async () => {
    answer(SUNREUNG);
    wrap(<LaunchEventBoard branchName={SUNREUNG} />);
    expect(await screen.findByRole("article", { name: "마이복서153 · 기록" })).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "TV 2번 탭" })).toBeInTheDocument();
    expect(selectedTab()).toContain("마이복서153");
    expect(screen.getByText("체육관 공지사항")).toBeInTheDocument();
  });

  it("홀수 분 첫 15초 — 샤워실 공지(QR 없이) · 공지 탭이 지금 탭", async () => {
    answer(SUNREUNG);
    now = DAY0 + NOTICE_TAB_MS + 1_000;
    wrap(<LaunchEventBoard branchName={SUNREUNG} />);
    const notice = await screen.findByRole("article", { name: "체육관 공지 · 샤워실" });
    expect(notice).toHaveTextContent("이제 끊기지 않아요");
    expect(notice).toHaveTextContent("최신형 린나이 보일러예요");
    expect(notice).toHaveTextContent("대용량이라 온수가 넉넉해요");
    expect(notice).not.toHaveTextContent("카메라로 찍어요");
    expect(selectedTab()).toContain("체육관 공지사항");
    expect(screen.queryByRole("article", { name: /마이복서153 · / })).toBeNull();
  });

  it("홀수 분 다음 15초씩 — 성향 검사 · 복싱 타이머 · 수강권 결제(QR 하나씩)", async () => {
    answer(SUNREUNG);
    now = DAY0 + NOTICE_TAB_MS + 16_000;
    const a = wrap(<LaunchEventBoard branchName={SUNREUNG} />);
    const style = await screen.findByRole("article", { name: "체육관 공지 · 성향 검사" });
    expect(style).toHaveTextContent("코치님이 알까요?");
    expect(style).toHaveTextContent("예시");
    expect(style).toHaveTextContent("카메라로 찍어요");
    a.unmount();

    now = DAY0 + NOTICE_TAB_MS + 31_000;
    const b = wrap(<LaunchEventBoard branchName={SUNREUNG} />);
    const timer = await screen.findByRole("article", { name: "체육관 공지 · 복싱 타이머" });
    expect(timer).toHaveTextContent("3:00");
    expect(timer).toHaveTextContent("3분 · 쉬기 30초 · 6라운드");
    b.unmount();

    now = DAY0 + NOTICE_TAB_MS + 59_000;
    wrap(<LaunchEventBoard branchName={SUNREUNG} />);
    const pass = await screen.findByRole("article", { name: "체육관 공지 · 수강권 결제" });
    expect(pass).toHaveTextContent("끝난 다음 날부터 이어져요");
    // QR 글은 넉넉한 칸에서 두 줄(「다음 수강권」 · 「보기」)
    expect(pass).toHaveTextContent(/다음 수강권\s*보기/);
    expect(pass).toHaveTextContent("카메라로 찍어요");
  });

  it("다음 짝수 분 — 가치 전달 다음 장면(레벨) · 장면은 두 분에 하나씩", async () => {
    answer(SUNREUNG);
    now = DAY0 + NOTICE_TAB_MS * 2 + 500;
    wrap(<LaunchEventBoard branchName={SUNREUNG} />);
    expect(await screen.findByRole("article", { name: "마이복서153 · 레벨" })).toBeInTheDocument();
  });

  it("공지가 없는 지점은 예전 그대로 — 1분마다 장면 · 탭 표시 없음", async () => {
    answer(CHILGEUM);
    now = DAY0 + NOTICE_TAB_MS + 1_000;
    wrap(<LaunchEventBoard branchName={CHILGEUM} />);
    expect(await screen.findByRole("article", { name: "마이복서153 · 레벨" })).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("article", { name: /체육관 공지/ })).toBeNull();
  });

  it("AppValueReel 단독(tabs 없이)은 예전 그대로 — 자기 시계 · 1분마다", async () => {
    answer(SUNREUNG);
    now = DAY0 + NOTICE_TAB_MS * 3 + 1_000;
    wrap(<AppValueReel branchName={SUNREUNG} />);
    expect(await screen.findByRole("article", { name: "마이복서153 · 마일리지" })).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).toBeNull();
  });
});
