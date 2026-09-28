import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const onlyDigits = (s: unknown) => String(s ?? "").replace(/[^0-9]/g, "");

// 소셜(구글/카카오) 회원이 전화번호로 기존 일괄등록 계정을 연동.
// 2026-09-28: 예전에는 일괄등록 계정(A)의 지점·수강권만 복사하고 A 를 바로 삭제해서
//   레벨·XP·배지가 cascade 로 사라지고, 출석 기록은 고아가 되어 라이브보드에 같은 회원이
//   두 명(Lv.10 / Lv.1)으로 떴다. 이제는 merge_linked_account(DB 함수, 한 트랜잭션)가
//   A 의 모든 기록(출석·레벨·XP·젬·배지·알림…)과 전화번호를 소셜 계정(B)으로 옮긴 뒤에만 A 를 지운다.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: uErr } = await caller.auth.getUser();
    if (uErr || !user) return json({ error: "로그인이 필요합니다." }, 401);

    const phone = onlyDigits((await req.json())?.phone);
    if (phone.length < 10) return json({ error: "올바른 전화번호를 입력해주세요." }, 400);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 기존 일괄등록 계정(A) 조회
    const { data: a } = await admin
      .from("profiles")
      .select("user_id, branch_name, must_change_credentials")
      .eq("phone_number", phone)
      .maybeSingle();

    if (!a) {
      return json({ matched: false, message: "해당 전화번호로 등록된 기존 계정이 없습니다. 관장님께 문의하거나 그대로 이용해주세요." });
    }
    if (a.user_id === user.id) {
      return json({ matched: true, ok: true, message: "이미 연동되어 있습니다." });
    }

    // 안전장치: 아직 본인이 넘겨받지 않은 '일괄등록 placeholder' 계정만 연동/정리 허용.
    // 이미 활성화된(자격증명 변경 완료) 계정은 타인이 흡수·삭제하지 못하도록 거부.
    if (a.must_change_credentials !== true) {
      return json({ error: "이미 사용 중인 계정으로 등록된 번호입니다. 관장님께 문의해주세요." }, 400);
    }

    // 연동 창은 번호가 없는 소셜 가입자에게만 뜬다 — 이미 다른 번호가 있는 계정은 연동 대상이 아니다.
    const { data: me } = await admin
      .from("profiles")
      .select("phone_number")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!me) return json({ error: "프로필을 찾을 수 없습니다. 다시 로그인해 주세요." }, 400);
    if (me.phone_number && onlyDigits(me.phone_number) !== phone) {
      return json({ error: "이미 다른 전화번호가 등록된 계정입니다. 관장님께 문의해주세요." }, 400);
    }

    // 1) A → B 기록 병합 + 전화번호 이전 (DB 한 트랜잭션 — 실패하면 아무것도 바뀌지 않는다)
    const { data: merged, error: mErr } = await admin.rpc("merge_linked_account", {
      p_from: a.user_id,
      p_to: user.id,
      p_phone: phone,
    });
    if (mErr) {
      console.error("merge_linked_account failed:", mErr.message);
      return json({ error: "기존 기록을 옮기는 중 오류가 발생했습니다. 잠시 후 다시 시도하거나 관장님께 문의해주세요." }, 400);
    }

    // 2) 기록을 모두 옮긴 빈 A 계정 정리 (실패해도 연동은 완료 — 이력에 남긴다)
    const eventId = (merged as { event_id?: number } | null)?.event_id ?? null;
    const { error: delErr } = await admin.auth.admin.deleteUser(a.user_id);
    if (delErr) console.error("deleteUser(A) failed after merge:", delErr.message);
    if (eventId) {
      await admin
        .from("account_link_events")
        .update(delErr ? { note: "A 삭제 실패: " + delErr.message } : { from_deleted_at: new Date().toISOString() })
        .eq("id", eventId);
    }

    return json({ matched: true, ok: true, branch: a.branch_name });
  } catch (e) {
    console.error("link-imported-by-phone error:", e);
    return json({ error: "처리 중 오류가 발생했습니다. 다시 시도해주세요." }, 500);
  }
});
