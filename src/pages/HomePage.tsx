import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import XPBar from "@/components/XPBar";
import RankBadge from "@/components/RankBadge";
import RankMiniCard from "@/components/RankMiniCard";
import QuestCard from "@/components/QuestCard";
import LevelUpModal from "@/components/LevelUpModal";
import { useQuests, useMySubmissions, useSubmitQuest, useRecordAttendance, useLevels } from "@/hooks/useQuestData";
import { useDivisionRanking, useRivalsAbove, useSetRival } from "@/hooks/useRankingData";
import { useNavigate } from "react-router-dom";
import { User, ChevronRight, TrendingUp } from "lucide-react";
import { celebrateSmall } from "@/lib/celebrations";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";

const RANK_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };

const HomePage = () => {
  const { user, profile, progress, role, refreshProgress } = useAuth();
  const navigate = useNavigate();
  const { data: quests } = useQuests();
  const { data: submissions } = useMySubmissions();
  const { data: levels } = useLevels();
  const { data: ranking } = useDivisionRanking();
  const { data: rivalsAbove } = useRivalsAbove();
  const submitQuest = useSubmitQuest();
  const attendance = useRecordAttendance();
  const setRival = useSetRival();
  const [levelUpModal, setLevelUpModal] = useState<{ show: boolean; level: number; rank: string; xp: number }>({ show: false, level: 0, rank: "", xp: 0 });

  useEffect(() => {
    if (progress) attendance.mutate();
  }, [progress?.user_id]); // eslint-disable-line

  if (!profile || !progress) return <LoadingState />;

  const rank = progress.current_rank as Enums<"rank_name">;
  const currentLevel = levels?.find(l => l.rank_name === rank && l.level_number === progress.current_level);
  const nextLevel = levels?.find(l => l.rank_name === rank && l.level_number === progress.current_level + 1)
    || (progress.current_level === 10 ? currentLevel : null);
  const xpToNext = nextLevel?.xp_required || currentLevel?.xp_required || (progress.current_level * 50);
  const xpRemaining = Math.max(0, xpToNext - progress.total_xp);

  // My position
  const myPosition = ranking?.find(r => r.r_user_id === user?.id)?.rank_position;

  // Quest status
  const submissionMap = new Map((submissions || []).map(s => [s.quest_id, s.status]));
  const questsWithStatus = (quests || []).map(q => ({ ...q, subStatus: submissionMap.get(q.id) || null }));
  const todayQuest = questsWithStatus.find(q => (q.quest_type === "main" || q.quest_type === "sub") && !q.subStatus);

  const handleSubmit = async (questId: string) => {
    try {
      await submitQuest.mutateAsync(questId);
      celebrateSmall();
      toast.success("완료 요청을 보냈습니다! 🥊");
    } catch { toast.error("요청 실패"); }
  };

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">안녕하세요 👋</p>
          <h1 className="text-2xl text-foreground">{profile.nickname || profile.name}</h1>
        </div>
        <button onClick={() => navigate("/mypage")} className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-all active:scale-95">
          <User className="h-5 w-5 text-secondary-foreground" />
        </button>
      </div>

      <div className="space-y-5">
        {/* ── 1. 내 계급/레벨 대형 배지 + 순위 ── */}
        <div className="animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <RankBadge rank={rank} level={progress.current_level} size="lg" />
            {myPosition && (
              <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm font-bold text-primary">{myPosition}위</span>
              </div>
            )}
          </div>
          <div className="mb-2 text-xs text-muted-foreground">
            {currentLevel?.title || `${RANK_LABELS[rank]} Lv.${progress.current_level}`}
            {profile.branch_name && <span className="ml-1.5 text-muted-foreground/60">· {profile.branch_name}</span>}
          </div>
          <XPBar current={progress.total_xp} max={xpToNext} />
          <p className="mt-1.5 text-right text-xs text-muted-foreground">
            다음 레벨까지 <strong className="text-primary">{xpRemaining} XP</strong>
          </p>
        </div>

        {/* ── 2. 승급 조건 요약 ── */}
        <NextPromotionCard rank={rank} level={progress.current_level} xpRemaining={xpRemaining} />

        {/* ── 3. 내 위 추격 대상 ── */}
        {rivalsAbove && rivalsAbove.length > 0 && (
          <div className="animate-slide-up" style={{ animationDelay: "0.05s" }}>
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
              🎯 추격 대상
            </h2>
            <div className="space-y-2">
              {rivalsAbove.map(rival => (
                <RankMiniCard
                  key={rival.r_user_id}
                  nickname={rival.r_nickname}
                  rank={rival.r_current_rank}
                  level={rival.r_current_level}
                  position={Number(rival.rank_position)}
                  avatarUrl={rival.r_avatar_url}
                  xp={rival.r_total_xp}
                  isRival={progress.rival_id === rival.r_user_id}
                  onSetRival={() => {
                    setRival.mutate(rival.r_user_id);
                    toast.success(`${rival.r_nickname}을 추격 목표로 설정! 🎯`);
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── 4. Stats Row ── */}
        <div className="grid grid-cols-3 gap-2.5 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <StatBox icon={progress.streak_days >= 3 ? "🔥" : "💪"} label="연속 출석" value={`${progress.streak_days}일`} />
          <StatBox icon="⚡" label="누적 XP" value={progress.total_xp.toLocaleString()} />
          <StatBox icon="🏆" label="보스 클리어" value={`${progress.bosses_cleared}회`} />
        </div>

        {/* ── 5. CTA ── */}
        <button
          onClick={() => navigate("/quests")}
          className="w-full animate-slide-up rounded-2xl bg-primary py-5 text-center text-lg font-bold text-primary-foreground shadow-lg transition-all active:scale-[0.98]"
          style={{ animationDelay: "0.15s" }}
        >
          🥊 오늘 도전 시작
        </button>

        {/* ── 6. 오늘 퀘스트 ── */}
        {todayQuest && (
          <div className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <h2 className="mb-3 text-base font-bold text-foreground">🥊 오늘의 퀘스트</h2>
            <QuestCard quest={todayQuest} submissionStatus={null} onSubmit={() => handleSubmit(todayQuest.id)} isSubmitting={submitQuest.isPending} />
          </div>
        )}

        {/* ── 7. 최근 승급자 ── */}
        <RecentPromotions ranking={ranking} />

        {/* Coach shortcut */}
        {(role === "coach" || role === "admin") && (
          <button onClick={() => navigate("/coach")} className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all active:scale-[0.98]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📋</span>
                <div>
                  <p className="text-sm font-bold text-foreground">{role === "admin" ? "관리자 대시보드" : "코치 대시보드"}</p>
                  <p className="text-xs text-muted-foreground">승인 대기 퀘스트 관리</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </button>
        )}
      </div>

      <LevelUpModal
        isOpen={levelUpModal.show}
        onClose={() => { setLevelUpModal({ show: false, level: 0, rank: "", xp: 0 }); refreshProgress(); }}
        newLevel={levelUpModal.level}
        newRank={levelUpModal.rank}
        xpGranted={levelUpModal.xp}
      />
    </div>
  );
};

/* ── Sub Components ── */

const LoadingState = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="text-center">
      <div className="mx-auto mb-4 h-16 w-16 animate-pulse rounded-2xl bg-primary/20" />
      <p className="text-muted-foreground">로딩 중...</p>
    </div>
  </div>
);

const StatBox = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <div className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card p-3 shadow-sm">
    <span className="text-xl">{icon}</span>
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-lg font-bold text-foreground">{value}</span>
  </div>
);

const NextPromotionCard = ({ rank, level, xpRemaining }: { rank: string; level: number; xpRemaining: number }) => {
  const RANK_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };
  const isBossLevel = level === 10;
  const nextRankMap: Record<string, string> = { white: "블루", blue: "레드", red: "블랙", black: "블랙" };

  return (
    <div className="animate-slide-up rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4">
      <p className="mb-2 text-xs font-bold text-primary">
        {isBossLevel ? `🏆 ${nextRankMap[rank]} 승급 조건` : `⬆️ Lv.${level + 1} 승급 조건`}
      </p>
      <div className="space-y-1.5 text-xs text-foreground">
        <div className="flex items-center gap-2">
          <span className={xpRemaining <= 0 ? "text-green-500" : "text-muted-foreground"}>
            {xpRemaining <= 0 ? "✅" : "⬜"}
          </span>
          <span>필요 XP 달성 {xpRemaining > 0 && `(${xpRemaining} XP 부족)`}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">⬜</span>
          <span>메인 퀘스트 1개 승인</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">⬜</span>
          <span>서브 퀘스트 1개 승인</span>
        </div>
        {isBossLevel && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">⬜</span>
            <span>🥊 타이틀매치 클리어</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">⬜</span>
          <span>코치 최종 승인</span>
        </div>
      </div>
    </div>
  );
};

const RecentPromotions = ({ ranking }: { ranking?: any[] }) => {
  // Show top 3 high-level members as "role models"
  const topMembers = (ranking || []).slice(0, 3);
  if (topMembers.length === 0) return null;

  return (
    <div className="animate-slide-up" style={{ animationDelay: "0.25s" }}>
      <h2 className="mb-3 text-base font-bold text-foreground">👑 상위 랭커</h2>
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        {topMembers.map((m, idx) => (
          <div key={m.r_user_id} className={`flex items-center gap-3 px-4 py-3 ${idx < topMembers.length - 1 ? "border-b border-border" : ""}`}>
            <span className="text-lg">{["🥇", "🥈", "🥉"][idx]}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">{m.r_nickname}</p>
              <p className="text-xs text-muted-foreground">
                {RANK_LABELS[m.r_current_rank] || m.r_current_rank} Lv.{m.r_current_level} · {m.r_total_xp} XP
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const RANK_LABELS_TOP: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };

export default HomePage;
