import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import RankMiniCard from "@/components/RankMiniCard";
import {
  useDivisionRanking,
  useWeeklyActivityRanking,
  useMonthlyRisers,
  useStreakRanking,
  useBossConquerors,
  useSetRival,
} from "@/hooks/useRankingData";
import { toast } from "sonner";

const TABS = [
  { key: "official", label: "🏆 공식 랭킹" },
  { key: "weekly", label: "⚡ 이번 주" },
  { key: "monthly", label: "📈 상승왕" },
  { key: "streak", label: "🔥 출석" },
  { key: "boss", label: "🥊 보스전" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const HallOfFamePage = () => {
  const navigate = useNavigate();
  const { user, progress } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("official");
  const setRival = useSetRival();

  const { data: officialRanking, isLoading: officialLoading } = useDivisionRanking();
  const { data: weeklyRanking } = useWeeklyActivityRanking();
  const { data: monthlyRanking } = useMonthlyRisers();
  const { data: streakRanking } = useStreakRanking();
  const { data: bossRanking } = useBossConquerors();

  const myPosition = officialRanking?.find(r => r.r_user_id === user?.id)?.rank_position;

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl text-foreground">🏆 명예의 전당</h1>
        <button onClick={() => navigate("/mypage")} className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-all active:scale-95">
          <User className="h-5 w-5 text-secondary-foreground" />
        </button>
      </div>

      {/* My position card */}
      {progress && myPosition && (
        <div className="mb-5 animate-slide-up rounded-2xl border border-primary/30 bg-primary/5 p-4">
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

      {/* Tabs */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {TABS.map(tab => (
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

      {/* Content */}
      <div className="space-y-2">
        {activeTab === "official" && (
          officialLoading ? <SkeletonList /> : (
            (officialRanking || []).map(m => (
              <RankMiniCard
                key={m.r_user_id}
                nickname={m.r_nickname}
                rank={m.r_current_rank}
                level={m.r_current_level}
                position={Number(m.rank_position)}
                avatarUrl={m.r_avatar_url}
                xp={m.r_total_xp}
                isMe={m.r_user_id === user?.id}
                isRival={progress?.rival_id === m.r_user_id}
                onSetRival={() => {
                  setRival.mutate(m.r_user_id);
                  toast.success(`${m.r_nickname}을 추격 목표로 설정! 🎯`);
                }}
              />
            ))
          )
        )}

        {activeTab === "weekly" && (
          (weeklyRanking || []).map(m => (
            <RankMiniCard
              key={m.r_user_id}
              nickname={m.r_nickname}
              rank={m.r_current_rank}
              level={m.r_current_level}
              position={Number(m.rank_position)}
              avatarUrl={m.r_avatar_url}
              isMe={m.r_user_id === user?.id}
              extra={`${m.weekly_xp} XP`}
            />
          ))
        )}

        {activeTab === "monthly" && (
          (monthlyRanking || []).map(m => (
            <RankMiniCard
              key={m.r_user_id}
              nickname={m.r_nickname}
              rank={m.r_current_rank}
              level={m.r_current_level}
              position={Number(m.rank_position)}
              avatarUrl={m.r_avatar_url}
              isMe={m.r_user_id === user?.id}
              extra={`+${m.monthly_xp} XP`}
            />
          ))
        )}

        {activeTab === "streak" && (
          (streakRanking || []).map(m => (
            <RankMiniCard
              key={m.r_user_id}
              nickname={m.r_nickname}
              rank={m.r_current_rank}
              level={m.r_current_level}
              position={Number(m.rank_position)}
              avatarUrl={m.r_avatar_url}
              isMe={m.r_user_id === user?.id}
              extra={`🔥 ${m.r_streak_days}일`}
            />
          ))
        )}

        {activeTab === "boss" && (
          (bossRanking || []).map(m => (
            <RankMiniCard
              key={m.r_user_id}
              nickname={m.r_nickname}
              rank={m.r_current_rank}
              level={m.r_current_level}
              position={Number(m.rank_position)}
              avatarUrl={m.r_avatar_url}
              isMe={m.r_user_id === user?.id}
              extra={`🏆 ${m.r_bosses_cleared}회`}
            />
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
