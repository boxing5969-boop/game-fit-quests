// 첫 사용 순서 (2026-11-22 대표님 「153복싱짐 기존 가입된 회원인지 먼저 묻고 정보를 먼저 받을 수 있는 순서로」)
//
// · 이 기기에서 한 번이라도 로그인했으면 첫 질문 없이 로그인 화면부터(markLoggedIn — 앱을 쓰던 회원은 한 번 덜 누르게).
// · 「다니고 있어요」에서 기록을 찾으면 서버가 준 10분짜리 이어받기 표(supabase/functions/_shared/linkTicket.ts)를
//   이 기기에 잠깐 두었다가, 카카오 · 구글 로그인에서 돌아오면 LinkAccountPrompt 가 그 표로 바로 합친다.
//   아이폰 앱의 로그인 창 · 웹 리디렉트 모두 같은 저장소(localStorage)를 보므로 sessionStorage 대신 localStorage.

const EVER_KEY = "153entry:loggedIn";
const TICKET_KEY = "153entry:linkTicket";
const TICKET_TTL_MS = 10 * 60_000;

function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function markLoggedIn(): void {
  try {
    store()?.setItem(EVER_KEY, "1");
  } catch {
    /* 저장이 막힌 기기 — 다음에도 첫 질문이 보일 뿐 */
  }
}

export function hasLoggedInBefore(): boolean {
  try {
    return store()?.getItem(EVER_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveLinkTicket(ticket: string, now = Date.now()): void {
  try {
    store()?.setItem(TICKET_KEY, JSON.stringify({ t: ticket, e: now + TICKET_TTL_MS }));
  } catch {
    /* 저장 실패 — 카카오에서 돌아오면 번호 입력 창이 대신 뜬다 */
  }
}

/** 아직 살아 있는 표만 돌려준다(지난 표는 지운다). */
export function peekLinkTicket(now = Date.now()): string | null {
  const s = store();
  if (!s) return null;
  try {
    const raw = s.getItem(TICKET_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { t?: unknown; e?: unknown };
    if (typeof v.t === "string" && typeof v.e === "number" && v.e > now) return v.t;
    s.removeItem(TICKET_KEY);
    return null;
  } catch {
    try {
      s.removeItem(TICKET_KEY);
    } catch {
      /* 무시 */
    }
    return null;
  }
}

export function clearLinkTicket(): void {
  try {
    store()?.removeItem(TICKET_KEY);
  } catch {
    /* 무시 */
  }
}

/** 첫 질문 다음 「다니고 있어요」 찾기 결과 — claim-member-account check 의 status 그대로 */
export type LookupStatus = "existing" | "new" | "registered" | "mismatch" | "desk" | "locked" | "invalid" | "error";

export function lookupStatusOf(v: unknown): LookupStatus {
  const s = (v as { status?: unknown } | null)?.status;
  return s === "existing" || s === "new" || s === "registered" || s === "mismatch" || s === "desk" || s === "locked" || s === "invalid"
    ? s
    : "error";
}

// ── 기록 확인 대기 (2026-11-22) ──
// 명단에서 못 찾은 회원이 데스크에 확인을 부탁하면(member-lookup-request create) 받은 열쇠를 이 기기에 둔다.
// 다시 앱을 열면 첫 화면이 「확인 대기」 카드부터 보여 주고, 열쇠로 상태를 묻는다. 30일 지나면 잊는다.
const REQ_KEY = "153entry:lookupReq";
const REQ_TTL_MS = 30 * 86_400_000;

export interface LookupRequest {
  key: string;
  name: string;
  branch: string;
  at: number;
}

export function saveLookupRequest(r: Omit<LookupRequest, "at">, now = Date.now()): void {
  try {
    store()?.setItem(REQ_KEY, JSON.stringify({ ...r, at: now }));
  } catch {
    /* 저장이 막힌 기기 — 이번 화면에서만 기다린다 */
  }
}

export function peekLookupRequest(now = Date.now()): LookupRequest | null {
  const s = store();
  if (!s) return null;
  try {
    const raw = s.getItem(REQ_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<LookupRequest>;
    if (typeof v.key === "string" && typeof v.at === "number" && now - v.at < REQ_TTL_MS) {
      return { key: v.key, name: String(v.name ?? ""), branch: String(v.branch ?? ""), at: v.at };
    }
    s.removeItem(REQ_KEY);
    return null;
  } catch {
    try {
      s.removeItem(REQ_KEY);
    } catch {
      /* 무시 */
    }
    return null;
  }
}

export function clearLookupRequest(): void {
  try {
    store()?.removeItem(REQ_KEY);
  } catch {
    /* 무시 */
  }
}

/** member-lookup-request status 의 status — 모르는 값은 error */
export type RequestStatus = "pending" | "found" | "not_member" | "closed" | "expired" | "done" | "gone" | "error";

export function requestStatusOf(v: unknown): RequestStatus {
  const s = (v as { status?: unknown } | null)?.status;
  return s === "pending" || s === "found" || s === "not_member" || s === "closed" || s === "expired" || s === "done" || s === "gone"
    ? s
    : "error";
}
