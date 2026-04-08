import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuests, useLevels } from "@/hooks/useQuestData";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";

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

const QuestManager = () => {
  const { data: quests, isLoading } = useQuests();
  const { data: levels } = useLevels();
  const qc = useQueryClient();
  const [form, setForm] = useState<QuestForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");

  const filtered = (quests || []).filter(q => filterType === "all" || q.quest_type === filterType);

  const sortedLevels = (levels || []).sort((a, b) => {
    const ri = (["white", "blue", "red", "black"] as string[]).indexOf(a.rank_name) - (["white", "blue", "red", "black"] as string[]).indexOf(b.rank_name);
    return ri !== 0 ? ri : a.level_number - b.level_number;
  });

  const openEdit = (quest: any) => {
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

  const handleSave = async () => {
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
        toast.success("퀘스트 수정 완료");
      } else {
        const { error } = await supabase.from("quests").insert(data);
        if (error) throw error;
        toast.success("퀘스트 추가 완료");
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

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`"${title}" 퀘스트를 삭제하시겠습니까?`)) return;
    try {
      const { error } = await supabase.from("quests").delete().eq("id", id);
      if (error) throw error;
      toast.success("퀘스트 삭제 완료");
      qc.invalidateQueries({ queryKey: ["quests"] });
    } catch {
      toast.error("삭제 실패");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5 overflow-x-auto">
          {["all", "main", "sub", "weekly", "boss"].map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${filterType === t ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
              {t === "all" ? "전체" : QUEST_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <button onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(true); }}
          className="ml-2 flex shrink-0 items-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground active:scale-95">
          <Plus className="h-3.5 w-3.5" /> 추가
        </button>
      </div>

      {isLoading ? (
        [1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)
      ) : !filtered.length ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <span className="text-4xl">🥊</span>
          <p className="mt-3 text-sm text-muted-foreground">등록된 퀘스트가 없습니다</p>
        </div>
      ) : (
        filtered.map((q: any) => (
          <div key={q.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {QUEST_TYPE_LABELS[q.quest_type] || q.quest_type}
                  </span>
                  <p className="text-sm font-bold text-foreground truncate">{q.title}</p>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs font-bold text-primary">+{q.xp_reward} XP</span>
                  {q.needs_coach_approval && <span className="text-[10px] text-muted-foreground">코치승인필요</span>}
                </div>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => openEdit(q)} className="rounded-lg bg-secondary p-2 active:scale-95">
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button onClick={() => handleDelete(q.id, q.title)} className="rounded-lg bg-destructive/10 p-2 active:scale-95">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            </div>
          </div>
        ))
      )}

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
                  <label className="mb-1 block text-xs text-muted-foreground">연결 레벨 (선택)</label>
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
                  onChange={e => setForm(f => ({ ...f, needs_coach_approval: e.target.checked }))}
                  className="rounded" />
                코치 승인 필요
              </label>
              <button onClick={handleSave} disabled={saving}
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

export default QuestManager;
