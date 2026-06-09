import { useEffect, useState, useCallback, lazy, Suspense, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { User, Banknote, Trophy, Settings } from "lucide-react";
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
import { getLevelById } from "@/data/allLevelsData";
import { RANK_LABELS } from "@/data/sharedConstants";

import CharacterSprite from "@/components/CharacterSprite";
import SelfChallengeFlow from "@/components/SelfChallengeFlow";
// 64-Q: QRScannerModal lazy import — qr.js (359KB) 첫 페인트에서 제거.
//   회원이 QR 체크인 버튼 누를 때만 다운로드. 평소 홈 진입엔 불필요.
const QRScannerModal = lazy(() => import("@/components/QRScannerModal"));
import CheckinSuccessModal from "@/components/CheckinSuccessModal";
import LevelUpModal from "@/components/LevelUpModal";
// 단계 47 — 홈 상단 정리: 오늘 할 일 / 오삼이 한마디 (기존 컴포넌트 0 변경)
import TodayFocusCard from "@/components/home/TodayFocusCard";
import OsamiHomeNote from "@/components/home/OsamiHomeNote";
// RetentionBanner 는 홈에서 제거 (Settings 의 widget pref 는 유지되어 향후 복구 가능).
// TutorialOverlay / TutorialCompleteModal: 랭킹업 입단식 리뉴얼로 글로벌
// InductionCeremonyOverlay (App.tsx) 가 대체. 기존 컴포넌트 파일은 보존되어
// 있으며 롤백 시 import 만 복구하면 된다.
import { MasterProgressCard } from "@/components/master/MasterProgressCard";
import HomeCustomizeSheet from "@/components/home/HomeCustomizeSheet";
// HomeEngagementSection 은 별도 메뉴 (/myboxer/quest, MyBoxerQuestPage) 로 이전.
import { useHomeLayout, type HomeWidgetId } from "@/lib/homeLayout";
import TodayActionCard, { type TodayActionState } from "@/components/home/TodayActionCard";
import QuickAccessRow from "@/components/home/QuickAccessRow";
import HomeMoreSection from "@/components/home/HomeMoreSection";
import StoryRpgEntryCard from "@/components/story-rpg/StoryRpgEntryCard";
import BoxerLicenseCard from "@/components/license/BoxerLicenseCard";
import { getMasterLevelDefinition } from "@/data/masterTierData";
import { useDisplayMode } from "@/hooks/useDisplayMode";
import { useLevelUpNotifications } from "@/hooks/useLevelUpNotifications";
import { useHofRewardsAutoClaim } from "@/hooks/useHofRewardsAutoClaim";

import {
  AppPage,
  PageHeader,
  XPBar,
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
  const { onboardingDone } = useOnboardingState();
  const { totalXp, metrics } = useLocalProgress();
  const activitySession = useActivitySession(user?.id, profile?.branch_name);
  const { resolveSlot: resolveDisplaySlot } = useDisplayMode();
  useLevelUpNotifications();
  useHofRewardsAutoClaim();

  const [showChallenge, setShowChallenge] = useState(false);
  const [qrAutoStarted, setQrAutoStarted] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const { visibility: homeWidgets, order: homeWidgetOrder } = useHomeLayout();
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
  }, [onboardingDone, navigate]);

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
  void myBadges; // 최근 획득 배지 섹션 제거로 현재 미사용 — 향후 복구 대비 hook 유지
  const isMaster40 =
    rank === "black" &&
    progress.current_level === 10 &&
    progress.bosses_cleared >= 4;
  // 마스터 트랙 진입자: 카드에 마스터 타이틀(예: 그랜드 챔피언) + 오버롤 레벨 표시
  const onMasterTrack = !!progress.master_track_unlocked && (progress.master_level ?? 0) >= 1;
  const masterDef = onMasterTrack ? getMasterLevelDefinition(progress.master_level ?? 0) : undefined;
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

  // leagueIcon/leagueName — 옛 HeroStatusCard 에서 사용. 라이센스 카드 도입으로 미사용.
  const isMasterDisplay = isMaster40 || isManagerRole(role);
  void isMasterDisplay;
  // missionTitle/SELF_CHALLENGE_BONUS_XP — 옛 MissionCard 에서 사용됨, Option C 에서는 미사용
  void unifiedLevel; void currentLevel;

  const myRankRow = ranking?.find((r) => r.r_user_id === user?.id);
  const myPosition = myRankRow ? Number(myRankRow.rank_position) : null;

  // ── Option C: 오늘의 액션 상태 결정 (TodayActionCard 입력) ──
  const activeMinutes = activitySession.activeSession?.started_at
    ? Math.max(0, Math.floor((Date.now() - new Date(activitySession.activeSession.started_at).getTime()) / 60000))
    : 0;
  const todayActionState: TodayActionState = !checkedInToday
    ? "qr_checkin"
    : activitySession.isActive
      ? "active_session"
      : bothDone
        ? "all_done"
        : !showChallenge && !sessionMet.current && !minuteMet.current
          ? "start_mission"
          : "evaluate";
  const handleTodayAction = () => {
    if (todayActionState === "qr_checkin") {
      setShowQRScanner(true);
      // 64-P: 오삼 가이드 step 4 'QR 출석체크 연습하기' detector 트리거
      if (typeof window !== "undefined") {
        try {
          window.dispatchEvent(new Event("tutorial-qr-opened"));
        } catch {
          /* noop */
        }
      }
    } else if (todayActionState === "active_session" || todayActionState === "start_mission") handleStartChallenge();
    else if (todayActionState === "all_done") navigate("/halloffame");
    else navigate("/missions");
  };

  // 퀵 액세스 칩 상태
  const missionStatus: "locked" | "ready" | "in_progress" | "done" = !checkedInToday
    ? "locked"
    : bothDone
      ? "done"
      : showChallenge || activitySession.isActive
        ? "in_progress"
        : "ready";
  const weeklyProgress = Math.min(
    1,
    sessionMet.target > 0
      ? (sessionMet.current / sessionMet.target +
          (minuteMet.target > 0 ? minuteMet.current / minuteMet.target : 0)) /
          (minuteMet.target > 0 ? 2 : 1)
      : 0,
  );

  const gemCount = walletData?.gems_balance ?? 0;
  // 전체 관리자는 파이트 머니 개념이 없음 — 상단 표기를 ∞ 로 통일.
  const isAdmin = role === "admin" || role === "super_admin";
  const gemsDisplay = isAdmin ? "∞" : gemCount.toLocaleString();
  const displayName = profile.nickname || profile.name;
  // 153 스토리 RPG: 미공개 — admin/super_admin 만 진입/표시 (회원 노출 차단).
  // 추가로 admin 도 본인 customize 토글로 끌 수 있음.
  const showStoryRpg = isAdmin && homeWidgets.storyRpg;

  return (
    <AppPage
      header={
        <PageHeader
          title={displayName}
          subtitle={profile.branch_name || undefined}
          leftAction={
            myCharacter?.character_presets ? (
              <button
                type="button"
                onClick={() => navigate("/character-studio")}
                aria-label="캐릭터 스튜디오로 이동"
                className="relative h-9 w-9 shrink-0 overflow-visible rounded-full transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
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
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate("/character-studio")}
                aria-label="캐릭터 만들러 가기"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-muted text-base transition-transform active:scale-95"
              >
                🥊
              </button>
            )
          }
          rightAction={
            <>
              <button
                onClick={() => navigate("/character-studio")}
                className="badge-pill bg-reward/15 text-reward active:scale-95"
                aria-label="파이트 머니 — 캐릭터 스튜디오로 이동"
              >
                <Banknote className="h-3.5 w-3.5" />
                <span className="number-font">{gemsDisplay}</span>
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
      <div className="space-y-4">
        {/* ─── Master-40 celebration (조건부 — 항상 상단 고정) ─── */}
        {isMaster40 && (
          <NotificationBanner
            variant="reward"
            title="🏆 마스터 리그 달성"
            message="명예의 전당에 등극!"
            action={{
              label: "전당 보기",
              onClick: () => navigate("/halloffame"),
            }}
          />
        )}

        {/* ─── Primary 슬롯 — 회원이 커스터마이즈에서 순서 변경 가능 ───
             기본값: ① 프로카드 ② QR 체크인 ③ 오삼 코치 한마디 ④ 명예의 전당.
             각 위젯은 homeWidgets[id] 토글로 켜고 끔. 끄면 더보기 안으로 이동. */}
        {(() => {
          const PRIMARY_IDS = new Set<HomeWidgetId>([
            "hero",
            "todayAction",
            "osamiNote",
            "rankingPreview",
          ]);

          const renderers: Record<HomeWidgetId, () => JSX.Element | null> = {
            hero: () => {
              if (!homeWidgets.hero) return null;
              const hasAvatar = !!profile?.avatar_url;
              const hasCharacter = !!myCharacter?.character_presets;
              const slot = resolveDisplaySlot(hasAvatar, hasCharacter);
              return (
                <BoxerLicenseCard
                  size="hero"
                  photo={
                    slot === "photo" && profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.nickname || profile.name || "프로필"}
                        className="h-full w-full object-cover"
                      />
                    ) : slot === "character" && myCharacter?.character_presets ? (
                      <CharacterSprite
                        style={(myCharacter.character_presets.parts_json as any)?.style}
                        userId={user?.id}
                        partsJson={myCharacter.character_presets.parts_json as any}
                        size="md"
                        animate
                        league={rank}
                        level={progress.current_level}
                        auraMode="compact"
                        priority
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center text-5xl font-black text-white"
                        style={{
                          background:
                            rank === "blue"
                              ? "linear-gradient(135deg, hsl(215, 100%, 35%), hsl(215, 100%, 18%))"
                              : rank === "red"
                                ? "linear-gradient(135deg, hsl(0, 84%, 35%), hsl(0, 84%, 18%))"
                                : rank === "black"
                                  ? "linear-gradient(135deg, hsl(42, 60%, 22%), hsl(0, 0%, 8%))"
                                  : "linear-gradient(135deg, hsl(220, 14%, 35%), hsl(220, 14%, 22%))",
                        }}
                      >
                        {(profile?.nickname || profile?.name || "🥊").charAt(0)}
                      </div>
                    )
                  }
                  name={profile.nickname || profile.name || "복서"}
                  branch={profile.branch_name}
                  league={rank}
                  level={onMasterTrack ? progress.overall_level : progress.current_level}
                  userId={user?.id}
                  issueDate={(profile as { created_at?: string }).created_at}
                  streakDays={progress.streak_days}
                  totalXp={totalXp}
                  xpToNext={Math.max(metrics.xp.target, totalXp || 1)}
                  isMaster={isMaster40}
                  masterTitle={masterDef?.title}
                />
              );
            },
            todayAction: () =>
              homeWidgets.todayAction ? (
                <TodayActionCard
                  state={todayActionState}
                  activeMinutes={activeMinutes}
                  streakDays={progress.streak_days}
                  onClick={handleTodayAction}
                />
              ) : null,
            osamiNote: () => (homeWidgets.osamiNote ? <OsamiHomeNote /> : null),
            rankingPreview: () =>
              homeWidgets.rankingPreview ? (
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-base font-black">이번 주 내 순위</h2>
                    <button
                      onClick={() => navigate("/halloffame")}
                      className="text-[11px] font-medium text-primary active:scale-95"
                    >
                      전체 →
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
                            style={(myCharacter.character_presets.parts_json as any)?.style}
                            userId={user?.id}
                            partsJson={myCharacter.character_presets.parts_json as any}
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
              ) : null,
            // primary 슬롯에 안 들어가는 ID 들 (HomeMoreSection 안에서 별도 렌더)
            quickAccess: () => null,
            masterTrack: () => null,
            storyRpg: () => null,
            dietPromo: () => null,
            todayMission: () => null,
            weeklyProgress: () => null,
          };

          // order 배열에서 primary 슬롯에 해당하는 ID 만 정렬 순서로 렌더
          return homeWidgetOrder
            .filter((id) => PRIMARY_IDS.has(id))
            .map((id) => <Fragment key={id}>{renderers[id]()}</Fragment>);
        })()}

        {/* ─── 퀵 액세스 3 칩 (Primary 슬롯에 들어가지 않는 항상-위 위젯) ─── */}
        {homeWidgets.quickAccess && (
          <QuickAccessRow
            missionStatus={missionStatus}
            challengeJoined={false}
            weeklyProgress={weeklyProgress}
          />
        )}

        {/* ─── 오늘 한 줄 포커스 카드 (always-on, customize 토글 대상 아님) ─── */}
        <TodayFocusCard />

        {/* ─── 활동 세션 진행 중일 때만 SelfChallengeFlow 표시 (전체 화면 모달) ─── */}
        {showChallenge && (
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
        )}

        {/* ─── "더 보기" — 펼침 가능한 보조 콘텐츠 ───
             rankingPreview 는 primary 슬롯으로 이전 — 더보기 안에서는 제거. */}
        <HomeMoreSection
          count={
            (showStoryRpg ? 1 : 0) +
            (homeWidgets.dietPromo && profile?.diet_program_enabled ? 1 : 0) +
            (homeWidgets.weeklyProgress ? 1 : 0)
          }
        >
          {/* 64-I: 마스터 로드 진행도 카드는 훈련 탭(/missions) 으로 이전.
              회원이 마스터(40레벨 달성=master_track_unlocked)에 들어선 뒤에만
              훈련 탭 상단에서 다음 보스 보상을 확인하도록 — 홈은 1~40 회원에게
              부담 줄임. */}

          {/* 153 QUEST 몰입 카드는 별도 메뉴 (/myboxer/quest) 로 이전 */}

          {/* 153 마인드셋 진입 카드 (회원 노출 라벨 통일 — 미공개, admin 만) */}
          {showStoryRpg && <StoryRpgEntryCard />}

          {/* 이번 주 진행도 */}
          {homeWidgets.weeklyProgress && (
            <section className="surface-card">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-black">이번 주 진행도</h2>
                <span className="text-[11px] text-muted-foreground">
                  {weeklyEncouragement}
                </span>
              </div>
              <div className="space-y-3">
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
          )}

          {/* 153 다이어트 프로그램 (feature flag) — 한 줄 요약 */}
          {homeWidgets.dietPromo && profile?.diet_program_enabled && (
            <button
              type="button"
              onClick={() => navigate("/diet")}
              className="flex w-full items-center gap-3 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-reward/5 to-primary/10 p-3 text-left transition-all active:scale-[0.99] hover:border-primary/50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-reward text-primary-foreground text-lg">
                🥗
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                  153 DIET · 21 DAYS
                </p>
                <p className="mt-0.5 truncate text-sm font-bold text-foreground">
                  체지방 제거 21일 챌린지
                </p>
              </div>
              <span className="shrink-0 text-primary text-lg">→</span>
            </button>
          )}

          {/* rankingPreview 는 primary 슬롯으로 이전됨 (커스터마이즈 토글로 켜고 끔). */}

          {/* 홈 커스터마이즈 진입점 */}
          <div className="flex justify-center pb-1">
            <button
              type="button"
              onClick={() => setShowCustomize(true)}
              className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-card px-3.5 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors active:scale-95 hover:border-primary/40 hover:text-primary"
            >
              <Settings className="h-3.5 w-3.5" />
              홈 커스터마이즈
            </button>
          </div>
        </HomeMoreSection>
      </div>

      <HomeCustomizeSheet
        open={showCustomize}
        onClose={() => setShowCustomize(false)}
      />

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

      {/* 64-Q: QRScannerModal 은 modal open 시점에만 chunk 다운로드.
          fallback=null — 미열린 평소엔 아무것도 안 그림. */}
      {showQRScanner && (
        <Suspense fallback={null}>
          <QRScannerModal
            open={showQRScanner}
            onClose={() => setShowQRScanner(false)}
            onSuccess={handleQrCheckinSuccess}
          />
        </Suspense>
      )}

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
