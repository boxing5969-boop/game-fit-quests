/**
 * useAppLaunchSplash — 앱 쿨드 스타트 스플래시 게이트.
 *
 * 정책 (명시)
 *   • 세션 1회만 재생. sessionStorage 키 `rankingup_splash_seen_v1` 로
 *     게이트. 새로고침(= 같은 탭·같은 세션) 에선 재생 안 함. 탭을 완전히
 *     닫았다가 새로 열면(= 새 세션) 다시 재생.
 *   • 로그인/셋업/퍼블릭 라우트에서는 bypass — 세션 플래그 세팅 안 함.
 *     (로그인 후 /home 으로 진입할 때 최초 재생되도록)
 *   • 외부 gated 플래그로 재생 지연 가능 — 예: auth loading 완료까지.
 *
 * 상태 머신
 *   ┌──────────────┐   gated=false · pathname 유효 · session 미시청    ┌──────────┐
 *   │  waiting     │ ─────────────────────────────────────────────► │ showing  │
 *   └──────────────┘                                                 └────┬─────┘
 *          │                                                              │ markFinished()
 *          │ gated=false · 이미 시청                                       ▼
 *          └──────────────────────────────────────────────────► ┌──────────┐
 *                                                                │   done   │
 *                                                                └──────────┘
 *   한 번 `done` 이면 다시 showing 으로 돌아가지 않음.
 */

import { useCallback, useEffect, useState } from "react";
import { isSignageRoute } from "@/lib/displayMode";

const STORAGE_KEY = "rankingup_splash_seen_v1";

// 셋업·퍼블릭 라우트 — 이 중에 있으면 splash 를 재생하지 않는다.
// 정확 일치("/" 로그인) + prefix 매칭(/onboarding 등) 혼합.
const BYPASS_PATH_EXACT = new Set<string>(["/"]);
const BYPASS_PATH_PREFIXES: readonly string[] = [
  "/onboarding",
  "/select-branch",
  "/waiting-approval",
  "/live-board",
];

function isBypassPath(pathname: string): boolean {
  // 전시용 화면(TV·키오스크) 경로는 displayMode 한 곳에서만 관리한다.
  if (isSignageRoute(pathname)) return true;
  if (BYPASS_PATH_EXACT.has(pathname)) return true;
  return BYPASS_PATH_PREFIXES.some((p) => pathname.startsWith(p));
}

function readSeen(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // private mode · quota 초과 — 세션 한정 효과만 유지, 차후 탭 재진입 시 재생됨.
  }
}

type Phase = "waiting" | "showing" | "done";

export interface UseAppLaunchSplashResult {
  /** 지금 스플래시 포털을 렌더해야 하는지. */
  shouldShow: boolean;
  /** 스플래시 주기가 종료됐는지. 튜토리얼 등 후속 오버레이 게이트에 사용. */
  splashDone: boolean;
  /** 애니메이션 완료 시 호출. 세션 플래그 저장 + phase→done. */
  markFinished: () => void;
  /** 디버그/테스트 전용 — 세션 플래그 제거. 다음 mount 때 waiting 재진입. */
  reset: () => void;
}

/**
 * @param pathname — 현재 라우트 경로 (react-router `useLocation().pathname`).
 * @param gated   — true 이면 waiting 유지. auth loading 등 외부 조건용.
 */
export function useAppLaunchSplash(
  pathname: string,
  gated = false,
): UseAppLaunchSplashResult {
  // 첫 렌더에서 동기적으로 phase 결정 — 깜빡임(1-frame flash) 방지.
  const [phase, setPhase] = useState<Phase>(() => {
    if (typeof window === "undefined") return "done";
    if (readSeen()) return "done";
    if (gated) return "waiting";
    if (isBypassPath(pathname)) return "waiting";
    return "showing";
  });

  // pathname/gated 변경 시 waiting → showing/done 전환.
  // done 이면 어떤 경우에도 되돌아가지 않음.
  useEffect(() => {
    if (phase !== "waiting") return;
    if (gated) return;
    if (isBypassPath(pathname)) return;
    if (readSeen()) {
      setPhase("done");
      return;
    }
    setPhase("showing");
  }, [pathname, gated, phase]);

  const markFinished = useCallback(() => {
    markSeen();
    setPhase("done");
  }, []);

  const reset = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // 무시
    }
    setPhase("waiting");
  }, []);

  return {
    shouldShow: phase === "showing",
    splashDone: phase === "done",
    markFinished,
    reset,
  };
}
