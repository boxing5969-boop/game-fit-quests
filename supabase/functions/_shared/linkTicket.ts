// 기존 회원 이어받기 표 (2026-11-22 「153복싱짐에 다니고 계세요?」 첫 화면)
//
// claim-member-account 가 '기존 회원 확인(existing)'을 낸 순간 10분짜리 표를 만들고,
// 회원이 카카오 · 구글로 로그인해 돌아오면 link-imported-by-phone 이 이 표로 바로 합친다
// — 번호를 두 번 묻지 않고, 「회원 등록 확인」 창을 건너뛸 길도 없다.
//
// 표 = base64url(JSON {p 번호, u 찾은 계정, e 만료 ms, c? 쓸 수 있는 로그인 계정}) + "." + HMAC-SHA256(서버 비밀값).
// 서버에 저장하지 않는다. 한 번 합치면 찾은 계정(u)이 사라져 같은 표로 다시 합칠 수 없다.
// 회원 정보(이름 · 레벨)는 담지 않는다 — 번호와 계정 번호뿐이고, 서명이 맞아야만 쓴다.
//
// 2026-11-23 보안 점검: link-imported-by-phone 은 이제 이 표가 있어야만 합친다(번호만으로는 합치지 않는다).
//   c 칸 — 이미 로그인한 사람이 「기록 찾기」를 하면 그 사람 계정 id 를 표에 넣어, 다른 계정은 그 표를 못 쓰게 한다.
//   로그인 전(첫 화면)에 받은 표는 c 가 없다 — 그 표는 앱이 「카카오로 이어받기」를 누를 때만 기기에 두고,
//   합치기 전에 한 번 더 묻는다(공용 기기에서 다음 사람 계정에 합쳐지지 않게).

export const LINK_TICKET_TTL_MS = 10 * 60_000;

export interface LinkTicket {
  p: string; // 체육관에 등록된 전화번호(숫자만)
  u: string; // 찾은 계정(아직 넘겨받지 않은 계정) user_id
  e: number; // 만료 시각(ms)
  c?: string; // 이 표를 쓸 수 있는 로그인 계정 user_id (로그인한 상태에서 받은 표만)
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]{1,400}$/.test(s)) return null;
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
    const bin = atob(b64);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

async function keyOf(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    enc.encode("153ticket:" + secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signLinkTicket(
  secret: string,
  phone: string,
  userId: string,
  now = Date.now(),
  callerId: string | null = null,
): Promise<string> {
  const payload: LinkTicket = { p: phone, u: userId, e: now + LINK_TICKET_TTL_MS };
  if (callerId) payload.c = callerId;
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await keyOf(secret), enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

/** 서명 · 만료 · 모양이 모두 맞을 때만 내용을 돌려준다. 아니면 null. */
export async function verifyLinkTicket(secret: string, ticket: unknown, now = Date.now()): Promise<LinkTicket | null> {
  if (typeof ticket !== "string" || ticket.length > 600) return null;
  const parts = ticket.split(".");
  if (parts.length !== 2) return null;
  const sig = fromB64url(parts[1]);
  const raw = fromB64url(parts[0]);
  if (!sig || !raw) return null;
  const ok = await crypto.subtle.verify("HMAC", await keyOf(secret), sig, enc.encode(parts[0]));
  if (!ok) return null;
  try {
    const v = JSON.parse(new TextDecoder().decode(raw)) as Partial<LinkTicket>;
    if (typeof v.p !== "string" || !/^0\d{9,10}$/.test(v.p)) return null;
    if (typeof v.u !== "string" || !/^[0-9a-f-]{36}$/i.test(v.u)) return null;
    if (typeof v.e !== "number" || !Number.isFinite(v.e) || v.e < now) return null;
    if (v.c !== undefined && (typeof v.c !== "string" || !/^[0-9a-f-]{36}$/i.test(v.c))) return null;
    return v.c ? { p: v.p, u: v.u, e: v.e, c: v.c } : { p: v.p, u: v.u, e: v.e };
  } catch {
    return null;
  }
}
