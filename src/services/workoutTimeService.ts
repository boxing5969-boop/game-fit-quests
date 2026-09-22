/**
 * 운동시간 기록 — 얼굴 인식 출석을 시작점으로 쓰고, 종료만 회원이 누른다.
 *
 * 왜 이렇게 만들었나 (2026-09-21):
 *   · 확인된 사실 — 브로제이 얼굴 인식기는 ENTRY 만 보낸다(14,300건 중 퇴장 0건).
 *     그래서 퇴장 시각은 앱에서 받는 수밖에 없다.
 *   · 시작 버튼은 두지 않는다. 출석 시각이 곧 시작이라 회원이 잊어도 놓치지 않는다.
 *   · 종료를 안 누르면 50분(한 타임)으로 기록된다. 대다수(96.6%)가 안 누를 것을
 *     전제로 설계했다 — 종료는 랭킹 욕심 있는 회원을 위한 선택 기능이다.
 *
 * 규약 (communityHubService 와 동일):
 *   · types.ts 에 신규 RPC 가 없어 rpc() 는 cast 경유(sbRpc).
 *   · 판정 규칙(50분 기본 · 120분 XP·보너스 상한 · 4시간 초과 무효)은 전부 서버에 있다.
 *     프론트는 숫자를 계산하지 않는다 — 화면과 랭킹이 다른 말을 하지 않게 하려는 것.
 */

import { supabase } from "@/integrations/supabase/client";

type SbResult<T> = { data: T | null; error: { message: string } | null };

async function sbRpc<T>(name: string, args?: Record<string, unknown>): Promise<SbResult<T>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).rpc(name, args);
}

export interface WorkoutToday {
  checked_in: boolean;
  started_at: string | null;
  finished: boolean;
  ended_at: string | null;
  /** 아직 안 눌렀으면 지금까지 흐른 시간(참고용), 눌렀으면 확정 기록 */
  elapsed_minutes: number | null;
  /** 종료를 안 눌렀을 때 기록되는 기본값(한 타임) */
  default_minutes: number;
  month_minutes: number;
  month_days: number;
}

export interface FinishResult {
  success: boolean;
  error?: string;
  already_finished?: boolean;
  minutes?: number;
  xp_granted?: number;
}

export const EMPTY_WORKOUT_TODAY: WorkoutToday = {
  checked_in: false,
  started_at: null,
  finished: false,
  ended_at: null,
  elapsed_minutes: null,
  default_minutes: 50,
  month_minutes: 0,
  month_days: 0,
};

export async function getMyWorkoutToday(): Promise<WorkoutToday> {
  const res = await sbRpc<WorkoutToday>("get_my_workout_today");
  if (res.error) throw new Error(res.error.message || "운동 기록을 불러오지 못했습니다.");
  return res.data ?? EMPTY_WORKOUT_TODAY;
}

/** 운동 종료. p_at_gym 은 표시용 배지일 뿐 — null 이어도 기록은 정상 처리된다. */
export async function finishWorkoutSession(atGym: boolean | null = null): Promise<FinishResult> {
  const res = await sbRpc<FinishResult>("finish_workout_session", { p_at_gym: atGym });
  if (res.error) throw new Error(res.error.message || "종료 처리에 실패했습니다.");
  return res.data ?? { success: false, error: "종료 처리에 실패했습니다." };
}

export interface WorkoutRankRow {
  r_user_id: string;
  r_nickname: string;
  r_branch_name: string | null;
  r_minutes: number;
  r_days: number;
  rank_position: number;
}

export async function getWorkoutTimeRanking(limit = 30): Promise<WorkoutRankRow[]> {
  // 지점은 보내지 않는다 — 서버가 호출자의 지점으로 강제한다(다른 지점 열람 방지).
  const res = await sbRpc<WorkoutRankRow[]>("get_workout_time_ranking", { _limit: limit });
  if (res.error) throw new Error(res.error.message || "랭킹을 불러오지 못했습니다.");
  return res.data ?? [];
}

/** "1시간 20분" 처럼 읽히게. 랭킹·누적 표시에 공통으로 쓴다. */
export function formatMinutes(total: number | null | undefined): string {
  const m = Math.max(0, Math.round(total ?? 0));
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}시간` : `${h}시간 ${rest}분`;
}
