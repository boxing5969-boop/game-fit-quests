/**
 * 🏢 지점 회의실 — 머리 위 대화 말풍선 자리 잡기 (2026-10-27 대표님 "진짜 회의 하는 것처럼")
 *
 *   회의 탁자는 자리 사이가 좁아(폰에서 40px 남짓) 옆사람 말풍선끼리 겹친다. 그래서
 *   · 가장 최근 말이 먼저 자기 머리 바로 위에 앉는다(꼬리가 그 사람을 가리킨다).
 *   · 먼저 한 말은 겹치지 않게 옆으로 비키고(꼬리는 그대로 머리 위), 그래도 겹치면 위로 올라가
 *     한 줄로 줄어든다 — 꼬리 대신 이름표를 단다.
 *   · 위에도 자리가 없으면 그 말풍선(과 그보다 먼저 한 말)은 숨긴다 — 아래 채팅에는 다 남아 있다.
 *   단위는 보이는 창의 px. 그리는 것은 components/office/OfficeScene.tsx.
 */

export interface TalkBox {
  id: string;
  /** 머리 위 가운데 x (px) */
  ax: number;
  /** 머리 위 끝 y (px) — 꼬리 끝이 닿는 곳 */
  ay: number;
  /** 말풍선 너비 · 높이 (px, 꼬리 빼고 — 제자리 모양 그대로) */
  w: number;
  h: number;
  /** 클수록 최근 */
  at: number;
}

export interface TalkPlace {
  /** 제자리(머리 위 가운데)에서 옮긴 만큼 — 말풍선 아래 끝 기준 (px, 위로 = 음수) */
  dx: number;
  dy: number;
  /** 위로 올라가 한 줄로 줄었나 (꼬리 대신 이름표) */
  lifted: boolean;
  /** 꼬리 자리 — 말풍선 가운데에서 (px) */
  tail: number;
}

/** 머리와 말풍선 사이 (꼬리 자리) */
export const TALK_GAP = 5;
/** 올라간(한 줄) 말풍선 높이 — 기본값 (그리는 쪽이 실제 한 줄 높이를 재서 넘긴다: 한글 글꼴은 줄 높이가 조금 더 크다) */
export const TALK_LIFTED_H = 26;
/** 올라간 말풍선 위로 이름표가 튀어나온 만큼 */
export const TALK_TAB = 8;
/** 말풍선끼리 띄우는 만큼 */
const MARGIN = 3;
/** 보이는 창 가장자리에서 띄우는 만큼 */
const PAD = 4;
/** 꼬리는 말풍선 모서리에서 이만큼 안쪽 */
const INSET = 12;

interface Rect {
  l: number;
  t: number;
  r: number;
  b: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** [lo, hi] 에서 막힌 구간(열린 구간)을 피해 p 에 가장 가까운 자리 — 없으면 null */
const closestFree = (p: number, lo: number, hi: number, blocks: Array<[number, number]>): number | null => {
  const cands = [clamp(p, lo, hi), lo, hi];
  for (const [a, b] of blocks) {
    if (a >= lo && a <= hi) cands.push(a);
    if (b >= lo && b <= hi) cands.push(b);
  }
  let best: number | null = null;
  for (const x of cands) {
    if (blocks.some(([a, b]) => x > a + 0.01 && x < b - 0.01)) continue;
    if (best === null || Math.abs(x - p) < Math.abs(best - p)) best = x;
  }
  return best;
};

const placeOne = (box: TalkBox, placed: Rect[], width: number, liftedH: number): { place: TalkPlace; rect: Rect } | null => {
  const natBottom = box.ay - TALK_GAP;
  const pref = box.ax - box.w / 2;
  // 꼬리가 머리 위에 남는 범위 — 머리가 가장자리라 안 되면 창 안 어디든(꼬리는 끝에 붙는다)
  let lo = Math.max(PAD, box.ax - box.w + INSET);
  let hi = Math.min(width - PAD - box.w, box.ax - INSET);
  if (lo > hi) {
    lo = PAD;
    hi = Math.max(PAD, width - PAD - box.w);
  }

  // 놓아 볼 높이: 제자리(머리 위) → 이미 놓인 말풍선 바로 위 (가까운 것부터)
  const cands: Array<{ bottom: number; lifted: boolean }> = [
    { bottom: Math.max(natBottom, PAD + box.h), lifted: false },
  ];
  const lifted = placed
    .map((r) => r.t - MARGIN)
    .filter((b) => b < natBottom - 0.5 && b - liftedH - TALK_TAB >= PAD - 0.5)
    .sort((a, b) => b - a);
  for (const b of lifted) cands.push({ bottom: b, lifted: true });

  for (const c of cands) {
    const h = c.lifted ? liftedH : box.h;
    const top = c.bottom - h - (c.lifted ? TALK_TAB : 0);
    const bottom = c.bottom + (c.lifted ? 0 : TALK_GAP);
    const blocks = placed
      .filter((r) => r.t < bottom + MARGIN && r.b > top - MARGIN)
      .map((r) => [r.l - MARGIN - box.w, r.r + MARGIN] as [number, number]);
    const x = closestFree(clamp(pref, lo, hi), lo, hi, blocks);
    if (x === null) continue;
    return {
      place: {
        dx: x - pref,
        dy: c.bottom - natBottom,
        lifted: c.lifted,
        tail: clamp(box.ax - x, INSET, Math.max(INSET, box.w - INSET)) - box.w / 2,
      },
      rect: { l: x, r: x + box.w, t: top, b: bottom },
    };
  }
  return null;
};

/** 말풍선마다 자리 — null 이면 숨긴다. liftedH = 한 줄 말풍선 높이 (px) */
export function layoutTalk(
  boxes: readonly TalkBox[],
  width: number,
  liftedH: number = TALK_LIFTED_H,
): Record<string, TalkPlace | null> {
  const out: Record<string, TalkPlace | null> = {};
  const placed: Rect[] = [];
  let full = false;
  for (const box of [...boxes].sort((a, b) => b.at - a.at)) {
    if (full) {
      out[box.id] = null;
      continue;
    }
    const got = placeOne(box, placed, width, Math.min(liftedH, box.h));
    if (!got) {
      // 최근 말이 자리를 못 찾으면 그보다 먼저 한 말도 숨긴다 (순서가 뒤섞여 보이지 않게)
      out[box.id] = null;
      full = true;
      continue;
    }
    out[box.id] = got.place;
    placed.push(got.rect);
  }
  return out;
}

/** 두 배치가 사실상 같나 (다시 그리지 않게) */
export const sameTalkLayout = (a: Record<string, TalkPlace | null>, b: Record<string, TalkPlace | null>) => {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => {
    const x = a[k];
    const y = b[k];
    if (!x || !y) return x === y && k in b;
    return x.lifted === y.lifted && Math.abs(x.dx - y.dx) < 0.5 && Math.abs(x.dy - y.dy) < 0.5 && Math.abs(x.tail - y.tail) < 0.5;
  });
};
