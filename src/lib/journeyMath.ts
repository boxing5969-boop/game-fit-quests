/**
 * 레벨 40까지 가는 길 — 소요 기간 계산 (2026-09-22).
 *
 * 규칙 숫자(리그별 필요 횟수·최소 일수·보너스 상한)는 전부 서버(get_levelup_rules,
 * get_workout_rules)에서 받는다. 이 파일은 그 숫자로 "며칠 걸리나"만 계산한다 —
 * 판정 함수(auto_advance_from_attendance)와 같은 식: 출석 1회 = 1.0, 오래 운동하면 최대 maxProgress.
 *
 * 패스(pass) = 한 레벨을 넘는 것. 화이트 L1→L2 … L9→L10 아홉 번 + L10→블루 L1(타이틀매치) 한 번 = 10패스.
 * 마지막 리그(블랙)는 L10 이 곧 레벨 40 이라 9패스.
 *
 * 순수 함수만 — node 로 바로 검증할 수 있다 (UI·네트워크 없음).
 */

export interface LeagueRule {
  rank: string;
  firstLevel: number;
  lastLevel: number;
  visitsPerLevel: number;
  minDaysPerLevel: number;
  autoAdvance: boolean;
}

export interface WorkoutRules {
  /** 종료를 안 누르면 기록되는 분 (50) */
  defaultMinutes: number;
  /** 이 분 이상이면 보너스가 더 안 오른다 (120) */
  bonusCapMinutes: number;
  /** 한 번 출석의 최대 진행량 (1.25) */
  maxProgress: number;
}

export interface MyPosition {
  rank: string;
  /** 리그 안 레벨 1~10 */
  currentLevel: number;
  /** 이번 레벨에서 쌓인 진행량 (예: 2.25) */
  progress: number;
  /** 이번 레벨에 머문 일수 */
  elapsedDays: number;
}

export interface LeaguePlan {
  rank: string;
  passes: number;
  visitsPerPass: number;
  visits: number;
  minDaysPerPass: number;
}

/** 리그별 패스 수·필요 출석. 마지막 리그는 L10 이 종점이라 한 패스 적다. */
export function leaguePlans(rules: LeagueRule[]): LeaguePlan[] {
  const sorted = [...rules].sort((a, b) => a.firstLevel - b.firstLevel);
  return sorted.map((r, i) => {
    const isLast = i === sorted.length - 1;
    const levels = r.lastLevel - r.firstLevel + 1;
    const passes = isLast ? levels - 1 : levels;
    return {
      rank: r.rank,
      passes,
      visitsPerPass: r.visitsPerLevel,
      visits: passes * r.visitsPerLevel,
      minDaysPerPass: r.minDaysPerLevel ?? 0,
    };
  });
}

export function totalVisits(rules: LeagueRule[]): number {
  return leaguePlans(rules).reduce((s, p) => s + p.visits, 0);
}

/** 한 패스에 걸리는 일수: 필요 출석을 보너스로 나눠 주당 횟수로 채우는 시간과 최소 일수 중 큰 쪽. */
function passDays(visitsNeeded: number, perWeek: number, bonus: number, minDays: number): number {
  if (perWeek <= 0) return Number.POSITIVE_INFINITY;
  const byVisits = (visitsNeeded / bonus / perWeek) * 7;
  return Math.max(byVisits, minDays);
}

/** 화이트 L1 출발, 레벨 40 까지 총 일수. bonus 1.0 = 매번 기본(50분), maxProgress = 매번 120분. */
export function daysToLevel40(rules: LeagueRule[], perWeek: number, bonus = 1): number {
  return leaguePlans(rules).reduce(
    (s, p) => s + passDays(p.visitsPerPass, perWeek, bonus, p.minDaysPerPass) * p.passes,
    0,
  );
}

/** 지금 위치에서 레벨 40 까지 남은 일수. */
export function remainingDaysToLevel40(
  rules: LeagueRule[],
  me: MyPosition,
  perWeek: number,
  bonus = 1,
): number {
  const plans = leaguePlans(rules);
  const idx = plans.findIndex((p) => p.rank === me.rank);
  if (idx < 0) return daysToLevel40(rules, perWeek, bonus);
  const sorted = [...rules].sort((a, b) => a.firstLevel - b.firstLevel);
  const rule = sorted[idx];
  const cur = plans[idx];
  const isLast = idx === plans.length - 1;
  const levels = rule.lastLevel - rule.firstLevel + 1;
  // 이 리그에서 남은 패스: L1 이면 전부, L10 이면 (마지막 리그가 아닐 때) 타이틀매치 1번
  const level = Math.min(Math.max(me.currentLevel, 1), levels);
  const remainingPasses = isLast ? levels - level : levels - level + 1;
  if (remainingPasses <= 0) return 0;

  // 지금 진행 중인 패스 — 이미 쌓인 진행량·머문 일수만큼 빼준다
  const leftVisits = Math.max(0, cur.visitsPerPass - Math.max(0, me.progress));
  const leftMinDays = Math.max(0, cur.minDaysPerPass - Math.max(0, me.elapsedDays));
  let days = passDays(leftVisits, perWeek, bonus, leftMinDays);
  // 이 리그의 나머지 패스
  days += passDays(cur.visitsPerPass, perWeek, bonus, cur.minDaysPerPass) * (remainingPasses - 1);
  // 다음 리그들
  for (let i = idx + 1; i < plans.length; i++) {
    const p = plans[i];
    days += passDays(p.visitsPerPass, perWeek, bonus, p.minDaysPerPass) * p.passes;
  }
  return days;
}

/** 지금 위치에서 레벨 40 까지 남은 출석 횟수(기본 50분 기준, 진행량은 내림). */
export function remainingVisitsToLevel40(rules: LeagueRule[], me: MyPosition): number {
  const plans = leaguePlans(rules);
  const idx = plans.findIndex((p) => p.rank === me.rank);
  if (idx < 0) return totalVisits(rules);
  const sorted = [...rules].sort((a, b) => a.firstLevel - b.firstLevel);
  const rule = sorted[idx];
  const cur = plans[idx];
  const isLast = idx === plans.length - 1;
  const levels = rule.lastLevel - rule.firstLevel + 1;
  const level = Math.min(Math.max(me.currentLevel, 1), levels);
  const remainingPasses = isLast ? levels - level : levels - level + 1;
  if (remainingPasses <= 0) return 0;
  let visits = Math.max(0, cur.visitsPerPass - Math.floor(Math.max(0, me.progress)));
  visits += cur.visitsPerPass * (remainingPasses - 1);
  for (let i = idx + 1; i < plans.length; i++) visits += plans[i].visits;
  return visits;
}

/** 일수 → "2년 4개월" 같은 말. 30일 미만은 "이번 달 안", 무한대는 null. */
export function formatDuration(days: number): string | null {
  if (!Number.isFinite(days)) return null;
  if (days < 30) return "한 달 안";
  const months = Math.round(days / 30.4);
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m}개월`;
  if (m === 0) return `${y}년`;
  return `${y}년 ${m}개월`;
}

/** 오늘 + 일수 → "2029년 1월쯤" */
export function formatArrival(days: number, now = new Date()): string | null {
  if (!Number.isFinite(days)) return null;
  const d = new Date(now.getTime() + days * 86400000);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월쯤`;
}
