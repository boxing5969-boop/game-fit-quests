import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMissions } from "@/hooks/useMissionData";
import { useLevels } from "@/hooks/useQuestData";
import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { Plus, Pencil, Trash2, X, Video, Upload, Image, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";

const RANK_ORDER: Enums<"rank_name">[] = ["white", "blue", "red", "black"];
const RANK_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };
const RANK_ICONS: Record<string, string> = { white: "⚪", blue: "🔵", red: "🔴", black: "⚫" };

interface MissionForm {
  title: string;
  description: string;
  level_id: string;
  difficulty: number;
  xp_reward: number;
  sort_order: number;
  key_point_1: string;
  key_point_2: string;
  key_point_3: string;
  video_url: string;
  poster_url: string;
}

const emptyForm: MissionForm = {
  title: "", description: "", level_id: "", difficulty: 1, xp_reward: 20,
  sort_order: 0, key_point_1: "", key_point_2: "", key_point_3: "",
  video_url: "", poster_url: "",
};

const MissionManager = () => {
  const { data: missions, isLoading } = useMissions();
  const { data: levels } = useLevels();
  const qc = useQueryClient();
  const [form, setForm] = useState<MissionForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterRank, setFilterRank] = useState<string>("all");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);

  const sortedLevels = (levels || []).sort((a, b) => {
    const ri = RANK_ORDER.indexOf(a.rank_name) - RANK_ORDER.indexOf(b.rank_name);
    return ri !== 0 ? ri : a.level_number - b.level_number;
  });

  const filteredMissions = (missions || []).filter(m => {
    if (filterRank === "all") return true;
    const level = (levels || []).find(l => l.id === m.level_id);
    return level?.rank_name === filterRank;
  });

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (mission: any) => {
    const video = mission.mission_videos?.[0];
    setForm({
      title: mission.title,
      description: mission.description,
      level_id: mission.level_id,
      difficulty: mission.difficulty,
      xp_reward: mission.xp_reward,
      sort_order: mission.sort_order,
      key_point_1: mission.key_point_1,
      key_point_2: mission.key_point_2,
      key_point_3: mission.key_point_3,
      video_url: video?.video_url || "",
      poster_url: video?.poster_url || "",
    });
    setEditingId(mission.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.level_id) {
      toast.error("제목과 레벨을 입력해주세요");
      return;
    }
    setSaving(true);
    try {
      const missionData = {
        title: form.title.trim(),
        description: form.description.trim(),
        level_id: form.level_id,
        difficulty: form.difficulty,
        xp_reward: form.xp_reward,
        sort_order: form.sort_order,
        key_point_1: form.key_point_1.trim(),
        key_point_2: form.key_point_2.trim(),
        key_point_3: form.key_point_3.trim(),
      };

      if (editingId) {
        const { error } = await supabase.from("missions").update(missionData).eq("id", editingId);
        if (error) throw error;

        // Update or create video
        if (form.video_url.trim()) {
          const { data: existingVideo } = await supabase
            .from("mission_videos").select("id").eq("mission_id", editingId).limit(1).single();
          if (existingVideo) {
            await supabase.from("mission_videos").update({
              video_url: form.video_url.trim(),
              poster_url: form.poster_url.trim() || null,
            }).eq("id", existingVideo.id);
          } else {
            await supabase.from("mission_videos").insert({
              mission_id: editingId,
              video_url: form.video_url.trim(),
              poster_url: form.poster_url.trim() || null,
            });
          }
        }
        toast.success("미션 수정 완료");
      } else {
        const { data: newMission, error } = await supabase
          .from("missions").insert(missionData).select("id").single();
        if (error) throw error;

        if (form.video_url.trim() && newMission) {
          await supabase.from("mission_videos").insert({
            mission_id: newMission.id,
            video_url: form.video_url.trim(),
            poster_url: form.poster_url.trim() || null,
          });
        }
        toast.success("미션 추가 완료");
      }

      qc.invalidateQueries({ queryKey: ["missions"] });
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
    if (!confirm(`"${title}" 미션을 삭제하시겠습니까?`)) return;
    try {
      await supabase.from("mission_videos").delete().eq("mission_id", id);
      const { error } = await supabase.from("missions").delete().eq("id", id);
      if (error) throw error;
      toast.success("미션 삭제 완료");
      qc.invalidateQueries({ queryKey: ["missions"] });
    } catch {
      toast.error("삭제 실패");
    }
  };

  const getLevelLabel = (levelId: string) => {
    const level = (levels || []).find(l => l.id === levelId);
    if (!level) return "?";
    return `${RANK_ICONS[level.rank_name]} ${RANK_LABELS[level.rank_name]} Lv.${level.level_number}`;
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5 overflow-x-auto">
          {["all", ...RANK_ORDER].map(r => (
            <button key={r} onClick={() => setFilterRank(r)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                filterRank === r ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
              }`}>
              {r === "all" ? "전체" : `${RANK_ICONS[r]} ${RANK_LABELS[r]}`}
            </button>
          ))}
        </div>
        <button onClick={openCreate}
          className="ml-2 flex shrink-0 items-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground active:scale-95">
          <Plus className="h-3.5 w-3.5" /> 추가
        </button>
      </div>

      {/* Mission List */}
      {isLoading ? (
        [1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)
      ) : !filteredMissions.length ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <span className="text-4xl">🥊</span>
          <p className="mt-3 text-sm text-muted-foreground">등록된 미션이 없습니다</p>
        </div>
      ) : (
        filteredMissions.map((mission: any) => {
          const video = mission.mission_videos?.[0];
          return (
            <div key={mission.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{mission.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{getLevelLabel(mission.level_id)}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-xs font-bold text-primary">+{mission.xp_reward} XP</span>
                    <span className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <div key={i} className={`h-1.5 w-2.5 rounded-full ${i < mission.difficulty ? "bg-primary" : "bg-border"}`} />
                      ))}
                    </span>
                    {video && <Video className="h-3 w-3 text-status-complete" />}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => openEdit(mission)} className="rounded-lg bg-secondary p-2 active:scale-95">
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => handleDelete(mission.id, mission.title)} className="rounded-lg bg-destructive/10 p-2 active:scale-95">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg animate-slide-up rounded-t-3xl border-t border-border bg-card p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg text-foreground">{editingId ? "✏️ 미션 수정" : "➕ 새 미션 추가"}</h3>
              <button onClick={() => setShowForm(false)} className="rounded-full bg-secondary p-2 active:scale-95">
                <X className="h-4 w-4 text-secondary-foreground" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Level select */}
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">레벨 *</label>
                <select value={form.level_id} onChange={e => setForm(f => ({ ...f, level_id: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none">
                  <option value="">레벨 선택</option>
                  {sortedLevels.map(l => (
                    <option key={l.id} value={l.id}>
                      {RANK_LABELS[l.rank_name]} Lv.{l.level_number} - {l.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">미션 제목 *</label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="예: 기본 스탠스" className="rounded-xl" />
              </div>

              {/* Description */}
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">설명</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="미션 설명" rows={2}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
              </div>

              {/* Difficulty & XP */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">난이도 (1-5)</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(d => (
                      <button key={d} onClick={() => setForm(f => ({ ...f, difficulty: d }))}
                        className={`flex-1 rounded-lg py-2 text-sm font-bold transition-all ${
                          form.difficulty >= d ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                        }`}>{d}</button>
                    ))}
                  </div>
                </div>
                <div className="w-24">
                  <label className="mb-1 block text-xs text-muted-foreground">XP 보상</label>
                  <Input type="number" value={form.xp_reward}
                    onChange={e => setForm(f => ({ ...f, xp_reward: Number(e.target.value) }))}
                    className="rounded-xl" />
                </div>
              </div>

              {/* Sort order */}
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">정렬 순서</label>
                <Input type="number" value={form.sort_order}
                  onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                  className="rounded-xl" />
              </div>

              {/* Key Points */}
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">핵심 포인트</label>
                <div className="space-y-2">
                  <Input value={form.key_point_1} onChange={e => setForm(f => ({ ...f, key_point_1: e.target.value }))}
                    placeholder="핵심 포인트 1" className="rounded-xl" />
                  <Input value={form.key_point_2} onChange={e => setForm(f => ({ ...f, key_point_2: e.target.value }))}
                    placeholder="핵심 포인트 2" className="rounded-xl" />
                  <Input value={form.key_point_3} onChange={e => setForm(f => ({ ...f, key_point_3: e.target.value }))}
                    placeholder="핵심 포인트 3" className="rounded-xl" />
                </div>
              </div>

              {/* Video */}
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">🎬 영상 URL</label>
                <Input value={form.video_url} onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))}
                  placeholder="https://youtube.com/..." className="rounded-xl" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">🖼️ 포스터 URL (선택)</label>
                <Input value={form.poster_url} onChange={e => setForm(f => ({ ...f, poster_url: e.target.value }))}
                  placeholder="https://..." className="rounded-xl" />
              </div>

              {/* Save */}
              <button onClick={handleSave} disabled={saving}
                className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md transition-all active:scale-[0.98] disabled:opacity-50">
                {saving ? "저장 중..." : editingId ? "수정 완료" : "미션 추가"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MissionManager;
