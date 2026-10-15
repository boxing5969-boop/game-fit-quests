/**
 * 153 레코드 — 153복싱짐의 '최초' 기록 + 153 체력테스트 신기록 (2026-10-15 대표님)
 * DB: supabase/migrations/20261015170000_records_153.sql (get_153_records)
 *   · firsts — 한 번 새겨지면 바뀌지 않는 최초 기록
 *   · bests  — 챌린지 아레나 체력 종목별 지금 최고 기록 (계속 바뀜)
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";

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

export interface Records153 {
  firsts: Record153First[];
  bests: Record153Best[];
  members: number;
}

export const RECORDS_153_KEY = ["records-153"] as const;

/** 최초 기록을 처음 세우면 주는 마일리지 (2026-10-16 대표님, DB app_settings.mileage_rules.record) */
export const RECORD_153_MILEAGE = 10_000;

export type Record153Section = "start" | "level" | "fitness";

/** 153 레코드 '최초' 기록 칸 — 153 레코드 탭 · 랭킹/명예의 전당 띠가 같이 쓴다 */
export const RECORD_153_FIRSTS: ReadonlyArray<{
  key: string;
  section: Record153Section;
  emoji: string;
  title: string;
  desc: string;
  empty: string;
}> = [
  { key: "first_signup", section: "start", emoji: "🥇", title: "최초 가입자", desc: "마이복서153에 가장 먼저 이름을 올린 회원", empty: "" },
  { key: "first_checkin", section: "start", emoji: "🚪", title: "최초 출석", desc: "앱이 생기고 처음으로 앱 출석을 찍은 회원", empty: "" },
  { key: "first_100_checkins", section: "start", emoji: "💯", title: "최초 출석 100회", desc: "가장 먼저 100번 출석한 회원", empty: "100번째 출석을 가장 먼저 찍는 회원이 주인이 돼요" },
  { key: "first_journal", section: "start", emoji: "✍️", title: "최초 커뮤니티 글", desc: "153 커뮤니티에 처음 글을 남긴 회원", empty: "커뮤니티에 처음 글을 쓰는 회원이 주인이 돼요" },
  { key: "first_handwrap", section: "start", emoji: "🩹", title: "최초 붕대 감기 연습", desc: "집에서 붕대 감기를 처음 해 본 회원", empty: "붕대 감기 연습을 처음 하는 회원이 주인이 돼요" },
  { key: "first_lv10", section: "level", emoji: "🔟", title: "최초 레벨 10", desc: "화이트 리그 끝까지 가장 먼저 오른 회원", empty: "레벨 10에 가장 먼저 오르는 회원이 주인이 돼요" },
  { key: "first_lv11", section: "level", emoji: "🔵", title: "최초 레벨 11", desc: "블루 리그 첫 입성", empty: "블루 리그에 가장 먼저 오르는 회원이 주인이 돼요" },
  { key: "first_lv21", section: "level", emoji: "🔴", title: "최초 레벨 21", desc: "레드 리그 첫 입성", empty: "레드 리그에 가장 먼저 오르는 회원이 주인이 돼요" },
  { key: "first_lv31", section: "level", emoji: "⚫", title: "최초 레벨 31", desc: "블랙 리그 첫 입성", empty: "블랙 리그에 가장 먼저 오르는 회원이 주인이 돼요" },
  // 아레나 '최초 체력테스트 기록'은 아레나가 빠져서 153 TEST 완주로 바꿈 (2026-10-16)
  { key: "first_test153", section: "fitness", emoji: "⏱️", title: "최초 153 TEST 완주", desc: "코치님과 공식 153 TEST를 처음 끝까지 마친 회원", empty: "153 TEST를 처음 완주하는 회원이 주인이 돼요" },
];

export async function getRecords153(): Promise<Records153> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("get_153_records");
  if (error) throw new Error(translateError(error));
  const d = (data ?? {}) as Partial<Records153>;
  return { firsts: d.firsts ?? [], bests: d.bests ?? [], members: Number(d.members ?? 0) };
}

export function useRecords153(enabled = true) {
  return useQuery({ queryKey: RECORDS_153_KEY, queryFn: getRecords153, enabled, staleTime: 60_000 });
}
