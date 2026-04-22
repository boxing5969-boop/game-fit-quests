import { useState } from "react";
import {
  Camera,
  Droplets,
  Flame,
  Footprints,
  MessageCircle,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

import type { Database } from "@/integrations/supabase/types";
import { useAddCoachFeedback } from "@/hooks/useDietCoach";
import { scoreFromLogRow } from "@/lib/diet/scoreEngine";
import { DIET_STAGES } from "@/data/dietProgramData";
import DietCoachTemplatePicker, {
  type CoachTemplateItem,
} from "./DietCoachTemplatePicker";
import { cn } from "@/lib/utils";

type DietDailyLogRow =
  Database["public"]["Tables"]["diet_daily_logs"]["Row"];

interface DietApprovalCardProps {
  log: DietDailyLogRow;
  nickname: string | null;
  avatarUrl: string | null;
  photosCount: number;
  onReviewed?: () => void;
  onOpenMember?: (userId: string) => void;
  className?: string;
}

/**
 * 코치 피드백 카드 — 승인 체계가 폐지되고 자가 기록으로 전환됨에 따라
 * 승인/반려/수정 3-버튼은 제거되고 "피드백 보내기" 단일 액션만 남는다.
 * 기존 props 시그니처 유지 — 상위 페이지(`DietCoachInboxPage`, `MemberDetailPage`) 호환.
 */
export const DietApprovalCard = ({
  log,
  nickname,
  avatarUrl,
  photosCount,
  onReviewed,
  onOpenMember,
  className,
}: DietApprovalCardProps) => {
  const feedback = useAddCoachFeedback();
  const [text, setText] = useState(log.coach_feedback ?? "");
  const [tplId, setTplId] = useState<string | null>(null);

  const stageLabel =
    DIET_STAGES.find((_, i) => {
      const start = i * 7 + 1;
      const end = i * 7 + 7;
      return log.day_number >= start && log.day_number <= end;
    })?.label ?? "";

  const score = scoreFromLogRow(log, photosCount, false).total;

  const sendFeedback = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      toast.error("피드백을 입력해 주세요.");
      return;
    }
    try {
      const r = await feedback.mutateAsync({
        logId: log.id,
        feedback: trimmed,
      });
      if (!r.success) {
        toast.error(`전송 실패: ${r.error}`);
        return;
      }
      toast.success("피드백을 보냈어요. 회원 알림으로 전달됩니다.");
      onReviewed?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "전송 실패");
    }
  };

  const handleTemplate = (t: CoachTemplateItem) => {
    setTplId(t.id);
    setText(t.body);
  };

  const busy = feedback.isPending;
  const alreadySent = !!log.coach_feedback;

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-4 space-y-3",
        className,
      )}
    >
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onOpenMember?.(log.user_id)}
          className="flex items-center gap-2.5 flex-1 min-w-0 text-left active:opacity-80"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[14px] font-bold text-muted-foreground">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              (nickname ?? "?").slice(0, 1)
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-foreground">
              {nickname ?? "회원"}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              Day {log.day_number} · {stageLabel} · {log.log_date}
            </p>
          </div>
        </button>
        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-black text-primary">
          {score}점
        </span>
      </div>

      {/* 체크 summary + 사진 count */}
      <div className="grid grid-cols-2 gap-1.5 text-[11.5px]">
        <SmallStat
          label="단백질"
          value={log.protein_first === true ? "O" : log.protein_first === false ? "X" : "—"}
          tone={log.protein_first === true ? "ok" : "muted"}
        />
        <SmallStat
          label="채소"
          value={log.veggies_natural === true ? "O" : log.veggies_natural === false ? "X" : "—"}
          tone={log.veggies_natural === true ? "ok" : "muted"}
        />
        <SmallStat
          label="당 음료"
          value={log.sugary_drink_avoided === true ? "O" : log.sugary_drink_avoided === false ? "X" : "—"}
          tone={log.sugary_drink_avoided === true ? "ok" : "muted"}
        />
        <SmallStat
          label="야식 절제"
          value={log.late_night_snack_avoided === true ? "O" : log.late_night_snack_avoided === false ? "X" : "—"}
          tone={log.late_night_snack_avoided === true ? "ok" : "muted"}
        />
        <SmallStat
          label="출석"
          value={log.gym_attended === true ? "O" : log.gym_attended === false ? "X" : "—"}
          tone={log.gym_attended === true ? "ok" : "muted"}
        />
        <SmallStat
          label="사진"
          value={photosCount > 0 ? `${photosCount}장` : "0장"}
          tone={photosCount > 0 ? "ok" : "muted"}
          icon={<Camera className="h-3 w-3" />}
        />
      </div>

      {/* 수치 */}
      <div className="grid grid-cols-3 gap-1.5">
        <MetricPill
          icon={<Droplets className="h-3 w-3" />}
          label="물"
          value={log.water_ml ? `${log.water_ml}ml` : "—"}
        />
        <MetricPill
          icon={<Footprints className="h-3 w-3" />}
          label="걸음"
          value={log.step_count ? `${log.step_count.toLocaleString()}` : "—"}
        />
        <MetricPill
          icon={<Moon className="h-3 w-3" />}
          label="수면"
          value={log.sleep_hours ? `${log.sleep_hours}h` : "—"}
        />
      </div>

      {/* 회원 회고 + 기분 */}
      {(log.memo || log.mood) && (
        <div className="rounded-xl border border-border bg-muted/30 p-2.5 text-[12px]">
          {log.mood && (
            <p className="text-[11px] font-bold uppercase text-primary mb-0.5">
              기분: {log.mood}
            </p>
          )}
          {log.memo && (
            <p className="text-foreground leading-relaxed whitespace-pre-line">
              {log.memo}
            </p>
          )}
        </div>
      )}

      {/* 템플릿 */}
      <DietCoachTemplatePicker selectedId={tplId} onPick={handleTemplate} />

      {/* 피드백 입력 */}
      <Textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value.slice(0, 300));
          setTplId(null);
        }}
        placeholder="회원에게 보낼 한마디 (템플릿 선택 또는 직접 입력)"
        className="min-h-[72px] rounded-xl text-[13px]"
      />

      {/* 액션 — 단일 "피드백 보내기" */}
      <div className="flex gap-1.5">
        <Button
          type="button"
          disabled={busy}
          onClick={sendFeedback}
          className={cn(
            "flex-1 h-10 rounded-xl font-bold",
            "bg-gradient-to-r from-primary to-primary/85 text-primary-foreground",
            "shadow-[0_4px_14px_-4px_rgba(217,54,32,0.6)]",
          )}
        >
          <MessageCircle className="mr-1 h-4 w-4" />
          {alreadySent ? "피드백 업데이트" : "피드백 보내기"}
        </Button>
      </div>

      <p className="text-[10.5px] text-muted-foreground">
        <Flame className="inline h-3 w-3 text-primary" /> 회원은 자가 기록 + 즉시 보상 모드입니다. 코치는 응원·코칭 메시지만 보냅니다.
      </p>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────────────
const SmallStat = ({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: "ok" | "muted";
  icon?: React.ReactNode;
}) => (
  <div
    className={cn(
      "flex items-center justify-between rounded-lg border px-2 py-1.5",
      tone === "ok"
        ? "border-primary/30 bg-primary/5 text-primary"
        : "border-border bg-card text-muted-foreground",
    )}
  >
    <span className="flex items-center gap-1 font-bold">
      {icon}
      {label}
    </span>
    <span className="font-black">{value}</span>
  </div>
);

const MetricPill = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => (
  <div className="flex items-center justify-between rounded-lg border border-border bg-card px-2 py-1.5 text-[11.5px]">
    <span className="flex items-center gap-1 text-muted-foreground">
      {icon}
      {label}
    </span>
    <span className="number-font font-bold text-foreground">{value}</span>
  </div>
);

export default DietApprovalCard;
