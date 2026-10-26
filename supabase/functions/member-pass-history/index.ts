// 회원 상세 '수강' 탭 — 한 회원의 브로제이 · 다짐 매출 (2026-10-27 대표님 보고서 「앱 결제 장바구니 · 수강권/락카/운동복 남은 기간」,
//   10번 답 "처음엔 대표님만" → 전체관리자만).
//
// 회원 상세(src/components/admin/MemberPassPanel.tsx)가 부른다:
//   1) 부른 사람이 앱의 super_admin 인지 확인한다 — admin · 지점장 · 코치 · 회원은 403.
//   2) 그 회원의 앱 정보(지점 · 이름 · 번호)를 서버 키로 읽고, 153OS member_sales_history 를 서버 키(OS_SERVICE_KEY)로 불러 그대로 돌려준다.
//      브로제이 지점 = sales_entries(같은 지점 · 같은 이름 — 전화번호가 없다) · 칠금점 = 다짐 매출 dagym_sales(전화번호).
// 읽기 전용. verify_jwt = true (로그인한 앱 사용자만). registration-report 와 같은 틀.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const OS_URL = Deno.env.get("OS_SUPABASE_URL") || "https://tbxdrfowanyksgdicryl.supabase.co";
  const OS_KEY = Deno.env.get("OS_SERVICE_KEY") || "";
  if (!OS_KEY) return json({ error: "os_not_configured" }, 500);

  // 1) 전체관리자인지 확인
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "not_authenticated" }, 401);
  const app = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
  const { data: who, error: whoErr } = await app.auth.getUser(token);
  if (whoErr || !who?.user) return json({ error: "not_authenticated" }, 401);
  const { data: roles, error: roleErr } = await app
    .from("user_roles")
    .select("role")
    .eq("user_id", who.user.id)
    .eq("role", "super_admin")
    .limit(1);
  if (roleErr) return json({ error: "role_check_failed" }, 500);
  if (!roles?.length) return json({ error: "forbidden" }, 403);

  // 2) 회원 앱 정보 → 153OS 매출
  const body: any = await req.json().catch(() => ({}));
  const userId = String(body?.user_id ?? "");
  if (!UUID.test(userId)) return json({ error: "bad_user" }, 400);
  const { data: p, error: pErr } = await app
    .from("profiles")
    .select("name, nickname, phone_number, branch_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (pErr) return json({ error: "profile_failed" }, 500);
  if (!p) return json({ error: "no_member" }, 404);

  const os = createClient(OS_URL, OS_KEY, { auth: { persistSession: false } });
  const { data, error } = await os.rpc("member_sales_history", {
    p_branch: p.branch_name ?? "",
    p_name: p.name || p.nickname || "",
    p_phone: p.phone_number ?? "",
    p_app_user_id: userId,
  });
  if (error) {
    console.error("member-pass-history os rpc", error.message);
    return json({ error: "os_query_failed" }, 502);
  }
  return json(data ?? {});
});
