/**
 * 153 다이어트 — 21일 식단 · 음식 분류 · 식단 패턴.
 *
 * 철학
 *   • "무제한" / "적정량" / "줄이기" / "21일 피하기" 4-단계 구분.
 *   • 숫자·그램 강제 없이 '손바닥·주먹·한 줌' 같은 직관적 단위.
 *   • 청소년(youth_habit) 트랙에는 `youthSafe=false` 항목을 UI 에서 숨기고,
 *     "피하기·금지" 문구도 "성장기 주의" 톤으로 약화해 노출.
 *   • 모든 카피는 자체 작성. 외부 서적·블로그 직접 인용 없음.
 */

export type FoodTier = "unlimited" | "portioned" | "reduce" | "forbidden21";

export interface FoodItem {
  name: string;
  hint: string;
  youthSafe: boolean;
}

export interface FoodBucket {
  tier: FoodTier;
  label: string;
  summary: string;
  items: readonly FoodItem[];
}

// ──────────────────────────────────────────────────────────────────
// 1. 무제한 — 양을 크게 신경 쓰지 않아도 되는 재료
// ──────────────────────────────────────────────────────────────────
const UNLIMITED_ITEMS: readonly FoodItem[] = Object.freeze([
  // 잎채소
  { name: "상추·로메인", hint: "쌈·샐러드 무제한", youthSafe: true },
  { name: "시금치·케일", hint: "데치거나 살짝 볶기", youthSafe: true },
  { name: "루꼴라·청경채", hint: "기름 없이 볶기·샐러드", youthSafe: true },
  { name: "깻잎·치커리·근대", hint: "쌈 또는 반찬", youthSafe: true },
  // 십자화과
  { name: "브로콜리·콜리플라워", hint: "데치거나 에어프라이어", youthSafe: true },
  { name: "양배추·방울양배추", hint: "찜·구이·쌈", youthSafe: true },
  // 뿌리·줄기
  { name: "무·당근·셀러리·오이", hint: "생/절임(간 약하게)", youthSafe: true },
  { name: "파프리카·피망", hint: "생/볶음", youthSafe: true },
  { name: "가지·애호박", hint: "기름 최소로 구이·조림", youthSafe: true },
  // 버섯
  { name: "표고·새송이·느타리", hint: "구이·볶음·국", youthSafe: true },
  { name: "팽이·양송이·목이", hint: "국·수프·볶음", youthSafe: true },
  // 해조
  { name: "미역·다시마", hint: "국·무침·쌈", youthSafe: true },
  { name: "김·매생이·톳", hint: "구이·무침·반찬", youthSafe: true },
  // 계란
  { name: "계란 (삶기/수란)", hint: "하루 2~4개 가능", youthSafe: true },
  { name: "스크램블·프리타타", hint: "기름 최소, 채소 듬뿍", youthSafe: true },
  // 두부·콩
  { name: "부침두부·연두부·순두부", hint: "구이·찜·탕", youthSafe: true },
  { name: "무가당 두유·콩물", hint: "당 함량 라벨 확인", youthSafe: true },
  // 흰살 생선
  { name: "대구·명태·동태", hint: "구이·찜·탕", youthSafe: true },
  { name: "광어·도미·농어·참돔", hint: "회·구이·찜", youthSafe: true },
  // 등푸른 생선
  { name: "고등어·삼치", hint: "기름 없이 구이", youthSafe: true },
  { name: "연어", hint: "구이·스테이크·회", youthSafe: true },
  { name: "꽁치·정어리·청어", hint: "구이 또는 캔(기름 뺀)", youthSafe: true },
  { name: "참치캔 (기름 뺀 것)", hint: "샐러드·비빔밥 토핑", youthSafe: true },
  // 해산물
  { name: "새우·대하", hint: "찜·구이·볶음", youthSafe: true },
  { name: "오징어·꼴뚜기·쭈꾸미·낙지", hint: "데치거나 구이", youthSafe: true },
  { name: "문어·갑오징어", hint: "삶아 초장 소량", youthSafe: true },
  { name: "전복·소라·골뱅이", hint: "찜·구이·볶음", youthSafe: true },
  { name: "굴·홍합·바지락·가리비", hint: "찜·탕·볶음", youthSafe: true },
  { name: "게·대게살", hint: "찜·소량의 소스", youthSafe: true },
  // 닭
  { name: "닭가슴살·안심", hint: "삶기·구이·에어프라이어", youthSafe: true },
  { name: "닭다리살 (껍질 제거)", hint: "기름 적게 굽기", youthSafe: true },
  // 음료
  { name: "물·탄산수(무가당)", hint: "텀블러에 나눠 1.5L+", youthSafe: true },
  { name: "무가당 차 (보리·녹차·루이보스)", hint: "하루 여러 잔", youthSafe: true },
  { name: "블랙커피", hint: "시럽·설탕 없이 / 청소년은 제한", youthSafe: true },
  // 유제품 (무가당)
  { name: "플레인 그릭요거트", hint: "무가당. 견과 토핑 OK", youthSafe: true },
  { name: "코티지 치즈", hint: "단백질 풍부, 소금 낮은 것", youthSafe: true },
  // 간편 단백질 (쉐이크·큐브 등)
  { name: "무가당 단백질 쉐이크", hint: "당 5g 이하, 단백 20g+", youthSafe: false },
  { name: "닭가슴살 큐브/스틱", hint: "편의점 저염 제품 OK", youthSafe: true },
  { name: "구운 계란·훈제 계란", hint: "출근길·간식 간편", youthSafe: true },
  { name: "샐러드 팩 (소스 최소)", hint: "드레싱 별도, 절반만", youthSafe: true },
  // 반찬
  { name: "김치 (익은 배추·무)", hint: "짠맛 강하면 한 스푼", youthSafe: true },
  { name: "나물·무침 (간 약하게)", hint: "시금치·콩나물·고사리", youthSafe: true },
] as const);

// ──────────────────────────────────────────────────────────────────
// 2. 적정량 — 양·타이밍만 맞추면 되는 재료
// ──────────────────────────────────────────────────────────────────
const PORTIONED_ITEMS: readonly FoodItem[] = Object.freeze([
  // 탄수 · 곡물
  { name: "현미밥·잡곡밥", hint: "반 공기 기준. 활동량 많은 끼니에", youthSafe: true },
  { name: "귀리·오트밀", hint: "1/2컵 + 무가당 두유", youthSafe: true },
  { name: "메밀·퀴노아", hint: "샐러드 베이스로 한 컵", youthSafe: true },
  { name: "호밀빵·통밀빵", hint: "한 쪽 (설탕·마가린 적은 것)", youthSafe: true },
  { name: "고구마·단호박", hint: "주먹 하나 크기", youthSafe: true },
  { name: "감자 (찐/구운)", hint: "주먹 하나, 튀기지 않기", youthSafe: true },
  // 과일
  { name: "사과·배·감", hint: "한 개 또는 반 개", youthSafe: true },
  { name: "베리류 (블루·라즈·딸기)", hint: "한 줌", youthSafe: true },
  { name: "귤·오렌지·자몽", hint: "작은 것 1~2개", youthSafe: true },
  { name: "키위·파인애플", hint: "반 개~한 개", youthSafe: true },
  { name: "토마토·방울토마토", hint: "무제한에 가까움, 드레싱 주의", youthSafe: true },
  // 견과 · 씨앗
  { name: "아몬드·호두·피칸", hint: "손바닥 한 줌", youthSafe: true },
  { name: "캐슈넛·마카다미아·피스타치오", hint: "무염 우선, 한 줌", youthSafe: true },
  { name: "치아씨드·아마씨", hint: "1~2큰술, 요거트 토핑", youthSafe: true },
  // 살코기 · 수육
  { name: "보쌈 (수육)", hint: "지방 적은 부위·수육으로. 쌈채소와", youthSafe: true },
  { name: "안심스테이크", hint: "손바닥 크기. 기름 최소", youthSafe: true },
  { name: "불고기 (살코기)", hint: "설탕·간 약한 양념 기준", youthSafe: true },
  { name: "돼지 안심·등심 (살코기)", hint: "구이·찜", youthSafe: true },
  { name: "오리 훈제 (껍질 제거)", hint: "지방 많은 부위 제거", youthSafe: true },
  // 유제품
  { name: "모짜렐라·리코타", hint: "손가락 2개 크기", youthSafe: true },
  { name: "체다·고다 치즈", hint: "한 장 (슬라이스)", youthSafe: true },
  // 가공 발효 소량
  { name: "된장·청국장", hint: "국 한 그릇 분량", youthSafe: true },
  { name: "나또·낫또", hint: "1팩, 단백·섬유 풍부", youthSafe: true },
  // 콩/팥 등
  { name: "삶은 콩·렌틸콩·병아리콩", hint: "1/2컵. 샐러드·수프", youthSafe: true },
] as const);

// ──────────────────────────────────────────────────────────────────
// 3. 줄이기 — 비율을 낮추면 좋은 음식
// ──────────────────────────────────────────────────────────────────
const REDUCE_ITEMS: readonly FoodItem[] = Object.freeze([
  { name: "흰 쌀·흰 빵", hint: "가능하면 현미·통곡물로 대체", youthSafe: true },
  { name: "밀가루 간식", hint: "떡볶이·빵·국수 (곁들이 정도)", youthSafe: true },
  { name: "기름진 고지방 육류", hint: "삼겹·곱창 과식 피하기", youthSafe: true },
  { name: "가공식품", hint: "소시지·햄·즉석식 재료 확인", youthSafe: true },
  { name: "짠 국물·절임", hint: "국물 절반·간은 식탁에서", youthSafe: true },
  { name: "커피 시럽·설탕", hint: "무가당 or 소량으로 이동", youthSafe: true },
] as const);

// ──────────────────────────────────────────────────────────────────
// 4. 21일 피하기
// ──────────────────────────────────────────────────────────────────
const FORBIDDEN21_ITEMS: readonly FoodItem[] = Object.freeze([
  { name: "당 음료", hint: "탄산·가당 주스·에너지드링크", youthSafe: true },
  { name: "정제 설탕 디저트", hint: "케이크·도넛·마카롱·크림빵", youthSafe: true },
  { name: "야식", hint: "취침 3시간 전부터 음식 끊기", youthSafe: true },
  { name: "튀김류 과식", hint: "프라이드·튀김·감자튀김", youthSafe: true },
  { name: "라면·인스턴트 한 끼 대체", hint: "주간 0~1회까지", youthSafe: true },
  { name: "과자 큰 봉지 통째로", hint: "절반·소분해서 먹기", youthSafe: true },
  { name: "술", hint: "21일 동안은 쉬어가기", youthSafe: false },
] as const);

// ──────────────────────────────────────────────────────────────────
// 공개 버킷
// ──────────────────────────────────────────────────────────────────
export const FOOD_BUCKETS: readonly FoodBucket[] = Object.freeze([
  {
    tier: "unlimited",
    label: "무제한",
    summary:
      "양을 크게 신경쓰지 않고 먹어도 되는 재료. 색과 식감을 다양하게 가져가세요.",
    items: UNLIMITED_ITEMS,
  },
  {
    tier: "portioned",
    label: "적정량",
    summary:
      "양과 타이밍만 맞추면 좋은 에너지원. 활동량 많은 끼니에 배치하는 게 핵심.",
    items: PORTIONED_ITEMS,
  },
  {
    tier: "reduce",
    label: "줄이기",
    summary:
      "완전히 끊기보다 비율을 낮추는 대상. 주간 빈도·양을 조금씩 줄입니다.",
    items: REDUCE_ITEMS,
  },
  {
    tier: "forbidden21",
    label: "21일 피하기",
    summary:
      "이 기간 동안만 멀리 두는 목록. 21일 이후엔 빈도를 스스로 정해 돌아갑니다.",
    items: FORBIDDEN21_ITEMS,
  },
] as const);

/** 청소년 트랙 노출용 */
export function getYouthSafeBuckets(): FoodBucket[] {
  return FOOD_BUCKETS.map((b) => ({
    ...b,
    label: b.tier === "forbidden21" ? "성장기 주의" : b.label,
    items: b.items.filter((i) => i.youthSafe),
  }));
}

// ──────────────────────────────────────────────────────────────────
// 스테이지별 샘플 식단 (하루 4끼 구조)
// ──────────────────────────────────────────────────────────────────
export type DietStageId = "reset" | "burning" | "lifestyle";

export interface DaySampleMeal {
  slot: string;
  items: readonly string[];
  note?: string;
}

export interface StageSample {
  stage: DietStageId;
  title: string;
  range: string;
  meals: readonly DaySampleMeal[];
  focus: string;
}

export const STAGE_SAMPLES: readonly StageSample[] = Object.freeze([
  {
    stage: "reset",
    title: "Reset · 식사 리듬 회복",
    range: "Day 1 ~ 7",
    focus: "시간 고정 + 당·야식 제거",
    meals: [
      {
        slot: "아침",
        items: ["삶은 계란 2개", "데친 브로콜리 한 접시", "플레인 요거트 1컵", "물 한 컵"],
      },
      {
        slot: "점심",
        items: ["현미 반 공기", "닭가슴살 구이 손바닥 1개 크기", "쌈채소·오이", "김치 한 스푼"],
        note: "점심을 가장 든든하게 — 오후 활동량 대비",
      },
      {
        slot: "저녁",
        items: ["두부구이 반 모", "생선구이 or 흰살찜", "시금치 무침·미역국"],
        note: "탄수는 줄이고 단백질·채소 위주",
      },
      {
        slot: "간식 (옵션)",
        items: ["아몬드 한 줌", "또는 삶은 계란 1개"],
      },
    ],
  },
  {
    stage: "burning",
    title: "Burning · 대사 민감성 회복",
    range: "Day 8 ~ 14",
    focus: "단백질 + 채소 기본형 + 활동량 증가",
    meals: [
      {
        slot: "아침",
        items: ["스크램블 에그 2개", "아보카도 1/2 (성인) / 바나나 1개 (청소년)", "무가당 차"],
      },
      {
        slot: "점심",
        items: ["퀴노아·현미 반 공기", "연어구이 or 닭가슴살", "샐러드 한 접시 (올리브오일 드레싱)"],
      },
      {
        slot: "저녁",
        items: ["단백질 한 덩이 (닭가슴살·생선·두부)", "데친 채소 한 접시", "해조류 반찬"],
        note: "취침 3시간 전 마지막 식사",
      },
      {
        slot: "운동 전후",
        items: ["운동 전: 바나나 1개 or 요거트 1컵", "운동 후 30분: 단백질 20g + 고구마"],
      },
    ],
  },
  {
    stage: "lifestyle",
    title: "Lifestyle · 유지형 식사",
    range: "Day 15 ~ 21",
    focus: "외식·무너진 끼니 후 복귀 연습",
    meals: [
      {
        slot: "아침",
        items: ["본인 루틴 유지 + 단백질 1가지 확보", "물 한 컵부터"],
        note: "'단백질 먼저' 원칙만 지키면 OK",
      },
      {
        slot: "점심",
        items: ["외식 자리: 단백질·채소가 있는 메뉴 우선", "국물·소스는 절반만"],
      },
      {
        slot: "저녁",
        items: ["가볍게. 단백질 + 채소 중심", "어제 과식했다면 오늘은 평소대로"],
      },
      {
        slot: "주말 예외",
        items: ["계획된 예외 1끼 허용", "다음 끼니에 즉시 제자리"],
        note: "완벽함 대신 회복 속도를 목표로",
      },
    ],
  },
] as const);

// ──────────────────────────────────────────────────────────────────
// 3종 대표 식단 패턴 (심플 · 보통 · 정석)
//   사용자가 자신의 라이프스타일에 맞춰 하나를 고르거나 참고해서
//   DIY Composer 로 자신만의 식단을 구성할 수 있다.
// ──────────────────────────────────────────────────────────────────
export type DietPatternId = "simple" | "moderate" | "classic";

export interface DietPatternMeal {
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  label: string;
  items: readonly string[];
  note?: string;
}

export interface DietPattern {
  id: DietPatternId;
  title: string;
  subtitle: string;
  prepTime: string;
  bestFor: string;
  caveat: string;
  meals: readonly DietPatternMeal[];
  tips: readonly string[];
  /** 청소년 트랙에 그대로 권장 가능한가 */
  youthRecommended: boolean;
}

export const DIET_PATTERNS: readonly DietPattern[] = Object.freeze([
  {
    id: "simple",
    title: "심플",
    subtitle: "5분 준비 · 외식·출장형 직장인 기본",
    prepTime: "끼니당 5~10분",
    bestFor: "요리 시간 부족 / 외식 많음 / 최소 결정 피로",
    caveat: "쉐이크 대체는 성인 기본 트랙만 · 청소년은 비권장 · 주 2~3회 상한",
    youthRecommended: false,
    meals: [
      {
        slot: "breakfast",
        label: "아침",
        items: ["무가당 단백질 쉐이크 1잔", "블루베리 한 줌 or 사과 1/2"],
        note: "물 또는 무가당 두유와 함께",
      },
      {
        slot: "lunch",
        label: "점심",
        items: [
          "편의점 닭가슴살 큐브/스틱 + 샐러드 팩 (소스 절반)",
          "생수 500ml",
        ],
      },
      {
        slot: "dinner",
        label: "저녁",
        items: ["두부 반 모 + 쌈채소", "미역국 or 달걀국 한 그릇"],
        note: "5분 조리 가능",
      },
      {
        slot: "snack",
        label: "간식",
        items: ["삶은 계란 1개 or 아몬드 한 줌"],
      },
    ],
    tips: [
      "쉐이크는 당 5g 이하 · 단백질 20g 이상 제품만",
      "매일 쉐이크는 피하고 2~3회 상한 · 나머진 자연식",
      "청소년은 쉐이크 대체 비권장 — 집밥 위주로 전환",
    ],
  },
  {
    id: "moderate",
    title: "보통",
    subtitle: "집밥 + 간편 조합 · 가장 일반적",
    prepTime: "끼니당 15~25분",
    bestFor: "주 3~5회 집밥 가능 · 외식도 병행",
    caveat: "주말 외식 잦으면 월요일 리셋 전략 필요",
    youthRecommended: true,
    meals: [
      {
        slot: "breakfast",
        label: "아침",
        items: [
          "계란 2개 (스크램블/삶기)",
          "오트밀 1/2컵 + 무가당 두유",
          "과일 한 조각",
        ],
      },
      {
        slot: "lunch",
        label: "점심",
        items: [
          "현미 반 공기 + 생선구이 or 보쌈 (수육)",
          "쌈채소 + 김치",
        ],
        note: "점심에 탄수 배치 — 활동량 많은 끼니",
      },
      {
        slot: "dinner",
        label: "저녁",
        items: [
          "두부 or 닭가슴살",
          "채소 볶음 + 미역국",
        ],
        note: "탄수 최소화",
      },
      {
        slot: "snack",
        label: "간식",
        items: [
          "그릭 요거트 + 베리",
          "또는 삶은 계란 + 견과 한 줌",
        ],
      },
    ],
    tips: [
      "주 1~2회 외식은 점심에 배치",
      "저녁은 탄수 최소 · 단백질·채소 중심",
      "주말에 밑반찬 1~2가지 미리 만들기",
    ],
  },
  {
    id: "classic",
    title: "정석",
    subtitle: "집밥·운동·수면까지 풀 관리형",
    prepTime: "끼니당 25~40분",
    bestFor: "집에서 조리 가능 · 근육 보존까지 원함",
    caveat: "식재료 관리·조리 시간 부담 있음",
    youthRecommended: true,
    meals: [
      {
        slot: "breakfast",
        label: "아침",
        items: [
          "오트밀 + 무가당 두유 + 베리",
          "계란 2개 or 그릭 요거트",
          "견과 한 줌",
        ],
      },
      {
        slot: "lunch",
        label: "점심",
        items: [
          "잡곡밥 1공기",
          "생선구이 or 보쌈 (수육)",
          "채소 3종 (색 다르게) + 나물",
          "김치 · 해조류 반찬",
        ],
        note: "단백질 + 복합 탄수 + 채소 풀세트",
      },
      {
        slot: "dinner",
        label: "저녁",
        items: [
          "두부구이 + 해산물 (새우·문어·오징어)",
          "쌈채소 + 미역국",
        ],
        note: "탄수 최소 · 단백질·채소 중심",
      },
      {
        slot: "snack",
        label: "간식",
        items: [
          "견과 한 줌 + 과일 한 조각",
          "운동 전후: 바나나 or 고구마",
        ],
      },
    ],
    tips: [
      "운동 전: 바나나 1개 / 운동 후 30분: 단백질 20g + 탄수",
      "주말에 밑반찬 미리 (쪄둔 닭가슴살·데친 브로콜리·삶은 계란)",
      "수면 7시간 고정이 감량·회복의 숨은 레버",
    ],
  },
] as const);

/** 템플릿 적용용 — 패턴의 meals 를 slot-name 배열 맵으로 변환 */
export function flattenPatternToMealMap(
  pattern: DietPattern,
): Record<"breakfast" | "lunch" | "dinner" | "snack", string[]> {
  const out: Record<"breakfast" | "lunch" | "dinner" | "snack", string[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };
  for (const m of pattern.meals) {
    out[m.slot] = [...m.items];
  }
  return out;
}

/** 모든 음식 이름 목록 (DIY composer 에서 자동완성용) */
export function getAllFoodItemNames(): string[] {
  const set = new Set<string>();
  for (const b of FOOD_BUCKETS) {
    for (const it of b.items) set.add(it.name);
  }
  return Array.from(set);
}
