/**
 * 사업자 가계부 · 한 사업자 한 달 (2026-11-28 · 문서 docs/features/73-사업자-가계부.md)
 *   ① 이 달 비용(지출 − 돌려받음) 큰 숫자 하나 · 통장 입금 · 이동(계산 안 함) · 확인 필요 · 순이익 연결
 *   ② 직접 넣기 · 파일 올리기(통장 엑셀 · CSV · 153가계부 CSV) · 자동 분류
 *   ③ 항목별 · 인건비 사람별 · 최근 12개월(누르면 그 달) · ④ 내역(거르기 · 날짜별, 누르면 고치기)
 */
import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronLeft, FileUp, Link2, Plus, Settings2, Wand2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { fmtMan } from "@/lib/opsSales";
import { fmtWon } from "@/lib/opsWork";
import { topCats } from "@/lib/opsCosts";
import { BIZ_KIND_LABEL, REVIEW_TAG, bizCatLabel, matchBizFilter, summarizeMonth, type BizEntry, type BizFilter } from "@/lib/bizLedger";
import { useBizMonth } from "@/services/bizLedgerService";
import { MonthSwitcher, OpsChip, fmtDay, kstToday } from "../OpsParts";
import BizBookSheet from "./BizBookSheet";
import BizEntrySheet from "./BizEntrySheet";
import BizImportSheet from "./BizImportSheet";
import BizRulesSheet from "./BizRulesSheet";

const card = "rounded-2xl border border-border bg-card p-5";
const PAGE = 60;

const KIND_DOT: Record<BizEntry["kind"], string> = {
  out: "bg-rose-400",
  back: "bg-emerald-500",
  in: "bg-primary",
  move: "bg-slate-300",
};

interface Props {
  bookId: string;
  /** YYYY-MM-01 */
  month: string;
  setMonth: (m: string) => void;
  maxMonth: string;
  canAdmin: boolean;
  branches: string[];
  onBack: () => void;
}

const BizBookView = ({ bookId, month, setMonth, maxMonth, canAdmin, branches, onBack }: Props) => {
  const ym = month.slice(0, 7);
  const monthNum = Number(ym.slice(5, 7));
  const q = useBizMonth(bookId, ym);
  const d = q.data;
  const sum = useMemo(() => summarizeMonth(d?.entries ?? []), [d?.entries]);
  const [filter, setFilter] = useState<BizFilter>("all");
  const [limit, setLimit] = useState(PAGE);
  const [edit, setEdit] = useState<BizEntry | "new" | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);

  const list = useMemo(() => (d?.entries ?? []).filter((e) => matchBizFilter(e, filter)), [d?.entries, filter]);
  const shown = list.slice(0, limit);
  const byDay = useMemo(() => {
    const m = new Map<string, BizEntry[]>();
    for (const e of shown) m.set(e.day, [...(m.get(e.day) ?? []), e]);
    return [...m.entries()];
  }, [shown]);
  const counts = useMemo(() => {
    const c: Record<BizFilter, number> = { all: 0, out: 0, in: 0, move: 0, review: 0 };
    for (const e of d?.entries ?? []) for (const f of Object.keys(c) as BizFilter[]) if (matchBizFilter(e, f)) c[f] += 1;
    return c;
  }, [d?.entries]);
  const pickFilter = (f: BizFilter) => {
    setFilter(f);
    setLimit(PAGE);
  };

  const today = kstToday();
  const defaultDay = today.slice(0, 7) === ym ? today : `${ym}-01`;
  const { top, rest } = topCats(sum.cats, 8);
  const maxCat = Math.max(1, ...top.map((c) => c.amount));
  const maxTrend = Math.max(1, ...(d?.trend ?? []).map((t) => Math.max(0, t.cost)));
  const maxPay = Math.max(1, ...sum.pay.map((p) => p.amount));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 flex h-9 items-center gap-0.5 rounded-full pr-3 text-label font-bold text-muted-foreground active:scale-95"
        >
          <ChevronLeft className="h-5 w-5" />
          사업자 목록
        </button>
        {d && (
          <button
            type="button"
            onClick={() => setBookOpen(true)}
            className="flex h-9 items-center gap-1 rounded-full bg-secondary px-3 text-label font-bold text-foreground active:scale-95"
          >
            <Settings2 className="h-4 w-4" />
            사업자 정보
          </button>
        )}
      </div>

      {q.isLoading ? (
        <div className="space-y-3" aria-hidden>
          <div className="h-48 animate-pulse rounded-2xl bg-card" />
          <div className="h-40 animate-pulse rounded-2xl bg-card" />
        </div>
      ) : !d ? (
        <div className={cn(card, "text-center")}>
          <p className="text-body font-bold text-foreground">가계부를 불러오지 못했어요</p>
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
        <>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-heading font-black text-foreground">{d.book.name}</h2>
              <p className="truncate text-label text-muted-foreground">
                {[d.book.owner_name, d.book.kind === "corp" ? "법인" : "개인사업자", d.book.accounts.length ? `통장 · 카드 ${d.book.accounts.length}개` : ""]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <MonthSwitcher month={month} onChange={setMonth} max={maxMonth} />
          </div>

          {/* ① 주인공 — 이 달 비용 */}
          <section className={card}>
            <p className="text-label font-bold text-muted-foreground">{monthNum}월 비용 · 지출 − 돌려받음</p>
            <p className={cn("mt-1 whitespace-nowrap font-black tabular-nums leading-none text-foreground", Math.abs(sum.cost) >= 100_000_000 ? "text-title" : "text-display")}>
              {Math.round(sum.cost).toLocaleString("ko-KR")}
              <span className="ml-0.5 text-title">원</span>
            </p>
            <p className="mt-2 text-label tabular-nums text-muted-foreground">통장 입금 {fmtMan(sum.inn)}</p>
            {sum.move > 0 && <p className="text-label tabular-nums text-muted-foreground">내 통장 · 개인 {fmtMan(sum.move)}은 비용에 안 넣었어요</p>}
            {d.book.costs_live && d.book.branch && (
              <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-primary/5 px-3 py-2 text-label font-bold text-primary">
                <Link2 className="h-4 w-4 shrink-0" />
                {d.book.branch.replace(/^153\s*복싱짐\s*/, "")} 순이익의 비용으로 들어가요
              </p>
            )}
            {sum.review > 0 && (
              <button
                type="button"
                onClick={() => pickFilter("review")}
                className="mt-2 flex w-full items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-left text-label font-bold text-amber-800 active:scale-[0.99] dark:bg-amber-500/10 dark:text-amber-300"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {REVIEW_TAG} {sum.review}줄 · 눌러서 보기
              </button>
            )}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <ActionButton onClick={() => setEdit("new")} icon={<Plus className="h-5 w-5" />} label="직접 넣기" />
              <ActionButton onClick={() => setImportOpen(true)} icon={<FileUp className="h-5 w-5" />} label="파일 올리기" />
              <ActionButton onClick={() => setRulesOpen(true)} icon={<Wand2 className="h-5 w-5" />} label="자동 분류" />
            </div>
          </section>

          {/* ③ 항목별 */}
          {top.length > 0 && (
            <section className={card}>
              <h3 className="text-heading font-black text-foreground">항목별</h3>
              <ul className="mt-3 space-y-2.5">
                {top.map((c) => (
                  <li key={c.k}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-body font-bold text-foreground">
                        {c.label}
                        {c.count > 1 ? <span className="ml-1 text-label font-normal text-muted-foreground">{c.count}건</span> : null}
                      </span>
                      <span className="text-body font-black tabular-nums text-foreground">{fmtMan(c.amount)}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                      <span className="block h-full rounded-full bg-rose-400" style={{ width: `${(Math.max(0, c.amount) / maxCat) * 100}%` }} />
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
            </section>
          )}

          {/* 인건비 · 사람별 */}
          {sum.pay.length > 0 && (
            <section className={card}>
              <h3 className="text-heading font-black text-foreground">인건비 · 사람별</h3>
              <p className="mt-0.5 text-label text-muted-foreground">일한 달 기준 · 1~15일에 보낸 급여는 지난달 몫</p>
              <ul className="mt-3 space-y-2">
                {sum.pay.map((p) => (
                  <li key={p.name}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-body font-bold text-foreground">{p.name}</span>
                      <span className="shrink-0 text-body font-black tabular-nums text-foreground">{fmtWon(p.amount)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <span className="block h-full rounded-full bg-orange-400" style={{ width: `${(Math.max(0, p.amount) / maxPay) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 최근 12개월 */}
          {d.trend.some((t) => t.n > 0) && (
            <section className={card}>
              <h3 className="text-heading font-black text-foreground">최근 12개월 비용</h3>
              <ul className="mt-3 space-y-2">
                {d.trend.map((t) => {
                  const on = t.month === ym;
                  return (
                    <li key={t.month}>
                      <button type="button" onClick={() => setMonth(`${t.month}-01`)} className="block w-full text-left active:opacity-70">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className={cn("text-label", on ? "font-black text-foreground" : "font-bold text-muted-foreground")}>
                            {t.month.slice(5, 7) === "01" || t.month === d.trend[0]?.month ? `${t.month.slice(2, 4)}년 ` : ""}
                            {Number(t.month.slice(5, 7))}월
                          </span>
                          <span className={cn("text-label tabular-nums", on ? "font-black text-foreground" : "text-muted-foreground")}>
                            {t.n === 0 ? "기록 없음" : fmtMan(t.cost)}
                          </span>
                        </div>
                        <div className={cn("mt-1 h-2.5 overflow-hidden rounded-full bg-secondary", on && "ring-2 ring-foreground/15")}>
                          <span className="block h-full rounded-full bg-rose-400" style={{ width: `${(Math.max(0, t.cost) / maxTrend) * 100}%` }} />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* ④ 내역 */}
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="px-5 pb-2 pt-5">
              <h3 className="text-heading font-black text-foreground">내역</h3>
              <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
                {(
                  [
                    ["all", "전체"],
                    ["out", "지출"],
                    ["in", "수입"],
                    ["move", "이동 · 개인"],
                    ["review", REVIEW_TAG],
                  ] as Array<[BizFilter, string]>
                )
                  .filter(([f]) => f === "all" || counts[f] > 0)
                  .map(([f, label]) => (
                    <OpsChip key={f} on={filter === f} onClick={() => pickFilter(f)}>
                      {label} {counts[f]}
                    </OpsChip>
                  ))}
              </div>
            </div>
            {list.length === 0 ? (
              <p className="px-5 pb-5 text-body text-muted-foreground">{d.entries.length === 0 ? "이 달 기록이 없어요" : "해당하는 줄이 없어요"}</p>
            ) : (
              <>
                {byDay.map(([day, rows]) => (
                  <div key={day} className="border-t border-border/70">
                    <p className="bg-secondary/50 px-5 py-1.5 text-label font-bold text-muted-foreground">{fmtDay(day)}</p>
                    <ul className="divide-y divide-border/60">
                      {rows.map((e) => (
                        <li key={e.id}>
                          <EntryRow e={e} ym={ym} onClick={() => setEdit(e)} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {list.length > shown.length && (
                  <button
                    type="button"
                    onClick={() => setLimit((n) => n + PAGE)}
                    className="h-14 w-full border-t border-border text-body font-bold text-foreground active:bg-secondary/60"
                  >
                    {list.length - shown.length}줄 더 보기
                  </button>
                )}
              </>
            )}
          </section>

          <BizEntrySheet
            open={edit !== null}
            onClose={() => setEdit(null)}
            book={d.book}
            staff={d.staff}
            entry={edit && edit !== "new" ? edit : null}
            defaultDay={defaultDay}
          />
          <BizImportSheet open={importOpen} onClose={() => setImportOpen(false)} book={d.book} />
          <BizRulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} book={d.book} staff={d.staff} />
          <BizBookSheet
            open={bookOpen}
            onClose={() => setBookOpen(false)}
            book={d.book}
            branches={branches}
            canAdmin={canAdmin}
            onArchived={onBack}
          />
        </>
      )}
    </div>
  );
};

const ActionButton = ({ onClick, icon, label }: { onClick: () => void; icon: ReactNode; label: string }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex h-16 flex-col items-center justify-center gap-1 rounded-xl bg-secondary text-label font-bold text-foreground active:scale-95"
  >
    {icon}
    {label}
  </button>
);

const EntryRow = ({ e, ym, onClick }: { e: BizEntry; ym: string; onClick: () => void }) => {
  const sign = e.kind === "out" ? "-" : e.kind === "move" ? "" : "+";
  const review = e.memo.includes(REVIEW_TAG);
  const summary = e.source === "summary";
  // 보낸 달과 귀속 월이 다르면(급여 = 일한 달) '○월 몫'
  const owed = e.day.slice(0, 7) !== e.month || e.month !== ym ? `${Number(e.month.slice(5, 7))}월 몫` : "";
  const sub = [
    summary ? "" : e.kind === "move" ? BIZ_KIND_LABEL.move : bizCatLabel(e.cat),
    e.kind === "back" ? "돌려받음" : "",
    owed,
    e.memo.replace(` · ${REVIEW_TAG}`, "").replace(REVIEW_TAG, ""),
  ]
    .filter(Boolean)
    .join(" · ");
  const title = summary ? (e.kind === "in" ? e.party || bizCatLabel(e.cat) : bizCatLabel(e.cat)) : e.staff_name || e.party || bizCatLabel(e.cat);
  return (
    <button type="button" onClick={onClick} className="flex w-full items-start gap-3 px-5 py-3 text-left active:bg-secondary/50">
      <span aria-hidden className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", KIND_DOT[e.kind])} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5">
          <span className="truncate text-body font-bold text-foreground">{title}</span>
          {summary && <span className="shrink-0 rounded-full bg-secondary px-1.5 text-micro font-bold text-muted-foreground">월 합계</span>}
          {review && <span className="shrink-0 rounded-full bg-amber-100 px-1.5 text-micro font-bold text-amber-800">{REVIEW_TAG}</span>}
        </p>
        <p className="truncate text-label text-muted-foreground">{sub}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className={cn("text-body font-black tabular-nums", e.kind === "move" ? "text-muted-foreground" : e.kind === "out" ? "text-foreground" : "text-primary")}>
          {sign}
          {fmtWon(e.amount)}
        </p>
        <p className="max-w-[7rem] truncate text-label text-muted-foreground">{e.n > 1 ? `${e.n}건` : e.account}</p>
      </div>
    </button>
  );
};

export default BizBookView;
