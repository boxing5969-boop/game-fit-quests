// ═══════════════════════════════════════════════════════
// White Lv.1 — 스탠스·가드·잽 입문 + 기초체력과 리듬
// Updated: 3-day/3-session/150-min pacing. Home missions removed.
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
  { id: "white", label: "화이트 리그", emoji: "⚪", color: "white", description: "기초체력, 리듬, 자세 유지, 잽 입문 중심" },
  { id: "blue", label: "블루 리그", emoji: "🔵", color: "blue", description: "기본기 숙련, 고품질 반복, 기술 테스트 중심" },
  { id: "red", label: "레드 리그", emoji: "🔴", color: "red", description: "실전 적용, 스파링 기초, 복합 기술" },
  { id: "black", label: "블랙 리그", emoji: "⚫", color: "black", description: "코칭 역량, 리더십, 마스터 기술" },
];

/* ─── White Lv.1 Meta ─────────────────────────────────── */
export const WHITE_LV1_META = {
  level: 1,
  league: "white",
  title: "스탠스·가드·잽 입문",
  shortGoal: "기본 자세를 잡고 첫 잽을 배우며 기초체력과 리듬을 만든다",
  duration: "50분",
  baseXp: 100,
  levelLabel: "White Lv.1",
};

/* ─── Learning Modules ────────────────────────────────── */
export interface LearningModule {
  id: string;
  title: string;
  keyPoints: string[];
}

export const WHITE_LV1_LEARNING: LearningModule[] = [
  {
    id: "stance-guard",
    title: "기본 스탠스와 가드",
    keyPoints: [
      "발은 어깨너비, 앞발 살짝 앞",
      "체중은 양발에 균등",
      "손은 얼굴 높이에서 턱 보호",
      "어깨는 약간 올려 턱 방어",
    ],
  },
  {
    id: "jab-intro",
    title: "잽 첫 동작",
    keyPoints: [
      "앞손을 직선으로 뻗기",
      "어깨로 턱 보호",
      "손은 빠르게 복귀",
      "반대손 가드 유지",
    ],
  },
];

/* ─── Home Mission Options (deprecated — kept for compat) */
export interface HomeMission {
  id: string;
  title: string;
  description: string;
  emoji: string;
}

export const WHITE_LV1_HOME_MISSIONS: HomeMission[] = [];

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
    timeRange: "0:00–5:00",
    title: "워밍업",
    durationMin: 5,
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
      { name: "가드 자세 정렬", detail: "2분" },
    ],
  },
  {
    id: "jumprope",
    timeRange: "5:00–10:00",
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
    timeRange: "10:00–18:00",
    title: "리듬/사다리 블록",
    durationMin: 8,
    intensity: "보통",
    rpe: "RPE 4–5",
    emoji: "🪜",
    description: "4개 드릴 × 각 2분, 발놀림·리듬·협응 훈련",
    drills: [
      { name: "한 칸 한 발 전진" },
      { name: "한 칸 두 발 전진" },
      { name: "사이드 인-인-아웃-아웃" },
      { name: "전진 진입 → 피벗 아웃" },
    ],
  },
  {
    id: "mirror-stance",
    timeRange: "18:00–26:00",
    title: "거울 앞 스탠스·가드·제자리 스텝",
    durationMin: 8,
    intensity: "보통",
    rpe: "RPE 4",
    emoji: "🪞",
    description: "자세를 확인하며 기본 스텝과 가드를 유지하는 시간",
    drills: [
      { name: "가드 유지", detail: "2분" },
      { name: "기본 복서 바운스", detail: "2분" },
      { name: "스탠스 정지 → 다시 스텝", detail: "2분" },
      { name: "좌우 중심 이동", detail: "2분" },
    ],
  },
  {
    id: "jab-intro",
    timeRange: "26:00–34:00",
    title: "잽 입문",
    durationMin: 8,
    intensity: "보통",
    rpe: "RPE 4–5",
    emoji: "👊",
    description: "첫 잽의 폼을 익히고 정확도를 높이는 시간",
    drills: [
      { name: "잽 폼 설명" },
      { name: "거울 앞 천천히 10회" },
      { name: "어깨로 턱 보호 확인" },
      { name: "손 빠른 복귀 연습" },
      { name: "반대손 가드 유지 확인" },
    ],
  },
  {
    id: "jab-repeat",
    timeRange: "34:00–42:00",
    title: "잽 반복 / 타깃 터치",
    durationMin: 8,
    intensity: "보통",
    rpe: "RPE 5",
    emoji: "🎯",
    description: "잽의 반복과 정확도에 집중하는 시간",
    drills: [
      { name: "제자리 잽 20회" },
      { name: "타깃 터치 잽 20회" },
      { name: "잽 후 가드 복귀 10회" },
      { name: "속도보다 정확도 우선" },
    ],
  },
  {
    id: "lower-circuit",
    timeRange: "42:00–49:00",
    title: "하체/코어",
    durationMin: 7,
    intensity: "조금 힘듦",
    rpe: "RPE 5–6",
    emoji: "🦵",
    description: "하체와 코어를 단련하는 마무리 서킷",
    drills: [
      { name: "스쿼트 15회" },
      { name: "리버스 런지 8회/8회" },
      { name: "카프 레이즈 20회" },
      { name: "플랭크 30초" },
      { name: "남는 시간 가드 유지 걷기" },
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
  { label: "30분 미만", minutes: "30분 미만", xp: 0, note: "레벨업용 출석 미인정" },
];

/* ─── Promotion Rules (Lv.1 → Lv.2) — 3일 페이싱 ──────── */
export interface PromotionMetric {
  id: string;
  label: string;
  target: number;
  unit: string;
  emoji: string;
}

export const PROMOTION_METRICS: PromotionMetric[] = [
  { id: "xp", label: "현재 레벨 XP", target: 300, unit: "XP", emoji: "⚡" },
  { id: "sessions", label: "인정 세션", target: 3, unit: "회", emoji: "🥊" },
  { id: "days", label: "인정 출석일", target: 3, unit: "일", emoji: "📅" },
  { id: "minutes", label: "현재 레벨 훈련 시간", target: 150, unit: "분", emoji: "⏱️" },
];

export const PROMOTION_RULES = {
  xpRequired: 300,
  sessionsRequired: 3,
  attendanceDaysRequired: 3,
  totalMinutesRequired: 150,
  checklistPassCount: 5,
  mandatoryItems: [0, 3],
};

/* ─── Recommended Paths ───────────────────────────────── */
export interface RecommendedPath {
  label: string;
  frequency: string;
  duration: string;
  sessions: string;
}

export const RECOMMENDED_PATHS: RecommendedPath[] = [
  { label: "일반 경로", frequency: "주 3회", duration: "약 1주", sessions: "3회" },
  { label: "빠른 경로", frequency: "주 5회", duration: "약 3~4일", sessions: "3회" },
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
    details: ["턱 들림 없음", "손이 얼굴에서 크게 떨어지지 않음"],
    mandatory: true,
  },
  {
    id: 2,
    title: "줄넘기 2분 × 2라운드 완수",
    details: ["중간에 끊겨도 빠르게 재시작 가능"],
    mandatory: false,
  },
  {
    id: 3,
    title: "제자리 스텝 2분 + 기본 스탠스 복구",
    details: ["몸통 크게 흔들리지 않음"],
    mandatory: false,
  },
  {
    id: 4,
    title: "잽 20회 정확도",
    details: ["반대손 가드 유지", "잽 후 손 빠른 복귀", "어깨로 턱 보호"],
    mandatory: true,
  },
  {
    id: 5,
    title: "잽 후 가드 복귀 10회 연속",
    details: ["손이 늦게 돌아오지 않음"],
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
export type RankUpStatus = "진행중" | "레벨업 심사 가능" | "보완 필요" | "레벨업 완료" | "코치 확인 필요";

export function getRankUpStatus(
  xp: number,
  sessions: number,
  days: number,
  minutes: number,
  checklistPassed: boolean,
  checklistAttempted: boolean,
  remediationUsed?: boolean,
): RankUpStatus {
  const metricsComplete =
    xp >= PROMOTION_RULES.xpRequired &&
    sessions >= PROMOTION_RULES.sessionsRequired &&
    days >= PROMOTION_RULES.attendanceDaysRequired &&
    minutes >= PROMOTION_RULES.totalMinutesRequired;

  if (checklistPassed) return "레벨업 완료";
  if (metricsComplete && checklistAttempted && !checklistPassed && remediationUsed) return "코치 확인 필요";
  if (metricsComplete && checklistAttempted && !checklistPassed) return "보완 필요";
  if (metricsComplete) return "레벨업 심사 가능";
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
  { id: "sessions-remaining", text: "레벨업까지 {remaining}회 남았습니다", condition: "sessions" },
  { id: "xp-today", text: "오늘 50분을 채우면 100XP" },
  { id: "review-available", text: "3회 완료 시 레벨업 심사 가능" },
  { id: "jab-improving", text: "첫 잽이 점점 자연스러워지고 있어요" },
  { id: "posture-improving", text: "자세와 리듬이 점점 안정되고 있어요" },
  { id: "accuracy-first", text: "빠르게보다 정확하게" },
  { id: "repetition-matters", text: "지금은 완벽함보다 반복이 더 중요합니다" },
];

export function formatMicrocopy(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ""));
}

/* ─── Home Message Cards ──────────────────────────────── */
export const HOME_MESSAGES = [
  "주 3회 회원은 약 1주 안에 레벨업 가능",
  "오늘 50분을 채우면 100XP",
  "3회 완료 시 레벨업 심사 가능",
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
  { id: "start-session", emoji: "🥊", label: "오늘 수업 시작", description: "수업 보기", route: "/missions" },
  { id: "checklist", emoji: "✅", label: "체크테스트 보기", description: "레벨업 심사 확인", route: "/missions" },
  { id: "weekly-plan", emoji: "📋", label: "이번 주 추천", description: "주간 처방 보기", route: "/missions" },
];

/* ─── Today's Purpose ─────────────────────────────────── */
export const WHITE_LV1_PURPOSE = [
  "운동을 시작하는 정체성 형성",
  "기본 자세와 가드 인식",
  "첫 잽 경험",
  "수업을 끝까지 해내는 경험",
  "기초체력과 리듬 시작",
];

/* ─── Value Gained ────────────────────────────────────── */
export const WHITE_LV1_VALUE = [
  "운동을 시작하는 정체성",
  "기본 자세와 가드 인식",
  "첫 잽 경험",
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
  "가드 그림자가 뺨에서 떨어지지 않게",
  "잽은 멀리 던지지 말고 바로 돌아오게",
  "머리 높이가 위아래로 크게 흔들리지 않게",
  "사다리 칸 중앙을 조용히 찍기",
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
    body: "화이트는 기초체력, 리듬, 자세 유지, 잽 입문 중심입니다. 블루부터는 기술 반복과 테스트 중심으로 바뀝니다.",
  },
  {
    id: "science",
    emoji: "🔬",
    title: "과학적 설계 안내",
    body: "이 앱은 WHO·CDC·ACSM 권고를 참고해 활동량, 강도, 근력, 회복 균형을 설명합니다. 공식 인증 또는 의료 서비스가 아닙니다.",
  },
  {
    id: "white-league",
    emoji: "⚪",
    title: "White League",
    body: "화이트는 쉽지만 의미 없이 쉬운 단계가 아니라, 운동 습관과 기초체력을 만드는 단계입니다.",
    accent: true,
  },
  {
    id: "why-jab-lv1",
    emoji: "👊",
    title: "White Lv.1에서 왜 잽을 배우나요?",
    body: "너무 지루하지 않도록 Lv.1부터 잽을 포함합니다. 첫 잽 경험은 복싱 정체성과 자신감을 만들어줍니다.",
    accent: true,
  },
  {
    id: "ladder-training",
    emoji: "🪜",
    title: "사다리 훈련은 왜 넣나요?",
    body: "사다리는 체력이 아니라 발놀림·리듬·협응 훈련입니다. 복싱에서 스텝과 리듬은 기본기의 핵심입니다.",
  },
  {
    id: "3day-pacing",
    emoji: "📅",
    title: "왜 3일 기준 레벨업인가요?",
    body: "주 3회 훈련하면 약 1주 만에 레벨업이 가능합니다. 여러 날에 걸쳐 반복하며 자연스럽게 몸에 익히는 것이 중요합니다.",
    accent: true,
  },
];
