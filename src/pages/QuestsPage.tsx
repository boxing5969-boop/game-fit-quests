import { useState } from "react";
import { todayQuests, weeklyQuests, bossQuests, getWeeklyCompletionRate } from "@/lib/mockData";
import QuestCard from "@/components/QuestCard";
import { User } from "lucide-react";
import { useNavigate } from "react-router-dom";

type TabKey = "today" | "weekly" | "boss";

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: "today", label: "오늘", icon: "🥊" },
  { key: "weekly", label: "주간", icon: "📅" },
  { key: "boss", label: "타이틀매치", icon: "🏆" },
];

const QuestsPage = () => {
  const [activeTab, setActiveTab] = useState<TabKey>("today");
  const navigate = useNavigate();
  const completionRate = getWeeklyCompletionRate();

  const questsByTab: Record<TabKey, typeof todayQuests> = {
    today: todayQuests,
    weekly: weeklyQuests,
    boss: bossQuests,
  };

  const quests = questsByTab[activeTab];

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl text-foreground">🥊 퀘스트</h1>
        <button
          onClick={() => navigate("/mypage")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-all active:scale-95"
        >
          <User className="h-5 w-5 text-secondary-foreground" />
        </button>
      </div>

      {/* Weekly completion rate */}
      <div className="mb-5 animate-slide-up rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">이번 주 완료율</span>
          <span className="text-sm font-bold text-primary">{completionRate}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-xp-bg">
          <div
            className="h-full rounded-full bg-status-complete transition-all duration-500"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-xl py-3 text-sm font-bold transition-all active:scale-[0.97] ${
              activeTab === tab.key
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Quest List */}
      <div className="space-y-3">
        {quests.map((q, idx) => (
          <div key={q.id} className="animate-slide-up" style={{ animationDelay: `${idx * 0.05}s` }}>
            <QuestCard quest={q} />
          </div>
        ))}
        {quests.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            퀘스트가 없습니다
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestsPage;
