import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Gift, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { LEAGUE_SUMMARIES, LEVEL_VALUE_MAP, UNLOCK_REWARDS } from "@/data/valueMapData";
import type { Enums } from "@/integrations/supabase/types";

const RANK_ORDER: Enums<"rank_name">[] = ["white", "blue", "red", "black"];

const RANK_BG: Record<string, string> = {
  white: "from-muted/50 to-muted/20",
  blue: "from-rank-blue/10 to-rank-blue/5",
  red: "from-rank-red/10 to-rank-red/5",
  black: "from-rank-black/10 to-rank-black/5",
};

const RankUpPage = () => {
  const navigate = useNavigate();
  const { progress } = useAuth();
  const [expandedRank, setExpandedRank] = useState<string | null>(null);

  const currentRank = progress?.current_rank || "white";
  const currentLevel = progress?.current_level || 1;
  const globalLevel = RANK_ORDER.indexOf(currentRank as Enums<"rank_name">) * 10 + currentLevel;

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-full bg-secondary p-2 active:scale-95">
          <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">랭크업 가치맵</h1>
      </div>

      {/* Current progress */}
      <div className="mb-6 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 p-5 border border-primary/20 text-center">
        <p className="text-sm text-muted-foreground">현재 진행</p>
        <p className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Black Han Sans', sans-serif" }}>
          Lv {globalLevel} / 40
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all"
            style={{ width: `${(globalLevel / 40) * 100}%` }}
          />
        </div>
      </div>

      {/* League cards */}
      <div className="space-y-4">
        {LEAGUE_SUMMARIES.map(league => {
          const isExpanded = expandedRank === league.rank;
          const levels = LEVEL_VALUE_MAP.filter(l => l.rank === league.rank);
          const reward = UNLOCK_REWARDS.find(r => r.rank === league.rank);
          const rankIdx = RANK_ORDER.indexOf(league.rank as Enums<"rank_name">);
          const isCurrentLeague = currentRank === league.rank;
          const isCompleted = RANK_ORDER.indexOf(currentRank as Enums<"rank_name">) > rankIdx;
          const isFuture = RANK_ORDER.indexOf(currentRank as Enums<"rank_name">) < rankIdx;

          return (
            <div key={league.rank} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {/* League header */}
              <button
                onClick={() => setExpandedRank(isExpanded ? null : league.rank)}
                className={`flex w-full items-center justify-between p-4 transition-all active:bg-secondary/30`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${RANK_BG[league.rank]} text-2xl`}>
                    {league.emoji}
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{league.label}</p>
                      {isCompleted && <span className="text-xs text-status-complete">✓ 완료</span>}
                      {isCurrentLeague && <span className="text-xs text-primary font-bold">진행 중</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">{league.theme}</p>
                  </div>
                </div>
                <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-border p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">{league.description}</p>

                  {/* Level timeline */}
                  <div className="space-y-1.5">
                    {levels.map(lv => {
                      const lvGlobal = rankIdx * 10 + (lv.level - rankIdx * 10);
                      const isReached = lv.level <= globalLevel;

                      return (
                        <div key={lv.level} className={`flex items-start gap-3 rounded-xl p-2.5 ${isReached ? "bg-primary/5" : "bg-muted/30"}`}>
                          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                            isReached ? "bg-primary text-primary-foreground" : "bg-border text-muted-foreground"
                          }`}>
                            {lv.level}
                          </div>
                          <p className={`text-sm pt-0.5 ${isReached ? "text-foreground" : "text-muted-foreground"}`}>{lv.title}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Completion values */}
                  <div className="rounded-xl border border-status-complete/20 bg-status-complete/5 p-3">
                    <p className="mb-1.5 text-xs font-bold text-foreground">{league.label} 완료 가치</p>
                    {league.completionValues.map(v => (
                      <p key={v} className="text-xs text-muted-foreground">✓ {v}</p>
                    ))}
                  </div>

                  {/* Unlock rewards */}
                  {reward && (
                    <div className="rounded-xl border border-accent/20 bg-accent/5 p-3">
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <Gift className="h-3.5 w-3.5 text-accent" />
                        <p className="text-xs font-bold text-foreground">Lv {reward.level} 해금 보상</p>
                      </div>
                      {reward.rewards.map(r => (
                        <p key={r} className="text-xs text-muted-foreground">🎁 {r}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RankUpPage;
