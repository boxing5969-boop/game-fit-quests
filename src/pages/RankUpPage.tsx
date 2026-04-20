import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Gift, ChevronDown, Lock, Star, Trophy, User, Play, CheckCircle2, ArrowUp, Crown, Sparkles, ExternalLink, X, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { LEAGUE_SUMMARIES, FULL_VALUE_MAP } from "@/data/valueMapData";
import { useLevels, useManualLevelUp, usePassBossBattle } from "@/hooks/useQuestData";
import { useMissions, useMyMissionSubmissions } from "@/hooks/useMissionData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import RankBadge from "@/components/RankBadge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { isManagerRole } from "@/lib/rankLabels";
import type { Tables, Enums } from "@/integrations/supabase/types";
import { useLocalProgress } from "@/hooks/useLocalProgress";
import { PROMOTION_METRICS, RECOMMENDED_PATHS } from "@/data/whiteLevel1Data";
import { RANK_ORDER, RANK_LABELS, RANK_ICONS, SECRET_MISSIONS, DAN_CHALLENGES, FINAL_REWARDS } from "@/data/sharedConstants";
const RANK_BG: Record<string, string> = {
  white: "from-muted/50 to-muted/20",
  blue: "from-rank-blue/10 to-rank-blue/5",
  red: "from-rank-red/10 to-rank-red/5",
  black: "from-rank-black/10 to-rank-black/5",
};

type TabType = "valuemap" | "levelmap";

const RankUpPage = () => {
  const navigate = useNavigate();
  const { progress, role, user, refreshProgress } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("levelmap");
  const [expandedRank, setExpandedRank] = useState<string | null>(null);

  // LevelMap state
  const [selectedNode, setSelectedNode] = useState<Tables<"levels"> | null>(null);
  const [showSecretDetail, setShowSecretDetail] = useState<typeof SECRET_MISSIONS[0] | null>(null);
  const [danChallengeOpen, setDanChallengeOpen] = useState<typeof DAN_CHALLENGES[0] | null>(null);
  const isManager = isManagerRole(role);
  const { data: levels, isLoading } = useLevels();
  const { data: missions } = useMissions();
  const { data: missionSubs } = useMyMissionSubmissions();
  const levelUpMutation = useManualLevelUp();
  const bossBattleMutation = usePassBossBattle();
  const qc = useQueryClient();
  const isAdmin = role === "admin" || role === "super_admin";

  const [editLevelModal, setEditLevelModal] = useState(false);
  const [editLevelForm, setEditLevelForm] = useState({ title: "", xp_required: 0, reward_name: "", is_boss: false });
  const [editLevelSaving, setEditLevelSaving] = useState(false);

  const currentRank = progress?.current_rank || "white";
  const currentLevel = progress?.current_level || 1;
  const globalLevel = RANK_ORDER.indexOf(currentRank as Enums<"rank_name">) * 10 + currentLevel;
  const currentGlobal = isManager ? 40 : globalLevel;
  const subMap = new Map((missionSubs || []).map(s => [s.mission_id, s.status]));
  const isMaxLevel = isManager || (progress?.current_rank === "black" && progress?.current_level === 10);

  const selectedMissions = selectedNode ? (missions || []).filter(m => m.level_id === selectedNode.id) : [];

  const completedForLevel = (levelId: string) => {
    const levelMissions = (missions || []).filter(m => m.level_id === levelId);
    if (isManager) return levelMissions.length;
    return levelMissions.filter(m => subMap.get(m.id) === "approved").length;
  };
  const totalForLevel = (levelId: string) => (missions || []).filter(m => m.level_id === levelId).length;

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">랭크업</h1>
        <button onClick={() => navigate("/mypage")} className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-all active:scale-95">
          <User className="h-5 w-5 text-secondary-foreground" />
        </button>
      </div>

      {/* Tab switcher */}
      <div className="mb-5 flex rounded-2xl border border-border bg-muted/30 p-1">
        <button
          onClick={() => setActiveTab("levelmap")}
          className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${activeTab === "levelmap" ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground"}`}
        >
          🗺️ 리그맵
        </button>
        <button
          onClick={() => setActiveTab("valuemap")}
          className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${activeTab === "valuemap" ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground"}`}
        >
          📋 가치맵
        </button>
      </div>

      {/* Current progress */}
      <div className="mb-6 rounded-2xl bg-gradient-to-br from-primary/10 to-reward/10 p-5 border border-primary/20 shadow-glow-soft text-center">
        <p className="text-sm text-muted-foreground">현재 진행</p>
        <p className="text-3xl font-bold text-foreground">
          {isManager ? "👑 마스터" : `Lv ${globalLevel} / 40`}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-reward transition-all" style={{ width: `${(currentGlobal / 40) * 100}%` }} />
        </div>
      </div>

      {/* White Lv.1 → Lv.2 Progression Card */}
      {currentRank === "white" && currentLevel === 1 && !isManager && (
        <WhiteLv1ProgressionCard />
      )}

      {activeTab === "valuemap" ? (
        /* ════ Value Map Tab ════ */
        <div className="space-y-4">
          {LEAGUE_SUMMARIES.map(league => {
            const isExpanded = expandedRank === league.rank;
            const lvls = FULL_VALUE_MAP.filter(l => l.league === league.rank);
            const rankIdx = RANK_ORDER.indexOf(league.rank as Enums<"rank_name">);
            const isCurrentLeague = currentRank === league.rank;
            const isCompleted = RANK_ORDER.indexOf(currentRank as Enums<"rank_name">) > rankIdx;

            return (
              <div key={league.rank} className="overflow-hidden rounded-2xl border border-border bg-card shadow-elev-1">
                <button onClick={() => setExpandedRank(isExpanded ? null : league.rank)} className="flex w-full items-center justify-between p-4 transition-all active:bg-secondary/30">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${RANK_BG[league.rank]} text-2xl`}>{league.emoji}</div>
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
                {isExpanded && (
                  <div className="border-t border-border p-4 space-y-3">
                    <p className="text-sm text-muted-foreground">{league.description}</p>
                    <div className="space-y-1.5">
                      {lvls.map(lv => {
                        const isReached = lv.level <= globalLevel;
                        return (
                           <div key={lv.level} className={`flex items-start gap-3 rounded-xl p-2.5 ${isReached ? "bg-primary/5" : "bg-muted/30"}`}>
                            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${isReached ? "bg-primary text-primary-foreground" : "bg-border text-muted-foreground"}`}>{lv.level}</div>
                            <div>
                              <p className={`text-sm ${isReached ? "text-foreground font-bold" : "text-muted-foreground"}`}>{lv.shortValueTitle}</p>
                              <p className="text-[11px] text-muted-foreground">{lv.valueDescription}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="rounded-xl border border-status-complete/20 bg-status-complete/5 p-3">
                      <p className="mb-1.5 text-xs font-bold text-foreground">{league.label} 완료 가치</p>
                      {league.completionValues.map(v => <p key={v} className="text-xs text-muted-foreground">✓ {v}</p>)}
                    </div>
                    {/* Boss level unlock benefit */}
                    {lvls.length > 0 && (
                      <div className="rounded-xl border border-reward/20 bg-reward/5 p-3">
                        <div className="mb-1.5 flex items-center gap-1.5">
                          <Gift className="h-3.5 w-3.5 text-reward" />
                          <p className="text-xs font-bold text-foreground">Lv {lvls[lvls.length - 1].level} 해금 보상</p>
                        </div>
                        <p className="text-xs text-muted-foreground">🎁 {lvls[lvls.length - 1].unlockedBenefit}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ════ Level Map Tab ════ */
        <>
          {isLoading ? (
            <div className="space-y-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="space-y-2">
                  <div className="h-6 w-32 animate-pulse rounded bg-muted" />
                  <div className="grid grid-cols-5 gap-2">{Array(10).fill(0).map((_, j) => <div key={j} className="h-16 animate-pulse rounded-2xl bg-muted" />)}</div>
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
                      <h2 className="text-lg text-foreground">{RANK_LABELS[rank]} 리그</h2>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {nodes.map(node => {
                        const globalLvl = sectionIdx * 10 + node.level_number;
                        const unlocked = globalLvl <= currentGlobal;
                        const isCurrent = globalLvl === currentGlobal;
                        const isPassed = globalLvl < currentGlobal;
                        const completed = completedForLevel(node.id);
                        const total = totalForLevel(node.id);
                        const allDone = isPassed || (total > 0 && completed === total);
                        return (
                          <button key={node.id} onClick={() => setSelectedNode(node)}
                            className={`relative flex flex-col items-center justify-center rounded-2xl border-2 p-2 transition-all active:scale-95 ${
                              isCurrent ? "border-primary bg-primary/10 shadow-glow-soft"
                              : allDone && unlocked ? "border-status-complete/30 bg-status-complete/5"
                              : unlocked ? "border-border bg-card hover:border-primary/30"
                              : "border-border/30 bg-muted/30 opacity-40"
                            } ${node.is_boss ? "col-span-2 py-3" : ""}`}
                            style={isCurrent ? { animation: "pulse-glow 2s ease-in-out infinite" } : {}}
                          >
                            {node.is_boss ? <Trophy className={`h-7 w-7 ${unlocked ? "text-reward" : "text-muted-foreground"}`} />
                              : allDone && unlocked ? <CheckCircle2 className="h-4 w-4 text-status-complete" />
                              : unlocked ? <Star className={`h-4 w-4 ${isCurrent ? "text-primary" : "text-muted-foreground"}`} />
                              : <Lock className="h-4 w-4 text-muted-foreground" />}
                            <span className={`mt-0.5 text-[10px] font-bold ${isCurrent ? "text-primary" : allDone ? "text-status-complete" : "text-muted-foreground"}`}>
                              {node.is_boss ? "BOSS" : `Lv.${node.level_number}`}
                            </span>
                            {total > 0 && unlocked && <span className="text-[8px] text-muted-foreground">{completed}/{total}</span>}
                          </button>
                        );
                      })}
                    </div>
                    {(() => {
                      const rankIdx = RANK_ORDER.indexOf(rank);
                      const rankMaxGlobal = (rankIdx + 1) * 10;
                      const challenge = DAN_CHALLENGES.find(c => c.rank === rank);
                      if (!challenge || currentGlobal < rankMaxGlobal) return null;
                      return (
                        <button onClick={() => setDanChallengeOpen(challenge)}
                          className="mt-3 w-full rounded-2xl border-2 border-reward/40 bg-gradient-to-r from-reward/10 via-primary/10 to-reward/10 p-4 text-left transition-all active:scale-[0.98] hover:border-reward/60">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{challenge.emoji}</span>
                            <div className="flex-1">
                              <p className="text-sm font-black text-foreground">{challenge.dan} 단증 도전 가능! 🔥</p>
                              <p className="text-xs text-muted-foreground">{RANK_LABELS[rank]} 마스터 완료 — 탭하여 도전하기</p>
                            </div>
                            <ExternalLink className="h-5 w-5 text-reward" />
                          </div>
                        </button>
                      );
                    })()}
                  </div>
                );
              })}

              {/* Master League */}
              <div className="animate-slide-up" style={{ animationDelay: "0.5s" }}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-lg">👑</span>
                  <h2 className="text-lg text-foreground">마스터 리그</h2>
                </div>
                <div className="relative overflow-hidden rounded-3xl border-2 border-reward/40 bg-gradient-to-br from-foreground via-foreground/95 to-foreground/90 p-5 shadow-2xl">
                  <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="absolute -left-4 -top-4 h-32 w-32 rounded-full bg-reward/20 blur-3xl" />
                    <div className="absolute -bottom-4 -right-4 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
                  </div>
                  <div className="relative mb-4 text-center">
                    <div className="mb-2 flex items-center justify-center gap-2">
                      <Sparkles className="h-5 w-5 text-reward" style={{ animation: "pulse 2s ease-in-out infinite" }} />
                      <span className="text-xs font-bold uppercase tracking-[0.2em] text-reward">Secret Mission</span>
                      <Sparkles className="h-5 w-5 text-reward" style={{ animation: "pulse 2s ease-in-out infinite 0.5s" }} />
                    </div>
                    <h3 className="text-xl font-black text-primary-foreground">🏆 마스터 리그 최종 미션</h3>
                    <p className="mt-1 text-xs text-primary-foreground/60">블랙 리그 레벨 10 달성 후 도전할 수 있는 시크릿 미션</p>
                  </div>
                  <div className="relative space-y-3">
                    {SECRET_MISSIONS.map(mission => {
                      const MIcon = mission.icon;
                      return (
                        <button key={mission.id}
                          onClick={() => isMaxLevel ? setShowSecretDetail(mission) : toast("블랙 리그 레벨 10 달성 후 도전할 수 있습니다! 🥊")}
                          className={`group relative w-full overflow-hidden rounded-2xl border text-left transition-all active:scale-[0.98] ${isMaxLevel ? "border-reward/30 bg-reward/10 hover:border-reward/50" : "border-primary-foreground/10 bg-primary-foreground/5"}`}>
                          <div className="flex items-center gap-3 p-4">
                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${isMaxLevel ? "bg-reward/20" : "bg-primary-foreground/10"}`}>
                              {isMaxLevel ? <MIcon className="h-6 w-6 text-reward" /> : <Lock className="h-6 w-6 text-primary-foreground/30" />}
                            </div>
                            <div className="flex-1">
                              <span className="text-sm font-black text-primary-foreground">{mission.emoji} {mission.title}</span>
                              <p className="mt-0.5 text-xs text-primary-foreground/50">{mission.subtitle}</p>
                              {isMaxLevel && <p className="mt-0.5 text-[10px] text-reward/70 font-medium">탭하여 도전하기 →</p>}
                            </div>
                            {isMaxLevel && <Crown className="h-5 w-5 text-reward" style={{ animation: "pulse 2s ease-in-out infinite" }} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="relative mt-4 rounded-2xl border border-reward/20 bg-reward/5 p-4">
                    <p className="mb-3 text-center text-xs font-bold uppercase tracking-wider text-reward">✨ 마스터 리그 달성 보상 ✨</p>
                    <div className="space-y-2">
                      {FINAL_REWARDS.map((r, i) => (
                        <div key={i} className="flex items-center gap-2.5 rounded-xl bg-primary-foreground/5 px-3 py-2">
                          <span className="text-base">{r.emoji}</span>
                          <span className="text-xs font-bold text-primary-foreground/80">{r.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {!isMaxLevel && (
                    <div className="relative mt-4 flex items-center justify-center gap-2 rounded-xl bg-primary-foreground/5 py-2.5">
                      <Lock className="h-4 w-4 text-primary-foreground/40" />
                      <span className="text-xs font-bold text-primary-foreground/40">블랙 리그 레벨 10 달성 시 해금</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail Drawer */}
      <Drawer open={!!selectedNode} onOpenChange={(open) => !open && setSelectedNode(null)}>
        <DrawerContent className="mx-auto max-w-lg pb-safe">
          <DrawerHeader className="pb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{selectedNode ? RANK_ICONS[selectedNode.rank_name] : ""}</span>
              <DrawerTitle>{selectedNode ? `${RANK_LABELS[selectedNode.rank_name]} Lv.${selectedNode.level_number}` : ""}</DrawerTitle>
              {selectedNode?.is_boss && <span className="rounded-full bg-reward/20 px-2 py-0.5 text-xs font-bold text-reward-foreground">🏆 타이틀매치</span>}
            </div>
          </DrawerHeader>
          {selectedNode && (
            <div className="space-y-3 px-4 pb-6">
              <div className="rounded-xl bg-secondary p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-foreground">{selectedNode.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">필요 XP: {selectedNode.xp_required}</p>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button onClick={() => { setEditLevelForm({ title: selectedNode.title, xp_required: selectedNode.xp_required, reward_name: selectedNode.reward_name || "", is_boss: selectedNode.is_boss }); setEditLevelModal(true); }} className="rounded-lg bg-card p-2 active:scale-95">
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={async () => {
                        if (!confirm("이 레벨을 삭제하시겠습니까?")) return;
                        const { error } = await supabase.from("levels").delete().eq("id", selectedNode.id);
                        if (error) { toast.error("삭제 실패"); return; }
                        toast.success("레벨 삭제 완료");
                        qc.invalidateQueries({ queryKey: ["levels"] });
                        setSelectedNode(null);
                      }} className="rounded-lg bg-destructive/10 p-2 active:scale-95">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </div>
                  )}
                </div>
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
                            {status === "approved" ? <CheckCircle2 className="h-4 w-4 text-status-complete" /> : status === "pending" ? <span className="text-xs text-status-pending">⏳</span> : <Play className="h-4 w-4 text-muted-foreground" />}
                            <span className="text-sm text-foreground">{m.title}</span>
                          </div>
                          <span className="text-xs font-bold text-primary">+{m.xp_reward} XP</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {isAdmin && user && !selectedNode.is_boss && (
                <button onClick={async () => {
                  try { const result = await levelUpMutation.mutateAsync(user.id); toast.success(`Lv.${result.new_level}로 레벨업! 🥊`); refreshProgress(); setSelectedNode(null); } catch (e: any) { toast.error(e?.message || "레벨업 실패"); }
                }} disabled={levelUpMutation.isPending} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-glow-soft hover:shadow-glow-primary transition-all active:scale-[0.98] disabled:opacity-50">
                  <ArrowUp className="mr-1 inline h-4 w-4" />{levelUpMutation.isPending ? "레벨업 중..." : "⚡ 즉시 레벨업 (관리자)"}
                </button>
              )}
              {isAdmin && user && selectedNode.is_boss && (
                <button onClick={async () => {
                  try { const result = await bossBattleMutation.mutateAsync({ memberId: user.id }); if (result?.ranked_up) { toast.success(`${RANK_LABELS[result.new_rank] || result.new_rank} 리그로 승격! 🏆`); } else { toast.success("타이틀매치 클리어! 🏆"); } refreshProgress(); setSelectedNode(null); } catch (e: any) { toast.error(e?.message || "타이틀매치 처리 실패"); }
                }} disabled={bossBattleMutation.isPending} className="w-full rounded-xl bg-reward py-3 text-sm font-bold text-reward-foreground shadow-glow-reward transition-all active:scale-[0.98] disabled:opacity-50">
                  <Trophy className="mr-1 inline h-4 w-4" />{bossBattleMutation.isPending ? "처리 중..." : "🏆 즉시 타이틀매치 클리어 (관리자)"}
                </button>
              )}
              <button onClick={() => { setSelectedNode(null); navigate("/missions"); }}
                className={`w-full rounded-xl ${isAdmin ? "bg-secondary text-secondary-foreground shadow-elev-1" : "bg-primary text-primary-foreground shadow-glow-soft hover:shadow-glow-primary"} py-3 text-sm font-bold transition-all active:scale-[0.98]`}>
                미션 보러가기
              </button>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* Dan Challenge Dialog */}
      <Dialog open={!!danChallengeOpen} onOpenChange={(open) => !open && setDanChallengeOpen(null)}>
        <DialogContent className="mx-auto max-w-sm rounded-3xl border-2 border-reward/30 bg-card p-0 overflow-hidden">
          <div className="relative bg-gradient-to-br from-reward/20 via-primary/10 to-reward/10 p-6 text-center">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -left-4 -top-4 h-24 w-24 rounded-full bg-reward/20 blur-3xl" />
              <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-primary/20 blur-3xl" />
            </div>
            <span className="relative text-5xl">{danChallengeOpen?.emoji}</span>
            <h3 className="relative mt-3 whitespace-pre-line text-xl font-black text-foreground">{danChallengeOpen?.message}</h3>
            <p className="relative mt-2 text-xs text-muted-foreground">승단 심사 신청서를 작성하고 공식 {danChallengeOpen?.dan}에 도전하세요</p>
          </div>
          <div className="flex gap-3 p-5">
            <button onClick={() => setDanChallengeOpen(null)} className="flex-1 rounded-xl border border-border bg-secondary py-3 text-sm font-bold text-secondary-foreground transition-all active:scale-95">다음에 할게요</button>
            <button onClick={() => { window.open("https://korea-boxing.lovable.app", "_blank"); setDanChallengeOpen(null); }} className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-glow-soft hover:shadow-glow-primary transition-all active:scale-95">🥊 도전하기!</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Secret Mission Detail Drawer */}
      <Drawer open={!!showSecretDetail} onOpenChange={(open) => !open && setShowSecretDetail(null)}>
        <DrawerContent className="mx-auto max-w-lg pb-safe">
          <DrawerHeader className="pb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{showSecretDetail?.emoji}</span>
              <DrawerTitle>{showSecretDetail?.title}</DrawerTitle>
            </div>
          </DrawerHeader>
          {showSecretDetail && (
            <div className="space-y-4 px-4 pb-6">
              <div className="rounded-xl bg-gradient-to-br from-reward/10 to-primary/10 p-4">
                <p className="text-sm font-bold text-foreground">{showSecretDetail.description}</p>
              </div>
              <div className="rounded-xl bg-secondary p-4">
                <p className="mb-2 text-xs font-bold text-muted-foreground">🎁 달성 보상</p>
                <div className="space-y-1.5">
                  {FINAL_REWARDS.map((r, i) => <div key={i} className="flex items-center gap-2 text-xs text-foreground"><span>{r.emoji}</span><span>{r.label}</span></div>)}
                </div>
              </div>
              <button onClick={() => { if (showSecretDetail.isExternal) window.open(showSecretDetail.linkTo, "_blank"); else navigate(showSecretDetail.linkTo); setShowSecretDetail(null); }}
                className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-glow-soft hover:shadow-glow-primary transition-all active:scale-[0.98]">{showSecretDetail.cta}</button>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* Admin: Edit Level Modal */}
      {editLevelModal && selectedNode && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-sm" onClick={() => setEditLevelModal(false)}>
          <div className="w-full max-w-lg animate-slide-up rounded-t-3xl border-t border-border bg-card p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg text-foreground">✏️ 레벨 수정</h3>
              <button onClick={() => setEditLevelModal(false)} className="rounded-full bg-secondary p-2 active:scale-95"><X className="h-4 w-4 text-secondary-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="mb-1 block text-xs text-muted-foreground">제목</label><Input value={editLevelForm.title} onChange={e => setEditLevelForm(f => ({ ...f, title: e.target.value }))} className="rounded-xl" /></div>
              <div><label className="mb-1 block text-xs text-muted-foreground">필요 XP</label><Input type="number" value={editLevelForm.xp_required} onChange={e => setEditLevelForm(f => ({ ...f, xp_required: Number(e.target.value) }))} className="rounded-xl" /></div>
              <div><label className="mb-1 block text-xs text-muted-foreground">보상</label><Input value={editLevelForm.reward_name} onChange={e => setEditLevelForm(f => ({ ...f, reward_name: e.target.value }))} placeholder="보상명 (선택)" className="rounded-xl" /></div>
              <button onClick={async () => {
                setEditLevelSaving(true);
                try {
                  const { error } = await supabase.from("levels").update({ title: editLevelForm.title.trim(), xp_required: editLevelForm.xp_required, reward_name: editLevelForm.reward_name.trim() || null }).eq("id", selectedNode.id);
                  if (error) throw error;
                  toast.success("레벨 수정 완료 ✅"); qc.invalidateQueries({ queryKey: ["levels"] }); setEditLevelModal(false); setSelectedNode(null);
                } catch { toast.error("수정 실패"); } finally { setEditLevelSaving(false); }
              }} disabled={editLevelSaving} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-glow-soft hover:shadow-glow-primary transition-all active:scale-[0.98] disabled:opacity-50">
                {editLevelSaving ? "저장 중..." : "수정 완료"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══ White Lv.1 → Lv.2 Progression Card ═══ */
const WhiteLv1ProgressionCard = () => {
  const { metrics, status, totalXp } = useLocalProgress();

  const STATUS_STYLE: Record<string, string> = {
    "진행중": "bg-primary/10 text-primary",
    "레벨업 심사 가능": "bg-status-complete/10 text-status-complete",
    "보완 필요": "bg-status-pending/10 text-status-pending",
    "레벨업 완료": "bg-reward/10 text-reward-foreground",
    "코치 확인 필요": "bg-destructive/10 text-destructive",
  };

  return (
    <div className="mb-6 space-y-4 animate-slide-up">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-elev-1">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">⚪ White Lv.1 → Lv.2</h3>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${STATUS_STYLE[status] || "bg-muted text-muted-foreground"}`}>{status}</span>
        </div>

        {/* Path chips */}
        <div className="mb-3 flex gap-2">
          {RECOMMENDED_PATHS.map(path => (
            <div key={path.label} className="flex-1 rounded-xl bg-muted/30 p-2 text-center">
              <p className="text-[9px] font-bold text-muted-foreground">{path.label}</p>
              <p className="text-xs font-bold text-foreground">{path.duration} · {path.sessions}</p>
              <p className="text-[9px] text-muted-foreground">{path.frequency}</p>
            </div>
          ))}
        </div>

        {/* 4 metrics */}
        <div className="grid grid-cols-2 gap-2">
          {PROMOTION_METRICS.map(m => {
            const met = metrics[m.id as keyof typeof metrics];
            const pct = met ? Math.min(100, Math.round((met.current / met.target) * 100)) : 0;
            const done = met && met.current >= met.target;
            return (
              <div key={m.id} className="rounded-xl border border-border p-2.5">
                <div className="mb-0.5 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">{m.emoji} {m.label}</span>
                  {done && <CheckCircle2 className="h-3 w-3 text-status-complete" />}
                </div>
                <p className="text-sm font-bold text-foreground">{met?.current ?? 0}<span className="text-xs text-muted-foreground">/{m.target}{m.unit}</span></p>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${done ? "bg-status-complete" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
          화이트는 쉽지만 의미 없이 쉬운 단계가 아니라, 습관·기초체력·자세 유지력을 만드는 단계입니다
        </p>
      </div>
    </div>
  );
};

export default RankUpPage;
