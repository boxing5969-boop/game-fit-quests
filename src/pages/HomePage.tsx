import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { User, Gem, QrCode, CheckCircle2, Trophy } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { useLocalProgress } from "@/hooks/useLocalProgress";
// useRetention: 홈 리스타트 루틴 배너 제거로 사용처 없음 (필요 시 복구).
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { useActivitySession } from "@/hooks/useActivitySession";
import { useWallet } from "@/hooks/useWallet";
import { useMemberCharacterAssignment } from "@/hooks/useCharacterData";
import {
  useRecordAttendance,
  useLevels,
  useMyBadges,
} from "@/hooks/useQuestData";
import { useDivisionRanking } from "@/hooks/useRankingData";
import { supabase } from "@/integrations/supabase/client";

import type { Enums } from "@/integrations/supabase/types";
import { isManagerRole } from "@/lib/rankLabels";
import { getLevelById, SELF_CHALLENGE_BONUS_XP } from "@/data/allLevelsData";
import { RANK_LABELS, RANK_ICONS } from "@/data/sharedConstants";

import CharacterSprite from "@/components/CharacterSprite";
import SelfChallengeFlow from "@/components/SelfChallengeFlow";
import QRScannerModal from "@/components/QRScannerModal";
import CheckinSuccessModal from "@/components/CheckinSuccessModal";
import LevelUpModal from "@/components/LevelUpModal";
// RetentionBanner 는 홈에서 제거 (Settings 의 widget pref 는 유지되어 향후 복구 가능).
// TutorialOverlay / TutorialCompleteModal: 랭킹업 입단식 리뉴얼로 글로벌
// InductionCeremonyOverlay (App.tsx) 가 대체. 기존 컴포넌트 파일은 보존되어
// 있으며 롤백 시 import 만 복구하면 된다.
import { MasterProgressCard } from "@/components/master/MasterProgressCard";
import { useLevelUpNotifications } from "@/hooks/useLevelUpNotifications";
import { useHofRewardsAutoClaim } from "@/hooks/useHofRewardsAutoClaim";

import {
  AppPage,
  PageHeader,
  HeroStatusCard,
  PrimaryCTAButton,
  MissionCard,
  XPBar,
  BadgeCard,
  RankingItem,
  EmptyState,
  NotificationBanner,
} from "@/components/ui/rankingup";

const HomePage = () => {
  const navigate = useNavigate();
  const { user, profile, progress, role, refreshProgress } = useAuth();
  const { data: levels } = useLevels();
  const { data: myBadges } = useMyBadges();
  const { data: walletData } = useWallet();
  const { data: myCharacter } = useMemberCharacterAssignment();
  const { data: ranking } = useDivisionRanking();
  const attendance = useRecordAttendance();
  const { onboardingDone, safetyDone } = useOnboardingState();
  const { totalXp, metrics } = useLocalProgress();
  const activitySession = useActivitySession(user?.id, profile?.branch_name);
  useLevelUpNotifications();
  useHofRewardsAutoClaim();

  const [showChallenge, setShowChallenge] = useState(false);
  const [qrAutoStarted, setQrAutoStarted] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [checkinResult, setCheckinResult] = useState<any>(null);
  const [showCheckinSuccess, setShowCheckinSuccess] = useState(false);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [levelUpModal, setLevelUpModal] = useState<{
    show: boolean;
    level: number;
    rank: string;
    xp: number;
  }>({ show: false, level: 0, rank: "", xp: 0 });

  // ───── Data side-effects (unchanged behavior) ─────
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

  const handleCheckinFeedback = useCallback(
    (isDuplicate: boolean, xpGranted: number) => {
      if (isDuplicate) {
        toast.success("라이브보드에 다시 입장합니다");
        toast.success("오늘 도전을 다시 시작합니다 🥊");
      } else {
        toast.success(`출석 완료! +${xpGranted}XP 🥊`);
        toast.success("오늘 도전 시작! 💪");
      }
    },
    [],
  );

  const ensureActiveSession = useCallback(async () => {
    let session = await activitySession.refreshSession();
    if (session) return session;
    await new Promise((resolve) => setTimeout(resolve, 250));
    session = await activitySession.refreshSession();
    if (session) return session;
    await new Promise((resolve) => setTimeout(resolve, 500));
    return activitySession.refreshSession();
  }, [activitySession]);

  const handleStartChallenge = useCallback(async () => {
    if (!checkedInToday) {
      toast.error("QR 체크인 후 오늘 도전이 오픈됩니다");
      return;
    }
    const session = await activitySession.startChallenge();
    if (session) setShowChallenge(true);
  }, [activitySession, checkedInToday]);

  const handleQrCheckinSuccess = useCallback(
    async (result: any) => {
      setShowQRScanner(false);
      setCheckedInToday(true);
      if (!result.is_duplicate) refreshProgress();
      setQrAutoStarted(true);
      setShowChallenge(true);
      await ensureActiveSession();
      setCheckinResult(result);
      setShowCheckinSuccess(true);
      handleCheckinFeedback(result.is_duplicate, result.xp_granted);
    },
    [ensureActiveSession, handleCheckinFeedback, refreshProgress],
  );

  if (!profile || !progress) return <LoadingState />;

  const rank = progress.current_rank as Enums<"rank_name">;
  const currentLevel = levels?.find(
    (l) => l.rank_name === rank && l.level_number === progress.current_level,
  );
  const recentBadges = (myBadges || []).slice(0, 5);
  const isMaster40 =
    rank === "black" &&
    progress.current_level === 10 &&
    progress.bosses_cleared >= 4;
  const unifiedLevel = getLevelById(rank, progress.current_level);

  const sessionMet = metrics.sessions;
  const minuteMet = metrics.minutes;
  const allZero = sessionMet.current === 0 && minuteMet.current === 0;
  const bothDone =
    sessionMet.current >= sessionMet.target &&
    minuteMet.current >= minuteMet.target;
  const weeklyEncouragement = bothDone
    ? "이번 주 목표 달성"
    : allZero
      ? "오늘 루틴으로 리그 진입"
      : "리듬 올라가는 중";

  const isMasterDisplay = isMaster40 || isManagerRole(role);
  const leagueIcon = isMasterDisplay ? "👑" : RANK_ICONS[rank];
  const leagueName = isMasterDisplay ? "마스터" : `${RANK_LABELS[rank]} 리그`;
  const missionTitle =
    unifiedLevel?.title ||
    currentLevel?.title ||
    `${RANK_LABELS[rank]} · Lv.${progress.current_level}`;

  const myRankRow = ranking?.find((r) => r.r_user_id === user?.id);
  const myPosition = myRankRow ? Number(myRankRow.rank_position) : null;

  const gemCount = walletData?.gems_balance ?? 0;
  const displayName = profile.nickname || profile.name;

  return (
    <AppPage
      header={
        <PageHeader
          title={displayName}
          subtitle={profile.branch_name || undefined}
          leftAction={
            myCharacter?.character_presets ? (
              <div className="h-9 w-9 shrink-0">
                <CharacterSprite
                  style={
                    (myCharacter.character_presets.parts_json as any)?.style
                  }
                  userId={user?.id}
                  partsJson={
                    myCharacter.character_presets.parts_json as any
                  }
                  size="xs"
                  league={rank}
                  level={progress.current_level}
                />
              </div>
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-muted text-base">
                🥊
              </div>
            )
          }
          rightAction={
            <>
              <button
                onClick={() => navigate("/avatar")}
                className="badge-pill bg-reward/15 text-reward active:scale-95"
                aria-label="보석"
              >
                <Gem className="h-3.5 w-3.5" />
                <span className="number-font">{gemCount.toLocaleString()}</span>
              </button>
              <button
                onClick={() => navigate("/mypage")}
                className="flex h-9 w-9 items-center justify-center rounded-pill bg-secondary active:scale-95"
                aria-label="내 정보"
              >
                <User className="h-4 w-4 text-secondary-foreground" />
              </button>
            </>
          }
          sticky
        />
      }
    >
      <div className="space-y-6">
        {/* ─── Master-40 celebration (conditional) ─── */}
        {isMaster40 && (
          <NotificationBanner
            variant="reward"
            title="🏆 마스터 리그 달성"
            message="블랙 10 + 모든 타이틀매치 클리어 완료. 명예의 전당에 등극!"
            action={{
              label: "명예의 전당 보기",
              onClick: () => navigate("/halloffame"),
            }}
          />
        )}

        {/* ─── 1. Hero Status ─── */}
        <HeroStatusCard
          character={
            myCharacter?.character_presets ? (
              <CharacterSprite
                style={(myCharacter.character_presets.parts_json as any)?.style}
                userId={user?.id}
                partsJson={myCharacter.character_presets.parts_json as any}
                size="lg"
                animate
                league={rank}
                level={progress.current_level}
                auraMode="detail"
                priority
              />
            ) : (
              <div className="flex h-32 w-32 items-center justify-center rounded-pill bg-muted text-6xl">
                🥊
              </div>
            )
          }
          leagueIcon={leagueIcon}
          leagueName={leagueName}
          level={progress.current_level}
          totalXp={totalXp}
          xpToNext={Math.max(metrics.xp.target, totalXp || 1)}
          streakDays={progress.streak_days}
        />

        {/* ─── 1b. Master Track progress (shown only when opted in) ─── */}
        {(progress as any)?.master_track_unlocked && (
          <MasterProgressCard masterLevel={(progress as any)?.master_level ?? 1} />
        )}

        {/* ─── 2. Primary CTA — QR check-in or success indicator ─── */}
        {checkedInToday ? (
          <div className="flex items-center justify-center gap-2 rounded-card border border-[#22C55E]/40 bg-[#22C55E]/10 px-6 py-4 font-bold text-[#22C55E]">
            <CheckCircle2 className="h-5 w-5" />
            <span>
              출석 완료
              {progress.streak_days > 0 && (
                <>
                  {" · "}
                  <span className="number-font">
                    {progress.streak_days}일
                  </span>{" "}
                  연속
                </>
              )}
            </span>
          </div>
        ) : (
          <PrimaryCTAButton
            icon={<QrCode className="h-5 w-5" />}
            rewardText="+10 XP"
            onClick={() => setShowQRScanner(true)}
          >
            QR 체크인 하기
          </PrimaryCTAButton>
        )}

        {/* ─── 3. Today's Mission / Active Session ─── */}
        {showChallenge ? (
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
        ) : (
          <MissionCard
            title={missionTitle}
            subtitle={`${RANK_LABELS[rank]} 리그 · 오늘의 미션`}
            reward={`+${SELF_CHALLENGE_BONUS_XP} XP 보너스`}
            status={checkedInToday ? "active" : "locked"}
            ctaText={checkedInToday ? "🥊 시작" : undefined}
            onClick={handleStartChallenge}
            lockedHint="QR 체크인 후 오늘의 미션이 오픈됩니다"
          />
        )}

        {/* ─── 4. Weekly Progress ─── */}
        <section className="surface-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-display-sm">이번 주 진행도</h2>
            <span className="text-caption text-muted-foreground">
              {weeklyEncouragement}
            </span>
          </div>
          <div className="space-y-4">
            <XPBar
              current={sessionMet.current}
              max={sessionMet.target}
              label="🎯 세션"
              variant="primary"
              size="md"
              showNumbers
            />
            <XPBar
              current={minuteMet.current}
              max={minuteMet.target}
              label="⏱ 훈련 시간 (분)"
              variant="primary"
              size="md"
              showNumbers
            />
          </div>
        </section>

        {/* ─── 5. Retention 배너는 홈에서 제거 ─── */}

        {/* ─── 5b. 153 다이어트 프로그램 (feature flag ON 시만) ─── */}
        {profile?.diet_program_enabled && (
          <section>
            <button
              type="button"
              onClick={() => navigate("/diet")}
              className="w-full rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-reward/5 to-primary/10 p-4 text-left transition-all active:scale-[0.99] hover:border-primary/50"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-reward text-primary-foreground text-xl">
                  🥗
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                    153 DIET · 21 DAYS
                  </p>
                  <p className="mt-0.5 truncate text-[14px] font-bold text-foreground">
                    체지방을 제거하는 몸 습관 만들기
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    매일 5 습관 체크 · 복싱짐 출석 연동 · 코치 피드백
                  </p>
                </div>
                <span className="shrink-0 text-primary text-xl">→</span>
              </div>
            </button>
          </section>
        )}

        {/* ─── 6. Recent Badges ─── */}
        {recentBadges.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-display-sm">최근 획득 배지</h2>
              <button
                onClick={() => navigate("/rewards")}
                className="text-caption font-medium text-primary active:scale-95"
              >
                전체보기 →
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
              {recentBadges.map((mb: any) => (
                <BadgeCard
                  key={mb.id}
                  title={mb.badges?.name || "배지"}
                  icon={mb.badges?.image_url || "🏅"}
                  rarity="rare"
                  subtitle="획득"
                />
              ))}
            </div>
          </section>
        )}

        {/* ─── 7. Ranking Preview ─── */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-display-sm">이번 주 내 순위</h2>
            <button
              onClick={() => navigate("/halloffame")}
              className="text-caption font-medium text-primary active:scale-95"
            >
              전체 랭킹 →
            </button>
          </div>
          {myPosition ? (
            <RankingItem
              rank={myPosition}
              name={displayName}
              score={totalXp}
              isMe
              meta={`${RANK_LABELS[rank]} · Lv.${progress.current_level}`}
              avatar={
                myCharacter?.character_presets ? (
                  <CharacterSprite
                    style={
                      (myCharacter.character_presets.parts_json as any)?.style
                    }
                    userId={user?.id}
                    partsJson={
                      myCharacter.character_presets.parts_json as any
                    }
                    size="xs"
                    league={rank}
                    level={progress.current_level}
                  />
                ) : (
                  "🥊"
                )
              }
              onClick={() => navigate("/halloffame")}
            />
          ) : (
            <EmptyState
              icon={<Trophy className="h-8 w-8 text-reward" />}
              title="아직 순위에 없어요"
              description="첫 도전을 완료하면 랭킹에 진입합니다."
              ctaText={checkedInToday ? "🥊 오늘 도전 시작" : "QR 체크인 하기"}
              onCtaClick={() => {
                if (checkedInToday) handleStartChallenge();
                else setShowQRScanner(true);
              }}
            />
          )}
        </section>
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

      {/* 튜토리얼 오버레이는 App.tsx 의 글로벌 InductionCeremonyOverlay 로 이관. */}
    </AppPage>
  );
};

const LoadingState = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl bg-primary/20 text-3xl">
        🥊
      </div>
      <p className="text-muted-foreground">로딩 중...</p>
    </div>
  </div>
);

export default HomePage;
