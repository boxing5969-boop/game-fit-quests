/**
 * 🏢 지점 회의실 — 누가 앱에 들어와 있나 (접속 표시) 공용 보관함 (2026-10-27)
 *
 *   OfficePresenceBridge(App 전체에 하나)가 비공개 채널 'office:<지점 코드>' 에 들어가 Presence 로 내 접속을 알리고,
 *   채널의 접속 목록(user_id)을 여기 담는다. 사무실 화면 · 홈 카드는 useOfficeOnline(topic) 으로 읽는다.
 *   회의 채팅에 쓰고 있는 사람(입력 중 '…')도 같은 채널로 — useOfficeTyping · sendOfficeTyping (아래).
 */
import { useSyncExternalStore } from "react";

export interface OfficeTopicState {
  /** 지금 앱에 들어와 있는 사람 (user_id) */
  online: ReadonlySet<string>;
  /** 실시간 채널이 이어져 있나 */
  connected: boolean;
}

const EMPTY: OfficeTopicState = Object.freeze({ online: new Set<string>(), connected: false });
const states = new Map<string, OfficeTopicState>();
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export const setOfficeTopicState = (topic: string, patch: Partial<OfficeTopicState>) => {
  states.set(topic, { ...(states.get(topic) ?? EMPTY), ...patch });
  emit();
};

export const clearOfficeTopic = (topic: string) => {
  const m = typing.get(topic);
  if (m) {
    m.forEach((t) => clearTimeout(t));
    typing.delete(topic);
    typingSnap.delete(topic);
  }
  senders.delete(topic);
  if (!states.has(topic) && !m) return;
  states.delete(topic);
  emit();
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const getOfficeTopicState = (topic: string | null | undefined): OfficeTopicState =>
  (topic && states.get(topic)) || EMPTY;

export const useOfficeOnline = (topic: string | null | undefined): OfficeTopicState =>
  useSyncExternalStore(
    subscribe,
    () => getOfficeTopicState(topic),
    () => EMPTY,
  );

/** 앱을 닫거나 화면을 끄면 이만큼 뒤에 자리에서 일어난다 (잠깐 전화 받을 때 깜빡이지 않게) */
export const OFFICE_LEAVE_DELAY_MS = 30_000;

/* ───────────── 입력 중 '…' (회의 채팅에 쓰고 있는 사람 — 2026-10-27 대표님 "진짜 회의 하는 것처럼") ─────────────
 *   같은 채널 broadcast 'typing' {u, off?} — 내용은 보내지 않는다. 받은 쪽은 4.5초 동안 그 사람 캐릭터 옆에 '…'.
 *   보내는 쪽은 쓰는 동안 2.5초마다 한 번, 보내거나 다 지우면 off.
 */
const TYPING_MS = 4500;

type OfficeSender = (event: string, payload: Record<string, unknown>) => void;
const senders = new Map<string, OfficeSender>();

/** OfficePresenceBridge 가 채널마다 보내는 길을 걸어 둔다 */
export const setOfficeSender = (topic: string, fn: OfficeSender | null) => {
  if (fn) senders.set(topic, fn);
  else senders.delete(topic);
};

/** 내가 쓰는 중 (on=false 면 그만) */
export const sendOfficeTyping = (topic: string | null | undefined, uid: string | null | undefined, on = true) => {
  if (!topic || !uid) return;
  senders.get(topic)?.("typing", on ? { u: uid } : { u: uid, off: 1 });
};

const typing = new Map<string, Map<string, ReturnType<typeof setTimeout>>>();
const typingSnap = new Map<string, ReadonlySet<string>>();
const NO_ONE: ReadonlySet<string> = new Set<string>();

const rebuildTyping = (topic: string) => {
  const m = typing.get(topic);
  typingSnap.set(topic, new Set(m ? m.keys() : []));
  emit();
};

/** 받은 '쓰는 중' 신호 */
export const markOfficeTyping = (topic: string, uid: string, on = true) => {
  let m = typing.get(topic);
  if (!m) {
    m = new Map();
    typing.set(topic, m);
  }
  const map = m;
  const old = map.get(uid);
  if (old) clearTimeout(old);
  if (!on) {
    if (old) {
      map.delete(uid);
      rebuildTyping(topic);
    }
    return;
  }
  map.set(
    uid,
    setTimeout(() => {
      map.delete(uid);
      rebuildTyping(topic);
    }, TYPING_MS),
  );
  if (!old) rebuildTyping(topic);
};

/** 지금 회의 채팅에 쓰고 있는 사람 (나는 빼고) */
export const useOfficeTyping = (topic: string | null | undefined): ReadonlySet<string> =>
  useSyncExternalStore(
    subscribe,
    () => (topic && typingSnap.get(topic)) || NO_ONE,
    () => NO_ONE,
  );
