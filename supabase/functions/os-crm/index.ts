// 📇 os-crm — 153운영본부 「CRM」 탭 (2026-11-27 대표님 「다음가자」 · 관장님 앱 ② 153OS CRM 보기 · docs/features/69)
//
// 화면(src/components/ops/OpsCrmTab.tsx)이 부른다. verify_jwt = true. 읽기만 한다(쓰기는 ④).
//   1) 부른 사람 토큰으로 앱 crm_scope(p_branch) — 본사는 CRM 켠 지점 모두 · 지점장은 자기 지점만(코치 · 회원은 꺼짐).
//   2) 153OS(서버 키 OS_SERVICE_KEY — 서버에만) 함수로 그 지점 자료를 받아 그대로 넘긴다(앱 DB 에 회원 정보를 저장하지 않는다):
//        action "members"   → crm_members(지점, 찾을 말)   회원 목록 · 할 일 표시 · 숫자(목록에는 전화 뒷 4자리만)
//        action "card"      → crm_member_card(지점, 회원 id) 회원 카드(전화 전체 · 결제 · 방문 날짜) — 연 기록을 crm_access_log 에
//        action "customers" → crm_customers(지점)           이번 달 손님 흐름 · 톡톡 손님 · 문의 기록
//   153OS 함수 사본: docs/os153/20261127002838_owner_crm.sql
// 답은 늘 200 { ok: true, scope, data } | { ok: false, code } — 화면이 code 로 안내한다.
// 로그에는 지점 · 결과 코드만(이름 · 전화 안 찍음).
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { cleanQuery, last4, tokenSub, UUID } from "./logic.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });

const ACTIONS = new Set(["members", "card", "customers"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const OS_URL = Deno.env.get("OS_SUPABASE_URL") || "https://tbxdrfowanyksgdicryl.supabase.co";
  const OS_KEY = Deno.env.get("OS_SERVICE_KEY") || "";
  if (!OS_KEY) return json({ ok: false, code: "OS_NOT_CONFIGURED" });

  const body: any = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "").trim();
  if (!ACTIONS.has(action)) return json({ ok: false, code: "INVALID_REQUEST" });
  const wantBranch = typeof body?.branch === "string" && body.branch.trim() ? body.branch.trim().slice(0, 60) : null;
  const memberId = String(body?.id ?? "").trim();
  if (action === "card" && !UUID.test(memberId)) return json({ ok: false, code: "INVALID_REQUEST" });

  // 1) 누가 — 관장 · 지점장 · 본사만 (서버 crm_scope)
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ ok: false, code: "NOT_AUTHENTICATED" });
  const asUser = createClient(SUPABASE_URL, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: scope, error: scopeErr } = await asUser.rpc("crm_scope", { p_branch: wantBranch });
  if (scopeErr) {
    console.error("os-crm scope", scopeErr.code ?? scopeErr.message);
    return json({ ok: false, code: scopeErr.code === "42501" ? "NOT_AUTHENTICATED" : "SCOPE_FAILED" });
  }
  if (!scope?.on || typeof scope?.branch !== "string") return json({ ok: false, code: "FORBIDDEN", role: scope?.role ?? "none" });
  const branch: string = scope.branch;
  const outScope = {
    role: scope.role === "admin" ? "admin" : "manager",
    branch,
    branches: Array.isArray(scope.branches) ? scope.branches.map(String) : [branch],
  };

  // 2) 153OS 에서 읽기
  const os = createClient(OS_URL, OS_KEY, { auth: { persistSession: false } });
  try {
    let data: any;
    if (action === "members") {
      const r = await os.rpc("crm_members", { p_branch_name: branch, p_query: cleanQuery(body?.q) });
      if (r.error) throw new Error(r.error.message);
      data = r.data;
    } else if (action === "customers") {
      const r = await os.rpc("crm_customers", { p_branch_name: branch });
      if (r.error) throw new Error(r.error.message);
      data = r.data;
    } else {
      const r = await os.rpc("crm_member_card", { p_branch_name: branch, p_member_id: memberId });
      if (r.error) throw new Error(r.error.message);
      data = r.data;
      if (data?.error === "member_not_found") return json({ ok: false, code: "NOT_FOUND" });
      if (data && scope.full_phone !== true) data = { ...data, phone: null, last4: last4(data.phone) };
      // 회원 카드를 연 기록 — 누가 · 언제 · 어느 지점 · 어느 회원 id (이름 · 전화 없음)
      const uid = tokenSub(token);
      if (uid) {
        const app = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
        const { error: logErr } = await app
          .from("crm_access_log")
          .insert({ user_id: uid, role: outScope.role, branch_name: branch, action: "card", member_id: memberId });
        if (logErr) console.error("os-crm log", logErr.code ?? logErr.message);
      }
    }
    if (data?.error === "branch_not_found") return json({ ok: false, code: "BRANCH_NOT_IN_OS" });
    return json({ ok: true, scope: outScope, data });
  } catch (e) {
    console.error("os-crm", action, branch, (e as Error).message);
    return json({ ok: false, code: "OS_FAILED" });
  }
});
