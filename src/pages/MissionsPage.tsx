import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  User,
  Plus,
  Pencil,
  Trash2,
  X,
  Upload,
  Loader2,
  Lock,
  Play,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import {
  useMissions,
  useMyMissionSubmissions,
  useSubmitMission,
} from "@/hooks/useMissionData";
import { useLevels } from "@/hooks/useQuestData";
import { supabase } from "@/integrations/supabase/client";
import { celebrateSmall } from "@/lib/celebrations";
import { cn } from "@/lib/utils";
import type { Enums } from "@/integrations/supabase/types";

import VideoPlayer from "@/components/VideoPlayer";
import WhiteLeagueTab from "@/components/WhiteLeagueTab";
import { Input } from "@/components/ui/input";

import {
  AppPage,
  PageHeader,
  SegmentedControl,
} from "@/components/ui/rankingup";

type MissionTab = "white" | "missions";
type MissionStatus = "locked" | "active" | "pending" | "complete";

const RANK_ORDER: Enums<"rank_name">[] = ["white", "blue", "red", "black"];
const RANK_LABELS: Record<string, string> = {
  white: "화이트",
  blue: "블루",
  red: "레드",
  black: "블랙",
};

/**
 * League accent — used for the left-side dot, progress fill, and small
 * pills only. Card surface stays dark so the screen doesn't become a
 * wash of league colors.
 */
const LEAGUE_ACCENT: Record<string, { dot: string; fill: string; text: string }> = {
  white: {
    dot: "bg-[hsl(220_14%_71%)]",
    fill: "bg-[hsl(220_14%_71%)]",
    text: "text-[hsl(220_14%_85%)]",
  },
  blue: {
    dot: "bg-accent",
    fill: "bg-accent",
    text: "text-accent",
  },
  red: {
    dot: "bg-destructive",
    fill: "bg-destructive",
    text: "text-destructive",
  },
  black: {
    dot: "bg-reward",
    fill: "bg-reward",
    text: "text-reward",
  },
};

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
const emptyMissionForm: MissionForm = {
  title: "",
  description: "",
  level_id: "",
  difficulty: 1,
  xp_reward: 20,
  sort_order: 0,
  key_point_1: "",
  key_point_2: "",
  key_point_3: "",
  video_url: "",
  poster_url: "",
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
  const [missionTab, setMissionTab] = useState<MissionTab>("white");
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
    show: boolean;
    videoUrl: string;
    posterUrl: string | null;
    title: string;
    keyPoints: string[];
    missionId: string;
    canSubmit: boolean;
  } | null>(null);

  // League expand/collapse — default: current rank expanded.
  const [expandedRanks, setExpandedRanks] = useState<Set<string>>(
    () => new Set([progress?.current_rank ?? "white"]),
  );
  const toggleRank = (rank: string) =>
    setExpandedRanks((prev) => {
      const next = new Set(prev);
      if (next.has(rank)) next.delete(rank);
      else next.add(rank);
      return next;
    });

  // `grouped` must be computed before any early return so the hook
  // order is stable on every render.
  const grouped = useMemo(
    () =>
      RANK_ORDER.map((rank) => {
        const rankLevels = (levels || [])
          .filter((l) => l.rank_name === rank)
          .sort((a, b) => a.level_number - b.level_number);
        const rankMissions = rankLevels.flatMap((level) =>
          (missions || [])
            .filter((m) => m.level_id === level.id)
            .map((m) => ({ mission: m, level })),
        );
        return { rank, rankLevels, rankMissions };
      }),
    [levels, missions],
  );

  if (!progress) return null;

  const currentGlobal =
    RANK_ORDER.indexOf(progress.current_rank as Enums<"rank_name">) * 10 +
    progress.current_level;
  const submissionMap = new Map(
    (submissions || []).map((s) => [s.mission_id, s.status]),
  );

  const sortedLevels = (levels || []).sort((a, b) => {
    const ri =
      RANK_ORDER.indexOf(a.rank_name) - RANK_ORDER.indexOf(b.rank_name);
    return ri !== 0 ? ri : a.level_number - b.level_number;
  });

  const getMissionStatus = (mission: any): MissionStatus => {
    const sub = submissionMap.get(mission.id);
    if (sub === "approved") return "complete";
    if (sub === "pending") return "pending";
    const level = mission.levels;
    if (level) {
      const missionGlobal =
        RANK_ORDER.indexOf(level.rank_name) * 10 + level.level_number;
      if (missionGlobal > currentGlobal) return "locked";
      if (missionGlobal < currentGlobal) return "complete";
    }
    return "active";
  };

  const totalMissions = (missions || []).length;
  const completedCount = (missions || []).filter(
    (m) => submissionMap.get(m.id) === "approved",
  ).length;
  const progressPct =
    totalMissions > 0 ? Math.round((completedCount / totalMissions) * 100) : 0;

  const handleSubmit = async (missionId: string) => {
    try {
      if (isAdmin && user) {
        setAdminClearing(true);
        await submitMission.mutateAsync({ missionId });
        const { data: sub } = await supabase
          .from("mission_submissions")
          .select("id")
          .eq("user_id", user.id)
          .eq("mission_id", missionId)
          .eq("status", "pending")
          .order("requested_at", { ascending: false })
          .limit(1)
          .single();
        if (sub)
          await supabase.rpc("approve_mission_submission", {
            _submission_id: sub.id,
          });
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
    if (!video) {
      toast.error("영상이 아직 등록되지 않았습니다");
      return;
    }
    const status = getMissionStatus(mission);
    setVideoModal({
      show: true,
      videoUrl: video.video_url,
      posterUrl: video.poster_url,
      title: mission.title,
      keyPoints: [
        mission.key_point_1,
        mission.key_point_2,
        mission.key_point_3,
      ],
      missionId: mission.id,
      canSubmit: status === "active",
    });
  };

  const handleFileUpload = async (file: File, type: "video" | "poster") => {
    const setUploading =
      type === "video" ? setUploadingVideo : setUploadingPoster;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || (type === "video" ? "mp4" : "jpg");
      const path = `${type}s/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage
        .from("mission-videos")
        .upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage
        .from("mission-videos")
        .getPublicUrl(path);
      if (type === "video") setForm((f) => ({ ...f, video_url: urlData.publicUrl }));
      else setForm((f) => ({ ...f, poster_url: urlData.publicUrl }));
      toast.success(
        type === "video" ? "영상 업로드 완료" : "포스터 업로드 완료",
      );
    } catch (e: any) {
      toast.error(e?.message || "업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  const openEditMission = (mission: any) => {
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

  const handleSaveMission = async () => {
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
        const { error } = await supabase
          .from("missions")
          .update(missionData)
          .eq("id", editingId);
        if (error) throw error;
        if (form.video_url.trim()) {
          const { data: existingVideo } = await supabase
            .from("mission_videos")
            .select("id")
            .eq("mission_id", editingId)
            .limit(1)
            .single();
          if (existingVideo) {
            await supabase
              .from("mission_videos")
              .update({
                video_url: form.video_url.trim(),
                poster_url: form.poster_url.trim() || null,
              })
              .eq("id", existingVideo.id);
          } else {
            await supabase.from("mission_videos").insert({
              mission_id: editingId,
              video_url: form.video_url.trim(),
              poster_url: form.poster_url.trim() || null,
            });
          }
        }
        toast.success("미션 수정 완료 ✅");
      } else {
        const { data: newMission, error } = await supabase
          .from("missions")
          .insert(missionData)
          .select("id")
          .single();
        if (error) throw error;
        if (form.video_url.trim() && newMission) {
          await supabase.from("mission_videos").insert({
            mission_id: newMission.id,
            video_url: form.video_url.trim(),
            poster_url: form.poster_url.trim() || null,
          });
        }
        toast.success("미션 추가 완료 ✅");
      }
      qc.invalidateQueries({ queryKey: ["missions"] });
      setShowForm(false);
      setEditingId(null);
      setForm(emptyMissionForm);
    } catch (e: any) {
      toast.error(e?.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMission = async (id: string, title: string) => {
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

  return (
    <AppPage
      header={
        <PageHeader
          title="훈련 미션"
          subtitle="리그를 완료하고 다음 단계로 승급하세요"
          rightAction={
            <>
              {isAdmin && (
                <button
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyMissionForm);
                    setShowForm(true);
                  }}
                  aria-label="미션 추가"
                  className="flex h-9 items-center gap-1 rounded-pill bg-primary px-3 text-caption font-bold text-primary-foreground active:scale-95"
                >
                  <Plus className="h-3.5 w-3.5" /> 추가
                </button>
              )}
              <button
                onClick={() => navigate("/mypage")}
                aria-label="내 정보"
                className="flex h-9 w-9 items-center justify-center rounded-pill bg-secondary active:scale-95"
              >
                <User className="h-4 w-4 text-secondary-foreground" />
              </button>
            </>
          }
          sticky
        />
      }
    >
      <div data-tour="missions-official-training" className="space-y-6">
        <SegmentedControl<MissionTab>
          value={missionTab}
          onChange={(v) => setMissionTab(v)}
          segments={[
            { value: "white", label: "🤍 화이트 리그" },
            { value: "missions", label: "🥊 전체 미션" },
          ]}
          fullWidth
        />

        {missionTab === "white" ? (
          <WhiteLeagueTab />
        ) : (
          <>
            {/* ─── Global progress card ─── */}
            <section className="surface-card">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-caption text-muted-foreground">
                    전체 진행률
                  </p>
                  <p className="number-font text-display-md text-foreground">
                    <span className="text-primary">{completedCount}</span>
                    <span className="text-muted-foreground">
                      {" / "}
                      {totalMissions}
                    </span>
                  </p>
                </div>
                <div className="number-font rounded-pill bg-accent/15 px-3 py-1 text-caption font-bold text-accent">
                  {progressPct}%
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-pill bg-[hsl(var(--xp-bar-bg))]">
                <div
                  className="h-full rounded-pill bg-[linear-gradient(90deg,hsl(var(--primary))_0%,hsl(8_90%_62%)_100%)] transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </section>

            {/* ─── League sections ─── */}
            {isLoading ? (
              <SkeletonList />
            ) : (
              <div className="space-y-4">
                {grouped.map(({ rank, rankMissions }) => {
                  if (rankMissions.length === 0) return null;
                  const completed = rankMissions.filter(
                    ({ mission }) =>
                      submissionMap.get(mission.id) === "approved",
                  ).length;
                  const total = rankMissions.length;
                  const pct = total > 0 ? (completed / total) * 100 : 0;
                  const isExpanded = expandedRanks.has(rank);
                  const leagueComplete = completed === total && total > 0;
                  const accent = LEAGUE_ACCENT[rank];

                  return (
                    <section
                      key={rank}
                      data-tutorial-target="first-mission-card"
                      className={cn(
                        "overflow-hidden rounded-card border border-border bg-card shadow-elev-1",
                        leagueComplete &&
                          "border-[#22C55E]/40 shadow-none",
                      )}
                    >
                      {/* League header (toggle) */}
                      <button
                        type="button"
                        onClick={() => toggleRank(rank)}
                        aria-expanded={isExpanded}
                        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[hsl(var(--surface-2))]/40 active:scale-[0.99]"
                      >
                        <span
                          className={cn(
                            "h-3 w-3 shrink-0 rounded-pill",
                            accent.dot,
                          )}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-body-lg text-foreground">
                            {RANK_LABELS[rank]} 리그
                          </h3>
                          <p className="text-caption text-muted-foreground">
                            <span className="number-font">
                              {completed}/{total}
                            </span>{" "}
                            완료
                            {leagueComplete && (
                              <span className="ml-2 text-[#22C55E]">
                                · 클리어
                              </span>
                            )}
                          </p>
                        </div>
                        {/* Compact progress pill */}
                        <div className="hidden w-24 sm:block">
                          <div className="h-1.5 w-full overflow-hidden rounded-pill bg-[hsl(var(--xp-bar-bg))]">
                            <div
                              className={cn(
                                "h-full rounded-pill transition-all",
                                leagueComplete
                                  ? "bg-[#22C55E]"
                                  : accent.fill,
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <ChevronDown
                          className={cn(
                            "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
                            isExpanded && "rotate-180",
                          )}
                        />
                      </button>

                      {/* Mission list */}
                      {isExpanded && (
                        <ul className="border-t border-border divide-y divide-border">
                          {rankMissions.map(({ mission, level }) => (
                            <MissionRow
                              key={mission.id}
                              mission={mission}
                              level={level}
                              status={getMissionStatus(mission)}
                              onClick={() => openVideo(mission)}
                              admin={
                                isAdmin
                                  ? {
                                      onEdit: () => openEditMission(mission),
                                      onDelete: () =>
                                        handleDeleteMission(
                                          mission.id,
                                          mission.title,
                                        ),
                                    }
                                  : undefined
                              }
                            />
                          ))}
                        </ul>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Video modal ─── */}
      {videoModal?.show && (
        <VideoPlayer
          videoUrl={videoModal.videoUrl}
          posterUrl={videoModal.posterUrl}
          title={videoModal.title}
          keyPoints={videoModal.keyPoints}
          onClose={() => setVideoModal(null)}
          onStartChallenge={
            videoModal.canSubmit || isAdmin
              ? () => handleSubmit(videoModal.missionId)
              : undefined
          }
          challengeDisabled={submitMission.isPending || adminClearing}
          challengeLabel={
            submitMission.isPending || adminClearing
              ? "처리 중..."
              : isAdmin
                ? "⚡ 즉시 클리어"
                : "🥊 도전 시작"
          }
        />
      )}

      {/* ─── Admin form modal — BottomNav(z-50) 위로 z-[70] / 하단 nav 영역 만큼 padding-bottom ─── */}
      {showForm && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-foreground/30 backdrop-blur-sm"
          onClick={() => setShowForm(false)}
        >
          <div
            className="w-full max-w-lg animate-slide-up rounded-t-hero border-t border-border bg-card p-6 shadow-elev-3 max-h-[85vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+5rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-display-sm text-foreground">
                {editingId ? "✏️ 미션 수정" : "➕ 새 미션 추가"}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-pill bg-secondary p-2 active:scale-95"
              >
                <X className="h-4 w-4 text-secondary-foreground" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-caption text-muted-foreground">
                  레벨 *
                </label>
                <select
                  value={form.level_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, level_id: e.target.value }))
                  }
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-body-sm text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="">레벨 선택</option>
                  {sortedLevels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {RANK_LABELS[l.rank_name]} Lv.{l.level_number} -{" "}
                      {l.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-caption text-muted-foreground">
                  미션 제목 *
                </label>
                <Input
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="예: 기본 스탠스"
                  className="rounded-xl"
                />
              </div>
              <div>
                <label className="mb-1 block text-caption text-muted-foreground">
                  설명
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="미션 설명"
                  rows={2}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-body-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-caption text-muted-foreground">
                    난이도 (1-5)
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((d) => (
                      <button
                        key={d}
                        onClick={() =>
                          setForm((f) => ({ ...f, difficulty: d }))
                        }
                        className={cn(
                          "flex-1 rounded-lg py-2 text-body-sm font-bold transition-all",
                          form.difficulty >= d
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground",
                        )}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="w-24">
                  <label className="mb-1 block text-caption text-muted-foreground">
                    XP
                  </label>
                  <Input
                    type="number"
                    value={form.xp_reward}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        xp_reward: Number(e.target.value),
                      }))
                    }
                    className="rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-caption text-muted-foreground">
                  핵심 포인트
                </label>
                <div className="space-y-2">
                  <Input
                    value={form.key_point_1}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, key_point_1: e.target.value }))
                    }
                    placeholder="핵심 포인트 1"
                    className="rounded-xl"
                  />
                  <Input
                    value={form.key_point_2}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, key_point_2: e.target.value }))
                    }
                    placeholder="핵심 포인트 2"
                    className="rounded-xl"
                  />
                  <Input
                    value={form.key_point_3}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, key_point_3: e.target.value }))
                    }
                    placeholder="핵심 포인트 3"
                    className="rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-caption text-muted-foreground">
                  🎬 영상
                </label>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f, "video");
                  }}
                />
                <div className="flex gap-2">
                  <Input
                    value={form.video_url}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, video_url: e.target.value }))
                    }
                    placeholder="URL 또는 업로드"
                    className="flex-1 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    disabled={uploadingVideo}
                    className="flex shrink-0 items-center gap-1 rounded-xl bg-secondary px-3 py-2 text-caption font-bold text-secondary-foreground active:scale-95 disabled:opacity-50"
                  >
                    {uploadingVideo ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-caption text-muted-foreground">
                  🖼️ 포스터
                </label>
                <input
                  ref={posterInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f, "poster");
                  }}
                />
                <div className="flex gap-2">
                  <Input
                    value={form.poster_url}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, poster_url: e.target.value }))
                    }
                    placeholder="URL 또는 업로드"
                    className="flex-1 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => posterInputRef.current?.click()}
                    disabled={uploadingPoster}
                    className="flex shrink-0 items-center gap-1 rounded-xl bg-secondary px-3 py-2 text-caption font-bold text-secondary-foreground active:scale-95 disabled:opacity-50"
                  >
                    {uploadingPoster ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {form.poster_url && (
                  <img
                    src={form.poster_url}
                    alt=""
                    className="mt-2 h-24 w-full rounded-xl object-cover"
                  />
                )}
              </div>
              <button
                onClick={handleSaveMission}
                disabled={saving}
                className="primary-button"
              >
                {saving ? "저장 중..." : editingId ? "수정 완료" : "미션 추가"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppPage>
  );
};

/* ─────────────────────────────────────────────────────────────
 * Mission row — compact list item optimized for information density.
 * Status drives the visual treatment; clicking opens the video modal,
 * which preserves every existing action (watch / submit / admin-clear).
 * ───────────────────────────────────────────────────────────── */

interface MissionRowProps {
  mission: any;
  level: { level_number: number; rank_name: string };
  status: MissionStatus;
  onClick: () => void;
  admin?: {
    onEdit: () => void;
    onDelete: () => void;
  };
}

const STATUS_VISUAL: Record<MissionStatus, {
  rowClass: string;
  statusIcon: typeof Lock;
  statusClass: string;
  statusLabel: string;
}> = {
  locked: {
    rowClass: "opacity-55",
    statusIcon: Lock,
    statusClass: "text-muted-foreground bg-muted",
    statusLabel: "잠김",
  },
  active: {
    rowClass: "bg-primary/5 ring-1 ring-inset ring-primary/40",
    statusIcon: Play,
    statusClass: "text-primary bg-primary/15",
    statusLabel: "도전 가능",
  },
  pending: {
    rowClass: "",
    statusIcon: Clock,
    statusClass: "text-status-pending bg-status-pending/15",
    statusLabel: "승인 대기",
  },
  complete: {
    rowClass: "",
    statusIcon: CheckCircle2,
    statusClass: "text-[#22C55E] bg-[#22C55E]/15",
    statusLabel: "완료",
  },
};

const MissionRow = ({
  mission,
  level,
  status,
  onClick,
  admin,
}: MissionRowProps) => {
  const v = STATUS_VISUAL[status];
  const Icon = v.statusIcon;
  const isLocked = status === "locked";
  // 영상 등록된 미션이면 썸네일 + ▶ 노출 ("훈련 탭의 영상" UI 복구)
  const video = mission.mission_videos?.[0] ?? null;
  const hasVideo = !!video?.video_url;
  const posterUrl = video?.poster_url ?? null;

  return (
    <li
      className={cn(
        "flex items-center gap-3 px-5 py-3 transition-colors",
        v.rowClass,
        !isLocked && "hover:bg-[hsl(var(--surface-2))]/40",
      )}
    >
      {/* Main tap area opens the video modal — preserves all existing
          actions inside that modal (watch / submit / admin-clear). */}
      <button
        type="button"
        onClick={isLocked ? undefined : onClick}
        disabled={isLocked}
        className="flex flex-1 items-center gap-3 text-left disabled:cursor-default"
      >
        {/* Level tile */}
        <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-[hsl(var(--surface-2))] text-center">
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            Lv
          </span>
          <span className="number-font text-[13px] font-bold leading-none text-foreground">
            {level.level_number}
          </span>
        </div>

        {/* 영상 썸네일 — mission_videos[0] 있을 때만 노출. ▶ 오버레이로 클릭 영역 시각화. */}
        {hasVideo && (
          <div
            className={cn(
              "relative h-10 w-16 shrink-0 overflow-hidden rounded-lg",
              "border border-border bg-[hsl(var(--surface-2))]",
              isLocked && "grayscale",
            )}
            aria-hidden
          >
            {posterUrl ? (
              <img
                src={posterUrl}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-primary/20 to-primary/5" />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-foreground/30">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/95 shadow">
                <Play className="h-2.5 w-2.5 fill-foreground text-foreground" />
              </span>
            </div>
          </div>
        )}

        {/* Title + difficulty + reward */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h4 className="truncate text-[15px] font-bold leading-tight text-foreground">
              {mission.title}
            </h4>
            {hasVideo && (
              <span
                className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-primary"
                aria-label="영상 있음"
              >
                ▶ 영상
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 w-3 rounded-pill",
                    i < (mission.difficulty || 0)
                      ? "bg-primary"
                      : "bg-border",
                  )}
                />
              ))}
            </div>
            <span className="number-font text-caption font-bold text-reward">
              +{mission.xp_reward} XP
            </span>
          </div>
        </div>
      </button>

      {/* Right side: admin controls (if any) + status + chevron */}
      <div className="flex shrink-0 items-center gap-1.5">
        {admin && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                admin.onEdit();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary/70 text-foreground active:scale-95"
              aria-label="미션 수정"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                admin.onDelete();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-destructive/70 text-destructive-foreground active:scale-95"
              aria-label="미션 삭제"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </>
        )}
        <span
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-pill",
            v.statusClass,
          )}
          aria-label={v.statusLabel}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        {!isLocked && (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
    </li>
  );
};

const SkeletonList = () => (
  <div className="space-y-4">
    {[1, 2, 3].map((i) => (
      <div
        key={i}
        className="h-32 animate-pulse rounded-card border border-border bg-card"
      />
    ))}
  </div>
);

export default MissionsPage;
