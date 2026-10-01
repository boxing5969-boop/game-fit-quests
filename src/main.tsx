import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// 설치형 앱(Capacitor)으로 켜면 랭킹앱 홈이 아니라 얼굴 키오스크로 진입한다.
// React Router 가 경로를 읽기 전에 바꿔야 하므로 렌더보다 먼저 실행.
if ((window as any).Capacitor?.isNativePlatform?.() && window.location.pathname === "/") {
  window.history.replaceState(null, "", "/face-kiosk");
}

// 아이폰: 글자가 16px 보다 작은 입력칸을 누르면 사파리가 화면을 확대한 채로 둔다 → 화면이 잘려 보인다 (2026-10-01).
// iOS 에서만 maximum-scale=1 을 붙여 '입력할 때 자동 확대'만 막는다 (iOS 는 손가락 확대는 계속 허용한다).
// 안드로이드는 이 값이 손가락 확대까지 막으므로 붙이지 않는다.
const isIOS =
  /iP(hone|od|ad)/.test(navigator.userAgent) ||
  (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
if (isIOS) {
  const vp = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (vp && !/maximum-scale/.test(vp.content)) vp.content = `${vp.content}, maximum-scale=1`;
}

createRoot(document.getElementById("root")!).render(<App />);
