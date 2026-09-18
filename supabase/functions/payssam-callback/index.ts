// 결제선생(Payssam) 결제 승인 콜백 수신 — 공개 엔드포인트.
// 결제선생이 결제 승인/취소 결과를 이 URL 로 POST 한다. (청구서 생성 시 callbackUrl 로 등록)
// 승인(apprState=F) 이면 주문을 paid 처리하고 수강권 만료일을 duration_days 만큼 연장,
// 회원 누적 결제금액(payment_total)을 가산한다.
// ⚠️ 이 함수는 결제선생 서버가 호출하므로 JWT 없이 접근 가능해야 한다 → Supabase 에서 verify_jwt=false 설정 필요.
//
// 인증 (2026-08-04 수정):
//   실제 수신된 콜백 payload 를 확인한 결과 필드는 billId/apprState/apprPrice 뿐이고
//   **apiKey 는 오지 않는다**. 기존 apiKey 검사는 "있는데 틀릴 때만" 거부하는 형태라
//   한 번도 작동한 적이 없었다 → 청구서번호만 알면 누구나 결제완료를 위조할 수 있었다.
//   결제선생이 공개한 발신 서버 IP 로 발신지를 검증한다(현재 유일한 실효 인증수단).
//   apiKey 가 오는 경우엔 기존대로 함께 검증한다.
//
// 2026-09-18 수정 (2건) — 첫 실결제·취소 검증에서 드러난 문제.
//   ① API 키 저장 금지: 콜백에는 운영 API 키가 실제로 실려 온다(발신 IP 3.39.97.44 확인).
//      raw 에 그대로 저장돼 회원이 자기 주문을 통해 조회할 수 있었다. 저장 전에 제거한다.
//   ② 취소가 아무것도 되돌리지 않던 문제: 수강권 만료일·누적결제액·CRM 이용권·출입권한까지
//      승인 때 한 일을 역순으로 되돌린다.
import { createClient } from "npm:@supabase/supabase-js@2";

// 결제선생 발신 서버 IP — 2026-08 서버 이전 공지 기준.
// 목록이 바뀌면 코드 수정 없이 PAYSSAM_ALLOWED_IPS 환경변수로 덮어쓴다(쉼표 구분).
const DEFAULT_PAYSSAM_IPS = [
  "52.78.118.82", "52.78.236.125", "52.79.214.146",
  "3.36.243.225", "3.39.97.44", "13.209.0.172", "13.209.248.179",
];

/** 프록시를 거쳐 오므로 x-forwarded-for 의 첫 주소가 실제 발신지다. */
const clientIp = (req: Request): string => {
  const xff = req.headers.get("x-forwarded-for") || "";
  const first = xff.split(",")[0].trim();
  return first || req.headers.get("x-real-ip") || req.headers.get("cf-connecting-ip") || "";
};

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

/** 결제선생 콜백에는 운영 API 키가 실려 온다. DB 에 남기기 전에 반드시 제거한다.
    payment_orders 는 'own orders select' 정책으로 회원이 자기 주문을 읽으므로,
    그대로 저장하면 회원이 결제 API 키를 조회할 수 있다. */
const scrub = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(scrub);
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (k === "apiKey" || k === "apikey" || k === "api_key") continue;
      o[k] = scrub(val);
    }
    return o;
  }
  return v;
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

    // 인증 1 — apiKey 가 실려 온 경우엔 반드시 일치해야 한다(평소엔 오지 않음).
    if (PAYSSAM_API_KEY && apiKey && apiKey !== PAYSSAM_API_KEY) {
      return json({ code: "9999", message: "invalid apiKey" }, 401);
    }

    // 인증 2 — 발신지 IP. 결제선생이 apiKey 를 보내지 않으므로 이것이 실질적인 유일한 인증이다.
    //   · 정상 호출이 막히면 PAYSSAM_ALLOWED_IPS 에 그 IP 를 추가하면 즉시 풀린다.
    //   · 급하면 PAYSSAM_IP_ENFORCE=false 로 차단을 끌 수 있다(기록은 계속 남는다).
    const allowed = new Set(
      (Deno.env.get("PAYSSAM_ALLOWED_IPS") || DEFAULT_PAYSSAM_IPS.join(","))
        .split(",").map((v) => v.trim()).filter(Boolean),
    );
    const enforce = (Deno.env.get("PAYSSAM_IP_ENFORCE") || "true").toLowerCase() !== "false";
    const srcIp = clientIp(req);
    const ipOk = allowed.has(srcIp);
    console.log(`[payssam-callback] ip=${srcIp} allowed=${ipOk} enforce=${enforce} billId=${billId} apprState=${apprState}`);
    if (!ipOk) {
      if (enforce) {
        // 정상 호출이 잘못 막혔을 때 손으로 복구할 수 있도록 payload 를 통째로 남긴다.
        console.error(
          `[payssam-callback] 차단 — 미등록 IP ${srcIp}. 정상 호출이었다면 PAYSSAM_ALLOWED_IPS 에 추가하세요. payload=`,
          JSON.stringify(scrub(body)),
        );
        return json({ code: "9999", message: "forbidden" }, 403);
      }
      console.warn(`[payssam-callback] 미등록 IP ${srcIp} — 기록만 하고 통과(PAYSSAM_IP_ENFORCE=false)`);
    }

    if (!billId) return json({ code: "9999", message: "no billId" }, 400);

    // DB 에 남길 payload — API 키는 절대 포함하지 않는다.
    const safeRaw = { ...(scrub(body) as Record<string, unknown>), _src_ip: srcIp, _ip_ok: ipOk };

    const { data: order } = await admin.from("payment_orders").select("*").eq("bill_id", billId).maybeSingle();
    if (!order) return json(OK); // 모르는 청구서(검수 테스트 등)는 멱등 무시 — 그래도 0000 정상응답

    if (apprState === "F") {
      // 금액 검증
      if (apprPrice && Number(apprPrice) !== Number(order.amount)) {
        await admin.from("payment_orders").update({ status: "failed", raw: safeRaw }).eq("id", order.id);
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
            raw: safeRaw,
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
      // ── 취소 ────────────────────────────────────────────────────────────────
      // 예전에는 주문 status 만 바꿨다. 그래서 환불된 회원의 수강권 만료일도,
      // CRM 이용권도, 출입권한도 전부 살아 있었다 — 환불받고 한 달 더 다닐 수 있었다.
      // 승인 때 한 일을 역순으로 되돌린다. 이미 canceled 면 아무것도 하지 않는다
      // (취소 콜백 중복 수신 시 이중 차감 방지).
      if (order.status === "canceled") return json(OK);
      const wasPaid = order.status === "paid";

      await admin.from("payment_orders").update({ status: "canceled", raw: safeRaw }).eq("id", order.id);

      if (wasPaid) {
        // 1) 앱 프로필 되돌리기 — 연장했던 일수만큼 빼고, 누적결제액에서 차감.
        const days = Number(order.duration_days || 0);
        const { data: prof } = await admin
          .from("profiles")
          .select("membership_end, payment_total")
          .eq("user_id", order.user_id)
          .maybeSingle();
        const updates: Record<string, unknown> = {
          payment_total: Math.max(0, Number(prof?.payment_total || 0) - Number(order.amount)) || null,
        };
        if (days > 0 && prof?.membership_end) {
          const back = new Date(new Date(prof.membership_end + "T00:00:00").getTime() - days * DAY);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          // 되돌린 날짜가 오늘보다 과거면 수강권이 없는 상태로 본다.
          updates.membership_end = back.getTime() > today.getTime() ? back.toISOString().slice(0, 10) : null;
        }
        await admin.from("profiles").update(updates).eq("user_id", order.user_id);

        // 2) CRM 이용권·출입권한 해지 — 승인 때 만든 것을 같은 주문ID로 되돌린다.
        //    실패해도 취소 처리 자체는 막지 않되(비차단), 반드시 로그로 남긴다.
        //    조용히 넘어가면 환불된 회원이 계속 출입하게 된다.
        try {
          const OS_API_URL = Deno.env.get("OS_API_URL") || "https://153-boxing-os-api.boxing5969.workers.dev";
          const OS_PARTNER_KEY = Deno.env.get("OS_PARTNER_KEY") || "";
          if (OS_PARTNER_KEY) {
            const ac = new AbortController();
            const timer = setTimeout(() => ac.abort(), 6000);
            const r = await fetch(`${OS_API_URL}/api/external/me/sync-refunded`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Partner-Key": OS_PARTNER_KEY,
                "X-Ranking-User-Id": String(order.user_id),
              },
              body: JSON.stringify({
                ext_order_id: String(order.id),
                amount: Number(order.amount || 0),
                reason: "결제선생 결제 취소",
              }),
              signal: ac.signal,
            });
            clearTimeout(timer);
            if (!r.ok) {
              console.error(
                `[payssam-callback] CRM 취소 반영 실패 (${r.status}) — 이용권·출입권한을 데스크에서 직접 해지해야 합니다.`,
                `order_id=${order.id} bill_id=${billId}`,
                await r.text().catch(() => ""),
              );
            }
          }
        } catch (e) {
          console.error("[payssam-callback] CRM 취소 반영 오류 — 수동 해지 필요:", `order_id=${order.id}`, e);
        }
      }
    }

    return json(OK);
  } catch (e) {
    console.error("payssam-callback error:", e);
    return json({ code: "9999" }, 500);
  }
});
