/**
 * 🏢 지점 회의실 — 줌 · 구글 미트 링크 (2026-10-27 대표님 "그렇게하자": 앱 음성 회의 + 바깥 화상회의 링크 둘 다)
 *   서버 _office_video_url(20261027204015)과 같은 규칙:
 *   붙여 넣은 글(줌 초대 글 통째도)에서 첫 링크만 · https · zoom.us · zoom.com(하위 주소 포함) · meet.google.com 만.
 *   회의를 열기 전에 화면에서 먼저 걸러, 회의는 열렸는데 링크만 거절되는 일이 없게 한다.
 */
export type MeetingLinkKind = "zoom" | "meet";

const URL_CHARS = "[A-Za-z0-9._~:/?#@!$&()*+,;=%-]";
const WITH_SCHEME = new RegExp(`https?://${URL_CHARS}+`, "i");
const BARE = new RegExp(`(?:[A-Za-z0-9-]+\\.)*(?:zoom\\.(?:us|com)|meet\\.google\\.com)/${URL_CHARS}*`, "i");

const hostOk = (h: string) =>
  h === "zoom.us" || h === "zoom.com" || h === "meet.google.com" || h.endsWith(".zoom.us") || h.endsWith(".zoom.com");

/** 붙여 넣은 글 → 링크. 비어 있으면 null, 줌 · 구글 미트 링크가 아니면 "bad" */
export function extractMeetingLink(text: string | null | undefined): string | null | "bad" {
  const v = (text ?? "").trim();
  if (!v) return null;
  let url = v.match(WITH_SCHEME)?.[0] ?? null;
  if (!url) {
    const bare = v.match(BARE)?.[0];
    if (bare) url = `https://${bare}`;
  }
  if (!url) return "bad";
  url = url.replace(/[.,;:!?)]+$/, "").replace(/^https?:\/\//i, "https://");
  if (url.length > 500) return "bad";
  const host = url.match(/^https:\/\/([^/?#:]+)/)?.[1]?.toLowerCase();
  if (!host || !hostOk(host)) return "bad";
  return url;
}

export const meetingLinkKind = (url: string): MeetingLinkKind => (/^https:\/\/meet\.google\.com/i.test(url) ? "meet" : "zoom");

export const MEETING_LINK_LABEL: Record<MeetingLinkKind, string> = { zoom: "줌", meet: "구글 미트" };

/** 링크가 이상할 때 화면 글 */
export const MEETING_LINK_BAD = "줌 · 구글 미트 링크만 넣을 수 있어요";
