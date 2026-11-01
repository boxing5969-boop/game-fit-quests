import { describe, expect, it } from "vitest";
import { branchLinks, hoursLines, inquiryBadge, mapHref, ratingText, reviewError, telHref } from "./osContent";

describe("153OS 앱 통로 — 화면 계산", () => {
  it("운영시간: 같은 시간이 이어지는 요일은 묶는다", () => {
    const wk = { closed: false, open: "06:00", close: "23:00" };
    expect(
      hoursLines({ mon: wk, tue: wk, wed: wk, thu: wk, fri: wk, sat: { open: "10:00", close: "18:00" }, sun: { closed: true }, holiday: { closed: true } }),
    ).toEqual(["월~금 06:00~23:00", "토 10:00~18:00", "일 휴무", "공휴일 휴무"]);
  });

  it("운영시간: 비었거나 이상하면 그 요일은 빼고, 없으면 빈 목록", () => {
    expect(hoursLines(null)).toEqual([]);
    expect(hoursLines({ mon: { open: "07:00", close: "22:00" }, tue: { open: "07:00" } })).toEqual(["월 07:00~22:00"]);
  });

  it("문의 상태: 새 답장이 먼저", () => {
    expect(inquiryBadge({ status: "answered", unread_by_member: true })).toEqual({ label: "새 답장", tone: "new" });
    expect(inquiryBadge({ status: "answered", unread_by_member: false }).label).toBe("답장 옴");
    expect(inquiryBadge({ status: "open", unread_by_member: false }).label).toBe("답장 기다림");
    expect(inquiryBadge({ status: "closed", unread_by_member: false }).label).toBe("끝남");
  });

  it("후기 확인: 별점 1~5 · 5자 이상", () => {
    expect(reviewError(0, "좋아요 정말로")).toBe("별점을 골라 주세요");
    expect(reviewError(5, "좋아요")).toBe("후기는 5자 이상 적어 주세요");
    expect(reviewError(5, "  코치님 최고예요  ")).toBeNull();
    expect(reviewError(6, "코치님 최고예요")).toBe("별점을 골라 주세요");
  });

  it("지점 링크: https 만 · 정한 순서", () => {
    expect(
      branchLinks({ blog: "https://blog.naver.com/x", naver_place: "https://naver.me/abc", instagram: "http://insecure", homepage: "javascript:alert(1)" }),
    ).toEqual([
      { key: "naver_place", label: "네이버 플레이스", url: "https://naver.me/abc" },
      { key: "blog", label: "블로그", url: "https://blog.naver.com/x" },
    ]);
    expect(branchLinks(null)).toEqual([]);
  });

  it("전화 · 지도 · 별점 글", () => {
    expect(telHref("02-1234-5678")).toBe("tel:02-1234-5678");
    expect(telHref("문의")).toBeNull();
    expect(mapHref("서울 강남구 테헤란로 1")).toBe(`https://map.naver.com/p/search/${encodeURIComponent("서울 강남구 테헤란로 1")}`);
    expect(mapHref("  ")).toBeNull();
    expect(ratingText(4.75)).toBe("4.8");
    expect(ratingText(null)).toBe("-");
  });
});
