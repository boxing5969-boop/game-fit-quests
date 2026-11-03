/**
 * 153운영본부 「매출」 탭 — 화면 쪽 모양 · 글 (2026-11-03 대표님 "매출 자세히 · 일반 수강권 매출과 PT 매출을 분리해서")
 *   나누기 · 합치기 규칙은 Edge Function supabase/functions/ops-sales/logic.ts 한 곳(테스트 src/lib/opsSales.test.ts).
 *   여기는 그 결과의 타입 · 이름 · 숫자 글만.
 */

export type SalesGroup = "membership" | "pt" | "daily" | "rental" | "goods" | "etc";
export type SalesSrc = "broj" | "dagym" | "app";

export interface SalesRow {
  id: string;
  day: string;
  at: string | null;
  member: string;
  product: string;
  amount: number;
  method: string;
  src: SalesSrc;
  group: SalesGroup;
  refund: boolean;
}

export interface GroupSum {
  amount: number;
  count: number;
  refund: number;
  refunds: number;
}

export interface SalesReport {
  branch: string;
  month: string; // YYYY-MM
  src: "broj" | "dagym" | "none";
  synced_at: string | null;
  app_added: number;
  summary: { total: number; count: number; refund: number; refunds: number; groups: Record<SalesGroup, GroupSum> };
  trend: Array<{ month: string; membership: number; pt: number; other: number; total: number }>;
  rows: SalesRow[];
  truncated: boolean;
}

export const SALES_GROUP_LABEL: Record<SalesGroup, string> = {
  membership: "일반 수강권",
  pt: "PT",
  daily: "일일권",
  rental: "락카 · 운동복",
  goods: "용품",
  etc: "기타",
};

/** 큰 칸(일반 수강권 · PT) 밖의 묶음 */
export const OTHER_GROUPS: SalesGroup[] = ["daily", "rental", "goods", "etc"];

export type SalesFilter = "all" | "membership" | "pt" | "other" | "refund";

export const matchFilter = (r: SalesRow, f: SalesFilter) =>
  f === "all" ? true : f === "refund" ? r.refund : f === "other" ? OTHER_GROUPS.includes(r.group) : r.group === f;

/** 1,980만 원 · 52.5만 원 · 9,000원 (음수는 앞에 -) */
export const fmtMan = (n: number): string => {
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(Math.round(n));
  if (a < 10_000) return `${sign}${a.toLocaleString("ko-KR")}원`;
  const man = a / 10_000;
  const v = man >= 100 ? Math.round(man).toLocaleString("ko-KR") : (Math.round(man * 10) / 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
  return `${sign}${v}만 원`;
};

/** fmtMan 을 숫자 · 단위로 나눔 — 큰 숫자 칸에서 단위만 작게 ("2,011" + "만 원") */
export const fmtManParts = (n: number): { num: string; unit: string } => {
  const s = fmtMan(n);
  const m = s.match(/^(-?[\d,.]+)(.*)$/);
  return m ? { num: m[1], unit: m[2] } : { num: s, unit: "" };
};

/** 몫(%) — 합계가 0 이하이면 0 */
export const sharePct = (part: number, total: number) => (total > 0 ? Math.round((Math.max(0, part) / total) * 100) : 0);

export const SALES_SRC_LABEL: Record<SalesReport["src"], string> = { broj: "브로제이", dagym: "다짐", none: "" };

/** "2026-11-02T15:05:48Z" → "11월 3일 00:05" (한국 시각) */
export const syncedText = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const d = new Date(t + 9 * 3600_000);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};

export const SALES_ERROR: Record<string, string> = {
  NOT_AUTHENTICATED: "다시 로그인해 주세요",
  FORBIDDEN: "매출은 대표님 · 회계매니저만 볼 수 있어요",
  INVALID_REQUEST: "지점 · 달을 다시 골라 주세요",
  OS_NOT_CONFIGURED: "153OS 연결 설정이 없어요",
  DAGYM_NOT_READY: "다짐(칠금점) 매출 연결을 준비하고 있어요",
  READ_FAILED: "매출 자료를 읽지 못했어요 — 잠시 후 다시 시도해 주세요",
};

/** 한 달의 매출이 0이 아닌 묶음만 (그 밖 한 줄) */
export const otherParts = (groups: Record<SalesGroup, GroupSum>) =>
  OTHER_GROUPS.filter((g) => groups[g].amount !== 0 || groups[g].count > 0).map((g) => ({ g, label: SALES_GROUP_LABEL[g], ...groups[g] }));
