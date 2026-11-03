// 💰 ops-sales — 153운영본부 「매출」 탭 (2026-11-03 대표님 "153운영본부에 매출 자세히 알 수 있도록 · 일반 수강권 매출과 PT 매출을 분리해서")
//
// 화면(src/components/ops/OpsSalesTab.tsx)이 부른다. verify_jwt = true.
//   1) 부른 사람 토큰으로 앱 ops_sales_scope() — 돈을 보는 분(대표님 · 회계매니저, _ops_can_see_pay)이 볼 수 있는 지점만.
//   2) 153OS(서버 키 OS_SERVICE_KEY)에서 그 지점 매출: 브로제이 sales_entries · 다짐 dagym_sales + 들어온 시각.
//      앱 DB 에서 앱 결제(payment_orders · payment_order_items, paid) — 브로제이에 이미 적힌 것은 뺀다(dedupeApp).
//   3) 나누기 · 합치기는 logic.ts — 일반 수강권 · PT · 일일권 · 락카/운동복 · 용품 · 기타. 고른 달 합계 · 줄, 지난 n달 흐름.
//   body { branch, month: 'YYYY-MM', months?: 1~12 (흐름, 기본 6) }
//   점검(probe): x-auto-key(internal_sync_config.auto_sync_key)면 사람 확인 없이 합계 · 흐름만(이름 · 줄 없음) — 서버에서 시험할 때.
// 읽기 전용. 로그에는 지점 · 결과 코드만(이름 · 금액 안 찍음).
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  addDays,
  dedupeApp,
  fromApp,
  fromBroj,
  fromDagym,
  monthRange,
  sortRows,
  summarize,
  trendOf,
  type AppOrder,
  type SalesRow,
} from "./logic.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-auto-key",
};
// 답은 늘 200 { ok: true, … } | { ok: false, code } — 화면이 code 로 안내한다
const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const PAGE = 1000;
const MAX_ROWS = 20000;
const ROWS_OUT = 2000;

/** PostgREST 는 한 번에 1,000줄 — 끝까지 넘겨 읽는다 */
async function readAll<T>(page: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const out: T[] = [];
  for (let a = 0; a < MAX_ROWS; a += PAGE) {
    const { data, error } = await page(a, a + PAGE - 1);
    if (error) throw new Error(error.message ?? "read_failed");
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const OS_URL = Deno.env.get("OS_SUPABASE_URL") || "https://tbxdrfowanyksgdicryl.supabase.co";
  const OS_KEY = Deno.env.get("OS_SERVICE_KEY") || "";
  if (!OS_KEY) return json({ ok: false, code: "OS_NOT_CONFIGURED" });
  const app = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

  const body: any = await req.json().catch(() => ({}));
  const branch = String(body?.branch ?? "").trim();
  const month = String(body?.month ?? "").trim();
  const n = Math.min(12, Math.max(1, Math.round(Number(body?.months ?? 6)) || 6));
  if (!branch || branch.length > 60 || !MONTH.test(month)) return json({ ok: false, code: "INVALID_REQUEST" });

  // 1) 누가 — 점검(서버 열쇠) 또는 돈을 보는 분
  let probe = false;
  const autoKey = req.headers.get("x-auto-key") || "";
  if (autoKey) {
    const { data: cfg } = await app.from("internal_sync_config").select("value").eq("key", "auto_sync_key").maybeSingle();
    if (!cfg?.value || autoKey !== cfg.value) return json({ ok: false, code: "FORBIDDEN" });
    const { data: ob } = await app.from("ops_branches").select("branch_name").eq("branch_name", branch).eq("enabled", true).maybeSingle();
    if (!ob) return json({ ok: false, code: "FORBIDDEN" });
    probe = true;
  } else {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ ok: false, code: "NOT_AUTHENTICATED" });
    const asUser = createClient(SUPABASE_URL, ANON, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: scope, error: scopeErr } = await asUser.rpc("ops_sales_scope");
    if (scopeErr) {
      console.error("ops-sales scope", scopeErr.code ?? scopeErr.message);
      return json({ ok: false, code: "NOT_AUTHENTICATED" });
    }
    const allowed: string[] = Array.isArray(scope?.branches) ? scope.branches : [];
    if (!allowed.includes(branch)) return json({ ok: false, code: "FORBIDDEN" });
  }

  const { from, to, months } = monthRange(month, n);
  // 앱 결제 중복 맞추기는 앞뒤 며칠 더 본다(달 경계)
  const crmFrom = addDays(from, -1);
  const crmTo = addDays(to, 3);
  const os = createClient(OS_URL, OS_KEY, { auth: { persistSession: false } });

  try {
    const { data: ob, error: obErr } = await os.from("branches").select("id").eq("name", branch).maybeSingle();
    if (obErr) throw new Error(obErr.message);
    const branchId = (ob as any)?.id as string | undefined;

    const [broj, dagym, brojRun, dagymRun, orders] = await Promise.all([
      branchId
        ? readAll<any>((a, b) =>
            os
              .from("sales_entries")
              .select("id, sale_date, created_at, member_name, category, product, payment_method, amount")
              .eq("branch_id", branchId)
              .gte("sale_date", crmFrom)
              .lte("sale_date", crmTo)
              .order("sale_date", { ascending: true })
              .order("id", { ascending: true })
              .range(a, b),
          )
        : Promise.resolve([]),
      branchId
        ? readAll<any>((a, b) =>
            os
              .from("dagym_sales")
              .select("row_id, sale_id, sale_date, income_at, member_name, sale_category, sale_name, income, payment_method, status")
              .eq("branch_id", branchId)
              .gte("sale_date", crmFrom)
              .lte("sale_date", crmTo)
              .neq("status", "missing")
              .order("sale_date", { ascending: true })
              .order("row_id", { ascending: true })
              .range(a, b),
          )
        : Promise.resolve([]),
      branchId
        ? os
            .from("broj_sync_runs")
            .select("started_at")
            .eq("branch_id", branchId)
            .eq("kind", "sales")
            .eq("status", "success")
            .order("started_at", { ascending: false })
            .limit(1)
        : Promise.resolve({ data: [], error: null }),
      branchId
        ? os
            .from("dagym_batches")
            .select("closed_at")
            .eq("branch_id", branchId)
            .gt("sales_received", 0)
            .not("closed_at", "is", null)
            .order("closed_at", { ascending: false })
            .limit(1)
        : Promise.resolve({ data: [], error: null }),
      readAll<any>((a, b) =>
        app
          .from("payment_orders")
          .select("id, user_id, product_name, amount, paid_at, payment_order_items(kind, product_name, amount)")
          .eq("branch_name", branch)
          .eq("status", "paid")
          .gte("paid_at", `${from}T00:00:00+09:00`)
          .lte("paid_at", `${to}T23:59:59.999+09:00`)
          .order("paid_at", { ascending: true })
          .range(a, b),
      ),
    ]);

    // 앱 결제한 분 이름 (중복 맞추기 · 줄에 보이기)
    const userIds = [...new Set(orders.map((o: any) => o.user_id).filter(Boolean))] as string[];
    const names = new Map<string, string>();
    if (userIds.length) {
      const { data: profs } = await app.from("profiles").select("user_id, name").in("user_id", userIds);
      for (const p of (profs ?? []) as any[]) if (p?.name) names.set(p.user_id, String(p.name));
    }
    const appOrders: AppOrder[] = orders.map((o: any) => ({
      id: o.id,
      user_id: o.user_id,
      product_name: o.product_name,
      amount: o.amount,
      paid_at: o.paid_at,
      items: o.payment_order_items ?? null,
    }));

    const crm: SalesRow[] = [...fromBroj(broj), ...fromDagym(dagym)];
    const appRows = dedupeApp(fromApp(appOrders, names), crm);
    const all = [...crm, ...appRows].filter((r) => r.day >= from && r.day <= to);
    const monthRows = all.filter((r) => r.day.startsWith(month));

    const src = dagym.length > 0 || ((dagymRun as any)?.data?.length ?? 0) > 0 ? "dagym" : broj.length > 0 || ((brojRun as any)?.data?.length ?? 0) > 0 ? "broj" : "none";
    const syncedAt =
      src === "dagym" ? ((dagymRun as any)?.data?.[0]?.closed_at ?? null) : src === "broj" ? ((brojRun as any)?.data?.[0]?.started_at ?? null) : null;
    const sorted = sortRows(monthRows);

    console.log("ops-sales ok", branch, month, probe ? "probe" : "user", monthRows.length);
    return json({
      ok: true,
      branch,
      month,
      src,
      synced_at: syncedAt,
      app_added: monthRows.filter((r) => r.src === "app").length,
      summary: summarize(monthRows),
      trend: trendOf(all, months),
      rows: probe ? [] : sorted.slice(0, ROWS_OUT),
      truncated: !probe && sorted.length > ROWS_OUT,
      ...(probe ? { probe: { broj: broj.length, dagym: dagym.length, app: orders.length, app_added: appRows.length } } : {}),
    });
  } catch (e) {
    console.error("ops-sales failed", branch, (e as Error).message);
    return json({ ok: false, code: "READ_FAILED" });
  }
});
