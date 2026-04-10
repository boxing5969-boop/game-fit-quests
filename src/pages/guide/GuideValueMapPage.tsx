import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronUp, Gift } from "lucide-react";
import { LEAGUE_SUMMARIES, LEVEL_VALUE_MAP, UNLOCK_REWARDS } from "@/data/valueMapData";

const RANK_COLORS: Record<string, string> = {
  white: "border-muted",
  blue: "border-rank-blue",
  red: "border-rank-red",
  black: "border-rank-black",
};

const GuideValueMapPage = () => {
  const navigate = useNavigate();
  const [expandedRank, setExpandedRank] = useState<string | null>("white");

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
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
            className={`rounded-2xl border-2 bg-card p-3 text-left shadow-sm transition-all active:scale-[0.98] ${
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
        const levels = LEVEL_VALUE_MAP.filter(l => l.rank === league.rank);
        const reward = UNLOCK_REWARDS.find(r => r.rank === league.rank);
        const summary = league;

        return (
          <div key={league.rank} className="mb-6 animate-slide-up">
            {/* Level list */}
            <div className="mb-4 space-y-1.5">
              {levels.map(lv => (
                <div key={lv.level} className="flex items-start gap-3 rounded-xl bg-card p-3 border border-border shadow-sm">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                    {lv.level}
                  </div>
                  <p className="text-sm text-foreground leading-snug pt-1">{lv.title}</p>
                </div>
              ))}
            </div>

            {/* Completion values */}
            <div className="mb-4 rounded-2xl border border-status-complete/30 bg-status-complete/5 p-4 shadow-sm">
              <p className="mb-2 text-sm font-bold text-foreground">{summary.label} 완료 가치</p>
              <div className="space-y-1">
                {summary.completionValues.map(v => (
                  <p key={v} className="text-xs text-muted-foreground">✓ {v}</p>
                ))}
              </div>
            </div>

            {/* Unlock reward */}
            {reward && (
              <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-2">
                  <Gift className="h-4 w-4 text-accent" />
                  <p className="text-sm font-bold text-foreground">Lv {reward.level} 해금 보상</p>
                </div>
                <div className="space-y-1">
                  {reward.rewards.map(r => (
                    <p key={r} className="text-xs text-muted-foreground">🎁 {r}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default GuideValueMapPage;
