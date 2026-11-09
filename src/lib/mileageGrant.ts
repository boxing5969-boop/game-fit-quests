/**
 * 🪙 회원에게 153 마일리지 지급 — 회원 상세 「153 마일리지」 칸의 '마일리지 지급' 줄 (2026-11-09 대표님
 *   「챔피언 머니처럼 회원님들 마일리지 드리는거 내 계정으로 할수있게 만들자」)
 *
 *   서버가 정본이다: DB admin_grant_mileage(supabase/migrations/20261109213315_admin_grant_mileage.sql)가
 *   전체관리자만 · 1 ~ 100,000점 · 사유 60자 · 같은 요청 id 는 한 번만 — 을 다시 검사한다.
 *   여기 값은 화면에서 먼저 막는 용도라 서버와 똑같이 맞춘다.
 */

/** 한 번에 줄 수 있는 최대 점수 — 서버 admin_grant_mileage 와 같은 값 */
export const MILEAGE_GRANT_MAX = 100_000;
/** 사유 최대 글자 수 — 서버와 같은 값 */
export const MILEAGE_GRANT_REASON_MAX = 60;
/** 사유를 비우면 회원 마일리지 내역에 이렇게 보인다 — 서버 기본값과 같은 글 */
export const MILEAGE_GRANT_DEFAULT_REASON = "153 보너스 마일리지";

const fmt = (n: number): string => n.toLocaleString("ko-KR");

/** 입력칸 글자 → 점수 (숫자만 읽는다 · 9자리까지) */
export const parseGrantAmount = (raw: string): number => {
  const digits = (raw || "").replace(/\D/g, "").slice(0, 9);
  return digits ? Number(digits) : 0;
};

/** 입력칸에 보여 줄 글 — 쓰는 동안 쉼표를 넣어 0 하나 더 붙는 실수를 막는다 */
export const formatGrantInput = (raw: string): string => {
  const n = parseGrantAmount(raw);
  return n > 0 ? fmt(n) : "";
};

/** 줄 수 없는 점수면 이유, 괜찮으면 null */
export const grantAmountError = (amount: number): string | null => {
  if (!Number.isFinite(amount) || amount <= 0) return "줄 점수를 입력해 주세요";
  if (amount > MILEAGE_GRANT_MAX) return `한 번에 ${fmt(MILEAGE_GRANT_MAX)}점까지 줄 수 있어요`;
  return null;
};

/** 회원 내역에 남을 사유 — 비우면 기본 글 */
export const grantReason = (raw: string): string => (raw || "").trim() || MILEAGE_GRANT_DEFAULT_REASON;

/** 지급 전 확인 창 글 — 누구에게 · 몇 점 · 무엇으로 · 알림 여부 */
export const grantConfirmText = (name: string, amount: number, reason: string, notify: boolean): string =>
  [
    `${(name || "").trim() || "회원"}님께 마일리지 ${fmt(amount)}점을 드릴까요?`,
    `사유: ${grantReason(reason)}`,
    notify ? "회원에게 알림이 함께 가요." : "알림은 보내지 않아요.",
  ].join("\n");

/** 지급 한 번마다 새 요청 id — 같은 지급이 두 번 들어가지 않게(서버 idem_key). crypto.randomUUID 가 없는 옛 브라우저도 */
export const newGrantRequestId = (): string => {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
