/**
 * 📘 153 매뉴얼 — 읽음 · 서명 계산 한 곳 (화면 · 현황이 같이 쓴다, 테스트 progress.test.ts)
 *
 *   장 상태
 *   · signed  — 지금 판에 서명함
 *   · resign  — 옛 판에만 서명함 (글이 바뀌어 '새 판 · 다시 서명')
 *   · open    — 읽을 수 있음 (앞의 필독 장을 모두 서명 — 옛 판 서명도 인정해 새 판 때문에 뒤 장이 잠기지는 않는다)
 *   · locked  — 앞의 필독 장 중 서명 안 한 장이 있음 (대표님 · 지점장님은 잠기지 않는다 — 검토용)
 *   필독이 아닌 장(부록)은 늘 open 이고 서명이 없다.
 */
import type { ManualBook, ManualChapter, ManualQuiz, ManualRead } from "./types";

export type ChapterState = "signed" | "resign" | "open" | "locked";

/** 그 장의 가장 높은 판 서명 */
export function latestRead(reads: readonly ManualRead[], chapterId: string): ManualRead | null {
  let best: ManualRead | null = null;
  for (const r of reads) {
    if (r.chapter !== chapterId) continue;
    if (!best || r.version > best.version) best = r;
  }
  return best;
}

export function chapterState(
  book: ManualBook,
  reads: readonly ManualRead[],
  chapterId: string,
  opts: { reviewer?: boolean } = {},
): ChapterState {
  const idx = book.chapters.findIndex((c) => c.id === chapterId);
  if (idx < 0) return "locked";
  const ch = book.chapters[idx];
  if (ch.required) {
    const last = latestRead(reads, ch.id);
    if (last && last.version >= ch.version) return "signed";
    if (last) return "resign";
  }
  if (!ch.required || opts.reviewer) return "open";
  for (let i = 0; i < idx; i += 1) {
    const prev = book.chapters[i];
    if (prev.required && !latestRead(reads, prev.id)) return "locked";
  }
  return "open";
}

export interface BookProgress {
  /** 지금 판에 서명한 필독 장 수 */
  done: number;
  /** 필독 장 수 */
  total: number;
  /** 새 판이라 다시 서명할 장 수 */
  resign: number;
  /** 다음에 읽을 장 — 다 읽었으면 null */
  next: ManualChapter | null;
  /** 마지막 서명 시각 */
  lastSignedAt: string | null;
}

export function bookProgress(book: ManualBook, reads: readonly ManualRead[]): BookProgress {
  let done = 0;
  let total = 0;
  let resign = 0;
  let next: ManualChapter | null = null;
  for (const ch of book.chapters) {
    if (!ch.required) continue;
    total += 1;
    const last = latestRead(reads, ch.id);
    if (last && last.version >= ch.version) done += 1;
    else {
      if (last) resign += 1;
      if (!next) next = ch;
    }
  }
  const ids = new Set(book.chapters.map((c) => c.id));
  let lastSignedAt: string | null = null;
  for (const r of reads) {
    if (!ids.has(r.chapter)) continue;
    if (!lastSignedAt || r.signed_at > lastSignedAt) lastSignedAt = r.signed_at;
  }
  return { done, total, resign, next, lastSignedAt };
}

/** 확인 문제 — 고른 답(문제마다 option 자리, 안 고르면 null)이 모두 맞았나 */
export function quizAllCorrect(quiz: readonly ManualQuiz[], picks: ReadonlyArray<number | null>): boolean {
  return quiz.every((q, i) => picks[i] === q.answer);
}

/** 읽기 화면의 쪽 — 장 표지 → 카드 → 오늘 한 가지 → 확인 문제(문제마다 한 쪽) → 서명(필독) 또는 끝 */
export type ReaderPage =
  | { kind: "cover" }
  | { kind: "card"; index: number }
  | { kind: "today" }
  | { kind: "quiz"; index: number }
  | { kind: "sign" }
  | { kind: "end" };

export function readerPages(ch: ManualChapter): ReaderPage[] {
  const pages: ReaderPage[] = [{ kind: "cover" }];
  ch.cards.forEach((_, index) => pages.push({ kind: "card", index }));
  if (ch.today) pages.push({ kind: "today" });
  ch.quiz.forEach((_, index) => pages.push({ kind: "quiz", index }));
  pages.push(ch.required ? { kind: "sign" } : { kind: "end" });
  return pages;
}

/** 다음 장 (책 순서) */
export function nextChapter(book: ManualBook, chapterId: string): ManualChapter | null {
  const idx = book.chapters.findIndex((c) => c.id === chapterId);
  return idx >= 0 && idx + 1 < book.chapters.length ? book.chapters[idx + 1] : null;
}

/** 현황 — 코치님 한 분 줄 */
export interface PersonSummary extends BookProgress {
  /** 필독 장마다 상태 (책 순서) — 점 줄에 쓴다 */
  marks: Array<{ id: string; no: string; state: "signed" | "resign" | "none" }>;
}

export function personSummary(book: ManualBook, reads: readonly ManualRead[]): PersonSummary {
  const marks = book.chapters
    .filter((c) => c.required)
    .map((c) => {
      const last = latestRead(reads, c.id);
      const state: "signed" | "resign" | "none" = !last ? "none" : last.version >= c.version ? "signed" : "resign";
      return { id: c.id, no: c.no, state };
    });
  return { ...bookProgress(book, reads), marks };
}

/** '읽어 주세요' 알림을 다시 보낼 수 있나 — 서버와 같은 20시간 */
export const NUDGE_GAP_HOURS = 20;
export function canNudge(nudgedAt: string | null, now: Date = new Date()): boolean {
  if (!nudgedAt) return true;
  const t = Date.parse(nudgedAt);
  if (!Number.isFinite(t)) return true;
  return now.getTime() - t >= NUDGE_GAP_HOURS * 3_600_000;
}

/** 'YYYY-MM-DDTHH…' → '11월 11일' (한국 시각) */
export function manualDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const kst = new Date(d.getTime() + 9 * 3_600_000);
  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`;
}
