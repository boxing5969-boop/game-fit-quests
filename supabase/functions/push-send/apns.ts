// 📲 아이폰 앱(App Store '마이복서153') 휴대폰 알림 — 애플 푸시 서버(APNs)로 직접 보낸다 (2026-10-19).
//
// 웹 푸시(webpush.ts)와 같은 알림을 아이폰 앱 기기 주소(push_subscriptions.kind = 'apns')로 보낸다.
// 키: internal_sync_config.apns_key = {"keyId":"…","teamId":"…","p8":"-----BEGIN PRIVATE KEY-----…","bundleId":"kr.boxing153.myboxer"}
//     (애플 개발자 › Keys 에서 'Apple Push Notifications service' 를 켠 키 .p8). DB 밖으로 꺼내지 않는다.
// 인증: ES256 JWT (애플 규칙: 20분~1시간마다 새로) — 50분 동안 다시 쓴다.
// 결과: 200 성공 · 410 Unregistered / 400 BadDeviceToken = 그 기기는 끈다(gone) · 나머지는 실패(다음에 다시).

export type ApnsKey = { keyId: string; teamId: string; p8: string; bundleId?: string };

export const APNS_BUNDLE_ID = "kr.boxing153.myboxer";

// 휴대폰 알림에는 그림을 못 넣는다 → 이모지를 지운다 (public/sw.js noEmoji 와 같은 규칙)
const EMOJI_SEQ =
  /\p{Regional_Indicator}{2}|\p{Extended_Pictographic}[︎️]?\p{Emoji_Modifier}?(?:‍\p{Extended_Pictographic}[︎️]?\p{Emoji_Modifier}?)*/gu;
const TEXT_SYMBOLS = "▶◀↔↕↩↪⚙☀‼⁉©®™ℹ➡⬅";
export function noEmoji(text: string): string {
  return text
    .replace(EMOJI_SEQ, (m) => {
      const base = m.replace(/[︎️]/g, "");
      return TEXT_SYMBOLS.includes(base) && [...base].length === 1 ? base : "\u0000";
    })
    .replace(/[ \t]*\u0000+[ \t]*/g, " ")
    .replace(/^ +| +$/gm, "")
    .trim();
}

export function isApnsKey(k: unknown): k is ApnsKey {
  const x = k as ApnsKey | null;
  return !!x && typeof x.keyId === "string" && /^[A-Z0-9]{10}$/.test(x.keyId) &&
    typeof x.teamId === "string" && /^[A-Z0-9]{10}$/.test(x.teamId) &&
    typeof x.p8 === "string" && x.p8.includes("PRIVATE KEY");
}

const b64url = (bytes: Uint8Array): string => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const b64urlText = (t: string): string => b64url(new TextEncoder().encode(t));

function pemToDer(pem: string): ArrayBuffer {
  const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(body);
  const buf = new ArrayBuffer(bin.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return buf;
}

let jwtCache: { token: string; at: number; keyId: string } | null = null;

/** APNs 인증 토큰 (50분 재사용) */
export async function apnsJwt(key: ApnsKey, nowMs: number = Date.now()): Promise<string> {
  if (jwtCache && jwtCache.keyId === key.keyId && nowMs - jwtCache.at < 50 * 60_000) return jwtCache.token;
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(key.p8),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const header = b64urlText(JSON.stringify({ alg: "ES256", kid: key.keyId }));
  const claims = b64urlText(JSON.stringify({ iss: key.teamId, iat: Math.floor(nowMs / 1000) }));
  const input = `${header}.${claims}`;
  // WebCrypto ECDSA 서명은 r||s (64바이트) — JWT ES256 형식 그대로
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, cryptoKey, new TextEncoder().encode(input)));
  const token = `${input}.${b64url(sig)}`;
  jwtCache = { token, at: nowMs, keyId: key.keyId };
  return token;
}

/** 'apns:<기기 토큰>' → 토큰 (모양이 다르면 null) */
export function apnsToken(endpoint: string): string | null {
  const m = /^apns:([0-9a-f]{64,200})$/.exec(endpoint);
  return m ? m[1] : null;
}

export type ApnsResult = { ok: boolean; gone: boolean; status: number; reason?: string };

/**
 * 한 기기로 보내기.
 * payload: 제목·내용·누르면 열 앱 안 경로·같은 알림 묶음 id
 */
export async function sendApns(
  key: ApnsKey,
  token: string,
  msg: { title: string; body: string; url: string; collapseId: string },
  opts: { sandbox?: boolean; ttlSec?: number } = {},
): Promise<ApnsResult> {
  const host = opts.sandbox ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
  const jwt = await apnsJwt(key);
  const body = JSON.stringify({
    aps: {
      alert: { title: msg.title, body: msg.body },
      sound: "default",
      "thread-id": "myboxer153",
    },
    url: msg.url,
  });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch(`${host}/3/device/${token}`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        authorization: `bearer ${jwt}`,
        "apns-topic": key.bundleId || APNS_BUNDLE_ID,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "apns-expiration": String(Math.floor(Date.now() / 1000) + (opts.ttlSec ?? 86_400)),
        "apns-collapse-id": msg.collapseId.slice(0, 64),
        "content-type": "application/json",
      },
      body,
    });
  } catch {
    return { ok: false, gone: false, status: 0, reason: "network" };
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 200) {
    await res.body?.cancel();
    return { ok: true, gone: false, status: 200 };
  }
  let reason = "";
  try {
    reason = String(((await res.json()) as { reason?: string })?.reason ?? "");
  } catch {
    /* 본문 없음 */
  }
  // 410 = 앱 삭제·알림 끔 · BadDeviceToken = 다른 환경(개발용) 토큰이거나 잘못된 토큰 → 그 기기는 끈다
  const gone = res.status === 410 || reason === "BadDeviceToken" || reason === "Unregistered" || reason === "DeviceTokenNotForTopic";
  if (res.status === 403 && (reason === "ExpiredProviderToken" || reason === "InvalidProviderToken")) jwtCache = null;
  return { ok: false, gone, status: res.status, reason };
}
