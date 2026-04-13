import { useEffect, useState, useCallback } from "react";
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
import { loadHomeWidgetPrefs } from "@/pages/SettingsPage";
import { useRecordAttendance, useLevels, useMyBadges } from "@/hooks/useQuestData";
import { useRivalsAbove, useSetRival, useDivisionRanking } from "@/hooks/useRankingData";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { useActivitySession } from "@/hooks/useActivitySession";
import { useNavigate } from "react-router-dom";
import { User, ChevronRight, TrendingUp, CheckCircle2, Flame, QrCode, X, Lock, Clock } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";

const RANK_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };
const RANK_ORDER: Enums<"rank_name">[] = ["white", "blue", "red", "black"];

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  "진행중": { bg: "bg-primary/10", text: "text-primary" },
  "레벨업 심사 가능": { bg: "bg-status-complete/10", text: "text-status-complete" },
  "보완 필요": { bg: "bg-status-pending/10", text: "text-status-pending" },
  "레벨업 완료": { bg: "bg-accent/10", text: "text-accent-foreground" },
  "코치 확인 필요": { bg: "bg-destructive/10", text: "text-destructive" },
};

const ALL_MENU_ITEMS = [
  { path: "/home", emoji: "🏠", label: "홈" },
  { path: "/missions", emoji: "🎯", label: "훈련" },
  { path: "/rank-up", emoji: "📈", label: "랭크업" },
  { path: "/halloffame", emoji: "🏆", label: "명예의전당" },
  { path: "/cert-benefits", emoji: "🏅", label: "단증혜택" },
  { path: "/guide", emoji: "📖", label: "가이드" },
  { path: "/mypage", emoji: "👤", label: "내정보" },
  { path: "/settings", emoji: "⚙️", label: "설정" },
  { path: "/level-map", emoji: "🗺️", label: "리그맵" },
  { path: "/rewards", emoji: "🎁", label: "보상" },
  { path: "/quests", emoji: "⚡", label: "퀘스트" },
];

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
  const activitySession = useActivitySession(user?.id, profile?.branch_name);
  const widgetPrefs = loadHomeWidgetPrefs();
  const [showChallenge, setShowChallenge] = useState(false);
  const [showAllMenu, setShowAllMenu] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [checkinResult, setCheckinResult] = useState<any>(null);
  const [showCheckinSuccess, setShowCheckinSuccess] = useState(false);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [checkingAttendance, setCheckingAttendance] = useState(true);
  const [levelUpModal, setLevelUpModal] = useState<{ show: boolean; level: number; rank: string; xp: number }>({ show: false, level: 0, rank: "", xp: 0 });

  // Check today's QR attendance
  const checkTodayAttendance = useCallback(async () => {
    if (!user?.id || !profile?.branch_name) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from("attendance_logs")
      .select("id")
      .eq("user_id", user.id)
      .eq("branch_name", profile.branch_name)
      .eq("method", "qr")
      .eq("is_duplicate", false)
      .gte("checked_in_at", todayStart.toISOString())
      .limit(1);
    if (!error && data && data.length > 0) {
      setCheckedInToday(true);
    } else {
      setCheckedInToday(false);
    }
    setCheckingAttendance(false);
  }, [user?.id, profile?.branch_name]);

  useEffect(() => {
    checkTodayAttendance();
  }, [checkTodayAttendance]);

  useEffect(() => {
    if (!onboardingDone) navigate("/onboarding", { replace: true });
    else if (!safetyDone) navigate("/safety-check", { replace: true });
  }, [onboardingDone, safetyDone, navigate]);

  useEffect(() => {
    if (progress) attendance.mutate();
  }, [progress?.user_id]); // eslint-disable-line

  // If there's an active session already, show the challenge flow
  useEffect(() => {
    if (activitySession.isActive && !showChallenge) {
      setShowChallenge(true);
    }
  }, [activitySession.isActive]); // eslint-disable-line

  const handleCheckinFeedback = useCallback((isDuplicate: boolean, xpGranted: number) => {
    if (isDuplicate) {
      toast.success("라이브보드에 다시 입장합니다");
      toast.success("오늘 도전을 다시 시작합니다 🥊");
    } else {
      toast.success(`출석 완료! +${xpGranted}XP 🥊`);
      toast.success("오늘 도전 시작! 💪");
    }
  }, []);

  const ensureActiveSession = useCallback(async () => {
    let session = await activitySession.refreshSession();
    if (session) return session;

    await new Promise(resolve => setTimeout(resolve, 250));
    session = await activitySession.refreshSession();
    if (session) return session;

    await new Promise(resolve => setTimeout(resolve, 500));
    return activitySession.refreshSession();
  }, [activitySession]);

  // Shared challenge start logic — used by both manual button and QR auto-start
  const handleStartChallenge = useCallback(async () => {
    const session = await activitySession.startChallenge();
    if (session) {
      setShowChallenge(true);
    }
  }, [activitySession]);

  const handleQrCheckinSuccess = useCallback(async (result: any) => {
    setShowQRScanner(false);
    setCheckedInToday(true);

    if (!result.is_duplicate) {
      refreshProgress();
    }

    setShowChallenge(true);
    await ensureActiveSession();

    if (!result.is_duplicate) {
      setCheckinResult(result);
      setShowCheckinSuccess(true);
    }

    handleCheckinFeedback(result.is_duplicate, result.xp_granted);
  }, [ensureActiveSession, handleCheckinFeedback, refreshProgress]);

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
        {/* QR Checkin Button */}
        <button
          onClick={() => setShowQRScanner(true)}
          className="w-full animate-slide-up rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-accent/10 p-4 shadow-sm transition-all active:scale-[0.98]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
              <QrCode className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold text-foreground">체육관 체크인</p>
              <p className="text-xs text-muted-foreground">QR 스캔으로 출석 + 10XP</p>
            </div>
            <ChevronRight className="h-5 w-5 text-primary" />
          </div>
        </button>

        {/* MASTER 40 */}
        {isMaster40 && (
          <div className="animate-bounce-in rounded-2xl border-2 border-accent bg-gradient-to-r from-accent/20 to-primary/20 p-5 text-center shadow-lg">
            <span className="text-4xl">🏆</span>
            <h2 className="mt-2 text-xl text-foreground">마스터 리그 달성!</h2>
            <p className="text-sm text-muted-foreground">모든 리그를 정복했습니다</p>
          </div>
        )}

        {/* 1. League/Level Card */}
        <div className="animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-sm relative overflow-hidden">
          {/* Sparkle effects */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute top-2 right-8 h-1.5 w-1.5 rounded-full bg-accent animate-ping" style={{ animationDuration: "2s" }} />
            <div className="absolute top-6 right-3 h-1 w-1 rounded-full bg-primary animate-ping" style={{ animationDuration: "2.5s", animationDelay: "0.5s" }} />
            <div className="absolute bottom-4 left-6 h-1.5 w-1.5 rounded-full bg-accent animate-ping" style={{ animationDuration: "3s", animationDelay: "1s" }} />
            <div className="absolute top-3 left-12 h-1 w-1 rounded-full bg-primary/60 animate-ping" style={{ animationDuration: "2.8s", animationDelay: "1.5s" }} />
            <div className="absolute bottom-6 right-12 h-1 w-1 rounded-full bg-accent/70 animate-ping" style={{ animationDuration: "2.2s", animationDelay: "0.8s" }} />
          </div>
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

        {/* 3. Retention Banner (hidden if restart routine toggled off) */}
        {widgetPrefs.showRestartRoutine && (
          <div className="animate-slide-up" style={{ animationDelay: "0.08s" }}>
            <RetentionBanner />
          </div>
        )}

        {/* 4. Weekly Prescription (hidden if toggled off) */}
        {widgetPrefs.showWeeklyPrescription && (
          <div className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <WeeklyPrescriptionCard />
          </div>
        )}

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

        {/* All menu sheet */}
        {showAllMenu && (
          <div className="fixed inset-0 z-[60] flex flex-col" onClick={() => setShowAllMenu(false)}>
            <div className="flex-1 bg-background/60 backdrop-blur-sm" />
            <div className="relative z-[61] rounded-t-2xl border-t border-border bg-card px-4 pb-8 pt-4 shadow-2xl safe-area-bottom animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">전체 메뉴</span>
                <button onClick={() => setShowAllMenu(false)} className="rounded-full bg-muted p-1.5 active:scale-95">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {ALL_MENU_ITEMS.map(item => {
                  const active = location.pathname === item.path;
                  return (
                    <button
                      key={item.path}
                      onClick={() => { navigate(item.path); setShowAllMenu(false); }}
                      className={`flex flex-col items-center gap-1.5 rounded-xl p-3 transition-all active:scale-95 ${
                        active ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <span className="text-xl">{item.emoji}</span>
                      <span className="text-[10px] font-medium">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

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
          <button
            onClick={() => setShowAllMenu(true)}
            className="group mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2.5 text-xs font-bold text-muted-foreground shadow-sm transition-all duration-300 hover:bg-primary/5 hover:text-primary hover:border-primary/30 active:scale-[0.97]"
          >
            <span className="transition-transform duration-300 group-hover:scale-110">📋</span>
            전체 메뉴 더보기
            <ChevronRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
          </button>
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
            {/* Active session timer banner */}
            {activitySession.isActive && (
              <div className="mb-3 rounded-2xl border-2 border-primary/30 bg-card p-4 text-center shadow-md">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-primary animate-pulse" />
                  <span className="text-xs font-bold text-primary">오늘 도전 진행 중</span>
                </div>
                <p className="text-3xl font-bold tabular-nums text-foreground" style={{ fontFamily: "monospace" }}>
                  {String(activitySession.elapsedMinutes).padStart(2, "0")}:{String(activitySession.elapsedSeconds).padStart(2, "0")}
                </p>
              </div>
            )}
            <SelfChallengeFlow
              league={rank}
              levelInLeague={progress.current_level}
              onComplete={async () => {
                await activitySession.completeChallenge();
                setShowChallenge(false);
              }}
              onClose={() => setShowChallenge(false)}
            />
          </div>
        ) : (
          <div className="space-y-2 animate-slide-up" style={{ animationDelay: "0.3s" }}>
            {/* Recommended routine card */}
            <div className={`rounded-2xl border p-4 ${checkedInToday ? "border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5" : "border-border bg-muted/30"}`}>
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
                {checkedInToday
                  ? `오늘 도전으로 완료 시 +${SELF_CHALLENGE_BONUS_XP}XP 보너스. 레벨업 진행은 동일합니다.`
                  : "체육관 체크인 후 도전을 시작할 수 있어요"}
              </p>
              <button
                onClick={async () => {
                  if (checkedInToday) {
                    await handleStartChallenge();
                  } else {
                    toast.error("체육관 QR 체크인 후 도전을 시작할 수 있어요 🥊");
                  }
                }}
                disabled={!checkedInToday}
                className={`w-full rounded-2xl py-4 text-center text-lg font-bold shadow-lg transition-all ${
                  checkedInToday
                    ? "bg-primary text-primary-foreground active:scale-[0.98]"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
                style={{ fontFamily: "'Black Han Sans', sans-serif" }}
              >
                {checkedInToday ? (
                  "🥊 오늘 도전 시작"
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Lock className="h-5 w-5" />
                    오늘 도전 시작
                  </span>
                )}
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

      <QRScannerModal
        open={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onSuccess={handleQrCheckinSuccess}
      />

      <CheckinSuccessModal
        open={showCheckinSuccess}
        onClose={() => setShowCheckinSuccess(false)}
        result={checkinResult}
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
