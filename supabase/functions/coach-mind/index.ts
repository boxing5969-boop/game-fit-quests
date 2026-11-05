// 🧭 153 코치 성향 카드 · 맞춤 피드백 — 오삼코치 (2026-11-05 대표님 「코치님들의 mbti와 심리 상세한 정보를 먼저 획득한 뒤에
//    … 코치님들이 알아들을 수 있도록 피드백해 주는 기능」)
//
//   verify_jwt = true (로그인한 앱 사용자만). POST { action, … } — 답은 늘 200 { ok, … } / { ok:false, error }(화면에 보일 말)
//     · summary  코치님 본인 — 내 성향 카드 → 전달 설명서. 서버 키로 내 카드만 읽고 summary 칸만 쓴다(그사이 카드를 고쳤으면 쓰지 않음)
//     · core     대표님 · 지점장님 — { text } 메모 → 공통 기준. 저장하지 않는다(메모도)
//     · tailor   대표님 · 지점장님 — { coach_id, core } → 그 코치님께 맞춘 글. 성향 카드는 서버 키로만 읽는다
//                (지점장님은 카드를 볼 수 없다 — 글만 돌려준다). 카드가 없으면 { ok, body: null } → 화면은 공통 기준 그대로 보낸다
//   권한: 부른 분 토큰으로 coach_growth_me — staff · can_direct · board(그 지점 코치님) · ai_polish(스위치 coach_feedback_ai = 'on')
//   모델: 시크릿 CLAUDE_COACH_MIND_MODEL(없으면 claude-opus-5-5 · effort CLAUDE_COACH_MIND_EFFORT 기본 medium) — API 오류면 채팅 모델로 한 번
//   답 검사: _shared/coachMind.ts (빠진 기준 · 지어낸 숫자 · 꼬리표 · 탓하는 말 · 길이) — 걸리면 무엇이 걸렸는지 붙여 한 번 다시
//   사용량: ai_usage_log feature coach_mind_summary · coach_mind_core · coach_mind_tailor — 사람마다 하루 6 · 20 · 80번 · 글은 남기지 않는다
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildClaudeBody, CLAUDE_CHAT_MODEL, claudeMessage, hasClaude, keepAlive, logAiUsage, messageText, usageOf } from "../_shared/claude.ts";
import {
  buildCoreSystem,
  buildCoreUser,
  buildSummaryUser,
  buildTailorUser,
  checkCore,
  checkSummary,
  checkTailor,
  cleanCore,
  CORE_LIMITS,
  CORE_SCHEMA,
  MIND_SUMMARY_SCHEMA,
  MIND_SUMMARY_SYSTEM,
  parseJson,
  retryNote,
  TAILOR_SCHEMA,
  TAILOR_SYSTEM,
  type MindProfileInput,
} from "../_shared/coachMind.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
const fail = (error: string) => json({ ok: false, error });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODEL = (Deno.env.get("CLAUDE_COACH_MIND_MODEL") ?? "").trim() || "claude-opus-5-5";
const EFFORT = (Deno.env.get("CLAUDE_COACH_MIND_EFFORT") ?? "").trim() || "medium";
const DAILY: Record<string, number> = { coach_mind_summary: 6, coach_mind_core: 20, coach_mind_tailor: 80 };
const BUSY = "오삼코치가 지금 바빠요 — 잠시 뒤 다시 눌러 주세요";
const PROFILE_COLS = "coach_id, answers, mbti, mbti_source, note_power, note_know, summary, consent_at, updated_at";

type Db = ReturnType<typeof createClient> | null;

async function overLimit(db: Db, uid: string, feature: string): Promise<boolean> {
  if (!db) return false;
  try {
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { count } = await db
      .from("ai_usage_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("feature", feature)
      .gte("created_at", since);
    return (count ?? 0) >= (DAILY[feature] ?? 20);
  } catch {
    return false; // 집계 실패는 넘어간다 — 상한은 요금 방어용
  }
}

/** 한 번 부르기 — 오푸스(생각 · effort)부터, API 오류면 채팅 모델로 */
async function callModel(opts: {
  feature: string;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  maxTokens: number;
  uid: string;
  db: Db;
  meta?: Record<string, unknown>;
}): Promise<string> {
  const models = MODEL === CLAUDE_CHAT_MODEL ? [MODEL] : [MODEL, CLAUDE_CHAT_MODEL];
  let last: unknown = null;
  for (const model of models) {
    try {
      const body: Record<string, any> = buildClaudeBody({
        model,
        system: [{ text: opts.system, cache: true }],
        messages: [{ role: "user", content: opts.user }],
        maxTokens: model.startsWith("claude-opus") ? opts.maxTokens : Math.min(opts.maxTokens, 4000),
        jsonSchema: opts.schema,
      });
      if (model.startsWith("claude-opus")) body.output_config = { ...(body.output_config ?? {}), effort: EFFORT };
      const msg = await claudeMessage(body);
      keepAlive(logAiUsage(opts.db, { feature: opts.feature, model, usage: usageOf(msg), userId: opts.uid, meta: { ...(opts.meta ?? {}), stop: msg.stop_reason ?? null } }));
      if (msg.stop_reason === "refusal") throw new Error("refusal");
      const text = messageText(msg);
      if (!text) throw new Error(`empty (${msg.stop_reason ?? "?"})`);
      return text;
    } catch (e) {
      last = e;
      console.error("coach-mind model failed", model, e instanceof Error ? e.message.slice(0, 300) : e);
    }
  }
  throw last ?? new Error("ai_failed");
}

/** 검사에 걸리면 무엇이 걸렸는지 붙여 한 번 다시 — 그래도 걸리면 null */
async function askChecked<T>(
  base: Omit<Parameters<typeof callModel>[0], "user"> & { user: string },
  check: (raw: unknown) => { ok: true; value: T } | { ok: false; reason: string; message?: string },
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  let note = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await callModel({ ...base, user: note ? `${base.user}\n\n${note}` : base.user });
    const c = check(parseJson(text));
    if (c.ok) return c;
    if (c.reason === "model_error") return { ok: false, error: c.message || "한두 줄만 더 적어 주세요" };
    console.warn("coach-mind check failed", base.feature, c.reason);
    note = retryNote(c.reason);
  }
  return { ok: false, error: "오삼코치 글이 기준에 맞지 않았어요 — 한 번 더 눌러 주세요" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("잘못된 요청이에요");
  const auth = req.headers.get("Authorization") ?? "";
  if (!/^Bearer\s+\S+/i.test(auth)) return fail("다시 로그인해 주세요");
  const body: any = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");
  if (!["summary", "core", "tailor"].includes(action)) return fail("잘못된 요청이에요");
  if (!hasClaude()) return fail("지금은 오삼코치를 쓸 수 없어요");

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const asUser = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: who } = await asUser.auth.getUser();
  const uid = who?.user?.id;
  if (!uid) return fail("다시 로그인해 주세요");
  if (!SERVICE) return fail("지금은 오삼코치를 쓸 수 없어요");
  const db = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

  // 권한 — 153 기준 화면과 같은 서버 판정 (부른 분 토큰)
  const branch = typeof body?.branch === "string" && body.branch.trim() ? body.branch.trim() : null;
  const { data: me } = await asUser.rpc("coach_growth_me", { p_branch: branch });
  if (!me?.staff) return fail("코치진만 쓸 수 있어요");
  if (!me?.ai_polish) return fail("오삼코치 정리는 아직 준비 중이에요");

  try {
    /* ───── 코치님 본인: 성향 카드 → 전달 설명서 ───── */
    if (action === "summary") {
      const { data: row } = await db.from("coach_mind_profiles").select(PROFILE_COLS).eq("coach_id", uid).maybeSingle();
      if (!row || !row.consent_at) return fail("성향 카드를 먼저 저장해 주세요");
      if (await overLimit(db, uid, "coach_mind_summary")) return fail("오늘은 요약을 많이 만들었어요 — 내일 다시 눌러 주세요");
      const profile = row as MindProfileInput;
      const name = String((me as any)?.me?.person?.name ?? "코치님");
      const r = await askChecked(
        { feature: "coach_mind_summary", system: MIND_SUMMARY_SYSTEM, user: buildSummaryUser(name, profile), schema: MIND_SUMMARY_SCHEMA, maxTokens: 8000, uid, db },
        (raw) => {
          const c = checkSummary(raw, profile);
          return c.ok ? { ok: true, value: c.summary } : c;
        },
      );
      if (!r.ok) return fail(r.error);
      // 그사이 카드를 다시 저장했으면(updated_at 이 바뀜) 쓰지 않는다 — 화면이 새 카드로 다시 부른다
      const { data: upd } = await db
        .from("coach_mind_profiles")
        .update({ summary: r.value, summary_at: new Date().toISOString() })
        .eq("coach_id", uid)
        .eq("updated_at", row.updated_at)
        .not("consent_at", "is", null)
        .select("coach_id");
      return json({ ok: true, summary: r.value, stale: !(Array.isArray(upd) && upd.length > 0) });
    }

    /* ───── 대표님 · 지점장님만 ───── */
    if (!me?.can_direct) return fail("대표님 · 지점장님만 쓸 수 있어요");

    if (action === "core") {
      const text = typeof body?.text === "string" ? body.text.trim().slice(0, CORE_LIMITS.memo) : "";
      if (text.replace(/\s/g, "").length < 8) return fail("무엇을 바꾸면 좋을지 한두 줄만 더 적어 주세요");
      if (await overLimit(db, uid, "coach_mind_core")) return fail("오늘은 정리를 많이 했어요 — 내일 다시 눌러 주세요");
      const standards = (Array.isArray(me.standards) ? me.standards : [])
        .map((s: any) => ({ no: Number(s?.no), title: String(s?.title ?? "") }))
        .filter((s: { no: number; title: string }) => Number.isInteger(s.no) && s.title);
      const allow = standards.map((s: { title: string }) => s.title).join(" ");
      const r = await askChecked(
        { feature: "coach_mind_core", system: buildCoreSystem(standards), user: buildCoreUser(text), schema: CORE_SCHEMA, maxTokens: 10000, uid, db },
        (raw) => {
          const c = checkCore(raw, { memo: text, allow });
          return c.ok ? { ok: true, value: c.core } : c;
        },
      );
      return r.ok ? json({ ok: true, core: r.value }) : fail(r.error);
    }

    // tailor
    const coachId = typeof body?.coach_id === "string" ? body.coach_id : "";
    if (!UUID.test(coachId)) return fail("코치님을 골라 주세요");
    const core = cleanCore(body?.core);
    if (!core) return fail("공통 기준을 먼저 정리해 주세요");
    const findIn = (m: any) => (Array.isArray(m?.board) ? m.board : []).find((p: any) => p?.person?.user_id === coachId);
    let target = findIn(me);
    if (!target && me.hq && branch) {
      // 대표님은 지점을 바꿔 보신다 — 그 지점으로 한 번 더 (coach_growth_me 가 다시 판단)
      const { data: me2 } = await asUser.rpc("coach_growth_me", { p_branch: branch });
      target = findIn(me2);
    }
    if (!target) return fail("이 지점 코치님만 맞출 수 있어요");
    const { data: row } = await db.from("coach_mind_profiles").select(PROFILE_COLS).eq("coach_id", coachId).maybeSingle();
    if (!row || !row.consent_at) return json({ ok: true, body: null, tailored: false });
    if (await overLimit(db, uid, "coach_mind_tailor")) return fail("오늘은 맞춤을 많이 만들었어요 — 내일 다시 눌러 주세요");
    const profile = row as MindProfileInput & { summary?: any };
    const r = await askChecked(
      {
        feature: "coach_mind_tailor",
        system: TAILOR_SYSTEM,
        user: buildTailorUser({ name: target.person?.name, title: target.person?.title }, core, profile, profile.summary),
        schema: TAILOR_SCHEMA,
        maxTokens: 10000,
        uid,
        db,
        meta: { coach_id: coachId },
      },
      (raw) => {
        const c = checkTailor(raw, { core, profile });
        return c.ok ? { ok: true, value: c.body } : c;
      },
    );
    return r.ok ? json({ ok: true, body: r.value, tailored: true }) : fail(r.error);
  } catch (e) {
    console.error("coach-mind failed", action, e instanceof Error ? e.message.slice(0, 300) : e);
    return fail(BUSY);
  }
});
