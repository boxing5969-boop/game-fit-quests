// 지도자 홈 — 신규 재등록률 다시 계산 + 코치용 사진 정리 (2026-11-26 대표님 「추천대로 가자」 · 마이그레이션 20261126122904_leader_home.sql)
//
//   부르는 길 두 가지
//   1) 크론 leader-kpi 매일 05:12 KST — x-auto-key(internal_sync_config.auto_sync_key). 켠 지점 모두 다시 계산 + 사진 정리.
//   2) 지도자 홈 화면 — 로그인한 코치 · 관장 · 본사(Bearer). 숫자가 오래됐을 때(kpi_stale_hours) 화면이 부른다.
//      30분 안에 계산한 숫자가 있으면 다시 계산하지 않는다. 본사는 body.branch 로 지점을 고를 수 있다.
//   계산: 153OS registration_report(서버 키 OS_SERVICE_KEY — 서버에만)를 100일씩 네 번 읽어(한 번에 3,000줄 한도)
//         _shared/leaderKpi.ts 로 재등록률을 낸다 → leader_kpi(숫자만) · leader_member_flags(「첫 수강권」 — 같은 이름이 하나뿐인 회원만).
//   사진 정리: leader_photo_cleanup_targets → 저장소 coach-photos 에서 지우기(SQL 로는 못 지운다) → leader_photo_mark_purged.
//   관장님 숫자(2026-11-26 대표님 「추천대로」 · docs/features/69 · 마이그레이션 20261126234059_owner_home.sql):
//     · 재등록률(전체) = 같은 줄로 computeAllRenew → leader_kpi.payload.all
//     · 출석 · 유효 회원 · 매출 · 할 일 = 153OS owner_home_kpi(지점 이름) → leader_owner_kpi(지금) · leader_owner_kpi_days(오늘 날짜)
//     · 크론은 둘 다 · 화면은 body.owner = true 일 때 관장님 숫자만(관장 · 지점장 · 본사 — 코치는 못 부른다 · 10분 안 계산은 건너뜀)
//   verify_jwt = false (config.toml) — 크론 키 또는 아래에서 직접 로그인 확인.
// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { addDays, computeAllRenew, computeLeaderKpi, matchMembers, type RegRow } from "../_shared/leaderKpi.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-auto-key",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const BUCKET = "coach-photos";
const FRESH_MINUTES = 30;
const OWNER_FRESH_MINUTES = 10;
const WINDOWS = 4;
const WINDOW_DAYS = 100;

const kstToday = (): string => new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);

async function readRegistrations(os: SupabaseClient, today: string): Promise<{ rows: RegRow[]; truncated: boolean }> {
  const rows: RegRow[] = [];
  let truncated = false;
  for (let i = WINDOWS - 1; i >= 0; i--) {
    const to = addDays(today, -i * WINDOW_DAYS);
    const from = addDays(to, -(WINDOW_DAYS - 1));
    const { data, error } = await os.rpc("registration_report", { p_from: from, p_to: to });
    if (error) throw new Error(`registration_report ${from}~${to}: ${error.message}`);
    for (const r of (data?.rows ?? []) as any[]) {
      rows.push({
        day: String(r.day ?? ""),
        branch: String(r.branch ?? ""),
        member: r.member ?? null,
        product: r.product ?? null,
        amount: r.amount ?? null,
        kind: String(r.kind ?? ""),
      });
    }
    if (data?.truncated) truncated = true;
  }
  return { rows, truncated };
}

async function refreshBranch(app: SupabaseClient, rows: RegRow[], branch: string, today: string, truncated: boolean) {
  const { kpi, members } = computeLeaderKpi(rows, branch, today);
  const runStart = new Date().toISOString();

  // 「첫 수강권」 표시 — 같은 지점 · 같은 이름이 하나뿐인 앱 회원만
  const { data: profiles, error: pErr } = await app
    .from("profiles")
    .select("user_id, name")
    .eq("branch_name", branch)
    .is("merged_into", null);
  if (pErr) throw new Error(`profiles: ${pErr.message}`);
  const matched = matchMembers(members, (profiles ?? []) as { user_id: string; name: string | null }[]);
  const flagRows = matched.map(({ userId, member }) => ({
    user_id: userId,
    branch_name: branch,
    first_term: member.firstTerm,
    paid_count: member.paidCount,
    first_paid_on: member.firstPaid,
    last_paid_on: member.lastPaid,
    updated_at: runStart,
  }));
  for (let i = 0; i < flagRows.length; i += 500) {
    const { error } = await app.from("leader_member_flags").upsert(flagRows.slice(i, i + 500), { onConflict: "user_id" });
    if (error) throw new Error(`flags: ${error.message}`);
  }
  await app.from("leader_member_flags").delete().eq("branch_name", branch).lt("updated_at", runStart);

  const all = computeAllRenew(rows, branch, today);
  const payload = { ...kpi, all, source: "153OS registration_report", truncated, matched: matched.length, members: members.length };
  const { error: kErr } = await app
    .from("leader_kpi")
    .upsert({ branch_name: branch, payload, computed_at: new Date().toISOString() }, { onConflict: "branch_name" });
  if (kErr) throw new Error(`kpi: ${kErr.message}`);
  return { branch, rate: kpi.recent.rate, n: kpi.recent.n, matched: matched.length, allRate: all.prev.rate };
}

/** 관장님 숫자 — 153OS owner_home_kpi(숫자만) → leader_owner_kpi · leader_owner_kpi_days */
async function refreshOwner(app: SupabaseClient, os: SupabaseClient, branch: string, today: string) {
  const { data, error } = await os.rpc("owner_home_kpi", { p_branch_name: branch, p_day: today });
  if (error) throw new Error(`owner_home_kpi ${branch}: ${error.message}`);
  if (!data || typeof data !== "object" || (data as any).error) throw new Error(`owner_home_kpi ${branch}: ${(data as any)?.error ?? "empty"}`);
  const at = new Date().toISOString();
  const { error: oErr } = await app
    .from("leader_owner_kpi")
    .upsert({ branch_name: branch, payload: data, computed_at: at }, { onConflict: "branch_name" });
  if (oErr) throw new Error(`owner: ${oErr.message}`);
  const { error: dErr } = await app
    .from("leader_owner_kpi_days")
    .upsert({ branch_name: branch, day: today, payload: data, computed_at: at }, { onConflict: "branch_name,day" });
  if (dErr) throw new Error(`owner_days: ${dErr.message}`);
  const att = (data as any).attendance ?? {};
  return { branch, owner: true, active: (data as any).members?.active ?? null, attRate: att.rate ?? null };
}

async function cleanupPhotos(app: SupabaseClient) {
  const { data, error } = await app.rpc("leader_photo_cleanup_targets", { _limit: 200 });
  if (error) return { error: error.message };
  const targets = (data ?? []) as { user_id: string; path: string; reason: string }[];
  if (targets.length === 0) return { found: 0 };
  const paths = [...new Set(targets.map((t) => t.path).filter(Boolean))];
  const { error: rmErr } = await app.storage.from(BUCKET).remove(paths);
  if (rmErr) return { found: targets.length, error: rmErr.message };
  const { data: marked } = await app.rpc("leader_photo_mark_purged", { _user_ids: targets.map((t) => t.user_id) });
  return { found: targets.length, marked: marked ?? 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const OS_URL = Deno.env.get("OS_SUPABASE_URL") || "https://tbxdrfowanyksgdicryl.supabase.co";
  const OS_KEY = Deno.env.get("OS_SERVICE_KEY") || "";
  if (!OS_KEY) return json({ error: "os_not_configured" }, 500);
  const app = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
  const body: any = await req.json().catch(() => ({}));

  const { data: setting } = await app.from("app_settings").select("value").eq("key", "leader_home").maybeSingle();
  const onBranches: string[] = Array.isArray(setting?.value?.branches) ? setting.value.branches.map(String) : [];
  const ownerBranches: string[] = (Array.isArray(setting?.value?.owner_branches) ? setting.value.owner_branches.map(String) : onBranches)
    .filter((b: string) => onBranches.includes(b));

  // 1) 크론
  const autoKey = req.headers.get("x-auto-key") || "";
  let cron = false;
  if (autoKey) {
    const { data: cfg } = await app.from("internal_sync_config").select("value").eq("key", "auto_sync_key").maybeSingle();
    if (!cfg?.value || autoKey !== cfg.value) return json({ error: "forbidden" }, 403);
    cron = true;
  }

  let targets: string[] = [];
  let ownerTargets: string[] = [];
  if (cron) {
    targets = onBranches;
    ownerTargets = ownerBranches;
  } else {
    // 2) 화면 — 로그인한 지도진 · 본사만, 자기 지점(본사는 고른 지점)
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "not_authenticated" }, 401);
    const { data: who, error: whoErr } = await app.auth.getUser(token);
    if (whoErr || !who?.user) return json({ error: "not_authenticated" }, 401);
    const uid = who.user.id;
    const [{ data: roles }, { data: me }] = await Promise.all([
      app.from("user_roles").select("role").eq("user_id", uid),
      app.from("profiles").select("branch_name, is_staff, is_test_account").eq("user_id", uid).maybeSingle(),
    ]);
    const roleSet = new Set(((roles ?? []) as { role: string }[]).map((r) => String(r.role)));
    const hq = roleSet.has("super_admin") || roleSet.has("admin");
    const staff = roleSet.has("coach") || roleSet.has("branch_manager") || (me?.is_staff === true && me?.is_test_account !== true);
    if (!hq && !staff) return json({ error: "forbidden" }, 403);
    const branch = hq && typeof body?.branch === "string" && body.branch.trim() ? body.branch.trim() : String(me?.branch_name ?? "");
    if (!branch || !onBranches.includes(branch)) return json({ ok: true, skipped: "branch_off" });
    if (body?.owner === true) {
      // 관장님 숫자 — 관장(지점장) · 본사만
      if (!hq && !roleSet.has("branch_manager")) return json({ error: "forbidden" }, 403);
      if (!ownerBranches.includes(branch)) return json({ ok: true, skipped: "owner_off", branch });
      const { data: prevOwner } = await app.from("leader_owner_kpi").select("computed_at").eq("branch_name", branch).maybeSingle();
      const ownerFresh = prevOwner?.computed_at && Date.now() - Date.parse(prevOwner.computed_at) < OWNER_FRESH_MINUTES * 60_000;
      if (ownerFresh && !(hq && body?.force === true)) return json({ ok: true, skipped: "fresh", branch, owner: true });
      ownerTargets = [branch];
    } else {
      const { data: prev } = await app.from("leader_kpi").select("computed_at").eq("branch_name", branch).maybeSingle();
      const fresh = prev?.computed_at && Date.now() - Date.parse(prev.computed_at) < FRESH_MINUTES * 60_000;
      if (fresh && !(hq && body?.force === true)) return json({ ok: true, skipped: "fresh", branch });
      targets = [branch];
    }
  }

  const today = kstToday();
  const results: unknown[] = [];
  if (targets.length > 0 || ownerTargets.length > 0) {
    const os = createClient(OS_URL, OS_KEY, { auth: { persistSession: false } });
    if (targets.length > 0) {
      try {
        const { rows, truncated } = await readRegistrations(os, today);
        for (const b of targets) results.push(await refreshBranch(app, rows, b, today, truncated));
      } catch (e) {
        console.error("leader-kpi", (e as Error).message);
        if (!cron) return json({ error: "kpi_failed", detail: (e as Error).message }, 502);
        results.push({ error: "kpi_failed", detail: (e as Error).message });
      }
    }
    for (const b of ownerTargets) {
      try {
        results.push(await refreshOwner(app, os, b, today));
      } catch (e) {
        console.error("leader-kpi owner", (e as Error).message);
        if (!cron) return json({ error: "owner_failed", detail: (e as Error).message }, 502);
        results.push({ branch: b, error: "owner_failed", detail: (e as Error).message });
      }
    }
  }
  const photos = cron ? await cleanupPhotos(app) : null;
  return json({ ok: true, cron, today, results, photos });
});
