import { useState } from "react";
import { whiteLevels, WhiteLevelDetail } from "@/data/whiteLevelData";
import { CheckCircle2, Lock, ChevronRight, Clock, Zap, Target, ArrowLeft, Star } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type LevelState = "complete" | "active" | "locked";

const WhiteLeagueTab = () => {
  const { progress } = useAuth();
  const [selectedLevel, setSelectedLevel] = useState<WhiteLevelDetail | null>(null);

  const currentRank = progress?.current_rank || "white";
  const currentLevel = progress?.current_level || 1;

  const getLevelState = (level: number): LevelState => {
    if (currentRank !== "white") return "complete"; // past white league
    if (level < currentLevel) return "complete";
    if (level === currentLevel) return "active";
    return "locked";
  };

  const completedCount = whiteLevels.filter(l => getLevelState(l.level) === "complete").length;
  const progressPct = Math.round((completedCount / whiteLevels.length) * 100);

  if (selectedLevel) {
    return <LevelDetailView level={selectedLevel} state={getLevelState(selectedLevel.level)} onBack={() => setSelectedLevel(null)} />;
  }

  return (
    <div className="space-y-4">
      {/* Progress summary */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-bold text-foreground">⚪ 화이트 리그 진행률</span>
          <span className="text-sm font-bold text-primary">{completedCount}/10</span>
        </div>
        <div className="mb-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
        {/* Progress dots */}
        <div className="flex items-center justify-between gap-1 px-1">
          {whiteLevels.map(l => {
            const state = getLevelState(l.level);
            return (
              <div
                key={l.level}
                className={`h-2 w-2 rounded-full transition-all ${
                  state === "complete" ? "bg-primary" :
                  state === "active" ? "bg-primary animate-pulse ring-2 ring-primary/30" :
                  "bg-muted-foreground/20"
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Level cards */}
      <div className="space-y-2.5">
        {whiteLevels.map((level, idx) => {
          const state = getLevelState(level.level);
          const isLocked = state === "locked";

          return (
            <button
              key={level.level}
              onClick={() => !isLocked && setSelectedLevel(level)}
              disabled={isLocked}
              className={`group w-full animate-slide-up rounded-2xl border p-4 text-left transition-all active:scale-[0.98] ${
                state === "complete"
                  ? "border-primary/20 bg-card shadow-sm"
                  : state === "active"
                  ? "border-primary/40 bg-card shadow-md ring-1 ring-primary/20"
                  : "border-border bg-muted/50 opacity-60"
              }`}
              style={{ animationDelay: `${idx * 0.04}s` }}
            >
              <div className="flex items-center gap-3">
                {/* Level indicator */}
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                  state === "complete"
                    ? "bg-primary/10 text-primary"
                    : state === "active"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {state === "complete" ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : state === "locked" ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    level.level
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground">{level.levelLabel}</span>
                    {level.level === 10 && (
                      <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold text-accent-foreground">리그 승격</span>
                    )}
                  </div>
                  <h3 className={`text-sm font-bold leading-tight ${isLocked ? "text-muted-foreground" : "text-foreground"}`}>
                    {level.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{level.shortGoal}</p>
                </div>

                {/* Meta */}
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs font-bold text-primary">+{level.xpReward} XP</span>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span className="text-[10px]">{level.duration}</span>
                  </div>
                </div>

                {!isLocked && (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ─── Detail View ──────────────────────────────────── */

const LevelDetailView = ({
  level,
  state,
  onBack,
}: {
  level: WhiteLevelDetail;
  state: LevelState;
  onBack: () => void;
}) => {
  const sectionItems = [
    { icon: Target, label: "오늘의 목적", content: level.sections.purpose },
    { icon: Zap, label: "무엇을 하게 되나요", content: level.sections.whatToDo },
    { icon: Star, label: "왜 중요한가", content: level.sections.whyImportant },
    { icon: CheckCircle2, label: "완료 조건", content: level.sections.completionCondition },
  ];

  return (
    <div className="animate-slide-up space-y-4">
      {/* Header */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-bold text-primary active:scale-95">
        <ArrowLeft className="h-4 w-4" /> 목록으로
      </button>

      {/* Illustration placeholder */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 to-accent/10 p-8 text-center">
        <span className="text-5xl">🥊</span>
        <p className="mt-2 text-xs text-muted-foreground">{level.illustrationTitle}</p>
      </div>

      {/* Title block */}
      <div>
        <span className="text-xs font-bold text-primary">{level.levelLabel}</span>
        <h2 className="text-xl font-bold text-foreground">{level.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{level.shortGoal}</p>
      </div>

      {/* Quick stats */}
      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl bg-card border border-border p-3">
          <Clock className="h-4 w-4 text-primary" />
          <div>
            <p className="text-[10px] text-muted-foreground">소요 시간</p>
            <p className="text-sm font-bold text-foreground">{level.duration}</p>
          </div>
        </div>
        <div className="flex flex-1 items-center gap-2 rounded-xl bg-card border border-border p-3">
          <Zap className="h-4 w-4 text-primary" />
          <div>
            <p className="text-[10px] text-muted-foreground">보상</p>
            <p className="text-sm font-bold text-primary">+{level.xpReward} XP</p>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {sectionItems.map(({ icon: Icon, label, content }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold text-foreground">{label}</span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{content}</p>
          </div>
        ))}
      </div>

      {/* 오늘 얻는 가치 box */}
      <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-base">💎</span>
          <span className="text-sm font-bold text-primary">오늘 얻는 가치</span>
        </div>
        <p className="text-sm leading-relaxed text-foreground">{level.valueGained}</p>
      </div>

      {/* Image description */}
      <div className="rounded-xl border border-border bg-muted/50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs">🖼️</span>
          <span className="text-xs font-bold text-muted-foreground">이미지 설명</span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{level.sections.imageDescription}</p>
      </div>

      {/* Status */}
      <div className={`rounded-xl p-3 text-center text-sm font-bold ${
        state === "complete"
          ? "bg-primary/10 text-primary"
          : state === "active"
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground"
      }`}>
        {state === "complete" ? "✅ 완료됨" : state === "active" ? "🥊 현재 진행 중" : "🔒 잠김"}
      </div>
    </div>
  );
};

export default WhiteLeagueTab;
