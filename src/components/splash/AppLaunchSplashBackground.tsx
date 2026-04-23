/**
 * AppLaunchSplashBackground
 *
 * 스플래시의 배경 · 레드 글로우 레이어. 순수 프레젠테이션, 상태 없음.
 *
 * 구조
 *   1) 전체화면 솔리드 배경 (딥 블랙) — splashBgIn
 *   2) 중앙 뒤쪽 radial red glow — splashGlowPulse (700ms 지연)
 *   3) 상하 비네팅 — 프리미엄 톤 강조용 정적 레이어
 *
 * 접근성: aria-hidden — 장식 레이어. 스크린리더엔 로고 <img alt="..."> 만 읽힘.
 */

export const AppLaunchSplashBackground = () => (
  <div
    aria-hidden
    className="splash-bg-anim pointer-events-none absolute inset-0"
    style={{
      // 딥 블랙 베이스. 완전 #000 대신 살짝 네이비 섞어 프리미엄 톤.
      background:
        "radial-gradient(ellipse at 50% 45%, #0B0F16 0%, #06070B 70%, #03040A 100%)",
    }}
  >
    {/* 뒤쪽 레드 글로우 — 로고 뒤에 은은하게.
        transform translate(-50%, -50%) 는 keyframes 안에 포함돼 있음. */}
    <span
      aria-hidden
      className="splash-glow-anim absolute left-1/2 top-1/2 block rounded-full"
      style={{
        width: "min(70vw, 560px)",
        height: "min(70vw, 560px)",
        background:
          "radial-gradient(circle, rgba(217, 54, 32, 0.55) 0%, rgba(217, 54, 32, 0.22) 35%, rgba(217, 54, 32, 0) 70%)",
        filter: "blur(6px)",
      }}
    />

    {/* 상단 비네팅 — 스포츠 RPG 다크 톤 보조 */}
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
