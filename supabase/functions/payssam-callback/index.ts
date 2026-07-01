// 결제선생(Payssam) 결제 승인 콜백 수신 — 공개 엔드포인트.
// 결제선생이 결제 승인/취소 결과를 이 URL 로 POST 한다. (청구서 생성 시 callbackUrl 로 등록)
// 승인(apprState=F) 이면 주문을 paid 처리하고 수강권 만료일을 duration_days 만큼 연장,
// 회원 누적 결제금액(payment_total)을 가산한다.
// ⚠️ 이 함수는 결제선생 서버가 호출하므로 JWT 없이 접근 가능해야 한다 → Supabase 에서 verify_jwt=false 설정 필요.
//    검증은 payload 의 apiKey 가 PAYSSAM_API_KEY 와 일치하는지로 1차 확인(추가로 IP 화이트리스트 권장).
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const DAY = 86400000;
// 페이민트 승인동기화 정상 수신 응답 — 문서 규격 그대로 반환해야 검수가 완료된다.
const OK = { code: "0000", msg: "성공하였습니다." };
// 페이민트 콜백은 snake_case(appr_state 등), OpenAPI 스키마는 camelCase — 양쪽 모두 수용.
const pick = (o: Record<string, unknown>, ...keys: string[]): string => {
  for (const k of keys) {
    const v = o?.[k];
    if (v !== undefined && v !== null && String(v) !== "") return String(v);
  }
  return "";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const PAYSSAM_API_KEY = Deno.env.get("PAYSSAM_API_KEY") || "";
    const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const billId = pick(body, "billId", "bill_id");
    const apiKey = pick(body, "apiKey", "apikey", "api_key");
    const apprState = pick(body, "apprState", "appr_state");
    const apprPrice = pick(body, "apprPrice", "appr_price");

    // 1차 인증: payload apiKey 검증
    if (PAYSSAM_API_KEY && apiKey && apiKey !== PAYSSAM_API_KEY) {
      return json({ code: "9999", message: "invalid apiKey" }, 401);
    }
    if (!billId) return json({ code: "9999", message: "no billId" }, 400);

    const { data: order } = await admin.from("payment_orders").select("*").eq("bill_id", billId).maybeSingle();
    if (!order) return json(OK); // 모르는 청구서(검수 테스트 등)는 멱등 무시 — 그래도 0000 정상응답

    if (apprState === "F") {
      // 금액 검증
      if (apprPrice && Number(apprPrice) !== Number(order.amount)) {
        await admin.from("payment_orders").update({ status: "failed", raw: body }).eq("id", order.id);
        return json(OK);
      }
      if (order.status !== "paid") {
        await admin
          .from("payment_orders")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            appr_num: pick(body, "apprNum", "appr_num"),
            appr_card: pick(body, "apprIssuer", "appr_issuer", "apprCardType", "appr_card_type", "apprPayType", "appr_pay_type"),
            raw: body,
          })
          .eq("id", order.id);

        // 수강권 만료일 연장 + 누적 결제금액 가산
        const days = Number(order.duration_days || 0);
        const { data: prof } = await admin
          .from("profiles")
          .select("membership_end, payment_total, name, phone_number")
          .eq("user_id", order.user_id)
          .maybeSingle();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const cur = prof?.membership_end ? new Date(prof.membership_end + "T00:00:00") : null;
        const base = cur && cur.getTime() > today.getTime() ? cur : today;
        const updates: Record<string, unknown> = {
          payment_total: Number(prof?.payment_total || 0) + Number(order.amount),
        };
        if (days > 0) {
          updates.membership_end = new Date(base.getTime() + days * DAY).toISOString().slice(0, 10);
        }
        await admin.from("profiles").update(updates).eq("user_id", order.user_id);

        // 153OS(CRM 두뇌) 동기화 — 회원·이용권·출입권한 생성 + 브로제이 단말 동기화 큐잉.
        // 외부주문ID(order.id)로 멱등. 실패해도 결제 처리엔 영향 없게 비차단(try/catch).
        try {
          const OS_API_URL = Deno.env.get("OS_API_URL") || "https://153-boxing-os-api.boxing5969.workers.dev";
          const OS_PARTNER_KEY = Deno.env.get("OS_PARTNER_KEY") || "";
          if (OS_PARTNER_KEY) {
            const months = Math.max(1, Math.round(Number(order.duration_days || 0) / 30));
            const ac = new AbortController();
            const timer = setTimeout(() => ac.abort(), 6000);
            const r = await fetch(`${OS_API_URL}/api/external/me/sync-paid`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Partner-Key": OS_PARTNER_KEY,
                "X-Ranking-User-Id": String(order.user_id),
              },
              body: JSON.stringify({
                ext_order_id: String(order.id),
                plan_name: String(order.product_name || "수강권"),
                amount: Number(order.amount || 0),
                months,
                name: prof?.name || undefined,
                phone: prof?.phone_number || undefined,
              }),
              signal: ac.signal,
            });
            clearTimeout(timer);
            if (!r.ok) console.error("153OS sync-paid failed:", r.status, await r.text().catch(() => ""));
          }
        } catch (e) {
          console.error("153OS sync-paid error:", e);
        }
      }
    } else if (apprState === "C") {
      await admin.from("payment_orders").update({ status: "canceled", raw: body }).eq("id", order.id);
    }

    return json(OK);
  } catch (e) {
    console.error("payssam-callback error:", e);
    return json({ code: "9999" }, 500);
  }
});
