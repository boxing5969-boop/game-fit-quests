import { describe, expect, it } from "vitest";
import {
  badgeText,
  groupNotificationsByDay,
  isSafeAppLink,
  normalizeNotification,
  notificationDayLabel,
  notificationTime,
  type AppNotification,
} from "./notifications";

// 2026-10-01 18:00 KST
const NOW = new Date("2026-10-01T09:00:00Z");

describe("앱 안 주소만", () => {
  it.each(["/", "/title-match?lv=20", "/myboxer/quest", "/missions?open=practice"])("'%s' 통과", (l) => {
    expect(isSafeAppLink(l)).toBe(true);
  });
  it.each(["//evil.com", "https://evil.com", "/\\evil", "/a b", "javascript:alert(1)", "", null, 3, "x".repeat(301)])(
    "'%s' 거부",
    (l) => {
      expect(isSafeAppLink(l)).toBe(false);
    },
  );
});

describe("행 정리", () => {
  it("기본 모양", () => {
    expect(
      normalizeNotification({ id: "a", title: " 공지 ", body: " 내용 ", link: "/home", read_at: null, created_at: "2026-10-01T08:00:00Z" }),
    ).toEqual({ id: "a", title: "공지", body: "내용", link: "/home", readAt: null, createdAt: "2026-10-01T08:00:00Z" });
  });
  it("위험한 링크는 버리고, 빈 제목은 '알림'", () => {
    const n = normalizeNotification({ id: "b", title: "", body: null, link: "https://evil.com", read_at: "2026-10-01T08:10:00Z", created_at: "2026-10-01T08:00:00Z" });
    expect(n?.link).toBeNull();
    expect(n?.title).toBe("알림");
    expect(n?.body).toBe("");
    expect(n?.readAt).toBe("2026-10-01T08:10:00Z");
  });
  it("id·시각이 없으면 null", () => {
    expect(normalizeNotification({ title: "x" })).toBeNull();
    expect(normalizeNotification(null)).toBeNull();
  });
});

describe("시각", () => {
  it("방금 · N분 전 · 오후 시각", () => {
    expect(notificationTime("2026-10-01T08:59:30Z", NOW)).toBe("방금");
    expect(notificationTime("2026-10-01T08:48:00Z", NOW)).toBe("12분 전");
    expect(notificationTime("2026-10-01T07:51:00Z", NOW)).toBe("오후 4:51");
    expect(notificationTime("2026-09-30T00:05:00Z", NOW)).toBe("오전 9:05");
  });
  it("날짜 묶음 제목 — 한국 날짜 기준 (UTC 로는 같은 날이어도)", () => {
    expect(notificationDayLabel("2026-09-30T15:30:00Z", NOW)).toBe("오늘"); // 10/1 00:30 KST
    expect(notificationDayLabel("2026-09-30T14:30:00Z", NOW)).toBe("어제"); // 9/30 23:30 KST
    expect(notificationDayLabel("2026-09-28T03:00:00Z", NOW)).toBe("9월 28일 월요일");
    expect(notificationDayLabel("2025-12-31T03:00:00Z", NOW)).toBe("2025. 12. 31. 수요일");
  });
  it("배지", () => {
    expect(badgeText(7)).toBe("7");
    expect(badgeText(120)).toBe("99+");
  });
});

describe("날짜별 묶기", () => {
  const n = (id: string, at: string): AppNotification => ({ id, title: id, body: "", link: null, readAt: null, createdAt: at });
  it("최신순 그대로 날짜마다 한 묶음", () => {
    const g = groupNotificationsByDay(
      [n("a", "2026-10-01T08:00:00Z"), n("b", "2026-09-30T16:00:00Z"), n("c", "2026-09-30T10:00:00Z"), n("d", "2026-09-28T03:00:00Z")],
      NOW,
    );
    expect(g.map((d) => [d.label, d.items.map((x) => x.id).join("")])).toEqual([
      ["오늘", "ab"],
      ["어제", "c"],
      ["9월 28일 월요일", "d"],
    ]);
  });
  it("빈 목록", () => {
    expect(groupNotificationsByDay([], NOW)).toEqual([]);
  });
});
