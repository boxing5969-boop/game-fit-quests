// 회원 자동 동기화 러너 (크론 전용).
// 흐름: pg_cron → 이 함수 → 기존 sync-members-to-app(SYNC_KEY 는 프로젝트 시크릿에서 읽음)
// 인증: DB(internal_sync_config.auto_sync_key)에 저장된 내부 키를 x-auto-key 헤더로 검증.
//       외부 비밀키를 크론이나 코드에 노출하지 않는다.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-auto-key",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const SYNC_KEY = Deno.env.get("SYNC_KEY") || "";
  const db = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    // 1) 내부 키 검증
    const provided = req.headers.get("x-auto-key") || "";
    const { data: cfg } = await db
      .from("internal_sync_config").select("value").eq("key", "auto_sync_key").maybeSingle();
    if (!cfg?.value || provided !== cfg.value) return json({ error: "unauthorized" }, 401);
    if (!SYNC_KEY) {
      await db.from("member_sync_runs").insert({ mode: "unknown", ok: false, error: "SYNC_KEY 미설정" });
      return json({ error: "SYNC_KEY 미설정" }, 503);
    }

    const body = await req.json().catch(() => ({}));
    const force = body?.force === true;
    const limit = Number(body?.limit) > 0 ? Math.min(1000, Number(body.limit)) : 200;
    const mode = force ? "full-refresh" : "new-members";

    // 2) 기존 동기화 함수 호출 (SYNC_KEY 는 이 런타임의 시크릿에서만 읽음)
    const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-members-to-app`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sync-key": SYNC_KEY },
      body: JSON.stringify({ force, limit }),
    });
    const out = await res.json().catch(() => ({}));

    // 3) 이력 기록
    const ok = res.ok && out?.ok === true;
    await db.from("member_sync_runs").insert({
      mode,
      ok,
      scanned: Number(out?.scanned ?? 0),
      created: Number(out?.created ?? 0),
      updated: Number(out?.updated ?? 0),
      linked: Number(out?.linked ?? 0),
      failed: Array.isArray(out?.failed) ? out.failed.length : 0,
      error: ok ? null : String(out?.error ?? `HTTP ${res.status}`).slice(0, 500),
    });

    return json({ ok, mode, result: out }, ok ? 200 : 502);
  } catch (e) {
    await db.from("member_sync_runs").insert({
      mode: "error", ok: false, error: (e instanceof Error ? e.message : String(e)).slice(0, 500),
    });
    return json({ error: "처리 중 오류가 발생했습니다." }, 500);
  }
});
