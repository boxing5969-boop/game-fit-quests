import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HANDWRAP_STEPS } from "@/data/handWrapGuide";
import { resetHandWrapPrefsForTest } from "@/hooks/useHandWrapPrefs";
import HandWrapStepDetail from "./HandWrapStepDetail";

// jsdom 은 영상을 틀지 못한다 — 부르는 것만 본다
const play = vi.fn().mockResolvedValue(undefined);
const pause = vi.fn();

beforeEach(() => {
  window.localStorage.clear();
  resetHandWrapPrefsForTest();
  play.mockClear();
  pause.mockClear();
  Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: play });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: pause });
});

afterEach(() => {
  document.body.style.overflow = "";
});

const video = () => screen.getByRole("dialog").querySelector("video") as HTMLVideoElement;
const src = () => video().getAttribute("src") ?? "";
const flipped = () => video().className.includes("-scale-x-100");
const tab = (name: string) => screen.getByRole("tab", { name });
const chip = (name: string) => screen.getByRole("button", { name });

describe("붕대 감기 — 한 단계씩 따라 하기 (실제 영상 | 그림)", () => {
  it("처음은 실제 영상 · 절반 속도 — 오른손이면 왼손 영상을 좌우로 뒤집는다", () => {
    render(<HandWrapStepDetail idx={3} onGo={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "붕대 감기 4단계 정권 감기" })).toBeInTheDocument();
    expect(src()).toContain("/handwrap/real/step04.mp4");
    expect(video().getAttribute("poster")).toContain("/handwrap/real/step04.webp");
    expect(flipped()).toBe(true);
    expect(tab("실제 영상")).toHaveAttribute("aria-selected", "true");
    expect(chip("아주 천천히")).toHaveAttribute("aria-pressed", "true");
    expect(chip("오른손")).toHaveAttribute("aria-pressed", "true");
    // 큰 흐름 · 시작 → 끝 · 설명
    expect(screen.getByText("② 정권 3바퀴")).toBeInTheDocument();
    expect(screen.getByText(HANDWRAP_STEPS[3].from)).toBeInTheDocument();
    expect(screen.getByText(HANDWRAP_STEPS[3].to)).toBeInTheDocument();
    expect(screen.getByText("4 / 12")).toBeInTheDocument();
    // 그림 속 표시 읽는 법은 그림으로 볼 때만
    expect(screen.queryByText("손바닥 쪽으로 지나가는 길")).toBeNull();
  });

  it("'그림'을 누르면 같은 단계의 그림 애니메이션 — 뒤집지 않고 · 보통 속도 · 다시 켜도 기억한다", () => {
    const view = render(<HandWrapStepDetail idx={3} onGo={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(tab("그림"));
    expect(src()).toContain("/handwrap/steps/step04.mp4");
    expect(flipped()).toBe(false);
    expect(chip("보통")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("손바닥 쪽으로 지나가는 길")).toBeInTheDocument();
    expect(window.localStorage.getItem("mb153.handwrap.view")).toBe("draw");
    // 왼손 — 따로 만든 왼손 그림
    fireEvent.click(chip("왼손"));
    expect(src()).toContain("/handwrap/steps/step04_l.mp4");
    view.unmount();
    resetHandWrapPrefsForTest();
    render(<HandWrapStepDetail idx={0} onGo={vi.fn()} onClose={vi.fn()} />);
    expect(src()).toContain("/handwrap/steps/step01_l.mp4");
  });

  it("시작 → 끝 옆 작은 그림을 누르면 다른 쪽으로 바뀐다 (영상 ↔ 그림)", () => {
    render(<HandWrapStepDetail idx={6} onGo={vi.fn()} onClose={vi.fn()} />);
    const toDraw = screen.getByRole("button", { name: "그림으로 보기" });
    expect(within(toDraw).getByText("그림 보기")).toBeInTheDocument();
    expect(toDraw.querySelector("img")?.getAttribute("src")).toContain("/handwrap/steps/step07_s.webp");
    fireEvent.click(toDraw);
    expect(src()).toContain("/handwrap/steps/step07.mp4");
    const toReal = screen.getByRole("button", { name: "실제 영상으로 보기" });
    expect(toReal.querySelector("img")?.getAttribute("src")).toContain("/handwrap/real/step07.webp");
    // 오른손이면 영상 끝 장면도 뒤집어 보여 준다
    expect(toReal.querySelector("img")?.className).toContain("-scale-x-100");
    fireEvent.click(toReal);
    expect(src()).toContain("/handwrap/real/step07.mp4");
  });

  it("실제 영상에서 손을 바꾸면 같은 영상을 뒤집기만 한다 (처음부터 다시 틀지 않는다)", () => {
    render(<HandWrapStepDetail idx={1} onGo={vi.fn()} onClose={vi.fn()} />);
    const before = video();
    act(() => {
      fireEvent.playing(before);
    });
    fireEvent.click(chip("왼손"));
    expect(video()).toBe(before);
    expect(flipped()).toBe(false);
    expect(src()).toContain("/handwrap/real/step02.mp4");
    // 움직이는 중이라 끝 장면 덮개는 그대로 숨겨져 있다
    const cover = screen.getByRole("dialog").querySelector("img[alt$='다 감은 모습']") as HTMLImageElement;
    expect(cover.className).toContain("opacity-0");
    fireEvent.click(chip("오른손"));
    expect(flipped()).toBe(true);
  });

  it("속도는 보는 방법마다 따로 — 영상에서 고른 속도가 영상에 걸리고 그림 속도는 그대로", () => {
    render(<HandWrapStepDetail idx={1} onGo={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(chip("천천히"));
    expect(video().playbackRate).toBe(0.75);
    expect(window.localStorage.getItem("mb153.handwrap.rate.real")).toBe("0.75");
    expect(window.localStorage.getItem("mb153.handwrap.rate2")).toBeNull();
    fireEvent.click(tab("그림"));
    expect(chip("보통")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(tab("실제 영상"));
    expect(chip("천천히")).toHaveAttribute("aria-pressed", "true");
  });

  it("영상을 누르면 멈춤 / 다시 — 멈추면 '눌러서 움직이기'", () => {
    render(<HandWrapStepDetail idx={0} onGo={vi.fn()} onClose={vi.fn()} />);
    const v = video();
    let paused = false;
    Object.defineProperty(v, "paused", { configurable: true, get: () => paused });
    fireEvent.click(screen.getByRole("button", { name: "멈추기" }));
    expect(pause).toHaveBeenCalledTimes(1);
    paused = true;
    expect(screen.getByText("눌러서 움직이기")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "움직이는 모습 보기" }));
    expect(play).toHaveBeenCalled();
    expect(v.playbackRate).toBe(0.5);
  });

  it("이전 · 다음 · 단계 바로 가기 · 키보드 · 닫기", () => {
    const onGo = vi.fn();
    const onClose = vi.fn();
    render(<HandWrapStepDetail idx={3} onGo={onGo} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /다음 5단계/ }));
    expect(onGo).toHaveBeenLastCalledWith(4);
    fireEvent.click(screen.getByRole("button", { name: /이전/ }));
    expect(onGo).toHaveBeenLastCalledWith(2);
    fireEvent.click(screen.getByRole("tab", { name: "9단계 넘어와 손목 감기" }));
    expect(onGo).toHaveBeenLastCalledWith(8);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onGo).toHaveBeenLastCalledWith(4);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(onGo).toHaveBeenLastCalledWith(2);
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("완성 칸 — 실제 영상에는 '완성' 표시 · 마지막엔 '처음부터 다시'", () => {
    const onGo = vi.fn();
    render(<HandWrapStepDetail idx={12} onGo={onGo} onClose={vi.fn()} />);
    expect(src()).toContain("/handwrap/real/step13.mp4");
    expect(screen.getByText("④ 손목에서 마무리")).toBeInTheDocument();
    expect(screen.getAllByText("완성").length).toBeGreaterThanOrEqual(2);
    fireEvent.click(screen.getByRole("button", { name: /처음부터 다시/ }));
    expect(onGo).toHaveBeenLastCalledWith(0);
  });

  it("실제 영상이 움직이기 시작하면 다음 단계 영상을 미리 받아 두라고 알린다 (그림으로 볼 땐 · 닫으면 거둔다)", () => {
    const hints = () => Array.from(document.head.querySelectorAll('link[rel="prefetch"]')).map((l) => l.getAttribute("href"));
    const view = render(<HandWrapStepDetail idx={4} onGo={vi.fn()} onClose={vi.fn()} />);
    expect(hints()).toEqual([]);
    act(() => {
      fireEvent.playing(video());
    });
    expect(hints()).toHaveLength(1);
    expect(hints()[0]).toContain("/handwrap/real/step06.mp4");
    fireEvent.click(tab("그림"));
    act(() => {
      fireEvent.playing(video());
    });
    expect(hints()).toEqual([]);
    fireEvent.click(tab("실제 영상"));
    act(() => {
      fireEvent.playing(video());
    });
    expect(hints()).toHaveLength(1);
    view.unmount();
    expect(hints()).toEqual([]);
  });
});
