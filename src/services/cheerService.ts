/**
 * 동료에게 응원 보내기 업그레이드 (2026-10-16 대표님 승인) — 받을 사람 고르기 · 받은 응원함 · 고마워요 153 · 라이센스 요약
 * DB: supabase/migrations/20261016110000_cheer_upgrade.sql
 *   보내기는 예전과 같은 send_boxing_cheer (boxingEngagementService.sendBoxingCheer) —
 *   스티커·한마디는 하루 10번, 같은 동료에게 하루 1번, 하루 첫 응원 챔피언 머니 +30, 받은 사람에게 알림
 */
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(name, args);
  if (error) throw new Error(translateError(error));
  return data as T;
}

export type CheerGroup = "now" | "today" | "recent";

export interface CheerCandidate {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  branch: string | null;
  league: string;
  /** 누적 레벨 1~40 */
  level: number;
  /** now = 지금 운동 중(TV 기준) · today = 오늘 다녀감 · recent = 최근 출석 순 */
  group: CheerGroup;
  /** 운동 시작(출석) 시각 — now/today 만 */
  since: string | null;
  last_at: string | null;
  cheered_today: boolean;
  birthday: boolean;
  promoted: boolean;
  returning: boolean;
}

export interface CheerCandidates {
  branch: string | null;
  all_branches: boolean;
  sent_today: number;
  daily_limit: number;
  members: CheerCandidate[];
}

export async function getCheerCandidates(search = "", limit = 40): Promise<CheerCandidates> {
  const q = search.trim();
  const d = await rpc<Partial<CheerCandidates> | null>("get_cheer_candidates", { p_search: q || null, p_limit: limit });
  return {
    branch: d?.branch ?? null,
    all_branches: d?.all_branches === true,
    sent_today: Number(d?.sent_today ?? 0),
    daily_limit: Number(d?.daily_limit ?? 10),
    members: Array.isArray(d?.members) ? d!.members! : [],
  };
}

export interface ReceivedCheer {
  id: string;
  type: "sticker" | "comment" | "clap";
  sender_id: string;
  sender: string;
  sender_avatar: string | null;
  sender_staff: boolean;
  sticker: string;
  note: string | null;
  at: string;
  thanked: boolean;
}

export interface ReceivedCheers {
  total: number;
  unthanked: number;
  items: ReceivedCheer[];
}

export async function getMyReceivedCheers(limit = 50): Promise<ReceivedCheers> {
  const d = await rpc<Partial<ReceivedCheers> | null>("get_my_received_cheers", { p_limit: limit });
  return {
    total: Number(d?.total ?? 0),
    unthanked: Number(d?.unthanked ?? 0),
    items: Array.isArray(d?.items) ? d!.items! : [],
  };
}

export const thankCheer = (cheerId: string) =>
  rpc<{ success: boolean; already?: boolean }>("thank_cheer", { p_cheer_id: cheerId });

export interface MemberCheerSummary {
  total: number;
  top: { sticker: string; count: number }[];
}

export async function getMemberCheerSummary(userId: string): Promise<MemberCheerSummary> {
  const d = await rpc<Partial<MemberCheerSummary> | null>("get_member_cheer_summary", { p_user_id: userId });
  return { total: Number(d?.total ?? 0), top: Array.isArray(d?.top) ? d!.top! : [] };
}

export const setCheerNotify = (on: boolean) => rpc<{ success: boolean; on: boolean }>("set_cheer_notify", { p_on: on });
