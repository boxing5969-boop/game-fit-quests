// 브로제이 출입 → 마이복서153 라이브보드 자동 표시.
//
// 흐름: pg_cron(10분) → 이 함수 → 153OS(CRM) attendance_logs 조회 → 앱 attendance_logs 기록
//
// 원칙 (절대 어기지 말 것):
//   - XP 를 지급하지 않는다. xp_granted=0, member_progress·xp_logs 를 건드리지 않는다.
//     XP 는 앱 QR 체크인(qr-checkin Edge Function)에서만 지급된다.
//   - 앱 계정을 새로 만들지 않는다. 전화번호로 못 찾으면 건너뛴다(unmatched 로 집계).
//   - source_ref 유니크(broj:<attendance_id>)로 재실행해도 중복되지 않는다.
//
// 인증: DB(internal_sync_config.auto_sync_key)에 저장된 내부 키를 x-auto-key 헤더로 검증.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-auto-key",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const onlyDigits = (s: unknown) => String(s ?? "").replace(/[^0-9]/g, "");

// 지점명 매핑 — 153OS ↔ 앱 이름 불일치 보정. sync-members-to-app 과 동일 규약.
const BRANCH_MAP: Record<string, string> = { "153복싱짐 선릉점": "153복싱짐 선릉역점" };

/** KST 기준 오늘(YYYY-MM-DD)에서 n일 전 */
function kstDate(offsetDays = 0): string {
  const t = new Date(Date.now() + 9 * 3600 * 1000 - offsetDays * 86400000);
  return t.toISOString().slice(0, 10);
}

/** 표시명 — branch_display_settings.display_name_mode 규약을 따른다 */
function displayName(mode: string, nickname: string | null, name: string | null): string {
  const nm = (name ?? "").trim();
  if (mode === "full_name") return nm || (nickname ?? "").trim();
  if (mode === "masked_name") {
    if (nm.length <= 1) return nm;
    if (nm.length === 2) return nm[0] + "*";
    return nm[0] + "*".repeat(nm.length - 2) + nm[nm.length - 1];
  }
  return (nickname ?? "").trim() || nm; // 기본: nickname
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const OS_URL = Deno.env.get("OS_SUPABASE_URL") || "https://tbxdrfowanyksgdicryl.supabase.co";
  const OS_KEY = Deno.env.get("OS_SERVICE_KEY") || "";

  const app = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    // 1) 내부 키 검증
    const provided = req.headers.get("x-auto-key") || "";
    const { data: cfg } = await app
      .from("internal_sync_config").select("value").eq("key", "auto_sync_key").maybeSingle();
    if (!cfg?.value || provided !== cfg.value) return json({ error: "unauthorized" }, 401);
    if (!OS_KEY) {
      await app.from("broj_checkin_runs").insert({ ok: false, error: "OS_SERVICE_KEY 미설정" });
      return json({ error: "OS_SERVICE_KEY 미설정" }, 503);
    }

    const body = await req.json().catch(() => ({}));
    const days = Number(body?.days) > 0 ? Math.min(30, Number(body.days)) : 1;
    const from = kstDate(days - 1);
    const to = kstDate(0);

    const os = createClient(OS_URL, OS_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

    // 2) CRM 출입 이력 조회 (지점명 필요 → branches 조인)
    const { data: osRows, error: osErr } = await os
      .from("attendance_logs")
      .select("broj_attendance_id, phone, member_name, attended_at, attend_date, branches!inner(name)")
      .gte("attend_date", from).lte("attend_date", to)
      .order("attended_at", { ascending: true })
      .limit(2000);
    if (osErr) {
      await app.from("broj_checkin_runs").insert({ ok: false, error: "OS 조회 실패: " + osErr.message });
      return json({ error: "OS 조회 실패" }, 502);
    }

    type OsRow = {
      broj_attendance_id: string; phone: string | null; member_name: string | null;
      attended_at: string; attend_date: string; branches: { name: string } | { name: string }[] | null;
    };
    const rows = (osRows || []) as unknown as OsRow[];
    const branchOf = (r: OsRow) => {
      const b = Array.isArray(r.branches) ? r.branches[0] : r.branches;
      const raw = (b?.name ?? "").trim();
      return BRANCH_MAP[raw] || raw;
    };

    if (rows.length === 0) {
      await app.from("broj_checkin_runs").insert({ ok: true, scanned: 0 });
      return json({ ok: true, from, to, scanned: 0, inserted: 0, skipped: 0, unmatched: 0 });
    }

    // 3) 이미 기록된 건 제외 (source_ref 유니크)
    const refs = rows.map((r) => `broj:${r.broj_attendance_id}`);
    const existing = new Set<string>();
    for (let i = 0; i < refs.length; i += 500) {
      const { data } = await app
        .from("attendance_logs").select("source_ref").in("source_ref", refs.slice(i, i + 500));
      for (const e of (data || []) as { source_ref: string }[]) existing.add(e.source_ref);
    }
    const todo = rows.filter((r) => !existing.has(`broj:${r.broj_attendance_id}`));
    if (todo.length === 0) {
      await app.from("broj_checkin_runs").insert({ ok: true, scanned: rows.length, skipped: rows.length });
      return json({ ok: true, from, to, scanned: rows.length, inserted: 0, skipped: rows.length, unmatched: 0 });
    }

    // 4) 전화번호 → 앱 회원 매칭
    const phones = [...new Set(todo.map((r) => onlyDigits(r.phone)).filter((p) => p.length >= 10))];
    const profMap = new Map<string, { user_id: string; nickname: string | null; name: string | null }>();
    for (let i = 0; i < phones.length; i += 300) {
      const { data } = await app
        .from("profiles").select("user_id, nickname, name, phone_number")
        .in("phone_number", phones.slice(i, i + 300));
      for (const p of (data || []) as { user_id: string; nickname: string | null; name: string | null; phone_number: string }[]) {
        profMap.set(onlyDigits(p.phone_number), { user_id: p.user_id, nickname: p.nickname, name: p.name });
      }
    }

    const userIds = [...new Set([...profMap.values()].map((p) => p.user_id))];
    if (userIds.length === 0) {
      await app.from("broj_checkin_runs").insert({ ok: true, scanned: rows.length, skipped: rows.length - todo.length, unmatched: todo.length });
      return json({ ok: true, from, to, scanned: rows.length, inserted: 0, skipped: rows.length - todo.length, unmatched: todo.length });
    }

    // 5) 리그·레벨 스냅샷 + 지점별 표시명 모드
    const progMap = new Map<string, { current_rank: string | null; current_level: number | null }>();
    for (let i = 0; i < userIds.length; i += 300) {
      const { data } = await app
        .from("member_progress").select("user_id, current_rank, current_level")
        .in("user_id", userIds.slice(i, i + 300));
      for (const g of (data || []) as { user_id: string; current_rank: string | null; current_level: number | null }[]) {
        progMap.set(g.user_id, { current_rank: g.current_rank, current_level: g.current_level });
      }
    }

    const modeMap = new Map<string, string>();
    {
      const { data } = await app.from("branch_display_settings").select("branch_name, display_name_mode");
      for (const s of (data || []) as { branch_name: string; display_name_mode: string }[]) {
        modeMap.set(s.branch_name, s.display_name_mode);
      }
    }

    // 6) 같은 날 이미 체크인(QR 또는 브로제이)이 있으면 is_duplicate=true — 라이브보드·통계 중복 방지
    const dayKeys = new Set<string>();
    {
      const startIso = new Date(`${from}T00:00:00+09:00`).toISOString();
      for (let i = 0; i < userIds.length; i += 300) {
        const { data } = await app
          .from("attendance_logs").select("user_id, checked_in_at")
          .in("user_id", userIds.slice(i, i + 300))
          .eq("is_duplicate", false)
          .gte("checked_in_at", startIso);
        for (const a of (data || []) as { user_id: string; checked_in_at: string }[]) {
          const d = new Date(new Date(a.checked_in_at).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
          dayKeys.add(`${a.user_id}|${d}`);
        }
      }
    }

    // 7) 삽입 행 조립
    let unmatched = 0;
    const inserts: Record<string, unknown>[] = [];
    for (const r of todo) {
      const prof = profMap.get(onlyDigits(r.phone));
      if (!prof) { unmatched++; continue; }
      const branch = branchOf(r);
      if (!branch) { unmatched++; continue; }
      const key = `${prof.user_id}|${r.attend_date}`;
      const dup = dayKeys.has(key);
      if (!dup) dayKeys.add(key);
      const prog = progMap.get(prof.user_id);
      inserts.push({
        user_id: prof.user_id,
        branch_name: branch,
        method: "broj",
        checked_in_at: r.attended_at,
        xp_granted: 0,                 // ⚠️ XP 는 QR 체크인에서만 — 여기서 절대 주지 않는다
        is_duplicate: dup,
        display_name_snapshot: displayName(modeMap.get(branch) ?? "nickname", prof.nickname, prof.name),
        league_snapshot: prog?.current_rank ?? "white",
        level_snapshot: prog?.current_level ?? 1,
        source_ref: `broj:${r.broj_attendance_id}`,
      });
    }

    // 8) 저장 (source_ref 유니크 → 동시 실행에도 안전)
    let inserted = 0;
    for (let i = 0; i < inserts.length; i += 300) {
      const chunk = inserts.slice(i, i + 300);
      const { error } = await app
        .from("attendance_logs").upsert(chunk, { onConflict: "source_ref", ignoreDuplicates: true });
      if (error) {
        await app.from("broj_checkin_runs").insert({
          ok: false, scanned: rows.length, inserted, unmatched, error: error.message.slice(0, 500),
        });
        return json({ error: "저장 실패" }, 500);
      }
      inserted += chunk.length;
    }

    const skipped = rows.length - todo.length;
    await app.from("broj_checkin_runs").insert({ ok: true, scanned: rows.length, inserted, skipped, unmatched });
    return json({ ok: true, from, to, scanned: rows.length, inserted, skipped, unmatched });
  } catch (e) {
    await app.from("broj_checkin_runs").insert({
      ok: false, error: (e instanceof Error ? e.message : String(e)).slice(0, 500),
    });
    return json({ error: "처리 중 오류가 발생했습니다." }, 500);
  }
});
