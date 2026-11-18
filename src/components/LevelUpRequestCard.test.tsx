import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// 홈 첫 화면 「다음 레벨까지」 (missions) — 몇 번 더 오면 되는지 + 이번 레벨 미션 · 레벨 10 타이틀미션.
// 다른 곳(훈련 탭 · 심사 탭 · 랭크업)이 쓰는 기본 모양은 그대로여야 한다.

const state = vi.hoisted(() => ({
  rank: "white",
  level: 4,
  branch: "153복싱짐 선릉역점",
  cycle: null as Record<string, unknown> | null,
  reviewStatus: null as string | null,
  videos: [] as unknown[],
  videosReady: true,
  title: null as Record<string, unknown> | null,
  titleLoading: false,
  titleEnabled: [] as boolean[],
  videoLevels: [] as number[],
  // 홈 레벨 퀘스트 (2026-11-18) — 오늘 왔나 · 마일리지 설정 · 부른 함수 · 읽은 표
  attended: false,
  mileage: null as Record<string, unknown> | null,
  rpcs: [] as string[],
  tables: [] as string[],
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u-test" },
    profile: { branch_name: state.branch },
    progress: { current_rank: state.rank, current_level: state.level },
  }),
}));

vi.mock("@/integrations/supabase/client", () => {
  const chain = (table: string) => {
    state.tables.push(table);
    const q: Record<string, unknown> = {};
    for (const k of ["select", "eq"]) q[k] = () => q;
    q.maybeSingle = async () =>
      table === "app_settings"
        ? { data: state.mileage ? { value: state.mileage } : null, error: null }
        : { data: state.reviewStatus ? { status: state.reviewStatus } : null, error: null };
    return q;
  };
  return {
    supabase: {
      rpc: vi.fn(async (name: string) => {
        state.rpcs.push(name);
        if (name === "get_level_cycle_progress") return { data: state.cycle, error: null };
        if (name === "get_my_workout_today") return { data: { checked_in: state.attended }, error: null };
        return { data: null, error: null };
      }),
      from: (table: string) => chain(table),
    },
  };
});

// 레벨업한 날 꽃가루 — 그리지 않고 불렸는지만
const confettiFn = vi.hoisted(() => vi.fn());
vi.mock("canvas-confetti", () => ({ default: confettiFn }));

vi.mock("@/hooks/useLevelVideos", async (orig) => {
  const real = await orig<typeof import("@/hooks/useLevelVideos")>();
  return {
    ...real,
    useLevelVideos: (_league: string, levelNumber: number) => {
      state.videoLevels.push(levelNumber);
      const on = levelNumber > 0;
      return { data: on && state.videosReady ? state.videos : undefined, isSuccess: on && state.videosReady };
    },
  };
});

vi.mock("@/hooks/useTitleMatchChallenge", () => ({
  useTitleMatchState: (_member: unknown, enabled: boolean) => {
    state.titleEnabled.push(enabled);
    return { data: enabled && !state.titleLoading ? state.title : undefined, isLoading: enabled && state.titleLoading };
  },
}));

// 진짜 훅처럼 지점 기준으로 바꿔 읽는다 — 신청 흐름이 안 열린 지점의 화이트 레벨 10은 담당 코치님
vi.mock("@/hooks/useLevelupRules", async () => {
  const { withBranchAuthority } = await import("@/lib/levelAuthority");
  const rules = [
    { rank: "white", levelAuthority: "coach", titleAuthority: "manager" },
    { rank: "blue", levelAuthority: "coach", titleAuthority: "manager" },
    { rank: "red", levelAuthority: "coach", titleAuthority: "owner" },
  ];
  return { useLevelupRules: () => ({ data: withBranchAuthority(rules, state.branch) }) };
});

import LevelUpRequestCard from "./LevelUpRequestCard";

const video = (id: string, title: string) => ({
  id,
  title,
  description: null,
  keyPoints: [],
  videoUrl: `https://example.com/${id}.mp4`,
  posterUrl: null,
  sortOrder: 0,
  variants: [{ label: "실사", videoUrl: `https://example.com/${id}.mp4`, posterUrl: null }],
});

const L4_VIDEOS = [
  video("m1", "[복싱/스텝] 사이드 방향전환 스텝ㅣ각도 만드는 좌우 풋워크"),
  video("m2", "[복싱/스텝] 원·투·쓰리 스텝ㅣ거리를 지배하는 전진 풋워크"),
];
const L10_VIDEOS = [
  video("t1", "[복싱/콤비] 잽잽 원투 연타 1번ㅣ레벨 미션 동작 ①"),
  video("t2", "[복싱/콤비] 연타 2번·백스텝 카운터ㅣ몰아치고 되받아치기 ②"),
  video("t3", "[복싱/콤비] 레벨10 연타 3번 미션ㅣ최고 난도 연결 동작 ③"),
];

const cycleOf = (over: Record<string, unknown> = {}) => ({
  sessions: 1,
  days: 1,
  minutes: 0,
  progress: 1,
  progressFloor: 1,
  reqSessions: 3,
  reqDays: 3,
  reqMinutes: 0,
  reqMinDays: 0,
  elapsedDays: 5,
  rank: state.rank,
  currentLevel: state.level,
  autoAdvances: true,
  fastTrackGates: 0,
  meets: false,
  ...over,
});

const titleOf = (over: Record<string, unknown> = {}) => ({
  rank: "white",
  level: 10,
  isTitleLevel: true,
  flowEnabled: true,
  cleared: false,
  authority: "manager",
  maxAttempts: 3,
  retryDays: 7,
  retryAt: null,
  challenge: null,
  canRequest: true,
  ...over,
});

const Where = () => {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname + loc.search}</p>;
};

const renderCard = (props: Parameters<typeof LevelUpRequestCard>[0] = {}) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/home"]}>
        <Routes>
          <Route path="/home" element={<LevelUpRequestCard {...props} />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  Object.assign(state, {
    rank: "white",
    level: 4,
    branch: "153복싱짐 선릉역점",
    reviewStatus: null,
    videos: L4_VIDEOS,
    videosReady: true,
    title: null,
    titleLoading: false,
    titleEnabled: [],
    videoLevels: [],
    attended: false,
    mileage: null,
    rpcs: [],
    tables: [],
  });
  state.cycle = cycleOf();
  confettiFn.mockClear();
});

/** 주인공 줄 — 숫자는 민트 조각이라 한 덩어리 글로 찾는다 */
const heroText = (text: string) => (_: string, el: Element | null) => el?.tagName === "P" && el.textContent === text;

describe("레벨업까지 카드 — 기본 모양(훈련 탭 · 심사 탭 · 랭크업)은 그대로", () => {
  it("막대 · 숫자 줄이 있고 미션 칸 · 맨 아래 줄은 없다 — 미션 영상 · 타이틀 상태도 읽지 않는다", async () => {
    renderCard();
    expect(await screen.findByText("2번 더 오면 돼요")).toBeInTheDocument();
    expect(screen.getByText("레벨 5까지")).toBeInTheDocument();
    expect(screen.getByText("출석 1/3회")).toBeInTheDocument();
    expect(screen.queryByText("레벨 4 미션")).toBeNull();
    expect(screen.queryByText("미션 연습하러 가기")).toBeNull();
    expect(screen.queryByRole("region", { name: "다음 레벨까지" })).toBeNull();
    // 레벨 0 = 읽지 않음 · 타이틀 상태도 꺼짐
    expect(state.videoLevels.every((n) => n === 0)).toBe(true);
    expect(state.titleEnabled.every((on) => on === false)).toBe(true);
    // 홈 레벨 퀘스트(도장 · 응원 · 보상)는 홈에만 — 오늘 출석 · 마일리지 설정도 읽지 않는다
    expect(screen.queryByText("반복은 천재를 만든다")).toBeNull();
    expect(screen.queryByRole("list", { name: /수업 도장/ })).toBeNull();
    expect(state.rpcs).not.toContain("get_my_workout_today");
    expect(state.tables).not.toContain("app_settings");
  });

  it("타이틀매치(레벨 10 · 시범 지점) — 예전처럼 단추가 주인공 줄 바로 아래", async () => {
    Object.assign(state, { level: 10 });
    state.cycle = cycleOf();
    renderCard();
    expect(await screen.findByText("타이틀매치만 남았어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /타이틀미션 · 심사 신청/ })).toBeInTheDocument();
    expect(screen.queryByText("타이틀미션")).toBeNull();
  });
});

describe("홈 첫 화면 「다음 레벨까지」 — 레벨 퀘스트(리그 막대 · 이번 목표 · 수업 도장 게이지 · 보상 상자 · 오늘의 퀘스트) + 이번 레벨 미션", () => {
  it("레벨 1~9 — 리그 막대 · 주인공 한 줄 · 수업 도장 · 보상 상자 · 응원 · 오늘의 퀘스트 · 이번 레벨 미션 · 맨 아래 연습 화면 가기", async () => {
    renderCard({ bar: false, missions: true });
    const card = await screen.findByRole("region", { name: "다음 레벨까지" });
    // 리그 막대 — 이미 쌓은 레벨부터 (누르면 레벨 지도)
    expect(within(card).getByRole("button", { name: "화이트 리그 레벨 지도 보기" })).toBeInTheDocument();
    expect(within(card).getByText(heroText("2번 더 오면 레벨 5"))).toBeInTheDocument();
    // 막대 · 숫자 줄 대신 수업 도장 — 화이트 레벨 4 = 10 · 11 · 12일차 (153 수업 매뉴얼과 같은 셈) · 마지막 칸 = 레벨업 도장
    expect(within(card).queryByText("출석 1/3회")).toBeNull();
    const rail = within(card).getByRole("list", { name: "레벨 5까지 수업 도장" });
    expect(within(rail).getAllByRole("listitem").map((li) => li.getAttribute("aria-label"))).toEqual([
      "지금 레벨 4",
      "10일차 수업 · 완료",
      "11일차 수업 · 다음 수업",
      "12일차 수업 · 남은 수업 · 레벨업 도장",
      "목표 레벨 5",
    ]);
    expect(within(rail).getByText("다음 수업")).toBeInTheDocument();
    // 응원 — 대표님 문구 + 그날 한 줄
    expect(within(card).getByText("반복은 천재를 만든다")).toBeInTheDocument();
    // 보상 상자 — XP · 챔피언 머니 (마일리지 설정을 못 읽으면 마일리지 칸 없이 · 레벨 이름을 안 넘기면 기술 줄 없이)
    expect(within(card).getByLabelText("레벨 5 달성 보상 — XP +50 · 챔피언 머니 +500")).toBeInTheDocument();
    // 오늘의 퀘스트 — 오면 바로 받는 것 (실제로 받는 값만)
    const quest = within(card).getByRole("group", { name: "오늘의 퀘스트 — 오면 받아요" });
    expect(within(quest).getByLabelText("도장 +1")).toBeInTheDocument();
    expect(within(quest).getByLabelText("챔피언 머니 +100")).toBeInTheDocument();
    expect(within(card).getByText("레벨 4 미션")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "사이드 방향전환 스텝 영상 보기" })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "원·투·쓰리 스텝 영상 보기" })).toBeInTheDocument();
    // 못한 것은 세지 않는다
    expect(card.textContent).not.toMatch(/0\s*\/\s*2/);

    fireEvent.click(within(card).getByRole("button", { name: /미션 연습하러 가기/ }));
    expect(screen.getByTestId("where").textContent).toBe("/missions?open=practice");
  });

  it("미션을 누르면 그 자리에서 영상 → 「따라했어요」 = 표시 · 훈련 탭과 같은 기기 저장", async () => {
    renderCard({ bar: false, missions: true });
    fireEvent.click(await screen.findByRole("button", { name: "사이드 방향전환 스텝 영상 보기" }));
    const dialog = screen.getByRole("dialog", { name: "사이드 방향전환 스텝 영상" });
    expect(dialog.querySelector("video")?.getAttribute("src")).toBe("https://example.com/m1.mp4");
    fireEvent.click(within(dialog).getByRole("button", { name: /따라했어요/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(JSON.parse(localStorage.getItem("153_video_watched") ?? "{}")).toEqual({ m1: true });
    // 따라 한 미션은 표시가 붙고 뒤로 간다
    const rows = screen.getAllByRole("button", { name: /영상 보기/ }).map((b) => b.getAttribute("aria-label"));
    expect(rows).toEqual(["원·투·쓰리 스텝 영상 보기", "사이드 방향전환 스텝 영상 보기 · 따라 했어요"]);

    // 다시 눌러도 표시가 풀리지 않는다 · 닫기는 표시 없이 닫는다
    fireEvent.click(screen.getByRole("button", { name: "사이드 방향전환 스텝 영상 보기 · 따라 했어요" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /따라했어요/ }));
    expect(JSON.parse(localStorage.getItem("153_video_watched") ?? "{}")).toEqual({ m1: true });
    fireEvent.click(screen.getByRole("button", { name: "원·투·쓰리 스텝 영상 보기" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "닫기" }));
    expect(JSON.parse(localStorage.getItem("153_video_watched") ?? "{}")).toEqual({ m1: true });
  });

  it("영상 목록을 다 읽기 전에는 미션 칸을 그리지 않는다 (목표 글이 잠깐 보였다 바뀌지 않게)", async () => {
    state.videosReady = false;
    renderCard({ bar: false, missions: true, levelGoal: { title: "인앤아웃 잽", goal: "인앤아웃 잽과 카운터를 연결한다" } });
    expect(await screen.findByText(heroText("2번 더 오면 레벨 5"))).toBeInTheDocument();
    expect(screen.queryByText("레벨 4 미션")).toBeNull();
    expect(screen.queryByText("인앤아웃 잽과 카운터를 연결한다")).toBeNull();
  });

  it("미션 영상이 아직 없는 레벨 — 레벨 데이터의 목표 한 줄", async () => {
    Object.assign(state, { rank: "blue", level: 3, videos: [] });
    state.cycle = cycleOf({ reqSessions: 5, progressFloor: 2, progress: 2.25 });
    renderCard({ bar: false, missions: true, levelGoal: { title: "스트레이트 회전 입문", goal: "스트레이트의 회전력과 체중 이동을 배운다" } });
    expect(await screen.findByText(heroText("3번 더 오면 레벨 14"))).toBeInTheDocument();
    // 블루 = 한 레벨 5칸 · 레벨 13 = 41~45일차 · 보너스(0.25)는 다음 칸에
    const rail = screen.getByRole("list", { name: "레벨 14까지 수업 도장" });
    const days = within(rail).getAllByRole("listitem").map((li) => li.getAttribute("aria-label"));
    expect(days).toEqual([
      "지금 레벨 13",
      "41일차 수업 · 완료",
      "42일차 수업 · 완료",
      "43일차 수업 · 다음 수업 · 운동 보너스로 25% 찼어요",
      "44일차 수업 · 남은 수업",
      "45일차 수업 · 남은 수업 · 레벨업 도장",
      "목표 레벨 14",
    ]);
    expect(screen.getByText("레벨 13 미션")).toBeInTheDocument();
    expect(screen.getByText("스트레이트의 회전력과 체중 이동을 배운다")).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: /영상 보기/ })).toHaveLength(0);
  });

  it("레드 리그 — 출석을 채우면 심사 · 보완 요청이면 할 일 한 줄은 남는다", async () => {
    Object.assign(state, { rank: "red", level: 2, videos: [] });
    state.cycle = cycleOf({ reqSessions: 8, progressFloor: 5, progress: 5, autoAdvances: false });
    const { unmount } = renderCard({ bar: false, missions: true, levelGoal: { goal: "타이밍을 읽고 정확한 순간에 친다" } });
    expect(await screen.findByText(heroText("3번 더 오면 승급 심사"))).toBeInTheDocument();
    // 코치 승인 리그 — 챔피언 머니 +1,000
    expect(screen.getByLabelText("레벨 23 달성 보상 — XP +50 · 챔피언 머니 +1,000")).toBeInTheDocument();
    // 심사 리그 — 마지막 칸은 「마지막 도장」
    expect(screen.getByRole("list", { name: "레벨 23까지 수업 도장" }).querySelector('[aria-label$="마지막 도장"]')).not.toBeNull();
    unmount();

    state.reviewStatus = "revision_requested";
    renderCard({ bar: false, missions: true, levelGoal: { goal: "타이밍을 읽고 정확한 순간에 친다" } });
    expect(await screen.findByText("보완 요청이 왔어요")).toBeInTheDocument();
    expect(screen.getByText("더 연습하고 출석하면 다시 심사에 올라가요")).toBeInTheDocument();
  });
});

describe("홈 「다음 레벨까지」 예시 (?lvdemo= — 운영진 미리 보기)", () => {
  it("내 진행 상황 대신 지어낸 값으로 — 출석 · 심사 단계는 서버를 부르지 않는다", async () => {
    // 내 계정은 블랙 레벨 10 · 서버 값도 없음
    Object.assign(state, { rank: "black", level: 10, branch: "153복싱짐 역삼점", videos: L4_VIDEOS });
    state.cycle = null;
    const { supabase } = await import("@/integrations/supabase/client");
    (supabase.rpc as ReturnType<typeof vi.fn>).mockClear();
    const { nextLevelDemo } = await import("@/lib/nextLevelGuideSample");
    const { unmount } = renderCard({ bar: false, missions: true, demo: nextLevelDemo("4")!.data });
    const card = await screen.findByRole("region", { name: "다음 레벨까지" });
    expect(within(card).getByRole("button", { name: "화이트 리그 레벨 지도 보기" })).toBeInTheDocument();
    expect(within(card).getByText(heroText("2번 더 오면 레벨 5"))).toBeInTheDocument();
    expect(within(card).getByText("레벨 4 미션")).toBeInTheDocument();
    expect(supabase.rpc).not.toHaveBeenCalled();
    // 미션 영상은 예시 레벨(4)의 실제 미션을 읽는다 · 타이틀 상태는 읽지 않는다
    expect(state.videoLevels.filter((n) => n > 0).every((n) => n === 4)).toBe(true);
    expect(state.titleEnabled.every((on) => on === false)).toBe(true);
    unmount();

    // 레벨 10 예시 — 시범 지점이 아니어도 타이틀미션 흐름으로
    state.videos = L10_VIDEOS;
    const ten = renderCard({ bar: false, missions: true, demo: nextLevelDemo("10")!.data });
    expect(await screen.findByText("타이틀매치만 남았어요")).toBeInTheDocument();
    expect(screen.getByText("타이틀미션")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /타이틀미션 · 심사 신청/ })).toBeInTheDocument();
    ten.unmount();

    renderCard({ bar: false, missions: true, demo: nextLevelDemo("wait")!.data });
    expect(await screen.findByText("심사를 기다려요")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /타이틀미션 · 심사 신청/ })).toBeNull();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

describe("홈 「다음 레벨까지」 — 레벨 10 타이틀매치", () => {
  beforeEach(() => {
    Object.assign(state, { level: 10, videos: L10_VIDEOS });
    state.cycle = cycleOf();
  });

  it("신청할 수 있을 때 — 타이틀미션 두 줄 · 타이틀매치 동작 · 신청 단추 (같은 곳으로 가는 줄은 또 두지 않는다)", async () => {
    state.title = titleOf();
    renderCard({ bar: false, missions: true });
    const card = await screen.findByRole("region", { name: "다음 레벨까지" });
    expect(within(card).getByRole("button", { name: "화이트 리그 레벨 지도 보기" })).toBeInTheDocument();
    expect(within(card).getByText("타이틀매치만 남았어요")).toBeInTheDocument();
    // 도장 대신 리그 길 — 레벨 1~9 지나옴 → 레벨 10 타이틀매치 · 응원 한 줄 · 넘으면 블루 리그
    const road = within(card).getByRole("list", { name: "리그 길" });
    expect(within(road).getAllByRole("listitem")).toHaveLength(10);
    expect(within(road).getByLabelText("레벨 10 타이틀매치 · 지금")).toBeInTheDocument();
    expect(within(card).queryByRole("list", { name: /수업 도장/ })).toBeNull();
    expect(within(card).getByText("아홉 레벨을 모두 지나왔어요")).toBeInTheDocument();
    expect(within(card).getByLabelText("타이틀매치 통과 보상 — 승급 블루 리그")).toBeInTheDocument();
    // 타이틀매치 날에도 오늘의 퀘스트는 있다 — 도장 칸 없이 (출석이 레벨을 올리지 않는다)
    const quest = within(card).getByRole("group", { name: "오늘의 퀘스트 — 오면 받아요" });
    expect(within(quest).queryByLabelText("도장 +1")).toBeNull();
    expect(within(quest).getByLabelText("챔피언 머니 +100")).toBeInTheDocument();
    expect(within(card).getByText("타이틀미션")).toBeInTheDocument();
    expect(within(card).getByText("완벽한 자세로 3번 연속 성공")).toBeInTheDocument();
    expect(within(card).getByText("같은 동작을 미트로 3번 받아주기")).toBeInTheDocument();
    expect(within(card).getAllByRole("button", { name: /영상 보기/ })).toHaveLength(3);
    expect(within(card).queryByText("타이틀미션 자세히 보기")).toBeNull();
    // 단추는 미션 아래
    const button = within(card).getByRole("button", { name: /타이틀미션 · 심사 신청/ });
    const lastRow = within(card).getAllByRole("button", { name: /영상 보기/ })[2];
    expect(lastRow.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(button);
    expect(screen.getByTestId("where").textContent).toBe("/title-match?lv=10");
  });

  it("상태를 읽는 동안에는 신청 단추를 보이지 않는다", async () => {
    state.titleLoading = true;
    renderCard({ bar: false, missions: true });
    expect(await screen.findByText("타이틀매치만 남았어요")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /타이틀미션 · 심사 신청/ })).toBeNull();
    expect(screen.getByRole("button", { name: /타이틀미션 자세히 보기/ })).toBeInTheDocument();
  });

  it("신청한 뒤 — 「심사를 기다려요」 · 단추 대신 맨 아래 한 줄", async () => {
    state.title = titleOf({
      canRequest: false,
      challenge: { id: "c1", status: "requested", requestedAt: "2026-11-16T01:00:00Z", requestedBySelf: true, closedAt: null, attempts: [] },
    });
    renderCard({ bar: false, missions: true });
    expect(await screen.findByText("심사를 기다려요")).toBeInTheDocument();
    expect(screen.getByText("지점장님이 심사 날짜를 잡아 드려요")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /타이틀미션 · 심사 신청/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /타이틀미션 자세히 보기/ }));
    expect(screen.getByTestId("where").textContent).toBe("/title-match?lv=10");
  });

  it("도전 중 · 다시 신청하는 날", async () => {
    state.title = titleOf({
      canRequest: false,
      challenge: {
        id: "c1",
        status: "requested",
        requestedAt: "2026-11-10T01:00:00Z",
        requestedBySelf: true,
        closedAt: null,
        attempts: [{ no: 1, passed: false, note: null, recordedAt: "2026-11-12T10:00:00Z", videoPath: "u/x.mp4" }],
      },
    });
    const { unmount } = renderCard({ bar: false, missions: true });
    expect(await screen.findByText("도전 중 · 남은 기회 2번")).toBeInTheDocument();
    unmount();

    state.title = titleOf({ canRequest: false, retryAt: "2026-11-22T15:00:00.000Z", challenge: null });
    renderCard({ bar: false, missions: true });
    expect(await screen.findByText("11월 23일부터 다시 신청해요")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /타이틀미션 · 심사 신청/ })).toBeNull();
  });

  it("신청 흐름이 아닌 지점 — 승인 대기 · 타이틀매치 동작 · 연습 화면으로", async () => {
    Object.assign(state, { branch: "153복싱짐 역삼점", reviewStatus: "pending" });
    renderCard({ bar: false, missions: true });
    expect(await screen.findByText("승인을 기다려요")).toBeInTheDocument();
    // 누가 보고 승인하는지 한 줄 — 신청 흐름이 안 열린 지점의 화이트 레벨 10은 담당 코치님
    expect(screen.getByText("담당 코치님이 보고 승인하면 블루 리그")).toBeInTheDocument();
    expect(screen.getByText("타이틀매치 동작")).toBeInTheDocument();
    expect(screen.queryByText("타이틀미션")).toBeNull();
    expect(screen.queryByRole("button", { name: /타이틀미션 · 심사 신청/ })).toBeNull();
    await waitFor(() => expect(state.titleEnabled.every((on) => on === false)).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: /타이틀매치 동작 연습하기/ }));
    expect(screen.getByTestId("where").textContent).toBe("/missions?open=practice");
  });
});

describe("홈 레벨 퀘스트 — 오늘 온 날 · 레벨업한 날 · 레벨 지도 · 마일리지 (2026-11-18)", () => {
  it("오늘 온 날 — 마지막 칸이 「오늘 수업」 · 응원은 오늘 말 · 다음 칸에 운동 보너스 몫", async () => {
    state.attended = true;
    state.cycle = cycleOf({ sessions: 2, days: 2, progressFloor: 2, progress: 2.25 });
    renderCard({ bar: false, missions: true });
    // 남은 출석 1번 — 「1번만 … !」 (목표 기울기)
    expect(await screen.findByText(heroText("1번만 더 오면 레벨 5!"))).toBeInTheDocument();
    const rail = await screen.findByRole("list", { name: "레벨 5까지 수업 도장" });
    await waitFor(() => expect(within(rail).getByText("오늘")).toBeInTheDocument());
    expect(within(rail).getByLabelText("11일차 수업 · 오늘 완료")).toBeInTheDocument();
    expect(within(rail).getByLabelText("12일차 수업 · 다음 수업 · 운동 보너스로 25% 찼어요 · 레벨업 도장")).toBeInTheDocument();
    // 마지막 칸 = 금색 「레벨업」 · 오늘 온 날은 「다음 수업」 이름표 없이
    expect(within(rail).getByText("레벨업")).toBeInTheDocument();
    expect(within(rail).queryByText("다음 수업")).toBeNull();
    // 오늘의 퀘스트 완료 — 받았어요 (도장 +1 · 챔피언 머니 +100)
    const quest = screen.getByRole("group", { name: "오늘의 퀘스트 완료! — 받았어요" });
    expect(within(quest).getByLabelText("도장 +1")).toBeInTheDocument();
    expect(within(quest).getByLabelText("챔피언 머니 +100")).toBeInTheDocument();
    const { CHEER_LINES } = await import("@/lib/levelQuest");
    expect(CHEER_LINES.today.some((line) => screen.queryByText(line))).toBe(true);
    // 오늘 칸 도장 움직임은 이 기기에서 하루 한 번 — 열쇠가 남는다
    expect(Object.keys(localStorage).some((k) => k.startsWith("153lvq:stamp:u-test:"))).toBe(true);
    expect(confettiFn).not.toHaveBeenCalled();
  });

  it("오늘 레벨이 오른 날 — 「레벨 5 달성!」 · 새 레벨 칸은 비어 있고 · 꽃가루는 이 기기에서 한 번", async () => {
    Object.assign(state, { level: 5, attended: true });
    state.cycle = cycleOf({ sessions: 0, days: 0, progressFloor: 0, progress: 0, since: new Date(Date.now() - 60_000).toISOString() });
    const { unmount } = renderCard({ bar: false, missions: true });
    expect(await screen.findByText(heroText("레벨 5 달성!🎉"))).toBeInTheDocument();
    const rail = screen.getByRole("list", { name: "레벨 6까지 수업 도장" });
    expect(within(rail).getAllByRole("listitem").map((li) => li.getAttribute("aria-label"))).toEqual([
      "지금 레벨 5",
      "13일차 수업 · 다음 수업",
      "14일차 수업 · 남은 수업",
      "15일차 수업 · 남은 수업 · 레벨업 도장",
      "목표 레벨 6",
    ]);
    // 보상 상자 = 오늘 받은 레벨 5 보상 · 오늘의 퀘스트 = 레벨업!
    expect(screen.getByLabelText("레벨 5 달성 보상 · 받았어요 — XP +50 · 챔피언 머니 +500")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "오늘의 퀘스트 완료! — 받았어요" })).getByLabelText("레벨업 레벨업!")).toBeInTheDocument();
    const { CHEER_LINES } = await import("@/lib/levelQuest");
    expect(CHEER_LINES.leveledUp.some((line) => screen.queryByText(line))).toBe(true);
    await waitFor(() => expect(confettiFn).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(localStorage.getItem("153lvq:up:u-test:5")).toBe("1");
    unmount();

    // 다시 열어도 꽃가루는 또 터지지 않는다
    renderCard({ bar: false, missions: true });
    expect(await screen.findByText(heroText("레벨 5 달성!🎉"))).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 900));
    expect(confettiFn).toHaveBeenCalledTimes(1);
  });

  it("「레벨 지도 ›」 — 내 카드 승급 막대 대신 랭크업 로드맵으로", async () => {
    renderCard({ bar: false, missions: true });
    fireEvent.click(await screen.findByRole("button", { name: /레벨 지도/ }));
    expect(screen.getByTestId("where").textContent).toBe("/rank-up");
  });

  it("마일리지 설정을 읽으면 보상에 마일리지 칸 — 운영 값 그대로", async () => {
    state.mileage = { enabled: true, attendance: 300, level_up: 300, title_match: 2500, record: 10000 };
    renderCard({ bar: false, missions: true });
    expect(await screen.findByLabelText("레벨 5 달성 보상 — XP +50 · 챔피언 머니 +500 · 마일리지 +300")).toBeInTheDocument();
    // 오늘의 퀘스트에도 출석 마일리지(운영 값)
    expect(within(screen.getByRole("group", { name: "오늘의 퀘스트 — 오면 받아요" })).getByLabelText("마일리지 +300")).toBeInTheDocument();
  });

  it("레벨 이름을 넘기면 보상 상자 맨 아래 「새 기술」 — 다음 레벨에서 배울 것 (v2)", async () => {
    renderCard({ bar: false, missions: true, levelTitle: (lg, lv) => (lg === "white" && lv === 5 ? "안정적인 원투" : null) });
    expect(await screen.findByLabelText("레벨 5 달성 보상 — XP +50 · 챔피언 머니 +500 · 새 기술 안정적인 원투")).toBeInTheDocument();
  });

  it("도장을 다 모았으면 — 「다음 출석 때 레벨 5!」 · 오늘의 퀘스트 = 오늘 오면 레벨업!", async () => {
    state.cycle = cycleOf({ sessions: 3, days: 3, progressFloor: 3, progress: 3.25, meets: true });
    renderCard({ bar: false, missions: true });
    expect(await screen.findByText("다음 출석 때 레벨 5!")).toBeInTheDocument();
    const quest = screen.getByRole("group", { name: "오늘의 퀘스트 — 오면 받아요" });
    expect(within(quest).getByLabelText("레벨업 레벨업!")).toBeInTheDocument();
    expect(within(quest).queryByLabelText("도장 +1")).toBeNull();
  });
});
