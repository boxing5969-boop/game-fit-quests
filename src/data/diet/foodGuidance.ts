/**
 * 153 다이어트 — 음식 가이드 카드.
 *
 * 두 축: "줄이기/피하기" vs "권장". 모든 카피는 자체 작성 — 외부
 * 자료·책 문구 직접 인용 없이, 원리만 벤치마킹해 앱 상황에 맞는
 * 짧은 한국어 한 줄로 재구성한다.
 *
 * 규칙
 *   • 청소년(youth_habit) 에서는 "금식/거르기/극단 제한" 표현 없음.
 *   • 성인 표준(adult_standard) 에서도 기본 톤은 "줄이기" 지 "완전
 *     금지" 아님.
 *   • 음식 이름만 나열하지 않고 왜/어떻게 짧게 붙인다.
 */

export type FoodGuideStance = "reduce" | "encourage";
export type FoodGuideCategory =
  | "drink"
  | "dessert"
  | "snack"
  | "grain"
  | "fried"
  | "processed"
  | "protein"
  | "vegetable"
  | "seafood"
  | "fermented"
  | "fat"
  | "nuts"
  | "whole_grain";

export interface FoodGuideCard {
  id: string;
  stance: FoodGuideStance;
  category: FoodGuideCategory;
  /** 1~2단어의 주제 (카드 제목) */
  title: string;
  /** 예시 음식 (쉼표 구분) */
  examples: string;
  /** 왜/어떻게 — 한 줄 코칭 */
  coaching: string;
  /** 청소년 트랙에 그대로 노출해도 안전한지 */
  youthSafe: boolean;
}

// ──────────────────────────────────────────────────────────────────
// REDUCE — 줄이기/피하기
// ──────────────────────────────────────────────────────────────────
const REDUCE_CARDS: readonly FoodGuideCard[] = [
  {
    id: "r-alcohol",
    stance: "reduce",
    category: "drink",
    title: "술",
    examples: "소주, 맥주, 와인, 폭탄주",
    coaching: "빈 칼로리에 회복력까지 깎입니다. 오늘 한잔은 내일 습관을 무너뜨리는 첫 도미노예요.",
    youthSafe: false,
  },
  {
    id: "r-sugary-drink",
    stance: "reduce",
    category: "drink",
    title: "당 음료",
    examples: "탄산음료, 가당 주스, 에너지드링크, 단 커피",
    coaching: "액체 설탕은 포만감 없이 지방이 됩니다. 같은 시간대 물이나 무가당 차로 맞바꾸세요.",
    youthSafe: true,
  },
  {
    id: "r-dessert",
    stance: "reduce",
    category: "dessert",
    title: "디저트",
    examples: "케이크, 마카롱, 아이스크림, 크림빵",
    coaching: "주 1회 '계획된 즐거움'이면 괜찮습니다. 무의식적으로 매일 먹는 패턴만 끊어요.",
    youthSafe: true,
  },
  {
    id: "r-snack-flour",
    stance: "reduce",
    category: "snack",
    title: "과자·튀김·라면",
    examples: "감자칩, 도넛, 컵라면, 프라이드치킨",
    coaching: "한 봉지 가볍게 비우기 쉽지만, 칼로리는 한 끼보다 많습니다. 절반만 꺼내 먹기.",
    youthSafe: true,
  },
  {
    id: "r-flour-snack",
    stance: "reduce",
    category: "grain",
    title: "밀가루 간식",
    examples: "빵, 떡볶이, 국수, 부침개",
    coaching: "혈당 스파이크가 빠릅니다. 한 끼 대신이 아니라면 '곁들이' 정도로만.",
    youthSafe: true,
  },
  {
    id: "r-late-night",
    stance: "reduce",
    category: "snack",
    title: "늦은 야식",
    examples: "야식 배달, 취침 직전 간식",
    coaching: "수면의 질이 떨어지고 체지방 저장 스위치가 켜집니다. 취침 3시간 전엔 끊기.",
    youthSafe: true,
  },
  {
    id: "r-processed",
    stance: "reduce",
    category: "processed",
    title: "과도한 가공식품",
    examples: "소시지, 인스턴트 수프, 냉동 피자, 조리된 도시락",
    coaching: "첨가물·나트륨이 습관을 흔듭니다. 재료가 1~3개로 떨어지는 음식을 우선.",
    youthSafe: true,
  },
  {
    id: "r-salty",
    stance: "reduce",
    category: "processed",
    title: "너무 짠 음식",
    examples: "짜장/짬뽕 국물, 찌개 다 먹기, 절임류 과다",
    coaching: "붓기·갈증·과식의 연쇄를 부릅니다. 국물은 절반, 간은 식탁에서 직접.",
    youthSafe: true,
  },
  {
    id: "r-fatty-meat",
    stance: "reduce",
    category: "fat",
    title: "기름진 고지방 육류 과식",
    examples: "삼겹살 무한리필, 곱창, 치킨 튀김 옷",
    coaching: "완전 금지 아니라 '양 조절'. 단백질은 챙기되 지방 많은 부위는 덜.",
    youthSafe: true,
  },
] as const;

// ──────────────────────────────────────────────────────────────────
// ENCOURAGE — 권장
// ──────────────────────────────────────────────────────────────────
const ENCOURAGE_CARDS: readonly FoodGuideCard[] = [
  {
    id: "e-water",
    stance: "encourage",
    category: "drink",
    title: "물",
    examples: "생수, 보리차, 무가당 차",
    coaching: "식전 1컵만 챙겨도 과식 확률이 내려갑니다. 하루 1.5L 부담 없이 나눠서.",
    youthSafe: true,
  },
  {
    id: "e-egg",
    stance: "encourage",
    category: "protein",
    title: "계란",
    examples: "삶은 계란, 스크램블, 반숙",
    coaching: "가장 쉽고 값싼 단백질. 아침 첫 입으로 아주 잘 맞습니다.",
    youthSafe: true,
  },
  {
    id: "e-tofu",
    stance: "encourage",
    category: "protein",
    title: "두부",
    examples: "부침두부, 연두부, 순두부",
    coaching: "식물성 단백 + 포만감. 데워서 간장 살짝만.",
    youthSafe: true,
  },
  {
    id: "e-fish-seafood",
    stance: "encourage",
    category: "seafood",
    title: "생선·해산물",
    examples: "연어, 고등어, 오징어, 새우",
    coaching: "양질의 단백질·오메가3. 구이·찜으로 조리하면 지방 부담이 가장 적습니다.",
    youthSafe: true,
  },
  {
    id: "e-lean-meat",
    stance: "encourage",
    category: "protein",
    title: "닭가슴살·살코기",
    examples: "닭가슴살, 안심, 홍두깨살",
    coaching: "지방 적은 부위를 골라 단백질 집중. 삶거나 에어프라이어로.",
    youthSafe: true,
  },
  {
    id: "e-yogurt",
    stance: "encourage",
    category: "fermented",
    title: "플레인 요거트",
    examples: "무가당 그릭 요거트, 플레인 요거트",
    coaching: "가당 제품 대신 무가당. 견과·과일 한 숟갈이면 충분한 간식이 됩니다.",
    youthSafe: true,
  },
  {
    id: "e-veggies",
    stance: "encourage",
    category: "vegetable",
    title: "채소",
    examples: "잎채소, 브로콜리, 파프리카, 오이",
    coaching: "양이 아니라 '색'을 늘리세요. 색 3가지면 영양소가 고르게 들어옵니다.",
    youthSafe: true,
  },
  {
    id: "e-mushrooms",
    stance: "encourage",
    category: "vegetable",
    title: "버섯",
    examples: "표고, 새송이, 느타리",
    coaching: "식감·포만감·미네랄. 볶음·국에 한 움큼 추가해도 칼로리 부담 적습니다.",
    youthSafe: true,
  },
  {
    id: "e-seaweed",
    stance: "encourage",
    category: "seafood",
    title: "해조류",
    examples: "미역, 김, 톳",
    coaching: "국·반찬 한 가지만 더 얹어도 식이섬유·요오드가 채워집니다.",
    youthSafe: true,
  },
  {
    id: "e-nuts",
    stance: "encourage",
    category: "nuts",
    title: "적당량 견과",
    examples: "아몬드, 호두, 땅콩(무염)",
    coaching: "'한 줌' 이상은 칼로리 폭발. 손바닥 한 줌까지만.",
    youthSafe: true,
  },
  {
    id: "e-whole-grain",
    stance: "encourage",
    category: "whole_grain",
    title: "양 조절한 밥·통곡물",
    examples: "현미, 귀리, 퀴노아, 잡곡",
    coaching: "탄수 금지가 아니라 '양과 타이밍'. 활동량 많은 끼니에 반 공기 기준.",
    youthSafe: true,
  },
] as const;

// ──────────────────────────────────────────────────────────────────
// 공개 카탈로그
// ──────────────────────────────────────────────────────────────────
export const FOOD_GUIDE_CARDS: readonly FoodGuideCard[] = Object.freeze([
  ...REDUCE_CARDS,
  ...ENCOURAGE_CARDS,
]);

/** 청소년 트랙 노출용 — 술 등 `youthSafe=false` 카드 제외. */
export function getYouthSafeGuide(): readonly FoodGuideCard[] {
  return FOOD_GUIDE_CARDS.filter((c) => c.youthSafe);
}

/** stance 기준 필터 */
export function getFoodGuideByStance(
  stance: FoodGuideStance,
): readonly FoodGuideCard[] {
  return FOOD_GUIDE_CARDS.filter((c) => c.stance === stance);
}
