/**
 * 라이브보드 컴팩트 그리드 — 카드 크기 · 칸 × 줄 계산 (components/liveBoard/LiveCompactGrid 에서 쓴다).
 *   화면과 따로 두어 시험(liveGridLayout.test.ts)할 수 있게 했다 (2026-10-28 — 떠 있는 QR 카드 피하기를 더하며).
 */
/** 카드를 그리는 기본 폭 — 예전 '작은 카드' 크기 */
export const BASE_W = 300;
/** 카드 폭 최대·최소 (TV 1920×1080 기준 px) */
const MAX_W = 560;
const MIN_W = 250;
export const GAP = 10;
const MAX_COLS = 8;
/** 카드 높이를 아직 못 쟀을 때 쓰는 값 (기본 폭 300 일 때 작은 카드 높이) */
const FALLBACK_H = 116;

export interface Layout {
  cols: number;
  rows: number;
  scale: number;
  pageSize: number;
  /** 떠 있는 카드에 가려 비워 두는 칸 (줄 × cols + 칸) */
  blocked: number[];
}

/** 카드 자리 오른쪽 아래에 비워 둘 자리 (px) — 떠 있는 카드가 덮는 만큼 */
export interface Reserve {
  w: number;
  h: number;
}

/** 이 배치에서 비워 둘 자리(reserve)에 걸리는 칸. 칸 모음은 가운데 정렬 · 위에서부터 */
export function blockedCells(cols: number, rows: number, scale: number, w: number, baseH: number, h: number, reserve?: Reserve | null): number[] {
  if (!reserve || reserve.w <= 0 || reserve.h <= 0) return [];
  const cellW = Math.floor(BASE_W * scale);
  const cellH = baseH * scale;
  const gridW = cols * cellW + (cols - 1) * GAP;
  const left = Math.max(0, (w - gridW) / 2);
  const out: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const right = left + c * (cellW + GAP) + cellW;
      const bottom = r * (cellH + GAP) + cellH;
      if (right > w - reserve.w && bottom > h - reserve.h) out.push(r * cols + c);
    }
  }
  return out;
}

/** 남은 공간(w×h)에 n명을 넣는 가장 큰 배치. 최소 크기보다 작아지면 최소 크기로 한 화면씩. reserve 구석의 칸은 비운다 */
export function computeGridLayout(n: number, w: number, h: number, cardH: number, reserve?: Reserve | null): Layout {
  const baseH = cardH > 0 ? cardH : FALLBACK_H;
  if (n <= 0 || w <= 0 || h <= 0) return { cols: 1, rows: 1, scale: 1, pageSize: Math.max(1, n), blocked: [] };
  const maxScale = MAX_W / BASE_W;
  const minScale = MIN_W / BASE_W;
  let best: Layout | null = null;
  for (let cols = 1; cols <= Math.min(MAX_COLS, n); cols++) {
    // 가려진 칸이 있으면 줄을 하나씩 늘려 본다 (크기가 최소보다 작아지면 그만)
    for (let rows = Math.ceil(n / cols); ; rows++) {
      const byW = (w - GAP * (cols - 1)) / cols / BASE_W;
      const byH = (h - GAP * (rows - 1)) / rows / baseH;
      const scale = Math.min(byW, byH, maxScale);
      const blocked = blockedCells(cols, rows, scale, w, baseH, h, reserve);
      if (cols * rows - blocked.length >= n) {
        // 더 크면 바꾸고, 크기가 같으면(최대 크기에 걸린 경우 등) 줄이 적은 쪽 — 가로로 넓게
        if (!best || scale > best.scale * 1.005 || (scale >= best.scale * 0.995 && rows < best.rows)) {
          best = { cols, rows, scale, pageSize: n, blocked };
        }
        break;
      }
      if (scale < minScale) break;
    }
  }
  if (best && best.scale >= minScale) return best;
  // 최소 크기로도 다 안 들어감 → 최소 크기로 한 화면에 들어가는 만큼씩 넘긴다
  const cols = Math.max(1, Math.min(MAX_COLS, Math.floor((w + GAP) / (MIN_W + GAP))));
  const rows = Math.max(1, Math.floor((h + GAP) / (baseH * minScale + GAP)));
  const blocked = blockedCells(cols, rows, minScale, w, baseH, h, reserve);
  return { cols, rows, scale: minScale, pageSize: Math.max(1, cols * rows - blocked.length), blocked };
}
