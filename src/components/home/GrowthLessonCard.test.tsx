import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GrowthLessonCard from "./GrowthLessonCard";

let today = "2026-11-17";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/lib/attendanceCheer", () => ({ kstToday: () => today }));
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

const openCard = () => fireEvent.click(screen.getByRole("button"));

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  today = "2026-11-17";
});

describe("GrowthLessonCard — 오늘의 1분 성장 (날마다 새 글)", () => {
  it("그날의 글 제목이 카드에 보이고, 열면 코너 · 오늘 하나 · 출처 링크가 보인다", () => {
    render(<GrowthLessonCard />);
    expect(screen.getByText("네모난데 왜 ‘링’일까요")).toBeInTheDocument();
    expect(screen.queryByTestId("drawer")).toBeNull();

    openCard();
    expect(screen.getByText(/오늘의 1분 성장 교육 · 복싱 상식 O\/X/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "오늘 하나" })).toBeInTheDocument();
    expect(screen.queryByText("오늘의 방향")).toBeNull();
    // 오늘 하나는 번호 없이
    expect(screen.queryByText("1")).toBeNull();
    const link = screen.getByRole("link", { name: /세계복싱협회/ });
    expect(link).toHaveAttribute("href", "https://www.wbaboxing.com/boxing-news/why-the-ring-is-called-a-ring");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("날이 바뀌면 다른 글 — 주소 없는 출처는 글자로만", () => {
    today = "2026-11-18";
    render(<GrowthLessonCard />);
    expect(screen.getByText("잽은 돌아오는 것까지예요")).toBeInTheDocument();
    openCard();
    expect(screen.getByText(/출처 ·/)).toHaveTextContent("153 레벨 과정");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("출처가 없는 글은 출처 줄을 그리지 않는다", () => {
    today = "2026-11-22";
    render(<GrowthLessonCard />);
    openCard();
    expect(screen.getByText("이번 주 잘한 것 하나", { selector: "h2" })).toBeInTheDocument();
    expect(screen.queryByText(/출처 ·/)).toBeNull();
  });

  it("예전 교육(오늘의 방향 여러 개)은 번호와 함께 예전 모양 그대로", () => {
    today = "2026-11-10";
    render(<GrowthLessonCard />);
    expect(screen.getByText("말보다 먼저, 내가 한 라운드")).toBeInTheDocument();
    openCard();
    expect(screen.getByRole("region", { name: "오늘의 방향" })).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.queryByText(/출처 ·/)).toBeNull();
  });

  it("‘오늘 하나 해 볼게요’를 누르면 이 기기에 그날 · 그 글로 남고 카드에 표시된다", () => {
    render(<GrowthLessonCard />);
    openCard();
    fireEvent.click(screen.getByRole("button", { name: "오늘 하나 해 볼게요" }));
    expect(localStorage.getItem("mb153.growth.done:u1:2026-11-17:ox-ring-square")).toBe("1");
    expect(screen.getByText("오늘 실천 약속 완료")).toBeInTheDocument();
  });
});
