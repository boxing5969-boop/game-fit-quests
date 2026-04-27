/**
 * 153 다이어트 — 오삼 코치 규칙 기반 메시지 엔진.
 *
 * AI 호출 없이 메시지 풀에서 결정적으로 선택. seed 가 같으면 같은 메시지 → 하루 동안
 * 같은 컨텍스트에서 메시지가 흔들리지 않음.
 *
 * 톤 규칙:
 *   · 성인 코치 톤. 짧고 힘 있게.
 *   · 죄책감 유발 금지 ("실패", "망함", "또 못함" 등 금지).
 *   · 벌점·체중 비교·외모 평가 금지.
 *   · "지속 > 완벽" 메시지 우선.
 */

import type { TimingGrade } from "@/lib/diet/questTimingEngine";

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

export type QuestMessageType =
  | "morning_start"
  | "mission_complete"
  | "perfect_complete"
  | "incomplete_nudge"
  | "almost_done"
  | "all_done"
  | "comeback_success"
  | "streak_message";

export interface QuestMessageParams {
  type: QuestMessageType;
  /** incomplete_nudge / almost_done 에서 남은 미션 수. */
  remainingCount?: number;
  /** mission_complete / perfect_complete 에서 완료한 미션 라벨. */
  completedMissionLabel?: string;
  /** perfect_complete 분기 — perfect 일 때 더 칭찬. */
  timingGrade?: TimingGrade;
  /** all_done 메시지에서 활용 가능한 오늘의 점수. */
  todayScore?: number;
  /** streak_message — 연속 일 수. */
  streakDays?: number;
  /** 풀 안에서 결정적 인덱스 선택용 시드. 같은 seed → 같은 메시지. */
  seed?: number;
}

// ──────────────────────────────────────────────────────────────────
// Message pools — 각 타입별 ≥ 5개
// ──────────────────────────────────────────────────────────────────

const MORNING_START: readonly string[] = [
  "오늘도 완벽보다 지속입니다. 하나씩 해볼게요.",
  "지금 시작하면 오늘 흐름은 이미 절반 성공입니다.",
  "어제와 비교하지 말고, 오늘 한 가지만 잘 짚고 갑시다.",
  "체크 한 번이 오늘의 리듬을 잡습니다. 첫 미션부터 가볍게.",
  "가장 쉬운 미션 하나로 시작하면 흐름이 따라옵니다.",
  "오늘은 어제보다 1퍼센트만 더. 작아도 누적됩니다.",
];

const MISSION_COMPLETE: readonly string[] = [
  "좋아요. 방금 기록이 오늘 흐름을 살렸어요.",
  "체크 하나가 다음 체크를 부릅니다. 이대로 이어가요.",
  "정확히 해냈어요. 이 페이스 그대로 유지합니다.",
  "이런 작은 실행이 21일 결과를 바꿉니다.",
  "한 칸 더 채웠습니다. 끝까지 같은 페이스로 가요.",
  "기록이 쌓일수록 회원님 데이터가 정확해집니다.",
];

const PERFECT_COMPLETE: readonly string[] = [
  "제시간에 해낸 점이 특히 좋습니다.",
  "정시 완료 — 오늘의 리듬을 살린 한 수입니다.",
  "타이밍이 정확했어요. 몸이 가장 잘 받아들이는 시간이에요.",
  "딱 맞춰 들어왔습니다. 계속 이 시간대를 지켜봐요.",
  "베스트 타이밍입니다. 일관성이 결과를 만듭니다.",
];

const INCOMPLETE_NUDGE: readonly string[] = [
  "아직 늦지 않았어요. 남은 한 가지만 더 해볼까요?",
  "지금 한 칸이면 오늘 미션 흐름을 살릴 수 있어요.",
  "포기 대신 작은 한 가지. 그 정도면 충분합니다.",
  "남은 미션 한 개부터 가볍게 가봐요. 무리하지 마세요.",
  "오늘을 완성도 있게 닫는 가장 빠른 길은 한 가지 더 체크입니다.",
  "물 한 잔이라도, 메모 한 줄이라도 — 작은 행동이 흐름을 살립니다.",
];

const ALMOST_DONE: readonly string[] = [
  "거의 다 왔어요. 한 가지만 더하면 오늘이 닫힙니다.",
  "마지막 한 칸 남았어요. 가장 쉬운 것부터 해도 좋아요.",
  "결승선 직전입니다. 마무리의 한 수가 결과를 만듭니다.",
  "딱 하나만 더. 오늘 미션 완주가 눈앞이에요.",
  "끝까지 흐름을 이어 보세요. 마지막 체크가 오늘을 정의합니다.",
];

const ALL_DONE: readonly string[] = [
  "오늘 퀘스트를 모두 마쳤어요. 끝까지 이어간 점이 정말 좋았습니다.",
  "완주 — 오늘의 점수도 우상향입니다. 페이스 유지하세요.",
  "전부 체크 완료. 이 흐름이 21일을 만듭니다.",
  "오늘은 100% 입니다. 잠시 멈춰서 칭찬받으세요.",
  "하루 닫기 완료. 회복까지 챙기면 내일도 가볍습니다.",
  "모든 미션 클리어. 일관성이 곧 결과입니다.",
];

const COMEBACK_SUCCESS: readonly string[] = [
  "다시 돌아왔습니다. 그게 가장 큰 성과예요.",
  "복귀 — 어떤 결과보다 가치 있는 한 걸음입니다.",
  "쉬어 갔던 시간을 자산으로 바꿨어요. 오늘 한 칸이 그 증거입니다.",
  "공백을 끊고 재개했습니다. 이게 진짜 실력입니다.",
  "회원님은 멈추지 않습니다. 다시 들어온 지금이 그 증거예요.",
  "끊어졌다 이어지는 게 진짜 습관입니다. 잘 돌아왔어요.",
];

const STREAK_MESSAGE: readonly string[] = [
  "연속 기록이 오늘도 이어집니다. 작은 일관성이 가장 강합니다.",
  "끊김 없이 이어가는 중 — 회원님의 페이스가 만든 결과입니다.",
  "꾸준함은 가장 비싼 성과입니다. 오늘도 한 줄 더 그었어요.",
  "이 길이가 곧 자산입니다. 무리하지 말고 페이스만 유지하세요.",
  "연속 기록은 흔들림 없는 자기 신뢰의 증거입니다.",
];

const POOLS: Readonly<Record<QuestMessageType, readonly string[]>> =
  Object.freeze({
    morning_start: MORNING_START,
    mission_complete: MISSION_COMPLETE,
    perfect_complete: PERFECT_COMPLETE,
    incomplete_nudge: INCOMPLETE_NUDGE,
    almost_done: ALMOST_DONE,
    all_done: ALL_DONE,
    comeback_success: COMEBACK_SUCCESS,
    streak_message: STREAK_MESSAGE,
  });

// ──────────────────────────────────────────────────────────────────
// Deterministic index selection
//   seed 가 주어지면 그 값 기준 mod 인덱스. 미지정 시 Math.random.
//   seed 는 호출부에서 (userId hash + 날짜 hash + type) 형태로 만들어 넣으면
//   같은 회원·같은 날·같은 타입의 메시지가 흔들리지 않음.
// ──────────────────────────────────────────────────────────────────

function pickIndex(poolLength: number, seed?: number): number {
  if (poolLength <= 0) return 0;
  if (typeof seed === "number" && Number.isFinite(seed)) {
    // 양의 정수로 변환 후 mod
    const s = Math.abs(Math.floor(seed));
    return s % poolLength;
  }
  return Math.floor(Math.random() * poolLength);
}

// ──────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────

/**
 * 메시지 1개 반환. 컨텍스트(미션 라벨·남은 수·점수·streak)는 prefix/suffix 로
 * 자연스럽게 결합. 본문은 풀에서 결정적 선택.
 */
export function getQuestMessage(params: QuestMessageParams): string {
  const pool = POOLS[params.type];
  const idx = pickIndex(pool.length, params.seed);
  const base = pool[idx] ?? "";

  switch (params.type) {
    case "mission_complete": {
      // 라벨 prefix: "[잽] 좋아요. ..."
      if (params.completedMissionLabel) {
        return `[${params.completedMissionLabel}] ${base}`;
      }
      return base;
    }
    case "perfect_complete": {
      if (params.completedMissionLabel) {
        return `[${params.completedMissionLabel}] ${base}`;
      }
      return base;
    }
    case "incomplete_nudge":
    case "almost_done": {
      // 남은 수 표기 — 0 이면 본문만, 1 이상이면 suffix 추가.
      if (typeof params.remainingCount === "number" && params.remainingCount > 0) {
        return `${base} (남은 미션 ${params.remainingCount}개)`;
      }
      return base;
    }
    case "all_done": {
      if (typeof params.todayScore === "number" && params.todayScore > 0) {
        return `${base} 오늘 점수 ${params.todayScore}점.`;
      }
      return base;
    }
    case "streak_message": {
      if (typeof params.streakDays === "number" && params.streakDays > 0) {
        return `${base} (연속 ${params.streakDays}일)`;
      }
      return base;
    }
    case "morning_start":
    case "comeback_success":
    default:
      return base;
  }
}

// ──────────────────────────────────────────────────────────────────
// Seed 헬퍼 — 호출부 편의
// ──────────────────────────────────────────────────────────────────

/**
 * 결정적 시드 생성: (userId|"anon") + YYYY-MM-DD + type → 32-bit hash.
 *   같은 회원·같은 날·같은 타입 호출이면 메시지가 항상 같음.
 */
export function makeMessageSeed(
  userId: string | null | undefined,
  type: QuestMessageType,
  date: Date = new Date(),
): number {
  const key = `${userId ?? "anon"}|${date.toISOString().slice(0, 10)}|${type}`;
  let h = 2166136261; // FNV-1a 32-bit
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
