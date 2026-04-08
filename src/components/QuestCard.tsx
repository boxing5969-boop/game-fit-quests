import { Lock, Clock, CheckCircle2, Zap } from "lucide-react";
import type { Quest, QuestStatus } from "@/lib/mockData";

const statusConfig: Record<QuestStatus, { label: string; icon: typeof Lock; colorClass: string }> = {
  locked: { label: "잠김", icon: Lock, colorClass: "text-status-locked bg-status-locked/10" },
  active: { label: "진행중", icon: Zap, colorClass: "text-status-active bg-status-active/10" },
  pending: { label: "승인대기", icon: Clock, colorClass: "text-status-pending bg-status-pending/10" },
  complete: { label: "완료", icon: CheckCircle2, colorClass: "text-status-complete bg-status-complete/10" },
};

const QuestCard = ({ quest }: { quest: Quest }) => {
  const cfg = statusConfig[quest.status];
  const Icon = cfg.icon;
  const isLocked = quest.status === "locked";

  return (
    <div
      className={`animate-slide-up rounded-xl border border-border p-4 transition-all ${
        isLocked ? "opacity-50" : "bg-card"
      } ${quest.status === "active" ? "glow-gold border-primary/30" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            {quest.isBoss && <span className="text-sm">🏆</span>}
            <h3 className="font-display text-base font-bold">{quest.title}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{quest.description}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.colorClass}`}>
              <Icon className="h-3 w-3" />
              {cfg.label}
            </span>
            <span className="text-xs font-display text-primary">+{quest.xpReward} XP</span>
          </div>
        </div>
        {quest.status === "active" && (
          <button className="mt-1 rounded-lg bg-primary px-4 py-2 font-display text-sm font-bold text-primary-foreground transition-transform active:scale-95">
            시작
          </button>
        )}
      </div>
    </div>
  );
};

export default QuestCard;
