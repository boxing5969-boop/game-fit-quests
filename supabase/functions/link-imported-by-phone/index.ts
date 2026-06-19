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
// 일괄등록 계정(A)의 지점·수강권 정보를 소셜 계정(B)으로 복사하고, A(placeholder)는 삭제해 전화번호 해제 후 B에 부여.
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
      .select("user_id, name, branch_name, gym_reg_date, membership_end, birth_date, is_approved")
      .eq("phone_number", phone)
      .maybeSingle();

    if (!a) {
      return json({ matched: false, message: "해당 전화번호로 등록된 기존 계정이 없습니다. 관장님께 문의하거나 그대로 이용해주세요." });
    }
    if (a.user_id === user.id) {
      return json({ matched: true, ok: true, message: "이미 연동되어 있습니다." });
    }

    // 1) A 의 지점·수강권 정보를 B 프로필로 복사 (전화번호는 A 삭제 후 부여)
    const { error: copyErr } = await admin
      .from("profiles")
      .update({
        branch_name: a.branch_name,
        gym_reg_date: a.gym_reg_date,
        membership_end: a.membership_end,
        birth_date: a.birth_date,
        is_approved: a.is_approved ?? true,
      })
      .eq("user_id", user.id);
    if (copyErr) return json({ error: "연동 중 오류(복사): " + copyErr.message }, 400);

    // 2) A(placeholder 계정) 삭제 → 관련 행 cascade + 전화번호 해제
    const { error: delErr } = await admin.auth.admin.deleteUser(a.user_id);
    if (delErr) return json({ error: "기존 계정 정리 중 오류: " + delErr.message }, 400);

    // 3) 해제된 전화번호를 B 에 부여
    const { error: phoneErr } = await admin
      .from("profiles")
      .update({ phone_number: phone })
      .eq("user_id", user.id);
    if (phoneErr) return json({ error: "전화번호 연결 중 오류: " + phoneErr.message }, 400);

    return json({ matched: true, ok: true, branch: a.branch_name });
  } catch (e) {
    console.error("link-imported-by-phone error:", e);
    return json({ error: "처리 중 오류가 발생했습니다. 다시 시도해주세요." }, 500);
  }
});
