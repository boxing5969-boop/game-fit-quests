import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LiveBoardGrowthCard from "./LiveBoardGrowthCard";
import { loadGrowthLessons, todayLesson } from "@/data/growthLessons";
import { tvGrowthOf } from "@/lib/growthStage2";

const model = async (day: string) => tvGrowthOf(todayLesson(day, await loadGrowthLessons(day)), day)!;

describe("라이브보드 2번 화면 — 오늘의 1분", () => {
  it("O/X 날 — 퀴즈 없이 다른 날과 같은 모양 (사이니지에 퀴즈는 올리지 않는다 · 2026-11-17 대표님)", async () => {
    render(<LiveBoardGrowthCard model={await model("2026-11-17")} />);
    const card = screen.getByRole("complementary", { name: "오늘의 1분 성장" });
    expect(within(card).getByRole("heading", { level: 2 })).toHaveTextContent("네모난데 왜 ‘링’일까요");
    expect(card).toHaveTextContent("복싱 상식");
    expect(card).toHaveTextContent("180년 넘게 이어진 이름 이야기");
    expect(card).toHaveTextContent("한 사람에게 물어보기");
    expect(card).toHaveTextContent("이야기는 마이복서153 앱 홈에서");
    // 문제 문장 · O/X · 정답 안내 · O · X 칸이 없다
    expect(card.textContent).not.toMatch(/O\/X|정답|처음부터 네모였다/);
    expect(within(card).queryByText(/^[OX]$/)).toBeNull();
  });

  it("그 밖의 날 — 제목 · 한 줄 · 오늘 하나", async () => {
    render(<LiveBoardGrowthCard model={await model("2026-11-18")} />);
    const card = screen.getByRole("complementary", { name: "오늘의 1분 성장" });
    expect(within(card).getByRole("heading", { level: 2 })).toHaveTextContent("잽은 돌아오는 것까지예요");
    expect(card).toHaveTextContent("기술 한 끗");
    expect(card).toHaveTextContent("뻗는 것이 반, 돌아오는 것이 반");
    expect(card).toHaveTextContent("거울 앞 잽 10번");
    expect(card).toHaveTextContent("이야기는 마이복서153 앱 홈에서");
  });

  it("글자는 28px 이상 — 멀리서도 읽히게 (글씨 크기를 숫자로 준 줄만 쓴다)", async () => {
    const { container } = render(<LiveBoardGrowthCard model={await model("2026-11-18")} />);
    const sizes = [...container.innerHTML.matchAll(/text-\[(\d+)px\]/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(4);
    for (const px of sizes) expect(px).toBeGreaterThanOrEqual(28);
    // 이름 붙은 작은 글씨(text-xs · text-sm · text-base …)는 쓰지 않는다
    expect(container.innerHTML).not.toMatch(/\btext-(xs|sm|base|lg|xl|2xl)\b/);
  });
});
