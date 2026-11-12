import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  resetHandWrapPrefsForTest,
  setHandWrapHand,
  setHandWrapRate,
  setHandWrapView,
  useHandWrapPrefs,
} from "./useHandWrapPrefs";

beforeEach(() => {
  window.localStorage.clear();
  resetHandWrapPrefsForTest();
});

describe("붕대 감기 — 이 기기에서 고른 것 기억", () => {
  it("처음 — 오른손 · 실제 영상 · 영상은 절반 속도 · 그림은 보통 속도", () => {
    const { result } = renderHook(() => useHandWrapPrefs());
    expect(result.current).toEqual({ hand: "right", view: "real", drawRate: 1, realRate: 0.5 });
  });

  it("예전에 고른 손 · 그림 속도는 그대로 읽는다 (같은 키)", () => {
    window.localStorage.setItem("mb153.handwrap.hand", "left");
    window.localStorage.setItem("mb153.handwrap.rate2", "0.75");
    resetHandWrapPrefsForTest();
    const { result } = renderHook(() => useHandWrapPrefs());
    expect(result.current.hand).toBe("left");
    expect(result.current.drawRate).toBe(0.75);
    expect(result.current.realRate).toBe(0.5);
  });

  it("이상한 값이 남아 있으면 기본값", () => {
    window.localStorage.setItem("mb153.handwrap.hand", "foot");
    window.localStorage.setItem("mb153.handwrap.view", "photo");
    window.localStorage.setItem("mb153.handwrap.rate2", "3");
    window.localStorage.setItem("mb153.handwrap.rate.real", "abc");
    resetHandWrapPrefsForTest();
    const { result } = renderHook(() => useHandWrapPrefs());
    expect(result.current).toEqual({ hand: "right", view: "real", drawRate: 1, realRate: 0.5 });
  });

  it("바꾸면 쓰는 화면이 모두 같이 바뀌고 기기에 남는다", () => {
    const a = renderHook(() => useHandWrapPrefs());
    const b = renderHook(() => useHandWrapPrefs());
    act(() => setHandWrapHand("left"));
    act(() => setHandWrapView("draw"));
    expect(a.result.current.hand).toBe("left");
    expect(b.result.current.hand).toBe("left");
    expect(b.result.current.view).toBe("draw");
    expect(window.localStorage.getItem("mb153.handwrap.hand")).toBe("left");
    expect(window.localStorage.getItem("mb153.handwrap.view")).toBe("draw");
    // 다시 켜도 그대로
    resetHandWrapPrefsForTest();
    const c = renderHook(() => useHandWrapPrefs());
    expect(c.result.current).toMatchObject({ hand: "left", view: "draw" });
  });

  it("속도는 보는 방법마다 따로 — 영상을 천천히 봐도 그림 속도는 그대로", () => {
    const { result } = renderHook(() => useHandWrapPrefs());
    act(() => setHandWrapRate("real", 0.75));
    expect(result.current.realRate).toBe(0.75);
    expect(result.current.drawRate).toBe(1);
    act(() => setHandWrapRate("draw", 0.5));
    expect(result.current.drawRate).toBe(0.5);
    expect(result.current.realRate).toBe(0.75);
    expect(window.localStorage.getItem("mb153.handwrap.rate.real")).toBe("0.75");
    expect(window.localStorage.getItem("mb153.handwrap.rate2")).toBe("0.5");
    // 고를 수 없는 속도는 무시
    act(() => setHandWrapRate("real", 2));
    expect(result.current.realRate).toBe(0.75);
  });
});
