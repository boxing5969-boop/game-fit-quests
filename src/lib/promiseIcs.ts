/**
 * 📅 운동 약속 → 휴대폰 캘린더 (2026-11-13 운동 달력 2-2단계 · 대표님 「다음」)
 *   「운동 달력 2단계 보고서」: 앱 알림을 안 켠 회원에게도 휴대폰이 알려 준다(선릉 앱 알림 켠 회원 13명) · 캘린더 위젯에 약속이 보인다.
 *   Edge Function calendar-ics 주소를 만든다 — 주소 인자는 요일 · 첫 날 · 시간대 · 알림 시각 · 지점 짧은 이름뿐(사람을 알아볼 값 없음).
 *   아이폰 앱 = 앱 안 사파리 창(캘린더에 추가 화면) · 그 밖 = 그 주소로 이동(아이폰 사파리는 캘린더 화면, 안드로이드는 파일 받기).
 *   만드는 쪽 글 · 검사는 supabase/functions/calendar-ics/ics.ts (시험 calendarIcs.test.ts).
 */
import { isPromisedDay, nextPromisedDay, type Promise153 } from "@/lib/promise153";
import { isIosApp, loadIosAppNative } from "@/lib/iosApp";

/** 첫 날 — 오늘이 약속한 날이면 오늘, 아니면 다음 약속한 날 */
export function promiseIcsStart(p: Pick<Promise153, "weekdays" | "startedOn">, today: string): string | null {
  return isPromisedDay(p, today) ? today : nextPromisedDay(p, today);
}

/** calendar-ics 주소 (base = VITE_SUPABASE_URL) — 약속이 없거나 주소를 못 만들면 null */
export function promiseIcsUrl(base: string | null | undefined, p: Promise153 | null, today: string, branchShort: string | null): string | null {
  if (!base || !p || p.weekdays.length === 0) return null;
  const d = promiseIcsStart(p, today);
  if (!d) return null;
  const q = new URLSearchParams({ w: [...p.weekdays].sort((a, b) => a - b).join(","), d });
  if (p.timeSlot) q.set("s", p.timeSlot);
  if (p.remind) q.set("r", p.remind);
  if (branchShort) q.set("b", branchShort);
  return `${base.replace(/\/+$/, "")}/functions/v1/calendar-ics?${q.toString()}`;
}

/** 휴대폰 캘린더에 넣기 — 아이폰 앱은 앱 안 사파리 창, 그 밖은 그 주소로(아이폰 사파리 = 캘린더 화면 · 안드로이드 = 파일 받기) */
export function openPhoneCalendar(p: Promise153 | null, today: string, branchShort: string | null): boolean {
  const url = promiseIcsUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined, p, today, branchShort);
  if (!url) return false;
  if (isIosApp()) void loadIosAppNative().then((n) => n.openInAppBrowser(url));
  else window.location.href = url;
  return true;
}
