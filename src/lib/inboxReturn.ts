/**
 * 🔔 알림함에서 연 화면 → 뒤로가기 = 다시 알림함 (2026-11-19 · 선릉역점 회원 제안 11/10
 *    「알림 확인하고 뒤로가기 누르면 메인화면이 떠서 여러 알림을 볼 때 일일이 다시 들어가야 해요」).
 *
 * 앱 안 기록은 맞다 — 알림함 → 알림 열기는 기록 한 칸(push)이라 크롬에서는 뒤로가기가 알림함으로 간다
 * (2026-11-19 실제 앱을 크로미움으로 띄워 확인). 그런데 회원님 폰(삼성 인터넷)에서는 뒤로가기가 알림함을
 * 건너뛰고 첫 화면으로 갔다 — 브라우저가 앱이 쌓은 칸을 건너뛰는 규칙(뒤로 가기 가로채기 막기)으로 본다
 * (그 폰에서 직접 재현은 못 함). 그래서 브라우저 규칙과 상관없이 앱이 직접 지킨다:
 *
 *   · 알림함에서 알림을 열 때 그 자리(기록 번호 idx)를 적어 둔다 — rememberInboxOpen
 *   · 뒤로가기(popstate)가 알림함보다 더 뒤로 건너뛰면 → 알림함으로 다시 연다 (InboxReturnBridge)
 *     크롬처럼 알림함에 바로 떨어지면 아무것도 안 한다
 *   · 휴대폰 알림을 눌러 연 화면도 아래에 알림함을 깔아 둔다 — openWithInboxBelow (PushBridge)
 *   · 알림함으로 돌아오면 보던 자리 · 아직 안 연 새 알림 표시가 그대로 — 아래 「본 것」 기록
 *
 * 30분이 지나거나 알림함보다 더 뒤로 가면(알림함에서 뒤로) 기록을 지운다. 이 기기 · 이 창에만(sessionStorage).
 * 화면은 components/notifications/InboxReturnBridge · NotificationsPage · PushBridge.
 */

export const INBOX_PATH = "/notifications";
export const INBOX_RETURN_TTL_MS = 30 * 60_000;

const RETURN_KEY = "153inbox:return";
const SEEN_KEY = "153inbox:seen:";

/** inbox = 알림함 칸의 idx · target = 그 위(연 알림) · scrollY = 알림함에서 보던 자리 */
export type InboxReturn = { inbox: number; target: number; at: number; scrollY: number };

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function store(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function readInboxReturn(now = Date.now()): InboxReturn | null {
  const s = store();
  if (!s) return null;
  try {
    const raw = s.getItem(RETURN_KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as Partial<InboxReturn> | null;
    if (!r || !num(r.inbox) || !num(r.target) || !num(r.at) || r.target <= r.inbox) return null;
    if (now - r.at > INBOX_RETURN_TTL_MS || r.at - now > 60_000) {
      s.removeItem(RETURN_KEY);
      return null;
    }
    return { inbox: r.inbox, target: r.target, at: r.at, scrollY: num(r.scrollY) ? Math.max(0, r.scrollY) : 0 };
  } catch {
    return null;
  }
}

function writeInboxReturn(r: InboxReturn): void {
  try {
    store()?.setItem(RETURN_KEY, JSON.stringify(r));
  } catch {
    /* 저장이 막힌 기기 — 앱 기록(뒤로가기) 그대로 */
  }
}

export function clearInboxReturn(): void {
  try {
    store()?.removeItem(RETURN_KEY);
  } catch {
    /* 무시 */
  }
}

/** 지금 칸의 기록 번호 — 라우터가 붙이는 state.idx (없으면 null) */
export function historyIdx(state: unknown = typeof window !== "undefined" ? window.history.state : null): number | null {
  const idx = (state as { idx?: unknown } | null)?.idx;
  return num(idx) ? idx : null;
}

/** 알림함에서 알림 하나를 열기 직전 — 알림함 칸과 보던 자리를 적어 둔다 */
export function rememberInboxOpen(
  idx: number | null = historyIdx(),
  scrollY: number = typeof window !== "undefined" ? window.scrollY : 0,
  now = Date.now(),
): void {
  if (idx == null) return;
  writeInboxReturn({ inbox: idx, target: idx + 1, at: now, scrollY: Math.max(0, Math.round(scrollY || 0)) });
}

/** 알림함으로 다시 연 뒤 — 새 알림함 칸으로 옮겨 적는다(보던 자리는 그대로) */
export function moveInboxReturn(r: InboxReturn, inboxIdx: number, now = Date.now()): void {
  writeInboxReturn({ ...r, inbox: inboxIdx, target: inboxIdx + 1, at: now });
}

/**
 * 알림함으로 다시 열어야 하나 — 연 알림(또는 그 위)에서 뒤로 갔는데 알림함보다 더 아래 칸에 떨어졌다.
 * 크롬처럼 알림함 칸에 바로 떨어지면 false (앱은 아무것도 안 한다).
 */
export function shouldReturnToInbox(r: InboxReturn | null, prevIdx: number | null, nextIdx: number | null): boolean {
  if (!r || prevIdx == null || nextIdx == null) return false;
  return prevIdx >= r.target && nextIdx < r.inbox;
}

/** 이 화면의 기록 번호 — InboxReturnBridge 가 화면이 바뀔 때마다 적는다 (뒤로가기 순간엔 '바로 앞 화면') */
let lastIdx: number | null = null;
export const noteInboxLocation = (idx: number | null): void => {
  lastIdx = idx;
};
export const lastInboxLocation = (): number | null => lastIdx;

/**
 * 뒤로가기 순간 — 이 뒤로가기는 알림함으로 돌려보낼 것인가. 안드로이드 종료 확인(androidBackExit)이
 * 첫 화면에 떨어진 이 뒤로가기를 '앱 종료'로 묻지 않게 먼저 본다 (부수 효과 없음).
 */
export function inboxReturnClaims(state: unknown = typeof window !== "undefined" ? window.history.state : null): boolean {
  return shouldReturnToInbox(readInboxReturn(), lastIdx, historyIdx(state));
}

/**
 * 휴대폰 알림을 눌러 연 화면 — 아래에 알림함을 깔고 그 화면으로 (뒤로가기 = 알림함).
 * 이미 알림함이면 그 위에 바로 연다. 링크가 알림함 자체면 알림함만.
 */
export function openWithInboxBelow(navigate: (to: string) => void, url: string, here = window.location.pathname): void {
  if (url === INBOX_PATH || url.startsWith(`${INBOX_PATH}?`)) {
    navigate(url);
    return;
  }
  if (here !== INBOX_PATH) navigate(INBOX_PATH);
  rememberInboxOpen(historyIdx(), 0);
  navigate(url);
}

// ───────── 본 것 — 알림함으로 돌아와도 '아직 안 연 새 알림' 표시가 그대로 ─────────
// 알림함을 열면 서버는 바로 모두 읽음으로 바꾼다(NotificationsPage). 그래서 돌아올 때 화면이 새로 그려지면
// 새 알림 표시가 다 사라져, 여러 알림을 하나씩 볼 때 어디까지 봤는지 모른다 → 처음 연 때의 새 알림과
// 그중 연 것을 이 창에 30분 기억한다.

export type InboxSeen = { fresh: string[]; opened: string[]; at: number };

const ids = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 80))].slice(0, 200) : [];

export function readInboxSeen(uid: string | null | undefined, now = Date.now()): InboxSeen | null {
  const s = store();
  if (!s || !uid) return null;
  try {
    const raw = s.getItem(SEEN_KEY + uid);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<InboxSeen> | null;
    if (!v || !num(v.at) || now - v.at > INBOX_RETURN_TTL_MS || v.at - now > 60_000) {
      s.removeItem(SEEN_KEY + uid);
      return null;
    }
    return { fresh: ids(v.fresh), opened: ids(v.opened), at: v.at };
  } catch {
    return null;
  }
}

export function writeInboxSeen(uid: string | null | undefined, v: InboxSeen): void {
  if (!uid) return;
  try {
    store()?.setItem(SEEN_KEY + uid, JSON.stringify({ fresh: ids(v.fresh), opened: ids(v.opened), at: v.at }));
  } catch {
    /* 무시 */
  }
}

/**
 * 알림함을 열 때 '새 알림' 표시할 것 — 기억이 있으면(30분 안) 그때의 새 알림 + 그 뒤 새로 온 것 − 연 것,
 * 없으면 지금 안 읽은 것. 기억도 같이 돌려준다(쓸 것).
 */
export function inboxFresh(
  prev: InboxSeen | null,
  unreadNow: string[],
  now = Date.now(),
): { fresh: Set<string>; seen: InboxSeen } {
  const seen: InboxSeen = prev
    ? { fresh: ids([...prev.fresh, ...unreadNow]), opened: prev.opened, at: now }
    : { fresh: ids(unreadNow), opened: [], at: now };
  const opened = new Set(seen.opened);
  return { fresh: new Set(seen.fresh.filter((id) => !opened.has(id))), seen };
}

/** 알림 하나를 열었다 — 그 알림은 돌아와도 새 알림 표시 없음 */
export function markInboxOpened(prev: InboxSeen | null, id: string, now = Date.now()): InboxSeen {
  const base = prev ?? { fresh: [], opened: [], at: now };
  return { fresh: base.fresh, opened: ids([...base.opened, id]), at: now };
}
