import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

import {
  b64urlToBytes,
  deviceLabelFrom,
  enablePush,
  forgetPushOnThisDevice,
  isInAppUA,
  kstDay,
  pushBlockFrom,
  readPushState,
  sameKey,
  syncPushSubscription,
  type PushEnv,
} from "./pushClient";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";
const SAMSUNG = "Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36";
const KAKAO_IOS = `${IPHONE} KAKAOTALK 10.8.5`;
const KAKAO_ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 KAKAOTALK/10.8.5";
const IPAD_DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";

const env = (p: Partial<PushEnv>): PushEnv => ({
  ua: ANDROID,
  maxTouchPoints: 5,
  standalone: false,
  hasSW: true,
  hasPush: true,
  hasNotification: true,
  ...p,
});

describe("pushBlockFrom — 이 기기에서 휴대폰 알림을 쓸 수 있나", () => {
  it("안드로이드 크롬은 탭에서도 된다", () => {
    expect(pushBlockFrom(env({}))).toBeNull();
    expect(pushBlockFrom(env({ ua: SAMSUNG }))).toBeNull();
  });
  it("아이폰 사파리 탭은 홈 화면에 추가해야 한다", () => {
    expect(pushBlockFrom(env({ ua: IPHONE, standalone: false }))).toBe("ios-install");
  });
  it("아이폰 홈 화면 앱은 된다 · 옛 iOS(푸시 없음)는 업데이트 안내", () => {
    expect(pushBlockFrom(env({ ua: IPHONE, standalone: true }))).toBeNull();
    expect(pushBlockFrom(env({ ua: IPHONE, standalone: true, hasPush: false }))).toBe("ios-old");
  });
  it("아이패드(데스크톱 표시)도 아이폰과 같은 규칙", () => {
    expect(pushBlockFrom(env({ ua: IPAD_DESKTOP, maxTouchPoints: 5, standalone: false }))).toBe("ios-install");
    // 진짜 맥(터치 없음)은 사파리 탭에서도 된다
    expect(pushBlockFrom(env({ ua: IPAD_DESKTOP, maxTouchPoints: 0 }))).toBeNull();
  });
  it("카카오톡 안 화면은 어디서든 막는다", () => {
    expect(isInAppUA(KAKAO_IOS)).toBe(true);
    expect(isInAppUA(KAKAO_ANDROID)).toBe(true);
    expect(isInAppUA(ANDROID)).toBe(false);
    expect(pushBlockFrom(env({ ua: KAKAO_IOS, standalone: true }))).toBe("in-app");
    expect(pushBlockFrom(env({ ua: KAKAO_ANDROID }))).toBe("in-app");
  });
  it("서비스워커·푸시가 없는 브라우저", () => {
    expect(pushBlockFrom(env({ hasSW: false }))).toBe("no-sw");
    expect(pushBlockFrom(env({ hasPush: false }))).toBe("no-push");
    expect(pushBlockFrom(env({ hasNotification: false }))).toBe("no-push");
  });
});

describe("작은 도우미", () => {
  it("기기 이름은 종류만", () => {
    expect(deviceLabelFrom(IPHONE)).toBe("아이폰");
    expect(deviceLabelFrom(IPAD_DESKTOP, 5)).toBe("아이패드");
    expect(deviceLabelFrom(ANDROID)).toBe("안드로이드");
    expect(deviceLabelFrom(SAMSUNG)).toBe("안드로이드 · 삼성 인터넷");
    expect(deviceLabelFrom("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("윈도우 PC");
    expect(deviceLabelFrom("")).toBe("기타 기기");
  });
  it("base64url 공개키 → 65바이트 · 같은 키 비교", () => {
    const raw = new Uint8Array(65).map((_, i) => (i * 37 + 4) % 256);
    let bin = "";
    raw.forEach((b) => (bin += String.fromCharCode(b)));
    const b64url = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const back = b64urlToBytes(b64url);
    expect(back.length).toBe(65);
    expect(Array.from(back)).toEqual(Array.from(raw));
    expect(sameKey(raw.buffer.slice(0), back)).toBe(true);
    const other = raw.slice();
    other[10] ^= 1;
    expect(sameKey(other.buffer, back)).toBe(false);
    expect(sameKey(null, back)).toBe(false);
    expect(sameKey(new Uint8Array(64).buffer, back)).toBe(false);
  });
  it("동기화 날짜는 한국 날짜 (자정 경계)", () => {
    expect(kstDay(new Date("2026-09-30T14:59:59Z"))).toBe("2026-09-30");
    expect(kstDay(new Date("2026-09-30T15:00:00Z"))).toBe("2026-10-01");
  });
});

// ── 켜기 · 동기화 흐름 (브라우저 API 흉내) ─────────────────────────
const KEY = (() => {
  const raw = new Uint8Array(65).map((_, i) => (i === 0 ? 4 : (i * 11) % 256));
  let bin = "";
  raw.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
})();

type FakeSub = {
  endpoint: string;
  options: { applicationServerKey: ArrayBuffer | null };
  toJSON: () => { endpoint: string; keys: { p256dh: string; auth: string } };
  unsubscribe: ReturnType<typeof vi.fn>;
};

function makeSub(endpoint: string, key: Uint8Array | null): FakeSub {
  return {
    endpoint,
    options: { applicationServerKey: key ? key.buffer.slice(0) : null },
    toJSON: () => ({ endpoint, keys: { p256dh: "B".repeat(87), auth: "A".repeat(22) } }),
    unsubscribe: vi.fn(async () => true),
  };
}

let current: FakeSub | null = null;
const subscribe = vi.fn(async (opts: { applicationServerKey: ArrayBuffer }) => {
  current = makeSub("https://fcm.googleapis.com/fcm/send/new-endpoint", new Uint8Array(opts.applicationServerKey));
  return current;
});
const reg = {
  active: {},
  pushManager: { getSubscription: vi.fn(async () => current), subscribe },
};
const requestPermission = vi.fn(async () => "granted" as NotificationPermission);
const FakeNotification = { permission: "default" as NotificationPermission, requestPermission };

beforeEach(() => {
  current = null;
  rpc.mockReset();
  subscribe.mockClear();
  requestPermission.mockClear();
  FakeNotification.permission = "default";
  localStorage.clear();
  vi.stubGlobal("Notification", FakeNotification);
  vi.stubGlobal("PushManager", function PushManager() {});
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { getRegistration: vi.fn(async () => reg), ready: Promise.resolve(reg) },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const rpcOk = (map: Record<string, unknown>) =>
  rpc.mockImplementation(async (fn: string) => ({ data: map[fn] ?? null, error: null }));

describe("enablePush — 켜기", () => {
  it("권한 허용 → 서버 키로 구독 → 서버 등록 · 이 기기 주인 기록", async () => {
    rpcOk({ get_push_public_key: KEY, push_subscribe: { ok: true, devices: 2 } });
    const r = await enablePush("user-a");
    expect(r).toEqual({ ok: true, devices: 2 });
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledTimes(1);
    const sent = new Uint8Array(subscribe.mock.calls[0][0].applicationServerKey);
    expect(Array.from(sent)).toEqual(Array.from(b64urlToBytes(KEY)));
    const call = rpc.mock.calls.find((c) => c[0] === "push_subscribe")!;
    expect(call[1]).toMatchObject({ p_endpoint: "https://fcm.googleapis.com/fcm/send/new-endpoint", p_p256dh: "B".repeat(87), p_auth: "A".repeat(22) });
    expect(localStorage.getItem("153push:owner")).toBe("user-a");
  });

  it("권한 거절이면 서버를 부르지 않는다", async () => {
    requestPermission.mockResolvedValueOnce("denied");
    const r = await enablePush("user-a");
    expect(r).toEqual({ ok: false, reason: "denied" });
    expect(rpc).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("창을 그냥 닫으면 dismissed", async () => {
    requestPermission.mockResolvedValueOnce("default");
    expect(await enablePush("user-a")).toEqual({ ok: false, reason: "dismissed" });
  });

  it("다른 서버 키로 만든 옛 구독은 지우고 새로 구독", async () => {
    FakeNotification.permission = "granted";
    const old = makeSub("https://fcm.googleapis.com/fcm/send/old", new Uint8Array(65));
    current = old;
    rpcOk({ get_push_public_key: KEY, push_subscribe: { ok: true, devices: 1 } });
    const r = await enablePush("user-a");
    expect(r.ok).toBe(true);
    expect(requestPermission).not.toHaveBeenCalled(); // 이미 허용이면 다시 묻지 않는다
    expect(old.unsubscribe).toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it("서버가 모르는 푸시 주소면 구독을 지우고 알려 준다", async () => {
    rpcOk({ get_push_public_key: KEY, push_subscribe: { ok: false, error: "unsupported_endpoint" } });
    const r = await enablePush("user-a");
    expect(r).toEqual({ ok: false, reason: "unsupported_endpoint" });
    expect(current!.unsubscribe).toHaveBeenCalled();
    expect(localStorage.getItem("153push:owner")).toBeNull();
  });
});

describe("syncPushSubscription · readPushState · 로그아웃", () => {
  beforeEach(() => {
    FakeNotification.permission = "granted";
    current = makeSub("https://fcm.googleapis.com/fcm/send/e1", b64urlToBytes(KEY));
  });

  it("이 기기를 켠 사람이면 하루 한 번만 서버에 알린다", async () => {
    localStorage.setItem("153push:owner", "user-a");
    rpcOk({ push_subscribe: { ok: true, devices: 1 } });
    await syncPushSubscription("user-a");
    await syncPushSubscription("user-a");
    expect(rpc.mock.calls.filter((c) => c[0] === "push_subscribe")).toHaveLength(1);
    expect(await readPushState("user-a")).toEqual({ kind: "on" });
  });

  it("다른 사람이 켠 구독이면 서버에 넘기지 않고 지운다", async () => {
    localStorage.setItem("153push:owner", "user-a");
    const sub = current!;
    await syncPushSubscription("user-b");
    expect(rpc).not.toHaveBeenCalled();
    expect(sub.unsubscribe).toHaveBeenCalled();
    expect(localStorage.getItem("153push:owner")).toBeNull();
  });

  it("주인을 모르는 구독도 지운다 (이 사람이 켰다는 기록이 없다)", async () => {
    const sub = current!;
    await syncPushSubscription("user-a");
    expect(rpc).not.toHaveBeenCalled();
    expect(sub.unsubscribe).toHaveBeenCalled();
  });

  it("남이 켠 구독은 '꺼짐'으로 보인다 · 막혔으면 denied", async () => {
    localStorage.setItem("153push:owner", "user-a");
    expect(await readPushState("user-b")).toEqual({ kind: "off" });
    FakeNotification.permission = "denied";
    expect(await readPushState("user-a")).toEqual({ kind: "denied" });
  });

  it("로그아웃하면 이 기기 구독과 기록을 지운다", async () => {
    localStorage.setItem("153push:owner", "user-a");
    localStorage.setItem("153push:sync", "x");
    const sub = current!;
    await forgetPushOnThisDevice();
    expect(sub.unsubscribe).toHaveBeenCalled();
    expect(localStorage.getItem("153push:owner")).toBeNull();
    expect(localStorage.getItem("153push:sync")).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
});
