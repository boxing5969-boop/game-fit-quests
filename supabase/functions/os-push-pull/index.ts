// 📲 os-push-pull — 153OS 앱 알림(일일경영리포트 '푸시메시지' · 공지 알림) → 마이복서153 알림함 · 휴대폰 (2026-11-02)
//
// 크론 os-push-pull 이 매분 부른다. x-auto-key(internal_sync_config.auto_sync_key) · verify_jwt = false (config.toml).
//   1) 153OS GET /api/external/push/outbox?limit=200 (X-Partner-Key = 시크릿 OS_PARTNER_KEY)
//      — 153OS 가 이미 지킨다: 예약 시각이 된 것만 · 24시간 안 · 광고성은 08~21시 · 보내기 직전 탈퇴/거부/동의 철회 다시 확인.
//   2) rpc os_push_receive(rows) — 처음 보는 줄만 notifications 에 한 번에 넣는다(같은 줄은 두 번 안 넣음 · os_push_inbox).
//      notifications 트리거가 휴대폰 알림을 켠 회원 몫만 push-send 로 보낸다(기존 알림 길 그대로).
//      앱에 없는 계정 줄은 넣지 않고 받은 것으로만 친다.
//   3) POST /api/external/push/ack {recipient_ids} — 받은 줄 모두(새로 넣은 줄 · 전에 넣은 줄 · 건너뛴 줄).
//   한 번에 200줄씩 최대 3번(분당 600줄).
// 시험: body {dry_run:true} = 1)만 하고 숫자만(넣지도 ack 도 안 한다 → 다음에 다시 나온다)
//       body {probe_user:"<앱 계정 id>"} = 그 계정으로 /me/branch 를 불러 상태 코드만(키 · 회원 연결 시험, 내용은 안 돌려준다)
// 로그에는 숫자만 남긴다(이름 · 내용을 찍지 않는다).
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { toInboxRows } from "./logic.ts";

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE = 200;
const MAX_ROUNDS = 3;
const TIMEOUT_MS = 15_000;

/** 길이가 달라도 끝까지 비교 (시간으로 키를 맞히지 못하게) */
function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

async function osFetch(url: string, init: RequestInit): Promise<{ status: number; body: any }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  } catch {
    return { status: 0, body: null };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const OS_API_URL = (Deno.env.get("OS_API_URL") || "https://153-boxing-os-api.boxing5969.workers.dev").replace(/\/+$/, "");
  const OS_PARTNER_KEY = Deno.env.get("OS_PARTNER_KEY") || "";
  const app = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

  const provided = req.headers.get("x-auto-key") || "";
  const { data: cfg } = await app.from("internal_sync_config").select("value").eq("key", "auto_sync_key").maybeSingle();
  const expected = (cfg?.value as string | undefined) ?? "";
  if (!expected || !provided || !safeEqual(provided, expected)) return json({ ok: false, error: "unauthorized" }, 401);
  if (!OS_PARTNER_KEY) return json({ ok: false, error: "os_not_configured" }, 500);

  const body = (await req.json().catch(() => ({}))) as { dry_run?: boolean; probe_user?: string };
  const headers = { "X-Partner-Key": OS_PARTNER_KEY };

  // 연결 시험 — 그 계정으로 지점 정보를 불러 상태 코드만
  if (typeof body.probe_user === "string") {
    if (!UUID.test(body.probe_user)) return json({ ok: false, error: "bad_user" }, 400);
    const r = await osFetch(`${OS_API_URL}/api/external/me/branch`, { headers: { ...headers, "X-Ranking-User-Id": body.probe_user } });
    return json({ ok: r.status === 200 && !!r.body?.success, status: r.status, code: r.body?.error?.code ?? null });
  }

  let rounds = 0, pulled = 0, inserted = 0, dup = 0, skipped = 0, acked = 0;
  while (rounds < MAX_ROUNDS) {
    rounds++;
    const out = await osFetch(`${OS_API_URL}/api/external/push/outbox?limit=${PAGE}`, { headers });
    if (out.status !== 200 || !out.body?.success) {
      console.log(`os-push-pull outbox_failed status=${out.status} code=${out.body?.error?.code ?? "-"}`);
      return json({ ok: false, error: "outbox_failed", status: out.status, rounds, pulled, inserted, acked }, 502);
    }
    const rawRows: unknown[] = Array.isArray(out.body.data) ? out.body.data : [];
    const rows = toInboxRows(rawRows);
    pulled += rows.length;
    if (!rows.length) break;
    if (body.dry_run) break;

    const { data: rec, error: recErr } = await app.rpc("os_push_receive", { p_rows: rows });
    if (recErr) {
      console.error("os-push-pull receive_failed", recErr.message);
      return json({ ok: false, error: "receive_failed", rounds, pulled, inserted, acked }, 500);
    }
    const ack: string[] = Array.isArray(rec?.ack) ? rec.ack : [];
    inserted += Number(rec?.inserted ?? 0);
    dup += Number(rec?.dup ?? 0);
    skipped += Number(rec?.skipped ?? 0);
    for (let i = 0; i < ack.length; i += 500) {
      const a = await osFetch(`${OS_API_URL}/api/external/push/ack`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_ids: ack.slice(i, i + 500) }),
      });
      if (a.status === 200 && a.body?.success) acked += Number(a.body?.data?.acked ?? 0);
      else console.log(`os-push-pull ack_failed status=${a.status}`); // 다음 바퀴에 다시 나오고, os_push_inbox 가 두 번 넣지 않는다
    }
    if (rawRows.length < PAGE) break;
  }
  if (pulled || inserted || acked) {
    console.log(`os-push-pull rounds=${rounds} pulled=${pulled} inserted=${inserted} dup=${dup} skipped=${skipped} acked=${acked}${body.dry_run ? " dry_run" : ""}`);
  }
  return json({ ok: true, dry_run: !!body.dry_run, rounds, pulled, inserted, dup, skipped, acked });
});
