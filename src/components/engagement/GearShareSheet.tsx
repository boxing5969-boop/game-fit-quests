/**
 * 중고 장비 나눔 — 시트.
 *
 * 운영 원칙 (화면에도 명시한다):
 *   · 금액은 앱에 적지 않는다. 주고받는 것은 데스크를 통한다 — 회원 간 금전 분쟁 방지.
 *   · 사진 업로드는 두지 않는다(1차). 종류·사이즈·상태 텍스트로 충분하고,
 *     자유 사진 업로드는 관리 부담이 크다.
 *   · 진행중 글은 한 사람 3개까지(서버에서도 막는다).
 */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PackageOpen, X } from "lucide-react";
import { toast } from "sonner";

import { useModalDismiss } from "@/hooks/useModalDismiss";
import { useGearActions, useGearPosts } from "@/hooks/useCommunityHub";
import {
  CONDITION_LABEL,
  DEAL_LABEL,
  GEAR_LABEL,
  type GearCondition,
  type GearDeal,
  type GearKind,
} from "@/services/communityHubService";

interface Props {
  open: boolean;
  onClose: () => void;
}

const KINDS: GearKind[] = ["glove", "handwrap", "shoes", "rope", "headgear", "other"];
const CONDITIONS: GearCondition[] = ["new", "good", "used"];
const DEALS: GearDeal[] = ["free", "transfer"];

const GearShareSheet = ({ open, onClose }: Props) => {
  useModalDismiss(open, onClose);

  const { data, isLoading } = useGearPosts(open);
  const { create, close } = useGearActions();

  const [kind, setKind] = useState<GearKind>("glove");
  const [size, setSize] = useState("");
  const [condition, setCondition] = useState<GearCondition>("good");
  const [deal, setDeal] = useState<GearDeal>("free");
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const posts = data?.posts ?? [];

  const handleCreate = async () => {
    try {
      await create.mutateAsync({
        kind,
        size: size.trim() || null,
        condition,
        deal,
        note: note.trim() || null,
      });
      toast.success("장비 글을 올렸습니다");
      setSize("");
      setNote("");
      setFormOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "글을 올리지 못했습니다");
    }
  };

  const handleClose = async (id: string) => {
    setBusyId(id);
    try {
      await close.mutateAsync(id);
      toast.success("완료로 바꿨습니다");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "완료 처리하지 못했습니다");
    } finally {
      setBusyId(null);
    }
  };

  const chip = (active: boolean) =>
    `rounded-pill border px-2.5 py-1.5 text-[11.5px] font-bold transition-colors ${
      active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
    }`;

  const renderList = () => {
    if (isLoading) {
      return <p className="py-6 text-center text-[12px] text-muted-foreground">불러오는 중…</p>;
    }
    if (posts.length === 0) {
      return (
        <div className="rounded-card border border-border bg-muted/20 px-4 py-6 text-center">
          <p className="text-2xl">🧤</p>
          <p className="mt-2 text-[13px] font-bold text-foreground">아직 올라온 장비가 없습니다</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            사이즈가 안 맞아 넣어둔 장비가 있으면 첫 글을 올려보세요.
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {posts.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-3 rounded-card border border-border bg-card px-3.5 py-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[13px] font-bold text-foreground">
                  {GEAR_LABEL[p.kind]}
                  {p.size && ` ${p.size}`}
                </span>
                <span
                  className={`rounded-pill px-2 py-0.5 text-[10px] font-bold ${
                    p.deal === "free"
                      ? "bg-primary/10 text-primary"
                      : "bg-reward/15 text-reward"
                  }`}
                >
                  {DEAL_LABEL[p.deal]}
                </span>
                <span className="text-[10.5px] font-semibold text-muted-foreground">
                  {CONDITION_LABEL[p.condition]}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {p.isMine ? "내 글" : p.nickname}
                {p.note && ` · ${p.note}`}
              </p>
            </div>
            {p.isMine && (
              <button
                type="button"
                disabled={busyId === p.id}
                onClick={() => handleClose(p.id)}
                className="shrink-0 rounded-pill border border-border px-3 py-1.5 text-[11.5px] font-bold text-muted-foreground active:scale-95 disabled:opacity-60"
              >
                완료
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderForm = () => {
    if (!formOpen) {
      return (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="mt-4 w-full rounded-xl border border-border bg-muted/20 py-3 text-[13px] font-black text-primary active:scale-[0.99]"
        >
          + 내 장비 올리기
        </button>
      );
    }
    return (
      <div className="mt-4 rounded-card border border-border bg-muted/20 p-4">
        <p className="text-[12px] font-black text-foreground">장비 올리기</p>

        <p className="mt-3 text-[11px] font-bold text-muted-foreground">종류</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} className={chip(kind === k)}>
              {GEAR_LABEL[k]}
            </button>
          ))}
        </div>

        <p className="mt-3 text-[11px] font-bold text-muted-foreground">상태</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {CONDITIONS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCondition(c)}
              className={chip(condition === c)}
            >
              {CONDITION_LABEL[c]}
            </button>
          ))}
        </div>

        <p className="mt-3 text-[11px] font-bold text-muted-foreground">나눔 / 양도</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {DEALS.map((d) => (
            <button key={d} type="button" onClick={() => setDeal(d)} className={chip(deal === d)}>
              {DEAL_LABEL[d]}
            </button>
          ))}
        </div>

        <input
          value={size}
          onChange={(e) => setSize(e.target.value.slice(0, 30))}
          placeholder="사이즈 (예: 12oz / 270mm)"
          className="mt-3 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground"
          aria-label="사이즈"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 200))}
          placeholder="한 줄 (예: 두 번 썼습니다)"
          className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground"
          aria-label="한 줄 메모"
        />

        <button
          type="button"
          onClick={handleCreate}
          disabled={create.isPending}
          className="mt-3 w-full rounded-xl bg-primary py-3 text-[13px] font-black text-primary-foreground active:scale-[0.99] disabled:opacity-60"
        >
          {create.isPending ? "올리는 중…" : "올리기"}
        </button>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-background/85 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="중고 장비 나눔"
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
          >
            <div className="flex items-start justify-between border-b border-border px-5 pt-5 pb-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-primary/15 text-primary">
                  <PackageOpen className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                    중고 장비 나눔
                  </p>
                  <h2 className="mt-0.5 text-[15px] font-bold text-foreground">
                    안 쓰는 장비, 필요한 사람에게
                  </h2>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    같은 지점 회원에게만 보입니다.
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+5rem)]">
              <div className="mb-3 rounded-xl border-l-2 border-primary/40 bg-primary/5 px-3.5 py-2.5">
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  <b className="text-foreground">주고받는 것은 데스크를 통해 주세요.</b>
                  <br />
                  금액은 앱에 적지 않습니다 — 회원 간 직접 거래에서 생기는 문제를 막기 위한 것입니다.
                </p>
              </div>
              {renderList()}
              {renderForm()}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GearShareSheet;
