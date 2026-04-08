import { Lock, Clock, CheckCircle2, Zap } from "lucide-react";
import type { Quest, QuestStatus } from "@/lib/mockData";

const statusConfig: Record<QuestStatus, { label: string; buttonLabel: string; icon: typeof Lock; colorClass: string }> = {
  locked: { label: "잠김", buttonLabel: "잠김", icon: Lock, colorClass: "text-status-locked bg-status-locked/10" },
  active: { label: "진행중", buttonLabel: "도전하기", icon: Zap, colorClass: "text-status-active bg-status-active/10" },
  pending: { label: "승인대기", buttonLabel: "승인대기", icon: Clock, colorClass: "text-status-pending bg-status-pending/10" },
  complete: { label: "완료", buttonLabel: "완료됨", icon: CheckCircle2, colorClass: "text-status-complete bg-status-complete/10" },
};

const QuestCard = ({ quest }: { quest: Quest }) => {
  const cfg = statusConfig[quest.status];
  const Icon = cfg.icon;
  const isLocked = quest.status === "locked";

  return (
    <div
      className={`rounded-2xl border p-4 transition-all ${
        isLocked ? "border-border/50 bg-muted/20 opacity-60" : "border-border bg-card shadow-sm"
      } ${quest.status === "active" ? "border-primary/30" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            {quest.isBoss && <span className="text-sm">🏆</span>}
            <h3 className="text-base font-bold text-foreground">{quest.title}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{quest.description}</p>
          <div className="mt-2.5 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.colorClass}`}>
              <Icon className="h-3 w-3" />
              {cfg.label}
            </span>
            <span className="text-xs font-bold text-primary">+{quest.xpReward} XP</span>
          </div>
        </div>

        {/* Status Button */}
        <button
          disabled={isLocked || quest.status === "complete" || quest.status === "pending"}
          className={`mt-1 shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold transition-all active:scale-95 ${
            quest.status === "active"
              ? "bg-primary text-primary-foreground shadow-md"
              : quest.status === "pending"
              ? "bg-status-pending/15 text-status-pending"
              : quest.status === "complete"
              ? "bg-status-complete/15 text-status-complete"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {quest.status === "active" ? "도전하기" : quest.status === "pending" ? "승인대기" : quest.status === "complete" ? "완료됨" : "잠김"}
        </button>
      </div>
    </div>
  );
};

export default QuestCard;
