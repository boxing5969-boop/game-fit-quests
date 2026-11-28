/**
 * 사업자 가계부 · 자동 분류 규칙 (2026-11-28 · 문서 docs/features/73-사업자-가계부.md)
 *   받는 · 보낸 이름에 낱말이 들어 있으면 그 구분 · 항목(· 근무자)으로. 긴 낱말이 먼저 맞는다.
 *   나간 돈에는 지출 · 이동 규칙만, 들어온 돈에는 수입 · 돌려받음 · 이동 규칙만 맞는다(lib/bizLedger matchRule).
 *   서버 biz_rules · biz_rule_save · biz_rule_delete.
 */
import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

import { BIZ_KIND_LABEL, bizCatLabel, catsForKind, defaultCat, type BizKind } from "@/lib/bizLedger";
import { useBizRuleDelete, useBizRuleSave, useBizRules, type BizBook, type BizStaff } from "@/services/bizLedgerService";
import { OpsButton, OpsChip, OpsLabel, OpsSheet, opsInput } from "../OpsParts";

interface Props {
  open: boolean;
  onClose: () => void;
  book: BizBook;
  staff: BizStaff[];
}

const KINDS: BizKind[] = ["out", "in", "back", "move"];

const BizRulesSheet = ({ open, onClose, book, staff }: Props) => {
  const q = useBizRules(book.id, open);
  const add = useBizRuleSave();
  const del = useBizRuleDelete();
  const [keyword, setKeyword] = useState("");
  const [kind, setKind] = useState<BizKind>("out");
  const [cat, setCat] = useState("etc");
  const [staffId, setStaffId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) return;
    setKeyword("");
    setKind("out");
    setCat("etc");
    setStaffId(null);
    setSearch("");
  }, [open]);

  const rules = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data ?? []).filter((r) => !s || r.keyword.toLowerCase().includes(s) || bizCatLabel(r.cat).includes(s));
  }, [q.data, search]);

  const submit = async () => {
    if (!keyword.trim()) return void toast.error("낱말을 적어 주세요");
    try {
      await add.mutateAsync({ book: book.id, keyword: keyword.trim(), kind, cat, staff_id: kind === "out" && cat === "bpay" ? staffId : null });
      toast.success("규칙을 넣었어요");
      setKeyword("");
      setStaffId(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <OpsSheet open={open} onClose={onClose} title="자동 분류" sub={`${book.name} · 파일을 올릴 때 항목을 붙여요`}>
      <OpsLabel>새 규칙</OpsLabel>
      <input value={keyword} onChange={(e) => setKeyword(e.target.value.slice(0, 30))} placeholder="이름에 들어 있는 낱말 (예: 전기료 · 세무회계)" className={opsInput} />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <OpsChip
            key={k}
            on={kind === k}
            onClick={() => {
              setKind(k);
              if (!catsForKind(k).some((c) => c.k === cat)) setCat(defaultCat(k));
            }}
          >
            {BIZ_KIND_LABEL[k]}
          </OpsChip>
        ))}
      </div>
      {kind !== "move" && (
        <select
          aria-label="항목"
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-body text-foreground"
        >
          {catsForKind(kind).map((c) => (
            <option key={c.k} value={c.k}>
              {c.label}
            </option>
          ))}
        </select>
      )}
      {kind === "out" && cat === "bpay" && staff.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {staff.map((s) => (
            <OpsChip key={s.id} on={staffId === s.id} onClick={() => setStaffId(staffId === s.id ? null : s.id)}>
              {s.name}
            </OpsChip>
          ))}
        </div>
      )}
      <div className="mt-3">
        <OpsButton tone="dark" onClick={() => void submit()} disabled={add.isPending}>
          규칙 넣기
        </OpsButton>
      </div>

      <OpsLabel>규칙 {q.data?.length ?? 0}개</OpsLabel>
      {(q.data?.length ?? 0) > 8 && <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="찾기" className={opsInput} />}
      {q.isLoading ? (
        <div className="mt-2 h-24 animate-pulse rounded-xl bg-secondary" aria-hidden />
      ) : rules.length === 0 ? (
        <p className="mt-2 text-label text-muted-foreground">{q.data?.length ? "맞는 규칙이 없어요" : "아직 규칙이 없어요. 직접 넣을 때 '자동 분류'를 켜도 규칙이 생겨요"}</p>
      ) : (
        <ul className="mt-2 divide-y divide-border/60 overflow-hidden rounded-xl border border-border">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center gap-2 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-bold text-foreground">{r.keyword}</p>
                <p className="truncate text-label text-muted-foreground">
                  {BIZ_KIND_LABEL[r.kind]}
                  {r.kind !== "move" ? ` · ${bizCatLabel(r.cat)}` : ""}
                  {r.staff_name ? ` · ${r.staff_name}` : ""}
                </p>
              </div>
              <button
                type="button"
                aria-label={`${r.keyword} 규칙 지우기`}
                disabled={del.isPending}
                onClick={() =>
                  r.id &&
                  del.mutate(r.id, {
                    onError: (e) => toast.error((e as Error).message),
                  })
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </OpsSheet>
  );
};

export default BizRulesSheet;
