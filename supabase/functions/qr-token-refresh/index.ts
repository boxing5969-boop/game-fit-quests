import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "인증이 필요합니다" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const jwt = authHeader.replace("Bearer ", "");

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(jwt);
    const userId = claimsData?.claims?.sub;

    if (claimsError || !userId) {
      console.error("[qr-token-refresh] Auth failed:", claimsError?.message ?? "missing claims");
      return new Response(JSON.stringify({ error: "인증 실패" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = { id: userId };

    // Get user role
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

    const isSuperAdmin = roleData.role === "super_admin" || roleData.role === "admin";

    // Parse body
    let expirySeconds = 300;
    let targetBranch: string | null = null;
    try {
      const body = await req.json();
      if (body?.expiry_seconds && typeof body.expiry_seconds === "number") {
        expirySeconds = Math.min(Math.max(body.expiry_seconds, 10), 600);
      }
      if (body?.branch_name && typeof body.branch_name === "string") {
        targetBranch = body.branch_name;
      }
    } catch {
      // no body, use default
    }

    // Determine branch
    let branchName: string;
    if (targetBranch && isSuperAdmin) {
      // super_admin can specify any branch
      branchName = targetBranch;
    } else {
      // branch_manager uses their own branch
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
      branchName = profile.branch_name;

      // If non-super_admin tried to specify a different branch, reject
      if (targetBranch && targetBranch !== branchName) {
        return new Response(JSON.stringify({ error: "다른 지점의 QR을 생성할 권한이 없습니다" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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

    console.log(`[qr-token-refresh] Token created for ${branchName} by ${user.id} (${roleData.role}), expires in ${expirySeconds}s`);

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
