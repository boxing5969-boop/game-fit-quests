/**
 * AppLaunchSplashBackground
 *
 * 스플래시의 배경 · 레드 글로우 레이어. 순수 프레젠테이션, 상태 없음.
 *
 * 구조 (z-순)
 *   1) 전체화면 딥-블랙 radial 베이스   — splashBgIn
 *   2) 라디얼 비네트 (미세)              — 정적
 *   3) 중앙 뒤쪽 레드 글로우 (아주 약하게)— splashGlowPulse (700ms 지연)
 *   4) 상하 비네팅 (정적)
 *
 * 접근성: aria-hidden — 장식 레이어. 스크린리더엔 로고 <img alt="..."> 만 읽힘.
 */

export const AppLaunchSplashBackground = () => (
  <div
    aria-hidden
    className="splash-bg-anim pointer-events-none absolute inset-0"
    style={{
      // 딥 블랙 + 살짝 네이비. 완전 #000 대신 프리미엄 톤.
      background:
        "radial-gradient(ellipse at 50% 45%, #0B0F16 0%, #06070B 70%, #03040A 100%)",
    }}
  >
    {/* 미세 radial vignette — 뷰포트 외곽을 살짝 더 어둡게 눌러
        로고에 시선 집중. 정적 레이어라 애니메이션 비용 0. */}
    <span
      aria-hidden
      className="absolute inset-0"
      style={{
        background:
          "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)",
      }}
    />

    {/* 뒤쪽 레드 글로우 — 아주 약하게. blur 키워 확산, alpha 낮춤. */}
    <span
      aria-hidden
      className="splash-glow-anim absolute left-1/2 top-1/2 block rounded-full"
      style={{
        width: "min(64vw, 520px)",
        height: "min(64vw, 520px)",
        // alpha 0.55 → 0.32, 주변부 0.22 → 0.08, 감쇠 중지점 70% → 65%
        background:
          "radial-gradient(circle, rgba(217, 54, 32, 0.32) 0%, rgba(217, 54, 32, 0.08) 40%, rgba(217, 54, 32, 0) 65%)",
        // blur 6 → 22 — 더 부드럽고 크게 확산. "은은함" 강화.
        filter: "blur(22px)",
      }}
    />

    {/* 상단 비네팅 */}
    <span
      aria-hidden
      className="absolute inset-x-0 top-0 h-24"
      style={{
        background:
          "linear-gradient(to bottom, rgba(0,0,0,0.55), rgba(0,0,0,0))",
      }}
    />
    {/* 하단 비네팅 */}
    <span
      aria-hidden
      className="absolute inset-x-0 bottom-0 h-28"
      style={{
        background:
          "linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0))",
      }}
    />
  </div>
);

export default AppLaunchSplashBackground;
