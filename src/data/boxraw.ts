/**
 * 🥊 BOXRAW(복스로우) 공식 앰버서더 체육관 — 153 마켓 칸 · TV 공지가 같이 쓰는 정본 (2026-11-26 23시 대표님)
 *   「복스로우와 153복싱짐 선릉역점이 mou 체결하게 되었어 공식 엠버서더 체육관이 되서 … 마이복서 153마켓에 복스로우 제품도 링크와 함께
 *    넣어놓자 전용링크는 이거야」 · 「해당 링크가 바로 앰배서더 전용 링크입니다. 링크에는 추적 코드가 포함되어 있어 해당 링크를 통한 접속
 *    내역을 확인할 수 있습니다. 구매 시에는 해당 링크를 통해 접속하신 후 프로모션 코드 153boxing20을 사용하시면 됩니다」 ·
 *   「복스로우 로고와 복스로우 제품 모두 사용가능하니 … 300만원상당의 고가 장비 제공 샌드백 모두 전면 교체 복싱계의 명품 브랜드라고
 *    소개해줘 코치님들 트레이닝복 의류 지원」
 *
 * 규칙
 *   · 공식몰로 가는 주소는 모두 전용 링크의 추적 값(utm_source=inst&utm_medium=153boxing)을 단다 — 첫 화면은 대표님이 준 주소 그대로(BOXRAW_LINK).
 *     제품 · 분류 주소도 같은 값을 붙인다(공식몰도 분류 화면 주소에 utm 이 붙어 오는 것을 전제로 만들어져 있다).
 *   · 가격은 적지 않는다 — 공식몰 할인 · 프로모션 코드로 수시로 바뀐다. 「가격 · 재고는 공식몰에서」 한 줄.
 *   · 제품 사진 · 로고는 공식몰 것(대표님: 로고 · 제품 사진 사용 가능) — public/market/boxraw/ 에 받아 둔 정적 파일(사진은 공식몰 485×730 webp 그대로,
 *     로고는 공식몰 머리 로고의 모양 그대로 · 색만 검정 #000 을 넣음). 제품은 11/26 공식몰에서 사이즈 · 색이 남아 있던 것으로 골랐다.
 *   · 보이는 곳: 앰버서더 지점(BOXRAW_BRANCHES)의 153 마켓 맨 위 칸 · TV 2번 체육관 공지사항.
 */

/** 앰버서더 지점(정식 이름) */
export const BOXRAW_BRANCHES: readonly string[] = ["153복싱짐 선릉역점"];

/** 전용 링크의 추적 값 — 공식몰로 가는 모든 주소에 단다 */
export const BOXRAW_UTM = "utm_source=inst&utm_medium=153boxing";

/** 대표님이 준 앰버서더 전용 링크(첫 화면) — 글자 하나 바꾸지 않는다 */
export const BOXRAW_LINK = "https://kr.boxraw.com/?utm_source=inst&utm_medium=153boxing";

/** 공식몰 결제 때 넣는 프로모션 코드 */
export const BOXRAW_CODE = "153boxing20";

const ORIGIN = "https://kr.boxraw.com";

/** 공식몰 주소 + 추적 값 — boxrawUrl("/") 는 BOXRAW_LINK 와 같다 */
export const boxrawUrl = (path = "/"): string => {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${ORIGIN}${p}${p.includes("?") ? "&" : "?"}${BOXRAW_UTM}`;
};

export const isBoxrawBranch = (branch: string | null | undefined): boolean =>
  !!branch && BOXRAW_BRANCHES.includes(branch.trim());

export interface BoxrawProduct {
  /** 사진 파일 이름과 같다 */
  id: string;
  /** 공식몰 제품 이름 그대로 */
  name: string;
  /** 짧은 갈래 */
  kind: string;
  /** 공식몰 제품 주소(색까지 정해진 주소) */
  path: string;
  image: string;
}

/** 마켓 칸에 보이는 제품 — 11/26 공식몰에서 사이즈 · 색이 남아 있던 것 */
export const BOXRAW_PRODUCTS: readonly BoxrawProduct[] = [
  { id: "impello-2", name: "임펠로 2.0 복싱화", kind: "복싱화", path: "/product/1ea64v87d", image: "/market/boxraw/impello-2.webp" },
  { id: "wraps-45", name: "복스로 4.5m 핸드랩", kind: "핸드랩", path: "/product/1ea32v860", image: "/market/boxraw/wraps-45.webp" },
  { id: "hegler-sauna-2", name: "헤글러 사우나 수트 2.0", kind: "사우나 수트", path: "/product/1ea19v86c", image: "/market/boxraw/hegler-sauna-2.webp" },
  { id: "wdpb-tee", name: "We Don't Play Boxing 오버사이즈 티셔츠", kind: "티셔츠", path: "/product/1e9f5v885", image: "/market/boxraw/wdpb-tee.webp" },
  { id: "ring-hoodie", name: "링 x 복스로 오버사이즈 후디", kind: "후디", path: "/product/1f2eev890", image: "/market/boxraw/ring-hoodie.webp" },
  { id: "valdez-shorts", name: "발데스 쇼츠", kind: "쇼츠", path: "/product/1e9f2v87a", image: "/market/boxraw/valdez-shorts.webp" },
  { id: "eaststreet-jogger", name: "이스트 스트리트 조거팬츠", kind: "여성 조거", path: "/product/1ea09v86a", image: "/market/boxraw/eaststreet-jogger.webp" },
  { id: "glove-sweatband", name: "복스로 글러브 스웻 밴드 (2 팩)", kind: "스웻 밴드", path: "/product/1ea36v860", image: "/market/boxraw/glove-sweatband.webp" },
];

/** 분류 바로 가기 — 공식몰 분류 화면(재고 · 새 제품은 늘 그쪽이 맞다) */
export const BOXRAW_CATEGORIES: readonly { label: string; path: string }[] = [
  { label: "복싱 글러브", path: "/catalog/strike-glove" },
  { label: "핸드랩", path: "/catalog/wraps" },
  { label: "복싱화", path: "/catalog/boxers" },
  { label: "샌드백", path: "/catalog/sand-bag" },
  { label: "남성 의류", path: "/catalog/clothing-for-men" },
  { label: "여성 의류", path: "/catalog/clothing-for-women" },
];

/** 회원에게 보이는 글 — 한글 AI 티 지우기(im-not-ai) 거침 · 대표님 말 밖의 사실은 쓰지 않는다 */
export const BOXRAW_COPY = {
  badge: "공식 앰버서더 체육관",
  title: "복싱계의 명품 브랜드 BOXRAW",
  line: "153복싱짐 선릉역점이 BOXRAW 공식 앰버서더 체육관이 됐어요",
  codeLabel: "프로모션 코드",
  codeHow: "아래 링크로 공식몰에 들어가 결제할 때 넣어 주세요",
  shop: "BOXRAW 공식몰 바로 가기",
  note: "체육관 샌드백도 모두 BOXRAW로 바꿨어요 · 가격과 재고는 공식몰에서 확인해요",
} as const;
