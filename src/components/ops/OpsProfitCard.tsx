/**
 * 153운영본부 「매출」 · 순이익 카드 (2026-11-04 대표님 "153가계부랑 연동해서 … 순이익도 계산하자" → 「매출 − 사업 비용」)
 *   순이익 = 이 달 매출(ops-sales) − 이 달 사업 비용(153가계부 CSV 에서 올린 합계, ops_costs).
 *   비용을 아직 안 올린 달은 '가계부 CSV 올리기'만.
 */
import { FileUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { fmtMan } from "@/lib/opsSales";
import { profitOf, topCats, type SavedCosts } from "@/lib/opsCosts";

const card = "rounded-2xl border border-border bg-card p-5";

const savedText = (iso: string) => {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const d = new Date(t + 9 * 3600_000);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
};

const OpsProfitCard = ({
  month,
  monthNum,
  sales,
  costs,
  onImport,
}: {
  /** YYYY-MM */
  month: string;
  monthNum: number;
  /** 이 달 매출(환불 뺀 금액) */
  sales: number;
  costs: SavedCosts | undefined;
  onImport: () => void;
}) => {
  const meta = costs?.months.find((m) => m.month === month);

  if (!meta) {
    return (
      <section className={card}>
        <h2 className="text-heading font-black text-foreground">{monthNum}월 순이익</h2>
        <p className="mt-1 text-body text-foreground">153가계부 사업 장부를 올리면 이 달 사업 비용을 빼서 순이익을 계산해요.</p>
        <button
          type="button"
          onClick={onImport}
          className="mt-4 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-foreground text-body font-black text-background active:scale-[0.99]"
        >
          <FileUp className="h-5 w-5" />
          가계부 CSV 올리기
        </button>
        <p className="mt-2 text-label text-muted-foreground">가계부 › 설정 › 엑셀용 CSV · 달 · 항목별 합계만 저장해요</p>
      </section>
    );
  }

  const cats = (costs?.rows ?? []).filter((r) => r.month === month && r.amount !== 0);
  const cost = meta.total;
  const { profit, pct } = profitOf(sales, cost);
  const { top, rest } = topCats(cats, 6);
  const max = Math.max(1, ...top.map((c) => c.amount));
  const short = (s: string) => s.replace(/^153\s*복싱짐\s*/, "");
  const stores = [...meta.stores.map(short), ...(meta.no_store ? ["매장 없음"] : [])];
  const skippedLoan = meta.excluded.includes("loan");

  return (
    <section className={card}>
      <p className="text-label font-bold text-muted-foreground">{monthNum}월 순이익 · 매출 − 사업 비용</p>
      <p className={cn("mt-1 whitespace-nowrap text-title font-black tabular-nums leading-none", profit < 0 ? "text-destructive" : "text-foreground")}>
        {profit < 0 ? "-" : ""}
        {Math.abs(Math.round(profit)).toLocaleString("ko-KR")}
        <span className="ml-0.5 text-body">원</span>
      </p>
      <p className="mt-2 text-label tabular-nums text-muted-foreground">
        매출 {fmtMan(sales)} − 비용 {fmtMan(cost)}
        {pct !== null ? ` · 매출의 ${pct}%` : ""}
      </p>

      {top.length > 0 && (
        <ul className="mt-4 space-y-2.5">
          {top.map((c) => (
            <li key={c.k}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-body font-bold text-foreground">{c.label}</span>
                <span className="text-body font-black tabular-nums text-foreground">{fmtMan(c.amount)}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                <span className="block h-full rounded-full bg-rose-400" style={{ width: `${(Math.max(0, c.amount) / max) * 100}%` }} />
              </div>
            </li>
          ))}
          {rest && (
            <li className="flex items-baseline justify-between gap-2">
              <span className="text-body font-bold text-muted-foreground">그 밖 {rest.n}개</span>
              <span className="text-body font-black tabular-nums text-muted-foreground">{fmtMan(rest.amount)}</span>
            </li>
          )}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
        <p className="min-w-0 truncate text-label text-muted-foreground">
          가계부 {savedText(meta.saved_at)} 올림{stores.length ? ` · ${stores.join(", ")}` : ""}
          {skippedLoan ? " · 대출 뺌" : ""}
        </p>
        <button
          type="button"
          onClick={onImport}
          className="shrink-0 rounded-full bg-secondary px-3 py-1.5 text-label font-bold text-foreground active:scale-95"
        >
          다시 올리기
        </button>
      </div>
    </section>
  );
};

export default OpsProfitCard;
