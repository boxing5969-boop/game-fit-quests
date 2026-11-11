// ─────────────────────────────────────────────────────────────
// 이용약관 동의 다시 받기 (2026-11-11 대표님 「앱에서 동의 받기 (추천)」)
//
// 데스크(브로제이)에서 등록한 회원은 앱 가입 신청서(SignupApply)를 거치지 않아
// 환불 · 지급 장비(글러브 50,000원 · 붕대 10,000원) · 홀딩 규정에 동의한 기록이 앱에 없다
// (11/11 선릉역점 이용 중 회원 135명 중 3명만 기록). 동의 기록이 없거나 옛 판인 회원이
// 홈을 열면 한 번 묻고(TermsConsentPrompt), 동의하면 profiles.signup_agreements 에
// 판(GYM_POLICY_VERSION) · 문구 지문(sha256) · 어디서(source)를, signup_agreed_at 에 시각을 남긴다.
// 앱 사용은 막지 않는다 — '나중에'는 3일 뒤 다시.
// ─────────────────────────────────────────────────────────────

import { GYM_POLICIES, GYM_POLICY_VERSION, type GymPolicy } from "@/data/gymPolicies";

export type AgreementSource = "signup" | "signup_existing" | "app_prompt";

export interface StoredAgreements {
  version?: string;
  hash?: string | null;
  source?: AgreementSource;
  history?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

/** 이 지점 회원에게만 묻는다 — 규정 문구(정상가 220,000원 · 장비 금액 등)가 선릉역점 기준이라서. */
export const TERMS_CONSENT_BRANCH_WORDS = ["선릉"] as const;
/** 묻는 화면 — 홈 두 곳만(결제 · QR 출석 · 가입 화면 한가운데서 끼어들지 않게) */
export const TERMS_PROMPT_ROUTES = ["/home", "/myboxer"] as const;
export const TERMS_SNOOZE_DAYS = 3;
export const TERMS_SNOOZE_MS = TERMS_SNOOZE_DAYS * 24 * 60 * 60 * 1000;
/** history 에 남기는 옛 기록 수 */
export const TERMS_HISTORY_MAX = 5;

export const termsSnoozeKey = (uid: string) => `153_terms_snooze_v1:${uid}`;
export const termsSessionKey = (uid: string) => `153_terms_session_v1:${uid}`;

export function parseAgreements(raw: unknown): StoredAgreements | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as StoredAgreements;
}

/** 지금 판 규정의 필수 항목에 모두 동의했나 */
export function hasCurrentConsent(
  raw: unknown,
  policies: readonly GymPolicy[] = GYM_POLICIES,
  version: string = GYM_POLICY_VERSION,
): boolean {
  const a = parseAgreements(raw);
  if (!a || a.version !== version) return false;
  return policies.every((p) => !p.required || a[p.key] === true);
}

export interface TermsAudience {
  isApproved: boolean;
  /** 화면 역할 ('회원으로 보기' 중이면 member) */
  role: string | null;
  /** 진짜 역할 */
  realRole: string | null;
  /** profiles.is_staff — 코치님 · 운영진 */
  isStaff: boolean;
  branchName: string | null | undefined;
}

/** 동의 창을 보여 줄 계정인가 — 승인된 일반 회원 · 선릉역점 (운영진이 '회원으로 보기' 중이어도 아님) */
export function isTermsAudience(a: TermsAudience): boolean {
  if (!a.isApproved || a.isStaff) return false;
  if (a.role !== "member" || a.realRole !== "member") return false;
  const b = (a.branchName ?? "").trim();
  return TERMS_CONSENT_BRANCH_WORDS.some((w) => b.includes(w));
}

/** 지금 띄울 때인가 — 이번 접속에 이미 보였거나 '나중에' 기간 안이면 아니다 */
export function termsPromptDue(o: { snoozedUntil: number | null; shownThisSession: boolean; now: number }): boolean {
  if (o.shownThisSession) return false;
  if (o.snoozedUntil != null && Number.isFinite(o.snoozedUntil) && o.now < o.snoozedUntil) return false;
  return true;
}

/** 지문을 뜨는 글 — 판 번호를 안 올리고 문구만 바뀌어도 어떤 글에 동의했는지 가려낼 수 있게 */
export function policyText(policies: readonly GymPolicy[] = GYM_POLICIES): string {
  return JSON.stringify(policies.map((p) => [p.key, p.title, p.body, p.required]));
}

/** 규정 문구 sha256(16진 64자). 브라우저가 못 하면 null — 판 번호는 그대로 남는다 */
export async function policyFingerprint(policies: readonly GymPolicy[] = GYM_POLICIES): Promise<string | null> {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return null;
    const buf = await subtle.digest("SHA-256", new TextEncoder().encode(policyText(policies)));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

/** 저장할 동의 기록 — 예전 기록(옛 판)은 지우지 않고 그때 시각과 함께 history 로 옮긴다 */
export function buildAgreementRecord(o: {
  agree: Record<string, boolean>;
  hash: string | null;
  source: AgreementSource;
  previous?: unknown;
  previousAt?: string | null;
  version?: string;
}): StoredAgreements {
  const prev = parseAgreements(o.previous);
  const history: Array<Record<string, unknown>> = Array.isArray(prev?.history) ? [...(prev?.history ?? [])] : [];
  if (prev) {
    const rest: Record<string, unknown> = { ...prev };
    delete rest.history;
    history.push({ ...rest, agreed_at: o.previousAt ?? null });
  }
  const rec: StoredAgreements = {
    ...o.agree,
    version: o.version ?? GYM_POLICY_VERSION,
    hash: o.hash,
    source: o.source,
  };
  if (history.length) rec.history = history.slice(-TERMS_HISTORY_MAX);
  return rec;
}
