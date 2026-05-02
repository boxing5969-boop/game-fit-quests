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

// ──────────────────────────────────────────────────────────────────
// types.ts 자동 생성 전 타입 우회 헬퍼 (양쪽 다 좁은 범위로 격리).
//   향후 supabase gen types typescript 갱신 시 본 헬퍼만 제거하고
//   호출부는 typed supabase.from / supabase.rpc 로 자연스럽게 전환된다.
// ──────────────────────────────────────────────────────────────────

interface SbResult<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

function sbFrom(table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from(table);
}

async function sbRpc<T>(
  name: string,
  args?: Record<string, unknown>,
): Promise<SbResult<T>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).rpc(name, args);
}

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
  // v1.5 14단계 — 컨디션 게이지
  { match: "condition_type required", ko: "컨디션을 선택해주세요." },
  { match: "invalid condition_type", ko: "올바르지 않은 컨디션입니다." },
  { match: "invalid energy_level", ko: "에너지 레벨은 0~5 사이여야 합니다." },
  // v1.5 15단계 — 리턴 라운드
  { match: "no return round available", ko: "복귀 라운드 조건이 아닙니다." },
  { match: "return round already claimed", ko: "오늘은 이미 복귀 보상을 받았습니다." },
  { match: "return round on cooldown", ko: "이번 복귀 보상은 다음 주기에 다시 열립니다." },
  { match: "mission_code required", ko: "복귀 미션을 선택해주세요." },
  { match: "invalid mission_code", ko: "올바르지 않은 복귀 미션 코드입니다." },
  // v1.5 16단계 — 숨겨진 미션
  { match: "hidden mission not eligible", ko: "아직 조건이 충족되지 않은 숨겨진 미션입니다." },
  { match: "hidden mission already claimed", ko: "이미 받은 숨겨진 미션입니다." },
  // v2 19단계 — 코너맨
  { match: "cornerman pair already exists", ko: "이미 코너맨이 있습니다." },
  { match: "cornerman request already pending", ko: "이미 보낸 요청이 처리 대기 중입니다." },
  { match: "cornerman not your pair", ko: "본인의 코너맨이 아닙니다." },
  { match: "cornerman branch mismatch", ko: "같은 지점 회원만 코너맨이 될 수 있습니다." },
  { match: "cornerman branch unknown", ko: "지점 정보를 확인할 수 없습니다." },
  { match: "cornerman bonus not eligible", ko: "오늘 코너 보너스 조건이 아닙니다." },
  { match: "cornerman bonus already claimed", ko: "오늘 코너 보너스는 이미 받았습니다." },
  { match: "cornerman pair not found", ko: "코너맨 정보를 찾을 수 없습니다." },
  { match: "cornerman not pending", ko: "이미 처리된 요청입니다." },
  { match: "cornerman already ended", ko: "이미 종료된 코너맨 관계입니다." },
  { match: "pair_id required", ko: "잘못된 요청입니다." },
  { match: "receiver required", ko: "상대 회원을 선택해주세요." },
  { match: "cannot request self", ko: "본인에게는 코너맨 요청을 보낼 수 없습니다." },
  { match: "invalid action", ko: "올바르지 않은 응답입니다." },
  // v2 20단계 — 그림자 복서
  { match: "shadow boxer not ready", ko: "아직 비교할 데이터가 부족합니다." },
  { match: "shadow boxer reward already claimed", ko: "이번 달 그림자 보상은 이미 받았습니다." },
  { match: "shadow boxer not improved", ko: "이번 라운드는 데이터로 저장되었습니다." },
  // v2 21단계 — 짐 레이드
  { match: "gym raid not found", ko: "해당 짐 레이드를 찾을 수 없습니다." },
  { match: "gym raid not active", ko: "이미 끝난 짐 레이드입니다." },
  { match: "gym raid invalid source", ko: "기여 인증 정보가 올바르지 않습니다." },
  { match: "gym raid not completed", ko: "짐 레이드 목표가 아직 달성되지 않았습니다." },
  { match: "gym raid no contribution", ko: "기여 기록이 없어 보상을 받을 수 없습니다." },
  { match: "gym raid reward already claimed", ko: "이미 받은 짐 레이드 보상입니다." },
  // v2 22단계 — 코치 대시보드
  { match: "insufficient permissions", ko: "이 화면을 볼 권한이 없습니다." },
  { match: "branch scope mismatch", ko: "본인 지점만 조회할 수 있습니다." },
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
  const { data, error } = await sbRpc<BoxingEngagementSummary>(
    "get_my_boxing_engagement_summary",
  );
  if (error) throwKo(error);
  if (!data || data.success !== true) {
    throw new Error("요약 정보를 불러오지 못했습니다.");
  }
  return data;
}

// ──────────────────────────────────────────────────────────────────
// 2. getActiveBoxingQuizQuestions  (boxing-academy)
// ──────────────────────────────────────────────────────────────────

export async function getActiveBoxingQuizQuestions(): Promise<BoxingQuizQuestion[]> {
  const { data, error } = (await sbFrom("boxing_quiz_questions")
    .select(
      "id, category, title, lesson_text, question, question_type, options, correct_answer, explanation, difficulty, reward_quest_xp, reward_gems, retry_reward_quest_xp, retry_reward_gems, active, sort_order",
    )
    .eq("active", true)
    .order("sort_order", { ascending: true })) as SbResult<
    BoxingQuizQuestion[]
  >;

  if (error) throwKo(error);
  return data ?? [];
}

// ──────────────────────────────────────────────────────────────────
// 3. submitBoxingQuizAttempt
// ──────────────────────────────────────────────────────────────────

export async function submitBoxingQuizAttempt(
  questionId: string,
  selectedAnswer: string,
): Promise<BoxingQuizAttemptResult> {
  const { data, error } = await sbRpc<BoxingQuizAttemptResult>(
    "submit_boxing_quiz_attempt",
    {
      p_question_id: questionId,
      p_selected_answer: selectedAnswer,
    },
  );
  if (error) throwKo(error);
  if (!data || data.success !== true) {
    throw new Error("퀴즈 결과를 처리하지 못했습니다.");
  }
  return data;
}

// ──────────────────────────────────────────────────────────────────
// 4. getActiveBoxingFunChallenges
// ──────────────────────────────────────────────────────────────────

export async function getActiveBoxingFunChallenges(): Promise<BoxingFunChallenge[]> {
  const { data, error } = (await sbFrom("boxing_fun_challenges")
    .select(
      "id, code, title, description, category, target_metric, duration_seconds, difficulty_targets, rewards_by_difficulty, pain_check_required, high_intensity, safety_note, active, sort_order",
    )
    .eq("active", true)
    .order("sort_order", { ascending: true })) as SbResult<
    BoxingFunChallenge[]
  >;

  if (error) throwKo(error);
  return data ?? [];
}

// ──────────────────────────────────────────────────────────────────
// 5. submitBoxingFunChallengeAttempt
// ──────────────────────────────────────────────────────────────────

export async function submitBoxingFunChallengeAttempt(
  payload: SubmitFunChallengeInput,
): Promise<FunChallengeAttemptResult> {
  const { data, error } = await sbRpc<FunChallengeAttemptResult>(
    "submit_boxing_fun_challenge_attempt",
    {
      p_challenge_id: payload.challengeId,
      p_difficulty: payload.difficulty,
      p_submitted_value: payload.submittedValue,
      p_pain_check_passed: payload.painCheckPassed ?? true,
      p_note: payload.note ?? null,
    },
  );
  if (error) throwKo(error);
  if (!data || data.success !== true) {
    throw new Error("챌린지 결과를 처리하지 못했습니다.");
  }
  return data;
}

// ──────────────────────────────────────────────────────────────────
// 6. submitChampionJournalEntry
// ──────────────────────────────────────────────────────────────────

export async function submitChampionJournalEntry(
  payload: SubmitJournalInput,
): Promise<JournalEntryResult> {
  const { data, error } = await sbRpc<JournalEntryResult>(
    "submit_champion_journal_entry",
    {
      p_prompt: payload.prompt,
      p_content: payload.content,
      p_mood: payload.mood ?? null,
    },
  );
  if (error) throwKo(error);
  if (!data || data.success !== true) {
    throw new Error("일기를 저장하지 못했습니다.");
  }
  return data;
}

// ──────────────────────────────────────────────────────────────────
// 6b. getRecentChampionJournalEntries — RLS 가 본인 것만 SELECT 허용
// ──────────────────────────────────────────────────────────────────

export async function getRecentChampionJournalEntries(
  limit = 3,
): Promise<ChampionJournalEntryRow[]> {
  const { data, error } = (await sbFrom("champion_journal_entries")
    .select(
      "id, user_id, prompt, content, mood, quest_xp_granted, gems_granted, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit)) as SbResult<ChampionJournalEntryRow[]>;

  if (error) throwKo(error);
  return data ?? [];
}

// ──────────────────────────────────────────────────────────────────
// 6c. getSecondCheerCandidates — SECURITY DEFINER RPC 경유.
//     민감정보(phone/email/birth_date) 자체를 컬럼 화이트리스트에 미포함.
// ──────────────────────────────────────────────────────────────────

export async function getSecondCheerCandidates(
  limit = 30,
): Promise<SecondCheerCandidate[]> {
  const { data, error } = await sbRpc<SecondCheerCandidate[]>(
    "get_second_cheer_candidates",
    { p_limit: limit },
  );
  if (error) throwKo(error);
  return data ?? [];
}

// ──────────────────────────────────────────────────────────────────
// 7. sendBoxingCheer
// ──────────────────────────────────────────────────────────────────

export async function sendBoxingCheer(
  payload: SendCheerInput,
): Promise<SendCheerResult> {
  const { data, error } = await sbRpc<SendCheerResult>("send_boxing_cheer", {
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
  return data;
}

// ══════════════════════════════════════════════════════════════════
// v1.5 — 14단계 컨디션 게이지
// ══════════════════════════════════════════════════════════════════

export type BoxingConditionType =
  | "great"
  | "normal"
  | "tired"
  | "pain"
  | "short_time";

export interface BoxingConditionLogRow {
  id: string;
  user_id: string;
  condition_type: BoxingConditionType;
  energy_level: number | null;
  pain_area: string[];
  note: string | null;
  selected_at: string;
  created_at: string;
}

export interface SubmitBoxingConditionInput {
  conditionType: BoxingConditionType;
  energyLevel?: number | null;
  painArea?: string[];
  note?: string | null;
}

export interface SubmitBoxingConditionResult {
  success: true;
  log_id: string;
  condition_type: BoxingConditionType;
  message: string;
}

export interface TodayBoxingCondition {
  success: true;
  has_today: boolean;
  log_id?: string;
  condition_type: BoxingConditionType | null;
  energy_level?: number | null;
  pain_area?: string[];
  note?: string | null;
  selected_at?: string;
  message?: string;
}

export async function submitBoxingCondition(
  payload: SubmitBoxingConditionInput,
): Promise<SubmitBoxingConditionResult> {
  const { data, error } = await sbRpc<SubmitBoxingConditionResult>(
    "submit_boxing_condition",
    {
      p_condition_type: payload.conditionType,
      p_energy_level: payload.energyLevel ?? null,
      p_pain_area: payload.painArea ?? [],
      p_note: payload.note ?? null,
    },
  );
  if (error) throwKo(error);
  if (!data || data.success !== true) {
    throw new Error("컨디션을 저장하지 못했습니다.");
  }
  return data;
}

export async function getTodayBoxingCondition(): Promise<TodayBoxingCondition> {
  const { data, error } = await sbRpc<TodayBoxingCondition>(
    "get_today_boxing_condition",
  );
  if (error) throwKo(error);
  if (!data) {
    return {
      success: true,
      has_today: false,
      condition_type: null,
      message: "오늘 컨디션이 아직 기록되지 않았습니다.",
    };
  }
  return data;
}

export async function getRecentBoxingConditions(
  days = 14,
): Promise<BoxingConditionLogRow[]> {
  const { data, error } = await sbRpc<BoxingConditionLogRow[]>(
    "get_recent_boxing_conditions",
    { p_days: days },
  );
  if (error) throwKo(error);
  return data ?? [];
}

// ══════════════════════════════════════════════════════════════════
// v1.5 — 15단계 리턴 라운드
// ══════════════════════════════════════════════════════════════════

export type ReturnRoundType =
  | "after_3_days"
  | "after_7_days"
  | "after_14_days"
  | "after_30_days";

export interface ReturnRoundMission {
  code: string;
  title: string;
  description: string;
  difficulty: "recovery";
}

export interface ReturnRoundStatus {
  success: true;
  active: boolean;
  inactive_days: number;
  return_type: ReturnRoundType | null;
  already_claimed_today?: boolean;
  on_cooldown?: boolean;
  message: string;
  missions?: ReturnRoundMission[];
}

export interface ClaimReturnRoundResult {
  success: true;
  claim_id: string;
  return_type: ReturnRoundType;
  inactive_days: number;
  mission_code: string;
  quest_xp_granted: number;
  gems_granted: number;
  message: string;
}

export async function getReturnRoundStatus(): Promise<ReturnRoundStatus> {
  const { data, error } = await sbRpc<ReturnRoundStatus>(
    "get_return_round_status",
  );
  if (error) throwKo(error);
  if (!data) {
    return {
      success: true,
      active: false,
      inactive_days: 0,
      return_type: null,
      message: "꾸준히 오고 계시네요.",
    };
  }
  return data;
}

export async function claimReturnRoundReward(
  missionCode: string,
): Promise<ClaimReturnRoundResult> {
  const { data, error } = await sbRpc<ClaimReturnRoundResult>(
    "claim_return_round_reward",
    { p_mission_code: missionCode },
  );
  if (error) throwKo(error);
  if (!data || data.success !== true) {
    throw new Error("복귀 보상을 처리하지 못했습니다.");
  }
  return data;
}

// ══════════════════════════════════════════════════════════════════
// v1.5 — 16단계 숨겨진 미션 + 복싱 IQ 리그
// ══════════════════════════════════════════════════════════════════

export interface HiddenMissionClaimedRow {
  code: string;
  title: string;
  description: string;
  quest_xp_granted: number;
  gems_granted: number;
  respect_granted: number;
}

export interface CheckAndClaimHiddenMissionsResult {
  success: true;
  claimed: HiddenMissionClaimedRow[];
}

export interface HiddenMissionProgressRow {
  code: string;
  title: string;
  description: string;
  reward_quest_xp: number;
  reward_gems: number;
  reward_respect: number;
  sort_order: number;
  claimed: boolean;
  claimed_at: string | null;
}

export interface HiddenMissionProgressResult {
  success: true;
  missions: HiddenMissionProgressRow[];
}

export interface BoxingIqLeagueSummary {
  success: true;
  quiz_correct_count: number;
  quiz_attempt_count: number;
  accuracy_rate: number;
  current_quiz_streak: number;
  best_quiz_streak: number;
  week_correct_count: number;
  grade: string;
}

export async function checkAndClaimHiddenMissions(): Promise<CheckAndClaimHiddenMissionsResult> {
  const { data, error } = await sbRpc<CheckAndClaimHiddenMissionsResult>(
    "check_and_claim_hidden_missions",
  );
  if (error) throwKo(error);
  if (!data || data.success !== true) {
    return { success: true, claimed: [] };
  }
  return data;
}

export async function getMyHiddenMissionProgress(): Promise<HiddenMissionProgressResult> {
  const { data, error } = await sbRpc<HiddenMissionProgressResult>(
    "get_my_hidden_mission_progress",
  );
  if (error) throwKo(error);
  if (!data || data.success !== true) {
    return { success: true, missions: [] };
  }
  return data;
}

export async function getBoxingIqLeagueSummary(): Promise<BoxingIqLeagueSummary> {
  const { data, error } = await sbRpc<BoxingIqLeagueSummary>(
    "get_boxing_iq_league_summary",
  );
  if (error) throwKo(error);
  if (!data || data.success !== true) {
    return {
      success: true,
      quiz_correct_count: 0,
      quiz_attempt_count: 0,
      accuracy_rate: 0,
      current_quiz_streak: 0,
      best_quiz_streak: 0,
      week_correct_count: 0,
      grade: "복싱 입문생",
    };
  }
  return data;
}

// ══════════════════════════════════════════════════════════════════
// v2 — 19단계 코너맨 매칭
// ══════════════════════════════════════════════════════════════════

export interface CornermanCandidate {
  user_id: string;
  display_name: string;
  branch_name: string;
  current_rank: string;
  current_level: number;
}

export interface CornermanPendingReceived {
  pair_id: string;
  requester_user_id: string;
  requester_name: string;
  requester_rank: string;
  requester_level: number;
  requested_at: string;
}

export interface CornermanPendingSent {
  pair_id: string;
  receiver_user_id: string;
  receiver_name: string;
  requested_at: string;
}

export interface CornermanTodayStatus {
  date: string;
  my_completed: boolean;
  partner_completed: boolean;
  both_completed: boolean;
  bonus_claimed: boolean;
}

export interface CornermanStatus {
  success: true;
  has_active: boolean;
  pair_id?: string;
  partner_user_id?: string;
  partner_name?: string;
  partner_rank?: string;
  partner_level?: number;
  accepted_at?: string | null;
  today?: CornermanTodayStatus;
  pending_received: CornermanPendingReceived[];
  pending_sent: CornermanPendingSent[];
}

export interface CornermanRequestResult {
  success: true;
  pair_id: string;
  status: "pending" | "active" | "declined" | "ended";
  message: string;
}

export interface ClaimCornermanBonusResult {
  success: true;
  pair_id: string;
  sync_id: string;
  quest_xp_granted: number;
  gems_granted: number;
  respect_granted: number;
  message: string;
}

export const EMPTY_CORNERMAN_STATUS: CornermanStatus = {
  success: true,
  has_active: false,
  pending_received: [],
  pending_sent: [],
};

export async function getCornermanCandidates(
  limit = 30,
): Promise<CornermanCandidate[]> {
  const { data, error } = await sbRpc<CornermanCandidate[]>(
    "get_cornerman_candidates",
    { p_limit: limit },
  );
  if (error) throwKo(error);
  return data ?? [];
}

export async function getMyCornermanStatus(): Promise<CornermanStatus> {
  const { data, error } = await sbRpc<CornermanStatus>(
    "get_my_cornerman_status",
  );
  if (error) throwKo(error);
  if (!data || data.success !== true) {
    return EMPTY_CORNERMAN_STATUS;
  }
  return data;
}

export async function requestCornermanPair(
  receiverUserId: string,
): Promise<CornermanRequestResult> {
  const { data, error } = await sbRpc<CornermanRequestResult>(
    "request_cornerman_pair",
    { p_receiver_user_id: receiverUserId },
  );
  if (error) throwKo(error);
  if (!data || data.success !== true) {
    throw new Error("코너맨 요청을 보내지 못했습니다.");
  }
  return data;
}

export async function respondCornermanPair(
  pairId: string,
  action: "accept" | "decline",
): Promise<CornermanRequestResult> {
  const { data, error } = await sbRpc<CornermanRequestResult>(
    "respond_cornerman_pair",
    { p_pair_id: pairId, p_action: action },
  );
  if (error) throwKo(error);
  if (!data || data.success !== true) {
    throw new Error("코너맨 응답을 처리하지 못했습니다.");
  }
  return data;
}

export async function endCornermanPair(
  pairId: string,
): Promise<CornermanRequestResult> {
  const { data, error } = await sbRpc<CornermanRequestResult>(
    "end_cornerman_pair",
    { p_pair_id: pairId },
  );
  if (error) throwKo(error);
  if (!data || data.success !== true) {
    throw new Error("코너맨 종료를 처리하지 못했습니다.");
  }
  return data;
}

export async function claimCornermanDailyBonus(): Promise<ClaimCornermanBonusResult> {
  const { data, error } = await sbRpc<ClaimCornermanBonusResult>(
    "claim_cornerman_daily_bonus",
  );
  if (error) throwKo(error);
  if (!data || data.success !== true) {
    throw new Error("코너맨 보너스를 받지 못했습니다.");
  }
  return data;
}

// ══════════════════════════════════════════════════════════════════
// v2 — 20단계 그림자 복서
// ══════════════════════════════════════════════════════════════════

export type ShadowBoxerWindow = 7 | 30 | 90;

export interface ShadowBoxerMetric {
  key: string;
  label: string;
  shadow: number;
  current: number;
  improved: boolean;
}

export interface ShadowBoxerSnapshot {
  success: true;
  ready: boolean;
  window_days: number;
  shadow_period?: string;
  current_period?: string;
  shadow_score?: number;
  current_score?: number;
  improved?: boolean;
  growth_rate?: number;
  metrics?: ShadowBoxerMetric[];
  message?: string;
  reason?: string;
}

export interface ClaimShadowBoxerResult {
  success: true;
  claim_id: string;
  window_days: number;
  shadow_score: number;
  current_score: number;
  growth_rate: number;
  quest_xp_granted: number;
  gems_granted: number;
  respect_granted: number;
  message: string;
}

export async function getShadowBoxerSnapshot(
  windowDays: ShadowBoxerWindow = 30,
): Promise<ShadowBoxerSnapshot> {
  const { data, error } = await sbRpc<ShadowBoxerSnapshot>(
    "get_shadow_boxer_snapshot",
    { p_window_days: windowDays },
  );
  if (error) throwKo(error);
  if (!data) {
    return {
      success: true,
      ready: false,
      window_days: windowDays,
      reason: "분석 준비 중입니다.",
      message: "잠시 후 다시 시도해주세요.",
    };
  }
  return data;
}

export async function claimShadowBoxerReward(
  windowDays: ShadowBoxerWindow = 30,
): Promise<ClaimShadowBoxerResult> {
  const { data, error } = await sbRpc<ClaimShadowBoxerResult>(
    "claim_shadow_boxer_reward",
    { p_window_days: windowDays },
  );
  if (error) throwKo(error);
  if (!data || data.success !== true) {
    throw new Error("그림자 복서 보상을 처리하지 못했습니다.");
  }
  return data;
}

// ══════════════════════════════════════════════════════════════════
// v2 — 21단계 짐 레이드
// ══════════════════════════════════════════════════════════════════

export type GymRaidType =
  | "quiz_correct"
  | "challenge_clear"
  | "cheer_sent"
  | "journal_write"
  | "quest_xp"
  | "respect_points";

export type GymRaidStatus = "draft" | "active" | "completed" | "ended";

export type GymRaidContributeSourceType =
  | "boxing_quiz_attempt"
  | "boxing_fun_challenge_attempt"
  | "champion_journal_entry"
  | "boxing_cheer";

export interface GymRaidRow {
  id: string;
  title: string;
  description: string;
  raid_type: GymRaidType;
  target_value: number;
  current_value: number;
  percentage: number;
  start_date: string;
  end_date: string;
  status: GymRaidStatus;
  reward_quest_xp: number;
  reward_gems: number;
  reward_respect: number;
  my_contribution: number;
  reward_claimed: boolean;
}

export interface ActiveGymRaidsResult {
  success: true;
  branch?: string;
  raids: GymRaidRow[];
}

export interface ContributeGymRaidResult {
  success: true;
  contributed: boolean;
  raids_contributed?: number;
  reason?: string;
}

export interface ClaimGymRaidRewardResult {
  success: true;
  claim_id: string;
  raid_id: string;
  contribution_count: number;
  quest_xp_granted: number;
  gems_granted: number;
  respect_granted: number;
  message: string;
}

export async function getActiveGymRaids(): Promise<ActiveGymRaidsResult> {
  const { data, error } = await sbRpc<ActiveGymRaidsResult>(
    "get_active_gym_raids",
  );
  if (error) throwKo(error);
  if (!data || data.success !== true) {
    return { success: true, raids: [] };
  }
  return data;
}

export async function contributeToGymRaid(
  sourceType: GymRaidContributeSourceType,
  sourceId?: string | null,
): Promise<ContributeGymRaidResult> {
  // sourceId 가 없으면 RPC 가 최근 5분 내 본인 source 자동 매칭
  // (v1 RPC 가 ID 반환하지 않는 quiz/challenge 우회용)
  const { data, error } = await sbRpc<ContributeGymRaidResult>(
    "contribute_to_gym_raid",
    { p_source_type: sourceType, p_source_id: sourceId ?? null },
  );
  if (error) {
    // contribute 실패는 사용자 흐름을 막지 말고 silent warning (§ 21단계 요구사항)
    console.warn("[gym-raid] contribute failed:", error);
    return { success: true, contributed: false };
  }
  if (!data) {
    return { success: true, contributed: false };
  }
  return data;
}

export async function claimGymRaidReward(
  raidId: string,
): Promise<ClaimGymRaidRewardResult> {
  const { data, error } = await sbRpc<ClaimGymRaidRewardResult>(
    "claim_gym_raid_reward",
    { p_raid_id: raidId },
  );
  if (error) throwKo(error);
  if (!data || data.success !== true) {
    throw new Error("짐 레이드 보상을 처리하지 못했습니다.");
  }
  return data;
}

// ══════════════════════════════════════════════════════════════════
// v2 — 22단계 코치 대시보드 QUEST 확장
// ══════════════════════════════════════════════════════════════════

export interface CoachQuestSummary {
  total_members: number;
  active_quest_members_7d: number;
  quiz_attempts_7d: number;
  challenge_clears_7d: number;
  journals_7d: number;
  cheers_7d: number;
  return_round_candidates: number;
  cornerman_active_pairs: number;
}

export interface CoachAtRiskMember {
  user_id: string;
  display_name: string;
  current_rank: string;
  current_level: number;
  last_activity_at: string | null;
  inactive_days: number;
  suggested_action: string;
}

export interface CoachPraiseTarget {
  user_id: string;
  display_name: string;
  current_rank: string;
  current_level: number;
  reason: string;
  metric: string;
}

export interface CoachTopRespectMember {
  user_id: string;
  display_name: string;
  respect_points: number;
}

export interface CoachGymRaidProgress {
  raid_id: string;
  title: string;
  raid_type: GymRaidType;
  current_value: number;
  target_value: number;
  percentage: number;
  end_date: string;
  status: GymRaidStatus;
}

export interface CoachGymRaidContributor {
  user_id: string;
  display_name: string;
  contribution_count: number;
}

export interface CoachQuestCommunity {
  active_cornerman_pairs: number;
  cheers_sent_7d: number;
  top_respect_members: CoachTopRespectMember[];
  gym_raid_progress: CoachGymRaidProgress[];
  gym_raid_top_contributors: CoachGymRaidContributor[];
}

export interface CoachQuestDashboard {
  success: true;
  branch?: string;
  reason?: string;
  summary: CoachQuestSummary | Record<string, never>;
  at_risk_members: CoachAtRiskMember[];
  praise_targets: CoachPraiseTarget[];
  community: CoachQuestCommunity | Record<string, never>;
  generated_at?: string;
}

export const EMPTY_COACH_QUEST_DASHBOARD: CoachQuestDashboard = {
  success: true,
  summary: {
    total_members: 0,
    active_quest_members_7d: 0,
    quiz_attempts_7d: 0,
    challenge_clears_7d: 0,
    journals_7d: 0,
    cheers_7d: 0,
    return_round_candidates: 0,
    cornerman_active_pairs: 0,
  },
  at_risk_members: [],
  praise_targets: [],
  community: {
    active_cornerman_pairs: 0,
    cheers_sent_7d: 0,
    top_respect_members: [],
    gym_raid_progress: [],
    gym_raid_top_contributors: [],
  },
};

export async function getCoachQuestDashboard(
  branchName?: string | null,
): Promise<CoachQuestDashboard> {
  const { data, error } = await sbRpc<CoachQuestDashboard>(
    "get_coach_quest_dashboard",
    { p_branch_name: branchName ?? null },
  );
  if (error) throwKo(error);
  if (!data || data.success !== true) {
    return EMPTY_COACH_QUEST_DASHBOARD;
  }
  return data;
}
