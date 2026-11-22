// 기록 확인 대기 (2026-11-22 대표님 「확인대기 가자」)
//
// 「153복싱짐에 다니고 계세요? → 네」에서 명단을 못 찾은 회원(로그인 전)이 지점 데스크에 확인을 부탁한다.
//   op create — 이름 · 번호 · 생년월일 · 지점 · 남길 말 → member_lookup_requests 한 줄 + 대표님 · 지점장 알림.
//               돌려주는 열쇠(key)는 그 기기에만 남고, 서버에는 해시만 있다.
//   op status — 그 열쇠로 상태를 묻는다. 지점이 회원 계정을 골라 연결했으면(found) 10분 이어받기 표를 같이 준다
//               (_shared/linkTicket.ts — link-imported-by-phone 이 카카오 로그인 뒤 그 표로 합친다).
// 회원 정보(이름 · 레벨 · 번호)는 돌려주지 않는다 — 상태와 지점의 짧은 답만.
// 업무 결과도 200 {ok:false, error} 로 — 앱이 말을 그대로 보여 준다. 예상 못 한 오류만 500.
import { createClient } from "npm:@supabase/supabase-js@2";
import { signLinkTicket } from "../_shared/linkTicket.ts";
import { IP_DAILY_LIMIT, PHONE_DAILY_LIMIT, birthToDate, memberViewOf, parseCreate } from "./logic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));

function newKey(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// claim-member-account 와 같은 접속지 단위(IPv6 는 /64)
function ipKey(ip: string): string {
  const v = ip.trim().toLowerCase();
  const mapped = v.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return mapped[1];
  if (!v.includes(":")) return v;
  const [head, tail = ""] = v.split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const full = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t];
  return full.slice(0, 4).map((x) => x.replace(/^0+(?=.)/, "") || "0").join(":") + "::/64";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "허용되지 않은 요청입니다." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const body = await req.json().catch(() => null);
    const op = body?.op;

    if (op === "create") {
      const p = parseCreate(body);
      if (!p.ok) return json({ ok: false, error: p.error });
      const v = p.v;

      const { data: br, error: brErr } = await admin.from("branches").select("name").eq("name", v.branch).eq("is_visible", true).maybeSingle();
      if (brErr) throw brErr;
      if (!br) return json({ ok: false, error: "다니는 지점을 다시 골라 주세요." });

      const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "").trim();
      const ipHash = ip ? await sha256("153lookup:ip:" + serviceKey + ":" + ipKey(ip)) : null;
      const since = new Date(Date.now() - 86_400_000).toISOString();
      const byPhone = await admin.from("member_lookup_requests").select("id", { count: "exact", head: true }).eq("phone", v.phone).gte("created_at", since);
      if (byPhone.error) throw byPhone.error;
      if ((byPhone.count ?? 0) >= PHONE_DAILY_LIMIT) {
        return json({ ok: false, error: "이 번호로 오늘 이미 확인을 부탁하셨어요. 지점에서 확인하고 있으니 조금만 기다려 주세요." });
      }
      if (ipHash) {
        const byIp = await admin.from("member_lookup_requests").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since);
        if (byIp.error) throw byIp.error;
        if ((byIp.count ?? 0) >= IP_DAILY_LIMIT) return json({ ok: false, error: "오늘은 더 부탁할 수 없어요. 지점 데스크에 말씀해 주세요." });
      }

      const key = newKey();
      const { data: row, error: insErr } = await admin
        .from("member_lookup_requests")
        .insert({
          branch_name: v.branch,
          name: v.name,
          phone: v.phone,
          birth_date: birthToDate(v.birth),
          memo: v.memo,
          key_hash: await sha256(key),
          ip_hash: ipHash,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      const { error: nErr } = await admin.rpc("_member_lookup_notify", { p_id: row.id });
      if (nErr) console.error("member lookup notify failed:", nErr.message);
      return json({ ok: true, key });
    }

    if (op === "status") {
      const key = typeof body?.key === "string" ? body.key : "";
      if (!/^[A-Za-z0-9_-]{40,60}$/.test(key)) return json({ ok: false, status: "gone", error: "확인 요청을 찾을 수 없어요." });
      const { data: r, error } = await admin
        .from("member_lookup_requests")
        .select("id, status, branch_name, reply, created_at, resolved_at, target_user_id, seen_at")
        .eq("key_hash", await sha256(key))
        .maybeSingle();
      if (error) throw error;
      if (!r) return json({ ok: false, status: "gone", error: "확인 요청을 찾을 수 없어요." });

      let usable: boolean | null = null;
      let phone: string | null = null;
      if (r.status === "found" && r.target_user_id) {
        const { data: t } = await admin
          .from("profiles")
          .select("phone_number, must_change_credentials, merged_into")
          .eq("user_id", r.target_user_id)
          .maybeSingle();
        usable = !!t && t.must_change_credentials === true && !t.merged_into && !!t.phone_number;
        if (usable) {
          const { data: au } = await admin.auth.admin.getUserById(r.target_user_id);
          if (!au?.user || au.user.last_sign_in_at) usable = false;
        }
        phone = usable ? String(t!.phone_number).replace(/[^0-9]/g, "") : null;
      } else if (r.status === "found") {
        usable = false;
      }

      const view = memberViewOf(r.status, r.resolved_at ? Date.parse(r.resolved_at) : null, usable);
      if (r.status !== "pending" && !r.seen_at) {
        await admin.from("member_lookup_requests").update({ seen_at: new Date().toISOString() }).eq("id", r.id);
      }
      const out: Record<string, unknown> = { ok: true, status: view, branch: r.branch_name, reply: r.reply, created_at: r.created_at };
      if (view === "found" && phone && r.target_user_id) out.ticket = await signLinkTicket(serviceKey, phone, r.target_user_id);
      return json(out);
    }

    return json({ ok: false, error: "요청 형식이 올바르지 않습니다." });
  } catch (e) {
    console.error("member-lookup-request error:", e instanceof Error ? e.message : e);
    return json({ ok: false, error: "처리 중 오류가 발생했어요. 잠시 뒤 다시 해 주세요." }, 500);
  }
});
