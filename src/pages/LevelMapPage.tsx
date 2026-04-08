import { useState } from "react";
import { useLevels, useManualLevelUp, usePassBossBattle } from "@/hooks/useQuestData";
import { useMissions, useMyMissionSubmissions } from "@/hooks/useMissionData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import RankBadge from "@/components/RankBadge";
import { Lock, Star, Trophy, User, Play, CheckCircle2, ArrowUp, Crown, Shield, Award, Sparkles, ExternalLink, X, Pencil, Trash2, Plus } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import type { Tables, Enums } from "@/integrations/supabase/types";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const RANK_ORDER: Enums<"rank_name">[] = ["white", "blue", "red", "black"];
const RANK_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };
const RANK_ICONS: Record<string, string> = { white: "⚪", blue: "🔵", red: "🔴", black: "⚫" };

const SECRET_MISSIONS = [
  {
    id: "secret-1",
    icon: Award,
    emoji: "🏅",
    title: "한국복싱협회 단증 심사관",
    subtitle: "심사관이 되어 후배를 이끄세요",
    description: "한국복싱협회 공인 단증 심사관 자격을 취득하세요. 승단 신청서를 작성하고 도전하세요!",
    cta: "🥊 도전하기!",
    linkTo: "https://korea-boxing.lovable.app",
    isExternal: true,
  },
  {
    id: "secret-2",
    icon: Shield,
    emoji: "🛡️",
    title: "인증 복싱코치 자격증",
    subtitle: "공식 코치로 인정받으세요",
    description: "한국 코치협회 인증 복싱코치 자격증을 획득하세요. 승단 신청서를 작성하고 도전하세요!",
    cta: "🥊 도전하기!",
    linkTo: "https://korea-boxing.lovable.app",
    isExternal: true,
  },
];

const DAN_CHALLENGES = [
  { rank: "white", dan: "1단", message: "화이트 10레벨 달성! 🥊\n1단 단증에 도전하세요!", emoji: "🥇" },
  { rank: "blue", dan: "2단", message: "블루 10레벨 달성! 🥊\n2단 단증에 도전하세요!", emoji: "🥈" },
  { rank: "red", dan: "3단", message: "레드 10레벨 달성! 🥊\n3단 단증에 도전하세요!", emoji: "🥉" },
  { rank: "black", dan: "4단", message: "블랙 10레벨 달성! 🥊\n4단 단증에 도전하세요!", emoji: "🏆" },
];

const FINAL_REWARDS = [
  { emoji: "💰", label: "153복싱짐 50% 영구 할인" },
  { emoji: "🏆", label: "명예의 전당 입성" },
  { emoji: "🔐", label: "명예의 전당 전용 락카" },
  { emoji: "👕", label: "운동복 평생 무료 제공" },
  { emoji: "🌐", label: "153복싱짐 홈페이지 명예의 전당" },
];

const LevelMapPage = () => {
  const [selectedNode, setSelectedNode] = useState<Tables<"levels"> | null>(null);
  const [showSecretDetail, setShowSecretDetail] = useState<typeof SECRET_MISSIONS[0] | null>(null);
  const [danChallengeOpen, setDanChallengeOpen] = useState<typeof DAN_CHALLENGES[0] | null>(null);
  const navigate = useNavigate();
  const { progress, role, user, refreshProgress } = useAuth();
  const { data: levels, isLoading } = useLevels();
  const { data: missions } = useMissions();
  const { data: missionSubs } = useMyMissionSubmissions();
  const levelUpMutation = useManualLevelUp();
  const bossBattleMutation = usePassBossBattle();
  const qc = useQueryClient();
  const isAdmin = role === "admin" || role === "super_admin";

  // Admin level edit state
  const [editLevelModal, setEditLevelModal] = useState(false);
  const [editLevelForm, setEditLevelForm] = useState({ title: "", xp_required: 0, reward_name: "", is_boss: false });
  const [editLevelSaving, setEditLevelSaving] = useState(false);

  if (!progress) return null;

  const currentGlobal = RANK_ORDER.indexOf(progress.current_rank as Enums<"rank_name">) * 10 + progress.current_level;
  const subMap = new Map((missionSubs || []).map(s => [s.mission_id, s.status]));
  const isMaxLevel = progress.current_rank === "black" && progress.current_level === 10;

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
                  <h2 className="text-lg text-foreground">{RANK_LABELS[rank]}</h2>
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
                {/* Dan Challenge Card */}
                {(() => {
                  const rankIdx = RANK_ORDER.indexOf(rank);
                  const rankMaxGlobal = (rankIdx + 1) * 10;
                  const challenge = DAN_CHALLENGES.find(c => c.rank === rank);
                  if (!challenge || currentGlobal < rankMaxGlobal) return null;
                  return (
                    <button
                      onClick={() => setDanChallengeOpen(challenge)}
                      className="mt-3 w-full rounded-2xl border-2 border-accent/40 bg-gradient-to-r from-accent/10 via-primary/10 to-accent/10 p-4 text-left transition-all active:scale-[0.98] hover:border-accent/60"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{challenge.emoji}</span>
                        <div className="flex-1">
                          <p className="text-sm font-black text-foreground">{challenge.dan} 단증 도전 가능! 🔥</p>
                          <p className="text-xs text-muted-foreground">{RANK_LABELS[rank]} 마스터 완료 — 탭하여 도전하기</p>
                        </div>
                        <ExternalLink className="h-5 w-5 text-accent" />
                      </div>
                    </button>
                  );
                })()}
              </div>
            );
          })}

          {/* ═══ SECRET FINAL MASTER MISSION ═══ */}
          <div className="animate-slide-up" style={{ animationDelay: "0.5s" }}>
            <div className="relative overflow-hidden rounded-3xl border-2 border-accent/40 bg-gradient-to-br from-foreground via-foreground/95 to-foreground/90 p-5 shadow-2xl">
              {/* Sparkle effects */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -left-4 -top-4 h-32 w-32 rounded-full bg-accent/20 blur-3xl" />
                <div className="absolute -bottom-4 -right-4 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
                <div className="absolute left-1/2 top-1/3 h-16 w-16 rounded-full bg-accent/10 blur-2xl" style={{ animation: "pulse 3s ease-in-out infinite" }} />
              </div>

              {/* Header */}
              <div className="relative mb-4 text-center">
                <div className="mb-2 flex items-center justify-center gap-2">
                  <Sparkles className="h-5 w-5 text-accent" style={{ animation: "pulse 2s ease-in-out infinite" }} />
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Secret Mission</span>
                  <Sparkles className="h-5 w-5 text-accent" style={{ animation: "pulse 2s ease-in-out infinite 0.5s" }} />
                </div>
                <h3 className="text-xl font-black text-primary-foreground" style={{ fontFamily: "'Black Han Sans', sans-serif" }}>
                  🏆 최종 마스터 미션
                </h3>
                <p className="mt-1 text-xs text-primary-foreground/60">블랙 레벨 10 달성 후 도전할 수 있는 시크릿 미션</p>
              </div>

              {/* Mission Cards */}
              <div className="relative space-y-3">
                {SECRET_MISSIONS.map((mission, idx) => {
                  const MIcon = mission.icon;
                  return (
                    <button
                      key={mission.id}
                      onClick={() => {
                        if (isMaxLevel) {
                          setShowSecretDetail(mission);
                        } else {
                          toast("블랙 레벨 10 달성 후 도전할 수 있습니다! 🥊");
                        }
                      }}
                      className={`group relative w-full overflow-hidden rounded-2xl border text-left transition-all active:scale-[0.98] ${
                        isMaxLevel
                          ? "border-accent/30 bg-accent/10 hover:border-accent/50"
                          : "border-primary-foreground/10 bg-primary-foreground/5"
                      }`}
                    >
                      <div className="flex items-center gap-3 p-4">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                          isMaxLevel ? "bg-accent/20" : "bg-primary-foreground/10"
                        }`}>
                          {isMaxLevel ? (
                            <MIcon className="h-6 w-6 text-accent" />
                          ) : (
                            <Lock className="h-6 w-6 text-primary-foreground/30" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-black text-primary-foreground">{mission.emoji} {mission.title}</span>
                          </div>
                          <p className="mt-0.5 text-xs text-primary-foreground/50">{mission.subtitle}</p>
                          {isMaxLevel && (
                            <p className="mt-0.5 text-[10px] text-accent/70 font-medium">탭하여 도전하기 →</p>
                          )}
                        </div>
                        {isMaxLevel && (
                          <Crown className="h-5 w-5 text-accent" style={{ animation: "pulse 2s ease-in-out infinite" }} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Rewards Preview */}
              <div className="relative mt-4 rounded-2xl border border-accent/20 bg-accent/5 p-4">
                <p className="mb-3 text-center text-xs font-bold uppercase tracking-wider text-accent">
                  ✨ 최종 미션 달성 보상 ✨
                </p>
                <div className="space-y-2">
                  {FINAL_REWARDS.map((r, i) => (
                    <div key={i} className="flex items-center gap-2.5 rounded-xl bg-primary-foreground/5 px-3 py-2">
                      <span className="text-base">{r.emoji}</span>
                      <span className="text-xs font-bold text-primary-foreground/80">{r.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lock overlay for non-max */}
              {!isMaxLevel && (
                <div className="relative mt-4 flex items-center justify-center gap-2 rounded-xl bg-primary-foreground/5 py-2.5">
                  <Lock className="h-4 w-4 text-primary-foreground/40" />
                  <span className="text-xs font-bold text-primary-foreground/40">블랙 레벨 10 달성 시 해금</span>
                </div>
              )}
            </div>
          </div>
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
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-foreground">{selectedNode.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">필요 XP: {selectedNode.xp_required}</p>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button onClick={() => {
                        setEditLevelForm({ title: selectedNode.title, xp_required: selectedNode.xp_required, reward_name: selectedNode.reward_name || "", is_boss: selectedNode.is_boss });
                        setEditLevelModal(true);
                      }} className="rounded-lg bg-card p-2 active:scale-95">
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={async () => {
                        if (!confirm(`이 레벨을 삭제하시겠습니까?`)) return;
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

              {role === "admin" && user && !selectedNode.is_boss && (
                <button
                  onClick={async () => {
                    try {
                      const result = await levelUpMutation.mutateAsync(user.id);
                      toast.success(`Lv.${result.new_level}로 레벨업! 🥊`);
                      refreshProgress();
                      setSelectedNode(null);
                    } catch (e: any) {
                      toast.error(e?.message || "레벨업 실패");
                    }
                  }}
                  disabled={levelUpMutation.isPending}
                  className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <ArrowUp className="mr-1 inline h-4 w-4" />
                  {levelUpMutation.isPending ? "레벨업 중..." : "⚡ 즉시 레벨업 (관리자)"}
                </button>
              )}

              {role === "admin" && user && selectedNode.is_boss && (
                <button
                  onClick={async () => {
                    try {
                      const result = await bossBattleMutation.mutateAsync({ memberId: user.id });
                      if (result?.ranked_up) {
                        toast.success(`${RANK_LABELS[result.new_rank] || result.new_rank} 랭크로 승급! 🏆`);
                      } else {
                        toast.success("타이틀매치 클리어! 🏆");
                      }
                      refreshProgress();
                      setSelectedNode(null);
                    } catch (e: any) {
                      toast.error(e?.message || "타이틀매치 처리 실패");
                    }
                  }}
                  disabled={bossBattleMutation.isPending}
                  className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-accent-foreground shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <Trophy className="mr-1 inline h-4 w-4" />
                  {bossBattleMutation.isPending ? "처리 중..." : "🏆 즉시 타이틀매치 클리어 (관리자)"}
                </button>
              )}

              <button
                onClick={() => { setSelectedNode(null); navigate("/missions"); }}
                className={`w-full rounded-xl ${role === "admin" ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"} py-3 text-sm font-bold shadow-md transition-all active:scale-[0.98]`}
              >
                미션 보러가기
              </button>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* Dan Challenge Dialog */}
      <Dialog open={!!danChallengeOpen} onOpenChange={(open) => !open && setDanChallengeOpen(null)}>
        <DialogContent className="mx-auto max-w-sm rounded-3xl border-2 border-accent/30 bg-card p-0 overflow-hidden">
          <div className="relative bg-gradient-to-br from-accent/20 via-primary/10 to-accent/10 p-6 text-center">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -left-4 -top-4 h-24 w-24 rounded-full bg-accent/20 blur-3xl" />
              <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-primary/20 blur-3xl" />
            </div>
            <span className="relative text-5xl">{danChallengeOpen?.emoji}</span>
            <h3 className="relative mt-3 whitespace-pre-line text-xl font-black text-foreground" style={{ fontFamily: "'Black Han Sans', sans-serif" }}>
              {danChallengeOpen?.message}
            </h3>
            <p className="relative mt-2 text-xs text-muted-foreground">
              승단 심사 신청서를 작성하고 공식 {danChallengeOpen?.dan}에 도전하세요
            </p>
          </div>
          <div className="flex gap-3 p-5">
            <button
              onClick={() => setDanChallengeOpen(null)}
              className="flex-1 rounded-xl border border-border bg-secondary py-3 text-sm font-bold text-secondary-foreground transition-all active:scale-95"
            >
              다음에 할게요
            </button>
            <button
              onClick={() => {
                window.open("https://korea-boxing.lovable.app", "_blank");
                setDanChallengeOpen(null);
              }}
              className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md transition-all active:scale-95"
            >
              🥊 도전하기!
            </button>
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
              <div className="rounded-xl bg-gradient-to-br from-accent/10 to-primary/10 p-4">
                <p className="text-sm font-bold text-foreground">{showSecretDetail.description}</p>
              </div>
              <div className="rounded-xl bg-secondary p-4">
                <p className="mb-2 text-xs font-bold text-muted-foreground">🎁 달성 보상</p>
                <div className="space-y-1.5">
                  {FINAL_REWARDS.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-foreground">
                      <span>{r.emoji}</span>
                      <span>{r.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => {
                  if (showSecretDetail.isExternal) {
                    window.open(showSecretDetail.linkTo, "_blank");
                  } else {
                    navigate(showSecretDetail.linkTo);
                  }
                  setShowSecretDetail(null);
                }}
                className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md transition-all active:scale-[0.98]"
              >
                {showSecretDetail.cta}
              </button>
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
              <button onClick={() => setEditLevelModal(false)} className="rounded-full bg-secondary p-2 active:scale-95">
                <X className="h-4 w-4 text-secondary-foreground" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">제목</label>
                <Input value={editLevelForm.title} onChange={e => setEditLevelForm(f => ({ ...f, title: e.target.value }))} className="rounded-xl" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">필요 XP</label>
                <Input type="number" value={editLevelForm.xp_required} onChange={e => setEditLevelForm(f => ({ ...f, xp_required: Number(e.target.value) }))} className="rounded-xl" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">보상</label>
                <Input value={editLevelForm.reward_name} onChange={e => setEditLevelForm(f => ({ ...f, reward_name: e.target.value }))} placeholder="보상명 (선택)" className="rounded-xl" />
              </div>
              <button onClick={async () => {
                setEditLevelSaving(true);
                try {
                  const { error } = await supabase.from("levels").update({
                    title: editLevelForm.title.trim(), xp_required: editLevelForm.xp_required,
                    reward_name: editLevelForm.reward_name.trim() || null,
                  }).eq("id", selectedNode.id);
                  if (error) throw error;
                  toast.success("레벨 수정 완료 ✅");
                  qc.invalidateQueries({ queryKey: ["levels"] });
                  setEditLevelModal(false);
                  setSelectedNode(null);
                } catch { toast.error("수정 실패"); }
                finally { setEditLevelSaving(false); }
              }} disabled={editLevelSaving}
                className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md transition-all active:scale-[0.98] disabled:opacity-50">
                {editLevelSaving ? "저장 중..." : "수정 완료"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LevelMapPage;
