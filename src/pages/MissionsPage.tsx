import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMissions, useMyMissionSubmissions, useSubmitMission } from "@/hooks/useMissionData";
import { useLevels } from "@/hooks/useQuestData";
import { supabase } from "@/integrations/supabase/client";
import MissionCard from "@/components/MissionCard";
import VideoPlayer from "@/components/VideoPlayer";
import { User, Plus, Pencil, Trash2, X, Upload, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { celebrateSmall } from "@/lib/celebrations";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import type { Enums } from "@/integrations/supabase/types";

const RANK_ORDER: Enums<"rank_name">[] = ["white", "blue", "red", "black"];
const RANK_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };

interface MissionForm {
  title: string; description: string; level_id: string; difficulty: number;
  xp_reward: number; sort_order: number; key_point_1: string; key_point_2: string;
  key_point_3: string; video_url: string; poster_url: string;
}
const emptyMissionForm: MissionForm = {
  title: "", description: "", level_id: "", difficulty: 1, xp_reward: 20,
  sort_order: 0, key_point_1: "", key_point_2: "", key_point_3: "",
  video_url: "", poster_url: "",
};

const MissionsPage = () => {
  const navigate = useNavigate();
  const { progress, role, user, refreshProgress } = useAuth();
  const { data: missions, isLoading } = useMissions();
  const { data: submissions } = useMyMissionSubmissions();
  const submitMission = useSubmitMission();
  const { data: levels } = useLevels();
  const qc = useQueryClient();
  const [adminClearing, setAdminClearing] = useState(false);
  const isAdmin = role === "admin" || role === "super_admin";

  // Admin form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MissionForm>(emptyMissionForm);
  const [saving, setSaving] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);

  const [videoModal, setVideoModal] = useState<{
    show: boolean; videoUrl: string; posterUrl: string | null; title: string;
    keyPoints: string[]; missionId: string; canSubmit: boolean;
  } | null>(null);

  if (!progress) return null;

  const currentGlobal = RANK_ORDER.indexOf(progress.current_rank as Enums<"rank_name">) * 10 + progress.current_level;
  const submissionMap = new Map((submissions || []).map(s => [s.mission_id, s.status]));

  const sortedLevels = (levels || []).sort((a, b) => {
    const ri = RANK_ORDER.indexOf(a.rank_name) - RANK_ORDER.indexOf(b.rank_name);
    return ri !== 0 ? ri : a.level_number - b.level_number;
  });

  const getMissionStatus = (mission: any): "locked" | "active" | "pending" | "complete" => {
    const sub = submissionMap.get(mission.id);
    if (sub === "approved") return "complete";
    if (sub === "pending") return "pending";
    const level = mission.levels;
    if (level) {
      const missionGlobal = RANK_ORDER.indexOf(level.rank_name) * 10 + level.level_number;
      if (missionGlobal > currentGlobal) return "locked";
      if (missionGlobal < currentGlobal) return "complete";
    }
    return "active";
  };

  const grouped = RANK_ORDER.map(rank => {
    const rankLevels = (levels || [])
      .filter(l => l.rank_name === rank)
      .sort((a, b) => a.level_number - b.level_number);
    return {
      rank,
      levels: rankLevels.map(level => ({
        level,
        missions: (missions || []).filter(m => m.level_id === level.id),
      })),
    };
  });

  const handleSubmit = async (missionId: string) => {
    try {
      if (isAdmin && user) {
        setAdminClearing(true);
        await submitMission.mutateAsync({ missionId });
        const { data: sub } = await supabase
          .from("mission_submissions").select("id")
          .eq("user_id", user.id).eq("mission_id", missionId).eq("status", "pending")
          .order("requested_at", { ascending: false }).limit(1).single();
        if (sub) await supabase.rpc("approve_mission_submission", { _submission_id: sub.id });
        refreshProgress();
        qc.invalidateQueries({ queryKey: ["my-mission-submissions"] });
        qc.invalidateQueries({ queryKey: ["xp-logs"] });
        setAdminClearing(false);
        celebrateSmall();
        toast.success("즉시 클리어! ⚡🥊");
      } else {
        await submitMission.mutateAsync({ missionId });
        celebrateSmall();
        toast.success("완료 요청을 보냈습니다! 🥊");
      }
      setVideoModal(null);
    } catch {
      setAdminClearing(false);
      toast.error("요청 실패");
    }
  };

  const openVideo = (mission: any) => {
    const video = mission.mission_videos?.[0];
    if (!video) { toast.error("영상이 아직 등록되지 않았습니다"); return; }
    const status = getMissionStatus(mission);
    setVideoModal({
      show: true, videoUrl: video.video_url, posterUrl: video.poster_url,
      title: mission.title, keyPoints: [mission.key_point_1, mission.key_point_2, mission.key_point_3],
      missionId: mission.id, canSubmit: status === "active",
    });
  };

  // Admin: file upload
  const handleFileUpload = async (file: File, type: "video" | "poster") => {
    const setUploading = type === "video" ? setUploadingVideo : setUploadingPoster;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || (type === "video" ? "mp4" : "jpg");
      const path = `${type}s/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("mission-videos").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("mission-videos").getPublicUrl(path);
      if (type === "video") setForm(f => ({ ...f, video_url: urlData.publicUrl }));
      else setForm(f => ({ ...f, poster_url: urlData.publicUrl }));
      toast.success(type === "video" ? "영상 업로드 완료" : "포스터 업로드 완료");
    } catch (e: any) { toast.error(e?.message || "업로드 실패"); }
    finally { setUploading(false); }
  };

  const openEditMission = (mission: any) => {
    const video = mission.mission_videos?.[0];
    setForm({
      title: mission.title, description: mission.description, level_id: mission.level_id,
      difficulty: mission.difficulty, xp_reward: mission.xp_reward, sort_order: mission.sort_order,
      key_point_1: mission.key_point_1, key_point_2: mission.key_point_2, key_point_3: mission.key_point_3,
      video_url: video?.video_url || "", poster_url: video?.poster_url || "",
    });
    setEditingId(mission.id);
    setShowForm(true);
  };

  const handleSaveMission = async () => {
    if (!form.title.trim() || !form.level_id) { toast.error("제목과 레벨을 입력해주세요"); return; }
    setSaving(true);
    try {
      const missionData = {
        title: form.title.trim(), description: form.description.trim(), level_id: form.level_id,
        difficulty: form.difficulty, xp_reward: form.xp_reward, sort_order: form.sort_order,
        key_point_1: form.key_point_1.trim(), key_point_2: form.key_point_2.trim(), key_point_3: form.key_point_3.trim(),
      };
      if (editingId) {
        const { error } = await supabase.from("missions").update(missionData).eq("id", editingId);
        if (error) throw error;
        if (form.video_url.trim()) {
          const { data: existingVideo } = await supabase.from("mission_videos").select("id").eq("mission_id", editingId).limit(1).single();
          if (existingVideo) {
            await supabase.from("mission_videos").update({ video_url: form.video_url.trim(), poster_url: form.poster_url.trim() || null }).eq("id", existingVideo.id);
          } else {
            await supabase.from("mission_videos").insert({ mission_id: editingId, video_url: form.video_url.trim(), poster_url: form.poster_url.trim() || null });
          }
        }
        toast.success("미션 수정 완료 ✅");
      } else {
        const { data: newMission, error } = await supabase.from("missions").insert(missionData).select("id").single();
        if (error) throw error;
        if (form.video_url.trim() && newMission) {
          await supabase.from("mission_videos").insert({ mission_id: newMission.id, video_url: form.video_url.trim(), poster_url: form.poster_url.trim() || null });
        }
        toast.success("미션 추가 완료 ✅");
      }
      qc.invalidateQueries({ queryKey: ["missions"] });
      setShowForm(false); setEditingId(null); setForm(emptyMissionForm);
    } catch (e: any) { toast.error(e?.message || "저장 실패"); }
    finally { setSaving(false); }
  };

  const handleDeleteMission = async (id: string, title: string) => {
    if (!confirm(`"${title}" 미션을 삭제하시겠습니까?`)) return;
    try {
      await supabase.from("mission_videos").delete().eq("mission_id", id);
      const { error } = await supabase.from("missions").delete().eq("id", id);
      if (error) throw error;
      toast.success("미션 삭제 완료");
      qc.invalidateQueries({ queryKey: ["missions"] });
    } catch { toast.error("삭제 실패"); }
  };

  const totalMissions = (missions || []).length;
  const completedCount = (missions || []).filter(m => submissionMap.get(m.id) === "approved").length;
  const progressPct = totalMissions > 0 ? Math.round((completedCount / totalMissions) * 100) : 0;

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl text-foreground">🥊 미션</h1>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={() => { setEditingId(null); setForm(emptyMissionForm); setShowForm(true); }}
              className="flex h-10 items-center gap-1 rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground transition-all active:scale-95">
              <Plus className="h-3.5 w-3.5" /> 추가
            </button>
          )}
          <button onClick={() => navigate("/mypage")} className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-all active:scale-95">
            <User className="h-5 w-5 text-secondary-foreground" />
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-5 animate-slide-up rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">전체 진행률</span>
          <span className="text-sm font-bold text-primary">{completedCount}/{totalMissions} ({progressPct}%)</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-xp-bg">
          <div className="h-full rounded-full bg-xp-bar transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Mission List grouped by rank/level */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-48 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ rank, levels: rankLevels }, sectionIdx) => {
            const hasAnyMission = rankLevels.some(rl => rl.missions.length > 0);
            if (!hasAnyMission) return null;
            return (
              <div key={rank} className="animate-slide-up" style={{ animationDelay: `${sectionIdx * 0.08}s` }}>
                <h2 className="mb-3 flex items-center gap-2 text-lg text-foreground">
                  <span>{rank === "white" ? "⚪" : rank === "blue" ? "🔵" : rank === "red" ? "🔴" : "⚫"}</span>
                  {RANK_LABELS[rank]}
                </h2>
                <div className="space-y-3">
                  {rankLevels.map(({ level, missions: levelMissions }) =>
                    levelMissions.map(mission => {
                      const status = getMissionStatus(mission);
                      const video = mission.mission_videos?.[0];
                      return (
                        <div key={mission.id} className="relative">
                          <MissionCard
                            title={`Lv.${level.level_number} ${mission.title}`}
                            posterUrl={video?.poster_url}
                            difficulty={mission.difficulty}
                            xpReward={mission.xp_reward}
                            status={status}
                            onWatch={() => openVideo(mission)}
                            onSubmit={() => handleSubmit(mission.id)}
                            isSubmitting={submitMission.isPending || adminClearing}
                            adminMode={isAdmin}
                          />
                          {isAdmin && (
                            <div className="absolute right-2 top-2 z-10 flex gap-1">
                              <button onClick={() => openEditMission(mission)}
                                className="rounded-lg bg-secondary/90 p-1.5 text-foreground shadow-sm active:scale-95 backdrop-blur-sm">
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button onClick={() => handleDeleteMission(mission.id, mission.title)}
                                className="rounded-lg bg-destructive/80 p-1.5 text-destructive-foreground shadow-sm active:scale-95">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Video Player Modal */}
      {videoModal?.show && (
        <VideoPlayer
          videoUrl={videoModal.videoUrl} posterUrl={videoModal.posterUrl} title={videoModal.title}
          keyPoints={videoModal.keyPoints} onClose={() => setVideoModal(null)}
          onStartChallenge={videoModal.canSubmit || isAdmin ? () => handleSubmit(videoModal.missionId) : undefined}
          challengeDisabled={submitMission.isPending || adminClearing}
          challengeLabel={submitMission.isPending || adminClearing ? "처리 중..." : isAdmin ? "⚡ 즉시 클리어" : "🥊 도전 시작"}
        />
      )}

      {/* Admin Mission Form Modal */}
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
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">레벨 *</label>
                <select value={form.level_id} onChange={e => setForm(f => ({ ...f, level_id: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none">
                  <option value="">레벨 선택</option>
                  {sortedLevels.map(l => (
                    <option key={l.id} value={l.id}>{RANK_LABELS[l.rank_name]} Lv.{l.level_number} - {l.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">미션 제목 *</label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="예: 기본 스탠스" className="rounded-xl" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">설명</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="미션 설명" rows={2}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">난이도 (1-5)</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(d => (
                      <button key={d} onClick={() => setForm(f => ({ ...f, difficulty: d }))}
                        className={`flex-1 rounded-lg py-2 text-sm font-bold transition-all ${form.difficulty >= d ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>{d}</button>
                    ))}
                  </div>
                </div>
                <div className="w-24">
                  <label className="mb-1 block text-xs text-muted-foreground">XP</label>
                  <Input type="number" value={form.xp_reward} onChange={e => setForm(f => ({ ...f, xp_reward: Number(e.target.value) }))} className="rounded-xl" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">핵심 포인트</label>
                <div className="space-y-2">
                  <Input value={form.key_point_1} onChange={e => setForm(f => ({ ...f, key_point_1: e.target.value }))} placeholder="핵심 포인트 1" className="rounded-xl" />
                  <Input value={form.key_point_2} onChange={e => setForm(f => ({ ...f, key_point_2: e.target.value }))} placeholder="핵심 포인트 2" className="rounded-xl" />
                  <Input value={form.key_point_3} onChange={e => setForm(f => ({ ...f, key_point_3: e.target.value }))} placeholder="핵심 포인트 3" className="rounded-xl" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">🎬 영상</label>
                <input ref={videoInputRef} type="file" accept="video/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, "video"); }} />
                <div className="flex gap-2">
                  <Input value={form.video_url} onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))} placeholder="URL 또는 업로드" className="flex-1 rounded-xl" />
                  <button type="button" onClick={() => videoInputRef.current?.click()} disabled={uploadingVideo}
                    className="flex shrink-0 items-center gap-1 rounded-xl bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground active:scale-95 disabled:opacity-50">
                    {uploadingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">🖼️ 포스터</label>
                <input ref={posterInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, "poster"); }} />
                <div className="flex gap-2">
                  <Input value={form.poster_url} onChange={e => setForm(f => ({ ...f, poster_url: e.target.value }))} placeholder="URL 또는 업로드" className="flex-1 rounded-xl" />
                  <button type="button" onClick={() => posterInputRef.current?.click()} disabled={uploadingPoster}
                    className="flex shrink-0 items-center gap-1 rounded-xl bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground active:scale-95 disabled:opacity-50">
                    {uploadingPoster ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  </button>
                </div>
                {form.poster_url && <img src={form.poster_url} alt="" className="mt-2 h-24 w-full rounded-xl object-cover" />}
              </div>
              <button onClick={handleSaveMission} disabled={saving}
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

export default MissionsPage;
