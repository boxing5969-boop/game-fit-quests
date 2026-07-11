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

    if (!username || !name || !phone || !newPassword || !birthDate) {
      return new Response(
        JSON.stringify({ error: "아이디, 이름, 전화번호, 생년월일을 모두 입력해주세요" }),
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

    // Try to find auth user — 전체 페이지 조회(페이지네이션 필수: 51번째 이후 사용자도 검색됨)
    const allUsers: any[] = [];
    {
      let page = 1;
      // deno-lint-ignore no-constant-condition
      while (true) {
        const { data: pageData, error: authError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
        if (authError) {
          console.error("Auth list error:", authError);
          throw authError;
        }
        allUsers.push(...pageData.users);
        if (pageData.users.length < 1000) break;
        page++;
      }
    }
    let authUser = allUsers.find((u) => u.email === fakeEmail);
    if (!authUser) {
      // Try matching username as full email
      authUser = allUsers.find((u) => u.email === usernameClean);
    }
    if (!authUser) {
      // Try matching username as email prefix (e.g. user entered "boxing" and email is "boxing@naver.com")
      authUser = allUsers.find((u) => u.email?.split("@")[0] === usernameClean);
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

    // 생년월일 필수 검증 — 저장된 생년월일이 없으면 본 셀프 경로로 재설정 불가(관장 문의).
    // (이름+전화만으로 계정 탈취되던 문제 차단. 근본 해결은 SMS OTP 권장 — 보고서 참조)
    if (!profile.birth_date) {
      return new Response(
        JSON.stringify({ error: "본인확인 정보가 부족합니다. 관장님께 문의해주세요." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    {
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

    console.log(`Password reset successful for user: ${authUser.id}`);

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
