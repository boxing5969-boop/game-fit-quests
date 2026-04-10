import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import XPBar from "@/components/XPBar";
import RankBadge from "@/components/RankBadge";
import RankMiniCard from "@/components/RankMiniCard";
import LevelUpModal from "@/components/LevelUpModal";
import WeeklyDashboard from "@/components/WeeklyDashboard";
import { useMissions, useMyMissionSubmissions } from "@/hooks/useMissionData";
import { useRecordAttendance, useLevels, useMyBadges } from "@/hooks/useQuestData";
import { useRivalsAbove, useSetRival, useDivisionRanking } from "@/hooks/useRankingData";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { useNavigate } from "react-router-dom";
import { User, ChevronRight, TrendingUp, Play } from "lucide-react";
import HallOfFameShowcase from "@/components/HallOfFameShowcase";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";
import { isManagerRole } from "@/lib/rankLabels";

const RANK_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };
const RANK_ORDER: Enums<"rank_name">[] = ["white", "blue", "red", "black"];

const HomePage = () => {
  const { user, profile, progress, role, refreshProgress } = useAuth();
  const navigate = useNavigate();
  const { data: missions } = useMissions();
  const { data: missionSubs } = useMyMissionSubmissions();
  const { data: levels } = useLevels();
  const { data: ranking } = useDivisionRanking();
  const { data: rivalsAbove } = useRivalsAbove();
  const { data: myBadges } = useMyBadges();
  const attendance = useRecordAttendance();
  const setRival = useSetRival();
  const { onboardingDone, safetyDone } = useOnboardingState();
  const [levelUpModal, setLevelUpModal] = useState<{ show: boolean; level: number; rank: string; xp: number }>({ show: false, level: 0, rank: "", xp: 0 });

  // Redirect to onboarding if not done
  useEffect(() => {
    if (!onboardingDone) {
      navigate("/onboarding", { replace: true });
    } else if (!safetyDone) {
      navigate("/safety-check", { replace: true });
    }
  }, [onboardingDone, safetyDone, navigate]);

  useEffect(() => {
    if (progress) attendance.mutate();
  }, [progress?.user_id]); // eslint-disable-line

  if (!profile || !progress) return <LoadingState />;

  const rank = progress.current_rank as Enums<"rank_name">;
  const currentLevel = levels?.find(l => l.rank_name === rank && l.level_number === progress.current_level);
  const nextLevel = levels?.find(l => l.rank_name === rank && l.level_number === progress.current_level + 1)
    || (progress.current_level === 10 ? currentLevel : null);
  const xpToNext = nextLevel?.xp_required || currentLevel?.xp_required || (progress.current_level * 50);
  const xpRemaining = Math.max(0, xpToNext - progress.total_xp);
  const myPosition = ranking?.find(r => r.r_user_id === user?.id)?.rank_position;

  // Today's mission
  const currentGlobal = RANK_ORDER.indexOf(rank) * 10 + progress.current_level;
  const subMap = new Map((missionSubs || []).map(s => [s.mission_id, s.status]));
  const todayMission = (missions || []).find(m => {
    const level = (m as any).levels;
    if (!level) return false;
    const mGlobal = RANK_ORDER.indexOf(level.rank_name) * 10 + level.level_number;
    return mGlobal <= currentGlobal && subMap.get(m.id) !== "approved";
  });

  const recentBadges = (myBadges || []).slice(0, 3);
  const isMaster40 = rank === "black" && progress.current_level === 10 && progress.bosses_cleared >= 4;

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">안녕하세요 👋</p>
          <h1 className="text-2xl text-foreground">{profile.nickname || profile.name}</h1>
        </div>
        <button onClick={() => navigate("/mypage")} className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-all active:scale-95">
          <User className="h-5 w-5 text-secondary-foreground" />
        </button>
      </div>

      <div className="space-y-5">
        {/* MASTER 40 */}
        {isMaster40 && (
          <div className="animate-bounce-in rounded-2xl border-2 border-accent bg-gradient-to-r from-accent/20 to-primary/20 p-5 text-center shadow-lg">
            <span className="text-4xl">🏆</span>
            <h2 className="mt-2 text-xl text-foreground">마스터 리그 달성!</h2>
            <p className="text-sm text-muted-foreground">모든 리그를 정복했습니다</p>
          </div>
        )}

        {/* 1. League/Level badge + rank */}
        <div className="animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <RankBadge rank={rank} level={progress.current_level} size="lg" isMaster={isManagerRole(role)} />
            {myPosition && (
              <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm font-bold text-primary">{myPosition}위</span>
              </div>
            )}
          </div>
          <div className="mb-2 text-xs text-muted-foreground">
            {isManagerRole(role) ? "👑 마스터 · 모든 레벨 달성" : (currentLevel?.title || `${RANK_LABELS[rank]} 리그 · 레벨 ${progress.current_level}`)}
            {profile.branch_name && <span className="ml-1.5 text-muted-foreground/60">· {profile.branch_name}</span>}
          </div>
          <XPBar current={progress.total_xp} max={xpToNext} />
          <p className="mt-1.5 text-right text-xs text-muted-foreground">
            다음 레벨까지 <strong className="text-primary">{xpRemaining} XP</strong>
          </p>
        </div>

        {/* 2. Weekly dashboard */}
        <WeeklyDashboard />

        {/* 3. Today's mission */}
        {todayMission && (
          <div className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <h2 className="mb-3 text-base font-bold text-foreground">🥊 오늘의 미션</h2>
            <button
              onClick={() => navigate("/missions")}
              className="w-full rounded-2xl border border-primary/30 bg-card p-4 shadow-sm transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Play className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-bold text-foreground">{todayMission.title}</p>
                  <p className="text-xs text-muted-foreground">+{todayMission.xp_reward} XP</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </button>
          </div>
        )}

        {/* 4. Rivals */}
        {rivalsAbove && rivalsAbove.length > 0 && (
          <div className="animate-slide-up" style={{ animationDelay: "0.15s" }}>
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">🎯 추격 대상</h2>
            <div className="space-y-2">
              {rivalsAbove.map(rival => (
                <RankMiniCard
                  key={rival.r_user_id}
                  nickname={rival.r_nickname}
                  rank={rival.r_current_rank}
                  level={rival.r_current_level}
                  position={Number(rival.rank_position)}
                  avatarUrl={rival.r_avatar_url}
                  xp={rival.r_total_xp}
                  isRival={progress.rival_id === rival.r_user_id}
                  onSetRival={() => {
                    setRival.mutate(rival.r_user_id);
                    toast.success(`${rival.r_nickname}을 추격 목표로 설정! 🎯`);
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* 5. Stats Row */}
        <div className="grid grid-cols-3 gap-2.5 animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <StatBox icon={progress.streak_days >= 3 ? "🔥" : "💪"} label="연속 출석" value={`${progress.streak_days}일`} />
          <StatBox icon="⚡" label="누적 XP" value={progress.total_xp.toLocaleString()} />
          <StatBox icon="🏆" label="보스 클리어" value={`${progress.bosses_cleared}회`} />
        </div>

        {/* 6. Quick Links */}
        <div className="animate-slide-up" style={{ animationDelay: "0.22s" }}>
          <h2 className="mb-3 text-base font-bold text-foreground">📌 바로가기</h2>
          <div className="grid grid-cols-2 gap-2.5">
            <QuickLink emoji="🗺️" label="레벨맵" desc="전체 레벨 현황" onClick={() => navigate("/levelmap")} />
            <QuickLink emoji="🎁" label="보상" desc="배지 & XP 기록" onClick={() => navigate("/rewards")} />
            <QuickLink emoji="🏆" label="명예의전당" desc="전체 랭킹 보기" onClick={() => navigate("/halloffame")} />
            <QuickLink emoji="🥋" label="단증 혜택" desc="자격증 & 혜택" onClick={() => navigate("/cert-benefits")} />
          </div>
        </div>

        {/* 6. Hall of fame */}
        <HallOfFameShowcase />

        {/* 7. Recent badges */}
        {recentBadges.length > 0 && (
          <div className="animate-slide-up" style={{ animationDelay: "0.25s" }}>
            <h2 className="mb-3 text-base font-bold text-foreground">🏅 최근 획득 배지</h2>
            <div className="flex gap-2">
              {recentBadges.map((mb: any) => (
                <div key={mb.id} className="flex flex-col items-center gap-1 rounded-2xl border border-primary/20 bg-card p-3 shadow-sm">
                  <span className="text-2xl">{mb.badges?.image_url || "🏅"}</span>
                  <span className="text-[10px] font-bold text-foreground">{mb.badges?.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 8. CTA */}
        <button
          onClick={() => navigate("/missions")}
          className="w-full animate-slide-up rounded-2xl bg-primary py-5 text-center text-lg font-bold text-primary-foreground shadow-lg transition-all active:scale-[0.98]"
          style={{ animationDelay: "0.3s" }}
        >
          🥊 오늘 도전 시작
        </button>

        {/* Coach shortcut */}
        {(role === "coach" || role === "admin" || role === "branch_manager" || role === "super_admin") && (
          <button onClick={() => navigate("/manager")} className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all active:scale-[0.98]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📋</span>
                <div>
                  <p className="text-sm font-bold text-foreground">회원 관리</p>
                  <p className="text-xs text-muted-foreground">미션 승인 및 회원 관리</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </button>
        )}
      </div>

      <LevelUpModal
        isOpen={levelUpModal.show}
        onClose={() => { setLevelUpModal({ show: false, level: 0, rank: "", xp: 0 }); refreshProgress(); }}
        newLevel={levelUpModal.level}
        newRank={levelUpModal.rank}
        xpGranted={levelUpModal.xp}
      />
    </div>
  );
};

const LoadingState = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="text-center">
      <div className="mx-auto mb-4 h-16 w-16 animate-pulse rounded-2xl bg-primary/20 flex items-center justify-center text-3xl">🥊</div>
      <p className="text-muted-foreground">로딩 중...</p>
    </div>
  </div>
);

const StatBox = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <div className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card p-3 shadow-sm">
    <span className="text-xl">{icon}</span>
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-lg font-bold text-foreground">{value}</span>
  </div>
);

export default HomePage;
