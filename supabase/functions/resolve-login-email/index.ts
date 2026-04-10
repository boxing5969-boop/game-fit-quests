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
    const { username } = await req.json();

    if (!username || typeof username !== "string") {
      return new Response(
        JSON.stringify({ error: "아이디를 입력해주세요" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const trimmed = username.toLowerCase().trim();
    const fakeEmail = `${trimmed}@153rankup.app`;

    // Look up the user by fake email first
    const { data: userData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

    // Check if user exists with fake email
    const userWithFake = userData?.users.find((u) => u.email?.toLowerCase() === fakeEmail);
    if (userWithFake) {
      // User's auth email is the fake email — normal case
      return new Response(
        JSON.stringify({ authEmail: fakeEmail }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // User not found with fake email — check if they have original_auth_email in metadata
    // This means they're in a password reset window
    const userWithRealEmail = userData?.users.find((u) => 
      u.app_metadata?.original_auth_email === fakeEmail
    );

    if (userWithRealEmail) {
      return new Response(
        JSON.stringify({ authEmail: userWithRealEmail.email }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Not found at all
    return new Response(
      JSON.stringify({ authEmail: fakeEmail }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Resolve login email error:", err);
    return new Response(
      JSON.stringify({ error: "처리 중 오류가 발생했습니다" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
