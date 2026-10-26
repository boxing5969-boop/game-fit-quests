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
// 2026-10-15: 153 마일리지 할인 — body.use_mileage(점) 를 DB mileage_max_use 로 검사(보유·결제 금액 10%·1,000점 단위)한 뒤
//    청구 금액에서 뺀다. 실제 차감은 결제 완료 때 DB 트리거(payment_orders_mileage)가 한다 — 안 내면 안 빠진다.
// 2026-10-27 장바구니 (대표님 보고서 「앱 결제 장바구니」 · "나머진 니추천대로"):
//    · body.cart = { membership_product_id?, sportswear_months?, locker_months? } — 수강권 + 운동복 + 락카를 링크 1개로.
//      운동복 · 락카 = 렌탈 상품(운동복 (1개월) · 개인 락카 (1개월)) 가격 × 개월. 수강권과 같이 사면 수강권 개월까지.
//      항목은 payment_order_items 에 한 줄씩 — 결제가 끝나면 payssam-callback 이 DB apply_payment_order 로 항목마다 반영한다.
//    · 마일리지는 수강권 금액 기준(10%) — 수강권이 없으면(락카 · 운동복만) 합계 기준.
//    · 같은 회원 · 같은 장바구니(또는 같은 상품)를 24시간 안에 다시 누르면 새 링크(50원)를 만들지 않고 아까 링크를 다시 준다.
//    · 칠금점(데스크 결제 지점)은 화면뿐 아니라 여기서도 막는다.
//    · body.product_id 하나만 오면 예전과 똑같이 처리한다(PT · 용품 · 1일권 등).
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

// 앱 결제(결제선생)를 아직 쓰지 않는 지점 — src/lib/branchPayment.ts OFFLINE_PAY_BRANCHES 와 같게
const OFFLINE_PAY_BRANCHES = ["153복싱짐 칠금점"];
// 같은 장바구니 링크를 다시 주는 시간
const REUSE_MS = 24 * 3600 * 1000;
// 결제선생 상품명 — 길면 "첫 항목 외 N건"
const MAX_NAME = 40;

type CartItem = {
  kind: "membership" | "sportswear" | "locker";
  product_id: string | null;
  product_name: string;
  months: number;
  unit_price: number;
  list_amount: number;
  mileage_used: number;
  amount: number;
  duration_days: number;
};

/** 렌탈 개월 → 일수. 수강권 개월과 같으면 수강권 일수(1년 = 365)를 그대로 써서 끝나는 날을 맞춘다 */
const rentalDays = (months: number, membership?: { months: number; days: number }) =>
  membership && membership.months === months ? membership.days : months === 12 ? 365 : months * 30;

/** 수강권 일수 → 개월 (30 → 1, 90 → 3, 150 → 5, 365 → 12) */
const membershipMonths = (days: number) => (days >= 360 ? 12 : Math.max(1, Math.round(days / 30)));

const productLabel = (it: CartItem) =>
  it.kind === "membership" ? it.product_name : `${it.kind === "locker" ? "락카" : "운동복"} ${it.months}개월`;

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
    // 도메인 전환(2026-08): 시크릿에 옛 주소가 남아 있어도 새 도메인으로 보낸다.
    // 대시보드에서 APP_URL 을 따로 바꾸지 않아도 되게 하기 위한 것.
    const APP_URL_RAW = Deno.env.get("APP_URL") || "";
    const APP_URL = (!APP_URL_RAW || APP_URL_RAW.includes("game-fit-quests.pages.dev"))
      ? "https://myboxer153.com"
      : APP_URL_RAW;
    const authHeader = req.headers.get("Authorization") || "";

    const caller = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: uErr } = await caller.auth.getUser();
    if (uErr || !user) return json({ error: "로그인이 필요합니다." }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

    const body = await req.json().catch(() => ({}));
    const cartIn = body?.cart && typeof body.cart === "object" ? body.cart : null;
    const productId = String(body?.product_id || "");
    if (!productId && !cartIn) return json({ error: "상품을 선택해주세요." }, 400);

    const { data: profile } = await admin
      .from("profiles")
      .select("name, nickname, phone_number, branch_name")
      .eq("user_id", user.id)
      .maybeSingle();
    const phone = onlyDigits(profile?.phone_number);
    const memberName = profile?.name || profile?.nickname || "회원";

    // 칠금점은 데스크 결제 — 화면에서 막지만 서버에서도 막는다 (2026-10-27)
    if (profile?.branch_name && OFFLINE_PAY_BRANCHES.includes(profile.branch_name)) {
      return json({ error: "이 지점은 데스크(계좌이체 · 현장 결제)에서 결제해 주세요." }, 403);
    }
    if (phone.length < 10) {
      return json({ error: "휴대폰 번호가 등록되어 있지 않습니다. 번호 등록 후 다시 시도해주세요." }, 400);
    }

    if (!PAYSSAM_API_KEY || !PAYSSAM_MERCHANT) {
      return json({ error: "결제 설정이 아직 완료되지 않았습니다(API 키 미설정)." }, 503);
    }

    const useMileage = Math.max(0, Math.floor(Number(body?.use_mileage) || 0));
    if (useMileage % 1000 !== 0) return json({ error: "마일리지는 1,000점 단위로 쓸 수 있어요." }, 400);

    // ── 주문 내용 정하기 ──────────────────────────────────────────────
    let orderProductId: string | null = null;
    let orderName = "";
    let listTotal = 0;
    let durationDays = 0;
    let mileageBase = 0;
    let items: CartItem[] = [];
    let cartKey = "";

    if (cartIn) {
      const memId = cartIn.membership_product_id ? String(cartIn.membership_product_id) : "";
      const swMonths = Math.floor(Number(cartIn.sportswear_months) || 0);
      const lkMonths = Math.floor(Number(cartIn.locker_months) || 0);

      let membership: { months: number; days: number } | undefined;
      if (memId) {
        const { data: mp } = await admin
          .from("membership_products").select("*").eq("id", memId).eq("is_active", true).maybeSingle();
        if (!mp || mp.category !== "membership") return json({ error: "수강권을 찾을 수 없습니다." }, 404);
        const days = Number(mp.duration_days || 0);
        membership = { months: membershipMonths(days), days };
        items.push({
          kind: "membership", product_id: mp.id, product_name: String(mp.name), months: membership.months,
          unit_price: Number(mp.price), list_amount: Number(mp.price), mileage_used: 0, amount: Number(mp.price), duration_days: days,
        });
        mileageBase = Number(mp.price);
      }

      const maxRental = membership ? membership.months : 12;
      // 렌탈 상품 가격(한 달) — 상품표 '렌탈'의 운동복 · 개인 락카 (1개월)
      //   화면(MembershipProducts rentalUnit)과 같게: 공용 또는 내 지점 상품 중 정렬 순서 · 가격 순 첫 번째
      const { data: rentalRows } = swMonths || lkMonths
        ? await admin.from("membership_products").select("*").eq("category", "rental").eq("is_active", true)
            .order("sort_order", { ascending: true }).order("price", { ascending: true })
        : { data: [] as Array<Record<string, unknown>> };
      const rentals = (rentalRows || []).filter((p: Record<string, unknown>) =>
        p.branch_name == null || p.branch_name === (profile?.branch_name ?? null));
      for (const [kind, months] of [["sportswear", swMonths], ["locker", lkMonths]] as const) {
        if (months === 0) continue;
        if (months < 1 || months > maxRental) {
          return json({ error: membership ? `운동복 · 락카는 수강권 개월(${maxRental}개월)까지 담을 수 있어요.` : "운동복 · 락카는 1~12개월로 담아 주세요." }, 400);
        }
        const rp = rentals.find((p: Record<string, unknown>) => (kind === "locker" ? /락카|락커/ : /운동복/).test(String(p.name)));
        if (!rp) return json({ error: `${kind === "locker" ? "락카" : "운동복"} 상품을 찾을 수 없습니다.` }, 404);
        const unit = Number(rp.price);
        items.push({
          kind, product_id: String(rp.id), product_name: `${kind === "locker" ? "락카" : "운동복"} ${months}개월`, months,
          unit_price: unit, list_amount: unit * months, mileage_used: 0, amount: unit * months,
          duration_days: rentalDays(months, membership),
        });
      }
      if (items.length === 0) return json({ error: "담긴 상품이 없어요." }, 400);

      listTotal = items.reduce((s, it) => s + it.list_amount, 0);
      if (!membership) mileageBase = listTotal; // 락카 · 운동복만이면 합계 기준
      durationDays = membership ? membership.days : 0;
      orderProductId = membership ? items[0].product_id : null;
      const labels = items.map(productLabel);
      orderName = labels.join(" + ");
      if (orderName.length > MAX_NAME) orderName = `${labels[0]} 외 ${labels.length - 1}건`;
      cartKey = `cart:${memId || "-"}:s${swMonths}:l${lkMonths}:m${useMileage}`;
    } else {
      const { data: product } = await admin
        .from("membership_products")
        .select("*")
        .eq("id", productId)
        .eq("is_active", true)
        .maybeSingle();
      if (!product) return json({ error: "상품을 찾을 수 없습니다." }, 404);
      orderProductId = product.id;
      orderName = String(product.name);
      listTotal = Number(product.price);
      durationDays = Number(product.duration_days || 0);
      mileageBase = listTotal;
      cartKey = `p:${product.id}:m${useMileage}`;
    }

    // 153 마일리지 (1점 = 1원) — 수강권 금액(없으면 합계)의 10%까지
    if (useMileage > 0) {
      const { data: maxUse, error: mErr } = await admin.rpc("mileage_max_use", { _uid: user.id, _price: mileageBase });
      if (mErr) return json({ error: "마일리지를 확인하지 못했어요. 잠시 후 다시 시도해주세요." }, 500);
      if (useMileage > Number(maxUse || 0)) {
        return json({ error: `이번 결제에는 마일리지를 최대 ${Number(maxUse || 0).toLocaleString("ko-KR")}점까지 쓸 수 있어요.` }, 400);
      }
      // 항목에 나눠 빼기 — 수강권부터(없으면 앞 항목부터)
      let left = useMileage;
      for (const it of items) {
        if (left <= 0) break;
        const take = Math.min(left, it.list_amount);
        it.mileage_used = take;
        it.amount = it.list_amount - take;
        left -= take;
      }
    }
    const payAmount = listTotal - useMileage;

    // 같은 장바구니 · 같은 상품을 24시간 안에 다시 누르면 아까 링크 (링크 하나에 50원)
    const { data: recent } = await admin
      .from("payment_orders")
      .select("id, short_url, bill_id, amount, created_at")
      .eq("user_id", user.id)
      .eq("cart_key", cartKey)
      .eq("status", "sent")
      .gte("created_at", new Date(Date.now() - REUSE_MS).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent?.short_url && Number(recent.amount) === payAmount) {
      return json({ ok: true, shortUrl: recent.short_url, billId: recent.bill_id, reused: true });
    }

    const price = String(payAmount);
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
        product_id: orderProductId,
        product_name: orderName,
        amount: payAmount,
        list_price: listTotal,
        mileage_used: useMileage,
        duration_days: durationDays,
        bill_id: billId,
        status: "created",
        cart_key: cartKey,
      })
      .select("id")
      .single();
    if (oErr || !order) return json({ error: "주문 생성에 실패했습니다." }, 500);

    if (items.length > 0) {
      const { error: iErr } = await admin
        .from("payment_order_items")
        .insert(items.map((it) => ({ ...it, order_id: order.id })));
      if (iErr) {
        await admin.from("payment_orders").update({ status: "failed" }).eq("id", order.id);
        return json({ error: "주문 항목을 저장하지 못했습니다." }, 500);
      }
    }

    // 가입 승인은 여기서 하지 않는다(2026-09-28). 예전엔 청구서를 만들기만 해도(결제 전) 승인돼
    // 결제창을 닫아도 지점 승인 없이 앱을 쓸 수 있었다. 승인은 결제 완료 콜백(payssam-callback)이 한다.

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
          productName: orderName,
          price,
          memberName,
          phone,
          message: items.length > 1 ? "153복싱짐 수강권 · 렌탈 결제" : "153복싱짐 수강권 결제",
          hash,
          callbackUrl,
          pageRedirectUrl,
        },
      }),
    });
    const out = await res.json().catch(() => ({}));
    // 결제선생 응답에는 우리 운영 API 키가 그대로 들어 있다.
    // payment_orders 는 RLS 상 회원이 자기 주문을 읽을 수 있으므로(own orders select),
    // 그대로 저장하면 회원이 결제 API 키를 조회할 수 있게 된다 → 저장 전에 제거.
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
    const safeOut = scrub(out);
    const shortUrl = out?.data?.shortUrl || "";
    if (!res.ok || !shortUrl) {
      await admin.from("payment_orders").update({ status: "failed", raw: safeOut }).eq("id", order.id);
      return json({ error: "결제 요청 실패: " + (out?.msg || out?.message || res.status) }, 502);
    }
    await admin.from("payment_orders").update({ status: "sent", short_url: shortUrl, raw: safeOut }).eq("id", order.id);
    return json({ ok: true, shortUrl, billId });
  } catch (e) {
    console.error("payssam-create-bill error:", e);
    return json({ error: "처리 중 오류가 발생했습니다." }, 500);
  }
});
