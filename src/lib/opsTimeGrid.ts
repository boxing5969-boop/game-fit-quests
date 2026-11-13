/**
 * 📅 캘린더 3-2단계 — 시간축 보기(일 · 3일 · 주) 계산 한 곳 (화면 OpsPlanTimeGrid · 시험 opsTimeGrid.test.ts)
 *
 *   06:00 ~ 24:00 · 15분 칸 · 한 시간 48px(15분 = 12px) · 겹치는 일정은 나란히(겹치는 묶음마다 칸 수를 나눔).
 *   06:00 앞 일정은 맨 위에 15분짜리로(이른 일정 표시) · 24:00 은 저장할 때 23:59.
 *   끌어 옮기기 · 늘리기는 15분 단위로 붙인다.
 */

export const GRID_START_MIN = 6 * 60;
export const GRID_END_MIN = 24 * 60;
export const SLOT_MIN = 15;
export const HOUR_PX = 48;
export const MIN_PX = HOUR_PX / 60;
/** 누르기 쉬운 가장 작은 높이 (15분 = 12px 라 작다) */
export const MIN_EVENT_PX = 20;
export const GRID_HEIGHT_PX = ((GRID_END_MIN - GRID_START_MIN) / 60) * HOUR_PX;

export const hmMin = (hm: string | null | undefined): number | null => {
  if (!hm || !/^\d{1,2}:\d{2}/.test(hm)) return null;
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
};

/** 분 → "HH:MM" (24:00 이상은 23:59 — 저장 모양) */
export const minHm = (min: number): string => {
  const v = Math.max(0, Math.min(min, 24 * 60 - 1));
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
};

export const snapMin = (min: number, step = SLOT_MIN): number => Math.round(min / step) * step;

/** 시간축 위 y(px) → 분 (붙이기 전) */
export const yToMin = (y: number): number => GRID_START_MIN + y / MIN_PX;
export const minToY = (min: number): number => (min - GRID_START_MIN) * MIN_PX;

export interface GridSpan {
  id: string;
  start: string;
  end: string;
}

export interface Placed<T> {
  item: T;
  top: number;
  height: number;
  /** 겹치는 묶음 안 몇 번째 칸 · 칸 수 */
  col: number;
  cols: number;
  /** 06:00 앞에서 시작 (위가 잘림) */
  early: boolean;
  startMin: number;
  endMin: number;
}

/** 하루 일정 놓기 — 시작 순(같으면 긴 것 먼저) · 겹치는 묶음마다 비어 있는 첫 칸 */
export function layoutDay<T>(items: readonly T[], span: (t: T) => GridSpan): Placed<T>[] {
  const rows = items
    .map((item) => {
      const s = span(item);
      const start = hmMin(s.start) ?? GRID_START_MIN;
      let end = hmMin(s.end) ?? start + 60;
      if (end <= start) end = start + SLOT_MIN;
      const shownStart = Math.max(start, GRID_START_MIN);
      let shownEnd = Math.min(end, GRID_END_MIN);
      if (shownEnd <= shownStart) shownEnd = shownStart + SLOT_MIN;
      return { item, id: s.id, start, end, shownStart, shownEnd };
    })
    .sort((a, b) => a.shownStart - b.shownStart || b.shownEnd - b.shownStart - (a.shownEnd - a.shownStart) || a.id.localeCompare(b.id));

  const out: Placed<T>[] = [];
  let group: typeof rows = [];
  let groupEnd = -1;
  const flush = () => {
    const colEnds: number[] = [];
    const cols: number[] = [];
    for (const r of group) {
      let c = colEnds.findIndex((e) => e <= r.shownStart);
      if (c < 0) {
        c = colEnds.length;
        colEnds.push(r.shownEnd);
      } else colEnds[c] = r.shownEnd;
      cols.push(c);
    }
    group.forEach((r, i) =>
      out.push({
        item: r.item,
        top: minToY(r.shownStart),
        height: Math.max((r.shownEnd - r.shownStart) * MIN_PX, MIN_EVENT_PX),
        col: cols[i],
        cols: colEnds.length,
        early: r.start < GRID_START_MIN,
        startMin: r.start,
        endMin: r.end,
      }),
    );
    group = [];
    groupEnd = -1;
  };
  for (const r of rows) {
    if (group.length && r.shownStart >= groupEnd) flush();
    group.push(r);
    groupEnd = Math.max(groupEnd, r.shownEnd);
  }
  if (group.length) flush();
  return out;
}

/** 끌어 옮긴 새 시작 · 끝 (15분 단위 · 길이 그대로 · 00:00 ~ 24:00 안) */
export function movedTimes(startMin: number, endMin: number, deltaMin: number): { start: number; end: number } {
  const len = Math.max(SLOT_MIN, endMin - startMin);
  let start = snapMin(startMin + deltaMin);
  start = Math.max(0, Math.min(start, 24 * 60 - len));
  return { start, end: start + len };
}

/** 아래 끝을 끌어 늘린 새 끝 (15분 단위 · 시작 + 15분 ~ 24:00) */
export function resizedEnd(startMin: number, endMin: number, deltaMin: number): number {
  return Math.max(startMin + SLOT_MIN, Math.min(snapMin(endMin + deltaMin), 24 * 60));
}

/** 시간축 시각 이름 — "6시" … "23시" */
export const hourLabel = (h: number): string => `${h}시`;

/** 빈 칸을 눌렀을 때 새 일정 — 누른 15분 칸부터 1시간 (24:00 넘지 않게) */
export function slotAt(y: number): { start: string; end: string } {
  const s = Math.max(GRID_START_MIN, Math.min(Math.floor(yToMin(y) / SLOT_MIN) * SLOT_MIN, GRID_END_MIN - SLOT_MIN));
  return { start: minHm(s), end: minHm(Math.min(s + 60, GRID_END_MIN)) };
}
