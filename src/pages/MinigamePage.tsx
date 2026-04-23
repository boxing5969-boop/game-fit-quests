import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dumbbell } from "lucide-react";

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
    return (
      <div className="minigame-app flex min-h-screen items-center justify-center" />
    );
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

  return <div className="minigame-app">{renderGame()}</div>;
};

export default MinigamePage;
