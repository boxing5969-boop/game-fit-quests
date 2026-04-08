import { currentUser, todayQuests } from "@/lib/mockData";
import RankBadge from "@/components/RankBadge";
import XPBar from "@/components/XPBar";
import QuestCard from "@/components/QuestCard";

const HomePage = () => {
  const activeQuest = todayQuests.find((q) => q.status === "active");

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 pb-24 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">안녕하세요</p>
          <h1 className="text-2xl">{currentUser.name}</h1>
        </div>
        <RankBadge rank={currentUser.rank} level={currentUser.level} size="lg" />
      </div>

      {/* XP */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">현재 칭호</span>
          <span className="font-display text-sm font-semibold text-primary">{currentUser.title}</span>
        </div>
        <XPBar current={currentUser.xp} max={currentUser.xpToNext} />
      </div>

      {/* Today's Featured Quest */}
      {activeQuest && (
        <div>
          <h2 className="mb-3 text-lg">🥊 오늘의 퀘스트</h2>
          <QuestCard quest={activeQuest} />
        </div>
      )}

      {/* Today's All Quests */}
      <div>
        <h2 className="mb-3 text-lg">📋 오늘 할 일</h2>
        <div className="space-y-3">
          {todayQuests.map((q) => (
            <QuestCard key={q.id} quest={q} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
