// 📲 push-send — 알림(notifications)을 회원 휴대폰으로 보내는 내부 함수 (2026-10-01 대표님: 휴대폰 알림).
//
// 누가 부르나: DB 트리거(notifications 저장 직후, 휴대폰 알림을 켠 회원 몫만) → pg_net → 이 함수.
// 인증: internal_sync_config.push_send_key 를 x-push-key 헤더로 검증 (다른 내부 함수의 x-auto-key 와 같은 방식).
//       → config.toml 에 verify_jwt = false 를 명시한다 (CLI 재배포 때 기본값 true 로 무음 정지 방지).
// 요청:
//   { action: "setup" }                — 서버 서명 키(VAPID)가 없으면 한 번 만든다. 공개키만 돌려준다.
//   { action: "send", ids: uuid[] }    — 그 알림들을 보낸다. 한 알림은 한 번만(push_claim_notifications 가 pushed_at 을 찍으며 가져간다),
//                                         30분 지난 알림은 보내지 않는다 — 키가 새도 옛 알림을 다시 울릴 수 없다.
// 보내는 곳은 브라우저 회사 푸시 서버뿐(구글·애플·모질라·MS) — webpush.ts isAllowedEndpoint.
// 404·410 이면 그 기기 구독을 끄고(active=false), 실패가 20번 쌓인 구독도 끈다(push_report).
// 로그에는 개수만 남긴다 (이름·내용·주소를 찍지 않는다).
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateVapidKeys, isAllowedEndpoint, sendWebPush, type VapidKeys } from "./webpush.ts";

/** VAPID 연락처 — 푸시 회사가 문제 있을 때 연락하는 곳. 개인 이메일 대신 공식 주소 */
const SUBJECT = "https://myboxer153.com";
const MAX_IDS = 2000;
const CONCURRENCY = 8;
const TITLE_MAX = 80;
const BODY_MAX = 240;

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 길이가 달라도 끝까지 비교 (시간으로 키를 맞히지 못하게) */
function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

async function readConfig(key: string): Promise<string | null> {
  const { data, error } = await db.from("internal_sync_config").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return (data?.value as string | undefined) ?? null;
}

let keysCache: VapidKeys | null = null;

/** 서버 서명 키 — 없으면 (create 일 때만) 만들어 저장한다. 두 요청이 겹쳐도 먼저 저장된 한 쌍만 쓴다 */
async function loadKeys(create: boolean): Promise<VapidKeys | null> {
  if (keysCache) return keysCache;
  const raw = await readConfig("push_vapid");
  if (raw) {
    const k = JSON.parse(raw) as VapidKeys;
    if (k?.publicKey && k?.privateJwk?.d) return (keysCache = k);
  }
  if (!create) return null;
  const fresh = await generateVapidKeys();
  const { error } = await db
    .from("internal_sync_config")
    .upsert({ key: "push_vapid", value: JSON.stringify(fresh) }, { onConflict: "key", ignoreDuplicates: true });
  if (error) throw error;
  const saved = await readConfig("push_vapid");
  return saved ? (keysCache = JSON.parse(saved) as VapidKeys) : null;
}

const clip = (s: unknown, max: number): string => {
  const t = typeof s === "string" ? s.trim() : "";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

const safePath = (link: unknown): string =>
  typeof link === "string" && /^\/([^/\\\s][^\\\s]*)?$/.test(link) && link.length <= 300 ? link : "/notifications";

type Claimed = { id: string; user_id: string; title: string; body: string | null; link: string | null };
type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };

async function runPool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

async function send(ids: string[]) {
  const keys = await loadKeys(false);
  if (!keys) return json(503, { ok: false, error: "no_vapid_keys" });

  const { data: claimedRaw, error: claimErr } = await db.rpc("push_claim_notifications", { p_ids: ids });
  if (claimErr) throw claimErr;
  const claimed = (claimedRaw ?? []) as Claimed[];
  if (!claimed.length) return json(200, { ok: true, notifications: 0, sent: 0 });

  const userIds = [...new Set(claimed.map((n) => n.user_id))];
  const subs: Sub[] = [];
  for (let i = 0; i < userIds.length; i += 200) {
    const { data, error } = await db
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .eq("active", true)
      .in("user_id", userIds.slice(i, i + 200));
    if (error) throw error;
    subs.push(...((data ?? []) as Sub[]));
  }
  const byUser = new Map<string, Sub[]>();
  for (const s of subs) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);

  const jobs: { n: Claimed; s: Sub }[] = [];
  for (const n of claimed) for (const s of byUser.get(n.user_id) ?? []) jobs.push({ n, s });

  const ok = new Set<string>();
  const gone = new Set<string>();
  const failed = new Set<string>();
  await runPool(jobs, CONCURRENCY, async ({ n, s }) => {
    if (!isAllowedEndpoint(s.endpoint)) {
      gone.add(s.id);
      return;
    }
    // 한 기기에서 무슨 일이 나도 같은 묶음의 다른 회원 발송은 계속한다
    try {
      const payload = JSON.stringify({
        title: clip(n.title, TITLE_MAX) || "마이복서153",
        body: clip(n.body, BODY_MAX),
        url: safePath(n.link),
        tag: n.id,
      });
      const r = await sendWebPush(s, payload, keys, SUBJECT, { ttlSec: 86_400, urgency: "normal" });
      if (r.ok) ok.add(s.id);
      else if (r.gone) gone.add(s.id);
      else failed.add(s.id);
    } catch {
      failed.add(s.id);
    }
  });
  for (const id of ok) failed.delete(id);

  const { error: repErr } = await db.rpc("push_report", {
    p_ok: [...ok],
    p_gone: [...gone],
    p_failed: [...failed],
  });
  if (repErr) console.error("push_report", repErr.message);
  console.log(`push-send notifications=${claimed.length} jobs=${jobs.length} ok=${ok.size} gone=${gone.size} failed=${failed.size}`);
  return json(200, { ok: true, notifications: claimed.length, sent: ok.size, gone: gone.size, failed: failed.size });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });
  try {
    const expected = await readConfig("push_send_key");
    const given = req.headers.get("x-push-key") ?? "";
    if (!expected || !given || !safeEqual(given, expected)) return json(401, { ok: false, error: "unauthorized" });

    const body = (await req.json().catch(() => ({}))) as { action?: string; ids?: unknown };
    if (body.action === "setup") {
      const keys = await loadKeys(true);
      return json(200, { ok: !!keys, publicKey: keys?.publicKey ?? null });
    }
    if (body.action === "send") {
      const ids = (Array.isArray(body.ids) ? body.ids : []).filter((x): x is string => typeof x === "string" && UUID.test(x));
      if (!ids.length) return json(200, { ok: true, notifications: 0, sent: 0 });
      return await send([...new Set(ids)].slice(0, MAX_IDS));
    }
    return json(400, { ok: false, error: "unknown_action" });
  } catch (e) {
    console.error("push-send error", e instanceof Error ? e.message : String(e));
    return json(500, { ok: false, error: "internal" });
  }
});
