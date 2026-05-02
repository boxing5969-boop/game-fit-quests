/**
 * RouteLoader — 라우트 전환·Auth 로딩·ProtectedRoute 대기 중에 보이는
 * 스플래시 톤 로더.
 *
 * 설계 원칙
 *   • 쿨드 스타트 스플래시(AppLaunchSplash)와 시각적으로 일관 — 동일한 딥 블랙
 *     radial 배경, 동일 로고 asset.
 *   • 다만 스플래시처럼 1.75s 풀 드라마(blur 전환·글로우 pulse)는 쓰지 않음.
 *     라우트 이동은 100ms~2s 로 가변이라 매번 같은 긴 애니메이션이 끼어들면
 *     체감이 나쁘다.
 *   • 대신 로고가 **은은히 호흡하듯 opacity breathe** 만 수행. 진입·종료는
 *     순간 fade in/out.
 *   • reduced-motion 환경에선 breathe 도 멈추고 정적 표시.
 *
 * 사용처 (현재)
 *   • AppRoutes auth loading 분기
 *   • Suspense fallback (라우트 chunk lazy load)
 *   • ProtectedRoute 로딩 분기
 */

import logoSrc from "@/assets/branding/153-logo-white.svg";

export interface RouteLoaderProps {
  /** 접근성용 안내 문구. 기본 "로딩 중". */
  label?: string;
}

export const RouteLoader = ({ label = "로딩 중" }: RouteLoaderProps) => (
  <div
    role="status"
    aria-label={label}
    className="route-loader-root flex min-h-screen items-center justify-center"
    style={{
      background:
        "radial-gradient(ellipse at 50% 45%, #0B0F16 0%, #06070B 70%, #03040A 100%)",
    }}
  >
    {/* 로고 — 스플래시 대비 60~70% 크기. clamp 로 반응형. */}
    <div
      className="flex items-center justify-center"
      style={{
        width: "clamp(160px, 42vw, 280px)",
        maxHeight: "30vh",
        aspectRatio: "1000 / 420",
      }}
    >
      <img
        src={logoSrc}
        alt=""
        aria-hidden
        draggable={false}
        className="route-loader-logo h-full w-full select-none object-contain"
        style={{
          filter: "drop-shadow(0 3px 14px rgba(0, 0, 0, 0.4))",
        }}
      />
    </div>
  </div>
);

export default RouteLoader;
