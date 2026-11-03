// 💬 member-voice-receipt — 고객의 소리 영수증 · 내가 보낸 고객의 소리 (2026-11-03 대표님 "고객의 소리에도 답변 달수있게해줘")
//
// 만족도 조사처럼 고객의 소리에도 본사 답변이 '보낸 회원에게만' 가게 한다(20261103175430_voice_replies.sql).
// 고객의 소리는 지금처럼 153OS 공개 경로(/api/feedback/submit)로 익명 저장되는데, 그 길은 글 번호를 돌려주지 않는다.
// 그래서 회원 화면(src/services/memberSurveyService.ts)이 보낸 직후 이 함수를 부른다. verify_jwt = true.
//
//   op "claim" { slug, category, content, rating } — 153OS 에서 그 의견함의 방금(10분 안) 들어온 같은 분류 · 같은 글 ·
//     같은 별점 줄을 찾아, 아직 영수증이 없는 줄이 하나뿐이면 앱 DB survey_receipts(kind 'feedback')에 '보낸 회원'으로 남긴다.
//     겹치거나 없으면 남기지 않는다(QR 처럼 답변은 저장만). 회원이 번호를 고를 수 없게 서버 키로만 쓴다.
//   op "mine" — 내가 보낸 고객의 소리 원문(153OS)을 '내가 보낸 의견'에 같이 보여 주려고 — 내 영수증 번호만 읽는다.
//
// 답은 늘 200 { ok: true, … } | { ok: false, code } — 화면은 실패해도 고객의 소리 제출 자체는 끝난 것으로 둔다.
// 153OS 는 서버 키(OS_SERVICE_KEY — member-voice-inbox · survey-auto-reply 와 같은 시크릿). 로그에는 op · 결과 코드만(글 · 이름 안 찍음).
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { parseClaim, pickClaim, voiceTitle } from "./logic.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });

const CLAIM_WINDOW_MS = 10 * 60 * 1000;
const MINE_LIMIT = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const OS_URL = Deno.env.get("OS_SUPABASE_URL") || "https://tbxdrfowanyksgdicryl.supabase.co";
  const OS_KEY = Deno.env.get("OS_SERVICE_KEY") || "";
  if (!OS_KEY) return json({ ok: false, code: "OS_NOT_CONFIGURED" });

  // 1) 부른 회원
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const app = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
  const { data: who } = token ? await app.auth.getUser(token) : { data: null };
  const uid = who?.user?.id ?? null;
  if (!uid) return json({ ok: false, code: "NOT_AUTHENTICATED" });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const op = String(body?.op ?? "");
  const os = createClient(OS_URL, OS_KEY, { auth: { persistSession: false } });

  // 2) 내가 보낸 고객의 소리 원문 — 내 영수증 번호만
  if (op === "mine") {
    const { data: mine, error } = await app
      .from("survey_receipts")
      .select("response_id")
      .eq("user_id", uid)
      .eq("kind", "feedback")
      .order("submitted_at", { ascending: false })
      .limit(MINE_LIMIT);
    if (error) {
      console.error("member-voice-receipt mine receipts", error.code);
      return json({ ok: false, code: "APP_READ_FAILED" });
    }
    const ids = (mine ?? []).map((r: any) => r.response_id as string);
    if (!ids.length) return json({ ok: true, items: [] });
    const { data: rows, error: osErr } = await os.from("member_feedback").select("id, category, rating, content, coach_name").in("id", ids);
    if (osErr) {
      console.error("member-voice-receipt mine os", osErr.code);
      return json({ ok: false, code: "OS_UNAVAILABLE" });
    }
    const items = (rows ?? []).map((f: any) => ({
      id: f.id,
      category: f.category ?? "free",
      rating: typeof f.rating === "number" ? f.rating : null,
      content: String(f.content ?? "").slice(0, 2000),
      coach: f.coach_name || null,
    }));
    return json({ ok: true, items });
  }

  if (op !== "claim") return json({ ok: false, code: "INVALID_REQUEST" });

  // 3) 방금 낸 고객의 소리 → 영수증
  const input = parseClaim(body);
  if (!input) return json({ ok: false, code: "INVALID_REQUEST" });

  const { data: ch } = await os.from("member_feedback_channels").select("id").eq("slug", input.slug).maybeSingle();
  if (!ch?.id) return json({ ok: false, code: "NOT_FOUND" });

  // 글 비교는 여기서 — 긴 글(2000자)을 주소에 실으면 요청이 너무 길어진다. 10분 · 한 의견함 · 한 분류라 줄이 몇 개 안 된다
  const since = new Date(Date.now() - CLAIM_WINDOW_MS).toISOString();
  const { data: rows, error: osErr } = await os
    .from("member_feedback")
    .select("id, rating, created_at, content")
    .eq("channel_id", ch.id)
    .eq("category", input.category)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50);
  if (osErr) {
    console.error("member-voice-receipt claim os", osErr.code);
    return json({ ok: false, code: "OS_UNAVAILABLE" });
  }
  const found = ((rows ?? []) as { id: string; rating: number | null; created_at: string; content: string | null }[]).filter(
    (r) => (r.content ?? "").trim() === input.content,
  );
  const { data: taken } = found.length
    ? await app.from("survey_receipts").select("response_id").in("response_id", found.map((r) => r.id))
    : { data: [] as { response_id: string }[] };
  const pick = pickClaim(found, input.rating, new Set((taken ?? []).map((r: any) => r.response_id as string)));
  if (!pick.id) {
    console.log("member-voice-receipt claim", pick.reason);
    return json({ ok: false, code: pick.reason === "ambiguous" ? "AMBIGUOUS" : "NOT_FOUND" });
  }

  const { data: prof } = await app.from("profiles").select("branch_name").eq("user_id", uid).maybeSingle();
  const row = found.find((r) => r.id === pick.id)!;
  const { data: ins, error: insErr } = await app
    .from("survey_receipts")
    .upsert(
      {
        response_id: pick.id,
        user_id: uid,
        branch_name: (prof as any)?.branch_name ?? null,
        survey_title: voiceTitle(input.category),
        submitted_at: row.created_at,
        kind: "feedback",
      },
      { onConflict: "response_id", ignoreDuplicates: true },
    )
    .select("response_id");
  if (insErr) {
    console.error("member-voice-receipt claim insert", insErr.code);
    return json({ ok: false, code: "APP_WRITE_FAILED" });
  }
  // 그 사이 다른 회원이 같은 줄을 먼저 남겼으면(같은 글이 겹침) 내 것으로 치지 않는다
  if (!ins?.length) return json({ ok: false, code: "AMBIGUOUS" });
  console.log("member-voice-receipt claim ok");
  return json({ ok: true, id: pick.id });
});
