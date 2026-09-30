/**
 * 신고하기 — 이유 고르기 + (선택) 자세한 내용 + 차단 함께. 본사만 확인하고 상대에게는 알리지 않는다.
 * 신고하면 최근 대화 50개 사본이 본사로 함께 간다 (서버 dm_report).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { useReportDm } from "@/hooks/useDm";
import { DM_REPORT_REASONS, type DmReportReason } from "@/services/dmService";
import { DmSheet } from "@/components/dm/DmParts";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  threadId: string;
  peerName: string;
  /** 신고 뒤 (차단까지 했으면 목록으로 나간다) */
  onDone?: (blocked: boolean) => void;
}

const DmReportSheet = ({ open, onClose, threadId, peerName, onDone }: Props) => {
  const [reason, setReason] = useState<DmReportReason | null>(null);
  const [detail, setDetail] = useState("");
  const [block, setBlock] = useState(true);
  const report = useReportDm();

  useEffect(() => {
    if (open) {
      setReason(null);
      setDetail("");
      setBlock(true);
    }
  }, [open]);

  const submit = async () => {
    if (!reason) return;
    try {
      const res = await report.mutateAsync({ threadId, reason, detail, block });
      toast.success(res.blocked ? "신고했어요 · 차단도 했어요. 본사가 확인할게요" : "신고했어요. 본사가 확인할게요");
      onClose();
      onDone?.(res.blocked);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "신고하지 못했어요");
    }
  };

  return (
    <DmSheet
      open={open}
      onClose={onClose}
      title={`${peerName}님 신고하기`}
      subtitle="본사만 확인하고, 상대에게는 알리지 않아요"
      footer={
        <button
          type="button"
          onClick={submit}
          disabled={!reason || report.isPending}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-destructive text-[15px] font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          {report.isPending ? "보내는 중…" : "신고하기"}
        </button>
      }
    >
      <ul className="space-y-2" role="radiogroup" aria-label="신고 이유">
        {DM_REPORT_REASONS.map((r) => {
          const on = reason === r.value;
          return (
            <li key={r.value}>
              <button
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setReason(r.value)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left ring-1 transition-colors active:scale-[0.99]",
                  on ? "bg-destructive/[0.06] ring-destructive/50" : "bg-secondary/50 ring-transparent",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-2",
                    on ? "bg-destructive ring-destructive" : "ring-border",
                  )}
                >
                  {on && <Check className="h-3 w-3 text-white" strokeWidth={3.2} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[14.5px] font-bold text-foreground">{r.label}</span>
                  <span className="block text-[12px] text-muted-foreground">{r.hint}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <textarea
        value={detail}
        onChange={(e) => setDetail(e.target.value.slice(0, 300))}
        rows={3}
        placeholder="자세한 내용 (선택 · 300자까지)"
        className="mt-3 w-full resize-none rounded-2xl bg-secondary/60 px-4 py-3 text-[16px] leading-snug text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40"
        aria-label="자세한 내용"
      />

      <label className="mt-3 flex items-center gap-3 rounded-2xl bg-secondary/40 px-4 py-3">
        <input
          type="checkbox"
          checked={block}
          onChange={(e) => setBlock(e.target.checked)}
          className="h-5 w-5 shrink-0 accent-[hsl(var(--destructive))]"
        />
        <span className="text-[13.5px] font-semibold text-foreground">{peerName}님 차단도 하기</span>
      </label>

      <p className="mt-3 px-1 text-[11.5px] leading-relaxed text-muted-foreground">
        신고하면 이 대화의 최근 메시지 50개가 본사에 함께 전달돼요. 본사가 확인한 뒤 메시지 보내기를 제한할 수 있어요.
      </p>
    </DmSheet>
  );
};

export default DmReportSheet;
