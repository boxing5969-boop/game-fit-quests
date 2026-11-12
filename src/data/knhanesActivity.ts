/**
 * 🏃 국민건강영양조사 — 유산소 신체활동 실천율 (성 · 나이대, 19세 이상) — 「같은 나이와 비교」 체력 나이 · 운동량 (2026-11-13)
 *
 *   출처: 질병관리청 「2025년 국민건강영양조사 주요결과」(잠정치) 표 3 신체활동.
 *   정의(그대로): "일주일에 중강도 신체활동을 2시간 30분 이상 또는 고강도 신체활동을 1시간 15분 이상 또는 중강도와 고강도
 *     신체활동을 섞어서(고강도 1분은 중강도 2분) 각 활동에 상당하는 시간을 실천한 분율" — 일 · 이동 · 여가 모두 센다.
 *   앱의 권장 운동량(주 500 MET·분 — lib/achievement153, 기본 수업 2번)과 같은 '중강도 주 150분' 지침을 재는 숫자.
 *     → 「같은 나이 · 성별 한국인 중 권장 운동량을 채우는 사람」 비율 · 체력 나이 계산의 '보통 사람' (lib/fitnessAge153).
 *   19세 이상 전체 49.5% (2024 52.1%). 새 해 결과가 나오면 숫자 · 연도를 같이 바꾼다 (시험 src/lib/fitnessAge153.test.ts).
 */
import type { NormSex } from "@/data/nfaNorms";

export const KNHANES_ACTIVITY_YEAR = 2025;
export const KNHANES_ACTIVITY_SOURCE = "국민건강영양조사 2025(잠정) · 질병관리청";

export type KnhanesBand = "19-29" | "30-39" | "40-49" | "50-59" | "60-69" | "70+";
export const KNHANES_BANDS: readonly KnhanesBand[] = ["19-29", "30-39", "40-49", "50-59", "60-69", "70+"];

/** 유산소 신체활동 실천율 (%) — 남 · 여 · 성별을 모를 때 전체 */
export const KNHANES_AEROBIC_PCT: Record<NormSex | "전체", Record<KnhanesBand, number>> = {
  남: { "19-29": 64.6, "30-39": 61.7, "40-49": 50.0, "50-59": 43.4, "60-69": 39.0, "70+": 30.6 },
  여: { "19-29": 56.2, "30-39": 45.6, "40-49": 45.8, "50-59": 44.2, "60-69": 40.9, "70+": 27.8 },
  전체: { "19-29": 60.6, "30-39": 54.2, "40-49": 47.9, "50-59": 43.8, "60-69": 40.0, "70+": 29.0 },
};

/** 나이 → 국민건강영양조사 나이대 (19세 아래는 null) */
export function knhanesBand(age: number): KnhanesBand | null {
  if (!Number.isFinite(age) || age < 19) return null;
  if (age >= 70) return "70+";
  if (age < 30) return "19-29";
  const lo = Math.floor(age / 10) * 10;
  return `${lo}-${lo + 9}` as KnhanesBand;
}

/** '30대' · '19~29세' · '70대 이상' */
export function knhanesBandLabel(band: KnhanesBand): string {
  if (band === "19-29") return "19~29세";
  if (band === "70+") return "70대 이상";
  return `${band.slice(0, 2)}대`;
}
