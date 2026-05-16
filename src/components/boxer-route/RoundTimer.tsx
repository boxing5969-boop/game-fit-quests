/**
 * 복싱인 루트 — 라운드 타이머.
 *
 * 단순 카운트다운 (3분 = 180s). 1초 tick 으로 진행률/잔여 시간 노출.
 * 종 (자체 SVG) 1회 — 시작/종료 시점에 시각적으로만 표시 (사운드 X).
 */

import { useEffect, useRef, useState } from "react";

export interface RoundTimerProps {
  durationSec: number;
  /** running=true 일 때만 카운트다운. false 로 바뀌면 멈춤. */
  running: boolean;
  /** 현재 경과 초 (controlled) — 외부에서 강제로 옮길 때 사용. 미지정 시 내부 상태. */
  currentSec?: number;
  onTick?: (elapsedSec: number) => void;
  onComplete?: () => void;
}

const RoundTimer = ({
  durationSec,
  running,
  currentSec,
  onTick,
  onComplete,
}: RoundTimerProps) => {
  const [elapsed, setElapsed] = useState(currentSec ?? 0);
  const completedRef = useRef(false);

  useEffect(() => {
    if (typeof currentSec === "number") {
      setElapsed(currentSec);
    }
  }, [currentSec]);

  useEffect(() => {
    if (!running) return;
    completedRef.current = false;
    const id = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (onTick) onTick(next);
        if (next >= durationSec && !completedRef.current) {
          completedRef.current = true;
          if (onComplete) onComplete();
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, durationSec, onTick, onComplete]);

  const remaining = Math.max(0, durationSec - elapsed);
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const pct = Math.min(100, (elapsed / durationSec) * 100);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex h-32 w-32 items-center justify-center">
        {/* 원형 progress */}
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="4"
          />
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="#fdb85c"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 289} 289`}
            style={{ transition: "stroke-dasharray 0.6s linear" }}
          />
        </svg>
        <div className="flex flex-col items-center">
          <span className="font-mono text-4xl font-black tabular-nums text-foreground">
            {mm}:{ss}
          </span>
          <span className="mt-0.5 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            ROUND
          </span>
        </div>
      </div>
    </div>
  );
};

export default RoundTimer;
