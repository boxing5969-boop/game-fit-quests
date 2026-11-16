import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LiveBoardGrowthCard from "./LiveBoardGrowthCard";
import { loadGrowthLessons, todayLesson } from "@/data/growthLessons";
import { tvGrowthOf } from "@/lib/growthStage2";

const model = async (day: string) => tvGrowthOf(todayLesson(day, await loadGrowthLessons(day)), day)!;

describe("라이브보드 2번 화면 — 오늘의 1분", () => {
  it("O/X 날 — 문제와 O · X, 정답은 앱 홈에서 (TV 에는 답 · 이야기가 없다)", async () => {
    render(<LiveBoardGrowthCard model={await model("2026-11-17")} />);
    const card = screen.getByRole("complementary", { name: "오늘의 1분 성장" });
    expect(within(card).getByRole("heading", { level: 2 })).toHaveTextContent("복싱 링은 처음부터 네모였다.");
    expect(card).toHaveTextContent("복싱 상식 O/X");
    expect(card).toHaveTextContent("정답은 마이복서153 앱 홈에서");
    expect(card).toHaveTextContent("한 사람에게 물어보기");
    expect(card.textContent).not.toMatch(/정답은 [OX]예요|런던/);
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
