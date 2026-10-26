// 전 지점 수강권 등록 모음 — 전체관리자(대표님 계정)만 (2026-10-26 대표님: "회원님들 등록한 부분만 정리해서 보여주는 기능 … 일단 나만 볼 수 있게").
//
// 전체관리자 대시보드 '등록' 칸(src/components/RegistrationReportPanel.tsx)이 부른다:
//   1) 부른 사람이 앱의 super_admin 인지 확인한다 — admin·지점장·코치·회원은 403.
//   2) 153OS 의 registration_report(p_from, p_to)를 서버 키(OS_SERVICE_KEY — 서버에만 있다)로 불러 그대로 돌려준다.
//      브로제이 지점(sales_entries '수강권') + 칠금점(다짐 매출 dagym_sales) · 신규/재등록/일일권/환불 · 지점별 합계 · 데이터 기준 시각.
// 읽기 전용. verify_jwt = true (로그인한 앱 사용자만).
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 400; // DB 함수도 같은 한도로 막는다

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

  // 2) 기간 확인 → 153OS 읽기
  const body: any = await req.json().catch(() => ({}));
  const from = String(body?.from ?? "");
  const to = String(body?.to ?? "");
  if (!ISO_DAY.test(from) || !ISO_DAY.test(to) || to < from) return json({ error: "bad_range" }, 400);
  if ((Date.parse(to) - Date.parse(from)) / 86400000 > MAX_DAYS) return json({ error: "range_too_long" }, 400);

  const os = createClient(OS_URL, OS_KEY, { auth: { persistSession: false } });
  const { data, error } = await os.rpc("registration_report", { p_from: from, p_to: to });
  if (error) {
    console.error("registration-report os rpc", error.message);
    return json({ error: "os_query_failed" }, 502);
  }
  return json(data ?? {});
});
