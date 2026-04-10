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
    const { name, phone, birthDate, newPassword } = await req.json();

    if (!name || !phone || !birthDate || !newPassword) {
      return new Response(
        JSON.stringify({ error: "모든 항목을 입력해주세요" }),
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
    const cleanBirthDate = birthDate.replace(/\D/g, "");

    // Find user by name + phone in profiles
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("user_id, name, phone_number, birth_date")
      .eq("name", name.trim());

    if (profileError) {
      console.error("Profile query error:", profileError);
      throw profileError;
    }

    // Match phone and optionally birth_date
    const matched = profiles?.find((p) => {
      const pPhone = p.phone_number?.replace(/\D/g, "") || "";
      if (pPhone !== cleanPhone) return false;
      // If profile has birth_date stored, verify it matches
      if (p.birth_date) {
        const pBirth = p.birth_date.replace(/\D/g, "");
        return pBirth === cleanBirthDate;
      }
      // If no birth_date in profile, match by name + phone only
      return true;
    });

    if (!matched) {
      return new Response(
        JSON.stringify({ error: "입력한 정보와 일치하는 계정을 찾을 수 없습니다" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update password using admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      matched.user_id,
      { password: newPassword }
    );

    if (updateError) {
      console.error("Password update error:", updateError);
      return new Response(
        JSON.stringify({ error: "비밀번호 변경에 실패했습니다. 다시 시도해주세요." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
