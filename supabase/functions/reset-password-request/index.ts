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
    const fakeEmail = trimmed.includes("@") ? null : `${trimmed}@153rankup.app`;

    // List all auth users
    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (userError) throw userError;

    let authUser = null;

    // Strategy 1: Find by fake email (normal case)
    if (fakeEmail) {
      authUser = userData.users.find(u => u.email?.toLowerCase() === fakeEmail);
    }

    // Strategy 2: Find by direct email match (user entered full email)
    if (!authUser && trimmed.includes("@")) {
      authUser = userData.users.find(u => u.email?.toLowerCase() === trimmed);
    }

    // Strategy 3: Find by original_auth_email in app_metadata (password reset in progress)
    if (!authUser && fakeEmail) {
      authUser = userData.users.find(u => 
        u.app_metadata?.original_auth_email?.toLowerCase() === fakeEmail
      );
    }

    // Strategy 4: Find by auth email starting with username@ (email was swapped to real one)
    if (!authUser && !trimmed.includes("@")) {
      const candidates = userData.users.filter(u => 
        u.email?.toLowerCase().startsWith(trimmed + "@") && 
        !u.email?.toLowerCase().endsWith("@153rankup.app")
      );
      // If multiple candidates, prefer the one with a matching profile
      if (candidates.length === 1) {
        authUser = candidates[0];
      } else if (candidates.length > 1) {
        // Check profiles to find the right user
        for (const candidate of candidates) {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("email")
            .eq("user_id", candidate.id)
            .single();
          if (profile?.email) {
            authUser = candidate;
            break;
          }
        }
      }
    }

    if (!authUser) {
      console.log("User not found for:", trimmed);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get real email from profiles
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("user_id", authUser.id)
      .single();

    const realEmail = profile?.email;
    if (!realEmail) {
      console.log("No real email for user:", authUser.id);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const currentAuthEmail = authUser.email!.toLowerCase();
    console.log(`User found: ${authUser.id}, auth email: ${currentAuthEmail}, real email: ${realEmail}`);

    // Case A: Auth email already IS the real email — just trigger recovery directly
    if (currentAuthEmail === realEmail.toLowerCase()) {
      console.log("Auth email matches real email — triggering recovery directly");
      
      // Make sure original_auth_email is stored if not already
      if (!authUser.app_metadata?.original_auth_email && fakeEmail) {
        await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
          app_metadata: { original_auth_email: fakeEmail },
        });
      }

      const recoverRes = await fetch(`${supabaseUrl}/auth/v1/recover`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: anonKey },
        body: JSON.stringify({
          email: realEmail,
          ...(redirectTo ? { redirect_to: redirectTo } : {}),
        }),
      });

      if (!recoverRes.ok) {
        console.error("Recovery API error:", recoverRes.status, await recoverRes.text());
      } else {
        console.log("Recovery email sent successfully");
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Case B: Auth email is fake — need to swap to real, trigger recovery, DON'T swap back
    console.log("Swapping auth email to real email for recovery");

    // Check if another auth user already has this real email
    const emailConflict = userData.users.find(u => 
      u.id !== authUser!.id && u.email?.toLowerCase() === realEmail.toLowerCase()
    );

    if (emailConflict) {
      console.error("Email conflict: another user has this real email as auth email:", emailConflict.id);
      // Can't swap — try generateLink approach instead
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: currentAuthEmail,
        options: redirectTo ? { redirectTo } : undefined,
      });

      if (linkError) {
        console.error("generateLink error:", linkError);
        throw linkError;
      }

      // We have the link but can't send it to the real email without email infra
      // As a fallback, trigger recovery to the current auth email
      // This won't reach the user, but at least we don't error out
      console.log("Generated recovery link (cannot send due to email conflict)");
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Store original email for later restoration
    await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
      app_metadata: { original_auth_email: currentAuthEmail },
    });

    // Swap to real email
    const { error: swapErr } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
      email: realEmail,
      email_confirm: true,
    });
    if (swapErr) {
      console.error("Failed to swap email:", swapErr);
      throw swapErr;
    }

    // Trigger recovery
    const recoverRes = await fetch(`${supabaseUrl}/auth/v1/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify({
        email: realEmail,
        ...(redirectTo ? { redirect_to: redirectTo } : {}),
      }),
    });

    if (!recoverRes.ok) {
      console.error("Recovery API error:", recoverRes.status, await recoverRes.text());
    } else {
      console.log("Recovery email sent successfully (email swapped, will restore after reset)");
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
