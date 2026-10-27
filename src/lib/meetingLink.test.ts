import { describe, expect, it } from "vitest";
import { extractMeetingLink, meetingLinkKind } from "./meetingLink";

describe("extractMeetingLink — 서버 _office_video_url 과 같은 규칙", () => {
  it("줌 초대 글을 통째로 붙여 넣어도 첫 링크만 (끝 마침표는 뺀다)", () => {
    expect(
      extractMeetingLink(
        "이용희님이 귀하를 예약된 Zoom 회의에 초대합니다. Zoom 회의 참가 https://us06web.zoom.us/j/88123456789?pwd=AbC123. 회의 ID: 881",
      ),
    ).toBe("https://us06web.zoom.us/j/88123456789?pwd=AbC123");
  });

  it("https 없이 넣은 줌 · 구글 미트 주소", () => {
    expect(extractMeetingLink("zoom.us/j/123456")).toBe("https://zoom.us/j/123456");
    expect(extractMeetingLink("meet.google.com/abc-defg-hij")).toBe("https://meet.google.com/abc-defg-hij");
  });

  it("붙어 있는 한글은 빼고, http 는 https 로", () => {
    expect(extractMeetingLink("링크https://meet.google.com/abc-defg-hij입니다")).toBe("https://meet.google.com/abc-defg-hij");
    expect(extractMeetingLink("http://Company.Zoom.us/my/room)")).toBe("https://Company.Zoom.us/my/room");
  });

  it("줌 · 구글 미트가 아니면 bad — 비슷한 주소 · 앞에 다른 주소를 숨긴 것도", () => {
    expect(extractMeetingLink("https://zoom.us@evil.com/j/1")).toBe("bad");
    expect(extractMeetingLink("https://evil-zoom.us/j/1")).toBe("bad");
    expect(extractMeetingLink("https://zoom.us.evil.com/j/1")).toBe("bad");
    expect(extractMeetingLink("https://example.com/meeting")).toBe("bad");
    expect(extractMeetingLink("그냥 글")).toBe("bad");
  });

  it("비어 있으면 null", () => {
    expect(extractMeetingLink("")).toBeNull();
    expect(extractMeetingLink("   ")).toBeNull();
    expect(extractMeetingLink(null)).toBeNull();
  });

  it("너무 긴 링크는 bad", () => {
    expect(extractMeetingLink(`https://zoom.us/j/1?pwd=${"a".repeat(600)}`)).toBe("bad");
  });
});

describe("meetingLinkKind", () => {
  it("구글 미트 · 줌", () => {
    expect(meetingLinkKind("https://meet.google.com/abc-defg-hij")).toBe("meet");
    expect(meetingLinkKind("https://us06web.zoom.us/j/1")).toBe("zoom");
  });
});
