/**
 * 🏢 지점 회의실 — 누가 앱에 들어와 있나 (접속 표시) 공용 보관함 (2026-10-27)
 *
 *   OfficePresenceBridge(App 전체에 하나)가 비공개 채널 'office:<지점 코드>' 에 들어가 Presence 로 내 접속을 알리고,
 *   채널의 접속 목록(user_id)을 여기 담는다. 사무실 화면 · 홈 카드는 useOfficeOnline(topic) 으로 읽는다.
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
  if (!states.has(topic)) return;
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
