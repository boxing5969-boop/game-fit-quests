// 휴대폰 인증 통과 표 (2026-11-24 보안 점검 ③ — 생년월일이 없는 회원 계정 넘겨받기)
//
// 생년월일이 비어 있는 계정은 이름 · 번호만으로는 본인인지 알 수 없다. 그래서 그 번호로 6자리 인증번호를 보내고
// (claim-member-account action sms_send → 153OS 문자), 맞게 넣으면(sms_verify) 15분짜리 이 표를 준다.
// 앱은 이 표를 check · claim 에 함께 보내고, 서버는 표의 번호(p) · 계정(u)이 지금 찾은 계정과 같을 때만 넘어간다.
//
// 표 = base64url(JSON {p 번호, u 계정, e 만료 ms}) + "." + HMAC-SHA256.
// 이어받기 표(linkTicket.ts)와 열쇠를 다르게 만든다("153smsproof:") — 한쪽 표를 다른 쪽에 쓸 수 없다.

export const SMS_PROOF_TTL_MS = 15 * 60_000;

export interface SmsProof {
  p: string; // 인증번호를 받은 번호(숫자만)
  u: string; // 그 번호의 아직 넘겨받지 않은 계정 user_id
  e: number; // 만료 시각(ms)
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
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

async function keyOf(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    enc.encode("153smsproof:" + secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signSmsProof(secret: string, phone: string, userId: string, now = Date.now()): Promise<string> {
  const payload: SmsProof = { p: phone, u: userId, e: now + SMS_PROOF_TTL_MS };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await keyOf(secret), enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

/** 서명 · 만료 · 모양이 모두 맞을 때만 내용을 돌려준다. 아니면 null. */
export async function verifySmsProof(secret: string, proof: unknown, now = Date.now()): Promise<SmsProof | null> {
  if (typeof proof !== "string" || proof.length > 600) return null;
  const parts = proof.split(".");
  if (parts.length !== 2) return null;
  const sig = fromB64url(parts[1]);
  const raw = fromB64url(parts[0]);
  if (!sig || !raw) return null;
  if (!(await crypto.subtle.verify("HMAC", await keyOf(secret), sig as BufferSource, enc.encode(parts[0])))) return null;
  try {
    const v = JSON.parse(new TextDecoder().decode(raw)) as Partial<SmsProof>;
    if (typeof v.p !== "string" || !/^0\d{9,10}$/.test(v.p)) return null;
    if (typeof v.u !== "string" || !/^[0-9a-f-]{36}$/i.test(v.u)) return null;
    if (typeof v.e !== "number" || !Number.isFinite(v.e) || v.e < now) return null;
    return { p: v.p, u: v.u, e: v.e };
  } catch {
    return null;
  }
}
