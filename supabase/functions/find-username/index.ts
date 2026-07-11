import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// 아이디/이메일 일부 가리기: 앞 2 + 뒤 1 노출, 가운데 마스킹(최소 2)
function maskId(id: string): string {
  if (!id) return "";
  if (id.length <= 2) return id[0] + "*";
  if (id.length === 3) return id[0] + "*" + id[2];
  const head = id.slice(0, 2);
  const tail = id.slice(-1);
  const stars = "*".repeat(Math.max(2, id.length - 3));
  return head + stars + tail;
}

function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return maskId(email);
  const [local, domain] = email.split("@");
  return `${maskId(local)}@${domain}`;
}

// 아이디(username) 찾기 — 이름+전화(+생년월일) 본인확인 후 가입 아이디/소셜을 가려서 안내.
// verify-identity-reset 과 동일한 본인확인 기준. 비번은 반환하지 않음.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { name, phone, birthDate } = await req.json();

    if (!name || !phone) {
      return json({ error: "이름과 전화번호를 입력해주세요" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const cleanPhone = String(phone).replace(/\D/g, "");
    const cleanBirth = birthDate ? String(birthDate).replace(/\D/g, "") : null;
    const nameClean = String(name).trim();

    // 이름 일치 프로필 조회 후 전화(+생년월일)로 필터
    const { data: profiles, error: pErr } = await admin
      .from("profiles")
      .select("user_id, name, phone_number, birth_date")
      .eq("name", nameClean);
    if (pErr) throw pErr;

    const matches = (profiles || []).filter((p) => {
      const pPhone = (p.phone_number || "").replace(/\D/g, "");
      if (pPhone !== cleanPhone) return false;
      if (cleanBirth && p.birth_date) {
        return String(p.birth_date).replace(/\D/g, "") === cleanBirth;
      }
      return true;
    });

    if (!matches.length) {
      return json({ error: "입력한 정보와 일치하는 계정을 찾을 수 없습니다" }, 404);
    }

    // auth 사용자 매핑(이메일/소셜 판별) — 전체 페이지 조회(페이지네이션 필수)
    const allUsers: any[] = [];
    {
      let page = 1;
      // deno-lint-ignore no-constant-condition
      while (true) {
        const { data: pageData, error: aErr } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (aErr) throw aErr;
        allUsers.push(...pageData.users);
        if (pageData.users.length < 1000) break;
        page++;
      }
    }

    const accounts: Array<Record<string, string>> = [];
    for (const m of matches) {
      const u = allUsers.find((x) => x.id === m.user_id);
      if (!u) continue;
      const email = u.email || "";
      const provider =
        (u.app_metadata?.provider as string) ||
        ((u.app_metadata?.providers as string[] | undefined)?.[0]) ||
        "email";

      if (email.endsWith("@153rankup.app")) {
        accounts.push({ type: "username", username: maskId(email.split("@")[0]) });
      } else if (provider === "google" || provider === "kakao" || provider === "apple") {
        accounts.push({ type: "social", provider, email: maskEmail(email) });
      } else {
        accounts.push({ type: "email", email: maskEmail(email) });
      }
    }

    if (!accounts.length) {
      return json({ error: "입력한 정보와 일치하는 계정을 찾을 수 없습니다" }, 404);
    }

    return json({ accounts });
  } catch (e) {
    console.error("find-username error:", e);
    return json({ error: "처리 중 오류가 발생했습니다. 다시 시도해주세요." }, 500);
  }
});
