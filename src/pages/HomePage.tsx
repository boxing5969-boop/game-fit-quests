import { useEffect, useState, useCallback, Fragment } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { User, Ticket, Trophy, Settings, ChevronLeft, X } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { useLocalProgress } from "@/hooks/useLocalProgress";
// useRetention: 홈 리스타트 루틴 배너 제거로 사용처 없음 (필요 시 복구).
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { useActivitySession, type ActivitySession } from "@/hooks/useActivitySession";
import { useWallet } from "@/hooks/useWallet";
import { useMemberCharacterAssignment } from "@/hooks/useCharacterData";
import {
  useRecordAttendance,
  useLevels,
} from "@/hooks/useQuestData";
import { useDivisionRanking } from "@/hooks/useRankingData";
import { supabase } from "@/integrations/supabase/client";

import type { Enums } from "@/integrations/supabase/types";
import { isManagerRole } from "@/lib/rankLabels";
import { getLevelById } from "@/data/allLevelsData";
import { RANK_LABELS } from "@/data/sharedConstants";

import CharacterSprite from "@/components/CharacterSprite";
import RankBadge from "@/components/RankBadge";
import SelfChallengeFlow from "@/components/SelfChallengeFlow";
//   회원이 QR 체크인 버튼 누를 때만 다운로드. 평소 홈 진입엔 불필요.
// QR 체크인은 폐지 — 출석은 입구 얼굴 인식으로 자동 기록된다 (2026-09-02).
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
import WorkoutFinishCard from "@/components/home/WorkoutFinishCard";
import MileageCard from "@/components/home/MileageCard";
import { useLevelCycleProgress, promotionHint } from "@/hooks/useLevelCycleProgress";
import {
  STAFF_CHAMPION_LEVEL, STAFF_CHAMPION_LINE, isStaffProfile, staffChampionLine, staffDisplayName, staffTitleLabel,
} from "@/lib/staffDisplay";
import { useLevelupRules } from "@/hooks/useLevelupRules";
import { authorityLabel } from "@/lib/levelAuthority";
import { useMyWorkoutToday } from "@/hooks/useWorkoutTime";
import QuickAccessRow from "@/components/home/QuickAccessRow";
import HomeMoreSection from "@/components/home/HomeMoreSection";
import HomeMenuGrid from "@/components/home/HomeMenuGrid";
import AppSearchButton from "@/components/search/AppSearchButton";
import DmHeaderButton from "@/components/dm/DmHeaderButton";
import NotificationBellButton from "@/components/notifications/NotificationBellButton";
import StoryRpgEntryCard from "@/components/story-rpg/StoryRpgEntryCard";
import BoxerLicenseCard from "@/components/license/BoxerLicenseCard";
import { getMasterLevelDefinition } from "@/data/masterTierData";
import { useDisplayMode } from "@/hooks/useDisplayMode";
import { isPtMember } from "@/lib/ptMember";
import { useLevelUpNotifications } from "@/hooks/useLevelUpNotifications";
import { useHofRewardsAutoClaim } from "@/hooks/useHofRewardsAutoClaim";
import { useMemberLicense } from "@/hooks/use153King";
import NicknameLikeSheet from "@/components/engagement/NicknameLikeSheet";
import NicknameEditSheet from "@/components/license/NicknameEditSheet";

import {
  AppPage,
  PageHeader,
  XPBar,
  RankingItem,
  EmptyState,
  NotificationBanner,
} from "@/components/ui/rankingup";

/**
 * 2026-09-29 대표님: "로그인해서 들어가면 전체 메뉴만 보이게 · 1번 메뉴 MY복서에 기존 홈 화면".
 *   · view="menu"    (/home)    — 머리글 + 전체 메뉴만. 로그인·하단 '홈' 탭이 여기로 온다.
 *   · view="myboxer" (/myboxer) — 예전 홈 화면 그대로(라이센스 카드·오늘의 할 일·순위·더 보기) + 뒤로 버튼.
 * 두 화면이 같은 컴포넌트라 앱 접속 출석·레벨업 알림·명예의 전당 보상·온보딩 이동·진행 중 도전(전체 화면)
 * 같은 부수 동작은 첫 화면(전체 메뉴)에서도 예전과 똑같이 돈다.
 */
const HomePage = ({ view = "menu" }: { view?: "menu" | "myboxer" }) => {
  const navigate = useNavigate();
  const { user, profile, progress, role, refreshProgress } = useAuth();
  const { data: levels } = useLevels();
  // useMyBadges 호출 제거 — 배지 섹션 제거 후 결과 미사용인데 홈 진입마다
  // member_badges 조회가 나감. 복구 시 useQuestData 의 훅을 다시 호출하면 됨.
  const { data: walletData } = useWallet();
  const { data: myCharacter } = useMemberCharacterAssignment();
  const { data: ranking } = useDivisionRanking();
  const attendance = useRecordAttendance();
  const { onboardingDone } = useOnboardingState();
  const { totalXp, metrics } = useLocalProgress();
  // 승급 진행도 — 홈 카드 막대의 단일 출처 (서버 계산). 대표님 결정(2026-09-22): 막대 = 승급 진행도.
  const { data: levelCycle } = useLevelCycleProgress();
  const { data: levelupRules } = useLevelupRules();
  // 오늘 출석 여부 — 서버(get_my_workout_today, KST·지점 무관)가 단일 출처. 예전엔 기기 자정·지점 필터로 따로 세어
  // WorkoutFinishCard 와 다른 답을 냈다 (검수 발견).
  const { data: workoutToday } = useMyWorkoutToday();
  const checkedInToday = !!workoutToday?.checked_in;
  // 지도진(profiles.is_staff)은 리그·레벨 대신 "이름 직함님" + 챔피언 · Lv.77 로 — 승급 막대도 없다 (2026-09-22, 09-23).
  const staffCard = isStaffProfile(profile) ? { title: staffTitleLabel(profile ?? {}) } : null;
  // 내 라이센스의 받은 하트 수 (MY복서 카드 아래 줄) — 지도진 카드는 하트·닉네임 바꾸기가 없다
  const { data: myLicense } = useMemberLicense(view === "myboxer" && !staffCard ? user?.id : null);
  const [likeListOpen, setLikeListOpen] = useState(false);
  const [nickEditOpen, setNickEditOpen] = useState(false);
  const activitySession = useActivitySession(user?.id, profile?.branch_name);
  const { resolveSlot: resolveDisplaySlot } = useDisplayMode();
  useLevelUpNotifications();
  useHofRewardsAutoClaim();

  // 오늘 도전 전체 화면 — 열린 세션(id·시작 시각)을 붙잡아 둔다. 끝내서 서버 세션이 사라져도 결과 화면은 남는다.
  const [challengeOpen, setChallengeOpen] = useState<{ id: string; startedAt: string } | null>(null);
  const openChallenge = useCallback((s: ActivitySession) => setChallengeOpen({ id: s.id, startedAt: s.started_at }), []);
  const [showCustomize, setShowCustomize] = useState(false);
  const { visibility: homeWidgets, order: homeWidgetOrder } = useHomeLayout();
  const [levelUpModal, setLevelUpModal] = useState<{
    show: boolean;
    level: number;
    rank: string;
    xp: number;
  }>({ show: false, level: 0, rank: "", xp: 0 });

  // ───── Data side-effects (unchanged behavior) ─────
  // (오늘 출석 여부는 위 useMyWorkoutToday 가 담당 — 기기 자정·지점 필터 로컬 조회는 2026-09-22 제거)

  useEffect(() => {
    if (!onboardingDone) navigate("/onboarding", { replace: true });
  }, [onboardingDone, navigate]);

  useEffect(() => {
    if (!progress) return;
    // 앱접속 출석(record_attendance)은 서버가 같은 날 중복을 무시하므로,
    // 성공한 날은 sessionStorage 로 표시해 홈 재진입마다 나가던
    // RPC + progress 재조회 체인을 차단한다 (실패 시엔 다음 진입에 재시도).
    const attKey = `153_att_${progress.user_id}_${new Date().toDateString()}`;
    if (sessionStorage.getItem(attKey)) return;
    attendance.mutate(undefined, {
      onSuccess: () => sessionStorage.setItem(attKey, "1"),
    });
  }, [progress?.user_id]); // eslint-disable-line

  // 진행 중인 도전이 처음 보이면(QR 출석 직후 등) 전체 화면으로 한 번 연다.
  // 같은 도전으로 홈에 돌아올 때마다 다시 띄우지는 않는다 — 그때는 '운동 중 · 이어하기' 카드로 연다.
  const activeSessionId = activitySession.activeSession?.id;
  useEffect(() => {
    const s = activitySession.activeSession;
    if (!s) return;
    const key = `153challenge:opened:${s.id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* 저장이 막혀도 이번 한 번은 연다 */
    }
    openChallenge(s);
  }, [activeSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 2026-10-01 대표님: "오늘 도전 시작이 안 눌러져" — 눌러도 도전 화면이 홈 맨 아래에 생겨 아무 일도 없는 것처럼 보였고,
  // 거기서 '오늘 도전 시작'을 한 번 더 눌러야 시계가 갔다. 이제 한 번 누르면 바로 전체 화면 시계가 뜬다 (원탭 시작).
  const handleStartChallenge = useCallback(async () => {
    if (!checkedInToday) {
      toast.error("출석(입구 얼굴 인식) 후 오늘 도전이 오픈됩니다");
      return;
    }
    const session = await activitySession.startChallenge();
    if (!session) {
      toast.error("오늘 도전을 시작하지 못했어요", { description: "인터넷 연결을 확인하고 다시 눌러 주세요." });
      return;
    }
    try {
      sessionStorage.setItem(`153challenge:opened:${session.id}`, "1");
    } catch {
      /* noop */
    }
    openChallenge(session);
  }, [activitySession, checkedInToday, openChallenge]);

  if (!profile || !progress) return <LoadingState />;

  const rank = progress.current_rank as Enums<"rank_name">;
  const currentLevel = levels?.find(
    (l) => l.rank_name === rank && l.level_number === progress.current_level,
  );
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
        : !challengeOpen && !sessionMet.current && !minuteMet.current
          ? "start_mission"
          : "evaluate";
  const handleTodayAction = () => {
    if (todayActionState === "qr_checkin") {
      // 출석은 입구 얼굴 인식으로 자동 기록된다. 브로제이가 느려 보드에 안 뜰 때는
      // 라이브보드 화면의 QR 을 앱에서 찍어 바로 올린다 (2026-09-22, /qr-checkin).
      navigate("/qr-checkin");
      // 64-P: 오삼 가이드 step 4 '자동 출석 확인하기' detector 트리거 (기존 이벤트명 유지)
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
      : challengeOpen || activitySession.isActive
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
  const displayName = staffCard ? staffDisplayName(profile) : (profile.nickname || profile.name);
  // 153 스토리 RPG: 미공개 — admin/super_admin 만 진입/표시 (회원 노출 차단).
  // 추가로 admin 도 본인 customize 토글로 끌 수 있음.
  const showStoryRpg = isAdmin && homeWidgets.storyRpg;

  // 오늘 도전 — 전체 화면 (body 로 portal: 홈 어느 보기에서 열어도 화면 기준으로 뜬다).
  // 열자마자 시계가 간다 (서버 도전 시작 시각부터). 닫아도 도전은 계속 — '운동 중 · 이어하기'로 다시 연다.
  const challengeFlow = challengeOpen
    ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="오늘 도전"
          className="fixed inset-0 z-[75] flex flex-col bg-background pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-base font-bold text-foreground">🥊 오늘 도전</h2>
            <button
              type="button"
              onClick={() => setChallengeOpen(null)}
              aria-label="닫기"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary active:scale-95"
            >
              <X className="h-5 w-5 text-secondary-foreground" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="mx-auto max-w-lg">
              <SelfChallengeFlow
                key={challengeOpen.id}
                league={rank}
                levelInLeague={progress.current_level}
                autoStart
                resumeStartedAt={challengeOpen.startedAt}
                onFinish={() => {
                  void activitySession.completeChallenge();
                }}
                onComplete={() => setChallengeOpen(null)}
                onLeave={async () => {
                  const ok = await activitySession.leaveChallenge();
                  if (ok) {
                    toast.success("라이브보드에서 퇴장했습니다");
                    setChallengeOpen(null);
                  } else {
                    toast.error("퇴장 처리 실패");
                  }
                }}
              />
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  // MY복서 머리글 — 뒤로(전체 메뉴) + 제목. 이름·지점은 바로 아래 라이센스 카드에 있다.
  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate("/home", { replace: true });
  };
  const myBoxerHeader = (
    <PageHeader
      title="MY복서"
      subtitle={profile.branch_name ? `${displayName} · ${profile.branch_name}` : displayName}
      leftAction={
        <button
          type="button"
          onClick={goBack}
          aria-label="뒤로"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary transition-transform active:scale-95"
        >
          <ChevronLeft className="h-5 w-5 text-secondary-foreground" />
        </button>
      }
      rightAction={
        <button
          onClick={() => navigate("/mypage")}
          className="flex h-9 w-9 items-center justify-center rounded-pill bg-secondary active:scale-95"
          aria-label="내 정보"
        >
          <User className="h-4 w-4 text-secondary-foreground" />
        </button>
      }
      sticky
    />
  );

  return (
    <AppPage
      header={
        view === "myboxer" ? myBoxerHeader : (
        <PageHeader
          title={displayName}
          titlePrefix={
            // 지도진은 리그 배지 대신 챔피언 표식 (2026-09-23 대표님 지시: 코치님은 모두 챔피언 · Lv.77)
            staffCard ? (
              <span
                className="inline-flex shrink-0 items-center rounded-md bg-yellow-500 px-1.5 py-0.5 text-[10px] font-black leading-none text-gray-900"
                aria-label={STAFF_CHAMPION_LINE}
              >
                챔피언 {STAFF_CHAMPION_LEVEL}
              </span>
            ) : (
            <RankBadge
              rank={rank}
              level={progress.current_level}
              size="inline"
              isMaster={isManagerRole(role)}
            />
            )
          }
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
                onClick={() => navigate("/membership-plans")}
                className="badge-pill bg-primary/15 text-primary active:scale-95"
                aria-label="153멤버십"
              >
                <Ticket className="h-3.5 w-3.5" />
                {/* 폭이 좁은 폰(390px 미만)에선 글자를 빼 닉네임 자리를 지킨다 — 머리글에 종이 늘어서 (2026-10-01) */}
                <span className="hidden min-[390px]:inline">멤버십</span>
              </button>
              {/* 알림 — 공지·출석·수업 소식 (2026-10-01) · 메시지(DM) — 인스타그램처럼 오른쪽 위 종이비행기 (2026-09-30) */}
              <NotificationBellButton />
              <DmHeaderButton />
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
        )
      }
    >
      {view === "menu" ? (
        // ─── 🗂 첫 화면 = 전체 메뉴만 (2026-09-29 대표님). 1번 'MY복서' 가 예전 홈 화면.
        //     하단 '전체' 탭 시트와 같은 목록·같은 버튼 (lib/appMenu.ts).
        <div className="space-y-5">
          {/* 오늘 도전 중이면 맨 위에 '운동 중 · 이어하기' — 누르면 도전 화면(시계)이 다시 열린다 */}
          {activitySession.isActive && !challengeOpen && (
            <TodayActionCard
              state="active_session"
              activeMinutes={activeMinutes}
              streakDays={progress.streak_days}
              onClick={handleStartChallenge}
            />
          )}
          {/* 기능 검색 — "타이틀매치" 처럼 치면 영상·기능이 바로 (2026-10-01) */}
          <AppSearchButton />
          <HomeMenuGrid />
        </div>
      ) : (
      <div className="space-y-5">
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
                  name={staffCard ? staffDisplayName(profile) : (profile.nickname || profile.name || "복서")}
                  staff={staffCard}
                  pt={!staffCard && isPtMember(profile)}
                  likes={staffCard ? undefined : (myLicense?.likes ?? 0)}
                  onLikeClick={staffCard ? undefined : () => setLikeListOpen(true)}
                  onCardClick={staffCard ? undefined : () => setNickEditOpen(true)}
                  branch={profile.branch_name}
                  league={rank}
                  level={onMasterTrack ? progress.overall_level : progress.current_level}
                  userId={user?.id}
                  issueDate={(profile as { created_at?: string }).created_at}
                  streakDays={progress.streak_days}
                  totalXp={totalXp}
                  xpToNext={Math.max(metrics.xp.target, totalXp || 1)}
                  promotion={
                    staffCard
                      ? undefined
                      : levelCycle
                        ? {
                            // 요건을 넘긴 값(승인 대기·다음 출석 때 승급)은 막대를 넘치지 않게 목표에서 자른다
                            current: Math.min(Number(levelCycle.progress ?? 0), Number(levelCycle.reqSessions ?? 0)),
                            target: Number(levelCycle.reqSessions ?? 0),
                            hint: promotionHint(levelCycle, authorityLabel(levelupRules, levelCycle.rank, levelCycle.currentLevel)),
                          }
                        // 서버 값이 오기 전엔 막대를 비워 둔다 — 옛 "XP / 300" 막대가 잠깐 그려졌다 바뀌는 깜빡임 방지
                        : { current: 0, target: 0 }
                  }
                  isMaster={isMaster40}
                  masterTitle={masterDef?.title}
                />
              );
            },
            todayAction: () =>
              homeWidgets.todayAction ? (
                <div className="space-y-2">
                  <TodayActionCard
                    state={todayActionState}
                    activeMinutes={activeMinutes}
                    streakDays={progress.streak_days}
                    onClick={handleTodayAction}
                  />
                  {/* 오늘 출석이 없으면 스스로 렌더하지 않는다. 위젯 on/off 대상에서
                      빼둔 이유 — 끄는 걸 잊어 종료를 못 누르는 일이 없어야 한다. */}
                  <WorkoutFinishCard />
                  {/* 마일리지 — 출석 · 레벨업 · 타이틀매치 승급 때 서버가 적립. 지도진·관리자는 적립 대상이 아니라 안 그린다. */}
                  {!staffCard && !isAdmin && <MileageCard />}
                </div>
              ) : null,
            osamiNote: () => (homeWidgets.osamiNote ? <OsamiHomeNote /> : null),
            rankingPreview: () =>
              homeWidgets.rankingPreview ? (
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-[17px] font-black">이번 주 내 순위</h2>
                    <button
                      onClick={() => navigate("/halloffame")}
                      className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary active:scale-95"
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
                      meta={staffCard ? staffChampionLine(profile) : `${RANK_LABELS[rank]} · Lv.${progress.current_level}`}
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
                      ctaText={checkedInToday ? (activitySession.isActive ? "🥊 오늘 도전 이어하기" : "🥊 오늘 도전 시작") : "QR 로 출석하기"}
                      onCtaClick={() => {
                        if (checkedInToday) handleStartChallenge();
                        else navigate("/qr-checkin");
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
                <h2 className="text-[17px] font-black">이번 주 진행도</h2>
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
      )}

      {/* MY복서 카드: 하트 → 추천 복서 목록 · 카드 → 닉네임 바꾸기 */}
      <NicknameLikeSheet open={likeListOpen} onClose={() => setLikeListOpen(false)} />
      <NicknameEditSheet open={nickEditOpen} onClose={() => setNickEditOpen(false)} />

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

      {/* 오늘 도전 — 전체 화면 (홈 어느 보기에서든) */}
      {challengeFlow}

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
