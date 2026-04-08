import { useState } from "react";
import { useLevels } from "@/hooks/useQuestData";
import { useMissions, useMyMissionSubmissions } from "@/hooks/useMissionData";
import { useAuth } from "@/contexts/AuthContext";
import RankBadge from "@/components/RankBadge";
import { Lock, Star, Trophy, User, Play, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Tables, Enums } from "@/integrations/supabase/types";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

const RANK_ORDER: Enums<"rank_name">[] = ["white", "blue", "red", "black"];
const RANK_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };
const RANK_ICONS: Record<string, string> = { white: "⚪", blue: "🔵", red: "🔴", black: "⚫" };

const LevelMapPage = () => {
  const [selectedNode, setSelectedNode] = useState<Tables<"levels"> | null>(null);
  const navigate = useNavigate();
  const { progress } = useAuth();
  const { data: levels, isLoading } = useLevels();
  const { data: missions } = useMissions();
  const { data: missionSubs } = useMyMissionSubmissions();

  if (!progress) return null;

  const currentGlobal = RANK_ORDER.indexOf(progress.current_rank as Enums<"rank_name">) * 10 + progress.current_level;
  const subMap = new Map((missionSubs || []).map(s => [s.mission_id, s.status]));

  // Missions for selected node
  const selectedMissions = selectedNode
    ? (missions || []).filter(m => m.level_id === selectedNode.id)
    : [];

  const completedForLevel = (levelId: string) => {
    const levelMissions = (missions || []).filter(m => m.level_id === levelId);
    return levelMissions.filter(m => subMap.get(m.id) === "approved").length;
  };

  const totalForLevel = (levelId: string) => {
    return (missions || []).filter(m => m.level_id === levelId).length;
  };

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl text-foreground">🗺️ 계급도</h1>
        <button onClick={() => navigate("/mypage")} className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-all active:scale-95">
          <User className="h-5 w-5 text-secondary-foreground" />
        </button>
      </div>

      {/* Current position */}
      <div className="mb-5 animate-slide-up rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-muted-foreground">현재 위치</span>
            <p className="text-lg font-bold text-foreground">레벨 {currentGlobal} / 40</p>
          </div>
          <RankBadge rank={progress.current_rank as Enums<"rank_name">} level={progress.current_level} size="lg" />
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-xp-bg">
          <div className="h-full rounded-full bg-xp-bar transition-all" style={{ width: `${(currentGlobal / 40) * 100}%` }} />
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
            const nodes = (levels || []).filter(l => l.rank_name === rank).sort((a, b) => a.level_number - b.level_number);

            return (
              <div key={rank} className="animate-slide-up" style={{ animationDelay: `${sectionIdx * 0.1}s` }}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-lg">{RANK_ICONS[rank]}</span>
                  <h2 className="text-lg text-foreground">{RANK_LABELS[rank]} 벨트</h2>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {nodes.map(node => {
                    const globalLvl = sectionIdx * 10 + node.level_number;
                    const unlocked = globalLvl <= currentGlobal;
                    const isCurrent = globalLvl === currentGlobal;
                    const completed = completedForLevel(node.id);
                    const total = totalForLevel(node.id);
                    const allDone = total > 0 && completed === total;

                    return (
                      <button
                        key={node.id}
                        onClick={() => setSelectedNode(node)}
                        className={`relative flex flex-col items-center justify-center rounded-2xl border-2 p-2 transition-all active:scale-95 ${
                          isCurrent
                            ? "border-primary bg-primary/10 shadow-md"
                            : allDone && unlocked
                            ? "border-status-complete/30 bg-status-complete/5"
                            : unlocked
                            ? "border-border bg-card hover:border-primary/30"
                            : "border-border/30 bg-muted/30 opacity-40"
                        } ${node.is_boss ? "col-span-2 py-3" : ""}`}
                        style={isCurrent ? { animation: "pulse-glow 2s ease-in-out infinite" } : {}}
                      >
                        {node.is_boss ? (
                          <Trophy className={`h-7 w-7 ${unlocked ? "text-accent" : "text-muted-foreground"}`} />
                        ) : allDone && unlocked ? (
                          <CheckCircle2 className="h-4 w-4 text-status-complete" />
                        ) : unlocked ? (
                          <Star className={`h-4 w-4 ${isCurrent ? "text-primary" : "text-muted-foreground"}`} />
                        ) : (
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className={`mt-0.5 text-[10px] font-bold ${isCurrent ? "text-primary" : allDone ? "text-status-complete" : "text-muted-foreground"}`}>
                          {node.is_boss ? "BOSS" : `Lv.${node.level_number}`}
                        </span>
                        {total > 0 && unlocked && (
                          <span className="text-[8px] text-muted-foreground">{completed}/{total}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Drawer */}
      <Drawer open={!!selectedNode} onOpenChange={(open) => !open && setSelectedNode(null)}>
        <DrawerContent className="mx-auto max-w-lg pb-safe">
          <DrawerHeader className="pb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{selectedNode ? RANK_ICONS[selectedNode.rank_name] : ""}</span>
              <DrawerTitle>{selectedNode ? `${RANK_LABELS[selectedNode.rank_name]} Lv.${selectedNode.level_number}` : ""}</DrawerTitle>
              {selectedNode?.is_boss && (
                <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-bold text-accent-foreground">🏆 타이틀매치</span>
              )}
            </div>
          </DrawerHeader>

          {selectedNode && (
            <div className="space-y-3 px-4 pb-6">
              <div className="rounded-xl bg-secondary p-4">
                <p className="text-sm font-bold text-foreground">{selectedNode.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">필요 XP: {selectedNode.xp_required}</p>
              </div>

              {selectedNode.reward_name && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">보상:</span>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{selectedNode.reward_name}</span>
                </div>
              )}

              {selectedMissions.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-bold text-muted-foreground">미션 목록</p>
                  <div className="space-y-2">
                    {selectedMissions.map(m => {
                      const status = subMap.get(m.id);
                      return (
                        <div key={m.id} className="flex items-center justify-between rounded-xl bg-background p-3">
                          <div className="flex items-center gap-2">
                            {status === "approved" ? (
                              <CheckCircle2 className="h-4 w-4 text-status-complete" />
                            ) : status === "pending" ? (
                              <span className="text-xs text-status-pending">⏳</span>
                            ) : (
                              <Play className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="text-sm text-foreground">{m.title}</span>
                          </div>
                          <span className="text-xs font-bold text-primary">+{m.xp_reward} XP</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                onClick={() => { setSelectedNode(null); navigate("/missions"); }}
                className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md transition-all active:scale-[0.98]"
              >
                미션 보러가기
              </button>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default LevelMapPage;
