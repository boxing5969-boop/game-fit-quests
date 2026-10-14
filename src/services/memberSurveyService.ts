/**
 * 회원 설문 — 일일경영리포트(153-boxing-os)의 만족도 조사·고객의 소리함을 앱 안에서 (2026-10-15 대표님).
 *
 * 응답은 지금 QR 로 받는 것과 **같은 공개 경로**로 경영리포트에 저장된다 → 경영리포트 집계·추첨이 그대로 돈다.
 *   · 만족도 조사: 153-boxing-os Supabase RPC get_public_survey / submit_survey_response (anon 공개 함수)
 *   · 고객의 소리: 153-boxing-os API /api/feedback/ch/:slug · /api/feedback/submit (CORS: myboxer153.com 허용됨)
 * 지점별 주소(slug)는 마이복서153 DB branch_survey_links 에 둔다 — 새 지점 QR 을 만들면 그 표에 한 줄 추가.
 * 답변 내용은 마이복서153 DB 에 남기지 않는다(익명 유지). 여기에는 '이번 달 참여 보상'만 기록한다.
 * 답변 형식은 CRM PublicSurveyPage 와 같아야 한다: rating=answer_score, 보기=answer_text+번호, 예/아니오=answer_text "예"|"아니오".
 */
import { supabase } from "@/integrations/supabase/client";

const OS_API = "https://153-boxing-os-api.boxing5969.workers.dev";
const OS_SB_URL = "https://tbxdrfowanyksgdicryl.supabase.co";
// 153-boxing-os 공개(anon) 키 — CRM 공개 설문 페이지가 쓰는 것과 같은 공개 키 (비밀 아님)
const OS_SB_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRieGRyZm93YW55a3NnZGljcnlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMDgyNjEsImV4cCI6MjA5Mjg4NDI2MX0.i8vPePIs0PzreC9RA8d-psLkabgXJRXykC3Km3a434g";

export interface BranchSurveyLinks {
  branch_name: string;
  feedback_slug: string | null;
  survey_slug: string | null;
}

export async function getBranchSurveyLinks(branchName: string | null | undefined): Promise<BranchSurveyLinks | null> {
  if (!branchName) return null;
  const { data } = await (supabase as any)
    .from("branch_survey_links")
    .select("branch_name, feedback_slug, survey_slug")
    .eq("branch_name", branchName)
    .maybeSingle();
  return (data as BranchSurveyLinks | null) ?? null;
}

// ── 만족도 조사 ─────────────────────────────────────────────
export type SurveyQuestionType = "rating" | "multiple_choice" | "yes_no" | "text";
export interface SurveyQuestion {
  id: string;
  order_index: number;
  question_type: SurveyQuestionType;
  question_text: string;
  options: { min?: number; max?: number; labels?: Record<string, string>; choices?: string[] } | null;
  is_required: boolean;
}
export interface PublicSurvey {
  branch_name: string;
  template: { id: string; title: string; description: string | null };
  questions: SurveyQuestion[];
}
export interface SurveyAnswer {
  answer_text?: string | null;
  answer_score?: number | null;
}

async function osRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${OS_SB_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: OS_SB_ANON,
      Authorization: `Bearer ${OS_SB_ANON}`,
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error("설문 서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요");
  return (await res.json()) as T;
}

const SURVEY_ERR: Record<string, string> = {
  QR_NOT_FOUND: "설문을 찾을 수 없어요",
  QR_INACTIVE: "지금은 설문을 받지 않아요",
  QR_EXPIRED: "설문 기간이 끝났어요",
  QR_NOT_YET_VALID: "아직 시작 전인 설문이에요",
  SURVEY_INACTIVE: "지금은 설문을 받지 않아요",
};

export async function getPublicSurvey(slug: string): Promise<PublicSurvey> {
  const r = await osRpc<{ success: boolean; error?: string } & Partial<PublicSurvey>>("get_public_survey", { p_slug: slug });
  if (!r.success) throw new Error(SURVEY_ERR[r.error ?? ""] ?? "설문을 불러오지 못했어요");
  return {
    branch_name: r.branch_name ?? "153복싱짐",
    template: r.template!,
    questions: [...(r.questions ?? [])].sort((a, b) => a.order_index - b.order_index),
  };
}

export async function submitSurvey(slug: string, answers: Record<string, SurveyAnswer>): Promise<void> {
  const payload = Object.entries(answers)
    .filter(([, a]) => a.answer_score != null || (a.answer_text ?? "").trim() !== "")
    .map(([question_id, a]) => ({
      question_id,
      answer_text: a.answer_text?.trim() || null,
      answer_score: a.answer_score ?? null,
    }));
  const r = await osRpc<{ success: boolean; error?: string }>("submit_survey_response", {
    p_qr_slug: slug,
    p_answers: payload,
    p_member_id: null, // 익명 — QR 설문과 같다
    p_respondent_phone: null,
  });
  if (!r.success) throw new Error(SURVEY_ERR[r.error ?? ""] ?? "제출에 실패했어요. 잠시 후 다시 시도해주세요");
}

// ── 고객의 소리 ─────────────────────────────────────────────
export type FeedbackCategory = "coach_praise" | "improvement" | "complaint" | "free";
export interface FeedbackChannel {
  branch_name: string;
  title: string | null;
  prize_text: string | null;
}
export interface FeedbackInput {
  slug: string;
  category: FeedbackCategory;
  rating: number | null;
  content: string;
  coach_name: string | null;
  draw_opt_in: boolean;
  contact_name: string | null;
  contact_phone: string | null;
  privacy_agreed: boolean;
}

export async function getFeedbackChannel(slug: string): Promise<FeedbackChannel> {
  const res = await fetch(`${OS_API}/api/feedback/ch/${encodeURIComponent(slug)}`);
  const json = (await res.json().catch(() => null)) as { success?: boolean; data?: FeedbackChannel; error?: { message?: string } } | null;
  if (!res.ok || !json?.success || !json.data) throw new Error(json?.error?.message ?? "의견함을 불러오지 못했어요");
  return json.data;
}

export async function submitFeedback(input: FeedbackInput): Promise<{ drawEntered: boolean; note: string | null }> {
  const res = await fetch(`${OS_API}/api/feedback/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...input,
      content: input.content.trim(),
      coach_name: input.category === "coach_praise" ? input.coach_name?.trim() || null : null,
      contact_name: input.draw_opt_in ? input.contact_name?.trim() || null : null,
      contact_phone: input.draw_opt_in ? input.contact_phone?.trim() || null : null,
      privacy_agreed: input.draw_opt_in ? input.privacy_agreed : false,
    }),
  });
  const json = (await res.json().catch(() => null)) as { success?: boolean; data?: { drawEntered: boolean; note: string | null }; error?: { message?: string } } | null;
  if (!res.ok || !json?.success || !json.data) throw new Error(json?.error?.message ?? "전송에 실패했어요");
  return json.data;
}

// ── 참여 보상 (마이복서153 DB) ───────────────────────────────
export type SurveyRewardKind = "satisfaction" | "feedback";
export const SURVEY_REWARD: Record<SurveyRewardKind, number> = { satisfaction: 300, feedback: 100 };

export async function getMySurveyRewards(): Promise<Record<SurveyRewardKind, boolean>> {
  const { data } = await (supabase as any).rpc("get_my_survey_rewards");
  return { satisfaction: !!data?.satisfaction, feedback: !!data?.feedback };
}

export async function claimSurveyReward(kind: SurveyRewardKind): Promise<{ granted: boolean; amount?: number }> {
  const { data, error } = await (supabase as any).rpc("claim_survey_reward", { p_kind: kind });
  if (error) return { granted: false };
  return { granted: !!data?.granted, amount: data?.amount };
}
