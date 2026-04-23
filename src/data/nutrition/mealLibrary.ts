/**
 * 153 다이어트 · 메뉴 라이브러리 (21일 프로그램 + 이후 자동 식단).
 *
 * 각 메뉴는 5대 영양소 관점의 추정 데이터 포함:
 *   · kcal · proteinG · fatG · carbsG · fiberG (3대 영양소 + 섬유질)
 *   · keyVitamins : 주로 함유되는 비타민 [A, B, B12, C, D, E, K]
 *   · keyMinerals : 주로 함유되는 무기질 [철, 칼슘, 마그네슘, 아연, 칼륨, 요오드]
 *   · hasProbiotic: 발효식품 여부 (요거트·김치·된장·낫또·케피어)
 *
 * 숫자는 USDA/한국영양학회 식품 DB 기반 대략치 — 감량/유지용 식단 조합 제안 목적.
 * 약물 처방용이 아니며 임상 영양 관리는 전문가에게.
 *
 * 필드 의미:
 *   · slots / tags / patternFit : 기존 유지 (호환)
 *   · veg/vegan 필터는 태그 + name 기반 (dietPlanEngine 에서 처리)
 */

import type { MealSlot } from "@/lib/diet/nutritionEngine";

export type Vitamin = "A" | "B" | "B12" | "C" | "D" | "E" | "K";
export type Mineral = "철" | "칼슘" | "마그네슘" | "아연" | "칼륨" | "요오드";

export interface MealItem {
  code: string;
  name: string;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number;              // 섬유질 (하루 25g 목표)
  keyVitamins: Vitamin[];      // 주로 함유 비타민
  keyMinerals: Mineral[];      // 주로 함유 무기질
  hasProbiotic: boolean;       // 유산균/발효식품 여부
  slots: MealSlot[];
  tags: string[];
  patternFit?: string[];
  note?: string;
}

// 프로틴 쉐이크 계열 — 가장 간편한 단백질 보강. 자동 보강 pass 가 우선 선택.
const SHAKE_MENUS: MealItem[] = [
  {
    code: "shk_whey_water",
    name: "유청 프로틴 쉐이크 (물 300ml + 1스쿱)",
    kcal: 130, proteinG: 25, fatG: 2, carbsG: 3, fiberG: 0,
    keyVitamins: ["B12"], keyMinerals: [],
    hasProbiotic: false,
    slots: ["snack", "breakfast"],
    tags: ["간편", "고단백", "쉐이크"],
    patternFit: ["diet_strong_attendance_weak", "workout_strong_diet_weak"],
    note: "30초 제조 · 가장 간편한 단백질 보강. 운동 후 30분 이내 권장.",
  },
  {
    code: "shk_whey_milk",
    name: "유청 프로틴 쉐이크 (우유 250ml + 1스쿱)",
    kcal: 280, proteinG: 33, fatG: 8, carbsG: 18, fiberG: 0,
    keyVitamins: ["B12", "D"], keyMinerals: ["칼슘"],
    hasProbiotic: false,
    slots: ["snack", "breakfast"],
    tags: ["간편", "고단백", "쉐이크", "유제품"],
    patternFit: ["workout_strong_diet_weak"],
    note: "칼슘·비타민D 까지 한번에. 우유 저지방으로 써도 OK.",
  },
  {
    code: "shk_banana_protein",
    name: "바나나 단백 쉐이크 (우유 200ml + 바나나 1 + 1스쿱)",
    kcal: 350, proteinG: 34, fatG: 8, carbsG: 45, fiberG: 3,
    keyVitamins: ["B", "B12", "C", "D"], keyMinerals: ["칼슘", "칼륨"],
    hasProbiotic: false,
    slots: ["breakfast", "snack"],
    tags: ["간편", "고단백", "쉐이크", "유제품"],
    patternFit: ["diet_strong_attendance_weak"],
    note: "아침 대체 최상. 믹서 없이 쉐이커로 OK (바나나 으깨서).",
  },
  {
    code: "shk_casein_night",
    name: "카제인 쉐이크 (자기 2시간 전, 물 또는 우유)",
    kcal: 120, proteinG: 25, fatG: 1, carbsG: 4, fiberG: 0,
    keyVitamins: ["B12"], keyMinerals: ["칼슘"],
    hasProbiotic: false,
    slots: ["snack"],
    tags: ["간편", "고단백", "쉐이크"],
    patternFit: ["late_binge", "sleep_short"],
    note: "카제인은 천천히 흡수 — 자기 전 단백 공급 + 야식 차단.",
  },
  {
    code: "shk_yogurt_protein",
    name: "그릭요거트 + 프로틴 파우더 1/2스쿱",
    kcal: 240, proteinG: 30, fatG: 5, carbsG: 18, fiberG: 1,
    keyVitamins: ["B12"], keyMinerals: ["칼슘"],
    hasProbiotic: true,
    slots: ["snack", "breakfast"],
    tags: ["간편", "고단백", "유제품"],
    patternFit: ["late_binge"],
    note: "유산균 + 고단백 동시 보강. 숟가락 하나면 끝.",
  },
];

// 편의점/즉석 활용 메뉴 — 현실적 간편성
const CONVENIENCE_MENUS: MealItem[] = [
  {
    code: "conv_chicken_box",
    name: "편의점 닭가슴살 도시락 + 방울토마토",
    kcal: 470, proteinG: 38, fatG: 10, carbsG: 52, fiberG: 5,
    keyVitamins: ["A", "B", "C"], keyMinerals: ["칼륨"],
    hasProbiotic: false,
    slots: ["lunch", "dinner"],
    tags: ["간편", "고단백", "양식"],
    patternFit: ["diet_strong_attendance_weak"],
    note: "바쁠 때 3분 솔루션. 현미밥 버전 선택.",
  },
  {
    code: "conv_tuna_salad_wrap",
    name: "편의점 샐러드 + 참치 팩 + 통밀랩",
    kcal: 420, proteinG: 32, fatG: 12, carbsG: 42, fiberG: 7,
    keyVitamins: ["A", "B12", "C", "K"], keyMinerals: ["철"],
    hasProbiotic: false,
    slots: ["lunch"],
    tags: ["간편", "고단백", "양식"],
    patternFit: ["eating_out"],
    note: "참치 팩 (기름 뺀 것) + 샐러드 토핑. 5분.",
  },
  {
    code: "ready_frozen_salmon",
    name: "즉석 연어 스테이크 + 냉동 브로콜리 + 즉석밥 반공기",
    kcal: 470, proteinG: 32, fatG: 16, carbsG: 45, fiberG: 5,
    keyVitamins: ["A", "B12", "D"], keyMinerals: ["칼륨", "요오드"],
    hasProbiotic: false,
    slots: ["dinner"],
    tags: ["간편", "고단백"],
    patternFit: ["sleep_short"],
    note: "에어프라이어 8분 + 전자레인지 2분. 오메가3 주 2회.",
  },
  {
    code: "ready_doenjang",
    name: "즉석 된장국 + 즉석 현미밥 + 두부 100g + 김",
    kcal: 480, proteinG: 26, fatG: 12, carbsG: 62, fiberG: 6,
    keyVitamins: ["A", "B", "K"], keyMinerals: ["철", "칼슘"],
    hasProbiotic: true,
    slots: ["dinner", "lunch"],
    tags: ["한식", "간편"],
    patternFit: ["weekend_crash"],
    note: "가장 빠른 한식. 전자레인지 3분이면 완성.",
  },
  {
    code: "bf_overnight_oats_protein",
    name: "오버나잇 오트 (귀리 + 우유 + 프로틴 1/2스쿱) + 베리",
    kcal: 420, proteinG: 32, fatG: 10, carbsG: 52, fiberG: 8,
    keyVitamins: ["B", "B12", "C"], keyMinerals: ["칼슘", "마그네슘"],
    hasProbiotic: false,
    slots: ["breakfast"],
    tags: ["간편", "고단백"],
    patternFit: ["diet_strong_attendance_weak"],
    note: "전날 밤 유리병에 섞어두고 아침에 그대로. 5분 조리.",
  },
  {
    code: "bf_ricecake_protein",
    name: "현미 떡 2개 + 피넛버터 + 바나나 + 프로틴 쉐이크",
    kcal: 430, proteinG: 32, fatG: 12, carbsG: 55, fiberG: 5,
    keyVitamins: ["B12", "E"], keyMinerals: ["칼슘", "마그네슘"],
    hasProbiotic: false,
    slots: ["breakfast"],
    tags: ["간편", "고단백"],
    patternFit: ["diet_strong_attendance_weak"],
    note: "빵 대안. 떡·견과 조합 + 쉐이크로 단백 완료.",
  },
  {
    code: "sn_edamame_pack",
    name: "냉동 엣지마메 1컵 + 삶은 달걀 2개",
    kcal: 280, proteinG: 25, fatG: 14, carbsG: 14, fiberG: 8,
    keyVitamins: ["B", "K"], keyMinerals: ["철", "마그네슘"],
    hasProbiotic: false,
    slots: ["snack"],
    tags: ["간편", "고단백", "자연식"],
    patternFit: ["workout_strong_diet_weak"],
    note: "전자레인지 3분 + 달걀. 식물성 + 동물성 단백질 조합.",
  },
  {
    code: "sn_jerky_cheese",
    name: "닭가슴살 스모크 1팩 + 치즈 1조각 + 방울토마토",
    kcal: 220, proteinG: 28, fatG: 10, carbsG: 6, fiberG: 1,
    keyVitamins: ["A", "B12"], keyMinerals: ["칼슘"],
    hasProbiotic: false,
    slots: ["snack"],
    tags: ["간편", "고단백", "저탄수"],
    patternFit: ["late_binge", "eating_out"],
    note: "휴대용 단백질. 야근·출장용 비상식.",
  },
];

export const MEAL_LIBRARY: MealItem[] = [
  ...SHAKE_MENUS,
  ...CONVENIENCE_MENUS,
  // ─── 아침 ───────────────────────────────────────────────────────
  {
    code: "bf_oatmeal_banana",
    name: "귀리 오트밀 + 바나나 + 그릭요거트",
    kcal: 380, proteinG: 18, fatG: 8, carbsG: 60, fiberG: 8,
    keyVitamins: ["B", "B12", "C"], keyMinerals: ["칼슘", "칼륨", "마그네슘"],
    hasProbiotic: true,
    slots: ["breakfast"],
    tags: ["자연식", "한식", "간편", "유제품"],
    patternFit: ["late_binge", "sleep_short"],
    note: "오트 40g + 바나나 1개 + 그릭요거트 100g. 포만감·혈당 안정 아침.",
  },
  {
    code: "bf_egg_toast",
    name: "통밀빵 + 스크램블 에그 2개 + 방울토마토",
    kcal: 420, proteinG: 24, fatG: 16, carbsG: 42, fiberG: 6,
    keyVitamins: ["A", "B12", "D", "C"], keyMinerals: ["철", "칼슘"],
    hasProbiotic: false,
    slots: ["breakfast"],
    tags: ["고단백", "양식", "간편"],
    patternFit: ["workout_strong_diet_weak"],
    note: "통밀 2쪽 · 달걀 2 · 올리브유 1ts. 단백질 우선 아침.",
  },
  {
    code: "bf_tofu_rice_bowl",
    name: "두부 부침 + 현미밥 + 김 + 나물 + 김치",
    kcal: 420, proteinG: 22, fatG: 10, carbsG: 58, fiberG: 7,
    keyVitamins: ["A", "B", "C", "K"], keyMinerals: ["철", "칼슘", "요오드"],
    hasProbiotic: true,
    slots: ["breakfast", "lunch"],
    tags: ["한식", "고단백", "채식", "자연식"],
    patternFit: ["diet_strong_attendance_weak"],
    note: "두부 150g + 현미 130g + 김치 1쪽. 식물성 단백질 + 유산균 한 번에.",
  },
  {
    code: "bf_protein_shake",
    name: "프로틴 쉐이크 + 아몬드 한 줌 + 사과",
    kcal: 320, proteinG: 26, fatG: 12, carbsG: 26, fiberG: 5,
    keyVitamins: ["B12", "E", "C"], keyMinerals: ["칼슘", "마그네슘"],
    hasProbiotic: false,
    slots: ["breakfast", "snack"],
    tags: ["고단백", "간편"],
    patternFit: ["diet_strong_attendance_weak", "workout_strong_diet_weak"],
    note: "우유/두유 250ml + 프로틴 1스쿱 + 아몬드 · 사과. 바쁜 아침 구제용.",
  },
  {
    code: "bf_banana_protein",
    name: "바나나 1개 + 프로틴 쉐이크",
    kcal: 260, proteinG: 24, fatG: 4, carbsG: 34, fiberG: 3,
    keyVitamins: ["B", "B12", "C"], keyMinerals: ["칼륨"],
    hasProbiotic: false,
    slots: ["breakfast"],
    tags: ["간편", "고단백"],
    patternFit: ["diet_strong_attendance_weak"],
    note: "출근길 30초 아침. 거르지 않는 최소선.",
  },
  {
    code: "bf_kimchi_bokkeumbap",
    name: "현미 김치볶음밥 (기름 적게) + 달걀 프라이",
    kcal: 480, proteinG: 20, fatG: 14, carbsG: 68, fiberG: 6,
    keyVitamins: ["A", "B", "C", "D"], keyMinerals: ["철", "칼륨"],
    hasProbiotic: true,
    slots: ["breakfast", "lunch"],
    tags: ["한식", "간편"],
    patternFit: ["weekend_crash"],
    note: "현미로 혈당 완화 + 김치 유산균. 기름은 올리브유 1ts 이내.",
  },

  // ─── 점심 ───────────────────────────────────────────────────────
  {
    code: "lu_chicken_salad",
    name: "닭가슴살 샐러드 볼 (퀴노아·채소)",
    kcal: 480, proteinG: 42, fatG: 14, carbsG: 45, fiberG: 9,
    keyVitamins: ["A", "B", "C", "E", "K"], keyMinerals: ["철", "마그네슘", "칼륨"],
    hasProbiotic: false,
    slots: ["lunch", "dinner"],
    tags: ["고단백", "양식", "자연식"],
    patternFit: ["workout_strong_diet_weak", "eating_out"],
    note: "닭가슴살 120g + 퀴노아 80g + 샐러드 2줌 + 발사믹.",
  },
  {
    code: "lu_bibimbap_light",
    name: "나물 비빔밥 (고추장 적게)",
    kcal: 540, proteinG: 22, fatG: 12, carbsG: 78, fiberG: 10,
    keyVitamins: ["A", "B", "C", "K"], keyMinerals: ["철", "칼슘", "마그네슘"],
    hasProbiotic: true,
    slots: ["lunch"],
    tags: ["한식", "자연식"],
    patternFit: ["eating_out"],
    note: "현미밥 150g + 나물 여러 종 + 달걀 1 + 고추장 반티스푼. 김치 곁들임.",
  },
  {
    code: "lu_salmon_rice",
    name: "연어 스테이크 + 찐 브로콜리 + 현미밥",
    kcal: 540, proteinG: 34, fatG: 20, carbsG: 50, fiberG: 6,
    keyVitamins: ["A", "B12", "D", "E", "K"], keyMinerals: ["마그네슘", "칼륨", "요오드"],
    hasProbiotic: false,
    slots: ["lunch", "dinner"],
    tags: ["고단백", "양식", "자연식"],
    patternFit: ["workout_strong_diet_weak", "sleep_short"],
    note: "연어 120g · 브로콜리 1컵 · 현미 120g. 오메가3 + 비타민D 주 2회.",
  },
  {
    code: "lu_tofu_stirfry",
    name: "두부·채소 볶음 + 잡곡밥",
    kcal: 460, proteinG: 24, fatG: 14, carbsG: 58, fiberG: 9,
    keyVitamins: ["A", "B", "C", "K"], keyMinerals: ["철", "칼슘", "마그네슘"],
    hasProbiotic: false,
    slots: ["lunch", "dinner"],
    tags: ["한식", "채식", "자연식"],
    patternFit: ["diet_strong_attendance_weak"],
    note: "두부 180g + 파프리카·애호박·양파. 간장 1 + 참기름 1.",
  },
  {
    code: "lu_chicken_wrap",
    name: "통밀 랩 + 닭가슴살 + 요거트 소스",
    kcal: 450, proteinG: 32, fatG: 14, carbsG: 42, fiberG: 7,
    keyVitamins: ["A", "B", "C"], keyMinerals: ["칼슘"],
    hasProbiotic: true,
    slots: ["lunch"],
    tags: ["양식", "고단백", "간편"],
    patternFit: ["eating_out"],
    note: "외식·런치박스 대안. 야채 듬뿍 + 요거트 소스로 유산균.",
  },
  {
    code: "lu_doenjang_soup",
    name: "된장찌개 + 현미밥 + 구운 두부 + 김치",
    kcal: 540, proteinG: 28, fatG: 14, carbsG: 72, fiberG: 10,
    keyVitamins: ["A", "B", "C", "K"], keyMinerals: ["철", "마그네슘", "칼륨"],
    hasProbiotic: true,
    slots: ["lunch", "dinner"],
    tags: ["한식", "자연식"],
    patternFit: ["weekend_crash"],
    note: "된장 소금 줄이고 채소 듬뿍. 된장·김치 동시 유산균.",
  },
  {
    code: "lu_poke_bowl",
    name: "참치 포케 보울 (현미·아보카도·엣지마메)",
    kcal: 520, proteinG: 32, fatG: 18, carbsG: 52, fiberG: 10,
    keyVitamins: ["B12", "D", "E", "K"], keyMinerals: ["철", "마그네슘", "요오드", "칼륨"],
    hasProbiotic: false,
    slots: ["lunch", "dinner"],
    tags: ["양식", "고단백", "자연식"],
    patternFit: ["workout_strong_diet_weak"],
    note: "참치·연어 회 80g + 현미 100g + 아보카도 1/4 + 엣지마메 한 줌.",
  },

  // ─── 저녁 ───────────────────────────────────────────────────────
  {
    code: "di_chicken_veggies",
    name: "닭가슴살 허브 구이 + 찐 채소 + 사우어크라우트",
    kcal: 440, proteinG: 44, fatG: 12, carbsG: 32, fiberG: 8,
    keyVitamins: ["A", "B", "C", "K"], keyMinerals: ["철", "칼륨"],
    hasProbiotic: true,
    slots: ["dinner"],
    tags: ["고단백", "저탄수", "양식"],
    patternFit: ["late_binge", "workout_strong_diet_weak"],
    note: "저녁 탄수 낮추고 단백질·채소 중심. 사우어크라우트 2큰술로 유산균.",
  },
  {
    code: "di_tofu_steak",
    name: "두부 스테이크 + 버섯 볶음 + 쌈채소 + 김치",
    kcal: 400, proteinG: 24, fatG: 14, carbsG: 34, fiberG: 9,
    keyVitamins: ["B", "C", "D", "K"], keyMinerals: ["철", "칼슘", "마그네슘"],
    hasProbiotic: true,
    slots: ["dinner"],
    tags: ["한식", "채식", "저탄수"],
    patternFit: ["late_binge", "diet_strong_attendance_weak"],
    note: "버섯 비타민D + 김치 유산균 + 두부 식물성 단백질.",
  },
  {
    code: "di_grilled_fish",
    name: "흰살 생선 구이 + 나물 + 잡곡밥 반공기",
    kcal: 430, proteinG: 32, fatG: 12, carbsG: 45, fiberG: 7,
    keyVitamins: ["A", "B12", "D", "K"], keyMinerals: ["칼슘", "요오드"],
    hasProbiotic: false,
    slots: ["dinner"],
    tags: ["한식", "고단백", "자연식"],
    patternFit: ["weekend_crash", "sleep_short"],
    note: "고등어·삼치·동태 등. 탄수 반공기로 저녁 가볍게.",
  },
  {
    code: "di_shrimp_stirfry",
    name: "새우 채소 볶음 + 곤약면",
    kcal: 360, proteinG: 30, fatG: 10, carbsG: 28, fiberG: 5,
    keyVitamins: ["A", "B12", "C"], keyMinerals: ["철", "아연", "칼슘", "요오드"],
    hasProbiotic: false,
    slots: ["dinner"],
    tags: ["저탄수", "고단백", "양식"],
    patternFit: ["late_binge"],
    note: "곤약면으로 탄수 축소. 새우 150g + 채소 듬뿍.",
  },
  {
    code: "di_salad_tuna",
    name: "참치 샐러드 + 통밀빵 반쪽 + 케피어",
    kcal: 420, proteinG: 32, fatG: 14, carbsG: 36, fiberG: 6,
    keyVitamins: ["A", "B12", "D", "K"], keyMinerals: ["칼슘"],
    hasProbiotic: true,
    slots: ["dinner", "lunch"],
    tags: ["간편", "고단백", "양식"],
    patternFit: ["eating_out", "late_binge"],
    note: "참치캔(기름 뺀 것) + 양상추·오이·양파 + 통밀빵 1/2 + 케피어 한 컵.",
  },
  {
    code: "di_miyeok_soup",
    name: "미역국 + 달걀찜 + 쌈채소 + 김치",
    kcal: 340, proteinG: 24, fatG: 10, carbsG: 32, fiberG: 5,
    keyVitamins: ["A", "B12", "D", "K"], keyMinerals: ["칼슘", "요오드", "철"],
    hasProbiotic: true,
    slots: ["dinner"],
    tags: ["한식", "저탄수", "자연식"],
    patternFit: ["late_binge", "sleep_short"],
    note: "밤 10시 이후 꼭 뭔가 먹어야 할 때 대체용. 미역 요오드 + 김치 유산균.",
  },

  // ─── 간식 ───────────────────────────────────────────────────────
  {
    code: "sn_greek_yogurt",
    name: "그릭요거트 + 블루베리 + 치아시드",
    kcal: 200, proteinG: 16, fatG: 6, carbsG: 22, fiberG: 5,
    keyVitamins: ["B12", "C", "E", "K"], keyMinerals: ["칼슘", "마그네슘"],
    hasProbiotic: true,
    slots: ["snack", "breakfast"],
    tags: ["간편", "고단백", "유제품"],
    patternFit: ["late_binge", "sleep_short"],
    note: "무가당 그릭요거트 150g + 블루베리 한 줌 + 치아시드 1ts.",
  },
  {
    code: "sn_boiled_eggs",
    name: "삶은 달걀 2개 + 방울토마토 + 치즈 1조각",
    kcal: 220, proteinG: 18, fatG: 12, carbsG: 8, fiberG: 1,
    keyVitamins: ["A", "B12", "D"], keyMinerals: ["칼슘"],
    hasProbiotic: false,
    slots: ["snack"],
    tags: ["간편", "고단백", "저탄수"],
    patternFit: ["late_binge", "eating_out"],
    note: "외식 전 단백질 선충전에 특히 유용.",
  },
  {
    code: "sn_nuts_mix",
    name: "견과류 한 줌 + 사과 반개",
    kcal: 220, proteinG: 6, fatG: 14, carbsG: 22, fiberG: 5,
    keyVitamins: ["E", "B"], keyMinerals: ["마그네슘", "아연"],
    hasProbiotic: false,
    slots: ["snack"],
    tags: ["자연식", "간편", "채식"],
    patternFit: ["sleep_short"],
    note: "아몬드·호두 30g + 사과. 오후 3~4시 슬럼프 방어.",
  },
  {
    code: "sn_protein_bar_light",
    name: "저당 프로틴 바 1개",
    kcal: 180, proteinG: 18, fatG: 6, carbsG: 18, fiberG: 4,
    keyVitamins: ["B", "B12"], keyMinerals: [],
    hasProbiotic: false,
    slots: ["snack"],
    tags: ["간편", "고단백"],
    patternFit: ["workout_strong_diet_weak"],
    note: "운동 전후 비상용. 당류 5g 이하 · 프로바이오틱 표기 있는 제품 권장.",
  },
  {
    code: "sn_cottage_cheese",
    name: "코티지 치즈 + 복숭아",
    kcal: 160, proteinG: 14, fatG: 4, carbsG: 16, fiberG: 2,
    keyVitamins: ["B12", "C"], keyMinerals: ["칼슘"],
    hasProbiotic: true,
    slots: ["snack"],
    tags: ["간편", "고단백", "유제품"],
    patternFit: ["late_binge"],
    note: "밤 간식이 필요할 때 상대적으로 안전한 선택. 발효 과정 유산균.",
  },
  {
    code: "sn_warm_milk",
    name: "따뜻한 저지방 우유 + 통밀 크래커 2개",
    kcal: 180, proteinG: 10, fatG: 4, carbsG: 24, fiberG: 2,
    keyVitamins: ["B12", "D"], keyMinerals: ["칼슘"],
    hasProbiotic: false,
    slots: ["snack"],
    tags: ["간편", "유제품"],
    patternFit: ["late_binge", "sleep_short"],
    note: "수면 전 2시간 안에 야식 대체. 10분 후 양치.",
  },
  {
    code: "sn_kefir_fruit",
    name: "케피어 1잔 + 딸기 한 줌",
    kcal: 140, proteinG: 8, fatG: 4, carbsG: 18, fiberG: 3,
    keyVitamins: ["B12", "C", "K"], keyMinerals: ["칼슘", "마그네슘"],
    hasProbiotic: true,
    slots: ["snack", "breakfast"],
    tags: ["간편", "유제품"],
    patternFit: ["late_binge"],
    note: "케피어는 그릭요거트보다 유산균 다양성 높음.",
  },

  // ─── 외식 대응 (주말/회식) ─────────────────────────────────────
  {
    code: "out_galbitang",
    name: "갈비탕 + 공기밥 반공기 + 깍두기",
    kcal: 560, proteinG: 36, fatG: 18, carbsG: 52, fiberG: 4,
    keyVitamins: ["A", "B12"], keyMinerals: ["철", "칼륨"],
    hasProbiotic: true,
    slots: ["lunch", "dinner"],
    tags: ["한식", "외식OK"],
    patternFit: ["eating_out", "weekend_crash"],
    note: "외식 메뉴 중 감량기에 가장 무난. 국물 짜면 적게 · 깍두기로 유산균.",
  },
  {
    code: "out_sushi_modest",
    name: "초밥 8조각 + 미소시루",
    kcal: 520, proteinG: 28, fatG: 10, carbsG: 72, fiberG: 4,
    keyVitamins: ["A", "B12", "D"], keyMinerals: ["요오드"],
    hasProbiotic: true,
    slots: ["lunch", "dinner"],
    tags: ["외식OK", "양식"],
    patternFit: ["eating_out"],
    note: "10조각 넘으면 탄수 과다. 간장 적게 · 와사비로 포인트. 미소 발효.",
  },
  {
    code: "out_sam_grilled",
    name: "생선·고기 구이 백반 (탄수 반공기) + 쌈·김치",
    kcal: 580, proteinG: 36, fatG: 20, carbsG: 54, fiberG: 6,
    keyVitamins: ["A", "B12", "D", "K"], keyMinerals: ["철", "칼륨"],
    hasProbiotic: true,
    slots: ["lunch", "dinner"],
    tags: ["한식", "외식OK"],
    patternFit: ["eating_out", "weekend_crash"],
    note: "삼겹살·갈비 대신 담백 구이. 쌈·나물·김치로 채소·유산균 확보.",
  },
  {
    code: "out_bibimmyeon_half",
    name: "잔치국수/비빔국수 → 면 반만 + 달걀",
    kcal: 480, proteinG: 20, fatG: 8, carbsG: 82, fiberG: 4,
    keyVitamins: ["A", "B12"], keyMinerals: ["철"],
    hasProbiotic: false,
    slots: ["lunch"],
    tags: ["한식", "외식OK"],
    patternFit: ["eating_out", "weekend_crash"],
    note: "면 반만 먹고 김·달걀 추가. 국물 짜면 반만.",
  },
];

/** 태그/제한으로 필터. */
export function filterMenus(opts: {
  slot?: MealSlot;
  excludeTags?: string[];
  excludeIngredients?: string[];
  preferPatterns?: string[];
  requireProbiotic?: boolean;
}): MealItem[] {
  return MEAL_LIBRARY.filter((m) => {
    if (opts.slot && !m.slots.includes(opts.slot)) return false;
    if (opts.excludeTags?.some((t) => m.tags.includes(t))) return false;
    if (opts.excludeIngredients?.some((ing) => m.name.includes(ing))) return false;
    if (opts.requireProbiotic && !m.hasProbiotic) return false;
    return true;
  }).sort((a, b) => {
    const aMatch = (a.patternFit ?? []).filter((p) => opts.preferPatterns?.includes(p)).length;
    const bMatch = (b.patternFit ?? []).filter((p) => opts.preferPatterns?.includes(p)).length;
    if (aMatch !== bMatch) return bMatch - aMatch;
    return 0;
  });
}
