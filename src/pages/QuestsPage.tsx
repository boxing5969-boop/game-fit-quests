import { useState } from "react";
import { useQuests, useMySubmissions, useSubmitQuest, useLevels } from "@/hooks/useQuestData";
import { useAuth } from "@/contexts/AuthContext";
import QuestCard from "@/components/QuestCard";
import { User, Pencil, Trash2, Plus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { celebrateSmall } from "@/lib/celebrations";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import type { Enums } from "@/integrations/supabase/types";

type TabKey = "today" | "weekly" | "boss";
const tabs: { key: TabKey; label: string; icon: string; types: Enums<"quest_type">[] }[] = [
  { key: "today", label: "오늘", icon: "🥊", types: ["main", "sub"] },
  { key: "weekly", label: "주간", icon: "📅", types: ["weekly"] },
  { key: "boss", label: "타이틀매치", icon: "🏆", types: ["boss"] },
];

const QUEST_TYPE_LABELS: Record<string, string> = { main: "메인", sub: "서브", weekly: "주간", boss: "보스" };
const RANK_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };

interface QuestForm {
  title: string;
  description: string;
  quest_type: Enums<"quest_type">;
  xp_reward: number;
  needs_coach_approval: boolean;
  level_id: string;
}

const emptyForm: QuestForm = {
  title: "", description: "", quest_type: "main", xp_reward: 20, needs_coach_approval: false, level_id: "",
};

const QuestsPage = () => {
  const [activeTab, setActiveTab] = useState<TabKey>("today");
  const navigate = useNavigate();
  const { role } = useAuth();
  const { data: quests, isLoading } = useQuests();
  const { data: submissions } = useMySubmissions();
  const { data: levels } = useLevels();
  const submitQuest = useSubmitQuest();
  const qc = useQueryClient();
  const isAdmin = role === "admin";

  // Admin form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<QuestForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const currentTypes = tabs.find(t => t.key === activeTab)!.types;
  const filtered = (quests || []).filter(q => currentTypes.includes(q.quest_type));

  const submissionMap = new Map((submissions || []).map(s => [s.quest_id, s.status]));

  const allMainSub = (quests || []).filter(q => ["main", "sub", "weekly"].includes(q.quest_type));
  const completed = allMainSub.filter(q => submissionMap.get(q.id) === "approved").length;
  const completionRate = allMainSub.length > 0 ? Math.round((completed / allMainSub.length) * 100) : 0;

  const sortedLevels = (levels || []).sort((a, b) => {
    const ri = (["white", "blue", "red", "black"] as string[]).indexOf(a.rank_name) - (["white", "blue", "red", "black"] as string[]).indexOf(b.rank_name);
    return ri !== 0 ? ri : a.level_number - b.level_number;
  });

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

  const openEditQuest = (quest: any) => {
    setForm({
      title: quest.title,
      description: quest.description,
      quest_type: quest.quest_type,
      xp_reward: quest.xp_reward,
      needs_coach_approval: quest.needs_coach_approval,
      level_id: quest.level_id || "",
    });
    setEditingId(quest.id);
    setShowForm(true);
  };

  const handleSaveQuest = async () => {
    if (!form.title.trim()) { toast.error("제목을 입력해주세요"); return; }
    setSaving(true);
    try {
      const data = {
        title: form.title.trim(),
        description: form.description.trim(),
        quest_type: form.quest_type,
        xp_reward: form.xp_reward,
        needs_coach_approval: form.needs_coach_approval,
        level_id: form.level_id || null,
      };
      if (editingId) {
        const { error } = await supabase.from("quests").update(data).eq("id", editingId);
        if (error) throw error;
        toast.success("퀘스트 수정 완료 ✅");
      } else {
        const { error } = await supabase.from("quests").insert(data);
        if (error) throw error;
        toast.success("퀘스트 추가 완료 ✅");
      }
      qc.invalidateQueries({ queryKey: ["quests"] });
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
    } catch (e: any) {
      toast.error(e?.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl text-foreground">🥊 퀘스트</h1>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(true); }}
              className="flex h-10 items-center gap-1 rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground transition-all active:scale-95">
              <Plus className="h-3.5 w-3.5" /> 추가
            </button>
          )}
          <button onClick={() => navigate("/mypage")} className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-all active:scale-95">
            <User className="h-5 w-5 text-secondary-foreground" />
          </button>
        </div>
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
              <div key={q.id} className={`animate-slide-up`} style={{ animationDelay: `${idx * 0.05}s` }}>
                {isBoss && (
                  <div className="mb-1 flex items-center gap-1.5 px-1">
                    <span className="text-xs font-bold text-accent-foreground">🏆 타이틀매치</span>
                  </div>
                )}
                <div className={isBoss ? "rounded-2xl border-2 border-accent/40 bg-accent/5 p-1" : ""}>
                  <div className="relative">
                    <QuestCard
                      quest={q}
                      submissionStatus={subStatus}
                      onSubmit={() => handleSubmit(q.id)}
                      isSubmitting={submitQuest.isPending}
                    />
                    {isAdmin && (
                      <div className="absolute right-2 top-2 flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); openEditQuest(q); }}
                          className="rounded-lg bg-secondary/90 p-1.5 text-foreground shadow-sm active:scale-95 backdrop-blur-sm">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteQuest(q.id, q.title); }}
                          className="rounded-lg bg-destructive/80 p-1.5 text-destructive-foreground shadow-sm active:scale-95">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Admin Quest Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg animate-slide-up rounded-t-3xl border-t border-border bg-card p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg text-foreground">{editingId ? "✏️ 퀘스트 수정" : "➕ 새 퀘스트 추가"}</h3>
              <button onClick={() => setShowForm(false)} className="rounded-full bg-secondary p-2 active:scale-95">
                <X className="h-4 w-4 text-secondary-foreground" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">퀘스트 유형</label>
                <div className="flex gap-2">
                  {(["main", "sub", "weekly", "boss"] as const).map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, quest_type: t }))}
                      className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${form.quest_type === t ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                      {QUEST_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">제목 *</label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="퀘스트 제목" className="rounded-xl" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">설명</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="퀘스트 설명" rows={2}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">XP 보상</label>
                  <Input type="number" value={form.xp_reward} onChange={e => setForm(f => ({ ...f, xp_reward: Number(e.target.value) }))} className="rounded-xl" />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">연결 레벨</label>
                  <select value={form.level_id} onChange={e => setForm(f => ({ ...f, level_id: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none">
                    <option value="">없음</option>
                    {sortedLevels.map(l => (
                      <option key={l.id} value={l.id}>{RANK_LABELS[l.rank_name]} Lv.{l.level_number}</option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={form.needs_coach_approval}
                  onChange={e => setForm(f => ({ ...f, needs_coach_approval: e.target.checked }))} className="rounded" />
                코치 승인 필요
              </label>
              <button onClick={handleSaveQuest} disabled={saving}
                className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md transition-all active:scale-[0.98] disabled:opacity-50">
                {saving ? "저장 중..." : editingId ? "수정 완료" : "퀘스트 추가"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestsPage;
