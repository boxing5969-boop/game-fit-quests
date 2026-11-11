/**
 * 153운영본부 · 「매출」 탭 (2026-11-03 대표님 "153운영본부에 매출 자세히 알 수 있도록 해줘 · 일단 일반 수강권 매출과 PT 매출을 분리해서")
 *
 *   보는 분: 돈을 보는 분(대표님 · 회계매니저 — 서버 ops_sales_scope). 지점장 · 코치님에게는 탭이 없다.
 *   ① 이 달 매출(환불 뺀 금액) — 주인공 숫자 하나 + 일반 수강권 · PT 두 칸(금액 · 건수 · 몫) · 그 밖 한 줄 · 환불 한 줄
 *   ② 최근 6개월 — 달마다 일반 수강권 · PT · 그 밖 막대(누르면 그 달로)
 *   ③ 매출 내역 — 전체 · 일반 수강권 · PT · 그 밖 · 환불 거르기, 날짜별
 *   자료: 브로제이(선릉) · 다짐(칠금) 매출 + 브로제이에 없는 앱 결제 — Edge Function ops-sales.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { fmtWon } from "@/lib/opsWork";
import {
  SALES_GROUP_LABEL,
  SALES_SRC_LABEL,
  fmtMan,
  fmtManParts,
  matchFilter,
  otherParts,
  sharePct,
  syncedText,
  type SalesFilter,
  type SalesRow,
} from "@/lib/opsSales";
import type { SavedCosts } from "@/lib/opsCosts";
import { useOpsSales } from "@/services/opsSalesService";
import { useOpsCosts } from "@/services/opsCostService";
import { readOpsBranch, saveOpsBranch, shortBranch } from "@/services/opsService";
import OpsCostImportSheet from "./OpsCostImportSheet";
import OpsProfitCard from "./OpsProfitCard";
import { MonthSwitcher, OpsChip, fmtDay, kstToday, monthOf, shiftMonth } from "./OpsParts";

const card = "rounded-2xl border border-border bg-card p-5";
const PAGE = 40;

const OpsSalesTab = ({ branches }: { branches: string[] }) => {
  const today = kstToday();
  const [branch, setBranchState] = useState<string | null>(() => {
    const saved = readOpsBranch();
    return saved && branches.includes(saved) ? saved : branches[0] ?? null;
  });
  useEffect(() => {
    if (!branch || !branches.includes(branch)) setBranchState(branches[0] ?? null);
  }, [branch, branches]);
  const setBranch = (b: string) => {
    setBranchState(b);
    saveOpsBranch(b);
  };
  const [month, setMonth] = useState(() => monthOf(today)); // YYYY-MM-01
  const ym = month.slice(0, 7);
  const q = useOpsSales(branch, ym);
  // 순이익 — 가계부에서 올린 사업 비용(최근 6개월, 흐름과 같은 기간)
  const costsQ = useOpsCosts(branch, shiftMonth(month, -5).slice(0, 7), ym);
  const [importOpen, setImportOpen] = useState(false);
  const [filter, setFilter] = useState<SalesFilter>("all");
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => {
    setFilter("all");
    setLimit(PAGE);
  }, [branch, ym]);

  // 회계관리 엑셀 (2026-11-11 대표님 「이렇게 정리해서 엑셀로 다운받을수있는 기능」) — 그해 1월 ~ 고른 달, 달마다 시트
  //   휴대폰은 만든 뒤 '저장'을 한 번 더 누르게 한다(공유 창은 손가락으로 누른 바로 그때만 열린다)
  const [xls, setXls] = useState<{ done: number; total: number } | null>(null);
  const [xlsReady, setXlsReady] = useState<{ key: string; bytes: Uint8Array; filename: string } | null>(null);
  const xlsKey = `${branch}|${ym}`;
  // 엑셀 만드는 코드는 누를 때만 받고, 받은 뒤엔 바로 부른다('저장'을 누른 그 순간에 공유 창이 열려야 한다)
  const acctMod = useRef<typeof import("@/lib/acctExport") | null>(null);
  const saveReady = async (f: { bytes: Uint8Array; filename: string }) => {
    const mod = acctMod.current ?? (acctMod.current = await import("@/lib/acctExport"));
    const how = await mod.saveXlsx(f.bytes, f.filename);
    if (how !== "canceled") {
      setXlsReady(null);
      toast.success(how === "shared" ? "회계관리 엑셀을 보냈어요" : "회계관리 엑셀을 저장했어요");
    }
  };
  const exportXlsx = async () => {
    if (!branch || xls) return;
    if (xlsReady?.key === xlsKey) return void saveReady(xlsReady);
    setXlsReady(null);
    setXls({ done: 0, total: Number(ym.slice(5, 7)) + 3 });
    try {
      const [{ collectOpsAcct }, mod] = await Promise.all([import("@/services/opsAcctService"), import("@/lib/acctExport")]);
      acctMod.current = mod;
      const d = await collectOpsAcct(branch, ym, (done, total) => setXls({ done, total }));
      const f = mod.opsAcctWorkbook(d);
      if (mod.isPhoneDevice()) {
        setXlsReady({ key: xlsKey, ...f });
        toast.success("엑셀이 준비됐어요 — '저장'을 눌러 주세요");
      } else await saveReady(f);
    } catch (e) {
      toast.error((e as Error).message || "엑셀을 만들지 못했어요");
    } finally {
      setXls(null);
    }
  };
  const ready = xlsReady?.key === xlsKey;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {branches.length > 1 ? (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {branches.map((b) => (
              <OpsChip key={b} on={b === branch} onClick={() => setBranch(b)}>
                {shortBranch(b)}
              </OpsChip>
            ))}
          </div>
        ) : (
          <p className="text-body font-black text-foreground">{branch ? shortBranch(branch) : ""}</p>
        )}
        <div className="flex items-center gap-2">
          <MonthSwitcher month={month} onChange={setMonth} max={monthOf(today)} />
          {q.data && (
            <button
              type="button"
              onClick={() => void exportXlsx()}
              disabled={!!xls}
              aria-label="회계관리 엑셀 받기"
              className={cn(
                "flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-label font-bold active:scale-95 disabled:opacity-70",
                ready ? "bg-foreground text-background" : "bg-secondary text-foreground",
              )}
            >
              <FileSpreadsheet className="h-4 w-4" />
              {xls ? `${xls.done}/${xls.total}` : ready ? "저장" : "엑셀"}
            </button>
          )}
        </div>
      </div>

      {q.isLoading ? (
        <div className="space-y-3" aria-hidden>
          <div className="h-56 animate-pulse rounded-2xl bg-card" />
          <div className="h-48 animate-pulse rounded-2xl bg-card" />
        </div>
      ) : !q.data ? (
        <div className={cn(card, "text-center")}>
          <p className="text-body font-bold text-foreground">매출을 불러오지 못했어요</p>
          <p className="mt-1 text-label text-muted-foreground">{(q.error as Error | null)?.message ?? "잠시 후 다시 시도해 주세요"}</p>
          <button
            type="button"
            onClick={() => void q.refetch()}
            className="mt-4 rounded-xl bg-secondary px-4 py-2 text-label font-bold text-foreground active:scale-95"
          >
            다시 불러오기
          </button>
        </div>
      ) : (
        <Report
          data={q.data}
          monthNum={Number(ym.slice(5, 7))}
          onPickMonth={(m) => setMonth(`${m}-01`)}
          filter={filter}
          setFilter={(f) => {
            setFilter(f);
            setLimit(PAGE);
          }}
          limit={limit}
          more={() => setLimit((n) => n + PAGE)}
          costs={costsQ.data}
          onImport={() => setImportOpen(true)}
        />
      )}
      {branch && (
        <OpsCostImportSheet
          open={importOpen}
          onClose={() => setImportOpen(false)}
          branch={branch}
          thisMonth={today.slice(0, 7)}
          savedMonths={costsQ.data?.months.map((m) => m.month) ?? []}
        />
      )}
    </div>
  );
};

const Report = ({
  data,
  monthNum,
  onPickMonth,
  filter,
  setFilter,
  limit,
  more,
  costs,
  onImport,
}: {
  data: NonNullable<ReturnType<typeof useOpsSales>["data"]>;
  monthNum: number;
  onPickMonth: (m: string) => void;
  filter: SalesFilter;
  setFilter: (f: SalesFilter) => void;
  limit: number;
  more: () => void;
  costs: SavedCosts | undefined;
  onImport: () => void;
}) => {
  const costOf = new Map((costs?.months ?? []).map((m) => [m.month, m.total]));
  const s = data.summary;
  const mem = s.groups.membership;
  const pt = s.groups.pt;
  const others = otherParts(s.groups);
  const otherTotal = others.reduce((t, o) => t + o.amount, 0);
  const sold = mem.amount + pt.amount + Math.max(0, otherTotal);
  const synced = syncedText(data.synced_at);

  const counts = useMemo(() => {
    const c: Record<SalesFilter, number> = { all: 0, membership: 0, pt: 0, other: 0, refund: 0 };
    for (const r of data.rows) for (const f of Object.keys(c) as SalesFilter[]) if (matchFilter(r, f)) c[f] += 1;
    return c;
  }, [data.rows]);
  const list = useMemo(() => data.rows.filter((r) => matchFilter(r, filter)), [data.rows, filter]);
  const shown = list.slice(0, limit);
  const byDay = useMemo(() => {
    const m = new Map<string, SalesRow[]>();
    for (const r of shown) m.set(r.day, [...(m.get(r.day) ?? []), r]);
    return [...m.entries()];
  }, [shown]);

  const maxTrend = Math.max(1, ...data.trend.map((t) => Math.max(0, t.membership) + Math.max(0, t.pt) + Math.max(0, t.other)));

  return (
    <>
      {/* ① 주인공 — 이 달 매출 */}
      <section className={card}>
        <p className="text-label font-bold text-muted-foreground">{monthNum}월 매출 · 환불 뺀 금액</p>
        {/* '원'은 작게 · 한 줄로 — 글씨 '크게'(390px)에서도 꺾이지 않게, 1억이 넘으면 숫자도 한 단계 작게 */}
        <p
          className={cn(
            "mt-1 whitespace-nowrap font-black tabular-nums leading-none text-foreground",
            Math.abs(s.total) >= 100_000_000 ? "text-title" : "text-display",
          )}
        >
          {Math.round(s.total).toLocaleString("ko-KR")}
          <span className="ml-0.5 text-title">원</span>
        </p>
        <p className="mt-2 text-label text-muted-foreground">
          {s.count}건{data.src !== "none" && synced ? ` · ${SALES_SRC_LABEL[data.src]} ${synced} 기준` : ""}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <GroupTile tone="membership" label={SALES_GROUP_LABEL.membership} g={mem} pct={sharePct(mem.amount, sold)} />
          <GroupTile tone="pt" label={SALES_GROUP_LABEL.pt} g={pt} pct={sharePct(pt.amount, sold)} />
        </div>

        {others.length > 0 && (
          <div className="mt-2 rounded-xl bg-secondary/60 px-3 py-2.5">
            <p className="flex items-baseline justify-between gap-2">
              <span className="text-body font-bold text-foreground">그 밖</span>
              <span className="text-body font-black tabular-nums text-foreground">{fmtMan(otherTotal)}</span>
            </p>
            <p className="mt-0.5 text-label text-muted-foreground">{others.map((o) => `${o.label} ${o.count}건`).join(" · ")}</p>
          </div>
        )}
        {s.refunds > 0 && (
          <p className="mt-2 text-label font-bold text-destructive">
            환불 {s.refunds}건 · {fmtWon(Math.abs(s.refund))} — 위 금액에서 뺐어요
          </p>
        )}
        {data.app_added > 0 && <p className="mt-1 text-label text-muted-foreground">앱 결제 {data.app_added}건은 브로제이에 없어 더했어요</p>}
      </section>

      {/* ② 순이익 — 매출 − 가계부에서 올린 사업 비용 */}
      <OpsProfitCard month={data.month} monthNum={monthNum} sales={s.total} costs={costs} onImport={onImport} />

      {/* ② 최근 6개월 */}
      {data.trend.length > 1 && (
        <section className={card}>
          <h2 className="text-heading font-black text-foreground">최근 {data.trend.length}개월</h2>
          <ul className="mt-3 space-y-2.5">
            {data.trend.map((t) => {
              const on = t.month === data.month;
              const w = (v: number) => `${(Math.max(0, v) / maxTrend) * 100}%`;
              return (
                <li key={t.month}>
                  <button type="button" onClick={() => onPickMonth(t.month)} className="block w-full text-left active:opacity-70">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={cn("text-label", on ? "font-black text-foreground" : "font-bold text-muted-foreground")}>
                        {Number(t.month.slice(5, 7))}월
                      </span>
                      <span className={cn("text-label tabular-nums", on ? "font-black text-foreground" : "text-muted-foreground")}>
                        {fmtMan(t.total)}
                        {t.pt > 0 ? <span className="font-normal text-muted-foreground"> · PT {fmtMan(t.pt)}</span> : null}
                      </span>
                    </div>
                    <div className={cn("mt-1 flex h-3 overflow-hidden rounded-full bg-secondary", on && "ring-2 ring-foreground/15")}>
                      <span className="h-full bg-primary" style={{ width: w(t.membership) }} />
                      <span className="h-full bg-orange-400" style={{ width: w(t.pt) }} />
                      <span className="h-full bg-slate-400" style={{ width: w(t.other) }} />
                    </div>
                    {costOf.has(t.month) && (
                      <p className={cn("mt-1 text-right text-label font-bold tabular-nums", t.total - (costOf.get(t.month) ?? 0) < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>
                        순이익 {fmtMan(t.total - (costOf.get(t.month) ?? 0))}
                      </p>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-label text-muted-foreground">
            <Legend cls="bg-primary" label="일반 수강권" />
            <Legend cls="bg-orange-400" label="PT" />
            <Legend cls="bg-slate-400" label="그 밖" />
          </div>
        </section>
      )}

      {/* ③ 매출 내역 */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="px-5 pb-2 pt-5">
          <h2 className="text-heading font-black text-foreground">매출 내역</h2>
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
            {(
              [
                ["all", "전체"],
                ["membership", "일반 수강권"],
                ["pt", "PT"],
                ["other", "그 밖"],
                ["refund", "환불"],
              ] as Array<[SalesFilter, string]>
            )
              .filter(([f]) => f === "all" || counts[f] > 0)
              .map(([f, label]) => (
                <OpsChip key={f} on={filter === f} onClick={() => setFilter(f)}>
                  {label} {counts[f]}
                </OpsChip>
              ))}
          </div>
        </div>
        {list.length === 0 ? (
          <p className="px-5 pb-5 text-body text-muted-foreground">{data.rows.length === 0 ? "이 달 매출 기록이 없어요" : "해당하는 매출이 없어요"}</p>
        ) : (
          <>
            {byDay.map(([day, rows]) => (
              <div key={day} className="border-t border-border/70">
                <p className="flex items-baseline justify-between bg-secondary/50 px-5 py-1.5">
                  <span className="text-label font-bold text-muted-foreground">{fmtDay(day)}</span>
                  <span className="text-label tabular-nums text-muted-foreground">{fmtWon(rows.reduce((t, r) => t + r.amount, 0))}</span>
                </p>
                <ul className="divide-y divide-border/60">
                  {rows.map((r) => (
                    <li key={r.id} className="flex items-start gap-3 px-5 py-3">
                      <span
                        aria-hidden
                        className={cn(
                          "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                          r.refund ? "bg-destructive" : r.group === "pt" ? "bg-orange-400" : r.group === "membership" ? "bg-primary" : "bg-slate-400",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body font-bold text-foreground">{r.member || "이름 없음"}</p>
                        <p className="truncate text-label text-muted-foreground">
                          {r.refund ? "환불 · " : ""}
                          {r.product}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={cn("text-body font-black tabular-nums", r.refund ? "text-destructive" : "text-foreground")}>{fmtWon(r.amount)}</p>
                        <p className="text-label text-muted-foreground">
                          {r.src === "app" ? <span className="rounded-full bg-primary/10 px-1.5 font-bold text-primary">앱 결제</span> : r.method || SALES_GROUP_LABEL[r.group]}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {list.length > shown.length && (
              <button type="button" onClick={more} className="h-14 w-full border-t border-border text-body font-bold text-foreground active:bg-secondary/60">
                {list.length - shown.length}건 더 보기
              </button>
            )}
          </>
        )}
        {data.truncated && <p className="border-t border-border px-5 py-3 text-label text-muted-foreground">줄이 너무 많아 최근 2,000건만 보여요</p>}
      </section>
    </>
  );
};

const GroupTile = ({ tone, label, g, pct }: { tone: "membership" | "pt"; label: string; g: { amount: number; count: number; refund: number; refunds: number }; pct: number }) => (
  <div className={cn("rounded-2xl border p-3.5", tone === "membership" ? "border-primary/30 bg-primary/5" : "border-orange-300/60 bg-orange-50 dark:bg-orange-500/10")}>
    <p className="flex items-center gap-1.5 text-label font-bold text-muted-foreground">
      <span className={cn("h-2.5 w-2.5 rounded-full", tone === "membership" ? "bg-primary" : "bg-orange-400")} />
      {label}
    </p>
    {/* 단위는 작게 — 글씨 '크게'에서도 칸 안에 한 줄 */}
    <p className="mt-1 whitespace-nowrap font-black tabular-nums leading-tight text-foreground">
      <span className="text-title">{fmtManParts(g.amount).num}</span>
      <span className="ml-0.5 text-body">{fmtManParts(g.amount).unit}</span>
    </p>
    <p className="mt-0.5 text-label tabular-nums text-muted-foreground">
      {g.count}건 · {pct}%
    </p>
    {g.refunds > 0 && <p className="text-label tabular-nums text-destructive">환불 {fmtMan(Math.abs(g.refund))}</p>}
  </div>
);

const Legend = ({ cls, label }: { cls: string; label: string }) => (
  <span className="flex items-center gap-1">
    <span className={cn("h-2.5 w-2.5 rounded-full", cls)} />
    {label}
  </span>
);

export default OpsSalesTab;
