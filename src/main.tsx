import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { stripEmoji } from "@/lib/emoji3d/core";
import { captureInviteCodeFromUrl } from "@/lib/appInvite";
import { isIosApp, loadIosAppNative } from "@/lib/iosApp";
import { applyTextScale, readTextScale } from "@/lib/textScale";

// 설치형 앱(Capacitor)으로 켜면 랭킹앱 홈이 아니라 얼굴 키오스크로 진입한다 (안드로이드 키오스크 APK).
// React Router 가 경로를 읽기 전에 바꿔야 하므로 렌더보다 먼저 실행.
// 아이폰 회원 앱(App Store, 2026-10-19)도 Capacitor 지만 회원 앱이라 제외한다.
if ((window as any).Capacitor?.isNativePlatform?.() && !isIosApp() && window.location.pathname === "/") {
  window.history.replaceState(null, "", "/face-kiosk");
}

// 아이폰 앱: 진동→햅틱 · 상태 표시줄 색 · 링크로 열기 (앱일 때만 내려받는다)
if (isIosApp()) void loadIosAppNative().then((m) => m.startIosApp()).catch(() => undefined);

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

// 브라우저 알림창(alert/confirm/prompt)은 그림을 못 넣는다 → 문구 속 이모지를 지운다 (2026-10-16 대표님: "이모지는 모두 빼고").
// 화면 글자·토스트의 이모지는 src/lib/emoji3d 가 153 입체 아이콘으로 바꾼다.
for (const k of ["alert", "confirm", "prompt"] as const) {
  const original = window[k].bind(window) as (...args: unknown[]) => unknown;
  (window as unknown as Record<string, unknown>)[k] = (message?: unknown, ...rest: unknown[]) =>
    original(typeof message === "string" ? stripEmoji(message) : message, ...rest);
}

// 초대 링크(?inv=코드)로 들어왔으면 코드를 남긴다 — 로그인하러 카카오에 다녀와도 쓰게 (2026-10-19)
captureInviteCodeFromUrl();

// 글씨 크기(내정보 · 작게/보통/크게) — 첫 화면을 그리기 전에 반영해 글씨가 바뀌며 깜빡이지 않게 (2026-10-28 리디자인)
applyTextScale(readTextScale());

createRoot(document.getElementById("root")!).render(<App />);
