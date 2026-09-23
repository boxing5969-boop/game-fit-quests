// 153OS members → 마이복서153(myboxer153) 회원 계정 자동 동기화.
// bulk-import-members 로직 재사용: 전화번호 기준 계정 생성/갱신 + members.ranking_app_user_id 되기록.
// 트리거: 153OS DB 웹훅(members) 또는 수동 pg_net 호출. SYNC_KEY 헤더로 인증(verify_jwt=false).
//
// 2026-08-07 수정 — 링크 실패를 조용히 삼키던 문제 해결.
//   기존: `if (!linkErr) linked++;` 만 있어서 링크가 실패해도 failed 에 안 담겼다.
//   그 결과 member_sync_runs 에 ok:true / failed:0 으로 191회 연속 "성공" 기록되는 동안
//   같은 회원 9명이 매 실행마다 실패하고 있었다(원인: uq_members_ranking_app_user 유니크 위반).
//   이제 링크 실패는 사유와 함께 failed 에 담긴다.
//
// 2026-09-17 수정 (3건) —
//   ① offset 지원: full-refresh 가 limit 1000 에 막혀 일부만 계속 갱신하고
//      나머지는 한 번도 갱신되지 않았다. offset 으로 전 회원을 순회한다.
//   ② 정렬키에 id 추가: 회원 3,341명 중 3,235명이 created_at 동률이다
//      (한 번에 2,000명 일괄등록). created_at 만으로 정렬하면 동률 구간의 순서가
//      실행마다 달라져 페이지 경계에서 누군 두 번 처리되고 누군 빠졌다.
//      id 를 2차 정렬키로 넣어 순서를 고정한다.
//   ③ 중복 링크 9건 분류: 그중 7건은 '같은 사람이 두 지점에 등록'된 정상 상황인데도
//      매 실행 실패로 기록돼 24시간 49/49 실행이 전부 실패로 보였다.
//      이제 앱 계정을 이미 보유한 회원 행의 이름을 확인해서
//      - 같은 이름  → 다지점 등록(정상). dup_skipped 로 세고 실패로 남기지 않는다.
//      - 다른 이름  → 전화번호가 잘못 등록된 실제 데이터 오류. 사람이 고쳐야 하므로 failed 에 남긴다.
//
// 2026-09-23 수정 — 지도진(profiles.is_staff) 계정에는 수강권·결제 정보를 쓰지 않는다.
//   코치님도 CRM 에 회원으로 등록돼 있으면(옛 회원권) 이 동기화가 만료된 membership_end 를
//   계속 되살려 "만료 D+62" 로 보였다. 지도진 이용권은 무제한(sync-staff-to-app 가 관리).
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-key",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const onlyDigits = (s: unknown) => String(s ?? "").replace(/[^0-9]/g, "");
// 이름 비교용 정규화 — 공백/괄호 표기 차이로 동일인을 남으로 오판하지 않게 한다.
const normName = (s: unknown) => String(s ?? "").replace(/\s+/g, "").trim();
function toISODate(v: unknown): string | null {
  if (v === null || v === undefined || v === "" || v === "-") return null;
  const s = String(v).trim();
  const m = s.match(/([0-9]{4})[^0-9]+([0-9]{1,2})[^0-9]+([0-9]{1,2})/);
  if (m) { const [, y, mo, d] = m; return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`; }
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return null;
}

// 지점명 매핑 — 153OS ↔ 앱 이름 불일치 보정(선릉점 = 선릉역점 동일 지점).
const BRANCH_MAP: Record<string, string> = { "153복싱짐 선릉점": "153복싱짐 선릉역점" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OS_URL = Deno.env.get("OS_SUPABASE_URL") || "https://tbxdrfowanyksgdicryl.supabase.co";
    const OS_KEY = Deno.env.get("OS_SERVICE_KEY") || "";
    const SYNC_KEY = Deno.env.get("SYNC_KEY") || "";

    const provided = req.headers.get("x-sync-key") || "";
    if (!SYNC_KEY || provided !== SYNC_KEY) return json({ error: "unauthorized" }, 401);
    if (!OS_KEY) return json({ error: "OS_SERVICE_KEY 미설정" }, 503);

    const app = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
    const os = createClient(OS_URL, OS_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

    const body = await req.json().catch(() => ({}));
    const rec = body?.record && typeof body.record === "object" ? body.record : null;
    const memberId = rec?.id ? String(rec.id) : (body?.member_id ? String(body.member_id) : null);
    const force = body?.force === true;
    const limit = Number(body?.limit) > 0 ? Math.min(1000, Number(body.limit)) : 500;
    // 전 회원 순회용 시작점. 호출자(auto-sync-members)가 커서를 들고 페이지를 넘긴다.
    const offset = Number.isFinite(Number(body?.offset)) && Number(body.offset) > 0 ? Math.floor(Number(body.offset)) : 0;

    let q = os.from("v_members_for_app_sync").select("*");
    if (memberId) q = q.eq("id", memberId);
    else {
      if (!force) q = q.is("ranking_app_user_id", null);
      // id 2차 정렬 필수 — created_at 동률이 많아 정렬이 불안정하면
      // 페이지 경계에서 회원이 누락된다.
      q = q.order("created_at", { ascending: true }).order("id", { ascending: true })
           .range(offset, offset + limit - 1);
    }
    const { data: rows, error: rErr } = await q;
    if (rErr) return json({ error: "OS 조회 실패: " + rErr.message }, 502);
    const members = (rows || []) as Array<Record<string, unknown>>;

    let created = 0, updated = 0, linked = 0, dupSkipped = 0;
    const failed: Array<{ member_id?: string; name: string; phone: string; reason: string }> = [];

    for (const m of members) {
      const name = String(m.name ?? "").trim();
      const phone = onlyDigits(m.phone);
      const branchRaw = String(m.branch_name ?? "").trim();
      const branch = BRANCH_MAP[branchRaw] || branchRaw;
      if (phone.length < 10) { failed.push({ member_id: String(m.id), name, phone, reason: "전화번호 형식 오류" }); continue; }

      // CRM 이 모르는 값을 null 로 덮어쓰지 않는다.
      // 예전에는 membership_end·payment_total 을 무조건 써 넣어서, 결제 콜백이 방금 연장한
      // 값을 30분 뒤 동기화가 지워 버렸다. 2026-09-18 첫 실결제에서 실제로 누적결제액
      // 220,000원이 이렇게 사라졌고, 수강권 만료일도 같은 방식으로 되돌아갈 수 있었다.
      // CRM 이 아는 값이 있을 때만 반영하고, 없으면 앱 값을 그대로 둔다.
      const billing: Record<string, unknown> = {};
      const msEnd = toISODate(m.membership_end);
      if (msEnd) billing.membership_end = msEnd;
      const cumulative = onlyDigits(m.cumulative_payment);
      if (cumulative) billing.payment_total = Number(cumulative);

      const { data: dup } = await app.from("profiles").select("user_id, is_staff").eq("phone_number", phone).maybeSingle();
      let appUserId: string | null = null;

      if (dup) {
        // 반영할 값이 하나도 없으면 쓰기 자체를 건너뛴다(빈 update 로 updated_at 만 흔들지 않는다).
        // 지도진 계정은 수강권·결제를 CRM 회원권으로 덮지 않는다(무제한).
        if (Object.keys(billing).length > 0 && dup.is_staff !== true) {
          await app.from("profiles").update(billing).eq("user_id", dup.user_id);
        }
        appUserId = dup.user_id as string;
        updated++;
      } else {
        const email = `${phone}@153rankup.app`;
        const { data: cu, error: cErr } = await app.auth.admin.createUser({
          email, password: phone, email_confirm: true,
          user_metadata: { name, nickname: name || phone, phone_number: phone, branch_name: branch, birth_date: toISODate(m.birth_date), gender: m.gender ?? null },
        });
        if (cErr || !cu?.user) { failed.push({ member_id: String(m.id), name, phone, reason: cErr?.message || "계정 생성 실패" }); continue; }
        appUserId = cu.user.id;
        const { error: upErr } = await app.from("profiles").update({ ...billing, is_approved: true, must_change_credentials: true, gym_reg_date: toISODate(m.created_at) }).eq("user_id", appUserId);
        if (upErr) { failed.push({ member_id: String(m.id), name, phone, reason: "프로필 업데이트 실패" }); continue; }
        created++;
      }

      if (appUserId && m.ranking_app_user_id !== appUserId) {
        // 앱 계정 1개는 회원 행 1개에만 연결된다(uq_members_ranking_app_user).
        // 이미 다른 행이 들고 있으면 유니크 위반이 나므로, 시도 전에 누가 들고 있는지부터 본다.
        const { data: holder } = await os
          .from("members").select("id, name, branch_id")
          .eq("ranking_app_user_id", appUserId).maybeSingle();

        if (holder && String(holder.id) !== String(m.id)) {
          if (normName(holder.name) === normName(name)) {
            // 같은 사람이 두 지점에 등록된 정상 상황. 앱 계정은 하나면 충분하다.
            // 회원권·결제 정보는 위에서 이미 갱신했으므로 링크만 건너뛴다.
            dupSkipped++;
          } else {
            // 서로 다른 사람이 같은 번호를 쓰고 있다 = 실제 데이터 오류. 사람이 고쳐야 한다.
            failed.push({
              member_id: String(m.id), name, phone,
              reason: `전화번호 데이터 오류: 같은 번호(${phone})를 '${String(holder.name ?? "?")}' 회원이 이미 사용 중 — 둘 중 한 명의 번호를 수정해야 합니다`,
            });
          }
          continue;
        }

        const { error: linkErr } = await os.from("members").update({ ranking_app_user_id: appUserId }).eq("id", m.id as string);
        if (linkErr) {
          const dupLink = /duplicate key|unique constraint|23505/i.test(linkErr.message || "");
          failed.push({
            member_id: String(m.id),
            name,
            phone,
            reason: dupLink
              ? `링크 실패(중복): 같은 앱 계정이 이미 다른 회원 행에 연결됨 — ${linkErr.message}`
              : `링크 실패: ${linkErr.message}`,
          });
        } else {
          linked++;
        }
      }
    }

    // ok 는 "실행이 끝났는가" 의미로 유지한다(DB 웹훅 등 다른 호출자의 계약을 깨지 않기 위함).
    // 실패 판정은 failed 배열을 보고 호출자(auto-sync-members)가 내린다.
    // dup_skipped 는 정상 상황이므로 실패가 아니다. next_offset 은 호출자가 커서를 넘길 때 쓴다.
    return json({
      ok: true, scanned: members.length, created, updated, linked,
      dup_skipped: dupSkipped, offset, limit,
      next_offset: members.length < limit ? null : offset + members.length,
      failed,
    });
  } catch (e) {
    console.error("sync-members-to-app error:", e);
    return json({ error: "처리 중 오류가 발생했습니다." }, 500);
  }
});
