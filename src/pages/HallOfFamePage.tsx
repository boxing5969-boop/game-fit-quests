import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { User, Settings2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import RankMiniCard from "@/components/RankMiniCard";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  useDivisionRanking,
  useWeeklyActivityRanking,
  useMonthlyRisers,
  useStreakRanking,
  useBossConquerors,
  useSetRival,
} from "@/hooks/useRankingData";
import { toast } from "sonner";

const RANKING_TABS = [
  { key: "official", label: "🏆 공식" },
  { key: "weekly", label: "⚡ 이번 주" },
  { key: "monthly", label: "📈 상승왕" },
  { key: "streak", label: "🔥 출석" },
  { key: "boss", label: "🥊 보스전" },
] as const;

type RankingTabKey = (typeof RANKING_TABS)[number]["key"];
type TopTab = "ranking" | "halloffame";

const RANK_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };

import { isHallOfFameMember, HALL_OF_FAME_DESCRIPTION } from "@/lib/rankLabels";

const HallOfFamePage = () => {
  const navigate = useNavigate();
  const { user, progress, role } = useAuth();
  const [topTab, setTopTab] = useState<TopTab>("ranking");
  const [activeTab, setActiveTab] = useState<RankingTabKey>("official");
  const setRival = useSetRival();
  const qc = useQueryClient();
  const isAdmin = role === "admin" || role === "super_admin";

  const { data: officialRanking, isLoading: officialLoading } = useDivisionRanking();
  const { data: weeklyRanking } = useWeeklyActivityRanking();
  const { data: monthlyRanking } = useMonthlyRisers();
  const { data: streakRanking } = useStreakRanking();
  const { data: bossRanking } = useBossConquerors();

  const myPosition = officialRanking?.find(r => r.r_user_id === user?.id)?.rank_position;

  const hallOfFameMembers = (officialRanking || []).filter(
    m => isHallOfFameMember(m.r_current_rank, m.r_current_level)
  );

  // Admin: level set modal for any member
  const [levelSetModal, setLevelSetModal] = useState<{
    show: boolean; userId: string; nickname: string; currentRank: string; currentLevel: number;
  } | null>(null);
  const [setRank, setSetRank] = useState("white");
  const [setLevel, setSetLevel] = useState(1);
  const [settingLevel, setSettingLevel] = useState(false);

  const handleSetLevel = async () => {
    if (!levelSetModal) return;
    setSettingLevel(true);
    try {
      const { data, error } = await supabase.rpc("set_member_level", {
        _member_id: levelSetModal.userId,
        _rank: setRank as any,
        _level: setLevel,
      });
      if (error) throw error;
      const result = data as any;
      toast.success(`${levelSetModal.nickname} → ${RANK_LABELS[result.new_rank] || result.new_rank} Lv.${result.new_level} 설정 완료`);
      setLevelSetModal(null);
      qc.invalidateQueries({ queryKey: ["division-ranking"] });
      qc.invalidateQueries({ queryKey: ["assigned-members"] });
    } catch (e: any) {
      toast.error(e?.message || "레벨 설정 실패");
    } finally {
      setSettingLevel(false);
    }
  };

  const openLevelSet = (member: any) => {
    setLevelSetModal({
      show: true,
      userId: member.r_user_id,
      nickname: member.r_nickname,
      currentRank: member.r_current_rank,
      currentLevel: member.r_current_level,
    });
    setSetRank(member.r_current_rank);
    setSetLevel(member.r_current_level);
  };

  return (
    <div className="mx-auto max-w-lg px-4 pb-32 pt-4">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl text-foreground">🏆 랭킹</h1>
        <button onClick={() => navigate("/mypage")} className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-all active:scale-95">
          <User className="h-5 w-5 text-secondary-foreground" />
        </button>
      </div>

      {/* Top-level toggle: 랭킹 vs 명예의전당 */}
      <div className="mb-4 flex rounded-2xl border border-border bg-secondary/50 p-1">
        <button
          onClick={() => setTopTab("ranking")}
          className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${
            topTab === "ranking" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          🏆 랭킹
        </button>
        <button
          onClick={() => setTopTab("halloffame")}
          className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${
            topTab === "halloffame" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          🏅 명예의 전당
        </button>
      </div>

      {topTab === "ranking" && (
        <>
          {/* My position card */}
          {progress && myPosition && (
            <div className="mb-4 animate-slide-up rounded-2xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">내 공식 순위</p>
                  <p className="text-2xl font-bold text-primary">{myPosition}위</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{progress.current_rank} Lv.{progress.current_level}</p>
                  <p className="text-sm font-bold text-foreground">{progress.total_xp.toLocaleString()} XP</p>
                </div>
              </div>
            </div>
          )}

          {/* Ranking sub-tabs */}
          <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {RANKING_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                  activeTab === tab.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Ranking Content */}
          <div className="space-y-2">
            {activeTab === "official" && (
              officialLoading ? <SkeletonList /> : (
                (officialRanking || []).map(m => (
                  <div key={m.r_user_id} className="relative">
                    <RankMiniCard
                      nickname={m.r_nickname}
                      rank={m.r_current_rank}
                      level={m.r_current_level}
                      position={Number(m.rank_position)}
                      avatarUrl={m.r_avatar_url}
                      xp={m.r_total_xp}
                      isMe={m.r_user_id === user?.id}
                      isRival={progress?.rival_id === m.r_user_id}
                      isHallOfFame={isHallOfFameMember(m.r_current_rank, m.r_current_level)}
                      onSetRival={() => {
                        setRival.mutate(m.r_user_id);
                        toast.success(`${m.r_nickname}을 추격 목표로 설정! 🎯`);
                      }}
                    />
                    {isAdmin && (
                      <button onClick={() => openLevelSet(m)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-secondary/90 p-1.5 text-muted-foreground shadow-sm active:scale-95 backdrop-blur-sm">
                        <Settings2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )
            )}

            {activeTab === "weekly" && (
              (weeklyRanking || []).map(m => (
                <div key={m.r_user_id} className="relative">
                  <RankMiniCard
                    nickname={m.r_nickname} rank={m.r_current_rank} level={m.r_current_level}
                    position={Number(m.rank_position)} avatarUrl={m.r_avatar_url}
                    isMe={m.r_user_id === user?.id} extra={`${m.weekly_xp} XP`}
                  />
                  {isAdmin && (
                    <button onClick={() => openLevelSet(m)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-secondary/90 p-1.5 text-muted-foreground shadow-sm active:scale-95 backdrop-blur-sm">
                      <Settings2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}

            {activeTab === "monthly" && (
              (monthlyRanking || []).map(m => (
                <div key={m.r_user_id} className="relative">
                  <RankMiniCard
                    nickname={m.r_nickname} rank={m.r_current_rank} level={m.r_current_level}
                    position={Number(m.rank_position)} avatarUrl={m.r_avatar_url}
                    isMe={m.r_user_id === user?.id} extra={`+${m.monthly_xp} XP`}
                  />
                  {isAdmin && (
                    <button onClick={() => openLevelSet(m)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-secondary/90 p-1.5 text-muted-foreground shadow-sm active:scale-95 backdrop-blur-sm">
                      <Settings2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}

            {activeTab === "streak" && (
              (streakRanking || []).map(m => (
                <div key={m.r_user_id} className="relative">
                  <RankMiniCard
                    nickname={m.r_nickname} rank={m.r_current_rank} level={m.r_current_level}
                    position={Number(m.rank_position)} avatarUrl={m.r_avatar_url}
                    isMe={m.r_user_id === user?.id} extra={`🔥 ${m.r_streak_days}일`}
                  />
                  {isAdmin && (
                    <button onClick={() => openLevelSet(m)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-secondary/90 p-1.5 text-muted-foreground shadow-sm active:scale-95 backdrop-blur-sm">
                      <Settings2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}

            {activeTab === "boss" && (
              (bossRanking || []).map(m => (
                <div key={m.r_user_id} className="relative">
                  <RankMiniCard
                    nickname={m.r_nickname} rank={m.r_current_rank} level={m.r_current_level}
                    position={Number(m.rank_position)} avatarUrl={m.r_avatar_url}
                    isMe={m.r_user_id === user?.id} extra={`🏆 ${m.r_bosses_cleared}회`}
                  />
                  {isAdmin && (
                    <button onClick={() => openLevelSet(m)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-secondary/90 p-1.5 text-muted-foreground shadow-sm active:scale-95 backdrop-blur-sm">
                      <Settings2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}

            {/* Empty state */}
            {activeTab !== "official" && !(
              (activeTab === "weekly" && weeklyRanking?.length) ||
              (activeTab === "monthly" && monthlyRanking?.length) ||
              (activeTab === "streak" && streakRanking?.length) ||
              (activeTab === "boss" && bossRanking?.length)
            ) && (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                <span className="text-3xl">🥊</span>
                <p className="mt-2 text-sm text-muted-foreground">아직 데이터가 없습니다</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Hall of Fame Section */}
      {topTab === "halloffame" && (
        <div className="space-y-2">
          <div className="mb-4 rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 to-primary/5 p-5 text-center">
            <span className="text-4xl">🏅</span>
            <h2 className="mt-2 text-lg font-bold text-foreground">명예의 전당</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {HALL_OF_FAME_DESCRIPTION}
            </p>
          </div>
          {officialLoading ? <SkeletonList /> : hallOfFameMembers.length > 0 ? (
            hallOfFameMembers.map((m, idx) => (
              <div key={m.r_user_id} className="relative">
                <RankMiniCard
                  nickname={m.r_nickname} rank={m.r_current_rank} level={m.r_current_level}
                  position={idx + 1} avatarUrl={m.r_avatar_url} xp={m.r_total_xp}
                  isMe={m.r_user_id === user?.id} isHallOfFame extra="153명예코치"
                />
                {isAdmin && (
                  <button onClick={() => openLevelSet(m)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-secondary/90 p-1.5 text-muted-foreground shadow-sm active:scale-95 backdrop-blur-sm">
                    <Settings2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-accent/30 p-8 text-center">
              <span className="text-3xl">🥊</span>
              <p className="mt-2 text-sm text-muted-foreground">아직 명예의 전당 멤버가 없습니다</p>
              <p className="mt-1 text-xs text-muted-foreground">블랙 레벨 10 + 마스터 미션 달성 시 입성!</p>
            </div>
          )}
        </div>
      )}

      {/* Admin: Level Set Modal */}
      {levelSetModal?.show && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/30 backdrop-blur-sm" onClick={() => setLevelSetModal(null)}>
          <div className="w-full max-w-lg animate-slide-up rounded-t-3xl border-t border-border bg-card p-6 pb-24 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg text-foreground">⚙️ 레벨 설정</h3>
              <button onClick={() => setLevelSetModal(null)} className="rounded-full bg-secondary p-2 active:scale-95">
                <X className="h-4 w-4 text-secondary-foreground" />
              </button>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">대상: <strong className="text-foreground">{levelSetModal.nickname}</strong></p>
            <p className="mb-3 text-xs text-muted-foreground">현재: {RANK_LABELS[levelSetModal.currentRank] || levelSetModal.currentRank} Lv.{levelSetModal.currentLevel}</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">랭크</label>
                <div className="flex gap-2">
                  {(["white", "blue", "red", "black"] as const).map(r => (
                    <button key={r} onClick={() => setSetRank(r)}
                      className={`flex-1 rounded-xl py-2 text-sm font-bold transition-all ${setRank === r ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                      {RANK_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">레벨 (1~10)</label>
                <div className="flex gap-1.5 flex-wrap">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(l => (
                    <button key={l} onClick={() => setSetLevel(l)}
                      className={`h-9 w-9 rounded-lg text-sm font-bold transition-all ${setLevel === l ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleSetLevel} disabled={settingLevel}
                className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md transition-all active:scale-[0.98] disabled:opacity-50">
                {settingLevel ? "설정 중..." : `${RANK_LABELS[setRank] || setRank} Lv.${setLevel}로 설정`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SkeletonList = () => (
  <div className="space-y-2">
    {[1, 2, 3, 4, 5].map(i => (
      <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
    ))}
  </div>
);

export default HallOfFamePage;
