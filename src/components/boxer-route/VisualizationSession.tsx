/**
 * 복싱인 루트 — 시각화 세션 (3분 1라운드).
 *
 * 흐름:
 *   1. 시작 전 안내 → "시작" 버튼
 *   2. 라운드 진행 (180s) — segment 본문 자동 전환 + 호흡 가이드 + 타이머
 *   3. 라운드 종료 → SessionComplete 노출
 *
 * 게임형 표현 사용 금지. 성인 회원 톤 유지.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pause, Play, X } from "lucide-react";
import RoundTimer from "./RoundTimer";
import BreathingGuide from "./BreathingGuide";
import SessionComplete from "./SessionComplete";
import { useVisualizationProgress } from "@/hooks/useVisualizationProgress";
import {
  ROUTINE_MOOD_LABEL,
  ROUTINE_MOOD_TONE,
  type VisualizationRoutine,
} from "@/data/boxerRouteContent";

export interface VisualizationSessionProps {
  routine: VisualizationRoutine;
  onExit: () => void;
  onPickAnother: () => void;
}

type Phase = "intro" | "running" | "completed";

const VisualizationSession = ({
  routine,
  onExit,
  onPickAnother,
}: VisualizationSessionProps) => {
  const [phase, setPhase] = useState<Phase>("intro");
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const { state, recordCompletion } = useVisualizationProgress();

  // 현재 segment 결정
  const currentSegment = useMemo(() => {
    const list = routine.segments;
    let active = list[0];
    for (const s of list) {
      if (s.start_sec <= elapsed) active = s;
    }
    return active;
  }, [routine.segments, elapsed]);

  const handleTick = (sec: number) => {
    setElapsed(sec);
  };

  const handleComplete = () => {
    setPhase("completed");
    recordCompletion(routine.code, routine.duration_sec);
  };

  // 이미 완료 처리된 후 새 라운드 시작 시 elapsed 리셋
  useEffect(() => {
    if (phase === "intro") {
      setElapsed(0);
      setPaused(false);
    }
  }, [phase, routine.code]);

  const moodTone = ROUTINE_MOOD_TONE[routine.mood];
  const moodLabel = ROUTINE_MOOD_LABEL[routine.mood];

  return (
    <div className="relative space-y-4">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`inline-block rounded-pill border px-2 py-0.5 text-[10px] font-bold tracking-widest ${moodTone}`}
          >
            {moodLabel}
          </p>
          <h2 className="mt-1.5 text-lg font-black leading-tight text-foreground">
            {routine.title}
          </h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {routine.subtitle}
          </p>
        </div>
        <button
          type="button"
          aria-label="세션 닫기"
          onClick={onExit}
          className="rounded-full border border-white/10 bg-gray-900/60 p-2 text-muted-foreground active:scale-95"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {phase === "intro" && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4 rounded-3xl border border-amber-500/15 bg-gray-950/70 p-5"
          >
            <p className="whitespace-pre-line text-[13px] leading-relaxed text-foreground">
              {routine.segments[0].body}
            </p>
            <div className="rounded-2xl border border-white/5 bg-gray-900/40 p-3 text-center">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                준비
              </p>
              <p className="mt-1 text-[12px] text-foreground">
                편한 자리에 앉습니다.
                <br />
                3분 동안 화면의 안내를 따라 천천히 호흡합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPhase("running")}
              className="flex w-full items-center justify-center gap-2 rounded-pill border border-amber-500/40 bg-gradient-to-r from-amber-500/30 to-amber-400/20 py-3 text-[13px] font-black tracking-wider text-amber-100 active:scale-[0.98]"
            >
              <Play className="h-4 w-4" />
              라운드 시작
            </button>
          </motion.div>
        )}

        {phase === "running" && (
          <motion.div
            key="running"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-4"
          >
            <div className="flex justify-center">
              <RoundTimer
                durationSec={routine.duration_sec}
                running={!paused}
                currentSec={elapsed}
                onTick={handleTick}
                onComplete={handleComplete}
              />
            </div>

            {currentSegment.breath && (
              <BreathingGuide
                pattern={currentSegment.breath.pattern}
                label={currentSegment.breath.label}
                paused={paused}
              />
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={currentSegment.start_sec}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.5 }}
                className="rounded-2xl border border-amber-500/15 bg-gray-950/70 p-4 shadow-[0_0_0_1px_rgba(253,184,92,0.12)_inset]"
              >
                <p className="whitespace-pre-line text-center text-[13px] leading-relaxed text-foreground">
                  {currentSegment.body}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* 일시정지 / 종료 */}
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                className="inline-flex items-center gap-1.5 rounded-pill border border-white/10 bg-gray-900/60 px-4 py-2 text-[11px] font-bold text-foreground active:scale-95"
              >
                {paused ? (
                  <>
                    <Play className="h-3.5 w-3.5" /> 다시 진행
                  </>
                ) : (
                  <>
                    <Pause className="h-3.5 w-3.5" /> 잠시 멈춤
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onExit}
                className="rounded-pill border border-white/10 bg-gray-900/40 px-4 py-2 text-[11px] text-muted-foreground active:scale-95"
              >
                오늘은 여기까지
              </button>
            </div>
          </motion.div>
        )}

        {phase === "completed" && (
          <motion.div
            key="completed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <SessionComplete
              routine={routine}
              streak={state.streak}
              totalRounds={state.total_rounds}
              onClose={onExit}
              onAnotherRound={onPickAnother}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VisualizationSession;
