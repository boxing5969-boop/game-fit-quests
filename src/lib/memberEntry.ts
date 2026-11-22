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
