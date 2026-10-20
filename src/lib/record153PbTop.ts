/**
 * 🏆 153 레코드 '최초 153 PB 1위 · 남자 / 여자' — 안내 문구 · 기록 표시 (2026-10-20 대표님:
 *   "최초 153 PB 1위 기록자 — 1위 기록은 한 달간 회원님들 테스트 후 최고 기록 보유자에게 수상" ·
 *    한 달은 첫 공식 기록일부터 · 남녀 각각 1명).
 *
 * 정본은 DB — test153_top_window() 가 한 달(첫 공식 기록일 한국 0시 ~ 한 달 뒤 0시)을 정하고,
 * refresh_153_records 가 한 달이 끝난 뒤 그 기간 오픈 공식 기록의 남녀 1위를 새긴다
 * (마이그레이션 20261020204537_records_153_first_payment_pb_top.sql). 여기는 화면 문구만 만든다.
 */
import { fmtScore, TEST153_CAP_MS } from "@/lib/test153";

export type PbTopGender = "남자" | "여자";

export interface PbTopWindow {
  starts_at: string;
  ends_at: string;
}

const KST_MS = 9 * 3600 * 1000;

/** 서버 값 → 창 (모양이 틀리면 null) */
export function parsePbTopWindow(raw: unknown): PbTopWindow | null {
  const w = raw as Partial<PbTopWindow> | null | undefined;
  if (!w || typeof w !== "object") return null;
  if (typeof w.starts_at !== "string" || typeof w.ends_at !== "string") return null;
  if (!Number.isFinite(Date.parse(w.starts_at)) || !Number.isFinite(Date.parse(w.ends_at))) return null;
  return { starts_at: w.starts_at, ends_at: w.ends_at };
}

/** "11월 19일" — 마감 0시의 하루 전(한국 날짜) = 기록을 잴 수 있는 마지막 날 */
export function lastDayLabel(endsAtIso: string): string {
  const k = new Date(Date.parse(endsAtIso) + KST_MS - 1);
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일`;
}

/** 주인 없는 칸 안내 — 시작 전 · 한 달 진행 중 · 끝나고 새기는 중 */
export function pbTopEmptyText(gender: PbTopGender, win: PbTopWindow | null, now: Date = new Date()): string {
  if (!win) return `첫 공식 기록일부터 한 달 — 그때 오픈 ${gender} 1위가 주인이 돼요`;
  if (now.getTime() < Date.parse(win.ends_at)) return `${lastDayLabel(win.ends_at)}까지 잰 기록 중 오픈 ${gender} 1위가 주인이 돼요`;
  return `한 달이 끝났어요 — 오픈 ${gender} 1위 기록이 곧 새겨져요`;
}

/** 새겨진 1위 기록 — score_ms (완주면 시간, 타임캡이면 '캡 + N개') */
export function pbTopValueLabel(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return fmtScore({ finished: value < TEST153_CAP_MS, score_ms: value });
}
