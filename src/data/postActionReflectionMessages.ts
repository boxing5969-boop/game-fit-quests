/**
 * 마이복서153 — 활동 후 30초 마무리 연출 메시지 (단계 47).
 *
 * 본 파일은 정적 메시지 + 가벼운 글로벌 trigger 버스만 포함.
 * DB / API / wallet / 보상 지급 0. localStorage "noisy 방지" 키만 사용.
 *
 * 표현 규칙:
 *   · 장소 표현 "153복싱짐" 만 사용
 *   · 금지어 0: 링 / 체육관 / 복싱장 / gym / RPG / 몬스터 / 전투 / 보스 / 판타지 / 레벨업
 *   · 차분하고 따뜻한 한 줄 톤
 */

// ─────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────

export type ReflectionSource =
  | "mindset"      // 153마인드셋 세션 완료
  | "camp_day"     // 7일 캠프 Day 완료
  | "camp_finish"  // 7일 캠프 전체 완료
  | "journal"      // 챔피언 일기 저장
  | "iq"           // 복싱 IQ 완료
  | "challenge";   // 챌린지 완료

export interface ReflectionMessage {
  source: ReflectionSource;
  title: string;
  osamiMessage: string;
  /** 오늘 남은 느낌 1줄 */
  feeling: string;
  /** 다음 추천 행동 1개 */
  nextAction: string;
}

// ─────────────────────────────────────────────────────────────
// 메시지 (회원 노출 텍스트)
// ─────────────────────────────────────────────────────────────

export const REFLECTION_MESSAGES: Record<ReflectionSource, ReflectionMessage> = {
  mindset: {
    source: "mindset",
    title: "오늘의 마무리",
    osamiMessage:
      "오늘 마음을 한 번 정돈하셨어요. 그게 오늘의 가장 큰 훈련이에요.",
    feeling: "마음의 결이 조금 가지런해졌어요.",
    nextAction:
      "오늘 한 줄, 챔피언 일기에 남겨두면 내일의 나에게 도움이 돼요.",
  },
  camp_day: {
    source: "camp_day",
    title: "오늘의 마무리",
    osamiMessage: "오늘도 잘 와주셨어요. 내일 또 만나요.",
    feeling: "오늘 하루의 조각이 하나 쌓였어요.",
    nextAction:
      "153복싱짐의 공기를 잠시 떠올려 보세요. 그것만으로도 오늘은 충분해요.",
  },
  camp_finish: {
    source: "camp_finish",
    title: "7일의 끝, 다시 시작",
    osamiMessage: "7일 동안 와줘서 진심으로 고마워요.",
    feeling: "오늘부터는 정해진 길이 아니라, 자기 페이스로 가는 길이에요.",
    nextAction:
      "153복싱짐에서 쌓은 기록은 나를 다시 세우는 증거가 됩니다.",
  },
  journal: {
    source: "journal",
    title: "오늘의 마무리",
    osamiMessage: "한 줄, 잘 남기셨어요.",
    feeling: "오늘의 한 문장이 한 달 뒤의 길이 됩니다.",
    nextAction: "내일도 한 문장이면 충분해요.",
  },
  iq: {
    source: "iq",
    title: "오늘의 마무리",
    osamiMessage: "오늘도 한 줄, 챙기셨어요.",
    feeling: "맞고 틀리는 게 아니라, 한 번 더 본 것이 남아요.",
    nextAction:
      "내일은 자세 한 가지를 거울 앞에서 직접 봐보면 더 깊어져요.",
  },
  challenge: {
    source: "challenge",
    title: "오늘의 마무리",
    osamiMessage: "오늘의 한 번, 안전하게 잘 마치셨어요.",
    feeling: "다치지 않은 오늘이 가장 좋은 오늘이에요.",
    nextAction:
      "내일은 같은 시간에 한 번만 더 — 그 한 번이 길을 만들어요.",
  },
};

export function getReflectionMessage(source: ReflectionSource): ReflectionMessage {
  return REFLECTION_MESSAGES[source];
}

// ─────────────────────────────────────────────────────────────
// 글로벌 trigger 버스 — DOM CustomEvent 사용
// ─────────────────────────────────────────────────────────────

const STORAGE_LAST_SHOWN = "myboxer.postActionReflection.v1.lastShownAt";
export const REFLECTION_EVENT_NAME = "myboxer:postActionReflection";

export interface ReflectionTriggerDetail {
  source: ReflectionSource;
  /** true 면 하루 1회 제한 무시하고 강제로 큰 sheet (Day 7 완료식 같은 큰 의식). */
  force?: boolean;
}

function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 큰 sheet 노출 가능 여부 — 하루 1회 제한.
 * 같은 날 이미 보여줬으면 false → 호출처가 sonner toast 등 작은 표시만.
 */
export function canShowBigReflectionToday(now: Date = new Date()): boolean {
  if (typeof window === "undefined") return false;
  try {
    const last = window.localStorage.getItem(STORAGE_LAST_SHOWN);
    if (!last) return true;
    return last.slice(0, 10) !== todayKey(now);
  } catch {
    return true;
  }
}

/** "오늘 봤음" 마크. */
export function markReflectionShownToday(now: Date = new Date()): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_LAST_SHOWN, now.toISOString());
  } catch {
    // ignore
  }
}

/**
 * 글로벌 trigger — 활동 완료 직후 호출.
 * Sheet 컴포넌트가 listen 후 자체 정책(force / canShowBigReflectionToday)으로 표시 여부 결정.
 *
 * @example
 * triggerPostActionReflection("mindset");
 * triggerPostActionReflection("camp_finish", { force: true });
 */
export function triggerPostActionReflection(
  source: ReflectionSource,
  options: { force?: boolean } = {},
): void {
  if (typeof window === "undefined") return;
  try {
    const detail: ReflectionTriggerDetail = {
      source,
      force: options.force === true,
    };
    window.dispatchEvent(
      new CustomEvent(REFLECTION_EVENT_NAME, { detail }),
    );
  } catch {
    // ignore
  }
}
