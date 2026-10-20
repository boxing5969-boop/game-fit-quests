import { describe, expect, it } from "vitest";
import { ANDROID_APP_PACKAGE, PLAY_STORE_URL, appIntentUrl, isAndroidBrowserEnv } from "./androidApp";

const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
const ANDROID_KAKAO = "Mozilla/5.0 (Linux; Android 13; SM-G991N Build/TP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 KAKAOTALK 10.8.0";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";

describe("안드로이드 앱(구글 플레이) 안내 — 2026-10-20", () => {
  it("구글 플레이 주소 = 앱 링크 패키지(assetlinks)와 같다", () => {
    expect(ANDROID_APP_PACKAGE).toBe("kr.boxing153.myboxer");
    expect(PLAY_STORE_URL).toBe("https://play.google.com/store/apps/details?id=kr.boxing153.myboxer");
  });

  it("안드로이드 브라우저만 안내 — 앱 안(전체 화면) · 아이폰 · 컴퓨터는 아니다", () => {
    expect(isAndroidBrowserEnv({ ua: ANDROID_CHROME, standalone: false })).toBe(true);
    expect(isAndroidBrowserEnv({ ua: ANDROID_KAKAO, standalone: false })).toBe(true);
    expect(isAndroidBrowserEnv({ ua: ANDROID_CHROME, standalone: true })).toBe(false);
    expect(isAndroidBrowserEnv({ ua: IPHONE, standalone: false })).toBe(false);
    expect(isAndroidBrowserEnv({ ua: DESKTOP, standalone: false })).toBe(false);
  });

  it("구글 플레이 앱이 연 화면(referrer android-app://)은 앱으로 본다 — 다른 앱이 연 건 아니다", () => {
    expect(isAndroidBrowserEnv({ ua: ANDROID_CHROME, standalone: false, referrer: "android-app://kr.boxing153.myboxer/" })).toBe(false);
    expect(isAndroidBrowserEnv({ ua: ANDROID_CHROME, standalone: false, referrer: "android-app://com.kakao.talk/" })).toBe(true);
    expect(isAndroidBrowserEnv({ ua: ANDROID_CHROME, standalone: false, referrer: "https://myboxer153.com/" })).toBe(true);
    expect(isAndroidBrowserEnv({ ua: ANDROID_CHROME, standalone: false, referrer: "" })).toBe(true);
  });

  it("앱으로 열기 링크 — 같은 화면 · 없으면 구글 플레이", () => {
    const u = appIntentUrl("https://myboxer153.com/qr-checkin?b=sunreung&t=abc123");
    expect(u.startsWith("intent://myboxer153.com/qr-checkin?b=sunreung&t=abc123#Intent;")).toBe(true);
    expect(u).toContain("scheme=https;");
    expect(u).toContain("package=kr.boxing153.myboxer;");
    expect(u).toContain(`S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`);
  });
});
