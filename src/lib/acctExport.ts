/**
 * 153운영본부 「매출」 → 회계관리 엑셀 (2026-11-11 대표님 「마이복서 153 · 153가게부 · 일일 경영 리포트 모두 이렇게 정리해서
 * 엑셀로 다운받을수있는 기능 만들어줘」 — 대표님 「점프윙스 칠금점 회계관리」 표 모양, 양식은 src/lib/acctXlsx.ts)
 *
 *   달마다 시트 하나(그해 1월 ~ 고른 달) + '설정'.
 *   - 누적매출 = 「매출」 탭과 같은 숫자(ops-sales — 일반 수강권 · PT · 일일권 · 락카/운동복 · 용품 · 기타, 환불 뺀 금액)
 *   - 결제 수단(참고) = 같은 달 매출 줄의 결제 수단별 합
 *   - 기타수입 = 빈 줄(지원금 · 기타 — 엑셀에서 적는 칸)
 *   - 고정 · 유동 지출 = 순이익 카드와 같은 비용(ops_costs — 가계부 CSV · 통장 내역 정리 합계), 항목 키로 고정/유동을 나눔
 *   - 회원(신규 · 재등록) = registration-report(전체관리자만 — 다른 분은 빈칸) · 수강권 상품 이름의 기간(1개월 · 3개월 …)
 *   - 예비비 · 운영비 · 기부금 · 정산 = 엑셀 수식(비율은 '설정' 시트, 기본 5% · 25% · 1%)
 *   돈을 보는 분(대표님 · 회계매니저)만 — 서버(ops-sales · ops_costs)가 다시 막는다. 파일은 기기에서 만들고 서버로 안 간다.
 *   서버에서 모으기는 src/services/opsAcctService.ts, 여기는 순수 함수(시험 acctExport.test.ts).
 */
import {
  buildAcctWorkbook,
  memberLines,
  payMethodLabel,
  planBucket,
  safeFileName,
  XLSX_MIME,
  type AcctBlock,
  type AcctLine,
  type AcctMonth,
  type AcctTotals,
} from "@/lib/acctXlsx";
import { OTHER_GROUPS, SALES_GROUP_LABEL, SALES_SRC_LABEL, syncedText, type SalesReport } from "@/lib/opsSales";

/** 고정 지출로 보는 비용 항목 키(가계부 · 통장 내역 정리 키) — 나머지는 유동 */
export const FIXED_COST_KEYS = ["brent", "bpay", "bins", "butil", "bfee", "insure", "bclean", "phone", "loan", "house"];

export interface CostRow {
  month: string; // YYYY-MM
  k: string;
  label: string;
  amount: number;
}

export interface RegRow {
  day: string;
  branch: string;
  product: string | null;
  kind: string; // new · renew · daily · refund
}

export const ymOf = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
/** YYYY-MM → 그 달 마지막 날 YYYY-MM-DD */
export const lastDayOf = (yyyymm: string) => {
  const [y, m] = yyyymm.split("-").map(Number);
  return `${yyyymm}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
};

/** 한 달 회원 칸 — 신규 · 재등록, 수강권 기간별(일일권 · 환불 빼기). regs 가 null 이면 빈칸 */
export function memberBlocks(regs: RegRow[] | null, branch: string, month: string): AcctBlock[] {
  if (!regs) {
    const empty: AcctLine[] = [
      { label: "1개월", value: null },
      { label: "3개월", value: null },
    ];
    return [
      { title: "월 누적 신규등록회원", unit: "명", lines: empty },
      { title: "월 누적 재등록회원", unit: "명", lines: empty },
    ];
  }
  const count = (kind: "new" | "renew") => {
    const m = new Map<string, { label: string; order: number; n: number }>();
    for (const r of regs) {
      if (r.kind !== kind || r.branch !== branch || !r.day?.startsWith(month)) continue;
      const b = planBucket(r.product);
      if (b.key === "day") continue;
      const cur = m.get(b.key) ?? { label: b.label, order: b.order, n: 0 };
      cur.n += 1;
      m.set(b.key, cur);
    }
    return memberLines(m);
  };
  return [
    { title: "월 누적 신규등록회원", unit: "명", lines: count("new") },
    { title: "월 누적 재등록회원", unit: "명", lines: count("renew") },
  ];
}

/** 매출 탭 한 달 → 누적매출(묶음별) · 결제 수단(참고) */
export function salesBlocks(rep: SalesReport | null): { income: AcctBlock; info: AcctBlock[] } {
  const g = rep?.summary.groups;
  const lines: AcctLine[] = [
    { label: SALES_GROUP_LABEL.membership, value: g?.membership.amount ?? 0 },
    { label: SALES_GROUP_LABEL.pt, value: g?.pt.amount ?? 0 },
  ];
  if (g) for (const k of OTHER_GROUPS) if (g[k].amount !== 0 || g[k].count > 0) lines.push({ label: SALES_GROUP_LABEL[k], value: g[k].amount });
  const by = new Map<string, number>();
  for (const r of rep?.rows ?? []) {
    const k = payMethodLabel(r.method);
    by.set(k, (by.get(k) ?? 0) + r.amount);
  }
  const pays = [...by.entries()].filter(([, v]) => v !== 0).sort((a, b) => b[1] - a[1]);
  const info: AcctBlock[] = pays.length ? [{ title: rep?.truncated ? "결제 수단 (참고 · 앞 2,000건)" : "결제 수단 (참고)", lines: pays.map(([label, value]) => ({ label, value })) }] : [];
  return { income: { title: "누적매출", lines }, info };
}

/** 한 달 비용 → 고정 · 유동 (큰 것부터). metaTotal = 순이익 카드가 쓰는 그 달 합계(올린 적 없으면 null) */
export function costBlocks(rows: CostRow[], month: string, metaTotal: number | null): { fixed: AcctBlock; variable: AcctBlock; total: number } {
  const mine = rows.filter((r) => r.month === month && r.amount !== 0).sort((a, b) => b.amount - a.amount);
  const fixed = mine.filter((r) => FIXED_COST_KEYS.includes(r.k)).map((r) => ({ label: r.label, value: r.amount }));
  const variable = mine.filter((r) => !FIXED_COST_KEYS.includes(r.k)).map((r) => ({ label: r.label, value: r.amount }));
  const rowSum = mine.reduce((t, r) => t + r.amount, 0);
  // 합계는 순이익 카드와 같은 숫자 — 항목 합과 다르면 차이를 한 줄로
  if (metaTotal !== null && metaTotal !== rowSum) variable.push({ label: "그 밖(항목 없이 올린 금액)", value: metaTotal - rowSum });
  const hint: AcctLine[] = metaTotal === null ? [{ label: "비용 자료 없음", value: null }] : [];
  return {
    fixed: { title: "고정 지출 운영비", lines: fixed.length ? fixed : hint },
    variable: { title: "유동 지출", lines: variable },
    total: metaTotal ?? rowSum,
  };
}

export interface OpsAcctData {
  branch: string;
  /** 고른 달 YYYY-MM */
  month: string;
  /** 그해 1월 ~ 고른 달 매출(없는 달은 null) */
  sales: Record<string, SalesReport | null>;
  /** 비용 줄(지난해들 포함) · 비용을 올린 달과 그 달 합계 */
  costRows: CostRow[];
  costMonths: Array<{ month: string; total: number }>;
  /** 지난해 매출 흐름(달 → 금액) */
  prevSales: Record<string, number>;
  /** 회원 등록(전체관리자만 — 아니면 null) */
  regs: RegRow[] | null;
  /** 모자라게 읽은 것(시트 아래에 적음) */
  warnings?: string[];
  now?: Date;
}

/** 모은 자료 → 엑셀 바이트 (순수 함수 — 시험은 acctExport.test.ts) */
export function opsAcctWorkbook(d: OpsAcctData): { bytes: Uint8Array; filename: string } {
  const year = Number(d.month.slice(0, 4));
  const last = Number(d.month.slice(5, 7));
  const costTotal = new Map(d.costMonths.map((c) => [c.month, c.total]));
  const months: AcctMonth[] = [];
  const monthTotals: Record<number, AcctTotals> = {};
  const noCost: string[] = [];
  for (let m = 1; m <= last; m++) {
    const key = ymOf(year, m);
    const rep = d.sales[key] ?? null;
    const hasSales = !!rep && (rep.rows.length > 0 || rep.summary.total !== 0);
    const hasCosts = costTotal.has(key);
    if (!hasSales && !hasCosts && key !== d.month) continue;
    const s = salesBlocks(rep);
    const c = costBlocks(d.costRows, key, hasCosts ? costTotal.get(key)! : null);
    if (hasSales && !hasCosts) noCost.push(`${m}월`);
    months.push({
      ym: key,
      left: memberBlocks(d.regs, d.branch, key),
      income: s.income,
      otherIncome: {
        title: "기타수입",
        lines: [
          { label: "지원금", value: null },
          { label: "기타", value: null },
        ],
      },
      info: s.info,
      fixed: c.fixed,
      variable: c.variable,
    });
    monthTotals[m] = { income: rep?.summary.total ?? 0, expense: c.total };
  }
  // 지난해들 — 매출이 있는 해만
  const prevYears: Array<{ year: number } & AcctTotals> = [];
  for (const y of [year - 2, year - 1]) {
    const income = Object.entries(d.prevSales)
      .filter(([k]) => k.startsWith(`${y}-`))
      .reduce((t, [, v]) => t + v, 0);
    const expense = d.costMonths.filter((c) => c.month.startsWith(`${y}-`)).reduce((t, c) => t + c.total, 0);
    if (income !== 0 || expense !== 0) prevYears.push({ year: y, income, expense });
  }
  const rep = d.sales[d.month];
  const src = rep && rep.src !== "none" ? SALES_SRC_LABEL[rep.src] : "";
  const synced = syncedText(rep?.synced_at);
  const now = d.now ?? new Date();
  const stamp = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(now);
  const notes = [
    `매출: 153운영본부 「매출」 탭과 같은 숫자 — ${src ? `${src}${synced ? ` ${synced} 기준` : ""} + ` : ""}앱 결제 · 환불 뺀 금액`,
    `비용: 153운영본부에 올린 사업 비용(가계부 CSV · 통장 내역 정리)${noCost.length ? ` — 비용을 아직 안 올린 달: ${noCost.join(" · ")}` : ""}`,
    d.regs ? "회원: 수강권 등록 건수(신규 · 재등록 · 상품 기간별) — 일일권 · 환불 빼고" : "회원 수는 대표님 계정에서만 채워져요",
    ...(d.warnings ?? []),
    `만든 때: ${stamp}`,
  ];
  const shortName = d.branch.replace(/^153복싱짐\s*/, "");
  const bytes = buildAcctWorkbook(
    {
      profile: "business",
      title: `${d.branch} 회계관리`,
      year,
      months,
      activeYm: d.month,
      monthTotals,
      prevYears,
      notes,
    },
    now,
  );
  return { bytes, filename: safeFileName(`${shortName} 회계관리 ${year}년 ${last}월.xlsx`) };
}

export const isPhoneDevice = () =>
  typeof navigator !== "undefined" &&
  (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)));

/** 휴대폰은 공유(카카오톡 · 파일에 저장), 아니면 내려받기 — contractPdf.savePdf 와 같은 길 */
export async function saveXlsx(bytes: Uint8Array, filename: string): Promise<"shared" | "downloaded" | "canceled"> {
  const blob = new Blob([bytes as BlobPart], { type: XLSX_MIME });
  const file = new File([blob], filename, { type: XLSX_MIME });
  if (isPhoneDevice() && typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return "shared";
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return "canceled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "downloaded";
}
