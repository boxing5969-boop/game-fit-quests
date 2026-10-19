// 🗑️ account-delete-request — 앱 안에서 계정 삭제(회원 탈퇴) 요청 (2026-10-19)
//
// App Store 심사 5.1.1(v): 가입이 되는 앱은 앱 안에서 계정 삭제를 시작할 수 있어야 한다 (이메일·전화만으로는 안 된다).
// 부르는 곳: 설정 › 계정 삭제 (src/components/account/AccountDeleteDialog.tsx) — 로그인한 회원 본인만 (verify_jwt 기본값 true).
// 요청: { confirm: "탈퇴", reason?: string }
// 하는 일:
//   1) account_deletion_requests 에 기록 (같은 사람은 한 번만)
//   2) 휴대폰 알림 끄기 · 전체관리자에게 알림 (회원 화면 링크) — 7일 안에 회원 화면의 '계정 삭제'(delete-user)로 마무리
//      계약·결제 기록은 법정 보관 기간이 있어 사람이 확인하고 지운다 (public/account-delete 안내와 같은 약속)
//   3) 바로 잠금: 로그인 막기(ban) + 모든 기기 로그아웃
// 운영진(전체관리자·관리자·지점장)은 막는다 — 지점 운영 계정을 실수로 잠그지 않게.
// 로그에는 개수·결과만 (이름·이유를 찍지 않는다).
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const STAFF_ROLES = new Set(["super_admin", "admin", "branch_manager"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json(401, { ok: false, error: "not_authenticated" });

    const caller = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json(401, { ok: false, error: "not_authenticated" });

    const body = (await req.json().catch(() => ({}))) as { confirm?: unknown; reason?: unknown };
    if (typeof body.confirm !== "string" || body.confirm.trim() !== "탈퇴") return json(400, { ok: false, error: "confirm_required" });
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) || null : null;

    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    if ((roles ?? []).some((r) => STAFF_ROLES.has(String(r.role)))) return json(200, { ok: false, error: "staff_account" });

    const { data: prof } = await admin.from("profiles").select("name, nickname, branch_name").eq("user_id", user.id).maybeSingle();
    const name = (prof?.name || prof?.nickname || "회원").toString().trim() || "회원";
    const branch = prof?.branch_name ? String(prof.branch_name) : null;

    // 1) 요청 기록 (이미 있으면 그대로)
    const { error: insErr } = await admin
      .from("account_deletion_requests")
      .upsert({ user_id: user.id, reason, source: "app", member_name: name, branch_name: branch }, { onConflict: "user_id", ignoreDuplicates: true });
    if (insErr) throw insErr;

    // 2) 휴대폰 알림 끄기 + 전체관리자에게 알림
    await admin.from("push_subscriptions").update({ active: false }).eq("user_id", user.id).eq("active", true);
    const { data: supers } = await admin.from("user_roles").select("user_id").eq("role", "super_admin");
    const rows = (supers ?? [])
      .map((r) => String(r.user_id))
      .filter((id) => id !== user.id)
      .map((id) => ({
        user_id: id,
        title: "계정 삭제 요청",
        body: `${name}${branch ? ` (${branch})` : ""} 님이 앱에서 계정 삭제를 요청했어요. 로그인은 바로 잠겼어요. 7일 안에 회원 화면의 '계정 삭제'로 마무리해 주세요.`,
        link: `/manager/member/${user.id}`,
      }));
    if (rows.length) await admin.from("notifications").insert(rows);

    // 3) 바로 잠금 — 다시 로그인할 수 없게(약 100년) + 모든 기기 로그아웃
    const { error: banErr } = await admin.auth.admin.updateUserById(user.id, { ban_duration: "876000h" });
    if (banErr) throw banErr;
    await admin.auth.admin.signOut(jwt, "global").catch(() => undefined);

    console.log("account-delete-request ok");
    return json(200, { ok: true });
  } catch (e) {
    console.error("account-delete-request error", e instanceof Error ? e.message : String(e));
    return json(500, { ok: false, error: "internal" });
  }
});
