// 수강권 시작일 고르기 (2026-11-20 대표님: "회원님들이 수강권 결제할때 시작일을 지정할수있게하자.
//   미리등록하려는분들도있고 신규인데 다음주부터 하고싶은 사람도 있으니까") — 결제 링크를 만들 때 고른 날을 검사한다.
//   화면 src/lib/cartPricing.ts(continueFrom · startBounds · requestedStart) · DB _pass_period 와 같은 식 — 바꾸면 세 곳을 같이.
//   · 기본 시작일 = 이어서 — 지금 수강권이 오늘까지라도 남아 있으면 끝난 다음 날, 없거나 끝났으면 오늘 (한국 날짜).
//   · 고를 수 있는 날 = 기본 시작일부터 30일 안.
//   · 기본 시작일을 고르면 저장하지 않는다(null) — 결제가 끝날 때 DB apply_payment_order 가 그때의 남은 기간으로 다시 센다.
//   시험: src/lib/passStartServer.test.ts (화면 식과 같은지)

export const START_AHEAD_DAYS = 30;

const DAY = 86400000;
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);
const utc = (s: string) => Date.parse(`${s}T00:00:00Z`);

/** 한국 날짜 'YYYY-MM-DD' */
export const kstToday = (now: number = Date.now()): string => ymd(now + 9 * 3600 * 1000);

/** 진짜 날짜면 앞 10글자, 아니면 null (2026-02-30 도 null) */
export const validYmd = (s: unknown): string | null => {
  const d = typeof s === "string" ? s.slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const t = utc(d);
  return Number.isFinite(t) && ymd(t) === d ? d : null;
};

export const addDays = (d: string, n: number): string => ymd(utc(d) + n * DAY);

/** 기본 시작일 — 지금 것이 오늘까지라도 남아 있으면 끝난 다음 날, 없거나 끝났으면 오늘 */
export function continueFrom(currentEnd: unknown, today: string): string {
  const cur = validYmd(currentEnd);
  return cur && cur >= today ? addDays(cur, 1) : today;
}

export function startWindow(currentEnd: unknown, today: string): { min: string; max: string } {
  const min = continueFrom(currentEnd, today);
  return { min, max: addDays(min, START_AHEAD_DAYS) };
}

const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;

export type StartCheck = { ok: true; start: string | null } | { ok: false; error: string };

/**
 * 받은 시작일 검사 — 없으면 기본(null) · 범위 안이면 그날(기본 시작일이면 null) · 아니면 회원에게 보여 줄 말.
 *   hasMembership = 이 장바구니에 수강권이 있나 (운동복 · 락카만이면 시작일을 받지 않는다)
 */
export function checkStart(input: unknown, currentEnd: unknown, today: string, hasMembership: boolean): StartCheck {
  if (input == null || input === "") return { ok: true, start: null };
  if (!hasMembership) return { ok: false, error: "시작일은 수강권을 살 때만 고를 수 있어요." };
  const s = validYmd(input);
  if (!s) return { ok: false, error: "시작일을 다시 골라 주세요." };
  const w = startWindow(currentEnd, today);
  if (s < w.min || s > w.max) return { ok: false, error: `시작일은 ${md(w.min)}부터 ${md(w.max)}까지 고를 수 있어요.` };
  return { ok: true, start: s > w.min ? s : null };
}
