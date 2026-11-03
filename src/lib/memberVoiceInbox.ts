/**
 * 받은 설문함 — 한 목록 만들기 (2026-11-03 대표님 "두가지 모두 한탭으로 합쳐줘").
 * 화면(components/survey/MemberVoiceInbox)과 테스트(memberVoiceReceipt.test.ts)가 같이 쓰는 순수 함수만 — supabase 를 부르지 않는다.
 */
import type { SurveyInboxItem, VoiceInboxItem } from "@/components/survey/MemberVoiceInbox";
import type { SurveyReplyInfo } from "@/services/memberSurveyService";

/** 거르기 — 답변 대기 = 앱에서 보낸 것 중 아직 답변이 없는 것(답하면 그 회원에게 간다) */
export type InboxFilter = "all" | "wait" | "survey" | "voice";

export type InboxItem =
  | { kind: "survey"; id: string; at: string; s: SurveyInboxItem }
  | { kind: "voice"; id: string; at: string; v: VoiceInboxItem };

const timeOf = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
};

/** 만족도 조사 · 고객의 소리를 한 목록으로 — 최근 것부터 */
export function mergeInbox(surveys: SurveyInboxItem[], voices: VoiceInboxItem[]): InboxItem[] {
  return [
    ...surveys.map((s) => ({ kind: "survey" as const, id: s.id, at: s.at, s })),
    ...voices.map((v) => ({ kind: "voice" as const, id: v.id, at: v.at, v })),
  ].sort((a, b) => timeOf(b.at) - timeOf(a.at));
}

/** 답변 대기 — 앱에서 보낸 것(답이 그 회원에게 간다)인데 아직 답변이 없는 것 */
export const isWaiting = (info: SurveyReplyInfo | undefined): boolean => !!info?.from_app && !info.reply;
