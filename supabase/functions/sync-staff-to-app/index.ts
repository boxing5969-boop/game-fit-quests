// 153OS 지도진 명단(staff_work_profiles) → 마이복서153 지도진 표기 동기화 (크론 전용, 2026-09-23).
//
// 대표님 지시: "코치님들은 모두 코치님들 동일하게 — 모든 코치님 정보는 153OS 에 있다."
// 153OS 에서 활성(active) 지도진으로 등록된 사람은 앱에서 전화번호(숫자만)로 계정을 찾아
//   · profiles.is_staff = true
//   · profiles.staff_title = 직함 (비어 있을 때만: coach→코치, manager→지점장)
//   · profiles.membership_end = null (지도진 이용권은 무제한 — 화면은 "무제한")
//   · profiles.staff_source = '153os' (출처 기록 — 앱 지도진 관리 화면이 "153OS 명단" 배지로 보여준다)
// 으로 맞춘다. 153OS 활성 명단에 없는 '153os' 출처 지도진은 is_staff 를 내린다 — 비활성으로 바꾼 경우와
// 명단에서 지웠거나 번호를 바꾼 경우 모두 (2026-09-23 검수 v3: 예전엔 '비활성' 만 해제해 삭제·번호 변경 시 영구 지도진).
// 관리자가 앱에서 직접 지정한 'manual' 지도진은 건드리지 않는다.
// 안전장치: 명단 조회 실패·활성 0명이면 해제 전부 보류, 번호 형식 오류가 있거나 한 번에 너무 많이(지도진의 30% 초과,
// 최소 2명) 빠지면 '명단에서 사라진' 쪽 해제만 보류하고 보고한다(명단 일시 오류로 코치님이 한꺼번에 풀리지 않게).
// 앱 계정이 없는 지도진은 보고만 한다(이름 첫 글자·번호 끝 4자리만 남긴다).
// 전화번호는 숫자만 + 국가번호 82 로 시작하면 0 으로 바꿔 비교한다(+82 10-… → 010…).
//
// 흐름: pg_cron(sync-staff-to-app, 매시 25분) → 이 함수. 인증은 auto-sync-members 와 같은
// x-auto-key(internal_sync_config.auto_sync_key). verify_jwt=false 필수(config.toml).
// 이력: member_sync_runs(mode='staff-sync'). body {dry_run:true} 면 쓰지 않고 결과만 돌려준다.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-auto-key",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const onlyDigits = (s: unknown) => String(s ?? "").replace(/[^0-9]/g, "");
// +82 10-1234-5678 → 01012345678 (앱은 숫자만, 0 으로 시작하는 국내 번호로 저장한다)
const normPhone = (s: unknown) => {
  const d = onlyDigits(s);
  return d.startsWith("82") && d.length >= 11 ? `0${d.slice(2)}` : d;
};
// 보고용 마스킹 — 이름 첫 글자 + 번호 끝 4자리만.
const mask = (name: unknown, phone: string) => `${String(name ?? "").trim().slice(0, 1) || "?"}OO(…${phone.slice(-4)})`;

// 153OS role_kind → 앱 직함. 화면은 honorTitle 이 "님" 을 붙인다(코치 → 코치님).
const TITLE: Record<string, string> = { coach: "코치", manager: "지점장", owner: "관장" };

type RosterRow = { id: string; person_name: string | null; person_phone: string | null; role_kind: string | null; active: boolean | null };
type AppProfile = {
  user_id: string; phone_number: string | null; is_staff: boolean | null; staff_title: string | null;
  membership_end: string | null; staff_source: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const startedAt = Date.now();
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const OS_URL = Deno.env.get("OS_SUPABASE_URL") || "https://tbxdrfowanyksgdicryl.supabase.co";
  const OS_KEY = Deno.env.get("OS_SERVICE_KEY") || "";
  const app = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    // 1) 내부 키 검증 (auto-sync-members 와 동일)
    const provided = req.headers.get("x-auto-key") || "";
    const { data: cfg } = await app.from("internal_sync_config").select("value").eq("key", "auto_sync_key").maybeSingle();
    if (!cfg?.value || provided !== cfg.value) return json({ error: "unauthorized" }, 401);
    if (!OS_KEY) return json({ error: "OS_SERVICE_KEY 미설정" }, 503);

    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run === true;
    const os = createClient(OS_URL, OS_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

    // 2) 153OS 지도진 명단 전체(활성·비활성)
    const { data: rosterRaw, error: rErr } = await os
      .from("staff_work_profiles").select("id, person_name, person_phone, role_kind, active");
    if (rErr) return json({ error: "OS 조회 실패: " + rErr.message }, 502);
    const roster = (rosterRaw || []) as RosterRow[];

    // 전화번호별로 합친다. 같은 사람이 두 지점에 있으면 활성 하나라도 있으면 활성, 지점장이 코치보다 우선.
    const active = new Map<string, RosterRow>();
    const inactive = new Map<string, RosterRow>();
    const badPhone: string[] = [];
    for (const r of roster) {
      const phone = normPhone(r.person_phone);
      if (phone.length < 10) { badPhone.push(mask(r.person_name, phone)); continue; }
      if (r.active === true) {
        if (!active.has(phone) || r.role_kind === "manager") active.set(phone, r);
      } else if (!inactive.has(phone)) {
        inactive.set(phone, r);
      }
    }
    for (const phone of active.keys()) inactive.delete(phone);

    // 3) 앱 계정 찾기 — 앱도 전화번호를 숫자만 저장한다(bulk-import·sync-members-to-app 규칙).
    const phones = [...active.keys(), ...inactive.keys()];
    let profs: AppProfile[] = [];
    if (phones.length) {
      const { data, error: pErr } = await app
        .from("profiles").select("user_id, phone_number, is_staff, staff_title, membership_end, staff_source").in("phone_number", phones);
      if (pErr) return json({ error: "앱 조회 실패: " + pErr.message }, 502);
      profs = (data || []) as AppProfile[];
    }
    const byPhone = new Map<string, AppProfile>();
    for (const p of profs) byPhone.set(String(p.phone_number ?? ""), p);

    // 4) 활성 지도진 → is_staff · 직함 · 무제한
    let flagged = 0, updated = 0, unflagged = 0;
    const unmatched: string[] = [];
    const failed: string[] = [];
    for (const [phone, r] of active) {
      const p = byPhone.get(phone);
      if (!p) { unmatched.push(mask(r.person_name, phone)); continue; }
      const patch: Record<string, unknown> = {};
      if (p.is_staff !== true) patch.is_staff = true;
      if (!String(p.staff_title ?? "").trim()) patch.staff_title = TITLE[String(r.role_kind ?? "")] ?? "코치";
      if (p.membership_end !== null) patch.membership_end = null;
      // 명단에 있는 사람은 출처가 153OS — 수동('manual')으로 지정돼 있었어도 명단이 우선한다.
      if (p.staff_source !== "153os") patch.staff_source = "153os";
      if (Object.keys(patch).length === 0) continue;
      if (!dryRun) {
        const { error } = await app.from("profiles").update(patch).eq("user_id", p.user_id);
        if (error) { failed.push(`${mask(r.person_name, phone)}: ${error.message}`); continue; }
      }
      if (patch.is_staff) flagged++; else updated++;
    }

    // 5) 활성 명단에 없는 '153os' 지도진 → is_staff 내림. 앱에서 직접 지정한('manual') 지도진은 그대로.
    //    이용권은 건드리지 않는다(다시 회원이면 CRM 동기화가 채운다).
    //    (a) 명단에 '비활성'으로 남은 사람 (b) 명단에서 지웠거나 번호가 바뀐 사람 — 둘 다 해제하되 (b) 는 안전장치를 건다.
    const { data: osStaffRaw, error: sErr } = await app
      .from("profiles").select("user_id, phone_number, is_staff, staff_title, membership_end, staff_source")
      .eq("is_staff", true).eq("staff_source", "153os");
    if (sErr) return json({ error: "앱 지도진 조회 실패: " + sErr.message }, 502);
    const osStaff = (osStaffRaw || []) as AppProfile[];
    const toInactive: { p: AppProfile; label: string }[] = [];
    const toAbsent: { p: AppProfile; label: string }[] = [];
    for (const p of osStaff) {
      const phone = normPhone(p.phone_number);
      if (active.has(phone)) continue;
      const r = inactive.get(phone);
      if (r) toInactive.push({ p, label: mask(r.person_name, phone) });
      else toAbsent.push({ p, label: `?OO(…${phone.slice(-4)})` });
    }
    const absentCap = Math.max(2, Math.ceil(osStaff.length * 0.3));
    let held = "";
    let toUnflag: { p: AppProfile; label: string }[] = [];
    if (active.size === 0) {
      held = `활성 명단 0명 — 해제 ${toInactive.length + toAbsent.length}명 보류`;
    } else if (toAbsent.length && (badPhone.length > 0 || toAbsent.length > absentCap)) {
      held = `명단에서 사라진 지도진 ${toAbsent.length}명 해제 보류(${badPhone.length > 0 ? "번호 형식 오류 있음" : `한 번에 ${absentCap}명 초과`}): ${toAbsent.map((x) => x.label).join(", ")}`;
      toUnflag = toInactive;
    } else {
      toUnflag = [...toInactive, ...toAbsent];
    }
    for (const { p, label } of toUnflag) {
      if (!dryRun) {
        const { error } = await app.from("profiles").update({ is_staff: false, staff_title: null, staff_source: null }).eq("user_id", p.user_id);
        if (error) { failed.push(`${label}: ${error.message}`); continue; }
      }
      unflagged++;
    }

    const ok = failed.length === 0;
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    const note = [
      `활성 ${active.size}명 · 신규지정 ${flagged} · 갱신 ${updated} · 해제 ${unflagged}`,
      unmatched.length ? `앱 계정 없음 ${unmatched.length}명: ${unmatched.join(", ")}` : null,
      badPhone.length ? `번호 형식 오류 ${badPhone.length}명: ${badPhone.join(", ")}` : null,
      held || null,
      `${elapsed}초${dryRun ? " (dry-run)" : ""}`,
    ].filter(Boolean).join(" / ");

    if (!dryRun) {
      await app.from("member_sync_runs").insert({
        mode: "staff-sync", ok, scanned: roster.length, updated: flagged + updated + unflagged,
        failed: failed.length, error: failed.length ? failed.join(" | ").slice(0, 500) : null, note: note.slice(0, 500),
      });
    }
    return json({ ok, dry_run: dryRun, active: active.size, flagged, updated, unflagged, held: held || null, unmatched, bad_phone: badPhone, failed, note }, ok ? 200 : 502);
  } catch (e) {
    console.error("sync-staff-to-app error:", e);
    await app.from("member_sync_runs")
      .insert({ mode: "staff-sync", ok: false, error: (e instanceof Error ? e.message : String(e)).slice(0, 500) })
      .then(() => undefined, () => undefined);
    return json({ error: "처리 중 오류가 발생했습니다." }, 500);
  }
});
