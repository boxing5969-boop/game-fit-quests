/**
 * 🤖 안드로이드 앱(구글 플레이 '마이복서153') — 2026-10-20 대표님: "마이복서153 앱 구글 스토어에 출시되었어.
 *   안드로이드 회원님들은 라이브보드에 QR 찍으면 앱스토어에서 다운받을 수 있게 해 주고, 아이폰 회원님들은 지금과 같은 방식으로"
 *
 * 안드로이드 앱 = myboxer153.com 을 그대로 담은 앱(TWA, 패키지 kr.boxing153.myboxer — public/.well-known/assetlinks.json).
 *   · 앱이 깔린 폰은 QR(https://myboxer153.com/qr-checkin?…)을 찍으면 앱이 바로 열린다(앱 링크).
 *   · 앱이 없는 폰은 브라우저로 열린다 → 이때 구글 플레이로 안내한다 (components/install/AndroidAppGate).
 *   · 앱 안(전체 화면 = display-mode standalone · fullscreen, 또는 referrer android-app://)에서는 안내하지 않는다.
 * 아이폰은 그대로 — useInstallPrompt 의 iOS 흐름.
 */

export const ANDROID_APP_PACKAGE = "kr.boxing153.myboxer";
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_APP_PACKAGE}`;

export interface UaEnv {
  ua: string;
  /** display-mode: standalone · fullscreen · minimal-ui (앱 안 · 홈 화면에 추가한 앱) */
  standalone: boolean;
  /** document.referrer — 구글 플레이 앱이 화면을 열면 android-app://kr.boxing153.myboxer */
  referrer?: string;
}

/** 구글 플레이 앱이 연 화면인지 (앱 안에서 연결 확인이 늦어 일반 탭처럼 보일 때도 앱으로 본다) */
export const isFromAndroidApp = (referrer: string | undefined): boolean =>
  !!referrer && referrer.startsWith(`android-app://${ANDROID_APP_PACKAGE}`);

/** 안드로이드 폰의 브라우저(크롬 · 삼성 인터넷 · 카카오톡 안 화면 등)인지 — 앱 안이면 false */
export function isAndroidBrowserEnv(env: UaEnv): boolean {
  if (!/Android/i.test(env.ua)) return false;
  if (env.standalone) return false;
  return !isFromAndroidApp(env.referrer);
}

const APP_SEEN_KEY = "153app:android-app";
const APP_DISPLAY_MODES = ["standalone", "fullscreen", "minimal-ui"] as const;

function currentEnv(): UaEnv | null {
  if (typeof window === "undefined" || typeof navigator === "undefined") return null;
  let standalone = false;
  try {
    standalone = APP_DISPLAY_MODES.some((m) => !!window.matchMedia?.(`(display-mode: ${m})`).matches);
  } catch {
    standalone = false;
  }
  // 앱이 연 탭이면 기억해 둔다 — 화면 안에서 주소가 바뀌어도 앱으로 본다
  let referrer = typeof document !== "undefined" ? document.referrer : "";
  try {
    if (isFromAndroidApp(referrer)) window.sessionStorage.setItem(APP_SEEN_KEY, "1");
    else if (window.sessionStorage.getItem(APP_SEEN_KEY) === "1") referrer = `android-app://${ANDROID_APP_PACKAGE}/`;
  } catch {
    /* 저장이 막혀도 referrer 만으로 판단 */
  }
  return { ua: navigator.userAgent, standalone, referrer };
}

export function isAndroidBrowser(): boolean {
  const env = currentEnv();
  return env ? isAndroidBrowserEnv(env) : false;
}

/** 구글 플레이 앱(또는 홈 화면에 추가한 앱) 안인지 — 설치 버튼을 숨긴다 */
export function isInAndroidApp(): boolean {
  const env = currentEnv();
  return !!env && /Android/i.test(env.ua) && !isAndroidBrowserEnv(env);
}

/**
 * 이 주소를 앱으로 여는 안드로이드 링크 — 앱이 있으면 앱의 같은 화면, 없으면 구글 플레이.
 * (https 주소 · 경로·검색어 그대로)
 */
export function appIntentUrl(httpsUrl: string): string {
  const u = new URL(httpsUrl);
  const fallback = encodeURIComponent(PLAY_STORE_URL);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=${ANDROID_APP_PACKAGE};S.browser_fallback_url=${fallback};end`;
}
