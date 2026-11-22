// 기록 확인 대기 — 순수 함수(검사 · 상태 판단). index.ts 와 시험(src/lib/memberLookupRequest.test.ts)이 같이 쓴다.

export const FOUND_VALID_DAYS = 7;
export const IP_DAILY_LIMIT = 5;
export const PHONE_DAILY_LIMIT = 3;

export interface CreateInput {
  name: string;
  phone: string;
  birth: string | null; // YYYYMMDD 또는 null
  branch: string;
  memo: string | null;
}

const onlyDigits = (s: unknown) => String(s ?? "").replace(/[^0-9]/g, "");

/** 받은 값을 다듬고 검사한다. 틀리면 회원에게 보일 한국어 말을 돌려준다. */
export function parseCreate(body: unknown): { ok: true; v: CreateInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = String(b.name ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
  const phone = onlyDigits(b.phone);
  const birthRaw = onlyDigits(b.birthDate);
  const branch = String(b.branch ?? "").trim();
  const memo = String(b.memo ?? "").replace(/\s+/g, " ").trim();
  if (!name || [...name].length > 40) return { ok: false, error: "이름(실명)을 넣어 주세요." };
  if (!/^0\d{9,10}$/.test(phone)) return { ok: false, error: "전화번호를 정확히 넣어 주세요." };
  let birth: string | null = null;
  if (birthRaw) {
    if (!isValidBirth(birthRaw)) return { ok: false, error: "생년월일 8자리를 정확히 넣어 주세요. (예: 19990315)" };
    birth = birthRaw;
  }
  if (!branch || branch.length > 60) return { ok: false, error: "다니는 지점을 골라 주세요." };
  if ([...memo].length > 200) return { ok: false, error: "남길 말은 200자까지예요." };
  return { ok: true, v: { name, phone, birth, branch, memo: memo || null } };
}

export function isValidBirth(d: string): boolean {
  if (!/^(19|20)\d{6}$/.test(d)) return false;
  const y = +d.slice(0, 4), m = +d.slice(4, 6), day = +d.slice(6, 8);
  const dt = new Date(Date.UTC(y, m - 1, day));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === day;
}

export const birthToDate = (d: string | null) => (d ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : null);

/** 회원 기기에 돌려줄 상태 — 서버 줄 상태 + 연결할 계정이 아직 이어받을 수 있는지 */
export type MemberView = "pending" | "found" | "not_member" | "closed" | "expired" | "done";

export function memberViewOf(
  status: string,
  resolvedAtMs: number | null,
  targetUsable: boolean | null,
  now = Date.now(),
): MemberView {
  if (status === "pending") return "pending";
  if (status === "not_member") return "not_member";
  if (status === "found") {
    if (targetUsable === false) return "done";
    if (resolvedAtMs !== null && now - resolvedAtMs > FOUND_VALID_DAYS * 86_400_000) return "expired";
    return "found";
  }
  return "closed";
}
