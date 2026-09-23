/**
 * 153 챌린지 킹 보드 — RPC 래퍼 + 왕좌 메타데이터 (2026-09-23).
 *
 * 대표님 지시: 153 챌린지에 출석왕·버피왕·체력왕 등 — 글보다 버튼, 누르면 설명.
 *
 * 점수는 전부 서버(get_153_king_board / get_153_king_summary)가 계산한다. 이 파일은
 * 카테고리 이름·설명·단위·행동 버튼 같은 "말" 만 들고 있다 — 숫자를 여기서 만들지 않는다.
 * 규칙 문구는 마이그레이션 20260923053413 / 053518 의 정의와 같아야 한다.
 *
 * 보호 원칙: 읽기 전용. 공식 XP / wallet / level 변경 0건.
 */

import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";

export type KingCategory = "attendance" | "streak" | "early_bird" | "levelup" | "burpee" | "fitness" | "app" | "nickname";
export type KingPeriod = "weekly" | "monthly";
export type KingScope = "branch" | "all";

export const KING_CATEGORIES: KingCategory[] = ["attendance", "app", "nickname", "streak", "early_bird", "levelup", "burpee", "fitness"];

/** 사이니지 TV2 런칭 이벤트에 걸리는 세 왕좌 — ① 출석왕 ② 앱활동왕 ③ 닉네임왕 (서버 get_launch_event_board 와 같은 순서) */
export const LAUNCH_EVENT_CATEGORIES: KingCategory[] = ["attendance", "app", "nickname"];

export interface KingBoardRow {
  rank: number;
  user_id: string;
  display_name: string;
  branch_name: string;
  score: number;
  is_me: boolean;
}

export interface KingBoard {
  category: KingCategory;
  period: KingPeriod;
  /** 서버가 실제 적용한 범위 — 내 지점이 비어 있으면 'all' 로 내려온다 */
  scope: KingScope;
  since: string;
  branch: string | null;
  board: KingBoardRow[];
  me: { rank: number; score: number } | null;
  total: number;
}

export interface KingSummaryItem {
  category: KingCategory;
  king: KingBoardRow | null;
  me: { rank: number; score: number } | null;
  total: number;
}

export interface KingSummary {
  period: KingPeriod;
  scope: KingScope;
  since: string;
  items: KingSummaryItem[];
}

/** 행동 버튼 종류 — 화면이 어떤 시트/페이지를 열지 결정한다 */
export type KingAction = "arena_burpee" | "arena" | "nickname_like" | null;

export interface KingMeta {
  key: KingCategory;
  emoji: string;
  title: string;
  /** 버튼 아래 한 줄 (아주 짧게) */
  tagline: string;
  /** 눌렀을 때 나오는 설명 — 무엇을 세나 */
  what: string;
  /** 어떻게 올리나 */
  how: string;
  /** 점수 단위 */
  unit: string;
  /** 기간 토글과 무관한 지표면 true (연속출석) */
  periodless?: boolean;
  action: KingAction;
  actionLabel?: string;
}

export const KING_META: Record<KingCategory, KingMeta> = {
  attendance: {
    key: "attendance", emoji: "🗓️", title: "출석왕", tagline: "많이 온 사람",
    what: "얼굴 인식·QR 출석으로 체육관에 온 날 수를 셉니다. 하루에 여러 번 와도 1일.",
    how: "그냥 자주 오세요. 동점이면 먼저 채운 사람이 앞섭니다.",
    unit: "일", action: null,
  },
  streak: {
    key: "streak", emoji: "🔥", title: "연속출석왕", tagline: "끊기지 않은 사람",
    what: "오늘 또는 어제까지 하루도 빠지지 않고 이어진 출석 일수입니다. 하루 빠지면 0부터.",
    how: "매일 오는 게 전부예요. 이 왕좌는 주·월 기간과 상관없이 '지금 연속' 으로 정합니다.",
    unit: "일 연속", periodless: true, action: null,
  },
  early_bird: {
    key: "early_bird", emoji: "🌅", title: "얼리버드왕", tagline: "오전 9시 전 출석",
    what: "오전 9시 전에 출석 체크한 횟수를 셉니다.",
    how: "아침 운동 습관이 있으면 자동으로 올라갑니다.",
    unit: "회", action: null,
  },
  levelup: {
    key: "levelup", emoji: "⬆️", title: "레벨업왕", tagline: "가장 많이 승급",
    what: "이 기간에 레벨이 오른 횟수입니다 (자동 승급·코치 승인 승급 모두).",
    how: "출석이 쌓이면 레벨이 오르고, 오래 운동하면(종료 버튼) 더 빨리 오릅니다.",
    unit: "회", action: null,
  },
  burpee: {
    key: "burpee", emoji: "💥", title: "버피왕", tagline: "버피 총 개수",
    what: "챌린지 아레나 '버피 폭발 챌린지' 에 기록한 버피 개수를 모두 더합니다.",
    how: "아레나에서 60초 버피를 하고 개수를 기록하세요. 통증 체크에 걸린 기록은 세지 않습니다.",
    unit: "개", action: "arena_burpee", actionLabel: "버피 기록하기",
  },
  fitness: {
    key: "fitness", emoji: "💪", title: "체력왕", tagline: "아레나 클리어 라운드",
    what: "챌린지 아레나 체력 종목(스쿼트·푸시업·버피·줄넘기·샌드백·잽·원투·콤보·가드)에서 목표를 달성한 라운드 수입니다.",
    how: "아레나 챌린지를 골라 목표 개수를 채우면 1라운드. 종목은 자유입니다.",
    unit: "라운드", action: "arena", actionLabel: "아레나 열기",
  },
  app: {
    key: "app", emoji: "📱", title: "앱활동왕", tagline: "앱에서 한 행동 수",
    what: "마이복서153 앱에서 한 행동을 셉니다 — 앱을 연 날, QR 출석, 운동 종료 기록, 아레나 도전, 퀴즈, 일기·댓글, 응원, 장비 나눔, 내가 보낸 닉네임 좋아요. 각 1점.",
    how: "매일 앱을 열고, 운동 끝나면 종료를 누르고, 챌린지·퀴즈·좋아요를 남기세요. 런칭 이벤트 ②번 왕좌예요.",
    unit: "점", action: null,
  },
  nickname: {
    key: "nickname", emoji: "❤️", title: "닉네임왕", tagline: "받은 좋아요",
    what: "같은 지점 회원들이 내 닉네임에 보낸 좋아요 수입니다. 한 사람이 한 명에게 하나만 보낼 수 있어요.",
    how: "마이페이지에서 멋진 닉네임을 정하고, 아래 버튼으로 다른 회원 닉네임에 좋아요를 보내세요. 런칭 이벤트 ③번 왕좌예요.",
    unit: "개", action: "nickname_like", actionLabel: "닉네임 좋아요 보내기",
  },
};

export const KING_PERIOD_LABEL: Record<KingPeriod, string> = { weekly: "이번 주", monthly: "이번 달" };
export const KING_PERIOD_RESET: Record<KingPeriod, string> = { weekly: "매주 월요일 0시에 새로 시작", monthly: "매월 1일 0시에 새로 시작" };

type SbResult<T> = { data: T | null; error: { message: string } | null };

async function sbRpc<T>(name: string, args?: Record<string, unknown>): Promise<SbResult<T>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).rpc(name, args);
}

export async function get153KingBoard(category: KingCategory, period: KingPeriod, scope: KingScope, limit = 10): Promise<KingBoard> {
  const { data, error } = await sbRpc<KingBoard>("get_153_king_board", {
    p_category: category, p_period: period, p_scope: scope, p_limit: limit,
  });
  if (error) throw new Error(translateError(error));
  if (!data) throw new Error("순위를 불러오지 못했어요");
  return { ...data, board: data.board ?? [], me: data.me ?? null, total: Number(data.total ?? 0) };
}

export async function get153KingSummary(period: KingPeriod, scope: KingScope): Promise<KingSummary> {
  const { data, error } = await sbRpc<KingSummary>("get_153_king_summary", { p_period: period, p_scope: scope });
  if (error) throw new Error(translateError(error));
  if (!data) throw new Error("왕좌 정보를 불러오지 못했어요");
  return { ...data, items: (data.items ?? []).map((i) => ({ ...i, king: i.king ?? null, me: i.me ?? null, total: Number(i.total ?? 0) })) };
}

// ── 닉네임 좋아요 ──────────────────────────────────────────
export interface BranchNicknameRow {
  user_id: string;
  display: string;
  has_nickname: boolean;
  likes_month: number;
  liked_by_me: boolean;
}
export interface BranchNicknames {
  branch: string | null;
  rows: BranchNicknameRow[];
  my_given: number;
}

/** 같은 지점 회원 닉네임 목록 (본인·지도진 제외, 좋아요 많은 순) */
export async function getBranchNicknames(search: string | null, limit = 60): Promise<BranchNicknames> {
  const { data, error } = await sbRpc<BranchNicknames>("get_branch_nicknames", { p_search: search, p_limit: limit });
  if (error) throw new Error(translateError(error));
  return { branch: data?.branch ?? null, rows: data?.rows ?? [], my_given: Number(data?.my_given ?? 0) };
}

/** 좋아요 토글 — 서버가 같은 지점·본인 제외·1인 1좋아요를 검사한다 */
export async function toggleNicknameLike(targetUserId: string): Promise<{ liked: boolean; likes_month: number; likes_total: number }> {
  const { data, error } = await sbRpc<{ liked: boolean; likes_month: number; likes_total: number }>("toggle_nickname_like", { _target: targetUserId });
  if (error) throw new Error(translateError(error));
  if (!data) throw new Error("처리 결과를 받지 못했어요");
  return data;
}

/** 점수 표시 — 숫자 + 단위. numeric 이 문자열로 올 수 있어 Number 로 정리한다. */
export const formatKingScore = (score: number | string, category: KingCategory): string =>
  `${Number(score).toLocaleString("ko-KR")}${KING_META[category].unit}`;
