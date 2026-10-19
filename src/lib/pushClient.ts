/**
 * 📲 휴대폰 알림(웹 푸시) — 이 기기 구독 켜기 · 끄기 · 동기화 (2026-10-01 대표님).
 *
 * 흐름: 알림함(notifications)에 새 알림이 저장되면 DB 트리거 → push-send 에지 함수가 이 기기 구독 주소로 보낸다.
 *   · 켜기   : 권한 묻기(버튼을 누른 그 순간 — 아이폰은 그때만 물어볼 수 있다) → 구독 → push_subscribe
 *   · 끄기   : 구독 해제 → push_unsubscribe
 *   · 앱 열 때: 이 기기를 켠 사람이 지금 로그인한 사람이면 하루 한 번 '살아 있음'을 알린다 (주소가 바뀌었으면 새 주소로).
 *              다른 사람이 켠 구독이면 지운다 — 한 폰을 둘이 써도 앞사람 알림이 오지 않게.
 *   · 로그아웃: 이 기기 구독을 지운다 (서버 기록은 다음 발송 때 '없는 주소'로 확인되어 저절로 꺼진다).
 * 아이폰은 iOS 16.4 이상 + '홈 화면에 추가'한 앱에서만 된다 (사파리 탭·카카오톡 안 화면에서는 안 된다).
 * 이 파일은 개인정보를 저장하지 않는다 — 기기 이름은 '아이폰'·'안드로이드' 정도만.
 *
 * 아이폰 앱(App Store, 2026-10-19)은 웹 푸시 대신 애플 푸시(APNs)를 쓴다 — 아래 각 함수 맨 앞의 isIosApp() 갈래.
 *   같은 함수·같은 화면(PushOptInCard)·같은 보상 그대로, 서버 등록만 push_subscribe_native('apns:<토큰>').
 */
import { supabase } from "@/integrations/supabase/client";
import { isIosApp, loadIosAppNative } from "@/lib/iosApp";

// 휴대폰 알림 함수들은 생성된 타입보다 새것이라 느슨한 클라이언트로 부른다
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** 이 기기에서 못 쓰는 이유 */
export type PushBlock =
  | "in-app" // 카카오톡·네이버 등 앱 안의 브라우저
  | "ios-install" // 아이폰 사파리 탭 — 홈 화면에 추가해야 한다
  | "ios-old" // 홈 화면 앱인데 iOS 16.4 미만
  | "no-sw" // 서비스워커 없음 (아주 오래된 브라우저 · 개발 주소)
  | "no-push"; // 웹 푸시를 지원하지 않는 브라우저

export type PushState =
  | { kind: "unsupported"; why: PushBlock }
  | { kind: "denied" }
  | { kind: "off" }
  | { kind: "on" };

export interface PushEnv {
  ua: string;
  maxTouchPoints: number;
  standalone: boolean;
  hasSW: boolean;
  hasPush: boolean;
  hasNotification: boolean;
}

const OWNER_KEY = "153push:owner";
const SYNC_KEY = "153push:sync";
/** 아이폰 앱 — 이 기기 애플 푸시 토큰 */
const NATIVE_TOKEN_KEY = "153push:apns";

export const isIosUA = (ua: string, maxTouchPoints = 0): boolean =>
  /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);

/** 카카오톡·네이버·인스타 등 앱 안의 브라우저 (안드로이드 웹뷰 포함) */
export const isInAppUA = (ua: string): boolean =>
  /KAKAOTALK|NAVER\(inapp|DaumApps|Line\/|FBAN|FBAV|Instagram|everytimeApp|; wv\)/i.test(ua);

/** 이 기기에서 휴대폰 알림을 쓸 수 있는지 — 못 쓰면 그 이유 (순수 함수) */
export function pushBlockFrom(env: PushEnv): PushBlock | null {
  const ios = isIosUA(env.ua, env.maxTouchPoints);
  if (isInAppUA(env.ua)) return "in-app";
  if (ios && !env.standalone) return "ios-install";
  if (!env.hasSW) return "no-sw";
  if (!env.hasPush || !env.hasNotification) return ios ? "ios-old" : "no-push";
  return null;
}

export function currentPushEnv(): PushEnv {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { ua: "", maxTouchPoints: 0, standalone: false, hasSW: false, hasPush: false, hasNotification: false };
  }
  const nav = navigator as Navigator & { standalone?: boolean };
  let standalone = nav.standalone === true;
  try {
    standalone = standalone || !!window.matchMedia?.("(display-mode: standalone)").matches;
  } catch {
    /* matchMedia 없음 */
  }
  return {
    ua: nav.userAgent || "",
    maxTouchPoints: nav.maxTouchPoints || 0,
    standalone,
    hasSW: "serviceWorker" in nav,
    hasPush: "PushManager" in window,
    hasNotification: "Notification" in window,
  };
}

export const pushBlock = (): PushBlock | null => (isIosApp() ? null : pushBlockFrom(currentPushEnv()));

/** 관리자가 볼 기기 이름 — 모델명 없이 종류만 */
export function deviceLabelFrom(ua: string, maxTouchPoints = 0): string {
  if (isIosUA(ua, maxTouchPoints)) return /iPad|Macintosh/.test(ua) ? "아이패드" : "아이폰";
  if (/Android/i.test(ua)) return /SamsungBrowser/i.test(ua) ? "안드로이드 · 삼성 인터넷" : "안드로이드";
  if (/Windows/i.test(ua)) return "윈도우 PC";
  if (/Macintosh|Mac OS X/i.test(ua)) return "맥";
  return "기타 기기";
}

/** base64url → 바이트 (서버 공개키) */
export function b64urlToBytes(s: string): Uint8Array {
  const clean = s.replace(/=+$/, "").replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(clean + "===".slice((clean.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 이 구독이 지금 서버 키로 만든 것인지 */
export function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const x = new Uint8Array(a);
  if (x.length !== b.length) return false;
  for (let i = 0; i < x.length; i++) if (x[i] !== b[i]) return false;
  return true;
}

/** 하루 한 번 동기화 표시 (한국 날짜) */
export const kstDay = (now: Date = new Date()): string => new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);

const ls = {
  get(k: string): string | null {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      window.localStorage.setItem(k, v);
    } catch {
      /* 저장 못 해도 동작은 한다 (다음에 한 번 더 동기화할 뿐) */
    }
  },
  del(k: string) {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* noop */
    }
  },
};

const toArrayBuffer = (u: Uint8Array): ArrayBuffer => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

/** 이 앱의 서비스워커 (없으면 잠깐 기다린다 — 첫 방문 직후엔 아직 등록 중일 수 있다) */
async function swRegistration(timeoutMs = 4000): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration().catch(() => undefined);
  if (existing?.active) return existing;
  return Promise.race([
    navigator.serviceWorker.ready.catch(() => null),
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await swRegistration(2500);
  if (!reg) return null;
  return reg.pushManager.getSubscription().catch(() => null);
}

/** 지금 이 기기 상태 — 다른 사람이 켠 구독은 '꺼짐'으로 본다 */
export async function readPushState(uid: string | null | undefined): Promise<PushState> {
  if (isIosApp()) return readNativeState(uid);
  const why = pushBlock();
  if (why) return { kind: "unsupported", why };
  if (Notification.permission === "denied") return { kind: "denied" };
  const reg = await swRegistration(2500);
  if (!reg) return { kind: "unsupported", why: "no-sw" };
  const sub = await reg.pushManager.getSubscription().catch(() => null);
  const mine = !!uid && ls.get(OWNER_KEY) === uid;
  return sub && mine && Notification.permission === "granted" ? { kind: "on" } : { kind: "off" };
}

async function registerOnServer(sub: PushSubscription): Promise<{ ok: boolean; devices: number; error?: string }> {
  const j = sub.toJSON();
  const { data, error } = await db.rpc("push_subscribe", {
    p_endpoint: j.endpoint ?? sub.endpoint,
    p_p256dh: j.keys?.p256dh ?? "",
    p_auth: j.keys?.auth ?? "",
    p_device: deviceLabelFrom(navigator.userAgent, navigator.maxTouchPoints || 0),
  });
  if (error) return { ok: false, devices: 0, error: errText(error) };
  const r = (data ?? {}) as { ok?: boolean; devices?: number; error?: string };
  return r.ok ? { ok: true, devices: Number(r.devices) || 1 } : { ok: false, devices: 0, error: r.error || "failed" };
}

/** 권한 묻기 — 옛 사파리는 콜백 방식이라 둘 다 받는다 */
function askPermission(): Promise<NotificationPermission> {
  return new Promise((resolve) => {
    try {
      const p = Notification.requestPermission((r) => resolve(r));
      if (p && typeof p.then === "function") p.then(resolve, () => resolve("default"));
    } catch {
      resolve("default");
    }
  });
}

/** 켜기가 어디서 막혔는지 — 2026-10-18 오류 신고("소리 켜기가 와이파이 연결 안 됐다고 나와요")로 원인을 나눠 안내·기록한다 */
export type PushFailStage = "key" | "subscribe" | "server" | "unknown";

export type EnableResult =
  | { ok: true; devices: number }
  | { ok: false; reason: "unsupported" | "denied" | "dismissed" | "unsupported_endpoint" }
  | { ok: false; reason: "failed"; stage: PushFailStage; detail: string };

const errText = (e: unknown): string => {
  const x = e as { name?: string; message?: string } | null;
  return `${x?.name ?? "Error"}: ${String(x?.message ?? e ?? "").slice(0, 200)}`;
};
const failed = (stage: PushFailStage, detail: string): EnableResult => ({ ok: false, reason: "failed", stage, detail });

/**
 * 켜기 — 반드시 버튼을 누른 그 자리에서 부른다.
 * 아이폰은 '누른 순간'에만 권한 창을 띄워 주므로, 권한 묻기 앞에 다른 await 를 두지 않는다.
 */
export async function enablePush(uid: string): Promise<EnableResult> {
  if (isIosApp()) return enableNative(uid);
  if (pushBlock()) return { ok: false, reason: "unsupported" };
  const perm = Notification.permission === "granted" ? "granted" : await askPermission();
  if (perm !== "granted") return { ok: false, reason: perm === "denied" ? "denied" : "dismissed" };
  let stage: PushFailStage = "key";
  try {
    const { data: key, error: keyErr } = await db.rpc("get_push_public_key");
    if (keyErr || typeof key !== "string" || !key) return failed("key", keyErr ? errText(keyErr) : "no key");
    stage = "unknown";
    const reg = await swRegistration();
    if (!reg) return { ok: false, reason: "unsupported" };
    const appKey = b64urlToBytes(key);
    let sub = await reg.pushManager.getSubscription();
    if (sub && !sameKey(sub.options?.applicationServerKey, appKey)) {
      await sub.unsubscribe().catch(() => false);
      sub = null;
    }
    stage = "subscribe";
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toArrayBuffer(appKey) });
    stage = "server";
    const r = await registerOnServer(sub);
    if (!r.ok) {
      if (r.error === "unsupported_endpoint") {
        await sub.unsubscribe().catch(() => false);
        return { ok: false, reason: "unsupported_endpoint" };
      }
      return failed("server", r.error || "failed");
    }
    ls.set(OWNER_KEY, uid);
    ls.set(SYNC_KEY, `${uid}|${sub.endpoint}|${kstDay()}`);
    return { ok: true, devices: r.devices };
  } catch (e) {
    return failed(stage, errText(e));
  }
}

/** 켜기 실패 기록 — 원인을 나중에 확인하려고 (기기·단계·오류 이름만, 하루 20건까지). 실패해도 화면엔 영향 없음 */
export async function logPushEnableFailure(stage: PushFailStage, detail: string): Promise<void> {
  try {
    await db.rpc("log_push_enable_failure", {
      p_stage: stage,
      p_detail: detail.slice(0, 300),
      p_ua: typeof navigator === "undefined" ? "" : navigator.userAgent.slice(0, 300),
    });
  } catch {
    /* 기록은 덤 */
  }
}

/**
 * 등록(subscribe) 단계 오류가 알림 서버 연결 문제인지 — AbortError("Registration failed - push service error" 등)·'push service'.
 * 브라우저가 막은 게 아니라 알림 서버에 닿지 못한 것이라 '인터넷 연결 확인'으로 안내한다 (2026-10-19).
 * NotAllowedError(권한 거절)는 여기 들지 않는다 — subscribeHelp 로 안내.
 */
export function isPushServiceError(detail: string): boolean {
  if (/\bNotAllowedError\b/.test(detail)) return false;
  return /\bAbortError\b/.test(detail) || /push service/i.test(detail);
}

/**
 * 브라우저가 알림 등록(subscribe)을 거절했을 때 — 기기별 안내.
 * 등록은 사이트 알림 권한이 이미 '허용'인 뒤에만 시도한다 → 사이트 설정이 아니라 휴대폰의 앱 알림 설정을 안내한다 (2026-10-19).
 */
export function subscribeHelp(ua: string = typeof navigator === "undefined" ? "" : navigator.userAgent): string {
  if (/SamsungBrowser/i.test(ua)) {
    // 운영 기록(SamsungBrowser/30): 사이트 권한은 허용인데 'NotAllowedError: Registration failed - permission denied'
    //   = 휴대폰 설정에서 삼성 인터넷 앱의 알림이 꺼져 있을 때
    return "휴대폰에서 삼성 인터넷 앱의 알림이 꺼져 있어요. 휴대폰 설정 → 애플리케이션 → 삼성 인터넷 → 알림 → 허용으로 바꾼 뒤 다시 눌러 주세요. 또는 Chrome으로 마이복서153을 열어 '알림 켜기'를 눌러 주세요.";
  }
  if (isIosUA(ua, typeof navigator === "undefined" ? 0 : navigator.maxTouchPoints || 0)) {
    // 아이폰은 홈 화면 앱에서만 여기까지 온다 (사파리 탭은 pushBlock 'ios-install' 에서 먼저 막힌다)
    return "아이폰 설정 → 알림 → 마이복서153 → '알림 허용'을 켠 뒤 다시 눌러 주세요. 집중 모드나 스크린 타임에서 알림을 막아 두지 않았는지도 확인해 주세요.";
  }
  if (/Android/i.test(ua)) {
    return "휴대폰 설정 → 애플리케이션 → Chrome(또는 마이복서153) → 알림이 켜져 있는지 확인하고 다시 눌러 주세요.";
  }
  return "브라우저 설정에서 이 사이트의 알림을 허용한 뒤 다시 눌러 주세요.";
}

/** 끄기 — 이 기기만 (다른 기기는 그대로) */
export async function disablePush(): Promise<boolean> {
  if (isIosApp()) return disableNative();
  const sub = await currentSubscription();
  ls.del(OWNER_KEY);
  ls.del(SYNC_KEY);
  if (!sub) return true;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => false);
  const { error } = await db.rpc("push_unsubscribe", { p_endpoint: endpoint });
  return !error;
}

/** 테스트 알림 — 서버가 알림함에 한 줄 넣으면 그게 휴대폰으로 간다 */
export async function sendTestPush(): Promise<{ ok: true } | { ok: false; reason: "too_soon" | "no_subscription" | "failed" }> {
  const { data, error } = await db.rpc("send_test_push");
  if (error) return { ok: false, reason: "failed" };
  const r = (data ?? {}) as { ok?: boolean; error?: string };
  if (r.ok) return { ok: true };
  return { ok: false, reason: r.error === "too_soon" || r.error === "no_subscription" ? r.error : "failed" };
}

/**
 * 앱을 열 때 (로그인한 사람) — 이 기기를 켠 사람이면 하루 한 번 서버에 알린다.
 * 다른 사람이 켠 구독(또는 주인을 모르는 구독)은 지운다.
 */
export async function syncPushSubscription(uid: string): Promise<void> {
  if (isIosApp()) return syncNative(uid);
  if (!uid || pushBlock() || Notification.permission !== "granted") return;
  const sub = await currentSubscription();
  if (!sub) return;
  if (ls.get(OWNER_KEY) !== uid) {
    await sub.unsubscribe().catch(() => false);
    ls.del(OWNER_KEY);
    ls.del(SYNC_KEY);
    return;
  }
  const stamp = `${uid}|${sub.endpoint}|${kstDay()}`;
  if (ls.get(SYNC_KEY) === stamp) return;
  const r = await registerOnServer(sub);
  if (r.ok) ls.set(SYNC_KEY, stamp);
}

/** 로그아웃 — 이 기기 구독을 지운다 (이미 로그아웃된 뒤라 서버 함수는 부르지 않는다) */
export async function forgetPushOnThisDevice(): Promise<void> {
  ls.del(OWNER_KEY);
  ls.del(SYNC_KEY);
  if (isIosApp()) {
    ls.del(NATIVE_TOKEN_KEY);
    await (await loadIosAppNative()).unregisterPush();
    return;
  }
  if (pushBlock()) return;
  const sub = await currentSubscription();
  await sub?.unsubscribe().catch(() => false);
}

// ── 아이폰 앱(App Store) — 애플 푸시 ─────────────────────────────

const NATIVE_DEVICE = "아이폰 앱";

async function readNativeState(uid: string | null | undefined): Promise<PushState> {
  const m = await loadIosAppNative();
  const perm = await m.pushPermission();
  if (perm === "denied") return { kind: "denied" };
  const mine = !!uid && ls.get(OWNER_KEY) === uid && !!ls.get(NATIVE_TOKEN_KEY);
  return perm === "granted" && mine ? { kind: "on" } : { kind: "off" };
}

async function registerNativeOnServer(token: string): Promise<{ ok: boolean; devices: number; error?: string }> {
  const { data, error } = await db.rpc("push_subscribe_native", { p_token: token, p_device: NATIVE_DEVICE, p_env: "production" });
  if (error) return { ok: false, devices: 0, error: errText(error) };
  const r = (data ?? {}) as { ok?: boolean; devices?: number; error?: string };
  return r.ok ? { ok: true, devices: Number(r.devices) || 1 } : { ok: false, devices: 0, error: r.error || "failed" };
}

async function enableNative(uid: string): Promise<EnableResult> {
  const m = await loadIosAppNative();
  let perm = await m.pushPermission();
  if (perm !== "granted") perm = await m.requestPushPermission();
  if (perm !== "granted") return { ok: false, reason: perm === "denied" ? "denied" : "dismissed" };
  let token: string;
  try {
    token = await m.registerForPush();
  } catch (e) {
    return failed("subscribe", errText(e));
  }
  const r = await registerNativeOnServer(token);
  if (!r.ok) return failed("server", r.error || "failed");
  ls.set(OWNER_KEY, uid);
  ls.set(NATIVE_TOKEN_KEY, token);
  ls.set(SYNC_KEY, `${uid}|apns:${token}|${kstDay()}`);
  return { ok: true, devices: r.devices };
}

async function disableNative(): Promise<boolean> {
  const token = ls.get(NATIVE_TOKEN_KEY);
  ls.del(OWNER_KEY);
  ls.del(SYNC_KEY);
  ls.del(NATIVE_TOKEN_KEY);
  await (await loadIosAppNative()).unregisterPush();
  if (!token) return true;
  const { error } = await db.rpc("push_unsubscribe", { p_endpoint: `apns:${token}` });
  return !error;
}

/** 앱을 열 때 — 켠 사람이면 하루 한 번 토큰을 다시 받아 서버에 알린다(토큰은 바뀔 수 있다). 다른 사람이 켠 기기면 끈다 */
async function syncNative(uid: string): Promise<void> {
  if (!uid) return;
  const token = ls.get(NATIVE_TOKEN_KEY);
  if (!token) return;
  const m = await loadIosAppNative();
  if (ls.get(OWNER_KEY) !== uid) {
    ls.del(OWNER_KEY);
    ls.del(SYNC_KEY);
    ls.del(NATIVE_TOKEN_KEY);
    await m.unregisterPush();
    return;
  }
  if ((await m.pushPermission()) !== "granted") return;
  const stamp = `${uid}|apns:${token}|${kstDay()}`;
  if (ls.get(SYNC_KEY) === stamp) return;
  let fresh = token;
  try {
    fresh = await m.registerForPush();
  } catch {
    return;
  }
  const r = await registerNativeOnServer(fresh);
  if (r.ok) {
    ls.set(NATIVE_TOKEN_KEY, fresh);
    ls.set(SYNC_KEY, `${uid}|apns:${fresh}|${kstDay()}`);
  }
}
