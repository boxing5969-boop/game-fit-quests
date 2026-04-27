/**
 * 153 다이어트 · 메뉴 라이브러리 v6.1 — 350+ 항목.
 *
 * 인터페이스(이중 호환):
 *   · 신 필드: id / calories / protein / carbs / fat / type / tags  ← UI·랜덤 풀 헬퍼용
 *   · 구 필드: code / kcal / proteinG / fatG / carbsG / fiberG / keyVitamins / keyMinerals / hasProbiotic / slots / patternFit / note  ← mealPlanEngine·MealSwapDialog 등 기존 코드 호환
 *
 * 데이터는 RAW(튜플) 로 압축 저장 후 expand() 로 두 인터페이스를 동시에 채움.
 * fiberG / hasProbiotic 등은 음식명 키워드 기반 자동 추정.
 *
 * 모드 풀:
 *   · home_korean  — korean / home 태그 우선
 *   · office_quick — quick / simple / office 태그 우선
 *   · random       — 전체
 *
 * 모드별 풀이 5개 미만이면 자동으로 전체 풀 fallback (빈 카드 방지).
 */

import type { MealSlot } from "@/lib/diet/nutritionEngine";

// ===== 타입 =====
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type MealTag =
  | "korean"
  | "home"
  | "office"
  | "quick"
  | "simple"
  | "diet"
  | "protein"
  | "soup"
  | "vegan";

export type Vitamin = "A" | "B" | "B12" | "C" | "D" | "E" | "K";
export type Mineral = "철" | "칼슘" | "마그네슘" | "아연" | "칼륨" | "요오드";

/** 단일 식단 항목. 신/구 필드를 모두 보유 — 신코드는 id/calories/..., 구코드는 code/kcal/... */
export interface MealItem {
  // 신 인터페이스
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  type: MealType;
  tags: MealTag[];
  // 구 인터페이스 (엔진/다이얼로그 호환)
  code: string;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number;
  keyVitamins: Vitamin[];
  keyMinerals: Mineral[];
  hasProbiotic: boolean;
  slots: MealSlot[];
  patternFit?: string[];
  note?: string;
}

export type PlanMode = "random" | "home_korean" | "office_quick";
/** 엔진 호환 별칭. */
export type MealPlanMode = PlanMode;

export type SelectedMeal = MealItem;

// ===== 음식명 → 영양 추정 헬퍼 =====
const PROBIOTIC_KEYWORDS = ["김치", "된장", "청국장", "낫또", "요거트", "고추장", "콤부차", "사우어"];
const HIGH_FIBER_KEYWORDS = ["현미", "잡곡", "통밀", "오트", "귀리", "보리", "콩", "두부", "시금치", "케일", "브로콜리", "양배추", "고구마", "호박", "버섯", "샐러드", "나물", "쌈", "채소"];

function estimateFiber(name: string, carbs: number): number {
  let base = Math.max(2, Math.round(carbs * 0.06));
  for (const kw of HIGH_FIBER_KEYWORDS) {
    if (name.includes(kw)) base += 2;
  }
  return Math.min(base, 14);
}

function detectProbiotic(name: string): boolean {
  return PROBIOTIC_KEYWORDS.some((kw) => name.includes(kw));
}

// ===== RAW 데이터 (튜플) =====
type Raw = [string, number, number, number, number, MealType, MealTag[]];

const RAW: Raw[] = [
  // ===== 한식 아침 (40) =====
  ["흰쌀밥+미역국", 380, 12, 72, 4, "breakfast", ["korean", "home", "soup"]],
  ["흰쌀밥+된장찌개", 420, 18, 68, 8, "breakfast", ["korean", "home", "soup"]],
  ["잡곡밥+김치찌개", 410, 15, 74, 7, "breakfast", ["korean", "home", "soup"]],
  ["현미밥+콩나물국", 360, 11, 70, 3, "breakfast", ["korean", "home", "soup", "diet"]],
  ["보리밥+청국장", 430, 20, 72, 9, "breakfast", ["korean", "home", "soup"]],
  ["흰쌀밥+북어국", 370, 22, 60, 4, "breakfast", ["korean", "home", "soup", "protein"]],
  ["흰쌀밥+시래기된장국", 380, 14, 68, 5, "breakfast", ["korean", "home", "soup"]],
  ["흰쌀밥+순두부찌개", 400, 17, 65, 8, "breakfast", ["korean", "home", "soup"]],
  ["흰쌀밥+황태해장국", 390, 25, 62, 5, "breakfast", ["korean", "home", "soup", "protein"]],
  ["흰쌀밥+동태찌개", 400, 24, 63, 5, "breakfast", ["korean", "home", "soup", "protein"]],
  ["오트밀죽", 280, 10, 48, 5, "breakfast", ["korean", "home", "diet", "quick"]],
  ["흰죽+깍두기", 310, 8, 62, 2, "breakfast", ["korean", "home", "diet"]],
  ["팥죽", 380, 11, 72, 4, "breakfast", ["korean", "home"]],
  ["호박죽", 320, 7, 65, 3, "breakfast", ["korean", "home", "diet"]],
  ["전복죽", 380, 18, 62, 4, "breakfast", ["korean", "home", "protein"]],
  ["닭죽", 360, 20, 56, 6, "breakfast", ["korean", "home", "protein"]],
  ["소고기죽", 370, 18, 58, 8, "breakfast", ["korean", "home", "protein"]],
  ["누룽지+물김치", 320, 7, 65, 2, "breakfast", ["korean", "home", "diet"]],
  ["흰쌀밥+계란후라이+김", 450, 16, 72, 12, "breakfast", ["korean", "home", "quick"]],
  ["흰쌀밥+멸치볶음+김치", 430, 16, 74, 8, "breakfast", ["korean", "home"]],
  ["흰쌀밥+두부조림+김치", 440, 18, 72, 10, "breakfast", ["korean", "home"]],
  ["보리밥+나물무침3종", 390, 13, 72, 6, "breakfast", ["korean", "home", "diet", "vegan"]],
  ["흰쌀밥+어묵국+김치", 400, 14, 70, 7, "breakfast", ["korean", "home", "soup"]],
  ["흰쌀밥+깍두기+계란찜", 430, 17, 72, 9, "breakfast", ["korean", "home"]],
  ["흰쌀밥+갈치구이", 480, 28, 62, 12, "breakfast", ["korean", "home", "protein"]],
  ["흰쌀밥+고등어구이", 490, 26, 62, 14, "breakfast", ["korean", "home", "protein"]],
  ["흑미밥+된장찌개", 420, 14, 78, 5, "breakfast", ["korean", "home", "soup"]],
  ["선식+두유", 300, 12, 52, 4, "breakfast", ["korean", "home", "diet", "quick"]],
  ["미숫가루+두유", 320, 10, 56, 4, "breakfast", ["korean", "home", "quick"]],
  ["흰쌀밥+참치전+김치", 480, 24, 72, 12, "breakfast", ["korean", "home", "protein"]],
  ["흰쌀밥+버섯볶음", 410, 11, 76, 6, "breakfast", ["korean", "home", "diet", "vegan"]],
  ["현미죽+계란", 360, 14, 60, 7, "breakfast", ["korean", "home", "diet"]],
  ["콩죽", 350, 14, 58, 5, "breakfast", ["korean", "home", "protein"]],
  ["흰쌀밥+굴국", 400, 16, 68, 6, "breakfast", ["korean", "home", "soup", "protein"]],
  ["흰쌀밥+냉이된장국+나물", 400, 12, 72, 5, "breakfast", ["korean", "home", "soup", "vegan"]],
  ["흰쌀밥+소고기볶음+된장국", 490, 24, 72, 12, "breakfast", ["korean", "home", "soup", "protein"]],
  ["기장밥+순두부찌개+나물", 430, 16, 74, 8, "breakfast", ["korean", "home", "soup"]],
  ["팥시루떡+두유", 400, 10, 76, 4, "breakfast", ["korean", "home"]],
  ["인절미+두유", 370, 10, 72, 4, "breakfast", ["korean", "home"]],
  ["누룽지탕+깍두기", 340, 8, 68, 2, "breakfast", ["korean", "home", "diet"]],

  // ===== 간단식 아침 (30) =====
  ["그릭요거트+바나나", 280, 18, 42, 4, "breakfast", ["quick", "simple", "diet", "protein"]],
  ["삶은달걀2개+방울토마토", 210, 14, 8, 14, "breakfast", ["quick", "simple", "diet", "protein"]],
  ["프로틴쉐이크+사과", 320, 30, 38, 5, "breakfast", ["quick", "simple", "protein", "office"]],
  ["통밀토스트+계란후라이", 380, 18, 46, 14, "breakfast", ["quick", "simple", "office"]],
  ["시리얼+우유", 380, 12, 68, 6, "breakfast", ["quick", "simple", "office"]],
  ["두유+삶은고구마", 330, 12, 58, 4, "breakfast", ["quick", "simple", "diet"]],
  ["그릭요거트+블루베리+견과류", 300, 16, 36, 10, "breakfast", ["quick", "simple", "diet"]],
  ["통밀토스트+아보카도", 380, 8, 44, 18, "breakfast", ["quick", "simple"]],
  ["오트밀+우유+바나나", 420, 14, 72, 7, "breakfast", ["quick", "simple", "office"]],
  ["삶은달걀+고구마+방울토마토", 330, 14, 52, 7, "breakfast", ["quick", "simple", "diet", "protein"]],
  ["그릭요거트+딸기", 240, 16, 30, 4, "breakfast", ["quick", "simple", "diet", "protein"]],
  ["프로틴쉐이크+바나나", 350, 34, 44, 4, "breakfast", ["quick", "simple", "protein"]],
  ["계란스크램블+토스트", 400, 20, 42, 16, "breakfast", ["quick", "simple", "office"]],
  ["무가당그래놀라+두유", 380, 12, 62, 8, "breakfast", ["quick", "simple", "office"]],
  ["닭가슴살+고구마", 380, 38, 52, 4, "breakfast", ["quick", "simple", "diet", "protein", "office"]],
  ["계란샌드위치(통밀)", 420, 22, 46, 14, "breakfast", ["quick", "simple", "office"]],
  ["참치캔+야채스틱", 240, 28, 6, 8, "breakfast", ["quick", "simple", "diet", "protein", "office"]],
  ["바나나오트밀팬케이크", 400, 14, 66, 8, "breakfast", ["quick", "simple"]],
  ["삶은달걀+아보카도+토스트", 450, 18, 44, 22, "breakfast", ["quick", "simple"]],
  ["닭가슴살샌드위치", 440, 36, 44, 10, "breakfast", ["quick", "simple", "protein", "office"]],
  ["베리스무디+그릭요거트", 280, 14, 42, 4, "breakfast", ["quick", "simple", "diet"]],
  ["치아씨드오버나이트오트", 360, 12, 58, 8, "breakfast", ["quick", "simple", "diet"]],
  ["두부스크램블+통밀토스트", 380, 20, 46, 10, "breakfast", ["quick", "simple", "protein", "vegan"]],
  ["아보카도토스트+달걀수란", 420, 16, 44, 20, "breakfast", ["quick", "simple"]],
  ["저지방코티지치즈+사과", 220, 16, 28, 2, "breakfast", ["quick", "simple", "diet", "protein"]],
  ["무가당아몬드밀크+오트+바나나", 310, 8, 56, 5, "breakfast", ["quick", "simple", "diet", "vegan"]],
  ["프로틴오버나이트오트", 330, 24, 46, 5, "breakfast", ["quick", "simple", "protein"]],
  ["그린스무디(시금치+바나나+두유)", 260, 10, 46, 4, "breakfast", ["quick", "simple", "diet", "vegan"]],
  ["무가당뮤즐리+두유", 360, 12, 60, 7, "breakfast", ["quick", "simple", "diet", "office"]],
  ["두유+오트밀+치아씨드", 320, 12, 52, 6, "breakfast", ["quick", "simple", "diet"]],

  // ===== 한식 점심 (60) =====
  ["비빔밥", 560, 18, 92, 10, "lunch", ["korean", "home"]],
  ["순두부찌개+밥", 480, 20, 74, 10, "lunch", ["korean", "home", "soup"]],
  ["갈비탕+밥", 580, 30, 72, 16, "lunch", ["korean", "home", "soup", "protein"]],
  ["삼계탕", 580, 38, 58, 16, "lunch", ["korean", "home", "soup", "protein"]],
  ["제육볶음+밥", 580, 28, 78, 14, "lunch", ["korean", "home", "protein"]],
  ["불고기+밥", 560, 26, 78, 12, "lunch", ["korean", "home", "protein"]],
  ["닭갈비+밥", 560, 30, 76, 12, "lunch", ["korean", "home", "protein"]],
  ["해물된장찌개+밥", 480, 22, 72, 8, "lunch", ["korean", "home", "soup", "protein"]],
  ["콩나물밥+양념간장", 500, 14, 90, 6, "lunch", ["korean", "home", "diet", "vegan"]],
  ["김치볶음밥", 520, 14, 84, 12, "lunch", ["korean", "home", "quick"]],
  ["오징어볶음+밥", 520, 24, 76, 10, "lunch", ["korean", "home", "protein"]],
  ["두부김치+밥", 520, 18, 78, 12, "lunch", ["korean", "home"]],
  ["참치김치찌개+밥", 510, 22, 76, 10, "lunch", ["korean", "home", "soup", "protein"]],
  ["순대국밥", 560, 24, 72, 16, "lunch", ["korean", "home", "soup"]],
  ["설렁탕+밥", 540, 28, 68, 14, "lunch", ["korean", "home", "soup", "protein"]],
  ["갈치조림+밥", 520, 28, 74, 12, "lunch", ["korean", "home", "protein"]],
  ["고등어조림+밥", 530, 26, 74, 14, "lunch", ["korean", "home", "protein"]],
  ["소불고기덮밥", 580, 28, 82, 12, "lunch", ["korean", "home", "protein"]],
  ["낙지볶음+밥", 500, 22, 74, 8, "lunch", ["korean", "home", "protein"]],
  ["쭈꾸미볶음+밥", 490, 24, 72, 8, "lunch", ["korean", "home", "protein"]],
  ["고등어구이+밥", 530, 28, 68, 14, "lunch", ["korean", "home", "protein"]],
  ["갈치구이+밥", 510, 28, 68, 12, "lunch", ["korean", "home", "protein"]],
  ["삼치구이+밥", 520, 26, 68, 14, "lunch", ["korean", "home", "protein"]],
  ["조기구이+밥", 500, 24, 68, 12, "lunch", ["korean", "home", "protein"]],
  ["가자미구이+밥", 490, 24, 68, 10, "lunch", ["korean", "home", "protein"]],
  ["돼지갈비찜+밥", 620, 32, 78, 18, "lunch", ["korean", "home", "protein"]],
  ["소갈비찜+밥", 640, 34, 76, 20, "lunch", ["korean", "home", "protein"]],
  ["닭볶음탕+밥", 560, 30, 74, 14, "lunch", ["korean", "home", "soup", "protein"]],
  ["아귀찜+밥", 490, 26, 70, 10, "lunch", ["korean", "home", "protein"]],
  ["해물파전+밥", 560, 18, 80, 14, "lunch", ["korean", "home"]],
  ["보쌈+보쌈김치+밥", 560, 28, 72, 16, "lunch", ["korean", "home", "protein"]],
  ["족발+쌈채소+밥", 580, 32, 70, 18, "lunch", ["korean", "home", "protein"]],
  ["떡볶이+어묵", 500, 14, 86, 8, "lunch", ["korean", "home"]],
  ["해물순두부+밥", 480, 22, 70, 10, "lunch", ["korean", "home", "soup", "protein"]],
  ["대구탕+밥", 480, 26, 68, 8, "lunch", ["korean", "home", "soup", "protein"]],
  ["동태탕+밥", 470, 26, 68, 7, "lunch", ["korean", "home", "soup", "protein"]],
  ["꽃게탕+밥", 480, 24, 68, 8, "lunch", ["korean", "home", "soup", "protein"]],
  ["장어구이+밥", 600, 30, 72, 20, "lunch", ["korean", "home", "protein"]],
  ["오리로스구이+밥", 580, 28, 72, 18, "lunch", ["korean", "home", "protein"]],
  ["비빔냉면", 520, 16, 88, 8, "lunch", ["korean", "home"]],
  ["물냉면", 450, 14, 80, 6, "lunch", ["korean", "home", "diet"]],
  ["막국수", 480, 12, 86, 6, "lunch", ["korean", "home", "diet"]],
  ["잔치국수", 460, 12, 84, 6, "lunch", ["korean", "home", "soup"]],
  ["비빔국수", 490, 12, 88, 8, "lunch", ["korean", "home"]],
  ["칼국수", 490, 14, 84, 8, "lunch", ["korean", "home", "soup"]],
  ["수제비", 480, 12, 84, 8, "lunch", ["korean", "home", "soup"]],
  ["만두국+밥", 530, 18, 80, 12, "lunch", ["korean", "home", "soup"]],
  ["떡국+만두", 540, 16, 86, 10, "lunch", ["korean", "home", "soup"]],
  ["된장비빔밥", 510, 16, 86, 8, "lunch", ["korean", "home", "vegan"]],
  ["나물비빔밥", 500, 14, 88, 6, "lunch", ["korean", "home", "vegan"]],
  ["돌솥비빔밥", 580, 18, 92, 12, "lunch", ["korean", "home"]],
  ["제육덮밥", 580, 26, 80, 14, "lunch", ["korean", "home", "protein"]],
  ["닭고기덮밥", 540, 28, 78, 10, "lunch", ["korean", "home", "protein"]],
  ["카레라이스", 560, 16, 90, 10, "lunch", ["korean", "home"]],
  ["오므라이스(한식)", 580, 16, 86, 14, "lunch", ["korean", "home"]],
  ["콩나물해장국+밥", 460, 14, 70, 6, "lunch", ["korean", "home", "soup"]],
  ["뼈해장국+밥", 520, 24, 70, 14, "lunch", ["korean", "home", "soup", "protein"]],
  ["부대찌개+밥", 560, 24, 78, 14, "lunch", ["korean", "home", "soup"]],
  ["콩비지찌개+밥", 470, 18, 72, 8, "lunch", ["korean", "home", "soup", "diet"]],
  ["청국장+밥", 470, 18, 74, 8, "lunch", ["korean", "home", "soup"]],

  // ===== 사무용 점심 (40) — office/quick =====
  ["닭가슴살샐러드볼", 380, 32, 28, 12, "lunch", ["office", "quick", "diet", "protein"]],
  ["단백질도시락(닭+현미+브로콜리)", 460, 38, 56, 8, "lunch", ["office", "quick", "diet", "protein"]],
  ["참치마요김밥", 460, 18, 70, 12, "lunch", ["office", "quick", "korean"]],
  ["야채김밥", 380, 10, 72, 6, "lunch", ["office", "quick", "korean", "vegan"]],
  ["소고기김밥", 480, 22, 70, 14, "lunch", ["office", "quick", "korean", "protein"]],
  ["충무김밥", 380, 12, 72, 4, "lunch", ["office", "quick", "korean"]],
  ["편의점도시락(불고기)", 580, 24, 78, 16, "lunch", ["office", "quick"]],
  ["편의점도시락(제육)", 600, 26, 78, 18, "lunch", ["office", "quick", "protein"]],
  ["편의점도시락(김치찌개)", 540, 22, 76, 14, "lunch", ["office", "quick", "soup"]],
  ["컵라면+삼각김밥", 580, 14, 84, 18, "lunch", ["office", "quick", "simple"]],
  ["닭가슴살랩", 420, 32, 38, 14, "lunch", ["office", "quick", "protein", "diet"]],
  ["치킨시저샐러드", 480, 30, 22, 24, "lunch", ["office", "quick", "protein"]],
  ["그린샐러드+닭가슴살+발사믹", 380, 32, 18, 14, "lunch", ["office", "quick", "diet", "protein"]],
  ["연어포케볼", 520, 28, 60, 14, "lunch", ["office", "quick", "protein"]],
  ["참치포케볼", 500, 26, 60, 12, "lunch", ["office", "quick", "protein"]],
  ["새우샌드위치", 440, 22, 50, 14, "lunch", ["office", "quick", "simple"]],
  ["햄에그샌드위치", 460, 22, 48, 18, "lunch", ["office", "quick", "simple"]],
  ["BLT샌드위치", 480, 16, 50, 22, "lunch", ["office", "quick", "simple"]],
  ["클럽샌드위치", 540, 28, 54, 22, "lunch", ["office", "quick"]],
  ["토르티야랩(닭)", 460, 30, 46, 14, "lunch", ["office", "quick", "protein"]],
  ["통밀파스타+토마토", 520, 16, 86, 8, "lunch", ["office", "quick"]],
  ["페스토파스타", 580, 16, 78, 22, "lunch", ["office", "quick"]],
  ["미트소스파스타", 600, 24, 80, 18, "lunch", ["office", "quick", "protein"]],
  ["크림파스타+닭가슴살", 620, 30, 72, 24, "lunch", ["office", "quick", "protein"]],
  ["카르보나라", 660, 22, 76, 28, "lunch", ["office", "quick"]],
  ["에그타르트+커피", 360, 8, 42, 18, "lunch", ["office", "quick", "simple"]],
  ["베이글+크림치즈+훈제연어", 480, 24, 56, 18, "lunch", ["office", "quick", "protein"]],
  ["핫도그+샐러드", 460, 16, 50, 22, "lunch", ["office", "quick"]],
  ["라면+계란", 520, 14, 76, 18, "lunch", ["office", "quick", "soup", "simple"]],
  ["우동+유부", 480, 14, 86, 7, "lunch", ["office", "quick", "soup"]],
  ["짜장면(소)", 580, 18, 92, 14, "lunch", ["office", "quick"]],
  ["짬뽕(소)", 540, 22, 80, 12, "lunch", ["office", "quick", "soup"]],
  ["군만두+밥", 540, 18, 78, 16, "lunch", ["office", "quick"]],
  ["새우볶음밥(중식)", 520, 20, 78, 12, "lunch", ["office", "quick"]],
  ["김밥+우동", 540, 16, 90, 10, "lunch", ["office", "quick", "korean"]],
  ["비빔밥(편의)", 520, 16, 86, 10, "lunch", ["office", "quick", "korean"]],
  ["컵누들+삶은달걀", 380, 16, 56, 10, "lunch", ["office", "quick", "simple"]],
  ["닭가슴살볼+현미밥", 480, 38, 58, 8, "lunch", ["office", "quick", "diet", "protein"]],
  ["닭가슴살꼬치+사이드샐러드", 360, 34, 22, 12, "lunch", ["office", "quick", "diet", "protein"]],
  ["두부샐러드(저염)", 320, 18, 22, 14, "lunch", ["office", "quick", "diet", "vegan"]],

  // ===== 기타 점심 (20) — 일식·중식·동남아·양식 =====
  ["가츠동(돈가스덮밥)", 660, 26, 86, 22, "lunch", []],
  ["규동(소고기덮밥)", 600, 26, 82, 18, "lunch", ["protein"]],
  ["오야코동(닭달걀덮밥)", 560, 28, 78, 14, "lunch", ["protein"]],
  ["텐동(튀김덮밥)", 640, 18, 90, 22, "lunch", []],
  ["돈코츠라멘", 620, 22, 76, 24, "lunch", ["soup"]],
  ["미소라멘", 540, 18, 78, 16, "lunch", ["soup"]],
  ["쇼유라멘", 520, 18, 76, 14, "lunch", ["soup"]],
  ["메밀소바", 400, 14, 74, 4, "lunch", ["quick", "simple", "diet"]],
  ["우동(붓카케)", 460, 14, 84, 6, "lunch", ["quick", "simple", "soup"]],
  ["돈카츠+밥", 680, 24, 84, 22, "lunch", []],
  ["치킨카츠+밥", 650, 28, 82, 20, "lunch", ["protein"]],
  ["하이라이스", 580, 18, 84, 16, "lunch", []],
  ["키마카레+밥", 600, 22, 84, 18, "lunch", ["protein"]],
  ["그린커리+밥", 580, 18, 78, 22, "lunch", []],
  ["똠얌꿍쌀국수", 480, 20, 70, 12, "lunch", ["soup", "protein"]],
  ["쌀국수(소고기)", 460, 22, 68, 8, "lunch", ["soup", "protein"]],
  ["팟타이", 580, 18, 86, 14, "lunch", []],
  ["분짜", 540, 26, 70, 14, "lunch", ["protein"]],
  ["반미샌드위치", 500, 22, 60, 16, "lunch", ["quick"]],
  ["비빔쌀국수", 520, 18, 80, 10, "lunch", []],

  // ===== 한식 저녁 (60) =====
  ["김치찌개+밥+나물", 540, 22, 78, 12, "dinner", ["korean", "home", "soup"]],
  ["된장찌개+밥+생선", 560, 28, 70, 14, "dinner", ["korean", "home", "soup", "protein"]],
  ["순두부찌개+밥+계란", 540, 24, 72, 14, "dinner", ["korean", "home", "soup"]],
  ["부대찌개+밥(저녁)", 580, 26, 78, 16, "dinner", ["korean", "home", "soup"]],
  ["청국장+밥+나물", 500, 20, 76, 9, "dinner", ["korean", "home", "soup"]],
  ["갈비찜+밥", 640, 34, 78, 20, "dinner", ["korean", "home", "protein"]],
  ["소불고기+밥+상추쌈", 580, 28, 78, 14, "dinner", ["korean", "home", "protein"]],
  ["돼지불고기+밥", 600, 28, 78, 16, "dinner", ["korean", "home", "protein"]],
  ["제육볶음+상추쌈+밥", 600, 30, 78, 16, "dinner", ["korean", "home", "protein"]],
  ["닭갈비+밥+양배추", 580, 32, 76, 12, "dinner", ["korean", "home", "protein"]],
  ["닭볶음탕+밥(저녁)", 580, 32, 74, 14, "dinner", ["korean", "home", "soup", "protein"]],
  ["닭도리탕+밥", 580, 32, 74, 14, "dinner", ["korean", "home", "soup", "protein"]],
  ["안동찜닭+밥", 600, 30, 80, 14, "dinner", ["korean", "home", "protein"]],
  ["삼겹살구이+상추쌈+밥", 700, 28, 64, 38, "dinner", ["korean", "home", "protein"]],
  ["목살구이+상추쌈+밥", 660, 32, 62, 32, "dinner", ["korean", "home", "protein"]],
  ["항정살구이+상추쌈+밥", 680, 30, 62, 36, "dinner", ["korean", "home", "protein"]],
  ["갈비구이+밥", 680, 32, 70, 28, "dinner", ["korean", "home", "protein"]],
  ["양념갈비+밥", 700, 32, 78, 26, "dinner", ["korean", "home", "protein"]],
  ["LA갈비+밥", 720, 30, 76, 30, "dinner", ["korean", "home", "protein"]],
  ["등심구이+밥", 620, 32, 64, 24, "dinner", ["korean", "home", "protein"]],
  ["안심구이+밥", 580, 36, 62, 18, "dinner", ["korean", "home", "protein"]],
  ["차돌박이+밥", 660, 28, 64, 32, "dinner", ["korean", "home", "protein"]],
  ["우삼겹+밥", 640, 26, 64, 30, "dinner", ["korean", "home", "protein"]],
  ["갈비탕+밥(저녁)", 580, 30, 72, 16, "dinner", ["korean", "home", "soup", "protein"]],
  ["곰탕+밥", 540, 26, 70, 14, "dinner", ["korean", "home", "soup", "protein"]],
  ["도가니탕+밥", 540, 24, 68, 16, "dinner", ["korean", "home", "soup"]],
  ["꼬리곰탕+밥", 580, 28, 70, 18, "dinner", ["korean", "home", "soup", "protein"]],
  ["추어탕+밥", 520, 24, 70, 12, "dinner", ["korean", "home", "soup", "protein"]],
  ["매운탕+밥", 500, 24, 68, 10, "dinner", ["korean", "home", "soup", "protein"]],
  ["생태매운탕+밥", 500, 24, 68, 10, "dinner", ["korean", "home", "soup", "protein"]],
  ["동태매운탕+밥", 480, 24, 66, 8, "dinner", ["korean", "home", "soup", "protein"]],
  ["광어매운탕+밥", 500, 26, 68, 10, "dinner", ["korean", "home", "soup", "protein"]],
  ["우럭매운탕+밥", 500, 26, 68, 10, "dinner", ["korean", "home", "soup", "protein"]],
  ["조개매운탕+밥", 460, 22, 68, 6, "dinner", ["korean", "home", "soup", "protein"]],
  ["알탕+밥", 520, 26, 68, 12, "dinner", ["korean", "home", "soup", "protein"]],
  ["청국장+생선구이+밥", 580, 30, 72, 14, "dinner", ["korean", "home", "soup", "protein"]],
  ["된장찌개+제육+밥", 620, 30, 76, 18, "dinner", ["korean", "home", "soup", "protein"]],
  ["김치찌개+계란말이+밥", 580, 24, 76, 16, "dinner", ["korean", "home", "soup"]],
  ["부대찌개+소시지+밥", 640, 28, 78, 20, "dinner", ["korean", "home", "soup"]],
  ["순두부+굴+밥", 500, 24, 70, 12, "dinner", ["korean", "home", "soup", "protein"]],
  ["갈치조림+밥(저녁)", 540, 28, 74, 12, "dinner", ["korean", "home", "protein"]],
  ["고등어조림+밥(저녁)", 550, 26, 74, 14, "dinner", ["korean", "home", "protein"]],
  ["코다리조림+밥", 540, 26, 74, 12, "dinner", ["korean", "home", "protein"]],
  ["가자미조림+밥", 510, 24, 72, 12, "dinner", ["korean", "home", "protein"]],
  ["우럭조림+밥", 520, 26, 72, 12, "dinner", ["korean", "home", "protein"]],
  ["갑오징어볶음+밥", 500, 24, 72, 8, "dinner", ["korean", "home", "protein"]],
  ["주꾸미볶음+밥(저녁)", 500, 24, 72, 8, "dinner", ["korean", "home", "protein"]],
  ["낙지볶음+밥(저녁)", 510, 22, 72, 10, "dinner", ["korean", "home", "protein"]],
  ["산낙지+밥", 460, 22, 70, 6, "dinner", ["korean", "home", "protein"]],
  ["회무침+밥", 480, 24, 70, 8, "dinner", ["korean", "home", "protein"]],
  ["광어회+밥", 460, 28, 62, 6, "dinner", ["korean", "home", "protein"]],
  ["우럭회+밥", 460, 28, 62, 6, "dinner", ["korean", "home", "protein"]],
  ["연어회+밥", 540, 30, 62, 18, "dinner", ["korean", "home", "protein"]],
  ["도다리회+밥", 460, 26, 62, 6, "dinner", ["korean", "home", "protein"]],
  ["한정식", 700, 26, 92, 18, "dinner", ["korean", "home"]],
  ["보리굴비정식", 580, 30, 76, 12, "dinner", ["korean", "home", "protein"]],
  ["황태정식", 540, 32, 70, 10, "dinner", ["korean", "home", "protein"]],
  ["고등어정식", 580, 30, 72, 14, "dinner", ["korean", "home", "protein"]],
  ["갈치정식", 560, 30, 70, 12, "dinner", ["korean", "home", "protein"]],
  ["비빔밥+미역국(저녁)", 560, 18, 88, 8, "dinner", ["korean", "home", "soup"]],

  // ===== 다이어트 저녁 (30) =====
  ["닭가슴살+현미밥+브로콜리", 460, 38, 56, 8, "dinner", ["diet", "protein"]],
  ["닭가슴살+고구마+양배추", 420, 38, 50, 6, "dinner", ["diet", "protein"]],
  ["닭가슴살구이+샐러드", 380, 38, 18, 14, "dinner", ["diet", "protein"]],
  ["닭가슴살스테이크+아스파라거스", 380, 38, 14, 14, "dinner", ["diet", "protein"]],
  ["두부스테이크+나물", 360, 22, 18, 18, "dinner", ["diet", "protein", "vegan"]],
  ["두부조림+현미밥+나물", 420, 20, 58, 10, "dinner", ["diet", "korean", "home"]],
  ["연두부+현미밥+미역", 360, 16, 56, 6, "dinner", ["diet", "korean", "home"]],
  ["연어구이+현미밥+시금치", 540, 32, 56, 18, "dinner", ["diet", "protein"]],
  ["연어스테이크+샐러드", 460, 30, 14, 26, "dinner", ["diet", "protein"]],
  ["흰살생선구이+현미밥+나물", 480, 28, 60, 10, "dinner", ["diet", "korean", "home", "protein"]],
  ["동태탕(저염)+현미밥", 440, 24, 60, 8, "dinner", ["diet", "korean", "home", "soup", "protein"]],
  ["매운탕(저염)+현미밥", 460, 24, 62, 10, "dinner", ["diet", "korean", "home", "soup", "protein"]],
  ["닭가슴살샐러드+발사믹", 360, 34, 18, 12, "dinner", ["diet", "protein"]],
  ["단백질샐러드(닭+계란+두부)", 420, 36, 16, 22, "dinner", ["diet", "protein"]],
  ["톳비빔밥+달걀", 480, 18, 76, 10, "dinner", ["diet", "korean", "home"]],
  ["곤약비빔밥+나물", 320, 14, 50, 6, "dinner", ["diet", "korean", "home", "vegan"]],
  ["곤약면+닭가슴살", 360, 32, 38, 6, "dinner", ["diet", "protein"]],
  ["두부면+토마토소스", 320, 22, 28, 12, "dinner", ["diet", "protein", "vegan"]],
  ["두부면+페스토", 380, 20, 28, 22, "dinner", ["diet", "vegan"]],
  ["통곡물김밥+오이무침", 420, 14, 70, 8, "dinner", ["diet", "korean", "home"]],
  ["잡곡밥+청국장(소량)", 380, 16, 64, 6, "dinner", ["diet", "korean", "home", "soup"]],
  ["현미밥+미역국+나물", 380, 14, 64, 6, "dinner", ["diet", "korean", "home", "soup", "vegan"]],
  ["보리밥+나물비빔", 420, 14, 76, 6, "dinner", ["diet", "korean", "home", "vegan"]],
  ["채소비빔밥(달걀)", 460, 16, 76, 8, "dinner", ["diet", "korean", "home"]],
  ["두부김치+현미밥(저녁)", 460, 18, 64, 10, "dinner", ["diet", "korean", "home"]],
  ["닭가슴살볶음+양배추쌈", 380, 34, 24, 12, "dinner", ["diet", "protein"]],
  ["단백질죽(닭+귀리)", 360, 28, 46, 6, "dinner", ["diet", "protein"]],
  ["흑미밥+갈치구이", 480, 28, 64, 12, "dinner", ["diet", "korean", "home", "protein"]],
  ["닭가슴살+양상추+고구마", 420, 38, 50, 6, "dinner", ["diet", "protein"]],
  ["채소+삶은달걀+귀리", 360, 18, 42, 12, "dinner", ["diet"]],

  // ===== 서양식 저녁 (20) =====
  ["그릴치킨+퀴노아샐러드", 520, 38, 50, 14, "dinner", ["protein"]],
  ["스테이크+구운채소+감자", 660, 38, 50, 28, "dinner", ["protein"]],
  ["안심스테이크+아스파라거스", 540, 36, 14, 28, "dinner", ["protein"]],
  ["폭찹+감자+사과소스", 600, 32, 50, 24, "dinner", ["protein"]],
  ["오븐치킨+로스트포테이토", 580, 36, 56, 18, "dinner", ["protein"]],
  ["닭가슴살파스타(통밀)", 580, 36, 76, 12, "dinner", ["protein"]],
  ["미트볼파스타", 620, 26, 76, 22, "dinner", ["protein"]],
  ["라자냐(소량)", 540, 24, 56, 22, "dinner", ["protein"]],
  ["치킨파히타", 580, 32, 56, 20, "dinner", ["protein"]],
  ["부리또볼(통밀)", 600, 28, 76, 18, "dinner", ["protein"]],
  ["그릴드새우+퀴노아", 460, 30, 50, 12, "dinner", ["protein"]],
  ["새우알프레도(소량)", 580, 26, 60, 26, "dinner", ["protein"]],
  ["닭윙+그린샐러드", 520, 30, 14, 36, "dinner", ["protein"]],
  ["닭다리오븐구이+녹색채소", 540, 36, 18, 32, "dinner", ["protein"]],
  ["양고기립+민트소스", 660, 36, 18, 48, "dinner", ["protein"]],
  ["비프스테이크샐러드", 540, 36, 16, 32, "dinner", ["protein"]],
  ["시저샐러드+그릴드치킨", 480, 32, 18, 26, "dinner", ["protein"]],
  ["콥샐러드", 520, 28, 18, 32, "dinner", ["protein"]],
  ["클램차우더+빵", 540, 18, 56, 22, "dinner", ["soup"]],
  ["미트소스라자냐", 600, 28, 60, 26, "dinner", ["protein"]],

  // ===== 간식 (50) =====
  ["사과 1개", 95, 1, 25, 0, "snack", ["quick", "simple", "diet", "vegan"]],
  ["바나나 1개", 105, 1, 27, 0, "snack", ["quick", "simple", "diet", "vegan"]],
  ["그릭요거트(무가당)", 130, 18, 8, 4, "snack", ["quick", "simple", "diet", "protein"]],
  ["삶은달걀 1개", 78, 6, 1, 5, "snack", ["quick", "simple", "diet", "protein"]],
  ["아몬드 한줌(20알)", 160, 6, 6, 14, "snack", ["quick", "simple"]],
  ["단백질바", 220, 22, 22, 6, "snack", ["quick", "simple", "office", "protein"]],
  ["프로틴쉐이크(저칼)", 150, 25, 6, 2, "snack", ["quick", "simple", "office", "protein"]],
  ["두유 200ml", 100, 7, 8, 4, "snack", ["quick", "simple", "vegan"]],
  ["우유 200ml", 130, 7, 12, 5, "snack", ["quick", "simple"]],
  ["치즈스틱 1개", 80, 6, 1, 6, "snack", ["quick", "simple", "office", "protein"]],
  ["닭가슴살 100g", 165, 32, 0, 4, "snack", ["quick", "simple", "diet", "protein"]],
  ["닭가슴살소시지 1개", 90, 14, 2, 3, "snack", ["quick", "simple", "office", "protein"]],
  ["다크초콜릿 2조각", 120, 2, 12, 8, "snack", ["quick", "simple"]],
  ["블루베리 한컵", 85, 1, 21, 0, "snack", ["quick", "simple", "diet", "vegan"]],
  ["딸기 한컵", 50, 1, 12, 0, "snack", ["quick", "simple", "diet", "vegan"]],
  ["키위 1개", 60, 1, 14, 0, "snack", ["quick", "simple", "diet", "vegan"]],
  ["오렌지 1개", 70, 1, 18, 0, "snack", ["quick", "simple", "diet", "vegan"]],
  ["자몽 반개", 50, 1, 13, 0, "snack", ["quick", "simple", "diet", "vegan"]],
  ["방울토마토 한컵", 30, 2, 6, 0, "snack", ["quick", "simple", "diet", "vegan"]],
  ["오이 1개", 30, 1, 6, 0, "snack", ["quick", "simple", "diet", "vegan"]],
  ["당근스틱", 35, 1, 8, 0, "snack", ["quick", "simple", "diet", "vegan"]],
  ["셀러리스틱", 20, 1, 4, 0, "snack", ["quick", "simple", "diet", "vegan"]],
  ["무가당아몬드밀크 200ml", 30, 1, 2, 2, "snack", ["quick", "simple", "diet", "vegan"]],
  ["코코넛워터", 50, 1, 12, 0, "snack", ["quick", "simple", "vegan"]],
  ["풋콩(에다마메) 한컵", 180, 17, 14, 8, "snack", ["quick", "simple", "diet", "protein", "vegan"]],
  ["김 1봉지", 30, 4, 4, 0, "snack", ["quick", "simple", "korean", "diet", "vegan"]],
  ["다시마칩", 80, 4, 12, 2, "snack", ["quick", "simple", "korean"]],
  ["두부칩", 100, 8, 6, 5, "snack", ["quick", "simple", "diet", "protein", "vegan"]],
  ["콩나물무침", 60, 5, 6, 2, "snack", ["korean", "home", "diet", "vegan"]],
  ["미역줄기무침", 50, 2, 8, 1, "snack", ["korean", "home", "diet", "vegan"]],
  ["호박씨 한줌", 130, 6, 4, 12, "snack", ["quick", "simple"]],
  ["해바라기씨 한줌", 140, 5, 6, 12, "snack", ["quick", "simple"]],
  ["호두 5알", 130, 3, 3, 13, "snack", ["quick", "simple"]],
  ["캐슈너트 한줌", 160, 5, 9, 12, "snack", ["quick", "simple"]],
  ["라이스케이크 2개", 70, 1, 16, 0, "snack", ["quick", "simple", "diet"]],
  ["쌀과자 한봉", 110, 2, 24, 1, "snack", ["quick", "simple"]],
  ["단호박찜 100g", 50, 1, 12, 0, "snack", ["quick", "simple", "diet", "vegan"]],
  ["고구마찜 작은것", 110, 2, 26, 0, "snack", ["quick", "simple", "diet", "vegan"]],
  ["옥수수 반개", 70, 2, 16, 1, "snack", ["quick", "simple", "vegan"]],
  ["삶은감자 1개", 130, 3, 30, 0, "snack", ["quick", "simple", "vegan"]],
  ["콘플레이크 한줌", 120, 2, 28, 0, "snack", ["quick", "simple", "office"]],
  ["그래놀라바", 180, 4, 30, 6, "snack", ["quick", "simple", "office"]],
  ["에너지볼 1개", 120, 4, 16, 5, "snack", ["quick", "simple", "office"]],
  ["프로틴쿠키", 180, 12, 18, 7, "snack", ["quick", "simple", "office", "protein"]],
  ["카카오닙스 한스푼", 70, 1, 6, 5, "snack", ["quick", "simple", "vegan"]],
  ["두부+간장", 80, 8, 2, 4, "snack", ["korean", "home", "diet", "protein", "vegan"]],
  ["청포도 한컵", 100, 1, 26, 0, "snack", ["quick", "simple", "diet", "vegan"]],
  ["멜론 한조각", 60, 1, 14, 0, "snack", ["quick", "simple", "diet", "vegan"]],
  ["수박 한조각", 50, 1, 12, 0, "snack", ["quick", "simple", "diet", "vegan"]],
  ["배 반개", 60, 1, 16, 0, "snack", ["quick", "simple", "diet", "vegan"]],

  // ===== office_quick 저녁 보강 (6) — 초간단 모드 저녁 풀 확보 =====
  ["편의점도시락(저녁)+삶은달걀", 600, 28, 78, 18, "dinner", ["office", "quick", "protein"]],
  ["배달닭가슴살볼+현미", 520, 38, 60, 10, "dinner", ["office", "quick", "diet", "protein"]],
  ["연어포케볼(저녁)", 540, 30, 60, 16, "dinner", ["office", "quick", "protein"]],
  ["프로틴쉐이크+닭가슴살랩", 460, 48, 28, 14, "dinner", ["office", "quick", "protein", "diet"]],
  ["통밀파스타+닭가슴살(저녁)", 580, 36, 76, 12, "dinner", ["office", "quick", "protein"]],
  ["닭가슴살샐러드보울(저녁)", 420, 36, 22, 18, "dinner", ["office", "quick", "diet", "protein"]],
];

// ===== 확장 — RAW → MealItem (신/구 필드 모두 채움) =====
function expand(raw: Raw, idx: number): MealItem {
  const [name, calories, protein, carbs, fat, type, tags] = raw;
  const id = `meal_${String(idx + 1).padStart(4, "0")}`;
  return {
    id,
    code: id,
    name,
    calories,
    kcal: calories,
    protein,
    proteinG: protein,
    carbs,
    carbsG: carbs,
    fat,
    fatG: fat,
    fiberG: estimateFiber(name, carbs),
    keyVitamins: [],
    keyMinerals: [],
    hasProbiotic: detectProbiotic(name),
    type,
    slots: [type],
    tags,
    patternFit: [],
    note: "",
  };
}

export const MEAL_LIBRARY: MealItem[] = RAW.map(expand);

// ===== 모드 풀 헬퍼 =====
const HOME_KOREAN_TAGS: MealTag[] = ["korean", "home"];
const OFFICE_QUICK_TAGS: MealTag[] = ["quick", "simple", "office"];

function modeMatches(item: MealItem, mode: PlanMode): boolean {
  if (mode === "random") return true;
  const allow = mode === "home_korean" ? HOME_KOREAN_TAGS : OFFICE_QUICK_TAGS;
  return item.tags.some((t) => allow.includes(t));
}

/**
 * 모드별 메뉴 풀.
 *   · getMealPoolByMode(mode)            — 전체 슬롯, 엔진 호환 (기존 시그니처)
 *   · getMealPoolByMode(type, mode)      — 특정 끼니 슬롯 한정 (신 시그니처)
 * 풀이 5개 미만이면 자동으로 전체 풀 fallback (빈 카드 방지).
 */
export function getMealPoolByMode(mode: PlanMode): MealItem[];
export function getMealPoolByMode(type: MealType, mode: PlanMode): MealItem[];
export function getMealPoolByMode(
  arg1: PlanMode | MealType,
  arg2?: PlanMode,
): MealItem[] {
  if (arg2 !== undefined) {
    const type = arg1 as MealType;
    const mode = arg2;
    const slotPool = MEAL_LIBRARY.filter((m) => m.type === type);
    if (mode === "random") return slotPool;
    const filtered = slotPool.filter((m) => modeMatches(m, mode));
    return filtered.length >= 5 ? filtered : slotPool;
  }
  const mode = arg1 as PlanMode;
  if (mode === "random") return MEAL_LIBRARY.slice();
  return MEAL_LIBRARY.filter((m) => modeMatches(m, mode));
}

/** 무작위 선택 + 최근 ID 회피. recentIds 에 모두 들어 있으면 fallback 으로 회피 풀어 빈 결과 방지. */
export function selectRandomMeal(
  pool: MealItem[],
  recentIds: readonly string[] = [],
): SelectedMeal | null {
  if (pool.length === 0) return null;
  const recent = new Set(recentIds);
  const fresh = pool.filter((m) => !recent.has(m.id));
  const candidates = fresh.length > 0 ? fresh : pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// ===== 엔진 호환: filterMenus =====
/** 슬롯/태그/재료 제한 필터. mealPlanEngine·MealSwapDialog 가 사용. */
export function filterMenus(opts: {
  slot?: MealSlot;
  excludeTags?: string[];
  excludeIngredients?: string[];
  preferPatterns?: string[];
  requireProbiotic?: boolean;
}): MealItem[] {
  return MEAL_LIBRARY.filter((m) => {
    if (opts.slot && !m.slots.includes(opts.slot)) return false;
    if (opts.excludeTags?.some((t) => (m.tags as string[]).includes(t))) return false;
    if (opts.excludeIngredients?.some((ing) => m.name.includes(ing))) return false;
    if (opts.requireProbiotic && !m.hasProbiotic) return false;
    return true;
  });
}
