/**
 * useAppLaunchSplash — 앱 쿨드 스타트 스플래시 게이팅 훅.
 *
 * 역할
 *   • 세션 내 1회만 재생. sessionStorage 키로 중복 방지.
 *   • 특정 퍼블릭 라우트(/live-board/*)는 bypass.
 *   • 실제 재생/애니메이션은 AppLaunchSplash 컴포넌트 책임.
 *
 * 현재 App.tsx 에 연결되어 있지 않음 — Gate 에서 읽어 쓰는 구조로
 * 사용 예정. 이 훅은 컴포넌트/테스트 양쪽에서 호출 가능하도록 순수 유지.
 */

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "app_splash_shown_v1";

/** pathname 이 이 prefix 로 시작하면 스플래시 생략. */
const BYPASS_ROUTES = ["/live-board"];

function readHasShown(): boolean {
  if (typeof window === "undefined") return true; // SSR safe-default
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markShown() {
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // private mode · quota 초과 — 무시 (세션 동안 메모리 플래그만 유지됨)
  }
}

function isBypassPath(pathname: string): boolean {
  return BYPASS_ROUTES.some((p) => pathname.startsWith(p));
}

export interface UseAppLaunchSplashResult {
  /** 지금 스플래시를 렌더해야 하는지. */
  shouldShow: boolean;
  /** 스플래시 애니메이션 완료 시 호출. 세션 플래그 세팅 + shouldShow=false. */
  markFinished: () => void;
  /** 디버그/테스트용 — 세션 플래그 리셋 (다음 페이지 로드부터 재생). */
  reset: () => void;
}

/**
 * pathname 기반 bypass + 세션 1회 제한.
 * SSR 안전 — 초기 렌더에선 항상 false 로 시작하고 mount 후 상태 확정.
 */
export function useAppLaunchSplash(pathname: string): UseAppLaunchSplashResult {
  const [shouldShow, setShouldShow] = useState<boolean>(false);

  useEffect(() => {
    // 첫 mount 시에 한 번만 결정. 이후 pathname 변경으로 재계산 X.
    if (isBypassPath(pathname)) {
      setShouldShow(false);
      return;
    }
    setShouldShow(!readHasShown());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markFinished = useCallback(() => {
    markShown();
    setShouldShow(false);
  }, []);

  const reset = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // 무시
    }
    setShouldShow(true);
  }, []);

  return { shouldShow, markFinished, reset };
}
