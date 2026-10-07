// 기존 회원 결제 없이 앱 가입 (2026-10-07)
//
// 배경: 체육관(CRM)에 등록된 회원은 자동 동기화(sync-members-to-app)로 앱 계정이 이미 만들어져 있다
//   (must_change_credentials=true · 아직 본인이 넘겨받지 않은 계정). 그런데 회원이 로그인 화면의
//   "신규 회원 가입 신청"을 누르면 수강권 결제 단계가 나오고, 끝까지 가도 "이미 등록된 전화번호"로 막혔다.
// 이제: 전화번호 + 이름(+ 생년월일이 등록된 회원은 생년월일까지)이 기존 회원 정보와 맞으면 결제 단계 없이
//   그 계정을 본인이 정한 아이디·비밀번호로 넘겨받는다. 계정이 그대로라 레벨·출석·수강권 기록이 이어진다.
//
// action
//   check — 판정만 한다. 회원 정보(이름·생년월일·수강권 등)는 일절 돌려주지 않는다.
//           status: new(등록 안 된 번호 → 일반 가입) | existing(기존 회원 확인) | registered(이미 넘겨받은 계정)
//                   | mismatch(정보 불일치) | desk(지도진 등 셀프 가입 불가) | locked(시도 초과)
//   claim — 판정을 처음부터 다시 한다(앞 단계 결과를 믿지 않는다). existing 일 때만 아이디·비밀번호·가입 정보를 적용.
//           로그인된(소셜) 사용자는 이 경로를 쓰지 않는다 — 앱이 기존 연동(link-imported-by-phone)을 부른다.
//
// 보안
//   · 30분 안에 같은 번호 불일치 5회, 같은 접속지 불일치 15회, 또는 같은 접속지에서 회원 번호(이미 가입·지도진·불일치)
//     10개 이상을 두드리면 잠금. 등록 안 된 번호(new)·기존 회원 확인(existing)·가입 완료는 세지 않는다 — 데스크
//     태블릿이나 체육관 와이파이에서 회원 여럿이 가입해도 막히지 않게. 기록은 해시만(member_claim_attempts).
//     접속지는 Cloudflare 가 넣는 cf-connecting-ip(없으면 게이트웨이의 x-real-ip)만 믿는다 — x-forwarded-for 는
//     방문자가 마음대로 넣을 수 있다. IPv6 는 /64 단위로 묶는다(한 기기가 주소를 바꿔 가며 잠금을 피하지 못하게).
//   · 넘겨받기는 "아직 넘겨받지 않았고 한 번도 로그인하지 않은 계정"만. 이미 쓰는 계정·지도진/관리자 권한 계정은 거부.
//   · 두 요청이 동시에 같은 계정을 넘겨받지 못하게 must_change_credentials 를 조건부로 먼저 내린다(선점).
//   · 업무 결과(불일치·잠금 등)도 200 으로 돌려준다 — 앱이 안내 문구를 그대로 보여 줄 수 있게. 예상 못 한 오류만 500.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const onlyDigits = (s: unknown) => String(s ?? "").replace(/[^0-9]/g, "");
// 이름 비교 — 띄어쓰기·대소문자·조합형/완성형 차이·보이지 않는 글자(폭 없는 공백)로 같은 이름을 다르게 보지 않는다.
const ZERO_WIDTH = new Set([0x200b, 0x200c, 0x200d, 0xfeff]);
const normName = (s: unknown) =>
  Array.from(String(s ?? "").normalize("NFC").toLowerCase())
    .filter((ch) => !/\s/.test(ch) && !ZERO_WIDTH.has(ch.codePointAt(0) ?? 0))
    .join("");

const LOCK_WINDOW_MIN = 30;
const PHONE_FAIL_LIMIT = 5;
const IP_FAIL_LIMIT = 15;
// 한 접속지에서 30분 안에 회원 번호 10개 이상의 상태(이미 가입·지도진·불일치)를 알아내면 번호 목록을 훑는 것으로 본다.
const IP_PROBE_PHONES_LIMIT = 10;
const FAIL_RESULTS = ["mismatch"];
const PROBE_RESULTS = ["mismatch", "registered", "desk"];

type Status = "new" | "existing" | "registered" | "mismatch" | "desk" | "locked";

const MESSAGES: Record<Exclude<Status, "existing">, string> = {
  new: "체육관에 등록된 회원 번호가 아니에요. 신규 가입으로 진행해 주세요.",
  registered:
    "이미 앱 계정이 있는 전화번호예요. 로그인 화면의 '아이디 찾기'·'비밀번호 찾기'를 이용해 주세요.",
  mismatch:
    "체육관에 등록된 회원 정보와 달라요. 이름(과 생년월일)을 체육관에 등록할 때와 똑같이 입력해 주세요. 계속 안 되면 지점 데스크에 문의해 주세요.",
  desk: "이 번호는 앱에서 바로 가입할 수 없어요. 지점 데스크에 문의해 주세요.",
  locked: `확인 시도가 너무 많아요. ${LOCK_WINDOW_MIN}분 뒤에 다시 시도하거나 지점 데스크에 문의해 주세요.`,
};

interface Target {
  user_id: string;
  name: string | null;
  birth_date: string | null;
  must_change_credentials: boolean | null;
  is_staff: boolean | null;
  membership_end: string | null;
}

// deno-lint-ignore no-explicit-any
type Admin = any;

let hmacKey: CryptoKey | null = null;
// 번호·IP 해시 — 서버 비밀값을 키로 쓰는 HMAC 이라 표만 보고는 원래 번호를 되돌릴 수 없다.
async function hashOf(kind: string, value: string): Promise<string> {
  if (!hmacKey) {
    const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    hmacKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("153claim:" + secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
  }
  const sig = await crypto.subtle.sign("HMAC", hmacKey, new TextEncoder().encode(kind + ":" + value));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

// 방문자가 보낸 값으로 바꿀 수 없는 머리글만 쓴다(cf-connecting-ip 는 Cloudflare 가, x-real-ip 는 게이트웨이가 덮어쓴다).
function clientIp(req: Request): string {
  return (req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "").trim();
}

// 잠금 단위 — IPv4 는 주소 그대로, IPv6 는 앞 64비트(/64: 한 가입자·한 기기에 해당).
export function ipKey(ip: string): string {
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

function jwtRole(authHeader: string): string | null {
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  const parts = m ? m[1].split(".") : [];
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)));
    return typeof payload?.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

// 로그인한 사용자면 id, 방문자(anon 키)면 null. 방문자는 확인 호출을 건너뛴다.
async function callerUserId(req: Request, url: string, anonKey: string): Promise<string | null> {
  const auth = req.headers.get("Authorization") || "";
  if (jwtRole(auth) !== "authenticated") return null;
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: auth } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await caller.auth.getUser();
  if (error || !data?.user) return null;
  return data.user.id;
}

async function isLocked(admin: Admin, phoneHash: string, ipHash: string | null): Promise<boolean> {
  const since = new Date(Date.now() - LOCK_WINDOW_MIN * 60_000).toISOString();
  const byPhone = await admin
    .from("member_claim_attempts")
    .select("id", { count: "exact", head: true })
    .eq("phone_hash", phoneHash)
    .in("result", FAIL_RESULTS)
    .gte("created_at", since);
  if (byPhone.error) throw byPhone.error;
  if ((byPhone.count ?? 0) >= PHONE_FAIL_LIMIT) return true;
  if (!ipHash) return false;
  // 회원 번호를 두드린 기록만 본다(등록 안 된 번호·기존 회원 확인·가입 완료·'locked' 는 세지 않는다).
  const byIp = await admin
    .from("member_claim_attempts")
    .select("phone_hash, result")
    .eq("ip_hash", ipHash)
    .in("result", PROBE_RESULTS)
    .gte("created_at", since)
    .limit(200);
  if (byIp.error) throw byIp.error;
  const rows = (byIp.data ?? []) as { phone_hash: string; result: string }[];
  if (new Set(rows.map((r) => r.phone_hash)).size >= IP_PROBE_PHONES_LIMIT) return true;
  return rows.filter((r) => FAIL_RESULTS.includes(r.result)).length >= IP_FAIL_LIMIT;
}

async function evaluate(
  admin: Admin,
  phone: string,
  name: string,
  birth: string,
  callerId: string | null,
): Promise<{ status: Status; target?: Target }> {
  const { data: rows, error } = await admin
    .from("profiles")
    .select("user_id, name, birth_date, must_change_credentials, is_staff, membership_end")
    .eq("phone_number", phone)
    .limit(2);
  if (error) throw error;
  const list = (rows ?? []) as Target[];
  if (list.length === 0) return { status: "new" };
  if (list.length > 1) return { status: "desk" }; // 전화번호 유니크라 생기지 않지만, 생기면 사람이 봐야 한다
  const t = list[0];
  // 본인 계정에 이미 붙은 번호(소셜 가입 뒤 번호 등록) → 일반 흐름 그대로
  if (callerId && t.user_id === callerId) return { status: "new" };
  if (t.must_change_credentials !== true) return { status: "registered" };
  if (t.is_staff === true) return { status: "desk" };
  const { data: roles, error: rErr } = await admin.from("user_roles").select("role").eq("user_id", t.user_id);
  if (rErr) throw rErr;
  if (((roles ?? []) as { role: string }[]).some((r) => r.role !== "member")) return { status: "desk" };
  // 한 번이라도 로그인한 계정은 누군가 쓰고 있는 계정이다 — 셀프 넘겨받기 대상에서 뺀다(가로채기 방지).
  const { data: au, error: aErr } = await admin.auth.admin.getUserById(t.user_id);
  if (aErr && (aErr as { status?: number }).status !== 404) throw aErr;
  if (aErr || !au?.user) return { status: "desk" }; // 로그인 계정이 없는 프로필 — 데스크가 정리해야 한다
  if (au.user.last_sign_in_at) return { status: "registered" };

  const dbName = normName(t.name);
  const nameOk = dbName !== "" && dbName === normName(name);
  const dbBirth = onlyDigits(t.birth_date);
  const birthOk = dbBirth === "" || dbBirth === birth;
  if (!nameOk || !birthOk) return { status: "mismatch" };
  return { status: "existing", target: t };
}

// 동의 항목 — 값이 true/false 인 키만 남긴다(필수 항목 검사는 앱 화면이 한다: 일반 가입과 같은 기준).
function sanitizeAgreements(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (!/^[a-z_]{1,40}$/.test(k)) continue;
    if (typeof val === "boolean") out[k] = val;
  }
  if (!Object.values(out).some((x) => x === true)) return null;
  const version = (v as Record<string, unknown>).version;
  if (typeof version === "string" && /^[0-9-]{4,20}$/.test(version)) out.version = version;
  return out;
}

const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, status: "invalid", error: "허용되지 않은 요청입니다." }, 405);
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const body = await req.json().catch(() => null);
    const invalid = (error: string) => json({ ok: false, status: "invalid", error });
    if (!body || typeof body !== "object") return invalid("요청 형식이 올바르지 않습니다.");
    const action = body.action === "claim" ? "claim" : body.action === "check" ? "check" : null;
    if (!action) return invalid("요청 형식이 올바르지 않습니다.");

    const phone = onlyDigits(body.phone);
    const name = String(body.name ?? "").trim();
    const birth = onlyDigits(body.birthDate);
    if (!/^0\d{9,10}$/.test(phone)) return invalid("전화번호를 정확히 입력해 주세요.");
    if (!normName(name) || name.length > 40) return invalid("이름(실명)을 입력해 주세요.");
    if (birth.length !== 8) return invalid("생년월일 8자리를 입력해 주세요. (예: 19990315)");

    // claim 입력 검사 — 판정(시도 횟수)에 들어가기 전에 형식부터 거른다.
    let username = "";
    let password = "";
    let nickname = "";
    let agreements: Record<string, unknown> | null = null;
    if (action === "claim") {
      username = String(body.username ?? "").toLowerCase().trim();
      password = typeof body.password === "string" ? body.password : "";
      nickname = String(body.nickname ?? "").trim();
      if (!/^[a-z0-9_]{4,20}$/.test(username)) return invalid("아이디는 영문 소문자·숫자·밑줄(_) 4~20자로 정해 주세요.");
      if (/^0\d{9,10}$/.test(username)) return invalid("전화번호는 아이디로 쓸 수 없어요. 다른 아이디를 정해 주세요.");
      if (password.length < 6 || password.length > 72) return invalid("비밀번호는 6자 이상으로 정해 주세요.");
      if (!nickname || [...nickname].length > 12) return invalid("닉네임은 1~12자로 정해 주세요.");
      agreements = sanitizeAgreements(body.agreements);
      if (!agreements) return invalid("필수 약관에 모두 동의해 주세요.");
    }

    const callerId = await callerUserId(req, supabaseUrl, anonKey);
    if (action === "claim" && callerId) {
      // 로그인된(소셜) 회원은 '기존 회원 연동'으로 합친다 — 앱이 link-imported-by-phone 을 부른다.
      return invalid("로그인된 상태에서는 '기존 회원 연동'으로 진행돼요. 화면을 새로 고친 뒤 다시 시도해 주세요.");
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const phoneHash = await hashOf("phone", phone);
    const ip = clientIp(req);
    const ipHash = ip ? await hashOf("ip", ipKey(ip)) : null;
    const record = async (result: string, userId: string | null = null) => {
      const { error } = await admin
        .from("member_claim_attempts")
        .insert({ phone_hash: phoneHash, ip_hash: ipHash, action, result, user_id: userId });
      if (error) console.error("member_claim_attempts insert failed:", error.message);
    };

    if (await isLocked(admin, phoneHash, ipHash)) {
      await record("locked");
      return json({ ok: false, status: "locked", error: MESSAGES.locked });
    }

    const ev = await evaluate(admin, phone, name, birth, callerId);

    if (action === "check") {
      await record(ev.status);
      if (ev.status === "new" || ev.status === "existing") return json({ ok: true, status: ev.status });
      return json({ ok: false, status: ev.status, error: MESSAGES[ev.status] });
    }

    // ── claim ──
    if (ev.status !== "existing" || !ev.target) {
      await record(ev.status);
      return json({ ok: false, status: ev.status, error: MESSAGES[ev.status as Exclude<Status, "existing">] });
    }
    const t = ev.target;

    // 1) 선점 — 아직 넘겨받지 않은 계정일 때만 표시를 내린다. 동시에 들어온 두 요청 중 하나만 통과한다.
    const { data: taken, error: takeErr } = await admin
      .from("profiles")
      .update({ must_change_credentials: false })
      .eq("user_id", t.user_id)
      .eq("must_change_credentials", true)
      .select("user_id");
    if (takeErr) throw takeErr;
    if (!taken || taken.length !== 1) {
      await record("registered");
      return json({ ok: false, status: "registered", error: MESSAGES.registered });
    }

    // 2) 아이디·비밀번호 적용 (가짜 이메일 {아이디}@153rankup.app — 로그인 화면과 같은 규칙)
    const newEmail = `${username}@153rankup.app`;
    const { error: upErr } = await admin.auth.admin.updateUserById(t.user_id, {
      email: newEmail,
      password,
      email_confirm: true,
    });
    if (upErr) {
      // 선점을 되돌린다 — 계정은 '아직 넘겨받지 않은' 상태 그대로 남는다.
      const { error: rbErr } = await admin
        .from("profiles")
        .update({ must_change_credentials: true })
        .eq("user_id", t.user_id);
      if (rbErr) console.error("claim rollback failed:", rbErr.message);
      const msg = upErr.message || "";
      if (/already|registered|exists|duplicate/i.test(msg)) {
        await record("username_taken");
        return json({ ok: false, status: "username_taken", error: "이미 사용 중인 아이디예요. 다른 아이디를 정해 주세요." });
      }
      if (/weak|password/i.test(msg)) {
        await record("weak_password");
        return json({ ok: false, status: "weak_password", error: "비밀번호가 너무 쉬워요. 더 길고 복잡하게 정해 주세요." });
      }
      console.error("claim updateUserById failed:", msg);
      return json({ ok: false, status: "error", error: "가입 처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요." }, 500);
    }

    // 3) 가입 정보 — 회원이 입력한 것만. 이름·전화·지점·등록일·수강권은 체육관(CRM) 값을 그대로 둔다.
    const patch: Record<string, unknown> = {
      email: newEmail,
      nickname,
      signup_agreements: agreements,
      signup_agreed_at: new Date().toISOString(),
    };
    if (body.gender === "남" || body.gender === "여") patch.gender = body.gender;
    const goal = String(body.fitnessGoal ?? "").trim().slice(0, 200);
    if (goal) patch.fitness_goal = goal;
    const health = String(body.healthNotes ?? "").trim().slice(0, 2000);
    if (health) patch.health_notes = health;
    // 생년월일이 비어 있던 회원은 지금 입력한 값을 남긴다 — 다음부터 비밀번호 찾기(본인 확인)가 된다.
    if (!onlyDigits(t.birth_date)) patch.birth_date = `${birth.slice(0, 4)}-${birth.slice(4, 6)}-${birth.slice(6, 8)}`;
    const { error: pErr } = await admin.from("profiles").update(patch).eq("user_id", t.user_id);
    // 계정 넘겨받기는 끝났다 — 부가 정보 저장이 실패해도 가입은 유효하다(기록만 남긴다).
    if (pErr) console.error("claim profile patch failed:", pErr.message);

    await record("claimed", t.user_id);
    const membershipActive = !!t.membership_end && String(t.membership_end).slice(0, 10) >= kstToday();
    return json({ ok: true, status: "claimed", membershipActive });
  } catch (e) {
    console.error("claim-member-account error:", e instanceof Error ? e.message : e);
    return json({ ok: false, status: "error", error: "처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요." }, 500);
  }
});
