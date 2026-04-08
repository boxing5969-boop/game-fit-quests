import { currentUser, todayQuests, badges, getNextBossDDay } from "@/lib/mockData";
import RankBadge from "@/components/RankBadge";
import XPBar from "@/components/XPBar";
import QuestCard from "@/components/QuestCard";
import { useNavigate } from "react-router-dom";
import { User, ChevronRight } from "lucide-react";

const HomePage = () => {
  const navigate = useNavigate();
  const mainQuest = todayQuests.find((q) => q.status === "active");
  const subQuest = todayQuests.find((q) => q.status !== "active" && q.status !== "complete");
  const recentBadges = badges.filter(b => currentUser.recentBadges.includes(b.id)).slice(0, 3);
  const bossDDay = getNextBossDDay();

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">안녕하세요 👋</p>
          <h1 className="text-2xl text-foreground">{currentUser.name}</h1>
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
            <RankBadge rank={currentUser.rank} level={currentUser.level} size="lg" />
            <span className="rounded-full bg-accent/60 px-3 py-1 text-xs font-bold text-accent-foreground">
              {currentUser.title}
            </span>
          </div>
          <XPBar current={currentUser.xp} max={currentUser.xpToNext} />
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-3 animate-slide-up" style={{ animationDelay: "0.05s" }}>
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <span className="text-2xl">🔥</span>
            <div>
              <p className="text-xs text-muted-foreground">연속 출석</p>
              <p className="text-xl font-bold text-foreground">{currentUser.streak}일</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <span className="text-2xl">🏆</span>
            <div>
              <p className="text-xs text-muted-foreground">다음 타이틀매치</p>
              <p className="text-xl font-bold text-foreground">D-{bossDDay}</p>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={() => navigate("/quests")}
          className="w-full animate-slide-up rounded-2xl bg-primary py-5 text-center text-lg font-bold text-primary-foreground shadow-lg transition-all active:scale-[0.98] hover:shadow-xl"
          style={{ animationDelay: "0.1s", animation: "pulse-glow 2s ease-in-out infinite, slide-up 0.35s ease-out" }}
        >
          🥊 오늘 도전 시작
        </button>

        {/* Main Quest */}
        {mainQuest && (
          <div className="animate-slide-up" style={{ animationDelay: "0.15s" }}>
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
              🥊 오늘의 메인 퀘스트
            </h2>
            <QuestCard quest={mainQuest} />
          </div>
        )}

        {/* Sub Quest */}
        {subQuest && (
          <div className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
              📋 서브 퀘스트
            </h2>
            <QuestCard quest={subQuest} />
          </div>
        )}

        {/* Recent Badges */}
        {recentBadges.length > 0 && (
          <div className="animate-slide-up" style={{ animationDelay: "0.25s" }}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">🏅 최근 획득 배지</h2>
              <button onClick={() => navigate("/rewards")} className="flex items-center gap-0.5 text-xs text-primary">
                더보기 <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex gap-3">
              {recentBadges.map((b) => (
                <div key={b.id} className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl border border-primary/20 bg-card p-3 shadow-sm">
                  <span className="text-3xl">{b.icon}</span>
                  <span className="text-xs font-bold text-foreground">{b.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
