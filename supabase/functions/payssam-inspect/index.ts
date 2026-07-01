// 결제선생(Payssam) 연동 검수 도구 — 관리자(admin) 전용.
// 검수 5항목의 BILL-ID를 뽑기 위한 원(raw) API 호출기.
//   action=create  → POST /bill          (테스트 청구서 생성 → shortUrl. 결제승인·승인동기화 검수용)
//   action=cancel  → POST /bill/cancel    (승인취소 검수용)
//   action=destroy → POST /bill/destroy   (청구서 파기 검수용)
//   action=read    → POST /bill/read      (청구서 조회 검수용)
// 해시 규격(문서 기준, 결제창까지 뜨는 것으로 SHA-256 확인됨):
//   create : {billId} + "," + {phone} + "," + {price}
//   cancel/destroy : {billId} + "," + {price}   (phone 미포함)
//   read   : 해시 불필요
// 시크릿(프론트 노출 금지): PAYSSAM_API_KEY / PAYSSAM_MERCHANT / PAYSSAM_MEMBER / PAYSSAM_BASE_URL / APP_URL
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

const newBillId = (prefix: string) =>
  (prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).slice(0, 20);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const PAYSSAM_API_KEY = Deno.env.get("PAYSSAM_API_KEY") || "";
    const PAYSSAM_MERCHANT = Deno.env.get("PAYSSAM_MERCHANT") || "";
    const PAYSSAM_MEMBER = Deno.env.get("PAYSSAM_MEMBER") || "";
    const PAYSSAM_BASE_URL = Deno.env.get("PAYSSAM_BASE_URL") || "https://sandbox.paymint.co.kr/partner";
    const APP_URL = Deno.env.get("APP_URL") || "https://game-fit-quests.pages.dev";
    const authHeader = req.headers.get("Authorization") || "";

    // ── 호출자 인증 + admin 권한 확인 ──
    const caller = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: uErr } = await caller.auth.getUser();
    if (uErr || !user) return json({ error: "로그인이 필요합니다." }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    const role = String(roleRow?.role || "");
    if (role !== "admin" && role !== "super_admin") {
      return json({ error: "관리자만 사용할 수 있습니다." }, 403);
    }

    if (!PAYSSAM_API_KEY || !PAYSSAM_MERCHANT) {
      return json({ error: "결제 설정이 아직 완료되지 않았습니다(API 키 미설정)." }, 503);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const member = PAYSSAM_MEMBER || user.id;
    const base = { apiKey: PAYSSAM_API_KEY, member, merchant: PAYSSAM_MERCHANT };

    const callPayssam = async (path: string, bill: Record<string, unknown>) => {
      const res = await fetch(`${PAYSSAM_BASE_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...base, bill }),
      });
      const out = await res.json().catch(() => ({}));
      const code = String(out?.code ?? "");
      const msg = String(out?.msg ?? out?.message ?? "");
      return { httpOk: res.ok, status: res.status, code, msg, data: out?.data ?? null, raw: out };
    };

    if (action === "create") {
      // 테스트 청구서 생성 (sendType=URL → shortUrl). 결제창에서 샌드박스 테스트카드로 결제하면 결제승인/승인동기화 검수 대상이 된다.
      const price = onlyDigits(body?.price) || "1000";
      const phone = onlyDigits(body?.phone) || "01000000000";
      const memberName = String(body?.memberName || "검수테스트");
      const productName = String(body?.productName || "[검수] 테스트결제");
      const billId = newBillId("iq");
      const hash = await sha256hex(`${billId},${phone},${price}`);
      const r = await callPayssam("/bill", {
        billId,
        sendType: "URL",
        billIssuer: "153복싱짐",
        productName,
        price,
        memberName,
        phone,
        message: "결제선생 연동 검수 테스트",
        hash,
        callbackUrl: `${SUPABASE_URL}/functions/v1/payssam-callback`,
        pageRedirectUrl: `${APP_URL}/membership?inspect=1`,
      });
      const shortUrl = r.data?.shortUrl || r.raw?.data?.shortUrl || "";
      return json({ ok: r.httpOk && !!shortUrl, action, billId, price, shortUrl, code: r.code, msg: r.msg, data: r.data, raw: r.raw });
    }

    if (action === "cancel") {
      const billId = String(body?.billId || "");
      const price = onlyDigits(body?.price);
      if (!billId || !price) return json({ error: "billId·price가 필요합니다." }, 400);
      const cancelReason = String(body?.cancelReason || "검수취소").slice(0, 20);
      const hash = await sha256hex(`${billId},${price}`);
      const r = await callPayssam("/bill/cancel", { billId, price, cancelReason, hash });
      return json({ ok: r.httpOk && r.code === "0000", action, billId, price, code: r.code, msg: r.msg, data: r.data, raw: r.raw });
    }

    if (action === "destroy") {
      const billId = String(body?.billId || "");
      const price = onlyDigits(body?.price);
      if (!billId || !price) return json({ error: "billId·price가 필요합니다." }, 400);
      const hash = await sha256hex(`${billId},${price}`);
      const r = await callPayssam("/bill/destroy", { billId, price, hash });
      return json({ ok: r.httpOk && r.code === "0000", action, billId, price, code: r.code, msg: r.msg, data: r.data, raw: r.raw });
    }

    if (action === "read") {
      const billId = String(body?.billId || "");
      if (!billId) return json({ error: "billId가 필요합니다." }, 400);
      const r = await callPayssam("/bill/read", { billId });
      return json({ ok: r.httpOk && r.code === "0000", action, billId, apprState: r.data?.apprState ?? "", code: r.code, msg: r.msg, data: r.data, raw: r.raw });
    }

    return json({ error: "알 수 없는 action (create|cancel|destroy|read)" }, 400);
  } catch (e) {
    console.error("payssam-inspect error:", e);
    return json({ error: "처리 중 오류가 발생했습니다." }, 500);
  }
});
