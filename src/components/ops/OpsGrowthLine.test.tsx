import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsGrowthLineView } from "./OpsGrowthLine";
import type { CoachLine } from "@/lib/growthStage2";

vi.mock("@/services/growthStage2Service", () => ({ useGrowthCoach: () => ({ data: undefined }), useGrowthCoachSay: () => ({ mutate: vi.fn(), isPending: false }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const LINE: CoachLine = { line: "링이 왜 ‘링’인지 아세요? 답은 앱 홈에 있어요.", corner: "복싱 상식 O/X", title: "네모난데 왜 ‘링’일까요", quiz: true };

describe("153운영본부 일정 탭 — 오늘의 한마디", () => {
  it("그날의 한 문장이 주인공 · 코너 이름 · 아직이면 쓰는 법 한 줄 — 「전했어요」를 누르면 켠다", () => {
    const onSay = vi.fn();
    render(<OpsGrowthLineView line={LINE} state={{ on: true, mine: false, count: 0 }} onSay={onSay} />);
    const card = screen.getByRole("region", { name: "오늘의 한마디" });
    expect(card).toHaveTextContent("링이 왜 ‘링’인지 아세요? 답은 앱 홈에 있어요.");
    expect(card).toHaveTextContent("복싱 상식 O/X");
    expect(card).toHaveTextContent("수업 시작이나 마무리에 한마디, 의무는 아니에요");
    const btn = screen.getByRole("button", { name: "오늘의 한마디를 수업에서 전했어요" });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(btn);
    expect(onSay).toHaveBeenCalledWith(true);
    // 코치님을 재촉하는 말 · 못한 것을 세는 말이 없다
    expect(card.textContent).not.toMatch(/아직 안|안 했|미완료|0명|빠졌|꼭/);
  });

  it("전했으면 눌린 모양 — 다시 누르면 취소 · 여러 명이면 사람 수만(이름 없이)", () => {
    const onSay = vi.fn();
    const { rerender } = render(<OpsGrowthLineView line={LINE} state={{ on: true, mine: true, count: 1 }} onSay={onSay} />);
    expect(screen.getByText("오늘 회원님께 한마디가 닿았어요")).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: "전했어요 취소" });
    expect(btn).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(btn);
    expect(onSay).toHaveBeenCalledWith(false);
    rerender(<OpsGrowthLineView line={LINE} state={{ on: true, mine: false, count: 2 }} onSay={onSay} />);
    expect(screen.getByText("오늘 2명이 전했어요")).toBeInTheDocument();
  });

  it("저장하는 동안은 누를 수 없다 · 예전 글이면 코너 칩이 없다", () => {
    render(<OpsGrowthLineView line={{ ...LINE, corner: "" }} state={{ on: true, mine: false, count: 0 }} busy onSay={() => {}} />);
    expect(screen.getByRole("button", { name: "오늘의 한마디를 수업에서 전했어요" })).toBeDisabled();
    expect(screen.queryByText("복싱 상식 O/X")).toBeNull();
  });
});
