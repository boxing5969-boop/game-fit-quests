/**
 * 📱 아이폰 앱 전용 기능 — iosApp.ts 의 loadIosAppNative() 로만 불러온다 (2026-10-19).
 *
 *   · 로그인: 구글·카카오는 '안전한 로그인 창'(앱의 WebAuth = ASWebAuthenticationSession) 으로.
 *            구글은 앱 속 웹 화면에서 로그인을 막는다(403 disallowed_useragent) — 이 길이 아니면 로그인이 안 된다.
 *            돌아오는 길: Supabase → https://myboxer153.com/app-auth-return/ → myboxer153://auth?… → 앱이 받아서
 *            이 화면을 '/?code=…' 로 다시 열면 Supabase 가 평소처럼 세션을 만든다.
 *   · 애플로 로그인: 앱의 AppleSignIn → supabase.auth.signInWithIdToken (App Store 심사 4.8)
 *   · 결제창: 앱 안 사파리 창(SFSafariViewController)으로 — 카드사 앱 이동이 그대로 된다
 *   · 휴대폰 알림: 애플 푸시(APNs) 기기 토큰 → push_subscribe_native
 *   · 알림을 누르면 그 화면으로, 진동(navigator.vibrate) → 아이폰 햅틱, 상태 표시줄 글자색 ↔ 테마
 */
import { registerPlugin } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

type Handle = { remove: () => Promise<void> };

interface WebAuthPlugin {
  start(o: { url: string; callbackScheme?: string; ephemeral?: boolean }): Promise<{ url: string }>;
}
interface AppleSignInPlugin {
  authorize(o: { nonce?: string }): Promise<{
    identityToken: string;
    authorizationCode?: string;
    user: string;
    email?: string;
    givenName?: string;
    familyName?: string;
  }>;
}
interface BrowserPlugin {
  open(o: { url: string; presentationStyle?: "fullscreen" | "popover"; toolbarColor?: string }): Promise<void>;
  addListener(e: "browserFinished", f: () => void): Promise<Handle>;
}
type PermState = "prompt" | "prompt-with-rationale" | "granted" | "denied";
interface PushMsg {
  id?: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}
interface PushPlugin {
  checkPermissions(): Promise<{ receive: PermState }>;
  requestPermissions(): Promise<{ receive: PermState }>;
  register(): Promise<void>;
  unregister(): Promise<void>;
  addListener(e: "registration", f: (t: { value: string }) => void): Promise<Handle>;
  addListener(e: "registrationError", f: (err: { error: string }) => void): Promise<Handle>;
  addListener(e: "pushNotificationReceived", f: (n: PushMsg) => void): Promise<Handle>;
  addListener(e: "pushNotificationActionPerformed", f: (a: { actionId: string; notification: PushMsg }) => void): Promise<Handle>;
}
interface AppPlugin {
  addListener(e: "appUrlOpen", f: (d: { url: string }) => void): Promise<Handle>;
}
interface HapticsPlugin {
  impact(o: { style: "HEAVY" | "MEDIUM" | "LIGHT" }): Promise<void>;
}
interface StatusBarPlugin {
  setStyle(o: { style: "DARK" | "LIGHT" | "DEFAULT" }): Promise<void>;
}

const WebAuth = registerPlugin<WebAuthPlugin>("WebAuth");
const AppleSignIn = registerPlugin<AppleSignInPlugin>("AppleSignIn");
const Browser = registerPlugin<BrowserPlugin>("Browser");
const Push = registerPlugin<PushPlugin>("PushNotifications");
const App = registerPlugin<AppPlugin>("App");
const Haptics = registerPlugin<HapticsPlugin>("Haptics");
const StatusBar = registerPlugin<StatusBarPlugin>("StatusBar");

const APP_ORIGIN = "https://myboxer153.com";
const AUTH_RETURN = `${APP_ORIGIN}/app-auth-return/`;
const CALLBACK_SCHEME = "myboxer153";

/** 로그인 창을 사람이 닫았는지 */
export const isCanceled = (e: unknown): boolean => {
  const x = e as { code?: string; message?: string } | null;
  return x?.code === "CANCELED" || /cancel/i.test(String(x?.message ?? ""));
};

/** 앱 안 경로만 (알림·링크로 들어온 주소 검사 — lib/notifications isSafeAppLink 와 같은 규칙) */
export const safeAppPath = (p: unknown): string | null =>
  typeof p === "string" && p.length <= 300 && /^\/([^/\\\s][^\\\s]*)?$/.test(p) ? p : null;

/** 새로고침 없이 앱 안 경로로 (React Router 가 popstate 를 듣는다) */
export function goPath(path: string): void {
  const safe = safeAppPath(path);
  if (!safe) return;
  if (window.location.pathname + window.location.search === safe) return;
  window.history.pushState(null, "", safe);
  window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
}

// ── 로그인 ───────────────────────────────────────────────

/**
 * 구글·카카오 로그인 — 성공하면 화면이 '/?code=…' 로 다시 열리며 로그인된다(이 함수는 돌아오지 않을 수 있다).
 * 실패하면 오류 문장, 사람이 창을 닫으면 null.
 */
export async function signInWithOAuthInApp(provider: "google" | "kakao", scopes?: string): Promise<string | null> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: AUTH_RETURN, skipBrowserRedirect: true, ...(scopes ? { scopes } : {}) },
  });
  if (error || !data?.url) return error?.message || "로그인 주소를 받지 못했습니다";
  let back: string;
  try {
    back = (await WebAuth.start({ url: data.url, callbackScheme: CALLBACK_SCHEME })).url;
  } catch (e) {
    if (isCanceled(e)) return null;
    return (e as Error)?.message || "로그인 창을 열지 못했습니다";
  }
  const u = new URL(back);
  const err = u.searchParams.get("error_description") || new URLSearchParams(u.hash.slice(1)).get("error_description");
  if (err) return err;
  // PKCE(?code=) 든 토큰(#access_token=) 이든 Supabase 가 화면을 열 때 알아서 세션을 만든다
  window.location.replace(`/${u.search}${u.hash}`);
  return null;
}

const sha256Hex = async (s: string): Promise<string> => {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return Array.from(d, (b) => b.toString(16).padStart(2, "0")).join("");
};

/** 애플로 로그인 — 성공 true, 사람이 닫으면 null, 실패하면 오류 문장 */
export async function signInWithAppleInApp(): Promise<true | null | string> {
  const raw = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
  let r: Awaited<ReturnType<AppleSignInPlugin["authorize"]>>;
  try {
    r = await AppleSignIn.authorize({ nonce: await sha256Hex(raw) });
  } catch (e) {
    if (isCanceled(e)) return null;
    return (e as Error)?.message || "애플 로그인을 시작하지 못했습니다";
  }
  const { data, error } = await supabase.auth.signInWithIdToken({ provider: "apple", token: r.identityToken, nonce: raw });
  if (error) return error.message;
  // 애플은 이름을 처음 한 번만 준다 → 비어 있으면 계정 정보에 남겨 둔다(가입 신청서가 이름을 미리 채운다)
  const name = [r.familyName, r.givenName].filter(Boolean).join("");
  const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
  if (name && !meta.full_name && !meta.name) {
    await supabase.auth.updateUser({ data: { full_name: name, name } }).catch(() => undefined);
  }
  return true;
}

// ── 결제창·바깥 주소 ──────────────────────────────────────

/** 앱 안 사파리 창으로 연다. 창을 닫으면 onClose (결제 결과 다시 읽기 등) */
export async function openInAppBrowser(url: string, onClose?: () => void): Promise<void> {
  if (onClose) {
    const h = await Browser.addListener("browserFinished", () => {
      void h.remove();
      onClose();
    });
  }
  await Browser.open({ url, presentationStyle: "fullscreen" });
}

// ── 휴대폰 알림 (애플 푸시) ────────────────────────────────

let lastToken: string | null = null;

/** 지금 권한 */
export async function pushPermission(): Promise<PermState> {
  try {
    return (await Push.checkPermissions()).receive;
  } catch {
    return "denied";
  }
}

/** 권한 묻기 (버튼을 누른 그 자리에서) */
export async function requestPushPermission(): Promise<PermState> {
  try {
    return (await Push.requestPermissions()).receive;
  } catch {
    return "denied";
  }
}

/** 애플에 등록하고 기기 토큰을 받는다 (권한이 허용된 뒤에만) */
export function registerForPush(timeoutMs = 15_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const handles: Handle[] = [];
    const done = (fn: () => void) => {
      window.clearTimeout(timer);
      handles.forEach((h) => void h.remove());
      fn();
    };
    const timer = window.setTimeout(() => done(() => reject(new Error("timeout"))), timeoutMs);
    void Push.addListener("registration", (t) => {
      lastToken = t.value.toLowerCase();
      done(() => resolve(lastToken as string));
    }).then((h) => handles.push(h));
    void Push.addListener("registrationError", (e) => done(() => reject(new Error(e.error || "registration_error")))).then((h) =>
      handles.push(h),
    );
    void Push.register().catch((e) => done(() => reject(e)));
  });
}

/** 이 기기에서 알림 받지 않기 (로그아웃·끄기) */
export async function unregisterPush(): Promise<void> {
  await Push.unregister().catch(() => undefined);
}

export const cachedPushToken = (): string | null => lastToken;

// ── 앱이 켜질 때 한 번 ───────────────────────────────────

let started = false;

/** 앱 전용 연결 — main.tsx 에서 한 번 부른다. 알림을 누르면 열 경로는 onOpenPath 로 */
export function startIosApp(): void {
  if (started) return;
  started = true;

  // 진동: 웹 코드의 navigator.vibrate 를 아이폰 햅틱으로 (아이폰 웹 화면에는 vibrate 가 없다)
  try {
    const vib = (pattern: VibratePattern): boolean => {
      const first = Array.isArray(pattern) ? Number(pattern[0] ?? 0) : Number(pattern ?? 0);
      if (first > 0) void Haptics.impact({ style: first >= 60 ? "HEAVY" : first >= 25 ? "MEDIUM" : "LIGHT" }).catch(() => undefined);
      return true;
    };
    Object.defineProperty(navigator, "vibrate", { value: vib, configurable: true });
  } catch {
    /* 못 바꿔도 앱은 돈다 */
  }

  // 상태 표시줄 글자색 — 화면 배경(theme-color)이 어두우면 흰 글자
  const syncStatusBar = () => {
    const c = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content ?? "#F2F4F6";
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(c.trim());
    const lum = m ? (0.299 * parseInt(m[1], 16) + 0.587 * parseInt(m[2], 16) + 0.114 * parseInt(m[3], 16)) / 255 : 1;
    void StatusBar.setStyle({ style: lum < 0.5 ? "DARK" : "LIGHT" }).catch(() => undefined);
  };
  syncStatusBar();
  new MutationObserver(syncStatusBar).observe(document.head, { subtree: true, childList: true, attributes: true, attributeFilter: ["content"] });

  // myboxer153.com 링크(초대 링크 등)로 앱이 열리면 그 화면으로
  void App.addListener("appUrlOpen", ({ url }) => {
    try {
      const u = new URL(url);
      if (u.origin === APP_ORIGIN) {
        // 쿼리가 있는 링크(초대 ?inv= 등)는 첫 화면 처리(main.tsx)가 읽도록 새로 연다
        if (u.search) window.location.assign(`${u.pathname}${u.search}${u.hash}`);
        else goPath(u.pathname);
      }
    } catch {
      /* 모르는 주소 */
    }
  });
}

/** 알림 연결 — PushBridge 가 화면에 붙을 때. 반환값으로 떼어 낸다 */
export function listenPush(onOpenPath: (path: string) => void, onReceived: () => void): () => void {
  const handles: Promise<Handle>[] = [
    Push.addListener("pushNotificationActionPerformed", (a) => {
      const p = safeAppPath(a.notification?.data?.url) ?? "/notifications";
      onOpenPath(p);
    }),
    Push.addListener("pushNotificationReceived", () => onReceived()),
  ];
  return () => handles.forEach((h) => void h.then((x) => x.remove()).catch(() => undefined));
}
