/**
 * 153 커뮤니티 확장 — 오늘 파트너 구하기 · 중고 장비 나눔 · 타이틀매치 축하 · 같은 시간대 팀.
 *
 * 규약 (boxingEngagementService 와 동일):
 *   · types.ts(자동 생성)에 신규 RPC 가 아직 없으므로 rpc() 호출은 cast 사용.
 *     향후 supabase gen types 시 sbRpc 만 걷어내면 된다.
 *   · 쓰기·타인 데이터 열람은 전부 SECURITY DEFINER RPC 경유. .from() 직접 조회 없음.
 *   · 지점 격리는 서버가 강제한다 — 프론트는 지점을 보내지 않는다.
 *   · 예외 메시지는 RPC 가 한국어로 던진다. 여기서 다시 번역하지 않는다
 *     (send_boxing_cheer 만 예외 — 구버전이라 영문을 던져서 아래에서 매핑한다).
 */

import { supabase } from "@/integrations/supabase/client";

type SbResult<T> = { data: T | null; error: { message: string } | null };

async function sbRpc<T>(name: string, args?: Record<string, unknown>): Promise<SbResult<T>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).rpc(name, args);
}

/** "153복싱짐 선릉역점" → "선릉역점" — 본사 계정의 전 지점 보기에서 글마다 지점을 붙일 때 */
export const shortBranchName = (b: string | null | undefined) => (b ?? "").replace(/^153복싱짐\s*/, "");

function unwrap<T>(res: SbResult<T>, fallback: string): T {
  if (res.error) throw new Error(res.error.message || fallback);
  if (!res.data) throw new Error(fallback);
  return res.data;
}

/* ══════════ 오늘 파트너 구하기 ══════════ */

export type PartnerPurpose = "mitt" | "sparring" | "jump" | "together";

export const PURPOSE_LABEL: Record<PartnerPurpose, string> = {
  mitt: "미트",
  sparring: "스파링",
  jump: "줄넘기",
  together: "같이 운동",
};

/**
 * 올릴 때 고르는 종류 (2026-10-28 운동 모집 1단계 — 대표님 "추천대로").
 *   회원: 미트 · 같이 운동 두 개(줄넘기는 '같이 운동'에 합침). 스파링은 코치님 · 운영진 모집으로만 — 서버(create_partner_call)도 같다.
 *   예전에 올라온 '줄넘기' 모집은 이름 그대로 보인다.
 */
export const MEMBER_PURPOSES: PartnerPurpose[] = ["mitt", "together"];
export const STAFF_PURPOSES: PartnerPurpose[] = ["mitt", "together", "sparring"];

/** 저요한 사람 (같은 지점 회원에게 사진 · 이름이 보인다) */
export interface PartnerCallPerson {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
}

export interface PartnerCall {
  id: string;
  /** 올린 사람 — 사진 · 이름을 누르면 회원 카드 (2026-10-28) */
  userId?: string;
  /** 닉네임, 없으면 이름 (커뮤니티 피드와 같은 규칙) */
  nickname: string;
  avatarUrl?: string | null;
  /** 코치님 · 운영진이 연 모집 */
  isStaff?: boolean;
  staffTitle?: string | null;
  /** 1~40 레벨 (피드와 같은 계산) */
  level?: number;
  /** 글쓴 회원 지점 (2026-09-30 — 본사 계정 전 지점 보기용) */
  branch?: string | null;
  isMine: boolean;
  slotHour: number;
  purpose: PartnerPurpose;
  note: string | null;
  rank: string;
  joinCount: number;
  joined: boolean;
  /** 저요한 사람 — 먼저 누른 순서 */
  joiners?: PartnerCallPerson[];
  /* ── 2단계 (2026-10-28 미리보기 · get_partner_calls_v2) ── */
  /** '지금' 모집 — expiresAt 까지(올린 뒤 30분) */
  isNow?: boolean;
  expiresAt?: string | null;
  /** 코치님 모집 정원 (null = 제한 없음) · 다 찼나 */
  capacity?: number | null;
  full?: boolean;
  /** 운동 시간이 됐나 ('같이 했어요'를 누를 수 있다) · 아직 저요할 수 있나 */
  started?: boolean;
  joinable?: boolean;
  /** 내가 '같이 했어요'를 눌렀나 · 누른 사람들 · 짝이 된 수(올린 사람과 저요한 사람이 둘 다 누름) */
  myDone?: boolean;
  doneUsers?: string[];
  pairs?: number;
}

export interface PartnerCallsResult {
  success: boolean;
  reason?: string;
  branch?: string;
  /** 본사(전체관리자·관리자) 계정 — 전 지점 모집을 본다 (참여는 같은 지점만) */
  all_branches?: boolean;
  /** 내가 평소 오는 시각(최근 60일) — 시간 칩 기본값 */
  usualHour?: number | null;
  /** 스파링 모집을 열 수 있나 (코치님 · 운영진) */
  canSpar?: boolean;
  /** 닉네임이 없어 올리기 전에 먼저 정해야 하나 */
  needsNickname?: boolean;
  /** 2단계: 정원을 정할 수 있나(코치님 · 운영진) · 3시간 안에 출석(체육관에 있음 → '지금' 칩) · 오늘 같이 운동한 짝 수 */
  canCapacity?: boolean;
  atGym?: boolean;
  pairsToday?: number;
  calls: PartnerCall[];
}

export const EMPTY_PARTNER_CALLS: PartnerCallsResult = { success: true, calls: [] };

// 2단계 미리보기 (2026-10-28) — '지금' 모집 · 정원 · 같이 했어요는 v2 함수 (1단계 함수는 지금 앱이 그대로 쓴다)
export async function getPartnerCalls(): Promise<PartnerCallsResult> {
  const res = await sbRpc<PartnerCallsResult>("get_partner_calls_v2");
  return unwrap(res, "모집 목록을 불러오지 못했습니다.");
}

export async function createPartnerCall(
  purpose: PartnerPurpose,
  slotHour: number,
  note: string | null,
  opts: { now?: boolean; capacity?: number | null } = {},
): Promise<{ success: boolean; call_id?: string }> {
  const res = await sbRpc<{ success: boolean; call_id?: string }>("create_partner_call_v2", {
    p_purpose: purpose,
    p_slot_hour: slotHour,
    p_note: note ?? null,
    p_now: !!opts.now,
    p_capacity: opts.capacity ?? null,
  });
  return unwrap(res, "모집 글을 올리지 못했습니다.");
}

export async function joinPartnerCall(callId: string) {
  return unwrap(
    await sbRpc<{ success: boolean }>("join_partner_call_v2", { p_call_id: callId }),
    "참여하지 못했습니다.",
  );
}

/** '같이 했어요' — 올린 사람과 저요한 사람이 둘 다 누르면 서로 153 + 각자 챔피언 머니 +30(하루 1번) */
export interface PartnerDoneResult {
  success: boolean;
  already?: boolean;
  paired?: number;
  reward?: number;
  waiting?: boolean;
}

export async function partnerCallDone(callId: string): Promise<PartnerDoneResult> {
  return unwrap(
    await sbRpc<PartnerDoneResult>("partner_call_done", { p_call_id: callId }),
    "기록하지 못했습니다.",
  );
}

export async function leavePartnerCall(callId: string) {
  return unwrap(
    await sbRpc<{ success: boolean }>("leave_partner_call", { p_call_id: callId }),
    "참여를 취소하지 못했습니다.",
  );
}

export async function closePartnerCall(callId: string) {
  return unwrap(
    await sbRpc<{ success: boolean }>("close_partner_call", { p_call_id: callId }),
    "모집을 내리지 못했습니다.",
  );
}

/* ══════════ 중고 장비 나눔 ══════════ */

export type GearKind = "glove" | "handwrap" | "shoes" | "rope" | "headgear" | "other";
export type GearCondition = "new" | "good" | "used";
export type GearDeal = "free" | "transfer";

export const GEAR_LABEL: Record<GearKind, string> = {
  glove: "글러브",
  handwrap: "핸드랩",
  shoes: "복싱화",
  rope: "줄넘기",
  headgear: "헤드기어",
  other: "기타",
};
export const CONDITION_LABEL: Record<GearCondition, string> = {
  new: "새것",
  good: "상태 좋음",
  used: "사용감 있음",
};
export const DEAL_LABEL: Record<GearDeal, string> = {
  free: "나눔",
  transfer: "양도",
};

export interface GearPost {
  id: string;
  nickname: string;
  /** 글쓴 회원 지점 (2026-09-30 — 본사 계정 전 지점 보기용) */
  branch?: string | null;
  isMine: boolean;
  kind: GearKind;
  size: string | null;
  condition: GearCondition;
  deal: GearDeal;
  note: string | null;
  /** 양도 금액(원) — 나눔이거나 안 적었으면 null (2026-10-18) */
  price?: number | null;
  createdAt: string;
}

export interface GearPostsResult {
  success: boolean;
  branch?: string;
  /** 본사(전체관리자·관리자) 계정 — 전 지점 글을 본다 */
  all_branches?: boolean;
  posts: GearPost[];
}

export const EMPTY_GEAR_POSTS: GearPostsResult = { success: true, posts: [] };

export async function getGearPosts(limit = 30): Promise<GearPostsResult> {
  return unwrap(
    await sbRpc<GearPostsResult>("get_gear_posts", { p_limit: limit }),
    "장비 글을 불러오지 못했습니다.",
  );
}

export async function createGearPost(input: {
  kind: GearKind;
  size: string | null;
  condition: GearCondition;
  deal: GearDeal;
  note: string | null;
  /** 양도 금액(원) — 나눔이면 서버가 비운다 (2026-10-18, create_gear_post_v2) */
  price?: number | null;
}) {
  return unwrap(
    await sbRpc<{ success: boolean; post_id?: string }>("create_gear_post_v2", {
      p_kind: input.kind,
      p_gear_size: input.size ?? null,
      p_condition: input.condition,
      p_deal: input.deal,
      p_note: input.note ?? null,
      p_price: input.deal === "transfer" ? input.price ?? null : null,
    }),
    "장비 글을 올리지 못했습니다.",
  );
}

export async function closeGearPost(id: string) {
  return unwrap(
    await sbRpc<{ success: boolean }>("close_gear_post", { p_id: id }),
    "완료 처리하지 못했습니다.",
  );
}

/* ══════════ 타이틀매치 축하 피드 ══════════ */

export interface TitleMatchItem {
  id: string;
  userId: string;
  nickname: string;
  /** 통과한 회원 지점 (2026-09-30 — 본사 계정 전 지점 보기용) */
  branch?: string | null;
  isMine: boolean;
  rank: string;
  globalLevel: number;
  at: string;
  claps: number;
  clapped: boolean;
}

export interface TitleMatchFeedResult {
  success: boolean;
  branch?: string;
  /** 본사(전체관리자·관리자) 계정 — 전 지점 소식을 본다 */
  all_branches?: boolean;
  items: TitleMatchItem[];
}

export const EMPTY_TITLEMATCH_FEED: TitleMatchFeedResult = { success: true, items: [] };

export async function getTitleMatchFeed(limit = 20): Promise<TitleMatchFeedResult> {
  return unwrap(
    await sbRpc<TitleMatchFeedResult>("get_titlematch_feed", { p_limit: limit }),
    "축하 피드를 불러오지 못했습니다.",
  );
}

/** send_boxing_cheer 는 구버전이라 영문 예외를 던진다 — 회원이 영문을 보지 않게 매핑한다 */
const CHEER_ERROR_KO: { match: string; ko: string }[] = [
  { match: "cannot cheer yourself", ko: "본인에게는 박수를 보낼 수 없습니다." },
  { match: "daily", ko: "오늘 보낼 수 있는 응원을 모두 썼습니다." },
  { match: "limit", ko: "오늘 보낼 수 있는 응원을 모두 썼습니다." },
  { match: "auth", ko: "로그인이 필요합니다." },
];

/**
 * 타이틀매치 축하 박수.
 * 새 테이블을 만들지 않고 기존 send_boxing_cheer 를 쓴다 —
 * 일일 한도·보상·멱등키가 전부 그 RPC 안에 있어서 한 곳에서 관리된다.
 */
export async function clapTitleMatch(
  receiverUserId: string,
  sourceId: string,
): Promise<{ success?: boolean; cheer_id?: string } | null> {
  const res = await sbRpc<{ success?: boolean; cheer_id?: string }>("send_boxing_cheer", {
    p_receiver_user_id: receiverUserId,
    p_cheer_type: "clap",
    p_message: null,
    p_source_type: "titlematch_feed",
    p_source_id: sourceId,
  });
  if (res.error) {
    const raw = (res.error.message || "").toLowerCase();
    const hit = CHEER_ERROR_KO.find((e) => raw.includes(e.match));
    throw new Error(hit ? hit.ko : "박수를 보내지 못했습니다.");
  }
  return res.data;
}

/* ══════════ 같은 시간대 팀 ══════════ */

export type CrewSlot = "dawn" | "morning" | "lunch" | "afternoon" | "evening" | "night";

export const SLOT_LABEL: Record<CrewSlot, string> = {
  dawn: "새벽 5~8시",
  morning: "오전 8~12시",
  lunch: "점심 12~15시",
  afternoon: "오후 15~18시",
  evening: "저녁 18~21시",
  night: "야간 21시 이후",
};
export const SLOT_SHORT: Record<CrewSlot, string> = {
  dawn: "새벽",
  morning: "오전",
  lunch: "점심",
  afternoon: "오후",
  evening: "저녁",
  night: "야간",
};
export const SLOT_ORDER: CrewSlot[] = [
  "dawn",
  "morning",
  "lunch",
  "afternoon",
  "evening",
  "night",
];

export interface TimeCrewResult {
  success: boolean;
  branch?: string;
  slot: CrewSlot | null;
  myVisits: number;
  crewCount: number;
  members: { nickname: string; visits: number }[];
  slots: { slot: CrewSlot; count: number }[];
}

export const EMPTY_TIME_CREW: TimeCrewResult = {
  success: true,
  slot: null,
  myVisits: 0,
  crewCount: 0,
  members: [],
  slots: [],
};

export async function getTimeCrew(): Promise<TimeCrewResult> {
  return unwrap(await sbRpc<TimeCrewResult>("get_time_crew"), "시간대 정보를 불러오지 못했습니다.");
}
