import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalProgress } from "@/hooks/useLocalProgress";
import { useRetention } from "@/hooks/useRetention";
import LevelUpModal from "@/components/LevelUpModal";
import RetentionBanner from "@/components/RetentionBanner";
import SelfChallengeFlow from "@/components/SelfChallengeFlow";
import QRScannerModal from "@/components/QRScannerModal";
import CheckinSuccessModal from "@/components/CheckinSuccessModal";
import { useRecordAttendance, useLevels, useMyBadges } from "@/hooks/useQuestData";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { useActivitySession } from "@/hooks/useActivitySession";
import { useNavigate } from "react-router-dom";
import { User, ChevronRight, QrCode, Gem, Flame, Lock, CheckCircle2 } from "lucide-react";
import HallOfFameShowcase from "@/components/HallOfFameShowcase";
import CharacterSprite from "@/components/CharacterSprite";
import { useMemberCharacterAssignment } from "@/hooks/useCharacterData";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";
import { isManagerRole } from "@/lib/rankLabels";
import { getLevelById } from "@/data/allLevelsData";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/hooks/useWallet";
import { RANK_LABELS, RANK_ICONS } from "@/data/sharedConstants";

const HomePage = () => {
  const { user, profile, progress, role, refreshProgress } = useAuth();
  const navigate = useNavigate();
  const { data: levels } = useLevels();
  const { data: myBadges } = useMyBadges();
  const attendance = useRecordAttendance();
  const retention = useRetention();
  const { onboardingDone, safetyDone } = useOnboardingState();
  const { totalXp, metrics } = useLocalProgress();
  const activitySession = useActivitySession(user?.id, profile?.branch_name);
  const { data: walletData } = useWallet();
  const { data: myCharacter } = useMemberCharacterAssignment();
  const [showChallenge, setShowChallenge] = useState(false);
  const [qrAutoStarted, setQrAutoStarted] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [checkinResult, setCheckinResult] = useState<any>(null);
  const [showCheckinSuccess, setShowCheckinSuccess] = useState(false);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [levelUpModal, setLevelUpModal] = useState<{ show: boolean; level: number; rank: string; xp: number }>({ show: false, level: 0, rank: "", xp: 0 });

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
    setCheckedInToday(!error && !!data && data.length > 0);
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

  useEffect(() => {
    if (activitySession.isActive && !showChallenge) setShowChallenge(true);
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

  const handleStartChallenge = useCallback(async () => {
    const session = await activitySession.startChallenge();
    if (session) setShowChallenge(true);
  }, [activitySession]);

  const handleQrCheckinSuccess = useCallback(async (result: any) => {
    setShowQRScanner(false);
    setCheckedInToday(true);
    if (!result.is_duplicate) refreshProgress();
    setQrAutoStarted(true);
    setShowChallenge(true);
    await ensureActiveSession();
    setCheckinResult(result);
    setShowCheckinSuccess(true);
    handleCheckinFeedback(result.is_duplicate, result.xp_granted);
  }, [ensureActiveSession, handleCheckinFeedback, refreshProgress]);

  if (!profile || !progress) return <LoadingState />;

  const rank = progress.current_rank as Enums<"rank_name">;
  const currentLevel = levels?.find(l => l.rank_name === rank && l.level_number === progress.current_level);
  const recentBadges = (myBadges || []).slice(0, 5);
  const isMaster40 = rank === "black" && progress.current_level === 10 && progress.bosses_cleared >= 4;
  const unifiedLevel = getLevelById(rank, progress.current_level);
  const showRestartRoutine = retention.inactiveDays >= 7;

  const sessionMet = metrics.sessions;
  const minuteMet = metrics.minutes;
  const allZero = sessionMet.current === 0 && minuteMet.current === 0;
  const bothDone = sessionMet.current >= sessionMet.target && minuteMet.current >= minuteMet.target;
  const weeklyEncouragement = bothDone
    ? "🎉 이번 주 목표 달성!"
    : allZero
      ? "가볍게 시작해볼까요? 💪"
      : "잘하고 있어요! 조금만 더!";

  const isMasterDisplay = isMaster40 || isManagerRole(role);
  const rankLabel = isMasterDisplay ? "마스터" : RANK_LABELS[rank];
  const rankIcon = isMasterDisplay ? "👑" : RANK_ICONS[rank];
  const missionTitle = unifiedLevel?.title || currentLevel?.title || `${RANK_LABELS[rank]} 리그 · 레벨 ${progress.current_level}`;

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      {/* ─── 1. Header ─── */}
      <header className="mb-4 flex items-center justify-between">
        <button
          onClick={() => navigate("/mypage")}
          className="flex items-center gap-2 active:scale-95 transition-transform"
        >
          {myCharacter?.character_presets ? (
            <div className="h-8 w-8">
              <CharacterSprite
                style={(myCharacter.character_presets.parts_json as any)?.style}
                userId={user?.id}
                partsJson={myCharacter.character_presets.parts_json as any}
                size="xs"
                league={rank}
                level={progress.current_level}
              />
            </div>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-base">🥊</div>
          )}
          <span className="text-sm font-bold text-foreground">
            {profile.nickname || profile.name}님
          </span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/avatar")}
            className="flex items-center gap-1 rounded-full bg-accent/20 px-3 py-1.5 active:scale-95"
          >
            <Gem className="h-4 w-4 text-accent" />
            <span className="text-sm font-bold text-accent-foreground">
              {walletData?.gems_balance?.toLocaleString() || 0}
            </span>
          </button>
          <button
            onClick={() => navigate("/mypage")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary active:scale-95"
          >
            <User className="h-4 w-4 text-secondary-foreground" />
          </button>
        </div>
      </header>

      <div className="space-y-4">
        {/* ─── 2. Character Showcase ─── */}
        <section className="animate-slide-up relative overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card via-card to-secondary/40 p-6 shadow-glow-soft">
          <div className="pointer-events-none absolute inset-0 opacity-60">
            <div className="absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute right-5 top-4 h-1.5 w-1.5 rounded-full bg-accent animate-ping" style={{ animationDuration: "2s" }} />
            <div className="absolute left-6 bottom-6 h-1 w-1 rounded-full bg-primary/50 animate-ping" style={{ animationDuration: "2.5s", animationDelay: "0.7s" }} />
          </div>
          <div className="relative flex flex-col items-center">
            <div className="mb-4 flex h-40 w-40 items-center justify-center">
              {myCharacter?.character_presets ? (
                <CharacterSprite
                  style={(myCharacter.character_presets.parts_json as any)?.style}
                  userId={user?.id}
                  partsJson={myCharacter.character_presets.parts_json as any}
                  size="lg"
                  animate
                  league={rank}
                  level={progress.current_level}
                  auraMode="detail"
                />
              ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded-full bg-muted text-6xl">🥊</div>
              )}
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3.5 py-1 backdrop-blur">
              <span className="text-base">{rankIcon}</span>
              <span className="text-sm font-bold text-foreground">
                {rankLabel} · Lv.{progress.current_level}
              </span>
            </div>
            {progress.streak_days > 0 ? (
              <div className="mt-2 flex items-center gap-1.5 rounded-full bg-status-pending/10 px-3 py-1">
                <Flame className="h-3.5 w-3.5 text-status-pending" />
                <span className="text-xs font-bold text-status-pending">
                  {progress.streak_days}일 연속 출석 중!
                </span>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                🔥 오늘 첫 출석을 시작해보세요!
              </p>
            )}
          </div>
        </section>

        {/* ─── 3. Today's Mission / Self-Challenge ─── */}
        {showChallenge ? (
          <div className="animate-slide-up">
            <SelfChallengeFlow
              league={rank}
              levelInLeague={progress.current_level}
              autoStart={qrAutoStarted}
              resumeStartedAt={activitySession.activeSession?.started_at}
              onComplete={async () => {
                await activitySession.completeChallenge();
                setShowChallenge(false);
                setQrAutoStarted(false);
              }}
              onLeave={async () => {
                const ok = await activitySession.leaveChallenge();
                if (ok) {
                  toast.success("라이브보드에서 퇴장했습니다");
                  setShowChallenge(false);
                  setQrAutoStarted(false);
                } else {
                  toast.error("퇴장 처리 실패");
                }
              }}
              onClose={() => {
                setShowChallenge(false);
                setQrAutoStarted(false);
              }}
            />
          </div>
        ) : (
          <section className="animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-elev-1">
            <h2 className="mb-2 text-base font-bold text-foreground">오늘의 미션</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              <span className="mr-1">⭐</span>
              {missionTitle}
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
              className={`w-full rounded-2xl py-4 text-center text-base font-bold transition-all ${
                checkedInToday
                  ? "bg-primary text-primary-foreground shadow-glow-soft hover:shadow-glow-primary active:scale-[0.98]"
                  : "bg-muted text-muted-foreground shadow-elev-1 cursor-not-allowed"
              }`}
            >
              {checkedInToday ? (
                "🥊 지금 시작하기"
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Lock className="h-4 w-4" />
                  먼저 체크인 해주세요
                </span>
              )}
            </button>
          </section>
        )}

        {/* ─── 4. Weekly Progress ─── */}
        <section
          className="animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-elev-1"
          style={{ animationDelay: "0.05s" }}
        >
          <h2 className="mb-3 text-base font-bold text-foreground">이번 주 진행도</h2>
          <div className="space-y-3">
            <ProgressRow
              icon="🎯"
              label="세션"
              current={sessionMet.current}
              target={sessionMet.target}
              unit=""
              zeroMessage={`이번 주 ${sessionMet.target}세션 도전 준비 완료!`}
            />
            <ProgressRow
              icon="⏱"
              label="시간"
              current={minuteMet.current}
              target={minuteMet.target}
              unit="분"
              zeroMessage="5분만 시작해도 충분해요"
            />
          </div>
          <p className="mt-3 text-center text-xs font-bold text-muted-foreground">
            {weeklyEncouragement}
          </p>
        </section>

        {/* ─── 5. Gym QR Checkin ─── */}
        <button
          onClick={() => {
            if (!checkedInToday) setShowQRScanner(true);
          }}
          disabled={checkedInToday}
          className={`w-full animate-slide-up rounded-2xl border p-4 shadow-elev-1 transition-all ${
            checkedInToday
              ? "cursor-default border-status-complete/30 bg-status-complete/5"
              : "border-primary/30 bg-gradient-to-r from-primary/10 to-accent/10 active:scale-[0.98]"
          }`}
          style={{ animationDelay: "0.08s" }}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                checkedInToday ? "bg-status-complete/20" : "bg-primary/20"
              }`}
            >
              {checkedInToday ? (
                <CheckCircle2 className="h-5 w-5 text-status-complete" />
              ) : (
                <QrCode className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold text-foreground">
                {checkedInToday ? "✅ 오늘 체크인 완료!" : "📍 체육관 체크인"}
              </p>
              <p className="text-xs text-muted-foreground">
                {checkedInToday ? "내일 다시 만나요 🥊" : "QR 스캔으로 출석 +10 XP"}
              </p>
            </div>
            {!checkedInToday && <ChevronRight className="h-4 w-4 text-primary" />}
          </div>
        </button>

        {/* ─── 6. Recent Badges ─── */}
        {recentBadges.length > 0 && (
          <section className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">🏅 최근 획득 배지</h2>
              <button
                onClick={() => navigate("/rewards")}
                className="text-xs font-medium text-primary active:scale-95"
              >
                전체보기 →
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {recentBadges.map((mb: any) => (
                <div
                  key={mb.id}
                  className="flex min-w-[80px] flex-col items-center gap-1 rounded-2xl border border-primary/20 bg-card p-3 shadow-elev-1"
                >
                  <span className="text-2xl">{mb.badges?.image_url || "🏅"}</span>
                  <span className="text-[10px] font-bold text-foreground text-center">
                    {mb.badges?.name}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── 7. Restart Routine (only if 7+ days inactive) ─── */}
        {showRestartRoutine && (
          <div className="animate-slide-up" style={{ animationDelay: "0.12s" }}>
            <RetentionBanner />
          </div>
        )}

        {/* ─── 8. Hall of Fame (bottom) ─── */}
        <div className="animate-slide-up" style={{ animationDelay: "0.15s" }}>
          <HallOfFameShowcase />
        </div>
      </div>

      <LevelUpModal
        isOpen={levelUpModal.show}
        onClose={() => {
          setLevelUpModal({ show: false, level: 0, rank: "", xp: 0 });
          refreshProgress();
        }}
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
      <div className="mx-auto mb-4 flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl bg-primary/20 text-3xl">
        🥊
      </div>
      <p className="text-muted-foreground">로딩 중...</p>
    </div>
  </div>
);

const ProgressRow = ({
  icon,
  label,
  current,
  target,
  unit,
  zeroMessage,
}: {
  icon: string;
  label: string;
  current: number;
  target: number;
  unit: string;
  zeroMessage: string;
}) => {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const done = target > 0 && current >= target;
  const isZero = current === 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-bold text-foreground">
          {icon} {label}
        </span>
        <span className={done ? "font-bold text-status-complete" : "text-muted-foreground"}>
          {current}/{target}{unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            done ? "bg-status-complete" : "bg-primary"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isZero && (
        <p className="mt-1 text-[11px] text-muted-foreground">{zeroMessage}</p>
      )}
    </div>
  );
};

export default HomePage;
