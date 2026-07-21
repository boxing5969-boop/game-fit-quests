import { useState, useEffect } from "react";
import { whiteLevels, WhiteLevelDetail } from "@/data/whiteLevelData";
import LevelUpRequestCard from "@/components/LevelUpRequestCard";
import {
  WHITE_LV1_META, WHITE_LV1_SESSION, WHITE_LV1_CHECKLIST,
  WHITE_LV1_PURPOSE, WHITE_LV1_VALUE, XP_RULES,
  PROMOTION_METRICS, RECOMMENDED_PATHS, BEGINNER_ALTERNATIVES,
  COACH_POINTS, WHITE_LV1_LEARNING,
  type SessionBlock, type ChecklistItem,
} from "@/data/whiteLevel1Data";
import {
  WHITE_LV2_META, WHITE_LV2_SESSION, WHITE_LV2_CHECKLIST,
  WHITE_LV2_PURPOSE, WHITE_LV2_VALUE, WHITE_LV2_XP_RULES,
  WHITE_LV2_PROMOTION_METRICS, WHITE_LV2_RECOMMENDED_PATHS,
  WHITE_LV2_BEGINNER_ALTS, WHITE_LV2_COACH_POINTS,
  WHITE_LV2_LEARNING,
} from "@/data/whiteLevel2Data";
import { ALL_LEVELS, getLevelById, type UnifiedLevel } from "@/data/allLevelsData";
import { getCurriculumReview } from "@/data/curriculumReviewCriteria";
import { levelHeroImage, levelDetailImages } from "@/data/curriculumImages";
import { useComposedSession, usePriorityDrills, type TrainingExercise } from "@/hooks/useTrainingLibrary";
import TrainingDrillSheet from "@/components/TrainingDrillSheet";
import { getChecklistForLevel } from "@/data/levelRuleEngine";
import { useLocalProgress } from "@/hooks/useLocalProgress";
import { useTutorialState } from "@/hooks/useTutorialState";
import SessionRunner from "@/components/SessionRunner";
import SessionTemplateEditor from "@/components/SessionTemplateEditor";
import { useSessionTemplate } from "@/hooks/useSessionTemplate";
import {
  CheckCircle2, Lock, ChevronRight, ChevronDown, Clock, Zap, Target,
  ArrowLeft, Star, Shield, Info, Dumbbell, Eye, Award, Play, Pencil,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMemberCharacterAssignment } from "@/hooks/useCharacterData";
import CharacterSprite from "@/components/CharacterSprite";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import SparringConsentModal from "@/components/SparringConsentModal";

type LevelState = "complete" | "active" | "locked";
type DetailView = null | { league: string; level: number };

const INTENSITY_STYLE: Record<string, string> = {
  "가볍게": "bg-status-complete/10 text-status-complete",
  "보통": "bg-primary/10 text-primary",
  "조금 힘듦": "bg-status-pending/10 text-status-pending",
};

const LEAGUE_CONFIG = [
  { id: "white", label: "화이트 리그", emoji: "⚪", levels: 10 },
  { id: "blue", label: "블루 리그", emoji: "🔵", levels: 10 },
  { id: "red", label: "레드 리그", emoji: "🔴", levels: 10 },
  { id: "black", label: "블랙 리그", emoji: "⚫", levels: 10 },
];

const WhiteLeagueTab = () => {
  const { progress } = useAuth();
  const [detailView, setDetailView] = useState<DetailView>(null);
  const [expandedLeague, setExpandedLeague] = useState<string | null>(null);
  // 64-N: 오삼 가이드 step 3 (훈련 미션 둘러보기) 진행 중 — Lv.1 카드 강조
  const tutorial = useTutorialState();
  const isTutorialStep3 =
    tutorial.isEligible && tutorial.currentStep?.key === "first_mission";

  const currentRank = progress?.current_rank || "white";
  const currentLevel = progress?.current_level || 1;
  const RANK_ORDER = ["white", "blue", "red", "black"];
  const currentGlobal = RANK_ORDER.indexOf(currentRank) * 10 + currentLevel;

  const getGlobalLevel = (league: string, level: number) => RANK_ORDER.indexOf(league) * 10 + level;

  const getLevelState = (league: string, level: number): LevelState => {
    const g = getGlobalLevel(league, level);
    if (g < currentGlobal) return "complete";
    if (g === currentGlobal) return "active";
    return "locked";
  };

  // Auto-expand current league
  const activeLeague = expandedLeague ?? currentRank;

  if (detailView) {
    return <UnifiedLevelDetailView league={detailView.league} levelNum={detailView.level} onBack={() => setDetailView(null)} />;
  }

  return (
    <div className="space-y-4">
      {/* League accordions */}
      {LEAGUE_CONFIG.map(lc => {
        const isExpanded = activeLeague === lc.id;
        const leagueLevels = ALL_LEVELS.filter(l => l.league === lc.id);
        const completedInLeague = leagueLevels.filter(l => getLevelState(lc.id, l.levelInLeague) === "complete").length;

        return (
          <div
            key={lc.id}
            data-tour={lc.id === "white" ? "white-league-accordion" : undefined}
            className="rounded-2xl border border-border bg-card shadow-elev-1 overflow-hidden"
          >
            <button
              onClick={() => setExpandedLeague(isExpanded && expandedLeague !== null ? null : lc.id)}
              className="flex w-full items-center justify-between p-4 text-left active:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{lc.emoji}</span>
                <div>
                  <p className="text-sm font-bold text-foreground">{lc.label}</p>
                  <p className="text-[10px] text-muted-foreground">{completedInLeague}/{lc.levels} 완료</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(completedInLeague / lc.levels) * 100}%` }} />
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-border px-3 pb-3 space-y-2">
                {leagueLevels.map((ul, idx) => {
                  const state = getLevelState(lc.id, ul.levelInLeague);
                  const isLocked = state === "locked";
                  const isBoss = ul.levelInLeague === 10;

                  // 64-N: 오삼 가이드 step 3 일 때 화이트 Lv.1 카드만 amber pulse + '👆 클릭' badge
                  const isTutorialTargetCard =
                    isTutorialStep3 &&
                    lc.id === "white" &&
                    ul.levelInLeague === 1 &&
                    !isLocked;
                  return (
                    <button
                      key={ul.globalLevel}
                      data-tour={
                        lc.id === "white" && ul.levelInLeague === 1
                          ? "white-level-1-card"
                          : undefined
                      }
                      onClick={() => !isLocked && setDetailView({ league: lc.id, level: ul.levelInLeague })}
                      disabled={isLocked}
                      className={`group relative w-full rounded-xl border p-3 text-left transition-all active:scale-[0.98] ${
                        state === "complete" ? "border-primary/20 bg-card"
                        : state === "active" ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                        : "border-border bg-muted/30 opacity-50"
                      } ${
                        isTutorialTargetCard
                          ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-card animate-pulse"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                          state === "complete" ? "bg-primary/10 text-primary"
                          : state === "active" ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                        }`}>
                          {state === "complete" ? <CheckCircle2 className="h-4 w-4" />
                            : state === "locked" ? <Lock className="h-3.5 w-3.5" />
                            : ul.levelInLeague}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-muted-foreground">Lv.{ul.globalLevel}</span>
                            {isBoss && <span className="rounded-full bg-reward px-1.5 py-0.5 text-[8px] font-bold text-reward-foreground">리그 승격</span>}
                          </div>
                          <p className={`text-xs font-bold leading-tight ${isLocked ? "text-muted-foreground" : "text-foreground"}`}>
                            {ul.title}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground">50분</span>
                          <span className="text-[10px] font-bold text-primary">+100XP</span>
                        </div>
                        {!isLocked && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                      </div>
                      {isTutorialTargetCard && (
                        <span className="absolute -top-2 right-3 rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-black text-amber-950 shadow-md">
                          👆 클릭
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   Unified Level Detail View — 40레벨 3탭 구조
   배우기 / 수업실행 / 심사
   ═══════════════════════════════════════════════════════ */
const UnifiedLevelDetailView = ({ league, levelNum, onBack }: { league: string; levelNum: number; onBack: () => void }) => {
  const ul = getLevelById(league, levelNum);
  const { user, progress, role, profile } = useAuth();
  const { data: myCharacter } = useMemberCharacterAssignment(user?.id);
  const { metrics, status, canAttemptChecklist, submitChecklist } = useLocalProgress();
  const [activeSection, setActiveSection] = useState<"learn" | "session" | "check">("learn");
  const [showChecklist, setShowChecklist] = useState(false);
  const [showCurriculumReview, setShowCurriculumReview] = useState(false);
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);
  const [showSession, setShowSession] = useState(false);
  const checklist = getChecklistForLevel(`${league}-${levelNum}`);
  const [checkResults, setCheckResults] = useState<boolean[]>(checklist.map(() => false));

  // 64-O: 오삼 가이드 step 3 cascade — 배우기 → 수업실행 → 심사 탭 순차 click
  //   화이트 Lv.1 detail 일 때만 활성. 첫 진입 시 'learn' 은 default 라 자동 등록.
  const tutorial = useTutorialState();
  const isStep3DetailCascade =
    tutorial.isEligible &&
    tutorial.currentStep?.key === "first_mission" &&
    league === "white" &&
    levelNum === 1;
  const [clickedSections, setClickedSections] = useState<
    Set<"learn" | "session" | "check">
  >(() => new Set(["learn"]));
  const nextUnclickedSection = isStep3DetailCascade
    ? (["learn", "session", "check"] as const).find(
        (k) => !clickedSections.has(k),
      ) ?? null
    : null;

  // 50분 수업 구성 — DB(session_templates) 우선, 없으면 하드코딩 폴백. 마스터만 편집.
  const sessionLevelKey =
    league === "white" && levelNum === 1 ? "white-1" : league === "white" && levelNum === 2 ? "white-2" : null;
  const sessionFallback =
    sessionLevelKey === "white-1" ? WHITE_LV1_SESSION : sessionLevelKey === "white-2" ? WHITE_LV2_SESSION : null;
  const { blocks: sessionBlocks, refetch: refetchSession } = useSessionTemplate(sessionLevelKey, sessionFallback);
  const isMaster = role === "admin" || role === "super_admin";
  const [showSessionEditor, setShowSessionEditor] = useState(false);

  // 🥊 스파링 신청 — 접촉 레벨(Lv.26+) 전용. 본인 최신 동의서 조회.
  const [showSparring, setShowSparring] = useState(false);
  const [sparringConsent, setSparringConsent] = useState<{ id: string; status: string } | null>(null);
  useEffect(() => {
    const gl = ul?.globalLevel ?? 0;
    if (!user || gl < 26) return;
    let active = true;
    supabase
      .from("sparring_consents")
      .select("id,status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setSparringConsent(data ? { id: data.id, status: data.status } : null);
      });
    return () => {
      active = false;
    };
  }, [user?.id, ul?.globalLevel]);

  // 📷 교육 다이어그램 갤러리 — 하단 썸네일을 누르면 큰 사진과 자리를 바꾼다.
  // imgOrder[0]=큰 사진 인덱스, [1..3]=썸네일. 레벨이 바뀌면 원래 순서로 리셋.
  const [imgOrder, setImgOrder] = useState([0, 1, 2, 3]);
  const [brokenImgs, setBrokenImgs] = useState<number[]>([]);
  useEffect(() => {
    setImgOrder([0, 1, 2, 3]);
    setBrokenImgs([]);
  }, [ul?.globalLevel]);

  // 🎯 AI 수업 구성(워밍업·체력 블록 매일 로테이션) + 레벨업 필수 훈련
  const composedBlocks = useComposedSession(sessionBlocks, ul?.globalLevel ?? 1);
  const priorityDrills = usePriorityDrills(ul?.globalLevel ?? 1);
  const [drillSheet, setDrillSheet] = useState<TrainingExercise | null>(null);
  // 배우기 탭 보조 섹션 접기 — 기본은 접힘(회원은 필수훈련·그림·학습모듈만 보면 됨)
  const [openLearnMore, setOpenLearnMore] = useState(false);

  if (!ul) return <div className="p-4 text-center text-muted-foreground">레벨 데이터를 불러올 수 없습니다</div>;

  // Use whiteLevel1/2 detailed session data if available, else use routineA
  const isWhiteLv1 = league === "white" && levelNum === 1;
  const isWhiteLv2 = league === "white" && levelNum === 2;
  const xpRules = isWhiteLv1 ? XP_RULES : isWhiteLv2 ? WHITE_LV2_XP_RULES : null;
  const learning = isWhiteLv1 ? WHITE_LV1_LEARNING : isWhiteLv2 ? WHITE_LV2_LEARNING : null;
  const purpose = isWhiteLv1 ? WHITE_LV1_PURPOSE : isWhiteLv2 ? WHITE_LV2_PURPOSE : null;
  const value = isWhiteLv1 ? WHITE_LV1_VALUE : isWhiteLv2 ? WHITE_LV2_VALUE : null;
  const coachPoints = isWhiteLv1 ? COACH_POINTS : isWhiteLv2 ? WHITE_LV2_COACH_POINTS : null;
  const beginnerAlts = isWhiteLv1 ? BEGINNER_ALTERNATIVES : isWhiteLv2 ? WHITE_LV2_BEGINNER_ALTS : null;
  const recPaths = isWhiteLv1 ? RECOMMENDED_PATHS : isWhiteLv2 ? WHITE_LV2_RECOMMENDED_PATHS : null;

  const handleChecklistSubmit = () => {
    const passed = submitChecklist(checkResults);
    if (passed) {
      toast.success(`🎉 체크테스트 통과!`);
    } else {
      toast("보완 포인트를 확인하고 다시 도전하세요");
    }
    setShowChecklist(false);
  };

  if (showSession && sessionBlocks) {
    return (
      <div className="animate-slide-up space-y-4">
        <button onClick={() => setShowSession(false)} className="flex items-center gap-1.5 text-sm font-bold text-primary active:scale-95">
          <ArrowLeft className="h-4 w-4" /> 돌아가기
        </button>
        <SessionRunner blocks={composedBlocks ?? sessionBlocks} levelLabel={`${league.charAt(0).toUpperCase()}${league.slice(1)} Lv.${levelNum}`} onComplete={() => setShowSession(false)} />
      </div>
    );
  }

  return (
    <div className="animate-slide-up space-y-4">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-bold text-primary active:scale-95">
        <ArrowLeft className="h-4 w-4" /> 목록으로
      </button>

      {/* Hero Card — 내 캐릭터 + 전설 등급 황금 글로우 배경.
          CharacterStudio 의 HoF 카드와 동일한 amber 테두리·다중 레이어 그림자·breathe 애니메이션. */}
      <div
        data-tour="white-detail-hero"
        className="relative h-48 overflow-visible rounded-2xl border-[2px] border-amber-400 animate-[breathe_2s_ease-in-out_infinite]"
        style={{
          // 황금 깊이감 그라디언트: yellow-900/40 → amber-800/30 → yellow-900/40
          background:
            "linear-gradient(to bottom, hsla(50, 92%, 13%, 0.55) 0%, hsla(35, 80%, 20%, 0.50) 50%, hsla(50, 92%, 13%, 0.55) 100%)",
          // 2중 황금 glow — 안쪽은 강하게, 바깥은 넓게 퍼지게. 전설 카드 톤 유지.
          boxShadow:
            "0 0 24px 8px rgba(251, 191, 36, 0.55), 0 0 54px 18px rgba(234, 179, 8, 0.28)",
        }}
      >
        {/* overflow-hidden 은 내부 래퍼에서 — 바깥 glow 살아남게 */}
        <div className="relative h-full w-full overflow-hidden rounded-[14px]">
          {/* 중앙 민트 hotspot (기존 radial 유지, 황금 톤 위에 은은히 블렌드) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 50% 40%, hsl(var(--primary) / 0.22) 0%, transparent 60%)",
            }}
          />

          {/* 스파클 파티클 — 황금 톤에 맞춰 3개 */}
          <span aria-hidden className="pointer-events-none absolute left-4 top-5 text-lg opacity-70 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]">✨</span>
          <span aria-hidden className="pointer-events-none absolute right-6 top-8 text-base opacity-60 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]">⭐</span>
          <span aria-hidden className="pointer-events-none absolute left-8 bottom-16 text-sm opacity-55 drop-shadow-[0_0_5px_rgba(251,191,36,0.7)]">✨</span>
          <span aria-hidden className="pointer-events-none absolute right-4 bottom-20 text-[10px] opacity-50 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]">⭐</span>

          {/* 캐릭터 — 중앙. 황금 drop-shadow 로 묶음. */}
          <div className="absolute inset-0 flex items-center justify-center pt-2">
            {myCharacter?.character_presets ? (
              <div className="drop-shadow-[0_4px_16px_rgba(251,191,36,0.45)]">
                <CharacterSprite
                  style={(myCharacter.character_presets.parts_json as Record<string, unknown>)?.style as string | undefined}
                  userId={user?.id}
                  partsJson={myCharacter.character_presets.parts_json as Record<string, unknown>}
                  size="lg"
                  animate
                  league={progress?.current_rank}
                  level={progress?.current_level}
                  auraMode="compact"
                />
              </div>
            ) : (
              <span className="text-6xl drop-shadow-[0_4px_14px_rgba(251,191,36,0.6)]">🥊</span>
            )}
          </div>

          {/* 하단 어둠 오버레이 — 텍스트 가독성 */}
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/75 via-transparent to-transparent" />

          {/* 레벨 라벨 + 제목 — 뱃지 톤을 황금으로 */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <span className="mb-1 inline-block rounded-full bg-gradient-to-r from-yellow-500 to-amber-500 px-2.5 py-0.5 text-[10px] font-black text-black backdrop-blur-sm">
              Lv.{ul.globalLevel}
            </span>
            <h2 className="text-xl font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">{ul.title}</h2>
            <p className="text-xs text-white/85 drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]">{ul.shortGoal}</p>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div data-tour="white-detail-stats" className="flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card p-3">
          <Clock className="h-4 w-4 text-primary" />
          <div>
            <p className="text-[10px] text-muted-foreground">소요 시간</p>
            <p className="text-sm font-bold text-foreground">50분</p>
          </div>
        </div>
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card p-3">
          <Zap className="h-4 w-4 text-primary" />
          <div>
            <p className="text-[10px] text-muted-foreground">보상</p>
            <p className="text-sm font-bold text-primary">+100 XP</p>
          </div>
        </div>
      </div>

      {/* 64-O: step 3 detail cascade 안내 카드 */}
      {isStep3DetailCascade && (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-400/40 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          <span className="text-base">👆</span>
          <span className="flex-1">
            세 개 탭(배우기 / 수업실행 / 심사)을 한 번씩 눌러 둘러보세요.
            클릭 <span className="number-font">{clickedSections.size}</span> /{" "}
            <span className="number-font">3</span>
          </span>
        </div>
      )}

      {/* Section tabs — 3탭 구조 */}
      <div className="flex gap-1 rounded-2xl bg-secondary p-1" data-tour="white-league-tabs">
        {([
          { key: "learn" as const, label: "📖 배우기" },
          { key: "session" as const, label: "🥊 수업실행" },
          { key: "check" as const, label: "✅ 심사" },
        ]).map(tab => {
          const isNextHint = nextUnclickedSection === tab.key;
          const isClicked = clickedSections.has(tab.key);
          return (
            <button
              key={tab.key}
              data-tour={`white-league-tab-${tab.key}`}
              onClick={() => {
                setActiveSection(tab.key);
                if (isStep3DetailCascade) {
                  setClickedSections((prev) => {
                    if (prev.has(tab.key)) return prev;
                    const next = new Set(prev);
                    next.add(tab.key);
                    return next;
                  });
                }
              }}
              className={`relative flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
                activeSection === tab.key ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground"
              } ${
                isNextHint
                  ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-secondary animate-pulse"
                  : ""
              }`}
            >
              {tab.label}
              {isNextHint && (
                <span className="absolute -top-1 -right-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[8px] font-black text-amber-950 shadow-md">
                  👆 클릭
                </span>
              )}
              {isStep3DetailCascade && isClicked && tab.key !== "learn" && (
                <span className="absolute -top-1 -right-1 text-emerald-500">
                  <CheckCircle2 className="h-3 w-3 fill-emerald-500/20" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ═══ 배우기 Section ═══ */}
      {activeSection === "learn" && (
        <>
      {/* 🎯 레벨업 필수 훈련 — 심사에 나오는 핵심 동작만 모아보기. 탭하면 그림 설명.
          50분 수업의 워밍업·체력 블록은 useComposedSession 이 매일 로테이션한다. */}
      {priorityDrills.length > 0 && (
        <section className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-black text-foreground">🎯 레벨업 필수 훈련</h3>
            <span className="text-[10px] font-bold text-primary">탭하면 그림 설명</span>
          </div>
          <p className="mb-2.5 text-[11px] text-muted-foreground">
            이번 레벨 심사에 나오는 핵심 동작이에요 · 50분 수업의 워밍업·체력 블록은 매일 새롭게 바뀝니다 ✨
          </p>
          <div className="grid grid-cols-2 gap-2">
            {priorityDrills.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDrillSheet(d)}
                className="rounded-xl border border-border bg-card p-3 text-left transition-all active:scale-[0.97]"
              >
                <p className="text-xs font-black text-foreground">{d.name}</p>
                <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">{d.summary}</p>
                <span className="mt-1 inline-block rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                  {d.category} · L{d.level_min}+
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
      <TrainingDrillSheet exercise={drillSheet} onClose={() => setDrillSheet(null)} />

      {/* 레벨 교육 다이어그램 — public/assets/curriculum/L{n}.png(히어로) + L{n}-A/B/C.png(세부).
          하단 썸네일을 탭하면 큰 사진과 자리를 바꿔 크게 볼 수 있다.
          파일이 아직 없으면 해당 칸만 숨김(무해). */}
      {(() => {
        const gallery = [levelHeroImage(ul.globalLevel), ...levelDetailImages(ul.globalLevel)];
        const mainIdx = imgOrder[0];
        const markBroken = (idx: number) =>
          setBrokenImgs((prev) => (prev.includes(idx) ? prev : [...prev, idx]));
        return (
          <div className="space-y-2">
            {!brokenImgs.includes(mainIdx) && (
              <img
                src={gallery[mainIdx]}
                alt={`${ul.title} 교육 다이어그램`}
                loading="lazy"
                onError={() => markBroken(mainIdx)}
                className="w-full rounded-2xl border border-border bg-card shadow-elev-1"
              />
            )}
            <div className="grid grid-cols-3 gap-2">
              {imgOrder.slice(1).map((idx, i) =>
                brokenImgs.includes(idx) ? null : (
                  <button
                    key={idx}
                    type="button"
                    onClick={() =>
                      setImgOrder((prev) => {
                        const next = [...prev];
                        const pos = i + 1;
                        [next[0], next[pos]] = [next[pos], next[0]];
                        return next;
                      })
                    }
                    aria-label={`교육 이미지 ${i + 1} 크게 보기`}
                    className="overflow-hidden rounded-xl border border-border bg-card transition-transform active:scale-95"
                  >
                    <img
                      src={gallery[idx]}
                      alt={`${ul.title} 세부 ${i + 1}`}
                      loading="lazy"
                      onError={() => markBroken(idx)}
                      className="w-full"
                    />
                  </button>
                ),
              )}
            </div>
          </div>
        );
      })()}

          {/* Learning modules from unified data */}
          <div
            data-tour="white-learn-modules"
            className="rounded-2xl border border-border bg-card p-4 shadow-elev-1"
          >
            <div className="mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-foreground">학습 모듈</span>
            </div>
            <div className="space-y-3">
              {(learning || ul.learningModules).map((mod, i) => (
                <div key={i} className="rounded-xl border border-border p-3">
                  <p className="mb-1 text-xs font-bold text-foreground">{mod.title}</p>
                  <div className="space-y-0.5">
                    {mod.keyPoints.map((kp, j) => (
                      <p key={j} className="text-[10px] text-muted-foreground">· {kp}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 더 알아보기 — 목적·초보자 대체·코치 포인트를 접어 첫 화면을 짧게 유지 */}
          <div className="rounded-2xl border border-border bg-card shadow-elev-1">
            <button
              type="button"
              onClick={() => setOpenLearnMore((v) => !v)}
              className="flex w-full items-center justify-between p-4"
            >
              <span className="text-sm font-bold text-foreground">📚 더 알아보기</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openLearnMore ? "rotate-180" : ""}`} />
            </button>
            {openLearnMore && (
              <div className="space-y-3 px-4 pb-4">
          {/* Purpose */}
          <div
            data-tour="white-learn-purpose"
            className="rounded-2xl border border-border bg-card p-4 shadow-elev-1"
          >
            <div className="mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-foreground">오늘의 목적</span>
            </div>
            <div className="space-y-2">
              {(purpose || [ul.shortGoal]).map((p, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{i + 1}</div>
                  <p className="text-sm text-foreground">{p}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Beginner alts (if available) */}
          {beginnerAlts && beginnerAlts.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-elev-1">
              <div className="mb-3 flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-foreground">초보자 대체 동작</span>
              </div>
              <div className="space-y-2">
                {beginnerAlts.map((alt, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg bg-muted/30 p-2.5">
                    <span className="text-xs font-bold text-primary">{alt.original}</span>
                    <span className="text-xs text-muted-foreground">→</span>
                    <div>
                      <p className="text-xs font-bold text-foreground">{alt.alt}</p>
                      <p className="text-[10px] text-muted-foreground">{alt.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coach Points */}
          {(coachPoints || ul.coachTags.length > 0) && (
            <div
              data-tour="white-learn-coach"
              className="rounded-2xl border border-reward/20 bg-reward/5 p-4"
            >
              <div className="mb-3 flex items-center gap-2">
                <Eye className="h-4 w-4 text-reward-foreground" />
                <span className="text-sm font-bold text-reward-foreground">코치 포인트</span>
              </div>
              <div className="space-y-1.5">
                {(coachPoints || ul.coachTags).map((point, i) => <p key={i} className="text-xs text-foreground">👁️ {point}</p>)}
              </div>
            </div>
          )}
              </div>
            )}
          </div>

        </>
      )}

      {/* ═══ 수업 실행 Section ═══ */}
      {activeSection === "session" && (
        <>
          {showSessionEditor && sessionLevelKey && (
            <SessionTemplateEditor
              levelKey={sessionLevelKey}
              levelLabel={`${league.charAt(0).toUpperCase()}${league.slice(1)} Lv.${levelNum}`}
              initialBlocks={sessionBlocks ?? []}
              onClose={() => setShowSessionEditor(false)}
              onSaved={() => {
                refetchSession();
                setShowSessionEditor(false);
              }}
            />
          )}
          {/* Routine blocks from unified data */}
          <div
            data-tour="white-session-blocks"
            className="rounded-2xl border border-border bg-card p-4 shadow-elev-1"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-foreground">50분 수업 구성</span>
              </div>
              <div className="flex items-center gap-1.5">
                {isMaster && sessionLevelKey && (
                  <button
                    onClick={() => setShowSessionEditor(true)}
                    className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground transition-all active:scale-95"
                  >
                    <Pencil className="h-3 w-3" /> 편집
                  </button>
                )}
                {sessionBlocks && (
                  <button
                    data-tour="white-session-start"
                    onClick={() => setShowSession(true)}
                    className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-all active:scale-95"
                  >
                    <Play className="h-3 w-3" /> 수업 시작
                  </button>
                )}
              </div>
            </div>

            {/* Show detailed session blocks if available, otherwise show routine blocks */}
            {sessionBlocks ? (
              <div className="space-y-2">
                {sessionBlocks.map(block => {
                  const isExpanded = expandedBlock === block.id;
                  return (
                    <div key={block.id} className="overflow-hidden rounded-xl border border-border">
                      <button
                        onClick={() => setExpandedBlock(isExpanded ? null : block.id)}
                        className="flex w-full items-center gap-3 p-3 text-left transition-all active:bg-muted/50"
                      >
                        <span className="text-lg">{block.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-muted-foreground">{block.timeRange}</span>
                            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${INTENSITY_STYLE[block.intensity]}`}>
                              {block.intensity}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-foreground">{block.title}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{block.durationMin}분</span>
                        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </button>
                      {isExpanded && (
                        <div className="border-t border-border bg-muted/20 px-3 pb-3 pt-2">
                          <p className="mb-2 text-xs text-muted-foreground">{block.description}</p>
                          <div className="space-y-1">
                            {block.drills.map((drill, di) => (
                              <div key={di} className="flex items-start gap-2">
                                <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40" />
                                <p className="text-xs text-foreground">
                                  {drill.name}{drill.detail ? <span className="text-muted-foreground"> · {drill.detail}</span> : ""}
                                </p>
                              </div>
                            ))}
                          </div>
                          {block.beginnerAlt && (
                            <div className="mt-2 rounded-lg bg-primary/5 px-2.5 py-1.5">
                              <p className="text-[10px] text-primary">💡 초보자: {block.beginnerAlt}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-2">루틴 A</p>
                {ul.routineA.map((block, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-muted/30 p-2.5">
                    <span className="text-lg">{block.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground">{block.title}</p>
                      <p className="text-[10px] text-muted-foreground">{block.durationMin}분 · {block.drills.slice(0, 2).join(", ")}</p>
                    </div>
                  </div>
                ))}
                {ul.routineB.length > 0 && (
                  <>
                    <p className="text-xs text-muted-foreground mt-3 mb-2">루틴 B</p>
                    {ul.routineB.map((block, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-xl bg-muted/30 p-2.5">
                        <span className="text-lg">{block.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground">{block.title}</p>
                          <p className="text-[10px] text-muted-foreground">{block.durationMin}분 · {block.drills.slice(0, 2).join(", ")}</p>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* XP rules (if available) */}
          {xpRules && (
            <div
              data-tour="white-session-xp"
              className="rounded-2xl border border-border bg-card p-4 shadow-elev-1"
            >
              <div className="mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-foreground">XP 규칙</span>
              </div>
              <div className="space-y-1.5">
                {xpRules.map(rule => (
                  <div key={rule.label} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                    <div>
                      <p className="text-xs font-bold text-foreground">{rule.label}</p>
                      {rule.note && <p className="text-[10px] text-muted-foreground">{rule.note}</p>}
                    </div>
                    <span className={`text-sm font-bold ${rule.xp > 0 ? "text-primary" : "text-muted-foreground"}`}>
                      {rule.xp > 0 ? `+${rule.xp}` : "0"} XP
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ 심사 Section ═══ */}
      {activeSection === "check" && (
        <>
          {/* 서버 3·3·3 집계 + 레벨업 신청 (실제 레벨업 경로) */}
          <LevelUpRequestCard />
          {/* 레벨업 조건 */}
          <div
            data-tour="white-check-conditions"
            className="rounded-2xl border border-border bg-card p-4 shadow-elev-1"
          >
            <div className="mb-3 flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-foreground">
                {ul.levelInLeague === 10 ? "리그 승격 심사" : `레벨업 조건 (Lv.${ul.globalLevel} → Lv.${ul.globalLevel + 1})`}
              </span>
            </div>
            <div className="space-y-2">
              {[
                { emoji: "⚡", label: "XP", met: metrics.xp },
                { emoji: "🥊", label: "인정 세션", met: metrics.sessions },
                { emoji: "📅", label: "인정 출석일", met: metrics.days },
                { emoji: "⏱️", label: "훈련 시간", met: metrics.minutes },
              ].map(m => {
                const done = m.met && m.met.current >= m.met.target;
                return (
                  <div key={m.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{m.emoji}</span>
                      <span className="text-xs text-foreground">{m.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${done ? "text-status-complete" : "text-muted-foreground"}`}>
                        {m.met?.current ?? 0}/{m.met?.target ?? 0}
                      </span>
                      {done && <CheckCircle2 className="h-3.5 w-3.5 text-status-complete" />}
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">✅</span>
                  <span className="text-xs text-foreground">체크테스트 통과</span>
                </div>
                <span className="text-xs font-bold text-muted-foreground">{checklist.length}개 중 {ul.progressionConfig.checklistPassCount}개 이상</span>
              </div>
            </div>
            {recPaths && (
              <div className="mt-3 flex gap-2">
                {recPaths.map(path => (
                  <div key={path.label} className="flex-1 rounded-xl bg-muted/30 p-2.5 text-center">
                    <p className="text-[10px] font-bold text-muted-foreground">{path.label}</p>
                    <p className="text-xs font-bold text-foreground">{path.frequency}</p>
                    <p className="text-[10px] text-muted-foreground">{path.duration} · {path.sessions}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checklist */}
          <div
            data-tour="white-check-checklist"
            className="rounded-2xl border border-border bg-card p-4 shadow-elev-1"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-foreground">체크테스트</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{checklist.length}개 중 {ul.progressionConfig.checklistPassCount}개 이상 통과</span>
            </div>
            <div className="space-y-2">
              {checklist.map(item => (
                <div key={item.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground">{item.id}.</span>
                      <span className="text-xs font-bold text-foreground">{item.title}</span>
                    </div>
                    {item.mandatory && (
                      <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[9px] font-bold text-destructive">필수</span>
                    )}
                  </div>
                  {item.details.length > 0 && (
                    <div className="mt-1 ml-5 space-y-0.5">
                      {item.details.map((d, di) => <p key={di} className="text-[10px] text-muted-foreground">· {d}</p>)}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {canAttemptChecklist && (
              <button
                onClick={() => setShowChecklist(true)}
                className="mt-3 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-all active:scale-[0.98]"
              >
                ✅ 체크테스트 시작
              </button>
            )}
          </div>

          {/* 판매급 심사 기준(커리큘럼) — 기존 체크리스트와 별개인 추가 참고 카드, 있을 때만 렌더 */}
          {(() => {
            const curriculumReview = getCurriculumReview(ul.globalLevel);
            if (!curriculumReview) return null;
            return (
              <div className="rounded-2xl border border-border bg-card p-4 shadow-elev-1">
                <button
                  onClick={() => setShowCurriculumReview(v => !v)}
                  className="flex w-full items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold text-foreground">판매급 심사 기준(커리큘럼)</span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${showCurriculumReview ? "rotate-180" : ""}`}
                  />
                </button>
                {showCurriculumReview && (
                  <div className="mt-3 space-y-3">
                    {curriculumReview.mission && (
                      <p className="text-[11px] leading-relaxed text-muted-foreground">{curriculumReview.mission}</p>
                    )}
                    {curriculumReview.quantitative.length > 0 && (
                      <div>
                        <p className="mb-1 text-[10px] font-bold text-primary">정량 기준</p>
                        <div className="space-y-0.5">
                          {curriculumReview.quantitative.map((q, i) => (
                            <p key={i} className="text-[10px] text-foreground">· {q}</p>
                          ))}
                        </div>
                      </div>
                    )}
                    {curriculumReview.qualitative.length > 0 && (
                      <div>
                        <p className="mb-1 text-[10px] font-bold text-primary">정성 루브릭</p>
                        <div className="space-y-0.5">
                          {curriculumReview.qualitative.map((q, i) => (
                            <p key={i} className="text-[10px] text-foreground">· {q}</p>
                          ))}
                        </div>
                      </div>
                    )}
                    {curriculumReview.instantFail.length > 0 && (
                      <div>
                        <p className="mb-1 text-[10px] font-bold text-destructive">즉시실패 조건</p>
                        <div className="space-y-0.5">
                          {curriculumReview.instantFail.map((q, i) => (
                            <p key={i} className="text-[10px] text-foreground">· {q}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Status */}
          <div className={`rounded-xl p-3 text-center text-sm font-bold ${
            status === "레벨업 완료" ? "bg-status-complete/10 text-status-complete"
            : status === "레벨업 심사 가능" ? "bg-primary text-primary-foreground"
            : status === "보완 필요" ? "bg-status-pending/10 text-status-pending"
            : status === "코치 확인 필요" ? "bg-destructive/10 text-destructive"
            : "bg-muted text-muted-foreground"
          }`}>
            {status === "진행중" ? "🥊 현재 진행 중" : status}
          </div>
        </>
      )}

      {/* 🥊 스파링 신청 — 접촉 레벨(Lv.26+) 전용 카드 */}
      {ul.globalLevel >= 26 && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-elev-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">🥊</span>
            <h3 className="text-sm font-bold text-foreground">스파링 참가</h3>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            접촉 훈련(라이트 스파링)은 부상 위험이 있어, 참가 전 안전 동의서 서명이 필요합니다.
          </p>
          {sparringConsent ? (
            <div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-status-complete/10 py-3 text-sm font-bold text-status-complete">
              <CheckCircle2 className="h-4 w-4" />
              스파링 동의 완료{sparringConsent.status === "coach_confirmed" ? " · 코치 확인됨" : ""}
            </div>
          ) : (
            <button
              onClick={() => setShowSparring(true)}
              className="mt-3 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-all active:scale-[0.98]"
            >
              🥊 스파링 신청
            </button>
          )}
        </div>
      )}

      {/* Checklist Modal */}
      {showChecklist && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-sm" onClick={() => setShowChecklist(false)}>
          <div className="w-full max-w-lg animate-slide-up rounded-t-3xl border-t border-border bg-card p-6 shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold text-foreground">✅ 체크테스트 — Lv.{ul.globalLevel}</h3>
            <div className="space-y-3">
              {checklist.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => {
                    const next = [...checkResults];
                    next[idx] = !next[idx];
                    setCheckResults(next);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                    checkResults[idx] ? "border-status-complete/30 bg-status-complete/5" : "border-border"
                  }`}
                >
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${checkResults[idx] ? "bg-status-complete text-white" : "bg-muted"}`}>
                    {checkResults[idx] && <CheckCircle2 className="h-4 w-4" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-foreground">{item.title}</p>
                    {item.mandatory && <span className="text-[9px] text-destructive">필수 항목</span>}
                  </div>
                </button>
              ))}
            </div>
            <button onClick={handleChecklistSubmit} className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground active:scale-[0.98]">
              결과 확인
            </button>
          </div>
        </div>
      )}

      {/* 🥊 스파링 참가 동의서 모달 */}
      {showSparring && (
        <SparringConsentModal
          participantDefaultName={profile?.name ?? ""}
          onClose={() => setShowSparring(false)}
          onSigned={(row) => {
            setSparringConsent(row);
            setShowSparring(false);
          }}
        />
      )}
    </div>
  );
};

export default WhiteLeagueTab;
