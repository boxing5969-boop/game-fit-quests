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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get the authenticated user from the JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "인증이 필요합니다" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) {
      return new Response(
        JSON.stringify({ error: "사용자를 찾을 수 없습니다" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if there's an original email to restore
    const originalEmail = user.app_metadata?.original_auth_email;
    if (!originalEmail) {
      console.log("No original email to restore for user:", user.id);
      return new Response(
        JSON.stringify({ success: true, message: "No restoration needed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Restoring auth email to:", originalEmail, "for user:", user.id);

    // Restore the original auth email
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      email: originalEmail,
      email_confirm: true,
      app_metadata: { original_auth_email: null },
    });

    if (updateErr) {
      console.error("Failed to restore email:", updateErr);
      throw updateErr;
    }

    console.log("Auth email restored successfully");

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Restore email error:", err);
    return new Response(
      JSON.stringify({ error: "이메일 복원 중 오류가 발생했습니다" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
