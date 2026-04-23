import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Dumbbell } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useRankupUser } from "@/features/minigame/lib/rankupAuth";
import { useGameEngine } from "@/features/minigame/hooks/useGameEngine";
import { useMittEngine } from "@/features/minigame/hooks/useMittEngine";
import ModeSelect from "@/features/minigame/components/ModeSelect";
import IntroSlider from "@/features/minigame/components/IntroSlider";
import EducationScreen from "@/features/minigame/components/EducationScreen";
import HomeScreen from "@/features/minigame/components/HomeScreen";
import CountdownScreen from "@/features/minigame/components/CountdownScreen";
import GameScreen from "@/features/minigame/components/GameScreen";
import ResultsScreen from "@/features/minigame/components/ResultsScreen";
import TutorialOverlay from "@/features/minigame/components/TutorialOverlay";
import UnifiedLeaderboard from "@/features/minigame/components/UnifiedLeaderboard";
import MittDrillScreen from "@/features/minigame/components/MittDrillScreen";
import MittResultsScreen from "@/features/minigame/components/MittResultsScreen";
import BoxingDefenseScreen from "@/features/minigame/components/BoxingDefenseScreen";

// 게임 스코프 전용 스타일 — .minigame-app 아래로만 적용됨.
import "@/features/minigame/minigame.css";

type AppMode = "select" | "mode1" | "mode2" | "mode3" | "education" | "leaderboard";

// ── 복싱 명언 — 진입 로딩 오버레이에서 순환 노출.
type Quote = { line: string; by: string };
const BOXING_QUOTES: readonly Quote[] = Object.freeze([
  { line: "복싱은 타이밍의 예술이다.", by: "Sugar Ray Robinson" },
  { line: "나비처럼 날아 벌처럼 쏴라.", by: "Muhammad Ali" },
  { line: "모두에게는 계획이 있다. 한 대 맞기 전까지는.", by: "Mike Tyson" },
  { line: "두려움은 친구이자 적이다. 통제하면 무기가 된다.", by: "Cus D'Amato" },
  { line: "챔피언은 링이 아니라 체육관에서 만들어진다.", by: "Muhammad Ali" },
  { line: "나는 훈련하는 매 1분이 싫었다. 그러나 '포기하지 마라, 지금 고통받고 평생 챔피언으로 살아라'라고 말했다.", by: "Muhammad Ali" },
  { line: "승리는 이미 이긴 사람의 것이 아니라, 포기하지 않은 사람의 것이다.", by: "Rocky Balboa" },
  { line: "중요한 건 얼마나 세게 때리느냐가 아니다. 얼마나 세게 맞고도 전진하느냐다.", by: "Rocky Balboa" },
  { line: "규율이 재능을 이긴다. 매일 반복하는 자를 이기는 건 쉽지 않다.", by: "Coach's Corner" },
  { line: "스피드가 파워다. 손이 빠르면 주먹은 무거워진다.", by: "Sugar Ray Leonard" },
  { line: "준비되지 않은 자에게 기회는 재앙일 뿐.", by: "George Foreman" },
  { line: "땀은 거짓말하지 않는다.", by: "Old Gym Wisdom" },
]);

const INTRO_VISIBLE_MS = 1800;
const QUOTE_ROTATE_MS = 2600;

const MinigamePage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [appMode, setAppMode] = useState<AppMode>("select");
  const game = useGameEngine();
  const mitt = useMittEngine();
  const { user: rankupUser } = useRankupUser();
  const [showTutorial, setShowTutorial] = useState(
    () => !(typeof window !== "undefined" && localStorage.getItem("mitt_tutorial_seen")),
  );

  // 진입 애니메이션 — 글러브 펀치 + 명언 순환. 게임은 같은 번들에 있어 즉시 로드되지만
  // 트랜지션 연출을 위해 짧게(INTRO_VISIBLE_MS) 오버레이를 띄운다.
  const [introVisible, setIntroVisible] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);
  const mountedAt = useRef<number>(Date.now());
  const startIdx = useMemo(
    () => Math.floor(Math.random() * BOXING_QUOTES.length),
    [],
  );
  const [quoteIdx, setQuoteIdx] = useState(startIdx);

  useEffect(() => {
    if (!introVisible) return;
    const rotate = window.setInterval(() => {
      setQuoteIdx((i) => (i + 1) % BOXING_QUOTES.length);
    }, QUOTE_ROTATE_MS);
    const fadeT = window.setTimeout(() => setFadingOut(true), INTRO_VISIBLE_MS - 400);
    const hideT = window.setTimeout(() => setIntroVisible(false), INTRO_VISIBLE_MS);
    return () => {
      window.clearInterval(rotate);
      window.clearTimeout(fadeT);
      window.clearTimeout(hideT);
    };
  }, [introVisible]);

  const resolvePlayerName = () => {
    const nick = rankupUser?.nickname?.trim();
    if (nick) return nick;
    const saved =
      (typeof window !== "undefined" && localStorage.getItem("boxing_player_name")) || "";
    if (saved.trim()) return saved.trim();
    return "Fighter";
  };

  const startMode1 = () => game.startGame(resolvePlayerName());
  const startMode2 = () => mitt.startGame(resolvePlayerName());

  const goToModeSelect = () => {
    setAppMode("select");
    game.goHome();
    mitt.goHome();
  };

  if (loading) {
    return <div className="minigame-app flex min-h-screen items-center justify-center" />;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Dumbbell className="h-8 w-8" />
        </div>
        <h1 className="text-lg font-bold text-foreground">로그인이 필요합니다</h1>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          복싱 트레이닝은 로그인 후 이용할 수 있어요. 점수는 내 계정에 연동됩니다.
        </p>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mt-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-glow-soft active:scale-[0.98]"
        >
          로그인 하러가기
        </button>
      </div>
    );
  }

  // ===== 게임 렌더링 — 모든 화면은 .minigame-app 아래에서만 동작 =====
  const renderGame = () => {
    if (appMode === "select") {
      return (
        <ModeSelect
          onMode1={() => setAppMode("mode1")}
          onMode2={() => setAppMode("mode2")}
          onMode3={() => setAppMode("mode3")}
          onEducation={() => setAppMode("education")}
          onLeaderboard={() => setAppMode("leaderboard")}
        />
      );
    }

    if (appMode === "leaderboard") {
      return (
        <UnifiedLeaderboard
          onBack={goToModeSelect}
          currentUserId={rankupUser?.id ?? null}
        />
      );
    }

    if (appMode === "education") {
      return <EducationScreen onBack={goToModeSelect} />;
    }

    if (appMode === "mode3") {
      return <BoxingDefenseScreen onExit={goToModeSelect} />;
    }

    if (appMode === "mode2") {
      switch (mitt.phase) {
        case "home":
        case "name":
          startMode2();
          return null;
        case "countdown":
          return <CountdownScreen countdown={mitt.countdown} round={mitt.currentStage} />;
        case "playing":
        case "clear":
        case "fail":
          return (
            <MittDrillScreen
              currentStage={mitt.currentStage}
              highestCleared={mitt.highestCleared}
              stageTime={mitt.stageTime}
              energy={mitt.energy}
              gloves={mitt.gloves}
              score={mitt.score}
              combo={mitt.combo}
              bestCombo={mitt.bestCombo}
              lastResult={mitt.lastResult}
              wrongShake={mitt.wrongShake}
              paused={mitt.paused}
              roundOutcome={mitt.roundOutcome}
              phase={mitt.phase as "playing" | "clear" | "fail"}
              comboMilestone={mitt.comboMilestone}
              energyFloat={mitt.energyFloat}
              perfectFlash={mitt.perfectFlash}
              onPunch={mitt.handlePunch}
              onPause={mitt.pauseGame}
              onResume={mitt.resumeGame}
              onQuit={goToModeSelect}
              onRestart={mitt.restartGame}
              onNextRound={mitt.nextRound}
              onRetryRound={mitt.retryRound}
              onEndSession={mitt.endSession}
            />
          );
        case "results":
          return mitt.sessionResult && mitt.sessionExtras ? (
            <MittResultsScreen
              result={mitt.sessionResult}
              extras={mitt.sessionExtras}
              onHome={goToModeSelect}
              onRetry={mitt.restartGame}
            />
          ) : null;
        default:
          return null;
      }
    }

    // ===== MODE 1: REACTION TRAINER =====
    switch (game.phase) {
      case "intro":
        return <IntroSlider onComplete={game.dismissIntro} />;
      case "home":
        return (
          <HomeScreen
            onStart={startMode1}
            onRanking={game.goToRanking}
            onBack={goToModeSelect}
          />
        );
      case "name":
        startMode1();
        return null;
      case "countdown":
        return (
          <>
            {showTutorial && (
              <TutorialOverlay
                onDismiss={() => {
                  localStorage.setItem("mitt_tutorial_seen", "1");
                  setShowTutorial(false);
                }}
              />
            )}
            <CountdownScreen countdown={game.countdown} round={game.currentRound} />
          </>
        );
      case "playing":
        return (
          <GameScreen
            currentPunch={game.currentPunch}
            waiting={game.waiting}
            lastResult={game.lastResult}
            showFeedback={game.showFeedback}
            currentScore={game.currentScore}
            currentCombo={game.currentCombo}
            wrongShake={game.wrongShake}
            round={game.round}
            successesInRound={game.successesInRound}
            roundTarget={game.roundTarget}
            shields={game.shields}
            feverActive={game.feverActive}
            feverProgress={game.feverProgress}
            elapsedSec={game.elapsedSec}
            shieldSavedFlash={game.shieldSavedFlash}
            roundClearFlash={game.roundClearFlash}
            feverEnterFlash={game.feverEnterFlash}
            bestRoundLive={game.bestRoundLive}
            bestScoreLive={game.bestScoreLive}
            paused={game.paused}
            onPunch={game.handlePunch}
            onPause={game.pauseGame}
            onResume={game.resumeGame}
            onQuit={goToModeSelect}
            onRestart={game.restartGame}
          />
        );
      case "rest":
        return null;
      case "promotion":
        return null;
      case "results":
        return game.sessionResult && game.sessionExtras ? (
          <ResultsScreen
            result={game.sessionResult}
            extras={game.sessionExtras}
            onHome={goToModeSelect}
            onRanking={game.goToRanking}
            onRetry={game.restartGame}
          />
        ) : null;
      case "ranking":
        return (
          <UnifiedLeaderboard
            onBack={game.goHome}
            currentUserId={rankupUser?.id ?? null}
            initialMode="speed"
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="minigame-app">
      {/* 랭킹업 앱 복귀 버튼 — 메인 모드 선택 화면에서만 노출. 게임 진행 중에는
          goToModeSelect 로 한 단계 빠진 뒤 다시 표시됨. */}
      {appMode === "select" && (
        <button
          type="button"
          onClick={() => navigate("/home")}
          className="fixed left-3 top-3 z-[55] flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-3 py-1.5 text-[11px] font-bold text-foreground shadow-lg backdrop-blur-sm active:scale-95"
          aria-label="랭킹업으로 돌아가기"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          랭킹업
        </button>
      )}

      {renderGame()}

      {introVisible && <IntroOverlay quoteIdx={quoteIdx} fadingOut={fadingOut} />}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────
// Intro overlay — 진입 시 복싱 명언 + 글러브 펀치 애니메이션
// ──────────────────────────────────────────────────────────────────
const IntroOverlay = ({
  quoteIdx,
  fadingOut,
}: {
  quoteIdx: number;
  fadingOut: boolean;
}) => {
  const q = BOXING_QUOTES[quoteIdx] ?? BOXING_QUOTES[0];
  return (
    <div
      aria-live="polite"
      className={`fixed inset-0 z-[70] flex flex-col items-center justify-center bg-background px-6 transition-opacity duration-500 ${
        fadingOut ? "opacity-0" : "opacity-100"
      }`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 35%, hsl(8 75% 48% / 0.22), transparent 55%)",
        }}
      />

      <div className="relative mb-7 flex h-16 w-28 items-center justify-center">
        <span
          aria-hidden
          className="absolute left-0 animate-[mg-punchL_0.9s_ease-in-out_infinite] text-[44px]"
          style={{ filter: "drop-shadow(0 6px 14px rgba(217,54,32,0.45))" }}
        >
          🥊
        </span>
        <span
          aria-hidden
          className="absolute right-0 scale-x-[-1] animate-[mg-punchR_0.9s_ease-in-out_infinite] text-[44px]"
          style={{ filter: "drop-shadow(0 6px 14px rgba(217,54,32,0.45))" }}
        >
          🥊
        </span>
      </div>

      <div className="relative mx-auto flex min-h-[88px] max-w-[320px] flex-col items-center justify-center text-center">
        <p
          key={`q-${quoteIdx}`}
          className="animate-[mg-quoteIn_520ms_ease-out] text-[16px] font-extrabold leading-snug text-foreground"
        >
          "{q.line}"
        </p>
        <p
          key={`by-${quoteIdx}`}
          className="mt-2 animate-[mg-quoteIn_620ms_ease-out] text-[11px] font-semibold tracking-wide text-muted-foreground"
        >
          — {q.by}
        </p>
      </div>

      <div className="mt-7 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-primary">
        <span className="inline-block h-1 w-8 animate-pulse rounded-full bg-primary/60" />
        ROUND 1 · READY
        <span className="inline-block h-1 w-8 animate-pulse rounded-full bg-primary/60" />
      </div>

      <style>{`
        @keyframes mg-punchL {
          0%, 100% { transform: translateX(-16px) rotate(-8deg) scale(1); }
          50%      { transform: translateX(14px)  rotate(8deg)  scale(1.15); }
        }
        @keyframes mg-punchR {
          0%, 100% { transform: translateX(16px)  rotate(8deg)  scale(1); }
          50%      { transform: translateX(-14px) rotate(-8deg) scale(1.15); }
        }
        @keyframes mg-quoteIn {
          0%   { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default MinigamePage;
