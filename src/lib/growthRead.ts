/**
 * 🌱 오늘의 1분 성장 — 이 기기에 남기는 기록 (읽은 글 · O/X 에서 고른 답 · 좋아요)
 *   2026-11-16 1단계(대표님 「다음」). 화면은 이 기록으로 그린다 — 서버 기록(growth_mark)이 없는 DB 에서도,
 *   인터넷이 끊겨도 그대로 보이게. 계정마다 한 칸 · 120편까지(오래 전에 연 글부터 비운다).
 *   「오늘 하나 해 볼게요」는 예전부터 쓰던 날짜별 칸(mb153.growth.done:…)을 그대로 쓴다.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type GrowthPick = "O" | "X";

export interface GrowthMark {
  /** 처음 연 날 (KST, YYYY-MM-DD) */
  o?: string;
  /** O/X 에서 처음 고른 답 */
  q?: GrowthPick;
  /** 좋아요 */
  h?: true;
}

export type GrowthMarks = Readonly<Record<string, GrowthMark>>;

export const GROWTH_MARKS_MAX = 120;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** 글 이름 — 서버 growth_mark 가 받는 모양과 같다 */
const ID = /^[a-z0-9][a-z0-9-]{1,39}$/;

/** 많아지면 최근에 연 글부터 max 편만 남긴다 */
export function trimGrowthMarks(marks: GrowthMarks, max = GROWTH_MARKS_MAX): GrowthMarks {
  const ids = Object.keys(marks);
  if (ids.length <= max) return marks;
  const keep = ids.sort((a, b) => (marks[b].o ?? "").localeCompare(marks[a].o ?? "")).slice(0, max);
  return Object.fromEntries(keep.map((id) => [id, marks[id]]));
}

/** 기기에 있던 값을 믿지 않고 다듬는다 (모르는 모양은 버린다) */
export function parseGrowthMarks(raw: unknown): GrowthMarks {
  let v = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return {};
    }
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, GrowthMark> = {};
  for (const [id, m] of Object.entries(v as Record<string, unknown>)) {
    if (!ID.test(id) || !m || typeof m !== "object") continue;
    const src = m as Record<string, unknown>;
    const mark: GrowthMark = {};
    if (typeof src.o === "string" && DAY.test(src.o)) mark.o = src.o;
    if (src.q === "O" || src.q === "X") mark.q = src.q;
    if (src.h === true) mark.h = true;
    if (mark.o || mark.q || mark.h) out[id] = mark;
  }
  return trimGrowthMarks(out);
}

/** 글을 열었다 — 처음 연 날만 남긴다 (이미 있으면 그대로) */
export const markOpened = (marks: GrowthMarks, id: string, day: string): GrowthMarks =>
  marks[id]?.o ? marks : trimGrowthMarks({ ...marks, [id]: { ...marks[id], o: day } });

/** O/X 에서 골랐다 — 처음 고른 답만 남긴다 */
export const markPick = (marks: GrowthMarks, id: string, pick: GrowthPick, day: string): GrowthMarks =>
  marks[id]?.q ? marks : { ...marks, [id]: { o: day, ...marks[id], q: pick } };

/** 좋아요를 켜고 끈다 */
export function markHeart(marks: GrowthMarks, id: string, on: boolean, day: string): GrowthMarks {
  const { h: was, ...rest } = marks[id] ?? {};
  if (!!was === on) return marks;
  return { ...marks, [id]: on ? { o: day, ...rest, h: true } : rest };
}

export const growthMarksKey = (uid: string): string => `mb153.growth.read:${uid}`;

export function readGrowthMarks(uid: string): GrowthMarks {
  try {
    return parseGrowthMarks(localStorage.getItem(growthMarksKey(uid)));
  } catch {
    return {};
  }
}

export function writeGrowthMarks(uid: string, marks: GrowthMarks): void {
  try {
    localStorage.setItem(growthMarksKey(uid), JSON.stringify(marks));
  } catch {
    /* 저장 못 하는 브라우저면 이 화면에서만 */
  }
}

/** 이 기기의 기록 — 고치면 바로 저장한다 (계정이 바뀌면 그 계정 것을 다시 읽는다) */
export function useGrowthMarks(uid: string) {
  const [marks, setMarks] = useState<GrowthMarks>(() => readGrowthMarks(uid));
  const latest = useRef(marks);
  const owner = useRef(uid);
  useEffect(() => {
    if (owner.current === uid) return;
    owner.current = uid;
    const next = readGrowthMarks(uid);
    latest.current = next;
    setMarks(next);
  }, [uid]);
  const update = useCallback(
    (fn: (m: GrowthMarks) => GrowthMarks) => {
      // 계정이 막 바뀐 틈에는 앞 계정 기록 위에 쓰지 않는다
      const base = owner.current === uid ? latest.current : readGrowthMarks(uid);
      const next = fn(base);
      if (next === base) return;
      owner.current = uid;
      latest.current = next;
      setMarks(next);
      writeGrowthMarks(uid, next);
    },
    [uid],
  );
  return [marks, update] as const;
}
