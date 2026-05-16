/**
 * 복싱인 루트 — 시각화 훈련 진행 기록 (localStorage 단독).
 *
 * DB / API / wallet 미사용. 회원 단말기에만 저장.
 * 키 prefix: mb153_viz_*
 *
 * 보호 원칙:
 *   · 공식 출석/XP/미션 미반영.
 *   · 다른 영역 localStorage 키와 충돌 방지를 위해 prefix 고정.
 */

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "mb153_viz_progress_v1";

export interface VisualizationCompletion {
  routine_code: string;
  completed_at: string; // ISO
  duration_sec: number; // 실제 머문 시간 (보통 180)
}

export interface VisualizationProgressState {
  /** 누적 완료 라운드 (최신이 앞) */
  completions: VisualizationCompletion[];
  /** 마지막 완료 ISO 날짜 (yyyy-mm-dd) */
  last_completed_date: string | null;
  /** 연속 일수 (오늘 / 어제 연결 시 +1) */
  streak: number;
  /** 누적 라운드 수 */
  total_rounds: number;
}

const EMPTY: VisualizationProgressState = {
  completions: [],
  last_completed_date: null,
  streak: 0,
  total_rounds: 0,
};

function readStorage(): VisualizationProgressState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as VisualizationProgressState;
    // 형식 검증 — 깨진 데이터는 EMPTY 로
    if (!parsed || !Array.isArray(parsed.completions)) return EMPTY;
    return {
      completions: parsed.completions.slice(0, 200), // 안전 상한
      last_completed_date: parsed.last_completed_date ?? null,
      streak: typeof parsed.streak === "number" ? parsed.streak : 0,
      total_rounds:
        typeof parsed.total_rounds === "number" ? parsed.total_rounds : 0,
    };
  } catch {
    return EMPTY;
  }
}

function writeStorage(state: VisualizationProgressState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // QuotaExceeded 등 — 조용히 무시. 회원 경험 흐트러뜨리지 않음.
  }
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function isYesterday(prev: string | null, today: string): boolean {
  if (!prev) return false;
  const a = new Date(prev);
  const b = new Date(today);
  const diff = (b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000);
  return Math.round(diff) === 1;
}

export function useVisualizationProgress() {
  const [state, setState] = useState<VisualizationProgressState>(EMPTY);

  // 마운트 시 1회 read (SSR-safe)
  useEffect(() => {
    setState(readStorage());
  }, []);

  const recordCompletion = useCallback(
    (routine_code: string, duration_sec: number = 180) => {
      const now = new Date();
      const today = formatDate(now);
      setState((prev) => {
        let nextStreak = prev.streak;
        if (prev.last_completed_date === today) {
          // 같은 날 추가 라운드 — streak 그대로
        } else if (isYesterday(prev.last_completed_date, today)) {
          nextStreak = prev.streak + 1;
        } else {
          nextStreak = 1;
        }
        const next: VisualizationProgressState = {
          completions: [
            { routine_code, completed_at: now.toISOString(), duration_sec },
            ...prev.completions,
          ].slice(0, 200),
          last_completed_date: today,
          streak: nextStreak,
          total_rounds: prev.total_rounds + 1,
        };
        writeStorage(next);
        return next;
      });
    },
    [],
  );

  const reset = useCallback(() => {
    writeStorage(EMPTY);
    setState(EMPTY);
  }, []);

  /** 오늘 이미 완료한 라운드 코드 set (중복 표시용) */
  const todayCodes = (() => {
    const today = formatDate(new Date());
    return new Set(
      state.completions
        .filter((c) => c.completed_at.slice(0, 10) === today)
        .map((c) => c.routine_code),
    );
  })();

  const completedToday = state.last_completed_date === formatDate(new Date());

  return {
    state,
    todayCodes,
    completedToday,
    recordCompletion,
    reset,
  };
}
