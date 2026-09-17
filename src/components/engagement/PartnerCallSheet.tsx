/**
 * 오늘 파트너 구하기 — 시트.
 *
 * 규약 (CornermanSheet 와 동일): z-[100] / role='dialog' / aria-modal / useModalDismiss.
 *
 * 안전 규칙:
 *   · 스파링 모집은 레드 리그(레벨 21)부터. 맞대는 구간이 레드에서 열리기 때문이다.
 *     화면에서 잠그고, 서버(create_partner_call)에서도 같은 조건으로 막는다.
 *   · 하루에 한 사람이 한 건만 올릴 수 있다(DB unique). 다시 올리면 덮어쓴다.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Handshake, X } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { usePartnerCallActions, usePartnerCalls } from "@/hooks/useCommunityHub";
import {
  PURPOSE_LABEL,
  SPARRING_RANKS,
  type PartnerPurpose,
} from "@/services/communityHubService";

interface Props {
  open: boolean;
  onClose: () => void;
}

const HOURS = Array.from({ length: 19 }, (_, i) => i + 5); // 5시 ~ 23시

const formatHour = (h: number) =>
  h < 12 ? `오전 ${h}시` : h === 12 ? "낮 12시" : `오후 ${h - 12}시`;

const PURPOSES: PartnerPurpose[] = ["mitt", "jump", "together", "sparring"];

const PartnerCallSheet = ({ open, onClose }: Props) => {
  useModalDismiss(open, onClose);

  const { progress } = useAuth();
  const { data, isLoading } = usePartnerCalls(open);
  const { create, join, leave, close } = usePartnerCallActions();

  const [purpose, setPurpose] = useState<PartnerPurpose>("mitt");
  const [hour, setHour] = useState<number>(19);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const myRank = progress?.current_rank ?? "white";
  const canSpar = (SPARRING_RANKS as readonly string[]).includes(myRank);

  const calls = data?.calls ?? [];
  const mine = calls.find((c) => c.isMine);

  const run = async (fn: () => Promise<unknown>, id: string, fail: string) => {
    setBusyId(id);
    try {
      await fn();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : fail);
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = async () => {
    if (purpose === "sparring" && !canSpar) {
      toast.error("스파링 모집은 레드 리그(레벨 21)부터 가능합니다");
      return;
    }
    try {
      await create.mutateAsync({ purpose, slotHour: hour, note: note.trim() || null });
      toast.success(mine ? "모집을 바꿨습니다" : "모집을 올렸습니다");
      setNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "모집 글을 올리지 못했습니다");
    }
  };

  const renderHeader = () => (
    <div className="flex items-start justify-between border-b border-border px-5 pt-5 pb-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-primary/15 text-primary">
          <Handshake className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            오늘 파트너 구하기
          </p>
          <h2 className="mt-0.5 text-[15px] font-bold text-foreground">
            같은 지점, 오늘만 보입니다
          </h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            하루가 지나면 저절로 사라집니다. 부담 없이 올려주세요.
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
  );

  const renderList = () => {
    if (isLoading) {
      return <p className="py-6 text-center text-[12px] text-muted-foreground">불러오는 중…</p>;
    }
    if (calls.length === 0) {
      return (
        <div className="rounded-card border border-border bg-muted/20 px-4 py-6 text-center">
          <p className="text-2xl">🥊</p>
          <p className="mt-2 text-[13px] font-bold text-foreground">아직 오늘 모집이 없습니다</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            아래에서 첫 모집을 올려보세요. 같은 지점 회원에게만 보입니다.
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {calls.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-3 rounded-card border border-border bg-card px-3.5 py-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-bold text-foreground">
                  {c.isMine ? "내 모집" : c.nickname}
                </span>
                <span className="rounded-pill bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  {PURPOSE_LABEL[c.purpose]}
                </span>
              </div>
              <p className="mt-0.5 text-[11.5px] font-semibold text-muted-foreground">
                {formatHour(c.slotHour)}
                {c.joinCount > 0 && ` · 참여 ${c.joinCount}명`}
              </p>
              {c.note && (
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{c.note}</p>
              )}
            </div>
            {c.isMine ? (
              <button
                type="button"
                disabled={busyId === c.id}
                onClick={() =>
                  run(() => close.mutateAsync(c.id), c.id, "모집을 내리지 못했습니다")
                }
                className="shrink-0 rounded-pill border border-border px-3 py-1.5 text-[11.5px] font-bold text-muted-foreground active:scale-95 disabled:opacity-60"
              >
                내리기
              </button>
            ) : c.joined ? (
              <button
                type="button"
                disabled={busyId === c.id}
                onClick={() =>
                  run(() => leave.mutateAsync(c.id), c.id, "취소하지 못했습니다")
                }
                className="shrink-0 rounded-pill border border-border px-3 py-1.5 text-[11.5px] font-bold text-muted-foreground active:scale-95 disabled:opacity-60"
              >
                참여 취소
              </button>
            ) : (
              <button
                type="button"
                disabled={busyId === c.id}
                onClick={() => run(() => join.mutateAsync(c.id), c.id, "참여하지 못했습니다")}
                className="shrink-0 rounded-pill bg-primary px-3.5 py-1.5 text-[11.5px] font-bold text-primary-foreground active:scale-95 disabled:opacity-60"
              >
                저요
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderForm = () => (
    <div className="mt-5 rounded-card border border-border bg-muted/20 p-4">
      <p className="text-[12px] font-black text-foreground">
        {mine ? "내 모집 바꾸기" : "모집 올리기"}
      </p>

      <p className="mt-3 text-[11px] font-bold text-muted-foreground">무엇을 함께 하나요</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {PURPOSES.map((p) => {
          const locked = p === "sparring" && !canSpar;
          return (
            <button
              key={p}
              type="button"
              disabled={locked}
              onClick={() => setPurpose(p)}
              className={`rounded-pill border px-2.5 py-1.5 text-[11.5px] font-bold transition-colors disabled:opacity-40 ${
                purpose === p
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {PURPOSE_LABEL[p]}
              {locked && " 🔒"}
            </button>
          );
        })}
      </div>
      {!canSpar && (
        <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
          스파링 모집은 맞대는 구간이 열리는 <b className="text-foreground">레드 리그(레벨 21)</b>부터
          가능합니다. 미트·줄넘기·같이 운동은 지금도 올릴 수 있습니다.
        </p>
      )}

      <p className="mt-3 text-[11px] font-bold text-muted-foreground">몇 시에 오시나요</p>
      <select
        value={hour}
        onChange={(e) => setHour(Number(e.target.value))}
        className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[13px] font-bold text-foreground"
        aria-label="시간 선택"
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {formatHour(h)}
          </option>
        ))}
      </select>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 120))}
        placeholder="한 줄 (예: 3라운드만 미트 부탁드려요)"
        className="mt-2.5 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground"
        aria-label="한 줄 메모"
      />

      <button
        type="button"
        onClick={handleCreate}
        disabled={create.isPending}
        className="mt-3 w-full rounded-xl bg-primary py-3 text-[13px] font-black text-primary-foreground active:scale-[0.99] disabled:opacity-60"
      >
        {create.isPending ? "올리는 중…" : mine ? "모집 바꾸기" : "모집 올리기"}
      </button>
      <p className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground">
        하루에 한 건만 올라갑니다. 다시 올리면 기존 모집이 바뀝니다.
      </p>
    </div>
  );

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
            aria-label="오늘 파트너 구하기"
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
          >
            {renderHeader()}
            <div className="flex-1 overflow-y-auto px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+5rem)]">
              {renderList()}
              {renderForm()}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PartnerCallSheet;
