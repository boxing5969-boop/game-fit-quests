import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import XPBar from "@/components/XPBar";
import RankBadge from "@/components/RankBadge";
import QuestCard from "@/components/QuestCard";
import LevelUpModal from "@/components/LevelUpModal";
import { useQuests, useMySubmissions, useSubmitQuest, useRecordAttendance, useXpLogs, useLevels } from "@/hooks/useQuestData";
import { useNavigate } from "react-router-dom";
import { User, ChevronRight } from "lucide-react";
import { celebrateSmall } from "@/lib/celebrations";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";

const RANK_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };

const HomePage = () => {
  const { profile, progress, role, refreshProgress } = useAuth();
  const navigate = useNavigate();
  const { data: quests } = useQuests();
  const { data: submissions } = useMySubmissions();
  const { data: xpLogs } = useXpLogs(7);
  const { data: levels } = useLevels();
  const submitQuest = useSubmitQuest();
  const attendance = useRecordAttendance();
  const [levelUpModal, setLevelUpModal] = useState<{ show: boolean; level: number; rank: string; xp: number }>({ show: false, level: 0, rank: "", xp: 0 });

  // Record attendance on page load
  useEffect(() => {
    if (progress) {
      attendance.mutate();
    }
  }, [progress?.user_id]); // eslint-disable-line

  if (!profile || !progress) {
    return <LoadingState />;
  }

  const rank = progress.current_rank as Enums<"rank_name">;
  const currentLevel = levels?.find(l => l.rank_name === rank && l.level_number === progress.current_level);
  const nextLevel = levels?.find(l => l.rank_name === rank && l.level_number === progress.current_level + 1)
    || (progress.current_level === 10 ? currentLevel : null);
  const xpToNext = nextLevel?.xp_required || currentLevel?.xp_required || (progress.current_level * 50);
  const xpRemaining = Math.max(0, xpToNext - progress.total_xp);

  // Map quests with submission status
  const submissionMap = new Map((submissions || []).map(s => [s.quest_id, s.status]));
  const questsWithStatus = (quests || []).map(q => ({ ...q, subStatus: submissionMap.get(q.id) || null }));
  const mainQuest = questsWithStatus.find(q => q.quest_type === "main" && !q.subStatus);
  const subQuest = questsWithStatus.find(q => q.quest_type === "sub" && !q.subStatus);

  // Weekly completion
  const weeklyAll = questsWithStatus.filter(q => ["main", "sub", "weekly"].includes(q.quest_type));
  const weeklyDone = weeklyAll.filter(q => q.subStatus === "approved").length;
  const weeklyRate = weeklyAll.length > 0 ? Math.round((weeklyDone / weeklyAll.length) * 100) : 0;

  // Recent 7 days activity
  const last7 = (xpLogs || []).filter(l => {
    const d = new Date(l.created_at);
    const now = new Date();
    return (now.getTime() - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
  });
  const totalXpThisWeek = last7.reduce((sum, l) => sum + l.amount, 0);

  const handleSubmit = async (questId: string) => {
    try {
      await submitQuest.mutateAsync(questId);
      celebrateSmall();
      toast.success("완료 요청을 보냈습니다! 🥊");
    } catch {
      toast.error("요청 실패");
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">안녕하세요 👋</p>
          <h1 className="text-2xl text-foreground">{profile.nickname || profile.name}</h1>
        </div>
        <button onClick={() => navigate("/mypage")} className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-all active:scale-95">
          <User className="h-5 w-5 text-secondary-foreground" />
        </button>
      </div>

      <div className="space-y-5">
        {/* Rank & XP Card */}
        <div className="animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <RankBadge rank={rank} level={progress.current_level} size="lg" />
            <span className="rounded-full bg-accent/60 px-3 py-1 text-xs font-bold text-accent-foreground">
              {currentLevel?.title || `${RANK_LABELS[rank]} Lv.${progress.current_level}`}
            </span>
          </div>
          <XPBar current={progress.total_xp} max={xpToNext} />
          <p className="mt-1.5 text-xs text-muted-foreground text-right">
            다음 레벨까지 <strong className="text-primary">{xpRemaining} XP</strong> 남음
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2.5 animate-slide-up" style={{ animationDelay: "0.05s" }}>
          <div className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card p-3 shadow-sm">
            <span className="text-xl">{progress.streak_days >= 3 ? "🔥" : "💪"}</span>
            <span className="text-xs text-muted-foreground">연속 출석</span>
            <span className="text-lg font-bold text-foreground">{progress.streak_days}일</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card p-3 shadow-sm">
            <span className="text-xl">⚡</span>
            <span className="text-xs text-muted-foreground">이번 주</span>
            <span className="text-lg font-bold text-foreground">{totalXpThisWeek} XP</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card p-3 shadow-sm">
            <span className="text-xl">📊</span>
            <span className="text-xs text-muted-foreground">완료율</span>
            <span className="text-lg font-bold text-foreground">{weeklyRate}%</span>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => navigate("/quests")}
          className="w-full animate-slide-up rounded-2xl bg-primary py-5 text-center text-lg font-bold text-primary-foreground shadow-lg transition-all active:scale-[0.98]"
          style={{ animationDelay: "0.1s" }}
        >
          🥊 오늘 도전 시작
        </button>

        {/* Main Quest */}
        {mainQuest ? (
          <div className="animate-slide-up" style={{ animationDelay: "0.15s" }}>
            <h2 className="mb-3 text-base font-bold text-foreground">🥊 오늘의 메인 퀘스트</h2>
            <QuestCard quest={mainQuest} submissionStatus={null} onSubmit={() => handleSubmit(mainQuest.id)} isSubmitting={submitQuest.isPending} />
          </div>
        ) : (
          <EmptyState message="오늘의 메인 퀘스트가 없습니다" />
        )}

        {/* Sub Quest */}
        {subQuest && (
          <div className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <h2 className="mb-3 text-base font-bold text-foreground">📋 서브 퀘스트</h2>
            <QuestCard quest={subQuest} submissionStatus={null} onSubmit={() => handleSubmit(subQuest.id)} isSubmitting={submitQuest.isPending} />
          </div>
        )}

        {/* Recent Activity */}
        {last7.length > 0 && (
          <div className="animate-slide-up" style={{ animationDelay: "0.25s" }}>
            <h2 className="mb-3 text-base font-bold text-foreground">⚡ 최근 7일 활동</h2>
            <div className="rounded-2xl border border-border bg-card shadow-sm">
              {last7.slice(0, 5).map((log, idx) => (
                <div key={log.id} className={`flex items-center justify-between px-4 py-2.5 ${idx < Math.min(last7.length, 5) - 1 ? "border-b border-border" : ""}`}>
                  <div>
                    <p className="text-sm text-foreground">{log.reason}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleDateString("ko-KR")}</p>
                  </div>
                  <span className="text-xs font-bold text-primary">+{log.amount} XP</span>
                </div>
              ))}
            </div>
          </div>
        )}

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

const LoadingState = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="text-center">
      <div className="mx-auto mb-4 h-16 w-16 animate-pulse rounded-2xl bg-primary/20" />
      <p className="text-muted-foreground">로딩 중...</p>
    </div>
  </div>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="rounded-2xl border border-dashed border-border p-8 text-center">
    <span className="text-3xl">🥊</span>
    <p className="mt-2 text-sm text-muted-foreground">{message}</p>
  </div>
);

export default HomePage;
