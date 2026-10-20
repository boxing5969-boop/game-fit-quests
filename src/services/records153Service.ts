/**
 * 153 레코드 — 153복싱짐의 '최초' 기록 + 153 체력테스트 신기록 (2026-10-15 대표님)
 * DB: supabase/migrations/20261015170000_records_153.sql (get_153_records)
 *   · firsts — 한 번 새겨지면 바뀌지 않는 최초 기록
 *   · bests  — 챌린지 아레나 체력 종목별 지금 최고 기록 (계속 바뀜)
 *   · tournament — 153복싱짐이 처음 나간 대회의 우승·준우승 (member_medals, 2026-10-16 · 20261016070000_records_153_tournament.sql)
 *   · pb_top_window — '최초 153 PB 1위' 한 달 (첫 공식 기록일부터, 2026-10-20 · 20261020204537_records_153_first_payment_pb_top.sql)
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import { parsePbTopWindow, type PbTopWindow } from "@/lib/record153PbTop";

export interface Record153First {
  key: string;
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  branch_name: string | null;
  achieved_at: string;
  value: number | null;
  is_me: boolean;
}

export interface Record153Best {
  code: string;
  category: string;
  title: string;
  metric: string | null;
  user_id: string | null;
  nickname: string | null;
  value: number | null;
  achieved_at: string | null;
  is_me: boolean | null;
}

/** 153복싱짐 첫 대회 수상자 한 명 (2026-10-16 대표님 — 우승·준우승만) */
export interface Record153TournamentHolder {
  medal: "gold" | "silver";
  /** 메달에 새겨진 이름 */
  name: string;
  /** 앱 가입 전이면 null — 가입하면 이름으로 이어진다 */
  user_id: string | null;
  avatar_url: string | null;
  /** 코치님 수상 */
  staff: boolean;
  is_me: boolean;
}

export interface Record153Tournament {
  title: string;
  branch_name: string | null;
  event_date: string | null;
  holders: Record153TournamentHolder[];
}

export interface Records153 {
  firsts: Record153First[];
  bests: Record153Best[];
  /** 153복싱짐이 처음 나간 대회의 우승·준우승 — 메달 기록이 없으면 null */
  tournament: Record153Tournament | null;
  /** '최초 153 PB 1위' 한 달 — 첫 공식 기록 전이면 null */
  pb_top_window: PbTopWindow | null;
  members: number;
}

export const RECORDS_153_KEY = ["records-153"] as const;

/** 최초 기록을 처음 세우면 주는 마일리지 (2026-10-16 대표님, DB app_settings.mileage_rules.record) */
export const RECORD_153_MILEAGE = 10_000;

export type Record153Section = "start" | "level" | "fitness";

/** '최초 153 PB 1위' 칸 — 남자 · 여자 (안내 문구는 lib/record153PbTop) */
export const RECORD_153_PB_TOP: Readonly<Record<string, "남자" | "여자">> = {
  first_test153_top_m: "남자",
  first_test153_top_f: "여자",
};

/** 153 레코드 '최초' 기록 칸 — 153 레코드 탭 · 랭킹/명예의 전당 띠가 같이 쓴다
 *  (2026-10-16 대표님: 레벨 11·21·31 → '최초 블루·레드·블랙리그 달성', DB record_153_label 도 같은 이름) */
export const RECORD_153_FIRSTS: ReadonlyArray<{
  key: string;
  section: Record153Section;
  emoji: string;
  title: string;
  desc: string;
  empty: string;
}> = [
  // 2026-10-19 대표님: "153복싱짐 선릉역점 최초 가입자 이성준 회원님이야 · 153마이복서 최초가입자도 있고" —
  //   체육관 첫 회원(선릉역점)과 앱 첫 가입자를 나눈다. 선릉역점 기록은 대표님이 정해 준 회원으로 새김(DB 20261019220000)
  { key: "first_member_sunreung", section: "start", emoji: "🥊", title: "선릉역점 최초 가입자", desc: "153복싱짐 선릉역점에 가장 먼저 등록한 회원", empty: "" },
  { key: "first_signup", section: "start", emoji: "🥇", title: "마이복서153 최초 가입자", desc: "마이복서153 앱에 가장 먼저 직접 가입한 회원", empty: "" },
  // 2026-10-20 대표님: "최초로 앱 통해 결제한 회원도 153 레코드에 넣자" (DB 20261020204537 — 결제 완료 · 0원 제외)
  { key: "first_app_payment", section: "start", emoji: "💳", title: "마이복서153 최초 결제", desc: "마이복서153 앱으로 처음 결제를 마친 회원", empty: "앱으로 처음 결제하는 회원이 주인이 돼요" },
  { key: "first_checkin", section: "start", emoji: "🚪", title: "최초 출석", desc: "앱이 생기고 처음으로 앱 출석을 찍은 회원", empty: "" },
  { key: "first_100_checkins", section: "start", emoji: "💯", title: "최초 출석 100회", desc: "가장 먼저 100번 출석한 회원", empty: "100번째 출석을 가장 먼저 찍는 회원이 주인이 돼요" },
  { key: "first_journal", section: "start", emoji: "✍️", title: "최초 커뮤니티 글", desc: "153 커뮤니티에 처음 글을 남긴 회원", empty: "커뮤니티에 처음 글을 쓰는 회원이 주인이 돼요" },
  { key: "first_handwrap", section: "start", emoji: "🩹", title: "최초 붕대 감기 연습", desc: "집에서 붕대 감기를 처음 해 본 회원", empty: "붕대 감기 연습을 처음 하는 회원이 주인이 돼요" },
  { key: "first_lv10", section: "level", emoji: "🔟", title: "최초 레벨 10", desc: "화이트 리그 끝까지 가장 먼저 오른 회원", empty: "레벨 10에 가장 먼저 오르는 회원이 주인이 돼요" },
  { key: "first_lv11", section: "level", emoji: "🔵", title: "최초 블루리그 달성", desc: "레벨 11 — 블루 리그에 가장 먼저 오른 회원", empty: "블루 리그에 가장 먼저 오르는 회원이 주인이 돼요" },
  { key: "first_lv21", section: "level", emoji: "🔴", title: "최초 레드리그 달성", desc: "레벨 21 — 레드 리그에 가장 먼저 오른 회원", empty: "레드 리그에 가장 먼저 오르는 회원이 주인이 돼요" },
  { key: "first_lv31", section: "level", emoji: "⚫", title: "최초 블랙리그 달성", desc: "레벨 31 — 블랙 리그에 가장 먼저 오른 회원", empty: "블랙 리그에 가장 먼저 오르는 회원이 주인이 돼요" },
  // 아레나 '최초 체력테스트 기록'은 아레나가 빠져서 153 PB 완주로 바꿈 (2026-10-16)
  { key: "first_test153", section: "fitness", emoji: "⏱️", title: "최초 153 PB 완주", desc: "코치님과 공식 153 PB를 처음 끝까지 마친 회원", empty: "153 PB를 처음 완주하는 회원이 주인이 돼요" },
  // 2026-10-20 대표님: "최초 153 PB 1위 — 한 달간 회원님들 테스트 후 최고 기록 보유자에게 수상" · 첫 공식 기록일부터 한 달 · 남녀 각각
  //   빈 칸 안내는 날짜에 따라 바뀐다 (Record153Board → lib/record153PbTop pbTopEmptyText)
  { key: "first_test153_top_m", section: "fitness", emoji: "👑", title: "최초 153 PB 1위 · 남자", desc: "첫 공식 기록일부터 한 달 동안 오픈 남자 1위", empty: "" },
  { key: "first_test153_top_f", section: "fitness", emoji: "👑", title: "최초 153 PB 1위 · 여자", desc: "첫 공식 기록일부터 한 달 동안 오픈 여자 1위", empty: "" },
];

/** 첫 대회 기록 칸 — 우승 · 준우승 (153 레코드 탭 '대회의 역사' · 랭킹/명예의 전당 띠) */
export const RECORD_153_TOURNAMENT: ReadonlyArray<{ medal: "gold" | "silver"; title: string; desc: string }> = [
  { medal: "gold", title: "최초 대회 우승", desc: "153복싱짐이 처음 나간 대회에서 금메달" },
  { medal: "silver", title: "최초 대회 준우승", desc: "153복싱짐이 처음 나간 대회에서 은메달" },
];

/** 회원 먼저, 코치님은 뒤로 (그 안의 이름 순은 서버가 맞춰 준다) */
export const sortTournamentHolders = (list: Record153TournamentHolder[]) =>
  [...list].sort((a, b) => Number(a.staff) - Number(b.staff));

const normalizeTournament = (raw: unknown): Record153Tournament | null => {
  const t = raw as Partial<Record153Tournament> | null | undefined;
  if (!t || typeof t !== "object" || !Array.isArray(t.holders) || t.holders.length === 0) return null;
  return {
    title: typeof t.title === "string" ? t.title : "",
    branch_name: typeof t.branch_name === "string" ? t.branch_name : null,
    event_date: typeof t.event_date === "string" ? t.event_date : null,
    holders: t.holders
      .filter((h) => h && (h.medal === "gold" || h.medal === "silver") && typeof h.name === "string")
      .map((h) => ({ ...h, staff: h.staff === true, is_me: h.is_me === true })),
  };
};

export async function getRecords153(): Promise<Records153> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("get_153_records");
  if (error) throw new Error(translateError(error));
  const d = (data ?? {}) as Partial<Records153>;
  return {
    firsts: d.firsts ?? [],
    bests: d.bests ?? [],
    tournament: normalizeTournament(d.tournament),
    pb_top_window: parsePbTopWindow(d.pb_top_window),
    members: Number(d.members ?? 0),
  };
}

export function useRecords153(enabled = true) {
  return useQuery({ queryKey: RECORDS_153_KEY, queryFn: getRecords153, enabled, staleTime: 60_000 });
}
