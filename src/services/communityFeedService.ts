/**
 * 153 커뮤니티 — 모두의 피드 · 153 반응 (2026-10-15 대표님: "커뮤니티 개편안대로 — 반응 이름은 153").
 *
 * 서버(supabase/migrations/20261015130000_community_feed_153.sql)가 볼 수 있는 글만 내려준다.
 * 본사 계정은 모든 지점의 모든 글(친구만 · 나만 보기 · 숨긴 글 포함, 30일)이 온다 — 20261016080000_hq_sees_all_community.sql
 *   · get_community_feed       — 코치 이번 주 목표(고정) · 승급 축하(고정) · 오늘 운동 한 줄 · 오늘도 한 판(출석)
 *   · toggle_community_153     — 153 누르기/취소 (내 글에는 못 누름)
 *   · set_journal_entry_options — 글 올린 직후 사진 (+ 공개 범위)
 *   · set_journal_entry_visibility — 쓴 뒤에 내 한 줄 공개 범위 바꾸기
 *   · post_weekly_goal · hide_community_entry · report_community_entry · set_community_auto_post
 * 153·댓글·목표 글에는 보상이 없다. 공식 레벨업과 무관.
 *
 * 공개 범위 3가지 (2026-10-18 대표님: "개인 공개 전체공개 친구만 공개할수있는 기능" — 20261018110000_community_visibility_private.sql)
 *   branch 전체 공개(같은 지점 회원 모두) · partners 친구만(운동 짝꿍 · 최근 서로 응원한 동료) · private 나만 보기.
 *   본사와, 본사가 권한을 준 지점장·코치(자기 지점만)는 공개 범위와 상관없이 본다 — list/set_community_view_grant.
 */
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import { compressImage } from "@/lib/imageCompression";

type SbResult<T> = { data: T | null; error: { message: string } | null };

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await (supabase as any).rpc(name, args)) as SbResult<T>;
  if (error) {
    // 서버가 한국어로 보낸 안내는 그대로, 나머지는 공통 번역
    const msg = error.message ?? "";
    throw new Error(/[가-힣]/.test(msg) ? msg : translateError(error));
  }
  return data as T;
}

export type FeedItemType = "goal" | "promotion" | "journal" | "checkin";
export type ReactTarget = "journal" | "checkin" | "promotion";

/** 한 줄 공개 범위 (2026-10-18) */
export type JournalVisibility = "branch" | "partners" | "private";
export const JOURNAL_VISIBILITIES: readonly JournalVisibility[] = ["branch", "partners", "private"];
export const VISIBILITY_LABEL: Record<JournalVisibility, string> = {
  branch: "전체 공개",
  partners: "친구만",
  private: "나만 보기",
};
/** 누가 보는지 — 고를 때 한 줄로 */
export const VISIBILITY_HINT: Record<JournalVisibility, string> = {
  branch: "우리 지점 회원 모두 볼 수 있어요",
  partners: "운동 짝꿍과 최근 서로 응원한 동료만 볼 수 있어요",
  private: "나만 볼 수 있어요",
};
/** 운영진 안내 — 본사 · 권한 받은 지점장·코치는 공개 범위와 상관없이 본다 */
export const VISIBILITY_STAFF_NOTE = "운영진은 커뮤니티 운영을 위해 모든 글을 볼 수 있어요.";

export interface FeedItem {
  type: FeedItemType;
  id: string;
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  isStaff: boolean;
  staffTitle: string | null;
  league: string;
  level: number;
  at: string;
  pinned: boolean;
  prompt: string | null;
  content: string | null;
  mood: string | null;
  photoUrl: string | null;
  visibility: JournalVisibility | null;
  newbie: boolean;
  promoRank: string | null;
  promoLevel: number | null;
  isMine: boolean;
  /** 글쓴이 지점 — 본사 보기에서 글마다 붙인다 */
  branch?: string | null;
  /** 숨긴 글 (본사 보기에서만 내려온다) */
  hidden?: boolean;
  comments: number;
  count153: number;
  reacted: boolean;
  /** 새 식구 카드 — 받은 환영 인사 수 · 내가 남겼는지 (2026-10-18) */
  welcomes?: number;
  welcomedByMe?: boolean;
}

export interface CommunityFeed {
  success: boolean;
  branch: string | null;
  /** 본사(전체관리자·관리자) — 모든 지점 · 친구만 · 나만 보기 · 숨긴 글까지 (2026-10-16 대표님, 20261016080000_hq_sees_all_community.sql) */
  all_branches?: boolean;
  /** 본사가 보기 권한을 준 지점장·코치 — 자기 지점 글이 공개 범위·숨김과 상관없이 온다 (2026-10-18) */
  granted?: boolean;
  /** 회원 화면으로 보기 — 전체관리자가 고른 지점의 일반 회원 피드 (get_community_feed_member_view) */
  member_view?: boolean;
  is_staff: boolean;
  items: FeedItem[];
}

/** 본사 화면 — 지점장·코치 한 명과 보기 권한 */
export interface ViewGrantStaff {
  user_id: string;
  name: string;
  title: string;
  branch: string | null;
  avatar_url: string | null;
  granted: boolean;
  granted_at: string | null;
}

/** 피드 글(목표 포함)의 153 대상 종류 */
export const reactTargetOf = (t: FeedItemType): ReactTarget => (t === "goal" ? "journal" : t);

export const getCommunityFeed = (limit = 40) => rpc<CommunityFeed>("get_community_feed", { p_limit: limit });

/** 회원 화면으로 보기 (전체관리자) — 그 지점 일반 회원이 보는 그대로: 전체 공개 글 · 목표 · 승급 · 오늘도 한 판 · 새 식구 */
export const getCommunityFeedMemberView = (branch: string, limit = 40) =>
  rpc<CommunityFeed>("get_community_feed_member_view", { p_branch: branch, p_limit: limit });

/** 새 식구 환영 인사 (2026-10-18) — 같은 지점, 한 사람 한 번(다시 쓰면 고쳐짐), 첫 출석 뒤 7일까지 */
export interface WelcomeItem {
  id: string;
  senderId: string;
  name: string;
  avatarUrl: string | null;
  isStaff: boolean;
  message: string;
  at: string;
  isMine: boolean;
}
export const WELCOME_PRESETS = ["환영합니다!", "같이 열심히 해요!", "반가워요, 화이팅!", "편하게 물어보세요!"] as const;

export const sendCommunityWelcome = (newbieId: string, message: string) =>
  rpc<{ success: boolean; new: boolean; count: number }>("send_community_welcome", { p_newbie: newbieId, p_message: message });

export const getCommunityWelcomes = (newbieId: string) =>
  rpc<{ items: WelcomeItem[] }>("get_community_welcomes", { p_newbie: newbieId });

export const toggle153 = (type: ReactTarget, id: string) =>
  rpc<{ success: boolean; reacted: boolean; count153: number }>("toggle_community_153", { p_type: type, p_id: id });

export const setJournalEntryOptions = (entryId: string, visibility: JournalVisibility, photoUrl: string | null) =>
  rpc<{ success: boolean }>("set_journal_entry_options", {
    p_entry_id: entryId,
    p_visibility: visibility,
    p_photo_url: photoUrl,
  });

export const setJournalEntryVisibility = (entryId: string, visibility: JournalVisibility) =>
  rpc<{ success: boolean; visibility: JournalVisibility }>("set_journal_entry_visibility", {
    p_entry_id: entryId,
    p_visibility: visibility,
  });

export const listCommunityViewStaff = () => rpc<{ staff: ViewGrantStaff[] }>("list_community_view_staff");

export const setCommunityViewGrant = (userId: string, on: boolean) =>
  rpc<{ success: boolean; granted: boolean }>("set_community_view_grant", { p_user_id: userId, p_on: on });

export const postWeeklyGoal = (content: string) => rpc<{ success: boolean; entry_id: string }>("post_weekly_goal", { p_content: content });

export const hideCommunityEntry = (entryId: string) => rpc<{ success: boolean }>("hide_community_entry", { p_entry_id: entryId });

export const reportCommunityEntry = (entryId: string, reason: string) =>
  rpc<{ success: boolean }>("report_community_entry", { p_entry_id: entryId, p_reason: reason });

export const setCommunityAutoPost = (on: boolean) => rpc<{ success: boolean; on: boolean }>("set_community_auto_post", { p_on: on });

/* ─── 커뮤니티 1단계 (2026-10-27 대표님 "니가 추천해주는대로 진행" — 20261027231653_community_phase1.sql) ─── */

/** 받은 153 — 보낸 동료 한 명 (돌려줄 카드 = 그 동료의 가장 최근 카드, 없으면 null) */
export interface Received153Sender {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  isStaff: boolean;
  staffTitle: string | null;
  branch: string | null;
  league: string;
  level: number;
  count: number;
  lastAt: string;
  returnTarget: { type: ReactTarget; id: string; at: string } | null;
  /** 돌려줄 카드에 내가 이미 153 을 눌렀나 */
  returned: boolean;
}

export interface Received153 {
  success: boolean;
  days: number;
  total: number;
  today: number;
  senders: Received153Sender[];
}

export const getMyReceived153 = (days = 7) => rpc<Received153>("get_my_received_153", { p_days: days });

/** 홈 '오늘 우리 체육관' 띠 숫자 */
export interface CommunityHomeStrip {
  success: boolean;
  reason?: string;
  branch: string | null;
  all_branches?: boolean;
  /** 아직 앱에서 숨겨 둔 지점이면 false — 띠를 보이지 않는다 */
  visible?: boolean;
  working_now?: number;
  today?: number;
  new_count?: number;
  received_today?: number;
  /** 오늘 우리 지점에 올라온 남의 운동 모집 수 ('오늘 같이 해요', 2026-10-28) */
  calls?: number;
}

export const getCommunityHomeStrip = (since: string | null) =>
  rpc<CommunityHomeStrip>("get_community_home_strip", { p_since: since });

/** 매주 볼 숫자 (운영진) — 핵심: 커뮤니티 활동 회원 비율 */
export interface CommunityWeeklyMetrics {
  success: boolean;
  branch: string;
  week_start: string;
  week_end: string;
  attendees: number;
  active: number;
  active_rate: number;
  member_153: number;
  posters: number;
  posts: number;
  comments: number;
  cheers: number;
  hearts: number;
  welcomes: number;
  attendees_30d: number;
  app_30d: number;
  app_rate_30d: number;
  /** 운동 모집 (2026-10-28) — 올라온 모집 · 저요가 붙은 모집 · 같이 운동한 쌍(둘 다 그날 출석) · 회원이 올린 모집 */
  calls?: number;
  calls_joined?: number;
  call_pairs?: number;
  member_calls?: number;
}

export const getCommunityWeeklyMetrics = (branch: string | null, weekStart: string | null) =>
  rpc<CommunityWeeklyMetrics>("community_weekly_metrics", { p_branch: branch, p_week_start: weekStart });

/** 커뮤니티를 마지막으로 연 때 — 홈 띠의 '새 소식'은 이 뒤에 올라온 것 (기기 · 계정별) */
const lastVisitKey = (uid: string) => `myboxer.community.lastVisit:${uid}`;

export function readCommunityLastVisit(uid: string | null | undefined): string | null {
  if (!uid) return null;
  try {
    return localStorage.getItem(lastVisitKey(uid));
  } catch {
    return null;
  }
}

export function markCommunityVisited(uid: string | null | undefined): void {
  if (!uid) return;
  try {
    localStorage.setItem(lastVisitKey(uid), new Date().toISOString());
  } catch {
    /* 저장이 막힌 기기 — 새 소식은 최근 24시간 기준으로 센다 */
  }
}

export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/** 한 줄에 붙일 사진 — 가장 긴 변 1280px JPEG 로 줄여 community/{uid}/… 에 올리고 공개 주소를 돌려준다 */
export async function uploadCommunityPhoto(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 올릴 수 있어요");
  if (file.size > PHOTO_MAX_BYTES) throw new Error("10MB 이하 사진만 올릴 수 있어요");
  const blob = await compressImage(file, 1280, 0.8);
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from("community").upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw new Error("사진을 올리지 못했어요. 잠시 후 다시 시도해 주세요");
  return supabase.storage.from("community").getPublicUrl(path).data.publicUrl;
}
