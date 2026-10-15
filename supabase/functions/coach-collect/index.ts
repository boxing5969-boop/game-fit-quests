// 🥊 오삼코치 배치 거두기 (2026-10-15)
//
// pg_cron(coach-collect) 이 15분마다 — 진행 중인 배치나 generating 메시지가 있을 때만 — 이 함수를 부른다 (x-auto-key).
//   · 끝난 배치: 결과(JSONL)를 읽어 _shared/coach.ts 의 checkCoachText 로 검사한다.
//       통과 → AI 문구로 바꾼다 (source='ai'). 탈락·오류·만료 → 기본 문구 그대로, 이유(check_reason)만 남긴다.
//       검수 중(review_required)이면 ready, 아니면 approved.
//   · 5시간이 지나도 안 끝난 배치 → 포기하고 기본 문구로 (아침 8시 전에 정리되게).
//   · 토큰·비용은 배치마다 ai_usage_log 한 줄 (feature 'coach_batch', 배치 반값).
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  claudeBatchResults,
  claudeGetBatch,
  emptyUsage,
  logAiUsage,
  messageText,
  usageOf,
  type BatchInfo,
} from "../_shared/claude.ts";
import { checkCoachText, parseCoachJson, type CoachFacts } from "../_shared/coach.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GIVE_UP_HOURS = 5;
const ORPHAN_HOURS = 6;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const chunks = <T,>(a: T[], n: number): T[][] => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

type Row = { id: string; status: string; title?: string; body?: string; detail?: string; source?: string; check_reason?: string | null; model?: string };

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  const provided = req.headers.get("x-auto-key") || "";
  const { data: k } = await db.from("internal_sync_config").select("value").eq("key", "auto_sync_key").maybeSingle();
  if (!k?.value || provided !== k.value) return json({ error: "unauthorized" }, 401);

  const { data: cfg } = await db.from("coach_config").select("review_required").eq("id", true).maybeSingle();
  const settled = cfg?.review_required === false ? "approved" : "ready";
  const now = () => new Date().toISOString();

  /** 남은 generating 메시지를 기본 문구로 정리 */
  const settleBatch = async (batchId: string, reason: string) => {
    const { data } = await db.from("coach_messages").select("id").eq("batch_id", batchId).eq("status", "generating");
    const rows: Row[] = ((data ?? []) as { id: string }[]).map((m) => ({ id: m.id, status: settled, check_reason: reason }));
    for (const part of chunks(rows, 300)) await db.rpc("coach_apply_results", { _rows: part });
    return rows.length;
  };

  const report: Record<string, unknown>[] = [];
  const { data: batches } = await db
    .from("coach_batches")
    .select("id, for_date, model, created_at")
    .eq("status", "in_progress")
    .order("created_at");

  for (const b of (batches ?? []) as { id: string; for_date: string; model: string; created_at: string }[]) {
    const ageH = (Date.now() - Date.parse(b.created_at)) / 3600_000;
    let info: BatchInfo | null = null;
    let err = "";
    try {
      info = await claudeGetBatch(b.id);
    } catch (e) {
      err = (e instanceof Error ? e.message : String(e)).slice(0, 200);
    }

    if (!info || info.processing_status !== "ended") {
      if (ageH >= GIVE_UP_HOURS) {
        const n = await settleBatch(b.id, "batch_timeout");
        await db.from("coach_batches").update({ status: "abandoned", checked_at: now(), error: err || info?.processing_status || "unknown" }).eq("id", b.id);
        report.push({ batch: b.id, abandoned: n });
      } else {
        await db.from("coach_batches").update({ checked_at: now(), error: err || null }).eq("id", b.id);
        report.push({ batch: b.id, waiting: info?.processing_status ?? "get_failed" });
      }
      continue;
    }

    let results;
    try {
      results = await claudeBatchResults(info);
    } catch (e) {
      err = (e instanceof Error ? e.message : String(e)).slice(0, 200);
      if (ageH >= GIVE_UP_HOURS) {
        const n = await settleBatch(b.id, "results_failed");
        await db.from("coach_batches").update({ status: "failed", checked_at: now(), error: err }).eq("id", b.id);
        report.push({ batch: b.id, failed: n });
      } else {
        await db.from("coach_batches").update({ checked_at: now(), error: err }).eq("id", b.id);
        report.push({ batch: b.id, retry: "results" });
      }
      continue;
    }

    const { data: msgs } = await db.from("coach_messages").select("id, facts").eq("batch_id", b.id).eq("status", "generating");
    const byId = new Map(((msgs ?? []) as { id: string; facts: CoachFacts }[]).map((m) => [m.id, m]));
    const usage = emptyUsage();
    const counts: Record<string, number> = { ai: 0, rejected: 0, errored: 0 };
    const reasons: Record<string, number> = {};
    const rows: Row[] = [];

    for (const r of results) {
      const m = byId.get(r.custom_id);
      if (!m) continue;
      byId.delete(r.custom_id);
      if (r.result.type !== "succeeded") {
        counts.errored++;
        reasons[r.result.type] = (reasons[r.result.type] ?? 0) + 1;
        rows.push({ id: m.id, status: settled, check_reason: r.result.type });
        continue;
      }
      const u = usageOf(r.result.message);
      usage.input_tokens += u.input_tokens;
      usage.output_tokens += u.output_tokens;
      usage.cache_read_input_tokens += u.cache_read_input_tokens;
      usage.cache_creation_input_tokens += u.cache_creation_input_tokens;
      const text = parseCoachJson(messageText(r.result.message));
      const verdict = r.result.message.stop_reason === "refusal" ? { ok: false as const, reason: "refusal" } : checkCoachText(text, m.facts);
      if (verdict.ok && text) {
        counts.ai++;
        rows.push({ id: m.id, status: settled, title: text.title, body: text.body, detail: text.detail, source: "ai", check_reason: null, model: b.model });
      } else {
        const reason = verdict.ok ? "parse" : verdict.reason;
        counts.rejected++;
        reasons[reason] = (reasons[reason] ?? 0) + 1;
        rows.push({ id: m.id, status: settled, check_reason: reason });
      }
    }
    // 결과 줄이 없는 메시지
    for (const id of byId.keys()) {
      counts.errored++;
      reasons.no_result = (reasons.no_result ?? 0) + 1;
      rows.push({ id, status: settled, check_reason: "no_result" });
    }

    let applied = 0;
    for (const part of chunks(rows, 300)) {
      const { data, error } = await db.rpc("coach_apply_results", { _rows: part });
      if (error) console.error("[coach-collect] apply failed", error.message);
      else applied += Number(data) || 0;
    }

    await logAiUsage(db, {
      feature: "coach_batch",
      model: b.model,
      usage,
      batch: true,
      meta: { batch_id: b.id, for_date: b.for_date, ...counts, reasons },
    });
    await db
      .from("coach_batches")
      .update({ status: "ended", checked_at: now(), collected_at: now(), counts: { ...counts, reasons, applied }, error: null })
      .eq("id", b.id);
    report.push({ batch: b.id, ...counts, applied });
  }

  // 배치 없이 남은 generating (배치 기록 실패 등) — 6시간 지나면 기본 문구로
  const cutoff = new Date(Date.now() - ORPHAN_HOURS * 3600_000).toISOString();
  const { data: orphans } = await db.from("coach_messages").select("id, batch_id").eq("status", "generating").lt("created_at", cutoff).limit(2000);
  const inProgress = new Set(((batches ?? []) as { id: string }[]).map((b) => b.id));
  const orphanRows: Row[] = ((orphans ?? []) as { id: string; batch_id: string | null }[])
    .filter((o) => !o.batch_id || !inProgress.has(o.batch_id))
    .map((o) => ({ id: o.id, status: settled, check_reason: "orphan" }));
  for (const part of chunks(orphanRows, 300)) await db.rpc("coach_apply_results", { _rows: part });

  return json({ ok: true, batches: report, orphans: orphanRows.length });
});
