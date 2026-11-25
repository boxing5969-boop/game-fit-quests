/**
 * 🧭 관장님 리드 가이드 · 관장님 이해 카드 — 화면 타입 · 글 (2026-11-26 대표님 · 성향 2단계)
 *   서버: coach_lead_state · coach_lead_share_set (20261126000342_coach_lead.sql) · 오삼코치 Edge Function coach-lead(team · pair)
 *   글 모양 · 검사는 supabase/functions/_shared/coachLead.ts 한 곳
 */
import type { LeadGuide, LeaderCard } from "../../supabase/functions/_shared/coachLead.ts";
import type { StaffDisplay } from "@/lib/coachGrowth";

export type { LeadGuide, LeaderCard };

export interface LeadCoachRow {
  person: StaffDisplay | null;
  has_mind: boolean;
  allowed: boolean;
  guide: LeadGuide | null;
  guide_at: string | null;
  stale: boolean;
}

export interface LeaderRow {
  person: StaffDisplay | null;
  card: LeaderCard | null;
  card_at: string | null;
}

export interface CoachLeadState {
  staff: boolean;
  branch?: string | null;
  can_direct?: boolean;
  hq?: boolean;
  ai?: boolean;
  me?: {
    has_mind: boolean;
    share_lead: boolean;
    share_team: boolean;
    team_card: LeaderCard | null;
    team_card_at: string | null;
    team_stale: boolean;
  };
  leaders?: LeaderRow[];
  coaches?: LeadCoachRow[];
}

/** 코치님 눈에 부르는 말 — 대표 = 대표님, 그 밖 = 관장님 (서버 지시문 leaderCall 과 같다) */
export const leaderCallOf = (title?: string | null): string => (title === "대표" ? "대표님" : "관장님");

/** 리드 가이드 줄 상태 한 줄 */
export function leadRowLine(r: LeadCoachRow, hq: boolean): string {
  if (!r.has_mind) return "성향 카드가 아직 없어요";
  if (!r.allowed) return hq ? "가이드를 만들 수 있어요" : "코치님 허락을 기다려요";
  if (r.guide) return r.stale ? "카드가 바뀌었어요 — 다시 만들기" : "가이드 보기";
  return "가이드를 만들 수 있어요";
}
