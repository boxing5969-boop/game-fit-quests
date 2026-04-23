/**
 * 153 다이어트 · 메뉴 라이브러리 (21일 이후 자동 식단 생성용).
 *
 * 각 메뉴는 추정 매크로 포함. 숫자는 USDA/한국영양학회 식품 DB 기반 대략치로,
 * 정밀 영양 관리용이 아니라 "균형 잡힌 감량/유지 식단 제안" 목적.
 *
 * 구조 규칙:
 *   · slots: 어떤 끼니에 적합한지 (복수 가능)
 *   · tags: 자연식·고단백·저탄수·저지방·채식·한식·양식·간편
 *   · patternFit: 연장 프로그램의 약점 패턴(pattern_tags)에 어떤 메뉴가 어울리는지
 *   · veg: 채식 (유제품 제외) · vegan (완전 채식) — dietary_restrictions 필터
 *
 * 목표: 30~40개 선에서 하루 식단을 다양하게 뽑을 수 있는 커버리지.
 * 더 확장 가능하나 초기엔 "누구에게나 구할 수 있는" 한국 기준 메뉴로.
 */

import type { MealSlot } from "@/lib/diet/nutritionEngine";

export interface MealItem {
  code: string;
  name: string;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  slots: MealSlot[];
  tags: string[];            // 자연식, 고단백, 저탄수, 저지방, 한식, 양식, 간편, 채식, vegan, 유제품
  patternFit?: string[];     // late_binge, eating_out, weekend_crash, workout_strong_diet_weak, diet_strong_attendance_weak, sleep_short
  note?: string;             // 준비 팁 한 줄
}

export const MEAL_LIBRARY: MealItem[] = [
  // ─── 아침 ───────────────────────────────────────────────────────
  {
    code: "bf_oatmeal_banana",
    name: "귀리 오트밀 + 바나나 + 그릭요거트",
    kcal: 380, proteinG: 18, fatG: 8, carbsG: 60,
    slots: ["breakfast"],
    tags: ["자연식", "한식", "간편", "유제품"],
    patternFit: ["late_binge", "sleep_short"],
    note: "오트 40g + 바나나 1개 + 그릭요거트 100g. 포만감·혈당 안정 아침.",
  },
  {
    code: "bf_egg_toast",
    name: "통밀빵 + 스크램블 에그 2개 + 방울토마토",
    kcal: 420, proteinG: 24, fatG: 16, carbsG: 42,
    slots: ["breakfast"],
    tags: ["고단백", "양식", "간편"],
    patternFit: ["workout_strong_diet_weak"],
    note: "통밀 2쪽 · 달걀 2 · 올리브유 1ts. 단백질 우선 아침.",
  },
  {
    code: "bf_tofu_rice_bowl",
    name: "두부 부침 + 현미밥 + 김 + 나물",
    kcal: 400, proteinG: 22, fatG: 10, carbsG: 55,
    slots: ["breakfast", "lunch"],
    tags: ["한식", "고단백", "채식", "자연식"],
    patternFit: ["diet_strong_attendance_weak"],
    note: "두부 150g + 현미 130g. 나물 1~2종 추가.",
  },
  {
    code: "bf_protein_shake",
    name: "프로틴 쉐이크 + 아몬드 한 줌",
    kcal: 260, proteinG: 26, fatG: 10, carbsG: 14,
    slots: ["breakfast", "snack"],
    tags: ["고단백", "간편"],
    patternFit: ["diet_strong_attendance_weak", "workout_strong_diet_weak"],
    note: "우유/두유 250ml + 프로틴 1스쿱. 바쁜 아침 구제용.",
  },

  // ─── 점심 ───────────────────────────────────────────────────────
  {
    code: "lu_chicken_salad",
    name: "닭가슴살 샐러드 볼 (퀴노아·채소)",
    kcal: 480, proteinG: 42, fatG: 14, carbsG: 45,
    slots: ["lunch", "dinner"],
    tags: ["고단백", "양식", "자연식"],
    patternFit: ["workout_strong_diet_weak", "eating_out"],
    note: "닭가슴살 120g + 퀴노아 80g + 샐러드 2줌 + 발사믹.",
  },
  {
    code: "lu_bibimbap_light",
    name: "나물 비빔밥 (고추장 적게)",
    kcal: 520, proteinG: 22, fatG: 12, carbsG: 78,
    slots: ["lunch"],
    tags: ["한식", "자연식"],
    patternFit: ["eating_out"],
    note: "현미밥 150g + 나물 여러 종 + 달걀 1 + 고추장 반티스푼.",
  },
  {
    code: "lu_salmon_rice",
    name: "연어 스테이크 + 찐 브로콜리 + 현미밥",
    kcal: 540, proteinG: 34, fatG: 20, carbsG: 50,
    slots: ["lunch", "dinner"],
    tags: ["고단백", "양식", "자연식"],
    patternFit: ["workout_strong_diet_weak", "sleep_short"],
    note: "연어 120g · 브로콜리 1컵 · 현미 120g. 오메가3 주 2회.",
  },
  {
    code: "lu_tofu_stirfry",
    name: "두부·채소 볶음 + 잡곡밥",
    kcal: 460, proteinG: 24, fatG: 14, carbsG: 58,
    slots: ["lunch", "dinner"],
    tags: ["한식", "채식", "자연식"],
    patternFit: ["diet_strong_attendance_weak"],
    note: "두부 180g + 파프리카·애호박·양파. 간장 1 + 참기름 1.",
  },
  {
    code: "lu_chicken_wrap",
    name: "통밀 랩 + 닭가슴살 + 요거트 소스",
    kcal: 450, proteinG: 32, fatG: 14, carbsG: 42,
    slots: ["lunch"],
    tags: ["양식", "고단백", "간편"],
    patternFit: ["eating_out"],
    note: "외식·런치박스 대안. 야채 듬뿍.",
  },
  {
    code: "lu_doenjang_soup",
    name: "된장찌개 + 현미밥 + 구운 두부",
    kcal: 520, proteinG: 26, fatG: 14, carbsG: 70,
    slots: ["lunch", "dinner"],
    tags: ["한식", "자연식"],
    patternFit: ["weekend_crash"],
    note: "된장 소금 줄이고 채소 듬뿍. 두부 100g 추가.",
  },

  // ─── 저녁 ───────────────────────────────────────────────────────
  {
    code: "di_chicken_veggies",
    name: "닭가슴살 허브 구이 + 찐 채소",
    kcal: 420, proteinG: 44, fatG: 12, carbsG: 30,
    slots: ["dinner"],
    tags: ["고단백", "저탄수", "양식"],
    patternFit: ["late_binge", "workout_strong_diet_weak"],
    note: "저녁 탄수 낮추고 단백질·채소 중심. 야식 차단에 효과적.",
  },
  {
    code: "di_tofu_steak",
    name: "두부 스테이크 + 버섯 볶음 + 쌈채소",
    kcal: 380, proteinG: 22, fatG: 14, carbsG: 30,
    slots: ["dinner"],
    tags: ["한식", "채식", "저탄수"],
    patternFit: ["late_binge", "diet_strong_attendance_weak"],
    note: "버섯 듬뿍 · 쌈채소 무한. 가벼운 저녁.",
  },
  {
    code: "di_grilled_fish",
    name: "흰살 생선 구이 + 나물 + 잡곡밥 반공기",
    kcal: 430, proteinG: 32, fatG: 12, carbsG: 45,
    slots: ["dinner"],
    tags: ["한식", "고단백", "자연식"],
    patternFit: ["weekend_crash", "sleep_short"],
    note: "고등어·삼치·동태 등. 탄수 반공기로 저녁 가볍게.",
  },
  {
    code: "di_shrimp_stirfry",
    name: "새우 채소 볶음 + 곤약면",
    kcal: 360, proteinG: 30, fatG: 10, carbsG: 28,
    slots: ["dinner"],
    tags: ["저탄수", "고단백", "양식"],
    patternFit: ["late_binge"],
    note: "곤약면으로 탄수 축소. 새우 150g + 채소 듬뿍.",
  },
  {
    code: "di_salad_tuna",
    name: "참치 샐러드 + 통밀빵 반쪽",
    kcal: 400, proteinG: 32, fatG: 14, carbsG: 32,
    slots: ["dinner", "lunch"],
    tags: ["간편", "고단백", "양식"],
    patternFit: ["eating_out", "late_binge"],
    note: "참치캔(기름 뺀 것) + 양상추·오이·양파 + 통밀빵 1/2.",
  },

  // ─── 간식 ───────────────────────────────────────────────────────
  {
    code: "sn_greek_yogurt",
    name: "그릭요거트 + 블루베리",
    kcal: 180, proteinG: 16, fatG: 4, carbsG: 20,
    slots: ["snack", "breakfast"],
    tags: ["간편", "고단백", "유제품"],
    patternFit: ["late_binge", "sleep_short"],
    note: "무가당 그릭요거트 150g + 블루베리 한 줌.",
  },
  {
    code: "sn_boiled_eggs",
    name: "삶은 달걀 2개 + 방울토마토",
    kcal: 180, proteinG: 14, fatG: 10, carbsG: 6,
    slots: ["snack"],
    tags: ["간편", "고단백", "저탄수"],
    patternFit: ["late_binge", "eating_out"],
    note: "외식 전 단백질 선충전에 특히 유용.",
  },
  {
    code: "sn_nuts_mix",
    name: "견과류 한 줌 + 사과 반개",
    kcal: 200, proteinG: 5, fatG: 12, carbsG: 20,
    slots: ["snack"],
    tags: ["자연식", "간편", "채식"],
    patternFit: ["sleep_short"],
    note: "아몬드·호두 30g + 사과. 오후 3~4시 슬럼프 방어.",
  },
  {
    code: "sn_protein_bar_light",
    name: "저당 프로틴 바 1개",
    kcal: 180, proteinG: 18, fatG: 6, carbsG: 18,
    slots: ["snack"],
    tags: ["간편", "고단백"],
    patternFit: ["workout_strong_diet_weak"],
    note: "운동 전후 비상용. 당류 5g 이하 선택.",
  },
  {
    code: "sn_cottage_cheese",
    name: "코티지 치즈 + 복숭아",
    kcal: 160, proteinG: 14, fatG: 4, carbsG: 16,
    slots: ["snack"],
    tags: ["간편", "고단백", "유제품"],
    patternFit: ["late_binge"],
    note: "밤 간식이 필요할 때 상대적으로 안전한 선택.",
  },

  // ─── 외식 대응 (주말/회식) ─────────────────────────────────────
  {
    code: "out_galbitang",
    name: "갈비탕 + 공기밥 반공기",
    kcal: 550, proteinG: 35, fatG: 18, carbsG: 50,
    slots: ["lunch", "dinner"],
    tags: ["한식", "외식OK"],
    patternFit: ["eating_out", "weekend_crash"],
    note: "외식 메뉴 중 감량기에 가장 무난. 국물 짜면 적게.",
  },
  {
    code: "out_sushi_modest",
    name: "초밥 8조각 + 미소시루",
    kcal: 520, proteinG: 28, fatG: 10, carbsG: 72,
    slots: ["lunch", "dinner"],
    tags: ["외식OK", "양식"],
    patternFit: ["eating_out"],
    note: "10조각 넘으면 탄수 과다. 간장 적게 · 와사비로 포인트.",
  },
  {
    code: "out_sam_grilled",
    name: "생선·고기 구이 백반 (탄수 반공기)",
    kcal: 560, proteinG: 36, fatG: 20, carbsG: 52,
    slots: ["lunch", "dinner"],
    tags: ["한식", "외식OK"],
    patternFit: ["eating_out", "weekend_crash"],
    note: "삼겹살·갈비 대신 담백 구이. 쌈·나물로 채소 확보.",
  },
  {
    code: "out_bibimmyeon_half",
    name: "잔치국수/비빔국수 → 면 반만",
    kcal: 480, proteinG: 18, fatG: 8, carbsG: 82,
    slots: ["lunch"],
    tags: ["한식", "외식OK"],
    patternFit: ["eating_out", "weekend_crash"],
    note: "면 반만 먹고 김·달걀 추가. 국물 짜면 반만.",
  },

  // ─── 가벼운 아침 스킵 대체 ─────────────────────────────────────
  {
    code: "bf_banana_protein",
    name: "바나나 1개 + 프로틴 쉐이크",
    kcal: 260, proteinG: 24, fatG: 4, carbsG: 34,
    slots: ["breakfast"],
    tags: ["간편", "고단백"],
    patternFit: ["diet_strong_attendance_weak"],
    note: "출근길 30초 아침. 거르지 않는 최소선.",
  },

  // ─── 늦은 저녁·야식 대체 ───────────────────────────────────────
  {
    code: "di_miyeok_soup",
    name: "미역국 + 달걀찜 + 쌈채소",
    kcal: 320, proteinG: 22, fatG: 10, carbsG: 28,
    slots: ["dinner"],
    tags: ["한식", "저탄수", "자연식"],
    patternFit: ["late_binge", "sleep_short"],
    note: "밤 10시 이후 꼭 뭔가 먹어야 할 때 대체용.",
  },
  {
    code: "sn_warm_milk",
    name: "따뜻한 저지방 우유 + 통밀 크래커 2개",
    kcal: 180, proteinG: 10, fatG: 4, carbsG: 24,
    slots: ["snack"],
    tags: ["간편", "유제품"],
    patternFit: ["late_binge", "sleep_short"],
    note: "수면 전 2시간 안에 야식 대체. 10분 후 양치.",
  },
];

/** 태그/제한으로 필터. */
export function filterMenus(opts: {
  slot?: MealSlot;
  excludeTags?: string[];        // vegan 이면 유제품·고기 태그 제외
  excludeIngredients?: string[]; // 이름에 포함 키워드
  preferPatterns?: string[];
}): MealItem[] {
  return MEAL_LIBRARY.filter((m) => {
    if (opts.slot && !m.slots.includes(opts.slot)) return false;
    if (opts.excludeTags?.some((t) => m.tags.includes(t))) return false;
    if (opts.excludeIngredients?.some((ing) => m.name.includes(ing))) return false;
    return true;
  }).sort((a, b) => {
    // preferPatterns 매칭 개수 내림차순
    const aMatch = (a.patternFit ?? []).filter((p) => opts.preferPatterns?.includes(p)).length;
    const bMatch = (b.patternFit ?? []).filter((p) => opts.preferPatterns?.includes(p)).length;
    if (aMatch !== bMatch) return bMatch - aMatch;
    return 0;
  });
}
