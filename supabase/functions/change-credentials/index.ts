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

// 회원 본인 아이디(이메일)·비밀번호 변경 — 최초 로그인 후 자율 변경(권장).
// 가입 이메일이 가짜({아이디}@153rankup.app)라 self updateUser 이메일 변경은 확인메일에 막힘 →
// 서비스롤 admin.updateUserById 로 즉시 변경(email_confirm) 후 must_change_credentials 해제.
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

    const body = await req.json();
    const newUsername = String(body?.newUsername ?? "").toLowerCase().trim();
    const newPassword = String(body?.newPassword ?? "");
    if (!/^[a-z0-9_]{4,20}$/.test(newUsername)) {
      return json({ error: "아이디는 영문·숫자·밑줄(_) 4~20자만 가능합니다." }, 400);
    }
    if (newPassword.length < 6) {
      return json({ error: "비밀번호는 6자 이상이어야 합니다." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const newEmail = `${newUsername}@153rankup.app`;

    const { error: upErr } = await admin.auth.admin.updateUserById(user.id, {
      email: newEmail,
      password: newPassword,
      email_confirm: true,
    });
    if (upErr) {
      const dup = /already|registered|exists|duplicate/i.test(upErr.message || "");
      return json({ error: dup ? "이미 사용 중인 아이디입니다." : ("변경 실패: " + (upErr.message || "")) }, 400);
    }

    await admin
      .from("profiles")
      .update({ must_change_credentials: false, email: newEmail })
      .eq("user_id", user.id);

    return json({ ok: true });
  } catch (e) {
    console.error("change-credentials error:", e);
    return json({ error: "처리 중 오류가 발생했습니다. 다시 시도해주세요." }, 500);
  }
});
