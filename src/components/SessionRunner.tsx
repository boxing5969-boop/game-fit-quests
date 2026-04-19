// ═══════════════════════════════════════════════════════
// SessionRunner — 50분 수업 실행 타이머
// ═══════════════════════════════════════════════════════
import { useState } from "react";
import { useSessionTracker } from "@/hooks/useSessionTracker";
import { useLocalProgress } from "@/hooks/useLocalProgress";
import { calculateSessionXp } from "@/data/levelRuleEngine";
import type { SessionBlock } from "@/data/whiteLevel1Data";
import { Play, Pause, Square, CheckCircle2, Clock, Zap } from "lucide-react";
import { toast } from "sonner";
import { celebrateSmall } from "@/lib/celebrations";

const INTENSITY_OPTIONS = [
  { value: "easy" as const, label: "가볍게", emoji: "😊", color: "bg-status-complete/10 text-status-complete" },
  { value: "normal" as const, label: "보통", emoji: "💪", color: "bg-primary/10 text-primary" },
  { value: "hard" as const, label: "조금 힘듦", emoji: "🔥", color: "bg-status-pending/10 text-status-pending" },
];

interface SessionRunnerProps {
  blocks: SessionBlock[];
  levelLabel: string;
  onComplete?: () => void;
}

const SessionRunner = ({ blocks, levelLabel, onComplete }: SessionRunnerProps) => {
  const tracker = useSessionTracker(blocks);
  const { recordSession } = useLocalProgress();
  const [showResult, setShowResult] = useState<{ minutes: number; xp: number; qualifies: boolean } | null>(null);

  const handleFinish = () => {
    const result = tracker.finishSession();
    const xp = calculateSessionXp(result.actualMinutes);
    const qualifies = result.actualMinutes >= 45;

    recordSession(result.actualMinutes, result.completedBlocks, result.intensity);

    setShowResult({ minutes: result.actualMinutes, xp, qualifies });

    if (xp > 0) {
      celebrateSmall();
      toast.success(`+${xp} XP 획득! 🥊`);
    }
  };

  // Result screen
  if (showResult) {
    return (
      <div className="animate-slide-up space-y-4">
        <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-reward/10 p-6 text-center">
          <span className="text-5xl">🥊</span>
          <h3 className="mt-3 text-xl font-bold text-foreground">수업 완료!</h3>
          <p className="mt-1 text-sm text-muted-foreground">{levelLabel}</p>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-2xl border border-border bg-card p-3 text-center">
            <Clock className="mx-auto h-5 w-5 text-primary" />
            <p className="mt-1 text-lg font-bold text-foreground">{showResult.minutes}분</p>
            <p className="text-[10px] text-muted-foreground">실제 훈련</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3 text-center">
            <Zap className="mx-auto h-5 w-5 text-primary" />
            <p className="mt-1 text-lg font-bold text-primary">+{showResult.xp}</p>
            <p className="text-[10px] text-muted-foreground">XP 획득</p>
          </div>
          <div className={`rounded-2xl border p-3 text-center ${showResult.qualifies ? "border-status-complete/30 bg-status-complete/5" : "border-border bg-card"}`}>
            <CheckCircle2 className={`mx-auto h-5 w-5 ${showResult.qualifies ? "text-status-complete" : "text-muted-foreground"}`} />
            <p className="mt-1 text-sm font-bold text-foreground">{showResult.qualifies ? "인정" : "미인정"}</p>
            <p className="text-[10px] text-muted-foreground">레벨업 세션</p>
          </div>
        </div>

        {!showResult.qualifies && showResult.minutes > 0 && (
          <div className="rounded-xl bg-status-pending/10 px-4 py-2.5">
            <p className="text-xs text-status-pending">⚠️ 45분 이상이어야 레벨업용 인정 세션이 됩니다</p>
          </div>
        )}

        <button
          onClick={() => { setShowResult(null); onComplete?.(); }}
          className="w-full rounded-2xl bg-primary py-4 text-sm font-bold text-primary-foreground transition-all active:scale-[0.98]"
        >
          확인
        </button>
      </div>
    );
  }

  // Not started
  if (!tracker.isActive) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-reward/5 p-5 text-center">
          <span className="text-4xl">🥊</span>
          <h3 className="mt-2 text-lg font-bold text-foreground">{levelLabel} 수업</h3>
          <p className="text-sm text-muted-foreground">50분 프로그램</p>
          <p className="mt-1 text-xs text-muted-foreground">블록을 따라가며 수업을 진행하세요</p>
        </div>
        <button
          onClick={tracker.startSession}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-lg font-bold text-primary-foreground shadow-lg transition-all active:scale-[0.98]"
        >
          <Play className="h-5 w-5" /> 수업 시작
        </button>
      </div>
    );
  }

  // Active session
  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      {/* Timer */}
      <div className="rounded-2xl border-2 border-primary/30 bg-card p-5 text-center shadow-elev-1">
        <p className="text-xs text-muted-foreground">{levelLabel}</p>
        <p className="mt-1 text-4xl font-bold tabular-nums text-foreground" style={{ fontFamily: "monospace" }}>
          {formatTime(tracker.elapsedSeconds)}
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${tracker.progressPct}%` }} />
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {tracker.elapsedMinutes}/{tracker.totalPlannedMinutes}분 · 완료 블록 {tracker.completedBlocks.length}/{blocks.length}
        </p>

        <div className="mt-3 flex justify-center gap-3">
          <button onClick={tracker.pauseSession} className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary transition-all active:scale-90">
            {tracker.isPaused ? <Play className="h-5 w-5 text-primary" /> : <Pause className="h-5 w-5 text-secondary-foreground" />}
          </button>
          <button onClick={handleFinish} className="flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground transition-all active:scale-95">
            <Square className="h-4 w-4" /> 수업 종료
          </button>
          <button onClick={tracker.cancelSession} className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 transition-all active:scale-90">
            <Square className="h-4 w-4 text-destructive" />
          </button>
        </div>
      </div>

      {/* Intensity */}
      <div className="flex gap-2">
        {INTENSITY_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => tracker.setIntensity(opt.value)}
            className={`flex-1 rounded-xl border p-2.5 text-center transition-all ${
              tracker.intensity === opt.value
                ? `border-primary/30 ${opt.color}`
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            <span className="text-lg">{opt.emoji}</span>
            <p className="text-[10px] font-bold">{opt.label}</p>
          </button>
        ))}
      </div>

      {/* Block toggles */}
      <div className="space-y-2">
        {blocks.map(block => {
          const done = tracker.completedBlocks.includes(block.id);
          return (
            <button
              key={block.id}
              onClick={() => tracker.toggleBlock(block.id)}
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all active:scale-[0.98] ${
                done ? "border-status-complete/30 bg-status-complete/5" : "border-border bg-card"
              }`}
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${done ? "bg-status-complete text-white" : "bg-muted"}`}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-sm">{block.emoji}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-bold ${done ? "text-status-complete" : "text-foreground"}`}>{block.title}</p>
                <p className="text-[10px] text-muted-foreground">{block.timeRange} · {block.durationMin}분</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SessionRunner;
