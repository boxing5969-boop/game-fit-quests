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
    const { username, redirectTo } = await req.json();

    if (!username || typeof username !== "string") {
      return new Response(
        JSON.stringify({ error: "아이디를 입력해주세요" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const fakeEmail = `${username.toLowerCase().trim()}@153rankup.app`;

    // Find user by fake email
    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

    if (userError) throw userError;

    const user = userData.users.find(
      (u) => u.email?.toLowerCase() === fakeEmail.toLowerCase()
    );

    if (!user) {
      // Don't reveal whether user exists - return success anyway
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get real email from profiles
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("user_id", user.id)
      .single();

    if (!profile?.email) {
      // No real email registered - return generic success (don't reveal info)
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const realEmail = profile.email;

    // Temporarily update auth email to real email
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      email: realEmail,
      email_confirm: true,
    });

    // Trigger password recovery email via GoTrue API
    const recoverRes = await fetch(`${supabaseUrl}/auth/v1/recover`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
      },
      body: JSON.stringify({
        email: realEmail,
        gotrue_meta_security: {},
        ...(redirectTo ? { redirect_to: redirectTo } : {}),
      }),
    });

    if (!recoverRes.ok) {
      const errBody = await recoverRes.text();
      console.error("Recovery API error:", errBody);
    }

    // Switch email back to fake email
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      email: fakeEmail,
      email_confirm: true,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Reset password error:", err);
    return new Response(
      JSON.stringify({ error: "처리 중 오류가 발생했습니다" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
