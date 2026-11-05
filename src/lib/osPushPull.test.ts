import { describe, expect, it } from "vitest";
import { mapOsLink, toInboxRows, TITLE_MAX } from "../../supabase/functions/os-push-pull/logic.ts";

const RID = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";
const UID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const MID = "0e7a1c2d-3b4f-4a5b-8c6d-7e8f9a0b1c2d";
const NID = "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d";

describe("os-push-pull — 153OS 알림 링크 → 앱 경로", () => {
  it("정해진 링크만 앱 경로로", () => {
    expect(mapOsLink("home")).toBe("/home");
    expect(mapOsLink("notices")).toBe("/notices");
    expect(mapOsLink(`notice:${NID.toUpperCase()}`)).toBe(`/notices/${NID}`);
    expect(mapOsLink("branch")).toBe("/branch");
    expect(mapOsLink("coaches")).toBe("/branch?tab=coaches");
    expect(mapOsLink("reviews")).toBe("/branch?tab=reviews");
    expect(mapOsLink("inquiries")).toBe("/inquiries");
    expect(mapOsLink(`inquiry:${NID}`)).toBe(`/inquiries/${NID}`);
    expect(mapOsLink("membership")).toBe("/membership");
    expect(mapOsLink(" membership ")).toBe("/membership");
  });

  it("앱에 없는 화면 · 이상한 값은 null (알림함에서 내용만)", () => {
    expect(mapOsLink("classes")).toBeNull();
    expect(mapOsLink(null)).toBeNull();
    expect(mapOsLink("constructor")).toBeNull();
    expect(mapOsLink("https://evil.example")).toBeNull();
    expect(mapOsLink("notice:not-a-uuid-at-all-0000000000000000")).toBeNull();
  });
});

describe("os-push-pull — outbox 줄 정리", () => {
  it("recipient_id 가 이상한 줄은 버리고, 같은 줄은 한 번만", () => {
    const rows = toInboxRows([
      { recipient_id: RID, ranking_app_user_id: UID, message_id: MID, kind: "info", title: "휴관 안내", body: "내일 쉽니다", link: "notices" },
      { recipient_id: RID.toUpperCase(), ranking_app_user_id: UID, message_id: MID, kind: "info", title: "중복", body: "", link: null },
      { recipient_id: "x", ranking_app_user_id: UID, title: "버림" },
      null,
      "문자열",
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      recipient_id: RID,
      message_id: MID,
      user_id: UID,
      kind: "info",
      title: "휴관 안내",
      body: "내일 쉽니다",
      link: "/notices",
    });
  });

  it("앱 계정이 이상하면 user_id null(받기만) · 광고 구분 · 빈 제목 · 긴 제목", () => {
    const [a] = toInboxRows([{ recipient_id: RID, ranking_app_user_id: "nope", kind: "ad", title: "", body: 3, link: "classes" }]);
    expect(a.user_id).toBeNull();
    expect(a.kind).toBe("ad");
    expect(a.title).toBe("153복싱짐 소식");
    expect(a.body).toBe("");
    expect(a.link).toBeNull();
    const [b] = toInboxRows([{ recipient_id: RID, ranking_app_user_id: UID, kind: "weird", title: "가".repeat(200) }]);
    expect(b.kind).toBe("info");
    expect(b.title.length).toBe(TITLE_MAX);
    expect(b.title.endsWith("…")).toBe(true);
  });

  it("배열이 아니면 빈 목록", () => {
    expect(toInboxRows(null)).toEqual([]);
    expect(toInboxRows({ data: [] })).toEqual([]);
  });
});
