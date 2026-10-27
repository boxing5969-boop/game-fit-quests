// 🏢 지점 회의실 3단계 — 오삼코치 3줄 요약 (2026-10-27 대표님 "다음단계진행할까?" · 「지점 회의실 상세 보고서」 3단계 '불참자 요약')
//
//   회의를 끝낼 때(끝내기 시트) · 회의록에서 대표님 · 지점장이 부른다. verify_jwt = true (로그인한 앱 사용자만).
//   POST { meeting_id }
//     1) 부른 사람 토큰으로 office_recap(회의) — 그 지점 회의실 사람만 · 요약은 대표님 · 지점장만(host)
//     2) office_messages(회의) — 채팅 · 정한 것(시스템 줄 빼고) → Haiku 5.5 에 3줄 요약(JSON — summary.ts)
//     3) 검사(이모지 · 기호 · 빈 줄 · 길이) 뒤 office_save_summary(회의, 줄, 'ai') — 부른 사람 토큰으로(서버가 다시 권한 확인)
//   채팅 원문은 저장하지 않는다(요약 세 줄만 office_meetings.summary). 사용량 ai_usage_log feature 'meeting_summary' · 사람마다 하루 20번.
//   키(ANTHROPIC_API_KEY)가 없거나 한도 · 오류면 503/429/502 — 화면은 요약 없이 회의를 끝낸다(정한 것만 지시 · 알림에).
//   미리보기(DB 에 안 씀): body { meeting_id, preview: true } — 저장하지 않고 줄만 돌려준다(말 1줄부터, 점검용).
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildClaudeBody,
  CLAUDE_COACH_MODEL,
  claudeMessage,
  hasClaude,
  keepAlive,
  logAiUsage,
  messageText,
  usageOf,
} from "../_shared/claude.ts";
import {
  buildSummaryPrompt,
  cleanSummaryLines,
  parseSummaryJson,
  SUMMARY_SCHEMA,
  SUMMARY_SYSTEM,
  talkCount,
  type Minutes,
} from "./summary.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAILY_LIMIT = 20;
const AI_FAILED = "지금은 정리하지 못했어요 — 잠시 후 다시 눌러 주세요";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  if (!/^Bearer\s+\S+/i.test(auth)) return json({ ok: false, error: "not_authenticated", message: "다시 로그인해 주세요" }, 401);
  const body: any = await req.json().catch(() => ({}));
  const meetingId = String(body?.meeting_id ?? "");
  const preview = body?.preview === true;
  if (!UUID.test(meetingId)) return json({ ok: false, error: "bad_meeting", message: "회의를 찾을 수 없어요" }, 400);
  if (!hasClaude()) return json({ ok: false, error: "ai_unavailable", message: "지금은 오삼코치 요약을 쓸 수 없어요" }, 503);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const asUser = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: who } = await asUser.auth.getUser();
  const uid = who?.user?.id;
  if (!uid) return json({ ok: false, error: "not_authenticated", message: "다시 로그인해 주세요" }, 401);

  // 권한 — 그 지점 회의실 사람만, 요약은 대표님 · 지점장만 (DB 가 매번 판단)
  const { data: recap, error: rErr } = await asUser.rpc("office_recap", { p_meeting: meetingId });
  if (rErr || !recap) return json({ ok: false, error: "forbidden", message: rErr?.message || "이 회의를 볼 수 없어요" }, 403);
  if (!recap.host) return json({ ok: false, error: "forbidden", message: "회의 요약은 대표님 · 지점장님이 만들어요" }, 403);

  const { data: minutes, error: mErr } = await asUser.rpc("office_messages", { p_meeting: meetingId });
  if (mErr || !minutes) return json({ ok: false, error: "forbidden", message: mErr?.message || "회의록을 읽지 못했어요" }, 403);
  const m = minutes as Minutes;
  const talk = talkCount(m);
  if (talk < (preview ? 1 : 2)) return json({ ok: false, error: "too_short", message: "요약할 이야기가 아직 적어요" }, 400);

  // 사람마다 하루 20번 (요금 방어 — 집계가 실패하면 넘어간다)
  const db = SERVICE ? createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } }) : null;
  if (db) {
    try {
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { count } = await db
        .from("ai_usage_log")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .eq("feature", "meeting_summary")
        .gte("created_at", since);
      if ((count ?? 0) >= DAILY_LIMIT) {
        return json({ ok: false, error: "daily_limit", message: "오늘은 요약을 많이 만들었어요 — 내일 다시 써 주세요" }, 429);
      }
    } catch (_e) {
      /* 집계 실패는 무시 */
    }
  }

  let lines: string[] = [];
  try {
    const model = CLAUDE_COACH_MODEL;
    const msg = await claudeMessage(
      buildClaudeBody({
        model,
        system: [SUMMARY_SYSTEM],
        messages: [{ role: "user", content: buildSummaryPrompt(m) }],
        maxTokens: 1200,
        jsonSchema: SUMMARY_SCHEMA,
      }),
    );
    keepAlive(
      logAiUsage(db, { feature: "meeting_summary", model, usage: usageOf(msg), userId: uid, meta: { meeting_id: meetingId, talk, preview } }),
    );
    if (msg.stop_reason === "refusal") throw new Error("refusal");
    lines = cleanSummaryLines(parseSummaryJson(messageText(msg)));
  } catch (e) {
    console.error("office-summary failed", e instanceof Error ? e.message.slice(0, 300) : e);
    return json({ ok: false, error: "ai_failed", message: AI_FAILED }, 502);
  }
  if (lines.length === 0) return json({ ok: false, error: "ai_failed", message: AI_FAILED }, 502);
  if (preview) return json({ ok: true, lines, preview: true });

  const { data: saved, error: sErr } = await asUser.rpc("office_save_summary", { p_meeting: meetingId, p_lines: lines, p_by: "ai" });
  if (sErr) return json({ ok: false, error: "save_failed", message: sErr.message, lines }, 500);
  return json({ ok: true, lines: Array.isArray(saved) && saved.length ? saved : lines });
});
