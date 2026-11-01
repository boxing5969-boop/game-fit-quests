/**
 * 153OS 앱 통로 — 공지사항 · 우리 지점(소개 · 코치 · 후기) · 1:1 문의 (2026-11-02 대표님 「둘 다 차례로」)
 *
 * 글 · 사진 · 후기 · 문의는 153OS(일일경영리포트)에 있다. 회원 화면은 Edge Function os-app-content 만 부르고
 * (src/services/osContentService.ts), 그 함수가 153OS 워커 /api/external/me/* 를 회원 계정으로 부른다.
 * 이 파일은 화면이 쓰는 모양(타입)과 계산만 — 서버 응답 모양은 153-boxing-os docs/partner-api-app-content.md.
 */

// ── 공지 ───────────────────────────────────────────────────────
export interface OsNotice {
  id: string;
  branch_id: string | null;
  title: string;
  body: string;
  pinned: boolean;
  publish_at: string;
  end_at: string | null;
  updated_at: string;
  /** branch = 우리 지점 공지 · all = 전 지점 공지 */
  scope: "branch" | "all";
  /** 목록에만 — 본문 앞 80자 */
  preview?: string;
}

// ── 지점 · 코치 ────────────────────────────────────────────────
export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun", "holiday"] as const;
export type DayKey = (typeof DAY_KEYS)[number];
const DAY_LABEL: Record<DayKey, string> = {
  mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일", holiday: "공휴일",
};
export interface DayHours {
  closed?: boolean;
  open?: string;
  close?: string;
}
export type BusinessHours = Partial<Record<DayKey, DayHours>>;

export interface OsBranchBasics {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  business_hours: BusinessHours | null;
  holiday_note: string | null;
  facility_note: string | null;
}

export interface OsBranchIntro {
  intro: string | null;
  highlights: string[] | null;
  photos: { url: string | null; caption: string | null }[];
  programs: string | null;
  price_note: string | null;
  parking: string | null;
  directions: string | null;
  links: Record<string, string> | null;
}

export interface OsCoach {
  staff_id: string;
  name: string;
  headline: string | null;
  intro: string | null;
  career: string[];
  specialties: string[];
  certificates: string[];
  photo_url: string | null;
}

export interface OsBranchInfo {
  branch: OsBranchBasics | null;
  /** 지점이 153OS 에서 '앱에 보이기'를 켰을 때만 */
  intro: OsBranchIntro | null;
  coaches: OsCoach[];
  reviews: { count: number; avg_rating: number | null };
}

// ── 후기 ───────────────────────────────────────────────────────
export interface OsMyReview {
  id: string;
  rating: number;
  body: string;
  reply: string | null;
  /** 운영진이 숨김 — 나만 보인다 */
  hidden: boolean;
  created_at: string;
  updated_at: string;
}
export interface OsReviewRow {
  id: string;
  /** 첫 글자 + ○○ (153OS 가 가린 이름) */
  author: string;
  rating: number;
  body: string;
  coach_name: string | null;
  reply: string | null;
  replied_at: string | null;
  created_at: string;
  is_mine: boolean;
}
export interface OsReviews {
  mine: OsMyReview | null;
  rows: OsReviewRow[];
}

export const REVIEW_MIN = 5;
export const REVIEW_MAX = 2000;

/** 후기 글 확인 — 153OS 와 같은 규칙(별점 1~5 · 5~2000자) */
export function reviewError(rating: number, body: string): string | null {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return "별점을 골라 주세요";
  const n = body.trim().length;
  if (n < REVIEW_MIN) return `후기는 ${REVIEW_MIN}자 이상 적어 주세요`;
  if (n > REVIEW_MAX) return `후기는 ${REVIEW_MAX.toLocaleString("ko-KR")}자까지예요`;
  return null;
}

// ── 1:1 문의 ───────────────────────────────────────────────────
export const INQUIRY_CATEGORIES = [
  { key: "membership", label: "이용권" },
  { key: "class", label: "수업·예약" },
  { key: "pt", label: "PT" },
  { key: "facility", label: "시설" },
  { key: "refund", label: "환불·양도" },
  { key: "etc", label: "기타" },
] as const;
export type InquiryCategory = (typeof INQUIRY_CATEGORIES)[number]["key"];

export type InquiryStatus = "open" | "answered" | "closed";

export interface OsInquiry {
  id: string;
  category: InquiryCategory;
  category_label: string;
  title: string;
  status: InquiryStatus;
  /** 운영진 답장을 아직 안 봤다 */
  unread_by_member: boolean;
  last_message_at: string;
  created_at: string;
}
export interface OsInquiryMessage {
  id: string;
  sender: "member" | "staff";
  body: string;
  created_at: string;
}
export interface OsInquiryThread {
  inquiry: OsInquiry;
  messages: OsInquiryMessage[];
}

export const INQUIRY_TITLE_MAX = 80;
export const INQUIRY_BODY_MAX = 2000;

/** 목록 오른쪽 상태 한 단어 — 새 답장이 먼저 */
export function inquiryBadge(q: Pick<OsInquiry, "status" | "unread_by_member">): { label: string; tone: "new" | "wait" | "done" } {
  if (q.unread_by_member) return { label: "새 답장", tone: "new" };
  if (q.status === "answered") return { label: "답장 옴", tone: "done" };
  if (q.status === "closed") return { label: "끝남", tone: "done" };
  return { label: "답장 기다림", tone: "wait" };
}

// ── 운영시간 ──────────────────────────────────────────────────
/** 운영시간 줄 — 같은 시간이 이어지는 요일은 묶는다: ['월~금 06:00~23:00', '토 10:00~18:00', '일 휴무', '공휴일 휴무'] */
export function hoursLines(h: BusinessHours | null | undefined): string[] {
  if (!h || typeof h !== "object") return [];
  const text = (k: DayKey): string | null => {
    const d = h[k];
    if (!d || typeof d !== "object") return null;
    if (d.closed) return "휴무";
    return d.open && d.close ? `${d.open}~${d.close}` : null;
  };
  const days = DAY_KEYS.filter((k) => k !== "holiday");
  const out: string[] = [];
  let i = 0;
  while (i < days.length) {
    const t = text(days[i]);
    let j = i;
    while (j + 1 < days.length && text(days[j + 1]) === t) j++;
    if (t) out.push(`${i === j ? DAY_LABEL[days[i]] : `${DAY_LABEL[days[i]]}~${DAY_LABEL[days[j]]}`} ${t}`);
    i = j + 1;
  }
  const holiday = text("holiday");
  if (holiday) out.push(`공휴일 ${holiday}`);
  return out;
}

// ── 지점 링크 ──────────────────────────────────────────────────
const LINK_LABEL: Record<string, string> = {
  naver_place: "네이버 플레이스",
  instagram: "인스타그램",
  youtube: "유튜브",
  blog: "블로그",
  kakao_channel: "카카오톡 채널",
  homepage: "홈페이지",
};
const LINK_ORDER = ["naver_place", "kakao_channel", "instagram", "youtube", "blog", "homepage"];

/** 153OS 가 https 만 남겨 보낸 링크 → 보여 줄 순서 · 이름 */
export function branchLinks(links: Record<string, string> | null | undefined): { key: string; label: string; url: string }[] {
  if (!links || typeof links !== "object") return [];
  return LINK_ORDER.filter((k) => typeof links[k] === "string" && /^https:\/\//.test(links[k])).map((k) => ({
    key: k,
    label: LINK_LABEL[k],
    url: links[k],
  }));
}

/** 별점 평균 한 자리 — 4.75 → '4.8' */
export const ratingText = (n: number | null | undefined): string => (typeof n === "number" ? n.toFixed(1) : "-");

/** 전화 걸기 주소 — 숫자 · + · - 만 */
export const telHref = (phone: string | null | undefined): string | null => {
  const t = (phone ?? "").replace(/[^\d+-]/g, "");
  return t.replace(/\D/g, "").length >= 7 ? `tel:${t}` : null;
};

/** 지도에서 보기(네이버 지도 검색) */
export const mapHref = (address: string | null | undefined): string | null =>
  address && address.trim() ? `https://map.naver.com/p/search/${encodeURIComponent(address.trim())}` : null;
