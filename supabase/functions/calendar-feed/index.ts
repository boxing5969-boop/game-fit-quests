// 📅 calendar-feed — 구독 주소: 휴대폰 · 구글 캘린더에서 153 일정이 저절로 (2026-11-13 캘린더 3-1단계 · 대표님 「추천대로 3-1부터」)
//
//   GET /functions/v1/calendar-feed/<토큰 64자>.ics         → 코치진(내 일정 · 근무 · 153 일정 · 정기 회의) 또는 회원(운동 약속 · 153 일정 · D-day)
//   GET /functions/v1/calendar-feed/branch/<지점 코드>.ics   → 그 지점 153 일정(승급 심사 빼고 · 사람 정보 없음)
//   ?download=1 = 파일로 받기 (Content-Disposition attachment)
//   캘린더 앱은 로그인하지 않으므로 verify_jwt = false(config.toml) — 토큰이 열쇠다. DB 는 서버 키로 함수만 부른다:
//     calendar_feed_data(p_token) · calendar_feed_branch(p_code) — 마이그레이션 20261113125736_calendar_feed.sql
//   끊긴 · 없는 · 권한이 없어진 주소 = 빈 달력(200) — 404 면 그 캘린더가 지난 일정을 계속 보여 준다.
//   DB 가 잠깐 안 되면 503(캘린더는 지난 일정 그대로) · 하루 상한을 넘으면 429.
//   .ics 만들기 · 주소 읽기는 ./feed.ts (시험 src/lib/calendarFeed.test.ts).
import { icsStamp } from "../calendar-ics/ics.ts";
import { buildFeedIcs, emptyFeed, feedFileName, normalizeFeedData, parseFeedPath } from "./feed.ts";

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const text = (body: string, status: number, extra: Record<string, string> = {}) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...extra } });

/** DB 함수 부르기 (서버 키 · 8초) — 실패면 ok:false */
async function rpc(fn: string, args: Record<string, unknown>): Promise<{ ok: true; data: unknown } | { ok: false }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(args),
      signal: ctrl.signal,
    });
    if (!r.ok) return { ok: false };
    const raw = await r.text();
    return { ok: true, data: raw ? JSON.parse(raw) : null };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") return text("GET 으로 열어 주세요", 405, { Allow: "GET, HEAD" });
  const url = new URL(req.url);
  const target = parseFeedPath(url.pathname, url.searchParams);
  if (!target) return text("주소를 다시 확인해 주세요", 404);
  if (!SUPABASE_URL || !SERVICE) return text("잠시 후 다시 시도해 주세요", 503, { "Retry-After": "600" });

  const res = "token" in target
    ? await rpc("calendar_feed_data", { p_token: target.token })
    : await rpc("calendar_feed_branch", { p_code: target.branch });
  if (!res.ok) return text("잠시 후 다시 시도해 주세요", 503, { "Retry-After": "600" });
  if (res.data && typeof res.data === "object" && (res.data as Record<string, unknown>).limited === true) {
    return text("오늘은 이 주소를 너무 많이 읽었어요 — 내일 다시 읽어 주세요", 429, { "Retry-After": "3600" });
  }

  const data = normalizeFeedData(res.data);
  if ("branch" in target && !data) return text("없는 지점 주소예요", 404);
  const feed = data ?? emptyFeed();
  const body = buildFeedIcs(feed, icsStamp(new Date()));
  const download = url.searchParams.get("download") === "1";
  return new Response(req.method === "HEAD" ? null : body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${feedFileName(feed.kind)}"`,
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
});
