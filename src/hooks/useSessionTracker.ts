// ═══════════════════════════════════════════════════════
// Session Tracker Hook — manages live session state
// ═══════════════════════════════════════════════════════
import { useState, useCallback, useRef, useEffect } from "react";
import type { SessionBlock } from "@/data/whiteLevel1Data";

export interface SessionState {
  isActive: boolean;
  startedAt: Date | null;
  elapsedSeconds: number;
  completedBlocks: string[];
  intensity: "easy" | "normal" | "hard";
  isPaused: boolean;
}

export function useSessionTracker(blocks: SessionBlock[]) {
  const [state, setState] = useState<SessionState>({
    isActive: false,
    startedAt: null,
    elapsedSeconds: 0,
    completedBlocks: [],
    intensity: "normal",
    isPaused: false,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer tick
  useEffect(() => {
    if (state.isActive && !state.isPaused) {
      timerRef.current = setInterval(() => {
        setState(prev => ({
          ...prev,
          elapsedSeconds: prev.elapsedSeconds + 1,
        }));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.isActive, state.isPaused]);

  const startSession = useCallback(() => {
    setState({
      isActive: true,
      startedAt: new Date(),
      elapsedSeconds: 0,
      completedBlocks: [],
      intensity: "normal",
      isPaused: false,
    });
  }, []);

  const pauseSession = useCallback(() => {
    setState(prev => ({ ...prev, isPaused: !prev.isPaused }));
  }, []);

  const toggleBlock = useCallback((blockId: string) => {
    setState(prev => {
      const has = prev.completedBlocks.includes(blockId);
      return {
        ...prev,
        completedBlocks: has
          ? prev.completedBlocks.filter(b => b !== blockId)
          : [...prev.completedBlocks, blockId],
      };
    });
  }, []);

  const setIntensity = useCallback((intensity: "easy" | "normal" | "hard") => {
    setState(prev => ({ ...prev, intensity }));
  }, []);

  const finishSession = useCallback(() => {
    const actualMinutes = Math.round(state.elapsedSeconds / 60);
    setState(prev => ({ ...prev, isActive: false, isPaused: false }));
    return {
      actualMinutes,
      completedBlocks: state.completedBlocks,
      intensity: state.intensity,
    };
  }, [state.elapsedSeconds, state.completedBlocks, state.intensity]);

  const cancelSession = useCallback(() => {
    setState({
      isActive: false,
      startedAt: null,
      elapsedSeconds: 0,
      completedBlocks: [],
      intensity: "normal",
      isPaused: false,
    });
  }, []);

  const elapsedMinutes = Math.floor(state.elapsedSeconds / 60);
  const elapsedSecondsRemainder = state.elapsedSeconds % 60;
  const totalPlannedMinutes = blocks.reduce((sum, b) => sum + b.durationMin, 0);
  const progressPct = totalPlannedMinutes > 0 ? Math.min(100, Math.round((elapsedMinutes / totalPlannedMinutes) * 100)) : 0;

  return {
    ...state,
    elapsedMinutes,
    elapsedSecondsRemainder,
    totalPlannedMinutes,
    progressPct,
    startSession,
    pauseSession,
    toggleBlock,
    setIntensity,
    finishSession,
    cancelSession,
  };
}
