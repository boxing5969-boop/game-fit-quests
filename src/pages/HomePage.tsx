import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalProgress } from "@/hooks/useLocalProgress";
import XPBar from "@/components/XPBar";
import RankBadge from "@/components/RankBadge";
import LevelUpModal from "@/components/LevelUpModal";
import WeeklyPrescriptionCard from "@/components/WeeklyPrescriptionCard";
import RetentionBanner from "@/components/RetentionBanner";
import SelfChallengeFlow from "@/components/SelfChallengeFlow";
import QRScannerModal from "@/components/QRScannerModal";
import CheckinSuccessModal from "@/components/CheckinSuccessModal";
import { useRecordAttendance, useLevels, useMyBadges } from "@/hooks/useQuestData";
import { useRivalsAbove, useSetRival, useDivisionRanking } from "@/hooks/useRankingData";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { useNavigate } from "react-router-dom";
import { User, ChevronRight, TrendingUp, CheckCircle2, Flame, QrCode } from "lucide-react";
import HallOfFameShowcase from "@/components/HallOfFameShowcase";
import RankMiniCard from "@/components/RankMiniCard";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";
import { isManagerRole } from "@/lib/rankLabels";
import { getLevelById, SELF_CHALLENGE_BONUS_XP } from "@/data/allLevelsData";
import {
  WHITE_LV1_META,
  QUICK_ACTIONS,
  PROMOTION_METRICS,
  formatMicrocopy,
} from "@/data/whiteLevel1Data";
import { WHITE_LV2_META, WHITE_LV2_PROMOTION_METRICS } from "@/data/whiteLevel2Data";

const RANK_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };
const RANK_ORDER: Enums<"rank_name">[] = ["white", "blue", "red", "black"];

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  "진행중": { bg: "bg-primary/10", text: "text-primary" },
  "레벨업 심사 가능": { bg: "bg-status-complete/10", text: "text-status-complete" },
  "보완 필요": { bg: "bg-status-pending/10", text: "text-status-pending" },
  "레벨업 완료": { bg: "bg-accent/10", text: "text-accent-foreground" },
  "코치 확인 필요": { bg: "bg-destructive/10", text: "text-destructive" },
};

const HomePage = () => {
  const { user, profile, progress, role, refreshProgress } = useAuth();
  const navigate = useNavigate();
  const { data: levels } = useLevels();
  const { data: ranking } = useDivisionRanking();
  const { data: rivalsAbove } = useRivalsAbove();
  const { data: myBadges } = useMyBadges();
  const attendance = useRecordAttendance();
  const setRival = useSetRival();
  const { onboardingDone, safetyDone } = useOnboardingState();
  const { totalXp, status, metrics, activeLevelId, selfChallengeStreak } = useLocalProgress();
  const [showChallenge, setShowChallenge] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [checkinResult, setCheckinResult] = useState<any>(null);
  const [showCheckinSuccess, setShowCheckinSuccess] = useState(false);
  const [levelUpModal, setLevelUpModal] = useState<{ show: boolean; level: number; rank: string; xp: number }>({ show: false, level: 0, rank: "", xp: 0 });

  useEffect(() => {
    if (!onboardingDone) navigate("/onboarding", { replace: true });
    else if (!safetyDone) navigate("/safety-check", { replace: true });
  }, [onboardingDone, safetyDone, navigate]);

  useEffect(() => {
    if (progress) attendance.mutate();
  }, [progress?.user_id]); // eslint-disable-line

  if (!profile || !progress) return <LoadingState />;

  const rank = progress.current_rank as Enums<"rank_name">;
  const currentLevel = levels?.find(l => l.rank_name === rank && l.level_number === progress.current_level);
  const myPosition = ranking?.find(r => r.r_user_id === user?.id)?.rank_position;
  const recentBadges = (myBadges || []).slice(0, 3);
  const isMaster40 = rank === "black" && progress.current_level === 10 && progress.bosses_cleared >= 4;

  // Get unified level data for current level
  const unifiedLevel = getLevelById(rank, progress.current_level);

  // Select correct promotion metrics based on level
  const isWhiteLv1 = rank === "white" && progress.current_level === 1;
  const isWhiteLv2 = rank === "white" && progress.current_level === 2;
  const activePromoMetrics = isWhiteLv2 ? WHITE_LV2_PROMOTION_METRICS : PROMOTION_METRICS;
  const levelMeta = isWhiteLv2 ? WHITE_LV2_META : WHITE_LV1_META;

  // Dynamic microcopy
  const sessionsRemaining = Math.max(0, metrics.sessions.target - metrics.sessions.current);

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

        {/* 1. League/Level Card */}
        <div className="animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <RankBadge rank={rank} level={progress.current_level} size="lg" isMaster={isManagerRole(role)} />
            <div className="flex items-center gap-2">
              {myPosition && (
                <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm font-bold text-primary">{myPosition}위</span>
                </div>
              )}
              <div className={`rounded-full px-3 py-1.5 ${STATUS_STYLE[status]?.bg || "bg-muted"}`}>
                <span className={`text-xs font-bold ${STATUS_STYLE[status]?.text || "text-muted-foreground"}`}>{status}</span>
              </div>
            </div>
          </div>
          <div className="mb-2 text-xs text-muted-foreground">
            {isManagerRole(role) ? "👑 마스터 · 모든 레벨 달성" : (
              unifiedLevel ? unifiedLevel.title : (currentLevel?.title || `${RANK_LABELS[rank]} 리그 · 레벨 ${progress.current_level}`)
            )}
            {profile.branch_name && <span className="ml-1.5 text-muted-foreground/60">· {profile.branch_name}</span>}
          </div>
          <XPBar current={totalXp} max={metrics.xp.target} />
          <p className="mt-1.5 text-right text-xs text-muted-foreground">
            <strong className="text-primary">{totalXp}</strong> / {metrics.xp.target} XP
          </p>
        </div>

        {/* 2. Level Progression Metrics — all levels */}
        <div className="animate-slide-up" style={{ animationDelay: "0.05s" }}>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { id: "xp", label: "현재 레벨 XP", emoji: "⚡", target: metrics.xp.target, unit: "XP" },
              { id: "sessions", label: "인정 세션", emoji: "🥊", target: metrics.sessions.target, unit: "회" },
              { id: "days", label: "인정 출석일", emoji: "📅", target: metrics.days.target, unit: "일" },
              { id: "minutes", label: "훈련 시간", emoji: "⏱️", target: metrics.minutes.target, unit: "분" },
            ].map(m => {
              const met = metrics[m.id as keyof typeof metrics];
              const pct = met ? Math.min(100, Math.round((met.current / met.target) * 100)) : 0;
              const done = met && met.current >= met.target;
              return (
                <div key={m.id} className={`rounded-2xl border p-3.5 shadow-sm transition-all ${done ? "border-status-complete/30 bg-status-complete/5" : "border-border bg-card"}`}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{m.emoji} {m.label}</span>
                    {done && <CheckCircle2 className="h-3.5 w-3.5 text-status-complete" />}
                  </div>
                  <p className="text-lg font-bold text-foreground">
                    {met?.current ?? 0}<span className="text-sm text-muted-foreground">/{m.target}{m.unit}</span>
                  </p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full transition-all duration-500 ${done ? "bg-status-complete" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Retention Banner */}
        <div className="animate-slide-up" style={{ animationDelay: "0.08s" }}>
          <RetentionBanner />
        </div>

        {/* 4. Weekly Prescription */}
        <div className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <WeeklyPrescriptionCard />
        </div>

        {/* 5. Quick Actions */}
        <div className="animate-slide-up" style={{ animationDelay: "0.12s" }}>
          <div className="grid grid-cols-3 gap-2">
            {QUICK_ACTIONS.map(action => (
              <button
                key={action.id}
                onClick={() => navigate(action.route)}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card p-3.5 shadow-sm transition-all active:scale-[0.96]"
              >
                <span className="text-2xl">{action.emoji}</span>
                <span className="text-xs font-bold text-foreground leading-tight text-center">{action.label}</span>
                <span className="text-[9px] text-muted-foreground text-center">{action.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 6. Attendance note */}
        <div className="animate-slide-up rounded-xl bg-muted/50 px-4 py-2.5" style={{ animationDelay: "0.14s" }}>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            ℹ️ 하루 2번 운동해도 레벨업 출석은 하루 1회만 인정됩니다. 짧게 몰아서 하기보다 여러 날에 걸쳐 반복하는 것이 더 중요합니다.
          </p>
        </div>

        {/* 7. Rivals */}
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

        {/* 8. Stats Row */}
        <div className="grid grid-cols-3 gap-2.5 animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <StatBox icon={progress.streak_days >= 3 ? "🔥" : "💪"} label="연속 출석" value={`${progress.streak_days}일`} />
          <StatBox icon="⚡" label="누적 XP" value={totalXp.toLocaleString()} />
          <StatBox icon="🏆" label="보스 클리어" value={`${progress.bosses_cleared}회`} />
        </div>

        {/* 9. Quick Links */}
        <div className="animate-slide-up" style={{ animationDelay: "0.22s" }}>
          <h2 className="mb-3 text-base font-bold text-foreground">📌 바로가기</h2>
          <div className="grid grid-cols-2 gap-2.5">
            <QuickLink emoji="🗺️" label="레벨맵" desc="전체 레벨 현황" onClick={() => navigate("/levelmap")} />
            <QuickLink emoji="🎁" label="보상" desc="배지 & XP 기록" onClick={() => navigate("/rewards")} />
            <QuickLink emoji="🏆" label="명예의전당" desc="전체 랭킹 보기" onClick={() => navigate("/halloffame")} />
            <QuickLink emoji="🥋" label="단증 혜택" desc="자격증 & 혜택" onClick={() => navigate("/cert-benefits")} />
          </div>
        </div>

        {/* 10. Hall of Fame */}
        <HallOfFameShowcase />

        {/* 11. Recent badges */}
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

        {/* 12. Self-Challenge CTA */}
        {showChallenge ? (
          <div className="animate-slide-up" style={{ animationDelay: "0.3s" }}>
            <SelfChallengeFlow
              league={rank}
              levelInLeague={progress.current_level}
              onComplete={() => setShowChallenge(false)}
              onClose={() => setShowChallenge(false)}
            />
          </div>
        ) : (
          <div className="space-y-2 animate-slide-up" style={{ animationDelay: "0.3s" }}>
            {/* Recommended routine card */}
            <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📋</span>
                  <span className="text-sm font-bold text-foreground">오늘의 추천 루틴</span>
                </div>
                {selfChallengeStreak > 0 && (
                  <div className="flex items-center gap-1 rounded-full bg-status-pending/10 px-2 py-0.5">
                    <Flame className="h-3 w-3 text-status-pending" />
                    <span className="text-[10px] font-bold text-status-pending">{selfChallengeStreak}회 연속</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-1">
                {unifiedLevel?.title || `${RANK_LABELS[rank]} 리그 · 레벨 ${progress.current_level}`}
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                자가 도전으로 완료 시 +{SELF_CHALLENGE_BONUS_XP}XP 보너스. 레벨업 진행은 동일합니다.
              </p>
              <button
                onClick={() => setShowChallenge(true)}
                className="w-full rounded-2xl bg-primary py-4 text-center text-lg font-bold text-primary-foreground shadow-lg transition-all active:scale-[0.98]"
                style={{ fontFamily: "'Black Han Sans', sans-serif" }}
              >
                🥊 자가 도전 시작
              </button>
            </div>
          </div>
        )}

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

const QuickLink = ({ emoji, label, desc, onClick }: { emoji: string; label: string; desc: string; onClick: () => void }) => (
  <button onClick={onClick} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm transition-all active:scale-[0.97]">
    <span className="text-2xl">{emoji}</span>
    <div className="text-left">
      <p className="text-sm font-bold text-foreground">{label}</p>
      <p className="text-[10px] text-muted-foreground">{desc}</p>
    </div>
  </button>
);

export default HomePage;
