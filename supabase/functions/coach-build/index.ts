// 🥊 오삼코치 밤 배치 — 회원별 메시지 초안 만들기 (2026-10-15 대표님: "일곱가지 니가 제안하는대로 시작해보자")
//
// 매일 02:00 KST pg_cron(coach-build) → 이 함수 (x-auto-key = internal_sync_config.auto_sync_key, 다른 크론 함수와 같은 열쇠).
//   1) coach_targets(오늘) — 대상과 사실(facts). 설정이 꺼져 있으면 빈 목록.
//   2) coach_messages 에 기본 문구로 넣는다 (이미 있는 날은 건너뜀 — 여러 번 불러도 한 번).
//   3) ANTHROPIC_API_KEY 가 있으면 Haiku 5.5 배치(반값)로 문구를 요청 → coach-collect 가 거둔다.
//      키가 없거나 배치가 실패하면 기본 문구 그대로 검수 대기(ready)로 둔다 — 기능이 멈추지 않게.
// body: { for_date?: "YYYY-MM-DD", no_ai?: boolean }
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildClaudeBody, CLAUDE_COACH_MODEL, claudeCreateBatch, hasClaude, type BatchRequest } from "../_shared/claude.ts";
import { COACH_SCHEMA, COACH_SYSTEM, coachUserPrompt, safeFallback, type CoachFacts } from "../_shared/coach.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const chunks = <T,>(a: T[], n: number): T[][] => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  const provided = req.headers.get("x-auto-key") || "";
  const { data: k } = await db.from("internal_sync_config").select("value").eq("key", "auto_sync_key").maybeSingle();
  if (!k?.value || provided !== k.value) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const forDate = typeof body?.for_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.for_date) ? body.for_date : kstToday();

  const { data: cfg } = await db.from("coach_config").select("enabled, review_required").eq("id", true).maybeSingle();
  if (!cfg?.enabled) return json({ ok: true, skipped: "disabled" });
  const settled = cfg.review_required === false ? "approved" : "ready";

  const { data: targets, error: tErr } = await db.rpc("coach_targets", { _for_date: forDate });
  if (tErr) {
    console.error("[coach-build] targets failed", tErr.message);
    return json({ error: "targets_failed" }, 500);
  }
  const useAi = hasClaude() && body?.no_ai !== true;

  // deno-lint-ignore no-explicit-any
  const rows = ((targets ?? []) as any[]).map((t) => {
    const facts = t.facts as CoachFacts;
    const fb = safeFallback(facts);
    return {
      user_id: t.user_id,
      branch_name: t.branch_name,
      kind: t.kind,
      for_date: forDate,
      send_at: t.send_at,
      status: useAi ? "generating" : settled,
      title: fb.title,
      body: fb.body,
      detail: fb.detail,
      source: "fallback",
      fallback: fb,
      facts,
      check_reason: useAi ? null : "no_ai",
    };
  });
  if (rows.length === 0) return json({ ok: true, for_date: forDate, created: 0 });

  // (user_id, kind, for_date) 유일 — 이미 만든 것은 건너뛰고 새로 넣은 것만 돌려받는다
  const fresh: { id: string; facts: CoachFacts }[] = [];
  for (const part of chunks(rows, 200)) {
    const { data, error } = await db
      .from("coach_messages")
      .upsert(part, { onConflict: "user_id,kind,for_date", ignoreDuplicates: true })
      .select("id, facts");
    if (error) {
      console.error("[coach-build] insert failed", error.message);
      return json({ error: "insert_failed", created: fresh.length }, 500);
    }
    fresh.push(...((data ?? []) as { id: string; facts: CoachFacts }[]));
  }
  if (!useAi || fresh.length === 0) return json({ ok: true, for_date: forDate, created: fresh.length, ai: false });

  const requests: BatchRequest[] = fresh.map((m) => ({
    custom_id: m.id,
    params: buildClaudeBody({
      model: CLAUDE_COACH_MODEL,
      system: [COACH_SYSTEM],
      messages: [{ role: "user", content: coachUserPrompt(m.facts) }],
      maxTokens: 1024, // Haiku 5.5 는 생각 토큰도 여기에 들어간다
      cacheFirstSystem: true,
      jsonSchema: COACH_SCHEMA,
    }),
  }));

  const ids = fresh.map((m) => m.id);
  try {
    const b = await claudeCreateBatch(requests);
    const { error: bErr } = await db
      .from("coach_batches")
      .insert({ id: b.id, for_date: forDate, model: CLAUDE_COACH_MODEL, request_count: requests.length });
    if (bErr) console.error("[coach-build] batch row failed", bErr.message);
    for (const part of chunks(ids, 100)) {
      await db.from("coach_messages").update({ batch_id: b.id, model: CLAUDE_COACH_MODEL }).in("id", part);
    }
    return json({ ok: true, for_date: forDate, created: fresh.length, batch: b.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[coach-build] batch create failed", msg.slice(0, 300));
    for (const part of chunks(ids, 100)) {
      await db
        .from("coach_messages")
        .update({ status: settled, check_reason: "batch_create_failed", updated_at: new Date().toISOString() })
        .in("id", part)
        .eq("status", "generating");
    }
    return json({ ok: true, for_date: forDate, created: fresh.length, ai: false, error: "batch_create_failed" });
  }
});
