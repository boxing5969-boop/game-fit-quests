// 결제선생(Payssam) 청구서 생성·발송 — 회원 자가결제(sendType=URL).
// 회원이 수강권 상품을 선택하면 청구서를 만들고 결제선생 /bill 을 호출,
// 반환된 결제 URL(shortUrl)을 프론트가 결제창으로 띄운다.
// API 키·매장코드는 Supabase Secrets 에만 둔다(프론트 노출 금지).
//   PAYSSAM_API_KEY  : 파트너 API 키 (Sandbox→Live)
//   PAYSSAM_MERCHANT : 파트너 매장 코드(MID)
//   PAYSSAM_BASE_URL : 기본 https://sandbox.paymint.co.kr/partner (운영은 검수 후 별도)
//   APP_URL          : 결제 완료 후 복귀할 앱 주소
// ⚠️ hash 규격은 공개문서에 알고리즘이 명시돼 있지 않다 → 검수 단계에서 결제선생 기술지원으로 확정 필요.
//    현재는 문서의 입력 문자열({billId},{phone},{price}) 기준 SHA-256(hex) 로 둠. [확인필요]
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const onlyDigits = (s: unknown) => String(s ?? "").replace(/[^0-9]/g, "");

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const PAYSSAM_API_KEY = Deno.env.get("PAYSSAM_API_KEY") || "";
    const PAYSSAM_MERCHANT = Deno.env.get("PAYSSAM_MERCHANT") || "";
    const PAYSSAM_MEMBER = Deno.env.get("PAYSSAM_MEMBER") || ""; // 샌드박스 테스트 Member ID. 비우면 회원 user.id 사용.
    const PAYSSAM_BASE_URL = Deno.env.get("PAYSSAM_BASE_URL") || "https://sandbox.paymint.co.kr/partner";
    const APP_URL = Deno.env.get("APP_URL") || "https://game-fit-quests.pages.dev";
    const authHeader = req.headers.get("Authorization") || "";

    const caller = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: uErr } = await caller.auth.getUser();
    if (uErr || !user) return json({ error: "로그인이 필요합니다." }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

    const body = await req.json().catch(() => ({}));
    const productId = String(body?.product_id || "");
    if (!productId) return json({ error: "상품을 선택해주세요." }, 400);

    const { data: product } = await admin
      .from("membership_products")
      .select("*")
      .eq("id", productId)
      .eq("is_active", true)
      .maybeSingle();
    if (!product) return json({ error: "상품을 찾을 수 없습니다." }, 404);

    const { data: profile } = await admin
      .from("profiles")
      .select("name, nickname, phone_number, branch_name")
      .eq("user_id", user.id)
      .maybeSingle();
    const phone = onlyDigits(profile?.phone_number);
    const memberName = profile?.name || profile?.nickname || "회원";
    if (phone.length < 10) {
      return json({ error: "휴대폰 번호가 등록되어 있지 않습니다. 번호 등록 후 다시 시도해주세요." }, 400);
    }

    if (!PAYSSAM_API_KEY || !PAYSSAM_MERCHANT) {
      return json({ error: "결제 설정이 아직 완료되지 않았습니다(API 키 미설정)." }, 503);
    }

    const price = String(product.price);
    const billId = ("mb" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).slice(0, 20);
    const hash = await sha256hex(`${billId},${phone},${price}`); // [확인필요] 결제선생 해시 규격 검수 시 확정
    const callbackUrl = `${SUPABASE_URL}/functions/v1/payssam-callback`;
    const pageRedirectUrl = `${APP_URL}/membership?paid=1`;

    // 주문 선기록
    const { data: order, error: oErr } = await admin
      .from("payment_orders")
      .insert({
        user_id: user.id,
        branch_name: profile?.branch_name ?? null,
        product_id: product.id,
        product_name: product.name,
        amount: product.price,
        duration_days: product.duration_days,
        bill_id: billId,
        status: "created",
      })
      .select("id")
      .single();
    if (oErr || !order) return json({ error: "주문 생성에 실패했습니다." }, 500);

    // 결제선생 청구서 생성·발송 (sendType=URL → shortUrl 응답)
    const res = await fetch(`${PAYSSAM_BASE_URL}/bill`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: PAYSSAM_API_KEY,
        member: PAYSSAM_MEMBER || user.id,
        merchant: PAYSSAM_MERCHANT,
        bill: {
          billId,
          sendType: "URL",
          billIssuer: "153복싱짐",
          productName: product.name,
          price,
          memberName,
          phone,
          message: "153복싱짐 수강권 결제",
          hash,
          callbackUrl,
          pageRedirectUrl,
        },
      }),
    });
    const out = await res.json().catch(() => ({}));
    const shortUrl = out?.data?.shortUrl || "";
    if (!res.ok || !shortUrl) {
      await admin.from("payment_orders").update({ status: "failed", raw: out }).eq("id", order.id);
      return json({ error: "결제 요청 실패: " + (out?.msg || out?.message || res.status) }, 502);
    }
    await admin.from("payment_orders").update({ status: "sent", short_url: shortUrl, raw: out }).eq("id", order.id);
    return json({ ok: true, shortUrl, billId });
  } catch (e) {
    console.error("payssam-create-bill error:", e);
    return json({ error: "처리 중 오류가 발생했습니다." }, 500);
  }
});
