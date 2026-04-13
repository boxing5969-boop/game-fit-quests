// ═══════════════════════════════════════════════════════
// SelfChallengeFlow — 원탭 시작/종료 오늘 도전 모드
// 운동 중 폰 조작 최소화: 시작 1탭 + 종료 1탭
// ═══════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocalProgress } from "@/hooks/useLocalProgress";
import { calculateSessionXp, isQualifyingSession } from "@/data/levelRuleEngine";
import { getLevelById, SELF_CHALLENGE_BONUS_XP, type UnifiedLevel, type RoutineBlock } from "@/data/allLevelsData";
import { Play, Square, Clock, Zap, CheckCircle2, Trophy, Flame, ChevronDown, LogOut } from "lucide-react";
import { toast } from "sonner";
import { celebrateSmall } from "@/lib/celebrations";

type FlowState = "ready" | "active" | "result";

interface SelfChallengeFlowProps {
  league: string;
  levelInLeague: number;
  onComplete?: () => void;
  onClose?: () => void;
  /** Called when user wants to leave the live board without completing */
  onLeave?: () => void;
  /** When true, skip "ready" screen and immediately start the timer (used after QR checkin) */
  autoStart?: boolean;
  /** If resuming an existing session, pass its started_at timestamp */
  resumeStartedAt?: string;
}

const SelfChallengeFlow = ({ league, levelInLeague, onComplete, onClose, onLeave, autoStart, resumeStartedAt }: SelfChallengeFlowProps) => {
  const level = getLevelById(league, levelInLeague);
  const { recordSession, recordSelfChallenge } = useLocalProgress();
  const [state, setState] = useState<FlowState>(autoStart ? "active" : "ready");
  const [startTime, setStartTime] = useState<number | null>(
    autoStart ? (resumeStartedAt ? new Date(resumeStartedAt).getTime() : Date.now()) : null
  );
  const [elapsed, setElapsed] = useState(0);
  const [showRoutineA, setShowRoutineA] = useState(true);
  const [routineExpanded, setRoutineExpanded] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const [result, setResult] = useState<{
    minutes: number; xp: number; bonusXp: number; qualifies: boolean; streak: number;
  } | null>(null);

  // Timer
  useEffect(() => {
    if (state === "active" && startTime) {
      intervalRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state, startTime]);

  const handleStart = useCallback(() => {
    setStartTime(Date.now());
    setState("active");
    toast.success("🥊 오늘 도전 시작!");
  }, []);

  const handleFinish = useCallback(() => {
    if (!startTime) return;
    if (intervalRef.current) clearInterval(intervalRef.current);

    const actualMinutes = Math.floor((Date.now() - startTime) / 60000);
    const xp = calculateSessionXp(actualMinutes);
    const qualifies = isQualifyingSession(actualMinutes);
    const bonusXp = qualifies ? SELF_CHALLENGE_BONUS_XP : 0;

    // Record to local progress
    recordSession(actualMinutes, [], "normal");
    const streak = recordSelfChallenge(actualMinutes, xp, bonusXp);

    setResult({ minutes: actualMinutes, xp, bonusXp, qualifies, streak });
    setState("result");

    if (xp > 0) {
      celebrateSmall();
    }
  }, [startTime, recordSession, recordSelfChallenge]);

  if (!level) return null;

  const routine = showRoutineA ? level.routineA : level.routineB;
  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const elapsedMin = Math.floor(elapsed / 60);
  const progressPct = Math.min(100, (elapsedMin / 50) * 100);

  // ─── Ready State ───
  if (state === "ready") {
    return (
      <div className="space-y-4 animate-slide-up">
        {/* Level info */}
        <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-accent/10 p-5 text-center">
          <span className="text-4xl">🥊</span>
          <h3 className="mt-2 text-lg font-bold text-foreground">{level.title}</h3>
          <p className="text-sm text-muted-foreground">{level.shortGoal}</p>
          <div className="mt-2 flex items-center justify-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> 50분</span>
            <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-primary" /> +100 XP</span>
            <span className="flex items-center gap-1"><Flame className="h-3 w-3 text-status-pending" /> +{SELF_CHALLENGE_BONUS_XP} 보너스</span>
          </div>
        </div>

        {/* Self-challenge bonus explainer */}
        <div className="rounded-xl bg-status-complete/5 border border-status-complete/20 px-4 py-3">
          <p className="text-xs font-bold text-status-complete mb-1">🏆 오늘 도전 보너스</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            오늘 도전으로 완료하면 추가 {SELF_CHALLENGE_BONUS_XP}XP와 연속 기록을 얻을 수 있어요.
            레벨업 진행은 동일하지만, 적극적인 참여에 보너스 보상이 주어집니다.
          </p>
        </div>

        {/* Routine selector */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowRoutineA(true)}
            className={`flex-1 rounded-xl border py-2.5 text-xs font-bold transition-all ${showRoutineA ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}
          >
            루틴 A
          </button>
          <button
            onClick={() => setShowRoutineA(false)}
            className={`flex-1 rounded-xl border py-2.5 text-xs font-bold transition-all ${!showRoutineA ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}
          >
            루틴 B
          </button>
        </div>

        {/* Routine preview (collapsible) */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <button onClick={() => setRoutineExpanded(!routineExpanded)} className="flex w-full items-center justify-between p-4 text-left">
            <span className="text-sm font-bold text-foreground">📋 오늘의 추천 루틴</span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${routineExpanded ? "rotate-180" : ""}`} />
          </button>
          {routineExpanded && (
            <div className="border-t border-border px-4 pb-4 space-y-2">
              {routine.map((block, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-muted/30 p-2.5">
                  <span className="text-lg">{block.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground">{block.title}</p>
                    <p className="text-[10px] text-muted-foreground">{block.durationMin}분 · {block.drills.slice(0, 2).join(", ")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Start button */}
        <button
          onClick={handleStart}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-5 text-lg font-bold text-primary-foreground shadow-lg transition-all active:scale-[0.97]"
          style={{ fontFamily: "'Black Han Sans', sans-serif" }}
        >
          <Play className="h-6 w-6" /> 오늘 도전 시작
        </button>

        {onClose && (
          <button onClick={onClose} className="w-full text-center text-xs text-muted-foreground py-2">
            닫기
          </button>
        )}
      </div>
    );
  }

  // ─── Active State ───
  if (state === "active") {
    return (
      <div className="space-y-5 animate-slide-up">
        {/* Timer - large and centered, minimal distraction */}
        <div className="rounded-2xl border-2 border-primary/30 bg-card p-6 text-center shadow-md">
          <p className="text-xs text-muted-foreground mb-1">{level.title}</p>
          <p className="text-5xl font-bold tabular-nums text-foreground" style={{ fontFamily: "monospace" }}>
            {formatTime(elapsed)}
          </p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {elapsedMin}분 경과 · {elapsedMin >= 45 ? "✅ 인정 세션" : `${45 - elapsedMin}분 후 인정`}
          </p>
        </div>

        {/* Minimal info */}
        <div className="rounded-xl bg-muted/30 px-4 py-3">
          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            🥊 운동에 집중하세요. 끝나면 아래 버튼을 눌러주세요.
          </p>
        </div>

        {/* Finish button */}
        <button
          onClick={handleFinish}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-5 text-lg font-bold text-primary-foreground shadow-lg transition-all active:scale-[0.97]"
          style={{ fontFamily: "'Black Han Sans', sans-serif" }}
        >
          <Square className="h-5 w-5" /> 오늘 도전 완료
        </button>

        {/* Leave button */}
        {onLeave && (
          <button
            onClick={onLeave}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-muted py-3.5 text-sm font-bold text-muted-foreground transition-all active:scale-[0.97]"
          >
            <LogOut className="h-4 w-4" /> 라이브보드 나가기
          </button>
        )}
      </div>
    );
  }

  // ─── Result State ───
  if (state === "result" && result) {
    return (
      <div className="space-y-4 animate-slide-up">
        <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-accent/10 p-6 text-center">
          <span className="text-5xl">🎉</span>
          <h3 className="mt-3 text-xl font-bold text-foreground">오늘 도전 완료!</h3>
          <p className="mt-1 text-sm text-muted-foreground">{level.title}</p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <ResultCard icon={<Clock className="h-5 w-5 text-primary" />} value={`${result.minutes}분`} label="실제 훈련" />
          <ResultCard icon={<Zap className="h-5 w-5 text-primary" />} value={`+${result.xp}`} label="기본 XP" highlight />
          <ResultCard icon={<Flame className="h-5 w-5 text-status-pending" />} value={`+${result.bonusXp}`} label="오늘 도전 보너스" highlight={result.bonusXp > 0} />
          <ResultCard icon={<Trophy className="h-5 w-5 text-accent" />} value={`${result.streak}회`} label="오늘 도전 연속" />
        </div>

        {result.qualifies ? (
          <div className="rounded-xl bg-status-complete/10 border border-status-complete/20 px-4 py-3">
            <p className="text-xs font-bold text-status-complete">✅ 레벨업용 인정 세션</p>
            <p className="text-[11px] text-muted-foreground">이 세션은 레벨업 진행에 인정됩니다</p>
          </div>
        ) : result.minutes > 0 ? (
          <div className="rounded-xl bg-status-pending/10 border border-status-pending/20 px-4 py-3">
            <p className="text-xs text-status-pending">⚠️ 45분 이상이어야 레벨업용 인정 세션이 됩니다</p>
          </div>
        ) : null}

        <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
          <p className="text-xs font-bold text-primary mb-1">💡 총 획득</p>
          <p className="text-sm font-bold text-foreground">
            +{result.xp + result.bonusXp} XP
            {result.bonusXp > 0 && <span className="text-status-pending ml-1">(보너스 포함)</span>}
          </p>
        </div>

        <button
          onClick={() => { setState("ready"); onComplete?.(); }}
          className="w-full rounded-2xl bg-primary py-4 text-sm font-bold text-primary-foreground transition-all active:scale-[0.98]"
        >
          확인
        </button>
      </div>
    );
  }

  return null;
};

const ResultCard = ({ icon, value, label, highlight }: { icon: React.ReactNode; value: string; label: string; highlight?: boolean }) => (
  <div className={`rounded-2xl border p-3 text-center ${highlight ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
    <div className="mx-auto mb-1">{icon}</div>
    <p className={`text-lg font-bold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
    <p className="text-[10px] text-muted-foreground">{label}</p>
  </div>
);

export default SelfChallengeFlow;
