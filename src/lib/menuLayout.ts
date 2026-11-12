// 🗂 내 메뉴 — 전체 메뉴를 아이폰 · 안드로이드 홈 화면처럼 사람마다 고친다
// (2026-11-08 대표님 「바로가기 기능 만들어줘 … 라이브보드까지 가는 여정이 너무 길어 … 현재 있는 바로가기 메뉴들도
//  옮기고 빼고 수정할수있게해줘 회원님들도 나도 가능하게 아이폰이나 안드로이드 처럼」).
//
// 기본 목록은 그대로 lib/appMenu.ts 한 곳 — 고친 적이 없는 사람은 지금과 똑같이 보인다.
// 고친 사람은 배치(MenuLayout)를 이 기기 + DB(get_my_menu_layout · save_my_menu_layout)에 둔다(hooks/useMenuLayout).
//
//   · 칸 하나 = 가는 곳(경로 + ?탭) 하나. 같은 곳은 한 번만 놓인다.
//   · 바로가기로 더 넣을 수 있는 화면 = 기본 메뉴 + SHORTCUT_EXTRAS(운영진 화면 · 하단 탭 화면) + 기능 검색 목록(FEATURES).
//   · 보이는 조건(다이어트 · 코치진 · 지점장 이상 …)은 그릴 때마다 다시 본다 — 배치에 있어도 권한이 없으면 안 보인다.
//   · 나중에 기본 메뉴에 새 칸이 생기면(known 에 없는 것) 끝에 저절로 붙는다. 본인이 뺀 칸은 다시 생기지 않는다.
//   · 이 파일은 화면 없는 계산만 — 시험 menuLayout.test.ts.
import type { MenuGlyphName } from "@/components/icons/menuGlyphs";
import { APP_MENU, isMenuFolder } from "@/lib/appMenu";
import { FEATURES } from "@/lib/appSearch";

// ── 보이는 조건 ─────────────────────────────────────────────

/**
 * diet: 다이어트 프로그램 회원 · staff: 코치님·지점장·운영진 · office: 사무실이 켜진 지점 지도진 ·
 * dm: 메시지를 쓸 수 있는 계정 · manager: 앱 권한 코치·지점장·관리자(관리자 화면 /manager 에 들어가는 분) ·
 * admin: 관리자 · 전체관리자
 */
export type MenuRequire = "diet" | "staff" | "office" | "dm" | "manager" | "admin";

export interface MenuViewer {
  diet: boolean;
  staff: boolean;
  office: boolean;
  dm: boolean;
  manager: boolean;
  admin: boolean;
}

export const canSee = (req: MenuRequire | undefined, v: MenuViewer): boolean => !req || v[req];

// ── 바로가기 목록 ───────────────────────────────────────────

export interface MenuCatalogItem {
  /** 가는 곳 — 경로 + ?탭. 칸의 이름표(id)로도 쓴다 */
  id: string;
  /** 칸 이름 (짧게) */
  label: string;
  /** 추가 창 한 줄 설명 */
  subtitle?: string;
  glyph: MenuGlyphName;
  requires?: MenuRequire;
  /** 추가 창 검색어 — 화면에는 안 보인다 */
  keywords: string[];
  /** menu: 처음 전체 메뉴에 있던 칸 · more: 바로가기로 더 넣을 수 있는 화면 */
  source: "menu" | "more";
}

const x = (
  id: string,
  label: string,
  glyph: MenuGlyphName,
  subtitle: string,
  keywords: string[],
  requires?: MenuRequire,
): MenuCatalogItem => ({ id, label, glyph, subtitle, keywords, requires, source: "more" });

/**
 * 기능 검색 목록에 없거나, 이름 · 권한을 바로가기에 맞게 따로 정한 화면.
 * 경로는 App.tsx 라우트와 같아야 한다. 관리자 화면(/manager …)은 ManagerRoute 라 'manager'.
 */
export const SHORTCUT_EXTRAS: readonly MenuCatalogItem[] = [
  // 하단 탭 화면 — 전체 메뉴에는 없지만 바로가기로는 넣을 수 있게
  x("/missions", "훈련", "glove", "오늘의 코스 · 출석 · 레벨 연습", ["훈련", "오늘 할 일", "코스", "출석"]),
  x("/halloffame", "랭킹", "medal", "지점 순위 · 명예의 전당", ["랭킹", "순위", "명예의 전당"]),
  x("/notifications", "알림", "bell", "공지 · 출석 · 수업 소식", ["알림", "알림함", "소식"]),
  // 운영진 — 설정 › 회원 관리 › … 로 몇 번 들어가야 하던 화면 (대표님 예: 라이브보드)
  x(
    "/manager/live-board",
    "라이브보드",
    "play",
    "지점 TV 화면 고르기 · TV 화면 바꾸기",
    ["라이브보드", "라이브 보드", "tv", "티비", "전광판", "사이니지", "tv 화면"],
    "manager",
  ),
  x(
    "/manager",
    "회원 관리",
    "clipboard",
    "회원 · 승인 · 심사 · 운영",
    ["회원 관리", "관리자", "관리자 화면", "지점 관리", "매니저"],
    "manager",
  ),
  x(
    "/manager?tab=test153",
    "153 PB 측정",
    "medal",
    "셀트런 + 8종목 · 코치가 재는 공식 기록",
    ["153 PB 측정", "pb 측정", "체력 측정", "기록 측정", "측정"],
    "manager",
  ),
  x(
    "/manager?tab=inbox",
    "가입 승인",
    "idcard",
    "승인 기다리는 회원",
    ["승인", "가입 승인", "승인 대기", "회원 승인"],
    "manager",
  ),
  x(
    "/manager?tab=level_review",
    "레벨 심사",
    "titlematch",
    "타이틀매치 · 레벨 심사 신청",
    ["심사", "레벨 심사", "심사 신청", "타이틀매치 심사"],
    "manager",
  ),
  x(
    "/manager?tab=operations",
    "오늘 운영",
    "clipboard",
    "오늘 출석 · 운영 보드",
    ["운영", "오늘 운영", "오늘 출석", "운영 보드"],
    "manager",
  ),
  x(
    "/manager?tab=at_risk",
    "위험 회원",
    "bell",
    "오래 안 온 회원 · 챙길 회원",
    ["위험", "위험 회원", "이탈", "안 오는 회원"],
    "manager",
  ),
  x(
    "/coach",
    "코치 화면",
    "clipboard",
    "회원 승인 · 심사 · 오늘 출석",
    ["코치", "코치 화면", "코치 대시보드"],
    "manager",
  ),
  x(
    "/routine-builder",
    "루틴 만들기",
    "clipboard",
    "코치 수업 루틴 빌더",
    ["루틴 만들기", "루틴 빌더", "수업 만들기"],
    "manager",
  ),
  x(
    "/office?tab=strategy",
    "전략 회의",
    "chat",
    "153운영본부 — 지시 · 오늘 프로그램 · 수업 기록",
    ["전략 회의", "전략", "지시", "수업 기록", "오늘 프로그램", "153 기준"],
    "staff",
  ),
  x(
    "/office?tab=work",
    "근무",
    "clipboard",
    "153운영본부 — 근무 시간 · 계약서",
    ["근무", "근무 시간", "계약서", "시급", "대타"],
    "staff",
  ),
  x(
    "/office?tab=plan",
    "팀 일정",
    "clipboard",
    "153운영본부 — 코치님 스케줄",
    ["일정", "스케줄", "팀 일정", "내 일정"],
    "staff",
  ),
  x(
    "/office?tab=sales",
    "매출",
    "membership",
    "153운영본부 — 이 달 매출",
    ["매출", "이번 달 매출", "pt 매출"],
    "admin",
  ),
  x("/admin", "전체 관리", "gear", "본사 대시보드", ["본사", "전체 관리", "대시보드", "슈퍼 관리자"], "admin"),
];

/** 칸 이름은 짧게 — 기능 검색 제목 "라이브보드 · TV" → "라이브보드" */
const shortLabel = (title: string) => title.split(" · ")[0].trim();

let catalogCache: { list: MenuCatalogItem[]; map: Map<string, MenuCatalogItem> } | null = null;

/** 넣을 수 있는 모든 화면 — 기본 메뉴 → SHORTCUT_EXTRAS → 기능 검색 목록 순서, 같은 곳은 처음 것 하나 */
export function menuCatalog(): { list: MenuCatalogItem[]; map: Map<string, MenuCatalogItem> } {
  if (catalogCache) return catalogCache;
  const map = new Map<string, MenuCatalogItem>();
  const featureByRoute = new Map<string, (typeof FEATURES)[number]>();
  for (const fe of FEATURES) {
    if (fe.action.kind === "route" && !featureByRoute.has(fe.action.to)) featureByRoute.set(fe.action.to, fe);
  }
  const extraById = new Map(SHORTCUT_EXTRAS.map((e) => [e.id, e]));

  for (const e of APP_MENU) {
    const items = isMenuFolder(e) ? e.items : [e];
    for (const m of items) {
      if (map.has(m.path)) continue;
      const fe = featureByRoute.get(m.path);
      const ex = extraById.get(m.path);
      // 메시지는 기본 메뉴에서 '쓸 수 없는 계정이면 빼기'로 따로 숨겼다 → 바로가기에서는 조건 dm
      const featReq = fe?.requires === "dm" || fe?.requires === "diet" ? fe.requires : undefined;
      map.set(m.path, {
        id: m.path,
        label: m.label,
        glyph: m.glyph,
        subtitle: ex?.subtitle ?? fe?.subtitle,
        requires: m.requires ?? featReq,
        keywords: [...(ex?.keywords ?? []), ...(fe?.keywords ?? [])],
        source: "menu",
      });
    }
  }
  for (const ex of SHORTCUT_EXTRAS) if (!map.has(ex.id)) map.set(ex.id, ex);
  for (const fe of FEATURES) {
    if (fe.action.kind !== "route") continue; // 창 열기 · 앱 밖 페이지는 칸으로 두지 않는다
    const id = fe.action.to;
    if (map.has(id)) continue;
    map.set(id, {
      id,
      label: shortLabel(fe.title),
      glyph: fe.glyph ?? "compass",
      subtitle: fe.subtitle,
      requires: fe.staffOnly ? "staff" : fe.requires,
      keywords: fe.keywords,
      source: "more",
    });
  }
  catalogCache = { list: [...map.values()], map };
  return catalogCache;
}

// ── 배치 ───────────────────────────────────────────────────

/** 첫 화면(폴더 밖) — 끌기(useMenuDrag DRAG_ROOT)와 같은 이름 */
export const ROOT = "root";
/** 칸 · 폴더 이름 글자 수 */
export const MAX_LABEL = 12;
/** 첫 화면 칸 수 (폴더도 한 칸) */
export const MAX_ROOT_ENTRIES = 48;
/** 폴더 하나에 넣는 칸 수 */
export const MAX_FOLDER_ITEMS = 24;

export interface LayoutItem {
  /** 가는 곳 — menuCatalog 의 id */
  id: string;
  /** 본인이 바꾼 이름 (없으면 원래 이름) */
  label?: string;
}

export interface LayoutFolder {
  /** 폴더 이름표 — 기본 묶음은 appMenu 의 folder, 본인이 만든 폴더는 'u-…' */
  folder: string;
  label: string;
  items: LayoutItem[];
}

export type LayoutEntry = LayoutItem | LayoutFolder;

export const isLayoutFolder = (e: LayoutEntry): e is LayoutFolder => "items" in e;

export interface MenuLayout {
  v: 1;
  /** 마지막으로 고친 시각(ms) — 이 기기와 DB 중 새것을 고른다 */
  updatedAt: number;
  /** 없으면 기본 메뉴 그대로 (처음대로) */
  entries?: LayoutEntry[];
  /** 저장할 때 있던 기본 칸 · 묶음 — 여기 없는 기본 칸은 그 뒤에 새로 생긴 것 */
  known?: string[];
}

// 앱 안 경로만 칸이 된다 — '/' 로 시작(// 아님) · 경로 글자만 · 200자까지
const ITEM_ID = /^\/(?!\/)[A-Za-z0-9._~%/?=&:@+,;!*()'-]*$/;
const FOLDER_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/;

const validItemId = (v: unknown): v is string => typeof v === "string" && v.length <= 200 && ITEM_ID.test(v);
const validFolderId = (v: unknown): v is string => typeof v === "string" && v !== ROOT && FOLDER_ID.test(v);

/** 이름 다듬기 — 빈칸을 한 칸으로 · 앞뒤 빈칸 빼고 · 12자까지 */
const cleanLabel = (v: unknown): string =>
  typeof v === "string" ? Array.from(v.replace(/\s+/g, " ").trim()).slice(0, MAX_LABEL).join("").trim() : "";

const entryId = (e: LayoutEntry): string => (isLayoutFolder(e) ? e.folder : e.id);

const clone = (entries: readonly LayoutEntry[]): LayoutEntry[] =>
  entries.map((e) => (isLayoutFolder(e) ? { ...e, items: e.items.map((i) => ({ ...i })) } : { ...e }));

const findFolder = (entries: readonly LayoutEntry[], id: string): LayoutFolder | undefined =>
  entries.find((e): e is LayoutFolder => isLayoutFolder(e) && e.folder === id);

/** 기본 메뉴(appMenu) 그대로의 배치 */
export function defaultEntries(): LayoutEntry[] {
  return APP_MENU.map(
    (e): LayoutEntry =>
      isMenuFolder(e)
        ? { folder: e.folder, label: e.label, items: e.items.map((m) => ({ id: m.path })) }
        : { id: e.path },
  );
}

/** 지금 기본 메뉴에 있는 칸 · 묶음('folder:<이름표>') — 저장할 때 같이 남긴다 */
export function baseKnownIds(): string[] {
  const out: string[] = [];
  for (const e of APP_MENU) {
    if (isMenuFolder(e)) {
      out.push(`folder:${e.folder}`);
      for (const m of e.items) out.push(m.path);
    } else out.push(e.path);
  }
  return out;
}

/** 저장할 모양으로 — 지금 시각 + 지금 기본 메뉴 목록(known) */
export const toLayout = (entries: LayoutEntry[]): MenuLayout => ({
  v: 1,
  updatedAt: Date.now(),
  entries,
  known: baseKnownIds(),
});

/** 본인이 만든 폴더 이름표 */
export const newFolderId = (): string => `u-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** 이 칸이 놓인 곳 — 첫 화면이면 ROOT(폴더 칸도) · 폴더 안이면 그 폴더 이름표 · 어디에도 없으면 null */
export function containerOf(entries: readonly LayoutEntry[], id: string): string | null {
  for (const e of entries) {
    if (!isLayoutFolder(e)) {
      if (e.id === id) return ROOT;
    } else if (e.folder === id) return ROOT;
    else if (e.items.some((i) => i.id === id)) return e.folder;
  }
  return null;
}

/**
 * 저장한 배치 → 지금 쓸 배치.
 *   · 고친 적이 없으면(entries 없음) 기본 메뉴.
 *   · 저장한 뒤 기본 메뉴에 새로 생긴 칸(known 에 없고 어디에도 안 놓인 것)은 저절로 붙는다 —
 *     기본 묶음 안의 칸이면 내 배치의 그 묶음 끝에, 묶음을 풀었거나 뺐으면 첫 화면 끝에, 묶음째 새로 생겼으면 묶음째 끝에.
 *   · 본인이 뺀 칸(known 에는 있고 배치에는 없는 것)은 다시 생기지 않는다.
 */
export function resolveEntries(layout: MenuLayout | null | undefined): LayoutEntry[] {
  if (!layout?.entries) return defaultEntries();
  const entries = clone(layout.entries);
  const known = new Set(layout.known ?? []);
  const placed = new Set<string>();
  for (const e of entries) {
    if (isLayoutFolder(e)) for (const i of e.items) placed.add(i.id);
    else placed.add(e.id);
  }
  const isNew = (path: string) => !known.has(path) && !placed.has(path);
  for (const d of APP_MENU) {
    if (!isMenuFolder(d)) {
      if (isNew(d.path)) entries.push({ id: d.path });
      continue;
    }
    const fresh = d.items.filter((m) => isNew(m.path)).map((m): LayoutItem => ({ id: m.path }));
    if (fresh.length === 0) continue;
    const mine = findFolder(entries, d.folder);
    if (mine) {
      const room = Math.max(0, MAX_FOLDER_ITEMS - mine.items.length);
      mine.items.push(...fresh.slice(0, room));
      entries.push(...fresh.slice(room));
    } else if (!known.has(`folder:${d.folder}`)) {
      entries.push({ folder: d.folder, label: d.label, items: fresh });
    } else {
      entries.push(...fresh);
    }
  }
  return entries;
}

// ── 화면에 그릴 모양 ───────────────────────────────────────

export interface MenuViewItem {
  kind: "item";
  /** 칸 이름표 (= 가는 곳) */
  id: string;
  path: string;
  label: string;
  /** 원래 이름 — 이름을 바꾼 칸을 되돌릴 때 */
  defaultLabel: string;
  glyph: MenuGlyphName;
}

export interface MenuViewFolder {
  kind: "folder";
  id: string;
  label: string;
  items: MenuViewItem[];
}

export type MenuViewEntry = MenuViewItem | MenuViewFolder;

/**
 * 배치 → 이 사람에게 보일 메뉴.
 *   · 권한이 없는 칸 · 이 판에 없는 화면은 뺀다(배치에는 그대로 남는다 — 권한이 생기면 그 자리에 나타난다).
 *   · 보통 화면: 보이는 칸이 하나뿐인 폴더는 그 칸으로 펼치고, 빈 폴더는 숨긴다(기본 메뉴 buildAppMenu 와 같은 규칙).
 *   · 편집 중: 폴더는 한 칸뿐이어도 · 비어 있어도 폴더로 — 넣을 곳 · 이름 바꾸기 · 지우기를 할 수 있게.
 */
export function buildMenuView(
  entries: readonly LayoutEntry[],
  viewer: MenuViewer,
  opts: { editing?: boolean } = {},
): MenuViewEntry[] {
  const { map } = menuCatalog();
  const seen = new Set<string>();
  const toView = (it: LayoutItem): MenuViewItem | null => {
    const c = map.get(it.id);
    if (!c || seen.has(it.id) || !canSee(c.requires, viewer)) return null;
    seen.add(it.id);
    return { kind: "item", id: it.id, path: c.id, label: it.label || c.label, defaultLabel: c.label, glyph: c.glyph };
  };
  const out: MenuViewEntry[] = [];
  for (const e of entries) {
    if (!isLayoutFolder(e)) {
      const v = toView(e);
      if (v) out.push(v);
      continue;
    }
    const items: MenuViewItem[] = [];
    for (const it of e.items) {
      const v = toView(it);
      if (v) items.push(v);
    }
    if (opts.editing || items.length > 1) out.push({ kind: "folder", id: e.folder, label: e.label, items });
    else if (items.length === 1) out.push(items[0]);
  }
  return out;
}

// ── 고치기 (모두 새 배열을 돌려준다 — 받은 배치는 건드리지 않는다) ──

/** 순서대로 다시 앉히기 — order 에 있는 것끼리만 자리를 바꾸고, 없는 것은 제자리 */
function reorder<T>(list: T[], idOf: (t: T) => string, order: readonly string[]): void {
  const byId = new Map(list.map((t) => [idOf(t), t]));
  const picked = new Set<string>();
  const seq: T[] = [];
  for (const id of order) {
    const t = byId.get(id);
    if (t && !picked.has(id)) {
      picked.add(id);
      seq.push(t);
    }
  }
  const slots: number[] = [];
  list.forEach((t, i) => {
    if (picked.has(idOf(t))) slots.push(i);
  });
  slots.forEach((slot, k) => {
    list[slot] = seq[k];
  });
}

/**
 * 끌어서 자리 바꾸기 — order = 그 그릇(ROOT 또는 폴더)에서 화면에 보이는 칸들의 새 순서.
 * 안 보이는 칸(권한이 없어 가려진 메뉴 등)은 제자리에 둔다.
 */
export function applyOrder(
  entries: readonly LayoutEntry[],
  container: string,
  order: readonly string[],
): LayoutEntry[] {
  const next = clone(entries);
  if (container === ROOT) reorder(next, entryId, order);
  else {
    const f = findFolder(next, container);
    if (f) reorder(f.items, (i) => i.id, order);
  }
  return next;
}

/**
 * 칸 옮기기 — dest: ROOT 또는 폴더 이름표 · beforeId: 그 칸 앞에(없으면 끝에).
 *   · 받을 폴더가 없거나 꽉 찼으면(첫 화면도) 그대로 돌려준다 — 부른 쪽은 containerOf 로 옮겨졌는지 본다.
 *   · 마지막 칸을 꺼내 비게 된 폴더는 없어진다.
 *   · 폴더 칸은 첫 화면 안에서만 옮긴다(폴더 안에 폴더는 없다).
 */
export function moveEntry(
  entries: readonly LayoutEntry[],
  id: string,
  dest: string,
  beforeId: string | null,
): LayoutEntry[] {
  const next = clone(entries);
  const src = containerOf(next, id);
  if (!src || beforeId === id) return next;
  const srcFolder = src === ROOT ? undefined : findFolder(next, src);
  const destFolder = dest === ROOT ? undefined : findFolder(next, dest);
  if (dest !== ROOT) {
    if (!destFolder || findFolder(next, id)) return next;
    if (src !== dest && destFolder.items.length >= MAX_FOLDER_ITEMS) return next;
  } else if (srcFolder && next.length >= MAX_ROOT_ENTRIES && srcFolder.items.length > 1) {
    return next;
  }

  // 꺼내기
  let moving: LayoutEntry;
  if (srcFolder) {
    moving = srcFolder.items.splice(
      srcFolder.items.findIndex((i) => i.id === id),
      1,
    )[0];
  } else {
    moving = next.splice(
      next.findIndex((e) => entryId(e) === id),
      1,
    )[0];
  }

  // 넣기
  if (destFolder) {
    const at = beforeId ? destFolder.items.findIndex((i) => i.id === beforeId) : -1;
    destFolder.items.splice(at < 0 ? destFolder.items.length : at, 0, moving as LayoutItem);
  } else {
    const at = beforeId ? next.findIndex((e) => entryId(e) === beforeId) : -1;
    next.splice(at < 0 ? next.length : at, 0, moving);
  }

  if (srcFolder && srcFolder !== destFolder && srcFolder.items.length === 0) next.splice(next.indexOf(srcFolder), 1);
  return next;
}

/**
 * 끌어온 칸을 다른 칸 위에 놓기 — 폴더 위면 그 폴더 끝에 넣고, 메뉴 위면 그 자리에 새 폴더(놓인 칸 · 끌어온 칸 순서).
 * folder = 들어간 폴더 이름표. 합칠 수 없으면 null — 폴더는 다른 칸 위에 놓을 수 없고, 폴더 안의 칸 위에도 못 놓는다.
 * (폴더가 꽉 찼으면 folder 는 그 폴더지만 칸은 제자리 — 부른 쪽이 containerOf 로 본다)
 */
export function mergeEntries(
  entries: readonly LayoutEntry[],
  dragId: string,
  targetId: string,
  newId: string = newFolderId(),
  newLabel = "새 폴더",
): { entries: LayoutEntry[]; folder: string | null } {
  const next = clone(entries);
  const src = containerOf(next, dragId);
  if (!src || dragId === targetId || findFolder(next, dragId) || containerOf(next, targetId) !== ROOT) {
    return { entries: next, folder: null };
  }
  const target = next.find((e) => entryId(e) === targetId);
  if (!target) return { entries: next, folder: null };
  if (isLayoutFolder(target)) return { entries: moveEntry(next, dragId, target.folder, null), folder: target.folder };
  if (!validFolderId(newId) || containerOf(next, newId)) return { entries: next, folder: null };

  const srcFolder = src === ROOT ? undefined : findFolder(next, src);
  const from: LayoutEntry[] = srcFolder ? srcFolder.items : next;
  const dragged = from.splice(
    from.findIndex((e) => entryId(e) === dragId),
    1,
  )[0] as LayoutItem;
  next[next.indexOf(target)] = { folder: newId, label: cleanLabel(newLabel) || "폴더", items: [target, dragged] };
  if (srcFolder && srcFolder.items.length === 0) next.splice(next.indexOf(srcFolder), 1);
  return { entries: next, folder: newId };
}

/** 빼기 — 메뉴 하나, 또는 폴더째(안의 메뉴도 같이). 마지막 칸을 빼서 비게 된 폴더는 없어진다 */
export function removeEntry(entries: readonly LayoutEntry[], id: string): LayoutEntry[] {
  const next: LayoutEntry[] = [];
  for (const e of clone(entries)) {
    if (!isLayoutFolder(e)) {
      if (e.id !== id) next.push(e);
      continue;
    }
    if (e.folder === id) continue;
    const items = e.items.filter((i) => i.id !== id);
    if (items.length === 0 && e.items.length > 0) continue;
    next.push({ ...e, items });
  }
  return next;
}

/** 폴더 풀기 — 안의 메뉴를 폴더가 있던 자리에 펼친다 (첫 화면이 넘치면 그대로) */
export function dissolveFolder(entries: readonly LayoutEntry[], folderId: string): LayoutEntry[] {
  const next = clone(entries);
  const f = findFolder(next, folderId);
  if (!f || next.length - 1 + f.items.length > MAX_ROOT_ENTRIES) return next;
  next.splice(next.indexOf(f), 1, ...f.items);
  return next;
}

/** 이름 바꾸기 — 메뉴는 비우면(원래 이름과 같아도) 원래 이름으로 · 폴더는 비우면 그대로 */
export function renameEntry(entries: readonly LayoutEntry[], id: string, label: string): LayoutEntry[] {
  const name = cleanLabel(label);
  const original = menuCatalog().map.get(id)?.label;
  const rename = (it: LayoutItem): LayoutItem =>
    it.id !== id ? it : name && name !== original ? { id: it.id, label: name } : { id: it.id };
  return clone(entries).map((e) => {
    if (!isLayoutFolder(e)) return rename(e);
    if (e.folder === id) return name ? { ...e, label: name } : e;
    return { ...e, items: e.items.map(rename) };
  });
}

/** 바로가기 넣기 — 이미 어딘가에 놓인 칸이면 그리로 옮긴다(바꾼 이름은 그대로). 꽉 찼으면 그대로 */
export function addEntry(entries: readonly LayoutEntry[], id: string, dest: string): LayoutEntry[] {
  if (containerOf(entries, id)) return moveEntry(entries, id, dest, null);
  const next = clone(entries);
  if (!validItemId(id)) return next;
  if (dest === ROOT) {
    if (next.length < MAX_ROOT_ENTRIES) next.push({ id });
    return next;
  }
  const f = findFolder(next, dest);
  if (f && f.items.length < MAX_FOLDER_ITEMS) f.items.push({ id });
  return next;
}

/** 빈 새 폴더를 첫 화면 끝에 — 첫 화면이 꽉 찼거나 같은 이름표가 이미 있으면 그대로(길이가 안 늘어난다) */
export function addFolder(entries: readonly LayoutEntry[], label: string, id: string): LayoutEntry[] {
  const next = clone(entries);
  if (!validFolderId(id) || next.length >= MAX_ROOT_ENTRIES || containerOf(next, id)) return next;
  next.push({ folder: id, label: cleanLabel(label) || "폴더", items: [] });
  return next;
}

// ── 읽은 값 다듬기 ─────────────────────────────────────────

/**
 * 이 기기 · DB 에서 읽은 값을 믿지 않고 다듬는다 — 모양이 틀리면 null.
 *   · 칸: 앱 안 경로('/…')만 · 같은 칸은 처음 것 하나 · 이름 12자까지
 *   · 폴더: 이름표 글자 확인 · 이름이 비면 '폴더' · 안의 칸 24개까지 · 첫 화면 48칸까지
 */
export function parseLayout(raw: unknown): MenuLayout | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return null;
  const at = o.updatedAt;
  const out: MenuLayout = { v: 1, updatedAt: typeof at === "number" && Number.isFinite(at) && at > 0 ? at : 0 };

  if (Array.isArray(o.entries)) {
    const usedItems = new Set<string>();
    const usedFolders = new Set<string>();
    const item = (v: unknown): LayoutItem | null => {
      if (!v || typeof v !== "object") return null;
      const { id, label } = v as Record<string, unknown>;
      if (!validItemId(id) || usedItems.has(id)) return null;
      usedItems.add(id);
      const name = cleanLabel(label);
      return name ? { id, label: name } : { id };
    };
    const entries: LayoutEntry[] = [];
    for (const v of o.entries) {
      if (entries.length >= MAX_ROOT_ENTRIES) break;
      if (!v || typeof v !== "object") continue;
      const r = v as Record<string, unknown>;
      if (!("folder" in r) && !("items" in r)) {
        const it = item(r);
        if (it) entries.push(it);
        continue;
      }
      const fid = r.folder;
      if (!validFolderId(fid) || usedFolders.has(fid) || !Array.isArray(r.items)) continue;
      usedFolders.add(fid);
      const items: LayoutItem[] = [];
      for (const iv of r.items) {
        if (items.length >= MAX_FOLDER_ITEMS) break;
        const it = item(iv);
        if (it) items.push(it);
      }
      entries.push({ folder: fid, label: cleanLabel(r.label) || "폴더", items });
    }
    out.entries = entries;
  }

  if (Array.isArray(o.known)) {
    out.known = o.known.filter((k): k is string => typeof k === "string" && k.length <= 200).slice(0, 500);
  }
  return out;
}
