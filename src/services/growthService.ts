/**
 * 🌱 오늘의 1분 성장 — 서버 읽음 기록 (보이지 않게)
 *   글을 열 때 · O/X 를 고를 때 · 「오늘 하나 해 볼게요」 · 좋아요 → DB `growth_mark`
 *   (supabase/migrations/20261116221640_growth_reads.sql — 보상 없음 · 본인 줄만).
 *   답으로 그 글의 좋아요 수를 받는다 — 5명이 넘을 때만(작은 숫자는 서버가 보내지 않는다).
 *   화면은 이 기기 기록(lib/growthRead)으로 그리므로 실패해도 아무것도 달라지지 않는다.
 *   함수가 없는 DB(적용 전 · 옛 DB 미리보기)면 이번 접속 동안 다시 부르지 않는다.
 *   2단계(2026-11-17 대표님 「다음진행」): 서버가 그날을 '읽은 날'로 적는다 — 그날 처음 남았을 때(onReadDay) 화면이
 *   읽은 날 · 운동 달력 체크를 다시 읽고, 누적 도장을 방금 받았으면(답의 stamp) onStamp 로 알려 준다.
 */
import { supabase } from "@/integrations/supabase/client";
import { kstToday } from "@/lib/attendanceCheer";
import type { GrowthPick } from "@/lib/growthRead";

export type GrowthMarkKind = "open" | "quiz" | "act" | "heart_on" | "heart_off";

type RpcError = { code?: string; message?: string } | null;
const rpc = (fn: string, args?: Record<string, unknown>) =>
  (supabase as unknown as { rpc: (f: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: RpcError }> }).rpc(fn, args);
const missingFn = (error: RpcError): boolean =>
  !!error && (error.code === "PGRST202" || error.code === "42883" || /could not find the function|does not exist/i.test(error.message ?? ""));

/** 함수가 없는 서버 — 이번 접속 동안 그만 부른다 */
let off = false;
/** 이번 접속에 이미 남긴 것 (열기 · O/X · 약속은 글마다 한 번이면 된다) */
const sent = new Set<string>();
/** 글마다 좋아요 수 — 서버가 5명이 넘을 때만 보낸다 (그 아래는 숫자가 없다) */
const hearts = new Map<string, number>();
/** (2단계) 이번 접속에 '읽은 날'이 서버에 남은 날 — 그날 처음일 때만 onReadDay 를 부른다 */
let readDay: string | null = null;

export interface GrowthMarkHooks {
  /** 오늘이 읽은 날로 서버에 남았다 (이번 접속 · 그날 처음) — 읽은 날 · 운동 달력 체크를 다시 읽을 때 */
  onReadDay?: () => void;
  /** 누적 도장을 방금 받았다 (읽은 날 n번째) */
  onStamp?: (n: number) => void;
}

/** 이번 접속에 알게 된 그 글의 좋아요 수 (없으면 null) */
export const growthHearts = (lessonId: string): number | null => hearts.get(lessonId) ?? null;

/**
 * 서버에 남기고, 그 글의 좋아요 수(5명이 넘을 때만 · 아니면 null)를 돌려준다.
 * 열기 · O/X · 약속은 글마다 이번 접속에 한 번, 좋아요는 누를 때마다.
 */
export async function markGrowth(
  lesson: { id: string; from: string },
  kind: GrowthMarkKind,
  quiz?: { pick: GrowthPick; right: boolean },
  hooks?: GrowthMarkHooks,
): Promise<number | null> {
  if (off) return null;
  const once = kind === "open" || kind === "quiz" || kind === "act";
  const key = `${kind}:${lesson.id}`;
  if (once) {
    if (sent.has(key)) return growthHearts(lesson.id);
    sent.add(key);
  }
  try {
    const { data, error } = await rpc("growth_mark", {
      p_lesson: lesson.id,
      p_date: lesson.from,
      p_kind: kind,
      p_pick: quiz?.pick ?? null,
      p_right: quiz?.right ?? null,
    });
    if (missingFn(error)) {
      off = true;
      return null;
    }
    if (error) {
      if (once) sent.delete(key); // 못 남겼으면 다음에 다시
      return growthHearts(lesson.id);
    }
    const r = (data ?? {}) as { ok?: unknown; hearts?: unknown; stamp?: unknown };
    if (r.ok === true) {
      const n = typeof r.hearts === "number" && Number.isFinite(r.hearts) && r.hearts > 5 ? Math.floor(r.hearts) : null;
      if (n === null) hearts.delete(lesson.id);
      else hearts.set(lesson.id, n);
      // (2단계) 좋아요 취소 말고는 모두 오늘을 읽은 날로 남긴다 — 화면은 그날 처음 한 번만 다시 읽는다
      if (kind !== "heart_off") {
        const day = kstToday();
        if (readDay !== day) {
          readDay = day;
          hooks?.onReadDay?.();
        }
        if (typeof r.stamp === "number" && Number.isFinite(r.stamp) && r.stamp >= 1) hooks?.onStamp?.(Math.floor(r.stamp));
      }
    }
  } catch {
    if (once) sent.delete(key);
  }
  return growthHearts(lesson.id);
}

/** 시험용 — 접속 동안 기억한 것을 비운다 */
export function resetGrowthServiceForTest(): void {
  off = false;
  sent.clear();
  hearts.clear();
  readDay = null;
}
