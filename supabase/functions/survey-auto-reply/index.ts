// 만족도 조사 자동 답변 · 의견 알림 — 크론이 15분마다 부른다 (2026-10-30 대표님)
//   · 긍정만 한 응답(별점 4점 이상 · '특별히 없습니다' · 적은 글 없음 · 추천 '예') → 낸 지 24시간이 지나도 답변이 없으면
//     대표님이 마지막으로 직접 단 답변 계정 이름으로 대신 답변(survey_replies.auto = true). 한국 시각 9~21시에만 단다.
//     앱에서 낸 설문(survey_receipts)이면 보낸 회원에게 알림 — 직접 단 답변과 똑같이.
//   · 의견 · 개선 · 낮은 점수 · 적은 글이 있는 응답 → 답변이 없으면 대표님께 알림 한 번(한국 시각 8~22시).
//   · 대표님이 먼저 답을 달면 그 응답은 건드리지 않는다. 대표님 답변은 절대 덮어쓰지 않는다.
//   · 응답은 일일경영리포트(153OS)에서 읽는다(OS_SERVICE_KEY). 최근 14일만.
//   · x-auto-key(internal_sync_config.auto_sync_key) · verify_jwt = false (config.toml).
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { classify, composeReply, kstHour, type AnswerIn } from "./logic.ts";

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const DAY = 86400000;
const LOOKBACK_DAYS = 14;
const one = (v: any) => (Array.isArray(v) ? v[0] ?? null : v ?? null);
const shortBranch = (b: string | null) => (b ? b.replace(/^153복싱짐\s*/, "") : "");

Deno.serve(async (req) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const OS_URL = Deno.env.get("OS_SUPABASE_URL") || "https://tbxdrfowanyksgdicryl.supabase.co";
  const OS_KEY = Deno.env.get("OS_SERVICE_KEY") || "";
  const app = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

  const provided = req.headers.get("x-auto-key") || "";
  const { data: cfg } = await app.from("internal_sync_config").select("value").eq("key", "auto_sync_key").maybeSingle();
  if (!provided || !cfg?.value || provided !== cfg.value) return json({ error: "forbidden" }, 403);
  if (!OS_KEY) return json({ error: "os_not_configured" }, 500);

  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dry_run === true;
  const now = new Date();
  const hour = kstHour(now);

  // 1) 153OS 최근 응답
  const os = createClient(OS_URL, OS_KEY, { auth: { persistSession: false } });
  const since = new Date(now.getTime() - LOOKBACK_DAYS * DAY).toISOString();
  const { data: rows, error } = await os
    .from("survey_responses")
    .select(
      "id, submitted_at, branches(name), survey_templates(title), survey_answers(answer_text, answer_score, survey_questions(question_text, question_type, order_index, options))",
    )
    .gte("submitted_at", since)
    .order("submitted_at", { ascending: true })
    .limit(200);
  if (error) return json({ error: "os_read_failed", detail: error.message }, 500);
  const responses = (rows ?? []) as any[];
  if (!responses.length) return json({ ok: true, seen: 0 });
  const ids = responses.map((r) => r.id as string);

  // 2) 이미 단 답변 · 처리 기록 · 보낸 회원
  const [rep, watch, rec] = await Promise.all([
    app.from("survey_replies").select("response_id").in("response_id", ids),
    app.from("survey_auto_watch").select("response_id, notified_at, auto_replied_at").in("response_id", ids),
    app.from("survey_receipts").select("response_id, user_id").in("response_id", ids),
  ]);
  const replied = new Set((rep.data ?? []).map((r: any) => r.response_id));
  const watched = new Map((watch.data ?? []).map((w: any) => [w.response_id, w]));
  const receipt = new Map((rec.data ?? []).map((r: any) => [r.response_id, r.user_id]));

  // 3) 대표님 계정 = 마지막으로 직접 단 답변의 주인 (없으면 전체관리자 아무나)
  const { data: lastManual } = await app
    .from("survey_replies")
    .select("replied_by")
    .eq("auto", false)
    .not("replied_by", "is", null)
    .order("replied_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let owner: string | null = lastManual?.replied_by ?? null;
  if (!owner) {
    const { data: sa } = await app.from("user_roles").select("user_id").eq("role", "super_admin").limit(1).maybeSingle();
    owner = sa?.user_id ?? null;
  }
  if (!owner) return json({ error: "no_owner" }, 500);

  // 최근 자동 답변 문장 — 같은 문장이 연달아 나가지 않게
  const { data: recentAuto } = await app.from("survey_replies").select("reply").eq("auto", true).order("replied_at", { ascending: false }).limit(10);
  const recentTexts = new Set((recentAuto ?? []).map((r: any) => r.reply as string));

  const out = { seen: responses.length, notified: [] as string[], auto: [] as { id: string; text: string; delivered: boolean }[], waiting: 0 };

  for (const r of responses) {
    const id = r.id as string;
    if (replied.has(id)) continue; // 대표님(또는 이미 자동)이 답을 단 응답
    const w = watched.get(id);
    const answers: AnswerIn[] = ((r.survey_answers ?? []) as any[])
      .map((a) => {
        const q = one(a.survey_questions) ?? {};
        return {
          type: String(q.question_type ?? "text"),
          question: String(q.question_text ?? ""),
          text: a.answer_text ?? null,
          score: typeof a.answer_score === "number" ? a.answer_score : null,
          max: typeof q.options?.max === "number" ? q.options.max : null,
          choices: Array.isArray(q.options?.choices) ? (q.options.choices as string[]) : null,
          order: Number(q.order_index ?? 0),
        };
      })
      .sort((x, y) => x.order - y.order);
    const v = classify(answers);
    const branch = shortBranch(one(r.branches)?.name ?? null);

    if (v.kind === "opinion") {
      if (w?.notified_at) continue;
      if (hour < 8 || hour > 22) {
        out.waiting++;
        continue;
      }
      out.notified.push(id);
      if (dryRun) continue;
      const body = [branch, ...v.reasons].filter(Boolean).join(" · ").slice(0, 160);
      await app.from("notifications").insert({ user_id: owner, title: "📋 만족도 조사에 의견이 왔어요", body, link: "/survey?inbox=1" });
      await app.from("survey_auto_watch").upsert({ response_id: id, kind: "opinion", notified_at: new Date().toISOString() });
      continue;
    }

    // 긍정만 — 24시간 지나고, 9~21시에
    if (w?.auto_replied_at) continue;
    const age = now.getTime() - new Date(r.submitted_at).getTime();
    if (age < DAY || hour < 9 || hour > 21) {
      out.waiting++;
      continue;
    }
    let text = composeReply(id, v);
    for (let salt = 1; recentTexts.has(text) && salt < 6; salt++) text = composeReply(id, v, salt);
    recentTexts.add(text);
    const to = receipt.get(id) ?? null;
    out.auto.push({ id, text, delivered: !!to });
    if (dryRun) continue;
    // 대표님 답변이 그 사이에 들어왔으면 덮어쓰지 않는다
    const { data: ins } = await app
      .from("survey_replies")
      .upsert({ response_id: id, reply: text, replied_by: owner, replied_at: new Date().toISOString(), auto: true }, { onConflict: "response_id", ignoreDuplicates: true })
      .select("response_id");
    await app.from("survey_auto_watch").upsert({ response_id: id, kind: "positive", auto_replied_at: new Date().toISOString() });
    if (ins?.length && to) {
      await app.from("notifications").insert({ user_id: to, title: "💬 만족도 조사에 답변이 왔어요", body: text.slice(0, 120), link: "/survey?mine=1" });
    }
  }

  return json({ ok: true, dry_run: dryRun, kst_hour: hour, ...out });
});
