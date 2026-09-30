/**
 * 메시지(DM) — RPC 래퍼 + 타입 (2026-09-30 대표님: "인스타그램처럼 DM 을 보낼 수 있게").
 *
 * 규칙은 전부 서버(마이그레이션 20260930073749_dm_direct_messages)가 검사한다 — 이 파일은 부르고 모양만 맞춘다.
 *   · 대상: 같은 지점 회원 + 코치님 (본사 계정은 전 지점)
 *   · 회원끼리 첫 메시지 = 메시지 요청 — 상대가 수락하기 전까지 1개만. 삭제해도 보낸 사람에게 알리지 않는다
 *   · 코치님·본사가 끼면 바로 대화
 *   · 글자 + 이모지만, 1000자까지
 *   · 신고는 본사만 확인 (신고할 때 남긴 최근 대화 50개 사본만 본다)
 * 테이블은 앱에서 직접 읽을 수 없다(RLS 정책 없음) — 반드시 아래 함수로만.
 */
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";

/** hq = 전체관리자·관리자(본사) · coach = 지도진 · member = 지점 회원 */
export type DmKind = "hq" | "coach" | "member";

export interface DmPerson {
  user_id: string;
  /** 코치님 = '실명 직함님' · 그 밖 = 닉네임 → 이름 → 익명 복서 (랭킹과 같은 규칙) */
  display: string;
  kind: DmKind | null;
  branch: string | null;
  /** white·blue·red·black 리그 · 코치님은 champion */
  rank: string;
  level: number;
  avatar_url: string | null;
}

/** 보낼 수 없는 이유 코드 — 문구는 서버(reason_text)가 함께 준다 */
export type DmReason =
  | "self"
  | "not_member"
  | "suspended"
  | "change_credentials"
  | "you_blocked"
  | "unavailable"
  | "target_unavailable"
  | "other_branch"
  | "target_closed"
  | "too_many_requests"
  | "awaiting_accept";

/** request = 수락 전(보낸 쪽은 삭제돼도 계속 request 로 보인다) · active = 대화 중 · declined = 내가 삭제한 요청 */
export type DmStatus = "request" | "active" | "declined";

export interface DmThreadRow {
  thread_id: string;
  peer: DmPerson | null;
  status: DmStatus;
  i_am_initiator: boolean;
  last_message_at: string;
  last_preview: string | null;
  last_from_me: boolean;
  unread: number;
  /** 내 마지막 메시지를 상대가 읽었는지 (대화 중일 때만) */
  seen: boolean;
}

export type DmBox = "inbox" | "requests";

export interface DmThreadList {
  box: DmBox;
  rows: DmThreadRow[];
  /** 받은 메시지 요청 수 (탭 이름에 쓴다) */
  requests: number;
}

export interface DmSummary {
  /** false = 메시지를 쓸 수 없는 계정(승인 전 등) — 입구를 숨긴다 */
  enabled: boolean;
  kind: DmKind | null;
  unread_threads: number;
  unread_messages: number;
  requests: number;
  new_requests: number;
  /** 본사만 — 처리 안 한 신고 */
  open_reports: number;
  suspended_until: string | null;
  /** 배지 = 안 읽은 대화 + 새 요청 (+ 본사: 처리 안 한 신고) */
  badge: number;
}

export interface DmMessage {
  id: number;
  mine: boolean;
  body: string;
  created_at: string;
}

export interface DmThread {
  thread: { id: string; status: DmStatus; i_am_initiator: boolean; created_at: string };
  peer: DmPerson | null;
  can_send: boolean;
  reason: DmReason | null;
  reason_text: string | null;
  suspended_until: string | null;
  /** 받은 요청 — 수락·삭제를 골라야 한다 */
  needs_response: boolean;
  i_blocked: boolean;
  /** 상대가 마지막으로 읽은 시각 (대화 중일 때만) */
  other_read_at: string | null;
  messages: DmMessage[];
  has_more: boolean;
}

export interface DmPeer {
  user_id: string;
  thread_id: string | null;
  status: DmStatus | null;
  i_am_initiator?: boolean | null;
  /** 대화 화면을 열어도 되는지 (다른 지점·차단 등은 false — 버튼을 숨긴다) */
  can_open: boolean;
  can_send: boolean;
  reason: DmReason | null;
  reason_text: string | null;
  peer: DmPerson | null;
}

export interface DmPeopleRow extends DmPerson {
  /** 이미 대화가 있으면 그 대화 */
  thread_id: string | null;
  /** 회원끼리 새 대화인데 상대가 '메시지 요청 받기'를 꺼 둠 — 흐리게 보이고 누를 수 없다 */
  closed?: boolean;
}

export interface DmPeople {
  branch: string | null;
  all_branches: boolean;
  rows: DmPeopleRow[];
  reason: DmReason | null;
  reason_text: string | null;
}

export interface DmBlockRow {
  user_id: string;
  display: string;
  branch: string | null;
  blocked_at: string;
}

export interface DmSettings {
  kind: DmKind | null;
  allow_requests: boolean;
  suspended_until: string | null;
  reason: DmReason | null;
  reason_text: string | null;
  blocks: DmBlockRow[];
}

export type DmReportReason = "abuse" | "sexual" | "harassment" | "spam" | "other";

export const DM_REPORT_REASONS: ReadonlyArray<{ value: DmReportReason; label: string; hint: string }> = [
  { value: "abuse", label: "욕설·비하", hint: "욕설, 모욕, 외모·성별 비하" },
  { value: "sexual", label: "성적인 메시지", hint: "원하지 않는 성적 표현" },
  { value: "harassment", label: "괴롭힘·반복 연락", hint: "거절했는데 계속 연락, 위협" },
  { value: "spam", label: "광고·영업", hint: "홍보, 가입 권유, 금전 요구" },
  { value: "other", label: "기타", hint: "그 밖에 불편한 메시지" },
];

export const dmReportReasonLabel = (r: string): string =>
  DM_REPORT_REASONS.find((x) => x.value === r)?.label ?? "기타";

export type DmAdminAction = "dismiss" | "suspend7" | "suspend30" | "lift";

export const DM_ADMIN_ACTION_LABEL: Record<DmAdminAction, string> = {
  dismiss: "문제 없음",
  suspend7: "7일 보내기 제한",
  suspend30: "30일 보내기 제한",
  lift: "제한 풀기",
};

export interface DmAdminReportRow {
  id: string;
  status: "open" | "resolved";
  reason: DmReportReason;
  detail: string | null;
  created_at: string;
  resolved_at: string | null;
  action: DmAdminAction | null;
  message_count: number;
  reporter: { user_id: string; display: string; branch: string | null };
  reported: { user_id: string; display: string; branch: string | null; suspended_until: string | null };
}

export interface DmAdminReportList {
  rows: DmAdminReportRow[];
  open: number;
}

export interface DmAdminReportDetail {
  id: string;
  status: "open" | "resolved";
  reason: DmReportReason;
  detail: string | null;
  created_at: string;
  resolved_at: string | null;
  action: DmAdminAction | null;
  note: string | null;
  reporter: DmPerson;
  reported: DmPerson & { suspended_until: string | null };
  /** 신고한 순간의 최근 대화 — from: reporter(신고한 사람) · reported(신고당한 사람) */
  messages: Array<{ from: "reporter" | "reported"; body: string; at: string }>;
}

type SbResult<T> = { data: T | null; error: { message: string } | null };

async function sbRpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  // 생성된 Supabase 타입에 아직 dm_* 함수가 없어 느슨하게 부른다 (king153Service 와 같은 방식)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await (supabase as any).rpc(name, args)) as SbResult<T>;
  if (error) throw new Error(translateError(error));
  if (data === null || data === undefined) throw new Error("응답을 받지 못했어요. 잠시 후 다시 시도해 주세요");
  return data;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function getDmSummary(): Promise<DmSummary> {
  const d = await sbRpc<Partial<DmSummary>>("dm_summary");
  return {
    enabled: d.enabled === true,
    kind: (d.kind as DmKind | null) ?? null,
    unread_threads: num(d.unread_threads),
    unread_messages: num(d.unread_messages),
    requests: num(d.requests),
    new_requests: num(d.new_requests),
    open_reports: num(d.open_reports),
    suspended_until: d.suspended_until ?? null,
    badge: num(d.badge),
  };
}

export async function listDmThreads(box: DmBox, limit = 50): Promise<DmThreadList> {
  const d = await sbRpc<Partial<DmThreadList>>("dm_list_threads", { p_box: box, p_limit: limit });
  return {
    box,
    rows: (d.rows ?? []).map((r) => ({ ...r, unread: num(r.unread), seen: r.seen === true })),
    requests: num(d.requests),
  };
}

export async function getDmThread(threadId: string, before: number | null = null, limit = 40): Promise<DmThread> {
  const d = await sbRpc<DmThread>("dm_get_thread", { p_thread: threadId, p_before: before, p_limit: limit });
  return { ...d, messages: d.messages ?? [], has_more: d.has_more === true };
}

export async function getDmPeer(userId: string): Promise<DmPeer> {
  return sbRpc<DmPeer>("dm_peer", { p_user: userId });
}

export interface DmSendResult {
  thread_id: string;
  status: DmStatus;
  message: DmMessage;
}

export async function sendDm(input: { threadId?: string | null; toUserId?: string | null; body: string }): Promise<DmSendResult> {
  return sbRpc<DmSendResult>("dm_send", { p_thread: input.threadId ?? null, p_to: input.toUserId ?? null, p_body: input.body });
}

export async function respondDm(threadId: string, action: "accept" | "decline"): Promise<{ thread_id: string; status: DmStatus }> {
  return sbRpc<{ thread_id: string; status: DmStatus }>("dm_respond", { p_thread: threadId, p_action: action });
}

export async function hideDmThread(threadId: string): Promise<void> {
  await sbRpc<unknown>("dm_hide_thread", { p_thread: threadId });
}

export async function setDmBlock(userId: string, block: boolean): Promise<{ blocked: boolean }> {
  return sbRpc<{ blocked: boolean }>("dm_block", { p_user: userId, p_block: block });
}

export async function getDmSettings(): Promise<DmSettings> {
  const d = await sbRpc<DmSettings>("dm_get_settings");
  return { ...d, allow_requests: d.allow_requests !== false, blocks: d.blocks ?? [] };
}

export async function setDmAllowRequests(allow: boolean): Promise<void> {
  await sbRpc<unknown>("dm_set_settings", { p_allow_requests: allow });
}

export async function searchDmPeople(search: string, limit = 40): Promise<DmPeople> {
  const q = search.trim();
  const d = await sbRpc<DmPeople>("dm_people", { p_search: q ? q : null, p_limit: limit });
  return { ...d, rows: d.rows ?? [], all_branches: d.all_branches === true };
}

export async function reportDm(input: {
  threadId: string;
  reason: DmReportReason;
  detail?: string;
  block: boolean;
}): Promise<{ report_id: string; blocked: boolean }> {
  return sbRpc<{ report_id: string; blocked: boolean }>("dm_report", {
    p_thread: input.threadId,
    p_reason: input.reason,
    p_detail: input.detail?.trim() ? input.detail.trim() : null,
    p_block: input.block,
  });
}

export async function listDmReports(status: "open" | "resolved" | "all" = "open"): Promise<DmAdminReportList> {
  const d = await sbRpc<Partial<DmAdminReportList>>("dm_admin_reports", { p_status: status, p_limit: 100 });
  return { rows: (d.rows ?? []).map((r) => ({ ...r, message_count: num(r.message_count) })), open: num(d.open) };
}

export async function getDmReport(reportId: string): Promise<DmAdminReportDetail> {
  const d = await sbRpc<DmAdminReportDetail>("dm_admin_report", { p_report: reportId });
  return { ...d, messages: d.messages ?? [] };
}

export async function resolveDmReport(reportId: string, action: DmAdminAction, note?: string): Promise<void> {
  await sbRpc<unknown>("dm_admin_resolve", { p_report: reportId, p_action: action, p_note: note?.trim() ? note.trim() : null });
}
