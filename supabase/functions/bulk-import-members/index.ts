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

const onlyDigits = (s: unknown) => String(s ?? "").replace(/[^0-9]/g, "");

// 날짜 정규화: "2026-09-14" / "2026. 9. 14." / Date → "YYYY-MM-DD" or null
function toISODate(v: unknown): string | null {
  if (v === null || v === undefined || v === "" || v === "-") return null;
  const s = String(v).trim();
  const m = s.match(/([0-9]{4})[^0-9]+([0-9]{1,2})[^0-9]+([0-9]{1,2})/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return null;
}

// 브로제이 회원정보 일괄 등록 — 관리자 전용.
// 행마다: auth 계정 생성(이메일/비번 = 전화번호) → handle_new_user 트리거가 프로필·역할·진행도 생성
//          → 프로필 is_approved=true + 등록일/만료일 + must_change_credentials=true 로 UPDATE.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    // 1) 호출자 인증 + 권한(관리자/관장/코치만)
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: uErr } = await caller.auth.getUser();
    if (uErr || !user) return json({ error: "로그인이 필요합니다." }, 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: roleRows } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const allowed = new Set(["admin", "super_admin", "branch_manager", "coach"]);
    const isManager = (roleRows || []).some((r: { role: string }) => allowed.has(r.role));
    if (!isManager) return json({ error: "관리자 권한이 필요합니다." }, 403);
    const isAdmin = (roleRows || []).some(
      (r: { role: string }) => r.role === "admin" || r.role === "super_admin",
    );

    // 2) 입력
    const body = await req.json();
    const members: Array<Record<string, unknown>> = Array.isArray(body?.members) ? body.members : [];
    if (!members.length) return json({ error: "등록할 회원이 없습니다." }, 400);
    if (members.length > 1000) return json({ error: "한 번에 1000명까지만 가능합니다." }, 400);

    // 지점 스코프: 관장/코치는 본인 지점에만, 마스터(admin/super_admin)는 지정한 지점에.
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("branch_name")
      .eq("user_id", user.id)
      .maybeSingle();
    const effectiveBranch: string = isAdmin
      ? String(body?.branch_name || "").trim()
      : String(callerProfile?.branch_name || "").trim();
    if (!effectiveBranch) {
      return json({ error: isAdmin ? "지점을 선택해주세요." : "관장 지점 정보가 없습니다." }, 400);
    }
    const { data: branchRow } = await admin
      .from("branches")
      .select("id")
      .eq("name", effectiveBranch)
      .maybeSingle();
    if (!branchRow) return json({ error: `등록되지 않은 지점입니다: ${effectiveBranch}` }, 400);

    let created = 0;
    let skipped = 0;
    const failed: Array<{ name: string; phone: string; reason: string }> = [];

    for (const m of members) {
      const name = String(m.name ?? "").trim();
      const phone = onlyDigits(m.phone);
      if (phone.length < 10) {
        failed.push({ name, phone, reason: "전화번호 형식 오류" });
        continue;
      }

      // 중복 전화번호 skip
      const { data: dup } = await admin
        .from("profiles")
        .select("user_id")
        .eq("phone_number", phone)
        .maybeSingle();
      if (dup) {
        skipped++;
        continue;
      }

      const email = `${phone}@153rankup.app`;
      const { data: cu, error: cErr } = await admin.auth.admin.createUser({
        email,
        password: phone,
        email_confirm: true,
        user_metadata: {
          name,
          nickname: name || phone,
          phone_number: phone,
          branch_name: effectiveBranch,
          birth_date: toISODate(m.birth_date),
        },
      });
      if (cErr || !cu?.user) {
        failed.push({ name, phone, reason: cErr?.message || "계정 생성 실패" });
        continue;
      }

      // handle_new_user 트리거가 프로필/역할/진행도 생성 → 승인 + 등록일/만료일 + 최초변경 플래그 UPDATE
      const { error: upErr } = await admin
        .from("profiles")
        .update({
          is_approved: true,
          gym_reg_date: toISODate(m.reg_date),
          membership_end: toISODate(m.membership_end),
          must_change_credentials: true,
        })
        .eq("user_id", cu.user.id);
      if (upErr) {
        failed.push({ name, phone, reason: "프로필 업데이트 실패" });
        continue;
      }
      created++;
    }

    return json({ ok: true, branch: effectiveBranch, total: members.length, created, skipped, failed });
  } catch (e) {
    console.error("bulk-import-members error:", e);
    return json({ error: "처리 중 오류가 발생했습니다. 다시 시도해주세요." }, 500);
  }
});
