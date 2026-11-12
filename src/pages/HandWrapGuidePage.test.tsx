import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetHandWrapPrefsForTest } from "@/hooks/useHandWrapPrefs";
import HandWrapGuidePage from "./HandWrapGuidePage";

// 집 연습 카드(로그인 · 서버)와 코치 영상 주소는 이 시험의 관심이 아니다
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/components/handwrap/HandWrapPracticeCard", () => ({ default: () => <div data-testid="practice-card" /> }));
vi.mock("@/hooks/useHandWrap", () => ({ useHandWrapVideo: () => ({ data: null }) }));

beforeEach(() => {
  window.localStorage.clear();
  resetHandWrapPrefsForTest();
  Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: vi.fn().mockResolvedValue(undefined) });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLMediaElement.prototype, "load", { configurable: true, value: vi.fn() });
});

afterEach(() => {
  document.body.style.overflow = "";
});

const page = (entry = "/handwrap") =>
  render(
    <MemoryRouter initialEntries={["/home", entry]} initialIndex={1}>
      <HandWrapGuidePage />
    </MemoryRouter>,
  );
const dialog = () => screen.queryByRole("dialog");
const headings = () => screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);

describe("붕대 감기 화면 — 배우는 순서대로 (영상 → 12단계 → 확인 → 집 연습)", () => {
  it("칸 순서 — 영상으로 먼저 보기 · 12단계 설명서 · 다 감았으면 확인해요 · 집에서 혼자 감아 보기 · 이것만 조심해요", () => {
    page();
    expect(headings()).toEqual(["영상으로 먼저 보기", "12단계 설명서", "다 감았으면 확인해요", "집에서 혼자 감아 보기", "이것만 조심해요"]);
    expect(screen.getByLabelText("붕대 감는 전체 영상")).toBeInTheDocument();
    // 지금 있는 설명서 그대로 — 12칸 + 완성
    expect(within(screen.getByRole("list", { name: /붕대 감기 12단계/ })).getAllByRole("listitem")).toHaveLength(13);
    expect(screen.getAllByRole("checkbox")).toHaveLength(5);
    expect(screen.getByTestId("practice-card")).toBeInTheDocument();
    expect(dialog()).toBeNull();
  });

  it("'한 단계씩 따라 감기' · 설명서 칸 · 실수 칸의 '○단계 보기'가 같은 단계 상세를 연다 — 닫으면 원래 화면", () => {
    page();
    fireEvent.click(screen.getByRole("button", { name: /^한 단계씩 따라 감기/ }));
    expect(screen.getByRole("dialog", { name: "붕대 감기 1단계 엄지에 걸기" })).toBeInTheDocument();
    expect(dialog()?.querySelector("video")?.getAttribute("src")).toContain("/handwrap/real/step01.mp4");
    fireEvent.click(within(dialog() as HTMLElement).getByRole("button", { name: "닫기" }));
    expect(dialog()).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "7단계 새끼 쪽 손가락 사이로 — 자세히 보기" }));
    expect(screen.getByRole("dialog", { name: "붕대 감기 7단계 새끼 쪽 손가락 사이로" })).toBeInTheDocument();
    fireEvent.click(within(dialog() as HTMLElement).getByRole("button", { name: "닫기" }));

    fireEvent.click(screen.getByRole("button", { name: "9단계 넘어와 손목 감기 영상 보기" }));
    expect(screen.getByRole("dialog", { name: "붕대 감기 9단계 넘어와 손목 감기" })).toBeInTheDocument();
    fireEvent.click(within(dialog() as HTMLElement).getByRole("button", { name: /다음 10단계/ }));
    expect(screen.getByRole("dialog", { name: "붕대 감기 10단계 다음 손가락 사이로" })).toBeInTheDocument();
    fireEvent.click(within(dialog() as HTMLElement).getByRole("button", { name: "닫기" }));
    expect(dialog()).toBeNull();
  });

  it("감는 손을 한 곳에서 바꾸면 영상 · 큰 흐름 사진 · 설명서 그림 · 확인 사진이 함께 바뀐다", () => {
    page();
    const hero = screen.getByLabelText("붕대 감는 전체 영상");
    const grid = screen.getByRole("list", { name: /붕대 감기 12단계/ });
    const firstThumb = () => grid.querySelector("img")?.getAttribute("src") ?? "";
    expect(hero.querySelector("video")?.className).toContain("-scale-x-100");
    expect(firstThumb()).toContain("/handwrap/steps/step01_s.webp");
    fireEvent.click(within(hero).getByRole("button", { name: "왼손" }));
    expect(hero.querySelector("video")?.className).not.toContain("-scale-x-100");
    expect(firstThumb()).toContain("/handwrap/steps/step01_l_s.webp");
    expect(screen.getByAltText("다 감은 모습 — 손등 쪽").className).not.toContain("-scale-x-100");
    // 설명서 칸의 단추로 되돌려도 영상 칸까지 같이
    fireEvent.click(within(grid.parentElement as HTMLElement).getByRole("button", { name: "오른손" }));
    expect(hero.querySelector("video")?.className).toContain("-scale-x-100");
    expect(within(hero).getByRole("button", { name: "오른손" })).toHaveAttribute("aria-pressed", "true");
  });

  it("주소 ?step=N 으로 바로 들어오면 그 단계 상세가 떠 있다 (13 = 완성)", () => {
    page("/handwrap?step=13");
    expect(screen.getByRole("dialog", { name: "붕대 감기 완성 완성된 모습" })).toBeInTheDocument();
  });
});
