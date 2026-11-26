// os-crm 계산만(화면 · 서버 호출 없음) — 시험 src/lib/crm153.test.ts
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 찾을 말 — 앞뒤 빈칸을 지우고 30자까지. 숫자 · 빼기 · 빈칸만이면 숫자만(010-1234 → 0101234, 한 글자 숫자는 버린다) */
export function cleanQuery(raw: unknown): string | null {
  const s = String(raw ?? "").trim().slice(0, 30);
  if (!s) return null;
  if (/^[\d\s-]+$/.test(s)) {
    const d = s.replace(/\D/g, "");
    return d.length >= 2 ? d : null;
  }
  return s;
}

/** 토큰의 sub(사용자 id) — 게이트(verify_jwt)와 crm_scope 가 이미 확인한 토큰에서 읽기만 한다 */
export function tokenSub(token: string): string | null {
  try {
    const part = token.split(".")[1] ?? "";
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    const sub = JSON.parse(atob(b64))?.sub;
    return typeof sub === "string" && UUID.test(sub) ? sub : null;
  } catch {
    return null;
  }
}

/** 전화 — 뒷 4자리만 남긴다(카드를 전화 전체 없이 보여 줄 때) */
export function last4(p: unknown): string | null {
  const d = String(p ?? "").replace(/\D/g, "");
  return d ? d.slice(-4) : null;
}
