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

    const trimmed = username.toLowerCase().trim();

    const possibleEmails: string[] = [];
    if (trimmed.includes("@")) {
      possibleEmails.push(trimmed);
      const localPart = trimmed.split("@")[0];
      possibleEmails.push(`${localPart}@153rankup.app`);
    } else {
      possibleEmails.push(`${trimmed}@153rankup.app`);
    }

    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

    if (userError) throw userError;

    // Try to find user by auth email
    let user = userData.users.find((u) =>
      possibleEmails.includes(u.email?.toLowerCase() ?? "")
    );

    // If not found, user might be in password-reset state (email swapped to real email)
    // Try finding by original_auth_email in app_metadata
    if (!user) {
      user = userData.users.find((u) =>
        possibleEmails.includes(u.app_metadata?.original_auth_email?.toLowerCase() ?? "")
      );
    }

    // Still not found? Try looking up by profile email
    if (!user) {
      const fakeEmail = possibleEmails.find(e => e.endsWith("@153rankup.app")) || possibleEmails[0];
      const usernameFromEmail = fakeEmail.split("@")[0];
      // Search profiles for matching real email
      const { data: profileMatch } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .or(`email.eq.${trimmed}`)
        .maybeSingle();
      if (profileMatch) {
        user = userData.users.find(u => u.id === profileMatch.user_id) || null;
      }
    }

    if (!user) {
      console.log("User not found for emails:", possibleEmails);
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

    const realEmail = profile?.email;

    if (!realEmail) {
      console.log("No real email for user:", user.id);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Sending recovery to:", realEmail, "for user:", user.id);

    // Save original auth email in user metadata so we can restore it later
    const originalEmail = user.email!;
    
    // Store original email in app_metadata for later restoration
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      app_metadata: { original_auth_email: originalEmail },
    });

    // Update auth email to the real email
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      email: realEmail,
      email_confirm: true,
    });
    if (updateErr) {
      console.error("Failed to update email:", updateErr);
      throw updateErr;
    }

    // Trigger password recovery — sends email to real address
    const recoverRes = await fetch(`${supabaseUrl}/auth/v1/recover`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
      },
      body: JSON.stringify({
        email: realEmail,
        ...(redirectTo ? { redirect_to: redirectTo } : {}),
      }),
    });

    if (!recoverRes.ok) {
      const errBody = await recoverRes.text();
      console.error("Recovery API error:", recoverRes.status, errBody);
    } else {
      console.log("Recovery email triggered successfully");
    }

    // DO NOT swap email back here — it invalidates the recovery token!
    // The email will be restored after the user successfully resets their password
    // via the restore-auth-email edge function.

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
