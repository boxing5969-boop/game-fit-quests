// 칠금점 다짐의 락카 · 운동복 기간 + 락카 번호 → 마이복서153 (크론 전용, 2026-10-27).
//
// 대표님 보고서 「앱 결제 장바구니」 진행 순서 5번: "칠금점은 다짐의 락카 · 운동복 기간도 매일 밤 같이 옮깁니다".
// 칠금점은 앱 결제를 쓰지 않고(데스크 결제) 다짐매니저가 정본이다. 예약 작업 「칠금점 다짐 회원 동기화」(월~토 22:49 KST)가
// 다짐 회원 목록을 153OS 로 옮기면(dagym_members.products · member_snapshots '락커정보'), 이 함수가 153OS app_rental_ends()
// 를 서버 키로 읽어 앱 apply_rental_ends(지점, 줄들)로 profiles.locker_end · sportswear_end · locker_label 을 맞춘다.
//   · 다짐에 값이 있을 때만 바꾼다(없으면 그대로). 다른 지점 · 예전 계정 · 체험용 계정은 DB 함수가 건너뛴다.
//   · 153OS 가 0줄을 주면 아무것도 바꾸지 않는다(동기화가 비었을 때 지우지 않게).
//
// 흐름: pg_cron(sync-rental-ends, 매일 14:40 UTC = 23:40 KST) → 이 함수. 인증은 sync-pt-members 와 같은
// x-auto-key(internal_sync_config.auto_sync_key). verify_jwt=false 필수(config.toml).
// 이력: member_sync_runs(mode='rental-sync'). body {dry_run:true} 면 쓰지 않고 몇 줄인지만 돌려준다.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-auto-key",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

type RentalRow = { app_user_id: string; locker_end: string | null; sportswear_end: string | null; locker_no: string | null };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const OS_URL = Deno.env.get("OS_SUPABASE_URL") || "https://tbxdrfowanyksgdicryl.supabase.co";
  const OS_KEY = Deno.env.get("OS_SERVICE_KEY") || "";
  const app = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    // 1) 내부 키 검증 (sync-pt-members 와 동일)
    const provided = req.headers.get("x-auto-key") || "";
    const { data: cfg } = await app.from("internal_sync_config").select("value").eq("key", "auto_sync_key").maybeSingle();
    if (!cfg?.value || provided !== cfg.value) return json({ error: "unauthorized" }, 401);
    if (!OS_KEY) return json({ error: "OS_SERVICE_KEY 미설정" }, 503);

    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run === true;

    // 2) 153OS — 칠금 다짐 회원의 락카 · 운동복 끝나는 날 + 락카 번호 (앱 계정이 이어진 회원만)
    const os = createClient(OS_URL, OS_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await os.rpc("app_rental_ends");
    if (error) throw new Error(`153OS app_rental_ends: ${error.message}`);
    const branch = String((data as { branch?: string } | null)?.branch || "153복싱짐 칠금점");
    const syncedAt = (data as { synced_at?: string | null } | null)?.synced_at ?? null;
    const rows = (Array.isArray((data as { rows?: unknown } | null)?.rows) ? (data as { rows: RentalRow[] }).rows : [])
      .filter((r) => r && typeof r.app_user_id === "string");

    if (rows.length === 0) {
      if (!dryRun) {
        await app.from("member_sync_runs").insert({ mode: "rental-sync", ok: true, scanned: 0, updated: 0, note: `0줄 — 바꾸지 않음 (다짐 ${syncedAt ?? "-"})` });
      }
      return json({ ok: true, dry_run: dryRun, rows: 0, note: "153OS 가 0줄 — 바꾸지 않음", synced_at: syncedAt });
    }
    if (dryRun) {
      return json({
        ok: true, dry_run: true, branch, rows: rows.length, synced_at: syncedAt,
        locker_end: rows.filter((r) => r.locker_end).length,
        sportswear_end: rows.filter((r) => r.sportswear_end).length,
        locker_no: rows.filter((r) => r.locker_no).length,
      });
    }

    // 3) 앱 — 다짐 값이 있는 칸만 맞춘다 (DB 함수가 지점 · 예전 계정 · 체험용 계정을 거른다)
    const { data: res, error: aErr } = await app.rpc("apply_rental_ends", { p_branch: branch, p_rows: rows });
    if (aErr) throw new Error(`apply_rental_ends: ${aErr.message}`);
    const r = (res ?? {}) as { locker_end?: number; sportswear_end?: number; locker_no?: number };
    const updated = (r.locker_end ?? 0) + (r.sportswear_end ?? 0) + (r.locker_no ?? 0);
    const note = `${branch} · ${rows.length}줄 · 락카 ${r.locker_end ?? 0} · 운동복 ${r.sportswear_end ?? 0} · 락카 번호 ${r.locker_no ?? 0} · 다짐 ${syncedAt ?? "-"}`;
    await app.from("member_sync_runs").insert({ mode: "rental-sync", ok: true, scanned: rows.length, updated, note: note.slice(0, 500) });
    return json({ ok: true, branch, rows: rows.length, ...r, synced_at: syncedAt });
  } catch (e) {
    console.error("sync-rental-ends error:", e);
    await app.from("member_sync_runs")
      .insert({ mode: "rental-sync", ok: false, error: (e instanceof Error ? e.message : String(e)).slice(0, 500) })
      .then(() => undefined, () => undefined);
    return json({ error: "처리 중 오류가 발생했습니다." }, 500);
  }
});
