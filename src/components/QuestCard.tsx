import { Lock, Clock, CheckCircle2, Zap } from "lucide-react";
import type { Tables, Enums } from "@/integrations/supabase/types";

type SubmissionStatus = Enums<"submission_status"> | null;

interface QuestCardProps {
  quest: Tables<"quests">;
  submissionStatus?: SubmissionStatus;
  onSubmit?: () => void;
  isSubmitting?: boolean;
}

const getDisplayStatus = (quest: Tables<"quests">, submissionStatus: SubmissionStatus) => {
  if (submissionStatus === "approved") return "complete";
  if (submissionStatus === "pending") return "pending";
  if (submissionStatus === "rejected") return "active"; // Can retry
  return "active";
};

const statusConfig = {
  locked: { label: "잠김", buttonLabel: "잠김", icon: Lock, colorClass: "text-status-locked bg-status-locked/10" },
  active: { label: "진행중", buttonLabel: "도전하기", icon: Zap, colorClass: "text-status-active bg-status-active/10" },
  pending: { label: "승인대기", buttonLabel: "승인대기", icon: Clock, colorClass: "text-status-pending bg-status-pending/10" },
  complete: { label: "완료", buttonLabel: "완료됨", icon: CheckCircle2, colorClass: "text-status-complete bg-status-complete/10" },
};

const QuestCard = ({ quest, submissionStatus = null, onSubmit, isSubmitting }: QuestCardProps) => {
  const displayStatus = getDisplayStatus(quest, submissionStatus);
  const cfg = statusConfig[displayStatus];
  const Icon = cfg.icon;

  const canSubmit = displayStatus === "active" && !!onSubmit;

  return (
    <div className={`rounded-2xl border p-4 transition-all ${
      displayStatus === "complete" ? "border-status-complete/20 bg-card shadow-elev-1" :
      displayStatus === "pending" ? "border-status-pending/20 bg-card shadow-elev-1" :
      "border-border bg-card shadow-elev-1"
    } ${displayStatus === "active" ? "border-primary/30" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            {quest.quest_type === "boss" && <span className="text-sm">🏆</span>}
            <h3 className="text-base font-bold text-foreground">{quest.title}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{quest.description}</p>
          <div className="mt-2.5 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.colorClass}`}>
              <Icon className="h-3 w-3" />
              {cfg.label}
            </span>
            <span className="text-xs font-bold text-primary">+{quest.xp_reward} XP</span>
            {quest.needs_coach_approval && (
              <span className="text-xs text-muted-foreground">코치 승인 필요</span>
            )}
          </div>
        </div>

        <button
          onClick={canSubmit ? onSubmit : undefined}
          disabled={!canSubmit || isSubmitting}
          className={`mt-1 shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold transition-all active:scale-95 ${
            canSubmit
              ? "bg-primary text-primary-foreground shadow-md"
              : displayStatus === "pending"
              ? "bg-status-pending/15 text-status-pending"
              : displayStatus === "complete"
              ? "bg-status-complete/15 text-status-complete"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {isSubmitting ? "..." : canSubmit ? (quest.needs_coach_approval ? "완료 요청" : "도전하기") : cfg.buttonLabel}
        </button>
      </div>
    </div>
  );
};

export default QuestCard;
