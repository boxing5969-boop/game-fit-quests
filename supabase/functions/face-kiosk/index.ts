// 얼굴 키오스크 API — 마이복서153 쪽(출석 · 라이브보드). 키오스크 화면(FaceKioskPage)이 부른다.
//
// 2026-11-25 저장소로 옮김 — 그전엔 배포본(v5, 2026-08-01)에만 있었다. 그 본문(lookup · enroll · list · checkin)은 그대로 두고 키 확인만 더했다(급한 고침 v6).
//   · 키: 앱 공용 키(internal_sync_config.face_kiosk_key) 또는 153OS 지점 키(FC-6). 지점 키는 153OS 에 물어(/api/face/settings)
//     맞으면 받아 주고 **지점은 키에서** 정한다 — 그전엔 지점 키를 넣은 키오스크의 출석이 여기서 401 로 조용히 막혔다
//     (선릉 패드에 지점 키를 넣으니 153OS 판정은 되는데 마이복서153 출석 · TV 가 안 남던 것).
//     지점 키는 checkin · state · checkout 만 — 옛 lookup · enroll · list(지점 구분 없음)는 앱 공용 키만(403).
//   · v7(2026-11-25 대표님 「올리자」) — [출석]/[퇴장] 버튼판:
//     state    — 오늘 출석했나 · 입장 시각 · 끝 기록(키오스크가 [출석] / [출석][퇴장] 중 무엇을 보일지 정한다)
//     checkout — [퇴장] = DB kiosk_finish_workout(누른 시각으로 운동 시간 · XP 차액 정산). 안 누르고 가면 기본 운동 시간(66분).
//   · v8(2026-11-27 대표님 「그렇게하자」) — checkin 뒤 자동 승급 검사(auto_advance_from_attendance · QR 출석 · 브로제이 동기화와 같은 길).
//     그전엔 키오스크 출석에 승급 검사가 없어 키오스크로만 오는 회원은 레벨이 안 올랐다.
//     지도진(profiles.is_staff — QR 출석과 같은 기준)과 코치 · 지점장 · 관리자 역할은 뺀다(출근 도장 ≠ 승급). 역할을 못 읽으면 검사도 건너뛴다.
//
// 액션: lookup(전화→회원), enroll(임베딩 등록+동의), list(매칭용 임베딩) — 2026-08-03 FC-2 부터 등록 · 명단 · 판정은 153OS 가 한다(옛 길, 호환으로 남김)
//       checkin(출석), state(오늘 상태), checkout(퇴장)
// 원칙: 사진 저장 없음(임베딩만), 동의 없으면 등록 거부. qr-checkin·브로제이 브리지 무수정 — 별도 병렬 경로.
//       출석 보상(XP)은 DB 트리거 attendance_base_xp 가 method 'face' 를 broj 와 같이 준다(2026-09-22).
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-kiosk-key",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const onlyDigits = (s: unknown) => String(s ?? "").replace(/[^0-9]/g, "");

const kstDayStartIso = () => {
  const kstMs = Date.now() + 9 * 3600 * 1000;
  return new Date(Math.floor(kstMs / 86400000) * 86400000 - 9 * 3600 * 1000).toISOString();
};

function maskName(mode: string, nickname: string | null, name: string | null): string {
  const nm = (name ?? "").trim();
  const nick = (nickname ?? "").trim();
  if (mode === "masked_name") {
    const n = nm || nick || "회원";
    return n.length <= 1 ? n : n[0] + "O".repeat(n.length - 1);
  }
  if (mode === "full_name") return nm || nick || "회원";
  return nick || nm || "회원";
}

// ── 키 확인 — 앱 공용 키 또는 153OS 지점 키 ──
// 153OS 지점 키는 153OS 만 안다(키 → 지점). 153OS /api/face/settings 가 그 키로 200 + scoped + branch_name 을 주면 맞는 키.
// 같은 키를 매번 묻지 않게 이 인스턴스 안에 잠깐 기억한다(맞음 10분 · 틀림 1분). 153OS 장애(5xx · 네트워크)는 기억하지 않는다.
const OS_FACE_URL = (Deno.env.get("OS_FACE_URL") || "https://153-boxing-os-api.boxing5969.workers.dev/api/face").replace(/\/+$/, "");
const KEY_OK_TTL_MS = 10 * 60_000;
const KEY_BAD_TTL_MS = 60_000;
const keyCache = new Map<string, { ok: boolean; branch: string | null; exp: number }>();

type KioskAuth = { ok: true; branchName: string | null } | { ok: false };

async function authKiosk(db: SupabaseClient, provided: string): Promise<KioskAuth> {
  if (!provided) return { ok: false };
  const { data: cfg } = await db.from("internal_sync_config").select("value").eq("key", "face_kiosk_key").maybeSingle();
  if (cfg?.value && provided === cfg.value) return { ok: true, branchName: null }; // 공용 키 — 지점은 화면이 보낸 값

  const now = Date.now();
  const hit = keyCache.get(provided);
  if (hit && hit.exp > now) return hit.ok ? { ok: true, branchName: hit.branch } : { ok: false };

  let ok = false;
  let branch: string | null = null;
  try {
    const r = await fetch(`${OS_FACE_URL}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-kiosk-key": provided },
      body: "{}",
      signal: AbortSignal.timeout(4000),
    });
    if (r.status === 200) {
      const j = await r.json().catch(() => null) as { success?: boolean; data?: { scoped?: boolean; branch_name?: unknown } } | null;
      const bn = j?.success === true && j?.data?.scoped === true && typeof j?.data?.branch_name === "string" ? j.data.branch_name.trim() : "";
      if (bn) { ok = true; branch = bn; }
    } else if (r.status !== 401) {
      return { ok: false }; // 153OS 장애 — 기억하지 않고 이번만 거절(키오스크는 30초 뒤 다시 시도한다)
    }
  } catch {
    return { ok: false };
  }
  if (keyCache.size > 200) keyCache.clear(); // 아무 키나 넣어 보는 요청이 메모리를 키우지 못하게
  keyCache.set(provided, { ok, branch, exp: now + (ok ? KEY_OK_TTL_MS : KEY_BAD_TTL_MS) });
  return ok ? { ok: true, branchName: branch } : { ok: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const auth = await authKiosk(db, req.headers.get("x-kiosk-key") || "");
    if (!auth.ok) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    // 지점 키(153OS 가 알려 준 키)는 출석 · 오늘 상태 · 퇴장만 — 옛 전화 찾기 · 등록 · 명단(지점 구분 없는 길)은 앱 공용 키만
    if (auth.branchName !== null && !["checkin", "state", "checkout"].includes(action)) return json({ error: "forbidden" }, 403);

    // ── 전화번호로 회원 찾기 (등록 1단계) ──
    if (action === "lookup") {
      const phone = onlyDigits(body?.phone);
      if (phone.length < 10) return json({ error: "전화번호 형식 오류" }, 400);
      const { data: p } = await db.from("profiles")
        .select("user_id, name, nickname, branch_name").eq("phone_number", phone).maybeSingle();
      if (!p) return json({ error: "회원을 찾지 못했습니다. 앱 가입 후 이용해주세요." }, 404);
      const { count } = await db.from("face_profiles").select("id", { count: "exact", head: true })
        .eq("user_id", p.user_id).eq("active", true);
      return json({ ok: true, user_id: p.user_id, name: p.name, nickname: p.nickname, branch_name: p.branch_name, enrolled: (count ?? 0) > 0 });
    }

    // ── 임베딩 등록 (동의 필수) ──
    if (action === "enroll") {
      const userId = String(body?.user_id || "");
      const embs = body?.embeddings as number[][] | undefined;
      if (!userId || !Array.isArray(embs) || embs.length === 0) return json({ error: "입력 오류" }, 400);
      if (body?.consent !== true) return json({ error: "생체정보 수집·이용 동의가 필요합니다" }, 400);
      const bad = embs.some((e) => !Array.isArray(e) || e.length !== 128 || e.some((v) => typeof v !== "number" || !isFinite(v)));
      if (bad || embs.length > 5) return json({ error: "임베딩 형식 오류" }, 400);
      // 기존 등록 비활성화 후 새로 (재등록 안전)
      await db.from("face_profiles").update({ active: false }).eq("user_id", userId).eq("active", true);
      const rows = embs.map((e) => ({ user_id: userId, embedding: e, consent_at: new Date().toISOString() }));
      const { error } = await db.from("face_profiles").insert(rows);
      if (error) return json({ error: "등록 실패" }, 500);
      return json({ ok: true, saved: rows.length });
    }

    // ── 매칭용 목록 (키오스크가 메모리에 들고 현장 매칭) ──
    if (action === "list") {
      const { data: rows } = await db.from("face_profiles")
        .select("user_id, embedding").eq("active", true).limit(2000);
      const ids = [...new Set((rows || []).map((r: { user_id: string }) => r.user_id))];
      const nameMap = new Map<string, string>();
      if (ids.length) {
        const { data: ps } = await db.from("profiles").select("user_id, name, nickname").in("user_id", ids);
        for (const p of (ps || []) as { user_id: string; name: string | null; nickname: string | null }[]) {
          nameMap.set(p.user_id, (p.nickname || p.name || "회원").trim());
        }
      }
      return json({ ok: true, profiles: (rows || []).map((r: { user_id: string; embedding: number[] }) => ({
        user_id: r.user_id, name: nameMap.get(r.user_id) || "회원", embedding: r.embedding })) });
    }

    // ── 출석 기록 ──
    if (action === "checkin") {
      const userId = String(body?.user_id || "");
      // 지점 키면 지점은 키에서(153OS 지점 이름 = 앱 지점 이름) — 화면이 보낸 이름은 공용 키일 때만 쓴다
      const branchName = (auth.branchName ?? String(body?.branch_name || "")).trim();
      if (!userId || !branchName) return json({ error: "입력 오류" }, 400);
      // 오늘(KST) 비중복 행이 있으면 새 행을 만들지 않는다 (라이브보드 중복·스팸 방지)
      const { data: existing } = await db.from("attendance_logs").select("id, method")
        .eq("user_id", userId).eq("is_duplicate", false)
        .gte("checked_in_at", kstDayStartIso()).limit(1);
      if (existing && existing.length > 0) {
        return json({ ok: true, already: true, method: existing[0].method });
      }
      const [{ data: prof }, { data: prog }, { data: ds }] = await Promise.all([
        db.from("profiles").select("name, nickname, is_staff").eq("user_id", userId).maybeSingle(),
        db.from("member_progress").select("current_rank, current_level").eq("user_id", userId).maybeSingle(),
        db.from("branch_display_settings").select("display_name_mode").eq("branch_name", branchName).maybeSingle(),
      ]);
      const { error } = await db.from("attendance_logs").insert({
        user_id: userId,
        branch_name: branchName,
        method: "face",
        xp_granted: 0, // 기본 보상은 DB 트리거(attendance_base_xp)가 준다
        is_duplicate: false,
        display_name_snapshot: maskName(ds?.display_name_mode || "nickname", prof?.nickname ?? null, prof?.name ?? null),
        league_snapshot: prog?.current_rank || "white",
        level_snapshot: prog?.current_level || 1,
      });
      if (error) return json({ error: "출석 기록 실패" }, 500);
      // 자동 승급 검사 (v8) — 실패는 삼킨다: 출석이 우선이고 다음 출석 때 같은 검사가 다시 돈다
      try {
        if (prof?.is_staff !== true) {
          const { data: roles, error: roleErr } = await db.from("user_roles").select("role").eq("user_id", userId)
            .in("role", ["super_admin", "admin", "branch_manager", "coach"]).limit(1);
          if (!roleErr && (roles?.length ?? 0) === 0) await db.rpc("auto_advance_from_attendance", { _user_id: userId });
        }
      } catch (_e) { /* 무시 */ }
      return json({ ok: true, already: false });
    }

    // ── 오늘 상태 (2026-11-25) — 키오스크가 [출석] / [출석][퇴장] 중 무엇을 보일지 ──
    if (action === "state") {
      const userId = String(body?.user_id || "");
      if (!userId) return json({ error: "입력 오류" }, 400);
      const { data: rows, error } = await db.from("attendance_logs")
        .select("checked_in_at, ended_at, ended_source, method")
        .eq("user_id", userId).eq("is_duplicate", false)
        .gte("checked_in_at", kstDayStartIso())
        .order("checked_in_at", { ascending: true }).limit(1);
      if (error) return json({ error: "상태 조회 실패" }, 500);
      const r = rows?.[0] as { checked_in_at: string; ended_at: string | null; ended_source: string | null; method: string | null } | undefined;
      return json({
        ok: true,
        attended: !!r,
        started_at: r?.checked_in_at ?? null,
        ended_at: r?.ended_at ?? null,
        ended_source: r?.ended_source ?? null,
        method: r?.method ?? null,
      });
    }

    // ── 퇴장 (2026-11-25) — 누른 시각으로 운동 시간 · XP 차액 정산 ──
    if (action === "checkout") {
      const userId = String(body?.user_id || "");
      if (!userId) return json({ error: "입력 오류" }, 400);
      const { data, error } = await db.rpc("kiosk_finish_workout", { p_user_id: userId });
      if (error) return json({ error: "퇴장 기록 실패" }, 500);
      const r = (data ?? {}) as Record<string, unknown>;
      if (r.success !== true) return json({ ok: false, code: typeof r.code === "string" ? r.code : "FAILED" });
      return json({
        ok: true,
        already_finished: r.already_finished === true,
        source: r.source ?? null,
        minutes: typeof r.minutes === "number" ? r.minutes : null,
        xp_granted: typeof r.xp_granted === "number" ? r.xp_granted : 0,
        started_at: r.started_at ?? null,
        ended_at: r.ended_at ?? null,
      });
    }

    return json({ error: "unknown action" }, 400);
  } catch (_e) {
    return json({ error: "처리 중 오류가 발생했습니다." }, 500);
  }
});
