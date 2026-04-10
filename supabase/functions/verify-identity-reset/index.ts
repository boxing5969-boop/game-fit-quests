import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { username, name, phone, birthDate, newPassword } = await req.json();

    if (!username || !name || !phone || !newPassword) {
      return new Response(
        JSON.stringify({ error: "아이디, 이름, 전화번호를 모두 입력해주세요" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: "비밀번호는 6자 이상이어야 합니다" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Clean phone number (remove dashes)
    const cleanPhone = phone.replace(/\D/g, "");
    const cleanBirthDate = birthDate ? birthDate.replace(/\D/g, "") : null;
    const usernameClean = username.toLowerCase().trim();
    const fakeEmail = `${usernameClean}@153rankup.app`;

    // Try to find auth user: first by fake email, then by real email (username might be a full email)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) {
      console.error("Auth list error:", authError);
      throw authError;
    }
    let authUser = authData.users.find((u) => u.email === fakeEmail);
    if (!authUser) {
      // Try matching username as full email
      authUser = authData.users.find((u) => u.email === usernameClean);
    }
    if (!authUser) {
      // Try matching username as email prefix (e.g. user entered "boxing" and email is "boxing@naver.com")
      authUser = authData.users.find((u) => u.email?.split("@")[0] === usernameClean);
    }
    if (!authUser) {
      return new Response(
        JSON.stringify({ error: "입력한 아이디와 일치하는 계정을 찾을 수 없습니다" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify name and phone from profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("user_id, name, phone_number, birth_date")
      .eq("user_id", authUser.id)
      .maybeSingle();

    if (profileError) {
      console.error("Profile query error:", profileError);
      throw profileError;
    }

    if (!profile || profile.name !== name.trim()) {
      return new Response(
        JSON.stringify({ error: "입력한 정보와 일치하는 계정을 찾을 수 없습니다" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pPhone = profile.phone_number?.replace(/\D/g, "") || "";
    if (pPhone !== cleanPhone) {
      return new Response(
        JSON.stringify({ error: "전화번호가 일치하지 않습니다" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If birth_date provided and stored, verify it
    if (cleanBirthDate && profile.birth_date) {
      const pBirth = profile.birth_date.replace(/\D/g, "");
      if (pBirth !== cleanBirthDate) {
        return new Response(
          JSON.stringify({ error: "생년월일이 일치하지 않습니다" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Update password using admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      authUser.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error("Password update error:", updateError);
      const msg = updateError.message?.includes("weak") || updateError.message?.includes("Weak")
        ? "비밀번호가 너무 쉽습니다. 더 복잡한 비밀번호를 사용해주세요."
        : "비밀번호 변경에 실패했습니다. 다시 시도해주세요.";
      return new Response(
        JSON.stringify({ error: msg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Password reset successful for user: ${matched.user_id}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Identity verify reset error:", err);
    return new Response(
      JSON.stringify({ error: "처리 중 오류가 발생했습니다" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
