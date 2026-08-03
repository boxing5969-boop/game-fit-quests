import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// 설치형 앱(Capacitor)으로 켜면 랭킹앱 홈이 아니라 얼굴 키오스크로 진입한다.
// React Router 가 경로를 읽기 전에 바꿔야 하므로 렌더보다 먼저 실행.
if ((window as any).Capacitor?.isNativePlatform?.() && window.location.pathname === "/") {
  window.history.replaceState(null, "", "/face-kiosk");
}

createRoot(document.getElementById("root")!).render(<App />);
