/**
 * 사업자 가계부 · 파일 올리기 (2026-11-28 · 문서 docs/features/73-사업자-가계부.md)
 *   ① 은행 앱에서 받은 거래내역 엑셀(xlsx · xls) · CSV — 거래 일시 · 금액 · 잔액 · 적요 칸을 찾아 읽는다(계좌번호 칸은 읽지 않음).
 *      자동 분류(biz_rules)로 항목을 붙이고, 규칙에 안 걸린 나간 돈은 '기타 · 확인 필요'(여기서 바로 고칠 수 있다).
 *      급여는 일한 달로(1~15일에 보낸 급여 = 지난달 몫, 끌 수 있음).
 *   ② 153가계부 '엑셀용 CSV' — 사업 장부 · 고른 매장 줄만.
 *   같은 거래는 지문(fp)으로 한 번만 들어간다(서버 biz_import · 3,000줄씩). PDF 내역서는 클로드에게 보내면 정리해서 넣는다.
 *   파일은 이 기기에서만 읽고, 서버에는 줄(날짜 · 금액 · 상대 이름 · 항목)만 보낸다.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { fmtMan } from "@/lib/opsSales";
import { fmtWon } from "@/lib/opsWork";
import { defaultStores, readCsvFile } from "@/lib/opsCosts";
import {
  BIZ_CATS,
  BIZ_KIND_LABEL,
  REVIEW_TAG,
  bizCatLabel,
  classifyBankRows,
  parseBankCsv,
  parseBankTable,
  parseGagyebuBook,
  type BankRow,
  type BizImportRow,
  type BizKind,
} from "@/lib/bizLedger";
import { useBizImport, useBizRules, type BizBook } from "@/services/bizLedgerService";
import { OpsButton, OpsChip, OpsLabel, OpsSheet, opsInput } from "../OpsParts";

interface Props {
  open: boolean;
  onClose: () => void;
  book: BizBook;
}

type Loaded =
  | { type: "bank"; rows: BankRow[]; skipped: number }
  | { type: "gagyebu"; rows: BizImportRow[]; storeOf: string[]; stores: Array<{ name: string; n: number }>; noStore: number };

/** 엑셀 → 표 (첫 시트부터, 통장 머리글이 있는 시트) — xlsx 는 누를 때만 받는다 */
async function readSheet(file: File): Promise<string[][][]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  return wb.SheetNames.map((n) =>
    XLSX.utils.sheet_to_json<string[]>(wb.Sheets[n], { header: 1, defval: "", raw: false, dateNF: "yyyy-mm-dd hh:mm:ss" }).map((r) => r.map((c) => String(c ?? ""))),
  );
}

/** 바로 고칠 때 고를 수 있는 것 — 지출 항목 + 이동 */
const FIX_OPTIONS: Array<{ v: string; label: string }> = [
  ...BIZ_CATS.filter((c) => c.group === "biz" || c.group === "life").map((c) => ({ v: `out:${c.k}`, label: c.label })),
  { v: "move:move", label: "내 통장 · 개인(계산 안 함)" },
];

const BizImportSheet = ({ open, onClose, book }: Props) => {
  const rulesQ = useBizRules(book.id, open);
  const imp = useBizImport();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [account, setAccount] = useState("");
  const [payAccrual, setPayAccrual] = useState(true);
  const [stores, setStores] = useState<string[]>([]);
  const [noStore, setNoStore] = useState(false);
  /** 지문 → 바로 고친 구분 · 항목 */
  const [fixes, setFixes] = useState<Record<string, { kind: BizKind; cat: string }>>({});
  const [showAllReview, setShowAllReview] = useState(false);

  useEffect(() => {
    if (open) {
      setAccount((a) => a || book.accounts[0] || "");
      return;
    }
    // 닫으면 파일 내용을 지운다
    setFileName("");
    setError("");
    setLoaded(null);
    setFixes({});
    setShowAllReview(false);
    setStores([]);
    setNoStore(false);
  }, [open, book.accounts]);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setFileName(f.name);
    setError("");
    setLoaded(null);
    setFixes({});
    setReading(true);
    try {
      const lower = f.name.toLowerCase();
      if (lower.endsWith(".pdf")) {
        setError("PDF 내역서는 여기서 읽지 못해요. 은행 앱에서 엑셀로 받거나, PDF 를 클로드에게 보내 주시면 정리해서 넣어 드려요");
        return;
      }
      if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
        const sheets = await readSheet(f);
        let last = "";
        for (const t of sheets) {
          const r = parseBankTable(t);
          if (r.ok === false) {
            last = r.error;
            continue;
          }
          return void setLoaded({ type: "bank", rows: r.rows, skipped: r.skipped });
        }
        setError(last || "읽을 수 있는 시트가 없어요");
        return;
      }
      const text = await readCsvFile(f);
      const head = text.slice(0, 400);
      if (/장부/.test(head) && /카테고리/.test(head)) {
        const g = parseGagyebuBook(text);
        if (g.ok === false) return void setError(g.error);
        setLoaded({ type: "gagyebu", rows: g.rows, storeOf: g.storeOf, stores: g.stores, noStore: g.noStore });
        const def = book.branch ? defaultStores(g.stores, book.branch) : [];
        setStores(def.length ? def : g.stores.map((s) => s.name));
        setNoStore(g.noStore > 0 && def.length === 0);
        return;
      }
      const r = parseBankCsv(text);
      if (r.ok === false) return void setError(r.error);
      setLoaded({ type: "bank", rows: r.rows, skipped: r.skipped });
    } catch (e) {
      setError((e as Error).message || "파일을 읽지 못했어요");
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // 넣을 줄 (바로 고친 것 반영)
  const rows: BizImportRow[] = useMemo(() => {
    if (!loaded) return [];
    const base =
      loaded.type === "bank"
        ? classifyBankRows(loaded.rows, rulesQ.data ?? [], { account, payAccrual })
        : loaded.rows.filter((_, i) => (loaded.storeOf[i] ? stores.includes(loaded.storeOf[i]) : noStore));
    return base.map((r) => {
      const fx = fixes[r.fp];
      if (!fx) return r;
      return { ...r, kind: fx.kind, cat: fx.cat, review: false, memo: r.memo.replace(` · ${REVIEW_TAG}`, "").replace(REVIEW_TAG, "").trim() };
    });
  }, [loaded, rulesQ.data, account, payAccrual, stores, noStore, fixes]);

  const stat = useMemo(() => {
    const s = { out: 0, in: 0, back: 0, move: 0, n: rows.length, months: new Set<string>(), review: [] as BizImportRow[] };
    for (const r of rows) {
      s[r.kind] += r.amount;
      s.months.add(r.month);
      if (r.review) s.review.push(r);
    }
    return s;
  }, [rows]);
  const monthsText = useMemo(() => {
    const ms = [...stat.months].sort();
    if (!ms.length) return "";
    const f = (m: string) => `${m.slice(2, 4)}년 ${Number(m.slice(5, 7))}월`;
    return ms.length === 1 ? f(ms[0]) : `${f(ms[0])} ~ ${f(ms[ms.length - 1])}`;
  }, [stat.months]);

  const fixAll = (kind: BizKind, cat: string) =>
    setFixes((prev) => {
      const next = { ...prev };
      for (const r of stat.review) next[r.fp] = { kind, cat };
      return next;
    });

  const submit = async () => {
    if (!rows.length) return;
    try {
      const r = await imp.mutateAsync({ book: book.id, rows, source: loaded?.type === "gagyebu" ? "gagyebu_csv" : "bank_file" });
      toast.success(r.skipped > 0 ? `새로 ${r.inserted}줄 넣었어요 · 이미 있던 ${r.skipped}줄은 건너뛰었어요` : `${r.inserted}줄 넣었어요`);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const reviewShown = showAllReview ? stat.review : stat.review.slice(0, 20);

  return (
    <OpsSheet
      open={open}
      onClose={onClose}
      title="파일 올리기"
      sub={book.name}
      footer={
        <OpsButton tone="dark" onClick={() => void submit()} disabled={!rows.length || imp.isPending || rulesQ.isLoading}>
          {imp.isPending ? "넣는 중…" : rows.length ? `${rows.length.toLocaleString("ko-KR")}줄 넣기` : "파일을 골라 주세요"}
        </OpsButton>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,.pdf"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={reading}
        className="flex h-24 w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-border bg-background text-body font-bold text-foreground active:scale-[0.99] disabled:opacity-60"
      >
        <FileUp className="h-6 w-6" />
        {reading ? "읽는 중…" : fileName ? fileName : "통장 거래내역 엑셀 · CSV 고르기"}
      </button>
      <p className="mt-2 text-label text-muted-foreground">
        은행 앱 거래내역 엑셀 · CSV, 153가계부 '엑셀용 CSV'를 읽어요. 계좌번호는 읽지 않고, 같은 거래는 한 번만 들어가요.
      </p>
      {error && <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-label font-bold text-destructive">{error}</p>}

      {loaded?.type === "bank" && (
        <>
          <OpsLabel>이 파일의 통장 · 카드</OpsLabel>
          {book.accounts.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {book.accounts.map((a) => (
                <OpsChip key={a} on={account === a} onClick={() => setAccount(a)}>
                  {a}
                </OpsChip>
              ))}
            </div>
          )}
          <input value={account} onChange={(e) => setAccount(e.target.value.slice(0, 30))} placeholder="예) 사업 통장" className={opsInput} />
          <label className="mt-3 flex items-start gap-2 text-label text-foreground">
            <input type="checkbox" checked={payAccrual} onChange={(e) => setPayAccrual(e.target.checked)} className="mt-0.5 h-4 w-4 accent-foreground" />
            <span>급여는 일한 달로 넣기 (1~15일에 보낸 인건비 = 지난달 몫)</span>
          </label>
        </>
      )}

      {loaded?.type === "gagyebu" && (
        <>
          <OpsLabel>어느 매장 기록을 넣을까요</OpsLabel>
          <div className="flex flex-wrap gap-1.5">
            {loaded.stores.map((s) => (
              <OpsChip key={s.name} on={stores.includes(s.name)} onClick={() => setStores((p) => (p.includes(s.name) ? p.filter((x) => x !== s.name) : [...p, s.name]))}>
                {s.name} {s.n}
              </OpsChip>
            ))}
            {loaded.noStore > 0 && (
              <OpsChip on={noStore} onClick={() => setNoStore((v) => !v)}>
                매장 안 적음 {loaded.noStore}
              </OpsChip>
            )}
          </div>
        </>
      )}

      {loaded && (
        <div className="mt-4 rounded-2xl bg-secondary/60 p-4">
          <p className="text-body font-black text-foreground">
            {rows.length.toLocaleString("ko-KR")}줄{monthsText ? ` · ${monthsText}` : ""}
          </p>
          <ul className="mt-2 space-y-1 text-label tabular-nums">
            <Line label={BIZ_KIND_LABEL.out} value={fmtMan(stat.out)} />
            {stat.back > 0 && <Line label={BIZ_KIND_LABEL.back} value={fmtMan(stat.back)} />}
            <Line label={BIZ_KIND_LABEL.in} value={fmtMan(stat.in)} />
            <Line label={`${BIZ_KIND_LABEL.move}(계산 안 함)`} value={fmtMan(stat.move)} />
          </ul>
          {loaded.type === "bank" && loaded.skipped > 0 && <p className="mt-2 text-label text-muted-foreground">합계 · 빈 줄 {loaded.skipped}줄은 뺐어요</p>}
          {rulesQ.isLoading && <p className="mt-2 text-label text-muted-foreground">자동 분류 규칙을 불러오는 중…</p>}
        </div>
      )}

      {stat.review.length > 0 && (
        <>
          <OpsLabel>
            {REVIEW_TAG} {stat.review.length}줄 · 규칙에 없는 나간 돈 (지금은 '기타' 지출)
          </OpsLabel>
          <div className="mb-2 flex flex-wrap gap-1.5">
            <OpsChip on={false} onClick={() => fixAll("move", "move")}>
              모두 개인 사용으로
            </OpsChip>
          </div>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border">
            {reviewShown.map((r) => (
              <li key={r.fp} className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-label font-bold text-foreground">{r.party || "이름 없음"}</p>
                  <p className="text-micro tabular-nums text-muted-foreground">
                    {r.day.slice(5).replace("-", ".")} · {fmtWon(r.amount)}
                  </p>
                </div>
                <select
                  aria-label="항목 고르기"
                  value={`${r.kind}:${r.cat}`}
                  onChange={(e) => {
                    const [k, c] = e.target.value.split(":");
                    setFixes((p) => ({ ...p, [r.fp]: { kind: k as BizKind, cat: c } }));
                  }}
                  className="h-9 max-w-[9.5rem] shrink-0 rounded-lg border border-border bg-background px-2 text-label text-foreground"
                >
                  {FIX_OPTIONS.map((o) => (
                    <option key={o.v} value={o.v}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
          {stat.review.length > reviewShown.length && (
            <button type="button" onClick={() => setShowAllReview(true)} className="mt-2 w-full text-label font-bold text-muted-foreground">
              {stat.review.length - reviewShown.length}줄 더 보기
            </button>
          )}
          <p className="mt-2 text-label text-muted-foreground">넣은 뒤에도 내역에서 눌러 고칠 수 있어요. 자주 나오는 이름은 '자동 분류'에 넣어 두세요.</p>
        </>
      )}

      {loaded && stat.review.length === 0 && rows.length > 0 && (
        <p className={cn("mt-3 text-label text-muted-foreground")}>
          항목은 자동 분류로 붙였어요{rows.some((r) => r.cat === "etc") ? ` · '${bizCatLabel("etc")}'는 넣은 뒤 고쳐 주세요` : ""}
        </p>
      )}
    </OpsSheet>
  );
};

const Line = ({ label, value }: { label: string; value: string }) => (
  <li className="flex items-baseline justify-between gap-2">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-bold text-foreground">{value}</span>
  </li>
);

export default BizImportSheet;
