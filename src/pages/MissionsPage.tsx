import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMissions, useMyMissionSubmissions, useSubmitMission } from "@/hooks/useMissionData";
import { useLevels } from "@/hooks/useQuestData";
import { supabase } from "@/integrations/supabase/client";
import MissionCard from "@/components/MissionCard";
import VideoPlayer from "@/components/VideoPlayer";
import { User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { celebrateSmall } from "@/lib/celebrations";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { Enums } from "@/integrations/supabase/types";

const RANK_ORDER: Enums<"rank_name">[] = ["white", "blue", "red", "black"];
const RANK_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };

const MissionsPage = () => {
  const navigate = useNavigate();
  const { progress, role, user, refreshProgress } = useAuth();
  const { data: missions, isLoading } = useMissions();
  const { data: submissions } = useMyMissionSubmissions();
  const submitMission = useSubmitMission();
  const { data: levels } = useLevels();
  const qc = useQueryClient();
  const [adminClearing, setAdminClearing] = useState(false);

  const [videoModal, setVideoModal] = useState<{
    show: boolean;
    videoUrl: string;
    posterUrl: string | null;
    title: string;
    keyPoints: string[];
    missionId: string;
    canSubmit: boolean;
  } | null>(null);

  if (!progress) return null;

  const currentGlobal = RANK_ORDER.indexOf(progress.current_rank as Enums<"rank_name">) * 10 + progress.current_level;
  const submissionMap = new Map((submissions || []).map(s => [s.mission_id, s.status]));

  const getMissionStatus = (mission: any): "locked" | "active" | "pending" | "complete" => {
    const sub = submissionMap.get(mission.id);
    if (sub === "approved") return "complete";
    if (sub === "pending") return "pending";
    // Check if level is unlocked
    const level = mission.levels;
    if (level) {
      const missionGlobal = RANK_ORDER.indexOf(level.rank_name) * 10 + level.level_number;
      if (missionGlobal > currentGlobal) return "locked";
    }
    return "active";
  };

  // Group missions by rank/level
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
      if (role === "admin" && user) {
        // Admin: submit then instantly approve
        setAdminClearing(true);
        await submitMission.mutateAsync(missionId);
        // Find the submission we just created and approve it
        const { data: sub } = await supabase
          .from("mission_submissions")
          .select("id")
          .eq("user_id", user.id)
          .eq("mission_id", missionId)
          .eq("status", "pending")
          .order("requested_at", { ascending: false })
          .limit(1)
          .single();
        if (sub) {
          await supabase.rpc("approve_mission_submission", { _submission_id: sub.id });
        }
        refreshProgress();
        qc.invalidateQueries({ queryKey: ["my-mission-submissions"] });
        qc.invalidateQueries({ queryKey: ["xp-logs"] });
        setAdminClearing(false);
        celebrateSmall();
        toast.success("즉시 클리어! ⚡🥊");
      } else {
        await submitMission.mutateAsync(missionId);
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
      keyPoints: [mission.key_point_1, mission.key_point_2, mission.key_point_3],
      missionId: mission.id,
      canSubmit: status === "active",
    });
  };

  // Count completed
  const totalMissions = (missions || []).length;
  const completedCount = (missions || []).filter(m => submissionMap.get(m.id) === "approved").length;
  const progressPct = totalMissions > 0 ? Math.round((completedCount / totalMissions) * 100) : 0;

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl text-foreground">🥊 미션</h1>
        <button onClick={() => navigate("/mypage")} className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-all active:scale-95">
          <User className="h-5 w-5 text-secondary-foreground" />
        </button>
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
                  {RANK_LABELS[rank]} 벨트
                </h2>
                <div className="space-y-3">
                  {rankLevels.map(({ level, missions: levelMissions }) =>
                    levelMissions.map(mission => {
                      const status = getMissionStatus(mission);
                      const video = mission.mission_videos?.[0];
                      return (
                        <MissionCard
                          key={mission.id}
                          title={`Lv.${level.level_number} ${mission.title}`}
                          posterUrl={video?.poster_url}
                          difficulty={mission.difficulty}
                          xpReward={mission.xp_reward}
                          status={status}
                          onWatch={() => openVideo(mission)}
                          onSubmit={() => handleSubmit(mission.id)}
                          isSubmitting={submitMission.isPending}
                        />
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
          videoUrl={videoModal.videoUrl}
          posterUrl={videoModal.posterUrl}
          title={videoModal.title}
          keyPoints={videoModal.keyPoints}
          onClose={() => setVideoModal(null)}
          onStartChallenge={videoModal.canSubmit ? () => handleSubmit(videoModal.missionId) : undefined}
          challengeDisabled={submitMission.isPending}
          challengeLabel={submitMission.isPending ? "요청 중..." : "🥊 도전 시작"}
        />
      )}
    </div>
  );
};

export default MissionsPage;
