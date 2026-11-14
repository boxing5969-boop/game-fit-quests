/**
 * 📣 앱 업데이트 내역 — 보이는 업데이트 · 아직 안 본 것(빨간 점) · 다 봤어요 (2026-11-15 · lib/appUpdates.ts)
 *   · 본 것 = 이 기기 localStorage `153updates:seen:<계정>` (기기 · 사람마다 가벼운 편의 — 서버에 안 남긴다)
 *   · 저장이 막힌 기기(사생활 보호 창 등)는 이번 접속 동안만 기억한다
 *   · 같은 앱 안 여러 곳(전체 메뉴 · 알림함 · 공지사항)이 같은 값을 보게 작은 보관함 하나
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDmSummary } from "@/hooks/useDm";
import { APP_UPDATES } from "@/data/appUpdates";
import { mergeSeen, newBadgeIds, parseSeen, unseenIds, visibleUpdates, type AppUpdate } from "@/lib/appUpdates";

const KEY_PREFIX = "153updates:seen:";
const memory = new Map<string, string>();
const listeners = new Set<() => void>();

function snapshot(uid: string | null): string {
  if (!uid) return "";
  try {
    return window.localStorage.getItem(KEY_PREFIX + uid) ?? memory.get(uid) ?? "";
  } catch {
    return memory.get(uid) ?? "";
  }
}

function writeSeen(uid: string, ids: readonly string[]) {
  const raw = JSON.stringify(ids);
  memory.set(uid, raw);
  try {
    window.localStorage.setItem(KEY_PREFIX + uid, raw);
  } catch {
    /* 저장이 막힌 기기 — 이번 접속 동안만 */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key.startsWith(KEY_PREFIX)) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export interface AppUpdatesState {
  /** 이 사람에게 보이는 업데이트 — 최신 먼저 */
  updates: AppUpdate[];
  /** 아직 안 본 업데이트 id */
  unseen: Set<string>;
  /** 「새」 표시를 붙일 업데이트 — 이 기기에서 처음이면 가장 최근 날짜만 */
  newBadges: Set<string>;
  /** 빨간 점 */
  hasNew: boolean;
  /** 보이는 업데이트를 모두 본 것으로 */
  markAllSeen: () => void;
}

export function useAppUpdates(): AppUpdatesState {
  const { user, profile, role } = useAuth();
  const uid = user?.id ?? null;
  // 코치님은 앱 권한이 '회원'이어도 서버가 코치로 본다 — 전체 메뉴의 지점 회의실 칸과 같은 기준
  const { data: dm } = useDmSummary();
  const hq = role === "super_admin" || role === "admin" || dm?.kind === "hq";
  const staff = hq || role === "branch_manager" || role === "coach" || dm?.kind === "coach";
  const branch = profile?.branch_name ?? null;

  const raw = useSyncExternalStore(
    subscribe,
    () => snapshot(uid),
    () => "",
  );
  const updates = useMemo(() => visibleUpdates(APP_UPDATES, { staff, hq, branch }), [staff, hq, branch]);
  const seen = useMemo(() => parseSeen(raw), [raw]);
  const unseen = useMemo(() => unseenIds(updates, seen), [updates, seen]);
  const newBadges = useMemo(() => newBadgeIds(updates, seen), [updates, seen]);

  const markAllSeen = useCallback(() => {
    if (!uid || unseen.size === 0) return;
    writeSeen(uid, mergeSeen(seen, [...unseen]));
  }, [uid, seen, unseen]);

  return { updates, unseen, newBadges, hasNew: !!uid && unseen.size > 0, markAllSeen };
}
