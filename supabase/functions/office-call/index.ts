// 🏢 지점 회의실 2단계 — 음성 · 카메라 회의 입장권 (2026-10-27 대표님 "다음 단계 작업하자" · 「지점 회의실 상세 보고서」 2단계)
//
//   회의 화면(src/pages/OfficeRoomPage.tsx → src/lib/officeCall.ts)이 부른다. verify_jwt = true (로그인한 앱 사용자만).
//   POST { meeting_id }
//     1) 권한: office_call_ticket(회의) 를 부른 사람 토큰으로 — 그 지점 지도진 + 대표님 · 열린 회의만 (DB 가 매번 판단)
//     2) 회의마다 RealtimeKit 회의 하나: office_meetings.rtk_meeting_id 가 없으면 만들고 저장(동시에 둘이 만들면 먼저 저장된 것)
//     3) 회의 · 사람마다 참가자 하나(office_call_participants) — 처음이면 만들고, 다시 들어오면 입장권만 새로 → { token, host }
//        custom_participant_id = 앱 user_id(개인정보 아님), 이름 '이재우 코치'
//        역할: 대표님 · 지점장 = host 프리셋(다른 사람 마이크 끄기 가능), 코치 = participant 프리셋
//   POST { meeting_id, action: 'end' } — 회의를 끝낸 대표님 · 지점장: 음성방 모두 내보내고 다시 못 들어오게(INACTIVE)
//
//   API 토큰은 시크릿에만: CF_REALTIME_TOKEN(Cloudflare API 토큰 · Realtime Admin).
//   계정 · 앱 번호(비밀 아님)는 시크릿 CF_ACCOUNT_ID · CF_RTK_APP_ID, 없으면 internal_sync_config 'office_call'
//   {"account_id","app_id","preset_host"?,"preset_member"?}. 프리셋 이름이 다르면 앱의 프리셋 목록에서 host · participant 를 찾는다.
//   설정이 없으면 503 { error: 'not_configured' } — 화면은 '준비 중'.
//   녹음 · 녹화 없음(record_on_start false). 마이크 · 카메라는 화면에서 본인이 켤 때만.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CF_API = "https://api.cloudflare.com/client/v4";

/** 앱 프리셋 목록에서 찾은 이름 (같은 서버가 살아 있는 동안 기억) */
let foundPresets: { host: string; member: string } | null = null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const CF_TOKEN = Deno.env.get("CF_REALTIME_TOKEN") ?? "";

  const auth = req.headers.get("Authorization") ?? "";
  if (!/^Bearer\s+\S+/i.test(auth)) return json({ error: "not_authenticated" }, 401);

  const body: any = await req.json().catch(() => ({}));
  const meetingId = String(body?.meeting_id ?? "");
  if (!UUID.test(meetingId)) return json({ error: "bad_meeting" }, 400);
  if (!CF_TOKEN) return json({ error: "not_configured" }, 503);

  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

  // 계정 · 앱 번호 (시크릿 → 없으면 internal_sync_config)
  let cfg: any = {};
  let ACCOUNT = Deno.env.get("CF_ACCOUNT_ID") ?? "";
  let APP = Deno.env.get("CF_RTK_APP_ID") ?? "";
  if (!ACCOUNT || !APP) {
    const { data } = await admin.from("internal_sync_config").select("value").eq("key", "office_call").maybeSingle();
    try {
      cfg = JSON.parse(data?.value ?? "{}") ?? {};
    } catch {
      cfg = {};
    }
    ACCOUNT ||= String(cfg.account_id ?? "");
    APP ||= String(cfg.app_id ?? "");
  }
  if (!ACCOUNT || !APP) return json({ error: "not_configured" }, 503);
  const PRESET_HOST = Deno.env.get("RTK_PRESET_HOST") || cfg.preset_host || "group_call_host";
  const PRESET_MEMBER = Deno.env.get("RTK_PRESET_MEMBER") || cfg.preset_member || "group_call_participant";

  // 권한 판단은 DB 함수가 — 부른 사람 토큰으로 부른다(auth.uid())
  const asUser = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });

  const rtk = async (path: string, init: { method: string; body?: unknown }) => {
    const r = await fetch(`${CF_API}/accounts/${ACCOUNT}/realtime/kit/${APP}${path}`, {
      method: init.method,
      headers: { Authorization: `Bearer ${CF_TOKEN}`, "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const data: any = await r.json().catch(() => null);
    if (!r.ok) {
      console.error(
        "office-call rtk",
        init.method,
        path.replace(/[0-9a-f-]{36}/gi, ":id").replace(/\?.*$/, ""),
        r.status,
        JSON.stringify(data?.errors ?? data?.error ?? data)?.slice(0, 300),
      );
    }
    return { ok: r.ok, status: r.status, data };
  };

  // ── 회의를 끝낼 때: 음성방도 닫는다 ──
  if (body?.action === "end") {
    const { data: rid, error } = await asUser.rpc("office_call_end_check", { p_meeting: meetingId });
    if (error) return json({ error: "forbidden", message: error.message }, 403);
    if (!rid) return json({ ok: true, skipped: true });
    await rtk(`/meetings/${rid}/active-session/kick-all`, { method: "POST" });
    await rtk(`/meetings/${rid}`, { method: "PATCH", body: { status: "INACTIVE" } });
    return json({ ok: true });
  }

  // ── 입장권 ──
  const { data: t, error: tErr } = await asUser.rpc("office_call_ticket", { p_meeting: meetingId });
  if (tErr || !t) return json({ error: "forbidden", message: tErr?.message ?? "" }, 403);
  const uid = String(t.user_id);
  const host = t.role === "host";

  let rid: string | null = t.rtk_meeting_id ?? null;
  if (!rid) {
    const made = await rtk(`/meetings`, {
      method: "POST",
      body: {
        title: `153 지점 회의실 · ${String(t.title ?? "")}`.slice(0, 120),
        record_on_start: false,
        persist_chat: false,
        session_keep_alive_time_in_secs: 60,
      },
    });
    const newId: string | undefined = made.data?.data?.id;
    if (!made.ok || !newId) return json({ error: "rtk_meeting_failed" }, 502);
    // 동시에 두 사람이 만들면 먼저 저장된 회의를 쓴다 (남은 하나는 아무도 안 들어와 비용 없음)
    const { data: saved } = await admin
      .from("office_meetings")
      .update({ rtk_meeting_id: newId })
      .eq("id", meetingId)
      .is("rtk_meeting_id", null)
      .select("rtk_meeting_id")
      .maybeSingle();
    if (saved?.rtk_meeting_id) rid = saved.rtk_meeting_id;
    else {
      const { data: cur } = await admin.from("office_meetings").select("rtk_meeting_id").eq("id", meetingId).maybeSingle();
      rid = cur?.rtk_meeting_id ?? newId;
    }
  }

  const remember = (pid: string) =>
    admin
      .from("office_call_participants")
      .upsert({ meeting_id: meetingId, user_id: uid, rtk_participant_id: pid }, { onConflict: "meeting_id,user_id" });
  const refresh = async (pid: string): Promise<string | null> => {
    const r = await rtk(`/meetings/${rid}/participants/${pid}/token`, { method: "POST", body: {} });
    return (r.ok && r.data?.data?.token) || null;
  };

  // 다시 들어온 사람 — 입장권만 새로
  const { data: had } = await admin
    .from("office_call_participants")
    .select("rtk_participant_id")
    .eq("meeting_id", meetingId)
    .eq("user_id", uid)
    .maybeSingle();
  if (had?.rtk_participant_id) {
    const token = await refresh(had.rtk_participant_id);
    if (token) return json({ token, host });
  }

  const create = (preset: string) =>
    rtk(`/meetings/${rid}/participants`, {
      method: "POST",
      body: { custom_participant_id: uid, preset_name: preset, name: String(t.name || "지도진").slice(0, 40) },
    });
  let added = await create(host ? PRESET_HOST : PRESET_MEMBER);

  if (!added.ok) {
    // ① 이미 있는 참가자인데 저장만 빠진 경우 — 찾아서 입장권만 새로
    const list = await rtk(`/meetings/${rid}/participants?per_page=200`, { method: "GET" });
    const mine = (list.data?.data ?? []).find((p: any) => p?.custom_participant_id === uid);
    if (mine?.id) {
      await remember(String(mine.id));
      const token = await refresh(String(mine.id));
      if (token) return json({ token, host });
    }
    // ② 프리셋 이름이 다른 앱 — 앱의 프리셋 목록에서 찾는다
    if (!foundPresets) {
      const ps = await rtk(`/presets?per_page=100`, { method: "GET" });
      const names: string[] = (ps.data?.data ?? []).map((p: any) => String(p?.name ?? "")).filter(Boolean);
      const pick = (want: string, re: RegExp) => names.find((n) => n === want) ?? names.find((n) => re.test(n)) ?? null;
      const h = pick(PRESET_HOST, /group.?call.?host|host/i);
      const m = pick(PRESET_MEMBER, /group.?call.?participant|participant/i) ?? h;
      if (h && m) foundPresets = { host: h, member: m };
      console.log("office-call presets", JSON.stringify(names).slice(0, 300));
    }
    const p = foundPresets;
    if (p && (host ? p.host : p.member) !== (host ? PRESET_HOST : PRESET_MEMBER)) added = await create(host ? p.host : p.member);
  }

  const token: string | undefined = added.data?.data?.token;
  const pid: string | undefined = added.data?.data?.id;
  if (!added.ok || !token) return json({ error: "rtk_participant_failed" }, 502);
  if (pid) await remember(pid);
  return json({ token, host });
});
