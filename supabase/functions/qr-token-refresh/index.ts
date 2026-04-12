import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "인증이 필요합니다" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      console.error("[qr-token-refresh] Auth failed:", authError?.message);
      return new Response(JSON.stringify({ error: "인증 실패" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify branch_manager or super_admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roleData || !["branch_manager", "super_admin", "admin"].includes(roleData.role)) {
      console.error("[qr-token-refresh] Unauthorized role:", roleData?.role);
      return new Response(JSON.stringify({ error: "권한이 없습니다" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get manager's branch
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("branch_name")
      .eq("user_id", user.id)
      .single();

    if (!profile?.branch_name) {
      console.error("[qr-token-refresh] No branch for user:", user.id);
      return new Response(JSON.stringify({ error: "지점 정보를 찾을 수 없습니다" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const branchName = profile.branch_name;

    // Parse optional expiry duration from body (default 5 min)
    let expirySeconds = 300; // 5 minutes default
    try {
      const body = await req.json();
      if (body?.expiry_seconds && typeof body.expiry_seconds === "number") {
        expirySeconds = Math.min(Math.max(body.expiry_seconds, 10), 600); // 10s ~ 10min
      }
    } catch {
      // no body, use default
    }

    // Deactivate existing tokens for this branch
    await supabaseAdmin
      .from("qr_checkin_tokens")
      .update({ is_active: false })
      .eq("branch_name", branchName)
      .eq("is_active", true);

    // Generate new token
    const token = generateToken();
    const expiresAt = new Date(Date.now() + expirySeconds * 1000).toISOString();

    const { data: newToken, error: insertError } = await supabaseAdmin
      .from("qr_checkin_tokens")
      .insert({
        branch_name: branchName,
        token,
        expires_at: expiresAt,
        is_active: true,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[qr-token-refresh] Insert failed:", insertError.message);
      return new Response(JSON.stringify({ error: "토큰 생성 실패" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure display settings exist for this branch
    await supabaseAdmin
      .from("branch_display_settings")
      .upsert({ branch_name: branchName }, { onConflict: "branch_name" });

    console.log(`[qr-token-refresh] Token created for ${branchName}, expires in ${expirySeconds}s`);

    return new Response(JSON.stringify({
      token: newToken.token,
      expires_at: newToken.expires_at,
      branch_name: branchName,
      expiry_seconds: expirySeconds,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[qr-token-refresh] Unexpected error:", e);
    return new Response(JSON.stringify({ error: "서버 오류" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
