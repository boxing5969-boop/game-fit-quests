// 🧭 153 회원 성향 검사 → 코치용 지도 카드 — 오삼코치 (2026-11-25 대표님 「회원님들도 mbti 검사를 통해 … 코치님들이 회원님들의
//    성격 성향을 빠르게 파악하여 거기에 맞게 지도할수있도록」)
//
//   verify_jwt = true. POST { user_id? } — 답은 늘 200 { ok, card? } / { ok:false, error }(화면에 보일 말)
//     · user_id 없음 = 본인 카드 만들기(검사를 낸 직후 화면이 부른다)
//     · user_id 있음 = 그 회원 지점 지도진 · 대표님이 카드가 없을 때 다시 만들기(부른 분 토큰으로 member_style_for_coach 가 ok 여야)
//   답 원문 · 출석 기록은 서버 키로만 읽는다. 점수는 _shared/memberStyle.ts scoreStyle 로 서버가 다시 센다.
//   모델: CLAUDE_MEMBER_STYLE_MODEL(없으면 claude-opus-5-5 · effort medium) → API 오류면 채팅 모델 · 검사에 걸리면 까닭을 붙여 한 번 다시
//   사용량: ai_usage_log feature member_style_card · 부른 사람마다 하루 8번 · 글은 남기지 않는다(카드만 표에)
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildClaudeBody, CLAUDE_CHAT_MODEL, claudeMessage, hasClaude, keepAlive, logAiUsage, messageText, usageOf } from "../_shared/claude.ts";
import {
  buildCardUser,
  CARD_SCHEMA,
  CARD_SYSTEM,
  checkCard,
  cleanStyleAnswers,
  missingItems,
  parseJson,
  scoreStyle,
  STYLE_WEEK,
  type StyleBehavior,
} from "../_shared/memberStyle.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
const fail = (error: string) => json({ ok: false, error });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODEL = (Deno.env.get("CLAUDE_MEMBER_STYLE_MODEL") ?? "").trim() || "claude-opus-5-5";
const EFFORT = (Deno.env.get("CLAUDE_MEMBER_STYLE_EFFORT") ?? "").trim() || "medium";
const FEATURE = "member_style_card";
const DAILY = 8;
const BUSY = "오삼코치가 지금 바빠요 — 잠시 뒤 다시 눌러 주세요";

const LEAGUE: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };

async function behaviorOf(db: any, uid: string): Promise<StyleBehavior> {
  const since = new Date(Date.now() - 56 * 86400_000).toISOString();
  const [{ data: logs }, { data: first }, { data: prog }, { data: prof }] = await Promise.all([
    db.from("attendance_logs").select("created_at").eq("user_id", uid).gte("created_at", since).order("created_at", { ascending: true }).limit(500),
    db.from("attendance_logs").select("created_at").eq("user_id", uid).order("created_at", { ascending: true }).limit(1),
    db.from("member_progress").select("current_rank, current_level").eq("user_id", uid).maybeSingle(),
    db.from("profiles").select("pt_remaining").eq("user_id", uid).maybeSingle(),
  ]);
  // 한국 날짜마다 첫 출석 하나
  const days = new Map<string, Date>();
  for (const r of logs ?? []) {
    const d = new Date(new Date(r.created_at).getTime() + 9 * 3600_000);
    const key = d.toISOString().slice(0, 10);
    if (!days.has(key)) days.set(key, d);
  }
  const list = [...days.values()];
  const wd = new Map<number, number>();
  const hours: number[] = [];
  for (const d of list) {
    wd.set(d.getUTCDay(), (wd.get(d.getUTCDay()) ?? 0) + 1);
    hours.push(d.getUTCHours());
  }
  const weekdays = [...wd.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).filter(([, n]) => n >= 2).map(([d]) => STYLE_WEEK[d]).join(" · ");
  hours.sort((a, b) => a - b);
  let gap: number | null = null;
  for (let i = 1; i < list.length; i++) {
    const g = Math.round((list[i].getTime() - list[i - 1].getTime()) / 86400_000);
    if (gap === null || g > gap) gap = g;
  }
  const firstAt = first?.[0]?.created_at ? new Date(first[0].created_at) : null;
  return {
    visits8w: list.length,
    weekdays,
    usualHour: hours.length ? hours[Math.floor(hours.length / 2)] : null,
    longestGapDays: gap,
    daysSinceFirst: firstAt ? Math.floor((Date.now() - firstAt.getTime()) / 86400_000) : null,
    league: prog?.current_rank ? LEAGUE[prog.current_rank] ?? prog.current_rank : null,
    level: prog?.current_level ?? null,
    pt: (prof?.pt_remaining ?? 0) > 0,
  };
}

async function callModel(db: any, uid: string, user: string, target: string): Promise<{ text: string; model: string }> {
  const models = MODEL === CLAUDE_CHAT_MODEL ? [MODEL] : [MODEL, CLAUDE_CHAT_MODEL];
  let last: unknown = null;
  for (const model of models) {
    try {
      const body: Record<string, any> = buildClaudeBody({
        model,
        system: [{ text: CARD_SYSTEM, cache: true }],
        messages: [{ role: "user", content: user }],
        maxTokens: model.startsWith("claude-opus") ? 6000 : 3000,
        jsonSchema: CARD_SCHEMA,
      });
      if (model.startsWith("claude-opus")) body.output_config = { ...(body.output_config ?? {}), effort: EFFORT };
      const msg = await claudeMessage(body);
      keepAlive(logAiUsage(db, { feature: FEATURE, model, usage: usageOf(msg), userId: uid, meta: { target, stop: msg.stop_reason ?? null } }));
      if (msg.stop_reason === "refusal") throw new Error("refusal");
      const text = messageText(msg);
      if (!text) throw new Error(`empty (${msg.stop_reason ?? "?"})`);
      return { text, model };
    } catch (e) {
      last = e;
      console.error("member-style model failed", model, e instanceof Error ? e.message.slice(0, 300) : e);
    }
  }
  throw last ?? new Error("ai_failed");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("잘못된 요청이에요");
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth || !SERVICE) return fail("다시 로그인해 주세요");
    const asUser = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: who } = await asUser.auth.getUser();
    const uid = who?.user?.id;
    if (!uid) return fail("다시 로그인해 주세요");
    const db = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

    const body = await req.json().catch(() => ({}));
    let target = uid;
    if (typeof body?.user_id === "string" && body.user_id !== uid) {
      if (!UUID.test(body.user_id)) return fail("잘못된 요청이에요");
      const { data: can } = await asUser.rpc("member_style_for_coach", { p_user: body.user_id });
      if (!can?.ok) return fail("이 회원의 카드는 볼 수 없어요");
      target = body.user_id;
    }

    if (!hasClaude()) return fail(BUSY);
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { count } = await db.from("ai_usage_log").select("id", { count: "exact", head: true }).eq("feature", FEATURE).eq("user_id", uid).gte("created_at", since);
    if ((count ?? 0) >= DAILY) return fail("오늘은 여기까지 만들 수 있어요 — 내일 다시 눌러 주세요");

    const { data: row } = await db.from("member_style_profiles").select("answers, updated_at, consent_at, removed_at").eq("user_id", target).maybeSingle();
    if (!row || row.removed_at || !row.consent_at) return fail("아직 성향 검사를 하지 않았어요");
    const answers = cleanStyleAnswers(row.answers);
    if (missingItems(answers).length > 0) return fail("검사 답이 모자라요 — 다시 검사해 주세요");
    const scores = scoreStyle(answers);

    const [{ data: prof }, behavior] = await Promise.all([
      db.from("profiles").select("nickname, name").eq("user_id", target).maybeSingle(),
      behaviorOf(db, target),
    ]);
    const nickname = (prof?.nickname || prof?.name || "회원").toString().slice(0, 20);
    const baseUser = buildCardUser({ nickname, scores, behavior });

    let note = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const { text, model } = await callModel(db, uid, note ? `${baseUser}\n\n[다시 써 줘] ${note}` : baseUser, target === uid ? "self" : "coach");
      const c = checkCard(parseJson(text));
      if (c.ok) {
        const { data: saved } = await db.rpc("member_style_set_card", {
          p_user: target, p_updated_at: row.updated_at, p_scores: scores, p_card: c.value, p_model: model,
        });
        if (!saved) return fail("그사이 검사를 다시 했어요 — 새로고침해 주세요");
        return json({ ok: true, card: c.value, scores });
      }
      note = c.reason;
    }
    return fail(BUSY);
  } catch (e) {
    console.error("member-style error", e instanceof Error ? e.message.slice(0, 300) : e);
    return fail(BUSY);
  }
});
