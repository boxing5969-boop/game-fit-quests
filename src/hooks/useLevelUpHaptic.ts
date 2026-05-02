/**
 * 153 — 레벨업 / 랭크업 셀러브레이션 haptic 진동 훅.
 *
 * 모바일 디바이스 (vibrate API 지원) 에서만 동작.
 * 데스크톱 / iOS Safari (vibrate 미지원) 는 silent.
 *
 * Rank 별 차별화:
 *   white  — 가벼운 노크 (입문 리그)
 *   blue   — 중간 신호 (성장 리그)
 *   red    — 강한 펀치 (정점 리그)
 *   black  — 폭발 시퀀스 (마스터 리그)
 */

import { useEffect } from "react";

type RankLike = string | undefined | null;

const HAPTIC_PATTERNS: Record<string, number | number[]> = {
  // 가벼운 진입 노크 (모든 rank 공통)
  enter: 30,
  // 트로피 도착 — rank 별 차별화
  white: [50, 50, 80],
  blue: [80, 50, 120, 50, 80],
  red: [100, 60, 150, 60, 100, 60, 150],
  black: [150, 80, 200, 80, 250, 80, 300],
  // 보스/마스터 폭발 시퀀스
  master: [200, 100, 300, 100, 400],
};

function safeVibrate(pattern: number | number[]): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.vibrate !== "function") return false;
  try {
    navigator.vibrate(pattern);
    return true;
  } catch {
    return false;
  }
}

export function useLevelUpHaptic(isOpen: boolean, rank: RankLike, isMaster?: boolean): void {
  useEffect(() => {
    if (!isOpen) return;

    // 진입 노크 (즉시)
    safeVibrate(HAPTIC_PATTERNS.enter);

    // 메인 시퀀스 (0.4s 후 트로피 도착 타이밍)
    const trophyTimer = window.setTimeout(() => {
      const key = isMaster ? "master" : (rank ?? "white").toLowerCase();
      const pattern = HAPTIC_PATTERNS[key] ?? HAPTIC_PATTERNS.white;
      safeVibrate(pattern);
    }, 400);

    return () => {
      window.clearTimeout(trophyTimer);
    };
  }, [isOpen, rank, isMaster]);
}

/** 외부에서 직접 트리거 — 보너스 폭발용 */
export function triggerLevelUpHaptic(rank?: RankLike, isMaster?: boolean): boolean {
  const key = isMaster ? "master" : (rank ?? "white").toLowerCase();
  const pattern = HAPTIC_PATTERNS[key] ?? HAPTIC_PATTERNS.white;
  return safeVibrate(pattern);
}
