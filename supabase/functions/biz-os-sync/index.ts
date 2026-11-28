// 🧾 biz-os-sync — 사업자 가계부 → 153OS 월별 손익 정산판 자동 맞춤 (2026-11-28 대표님 「그래 그렇게하고」 · 문서 docs/features/73-사업자-가계부.md)
//
//   가계부 줄이 바뀌면 앱 DB _biz_sync 가 그 사업자 · 달을 biz_os_queue 에 넣는다(순이익 연결 costs_live 를 켠 사업자만).
//   이 함수가 대기열을 읽어 153OS branch_pl_months(같은 이름 지점 · 그 달)를 가계부 숫자로 다시 쓴다.
//     · 부르는 길: ① 가계부 화면이 고친 뒤 바로 — 로그인한 대표님 · 회계매니저(_biz_any) ② 크론 biz-os-sync 10분마다 — x-auto-key
//       어느 길이든 하는 일은 같다(대기열 처리). 화면은 숫자를 받지 않는다(건수만).
//     · 숫자 · 줄 나누기는 logic.ts — 153OS 분류 규칙(branch_pl_rules)에서는 급여 · 뺀 돈 줄 이름만 빌린다.
//     · 153OS 줄과 숫자 · 줄이 같으면 다시 쓰지 않는다. 바꿀 때마다 153OS audit_logs 에 전 · 후를 남긴다.
//     · 가계부에서 그 달 줄이 모두 없어지면 — 153OS 줄 메모가 우리 머리말(마이복서153 사업자 가계부)일 때만 지운다.
//   153OS 는 서버 키 OS_SERVICE_KEY(서버에만). 로그에는 건수 · 결과 코드만(이름 · 금액 안 찍음).
//   verify_jwt = false (config.toml) — 크론 키 또는 아래에서 직접 로그인 확인.
// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  buildOsMonth,
  isEmptyMonth,
  isLedgerMemo,
  ledgerMemo,
  monthStart,
  sameMonth,
  type BizOsPayload,
  type OsRule,
} from "./logic.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-auto-key",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

/** 한 번에 처리할 달 수 · 다시 해 볼 횟수(넘으면 크론이 더 부르지 않는다 — 가계부에서 다시 고치면 0부터) */
const BATCH = 24;
const MAX_TRIES = 5;
const AUDIT_ACTION = "branch_pl_months.sync_from_myboxer_ledger";

type QueueRow = { book_id: string; month: string; queued_at: string; tries: number };

async function osBranchId(os: SupabaseClient, cache: Map<string, string | null>, name: string): Promise<string | null> {
  if (cache.has(name)) return cache.get(name) ?? null;
  const { data, error } = await os.from("branches").select("id").eq("name", name).limit(2);
  if (error) throw new Error(`os_branch: ${error.message}`);
  const id = Array.isArray(data) && data.length === 1 ? String((data[0] as any).id) : null;
  cache.set(name, id);
  return id;
}

async function osRules(os: SupabaseClient, cache: Map<string, OsRule[]>, branchId: string): Promise<OsRule[]> {
  const hit = cache.get(branchId);
  if (hit) return hit;
  const { data, error } = await os
    .from("branch_pl_rules")
    .select("keyword, kind, label, sort_order")
    .eq("branch_id", branchId)
    .in("kind", ["labor", "exclude"])
    .limit(1000);
  if (error) throw new Error(`os_rules: ${error.message}`);
  const rules = (data ?? []) as OsRule[];
  cache.set(branchId, rules);
  return rules;
}

/** 대기열 한 줄 처리 → 결과 코드 */
async function syncOne(
  app: SupabaseClient,
  os: SupabaseClient,
  q: QueueRow,
  caches: { branch: Map<string, string | null>; rules: Map<string, OsRule[]> },
): Promise<string> {
  const { data: payload, error: pErr } = await app.rpc("biz_os_payload", { p_book: q.book_id, p_month: q.month });
  if (pErr) throw new Error(`payload: ${pErr.message}`);
  const p = payload as BizOsPayload;
  if (!p?.ok || !p.live || !p.branch) return "skip_not_live";

  const branchId = await osBranchId(os, caches.branch, p.branch);
  if (!branchId) return "no_os_branch";
  const month = monthStart(q.month);

  const { data: before, error: bErr } = await os
    .from("branch_pl_months")
    .select("month, rent, labor, fixed, variable, excluded, items, memo")
    .eq("branch_id", branchId)
    .eq("month", month)
    .maybeSingle();
  if (bErr) throw new Error(`os_read: ${bErr.message}`);

  if (isEmptyMonth(p)) {
    if (!before) return "empty";
    if (!isLedgerMemo((before as any).memo)) return "empty_keep_os"; // 153OS 에서 따로 정리한 달 — 손대지 않는다
    const { error: dErr } = await os.from("branch_pl_months").delete().eq("branch_id", branchId).eq("month", month);
    if (dErr) throw new Error(`os_delete: ${dErr.message}`);
    await os.from("audit_logs").insert({
      branch_id: branchId,
      actor_role: "myboxer_ledger",
      action: AUDIT_ACTION,
      target_table: "branch_pl_months",
      before_data: before,
      after_data: { month: month.slice(0, 7), deleted: true, source: "마이복서153 사업자 가계부(자동)" },
    });
    return "deleted";
  }

  const rules = await osRules(os, caches.rules, branchId);
  const m = buildOsMonth(p, rules);
  if (sameMonth(m, before as any)) return "same";

  const row = {
    branch_id: branchId,
    month,
    ...m,
    memo: ledgerMemo(new Date()),
    updated_at: new Date().toISOString(),
    updated_by: null,
  };
  const { error: uErr } = await os.from("branch_pl_months").upsert(row, { onConflict: "branch_id,month" });
  if (uErr) throw new Error(`os_write: ${uErr.message}`);
  const { error: aErr } = await os.from("audit_logs").insert({
    branch_id: branchId,
    actor_role: "myboxer_ledger",
    action: AUDIT_ACTION,
    target_table: "branch_pl_months",
    before_data: before ?? null,
    after_data: { month: month.slice(0, 7), ...m, source: "마이복서153 사업자 가계부(자동)" },
  });
  if (aErr) console.error("biz-os-sync audit", aErr.code ?? "error");
  return before ? "updated" : "inserted";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, code: "METHOD" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const OS_URL = Deno.env.get("OS_SUPABASE_URL") || "https://tbxdrfowanyksgdicryl.supabase.co";
  const OS_KEY = Deno.env.get("OS_SERVICE_KEY") || "";
  if (!OS_KEY) return json({ ok: false, code: "OS_NOT_CONFIGURED" }, 500);
  const app = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

  // 1) 누가 — 크론 열쇠 또는 가계부를 쓰는 분(대표님 · 회계매니저)
  let cron = false;
  const autoKey = req.headers.get("x-auto-key") || "";
  if (autoKey) {
    const { data: cfg } = await app.from("internal_sync_config").select("value").eq("key", "auto_sync_key").maybeSingle();
    if (!cfg?.value || autoKey !== cfg.value) return json({ ok: false, code: "FORBIDDEN" }, 403);
    cron = true;
  } else {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ ok: false, code: "NOT_AUTHENTICATED" }, 401);
    const { data: who, error: whoErr } = await app.auth.getUser(token);
    if (whoErr || !who?.user) return json({ ok: false, code: "NOT_AUTHENTICATED" }, 401);
    const { data: can, error: canErr } = await app.rpc("_biz_any", { _uid: who.user.id });
    if (canErr) {
      console.error("biz-os-sync can", canErr.code ?? "error");
      return json({ ok: false, code: "FORBIDDEN" }, 403);
    }
    if (can !== true) return json({ ok: false, code: "FORBIDDEN" }, 403);
  }

  // 2) 대기열 — 오래된 것부터
  const { data: queue, error: qErr } = await app
    .from("biz_os_queue")
    .select("book_id, month, queued_at, tries")
    .lt("tries", MAX_TRIES)
    .order("queued_at", { ascending: true })
    .limit(BATCH);
  if (qErr) {
    console.error("biz-os-sync queue", qErr.code ?? "error");
    return json({ ok: false, code: "QUEUE_READ" }, 500);
  }
  const rows = (queue ?? []) as QueueRow[];
  if (rows.length === 0) return json({ ok: true, cron, done: 0, counts: {} });

  const os = createClient(OS_URL, OS_KEY, { auth: { persistSession: false } });
  const caches = { branch: new Map<string, string | null>(), rules: new Map<string, OsRule[]>() };
  const counts: Record<string, number> = {};
  let failed = 0;
  for (const q of rows) {
    try {
      const code = await syncOne(app, os, q, caches);
      counts[code] = (counts[code] ?? 0) + 1;
      if (code === "no_os_branch") {
        // 153OS 에 같은 이름 지점이 없다 — 다시 해도 같으니 멈춰 둔다(가계부를 다시 고치면 0부터)
        await app
          .from("biz_os_queue")
          .update({ tries: MAX_TRIES, last_error: "153OS 에 같은 이름 지점이 없음" })
          .eq("book_id", q.book_id)
          .eq("month", q.month)
          .eq("queued_at", q.queued_at);
      } else {
        // 처리하는 동안 다시 들어온 일(queued_at 이 바뀜)은 남겨 둔다 — 다음 번에 다시 맞춘다
        await app.from("biz_os_queue").delete().eq("book_id", q.book_id).eq("month", q.month).eq("queued_at", q.queued_at);
      }
    } catch (e) {
      failed += 1;
      const msg = String((e as Error)?.message ?? e).slice(0, 300);
      console.error("biz-os-sync fail", msg.split(":")[0]);
      await app
        .from("biz_os_queue")
        .update({ tries: q.tries + 1, last_error: msg })
        .eq("book_id", q.book_id)
        .eq("month", q.month)
        .eq("queued_at", q.queued_at);
    }
  }
  console.log("biz-os-sync", JSON.stringify({ cron, n: rows.length, failed, counts }));
  return json({ ok: failed === 0, cron, done: rows.length - failed, failed, counts });
});
