import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { HANDWRAP_DONE_CHECKS } from "@/data/handWrapGuide";
import { resetHandWrapPrefsForTest, setHandWrapHand } from "@/hooks/useHandWrapPrefs";
import HandWrapDoneCheck from "./HandWrapDoneCheck";

beforeEach(() => {
  window.localStorage.clear();
  resetHandWrapPrefsForTest();
});

describe("붕대 감기 — 다 감았으면 확인", () => {
  it("실제 사진 두 장 + 다섯 가지 — 하나씩 누르면 체크, 다 누르면 칭찬 한 줄", () => {
    render(<HandWrapDoneCheck />);
    expect(screen.getByAltText("다 감은 모습 — 손등 쪽")).toBeInTheDocument();
    expect(screen.getByAltText("다 감은 모습 — 주먹 쥔 모습")).toBeInTheDocument();
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(5);
    expect(screen.getByText(/하나라도 아니면 풀고 그 단계부터 다시 감아요 · 0\/5/)).toBeInTheDocument();
    boxes.slice(0, 4).forEach((b) => fireEvent.click(b));
    expect(boxes[0]).toHaveAttribute("aria-checked", "true");
    expect(boxes[4]).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText(/4\/5/)).toBeInTheDocument();
    fireEvent.click(boxes[4]);
    expect(screen.getByText(/잘 감았어요!/)).toBeInTheDocument();
    // 다시 누르면 풀린다
    fireEvent.click(boxes[1]);
    expect(boxes[1]).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByText(/잘 감았어요!/)).toBeNull();
    for (const c of HANDWRAP_DONE_CHECKS) expect(screen.getByText(c)).toBeInTheDocument();
  });

  it("사진은 고른 손에 맞춰 — 오른손이면 좌우 뒤집기 · 왼손이면 그대로", () => {
    const view = render(<HandWrapDoneCheck />);
    for (const img of Array.from(document.querySelectorAll("figure img"))) expect(img.className).toContain("-scale-x-100");
    view.unmount();
    setHandWrapHand("left");
    render(<HandWrapDoneCheck />);
    for (const img of Array.from(document.querySelectorAll("figure img"))) expect(img.className).not.toContain("-scale-x-100");
  });
});
