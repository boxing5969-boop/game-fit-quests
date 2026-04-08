import { useState } from "react";
import { useQuests, useMySubmissions, useSubmitQuest } from "@/hooks/useQuestData";
import { useAuth } from "@/contexts/AuthContext";
import QuestCard from "@/components/QuestCard";
import { User, Pencil, Trash2, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { celebrateSmall } from "@/lib/celebrations";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { Enums } from "@/integrations/supabase/types";

type TabKey = "today" | "weekly" | "boss";
const tabs: { key: TabKey; label: string; icon: string; types: Enums<"quest_type">[] }[] = [
  { key: "today", label: "오늘", icon: "🥊", types: ["main", "sub"] },
  { key: "weekly", label: "주간", icon: "📅", types: ["weekly"] },
  { key: "boss", label: "타이틀매치", icon: "🏆", types: ["boss"] },
];

const QuestsPage = () => {
  const [activeTab, setActiveTab] = useState<TabKey>("today");
  const navigate = useNavigate();
  const { role } = useAuth();
  const { data: quests, isLoading } = useQuests();
  const { data: submissions } = useMySubmissions();
  const submitQuest = useSubmitQuest();
  const qc = useQueryClient();
  const isAdmin = role === "admin";

  const currentTypes = tabs.find(t => t.key === activeTab)!.types;
  const filtered = (quests || []).filter(q => currentTypes.includes(q.quest_type));

  const submissionMap = new Map((submissions || []).map(s => [s.quest_id, s.status]));

  const allMainSub = (quests || []).filter(q => ["main", "sub", "weekly"].includes(q.quest_type));
  const completed = allMainSub.filter(q => submissionMap.get(q.id) === "approved").length;
  const completionRate = allMainSub.length > 0 ? Math.round((completed / allMainSub.length) * 100) : 0;

  const handleSubmit = async (questId: string) => {
    try {
      await submitQuest.mutateAsync(questId);
      celebrateSmall();
      toast.success("완료 요청을 보냈습니다! 🥊");
    } catch {
      toast.error("요청 실패");
    }
  };

  const handleDeleteQuest = async (id: string, title: string) => {
    if (!confirm(`"${title}" 퀘스트를 삭제하시겠습니까?`)) return;
    try {
      const { error } = await supabase.from("quests").delete().eq("id", id);
      if (error) throw error;
      toast.success("퀘스트 삭제 완료");
      qc.invalidateQueries({ queryKey: ["quests"] });
    } catch { toast.error("삭제 실패"); }
  };
  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl text-foreground">🥊 퀘스트</h1>
        <button onClick={() => navigate("/mypage")} className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-all active:scale-95">
          <User className="h-5 w-5 text-secondary-foreground" />
        </button>
      </div>

      {/* Completion Rate */}
      <div className="mb-5 animate-slide-up rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">이번 주 완료율</span>
          <span className="text-sm font-bold text-primary">{completionRate}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-xp-bg">
          <div className="h-full rounded-full bg-status-complete transition-all duration-500" style={{ width: `${completionRate}%` }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-2">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-xl py-3 text-sm font-bold transition-all active:scale-[0.97] ${
              activeTab === tab.key ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-secondary-foreground"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Quest List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center">
          <span className="text-4xl">🥊</span>
          <p className="mt-3 text-muted-foreground">퀘스트가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((q, idx) => {
            const subStatus = submissionMap.get(q.id) || null;
            const isBoss = q.quest_type === "boss";
            return (
              <div key={q.id} className={`animate-slide-up ${isBoss ? "" : ""}`} style={{ animationDelay: `${idx * 0.05}s` }}>
                {isBoss && (
                  <div className="mb-1 flex items-center gap-1.5 px-1">
                    <span className="text-xs font-bold text-accent-foreground">🏆 타이틀매치</span>
                  </div>
                )}
                <div className={isBoss ? "rounded-2xl border-2 border-accent/40 bg-accent/5 p-1" : ""}>
                  <QuestCard
                    quest={q}
                    submissionStatus={subStatus}
                    onSubmit={() => handleSubmit(q.id)}
                    isSubmitting={submitQuest.isPending}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default QuestsPage;
