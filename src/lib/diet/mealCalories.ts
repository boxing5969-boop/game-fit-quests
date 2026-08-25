/**
 * 153 다이어트 · 사진 칼로리 추정 결과를 다루는 순수 로직.
 *
 * 화면(MealCalorieSheet)과 저장(dietService)이 같은 계산을 쓰도록 여기에 모은다.
 *
 * 대전제: 사진으로 뽑은 칼로리는 "추정" 이다.
 *   · 화면에는 항상 약(≈) 을 붙이고, 신뢰도가 낮으면 범위를 함께 보여준다.
 *   · 회원이 고친 값이 언제나 AI 값보다 우선한다.
 */

import type { MealCategory, MealSlot } from "./mealAnalyzer";

export type MealConfidence = "low" | "medium" | "high";
export type MealKcalSource = "ai" | "edited" | "manual";

/** 서버(Vision)에서 내려오는 한 항목. */
export interface MealVisionItem {
  name: string;
  portion: string;
  kcal: number;
  protein_g: number;
}

/** 서버(Vision) 응답 전체. */
export interface MealVisionResponse {
  items: MealVisionItem[];
  totalKcal: number;
  totalProteinG: number;
  confidence: MealConfidence;
  category: MealCategory;
  feedback: string;
  detectedTags: string[];
  notFood: boolean;
  provider: string;
}

/** 화면에서 회원이 만지는 항목. AI 원본값(base*)은 그대로 두고 배수만 바꾼다. */
export interface MealItemDraft {
  key: string;
  name: string;
  basePortion: string;
  baseKcal: number;
  baseProteinG: number;
  factor: number;
  manual: boolean;
}

/** 양 조절 단계 — 반 / 1인분 / 1.5배 / 2배. */
export const PORTION_STEPS = [0.5, 1, 1.5, 2] as const;

export const FACTOR_LABEL: Record<number, string> = {
  0.5: "절반",
  1: "그대로",
  1.5: "1.5배",
  2: "2배",
};

export const CONFIDENCE_LABEL: Record<MealConfidence, string> = {
  high: "또렷하게 보임",
  medium: "대략 가늠함",
  low: "가늠이 어려움",
};

/** 신뢰도별 오차 폭. 낮을수록 넓게 잡아 솔직하게 보여준다. */
const SPREAD: Record<MealConfidence, number> = {
  high: 0.15,
  medium: 0.22,
  low: 0.32,
};

let keySeq = 0;
const nextKey = () => `mi_${Date.now().toString(36)}_${(keySeq += 1)}`;

export function toDrafts(items: MealVisionItem[]): MealItemDraft[] {
  return items.map((it) => ({
    key: nextKey(),
    name: it.name,
    basePortion: it.portion || "1인분",
    baseKcal: Math.max(0, Math.round(it.kcal)),
    baseProteinG: Math.max(0, Math.round(it.protein_g)),
    factor: 1,
    manual: false,
  }));
}

export function makeManualDraft(name: string, kcal: number, proteinG = 0): MealItemDraft {
  return {
    key: nextKey(),
    name: name.trim().slice(0, 40) || "직접 입력",
    basePortion: "1인분",
    baseKcal: Math.min(Math.max(Math.round(kcal), 0), 3000),
    baseProteinG: Math.min(Math.max(Math.round(proteinG), 0), 200),
    factor: 1,
    manual: true,
  };
}

export const itemKcal = (d: MealItemDraft): number => Math.round(d.baseKcal * d.factor);
export const itemProtein = (d: MealItemDraft): number =>
  Math.round(d.baseProteinG * d.factor);

/** 배수가 1이면 AI 가 본 양 그대로, 아니면 "1인분 · 절반" 식으로 붙여 쓴다. */
export function portionLabel(d: MealItemDraft): string {
  if (d.factor === 1) return d.basePortion;
  return `${d.basePortion} · ${FACTOR_LABEL[d.factor] ?? `${d.factor}배`}`;
}

export const totalKcal = (list: MealItemDraft[]): number =>
  Math.min(list.reduce((s, d) => s + itemKcal(d), 0), 6000);

export const totalProtein = (list: MealItemDraft[]): number =>
  Math.min(list.reduce((s, d) => s + itemProtein(d), 0), 400);

/** 화면 하단에 같이 띄우는 오차 범위. */
export function kcalRange(
  total: number,
  confidence: MealConfidence,
): { low: number; high: number } {
  const spread = SPREAD[confidence] ?? SPREAD.low;
  const round10 = (n: number) => Math.round(n / 10) * 10;
  return {
    low: Math.max(0, round10(total * (1 - spread))),
    high: round10(total * (1 + spread)),
  };
}

/** AI 가 준 그대로면 'ai', 하나라도 손댔으면 'edited'. */
export function sourceOf(
  original: MealVisionItem[],
  drafts: MealItemDraft[],
): MealKcalSource {
  if (drafts.some((d) => d.manual)) return "edited";
  if (drafts.length !== original.length) return "edited";
  if (drafts.some((d) => d.factor !== 1)) return "edited";
  return "ai";
}

/** DB(jsonb) 에 넣을 모양으로 되돌린다. */
export function toStoredItems(drafts: MealItemDraft[]): MealVisionItem[] {
  return drafts.map((d) => ({
    name: d.name,
    portion: portionLabel(d),
    kcal: itemKcal(d),
    protein_g: itemProtein(d),
  }));
}

export type { MealCategory, MealSlot };

/**
 * 오늘 확정된 사진들의 칼로리 합계.
 *
 * 사진 행 타입은 Supabase 생성 타입이라 새 컬럼이 아직 반영돼 있지 않다.
 * 타입 파일을 통째로 다시 만드는 대신 여기서 좁게 읽어 쓴다.
 */
export function sumConfirmedKcal(rows: readonly unknown[]): number {
  let total = 0;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as { total_kcal?: unknown; confirmed_at?: unknown };
    if (!r.confirmed_at) continue;
    const n = typeof r.total_kcal === "number" ? r.total_kcal : Number(r.total_kcal);
    if (Number.isFinite(n)) total += n;
  }
  return Math.min(Math.max(Math.round(total), 0), 20000);
}
