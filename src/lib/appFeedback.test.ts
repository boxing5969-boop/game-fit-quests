import { describe, expect, it } from "vitest";
import { commentErrorText, feedbackTabFromParams, myThreadButtonText, waitingForStaff } from "@/lib/appFeedback";

describe("오류 신고 — 첫 탭 (알림 바로 가기)", () => {
  it("회원 답글 알림(?mine=1&id=)은 내 신고 탭", () => {
    expect(feedbackTabFromParams({ mine: true, inbox: false, id: "x" })).toBe("mine");
  });
  it("운영진 알림(?inbox=1&id=) · 옛 링크(?id=)는 받은 신고 탭", () => {
    expect(feedbackTabFromParams({ mine: false, inbox: true, id: "x" })).toBe("inbox");
    expect(feedbackTabFromParams({ mine: false, inbox: false, id: "x" })).toBe("inbox");
  });
  it("주소에 아무것도 없으면 신고 보내기", () => {
    expect(feedbackTabFromParams({ mine: false, inbox: false, id: null })).toBe("send");
  });
});

describe("오류 신고 — 회원 답글 대기", () => {
  it("마지막 댓글이 회원 것일 때만", () => {
    expect(waitingForStaff({ last_comment_staff: false })).toBe(true);
    expect(waitingForStaff({ last_comment_staff: true })).toBe(false);
    expect(waitingForStaff({ last_comment_staff: null })).toBe(false);
    expect(waitingForStaff({})).toBe(false);
  });
});

describe("오류 신고 — 내 신고 댓글 단추", () => {
  it("새 답글이 먼저 · 그다음 댓글 수 · 없으면 남기기", () => {
    expect(myThreadButtonText({ unread: 2, comment_count: 5 })).toBe("새 답글 2");
    expect(myThreadButtonText({ unread: 0, comment_count: 3 })).toBe("댓글 3");
    expect(myThreadButtonText({ unread: 0, comment_count: 0 })).toBe("댓글 남기기");
    expect(myThreadButtonText({})).toBe("댓글 남기기");
  });
});

describe("오류 신고 — 댓글 실패 안내", () => {
  it("하루 한도 · 빈 글 · 그 밖", () => {
    expect(commentErrorText("too_many")).toContain("내일");
    expect(commentErrorText("empty")).toContain("내용");
    expect(commentErrorText("boom")).toContain("다시");
  });
});
