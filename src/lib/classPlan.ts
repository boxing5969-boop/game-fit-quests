/**
 * 📝 코치님 「내 수업 짜기」 — 수업안 (2026-11-13 대표님 「코치님 내 수업 짜기 (추천)」)
 *
 *   전략 회의 › 오늘 프로그램 칸에서 코치님이 블록마다 153 콘텐츠 카드를 골라 수업을 짠다.
 *   새 표 · 새 함수 없이 수업 기록(strategy_items kind 'class_log') 한 줄에 data.stage = 'plan' 으로 둔다:
 *     · 보이는 사람 = 수업 기록과 같다(그 지점 코치진 · 대표님) — 지시처럼 알림이 퍼지지 않는다
 *     · 대표님 · 지점장님은 수업안에 피드백(댓글)을 남긴다 — 글쓴이에게 알림(서버 그대로)
 *     · 수업이 끝나 「기록 쓰기」를 하면 같은 글이 수업 기록이 된다(stage 가 빠지고 짠 블록은 data.plan 에 남는다 · 피드백도 그대로 이어진다)
 *   서버 셈(153 기준 점검 · 4주 성장)은 data.std 가 있는 수업 기록만 세서 수업안은 섞이지 않는다.
 *   이 파일은 화면 없는 계산만 — 시험 classPlan.test.ts
 */
import type { ProgramBlock, StrategyItem } from "@/services/strategyService";

export const PLAN_STAGE = "plan" as const;

type PlanLike = Pick<StrategyItem, "kind" | "data">;

/** 수업안인가 — 수업 기록 중 아직 기록 전(stage 'plan') */
export const isClassPlan = (item: PlanLike): boolean => item.kind === "class_log" && item.data?.stage === PLAN_STAGE;

/** 수업안의 블록 · 시간 · 합계 */
export interface PlanSnapshot {
  title: string;
  slot: string | null;
  blocks: ProgramBlock[];
  total_min: number;
}

const total = (blocks: readonly ProgramBlock[]) => blocks.reduce((s, b) => s + (Number(b.minutes) || 0), 0);

/** 수업안 → 기록에 남길 모양 (data.plan) */
export function planSnapshot(item: Pick<StrategyItem, "title" | "data">): PlanSnapshot {
  const blocks = Array.isArray(item.data?.blocks) ? (item.data.blocks as ProgramBlock[]) : [];
  const slot = typeof item.data?.slot === "string" && item.data.slot.trim() ? item.data.slot.trim() : null;
  return { title: item.title ?? "", slot, blocks, total_min: total(blocks) };
}

/** 수업 시간 글('19:00' · '7시' · '19') → 기록의 시(5~23시). 못 읽으면 fallback */
export function planHour(slot: string | null | undefined, fallback: number): number {
  const m = /^(\d{1,2})/.exec((slot ?? "").trim());
  const h = m ? Number(m[1]) : NaN;
  return Number.isInteger(h) && h >= 5 && h <= 23 ? h : fallback;
}

const dateOf = (i: Pick<StrategyItem, "event_date" | "created_at">): string => i.event_date ?? i.created_at.slice(0, 10);
const slotKey = (i: Pick<StrategyItem, "data">): string => (typeof i.data?.slot === "string" ? i.data.slot : "99:99");
const byDateSlot = (a: StrategyItem, b: StrategyItem) =>
  dateOf(a).localeCompare(dateOf(b)) || slotKey(a).localeCompare(slotKey(b)) || a.created_at.localeCompare(b.created_at);

/**
 * 오늘 프로그램 칸에 보일 수업안 — 내 것 먼저(지난 날짜인데 기록 전인 것 → 오늘 · 앞으로), 다른 코치님 것은 오늘 · 앞으로만.
 * 날짜 · 시간 순.
 */
export function plansForBoard(items: readonly StrategyItem[], today: string): { mine: StrategyItem[]; others: StrategyItem[] } {
  const plans = items.filter(isClassPlan);
  const mine = plans.filter((p) => p.mine).sort(byDateSlot);
  const others = plans.filter((p) => !p.mine && dateOf(p) >= today).sort(byDateSlot);
  return { mine, others };
}

/** 지난 날짜인데 아직 기록 전 — 「수업 끝 — 기록 쓰기」를 먼저 보이게 */
export const planOverdue = (item: Pick<StrategyItem, "event_date" | "created_at">, today: string): boolean => dateOf(item) < today;

/** 대표님 · 지점장님 칸 점 — 오늘 다른 코치님 수업안 중 아직 피드백이 없는 것 */
export function plansAwaitingFeedback(items: readonly StrategyItem[], today: string): number {
  return items.filter((i) => isClassPlan(i) && !i.mine && dateOf(i) === today && (i.comments ?? 0) === 0).length;
}

/** 수업 기록 칸 — 수업안은 빼고 */
export const onlyClassLogs = (items: readonly StrategyItem[]): StrategyItem[] => items.filter((i) => !isClassPlan(i));
