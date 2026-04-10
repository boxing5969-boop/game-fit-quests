// ═══════════════════════════════════════════════════════
// White Lv.1 — 기초체력과 자세 리듬 만들기
// All data for session template, checklist, XP, promotion
// ═══════════════════════════════════════════════════════

/* ─── Leagues ─────────────────────────────────────────── */
export interface League {
  id: string;
  label: string;
  emoji: string;
  color: string;
  description: string;
}

export const LEAGUES: League[] = [
  { id: "white", label: "화이트 리그", emoji: "⚪", color: "white", description: "기초체력, 리듬, 자세 유지 중심" },
  { id: "blue", label: "블루 리그", emoji: "🔵", color: "blue", description: "기본기 숙련, 고품질 반복, 기술 테스트 중심" },
  { id: "red", label: "레드 리그", emoji: "🔴", color: "red", description: "실전 적용, 스파링 기초, 복합 기술" },
  { id: "black", label: "블랙 리그", emoji: "⚫", color: "black", description: "코칭 역량, 리더십, 마스터 기술" },
];

/* ─── White Lv.1 Meta ─────────────────────────────────── */
export const WHITE_LV1_META = {
  level: 1,
  league: "white",
  title: "기초체력과 자세 리듬 만들기",
  shortGoal: "리듬, 기초체력, 자세 유지 습관을 만든다",
  duration: "50분",
  baseXp: 100,
  levelLabel: "White Lv.1",
};

/* ─── Session Template (50분) ─────────────────────────── */
export type IntensityLevel = "가볍게" | "보통" | "조금 힘듦";

export interface SessionDrill {
  name: string;
  detail?: string;
}

export interface SessionBlock {
  id: string;
  timeRange: string;
  title: string;
  durationMin: number;
  intensity: IntensityLevel;
  rpe: string;
  emoji: string;
  description: string;
  drills: SessionDrill[];
  beginnerAlt?: string;
}

export const WHITE_LV1_SESSION: SessionBlock[] = [
  {
    id: "warmup",
    timeRange: "0:00–4:00",
    title: "워밍업",
    durationMin: 4,
    intensity: "가볍게",
    rpe: "RPE 3",
    emoji: "🔥",
    description: "관절과 근육을 깨우고 복싱 자세를 잡는 시간",
    drills: [
      { name: "발목 바운스", detail: "30초" },
      { name: "제자리 마칭", detail: "30초" },
      { name: "어깨 돌리기", detail: "30초" },
      { name: "힙 오픈/클로즈", detail: "30초" },
      { name: "에어 스쿼트", detail: "10회" },
      { name: "카프 레이즈", detail: "20회" },
      { name: "복싱 가드 자세 정렬", detail: "1분" },
    ],
  },
  {
    id: "jumprope",
    timeRange: "4:00–9:00",
    title: "줄넘기 2라운드",
    durationMin: 5,
    intensity: "보통",
    rpe: "RPE 4–5",
    emoji: "🪢",
    description: "심폐지구력과 복싱 리듬의 기초를 만드는 시간",
    drills: [
      { name: "1R 2분", detail: "기본 바운스" },
      { name: "액티브 레스트", detail: "1분" },
      { name: "2R 2분", detail: "번갈아 스텝 또는 복서 스텝" },
    ],
    beginnerAlt: "에어 줄넘기 또는 라인 홉으로 대체 가능",
  },
  {
    id: "ladder",
    timeRange: "9:00–29:00",
    title: "사다리/스텝 트레이닝",
    durationMin: 20,
    intensity: "보통",
    rpe: "RPE 4–5",
    emoji: "🪜",
    description: "5개 드릴 × 각 2세트 × 세트당 2분 (40초 진행 → 20초 리셋 × 2)",
    drills: [
      { name: "한 칸 한 발 전진" },
      { name: "한 칸 두 발 전진" },
      { name: "사이드 인-인-아웃-아웃" },
      { name: "이키 셔플" },
      { name: "전진 진입 → 피벗 아웃 → 후퇴 리턴" },
    ],
  },
  {
    id: "mirror-step",
    timeRange: "29:00–35:00",
    title: "거울 앞 제자리 복싱 스텝",
    durationMin: 6,
    intensity: "보통",
    rpe: "RPE 4",
    emoji: "🪞",
    description: "2분 × 3라운드, 자세를 확인하며 리듬을 유지",
    drills: [
      { name: "1R", detail: "기본 복서 바운스" },
      { name: "2R", detail: "앞발-뒷발 리듬 교차" },
      { name: "3R", detail: "20초마다 스탠스 정지 → 다시 스텝" },
    ],
  },
  {
    id: "side-step",
    timeRange: "35:00–41:00",
    title: "거울 앞 사이드 스텝",
    durationMin: 6,
    intensity: "보통",
    rpe: "RPE 4–5",
    emoji: "↔️",
    description: "2분 × 3라운드, 좌우 이동과 밸런스 훈련",
    drills: [
      { name: "1R", detail: "좌 2번, 우 2번 반복" },
      { name: "2R", detail: "좌 1번, 우 1번 짧고 빠르게" },
      { name: "3R", detail: "좌우 이동 후 1초 정지 자세 체크" },
    ],
  },
  {
    id: "lower-circuit",
    timeRange: "41:00–49:00",
    title: "하체/코어 서킷",
    durationMin: 8,
    intensity: "조금 힘듦",
    rpe: "RPE 5–7",
    emoji: "🦵",
    description: "4라운드 × 2분, 하체와 코어를 단련하는 마무리 서킷",
    drills: [
      { name: "R1", detail: "스쿼트 15회 → 스쿼트 홀드 15초 → 카프 레이즈 20회 → 가드 유지 걷기" },
      { name: "R2", detail: "리버스 런지 8회/8회 → 미니 스쿼트 10회 → 제자리 바운스" },
      { name: "R3", detail: "스플릿 스쿼트 홀드 20초/20초 → 카프 레이즈 20회 → 가드 자세 정지" },
      { name: "R4", detail: "월싯 30초 → 플랭크 30초 → 빠른 발 제자리 20초 → 10초 호흡 정리" },
    ],
  },
  {
    id: "cooldown",
    timeRange: "49:00–50:00",
    title: "마무리",
    durationMin: 1,
    intensity: "가볍게",
    rpe: "RPE 2",
    emoji: "🧘",
    description: "호흡 정리와 오늘의 포인트 체크",
    drills: [
      { name: "호흡 정리" },
      { name: "오늘 무너진 포인트 1개 체크" },
      { name: "다음 수업 목표 1개 설정" },
    ],
  },
];

/* ─── XP Rules ────────────────────────────────────────── */
export interface XpRule {
  label: string;
  minutes: string;
  xp: number;
  note?: string;
}

export const XP_RULES: XpRule[] = [
  { label: "프로그램 완수", minutes: "50분", xp: 100 },
  { label: "40~49분 완료", minutes: "40~49분", xp: 80 },
  { label: "30~39분 완료", minutes: "30~39분", xp: 60 },
  { label: "30분 미만", minutes: "30분 미만", xp: 0, note: "승급용 출석 미인정" },
  { label: "홈미션 제출", minutes: "3분", xp: 20, note: "하루 최대 1회" },
];

/* ─── Promotion Rules (Lv.1 → Lv.2) ──────────────────── */
export interface PromotionMetric {
  id: string;
  label: string;
  target: number;
  unit: string;
  emoji: string;
}

export const PROMOTION_METRICS: PromotionMetric[] = [
  { id: "xp", label: "누적 XP", target: 500, unit: "XP", emoji: "⚡" },
  { id: "sessions", label: "수업 완수", target: 5, unit: "회", emoji: "🥊" },
  { id: "days", label: "출석 일수", target: 5, unit: "일", emoji: "📅" },
  { id: "minutes", label: "훈련 시간", target: 250, unit: "분", emoji: "⏱️" },
];

export const PROMOTION_RULES = {
  xpRequired: 500,
  sessionsRequired: 5,
  attendanceDaysRequired: 5,
  totalMinutesRequired: 250,
  checklistPassCount: 5,
  mandatoryItems: [0, 2], // indices of mandatory checklist items (1-indexed: 1, 3)
};

/* ─── Recommended Paths ───────────────────────────────── */
export interface RecommendedPath {
  label: string;
  frequency: string;
  duration: string;
  sessions: string;
}

export const RECOMMENDED_PATHS: RecommendedPath[] = [
  { label: "일반 경로", frequency: "주 3회", duration: "약 2주", sessions: "5~6회" },
  { label: "빠른 경로", frequency: "주 5회", duration: "약 1주", sessions: "5회" },
];

/* ─── Final Checklist ─────────────────────────────────── */
export interface ChecklistItem {
  id: number;
  title: string;
  details: string[];
  mandatory: boolean;
}

export const WHITE_LV1_CHECKLIST: ChecklistItem[] = [
  {
    id: 1,
    title: "가드 자세 60초 유지",
    details: ["턱 들림 없음", "손이 뺨에서 크게 떨어지지 않음"],
    mandatory: true,
  },
  {
    id: 2,
    title: "줄넘기 2분 × 2라운드 완수",
    details: ["중간에 걸려도 빠르게 재시작 가능"],
    mandatory: false,
  },
  {
    id: 3,
    title: "사다리 2분 1패턴 + 사이드 2분 1패턴 수행",
    details: ["발 교차 없음", "상체 흔들림 과도하지 않음"],
    mandatory: true,
  },
  {
    id: 4,
    title: "거울 앞 제자리 복싱 스텝 2분 연속",
    details: [],
    mandatory: false,
  },
  {
    id: 5,
    title: "사이드 스텝 2분 연속",
    details: [],
    mandatory: false,
  },
  {
    id: 6,
    title: "하체 기초체력",
    details: ["스쿼트 20회", "리버스 런지 8회/8회", "월싯 30초"],
    mandatory: false,
  },
];

/* ─── Rank-up States ──────────────────────────────────── */
export type RankUpStatus = "진행중" | "승급 심사 가능" | "보완 필요" | "승급 완료";

export function getRankUpStatus(
  xp: number,
  sessions: number,
  days: number,
  minutes: number,
  checklistPassed: boolean,
  checklistAttempted: boolean,
): RankUpStatus {
  const metricsComplete =
    xp >= PROMOTION_RULES.xpRequired &&
    sessions >= PROMOTION_RULES.sessionsRequired &&
    days >= PROMOTION_RULES.attendanceDaysRequired &&
    minutes >= PROMOTION_RULES.totalMinutesRequired;

  if (checklistPassed) return "승급 완료";
  if (metricsComplete && checklistAttempted && !checklistPassed) return "보완 필요";
  if (metricsComplete) return "승급 심사 가능";
  return "진행중";
}

/* ─── Microcopy ───────────────────────────────────────── */
export interface Microcopy {
  id: string;
  text: string;
  condition?: string;
}

export const MICROCOPY: Microcopy[] = [
  { id: "building", text: "오늘도 1레벨을 쌓고 있습니다" },
  { id: "sessions-progress", text: "현재 {current}/{target}회 완료", condition: "sessions" },
  { id: "sessions-remaining", text: "승급까지 {remaining}회 남았습니다", condition: "sessions" },
  { id: "xp-today", text: "오늘 50분을 채우면 100XP" },
  { id: "review-available", text: "5회 완료 시 승급 심사 가능" },
  { id: "supplement", text: "6회차는 부족한 부분만 보완하면 됩니다" },
  { id: "posture-improving", text: "자세와 리듬이 점점 안정되고 있어요" },
  { id: "supplement-point", text: "보완 포인트: 사이드 스텝 후 자세 복구" },
];

export function formatMicrocopy(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ""));
}

/* ─── Home Message Cards ──────────────────────────────── */
export const HOME_MESSAGES = [
  "주 3회 회원은 약 2주, 주 5회 회원은 약 1주 안에 승급 가능",
  "오늘 50분을 채우면 100XP",
  "5회 완료 시 승급 심사 가능",
];

/* ─── Quick Actions ───────────────────────────────────── */
export interface QuickAction {
  id: string;
  emoji: string;
  label: string;
  description: string;
  route: string;
}

export const QUICK_ACTIONS: QuickAction[] = [
  { id: "start-session", emoji: "🥊", label: "오늘 수업 시작", description: "White Lv.1 수업 보기", route: "/missions" },
  { id: "home-mission", emoji: "🏠", label: "홈미션 제출", description: "+20XP 보너스", route: "/missions" },
  { id: "checklist", emoji: "✅", label: "체크테스트 보기", description: "승급 심사 확인", route: "/missions" },
];

/* ─── Today's Purpose ─────────────────────────────────── */
export const WHITE_LV1_PURPOSE = [
  "리듬을 만든다",
  "발목/종아리/허벅지의 기초 지구력을 만든다",
  "자세를 유지한 채 움직이는 습관을 만든다",
  "수업을 끝까지 해내는 경험을 준다",
];

/* ─── Value Gained ────────────────────────────────────── */
export const WHITE_LV1_VALUE = [
  "운동을 시작하는 정체성",
  "자세를 유지한 채 움직이는 감각",
  "기초체력과 리듬의 시작",
];

/* ─── Beginner Alternatives ───────────────────────────── */
export const BEGINNER_ALTERNATIVES = [
  { original: "줄넘기", alt: "에어 줄넘기", note: "줄 없이 동일한 동작 수행" },
  { original: "줄넘기", alt: "라인 홉", note: "바닥 선을 기준으로 좌우 점프" },
  { original: "전체", alt: "속도보다 정확도 우선", note: "느려도 정확하게 수행" },
];

/* ─── Coach Points ────────────────────────────────────── */
export const COACH_POINTS = [
  "턱 살짝 내리기",
  "가드 그림자가 뺨에서 떨어지지 않게",
  "사다리 칸 중앙을 조용히 찍기",
  "머리 높이가 위아래로 크게 흔들리지 않게",
];

/* ─── Guide Cards ─────────────────────────────────────── */
export interface GuideCard {
  id: string;
  emoji: string;
  title: string;
  body: string;
  accent?: boolean;
}

export const GUIDE_CARDS: GuideCard[] = [
  {
    id: "program-intro",
    emoji: "📋",
    title: "프로그램 소개",
    body: "화이트는 기초체력, 리듬, 자세 유지 중심입니다. 블루부터는 기술 반복과 테스트 중심으로 바뀝니다.",
  },
  {
    id: "science",
    emoji: "🔬",
    title: "과학적 설계 안내",
    body: "이 앱은 WHO·CDC·ACSM 권고를 참고해 활동량, 강도, 근력, 회복 균형을 설명합니다. 공식 인증 또는 의료 서비스가 아닙니다. 꾸준한 반복과 여러 날에 걸친 훈련을 중요하게 봅니다.",
  },
  {
    id: "white-league",
    emoji: "⚪",
    title: "White League",
    body: "화이트는 쉽지만 의미 없이 쉬운 단계가 아니라, 운동 습관과 기초체력을 만드는 단계입니다.",
    accent: true,
  },
  {
    id: "ladder-training",
    emoji: "🪜",
    title: "사다리 훈련 설명",
    body: "사다리 훈련은 체력 메인보다 발놀림, 리듬, 협응을 위한 훈련입니다.",
  },
  {
    id: "blue-preview",
    emoji: "🔵",
    title: "Blue League 예고",
    body: "블루부터는 출석형 승급이 아니라 기술 반복과 테스트 중심으로 바뀝니다.",
    accent: true,
  },
];

/* ─── Session Recognition Rules ───────────────────────── */
export const SESSION_RULES = {
  sessionMinutes: 50,
  rankSessionMinMinutes: 45,
  maxRankSessionsPerDay: 1,
  homeMissionMaxPerDay: 1,
  homeMissionXp: 20,
  supplementWindowDays: 7,
};

/* ─── Supplement / Retry Rules ────────────────────────── */
export const SUPPLEMENT_RULES = {
  maxExtraSessions: 1,
  retryWindowDays: 7,
  passMessage: "화이트 Lv.2 승급 가능\n기본 자세와 기초체력이 잡히고 있습니다",
  holdMessage: "보완 포인트를 확인하고 6회차에서 다시 도전하세요\n부족한 항목만 다시 채우면 됩니다",
  failMessage: "코치 확인 필요",
};
