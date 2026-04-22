/**
 * 153 다이어트 — 21일 식단 · 음식 분류.
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
  /** 짧은 힌트 (조리·양) */
  hint: string;
  /** 청소년 트랙에도 안전하게 노출 가능한가 (ex: '술' = false) */
  youthSafe: boolean;
}

export interface FoodBucket {
  tier: FoodTier;
  label: string;
  summary: string;
  items: readonly FoodItem[];
}

// ──────────────────────────────────────────────────────────────────
// 1. 무제한 — 양 조절 신경 쓰지 않아도 되는 식재료
// ──────────────────────────────────────────────────────────────────
const UNLIMITED_ITEMS: readonly FoodItem[] = Object.freeze([
  { name: "잎채소", hint: "상추·시금치·케일·청경채 등", youthSafe: true },
  { name: "십자화과", hint: "브로콜리·양배추·콜리플라워", youthSafe: true },
  { name: "뿌리·줄기채소", hint: "무·당근·셀러리·오이", youthSafe: true },
  { name: "버섯류", hint: "표고·새송이·느타리·팽이", youthSafe: true },
  { name: "해조류", hint: "미역·김·톳·다시마", youthSafe: true },
  { name: "계란", hint: "삶거나 스크램블 (기름 적게)", youthSafe: true },
  { name: "두부·콩제품", hint: "부침두부·연두부·순두부", youthSafe: true },
  { name: "흰살 생선", hint: "대구·명태·광어 (구이·찜)", youthSafe: true },
  { name: "등푸른 생선", hint: "고등어·삼치·연어 (구이·찜)", youthSafe: true },
  { name: "닭가슴살·안심", hint: "삶거나 에어프라이어", youthSafe: true },
  { name: "물·무가당 차", hint: "보리차·녹차·캐모마일", youthSafe: true },
  { name: "플레인 요거트", hint: "무가당. 그릭 요거트 OK", youthSafe: true },
] as const);

// ──────────────────────────────────────────────────────────────────
// 2. 적정량 — 양만 조절하면 괜찮은 식재료
// ──────────────────────────────────────────────────────────────────
const PORTIONED_ITEMS: readonly FoodItem[] = Object.freeze([
  { name: "현미·통곡물 밥", hint: "반 공기 기준. 활동량 많은 끼니에", youthSafe: true },
  { name: "고구마·단호박", hint: "주먹 하나 크기까지", youthSafe: true },
  { name: "귀리·오트밀", hint: "1/2컵 + 무가당 우유/두유", youthSafe: true },
  { name: "과일", hint: "한 끼 1주먹. 저당 과일 우선 (사과·베리·토마토)", youthSafe: true },
  { name: "견과류", hint: "손바닥 한 줌. 무염 선호", youthSafe: true },
  { name: "살코기", hint: "안심·홍두깨살 등 지방 적은 부위", youthSafe: true },
  { name: "치즈", hint: "한 장 혹은 손가락 2개 크기", youthSafe: true },
  { name: "김치·나또·된장", hint: "짠맛 주의. 반찬 한 스푼 수준", youthSafe: true },
] as const);

// ──────────────────────────────────────────────────────────────────
// 3. 줄이기 — 비율을 낮추면 좋은 음식
// ──────────────────────────────────────────────────────────────────
const REDUCE_ITEMS: readonly FoodItem[] = Object.freeze([
  { name: "흰 쌀·흰 빵", hint: "가능하면 현미·통곡물로 대체", youthSafe: true },
  { name: "밀가루 간식", hint: "떡볶이·빵·국수 (곁들이 정도로만)", youthSafe: true },
  { name: "기름진 고지방 육류", hint: "삼겹·곱창 과식 피하기", youthSafe: true },
  { name: "가공식품", hint: "소시지·햄·즉석식 재료 수 확인", youthSafe: true },
  { name: "짠 국물·절임", hint: "국물 절반·간은 식탁에서", youthSafe: true },
  { name: "커피에 넣는 시럽·설탕", hint: "무가당 or 소량으로 이동", youthSafe: true },
] as const);

// ──────────────────────────────────────────────────────────────────
// 4. 21일 피하기 — 이 기간만이라도 멀리 두는 음식
// ──────────────────────────────────────────────────────────────────
const FORBIDDEN21_ITEMS: readonly FoodItem[] = Object.freeze([
  { name: "당 음료", hint: "탄산·가당 주스·에너지드링크", youthSafe: true },
  { name: "정제 설탕 디저트", hint: "케이크·도넛·마카롱·크림빵", youthSafe: true },
  { name: "야식", hint: "취침 3시간 전부터 음식 끊기", youthSafe: true },
  { name: "튀김류 과식", hint: "프라이드치킨·튀김·감자튀김 무제한 금지", youthSafe: true },
  { name: "라면·인스턴트 한 끼 대체", hint: "주간 예외 0~1회까지", youthSafe: true },
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

/** 청소년 트랙 노출용 — youthSafe=false 제외 + '피하기' 라벨을 부드럽게 */
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
  /** 이 스테이지의 핵심 포커스 */
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
        items: ["운동 전: 바나나 1개 or 요거트 1컵", "운동 후 30분: 단백질 20g + 탄수 (고구마)"],
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
