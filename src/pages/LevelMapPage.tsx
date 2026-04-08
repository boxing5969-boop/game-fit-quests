import { useState } from "react";
import { useLevels } from "@/hooks/useQuestData";
import { useAuth } from "@/contexts/AuthContext";
import RankBadge from "@/components/RankBadge";
import { Lock, Star, Trophy, X, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Tables, Enums } from "@/integrations/supabase/types";

const RANK_ORDER: Enums<"rank_name">[] = ["white", "blue", "red", "black"];
const RANK_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };
const RANK_ICONS: Record<string, string> = { white: "⚪", blue: "🔵", red: "🔴", black: "⚫" };

const LevelMapPage = () => {
  const [selectedNode, setSelectedNode] = useState<Tables<"levels"> | null>(null);
  const navigate = useNavigate();
  const { progress } = useAuth();
  const { data: levels, isLoading } = useLevels();

  if (!progress) return null;

  const currentGlobal = RANK_ORDER.indexOf(progress.current_rank as Enums<"rank_name">) * 10 + progress.current_level;

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl text-foreground">🗺️ 레벨맵</h1>
        <button onClick={() => navigate("/mypage")} className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-all active:scale-95">
          <User className="h-5 w-5 text-secondary-foreground" />
        </button>
      </div>

      <div className="mb-5 animate-slide-up rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">현재 위치</span>
          <RankBadge rank={progress.current_rank as Enums<"rank_name">} level={progress.current_level} size="lg" />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="space-y-2">
              <div className="h-6 w-32 animate-pulse rounded bg-muted" />
              <div className="grid grid-cols-5 gap-2">
                {Array(10).fill(0).map((_, j) => <div key={j} className="h-16 animate-pulse rounded-2xl bg-muted" />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {RANK_ORDER.map((rank, sectionIdx) => {
            const nodes = (levels || []).filter(l => l.rank_name === rank);
            const hasUnlocked = sectionIdx * 10 < currentGlobal;

            return (
              <div key={rank} className="animate-slide-up" style={{ animationDelay: `${sectionIdx * 0.1}s` }}>
                <div className={`mb-3 flex items-center gap-2 ${!hasUnlocked && sectionIdx > 0 ? "opacity-40" : ""}`}>
                  <span className="text-lg">{RANK_ICONS[rank]}</span>
                  <h2 className="text-lg text-foreground">{RANK_LABELS[rank]} 벨트</h2>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {nodes.map(node => {
                    const globalLvl = sectionIdx * 10 + node.level_number;
                    const unlocked = globalLvl <= currentGlobal;
                    const isCurrent = globalLvl === currentGlobal;

                    return (
                      <button
                        key={node.id}
                        onClick={() => setSelectedNode(node)}
                        className={`flex flex-col items-center justify-center rounded-2xl border-2 p-2.5 transition-all active:scale-95 ${
                          isCurrent
                            ? "border-primary bg-primary/10 shadow-md"
                            : unlocked
                            ? "border-border bg-card hover:border-primary/30"
                            : "border-border/30 bg-muted/30 opacity-40"
                        } ${node.is_boss ? "col-span-2" : ""}`}
                        style={isCurrent ? { animation: "pulse-glow 2s ease-in-out infinite" } : {}}
                      >
                        {node.is_boss ? (
                          <Trophy className={`h-6 w-6 ${unlocked ? "text-accent" : "text-muted-foreground"}`} />
                        ) : unlocked ? (
                          <Star className={`h-4 w-4 ${isCurrent ? "text-primary" : "text-muted-foreground"}`} />
                        ) : (
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className={`mt-0.5 text-[10px] font-bold ${isCurrent ? "text-primary" : "text-muted-foreground"}`}>
                          {node.is_boss ? "BOSS" : `Lv.${node.level_number}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedNode && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-sm" onClick={() => setSelectedNode(null)}>
          <div className="w-full max-w-lg animate-slide-up rounded-t-3xl border-t border-border bg-card p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{RANK_ICONS[selectedNode.rank_name]}</span>
                <h3 className="text-lg text-foreground">{RANK_LABELS[selectedNode.rank_name]} Lv.{selectedNode.level_number}</h3>
              </div>
              <button onClick={() => setSelectedNode(null)} className="rounded-full bg-secondary p-2 active:scale-95">
                <X className="h-4 w-4 text-secondary-foreground" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="rounded-xl bg-secondary p-4">
                <p className="text-sm font-bold text-foreground">{selectedNode.title}</p>
                {selectedNode.is_boss && (
                  <span className="mt-1 inline-block rounded-full bg-accent/20 px-2 py-0.5 text-xs font-bold text-accent-foreground">🏆 타이틀매치</span>
                )}
              </div>
              {selectedNode.reward_name && (
                <div>
                  <p className="mb-2 text-xs font-bold text-muted-foreground">보상</p>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{selectedNode.reward_name}</span>
                </div>
              )}
              <div className="rounded-xl bg-secondary p-3 text-center">
                <p className="text-xs text-muted-foreground">필요 XP</p>
                <p className="text-lg font-bold text-foreground">{selectedNode.xp_required} XP</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LevelMapPage;
