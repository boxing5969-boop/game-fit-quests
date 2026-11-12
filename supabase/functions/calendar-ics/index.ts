// 📅 calendar-ics — 운동 약속을 휴대폰 캘린더에 (2026-11-13 운동 달력 2-2단계 · 대표님 「다음」)
//
//   GET /functions/v1/calendar-ics?w=2,4&d=2026-11-17&s=evening&r=08:30&b=선릉역점
//   → text/calendar (매주 반복 일정 하나 + 알림). 아이폰(사파리 · 앱 안 사파리 창)은 '캘린더에 추가' 화면,
//     안드로이드 · 컴퓨터는 .ics 파일을 받아 캘린더 앱으로 연다.
//   DB 를 읽지 않고 주소 인자로만 만든다 — 로그인 · 키 없음(verify_jwt = false, config.toml). 사람을 알아볼 값은 받지 않는다.
//   글 · 검사는 ./ics.ts (시험 src/lib/calendarIcs.test.ts). 화면은 src/lib/promiseIcs.ts 가 주소를 만든다.
import { buildPromiseIcs, icsStamp, kstDay, parseIcsQuery } from "./ics.ts";

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

Deno.serve((req) => {
  if (req.method !== "GET" && req.method !== "HEAD") return text("GET 으로 열어 주세요", 405);
  const now = new Date();
  const input = parseIcsQuery(new URL(req.url).searchParams, kstDay(now));
  if ("error" in input) return text(input.error, 400);
  const body = buildPromiseIcs(input, icsStamp(now));
  return new Response(req.method === "HEAD" ? null : body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="153-promise.ics"',
      "Cache-Control": "no-store",
    },
  });
});
