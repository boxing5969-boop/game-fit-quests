/**
 * 🗂 영상으로 배우기 정리표 — 대표님이 앱에서 고친 정리를 화면 모양으로 (2026-11-14 대표님 「추천대로진행하자」)
 *   보고서 https://claude.ai/artifact/F9QW5nn9N51k5wqZmGKVdE 「대표님 정리 편집 (아이폰처럼)」
 *
 *   정리표 한 장(DB training_shelf_layouts · 전 지점 같은 정리 — 결정 1번)은 카드 글과 따로다. 이 파일은 화면 없는 계산만:
 *   · parseShelfLayout — DB 값을 믿지 않고 다듬기(모르는 칸 · 틀린 key · 너무 긴 이름 · 겹친 줄은 버림)
 *   · arrangeShelves — 카드 · 레벨 미션 영상 + 정리표 → 칸마다 타일 순서
 *       회원: 숨김 · 합친 카드는 빼고(결정 2번) · 내 리그 위 카드는 「다음 리그에서 배울 동작 n개」로 접기(결정 3번)
 *       코치진: 숨김 · 합친 카드는 칸 맨 뒤에 흐리게 / 편집 중(대표님): 제자리에 흐리게 · 접기 없음 · 빈 칸도 보임
 *       정리표에 없는 새 카드는 분류대로 그 칸 맨 뒤 — 정리표가 비면 예전 화면과 똑같다(시험 shelfLayout.test.ts)
 *   · 고치기(순서 · 칸 옮기기 · 숨기기 · 맨 앞 고정 · 합치기 · 묶기 · 칸 순서와 이름 · 위 리그 접기) — 늘 새 정리표를 돌려준다
 *   · findOverlaps — 겹쳐 보이는 카드(같은 콤비 번호 · 같은 영상 파일 · 한 이름이 다른 이름 안에 다 들어감)와
 *       두 칸에 흩어진 같은 계열(카드 분류 · 레벨 미션 [복싱/○○] 꼬리표 — 예: 줄넘기 = 체력 칸 카드 + 워밍업 칸 미션 영상)
 *
 *   key: 카드 'c:<카드 id>' · 레벨 미션 영상 'm:<미션 id>' · 묶음(폴더) 'f:<묶음 id>'
 */
import {
  MEMBER_SHELVES,
  SHELF_INFO,
  STAFF_SHELVES,
  cardLevel,
  categoryToShelf,
  orderForMember,
  orderForStaff,
  type Shelf,
  type TrainingCard,
} from "@/lib/trainingCards";

export type TileKey = string;

export interface ShelfLayoutFolder {
  id: string;
  name: string;
  items: TileKey[];
}

export interface ShelfLayout {
  v: 1;
  /** 칸 순서 · 칸 이름(기본 이름이면 label 없음) */
  shelves?: { id: Shelf; label?: string }[];
  /** 칸마다 맨 위 타일 순서(카드 · 레벨 미션 · 묶음) — 없는 칸은 예전 순서 */
  items?: Partial<Record<Shelf, TileKey[]>>;
  /** 회원에게 숨김 (코치진 화면엔 흐리게) */
  hidden?: TileKey[];
  /** 칸 맨 앞 고정 — 「추천」 */
  pinned?: TileKey[];
  /** 합치기 — 숨길 key → 보일 key (보일 카드 시트에 「같은 동작」으로 이어짐) */
  merged?: Record<TileKey, TileKey>;
  /** 묶음(아이폰 폴더처럼 한 칸) */
  folders?: ShelfLayoutFolder[];
  /** 위 리그 카드 접기 — 없으면 켜짐(결정 3번) */
  foldUpper?: boolean;
  /** 겹침 아님으로 넘긴 것 — 'a|b'(정렬) 또는 'family:<계열>' */
  notDup?: string[];
}

export const EMPTY_LAYOUT: ShelfLayout = { v: 1 };

export const SHELF_LABEL_MAX = 8;
export const FOLDER_NAME_MAX = 14;
export const MAX_FOLDERS = 40;
export const MAX_FOLDER_ITEMS = 24;
const MAX_LIST = 400;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const LEAF_RE = new RegExp(`^[cm]:${UUID}$`);
const FOLDER_ID_RE = /^[a-z0-9_-]{1,24}$/;

export const cardKey = (id: string): TileKey => `c:${id}`;
export const missionKey = (id: string): TileKey => `m:${id}`;
export const folderKey = (id: string): TileKey => `f:${id}`;
export const isLeafKey = (k: unknown): k is TileKey => typeof k === "string" && LEAF_RE.test(k);
export const isFolderKey = (k: unknown): k is TileKey =>
  typeof k === "string" && k.startsWith("f:") && FOLDER_ID_RE.test(k.slice(2));
const isTileKey = (k: unknown): k is TileKey => isLeafKey(k) || isFolderKey(k);
const isShelf = (v: unknown): v is Shelf => typeof v === "string" && (STAFF_SHELVES as readonly string[]).includes(v);

/** 새 묶음 id — 시간 + 무작위 (영문 소문자 · 숫자) */
export const newFolderId = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 16);

const cleanText = (v: unknown, max: number): string =>
  typeof v === "string"
    ? v
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
        .trim()
    : "";

function uniqKeys(list: unknown, ok: (k: unknown) => boolean, cap = MAX_LIST): TileKey[] {
  if (!Array.isArray(list)) return [];
  const out: TileKey[] = [];
  const seen = new Set<string>();
  for (const k of list) {
    if (!ok(k) || seen.has(k as string)) continue;
    seen.add(k as string);
    out.push(k as string);
    if (out.length >= cap) break;
  }
  return out;
}

const pairKey = (a: TileKey, b: TileKey): string => (a < b ? `${a}|${b}` : `${b}|${a}`);
const NOTDUP_RE = new RegExp(`^(?:[cm]:${UUID}\\|[cm]:${UUID}|family:[^|]{1,16})$`);

/** DB 값 → 정리표 (모르는 것 · 틀린 것은 버린다 — 몇 번을 거쳐도 결과가 같다) */
export function parseShelfLayout(raw: unknown): ShelfLayout {
  const out: ShelfLayout = { v: 1 };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const r = raw as Record<string, unknown>;

  if (Array.isArray(r.shelves)) {
    const seen = new Set<Shelf>();
    const list: { id: Shelf; label?: string }[] = [];
    for (const s of r.shelves) {
      if (!s || typeof s !== "object") continue;
      const id = (s as { id?: unknown }).id;
      if (!isShelf(id) || seen.has(id)) continue;
      seen.add(id);
      const label = cleanText((s as { label?: unknown }).label, SHELF_LABEL_MAX);
      list.push(label && label !== SHELF_INFO[id].label ? { id, label } : { id });
    }
    if (list.length) out.shelves = list;
  }

  // 묶음 — 한 카드는 한 묶음에만 · 빈 묶음은 버림
  const inFolder = new Set<string>();
  if (Array.isArray(r.folders)) {
    const seen = new Set<string>();
    const folders: ShelfLayoutFolder[] = [];
    for (const f of r.folders) {
      if (!f || typeof f !== "object" || folders.length >= MAX_FOLDERS) continue;
      const id = (f as { id?: unknown }).id;
      if (typeof id !== "string" || !FOLDER_ID_RE.test(id) || seen.has(id)) continue;
      const items = uniqKeys((f as { items?: unknown }).items, isLeafKey, MAX_FOLDER_ITEMS).filter((k) => !inFolder.has(k));
      if (!items.length) continue;
      seen.add(id);
      items.forEach((k) => inFolder.add(k));
      folders.push({ id, name: cleanText((f as { name?: unknown }).name, FOLDER_NAME_MAX) || "묶음", items });
    }
    if (folders.length) out.folders = folders;
  }
  const folderIds = new Set((out.folders ?? []).map((f) => folderKey(f.id)));
  const tileOk = (k: unknown) => isLeafKey(k) || (isFolderKey(k) && folderIds.has(k));

  if (r.items && typeof r.items === "object" && !Array.isArray(r.items)) {
    const items: Partial<Record<Shelf, TileKey[]>> = {};
    const used = new Set<string>();
    for (const [shelf, list] of Object.entries(r.items as Record<string, unknown>)) {
      if (!isShelf(shelf)) continue;
      const keys = uniqKeys(list, tileOk).filter((k) => !used.has(k) && !inFolder.has(k));
      keys.forEach((k) => used.add(k));
      if (keys.length) items[shelf] = keys;
    }
    if (Object.keys(items).length) out.items = items;
  }

  const hidden = uniqKeys(r.hidden, tileOk);
  if (hidden.length) out.hidden = hidden;
  const pinned = uniqKeys(r.pinned, tileOk);
  if (pinned.length) out.pinned = pinned;

  if (r.merged && typeof r.merged === "object" && !Array.isArray(r.merged)) {
    const raw = r.merged as Record<string, unknown>;
    const direct: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (isLeafKey(k) && isLeafKey(v) && k !== v) direct[k] = v;
    }
    const merged: Record<TileKey, TileKey> = {};
    for (const k of Object.keys(direct)) {
      // 줄줄이 합친 것은 맨 끝 카드로 · 돌아오는 고리는 버림
      let to = direct[k];
      const seen = new Set([k]);
      while (direct[to] && !seen.has(to) && seen.size < 10) {
        seen.add(to);
        to = direct[to];
      }
      if (to !== k && !seen.has(to)) merged[k] = to;
    }
    if (Object.keys(merged).length) out.merged = merged;
  }

  if (r.foldUpper === false) out.foldUpper = false;
  const notDup = uniqKeys(r.notDup, (k) => typeof k === "string" && NOTDUP_RE.test(k), 500);
  if (notDup.length) out.notDup = notDup;
  return out;
}

// ───────────────────────── 화면 모양 ─────────────────────────

export interface ShelfMission {
  id: string;
  title: string;
  poster: string | null;
}

interface LeafBase {
  key: TileKey;
  hidden: boolean;
  pinned: boolean;
  /** 합친 카드면 보일 카드 key */
  mergedInto: TileKey | null;
}
export type ShelfCardTile<C extends TrainingCard = TrainingCard> = LeafBase & { kind: "card"; card: C };
export type ShelfMissionTile = LeafBase & { kind: "mission"; mission: ShelfMission };
export type ShelfLeaf<C extends TrainingCard = TrainingCard> = ShelfCardTile<C> | ShelfMissionTile;
export interface ShelfFolderTile<C extends TrainingCard = TrainingCard> {
  kind: "folder";
  key: TileKey;
  id: string;
  name: string;
  tiles: ShelfLeaf<C>[];
  hidden: boolean;
  pinned: boolean;
  mergedInto: null;
}
export type ShelfTile<C extends TrainingCard = TrainingCard> = ShelfLeaf<C> | ShelfFolderTile<C>;

export interface ArrangedShelf<C extends TrainingCard = TrainingCard> {
  id: Shelf;
  label: string;
  color: string;
  /** 보이는 타일 순서 */
  tiles: ShelfTile<C>[];
  /** 회원 — 내 리그 위 타일(접힘) · 그 밖에는 빈 목록 */
  upper: ShelfTile<C>[];
}

export interface ArrangeOptions {
  audience: "member" | "staff";
  myLevel: number;
  /** 대표님 편집 중 — 숨김 · 합침도 제자리에 흐리게, 접기 없음, 빈 칸도 */
  editing?: boolean;
}

/** 내 리그의 마지막 레벨 (화이트 1~10 → 10 · 블루 → 20 …) */
export const leagueMaxLevel = (myLevel: number): number =>
  Math.min(40, Math.ceil(Math.max(1, Math.floor(Number(myLevel) || 1)) / 10) * 10);

/** 칸 순서 · 이름 — 정리표 순서 다음 남은 칸은 기본 순서 */
export function shelfOrder(layout: ShelfLayout, allowed: readonly Shelf[]): { id: Shelf; label: string; color: string }[] {
  const out: { id: Shelf; label: string; color: string }[] = [];
  const seen = new Set<Shelf>();
  const labels = new Map((layout.shelves ?? []).map((s) => [s.id, s.label]));
  for (const s of [...(layout.shelves ?? []).map((x) => x.id), ...allowed]) {
    if (!allowed.includes(s) || seen.has(s)) continue;
    seen.add(s);
    out.push({ id: s, label: labels.get(s) || SHELF_INFO[s].label, color: SHELF_INFO[s].color });
  }
  return out;
}

/** 칸 이름 (정리표에서 바꾼 이름 · 없으면 기본) */
export const shelfLabel = (layout: ShelfLayout, shelf: Shelf): string =>
  (layout.shelves ?? []).find((s) => s.id === shelf)?.label || SHELF_INFO[shelf].label;

const tileLevel = <C extends TrainingCard>(t: ShelfTile<C>): number => {
  if (t.kind === "card") return cardLevel(t.card);
  if (t.kind === "mission") return 0;
  const levels = t.tiles.map((x) => tileLevel(x));
  return levels.length && levels.every((l) => l > 0) ? Math.min(...levels) : 0;
};

/**
 * 카드 · 레벨 미션 영상 + 정리표 → 칸마다 타일.
 * cards 는 이미 그 사람에게 보이는 카드만(회원: isMemberVisible · 코치진: 켜진 카드).
 */
export function arrangeShelves<C extends TrainingCard>(
  cards: readonly C[],
  missions: readonly ShelfMission[],
  layout: ShelfLayout,
  opts: ArrangeOptions,
): ArrangedShelf<C>[] {
  const member = opts.audience === "member";
  const editing = !!opts.editing;
  const allowed = member ? MEMBER_SHELVES : STAFF_SHELVES;
  const hidden = new Set(layout.hidden ?? []);
  const pinned = layout.pinned ?? [];
  const pinnedSet = new Set(pinned);
  const merged = layout.merged ?? {};

  // 잎(카드 · 미션) 만들기
  const leaves = new Map<TileKey, ShelfLeaf<C>>();
  for (const m of missions) {
    const key = missionKey(m.id);
    if (!leaves.has(key)) leaves.set(key, { kind: "mission", key, mission: m, hidden: false, pinned: false, mergedInto: null });
  }
  for (const c of cards) {
    const key = cardKey(c.id);
    if (!leaves.has(key)) leaves.set(key, { kind: "card", key, card: c, hidden: false, pinned: false, mergedInto: null });
  }
  for (const leaf of leaves.values()) {
    leaf.hidden = hidden.has(leaf.key);
    leaf.pinned = pinnedSet.has(leaf.key);
    const to = merged[leaf.key];
    leaf.mergedInto = to && leaves.has(to) && to !== leaf.key ? to : null;
  }

  // 묶음 — 있는 잎만 · 한 잎은 한 묶음에만
  const folderOf = new Map<TileKey, string>();
  const folders = new Map<string, ShelfFolderTile<C>>();
  for (const f of layout.folders ?? []) {
    const tiles: ShelfLeaf<C>[] = [];
    for (const k of f.items) {
      const leaf = leaves.get(k);
      if (!leaf || folderOf.has(k)) continue;
      folderOf.set(k, f.id);
      tiles.push(leaf);
    }
    if (!tiles.length) continue;
    const key = folderKey(f.id);
    folders.set(f.id, {
      kind: "folder",
      key,
      id: f.id,
      name: f.name,
      tiles,
      hidden: hidden.has(key),
      pinned: pinnedSet.has(key),
      mergedInto: null,
    });
  }

  // 칸 정하기 — 정리표에 적힌 칸 → 기본 칸(카드 = 분류 · 미션 = 워밍업 · 묶음 = 첫 잎의 칸)
  const placed = new Map<TileKey, Shelf>();
  const order = shelfOrder(layout, allowed);
  for (const s of order) {
    for (const k of layout.items?.[s.id] ?? []) {
      if (placed.has(k)) continue;
      if (isFolderKey(k)) {
        if (folders.has(k.slice(2))) placed.set(k, s.id);
      } else if (leaves.has(k) && !folderOf.has(k)) placed.set(k, s.id);
    }
  }
  const defaultShelf = (leaf: ShelfLeaf<C>): Shelf => (leaf.kind === "mission" ? "warmup" : categoryToShelf(leaf.card.category));
  for (const leaf of leaves.values()) {
    if (folderOf.has(leaf.key) || placed.has(leaf.key)) continue;
    placed.set(leaf.key, defaultShelf(leaf));
  }
  for (const f of folders.values()) {
    if (!placed.has(f.key)) placed.set(f.key, defaultShelf(f.tiles[0]));
  }

  // 예전 순서 — 미션 먼저, 카드는 회원(내 레벨까지 먼저) · 코치진(레벨 낮은 것부터). 묶음은 첫 잎이 올 자리에.
  const defaultOrder = (shelf: Shelf): TileKey[] => {
    const ms: TileKey[] = [];
    const cs: C[] = [];
    const topOf = (k: TileKey): TileKey => {
      const fid = folderOf.get(k);
      return fid ? folderKey(fid) : k;
    };
    for (const leaf of leaves.values()) {
      const top = topOf(leaf.key);
      if (placed.get(top) !== shelf) continue;
      if (leaf.kind === "mission") ms.push(leaf.key);
      else cs.push(leaf.card);
    }
    const ordered = member ? orderForMember(cs, opts.myLevel) : orderForStaff(cs);
    const out: TileKey[] = [];
    const seen = new Set<TileKey>();
    for (const k of [...ms, ...ordered.map((c) => cardKey(c.id))]) {
      const top = topOf(k);
      if (seen.has(top)) continue;
      seen.add(top);
      out.push(top);
    }
    return out;
  };

  const tileOf = (k: TileKey): ShelfTile<C> | null => (isFolderKey(k) ? folders.get(k.slice(2)) ?? null : leaves.get(k) ?? null);
  const gone = (t: { hidden: boolean; mergedInto: TileKey | null }) => t.hidden || !!t.mergedInto;
  const leagueMax = leagueMaxLevel(opts.myLevel);
  const fold = member && !editing && layout.foldUpper !== false;

  const result: ArrangedShelf<C>[] = [];
  for (const s of order) {
    const explicit = (layout.items?.[s.id] ?? []).filter((k) => placed.get(k) === s.id && !!tileOf(k));
    const rest = defaultOrder(s.id).filter((k) => !explicit.includes(k));
    let keys = [...explicit, ...rest];
    // 맨 앞 고정 — 고정한 순서대로
    const pin = pinned.filter((k) => keys.includes(k));
    keys = [...pin, ...keys.filter((k) => !pinnedSet.has(k))];

    let tiles: ShelfTile<C>[] = [];
    for (const k of keys) {
      const t = tileOf(k);
      if (!t) continue;
      if (t.kind !== "folder") {
        tiles.push(t);
        continue;
      }
      // 묶음 안 — 회원은 숨김 · 합친 것 빼기, 코치진은 뒤로, 편집 중은 제자리
      let inner = t.tiles;
      if (member && !editing) inner = inner.filter((x) => !gone(x));
      else if (!editing) inner = [...inner.filter((x) => !gone(x)), ...inner.filter((x) => gone(x))];
      tiles.push({ ...t, tiles: inner });
    }

    if (member && !editing) {
      tiles = tiles
        .filter((t) => !gone(t))
        .flatMap((t): ShelfTile<C>[] => {
          if (t.kind !== "folder") return [t];
          if (!t.tiles.length) return [];
          return t.tiles.length === 1 ? [t.tiles[0]] : [t];
        });
    } else if (!editing) {
      tiles = [...tiles.filter((t) => !gone(t)), ...tiles.filter((t) => gone(t))];
    }

    let upper: ShelfTile<C>[] = [];
    if (fold) {
      upper = tiles.filter((t) => !t.pinned && tileLevel(t) > leagueMax);
      tiles = tiles.filter((t) => t.pinned || tileLevel(t) <= leagueMax);
    }
    if (!editing && !tiles.length && !upper.length) continue;
    result.push({ id: s.id, label: s.label, color: s.color, tiles, upper });
  }
  return result;
}

/** 타일 목록 → 잎만(묶음은 펼쳐서) — 카드 시트 「다음 동작」 목록 */
export function flattenLeaves<C extends TrainingCard>(tiles: readonly ShelfTile<C>[]): ShelfLeaf<C>[] {
  return tiles.flatMap((t) => (t.kind === "folder" ? t.tiles : [t]));
}

/** 편집 화면 숫자 — 숨긴 카드(숨김 + 합침) · 「숨긴 카드」 창 줄 수와 같다 */
export function countHiddenTiles(arranged: readonly ArrangedShelf[]): number {
  return arranged.reduce(
    (n, s) => n + [...s.tiles, ...s.tiles.flatMap((t) => (t.kind === "folder" ? t.tiles : []))].filter((t) => t.hidden || t.mergedInto).length,
    0,
  );
}

/** 보일 카드에 합친 카드들 (보일 카드 시트의 「같은 동작」) */
export function mergedFrom(layout: ShelfLayout, key: TileKey): TileKey[] {
  return Object.entries(layout.merged ?? {})
    .filter(([, to]) => to === key)
    .map(([from]) => from);
}

// ───────────────────────── 고치기 ─────────────────────────
// 모두 새 정리표를 돌려준다. shelfKeys = 편집 화면에 지금 보이는 그 칸의 맨 위 순서(숨김 포함).

const clone = (l: ShelfLayout): ShelfLayout => ({
  v: 1,
  ...(l.shelves ? { shelves: l.shelves.map((s) => ({ ...s })) } : {}),
  ...(l.items ? { items: Object.fromEntries(Object.entries(l.items).map(([k, v]) => [k, [...(v ?? [])]])) } : {}),
  ...(l.hidden ? { hidden: [...l.hidden] } : {}),
  ...(l.pinned ? { pinned: [...l.pinned] } : {}),
  ...(l.merged ? { merged: { ...l.merged } } : {}),
  ...(l.folders ? { folders: l.folders.map((f) => ({ ...f, items: [...f.items] })) } : {}),
  ...(l.foldUpper === false ? { foldUpper: false } : {}),
  ...(l.notDup ? { notDup: [...l.notDup] } : {}),
});

/** 빈 목록은 지워 정리표를 작게 */
const tidy = (l: ShelfLayout): ShelfLayout => {
  const out = clone(l);
  if (out.items) {
    for (const k of Object.keys(out.items) as Shelf[]) if (!out.items[k]?.length) delete out.items[k];
    if (!Object.keys(out.items).length) delete out.items;
  }
  if (out.folders) {
    out.folders = out.folders.filter((f) => f.items.length > 0);
    if (!out.folders.length) delete out.folders;
  }
  const folderIds = new Set((out.folders ?? []).map((f) => folderKey(f.id)));
  const alive = (k: TileKey) => !isFolderKey(k) || folderIds.has(k);
  if (out.items) {
    for (const k of Object.keys(out.items) as Shelf[]) out.items[k] = out.items[k]!.filter(alive);
    for (const k of Object.keys(out.items) as Shelf[]) if (!out.items[k]?.length) delete out.items[k];
    if (!Object.keys(out.items).length) delete out.items;
  }
  for (const f of ["hidden", "pinned", "notDup"] as const) {
    const list = out[f]?.filter((k) => f === "notDup" || alive(k));
    if (list?.length) out[f] = list;
    else delete out[f];
  }
  if (out.merged && !Object.keys(out.merged).length) delete out.merged;
  if (out.shelves && !out.shelves.length) delete out.shelves;
  return out;
};

/** key 를 모든 칸 목록 · 묶음에서 뺀다 (묶음이 비면 묶음도) */
function detach(l: ShelfLayout, key: TileKey): ShelfLayout {
  const out = clone(l);
  if (out.items) for (const s of Object.keys(out.items) as Shelf[]) out.items[s] = out.items[s]!.filter((k) => k !== key);
  if (out.folders) out.folders = out.folders.map((f) => ({ ...f, items: f.items.filter((k) => k !== key) }));
  return out;
}

const folderIdOf = (l: ShelfLayout, key: TileKey): string | null => l.folders?.find((f) => f.items.includes(key))?.id ?? null;

/** 칸 안 순서 — 그 칸 맨 위 순서를 통째로 */
export function setShelfItems(l: ShelfLayout, shelf: Shelf, keys: readonly TileKey[]): ShelfLayout {
  const want = uniqKeys(keys, isTileKey);
  let out = clone(l);
  for (const k of want) out = detach(out, k);
  out.items = { ...(out.items ?? {}), [shelf]: want };
  return tidy(out);
}

/** 다른 칸으로 — 그 칸 맨 뒤 (targetKeys = 옮길 칸의 지금 순서) */
export function moveToShelf(l: ShelfLayout, key: TileKey, to: Shelf, targetKeys: readonly TileKey[]): ShelfLayout {
  if (!isTileKey(key)) return l;
  return setShelfItems(l, to, [...targetKeys.filter((k) => k !== key), key]);
}

/** 회원에게 숨기기 · 보이기 */
export function setHidden(l: ShelfLayout, key: TileKey, on: boolean): ShelfLayout {
  const out = clone(l);
  const list = (out.hidden ?? []).filter((k) => k !== key);
  out.hidden = on ? [...list, key] : list;
  return tidy(out);
}

/** 맨 앞 고정 · 풀기 (고정한 차례대로 앞에) */
export function setPinned(l: ShelfLayout, key: TileKey, on: boolean): ShelfLayout {
  const out = clone(l);
  const list = (out.pinned ?? []).filter((k) => k !== key);
  out.pinned = on ? [...list, key] : list;
  return tidy(out);
}

/** 합치기 — dup 을 숨기고 main 에 잇는다 (dup 에 합쳐 있던 것도 main 으로) */
export function mergeInto(l: ShelfLayout, dup: TileKey, main: TileKey): ShelfLayout {
  if (!isLeafKey(dup) || !isLeafKey(main) || dup === main) return l;
  const out = clone(l);
  const merged = { ...(out.merged ?? {}) };
  // main 이 이미 다른 카드에 합쳐져 있으면 그 카드에
  let target = main;
  const seen = new Set([dup]);
  while (merged[target] && !seen.has(target)) {
    seen.add(target);
    target = merged[target];
  }
  if (target === dup) return l;
  for (const [k, v] of Object.entries(merged)) if (v === dup) merged[k] = target;
  merged[dup] = target;
  out.merged = merged;
  out.pinned = (out.pinned ?? []).filter((k) => k !== dup);
  out.notDup = (out.notDup ?? []).filter((k) => k !== pairKey(dup, main));
  return tidy(out);
}

/** 합침 풀기 */
export function unmerge(l: ShelfLayout, dup: TileKey): ShelfLayout {
  const out = clone(l);
  if (out.merged) delete out.merged[dup];
  return tidy(out);
}

/** 묶기 — target 자리에 새 묶음(target · dragged). target 이 묶음이면 그 묶음에 넣기 */
export function makeFolder(
  l: ShelfLayout,
  shelf: Shelf,
  shelfKeys: readonly TileKey[],
  target: TileKey,
  dragged: TileKey,
  id: string,
  name: string,
): ShelfLayout {
  if (isFolderKey(target)) return addToFolder(l, shelf, shelfKeys, target.slice(2), dragged);
  if (!isLeafKey(target) || !isLeafKey(dragged) || target === dragged || !FOLDER_ID_RE.test(id)) return l;
  if ((l.folders?.length ?? 0) >= MAX_FOLDERS) return l;
  let out = detach(detach(l, target), dragged);
  out.folders = [...(out.folders ?? []), { id, name: cleanText(name, FOLDER_NAME_MAX) || "묶음", items: [target, dragged] }];
  const keys = shelfKeys.map((k) => (k === target ? folderKey(id) : k)).filter((k) => k !== dragged);
  if (!keys.includes(folderKey(id))) keys.push(folderKey(id));
  out = setShelfItems(out, shelf, keys);
  return tidy(out);
}

/** 묶음에 넣기 (맨 뒤) */
export function addToFolder(l: ShelfLayout, shelf: Shelf, shelfKeys: readonly TileKey[], folderId: string, key: TileKey): ShelfLayout {
  const f = l.folders?.find((x) => x.id === folderId);
  if (!f || !isLeafKey(key) || f.items.includes(key) || f.items.length >= MAX_FOLDER_ITEMS) return l;
  const out = detach(l, key);
  out.folders = (out.folders ?? []).map((x) => (x.id === folderId ? { ...x, items: [...x.items, key] } : x));
  return setShelfItems(out, shelf, shelfKeys.filter((k) => k !== key));
}

/** 묶음에서 빼기 — 그 칸에서 묶음 바로 뒤 (묶음이 비면 묶음도 사라짐) */
export function removeFromFolder(l: ShelfLayout, shelf: Shelf, shelfKeys: readonly TileKey[], key: TileKey, beforeKey?: TileKey | null): ShelfLayout {
  const fid = folderIdOf(l, key);
  if (!fid) return l;
  const out = detach(l, key);
  const fk = folderKey(fid);
  const keys = shelfKeys.filter((k) => k !== key);
  const at = beforeKey && keys.includes(beforeKey) ? keys.indexOf(beforeKey) : keys.indexOf(fk) >= 0 ? keys.indexOf(fk) + 1 : keys.length;
  keys.splice(at, 0, key);
  return setShelfItems(out, shelf, keys);
}

/** 묶음 안 순서 */
export function setFolderItems(l: ShelfLayout, folderId: string, keys: readonly TileKey[]): ShelfLayout {
  const f = l.folders?.find((x) => x.id === folderId);
  if (!f) return l;
  const want = keys.filter((k) => f.items.includes(k));
  const rest = f.items.filter((k) => !want.includes(k));
  const out = clone(l);
  out.folders = (out.folders ?? []).map((x) => (x.id === folderId ? { ...x, items: [...want, ...rest] } : x));
  return tidy(out);
}

/** 묶음 이름 */
export function renameFolder(l: ShelfLayout, folderId: string, name: string): ShelfLayout {
  const out = clone(l);
  out.folders = (out.folders ?? []).map((x) => (x.id === folderId ? { ...x, name: cleanText(name, FOLDER_NAME_MAX) || x.name } : x));
  return tidy(out);
}

/** 묶음 풀기 — 묶음 자리에 안의 카드를 차례로 */
export function dissolveFolder(l: ShelfLayout, shelf: Shelf, shelfKeys: readonly TileKey[], folderId: string): ShelfLayout {
  const f = l.folders?.find((x) => x.id === folderId);
  if (!f) return l;
  const fk = folderKey(folderId);
  const keys = shelfKeys.flatMap((k) => (k === fk ? f.items : [k]));
  if (!shelfKeys.includes(fk)) keys.push(...f.items);
  const out = clone(l);
  out.folders = (out.folders ?? []).filter((x) => x.id !== folderId);
  out.hidden = (out.hidden ?? []).filter((k) => k !== fk);
  out.pinned = (out.pinned ?? []).filter((k) => k !== fk);
  return setShelfItems(tidy(out), shelf, keys);
}

/** 칸 순서 · 이름 — 보이는 칸 목록 그대로 (기본 이름이면 label 없음) */
export function setShelves(l: ShelfLayout, shelves: readonly { id: Shelf; label?: string }[]): ShelfLayout {
  const out = clone(l);
  const seen = new Set<Shelf>();
  const list: { id: Shelf; label?: string }[] = [];
  for (const s of shelves) {
    if (!isShelf(s.id) || seen.has(s.id)) continue;
    seen.add(s.id);
    const label = cleanText(s.label, SHELF_LABEL_MAX);
    list.push(label && label !== SHELF_INFO[s.id].label ? { id: s.id, label } : { id: s.id });
  }
  out.shelves = list;
  return tidy(out);
}

/** 위 리그 카드 접기 켜기 · 끄기 */
export function setFoldUpper(l: ShelfLayout, on: boolean): ShelfLayout {
  const out = clone(l);
  if (on) delete out.foldUpper;
  else out.foldUpper = false;
  return tidy(out);
}

/** 겹침 아님 (짝 또는 계열) */
export function dismissOverlap(l: ShelfLayout, id: string): ShelfLayout {
  if (!NOTDUP_RE.test(id)) return l;
  const out = clone(l);
  out.notDup = [...(out.notDup ?? []).filter((k) => k !== id), id];
  return tidy(out);
}

/** 정리 기록 한 줄 요약 — 숨김 n · 묶음 n · 고정 n · 합침 n · 옮긴 칸 n */
export function layoutSummary(l: ShelfLayout): string {
  const parts: string[] = [];
  const n = (x?: unknown[] | Record<string, unknown>) => (Array.isArray(x) ? x.length : x ? Object.keys(x).length : 0);
  if (n(l.hidden)) parts.push(`숨김 ${n(l.hidden)}`);
  if (n(l.merged)) parts.push(`합침 ${n(l.merged)}`);
  if (n(l.folders)) parts.push(`묶음 ${n(l.folders)}`);
  if (n(l.pinned)) parts.push(`고정 ${n(l.pinned)}`);
  if (n(l.items)) parts.push(`순서 정한 칸 ${n(l.items)}`);
  if ((l.shelves ?? []).some((s) => s.label)) parts.push("칸 이름");
  if (l.foldUpper === false) parts.push("위 리그 펼침");
  return parts.length ? parts.join(" · ") : "처음 정리";
}

// ───────────────────────── 겹침 찾기 ─────────────────────────

export interface OverlapPair {
  kind: "pair";
  id: string;
  a: TileKey;
  b: TileKey;
  reason: "combo" | "video" | "name";
}
export interface OverlapSpread {
  kind: "spread";
  id: string;
  family: string;
  keys: TileKey[];
  shelves: { id: Shelf; count: number }[];
}
export type Overlap = OverlapPair | OverlapSpread;

/** 이름에서 뺄 말 — 동작이 아니라 꾸밈 · 단계 말 */
const FILLER = new Set([
  "드릴", "트레이닝", "훈련", "연습", "입문", "기초", "기본", "실전", "루틴", "라운드", "콤비", "콤보", "연결",
  "가이드", "완벽", "끝판왕", "게임", "챌린지", "체크", "복싱", "리듬", "방법", "자세", "따라하기", "하기",
]);
/** 같은 뜻 */
const SYNONYM: Record<string, string> = {
  래더: "사다리",
  풋워크: "스텝",
  디펜스: "방어",
  인아웃: "인앤아웃",
  쉐도우: "섀도",
  섀도우: "섀도",
  쉐도우복싱: "섀도",
  섀도복싱: "섀도",
  스트레이트: "원투",
};

/** 이름 → 핵심 낱말 (꼬리표 [복싱/줄넘기] 는 뺌 · 숫자만인 낱말 · 꾸밈말 빼기) */
export function nameTokens(name: string): string[] {
  const s = (name ?? "")
    .toLowerCase()
    .replace(/^\s*\[[^\]]*\]\s*/, "")
    .replace(/인\s*-\s*아웃/g, "인앤아웃");
  const words = s
    .replace(/[ㅣ|·•・,./!?~()[\]{}+:;"'“”‘’→\-–—]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (let w of words) {
    w = SYNONYM[w] ?? w;
    if (/^\d+([번개회초분가지주]|가지)?$/.test(w)) continue;
    if (FILLER.has(w) || w.length < 1) continue;
    if (!out.includes(w)) out.push(w);
  }
  return out;
}

/** 콤비 번호 (1-2-3 · 1-2-3-2) — 없으면 null */
export function comboCode(name: string): string | null {
  const m = (name ?? "").match(/\b(\d(?:\s*-\s*\d){1,6})\b/);
  return m ? m[1].replace(/\s+/g, "") : null;
}

/** 계열 — 카드 분류 · 레벨 미션 [복싱/○○] 꼬리표의 뒤 말 */
function familyOf(leaf: ShelfLeaf): string | null {
  if (leaf.kind === "card") return (leaf.card.category ?? "").trim() || null;
  const m = leaf.mission.title.match(/^\s*\[[^/\]]*\/\s*([^\]]+)\]/);
  return m ? m[1].trim() : null;
}
/** 계열 이름 → 같은 뜻으로 (미션 '줄넘기' = 카드 분류 '줄넘기') */
const FAMILY_SKIP = new Set(["체력", "기본기", "준비", "코칭"]);

/**
 * 겹쳐 보이는 카드 — 회원에게 보이는 잎끼리(숨김 · 합친 것 · 같은 묶음 · 겹침 아님은 빼고).
 * 짝: 같은 콤비 번호 · 같은 영상 파일 · 한 이름의 핵심 낱말(2개 이상)이 다른 이름에 다 들어감.
 * 흩어짐: 같은 계열이 두 칸 이상에 3장 넘게.
 */
export function findOverlaps<C extends TrainingCard>(arranged: readonly ArrangedShelf<C>[], layout: ShelfLayout, limit = 40): Overlap[] {
  const notDup = new Set(layout.notDup ?? []);
  type Entry = { leaf: ShelfLeaf<C>; shelf: Shelf; folder: string | null; tokens: string[]; combo: string | null; video: string | null };
  const entries: Entry[] = [];
  for (const s of arranged) {
    for (const t of [...s.tiles, ...s.upper]) {
      const list = t.kind === "folder" ? t.tiles.map((x) => ({ leaf: x, folder: t.id, hidden: t.hidden })) : [{ leaf: t, folder: null, hidden: false }];
      for (const { leaf, folder, hidden } of list) {
        if (hidden || leaf.hidden || leaf.mergedInto) continue;
        const name = leaf.kind === "card" ? leaf.card.name : leaf.mission.title;
        entries.push({
          leaf,
          shelf: s.id,
          folder,
          tokens: nameTokens(name),
          combo: comboCode(name),
          video: leaf.kind === "card" ? leaf.card.video_path || null : null,
        });
      }
    }
  }
  const out: Overlap[] = [];
  const paired = new Set<string>();
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      if (a.folder && a.folder === b.folder) continue;
      const id = pairKey(a.leaf.key, b.leaf.key);
      if (notDup.has(id) || paired.has(id)) continue;
      let reason: OverlapPair["reason"] | null = null;
      if (a.combo && a.combo === b.combo) reason = "combo";
      else if (a.video && a.video === b.video) reason = "video";
      else {
        const [small, big] = a.tokens.length <= b.tokens.length ? [a.tokens, b.tokens] : [b.tokens, a.tokens];
        if (small.length >= 2 && small.every((w) => big.includes(w))) reason = "name";
      }
      if (!reason) continue;
      paired.add(id);
      const [first, second] = a.leaf.key < b.leaf.key ? [a.leaf.key, b.leaf.key] : [b.leaf.key, a.leaf.key];
      out.push({ kind: "pair", id, a: first, b: second, reason });
    }
  }
  // 흩어진 계열
  const fam = new Map<string, Entry[]>();
  for (const e of entries) {
    const f = familyOf(e.leaf as ShelfLeaf);
    if (!f || FAMILY_SKIP.has(f)) continue;
    (fam.get(f) ?? fam.set(f, []).get(f)!).push(e);
  }
  for (const [family, list] of fam) {
    const id = `family:${family}`.slice(0, 23);
    if (notDup.has(id)) continue;
    const by = new Map<Shelf, number>();
    for (const e of list) by.set(e.shelf, (by.get(e.shelf) ?? 0) + 1);
    if (by.size < 2 || list.length < 3) continue;
    out.push({
      kind: "spread",
      id,
      family,
      keys: list.map((e) => e.leaf.key),
      shelves: [...by.entries()].map(([sid, count]) => ({ id: sid, count })).sort((x, y) => y.count - x.count),
    });
  }
  return out.slice(0, limit);
}

/** 합칠 때 남길 카드 — 회원용 영상 → 그림 → 레벨 낮은 것 → 카드(미션보다) */
export function preferredMain<C extends TrainingCard>(a: ShelfLeaf<C>, b: ShelfLeaf<C>): [main: ShelfLeaf<C>, dup: ShelfLeaf<C>] {
  const score = (x: ShelfLeaf<C>) => {
    if (x.kind === "mission") return 1;
    const c = x.card;
    return (c.video_path || c.video_url ? 8 : 0) + (c.poster_path || c.image_url ? 4 : 0) + 2 - Math.min(1, cardLevel(c) / 40);
  };
  return score(a) >= score(b) ? [a, b] : [b, a];
}

/** 묶음 이름 제안 — 두 이름에 같이 있는 낱말, 없으면 앞 카드 이름 */
const GENERIC_WORDS = new Set(["스텝", "기술", "방어", "드릴", "체력", "워밍업", "기본기", "쿨다운", "미트", "샌드백", "카운터"]);
export function suggestFolderName(a: string, b: string): string {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  const common = ta.filter((w) => tb.includes(w));
  // 같이 있는 말이 칸 이름 같은 넓은 말뿐이면(예: '스텝') 앞 카드 이름으로
  const useCommon = common.length > 0 && common.some((w) => !GENERIC_WORDS.has(w));
  const name = (useCommon ? common.join(" ") : a.replace(/^\s*\[[^\]]*\]\s*/, "").split(/[ㅣ|(]/)[0]).trim();
  return name.slice(0, FOLDER_NAME_MAX).trim() || "묶음";
}

export const leafName = (leaf: ShelfLeaf): string => (leaf.kind === "card" ? leaf.card.name : leaf.mission.title.replace(/^\s*\[[^\]]*\]\s*/, ""));
