/**
 * 🧠 마음 능력치 — 문항 · 보기 · 출처 한 곳 (2026-11-14 대표님 「마이복서 153 정신적인 향상도 넣자 · 운동을 통한 자신감 힘 ·
 *   과학적이고 설득력이 정말 중요해 — 사람들이 이거 신뢰할 수 있는 데이터인가 생각하기 때문에」)
 *
 *   지어낸 질문 없이, 연구에서 오래 써 온 검증된 척도 세 가지를 그대로 쓴다. 점수 계산은 서버(mind_check_save → _mind_score_*)가 한다.
 *   · 자신감    — 로젠버그 자존감 척도(RSES, Rosenberg 1965) 10문항 · 4점. 공개 저작물(메릴랜드대 사회학과 — 허락 없이 사용 · 번역 가능).
 *                 한국어는 한국판(전병재 1974, 연세논총 11) 문장을 따르고, 순서는 원래 척도처럼 좋은 쪽 · 힘든 쪽 문장을 번갈아.
 *                 8번은 한국어 번역에서 뜻이 갈린다는 보고가 있다(초 · 중 · 고 · 대학생 3,498명 문항 분석) — 같은 사람의 변화를 보는 데는 그대로 쓴다.
 *   · 힘(활력)  — RAND 36문항 건강조사 1.0(Hays 외 1993)의 활력(energy/fatigue) 4문항 · 6점 · 지난 4주.
 *                 RAND 공개 문항 — 허락 없이 사용(번역은 쓰는 쪽 책임 — 153이 한국어로 옮김).
 *   · 운동 습관 — 습관 자동성 지수(SRBAI, Gardner 외 2012 IJBNPA 9:102 · CC BY) 4문항 · 7점. 66일 습관 연구(Lally 외 2010)가 잰 '자동성'과 같은 것.
 *                 한국어는 153이 옮김.
 *   WHO-5 웰빙 지수는 2024년부터 WHO 저작권(CC BY-NC-SA 3.0 IGO — 상업적 사용은 WHO에 따로 요청)이라 넣지 않았다.
 *
 *   문장을 바꾸면 버전(MIND_VERSION)을 올리고 서버 ver 도 같이 — 다른 문장으로 잰 점수끼리는 견주지 않는다.
 */

export const MIND_VERSION = 1;

export type MindScaleKey = "conf" | "vital" | "habit";

export interface MindOption {
  /** 서버로 보내는 값(척도 원래 번호) */
  v: number;
  label: string;
}

export interface MindItem {
  id: string;
  text: string;
  /** 힘든 쪽 문장 — 점수를 거꾸로 센다 (화면 시험용 · 계산은 서버) */
  reverse?: boolean;
}

export interface MindScaleDef {
  key: MindScaleKey;
  /** 능력치 이름 */
  label: string;
  /** 좁은 줄(지난 기록)에 쓰는 짧은 이름 */
  short: string;
  /** 검사 이름 (짧게) */
  test: string;
  /** 문항을 고를 때 맨 위 안내 */
  prompt: string;
  /** 문장 앞에 붙는 말 (습관만) */
  stem?: string;
  options: MindOption[];
  items: MindItem[];
  /** 출처 한 줄 */
  source: string;
}

/** 자신감 — 로젠버그 자존감 척도 (원래 순서 · 역채점 2 · 5 · 6 · 8 · 9) */
const CONF: MindScaleDef = {
  key: "conf",
  label: "자신감",
  short: "자신감",
  test: "로젠버그 자존감 척도",
  prompt: "요즘 나에 대한 생각과 가장 가까운 것을 골라 주세요",
  options: [
    { v: 1, label: "전혀 아니다" },
    { v: 2, label: "아닌 편이다" },
    { v: 3, label: "그런 편이다" },
    { v: 4, label: "매우 그렇다" },
  ],
  items: [
    { id: "c1", text: "나는 대체로 나 자신에 대해 만족한다" },
    { id: "c2", text: "때때로 나는 내가 좋지 않은 사람이라고 생각한다", reverse: true },
    { id: "c3", text: "나는 좋은 점을 여러 가지 가지고 있다고 생각한다" },
    { id: "c4", text: "나는 대부분의 다른 사람들만큼 일을 잘할 수 있다" },
    { id: "c5", text: "나는 자랑할 것이 별로 없다", reverse: true },
    { id: "c6", text: "나는 가끔 나 자신이 쓸모없는 사람이라는 느낌이 든다", reverse: true },
    { id: "c7", text: "나는 내가 적어도 다른 사람들만큼 가치 있는 사람이라고 생각한다" },
    { id: "c8", text: "나는 나 자신을 좀 더 존중할 수 있으면 좋겠다", reverse: true },
    { id: "c9", text: "대체로 나는 실패한 사람이라는 느낌이 든다", reverse: true },
    { id: "c10", text: "나는 나 자신에 대해 긍정적인 태도를 가지고 있다" },
  ],
  source: "Rosenberg(1965) · 한국판 전병재(1974)",
};

/** 힘(활력) — RAND-36 23 · 27(좋은 쪽) · 29 · 31(힘든 쪽). 보기 번호 = RAND 번호(1 항상 … 6 전혀) */
const VITAL: MindScaleDef = {
  key: "vital",
  label: "힘(활력)",
  short: "힘",
  test: "RAND-36 활력",
  prompt: "지난 4주 동안 얼마나 자주 그랬나요?",
  options: [
    { v: 1, label: "항상" },
    { v: 2, label: "대부분" },
    { v: 3, label: "꽤 자주" },
    { v: 4, label: "가끔" },
    { v: 5, label: "아주 가끔" },
    { v: 6, label: "전혀" },
  ],
  items: [
    { id: "v1", text: "활기가 넘쳤다" },
    { id: "v2", text: "기운이 많이 났다" },
    { id: "v3", text: "녹초가 될 만큼 지쳤다", reverse: true },
    { id: "v4", text: "피곤했다", reverse: true },
  ],
  source: "RAND 36문항 건강조사 1.0(Hays 외 1993)",
};

/** 운동 습관 — SRBAI (문장 앞에 '153에 운동하러 가는 건') */
const HABIT: MindScaleDef = {
  key: "habit",
  label: "운동 습관",
  short: "습관",
  test: "습관 자동성 지수",
  prompt: "153에 운동하러 가는 건 …",
  stem: "153에 운동하러 가는 건",
  options: [
    { v: 1, label: "전혀 아니다" },
    { v: 2, label: "아니다" },
    { v: 3, label: "조금 아니다" },
    { v: 4, label: "보통이다" },
    { v: 5, label: "조금 그렇다" },
    { v: 6, label: "그렇다" },
    { v: 7, label: "매우 그렇다" },
  ],
  items: [
    { id: "h1", text: "자동으로 하게 되는 일이다" },
    { id: "h2", text: "일부러 기억하지 않아도 하는 일이다" },
    { id: "h3", text: "깊이 생각하지 않고 하는 일이다" },
    { id: "h4", text: "하려고 마음먹기 전에 이미 시작하고 있는 일이다" },
  ],
  source: "SRBAI(Gardner 외 2012, IJBNPA)",
};

/** 묻는 순서 = 화면 순서 */
export const MIND_SCALES: readonly MindScaleDef[] = [CONF, VITAL, HABIT];

export const MIND_SCALE: Record<MindScaleKey, MindScaleDef> = { conf: CONF, vital: VITAL, habit: HABIT };

/** 전체 문항 수 (10 + 4 + 4) */
export const MIND_ITEM_TOTAL = MIND_SCALES.reduce((n, s) => n + s.items.length, 0);
