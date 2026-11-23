import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyLinkTicket } from "../_shared/linkTicket.ts";
import { DESK_MESSAGE, checkTarget, checkTicket } from "./logic.ts";

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

// 소셜(구글/카카오) 회원이 「기록 찾기」로 확인한 기존 일괄등록 계정을 연동.
// 2026-11-23 보안 점검: 번호만으로는 합치지 않는다 — claim-member-account check(이름 · 번호 · 생년월일 · 잠금)가 준
//   이어받기 표(ticket)가 있어야 한다. 로그인한 상태에서 받은 표는 그 계정만 쓸 수 있고(c),
//   지도진 표시 계정 · 한 번이라도 로그인한 계정은 합치지 않는다(logic.ts).
// 2026-09-28: 예전에는 일괄등록 계정(A)의 지점·수강권만 복사하고 A 를 바로 삭제해서
//   레벨·XP·배지가 cascade 로 사라지고, 출석 기록은 고아가 되어 라이브보드에 같은 회원이
//   두 명(Lv.10 / Lv.1)으로 떴다. 이제는 merge_linked_account(DB 함수, 한 트랜잭션)가
//   A 의 모든 기록(출석·레벨·XP·젬·배지·알림…)과 전화번호를 소셜 계정(B)으로 옮긴 뒤에만 A 를 지운다.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: uErr } = await caller.auth.getUser();
    if (uErr || !user) return json({ error: "로그인이 필요합니다." }, 401);

    // 이어받기 표(ticket)만 받는다. 표가 없거나(옛 앱의 번호만 보내기) · 지났거나 · 다른 계정 것이면 200 으로 안내 문구를
    //   돌려준다 — 옛 앱도 문구를 그대로 보여 준다(400 이면 옛 앱은 '오류'만 띄운다).
    const reqBody = await req.json().catch(() => null);
    const hasTicket = reqBody?.ticket !== undefined && reqBody?.ticket !== null;
    const verified = hasTicket ? await verifyLinkTicket(serviceKey, reqBody.ticket) : undefined;
    const tc = checkTicket(hasTicket, verified, user.id);
    if (!tc.ok) {
      return json({ ticket_invalid: tc.reason !== "need_lookup", need_lookup: true, error: tc.message });
    }
    const phone = onlyDigits(tc.phone);
    const expectedFrom = tc.expectedFrom;

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 기존 일괄등록 계정(A) 조회
    const { data: a } = await admin
      .from("profiles")
      .select("user_id, branch_name, must_change_credentials, is_staff")
      .eq("phone_number", phone)
      .maybeSingle();

    if (!a) {
      return json({ matched: false, message: "해당 전화번호로 등록된 기존 계정이 없습니다. 관장님께 문의하거나 그대로 이용해주세요." });
    }
    if (a.user_id !== expectedFrom && a.user_id !== user.id) {
      return json({ ticket_invalid: true, need_lookup: true, error: "기록 정보가 바뀌었어요. 「기록 찾기」를 다시 해 주세요." });
    }
    if (a.user_id === user.id) {
      return json({ matched: true, ok: true, message: "이미 연동되어 있습니다." });
    }

    // 안전장치: 아직 본인이 넘겨받지 않은 '일괄등록 placeholder' 계정만 · 지도진 표시 계정 X · 로그인한 적 있는 계정 X.
    const { data: au, error: auErr } = await admin.auth.admin.getUserById(a.user_id);
    if (auErr && (auErr as { status?: number }).status !== 404) throw auErr;
    if (!au?.user) return json({ error: DESK_MESSAGE }); // 로그인 계정이 없는 프로필 — 데스크가 정리해야 한다(claim 과 같은 기준)
    const target = checkTarget(
      { user_id: a.user_id, must_change_credentials: a.must_change_credentials, is_staff: (a as { is_staff?: boolean | null }).is_staff ?? null },
      au?.user?.last_sign_in_at ?? null,
    );
    if (!target.ok) return json({ error: target.message });

    // 연동 창은 번호가 없는 소셜 가입자에게만 뜬다 — 이미 다른 번호가 있는 계정은 연동 대상이 아니다.
    const { data: me } = await admin
      .from("profiles")
      .select("phone_number")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!me) return json({ error: "프로필을 찾을 수 없습니다. 다시 로그인해 주세요." }, 400);
    if (me.phone_number && onlyDigits(me.phone_number) !== phone) {
      return json({ error: "이미 다른 전화번호가 등록된 계정입니다. 관장님께 문의해주세요." }, 400);
    }

    // 1) A → B 기록 병합 + 전화번호 이전 (DB 한 트랜잭션 — 실패하면 아무것도 바뀌지 않는다)
    const { data: merged, error: mErr } = await admin.rpc("merge_linked_account", {
      p_from: a.user_id,
      p_to: user.id,
      p_phone: phone,
    });
    if (mErr) {
      console.error("merge_linked_account failed:", mErr.message);
      return json({ error: "기존 기록을 옮기는 중 오류가 발생했습니다. 잠시 후 다시 시도하거나 관장님께 문의해주세요." }, 400);
    }

    // 2) 기록을 모두 옮긴 빈 A 계정 정리 (실패해도 연동은 완료 — 이력에 남긴다)
    const eventId = (merged as { event_id?: number } | null)?.event_id ?? null;
    const { error: delErr } = await admin.auth.admin.deleteUser(a.user_id);
    if (delErr) console.error("deleteUser(A) failed after merge:", delErr.message);
    if (eventId) {
      await admin
        .from("account_link_events")
        .update(delErr ? { note: "A 삭제 실패: " + delErr.message } : { from_deleted_at: new Date().toISOString() })
        .eq("id", eventId);
    }

    return json({ matched: true, ok: true, branch: a.branch_name });
  } catch (e) {
    console.error("link-imported-by-phone error:", e);
    return json({ error: "처리 중 오류가 발생했습니다. 다시 시도해주세요." }, 500);
  }
});
