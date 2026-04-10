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

    // Build possible auth emails to search for
    const possibleEmails: string[] = [];

    if (trimmed.includes("@")) {
      // User entered a full email — try it directly AND as fake email
      possibleEmails.push(trimmed);
      const localPart = trimmed.split("@")[0];
      possibleEmails.push(`${localPart}@153rankup.app`);
    } else {
      // User entered just a username
      possibleEmails.push(`${trimmed}@153rankup.app`);
    }

    // Find user by any of the possible emails
    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

    if (userError) throw userError;

    const user = userData.users.find((u) =>
      possibleEmails.includes(u.email?.toLowerCase() ?? "")
    );

    if (!user) {
      console.log("User not found for emails:", possibleEmails);
      // Don't reveal whether user exists
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

    // Save original auth email
    const originalEmail = user.email!;

    // Temporarily update auth email to the real email
    const { error: updateErr1 } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      email: realEmail,
      email_confirm: true,
    });
    if (updateErr1) {
      console.error("Failed to update email:", updateErr1);
      throw updateErr1;
    }

    // Trigger password recovery via GoTrue API — this sends the actual email
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

    // Switch email back to original
    const { error: updateErr2 } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      email: originalEmail,
      email_confirm: true,
    });
    if (updateErr2) {
      console.error("Failed to restore email:", updateErr2);
    }

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
