/**
 * 💳 지점별 수강권 결제 방법 (2026-10-21 대표님: "칠금점 수강권은 따로 결제선생을 통해서 구축해야 돼.
 *   그래서 일단 계좌이체와 오프라인 결제만 가능하게 하자")
 *
 *   · 선릉역점 — 앱에서 결제선생으로 결제 (payssam-create-bill). 결제가 끝나면 가입이 자동 승인된다.
 *   · 칠금점 — 결제선생이 아직 없다 → 앱 결제를 막고 '계좌이체 · 현장 결제(데스크)'만 안내한다.
 *     가입 신청은 받되 승인 대기로 남고, 데스크가 입금·결제를 확인하면 승인 · 수강권을 등록한다.
 *     계좌 정보는 운영 DB app_settings 'offline_payment' 한 줄 — 비어 있으면 '데스크에서 안내'로 보인다
 *     (계좌를 바꿔도 앱을 다시 올릴 필요가 없다).
 *
 *   지점 이름은 profiles.branch_name 과 정확히 같아야 한다.
 */

/** 앱 결제(결제선생)를 아직 쓰지 않는 지점 — 계좌이체 · 현장 결제만 */
export const OFFLINE_PAY_BRANCHES: readonly string[] = ["153복싱짐 칠금점"];

/** 수강권을 앱 결제 대신 계좌이체 · 현장 결제로만 받는 지점인가 */
export const isOfflinePayBranch = (branch: string | null | undefined): boolean =>
  !!branch && OFFLINE_PAY_BRANCHES.includes(branch);

/** 앱 '가입 신청'에서 고를 수 있는 지점 — 앱에서 바로 결제하는 곳 + 데스크 결제 지점 */
export const SIGNUP_BRANCHES: readonly { name: string; label: string }[] = [
  { name: "153복싱짐 선릉역점", label: "선릉역점" },
  { name: "153복싱짐 칠금점", label: "칠금점" },
];

/** '153복싱짐 칠금점' → '칠금점' */
export const branchShortName = (branch: string | null | undefined): string =>
  (branch || "").replace(/^153복싱짐\s*/, "").trim() || "지점";

/** app_settings 'offline_payment' 키 */
export const OFFLINE_PAY_SETTING_KEY = "offline_payment";

export interface OfflinePayInfo {
  bank: string;
  account: string;
  holder: string;
}

/**
 * app_settings 'offline_payment' 값에서 이 지점 계좌를 꺼낸다.
 * 모양: { "153복싱짐 칠금점": { "bank": "…", "account": "…", "holder": "…" } } — 셋 중 하나라도 비면 null(데스크 안내).
 */
export function offlinePayInfoFor(value: unknown, branch: string | null | undefined): OfflinePayInfo | null {
  if (!branch || !value || typeof value !== "object") return null;
  const row = (value as Record<string, unknown>)[branch];
  if (!row || typeof row !== "object") return null;
  const pick = (k: string) => {
    const v = (row as Record<string, unknown>)[k];
    return typeof v === "string" ? v.trim() : "";
  };
  const info = { bank: pick("bank"), account: pick("account"), holder: pick("holder") };
  return info.bank && info.account && info.holder ? info : null;
}
