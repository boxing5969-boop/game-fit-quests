/**
 * 🌱 출석 기록을 기분 좋게 — 회원 화면 문구 (2026-10-21 대표님)
 *   "회원님들이 주 평균을 보면 손해 본다는 생각을 하지 않을까?" → "출석 데이터를 통해 재등록과 감정이 긍정적으로 생각할 수 있도록 세팅하자"
 *
 *   원칙 — 회원 화면은 '잘한 것'만 센다:
 *     · 주 평균 · 지난달보다 줄어든 것 · 수강권 횟수 대비는 보여 주지 않는다 (관리자 · 지점장 화면에만)
 *     · 지난달과 비교는 늘었을 때만 (+N)
 *     · 연속 출석 주 · 최고 기록 · 153과 함께한 날 · 다음 축하까지 남은 횟수
 *     · 한동안 못 왔어도 탓하지 않고 '다시 시작'으로
 *   수강권이 끝나 갈 때(만료 21일 전 ~ 끝나고 14일) — 지금까지 쌓은 기록을 보여 주고 '이어 가기'로 (RenewalStoryCard)
 *   금지 표현(벨트 · 계급 · 무조건 · 확정 혜택)은 쓰지 않는다.
 */

export interface CheerInput {
  total: number;
  month: number;
  lastMonth: number;
  weekStreak: number;
  bestWeekStreak: number;
  thisWeek: boolean;
  /** 다음 축하 횟수 (50 · 100 …) — 지도진은 0 */
  next: number;
}

export interface Cheer {
  emoji: string;
  text: string;
}

const n = (v: number) => v.toLocaleString("ko-KR");

/** 지난달보다 늘었을 때만 그 차이 (줄었거나 지난달 기록이 없으면 null) */
export const monthGain = (month: number, lastMonth: number): number | null =>
  lastMonth > 0 && month > lastMonth ? month - lastMonth : null;

/** 회원에게 보여 줄 응원 한 줄 — 위에서부터 먼저 맞는 것 하나 */
export function attendanceCheer(i: CheerInput): Cheer {
  if (i.total <= 0) {
    return { emoji: "👋", text: "첫 출석을 기다리고 있어요 — 체육관에서 얼굴 인식이나 QR로 시작해요" };
  }
  const left = i.next > 0 ? i.next - i.total : 0;
  if (i.next > 0 && left > 0 && left <= 5) {
    return { emoji: "🏅", text: `${n(left)}번만 더 오면 출석 ${n(i.next)}회 축하예요` };
  }
  if (i.weekStreak >= 3) {
    const best = i.weekStreak >= i.bestWeekStreak && i.weekStreak >= 4;
    if (!i.thisWeek) return { emoji: "🔥", text: `${n(i.weekStreak)}주 연속 출석 중 — 이번 주도 이어 가요` };
    return { emoji: "🔥", text: best ? `${n(i.weekStreak)}주 연속 출석 — 내 최고 기록을 이어 가는 중이에요` : `${n(i.weekStreak)}주 연속 출석 — 한 주도 안 빠졌어요` };
  }
  const gain = monthGain(i.month, i.lastMonth);
  if (gain) {
    return { emoji: "📈", text: `이번 달 벌써 지난달보다 ${n(gain)}번 더 왔어요` };
  }
  if (i.thisWeek) {
    return { emoji: "✅", text: "이번 주도 출석 완료 — 꾸준함이 쌓이고 있어요" };
  }
  if (i.weekStreak >= 1) {
    return { emoji: "💪", text: `${n(i.weekStreak)}주 연속 출석 중 — 이번 주도 한 번 와서 이어 가요` };
  }
  return { emoji: "🥊", text: `지금까지 ${n(i.total)}번 — 이번 주 한 번이면 다시 연속 출석이 시작돼요` };
}

/** '2026-10-21' 기준 KST 오늘 */
export const kstToday = (now = Date.now()): string => new Date(now + 9 * 3600_000).toISOString().slice(0, 10);

/** 두 날짜(YYYY-MM-DD) 사이 일수 b - a */
const dayDiff = (a: string, b: string): number => {
  const pa = Date.UTC(Number(a.slice(0, 4)), Number(a.slice(5, 7)) - 1, Number(a.slice(8, 10)));
  const pb = Date.UTC(Number(b.slice(0, 4)), Number(b.slice(5, 7)) - 1, Number(b.slice(8, 10)));
  return Math.round((pb - pa) / 86400000);
};

export const RENEWAL_BEFORE_DAYS = 21;
export const RENEWAL_AFTER_DAYS = 14;

/** 수강권 끝나 가는 때인가 — 만료 21일 전 ~ 끝나고 14일. 아니면 null. ddays = 만료일 - 오늘 (0 = 오늘까지) */
export function renewalWindow(membershipEnd: string | null | undefined, today: string): { ddays: number; ended: boolean } | null {
  if (!membershipEnd || !/^\d{4}-\d{2}-\d{2}/.test(membershipEnd) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  const ddays = dayDiff(today, membershipEnd.slice(0, 10));
  if (ddays > RENEWAL_BEFORE_DAYS || ddays < -RENEWAL_AFTER_DAYS) return null;
  return { ddays, ended: ddays < 0 };
}

/** 'D-7' · '오늘까지' · '끝난 지 3일' */
export const renewalBadge = (w: { ddays: number; ended: boolean }): string =>
  w.ended ? `끝난 지 ${n(-w.ddays)}일` : w.ddays === 0 ? "오늘까지" : `D-${n(w.ddays)}`;
