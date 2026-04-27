/**
 * 챌린지 서비스 — 20260505 마이그레이션 RPC 래퍼.
 *
 * 모든 쓰기는 SECURITY DEFINER RPC 만 사용. RLS 는 읽기만.
 */

import { supabase } from "@/integrations/supabase/client";

export type ChallengeGoal =
  | "fat_loss"
  | "late_snack_stop"
  | "workout_habit"
  | "maintenance";
export type ChallengeStatus = "upcoming" | "active" | "ended";
export type ChallengeTeamSide = "red" | "blue" | "none";

export const CHALLENGE_GOAL_LABEL: Record<ChallengeGoal, string> = {
  fat_loss: "체지방 감량형",
  late_snack_stop: "야식 끊기형",
  workout_habit: "운동 습관형",
  maintenance: "유지 관리형",
};

export interface ChallengeRow {
  id: string;
  title: string;
  goal: ChallengeGoal;
  branch_name: string | null;
  start_date: string;
  duration_days: number;
  status: ChallengeStatus;
  invite_code: string | null;
  is_joined: boolean;
  participant_count: number;
}

export interface ChallengeLeaderRow {
  user_id: string;
  team_side: ChallengeTeamSide;
  total_points: number;
  current_streak: number;
  last_checkin_date: string | null;
  member_name: string | null;
  branch_name: string | null;
}

type Ok<T> = { success: true } & T;
type Err = { success: false; error: string };
type Res<T> = Ok<T> | Err;

const err = (m: string): Err => ({ success: false, error: m });
const asRes = <T>(data: unknown): Res<T> => {
  if (!data || typeof data !== "object") return err("unexpected_response");
  return data as Res<T>;
};

export async function listChallenges(
  status?: ChallengeStatus,
  branchName?: string | null,
): Promise<Res<{ rows: ChallengeRow[] }>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("list_challenges", {
    _status: status ?? null,
    _branch_name: branchName ?? null,
  });
  if (error) return err(error.message);
  return asRes<{ rows: ChallengeRow[] }>(data);
}

export async function joinChallenge(input: {
  challengeId: string;
  teamSide?: ChallengeTeamSide;
  inviteCode?: string | null;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("join_challenge", {
    _challenge_id: input.challengeId,
    _team_side: input.teamSide ?? "none",
    _invite_code: input.inviteCode ?? null,
  });
  if (error) return err(error.message);
  return asRes<{ participant_id: string }>(data);
}

export async function submitChallengeCheckin(input: {
  challengeId: string;
  kind?: "daily" | "comeback" | "mission" | "photo";
  points?: number;
  note?: string | null;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("submit_challenge_checkin", {
    _challenge_id: input.challengeId,
    _kind: input.kind ?? "daily",
    _points: input.points ?? 1,
    _note: input.note ?? null,
  });
  if (error) return err(error.message);
  return asRes<{
    checkin_id?: string;
    current_streak?: number;
    already_done_today?: boolean;
  }>(data);
}

// ──────────────────────────────────────────────────────────────────
// 신규 헬퍼 — quest event 발생 시 active challenge 에 자동 동기화
//
//   · 회원이 active(status='active') 챌린지에 참여 중일 때만 실행
//   · 같은 (kind, today) 조합으로 이미 체크인 했으면 skip — 중복 방지
//   · 내부적으로 기존 submitChallengeCheckin 재사용 (기존 함수 무변경)
//   · 실패해도 throw 하지 않음 — 호출부가 quest event insert 흐름을 막지 않도록 console.warn 만
// ──────────────────────────────────────────────────────────────────

export interface SyncQuestCheckinInput {
  userId: string;
  kind: "mission" | "photo" | "comeback";
  /** mission:3 / photo:2 / comeback:3 — 호출부에서 정책 결정. */
  points: number;
}

export interface SyncQuestCheckinResult {
  attempted: boolean;
  challengeId: string | null;
  alreadyDoneToday: boolean;
  skippedReason?: "no_active_challenge" | "duplicate_today" | "rpc_failed";
}

const SYNC_DEDUP_KEY_PREFIX = "challenge_quest_sync_v1";

function todayKstIso(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // YYYY-MM-DD
}

function dedupKey(userId: string, challengeId: string, kind: string, day: string) {
  return `${SYNC_DEDUP_KEY_PREFIX}:${userId}:${challengeId}:${kind}:${day}`;
}

export async function syncQuestCheckin(
  params: SyncQuestCheckinInput,
): Promise<SyncQuestCheckinResult> {
  const baseFail = (
    reason: SyncQuestCheckinResult["skippedReason"],
  ): SyncQuestCheckinResult => ({
    attempted: false,
    challengeId: null,
    alreadyDoneToday: false,
    skippedReason: reason,
  });

  try {
    // 1) 회원이 참여 중인 active challenge 1개 확보
    //    list_challenges(status='active') 결과 중 is_joined=true 첫 행.
    const list = await listChallenges("active", null);
    if (!list.success) {
      // eslint-disable-next-line no-console
      console.warn("[syncQuestCheckin] listChallenges 실패", list.error);
      return baseFail("rpc_failed");
    }
    const joined = (list.rows ?? []).find((r) => r.is_joined);
    if (!joined) return baseFail("no_active_challenge");

    // 2) 같은 (challenge, kind, today) 로 이미 체크인 했는지 — 클라이언트 dedup
    //    서버 already_done_today 도 있으나, RPC 호출 자체를 줄이기 위해 1차로 localStorage 체크.
    const day = todayKstIso();
    const key = dedupKey(params.userId, joined.id, params.kind, day);
    try {
      const cached = localStorage.getItem(key);
      if (cached === "1") {
        return {
          attempted: false,
          challengeId: joined.id,
          alreadyDoneToday: true,
          skippedReason: "duplicate_today",
        };
      }
    } catch {
      // best-effort — localStorage 비활성/예외 시 진행
    }

    // 3) 기존 submitChallengeCheckin 재사용
    const r = await submitChallengeCheckin({
      challengeId: joined.id,
      kind: params.kind,
      points: params.points,
      note: null,
    });
    if (!r.success) {
      // eslint-disable-next-line no-console
      console.warn("[syncQuestCheckin] submitChallengeCheckin 실패", r.error);
      return {
        attempted: true,
        challengeId: joined.id,
        alreadyDoneToday: false,
        skippedReason: "rpc_failed",
      };
    }

    // 4) 서버 측 already_done_today 도 dedup 캐시에 반영
    const alreadyDoneToday = !!r.already_done_today;
    try {
      localStorage.setItem(key, "1");
    } catch {
      // best-effort
    }
    return {
      attempted: true,
      challengeId: joined.id,
      alreadyDoneToday,
    };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[syncQuestCheckin] 예외", e);
    return baseFail("rpc_failed");
  }
}

export async function getChallengeLeaderboard(
  challengeId: string,
  limit = 50,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("get_challenge_leaderboard", {
    _challenge_id: challengeId,
    _limit: limit,
  });
  if (error) return err(error.message);
  return asRes<{
    team_red_points: number;
    team_blue_points: number;
    participant_count: number;
    rows: ChallengeLeaderRow[];
  }>(data);
}
