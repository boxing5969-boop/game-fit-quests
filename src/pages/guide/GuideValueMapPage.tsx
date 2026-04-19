import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, Gift, Lock, CheckCircle2 } from "lucide-react";
import { LEAGUE_SUMMARIES, FULL_VALUE_MAP } from "@/data/valueMapData";
import { useAuth } from "@/contexts/AuthContext";

const RANK_COLORS: Record<string, string> = {
  white: "border-muted",
  blue: "border-rank-blue",
  red: "border-rank-red",
  black: "border-rank-black",
};

const RANK_ORDER = ["white", "blue", "red", "black"];

const GuideValueMapPage = () => {
  const navigate = useNavigate();
  const { progress } = useAuth();
  const [expandedRank, setExpandedRank] = useState<string | null>("white");

  const currentRank = progress?.current_rank || "white";
  const currentLevel = progress?.current_level || 1;
  const currentGlobal = RANK_ORDER.indexOf(currentRank) * 10 + currentLevel;

  return (
    <div className="light-surface min-h-screen mx-auto max-w-lg px-4 pb-24 pt-4">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate("/guide")} className="rounded-full bg-secondary p-2 active:scale-95">
          <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">1~40 가치맵</h1>
      </div>

      <p className="mb-5 text-sm text-muted-foreground">각 레벨에서 무엇을 얻게 되는지 확인하세요.</p>

      {/* League summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-2.5">
        {LEAGUE_SUMMARIES.map(league => (
          <button
            key={league.rank}
            onClick={() => setExpandedRank(expandedRank === league.rank ? null : league.rank)}
            className={`rounded-2xl border-2 bg-card p-3 text-left shadow-elev-1 transition-all active:scale-[0.98] ${
              expandedRank === league.rank ? RANK_COLORS[league.rank] : "border-border"
            }`}
          >
            <span className="text-xl">{league.emoji}</span>
            <p className="mt-1 text-sm font-bold text-foreground">{league.label}</p>
            <p className="text-[10px] text-muted-foreground">{league.levels}</p>
            <p className="mt-1 text-[10px] text-primary">{league.theme}</p>
          </button>
        ))}
      </div>

      {/* Expanded level timeline */}
      {LEAGUE_SUMMARIES.map(league => {
        if (expandedRank !== league.rank) return null;
        const levels = FULL_VALUE_MAP.filter(l => l.league === league.rank);

        return (
          <div key={league.rank} className="mb-6 animate-slide-up">
            <div className="mb-4 space-y-1.5">
              {levels.map(lv => {
                const isComplete = lv.level < currentGlobal;
                const isCurrent = lv.level === currentGlobal;
                return (
                  <div key={lv.level} className={`flex items-start gap-3 rounded-xl bg-card p-3 border border-border shadow-elev-1 ${isCurrent ? "ring-1 ring-primary/30" : ""}`}>
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                      isComplete ? "bg-primary text-primary-foreground" :
                      isCurrent ? "bg-primary text-primary-foreground animate-pulse" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {isComplete ? <CheckCircle2 className="h-4 w-4" /> : lv.level}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-bold ${isComplete || isCurrent ? "text-foreground" : "text-muted-foreground"}`}>{lv.shortValueTitle}</p>
                      <p className="text-[11px] text-muted-foreground">{lv.valueDescription}</p>
                      <span className="mt-1 inline-block rounded-full bg-reward/10 px-2 py-0.5 text-[9px] font-bold text-reward-foreground">
                        🔓 {lv.unlockedBenefit}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Completion values */}
            <div className="mb-4 rounded-2xl border border-status-complete/30 bg-status-complete/5 p-4 shadow-elev-1">
              <p className="mb-2 text-sm font-bold text-foreground">{league.label} 완료 가치</p>
              <div className="space-y-1">
                {league.completionValues.map(v => (
                  <p key={v} className="text-xs text-muted-foreground">✓ {v}</p>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default GuideValueMapPage;
