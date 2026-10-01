// 📲 웹 푸시 보내기 — 표준(RFC 8030 전송 · RFC 8291 aes128gcm 암호화 · RFC 8292 VAPID) 그대로, WebCrypto 만 쓴다.
// Deno(에지 함수)와 Node 20+(검증 스크립트) 양쪽에서 같은 코드가 돈다 — 외부 라이브러리 없음.
//
//   · generateVapidKeys  — 서버 서명 키 한 쌍 (P-256). 공개키는 앱이 구독할 때 쓰고, 개인키는 서버에만 둔다.
//   · encryptPayload     — 회원 기기 키(p256dh·auth)로 알림 내용을 암호화 (푸시 회사도 내용을 못 본다)
//   · vapidAuthHeader    — "이 알림은 마이복서153 서버가 보냈다" 서명
//   · isAllowedEndpoint  — 구글·애플·모질라·MS 푸시 주소만 (아무 주소로나 요청을 보내지 않게)

const te = new TextEncoder();

export const b64urlEncode = (bytes: Uint8Array): string => {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const b64urlDecode = (str: string): Uint8Array => {
  const clean = str.replace(/=+$/, "").replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(clean + "===".slice((clean.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

/** WebCrypto·fetch 에 넘길 독립된 ArrayBuffer (새 TS 의 Uint8Array<ArrayBufferLike> 타입 경고 피하기 · 값은 그대로) */
const ab = (u: Uint8Array): ArrayBuffer => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

export interface VapidKeys {
  /** 공개키 — 압축 안 한 P-256 점 65바이트를 base64url 로 (브라우저 applicationServerKey) */
  publicKey: string;
  /** 개인키 — JWK (kty·crv·x·y·d) */
  privateJwk: JsonWebKey;
}

export async function generateVapidKeys(): Promise<VapidKeys> {
  const kp = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
  return {
    publicKey: b64urlEncode(raw),
    privateJwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d },
  };
}

/** VAPID 서명 — Authorization 헤더 값 ("vapid t=<JWT>, k=<공개키>") */
export async function vapidAuthHeader(
  endpoint: string,
  keys: VapidKeys,
  subject: string,
  nowSec: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  const aud = new URL(endpoint).origin;
  const head = b64urlEncode(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64urlEncode(te.encode(JSON.stringify({ aud, exp: nowSec + 12 * 3600, sub: subject })));
  const unsigned = `${head}.${claims}`;
  const { kty, crv, x, y, d } = keys.privateJwk;
  const key = await crypto.subtle.importKey("jwk", { kty, crv, x, y, d }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  // WebCrypto ECDSA 서명은 r||s 64바이트(IEEE P1363) — JWS ES256 형식 그대로다
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(unsigned)));
  return `vapid t=${unsigned}.${b64urlEncode(sig)}, k=${keys.publicKey}`;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ab(ikm), "HKDF", false, ["deriveBits"]);
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: ab(salt), info: ab(info) }, key, length * 8),
  );
}

/** 한 레코드 크기 — 알림 내용은 4KB 를 넘지 않는다 */
const RECORD_SIZE = 4096;

/**
 * RFC 8291 aes128gcm 암호화.
 * 결과 = salt(16) · rs(4) · idlen(1) · 서버 임시 공개키(65) · 암호문(+태그 16)
 */
export async function encryptPayload(
  plaintext: Uint8Array,
  uaPublicB64: string,
  authSecretB64: string,
  opts: { salt?: Uint8Array; serverKeys?: CryptoKeyPair } = {},
): Promise<Uint8Array> {
  const uaPublic = b64urlDecode(uaPublicB64);
  const authSecret = b64urlDecode(authSecretB64);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error("bad_p256dh");
  if (authSecret.length < 16) throw new Error("bad_auth");
  if (plaintext.length > RECORD_SIZE - 17 - 86) throw new Error("payload_too_large");

  const serverKeys =
    opts.serverKeys ??
    ((await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", serverKeys.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", ab(uaPublic), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, serverKeys.privateKey, 256));

  // IKM = HKDF(auth, ecdh, "WebPush: info" 0x00 ua_public as_public, 32)
  const ikm = await hkdf(authSecret, ecdhSecret, concat(te.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const salt = opts.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);

  // 마지막(이자 유일한) 레코드 — 내용 뒤에 구분 바이트 0x02
  const record = concat(plaintext, new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey("raw", ab(cek), "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: ab(nonce) }, aesKey, ab(record)));

  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, cipher);
}

/** 보낼 수 있는 푸시 주소 — 브라우저 회사 푸시 서버만 (https · 포트 없음) */
const PUSH_HOSTS: RegExp[] = [
  /^fcm\.googleapis\.com$/, // 크롬 · 삼성 인터넷 · 엣지(안드로이드)
  /^android\.googleapis\.com$/, // 예전 크롬
  /^updates\.push\.services\.mozilla\.com$/, // 파이어폭스
  /^web\.push\.apple\.com$/, // 사파리 · 아이폰 홈 화면 앱
  /^[a-z0-9-]+\.notify\.windows\.com$/, // 엣지(윈도우)
];

export const isAllowedEndpoint = (endpoint: unknown): endpoint is string => {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && !u.port && !u.username && !u.password && PUSH_HOSTS.some((r) => r.test(u.hostname));
  } catch {
    return false;
  }
};

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushResult {
  status: number;
  ok: boolean;
  /** 404·410 — 구독이 사라졌다 (앱 삭제·알림 끔·기기 초기화). 저장된 구독을 끈다.
   *  기기 키가 망가져 암호화할 수 없는 구독도 여기에 넣는다 (다시 보내도 절대 안 된다). */
  gone: boolean;
}

/** 알림 한 통 보내기 */
export async function sendWebPush(
  target: PushTarget,
  payload: string,
  keys: VapidKeys,
  subject: string,
  opts: { ttlSec?: number; urgency?: "very-low" | "low" | "normal" | "high"; timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<PushResult> {
  if (!isAllowedEndpoint(target.endpoint)) return { status: 0, ok: false, gone: true };
  // 기기 키(p256dh·auth)가 곡선 위의 점이 아니거나 길이가 틀리면 암호화가 안 된다 → 이 구독만 끈다
  // (예전엔 여기서 던진 에러가 같은 묶음의 다른 회원 발송까지 멈췄다)
  let body: Uint8Array;
  try {
    body = await encryptPayload(te.encode(payload), target.p256dh, target.auth);
  } catch (e) {
    // 내용이 너무 큰 건 우리 쪽 문제 — 구독은 그대로 둔다
    if (e instanceof Error && e.message === "payload_too_large") return { status: 0, ok: false, gone: false };
    return { status: 0, ok: false, gone: true };
  }
  // 서버 서명이 안 되는 건 서버 키 문제 — 구독은 끄지 않고 실패로만 센다
  let authorization: string;
  try {
    authorization = await vapidAuthHeader(target.endpoint, keys, subject);
  } catch {
    return { status: 0, ok: false, gone: false };
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/octet-stream",
    "Content-Encoding": "aes128gcm",
    TTL: String(opts.ttlSec ?? 86_400),
    Urgency: opts.urgency ?? "normal",
    Authorization: authorization,
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 10_000);
  try {
    const res = await (opts.fetchImpl ?? fetch)(target.endpoint, { method: "POST", headers, body: ab(body), signal: ctrl.signal });
    try {
      await res.arrayBuffer();
    } catch {
      /* 응답 본문은 버린다 */
    }
    return { status: res.status, ok: res.status >= 200 && res.status < 300, gone: res.status === 404 || res.status === 410 };
  } catch {
    return { status: 0, ok: false, gone: false };
  } finally {
    clearTimeout(timer);
  }
}
