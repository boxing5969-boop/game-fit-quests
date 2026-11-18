import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

import AppValueReel from "./AppValueReel";
import LaunchEventBoard from "./LaunchEventBoard";
import { SCENE_MS } from "@/lib/appValueReel";

// 지어낸 숫자 · 이름만 (저장소가 공개)
const SUNREUNG = "153복싱짐 선릉역점";
const PULSE = {
  branch: SUNREUNG,
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
};
const EVENT_ENDED = {
  branch: SUNREUNG,
  since: "2026-10-01",
  period: "",
  items: [],
  start_date: "2026-10-01",
  end_date: "2026-11-09",
  status: "ended",
  days_until_start: 0,
  days_left: 0,
};
const AWARDS = {
  branch: SUNREUNG,
  status: "ended",
  start_date: "2026-10-01",
  end_date: "2026-11-09",
  items: [
    { category: "attendance", rows: [{ rank: 1, name: "예시 복서", score: 30, paid_points: 50000 }] },
    { category: "app", rows: [{ rank: 1, name: "봄비", score: 100, paid_points: 50000 }] },
  ],
  rules: { enabled: true, attendance: 300, level_up: 300, title_match: 2500, record: 10000 },
};

type Rpc = Record<string, unknown>;
const answer = (map: Rpc) =>
  rpc.mockImplementation(async (name: string) =>
    name in map
      ? map[name] instanceof Error
        ? { data: null, error: { message: String(map[name]) } }
        : { data: map[name], error: null }
      : { data: null, error: { message: `no ${name}` } },
  );

const wrap = (ui: ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

let now = 0;
beforeEach(() => {
  rpc.mockReset();
  now = 0;
  vi.spyOn(Date, "now").mockImplementation(() => now);
});
afterEach(() => vi.restoreAllMocks());

describe("라이브보드 2번 「마이복서153 가치 전달」", () => {
  it("첫 장면(기록) — 빈칸 훅 · 답 · 지난 4주 운동 시간 · QR 하나", async () => {
    answer({ board_app_pulse: PULSE });
    wrap(<AppValueReel branchName={SUNREUNG} />);
    const scene = await screen.findByRole("article", { name: "마이복서153 · 기록" });
    expect(scene).toHaveTextContent("오늘 운동은");
    expect(scene).toHaveTextContent("어디에 남을까요?");
    expect(scene).toHaveTextContent("마이복서153에 저절로 쌓여요");
    expect(scene).toHaveTextContent("1,020");
    expect(scene).toHaveTextContent("회원님 120명이 쌓은 운동 시간");
    expect(scene).toHaveTextContent("내 운동 기록");
    expect(scene).toHaveTextContent("153 건강과 행복. 153복싱짐");
    expect(scene.querySelectorAll("svg[role='img'], svg").length).toBeGreaterThan(0);
    expect(rpc).toHaveBeenCalledWith("board_app_pulse", { p_branch: SUNREUNG, p_key: null });
  });

  it("1분마다 다음 장면 — 4분째는 마일리지(규칙 사다리 · '원' 없이)", async () => {
    answer({ board_app_pulse: PULSE });
    now = SCENE_MS * 3 + 1_000;
    wrap(<AppValueReel branchName={SUNREUNG} />);
    const scene = await screen.findByRole("article", { name: "마이복서153 · 마일리지" });
    expect(scene).toHaveTextContent("결제할 때");
    expect(scene).toHaveTextContent("+10,000");
    expect(scene).toHaveTextContent("35만 2,100점 쌓였어요");
    expect(scene.textContent ?? "").not.toMatch(/\d[\d,]*\s*원/);
  });

  it("숫자를 못 읽으면 숫자 없이 같은 장면 — 기록은 흐름 그림, 레벨은 숫자 없는 답", async () => {
    answer({});
    const first = wrap(<AppValueReel branchName={SUNREUNG} />);
    const rec = await screen.findByRole("article", { name: "마이복서153 · 기록" });
    expect(rec).toHaveTextContent("운동 시간");
    expect(rec.textContent ?? "").not.toMatch(/시간을 쌓은|명이 쌓은/);
    first.unmount();
    now = SCENE_MS * 1 + 500;
    wrap(<AppValueReel branchName={SUNREUNG} />);
    const lv = await screen.findByRole("article", { name: "마이복서153 · 레벨" });
    expect(lv).toHaveTextContent("출석만으로 한 레벨씩 올라가요");
  });
});

describe("라이브보드 2번 왼쪽 칸 — 이벤트가 끝나면 수상자 한 줄 + 가치 전달", () => {
  it("끝난 이벤트: 맨 위 금색 한 줄(1위 이름) · 그 아래 가치 전달 장면 · 예전 큰 축하 제목은 없다", async () => {
    answer({ get_launch_event_board: EVENT_ENDED, board_launch_awards: AWARDS, board_app_pulse: PULSE });
    wrap(<LaunchEventBoard branchName={SUNREUNG} />);
    const strip = await screen.findByRole("note", { name: "런칭 이벤트 1위 축하" });
    expect(strip).toHaveTextContent("런칭 이벤트 1위");
    expect(strip).toHaveTextContent("출석왕");
    expect(strip).toHaveTextContent("예시 복서");
    expect(strip).toHaveTextContent("봄비");
    expect(await screen.findByRole("article", { name: "마이복서153 · 기록" })).toBeInTheDocument();
    expect(screen.queryByText(/축하합니다! 런칭 이벤트 왕좌/)).toBeNull();
  });

  it("수상자를 못 읽으면 한 줄 없이 가치 전달만 · 이벤트 정보를 못 읽어도 가치 전달", async () => {
    answer({ get_launch_event_board: EVENT_ENDED, board_launch_awards: new Error("key"), board_app_pulse: PULSE });
    const first = wrap(<LaunchEventBoard branchName={SUNREUNG} />);
    expect(await screen.findByRole("article", { name: "마이복서153 · 기록" })).toBeInTheDocument();
    expect(screen.queryByRole("note", { name: "런칭 이벤트 1위 축하" })).toBeNull();
    first.unmount();
    answer({ board_app_pulse: PULSE });
    wrap(<LaunchEventBoard branchName={SUNREUNG} />);
    expect(await screen.findByRole("article", { name: "마이복서153 · 기록" })).toBeInTheDocument();
  });

  it("이벤트가 다시 열리면(진행 중) 예전 이벤트 보드 — 가치 전달은 그리지 않는다", async () => {
    answer({
      get_launch_event_board: { ...EVENT_ENDED, status: "active", end_date: "2099-01-01", days_left: 10 },
      board_app_pulse: PULSE,
    });
    wrap(<LaunchEventBoard branchName={SUNREUNG} />);
    await waitFor(() => expect(screen.getByLabelText("153 마이복서 런칭 이벤트")).toBeInTheDocument());
    expect(screen.queryByRole("article", { name: /마이복서153 · / })).toBeNull();
  });
});
