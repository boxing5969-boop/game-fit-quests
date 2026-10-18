// 받은 설문·고객의 소리 — 본사 전용 읽기 (2026-10-18 대표님: "설문조사랑 앱 오류 신고 … 회원님들이 보낸 것 자세히 볼 수 있게").
//
// 만족도 조사 응답과 고객의 소리는 일일경영리포트(153OS) DB 에 저장된다 (앱 설문 화면도 QR 과 같은 공개 경로로 보낸다).
// 앱 화면(설문·소리함 → 받은 응답)이 이 함수를 부르면:
//   1) 부른 사람이 앱의 본사(super_admin · admin)인지 확인하고
//   2) 153OS 를 서버 키(OS_SERVICE_KEY — 서버에만 있다)로 읽어 최근 6개월 것만 돌려준다.
// 읽기 전용이다. 처리 상태 바꾸기·답장은 경영리포트에서 한다. 연락처는 가운데를 가려서 보낸다.
// verify_jwt = true (로그인한 앱 사용자만).
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const DAY = 86400000;
const LOOKBACK_DAYS = 180;
const LIMIT = 80;

const maskPhone = (p: unknown): string | null => {
  const d = String(p ?? "").replace(/\D/g, "");
  if (d.length < 8) return null;
  return `${d.slice(0, 3)}-****-${d.slice(-4)}`;
};
const one = (v: any) => (Array.isArray(v) ? v[0] ?? null : v ?? null);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const OS_URL = Deno.env.get("OS_SUPABASE_URL") || "https://tbxdrfowanyksgdicryl.supabase.co";
  const OS_KEY = Deno.env.get("OS_SERVICE_KEY") || "";
  if (!OS_KEY) return json({ error: "os_not_configured" }, 500);

  // 1) 본사인지 확인
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "not_authenticated" }, 401);
  const app = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
  const { data: who, error: whoErr } = await app.auth.getUser(token);
  if (whoErr || !who?.user) return json({ error: "not_authenticated" }, 401);
  const { data: roles, error: roleErr } = await app
    .from("user_roles")
    .select("role")
    .eq("user_id", who.user.id)
    .in("role", ["super_admin", "admin"])
    .limit(1);
  if (roleErr) return json({ error: "role_check_failed" }, 500);
  if (!roles?.length) return json({ error: "forbidden" }, 403);

  // 2) 153OS 읽기
  const os = createClient(OS_URL, OS_KEY, { auth: { persistSession: false } });
  const since = new Date(Date.now() - LOOKBACK_DAYS * DAY).toISOString();
  const [s, v] = await Promise.all([
    os
      .from("survey_responses")
      .select(
        "id, submitted_at, is_anonymous, respondent_name, branches(name), survey_templates(title), members(name), survey_answers(answer_text, answer_score, survey_questions(question_text, question_type, order_index, options))",
      )
      .gte("submitted_at", since)
      .order("submitted_at", { ascending: false })
      .limit(LIMIT),
    os
      .from("member_feedback")
      .select("id, created_at, category, rating, content, coach_name, draw_opt_in, contact_name, contact_phone, status, branches(name)")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
  ]);
  if (s.error || v.error) {
    console.error("member-voice-inbox os query", s.error?.message ?? v.error?.message);
    return json({ error: "os_query_failed" }, 502);
  }

  const surveys = (s.data ?? []).map((r: any) => {
    const answers = (r.survey_answers ?? [])
      .map((a: any) => {
        const q = one(a.survey_questions);
        const max = Number(q?.options?.max);
        return {
          q: String(q?.question_text ?? ""),
          type: String(q?.question_type ?? "text"),
          order: Number(q?.order_index ?? 0),
          text: a.answer_text ?? null,
          score: a.answer_score ?? null,
          max: Number.isFinite(max) && max > 0 ? max : null,
        };
      })
      .sort((a: any, b: any) => a.order - b.order);
    const rated = answers.filter((a: any) => a.type === "rating" && typeof a.score === "number");
    const avg = rated.length ? Math.round((rated.reduce((n: number, a: any) => n + a.score, 0) / rated.length) * 10) / 10 : null;
    const name = r.is_anonymous ? null : r.respondent_name || one(r.members)?.name || null;
    return {
      id: r.id,
      at: r.submitted_at,
      branch: one(r.branches)?.name ?? null,
      title: one(r.survey_templates)?.title ?? "설문",
      anonymous: !!r.is_anonymous,
      who: name,
      avg,
      answers: answers.map(({ order: _o, ...rest }: any) => rest),
    };
  });

  const voices = (v.data ?? []).map((f: any) => ({
    id: f.id,
    at: f.created_at,
    branch: one(f.branches)?.name ?? null,
    category: f.category ?? "free",
    rating: typeof f.rating === "number" ? f.rating : null,
    content: f.content ?? "",
    coach: f.coach_name || null,
    draw: !!f.draw_opt_in,
    who: f.contact_name || null,
    phone: maskPhone(f.contact_phone),
    status: f.status ?? "new",
  }));

  return json({ surveys, voices, since });
});
