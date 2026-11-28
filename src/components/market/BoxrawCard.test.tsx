import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import BoxrawCard from "./BoxrawCard";
import {
  BOXRAW_BRANCHES,
  BOXRAW_CATEGORIES,
  BOXRAW_CODE,
  BOXRAW_COPY,
  BOXRAW_LINK,
  BOXRAW_PRODUCTS,
  BOXRAW_UTM,
  boxrawUrl,
  isBoxrawBranch,
} from "@/data/boxraw";

/** 153 브랜드 금칙 — 가치 전달 · 체육관 공지 시험과 같은 목록 */
const BANNED =
  /국가대표|태릉|선수 ?출신|프로 ?출신|엘리트|메달|최고|프리미엄|압도적|무조건|보장|확정 ?혜택|벨트|계급|급수|잽부터|끝까지 ?붙|정성을 다|고객 만족|가족 같은|믿고 맡겨|년 전통|오삼코치|오사미|—|–|100%|건강 나이|일오삼|실패|밀린|못 ?했|못한/;

afterEach(() => vi.restoreAllMocks());

describe("BOXRAW 전용 링크 · 코드", () => {
  it("대표님이 준 전용 링크 글자 그대로 · 첫 화면 주소 = 전용 링크", () => {
    expect(BOXRAW_LINK).toBe("https://kr.boxraw.com/?utm_source=inst&utm_medium=153boxing");
    expect(boxrawUrl("/")).toBe(BOXRAW_LINK);
    expect(boxrawUrl()).toBe(BOXRAW_LINK);
    expect(BOXRAW_LINK.endsWith(`?${BOXRAW_UTM}`)).toBe(true);
    expect(BOXRAW_CODE).toBe("153boxing20");
  });

  it("공식몰로 가는 주소는 모두 같은 추적 값을 단다", () => {
    expect(boxrawUrl("/product/1ea32v860")).toBe("https://kr.boxraw.com/product/1ea32v860?utm_source=inst&utm_medium=153boxing");
    expect(boxrawUrl("catalog/wraps")).toBe("https://kr.boxraw.com/catalog/wraps?utm_source=inst&utm_medium=153boxing");
    expect(boxrawUrl("/catalog/wraps?page=2")).toBe("https://kr.boxraw.com/catalog/wraps?page=2&utm_source=inst&utm_medium=153boxing");
  });

  it("앰버서더 지점만 — 선릉역점", () => {
    expect(BOXRAW_BRANCHES).toEqual(["153복싱짐 선릉역점"]);
    expect(isBoxrawBranch("153복싱짐 선릉역점")).toBe(true);
    expect(isBoxrawBranch(" 153복싱짐 선릉역점 ")).toBe(true);
    expect(isBoxrawBranch("153복싱짐 칠금점")).toBe(false);
    expect(isBoxrawBranch(null)).toBe(false);
    expect(isBoxrawBranch("")).toBe(false);
  });
});

describe("BOXRAW 제품 · 분류 · 글", () => {
  it("제품 — id 한 번씩 · 공식몰 제품 주소 · 사진 파일이 있다", () => {
    expect(new Set(BOXRAW_PRODUCTS.map((p) => p.id)).size).toBe(BOXRAW_PRODUCTS.length);
    expect(BOXRAW_PRODUCTS.length).toBeGreaterThanOrEqual(4);
    for (const p of BOXRAW_PRODUCTS) {
      expect(p.path, p.id).toMatch(/^\/product\/[a-z0-9]+$/);
      expect(p.image, p.id).toBe(`/market/boxraw/${p.id}.webp`);
      expect(existsSync(resolve(process.cwd(), "public", p.image.slice(1))), p.image).toBe(true);
      expect(p.name.trim(), p.id).toBe(p.name);
      expect(p.name.length).toBeGreaterThan(1);
    }
  });

  it("분류 — 공식몰 분류 주소", () => {
    for (const c of BOXRAW_CATEGORIES) expect(c.path, c.label).toMatch(/^\/catalog\/[a-z0-9-]+$/);
    expect(new Set(BOXRAW_CATEGORIES.map((c) => c.path)).size).toBe(BOXRAW_CATEGORIES.length);
  });

  it("로고 — 공식몰 로고 파일(검정) · 가로 240 × 30", () => {
    const svg = readFileSync(resolve(process.cwd(), "public/market/boxraw/logo.svg"), "utf8");
    expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 240 30"/);
    expect(svg).toContain('fill="#000"');
  });

  it("글 — 153 금칙 · 긴 줄표 없음 · 가격(원 · %) 없음 · 대표님 말(명품 브랜드 · 앰버서더 · 샌드백)", () => {
    const texts = [...Object.values(BOXRAW_COPY), ...BOXRAW_PRODUCTS.map((p) => p.kind), ...BOXRAW_CATEGORIES.map((c) => c.label)];
    for (const t of texts) {
      expect(t, t).not.toMatch(BANNED);
      expect(t, t).not.toMatch(/[0-9,]+ ?원|[0-9]+%/);
    }
    expect(BOXRAW_COPY.title).toContain("복싱계의 명품 브랜드");
    expect(BOXRAW_COPY.line).toContain("앰버서더");
    expect(BOXRAW_COPY.note).toContain("샌드백");
  });
});

describe("마켓 BOXRAW 칸 화면", () => {
  it("로고 · 코드 · 제품 · 분류 · 공식몰 단추 — 모두 새 창 · 추적 값", () => {
    render(<BoxrawCard />);
    expect(screen.getByRole("region", { name: "BOXRAW 공식 앰버서더" })).toBeInTheDocument();
    expect(screen.getByAltText("BOXRAW")).toHaveAttribute("src", "/market/boxraw/logo.svg");
    expect(screen.getByText(BOXRAW_CODE)).toBeInTheDocument();

    const shop = screen.getByRole("link", { name: /BOXRAW 공식몰 바로 가기/ });
    expect(shop).toHaveAttribute("href", BOXRAW_LINK);
    expect(shop).toHaveAttribute("target", "_blank");
    expect(shop.getAttribute("rel")).toContain("noopener");

    const first = BOXRAW_PRODUCTS[0];
    const card = screen.getByRole("link", { name: new RegExp(`^${first.name}`) });
    expect(card).toHaveAttribute("href", boxrawUrl(first.path));
    expect(card).toHaveAttribute("target", "_blank");

    for (const c of BOXRAW_CATEGORIES) {
      expect(screen.getByRole("link", { name: c.label })).toHaveAttribute("href", boxrawUrl(c.path));
    }
    for (const a of screen.getAllByRole("link")) {
      expect(a.getAttribute("href"), a.textContent ?? "").toMatch(/^https:\/\/kr\.boxraw\.com\/.*utm_source=inst&utm_medium=153boxing/);
    }
  });

  it("코드 복사 — 복사되면 「복사됐어요」 · 막힌 기기면 길게 눌러 복사 안내", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const first = render(<BoxrawCard />);
    fireEvent.click(screen.getByRole("button", { name: `할인 코드 ${BOXRAW_CODE} 복사` }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(BOXRAW_CODE));
    expect(await screen.findByText("복사됐어요")).toBeInTheDocument();
    first.unmount();

    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("no")) }, configurable: true });
    render(<BoxrawCard />);
    fireEvent.click(screen.getByRole("button", { name: `할인 코드 ${BOXRAW_CODE} 복사` }));
    expect(await screen.findByText(/길게 눌러 복사해 주세요/)).toBeInTheDocument();
  });
});
