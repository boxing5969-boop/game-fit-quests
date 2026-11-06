import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HomePullToRefresh from "./HomePullToRefresh";

// jsdom 에는 Touch 생성자가 없어 touches 를 직접 붙인 이벤트로 손가락을 흉내 낸다
function touch(type: string, points: Array<[number, number]>, target: EventTarget = document.body) {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "touches", {
    value: points.map(([clientX, clientY]) => ({ clientX, clientY })),
  });
  act(() => {
    target.dispatchEvent(ev);
  });
}

/** 위에서 아래로 dy 만큼 끌었다 놓기 */
function pullDown(dy: number, dx = 0) {
  touch("touchstart", [[100, 100]]);
  for (let i = 1; i <= 5; i += 1) touch("touchmove", [[100 + (dx * i) / 5, 100 + (dy * i) / 5]]);
  touch("touchend", []);
}

const phase = () => screen.getByTestId("home-pull-refresh").getAttribute("data-phase");

afterEach(() => {
  document.body.style.overflow = "";
});

describe("HomePullToRefresh — 홈 맨 위에서 한 번 더 당기면 새로고침", () => {
  it("충분히 당겼다 놓으면 한 번 새로고침하고 표시가 닫힌다", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(<HomePullToRefresh onRefresh={onRefresh} />);
    pullDown(260);
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
    expect(phase()).toBe("refreshing");
    await waitFor(() => expect(phase()).toBe("idle"), { timeout: 2500 });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("조금만 당기면 새로고침하지 않는다", () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(<HomePullToRefresh onRefresh={onRefresh} />);
    pullDown(60);
    expect(onRefresh).not.toHaveBeenCalled();
    expect(phase()).toBe("idle");
  });

  it("가로로 넘기는 손짓은 새로고침이 아니다", () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(<HomePullToRefresh onRefresh={onRefresh} />);
    touch("touchstart", [[100, 100]]);
    touch("touchmove", [[160, 110]]);
    touch("touchmove", [[200, 400]]);
    touch("touchend", []);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("창이 열려 페이지 스크롤이 잠겨 있으면 받지 않는다", () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(<HomePullToRefresh onRefresh={onRefresh} />);
    document.body.style.overflow = "hidden";
    pullDown(260);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("enabled=false 면 받지 않는다", () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(<HomePullToRefresh onRefresh={onRefresh} enabled={false} />);
    pullDown(260);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("새로고침이 실패해도 표시는 닫힌다", async () => {
    const onRefresh = vi.fn().mockRejectedValue(new Error("offline"));
    render(<HomePullToRefresh onRefresh={onRefresh} />);
    pullDown(260);
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(phase()).toBe("idle"), { timeout: 2500 });
  });
});
