/**
 * 🗂 영상으로 배우기 정리표 · 이용 기록 (2026-11-14 대표님 「추천대로진행하자」 1단계)
 *
 *   · useShelfLayout — 정리표 한 장(전 지점 같은 정리) + 서버가 보는 '고칠 수 있나'(대표님 · 운영진) — 열쇠 ["training-library","layout"]
 *   · saveShelfLayout · restoreShelfLayout · useShelfLayoutHistory — 대표님 편집(판 번호가 다르면 conflict → 새로 불러오기)
 *   · useCardBrief — 지난 n일 회원 숫자(합계만 — 누가 무엇을 봤는지는 안 온다)
 *   · logCardEvent — 카드를 열고 · 영상이 돌고 · 끝까지 · 다시 본 것. 보이지 않게, 실패해도 조용히(서버에 함수가 없으면 그만 부름)
 *   · 예시 모드(?demo=1): 서버를 부르지 않고 이 창(sessionStorage)에만 — 미리보기 주소(옛 DB)에서도 편집을 눌러 볼 수 있다
 *   · 서버에 정리표 함수가 없으면(DB 적용 전 · 옛 DB 미리보기) 빈 정리표(= 예전 화면) · 편집 없음 · 기록 안 함
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EMPTY_LAYOUT, parseShelfLayout, type ShelfLayout } from "@/lib/shelfLayout";
import { isTrainingDemo } from "@/services/trainingCardService";

export const SHELF_LAYOUT_KEY = ["training-library", "layout"] as const;
/** 정리표 쿼리 열쇠 (예시 모드면 따로) */
export const shelfLayoutQueryKey = () => [...SHELF_LAYOUT_KEY, isTrainingDemo() ? "demo" : "db"] as const;

export interface ShelfLayoutState {
  layout: ShelfLayout;
  version: number;
  updatedAt: string | null;
  /** 서버가 본 '고칠 수 있나' (예시 모드는 false — 화면이 관리자 계정이면 켠다) */
  canEdit: boolean;
  /** 서버에 정리표 함수가 있나 */
  available: boolean;
  demo: boolean;
}

export type SaveResult = { ok: true; version: number } | { ok: false; code: "conflict"; version: number };

export interface LayoutHistoryEntry {
  version: number;
  note: string;
  savedAt: string;
  savedByName: string;
  layout: ShelfLayout;
}

export interface CardBriefItem {
  users: number;
  opens: number;
  completes: number;
  replays: number;
}
export interface CardBrief {
  days: number;
  since: string;
  /** 영상으로 배우기를 본 회원 */
  shelfMembers: number;
  /** 카드 · 레벨 미션을 연 회원 */
  members: number;
  items: Map<string, CardBriefItem>;
  demo: boolean;
}

export type CardEventKind = "shelf" | "open" | "play" | "complete" | "replay";

type RpcError = { code?: string; message?: string } | null;
const missingFn = (error: RpcError) =>
  !!error && (error.code === "PGRST202" || error.code === "42883" || /could not find the function|does not exist/i.test(error.message ?? ""));

const rpc = (fn: string, args?: Record<string, unknown>) =>
  (supabase as unknown as { rpc: (f: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: RpcError }> }).rpc(fn, args);

/* ───────── 예시 모드 (이 창에만) ───────── */

const DEMO_LAYOUT = "153learn:layout:demo";
const DEMO_HISTORY = "153learn:layout:demo:history";

function readDemo(): { layout: ShelfLayout; version: number } {
  try {
    const r = JSON.parse(window.sessionStorage.getItem(DEMO_LAYOUT) ?? "null");
    if (r && typeof r === "object") return { layout: parseShelfLayout(r.layout), version: Number(r.version) || 0 };
  } catch {
    /* 무시 */
  }
  return { layout: EMPTY_LAYOUT, version: 0 };
}

function readDemoHistory(): LayoutHistoryEntry[] {
  try {
    const r = JSON.parse(window.sessionStorage.getItem(DEMO_HISTORY) ?? "[]");
    if (Array.isArray(r))
      return r.map((h) => ({
        version: Number(h.version) || 0,
        note: String(h.note ?? ""),
        savedAt: String(h.savedAt ?? ""),
        savedByName: "예시",
        layout: parseShelfLayout(h.layout),
      }));
  } catch {
    /* 무시 */
  }
  return [];
}

function writeDemo(layout: ShelfLayout, note: string): SaveResult {
  const cur = readDemo();
  const version = cur.version + 1;
  try {
    window.sessionStorage.setItem(DEMO_LAYOUT, JSON.stringify({ layout, version }));
    const hist = [{ version, note, savedAt: new Date().toISOString(), layout }, ...readDemoHistory()].slice(0, 30);
    window.sessionStorage.setItem(DEMO_HISTORY, JSON.stringify(hist));
  } catch {
    /* 무시 */
  }
  return { ok: true, version };
}

/* ───────── 정리표 ───────── */

export function useShelfLayout() {
  const demo = isTrainingDemo();
  return useQuery({
    queryKey: shelfLayoutQueryKey(),
    staleTime: 3 * 60_000,
    retry: 1,
    queryFn: async (): Promise<ShelfLayoutState> => {
      if (demo) {
        const d = readDemo();
        return { ...d, updatedAt: null, canEdit: false, available: false, demo: true };
      }
      const { data, error } = await rpc("training_shelf_layout");
      if (error) {
        if (missingFn(error)) return { layout: EMPTY_LAYOUT, version: 0, updatedAt: null, canEdit: false, available: false, demo: false };
        throw new Error(error.message ?? "정리를 불러오지 못했어요");
      }
      const r = (data ?? {}) as Record<string, unknown>;
      return {
        layout: parseShelfLayout(r.layout),
        version: Number(r.version) || 0,
        updatedAt: typeof r.updated_at === "string" ? r.updated_at : null,
        canEdit: r.can_edit === true,
        available: true,
        demo: false,
      };
    },
  });
}

const cleanNote = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 80);

export async function saveShelfLayout(layout: ShelfLayout, baseVersion: number, note: string): Promise<SaveResult> {
  if (isTrainingDemo()) return writeDemo(layout, cleanNote(note));
  const { data, error } = await rpc("training_shelf_layout_save", { p_layout: layout, p_base_version: baseVersion, p_note: cleanNote(note) });
  if (error) throw new Error(error.message ?? "정리를 저장하지 못했어요");
  const r = (data ?? {}) as Record<string, unknown>;
  if (r.ok === true) return { ok: true, version: Number(r.version) || baseVersion + 1 };
  return { ok: false, code: "conflict", version: Number(r.version) || 0 };
}

export async function restoreShelfLayout(version: number, baseVersion: number): Promise<SaveResult> {
  if (isTrainingDemo()) {
    const hit = readDemoHistory().find((h) => h.version === version);
    if (!hit) throw new Error("그 정리 기록이 없어요");
    return writeDemo(hit.layout, `되돌림 · ${version}번 정리`);
  }
  const { data, error } = await rpc("training_shelf_layout_restore", { p_version: version, p_base_version: baseVersion });
  if (error) throw new Error(error.message ?? "되돌리지 못했어요");
  const r = (data ?? {}) as Record<string, unknown>;
  if (r.ok === true) return { ok: true, version: Number(r.version) || baseVersion + 1 };
  return { ok: false, code: "conflict", version: Number(r.version) || 0 };
}

export function useShelfLayoutHistory(enabled: boolean) {
  const demo = isTrainingDemo();
  return useQuery({
    queryKey: [...SHELF_LAYOUT_KEY, "history", demo ? "demo" : "db"],
    enabled,
    staleTime: 0,
    queryFn: async (): Promise<LayoutHistoryEntry[]> => {
      if (demo) return readDemoHistory();
      const { data, error } = await rpc("training_shelf_layout_history", { p_limit: 30 });
      if (error) {
        if (missingFn(error)) return [];
        throw new Error(error.message ?? "정리 기록을 불러오지 못했어요");
      }
      return ((data ?? []) as Record<string, unknown>[]).map((h) => ({
        version: Number(h.version) || 0,
        note: String(h.note ?? ""),
        savedAt: String(h.saved_at ?? ""),
        savedByName: String(h.saved_by_name ?? ""),
        layout: parseShelfLayout(h.layout),
      }));
    },
  });
}

/* ───────── 대표님 요약 (합계만) ───────── */

const demoNum = (key: string, mod: number) => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % mod;
};

export function useCardBrief(enabled: boolean, keys: readonly string[] = [], days = 7) {
  const demo = isTrainingDemo();
  return useQuery({
    queryKey: [...SHELF_LAYOUT_KEY, "brief", days, demo ? "demo" : "db"],
    enabled,
    staleTime: 2 * 60_000,
    queryFn: async (): Promise<CardBrief | null> => {
      if (demo) {
        // 예시 숫자 — 화면에 「예시」로 표시한다
        const items = new Map<string, CardBriefItem>();
        for (const k of keys) {
          const users = demoNum(k, 9);
          if (users) items.set(k, { users, opens: users + demoNum(`${k}o`, 4), completes: Math.max(0, users - demoNum(`${k}c`, 4)), replays: demoNum(`${k}r`, 3) });
        }
        return { days, since: "", shelfMembers: 24, members: 17, items, demo: true };
      }
      const { data, error } = await rpc("training_card_brief", { p_days: days });
      if (error) {
        if (missingFn(error)) return null;
        throw new Error(error.message ?? "이용 기록을 불러오지 못했어요");
      }
      const r = (data ?? {}) as Record<string, unknown>;
      const items = new Map<string, CardBriefItem>();
      for (const x of (Array.isArray(r.items) ? r.items : []) as Record<string, unknown>[]) {
        items.set(String(x.item), {
          users: Number(x.users) || 0,
          opens: Number(x.opens) || 0,
          completes: Number(x.completes) || 0,
          replays: Number(x.replays) || 0,
        });
      }
      return {
        days: Number(r.days) || days,
        since: String(r.since ?? ""),
        shelfMembers: Number(r.shelf_members) || 0,
        members: Number(r.members) || 0,
        items,
        demo: false,
      };
    },
  });
}

/* ───────── 이용 기록 (보이지 않게) ───────── */

let eventsOff = false;
let cleaned = false;
const sentToday = new Set<string>();
const kstDay = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const EV_PREFIX = "153learn:ev:";

/** 지난 날의 '하루 한 번' 표시를 지운다 (이 창에서 한 번) */
function cleanOldMarks(today: string) {
  if (cleaned) return;
  cleaned = true;
  try {
    const old: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(EV_PREFIX) && !k.startsWith(`${EV_PREFIX}${today}:`)) old.push(k);
    }
    old.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* 무시 */
  }
}

/**
 * 이용 기록 한 줄 — item: 'shelf' · 's:<칸>' · 'f:<묶음>' · 'c:<카드 id>' · 'm:<미션 id>'.
 * daily: 이 기기에서 하루 한 번만(영상으로 배우기를 본 날 · 칸 칩 · 묶음). 로그인한 사람만 부른다(화면이 확인).
 */
export function logCardEvent(item: string, kind: CardEventKind, opts: { daily?: boolean } = {}): void {
  if (eventsOff || typeof window === "undefined" || isTrainingDemo()) return;
  if (opts.daily) {
    const today = kstDay();
    cleanOldMarks(today);
    const mark = `${EV_PREFIX}${today}:${item}:${kind}`;
    if (sentToday.has(mark)) return;
    sentToday.add(mark);
    try {
      if (window.localStorage.getItem(mark)) return;
      window.localStorage.setItem(mark, "1");
    } catch {
      /* 무시 — 이 창에서 한 번은 지킨다 */
    }
  }
  void rpc("training_card_event", { p_item: item, p_kind: kind }).then(
    ({ error }) => {
      if (missingFn(error)) eventsOff = true;
    },
    () => undefined,
  );
}
