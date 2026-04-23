/**
 * AppLaunchSplash — 153 Boxing Gym 앱 쿨드 스타트 스플래시.
 *
 * 책임 범위 (현재 라운드)
 *   • 전체화면 fixed overlay 로 포털 렌더.
 *   • 1750ms 타임라인 자동 진행 후 onFinished 콜백.
 *   • prefers-reduced-motion 시 장식성 모션 제거 (CSS 레이어에서 처리).
 *   • App.tsx 연결은 별도 라운드 — 이 파일은 UI 자체만 완성.
 *
 * 로고 asset
 *   기본 import 는 src/assets/branding/153-logo-white.svg (placeholder).
 *   실 배포 로고 PNG 로 교체하려면:
 *     1. src/assets/branding/153-logo-white.png 저장
 *     2. 아래 import 경로의 .svg → .png 만 수정.
 *
 * z-index 기준
 *   InductionCeremonyOverlay 가 z-[70] 을 사용. 그 위에 얹혀야 하므로 z-[80].
 *   (App.tsx 연결 시 Splash 는 AppRoutes 와 형제 위치로 들어갈 예정이라
 *    실제 튜토리얼 오버레이는 Splash 동안 DOM 에 존재하지 않지만, 방어적으로
 *    상위 스태킹 유지.)
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AppLaunchSplashBackground } from "./AppLaunchSplashBackground";
import logoSrc from "@/assets/branding/153-logo-white.svg";
import { cn } from "@/lib/utils";

// 타임라인 상수 — CSS keyframes 와 정합 유지.
const TOTAL_MS = 1750;
const FADE_OUT_MS = 300;      // 마지막 0.3s 는 전체 fade out

export interface AppLaunchSplashProps {
  /** 스플래시 종료 시 호출. Gate 에서 세션 플래그 세팅 + children 마운트. */
  onFinished: () => void;
  /**
   * 디버그/테스트 전용 — 전체 재생 시간 override.
   * 프로덕션 기본값(1750ms) 보다 짧게 써야 미치는 영향 없음.
   */
  totalMs?: number;
}

export const AppLaunchSplash = ({
  onFinished,
  totalMs = TOTAL_MS,
}: AppLaunchSplashProps) => {
  const [exiting, setExiting] = useState(false);

  // React 18 StrictMode 이중 마운트 방어 — 타이머가 2번 돌면서 onFinished 가
  // 두 번 호출되는 버그 예방.
  const scheduledRef = useRef(false);

  useEffect(() => {
    if (scheduledRef.current) return;
    scheduledRef.current = true;

    const exitAt = Math.max(0, totalMs - FADE_OUT_MS);
    const exitTimer = window.setTimeout(() => {
      setExiting(true);
    }, exitAt);

    const finishTimer = window.setTimeout(() => {
      onFinished();
    }, totalMs);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(finishTimer);
    };
  }, [totalMs, onFinished]);

  if (typeof document === "undefined") return null;

  const content = (
    <div
      role="presentation"
      className={cn(
        "fixed inset-0 z-[80] flex items-center justify-center overflow-hidden",
        exiting && "splash-exiting",
      )}
      // 의도치 않은 클릭·스크롤 차단 — 스플래시 동안은 입력 봉쇄.
      style={{ touchAction: "none" }}
    >
      <AppLaunchSplashBackground />

      {/* 로고 컨테이너 — clamp 로 뷰포트에 반응. 세로·가로 정렬은 부모 flex.
           - width: 폰 320px ~ 태블릿 768px+ 공통 시각 무게 유지
           - maxHeight 40vh: 랜드스케이프·초세로 짧은 뷰포트에서 로고가 화면 넘치지 않게 보호
           - aspectRatio 로 원본 비율(1000:420) 유지, object-contain 으로 내부 맞춤 */}
      <div
        className="relative z-10 flex items-center justify-center"
        style={{
          width: "clamp(220px, 58vw, 420px)",
          maxHeight: "40vh",
          aspectRatio: "1000 / 420",
          // safe-area 보정: iOS notch 환경에서도 중앙 유지
          padding: "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)",
        }}
      >
        <img
          src={logoSrc}
          alt="153 BOXING GYM"
          draggable={false}
          className="splash-logo-anim h-full w-full select-none object-contain"
          style={{
            // 은은한 깊이감. 레드 글로우는 배경 레이어에서 따로 처리.
            filter: "drop-shadow(0 4px 18px rgba(0, 0, 0, 0.45))",
          }}
        />
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default AppLaunchSplash;
