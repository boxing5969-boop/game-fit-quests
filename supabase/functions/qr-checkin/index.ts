import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "인증이 필요합니다", code: "NO_AUTH" }), {
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
      console.error("[qr-checkin] Auth failed:", authError?.message);
      return new Response(JSON.stringify({ error: "유효하지 않은 사용자입니다", code: "INVALID_USER" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "토큰이 필요합니다", code: "NO_TOKEN" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[qr-checkin] User ${user.id} scanning token ${token.substring(0, 6)}...`);

    // 1. Validate QR token
    const { data: qrToken, error: tokenError } = await supabaseAdmin
      .from("qr_checkin_tokens")
      .select("*")
      .eq("token", token)
      .single();

    if (tokenError || !qrToken) {
      console.error("[qr-checkin] Token not found:", token.substring(0, 6));
      return new Response(JSON.stringify({ error: "유효하지 않은 QR입니다", code: "INVALID_QR" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!qrToken.is_active) {
      console.error("[qr-checkin] Token inactive:", token.substring(0, 6));
      return new Response(JSON.stringify({ error: "만료된 QR입니다. 새 QR을 스캔해주세요", code: "INACTIVE_QR" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check expiry
    if (new Date(qrToken.expires_at) < new Date()) {
      console.error("[qr-checkin] Token expired:", qrToken.expires_at);
      return new Response(JSON.stringify({ error: "만료된 QR입니다. 새 QR을 스캔해주세요", code: "EXPIRED_QR" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get user profile and verify branch
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("branch_name, nickname, name, avatar_url, is_approved")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      console.error("[qr-checkin] Profile not found for user:", user.id);
      return new Response(JSON.stringify({ error: "프로필을 찾을 수 없습니다", code: "NO_PROFILE" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (profile.branch_name !== qrToken.branch_name) {
      console.error(`[qr-checkin] Branch mismatch: user=${profile.branch_name}, qr=${qrToken.branch_name}`);
      return new Response(JSON.stringify({ error: "다른 지점의 QR입니다", code: "WRONG_BRANCH" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Get member progress
    const { data: progress } = await supabaseAdmin
      .from("member_progress")
      .select("current_rank, current_level, total_xp, streak_days")
      .eq("user_id", user.id)
      .single();

    // 4. Get display settings
    const { data: displaySettings } = await supabaseAdmin
      .from("branch_display_settings")
      .select("display_name_mode")
      .eq("branch_name", qrToken.branch_name)
      .single();

    const nameMode = displaySettings?.display_name_mode || "nickname";
    let displayName = profile.nickname || profile.name || "회원";
    if (nameMode === "masked_name") {
      const n = profile.name || profile.nickname || "회원";
      displayName = n.length <= 1 ? n : n[0] + "O".repeat(n.length - 1);
    } else if (nameMode === "full_name") {
      displayName = profile.name || profile.nickname || "회원";
    }

    // 5. Check duplicate today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: existingToday } = await supabaseAdmin
      .from("attendance_logs")
      .select("id")
      .eq("user_id", user.id)
      .eq("branch_name", qrToken.branch_name)
      .eq("is_duplicate", false)
      .gte("checked_in_at", todayStart.toISOString())
      .limit(1);

    const isDuplicate = (existingToday && existingToday.length > 0);
    const xpAmount = isDuplicate ? 0 : (profile.is_approved ? 10 : 0);

    // 6. Insert attendance log
    const { data: log, error: logError } = await supabaseAdmin
      .from("attendance_logs")
      .insert({
        user_id: user.id,
        branch_name: qrToken.branch_name,
        method: "qr",
        xp_granted: xpAmount,
        is_duplicate: isDuplicate,
        display_name_snapshot: displayName,
        league_snapshot: progress?.current_rank || "white",
        level_snapshot: progress?.current_level || 1,
      })
      .select()
      .single();

    if (logError) {
      console.error("[qr-checkin] Insert attendance_logs failed:", logError.message);
      return new Response(JSON.stringify({ error: "체크인 처리 중 오류가 발생했습니다", code: "INSERT_FAILED", detail: logError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7. Grant XP if not duplicate and approved
    if (xpAmount > 0) {
      const { error: xpError } = await supabaseAdmin.from("xp_logs").insert({
        user_id: user.id,
        amount: xpAmount,
        reason: "QR 체크인 출석",
      });
      if (xpError) console.error("[qr-checkin] xp_logs insert failed:", xpError.message);

      const { error: progressError } = await supabaseAdmin
        .from("member_progress")
        .update({ 
          total_xp: (progress?.total_xp || 0) + xpAmount,
          streak_days: (progress?.streak_days || 0) + 1,
        })
        .eq("user_id", user.id);
      if (progressError) console.error("[qr-checkin] member_progress update failed:", progressError.message);

      // Create notification
      await supabaseAdmin.from("notifications").insert({
        user_id: user.id,
        title: "출석 완료! +10XP 🥊",
        body: "오늘도 복싱 레벨업 중!",
      });
    }

    console.log(`[qr-checkin] Success: user=${user.id}, duplicate=${isDuplicate}, xp=${xpAmount}`);

    return new Response(JSON.stringify({
      success: true,
      is_duplicate: isDuplicate,
      xp_granted: xpAmount,
      display_name: displayName,
      league: progress?.current_rank || "white",
      level: progress?.current_level || 1,
      avatar_url: profile.avatar_url,
      attendance_id: log.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[qr-checkin] Unexpected error:", e);
    return new Response(JSON.stringify({ error: "서버 오류가 발생했습니다", code: "SERVER_ERROR" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
