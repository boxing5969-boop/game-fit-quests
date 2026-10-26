// 결제선생 관리자에서 취소한 결제 → 앱 · 153OS 되돌리기 (크론 전용, 2026-10-27).
//
// 결제선생은 관리자 화면에서 승인 취소를 해도 우리 콜백(payssam-callback, apprState=C)을 보내지 않는다.
//   9/18 첫 시험 결제 취소도, 10/27 대표님 시험 결제(장바구니 218,000원 · 마일리지 22,000) 취소도
//   콜백은 승인(F) 한 번뿐이었다 → 앱에는 수강권 · 락카 · 운동복이 늘어난 채, 마일리지는 빠진 채, 153OS 이용권 · 출입권한도 살아 있었다.
// 그래서 이 함수가 '결제 완료(paid)' 주문을 결제선생 /bill/read 로 다시 조회해, 취소된 청구서면
// payssam-callback 의 취소(apprState=C)와 같은 일을 한다:
//   ① 주문 canceled (raw 에 _canceled_at · _canceled_by · _prev_status — 승인 기록은 그대로 둔다)
//      → 마일리지는 DB 트리거(payment_orders_mileage)가 돌려준다
//   ② 장바구니 주문은 revert_payment_order(항목마다 수강권 · 락카 · 운동복 · 누적 결제액) / 예전 주문은 수강권 일수 빼기
//   ③ 153OS app_refund_paid_membership (수강권이 든 주문만 — 승인 때도 수강권만 보냈다)
//   ④ 맞춰 보기: 앱에서는 이미 취소(콜백 C 등)인데 153OS 에 '결제'로 남은 주문도 같은 153OS 함수로 (raw._os_refund 로 한 번만)
//
// 흐름: pg_cron(payssam-sync-cancels) → 이 함수. 인증은 sync-rental-ends 와 같은 x-auto-key(internal_sync_config.auto_sync_key).
//   verify_jwt=false 필수(config.toml). 이력: member_sync_runs(mode='payssam-cancel').
// body: {dry_run?: true}        → 조회만 하고 바꾸지 않는다(청구서 상태 칸만 돌려준다 — 이름 · 번호는 돌려주지 않는다)
//       {bill_ids?: string[]}   → 그 청구서만
//       {days?: number}         → 결제한 지 며칠 안의 주문까지 볼지 (기본 7일, 매일 한 번은 400일)
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-auto-key",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const DAY = 86400000;

type Order = {
  id: string;
  user_id: string;
  bill_id: string;
  amount: number;
  duration_days: number | null;
  status: string;
  raw: Record<string, unknown> | null;
  product_name: string | null;
};
type OrderItem = { kind: string; product_name: string; months: number; amount: number; duration_days: number };

/** 청구서 조회 결과에서 상태를 알 수 있는 칸만 남긴다 (이름 · 전화번호 같은 개인 정보는 버린다) */
const stateFields = (d: unknown): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  if (!d || typeof d !== "object") return out;
  for (const [k, v] of Object.entries(d as Record<string, unknown>)) {
    if (/state|status|cancel|refund|price|Dt$|date/i.test(k) && (v === null || typeof v !== "object")) out[k] = v;
  }
  return out;
};

/** 취소된 청구서인가 — 결제선생 apprState: F 승인 · C 취소 (부분 취소도 취소로 본다) */
const isCanceled = (d: Record<string, unknown> | null): boolean => {
  if (!d) return false;
  const st = String(d.apprState ?? d.appr_state ?? "").toUpperCase();
  return st === "C" || st === "PC" || st === "CANCEL" || st === "CANCELED" || st === "CANCELLED";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const PAYSSAM_API_KEY = Deno.env.get("PAYSSAM_API_KEY") || "";
  const PAYSSAM_MERCHANT = Deno.env.get("PAYSSAM_MERCHANT") || "";
  const PAYSSAM_MEMBER = Deno.env.get("PAYSSAM_MEMBER") || "";
  const PAYSSAM_BASE_URL = Deno.env.get("PAYSSAM_BASE_URL") || "https://sandbox.paymint.co.kr/partner";
  const app = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const provided = req.headers.get("x-auto-key") || "";
    const { data: cfg } = await app.from("internal_sync_config").select("value").eq("key", "auto_sync_key").maybeSingle();
    if (!cfg?.value || provided !== cfg.value) return json({ error: "unauthorized" }, 401);
    if (!PAYSSAM_API_KEY || !PAYSSAM_MERCHANT) return json({ error: "결제 설정 없음" }, 503);

    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run === true;
    const billIds = Array.isArray(body?.bill_ids) ? (body.bill_ids as unknown[]).map(String).filter(Boolean).slice(0, 50) : [];
    const days = Math.min(400, Math.max(1, Math.floor(Number(body?.days) || 7)));

    // 1) 결제 완료 주문 (결제선생 청구서만 — 예전 모의 시험 TEST-… 는 뺀다)
    let q = app
      .from("payment_orders")
      .select("id, user_id, bill_id, amount, duration_days, status, raw, product_name")
      .eq("status", "paid")
      .not("bill_id", "is", null)
      .not("bill_id", "like", "TEST-%")
      .order("paid_at", { ascending: false })
      .limit(200);
    q = billIds.length > 0 ? q.in("bill_id", billIds) : q.gte("paid_at", new Date(Date.now() - days * DAY).toISOString());
    const { data: orders, error: oErr } = await q;
    if (oErr) throw new Error(`payment_orders: ${oErr.message}`);

    const results: Array<Record<string, unknown>> = [];
    let canceled = 0;
    let failed = 0;
    for (const o of (orders || []) as Order[]) {
      // 2) 결제선생 청구서 조회 — 만들 때와 같은 member (create-bill: PAYSSAM_MEMBER || 회원 id)
      let data: Record<string, unknown> | null = null;
      let code = "";
      try {
        const res = await fetch(`${PAYSSAM_BASE_URL}/bill/read`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey: PAYSSAM_API_KEY,
            member: PAYSSAM_MEMBER || o.user_id,
            merchant: PAYSSAM_MERCHANT,
            bill: { billId: o.bill_id },
          }),
        });
        const out = await res.json().catch(() => ({}));
        code = String(out?.code ?? res.status);
        data = out?.data && typeof out.data === "object" ? (out.data as Record<string, unknown>) : null;
      } catch (e) {
        failed++;
        results.push({ bill_id: o.bill_id, error: e instanceof Error ? e.message : String(e) });
        continue;
      }
      const fields = stateFields(data);
      const cancel = code === "0000" && isCanceled(data);
      results.push({ bill_id: o.bill_id, code, canceled: cancel, fields, keys: data ? Object.keys(data) : [] });
      if (!cancel || dryRun) continue;

      // 3) 취소 반영 — payssam-callback 의 apprState=C 와 같은 일
      const { data: itemRows } = await app
        .from("payment_order_items")
        .select("kind, product_name, months, amount, duration_days")
        .eq("order_id", o.id);
      const items = (itemRows || []) as OrderItem[];
      const memItem = items.find((i) => i.kind === "membership") || null;

      const { data: upd, error: uErr } = await app
        .from("payment_orders")
        .update({
          status: "canceled",
          raw: {
            ...(o.raw || {}),
            _canceled_at: new Date().toISOString(),
            _canceled_by: "결제선생 관리자 취소 — 청구서 조회로 확인(payssam-sync-cancels)",
            _prev_status: "paid",
            _cancel_read: fields,
          },
        })
        .eq("id", o.id)
        .eq("status", "paid")
        .select("id");
      if (uErr || !upd || upd.length === 0) {
        // 그사이 다른 곳(콜백)이 먼저 바꿨으면 건너뛴다
        results[results.length - 1].skipped = uErr ? uErr.message : "already changed";
        continue;
      }
      canceled++;

      if (items.length > 0) {
        const { error: rErr } = await app.rpc("revert_payment_order", { p_order_id: o.id });
        if (rErr) console.error("[payssam-sync-cancels] ⚠️ 항목 되돌리기 실패 — 손으로 되돌려야 합니다:", `order_id=${o.id}`, rErr.message);
      } else {
        const d = Number(o.duration_days || 0);
        const { data: prof } = await app.from("profiles").select("membership_end, payment_total").eq("user_id", o.user_id).maybeSingle();
        const updates: Record<string, unknown> = {
          payment_total: Math.max(0, Number(prof?.payment_total || 0) - Number(o.amount)) || null,
        };
        if (d > 0 && prof?.membership_end) {
          const back = new Date(new Date(prof.membership_end + "T00:00:00").getTime() - d * DAY);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          updates.membership_end = back.getTime() > today.getTime() ? back.toISOString().slice(0, 10) : null;
        }
        await app.from("profiles").update(updates).eq("user_id", o.user_id);
      }

      // 153OS 이용권 · 출입권한 해지 (승인 때 수강권을 보낸 주문만).
      //   153OS 워커에는 취소 길(/api/external/me/sync-refunded)이 없다(404, 10/27 확인) → 153OS DB 함수
      //   app_refund_paid_membership(승인 때 app_sync_paid_membership 이 만든 것을 거꾸로)을 서버 키로 바로 부른다.
      try {
        const OS_URL = Deno.env.get("OS_SUPABASE_URL") || "https://tbxdrfowanyksgdicryl.supabase.co";
        const OS_KEY = Deno.env.get("OS_SERVICE_KEY") || "";
        if (!OS_KEY) {
          results[results.length - 1].os = { error: "OS_SERVICE_KEY 없음" };
        } else if (items.length === 0 || memItem) {
          const os = createClient(OS_URL, OS_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
          const { data: osRes, error: osErr } = await os.rpc("app_refund_paid_membership", {
            _ext_order_id: String(o.id),
            _amount: Number((memItem ? memItem.amount : o.amount) || 0),
            _reason: "결제선생 결제 취소",
          });
          results[results.length - 1].os = osErr ? { error: osErr.message } : osRes;
          if (osErr) {
            console.error("[payssam-sync-cancels] ⚠️ 153OS 취소 반영 실패 — 이용권 · 출입권한을 손으로 해지해야 합니다.", `order_id=${o.id}`, osErr.message);
          }
        }
      } catch (e) {
        results[results.length - 1].os = { error: e instanceof Error ? e.message : String(e) };
        console.error("[payssam-sync-cancels] ⚠️ 153OS 취소 반영 오류:", `order_id=${o.id}`, e);
      }
    }

    // 4) 맞춰 보기 — 앱에서는 이미 취소인데(콜백 C · 위 3번 · 9/18 손 정리) 153OS 에는 아직 '결제'로 남았을 수 있는 주문.
    //    app_refund_paid_membership 은 두 번 불러도 한 번만 되므로, 한 번 확인한 주문은 raw._os_refund 를 남겨 다시 부르지 않는다.
    //    (payment_orders 의 마일리지 트리거는 status 가 바뀔 때만 돈다 — raw 만 고치면 돌지 않는다)
    let reconciled = 0;
    const OS_KEY = Deno.env.get("OS_SERVICE_KEY") || "";
    if (!dryRun && OS_KEY) {
      const os = createClient(Deno.env.get("OS_SUPABASE_URL") || "https://tbxdrfowanyksgdicryl.supabase.co", OS_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      let cq = app
        .from("payment_orders")
        .select("id, amount, raw")
        .eq("status", "canceled")
        .not("paid_at", "is", null)
        .is("raw->_os_refund", null)
        .limit(100);
      cq = billIds.length > 0 ? cq.in("bill_id", billIds) : cq.gte("paid_at", new Date(Date.now() - days * DAY).toISOString());
      const { data: cans } = await cq;
      for (const c of (cans || []) as Array<{ id: string; amount: number; raw: Record<string, unknown> | null }>) {
        const { data: its } = await app.from("payment_order_items").select("kind, amount").eq("order_id", c.id);
        const list = (its || []) as Array<{ kind: string; amount: number }>;
        const mem = list.find((i) => i.kind === "membership") || null;
        let mark = "no_membership"; // 운동복 · 락카만 산 주문은 153OS 에 보내지 않았다
        if (list.length === 0 || mem) {
          const { data: r, error: e } = await os.rpc("app_refund_paid_membership", {
            _ext_order_id: String(c.id),
            _amount: Number((mem ? mem.amount : c.amount) || 0),
            _reason: "결제선생 결제 취소",
          });
          if (e) {
            console.error("[payssam-sync-cancels] ⚠️ 153OS 맞춰 보기 실패:", `order_id=${c.id}`, e.message);
            continue;
          }
          const res = (r ?? {}) as { ok?: boolean; already?: boolean; reason?: string };
          mark = res.already ? "already" : res.ok ? "done" : res.reason || "none";
          if (res.ok && !res.already) reconciled++;
        }
        await app
          .from("payment_orders")
          .update({ raw: { ...(c.raw || {}), _os_refund: mark, _os_refund_at: new Date().toISOString() } })
          .eq("id", c.id);
      }
    }

    // 기록은 취소를 반영했거나 · 153OS 를 맞췄거나 · 조회가 실패했거나 · 하루 한 번(긴 기간) 돌 때만 (30분마다 빈 줄이 쌓이지 않게)
    if (!dryRun && (canceled > 0 || reconciled > 0 || failed > 0 || days >= 30 || billIds.length > 0)) {
      await app.from("member_sync_runs").insert({
        mode: "payssam-cancel",
        ok: failed === 0,
        scanned: (orders || []).length,
        updated: canceled,
        failed,
        note: `결제 완료 ${(orders || []).length}건 조회 · 취소 반영 ${canceled}건 · 153OS 맞춤 ${reconciled}건${billIds.length ? " (청구서 지정)" : ` (${days}일)`}`,
      });
    }
    return json({ ok: true, dry_run: dryRun, scanned: (orders || []).length, canceled, reconciled, failed, results });
  } catch (e) {
    console.error("payssam-sync-cancels error:", e);
    await app.from("member_sync_runs")
      .insert({ mode: "payssam-cancel", ok: false, error: (e instanceof Error ? e.message : String(e)).slice(0, 500) })
      .then(() => undefined, () => undefined);
    return json({ error: "처리 중 오류가 발생했습니다." }, 500);
  }
});
