import { useAuth } from "@/contexts/AuthContext";
import XPBar from "@/components/XPBar";
import RankBadge from "@/components/RankBadge";
import QuestCard from "@/components/QuestCard";
import { useQuests, useMySubmissions } from "@/hooks/useQuestData";
import { useNavigate } from "react-router-dom";
import { User, ChevronRight } from "lucide-react";
import type { Enums } from "@/integrations/supabase/types";

const RANK_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };

const HomePage = () => {
  const { profile, progress, role } = useAuth();
  const navigate = useNavigate();
  const { data: quests, isLoading: questsLoading } = useQuests();
  const { data: submissions } = useMySubmissions();

  if (!profile || !progress) {
    return <LoadingState />;
  }

  const rank = progress.current_rank as Enums<"rank_name">;
  const xpToNext = getXpToNext(progress.current_level, rank);

  // Map quests with submission status
  const questsWithStatus = (quests || []).map((q) => {
    const sub = submissions?.find((s) => s.quest_id === q.id);
    return { ...q, submissionStatus: sub?.status ?? null };
  });

  const mainQuest = questsWithStatus.find(q => q.quest_type === "main" && !q.submissionStatus);
  const subQuest = questsWithStatus.find(q => q.quest_type === "sub" && !q.submissionStatus);

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">안녕하세요 👋</p>
          <h1 className="text-2xl text-foreground">{profile.nickname || profile.name}</h1>
        </div>
        <button
          onClick={() => navigate("/mypage")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-all active:scale-95"
        >
          <User className="h-5 w-5 text-secondary-foreground" />
        </button>
      </div>

      <div className="space-y-5">
        {/* Rank & XP Card */}
        <div className="animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <RankBadge rank={rank} level={progress.current_level} size="lg" />
            <span className="rounded-full bg-accent/60 px-3 py-1 text-xs font-bold text-accent-foreground">
              {RANK_LABELS[rank]} Lv.{progress.current_level}
            </span>
          </div>
          <XPBar current={progress.total_xp} max={xpToNext} />
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-3 animate-slide-up" style={{ animationDelay: "0.05s" }}>
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <span className="text-2xl">🔥</span>
            <div>
              <p className="text-xs text-muted-foreground">연속 출석</p>
              <p className="text-xl font-bold text-foreground">{progress.streak_days}일</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <span className="text-2xl">🏆</span>
            <div>
              <p className="text-xs text-muted-foreground">보스 클리어</p>
              <p className="text-xl font-bold text-foreground">{progress.bosses_cleared}회</p>
            </div>
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
        {questsLoading ? (
          <QuestSkeleton />
        ) : mainQuest ? (
          <div className="animate-slide-up" style={{ animationDelay: "0.15s" }}>
            <h2 className="mb-3 text-base font-bold text-foreground">🥊 오늘의 메인 퀘스트</h2>
            <QuestCard quest={mainQuest} submissionStatus={null} />
          </div>
        ) : (
          <EmptyState message="오늘의 메인 퀘스트가 없습니다" />
        )}

        {/* Sub Quest */}
        {subQuest && (
          <div className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <h2 className="mb-3 text-base font-bold text-foreground">📋 서브 퀘스트</h2>
            <QuestCard quest={subQuest} submissionStatus={null} />
          </div>
        )}

        {/* Coach/Admin shortcut */}
        {(role === "coach" || role === "admin") && (
          <button
            onClick={() => navigate("/coach")}
            className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all active:scale-[0.98]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📋</span>
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {role === "admin" ? "관리자 대시보드" : "코치 대시보드"}
                  </p>
                  <p className="text-xs text-muted-foreground">승인 대기 퀘스트 관리</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </button>
        )}
      </div>
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

const QuestSkeleton = () => (
  <div className="space-y-3">
    <div className="h-5 w-40 animate-pulse rounded bg-muted" />
    <div className="h-24 animate-pulse rounded-2xl bg-muted" />
  </div>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="rounded-2xl border border-dashed border-border p-8 text-center">
    <span className="text-3xl">🥊</span>
    <p className="mt-2 text-sm text-muted-foreground">{message}</p>
  </div>
);

function getXpToNext(level: number, rank: string): number {
  const rankIdx = ["white", "blue", "red", "black"].indexOf(rank);
  const globalLevel = rankIdx * 10 + level;
  return (globalLevel + 1) * 50;
}

export default HomePage;
