import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useNavigate, type NavigateFunction, type NavigateOptions } from "react-router-dom";
import NewScreenScrollTop from "@/components/NewScreenScrollTop";
import { KEEP_SCROLL_STATE } from "@/lib/newScreenScroll";

// 새 화면은 맨 위부터 (2026-11-19 선릉역점 회원 오류 신고 — 홈 「오늘 우리 체육관」을 다시 누르면 커뮤니티가 맨 밑에서 열림)
//   새 화면으로 갈 때(PUSH · REPLACE)만 맨 위로 · 뒤로 가기(POP) · 주소 뒷부분만 바뀜 · #조각은 그대로

let nav: NavigateFunction | null = null;
const Grab = () => {
  nav = useNavigate();
  return null;
};

const mount = (opts: { disabled?: boolean; at?: string } = {}) =>
  render(
    <MemoryRouter initialEntries={[opts.at ?? "/home"]}>
      <NewScreenScrollTop disabled={opts.disabled} />
      <Grab />
    </MemoryRouter>,
  );

const go = (to: string | number, options?: NavigateOptions) =>
  act(() => {
    if (typeof to === "number") nav!(to);
    else nav!(to, options);
  });

describe("새 화면은 맨 위부터", () => {
  let scrollTo: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    nav = null;
    scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("처음 열 때는 건드리지 않는다(새로고침 · 주소로 바로 열기)", () => {
    mount();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("홈 → 오늘 우리 체육관(커뮤니티) = 맨 위로", () => {
    mount();
    go("/myboxer/community");
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it("커뮤니티 → 뒤로 가기(홈) = 그대로 · 다시 누르면 또 맨 위로", () => {
    mount();
    go("/myboxer/community");
    go(-1);
    expect(scrollTo).toHaveBeenCalledTimes(1); // 뒤로 가기는 브라우저가 보던 자리로
    go("/myboxer/community");
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });

  it("하단 탭으로 홈 → 다른 탭(바꿔 치우기 포함) = 맨 위로", () => {
    mount({ at: "/myboxer/community" });
    go("/home");
    go("/office", { replace: true });
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });

  it("주소 뒷부분(?tab= · ?learn=)만 바뀌면 그대로 — 탭 · 시트가 튀지 않게", () => {
    mount({ at: "/office" });
    go("/office?tab=work");
    go("/office?tab=plan", { replace: true });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("#조각 주소 · keepScroll 은 그대로", () => {
    mount();
    go("/notices#top");
    go("/branch", { state: KEEP_SCROLL_STATE });
    expect(scrollTo).not.toHaveBeenCalled();
    go("/market");
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it("사이니지(disabled)에서는 아무것도 안 한다", () => {
    mount({ disabled: true, at: "/tv/sunreung" });
    go("/tv/sunreung/2");
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
