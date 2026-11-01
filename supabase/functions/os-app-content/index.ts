// 📮 os-app-content — 회원 화면 ↔ 153OS 앱 통로 (2026-11-02 대표님 「둘 다 차례로」 — 153OS 33단계로 만든
//   공지사항 · 지점/코치 소개 · 후기 · 1:1 문의를 마이복서153 회원 화면에)
//
// 회원 화면(src/services/osContentService.ts)이 부른다. verify_jwt = true (로그인한 앱 사용자만).
//   1) 부른 사람 토큰 → 앱 계정 id
//   2) 153OS 워커 /api/external/me/* 를 X-Partner-Key(시크릿 OS_PARTNER_KEY — payssam-callback 과 같은 키)
//      + X-Ranking-User-Id(앱 계정 id)로 부른다. 153OS 가 앱 계정 → 회원(members.ranking_app_user_id)을 찾아
//      그 회원 지점 것만 돌려준다. 키는 이 함수 밖(브라우저 · 앱)으로 나가지 않는다.
//   3) op 로 정해 둔 길만 — 주소를 그대로 넘기지 않는다.
// 답은 늘 200 { ok: true, data, message } | { ok: false, status, code, message } — 화면이 한 모양으로 읽게.
//   code 예: NOT_REGISTERED(153OS 회원과 아직 안 이어짐) · TOO_MANY(문의 하루 5건) · INVALID_REQUEST · OS_UNAVAILABLE
// 로그에는 op · 상태 코드만 남긴다(글 · 이름을 찍지 않는다).
// 153OS 쪽 설명: 153-boxing-os docs/partner-api-app-content.md
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORIES = ["membership", "class", "pt", "facility", "refund", "etc"];
const MAX_BODY_BYTES = 12_000;
const TIMEOUT_MS = 12_000;

type Body = Record<string, unknown>;
type Op = { method: "GET" | "POST" | "DELETE"; path: (b: Body) => string | null; body?: (b: Body) => unknown };

const uuidOf = (v: unknown): string | null => (typeof v === "string" && UUID.test(v) ? v.toLowerCase() : null);
const text = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");

const OPS: Record<string, Op> = {
  notices: { method: "GET", path: () => "/me/notices" },
  notice: { method: "GET", path: (b) => (uuidOf(b.id) ? `/me/notices/${uuidOf(b.id)}` : null) },
  branch: { method: "GET", path: () => "/me/branch" },
  coaches: { method: "GET", path: () => "/me/coaches" },
  reviews: { method: "GET", path: () => "/me/reviews" },
  review_save: {
    method: "POST",
    path: () => "/me/reviews",
    body: (b) => ({
      rating: Math.round(Number(b.rating)),
      body: text(b.body, 2000),
      coach_staff_id: uuidOf(b.coach_staff_id),
    }),
  },
  review_delete: { method: "DELETE", path: () => "/me/reviews/mine" },
  inquiries: { method: "GET", path: () => "/me/inquiries" },
  inquiry: { method: "GET", path: (b) => (uuidOf(b.id) ? `/me/inquiries/${uuidOf(b.id)}` : null) },
  inquiry_new: {
    method: "POST",
    path: () => "/me/inquiries",
    body: (b) => ({
      category: typeof b.category === "string" && CATEGORIES.includes(b.category) ? b.category : "etc",
      title: text(b.title, 80),
      body: text(b.body, 2000),
    }),
  },
  inquiry_reply: {
    method: "POST",
    path: (b) => (uuidOf(b.id) ? `/me/inquiries/${uuidOf(b.id)}/messages` : null),
    body: (b) => ({ body: text(b.body, 2000) }),
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, code: "METHOD_NOT_ALLOWED", message: "잘못된 요청이에요" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const OS_API_URL = (Deno.env.get("OS_API_URL") || "https://153-boxing-os-api.boxing5969.workers.dev").replace(/\/+$/, "");
  const OS_PARTNER_KEY = Deno.env.get("OS_PARTNER_KEY") || "";
  if (!OS_PARTNER_KEY) return json({ ok: false, code: "OS_NOT_CONFIGURED", message: "지점 정보 연결이 아직 준비되지 않았어요" });

  // 1) 부른 사람
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ ok: false, code: "NOT_AUTHENTICATED", message: "다시 로그인해 주세요" }, 401);
  const app = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
  const { data: who, error: whoErr } = await app.auth.getUser(token);
  if (whoErr || !who?.user) return json({ ok: false, code: "NOT_AUTHENTICATED", message: "다시 로그인해 주세요" }, 401);
  const uid = who.user.id;

  // 2) op
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ ok: false, code: "INVALID_REQUEST", message: "글이 너무 길어요" });
  let body: Body = {};
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as Body;
  } catch {
    return json({ ok: false, code: "INVALID_REQUEST", message: "잘못된 요청이에요" });
  }
  const opName = typeof body.op === "string" ? body.op : "";
  const op = Object.prototype.hasOwnProperty.call(OPS, opName) ? OPS[opName] : null;
  if (!op) return json({ ok: false, code: "INVALID_REQUEST", message: "잘못된 요청이에요" });
  const path = op.path(body);
  if (!path) return json({ ok: false, code: "NOT_FOUND", message: "찾을 수 없어요" });
  const payload = op.body ? op.body(body) : undefined;

  // 3) 153OS
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${OS_API_URL}/api/external${path}`, {
      method: op.method,
      signal: ctrl.signal,
      headers: {
        "X-Partner-Key": OS_PARTNER_KEY,
        "X-Ranking-User-Id": uid,
        ...(payload !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: payload !== undefined ? JSON.stringify(payload) : undefined,
    });
  } catch {
    console.log(`os-app-content op=${opName} status=network`);
    return json({ ok: false, code: "OS_UNAVAILABLE", message: "지점 정보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요" });
  } finally {
    clearTimeout(timer);
  }
  // deno-lint-ignore no-explicit-any
  const j: any = await res.json().catch(() => null);
  console.log(`os-app-content op=${opName} status=${res.status}`);
  if (res.ok && j?.success) return json({ ok: true, data: j.data ?? null, message: typeof j.message === "string" ? j.message : null });
  return json({
    ok: false,
    status: res.status,
    code: typeof j?.error?.code === "string" ? j.error.code : `HTTP_${res.status}`,
    message: typeof j?.error?.message === "string" ? j.error.message : "잠시 뒤 다시 시도해 주세요",
  });
});
