/**
 * 사업자 가계부 · 한 줄 넣기 · 고치기 (2026-11-28 · 문서 docs/features/73-사업자-가계부.md)
 *   구분(지출 · 수입 · 돌려받음 · 이동) · 날짜 · 귀속 월(급여는 일한 달) · 금액 · 항목 · 받는 사람(곳) · 근무자 · 3.3% 계산 · 메모 · 통장
 *   '다음부터 자동 분류'를 켜면 받는 사람(곳) 이름이 규칙이 된다(biz_rules). 서버 biz_entry_save · biz_entry_delete.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { fmtWon } from "@/lib/opsWork";
import { BIZ_KIND_LABEL, catsForKind, defaultCat, prevMonth, whtOf, type BizEntry, type BizKind } from "@/lib/bizLedger";
import { useBizEntryDelete, useBizEntrySave, type BizBook, type BizStaff } from "@/services/bizLedgerService";
import { OpsButton, OpsChip, OpsLabel, OpsSheet, opsInput } from "../OpsParts";

interface Props {
  open: boolean;
  onClose: () => void;
  book: BizBook;
  staff: BizStaff[];
  entry: BizEntry | null;
  /** 새 줄의 날짜 YYYY-MM-DD */
  defaultDay: string;
}

const KINDS: BizKind[] = ["out", "in", "back", "move"];
const digits = (s: string) => s.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 11);
const withComma = (s: string) => (s ? Number(s).toLocaleString("ko-KR") : "");

const BizEntrySheet = ({ open, onClose, book, staff, entry, defaultDay }: Props) => {
  const save = useBizEntrySave();
  const del = useBizEntryDelete();
  const [kind, setKind] = useState<BizKind>("out");
  const [day, setDay] = useState(defaultDay);
  const [month, setMonth] = useState(defaultDay.slice(0, 7));
  const [monthTouched, setMonthTouched] = useState(false);
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState("etc");
  const [party, setParty] = useState("");
  const [memo, setMemo] = useState("");
  const [account, setAccount] = useState("");
  const [staffId, setStaffId] = useState<string | null>(null);
  const [wht, setWht] = useState<number | null>(null);
  const [gross, setGross] = useState("");
  const [rule, setRule] = useState(false);
  const [showLife, setShowLife] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKind(entry?.kind ?? "out");
    setDay(entry?.day ?? defaultDay);
    setMonth(entry?.month ?? defaultDay.slice(0, 7));
    setMonthTouched(!!entry && entry.month !== entry.day.slice(0, 7));
    setAmount(entry ? String(entry.amount) : "");
    setCat(entry?.cat ?? "etc");
    setParty(entry?.party ?? "");
    setMemo(entry?.memo ?? "");
    setAccount(entry?.account ?? book.accounts[0] ?? "");
    setStaffId(entry?.staff_id ?? null);
    setWht(entry?.wht ?? null);
    setGross("");
    setRule(false);
    setConfirmDel(false);
    setShowLife(!!entry && catsForKind("out").some((c) => c.k === entry.cat && c.group === "life"));
  }, [open, entry, defaultDay, book.accounts]);

  const cats = useMemo(() => catsForKind(kind), [kind]);
  const bizCats = cats.filter((c) => c.group !== "life");
  const lifeCats = cats.filter((c) => c.group === "life");
  const pickKind = (k: BizKind) => {
    setKind(k);
    if (!catsForKind(k).some((c) => c.k === cat)) setCat(defaultCat(k));
  };
  const pickDay = (v: string) => {
    setDay(v);
    if (!monthTouched && /^\d{4}-\d{2}-\d{2}$/.test(v)) setMonth(v.slice(0, 7));
  };
  const dayMonth = day.slice(0, 7);
  const isPay = kind === "out" && cat === "bpay";
  const calc = gross ? whtOf(Number(gross)) : null;

  const busy = save.isPending || del.isPending;
  const submit = async () => {
    const amt = Number(amount);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return void toast.error("날짜를 골라 주세요");
    if (!amt) return void toast.error("금액을 적어 주세요");
    try {
      await save.mutateAsync({
        id: entry?.id,
        book: book.id,
        day,
        month: /^\d{4}-\d{2}$/.test(month) ? month : dayMonth,
        kind,
        cat,
        amount: amt,
        party: party.trim(),
        memo: memo.trim(),
        account: account.trim(),
        staff_id: isPay ? staffId : null,
        wht: isPay ? wht : null,
        rule: rule && party.trim().length >= 2,
      });
      toast.success(entry ? "고쳤어요" : "넣었어요");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const remove = async () => {
    if (!entry) return;
    if (!confirmDel) return setConfirmDel(true);
    try {
      await del.mutateAsync(entry.id);
      toast.success("지웠어요");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <OpsSheet
      open={open}
      onClose={onClose}
      title={entry ? "내역 고치기" : "직접 넣기"}
      sub={book.name}
      footer={
        <div className="flex gap-2">
          {entry && (
            <div className="w-28 shrink-0">
              <OpsButton tone="danger" onClick={() => void remove()} disabled={busy}>
                {confirmDel ? "정말 지울까요" : "지우기"}
              </OpsButton>
            </div>
          )}
          <OpsButton tone="dark" onClick={() => void submit()} disabled={busy}>
            {save.isPending ? "저장하는 중…" : "저장"}
          </OpsButton>
        </div>
      }
    >
      <OpsLabel>구분</OpsLabel>
      <div className="grid grid-cols-4 gap-1.5">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => pickKind(k)}
            aria-pressed={kind === k}
            className={cn(
              "h-10 rounded-xl border text-label font-bold active:scale-95",
              kind === k ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground",
            )}
          >
            {BIZ_KIND_LABEL[k]}
          </button>
        ))}
      </div>
      {kind === "move" && <p className="mt-1.5 text-label text-muted-foreground">내 통장끼리 옮긴 돈이나 개인으로 쓴 돈은 비용에 넣지 않아요</p>}
      {kind === "back" && <p className="mt-1.5 text-label text-muted-foreground">환불이나 반품으로 돌려받은 돈은 그 항목 비용에서 빼요</p>}

      <OpsLabel>날짜</OpsLabel>
      <input type="date" value={day} onChange={(e) => pickDay(e.target.value)} className={opsInput} />
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-label text-muted-foreground">귀속 월</span>
        <OpsChip
          on={month === dayMonth}
          onClick={() => {
            setMonth(dayMonth);
            setMonthTouched(false);
          }}
        >
          {Number(dayMonth.slice(5, 7)) || "-"}월
        </OpsChip>
        <OpsChip
          on={month === prevMonth(dayMonth)}
          onClick={() => {
            setMonth(prevMonth(dayMonth));
            setMonthTouched(true);
          }}
        >
          지난달 몫
        </OpsChip>
        <input
          type="month"
          value={month}
          onChange={(e) => {
            setMonth(e.target.value);
            setMonthTouched(true);
          }}
          aria-label="귀속 월 고르기"
          className="h-8 rounded-full border border-border bg-background px-2 text-label text-foreground"
        />
      </div>
      {isPay && <p className="mt-1.5 text-label text-muted-foreground">급여는 일한 달로 넣어요 · 10일에 보낸 급여는 지난달 몫</p>}

      <OpsLabel>금액</OpsLabel>
      <div className="relative">
        <input
          inputMode="numeric"
          value={withComma(amount)}
          onChange={(e) => setAmount(digits(e.target.value))}
          placeholder="0"
          className={cn(opsInput, "pr-8 text-right text-heading font-black tabular-nums")}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-body text-muted-foreground">원</span>
      </div>

      <OpsLabel>항목</OpsLabel>
      <div className="flex flex-wrap gap-1.5">
        {bizCats.map((c) => (
          <OpsChip key={c.k} on={cat === c.k} onClick={() => setCat(c.k)}>
            {c.label}
          </OpsChip>
        ))}
        {lifeCats.length > 0 &&
          (showLife ? (
            lifeCats.map((c) => (
              <OpsChip key={c.k} on={cat === c.k} onClick={() => setCat(c.k)}>
                {c.label}
              </OpsChip>
            ))
          ) : (
            <OpsChip on={false} onClick={() => setShowLife(true)}>
              생활 항목 더 보기
            </OpsChip>
          ))}
      </div>

      {isPay && staff.length > 0 && (
        <>
          <OpsLabel>근무자</OpsLabel>
          <div className="flex flex-wrap gap-1.5">
            {staff.map((s) => (
              <OpsChip
                key={s.id}
                on={staffId === s.id}
                onClick={() => {
                  setStaffId(staffId === s.id ? null : s.id);
                  if (!party.trim() || staff.some((x) => x.name === party.trim())) setParty(s.name);
                }}
              >
                {s.name}
                {!s.active ? " (그만둠)" : ""}
              </OpsChip>
            ))}
          </div>
        </>
      )}

      {isPay && (
        <div className="mt-3 rounded-xl bg-secondary/60 p-3">
          <p className="text-label font-bold text-foreground">프리랜서 3.3% 계산</p>
          <div className="relative mt-2">
            <input
              inputMode="numeric"
              value={withComma(gross)}
              onChange={(e) => setGross(digits(e.target.value))}
              placeholder="세전 금액"
              className={cn(opsInput, "pr-8 text-right tabular-nums")}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-label text-muted-foreground">원</span>
          </div>
          {calc && (
            <>
              <p className="mt-2 text-label tabular-nums text-muted-foreground">
                원천세 {fmtWon(calc.tax)} (소득세 3% + 지방소득세 0.3%) · 실지급 {fmtWon(calc.net)}
              </p>
              <button
                type="button"
                onClick={() => {
                  setAmount(String(calc.net));
                  setWht(calc.tax);
                }}
                className="mt-2 h-9 w-full rounded-lg bg-foreground text-label font-black text-background active:scale-[0.99]"
              >
                실지급 {fmtWon(calc.net)}으로 넣기
              </button>
            </>
          )}
          {wht !== null && wht > 0 && <p className="mt-2 text-label text-muted-foreground">이 줄의 원천세 {fmtWon(wht)} · 국세청에 낸 원천세는 '세금' 줄로 따로 들어가요</p>}
        </div>
      )}

      <OpsLabel>{kind === "in" ? "보낸 사람(곳)" : "받는 사람(곳)"}</OpsLabel>
      <input value={party} onChange={(e) => setParty(e.target.value.slice(0, 60))} placeholder="예) 건물주 · 전기료 · 코치 이름" className={opsInput} />
      {party.trim().length >= 2 && (
        <label className="mt-2 flex items-center gap-2 text-label text-foreground">
          <input type="checkbox" checked={rule} onChange={(e) => setRule(e.target.checked)} className="h-4 w-4 accent-foreground" />
          다음에 파일을 올릴 때 '{party.trim()}'은 이 항목으로 자동 분류
        </label>
      )}

      <OpsLabel>메모</OpsLabel>
      <input value={memo} onChange={(e) => setMemo(e.target.value.slice(0, 200))} placeholder="예) 11월 월세" className={opsInput} />

      <OpsLabel>통장 · 카드</OpsLabel>
      {book.accounts.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {book.accounts.map((a) => (
            <OpsChip key={a} on={account === a} onClick={() => setAccount(a)}>
              {a}
            </OpsChip>
          ))}
        </div>
      )}
      <input value={account} onChange={(e) => setAccount(e.target.value.slice(0, 30))} placeholder="예) 사업 통장 · 대표 카드 (번호는 적지 마세요)" className={opsInput} />
    </OpsSheet>
  );
};

export default BizEntrySheet;
