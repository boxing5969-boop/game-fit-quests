/**
 * 운동 모집('오늘 같이 해요') 시간 고르기 (2026-10-28 1단계 — 「마이복서153 운동 모집 업그레이드 보고서」).
 *   예전: 오전 5시 ~ 오후 11시 19칸 목록. 지금: 내가 평소 오는 시간 앞뒤 1시간 칩 + '다른 시간'.
 *   선릉역점 회원은 출석의 84%가 평소 시간 ±1시간 안이라, 대부분 칩 하나만 누르면 된다.
 *   평소 시간은 서버(get_partner_calls 의 usualHour — 최근 60일 출석이 가장 많은 시각)가 알려 준다.
 */

/** 모집을 올릴 수 있는 시간 (서버 create_partner_call 과 같은 범위) */
export const PARTNER_HOUR_MIN = 5;
export const PARTNER_HOUR_MAX = 23;

/** 21 → '오후 9시' · 12 → '낮 12시' · 7 → '오전 7시' (서버 알림 글과 같은 말) */
export const formatHour = (h: number): string =>
  h < 12 ? `오전 ${h}시` : h === 12 ? "낮 12시" : `오후 ${h - 12}시`;

/** 한국 시간 지금 몇 시 (0~23) */
export function kstHour(d: Date = new Date()): number {
  const h = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "numeric", hourCycle: "h23" }).format(d),
  );
  return Number.isFinite(h) ? h % 24 : d.getHours();
}

/** 오늘 아직 고를 수 있는 시간 — 지금 시각부터 오후 11시까지 (새벽이면 오전 5시부터) */
export function laterHours(now: number): number[] {
  const start = Math.max(PARTNER_HOUR_MIN, now);
  const out: number[] = [];
  for (let h = start; h <= PARTNER_HOUR_MAX; h++) out.push(h);
  return out;
}

/**
 * 시간 칩 세 칸 — 평소 시간 앞뒤 1시간이 들어가게, 아직 안 지난 시간만.
 * 평소 시간을 모르거나 다 지났으면 지금부터 세 칸. 오후 11시 가까이면 남은 만큼만.
 */
export function hourChips(usual: number | null | undefined, now: number): number[] {
  const later = laterHours(now);
  if (usual != null && Number.isInteger(usual)) {
    const first = later.findIndex((h) => h >= usual - 1 && h <= usual + 1);
    if (first >= 0) {
      const start = Math.max(0, Math.min(first, later.length - 3));
      return later.slice(start, start + 3);
    }
  }
  return later.slice(0, 3);
}

/** 처음 골라 둘 시간 — 평소 시간이 칩에 있으면 그것, 아니면 첫 칩 */
export function defaultHour(usual: number | null | undefined, now: number): number | null {
  const chips = hourChips(usual, now);
  if (chips.length === 0) return null;
  return usual != null && chips.includes(usual) ? usual : chips[0];
}
