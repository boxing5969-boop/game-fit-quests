/**
 * 153 챌린지 킹 보드 — RPC 래퍼 + 왕좌 메타데이터 (2026-09-23).
 *
 * 대표님 지시: 153 챌린지에 출석왕·버피왕·체력왕 등 — 글보다 버튼, 누르면 설명.
 *
 * 점수는 전부 서버(get_153_king_board / get_153_king_summary)가 계산한다. 이 파일은
 * 카테고리 이름·설명·단위·행동 버튼 같은 "말" 만 들고 있다 — 숫자를 여기서 만들지 않는다.
 * 규칙 문구는 서버 점수 정의(_king_scores v3, 마이그레이션 20260923132101)와 같아야 한다:
 *   출석 계열 = 얼굴 인식 출석만 · 얼리버드 = 새벽 5시~오전 9시 · 앱활동 = 행동 종류별 하루 1점 ·
 *   버피 = 하루 최고 기록의 합(상급 목표 × 3 까지) · 체력 = 종목별 하루 1라운드 · 닉네임 = 지금 받고 있는 좋아요(누적).
 * 순위에는 승인된 지점 회원만 오른다(지도진·관리자·이용 기록 없는 계정 제외).
 *
 * 보호 원칙: 읽기 전용. 공식 XP / wallet / level 변경 0건.
 */

import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";

export type KingCategory = "attendance" | "streak" | "early_bird" | "levelup" | "burpee" | "fitness" | "app" | "nickname";
/** weekly/monthly = 정기 왕좌, event = 런칭 이벤트 기간(설정 화면에서 시작·종료일을 정한다) */
export type KingPeriod = "weekly" | "monthly" | "event";
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

/** 런칭 이벤트 기간 — 서버 get_launch_event_window 가 준다. 날짜는 KST. */
export type LaunchEventStatus = "upcoming" | "active" | "ended";
export interface LaunchEventWindow {
  start_date: string;
  end_date: string | null;
  since: string;
  until: string | null;
  status: LaunchEventStatus;
  days_until_start: number;
  days_left: number | null;
}

export interface KingBoard {
  category: KingCategory;
  period: KingPeriod;
  /** 서버가 실제 적용한 범위 — 내 지점이 비어 있으면 'all' 로 내려온다 */
  scope: KingScope;
  since: string;
  until?: string | null;
  branch: string | null;
  /** period=event 일 때만 */
  event?: LaunchEventWindow | null;
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
  event?: LaunchEventWindow | null;
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
  /** 기간 토글과 무관한 지표면 true (연속출석 = 지금 연속, 닉네임 = 누적) */
  periodless?: boolean;
  action: KingAction;
  actionLabel?: string;
}

export const KING_META: Record<KingCategory, KingMeta> = {
  attendance: {
    key: "attendance", emoji: "🗓️", title: "출석왕", tagline: "많이 온 사람",
    what: "얼굴 인식으로 체육관에 들어온 날 수를 셉니다. 하루에 여러 번 와도 1일. (QR 출석은 체육관 밖에서도 찍힐 수 있어 왕좌에는 넣지 않아요)",
    how: "그냥 자주 오세요. 동점이면 먼저 채운 사람이 앞섭니다.",
    unit: "일", action: null,
  },
  streak: {
    key: "streak", emoji: "🔥", title: "연속출석왕", tagline: "끊기지 않은 사람",
    what: "얼굴 인식 출석이 오늘 또는 어제까지 하루도 빠지지 않고 이어진 일수입니다. 하루 빠지면 0부터.",
    how: "매일 오는 게 전부예요. 주·월 기간과 상관없이 '지금 연속' 으로 정하고, 런칭 이벤트 탭에서는 이벤트 시작일부터 셉니다.",
    unit: "일 연속", periodless: true, action: null,
  },
  early_bird: {
    key: "early_bird", emoji: "🌅", title: "얼리버드왕", tagline: "새벽 5시~오전 9시 출석",
    what: "새벽 5시~오전 9시 사이에 얼굴 인식으로 출석한 날 수입니다. 하루에 한 번만 셉니다.",
    how: "아침 운동 습관이 있으면 자동으로 올라갑니다.",
    unit: "일", action: null,
  },
  levelup: {
    key: "levelup", emoji: "⬆️", title: "레벨업왕", tagline: "가장 많이 승급",
    what: "이 기간에 레벨이 오른 횟수입니다 (출석 자동 승급·코치 승인 승급·타이틀매치 클리어).",
    how: "출석이 쌓이면 레벨이 오르고, 오래 운동하면(종료 버튼) 더 빨리 오릅니다.",
    unit: "회", action: null,
  },
  burpee: {
    key: "burpee", emoji: "💥", title: "버피왕", tagline: "버피 총 개수",
    what: "챌린지 아레나 '버피 폭발 챌린지' 기록을 더합니다. 하루에 여러 번 기록해도 그날 최고 기록 하나만, 한 번에 75개까지 인정해요.",
    how: "아레나에서 60초 버피를 하고 개수를 기록하세요. 통증 체크에 걸린 기록은 세지 않습니다.",
    unit: "개", action: "arena_burpee", actionLabel: "버피 기록하기",
  },
  fitness: {
    key: "fitness", emoji: "💪", title: "체력왕", tagline: "아레나 클리어 라운드",
    what: "챌린지 아레나 체력 종목(스쿼트·푸시업·버피·줄넘기·샌드백·잽·원투·콤보·가드)에서 목표를 달성한 라운드 수입니다. 같은 종목은 하루 1라운드만 셉니다.",
    how: "아레나 챌린지를 골라 목표 개수를 채우면 1라운드. 여러 종목을 돌면 하루에 여러 라운드가 쌓여요.",
    unit: "라운드", action: "arena", actionLabel: "아레나 열기",
  },
  app: {
    key: "app", emoji: "📱", title: "앱활동왕", tagline: "앱에서 한 행동",
    what: "마이복서153 앱에서 한 행동을 셉니다 — 앱 열기, QR 출석, 운동 종료, 아레나 도전, 퀴즈, 일기, 댓글, 응원, 장비 나눔, 닉네임 좋아요. 행동 종류마다 하루 1점(하루 최대 10점).",
    how: "매일 앱을 열고, 운동이 끝나면 종료를 누르고, 챌린지·퀴즈·좋아요를 남기세요. 같은 행동을 여러 번 해도 하루 1점이에요. 런칭 이벤트 ②번 왕좌예요.",
    unit: "점", action: null,
  },
  nickname: {
    key: "nickname", emoji: "❤️", title: "닉네임왕", tagline: "받은 좋아요",
    what: "같은 지점 회원들이 내 닉네임에 보낸 좋아요 수입니다. 한 사람이 한 명에게 하나만 보낼 수 있고, 취소하지 않으면 계속 유지돼요(누적).",
    how: "설정에서 나만의 닉네임(12자 이내)을 정하면 목록에 올라가요. 아래 버튼으로 다른 회원 닉네임에 좋아요를 보내세요. 런칭 이벤트 ③번 왕좌예요.",
    unit: "개", periodless: true, action: "nickname_like", actionLabel: "닉네임 좋아요 보내기",
  },
};

export const KING_PERIOD_LABEL: Record<KingPeriod, string> = { weekly: "이번 주", monthly: "이번 달", event: "런칭 이벤트" };
export const KING_PERIOD_RESET: Record<KingPeriod, string> = {
  weekly: "매주 월요일 0시에 새로 시작", monthly: "매월 1일 0시에 새로 시작", event: "런칭 이벤트 기간 동안 누적",
};

/** "2026-10-01" → "10월 1일" */
export const fmtKstDate = (d?: string | null): string => {
  if (!d) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${Number(m[2])}월 ${Number(m[3])}일` : d;
};

/** 이벤트 기간 한 줄 — "10월 1일 시작 · D-8" / "10월 1일 ~ 10월 31일" / "10월 1일부터 · 종료일 미정" */
export const launchEventLine = (w: LaunchEventWindow | null | undefined): string => {
  if (!w) return "";
  if (w.status === "upcoming") return `${fmtKstDate(w.start_date)} 시작 · D-${w.days_until_start}`;
  const range = w.end_date ? `${fmtKstDate(w.start_date)} ~ ${fmtKstDate(w.end_date)}` : `${fmtKstDate(w.start_date)}부터 · 종료일 미정`;
  return w.status === "ended" ? `종료 · ${range} 최종 결과` : `진행 중 · ${range}`;
};

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
  /** 지금 받고 있는 좋아요(닉네임왕 점수와 같은 정의) */
  likes: number;
  liked_by_me: boolean;
}
/** 좋아요를 못 누르는 이유 — change_credentials: 처음 받은 아이디·비밀번호 그대로, not_member: 지점 회원 아님, no_branch: 지점 없음 */
export type NicknameLikeBlock = "change_credentials" | "not_member" | "no_branch";
export interface BranchNicknames {
  branch: string | null;
  rows: BranchNicknameRow[];
  my_given: number;
  can_like: boolean;
  /** null = 가능, admin_test = 관리자 체험(점수에는 안 들어감) */
  reason: NicknameLikeBlock | "admin_test" | null;
}

type RawNicknameRow = Omit<BranchNicknameRow, "likes"> & { likes?: number | string | null; likes_month?: number | string | null };

/** 같은 지점 닉네임 목록 — 닉네임을 정한 회원만(본인·지도진·관리자 제외), 좋아요 많은 순. 검색은 닉네임만. */
export async function getBranchNicknames(search: string | null, limit = 60): Promise<BranchNicknames> {
  const { data, error } = await sbRpc<Omit<BranchNicknames, "rows"> & { rows?: RawNicknameRow[] }>(
    "get_branch_nicknames", { p_search: search, p_limit: limit },
  );
  if (error) throw new Error(translateError(error));
  return {
    branch: data?.branch ?? null,
    rows: (data?.rows ?? []).map((r) => ({ ...r, likes: Number(r.likes ?? r.likes_month ?? 0) })),
    my_given: Number(data?.my_given ?? 0),
    can_like: data?.can_like ?? false,
    reason: data?.reason ?? null,
  };
}

/** 좋아요 토글 — 서버가 같은 지점·본인 제외·1인 1좋아요·자격을 검사한다. likes = 대상이 지금 받고 있는 좋아요 */
export async function toggleNicknameLike(targetUserId: string): Promise<{ liked: boolean; likes: number }> {
  const { data, error } = await sbRpc<{ liked: boolean; likes?: number; likes_month?: number }>("toggle_nickname_like", { _target: targetUserId });
  if (error) throw new Error(translateError(error));
  if (!data) throw new Error("처리 결과를 받지 못했어요");
  return { liked: !!data.liked, likes: Number(data.likes ?? data.likes_month ?? 0) };
}

// ── 런칭 이벤트 기간 설정 ────────────────────────────────────
export async function getLaunchEventWindow(): Promise<LaunchEventWindow> {
  const { data, error } = await sbRpc<LaunchEventWindow>("get_launch_event_window");
  if (error) throw new Error(translateError(error));
  if (!data) throw new Error("이벤트 기간을 불러오지 못했어요");
  return data;
}

/** 관리자만 — 서버(set_app_setting)가 권한·날짜 순서를 검사한다 */
export async function setLaunchEventSettings(input: { start_date: string; end_date: string | null }): Promise<void> {
  const { error } = await sbRpc<unknown>("set_app_setting", { _key: "launch_event", _value: input });
  if (error) throw new Error(translateError(error));
}

/** 점수 표시 — 숫자 + 단위. numeric 이 문자열로 올 수 있어 Number 로 정리한다. */
export const formatKingScore = (score: number | string, category: KingCategory): string =>
  `${Number(score).toLocaleString("ko-KR")}${KING_META[category].unit}`;
