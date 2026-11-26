import { describe, expect, it } from "vitest";
import {
  badgeText,
  groupNotificationsByDay,
  isSafeAppLink,
  normalizeNotification,
  notificationDayLabel,
  notificationTime,
  upgradeNotificationLink,
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

// 2026-11-26 대표님 「내용 누르면 바로 그 부분으로 … 근무 메뉴로는 가는데 PT 확인 메뉴까지는 못 가네」 — 이미 와 있던 알림도 정확한 화면으로
describe("옛 알림 링크 올려 읽기", () => {
  const at = "2026-11-26T01:00:00Z"; // 11/26 10:00 KST
  it("PT 기록 · 이틀 넘은 확인 필요 → PT 확인(그 지점)", () => {
    const l = upgradeNotificationLink("PT 기록 · 이틀 넘은 확인 필요", "선릉역점 · 기록 없는 입장 1건 · 차감 대기 1건", "/office?tab=work", at);
    expect(l).toBe("/office?tab=work&pt=check&b=%EC%84%A0%EB%A6%89%EC%97%AD%EC%A0%90");
    expect(isSafeAppLink(l)).toBe(true);
    expect(new URLSearchParams(l!.split("?")[1]).get("b")).toBe("선릉역점");
  });
  it("지점을 못 읽으면 지점 없이", () => {
    expect(upgradeNotificationLink("PT 기록 · 이틀 넘은 확인 필요", "기록 없는 입장 1건", "/office?tab=work", at)).toBe("/office?tab=work&pt=check");
  });
  it("📍 출근 기록 없음 → 그 코치의 그날", () => {
    const l = upgradeNotificationLink("📍 출근 기록 없음 · 이재현", "11/25 12:00 근무 · 60분이 지나도 출근 기록 · 신고가 없어요", "/office?tab=work", "2026-11-25T04:00:00Z");
    expect(l).toBe("/office?tab=work&staffname=%EC%9D%B4%EC%9E%AC%ED%98%84&day=2026-11-25");
    expect(isSafeAppLink(l)).toBe(true);
  });
  it("새해 첫날 받은 12/31 알림은 지난해 12/31", () => {
    expect(upgradeNotificationLink("📍 출근 기록 없음 · 김코치", "12/31 22:00 근무 · 60분이 지나도", "/office?tab=work", "2027-01-01T00:30:00Z")).toBe(
      "/office?tab=work&staffname=%EA%B9%80%EC%BD%94%EC%B9%98&day=2026-12-31",
    );
  });
  it("이미 정확한 링크 · 다른 근무 알림은 그대로", () => {
    expect(upgradeNotificationLink("PT 기록 확인", "오늘 PT 2건", "/office?tab=work&pt=today", at)).toBe("/office?tab=work&pt=today");
    expect(upgradeNotificationLink("PT 기록 · 이틀 넘은 확인 필요", "선릉역점", "/office?tab=work&pt=check&b=x", at)).toBe("/office?tab=work&pt=check&b=x");
    expect(upgradeNotificationLink("연장 근무 신청", "…", "/office?tab=work", at)).toBe("/office?tab=work");
  });
  it("링크 없던 출석 · 레벨 알림 → 홈", () => {
    expect(upgradeNotificationLink("오늘 출석 완료! 🥊 챔피언 머니 +100", "현재 화이트 리그 Lv.3 — 홈에서 내 카드와 이번 주 순위를 확인하세요", null, at)).toBe("/home");
    expect(upgradeNotificationLink("레벨 4 달성! 🥊", "출석 4회를 채워 자동으로 승급했어요", null, at)).toBe("/home");
    expect(upgradeNotificationLink("승급 심사 대기 중 🥇", "타이틀매치에 도달했어요!", null, at)).toBeNull();
  });
  it("행 정리에서 바로 적용된다", () => {
    const n = normalizeNotification({
      id: "x",
      title: "PT 기록 · 이틀 넘은 확인 필요",
      body: "칠금점 · 차감 대기 1건",
      link: "/office?tab=work",
      read_at: null,
      created_at: at,
    });
    expect(n?.link).toBe("/office?tab=work&pt=check&b=%EC%B9%A0%EA%B8%88%EC%A0%90");
  });
});
