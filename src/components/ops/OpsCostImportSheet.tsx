/**
 * 153운영본부 「매출」 · 가계부 CSV 올리기 (2026-11-04 대표님 "153가계부랑 연동해서 … 순이익도 계산하자")
 *   153가계부 › 설정 › '엑셀용 CSV' 파일 → 이 창이 읽어 사업 장부 · 고른 매장의 지출만 달 · 항목별로 더한다 → 합계만 저장.
 *   파일 · 거래 하나하나 · 개인 장부는 서버로 보내지 않는다. 규칙은 src/lib/opsCosts.ts.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, FileUp } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { fmtMan } from "@/lib/opsSales";
import {
  DEFAULT_SKIP,
  bizStores,
  costsByMonth,
  defaultMonths,
  defaultStores,
  parseGagyebuCsv,
  readCsvFile,
  toSavePayload,
  type GbRow,
} from "@/lib/opsCosts";
import { useSaveOpsCosts } from "@/services/opsCostService";
import { shortBranch } from "@/services/opsService";
import { OpsButton, OpsChip, OpsLabel, OpsSheet } from "./OpsParts";

interface Props {
  open: boolean;
  onClose: () => void;
  branch: string;
  /** 이번 달 YYYY-MM — 처음 고를 달은 이번 달까지 */
  thisMonth: string;
  /** 이미 올린 달 */
  savedMonths: string[];
}

const monthText = (ym: string, thisYear: string) => {
  const [y, m] = ym.split("-");
  return y === thisYear ? `${Number(m)}월` : `${y}년 ${Number(m)}월`;
};

const OpsCostImportSheet = ({ open, onClose, branch, thisMonth, savedMonths }: Props) => {
  const save = useSaveOpsCosts();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<GbRow[] | null>(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [stores, setStores] = useState<string[]>([]);
  const [noStore, setNoStore] = useState(false);
  const [skipLoan, setSkipLoan] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    if (open) return;
    // 닫으면 파일 내용을 지운다(이 화면 밖으로 남기지 않음)
    setFileName("");
    setRows(null);
    setError("");
    setStores([]);
    setNoStore(false);
    setSkipLoan(true);
    setPicked([]);
  }, [open]);

  const storeInfo = useMemo(() => (rows ? bizStores(rows) : { stores: [], noStore: 0 }), [rows]);
  const months = useMemo(
    () => (rows ? costsByMonth(rows, { stores, noStore, skip: skipLoan ? DEFAULT_SKIP : [] }) : []),
    [rows, stores, noStore, skipLoan],
  );
  // 매장 · 빼는 항목을 바꾸면 고를 달도 다시
  useEffect(() => {
    setPicked(defaultMonths(months, thisMonth));
  }, [months, thisMonth]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    if (file.size > 15 * 1024 * 1024) {
      setError("파일이 너무 커요 (15MB 까지)");
      return;
    }
    setReading(true);
    try {
      const p = parseGagyebuCsv(await readCsvFile(file));
      if (p.ok === false) {
        setRows(null);
        setError(p.error);
        return;
      }
      if (!p.biz) {
        setRows(null);
        setError("이 파일에는 사업 장부 기록이 없어요");
        return;
      }
      const info = bizStores(p.rows);
      const defs = defaultStores(info.stores, branch);
      setFileName(file.name);
      setRows(p.rows);
      setStores(defs);
      // 매장을 하나도 안 적어 온 장부면 매장 없는 지출을 이 지점 것으로
      setNoStore(defs.length === 0 && info.stores.length === 0 && info.noStore > 0);
    } catch {
      setError("파일을 읽지 못했어요");
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const chosen = months.filter((m) => picked.includes(m.month));
  const thisYear = thisMonth.slice(0, 4);
  const overlap = chosen.some((m) => savedMonths.includes(m.month));

  const submit = async () => {
    if (!chosen.length) return;
    try {
      await save.mutateAsync({
        branch,
        months: toSavePayload(chosen),
        meta: { stores, no_store: noStore, excluded: ["save", ...(skipLoan ? DEFAULT_SKIP : [])] },
      });
      const names = chosen
        .map((m) => monthText(m.month, thisYear))
        .slice(0, 3)
        .join(" · ");
      toast.success(`${names}${chosen.length > 3 ? ` 외 ${chosen.length - 3}개월` : ""} 비용을 저장했어요`);
      onClose();
    } catch (e) {
      toast.error((e as Error).message || "비용을 저장하지 못했어요");
    }
  };

  return (
    <OpsSheet
      open={open}
      onClose={onClose}
      title="가계부 CSV 올리기"
      sub={`${shortBranch(branch)} · 사업 비용`}
      footer={
        rows ? (
          <OpsButton onClick={() => void submit()} disabled={!chosen.length || save.isPending}>
            {save.isPending ? "저장하는 중…" : chosen.length ? `${chosen.length}개월 저장` : "저장할 달을 골라 주세요"}
          </OpsButton>
        ) : undefined
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv,text/comma-separated-values,application/vnd.ms-excel"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />

      {!rows ? (
        <div>
          <ol className="space-y-2.5">
            {[
              "153가계부 › 설정에서 '엑셀용 CSV'를 눌러요",
              "파일을 저장해요 (휴대폰은 공유 › 파일에 저장)",
              "아래 '파일 고르기'로 그 파일을 골라요",
            ].map((t, i) => (
              <li key={t} className="flex items-start gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-label font-black text-foreground">{i + 1}</span>
                <span className="text-body text-foreground">{t}</span>
              </li>
            ))}
          </ol>
          <div className="mt-5">
            <OpsButton tone="dark" onClick={() => fileRef.current?.click()} disabled={reading}>
              <FileUp className="h-5 w-5" />
              {reading ? "읽는 중…" : "파일 고르기"}
            </OpsButton>
          </div>
          {error && <p className="mt-3 text-label font-bold text-destructive">{error}</p>}
          <p className="mt-4 text-label text-muted-foreground">파일은 이 화면에서만 읽어요. 사업 장부의 달 · 항목별 합계만 저장돼요.</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between gap-2 rounded-xl bg-secondary/60 px-3 py-2.5">
            <p className="min-w-0 truncate text-label font-bold text-foreground">{fileName}</p>
            <button type="button" onClick={() => fileRef.current?.click()} className="shrink-0 text-label font-bold text-primary active:opacity-70">
              다른 파일
            </button>
          </div>
          {error && <p className="mt-2 text-label font-bold text-destructive">{error}</p>}

          <OpsLabel>매장 — 이 지점 비용으로 셀 것</OpsLabel>
          {storeInfo.stores.length || storeInfo.noStore ? (
            <div className="flex flex-wrap gap-1.5">
              {storeInfo.stores.map((s) => (
                <OpsChip key={s.name} on={stores.includes(s.name)} onClick={() => setStores((l) => toggle(l, s.name))}>
                  {s.name} {s.n}
                </OpsChip>
              ))}
              {storeInfo.noStore > 0 && (
                <OpsChip on={noStore} onClick={() => setNoStore((v) => !v)}>
                  매장 안 적은 지출 {storeInfo.noStore}
                </OpsChip>
              )}
            </div>
          ) : (
            <p className="text-body text-muted-foreground">사업 장부에 지출이 없어요</p>
          )}

          <OpsLabel>빼는 항목</OpsLabel>
          <div className="flex flex-wrap gap-1.5">
            <OpsChip on={skipLoan} onClick={() => setSkipLoan((v) => !v)}>
              대출·금융 빼기
            </OpsChip>
          </div>
          <p className="mt-1.5 text-label text-muted-foreground">대출 원금 · 저축은 비용이 아니라서 빼요. 이동(내 통장끼리)과 수입은 늘 빠져요.</p>

          <OpsLabel>저장할 달</OpsLabel>
          {months.length ? (
            <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border">
              {months.slice(0, 24).map((m) => {
                const on = picked.includes(m.month);
                return (
                  <li key={m.month}>
                    <button
                      type="button"
                      onClick={() => setPicked((l) => toggle(l, m.month))}
                      aria-pressed={on}
                      className="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-secondary/60"
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border",
                          on ? "border-foreground bg-foreground text-background" : "border-border bg-background",
                        )}
                      >
                        {on && <Check className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="text-body font-bold text-foreground">
                            {monthText(m.month, thisYear)}
                            {savedMonths.includes(m.month) && <span className="ml-1.5 text-label font-bold text-primary">올림</span>}
                          </span>
                          <span className="text-body font-black tabular-nums text-foreground">{fmtMan(m.total)}</span>
                        </span>
                        <span className="block truncate text-label text-muted-foreground">
                          {m.cats
                            .slice(0, 3)
                            .map((c) => `${c.label} ${fmtMan(c.amount)}`)
                            .join(" · ")}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-body text-muted-foreground">고른 매장의 사업 지출이 없어요</p>
          )}
          {overlap && <p className="mt-2 text-label text-muted-foreground">이미 올린 달은 새 값으로 바뀌어요.</p>}
        </div>
      )}
    </OpsSheet>
  );
};

export default OpsCostImportSheet;
