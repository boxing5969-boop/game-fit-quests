export interface WeeklyMetrics {
  activityMinutes: number;
  strengthDays: number;
  averageRpe: number;
  highIntensitySessions: number;
  balanceSessions: number;
  isOver65: boolean;
  hasBalanceFlag: boolean;
}

export const DASHBOARD_MOCK_METRICS: WeeklyMetrics = {
  activityMinutes: 95,
  strengthDays: 1,
  averageRpe: 4,
  highIntensitySessions: 1,
  balanceSessions: 0,
  isOver65: false,
  hasBalanceFlag: false,
};

export const ACTIVITY_ZONES = [
  { min: 0, max: 149, label: "시작 구간", color: "text-muted-foreground", description: "조금씩 늘려보세요" },
  { min: 150, max: 299, label: "건강 권장 구간", color: "text-status-complete", description: "WHO 권고 충족" },
  { min: 300, max: Infinity, label: "추가 이점 구간", color: "text-primary", description: "더 많은 건강 이점" },
] as const;

export function getActivityZone(minutes: number) {
  return ACTIVITY_ZONES.find(z => minutes >= z.min && minutes <= z.max) || ACTIVITY_ZONES[0];
}
