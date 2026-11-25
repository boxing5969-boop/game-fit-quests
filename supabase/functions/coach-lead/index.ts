// 🧭 관장님 리드 가이드 · 관장님 이해 카드 — 오삼코치 (2026-11-26 대표님 「관장님들은 코치님들을 어떻게 리드하는 것이 좋을지 알려 주자 ·
//    코치님들도 관장님의 성향을 알고 서로 오해 없이 이해할 수 있도록」)
//
//   verify_jwt = true. POST { action, branch?, … } — 답은 늘 200 { ok, … } / { ok:false, error }(화면에 보일 말)
//     · team  이끄는 분(대표님 · 지점장님 · 관장님) 본인 — 내 성향 카드 → '이해 카드'. 서버 키로 내 카드만 읽고 team_card 칸만 쓴다
//             (그사이 카드를 고쳤으면 쓰지 않음). 보여 주기(share_team)는 화면이 coach_lead_share_set 으로 따로 켠다
//     · pair  이끄는 분 — { coach_id } → 그 코치님 리드 가이드. 두 카드 모두 동의가 있어야 하고, 대표님이 아니면 코치님이 share_lead 를 켰을 때만.
//             coach_lead_cards 에 (관장님, 코치님) 한 줄로 저장 — 그 관장님만 읽는다(coach_lead_state)
//   권한: 부른 분 토큰으로 coach_growth_me — staff · can_direct · hq · board(그 지점 코치님) · ai_polish(스위치 coach_feedback_ai = 'on')
//   모델: CLAUDE_COACH_MIND_MODEL(없으면 claude-opus-5-5 · effort CLAUDE_COACH_MIND_EFFORT 기본 medium) — API 오류면 채팅 모델로 한 번
//   답 검사: _shared/coachLead.ts(탓하는 말 · 꼬리표 · 카드 답 옮기기 · 지어낸 숫자 · 본인 글 옮기기 · 길이) — 걸리면 까닭을 붙여 한 번 다시
//   사용량: ai_usage_log feature coach_lead_team · coach_lead_pair — 사람마다 하루 6 · 40번 · 카드 글은 남기지 않는다
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildClaudeBody, CLAUDE_CHAT_MODEL, claudeMessage, hasClaude, keepAlive, logAiUsage, messageText, usageOf } from "../_shared/claude.ts";
import { parseJson, retryNote, type MindProfileInput } from "../_shared/coachMind.ts";
import { buildPairUser, buildTeamUser, checkPair, checkTeam, PAIR_SCHEMA, PAIR_SYSTEM, TEAM_SCHEMA, TEAM_SYSTEM } from "../_shared/coachLead.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
const fail = (error: string) => json({ ok: false, error });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODEL = (Deno.env.get("CLAUDE_COACH_MIND_MODEL") ?? "").trim() || "claude-opus-5-5";
const EFFORT = (Deno.env.get("CLAUDE_COACH_MIND_EFFORT") ?? "").trim() || "medium";
const DAILY: Record<string, number> = { coach_lead_team: 6, coach_lead_pair: 40 };
const BUSY = "오삼코치가 지금 바빠요 — 잠시 뒤 다시 눌러 주세요";
const COLS = "coach_id, answers, mbti, mbti_source, note_power, note_know, consent_at, updated_at, share_lead";

type Db = ReturnType<typeof createClient>;

async function overLimit(db: Db, uid: string, feature: string): Promise<boolean> {
  try {
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { count } = await db.from("ai_usage_log").select("id", { count: "exact", head: true }).eq("feature", feature).eq("user_id", uid).gte("created_at", since);
    return (count ?? 0) >= (DAILY[feature] ?? 20);
  } catch {
    return false;
  }
}

async function callModel(o: { feature: string; system: string; user: string; schema: Record<string, unknown>; uid: string; db: Db; meta?: Record<string, unknown> }): Promise<{ text: string; model: string }> {
  const models = MODEL === CLAUDE_CHAT_MODEL ? [MODEL] : [MODEL, CLAUDE_CHAT_MODEL];
  let last: unknown = null;
  for (const model of models) {
    try {
      const body: Record<string, any> = buildClaudeBody({
        model,
        system: [{ text: o.system, cache: true }],
        messages: [{ role: "user", content: o.user }],
        maxTokens: model.startsWith("claude-opus") ? 10000 : 4000,
        jsonSchema: o.schema,
      });
      if (model.startsWith("claude-opus")) body.output_config = { ...(body.output_config ?? {}), effort: EFFORT };
      const msg = await claudeMessage(body);
      keepAlive(logAiUsage(o.db, { feature: o.feature, model, usage: usageOf(msg), userId: o.uid, meta: { ...(o.meta ?? {}), stop: msg.stop_reason ?? null } }));
      if (msg.stop_reason === "refusal") throw new Error("refusal");
      const text = messageText(msg);
      if (!text) throw new Error(`empty (${msg.stop_reason ?? "?"})`);
      return { text, model };
    } catch (e) {
      last = e;
      console.error("coach-lead model failed", model, e instanceof Error ? e.message.slice(0, 300) : e);
    }
  }
  throw last ?? new Error("ai_failed");
}

async function askChecked<T>(
  base: Parameters<typeof callModel>[0],
  check: (raw: unknown) => { ok: true; value: T } | { ok: false; reason: string; message?: string },
): Promise<{ ok: true; value: T; model: string } | { ok: false; error: string }> {
  let note = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const { text, model } = await callModel({ ...base, user: note ? `${base.user}\n\n${note}` : base.user });
    const c = check(parseJson(text));
    if (c.ok) return { ok: true, value: c.value, model };
    console.warn("coach-lead check failed", base.feature, c.reason);
    note = retryNote(c.reason, c.reason === "echo" ? undefined : c.message);
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
  if (!["team", "pair"].includes(action)) return fail("잘못된 요청이에요");
  if (!hasClaude()) return fail("지금은 오삼코치를 쓸 수 없어요");

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!SERVICE) return fail("지금은 오삼코치를 쓸 수 없어요");
  const asUser = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: who } = await asUser.auth.getUser();
  const uid = who?.user?.id;
  if (!uid) return fail("다시 로그인해 주세요");
  const db = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

  const branch = typeof body?.branch === "string" && body.branch.trim() ? body.branch.trim() : null;
  const { data: me } = await asUser.rpc("coach_growth_me", { p_branch: branch });
  if (!me?.staff) return fail("코치진만 쓸 수 있어요");
  if (!me?.ai_polish) return fail("오삼코치 정리는 아직 준비 중이에요");
  if (!me?.can_direct) return fail("관장님만 쓸 수 있어요");

  try {
    const { data: mine } = await db.from("coach_mind_profiles").select(COLS).eq("coach_id", uid).maybeSingle();
    if (!mine || !mine.consent_at) return fail("내 성향 카드를 먼저 저장해 주세요");
    const { data: disp } = await db.rpc("_strategy_display", { _uid: uid });
    const leader = { name: String((disp as any)?.name ?? ""), title: String((disp as any)?.title ?? "") };

    /* ───── 관장님 이해 카드 ───── */
    if (action === "team") {
      if (await overLimit(db, uid, "coach_lead_team")) return fail("오늘은 이해 카드를 많이 만들었어요 — 내일 다시 눌러 주세요");
      const profile = mine as MindProfileInput;
      const r = await askChecked(
        { feature: "coach_lead_team", system: TEAM_SYSTEM, user: buildTeamUser(leader, profile), schema: TEAM_SCHEMA, uid, db },
        (raw) => {
          const c = checkTeam(raw, profile);
          return c.ok ? { ok: true, value: c.card } : c;
        },
      );
      if (!r.ok) return fail(r.error);
      const { data: upd } = await db
        .from("coach_mind_profiles")
        .update({ team_card: r.value, team_card_at: new Date().toISOString() })
        .eq("coach_id", uid)
        .eq("updated_at", mine.updated_at)
        .not("consent_at", "is", null)
        .select("coach_id");
      return json({ ok: true, card: r.value, stale: !(Array.isArray(upd) && upd.length > 0) });
    }

    /* ───── 리드 가이드 ───── */
    const coachId = typeof body?.coach_id === "string" ? body.coach_id : "";
    if (!UUID.test(coachId) || coachId === uid) return fail("코치님을 골라 주세요");
    const target = (Array.isArray(me?.board) ? me.board : []).find((p: any) => p?.person?.user_id === coachId);
    if (!target) return fail("이 지점 코치님만 볼 수 있어요");
    const { data: row } = await db.from("coach_mind_profiles").select(COLS).eq("coach_id", coachId).maybeSingle();
    if (!row || !row.consent_at) return fail("코치님 성향 카드가 아직 없어요");
    if (me?.hq !== true && !row.share_lead) return fail("코치님이 리드 가이드를 허락하면 볼 수 있어요");
    if (await overLimit(db, uid, "coach_lead_pair")) return fail("오늘은 가이드를 많이 만들었어요 — 내일 다시 눌러 주세요");
    const coach = { name: String(target.person?.name ?? ""), title: String(target.person?.title ?? "") };
    const r = await askChecked(
      {
        feature: "coach_lead_pair",
        system: PAIR_SYSTEM,
        user: buildPairUser(leader, mine as MindProfileInput, coach, row as MindProfileInput),
        schema: PAIR_SCHEMA,
        uid,
        db,
        meta: { coach_id: coachId },
      },
      (raw) => {
        const c = checkPair(raw, { leader: mine as MindProfileInput, coach: row as MindProfileInput, allow: `${coach.name} ${leader.name}` });
        return c.ok ? { ok: true, value: c.guide } : c;
      },
    );
    if (!r.ok) return fail(r.error);
    const { error: wErr } = await db.from("coach_lead_cards").upsert(
      {
        leader_id: uid,
        coach_id: coachId,
        branch_name: me?.branch ?? branch,
        body: r.value,
        leader_at: mine.updated_at,
        coach_at: row.updated_at,
        model: r.model,
        created_at: new Date().toISOString(),
      },
      { onConflict: "leader_id,coach_id" },
    );
    if (wErr) console.error("coach-lead save failed", wErr.message);
    return json({ ok: true, guide: r.value });
  } catch (e) {
    console.error("coach-lead failed", action, e instanceof Error ? e.message.slice(0, 300) : e);
    return fail(BUSY);
  }
});
