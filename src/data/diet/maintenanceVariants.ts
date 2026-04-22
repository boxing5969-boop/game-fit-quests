/**
 * 153 다이어트 — 21일 후 유지 플랜 (Maintenance Variants).
 *
 * 21일 프로그램 완주 후에도 지속 가능한 습관을 고르도록 4가지 라이프
 * 스타일 분기를 제공한다. 사용자가 자기 패턴을 한 가지 고르면 그에
 * 맞는 체크리스트가 홈에 배치되는 구조(Stage 4+ UI 에서 소비).
 *
 * 문구는 모두 자체 작성 — 외부 자료 직접 인용 없이 앱 컨텍스트에 맞는
 * 짧은 한국어로 재구성한다.
 */

export type DietMaintenanceVariantId =
  | "early_bird"       // 아침형
  | "night_owl"        // 저녁형
  | "social_eater"     // 외식 많은 직장인형
  | "weekend_relapse"; // 주말에 무너지는 사람

export interface DietMaintenanceVariant {
  id: DietMaintenanceVariantId;
  title: string;
  summary: string;
  /** 이 유형의 사용자가 다음 7일 동안 지킬 만한 체크리스트 (3~5개) */
  tips: readonly string[];
}

export const DIET_MAINTENANCE_VARIANTS: readonly DietMaintenanceVariant[] = Object.freeze([
  {
    id: "early_bird",
    title: "아침형",
    summary: "하루의 무게 중심이 오전에 있는 사람",
    tips: [
      "아침 단백질 30g 기본 (계란 2개 + 두유 or 요거트).",
      "점심은 탄수 포함해도 OK — 오후 활동이 받쳐준다.",
      "저녁은 가볍게 — 단백질 + 채소 위주, 탄수는 반 공기.",
      "밤 9시 이후 커피·단 음료 끊기 (수면 질 보호).",
    ],
  },
  {
    id: "night_owl",
    title: "저녁형",
    summary: "업무·일정이 저녁에 몰리는 사람",
    tips: [
      "아침은 부담 없이 — 달걀 1개 + 과일 한 조각이면 충분.",
      "점심은 단백질 중심으로 에너지 확보.",
      "저녁은 식사 대신 야식이 되지 않도록 '식사답게' 챙기기.",
      "취침 3시간 전 마지막 음식 — 무너졌으면 다음 날 오전에 보정.",
    ],
  },
  {
    id: "social_eater",
    title: "외식 많은 직장인형",
    summary: "회식·약속으로 외식 빈도가 높은 사람",
    tips: [
      "약속 전 단백질 간식 한 입 — 폭식 방지.",
      "메뉴 먼저 보고 '단백질 + 채소' 1접시 확보 후 나머지.",
      "술 자리는 주 1회 상한. 무알콜/저알콜 옵션 익혀두기.",
      "다음 끼니는 평소대로 — 보상 식사로 연속 무너지지 않기.",
    ],
  },
  {
    id: "weekend_relapse",
    title: "주말에 무너지는 사람",
    summary: "평일은 잘 지키지만 주말에 리듬이 깨지는 사람",
    tips: [
      "금요일 저녁에 주말 식단·활동 계획 10분 짜기.",
      "토요일 브런치는 단백질 + 채소 기본 템플릿.",
      "주말 한 끼 무너졌어도 다음 끼니 즉시 복귀.",
      "일요일 저녁은 다음 주 월요일 리셋을 준비하는 '가벼운 저녁'.",
    ],
  },
] as const);

/** id → variant 룩업. 없으면 null. */
export function getMaintenanceVariant(
  id: DietMaintenanceVariantId,
): DietMaintenanceVariant | null {
  return DIET_MAINTENANCE_VARIANTS.find((v) => v.id === id) ?? null;
}
