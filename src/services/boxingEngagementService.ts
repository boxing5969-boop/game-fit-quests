/**
 * 153 QUEST 몰입 레이어 v1 — 보조 보상 시스템 service.
 *
 * 마이그레이션 20260508000000_boxing_engagement_foundation.sql 의 RPC/테이블 래퍼.
 *
 * 보호 원칙(절대):
 *   · 공식 1~40 levels/missions/member_progress 미수정
 *   · 공식 XP 미지급 — QUEST XP / RP / 파이트 머니만 지급
 *   · 파이트 머니는 RPC 내부 grant_gems 경유 (클라이언트 직접 wallet update 금지)
 *   · 클라이언트는 amount 를 보내지 않는다 — 서버가 row 와 내부 규칙으로 결정
 *
 * 타입 주의:
 *   types.ts(자동 생성) 에 신규 테이블/RPC 가 아직 없으므로 from()/rpc() 호출은 cast 사용.
 *   향후 supabase gen types 시 cast 만 제거하면 된다.
 */

import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";

// types.ts 갱신 전 임시 cast — 향후 자동 생성 후 제거.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// ──────────────────────────────────────────────────────────────────
// 한국어 fallback (translateError 가 매핑하지 못하는 RPC 도메인 메시지 보강)
// ──────────────────────────────────────────────────────────────────

const ENGAGEMENT_ERROR_MAP: ReadonlyArray<{ match: string; ko: string }> = [
  { match: "auth required", ko: "로그인이 필요합니다." },
  { match: "question not available", ko: "지금은 풀 수 없는 문제입니다." },
  { match: "challenge not available", ko: "지금은 도전할 수 없는 챌린지입니다." },
  { match: "invalid difficulty", ko: "올바르지 않은 난이도입니다." },
  { match: "selected_answer required", ko: "답안을 선택해주세요." },
  { match: "content required", ko: "일기 내용을 입력해주세요." },
  { match: "receiver required", ko: "응원할 상대를 선택해주세요." },
  { match: "cannot cheer yourself", ko: "본인에게는 응원을 보낼 수 없습니다." },
  { match: "invalid cheer_type", ko: "올바르지 않은 응원 종류입니다." },
  { match: "receiver not found", ko: "응원할 회원을 찾을 수 없습니다." },
];

function toKoreanError(err: unknown): string {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "";
  const lower = msg.toLowerCase();
  for (const { match, ko } of ENGAGEMENT_ERROR_MAP) {
    if (lower.includes(match)) return ko;
  }
  return translateError(err);
}

function throwKo(err: unknown): never {
  throw new Error(toKoreanError(err));
}

// ──────────────────────────────────────────────────────────────────
// 반환 타입
// ──────────────────────────────────────────────────────────────────

export interface BoxingEngagementSummary {
  success: true;
  quest_xp: number;
  respect_points: number;
  quiz_correct_count: number;
  quiz_attempt_count: number;
  challenge_clear_count: number;
  challenge_attempt_count: number;
  cheer_sent_count: number;
  cheer_received_count: number;
  journal_count: number;
  current_quiz_streak: number;
  best_quiz_streak: number;
  today_quest_xp: number;
  today_gems: number;
  last_daily_briefing_date: string | null;
}

export const EMPTY_ENGAGEMENT_SUMMARY: BoxingEngagementSummary = {
  success: true,
  quest_xp: 0,
  respect_points: 0,
  quiz_correct_count: 0,
  quiz_attempt_count: 0,
  challenge_clear_count: 0,
  challenge_attempt_count: 0,
  cheer_sent_count: 0,
  cheer_received_count: 0,
  journal_count: 0,
  current_quiz_streak: 0,
  best_quiz_streak: 0,
  today_quest_xp: 0,
  today_gems: 0,
  last_daily_briefing_date: null,
};

export type QuizQuestionType = "multiple_choice" | "ox" | "order" | "situation";
export type QuizDifficulty = "beginner" | "normal" | "advanced";

export interface BoxingQuizQuestion {
  id: string;
  category: string;
  title: string;
  lesson_text: string;
  question: string;
  question_type: QuizQuestionType;
  options: string[];
  correct_answer: string;
  explanation: string | null;
  difficulty: QuizDifficulty;
  reward_quest_xp: number;
  reward_gems: number;
  retry_reward_quest_xp: number;
  retry_reward_gems: number;
  active: boolean;
  sort_order: number;
}

export interface BoxingQuizAttemptResult {
  success: true;
  is_correct: boolean;
  already_rewarded: boolean;
  attempt_no: number;
  quest_xp_granted: number;
  gems_granted: number;
  correct_answer: string;
  explanation: string | null;
  message: string;
}

export type FunChallengeCategory =
  | "jab"
  | "one_two"
  | "squat"
  | "pushup"
  | "sandbag"
  | "jump_rope"
  | "guard"
  | "combo"
  | "community"
  | "recovery";

export interface BoxingFunChallenge {
  id: string;
  code: string;
  title: string;
  description: string;
  category: FunChallengeCategory;
  target_metric: string;
  duration_seconds: number | null;
  difficulty_targets: Record<QuizDifficulty, number>;
  rewards_by_difficulty: Record<
    QuizDifficulty,
    { quest_xp: number; gems: number }
  >;
  pain_check_required: string[];
  high_intensity: boolean;
  safety_note: string | null;
  active: boolean;
  sort_order: number;
}

export interface SubmitFunChallengeInput {
  challengeId: string;
  difficulty: QuizDifficulty;
  submittedValue: number;
  painCheckPassed?: boolean;
  note?: string | null;
}

export interface FunChallengeAttemptResult {
  success: true;
  status: "submitted" | "completed" | "failed" | "rejected";
  target_value: number;
  submitted_value: number;
  daily_limit_reached: boolean;
  quest_xp_granted: number;
  gems_granted: number;
  message: string;
}

export interface SubmitJournalInput {
  prompt: string;
  content: string;
  mood?: string | null;
}

export interface JournalEntryResult {
  success: true;
  first_of_day: boolean;
  quest_xp_granted: number;
  gems_granted: number;
  entry_id: string;
  message: string;
}

export interface ChampionJournalEntryRow {
  id: string;
  user_id: string;
  prompt: string;
  content: string;
  mood: string | null;
  quest_xp_granted: number;
  gems_granted: number;
  created_at: string;
}

export type CheerType = "clap" | "sticker" | "comment";

export interface SendCheerInput {
  receiverUserId: string;
  cheerType: CheerType;
  message?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
}

export interface SendCheerResult {
  success: true;
  cheer_id: string;
  respect_granted: number;
  receiver_gems_granted: number;
  sender_daily_count_today: number;
  limit_reached: boolean;
  message: string;
}

export interface SecondCheerCandidate {
  user_id: string;
  display_name: string;
  branch_name: string;
  current_rank: string | null;
  current_level: number | null;
}

// ──────────────────────────────────────────────────────────────────
// 1. getMyBoxingEngagementSummary
// ──────────────────────────────────────────────────────────────────

export async function getMyBoxingEngagementSummary(): Promise<BoxingEngagementSummary> {
  const { data, error } = await sb.rpc("get_my_boxing_engagement_summary");
  if (error) throwKo(error);
  if (!data || data.success !== true) {
    throw new Error("요약 정보를 불러오지 못했습니다.");
  }
  return data as BoxingEngagementSummary;
}

// ──────────────────────────────────────────────────────────────────
// 2. getActiveBoxingQuizQuestions  (boxing-academy)
// ──────────────────────────────────────────────────────────────────

export async function getActiveBoxingQuizQuestions(): Promise<BoxingQuizQuestion[]> {
  const { data, error } = await sb
    .from("boxing_quiz_questions")
    .select(
      "id, category, title, lesson_text, question, question_type, options, correct_answer, explanation, difficulty, reward_quest_xp, reward_gems, retry_reward_quest_xp, retry_reward_gems, active, sort_order",
    )
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) throwKo(error);
  return (data ?? []) as BoxingQuizQuestion[];
}

// ──────────────────────────────────────────────────────────────────
// 3. submitBoxingQuizAttempt
// ──────────────────────────────────────────────────────────────────

export async function submitBoxingQuizAttempt(
  questionId: string,
  selectedAnswer: string,
): Promise<BoxingQuizAttemptResult> {
  const { data, error } = await sb.rpc("submit_boxing_quiz_attempt", {
    p_question_id: questionId,
    p_selected_answer: selectedAnswer,
  });
  if (error) throwKo(error);
  if (!data || data.success !== true) {
    throw new Error("퀴즈 결과를 처리하지 못했습니다.");
  }
  return data as BoxingQuizAttemptResult;
}

// ──────────────────────────────────────────────────────────────────
// 4. getActiveBoxingFunChallenges
// ──────────────────────────────────────────────────────────────────

export async function getActiveBoxingFunChallenges(): Promise<BoxingFunChallenge[]> {
  const { data, error } = await sb
    .from("boxing_fun_challenges")
    .select(
      "id, code, title, description, category, target_metric, duration_seconds, difficulty_targets, rewards_by_difficulty, pain_check_required, high_intensity, safety_note, active, sort_order",
    )
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) throwKo(error);
  return (data ?? []) as BoxingFunChallenge[];
}

// ──────────────────────────────────────────────────────────────────
// 5. submitBoxingFunChallengeAttempt
// ──────────────────────────────────────────────────────────────────

export async function submitBoxingFunChallengeAttempt(
  payload: SubmitFunChallengeInput,
): Promise<FunChallengeAttemptResult> {
  const { data, error } = await sb.rpc("submit_boxing_fun_challenge_attempt", {
    p_challenge_id: payload.challengeId,
    p_difficulty: payload.difficulty,
    p_submitted_value: payload.submittedValue,
    p_pain_check_passed: payload.painCheckPassed ?? true,
    p_note: payload.note ?? null,
  });
  if (error) throwKo(error);
  if (!data || data.success !== true) {
    throw new Error("챌린지 결과를 처리하지 못했습니다.");
  }
  return data as FunChallengeAttemptResult;
}

// ──────────────────────────────────────────────────────────────────
// 6. submitChampionJournalEntry
// ──────────────────────────────────────────────────────────────────

export async function submitChampionJournalEntry(
  payload: SubmitJournalInput,
): Promise<JournalEntryResult> {
  const { data, error } = await sb.rpc("submit_champion_journal_entry", {
    p_prompt: payload.prompt,
    p_content: payload.content,
    p_mood: payload.mood ?? null,
  });
  if (error) throwKo(error);
  if (!data || data.success !== true) {
    throw new Error("일기를 저장하지 못했습니다.");
  }
  return data as JournalEntryResult;
}

// ──────────────────────────────────────────────────────────────────
// 6b. getRecentChampionJournalEntries — RLS 가 본인 것만 SELECT 허용
// ──────────────────────────────────────────────────────────────────

export async function getRecentChampionJournalEntries(
  limit = 3,
): Promise<ChampionJournalEntryRow[]> {
  const { data, error } = await sb
    .from("champion_journal_entries")
    .select(
      "id, user_id, prompt, content, mood, quest_xp_granted, gems_granted, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throwKo(error);
  return (data ?? []) as ChampionJournalEntryRow[];
}

// ──────────────────────────────────────────────────────────────────
// 6c. getSecondCheerCandidates — SECURITY DEFINER RPC 경유.
//     민감정보(phone/email/birth_date) 자체를 컬럼 화이트리스트에 미포함.
// ──────────────────────────────────────────────────────────────────

export async function getSecondCheerCandidates(
  limit = 30,
): Promise<SecondCheerCandidate[]> {
  const { data, error } = await sb.rpc("get_second_cheer_candidates", {
    p_limit: limit,
  });
  if (error) throwKo(error);
  return (data ?? []) as SecondCheerCandidate[];
}

// ──────────────────────────────────────────────────────────────────
// 7. sendBoxingCheer
// ──────────────────────────────────────────────────────────────────

export async function sendBoxingCheer(
  payload: SendCheerInput,
): Promise<SendCheerResult> {
  const { data, error } = await sb.rpc("send_boxing_cheer", {
    p_receiver_user_id: payload.receiverUserId,
    p_cheer_type: payload.cheerType,
    p_message: payload.message ?? null,
    p_source_type: payload.sourceType ?? null,
    p_source_id: payload.sourceId ?? null,
  });
  if (error) throwKo(error);
  if (!data || data.success !== true) {
    throw new Error("응원을 전송하지 못했습니다.");
  }
  return data as SendCheerResult;
}
