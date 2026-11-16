import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GrowthLessonCard from "./GrowthLessonCard";

let today = "2026-11-17";
let authUser: { id: string } | null = { id: "u1" };

const { markGrowth } = vi.hoisted(() => ({ markGrowth: vi.fn() }));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: authUser }) }));
vi.mock("@/lib/attendanceCheer", () => ({ kstToday: () => today }));
vi.mock("@/services/growthService", () => ({ markGrowth }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
// 서랍(vaul)은 jsdom 에서 열림 애니메이션을 못 해서 — 열렸을 때 안쪽만 그대로 그린다
vi.mock("@/components/ui/drawer", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Drawer: ({ open, children }: { open?: boolean; children?: ReactNode }) => (open ? <div data-testid="drawer">{children}</div> : null),
    DrawerContent: Box,
    DrawerHeader: Box,
    DrawerTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
    DrawerDescription: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  };
});

/** 카드를 그리고 그날의 글(달 파일)을 받을 때까지 기다린다 */
const renderCard = async (text: string) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = () => (
    <QueryClientProvider client={client}>
      <GrowthLessonCard />
    </QueryClientProvider>
  );
  const view = render(ui());
  await screen.findByText(text);
  /** 같은 화면을 다시 그린다 (앱을 켜 둔 채 날이 바뀐 것처럼) */
  return { ...view, again: () => view.rerender(ui()) };
};
/** 홈 카드 (서랍 밖) */
const cardFace = () => screen.getByRole("region", { name: "오늘의 1분 성장" });
/** 카드 몸통을 눌러 서랍을 연다 */
const openCard = () => fireEvent.click(within(cardFace()).getAllByRole("button")[0]);
const drawer = () => within(screen.getByTestId("drawer"));
const stored = (uid = "u1") => JSON.parse(localStorage.getItem(`mb153.growth.read:${uid}`) ?? "{}");

beforeEach(() => {
  localStorage.clear();
  markGrowth.mockReset();
  markGrowth.mockResolvedValue(null);
});
afterEach(() => {
  today = "2026-11-17";
  authUser = { id: "u1" };
});

describe("GrowthLessonCard — 오늘의 1분 성장 (날마다 새 글)", () => {
  it("카드에 요일 코너 이름과 그날 제목 — 열면 오늘 하나 · 출처, 연 기록이 남는다", async () => {
    today = "2026-11-18";
    await renderCard("잽은 돌아오는 것까지예요");
    expect(cardFace()).toHaveTextContent("오늘의 1분 성장 · 기술 한 끗");
    // 문제가 없는 날에는 카드에 O · X 가 없다
    expect(within(cardFace()).getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByTestId("drawer")).toBeNull();
    expect(markGrowth).not.toHaveBeenCalled();

    openCard();
    expect(screen.getByRole("region", { name: "오늘 하나" })).toBeInTheDocument();
    expect(screen.queryByText("오늘의 방향")).toBeNull();
    // 오늘 하나는 번호 없이
    expect(screen.queryByText("1")).toBeNull();
    // 주소 없는 출처는 글자로만
    expect(screen.getByText(/출처 ·/)).toHaveTextContent("153 레벨 과정");
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("region", { name: "O/X 문제" })).toBeNull();

    expect(stored()).toEqual({ "jab-return": { o: "2026-11-18" } });
    expect(markGrowth).toHaveBeenCalledWith(expect.objectContaining({ id: "jab-return", from: "2026-11-18" }), "open", undefined);
  });

  it("주소가 있는 출처는 누르면 새 창으로", async () => {
    today = "2026-11-19";
    await renderCard("운동은 기분에도 닿아요");
    openCard();
    const link = screen.getByRole("link", { name: /영국 스포츠의학 저널/ });
    expect(link).toHaveAttribute("href", "https://blogs.bmj.com/bjsm/?p=10597");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("출처가 없는 글은 출처 줄을 그리지 않는다", async () => {
    today = "2026-11-22";
    await renderCard("이번 주 잘한 것 하나");
    openCard();
    expect(screen.getByText("이번 주 잘한 것 하나", { selector: "h2" })).toBeInTheDocument();
    expect(screen.queryByText(/출처 ·/)).toBeNull();
  });

  it("예전 교육(오늘의 방향 여러 개)은 번호와 함께 예전 모양 그대로", async () => {
    today = "2026-11-10";
    await renderCard("말보다 먼저, 내가 한 라운드");
    // 날마다 글이 아닌 예전 글은 코너 이름 없이
    expect(cardFace()).toHaveTextContent(/^오늘의 1분 성장말보다 먼저/);
    openCard();
    expect(screen.getByRole("region", { name: "오늘의 방향" })).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.queryByText(/출처 ·/)).toBeNull();
    expect(screen.queryByText("지난 글 보기")).toBeNull();
  });

  it("‘오늘 하나 해 볼게요’를 누르면 이 기기에 그날 · 그 글로 남고 카드에 표시된다", async () => {
    today = "2026-11-18";
    await renderCard("잽은 돌아오는 것까지예요");
    openCard();
    fireEvent.click(screen.getByRole("button", { name: "오늘 하나 해 볼게요" }));
    expect(localStorage.getItem("mb153.growth.done:u1:2026-11-18:jab-return")).toBe("1");
    expect(screen.getByText("오늘 실천 약속 완료")).toBeInTheDocument();
    expect(markGrowth).toHaveBeenCalledWith(expect.objectContaining({ id: "jab-return" }), "act", undefined);
  });

  it("앱을 켜 둔 채 날이 바뀌면 — 새 글이 나오고 어제의 약속 표시는 따라오지 않는다", async () => {
    today = "2026-11-18";
    const view = await renderCard("잽은 돌아오는 것까지예요");
    openCard();
    fireEvent.click(screen.getByRole("button", { name: "오늘 하나 해 볼게요" }));
    expect(screen.getByText("오늘 실천 약속 완료")).toBeInTheDocument();

    today = "2026-11-19";
    view.again();
    expect(cardFace()).toHaveTextContent("오늘의 1분 성장 · 몸이 받는 선물");
    expect(cardFace()).toHaveTextContent("운동은 기분에도 닿아요");
    expect(screen.queryByText("오늘 실천 약속 완료")).toBeNull();
  });
});

describe("GrowthLessonCard — 복싱 상식 O/X", () => {
  const QUESTION = "복싱 링은 처음부터 네모였다.";

  it("O/X 날은 카드 앞면이 문제 — 카드에서 고르면 답이 남고 서랍이 열리며 이야기가 나온다", async () => {
    await renderCard(QUESTION);
    expect(cardFace()).toHaveTextContent("오늘의 1분 성장 · 복싱 상식 O/X");
    // 고르기 전에는 제목 대신 문제
    expect(within(cardFace()).queryByText("네모난데 왜 ‘링’일까요")).toBeNull();
    expect(screen.queryByTestId("drawer")).toBeNull();

    fireEvent.click(within(screen.getByRole("group", { name: "O/X 고르기" })).getByRole("button", { name: "X" }));
    expect(stored()).toEqual({ "ox-ring-square": { o: "2026-11-17", q: "X" } });
    expect(markGrowth).toHaveBeenCalledWith(expect.objectContaining({ id: "ox-ring-square" }), "quiz", { pick: "X", right: true });
    expect(markGrowth).toHaveBeenCalledWith(expect.objectContaining({ id: "ox-ring-square" }), "open", undefined);
    // 서랍이 열리고 바로 결과 · 이야기
    expect(drawer().getByRole("status")).toHaveTextContent("맞혔어요!");
    expect(drawer().getByText(/정답은 X예요/)).toBeInTheDocument();
    // 고른 뒤 카드 앞면은 제목으로 · O · X 는 사라진다
    expect(within(cardFace()).getByText("네모난데 왜 ‘링’일까요")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "O/X 고르기" })).toBeNull();
  });

  it("카드 몸통을 누르면 서랍에서 고른다 — 고르기 전에는 이야기 · 오늘 하나가 보이지 않는다", async () => {
    await renderCard(QUESTION);
    openCard();
    const quiz = drawer().getByRole("region", { name: "O/X 문제" });
    expect(within(quiz).getByText(QUESTION)).toBeInTheDocument();
    expect(within(quiz).getByRole("button", { name: "O" })).toBeEnabled();
    expect(within(quiz).getByRole("button", { name: "X" })).toBeEnabled();
    expect(screen.queryByText(/정답은 X예요/)).toBeNull();
    expect(screen.queryByRole("region", { name: "오늘 하나" })).toBeNull();
    expect(screen.queryByRole("button", { name: "오늘 하나 해 볼게요" })).toBeNull();
    expect(screen.queryByText(/출처 ·/)).toBeNull();
    // 열기만 해서는 고른 답이 없다
    expect(stored()).toEqual({ "ox-ring-square": { o: "2026-11-17" } });
  });

  it("맞히면 ‘맞혔어요!’ — 이야기 · 출처 · 오늘 하나가 열리고, 다시 들어와도 고른 답 그대로", async () => {
    const first = await renderCard(QUESTION);
    openCard();
    fireEvent.click(drawer().getByRole("button", { name: "X" }));
    expect(drawer().getByRole("status")).toHaveTextContent("맞혔어요!");
    expect(drawer().getByText(/정답은 X예요/)).toBeInTheDocument();
    expect(drawer().getByRole("link", { name: /세계복싱협회/ })).toHaveAttribute(
      "href",
      "https://www.wbaboxing.com/boxing-news/why-the-ring-is-called-a-ring",
    );
    expect(drawer().getByRole("region", { name: "오늘 하나" })).toBeInTheDocument();
    // 고른 뒤에는 다시 못 고른다
    expect(drawer().getByRole("button", { name: "X · 정답 · 내 답" })).toBeDisabled();
    expect(drawer().getByRole("button", { name: "O" })).toBeDisabled();
    expect(stored()).toEqual({ "ox-ring-square": { o: "2026-11-17", q: "X" } });
    expect(markGrowth).toHaveBeenCalledWith(expect.objectContaining({ id: "ox-ring-square" }), "quiz", { pick: "X", right: true });

    first.unmount();
    await renderCard("네모난데 왜 ‘링’일까요");
    expect(screen.queryByRole("group", { name: "O/X 고르기" })).toBeNull();
    openCard();
    expect(drawer().getByRole("status")).toHaveTextContent("맞혔어요!");
    expect(drawer().getByText(/정답은 X예요/)).toBeInTheDocument();
  });

  it("다른 답을 골라도 나무라는 말 없이 — 정답에 표시만 하고 이야기가 열린다", async () => {
    await renderCard(QUESTION);
    openCard();
    fireEvent.click(drawer().getByRole("button", { name: "O" }));
    expect(drawer().getByRole("status")).toHaveTextContent("오늘 하나 알아 가요");
    expect(drawer().getByRole("button", { name: "O · 내 답" })).toBeDisabled();
    expect(drawer().getByRole("button", { name: "X · 정답" })).toBeDisabled();
    expect(drawer().getByText(/정답은 X예요/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/틀렸|틀린|오답|땡|아쉽|실패/);
    expect(markGrowth).toHaveBeenCalledWith(expect.objectContaining({ id: "ox-ring-square" }), "quiz", { pick: "O", right: false });
  });
});

describe("GrowthLessonCard — 좋아요 · 지난 글", () => {
  it("제목 옆 ♥ 를 켜고 끈다 — 숫자는 서버가 보낼 때만(5명이 넘을 때)", async () => {
    today = "2026-11-18";
    await renderCard("잽은 돌아오는 것까지예요");
    openCard();
    const heart = screen.getByRole("button", { name: "이 글 좋아요" });
    expect(heart).toHaveAttribute("aria-pressed", "false");
    expect(heart).toHaveTextContent("");

    markGrowth.mockResolvedValueOnce(7);
    fireEvent.click(heart);
    const on = screen.getByRole("button", { name: "좋아요 취소" });
    expect(on).toHaveAttribute("aria-pressed", "true");
    expect(stored()["jab-return"]).toEqual({ o: "2026-11-18", h: true });
    expect(markGrowth).toHaveBeenLastCalledWith(expect.objectContaining({ id: "jab-return" }), "heart_on", undefined);
    expect(await within(on).findByText("7")).toBeInTheDocument();

    fireEvent.click(on);
    expect(stored()["jab-return"]).toEqual({ o: "2026-11-18" });
    expect(markGrowth).toHaveBeenLastCalledWith(expect.objectContaining({ id: "jab-return" }), "heart_off", undefined);
    // 5명 아래로 내려가면(서버가 숫자를 안 보내면) 숫자가 사라진다
    await waitFor(() => expect(screen.getByRole("button", { name: "이 글 좋아요" })).toHaveTextContent(""));
  });

  it("지난 글 보기 — 가까운 날부터, 누르면 그 글 · ‘오늘 글로’로 돌아온다", async () => {
    today = "2026-11-20";
    await renderCard("3분 라운드는 1867년에 왔어요");
    openCard();
    const toggle = screen.getByRole("button", { name: "지난 글 보기" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("잽은 돌아오는 것까지예요")).toBeNull();

    fireEvent.click(toggle);
    const past = screen.getByRole("region", { name: "지난 글" });
    const rows = within(past).getAllByRole("listitem");
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent("11/19(목) · 몸이 받는 선물");
    expect(rows[0]).toHaveTextContent("운동은 기분에도 닿아요");
    expect(rows[3]).toHaveTextContent("11/16(월) · 이번 주 한 가지");
    // 안 읽은 글에는 아무 표시가 없다
    expect(within(past).queryByText("읽은 글")).toBeNull();

    fireEvent.click(within(rows[1]).getByRole("button"));
    expect(screen.getByText("지난 글 · 11/18(수) · 기술 한 끗")).toBeInTheDocument();
    expect(screen.getByText("잽은 돌아오는 것까지예요", { selector: "h2" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "해 볼 것 하나" })).toBeInTheDocument();
    // 지난 글에는 오늘의 약속 단추가 없다
    expect(screen.queryByRole("button", { name: "오늘 하나 해 볼게요" })).toBeNull();
    expect(markGrowth).toHaveBeenLastCalledWith(expect.objectContaining({ id: "jab-return", from: "2026-11-18" }), "open", undefined);
    // 읽은 글에만 표시 · 연 날은 오늘
    expect(within(screen.getByRole("region", { name: "지난 글" })).getAllByText("읽은 글")).toHaveLength(1);
    expect(stored()["jab-return"]).toEqual({ o: "2026-11-20" });

    fireEvent.click(screen.getByRole("button", { name: "오늘 글로" }));
    expect(drawer().getByText("오늘의 1분 성장 · 링 위의 이야기")).toBeInTheDocument();
    expect(screen.getByText("3분 라운드는 1867년에 왔어요", { selector: "h2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "오늘 하나 해 볼게요" })).toBeInTheDocument();
  });

  it("지난 O/X 글도 문제부터 — 지난 글에서 고른 답도 남는다", async () => {
    today = "2026-11-20";
    await renderCard("3분 라운드는 1867년에 왔어요");
    openCard();
    fireEvent.click(screen.getByRole("button", { name: "지난 글 보기" }));
    fireEvent.click(screen.getByRole("button", { name: /네모난데 왜 ‘링’일까요/ }));
    expect(screen.getByRole("region", { name: "O/X 문제" })).toBeInTheDocument();
    expect(screen.queryByText(/정답은 X예요/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "X" }));
    expect(screen.getByText(/정답은 X예요/)).toBeInTheDocument();
    expect(stored()["ox-ring-square"]).toEqual({ o: "2026-11-20", q: "X" });
  });

  it("날마다 글이 시작한 날에는 지난 글 줄이 없다", async () => {
    today = "2026-11-16";
    await renderCard("하루 빠져도 습관은 자라요");
    openCard();
    expect(screen.queryByText("지난 글 보기")).toBeNull();
  });

  it("로그인 전이면 서버에 남기지 않는다 (이 기기에는 남는다)", async () => {
    authUser = null;
    today = "2026-11-18";
    await renderCard("잽은 돌아오는 것까지예요");
    openCard();
    fireEvent.click(screen.getByRole("button", { name: "이 글 좋아요" }));
    expect(markGrowth).not.toHaveBeenCalled();
    expect(stored("anon")["jab-return"]).toEqual({ o: "2026-11-18", h: true });
  });
});
