import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import NextLevelDemoStrip from "./NextLevelDemoStrip";
import { nextLevelDemo } from "@/lib/nextLevelGuideSample";

// 홈 「다음 레벨까지」 예시 띠 — 주소 예시는 닫기가 있고, '회원으로 보기' 예시는 닫기 대신 까닭 한 줄 (2026-11-20)
const demo = nextLevelDemo("4")!;

const renderStrip = (viewAsMember?: boolean) =>
  render(
    <MemoryRouter>
      <NextLevelDemoStrip current={demo} viewAsMember={viewAsMember} />
    </MemoryRouter>,
  );

describe("NextLevelDemoStrip", () => {
  it("주소 예시 — 닫기 · 칩 여섯", () => {
    renderStrip();
    expect(screen.getByText(/예시 화면 · 레벨 4/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "닫기" }).getAttribute("href")).toBe("/home");
    expect(screen.queryByText(/회원 예시로 보여요/)).toBeNull();
    expect(screen.getByRole("link", { name: "레벨 4" }).getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("link", { name: "오늘 온 날" }).getAttribute("href")).toBe("/home?lvdemo=today");
  });

  it("회원으로 보기 예시 — 닫기 없음 · 까닭 한 줄 · 칩은 그대로", () => {
    renderStrip(true);
    expect(screen.queryByRole("link", { name: "닫기" })).toBeNull();
    expect(screen.getByText("이 계정은 다음 레벨이 없어 회원 예시로 보여요")).toBeTruthy();
    expect(screen.getByRole("link", { name: "레벨업한 날" }).getAttribute("href")).toBe("/home?lvdemo=up");
    expect(screen.getAllByRole("link")).toHaveLength(6);
  });
});
