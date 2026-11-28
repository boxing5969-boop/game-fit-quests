/**
 * 사업자 가계부 · 사업자 더하기 · 고치기 · 보관 (2026-11-28 · 문서 docs/features/73-사업자-가계부.md)
 *   이름 · 대표자 · 개인사업자/법인 · 통장 · 카드 이름(번호 없이) — 회계매니저도 고칠 수 있다.
 *   지점 잇기 · 순이익 연결 · 더하기 · 보관은 대표님만(서버가 다시 확인).
 *   순이익 연결을 켜면 그 지점 운영본부 순이익의 비용을 이 가계부가 채운다(예전 '가계부 CSV 올리기'는 막힘).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { useBizBookArchive, useBizBookSave, type BizBook } from "@/services/bizLedgerService";
import { shortBranch } from "@/services/opsService";
import { OpsButton, OpsChip, OpsLabel, OpsSheet, opsInput } from "../OpsParts";

interface Props {
  open: boolean;
  onClose: () => void;
  /** null 이면 새 사업자 */
  book: BizBook | null;
  branches: string[];
  /** 대표님 — 지점 · 순이익 연결 · 보관 */
  canAdmin: boolean;
  onSaved?: (id: string) => void;
  onArchived?: () => void;
}

const BizBookSheet = ({ open, onClose, book, branches, canAdmin, onSaved, onArchived }: Props) => {
  const save = useBizBookSave();
  const archive = useBizBookArchive();
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [kind, setKind] = useState<"personal" | "corp">("personal");
  const [branch, setBranch] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [accounts, setAccounts] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(book?.name ?? "");
    setOwner(book?.owner_name ?? "");
    setKind(book?.kind ?? "personal");
    setBranch(book?.branch ?? null);
    setLive(book?.costs_live ?? false);
    setAccounts((book?.accounts ?? []).join(", "));
    setConfirmArchive(false);
  }, [open, book]);

  const busy = save.isPending || archive.isPending;
  const submit = async () => {
    if (!name.trim()) return void toast.error("사업자 이름을 적어 주세요");
    try {
      const r = await save.mutateAsync({
        id: book?.id,
        name: name.trim(),
        owner_name: owner.trim(),
        kind,
        branch,
        costs_live: !!branch && live,
        accounts: accounts
          .split(/[,\n]/)
          .map((a) => a.trim())
          .filter(Boolean)
          .slice(0, 10),
      });
      toast.success(book ? "사업자 정보를 고쳤어요" : "사업자를 더했어요");
      onClose();
      if (!book) onSaved?.(r.id);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const doArchive = async () => {
    if (!book) return;
    if (!confirmArchive) return setConfirmArchive(true);
    try {
      await archive.mutateAsync(book.id);
      toast.success("사업자를 보관했어요");
      onClose();
      onArchived?.();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <OpsSheet
      open={open}
      onClose={onClose}
      title={book ? "사업자 정보" : "사업자 추가"}
      sub={book?.name}
      footer={
        <div className="flex gap-2">
          {book && canAdmin && (
            <div className="w-32 shrink-0">
              <OpsButton tone="danger" onClick={() => void doArchive()} disabled={busy}>
                {confirmArchive ? "정말 보관할까요" : "보관하기"}
              </OpsButton>
            </div>
          )}
          <OpsButton tone="dark" onClick={() => void submit()} disabled={busy}>
            {save.isPending ? "저장하는 중…" : "저장"}
          </OpsButton>
        </div>
      }
    >
      <OpsLabel>사업자 이름</OpsLabel>
      <input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder="예) 153복싱짐 ○○점" className={opsInput} />

      <OpsLabel>대표자</OpsLabel>
      <input value={owner} onChange={(e) => setOwner(e.target.value.slice(0, 20))} placeholder="사업자등록증의 대표자 이름" className={opsInput} />

      <OpsLabel>사업자 종류</OpsLabel>
      <div className="flex gap-1.5">
        <OpsChip on={kind === "personal"} onClick={() => setKind("personal")}>
          개인사업자
        </OpsChip>
        <OpsChip on={kind === "corp"} onClick={() => setKind("corp")}>
          법인
        </OpsChip>
      </div>

      <OpsLabel>통장 · 카드 이름</OpsLabel>
      <input value={accounts} onChange={(e) => setAccounts(e.target.value)} placeholder="예) 사업 통장, 대표 카드 (쉼표로 나눠요)" className={opsInput} />
      <p className="mt-1.5 text-label text-muted-foreground">이름만 적어요. 계좌번호 · 카드 번호는 저장하지 않아요.</p>

      <OpsLabel>운영본부 지점과 잇기</OpsLabel>
      {canAdmin ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            <OpsChip on={branch === null} onClick={() => setBranch(null)}>
              잇지 않음
            </OpsChip>
            {branches.map((b) => (
              <OpsChip key={b} on={branch === b} onClick={() => setBranch(b)}>
                {shortBranch(b)}
              </OpsChip>
            ))}
          </div>
          {branch && (
            <label
              className={cn(
                "mt-3 flex items-start gap-2 rounded-xl border p-3 text-label",
                live ? "border-primary/40 bg-primary/5 text-foreground" : "border-border bg-background text-foreground",
              )}
            >
              <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} className="mt-0.5 h-4 w-4 accent-foreground" />
              <span>
                <span className="font-bold">순이익 연결</span>
                <br />
                켜면 {shortBranch(branch)} 순이익의 비용을 이 가계부가 채워요. 예전 '가계부 CSV 올리기'는 막혀요.
              </span>
            </label>
          )}
        </>
      ) : (
        <p className="text-body text-foreground">{book?.branch ? `${shortBranch(book.branch)}${book.costs_live ? " · 순이익 연결 켜짐" : ""}` : "잇지 않음"}</p>
      )}
    </OpsSheet>
  );
};

export default BizBookSheet;
