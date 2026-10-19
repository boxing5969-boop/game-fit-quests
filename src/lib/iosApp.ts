/**
 * 📱 아이폰 앱(App Store '마이복서153') 안에서 열렸는지 (2026-10-19 대표님: 애플스토어 등록).
 *
 * 아이폰 앱은 myboxer153.com 을 그대로 담는다(ios-app/ 폴더, Capacitor) — 웹을 고치면 앱도 바로 바뀐다(재심사 없음).
 * 앱은 User-Agent 끝에 'MyBoxer153App' 을 붙이고, 앱 기능 다리(window.Capacitor)를 넣어 준다.
 *
 * 이 파일은 가볍게 '앱인지'만 본다. 실제 앱 기능(로그인 창·알림·진동 …)은 iosAppNative.ts 를 필요할 때만 불러온다
 * — 웹·안드로이드 회원은 그 코드를 내려받지 않는다.
 *
 * 안드로이드 얼굴 출석 키오스크(Capacitor)와 헷갈리지 않게: 키오스크는 이 표시가 없다.
 */
export const IOS_APP_MARK = "MyBoxer153App";

/** 아이폰 앱 화면인지 */
export function isIosApp(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  if (!navigator.userAgent.includes(IOS_APP_MARK)) return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return cap?.isNativePlatform?.() === true;
}

/** 앱 기능 모듈 (필요할 때만 내려받는다) */
export const loadIosAppNative = () => import("./iosAppNative");
