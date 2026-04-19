import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLevels } from "@/hooks/useQuestData";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";

const RANK_ORDER: Enums<"rank_name">[] = ["white", "blue", "red", "black"];
const RANK_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };
const RANK_ICONS: Record<string, string> = { white: "⚪", blue: "🔵", red: "🔴", black: "⚫" };

interface LevelForm {
  rank_name: Enums<"rank_name">;
  level_number: number;
  title: string;
  xp_required: number;
  is_boss: boolean;
  reward_name: string;
  display_order: number;
}

const emptyForm: LevelForm = {
  rank_name: "white", level_number: 1, title: "", xp_required: 0,
  is_boss: false, reward_name: "", display_order: 0,
};

const LevelManager = () => {
  const { data: levels, isLoading } = useLevels();
  const qc = useQueryClient();
  const [form, setForm] = useState<LevelForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterRank, setFilterRank] = useState<string>("all");

  const filtered = (levels || [])
    .filter(l => filterRank === "all" || l.rank_name === filterRank)
    .sort((a, b) => {
      const ri = RANK_ORDER.indexOf(a.rank_name) - RANK_ORDER.indexOf(b.rank_name);
      return ri !== 0 ? ri : a.level_number - b.level_number;
    });

  const openEdit = (level: any) => {
    setForm({
      rank_name: level.rank_name,
      level_number: level.level_number,
      title: level.title,
      xp_required: level.xp_required,
      is_boss: level.is_boss,
      reward_name: level.reward_name || "",
      display_order: level.display_order,
    });
    setEditingId(level.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("제목을 입력해주세요"); return; }
    setSaving(true);
    try {
      const data = {
        rank_name: form.rank_name,
        level_number: form.level_number,
        title: form.title.trim(),
        xp_required: form.xp_required,
        is_boss: form.is_boss,
        reward_name: form.reward_name.trim() || null,
        display_order: form.display_order,
      };
      if (editingId) {
        const { error } = await supabase.from("levels").update(data).eq("id", editingId);
        if (error) throw error;
        toast.success("레벨 수정 완료");
      } else {
        const { error } = await supabase.from("levels").insert(data);
        if (error) throw error;
        toast.success("레벨 추가 완료");
      }
      qc.invalidateQueries({ queryKey: ["levels"] });
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
    if (!confirm(`"${title}" 레벨을 삭제하시겠습니까? 연결된 미션도 확인하세요.`)) return;
    try {
      const { error } = await supabase.from("levels").delete().eq("id", id);
      if (error) throw error;
      toast.success("레벨 삭제 완료");
      qc.invalidateQueries({ queryKey: ["levels"] });
    } catch {
      toast.error("삭제 실패 (연결된 미션이 있을 수 있습니다)");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5 overflow-x-auto">
          {["all", ...RANK_ORDER].map(r => (
            <button key={r} onClick={() => setFilterRank(r)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${filterRank === r ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
              {r === "all" ? "전체" : `${RANK_ICONS[r]} ${RANK_LABELS[r]}`}
            </button>
          ))}
        </div>
        <button onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(true); }}
          className="ml-2 flex shrink-0 items-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground active:scale-95">
          <Plus className="h-3.5 w-3.5" /> 추가
        </button>
      </div>

      {isLoading ? (
        [1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />)
      ) : !filtered.length ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <span className="text-4xl">🗺️</span>
          <p className="mt-3 text-sm text-muted-foreground">등록된 레벨이 없습니다</p>
        </div>
      ) : (
        filtered.map((l: any) => (
          <div key={l.id} className="rounded-2xl border border-border bg-card p-3 shadow-elev-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{RANK_ICONS[l.rank_name]}</span>
                  <span className="text-xs font-bold text-muted-foreground">{RANK_LABELS[l.rank_name]} Lv.{l.level_number}</span>
                  {l.is_boss && <span className="rounded-full bg-reward/20 px-1.5 py-0.5 text-[9px] font-bold text-reward-foreground">BOSS</span>}
                </div>
                <p className="mt-0.5 text-sm font-bold text-foreground truncate">{l.title}</p>
                <div className="mt-0.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>필요 XP: {l.xp_required}</span>
                  {l.reward_name && <span>보상: {l.reward_name}</span>}
                </div>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => openEdit(l)} className="rounded-lg bg-secondary p-2 active:scale-95">
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button onClick={() => handleDelete(l.id, l.title)} className="rounded-lg bg-destructive/10 p-2 active:scale-95">
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
              <h3 className="text-lg text-foreground">{editingId ? "✏️ 레벨 수정" : "➕ 새 레벨 추가"}</h3>
              <button onClick={() => setShowForm(false)} className="rounded-full bg-secondary p-2 active:scale-95">
                <X className="h-4 w-4 text-secondary-foreground" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">랭크</label>
                <div className="flex gap-2">
                  {RANK_ORDER.map(r => (
                    <button key={r} onClick={() => setForm(f => ({ ...f, rank_name: r }))}
                      className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${form.rank_name === r ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                      {RANK_ICONS[r]} {RANK_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">레벨 번호</label>
                  <Input type="number" min={1} max={10} value={form.level_number}
                    onChange={e => setForm(f => ({ ...f, level_number: Number(e.target.value) }))} className="rounded-xl" />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">정렬 순서</label>
                  <Input type="number" value={form.display_order}
                    onChange={e => setForm(f => ({ ...f, display_order: Number(e.target.value) }))} className="rounded-xl" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">제목 *</label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="레벨 제목" className="rounded-xl" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">필요 XP</label>
                <Input type="number" value={form.xp_required}
                  onChange={e => setForm(f => ({ ...f, xp_required: Number(e.target.value) }))} className="rounded-xl" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">보상 (선택)</label>
                <Input value={form.reward_name} onChange={e => setForm(f => ({ ...f, reward_name: e.target.value }))} placeholder="보상명" className="rounded-xl" />
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={form.is_boss} onChange={e => setForm(f => ({ ...f, is_boss: e.target.checked }))} className="rounded" />
                보스 레벨 (타이틀매치)
              </label>
              <button onClick={handleSave} disabled={saving}
                className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md transition-all active:scale-[0.98] disabled:opacity-50">
                {saving ? "저장 중..." : editingId ? "수정 완료" : "레벨 추가"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LevelManager;
