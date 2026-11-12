import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HANDWRAP_FULL } from "@/data/handWrapGuide";
import { resetHandWrapPrefsForTest } from "@/hooks/useHandWrapPrefs";
import HandWrapFullVideo from "./HandWrapFullVideo";

// jsdom 은 영상을 틀지 못한다 — 부르는 것만 보고, 시각은 직접 넣어 준다
const play = vi.fn().mockResolvedValue(undefined);
const pause = vi.fn();
const load = vi.fn();

beforeEach(() => {
  window.localStorage.clear();
  resetHandWrapPrefsForTest();
  play.mockClear();
  pause.mockClear();
  load.mockClear();
  Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: play });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: pause });
  Object.defineProperty(HTMLMediaElement.prototype, "load", { configurable: true, value: load });
});

const video = () => document.querySelector("video") as HTMLVideoElement;
/** 영상이 t초를 지나는 중 */
const at = (t: number) => {
  const v = video();
  Object.defineProperty(v, "currentTime", { configurable: true, writable: true, value: t });
  act(() => {
    fireEvent.timeUpdate(v);
  });
};
const current = () => document.querySelector('[aria-current="step"]')?.getAttribute("aria-label") ?? null;
const stage = (n: number) => screen.getByRole("button", { name: new RegExp(`^${n}\\. `) });

describe("붕대 감기 — 전체 영상으로 먼저 보기 + 순서는 3 · 3 · 3", () => {
  it("처음 — 표지 그림만(영상은 누를 때 받는다) · 내 눈으로 44초 · 오른손이면 좌우 뒤집기 · 큰 흐름 네 칸", () => {
    render(<HandWrapFullVideo onOpenStep={vi.fn()} />);
    const v = video();
    expect(v.getAttribute("src")).toBe(HANDWRAP_FULL.mine.src);
    expect(v.getAttribute("poster")).toBe(HANDWRAP_FULL.mine.poster);
    expect(v.getAttribute("preload")).toBe("none");
    expect(v.className).toContain("-scale-x-100");
    expect(screen.getByText("내 눈으로 · 44초")).toBeInTheDocument();
    expect(screen.getByText("· 소리 없음")).toBeInTheDocument();
    expect(screen.getByText("영상 보기")).toBeInTheDocument();
    expect(screen.getByText("순서는 3 · 3 · 3")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    // 틀기 전에는 불 들어온 칸이 없고, 왜 이 순서인지 한 줄
    expect(current()).toBeNull();
    expect(screen.getByText("손목을 잡고 → 주먹 마디(정권)를 덮고 → 손가락 사이로 고정해요")).toBeInTheDocument();
    expect(play).not.toHaveBeenCalled();
  });

  it("영상을 누르면 틀고, 지나가는 큰 흐름 칸에 불 · 지금 단계 · 까닭 한 줄이 따라 바뀐다", () => {
    render(<HandWrapFullVideo onOpenStep={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "영상 보기" }));
    expect(play).toHaveBeenCalledTimes(1);
    act(() => {
      fireEvent.play(video());
    });
    expect(screen.queryByText("영상 보기")).toBeNull();
    at(1);
    expect(current()).toContain("손목 3바퀴");
    expect(screen.getByText("① 손목 3바퀴 — 손목을 단단히 잡아 줘요")).toBeInTheDocument();
    at(10);
    expect(current()).toContain("정권 3바퀴");
    expect(screen.getByRole("button", { name: "4단계 정권 감기 — 이 단계만 반복해서 보기" })).toBeInTheDocument();
    at(26);
    expect(current()).toContain("손가락 사이 3번");
    expect(screen.getByRole("button", { name: /^10단계 다음 손가락 사이로/ })).toBeInTheDocument();
    at(38);
    expect(current()).toContain("손목에서 마무리");
    expect(screen.getByRole("button", { name: /^12단계/ })).toBeInTheDocument();
    at(43);
    expect(screen.getByRole("button", { name: /^완성 완성된 모습/ })).toBeInTheDocument();
  });

  it("큰 흐름 칸을 누르면 그 부분부터 — 영상 정보를 받기 전이면 받은 뒤 그 초로 간다", () => {
    render(<HandWrapFullVideo onOpenStep={vi.fn()} />);
    const v = video();
    const seeks: number[] = [];
    let now = 0;
    Object.defineProperty(v, "currentTime", {
      configurable: true,
      get: () => now,
      set: (t: number) => {
        now = t;
        seeks.push(t);
      },
    });
    // 아직 영상 정보를 못 받았다 (readyState 0) — 누르면 틀기만 하고 자리는 기억
    fireEvent.click(stage(3));
    expect(play).toHaveBeenCalledTimes(1);
    expect(seeks).toEqual([]);
    expect(current()).toContain("손가락 사이 3번");
    act(() => {
      fireEvent.loadedMetadata(v);
    });
    expect(seeks).toEqual([HANDWRAP_FULL.mine.stageAt[2]]);
    // 받은 뒤에는 바로 그 초로
    Object.defineProperty(v, "readyState", { configurable: true, value: 4 });
    fireEvent.click(stage(2));
    expect(seeks).toEqual([HANDWRAP_FULL.mine.stageAt[2], HANDWRAP_FULL.mine.stageAt[1]]);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("'이 단계만'을 누르면 영상을 멈추고 그 단계 상세를 연다 · '한 단계씩 따라 감기'는 1단계부터", () => {
    const onOpenStep = vi.fn();
    render(<HandWrapFullVideo onOpenStep={onOpenStep} />);
    fireEvent.click(screen.getByRole("button", { name: "영상 보기" }));
    at(20);
    fireEvent.click(screen.getByRole("button", { name: /^8단계 손바닥 건너 엄지 사이로/ }));
    expect(pause).toHaveBeenCalledTimes(1);
    expect(onOpenStep).toHaveBeenLastCalledWith(7);
    fireEvent.click(screen.getByRole("button", { name: /한 단계씩 따라 감기/ }));
    expect(onOpenStep).toHaveBeenLastCalledWith(0);
  });

  it("천천히 — 절반 속도로 · 다시 누르면 보통", () => {
    render(<HandWrapFullVideo onOpenStep={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "천천히 보기" }));
    expect(video().playbackRate).toBe(0.5);
    const on = screen.getByRole("button", { name: /천천히 보는 중/ });
    expect(on).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(on);
    expect(video().playbackRate).toBe(1);
  });

  it("옆에서 보기 — 다른 영상(40초) · 표지부터 · 단계 대신 큰 흐름 이름 · 큰 흐름 초도 그 영상 것", () => {
    render(<HandWrapFullVideo onOpenStep={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "영상 보기" }));
    at(10);
    fireEvent.click(screen.getByRole("button", { name: /옆에서 보기/ }));
    const v = video();
    expect(v.getAttribute("src")).toBe(HANDWRAP_FULL.side.src);
    expect(screen.getByText("옆에서 · 40초")).toBeInTheDocument();
    expect(screen.getByText("영상 보기")).toBeInTheDocument();
    expect(current()).toBeNull();
    expect(screen.queryByRole("button", { name: /이 단계만 반복해서 보기/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "영상 보기" }));
    // 옆에서 찍은 영상은 5초면 이미 정권 (내 눈으로 영상은 아직 손목)
    at(5);
    expect(current()).toContain("정권 3바퀴");
    expect(screen.getByText("② 정권 3바퀴")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /내 눈으로 보기/ }));
    expect(video().getAttribute("src")).toBe(HANDWRAP_FULL.mine.src);
  });

  it("왼손을 고르면 뒤집지 않는다 (영상에 왼손이 찍혀 있다) — 사진도 같이", () => {
    render(<HandWrapFullVideo onOpenStep={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "왼손" }));
    expect(video().className).not.toContain("-scale-x-100");
    for (const img of Array.from(document.querySelectorAll("ol img"))) expect(img.className).not.toContain("-scale-x-100");
    expect(window.localStorage.getItem("mb153.handwrap.hand")).toBe("left");
    fireEvent.click(screen.getByRole("button", { name: "오른손" }));
    for (const img of Array.from(document.querySelectorAll("ol img"))) expect(img.className).toContain("-scale-x-100");
  });

  it("단계 상세가 덮으면 멈춘다 · 다 보면 '처음부터 다시 보기'", () => {
    const view = render(<HandWrapFullVideo onOpenStep={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "영상 보기" }));
    view.rerender(<HandWrapFullVideo onOpenStep={vi.fn()} covered />);
    expect(pause).toHaveBeenCalledTimes(1);
    view.rerender(<HandWrapFullVideo onOpenStep={vi.fn()} />);
    act(() => {
      fireEvent.ended(video());
    });
    expect(screen.getByText("처음부터 다시 보기")).toBeInTheDocument();
  });

  it("영상을 못 받으면 '다시 불러오기' — 누르면 다시 받는다 (틀기 전의 오류는 표시하지 않는다)", () => {
    render(<HandWrapFullVideo onOpenStep={vi.fn()} />);
    act(() => {
      fireEvent.error(video());
    });
    expect(screen.queryByText("다시 불러오기")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "영상 보기" }));
    act(() => {
      fireEvent.error(video());
    });
    expect(screen.getByText("다시 불러오기")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "영상 보기" }));
    expect(load).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("다시 불러오기")).toBeNull();
  });
});
