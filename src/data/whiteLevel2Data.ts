// ═══════════════════════════════════════════════════════
// White Lv.2 — 전진·후진 스텝과 잽 반복
// Updated: 3-day/3-session/150-min pacing. Home missions removed.
// ═══════════════════════════════════════════════════════
import type { SessionBlock, ChecklistItem, XpRule, PromotionMetric, RecommendedPath, LearningModule, HomeMission, GuideCard } from "@/data/whiteLevel1Data";

/* ─── Meta ────────────────────────────────────────────── */
export const WHITE_LV2_META = {
  level: 2,
  league: "white",
  title: "전진·후진 스텝과 잽 반복",
  shortGoal: "움직이면서 자세를 유지하고 잽을 반복한다",
  duration: "50분",
  baseXp: 100,
  levelLabel: "White Lv.2",
};

/* ─── Learning Modules ────────────────────────────────── */
export const WHITE_LV2_LEARNING: LearningModule[] = [
  {
    id: "forward-back-step",
    title: "전진·후진 스텝 기초",
    keyPoints: [
      "전진: 앞발 먼저 → 뒷발 따라감",
      "후진: 뒷발 먼저 → 앞발 따라감",
      "발이 교차되지 않게 주의",
      "이동 후 스탠스 복구",
    ],
  },
  {
    id: "jab-guard-return",
    title: "잽과 가드 복귀",
    keyPoints: [
      "잽 후 손 빠른 복귀",
      "반대손 가드 유지 강화",
      "어깨 턱 보호 유지",
      "더블 잽 소개",
    ],
  },
  {
    id: "jab-movement",
    title: "잽 + 이동 연결",
    keyPoints: [
      "전진 잽: 이동 후 잽",
      "후진 후 가드 복귀",
      "속도보다 정렬 유지",
      "step and reset",
    ],
  },
];

/* ─── Home Mission Options (deprecated) ───────────────── */
export const WHITE_LV2_HOME_MISSIONS: HomeMission[] = [];

/* ─── Session Template (50분) ─────────────────────────── */
export const WHITE_LV2_SESSION: SessionBlock[] = [
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
      { name: "발목 바운스" },
      { name: "제자리 마칭" },
      { name: "어깨/골반 가동성" },
      { name: "에어 스쿼트", detail: "10회" },
      { name: "카프 레이즈", detail: "20회" },
      { name: "가드 자세 정렬" },
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
    description: "심폐지구력과 복싱 리듬의 기초",
    drills: [
      { name: "1R", detail: "기본 바운스" },
      { name: "2R", detail: "복서 스텝" },
    ],
    beginnerAlt: "에어 줄넘기 또는 라인 홉으로 대체 가능",
  },
  {
    id: "ladder",
    timeRange: "10:00–18:00",
    title: "사다리/리듬 블록",
    durationMin: 8,
    intensity: "보통",
    rpe: "RPE 4–5",
    emoji: "🪜",
    description: "4개 드릴 × 각 2분, 발놀림·리듬·협응 훈련",
    drills: [
      { name: "한 칸 두 발 전진" },
      { name: "사이드 인-인-아웃-아웃" },
      { name: "이키 셔플" },
      { name: "전진 → 피벗 → 후퇴" },
    ],
  },
  {
    id: "mirror-movement",
    timeRange: "18:00–26:00",
    title: "거울 앞 전진·후진·사이드 스텝",
    durationMin: 8,
    intensity: "보통",
    rpe: "RPE 4–5",
    emoji: "🪞",
    description: "방향별 이동과 자세 복구를 연습하는 시간",
    drills: [
      { name: "전진", detail: "2분" },
      { name: "후진", detail: "2분" },
      { name: "전진/후진 혼합", detail: "2분" },
      { name: "이동 후 스탠스 복구", detail: "2분" },
    ],
  },
  {
    id: "jab-quality",
    timeRange: "26:00–34:00",
    title: "잽 품질 반복",
    durationMin: 8,
    intensity: "보통",
    rpe: "RPE 5",
    emoji: "👊",
    description: "잽 품질과 가드 복귀를 강화하는 시간",
    drills: [
      { name: "제자리 잽 30회" },
      { name: "더블 잽 10회" },
      { name: "잽 후 가드 복귀" },
      { name: "반대손 가드 유지" },
    ],
  },
  {
    id: "movement-jab",
    timeRange: "34:00–42:00",
    title: "이동 잽 블록",
    durationMin: 8,
    intensity: "보통",
    rpe: "RPE 5",
    emoji: "🎯",
    description: "이동하면서 잽을 연결하고 정리하는 시간",
    drills: [
      { name: "전진 잽 10회" },
      { name: "후진 후 가드 복귀 10회" },
      { name: "잽 + 한 걸음 정리" },
      { name: "step and reset (속도 X, 정렬 O)" },
    ],
  },
  {
    id: "lower-circuit",
    timeRange: "42:00–49:00",
    title: "하체/코어 + 가드 유지",
    durationMin: 7,
    intensity: "조금 힘듦",
    rpe: "RPE 5–6",
    emoji: "🦵",
    description: "하체와 코어를 단련하고 가드를 유지하는 마무리",
    drills: [
      { name: "스쿼트 15회" },
      { name: "스플릿 스쿼트 홀드 20초/20초" },
      { name: "카프 레이즈 20회" },
      { name: "플랭크 30초" },
      { name: "가드 자세 정지" },
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
      { name: "오늘 좋아진 점 1개 기록" },
      { name: "다음 수업 포인트 1개 저장" },
    ],
  },
];

/* ─── XP Rules ────────────────────────────────────────── */
export const WHITE_LV2_XP_RULES: XpRule[] = [
  { label: "프로그램 완수", minutes: "50분", xp: 100 },
  { label: "40~49분 완료", minutes: "40~49분", xp: 80 },
  { label: "30~39분 완료", minutes: "30~39분", xp: 60 },
  { label: "30분 미만", minutes: "30분 미만", xp: 0, note: "레벨업용 출석 미인정" },
];

/* ─── Promotion Rules (Lv.2 → Lv.3) — 3일 페이싱 ──────── */
export const WHITE_LV2_PROMOTION_METRICS: PromotionMetric[] = [
  { id: "xp", label: "현재 레벨 XP", target: 300, unit: "XP", emoji: "⚡" },
  { id: "sessions", label: "인정 세션", target: 3, unit: "회", emoji: "🥊" },
  { id: "days", label: "인정 출석일", target: 3, unit: "일", emoji: "📅" },
  { id: "minutes", label: "현재 레벨 훈련 시간", target: 150, unit: "분", emoji: "⏱️" },
];

export const WHITE_LV2_PROMOTION_RULES = {
  xpRequired: 300,
  sessionsRequired: 3,
  attendanceDaysRequired: 3,
  totalMinutesRequired: 150,
  checklistPassCount: 5,
  mandatoryItems: [0, 3],
  movementJabBlockMinSessions: 2,
};

/* ─── Recommended Paths ───────────────────────────────── */
export const WHITE_LV2_RECOMMENDED_PATHS: RecommendedPath[] = [
  { label: "일반 경로", frequency: "주 3회", duration: "약 1주", sessions: "3회" },
  { label: "빠른 경로", frequency: "주 5회", duration: "약 3~4일", sessions: "3회" },
];

/* ─── Final Checklist ─────────────────────────────────── */
export const WHITE_LV2_CHECKLIST: ChecklistItem[] = [
  {
    id: 1,
    title: "전진·후진 스텝 2분",
    details: ["발 교차 없음", "이동 후 스탠스 복구 가능"],
    mandatory: true,
  },
  {
    id: 2,
    title: "사이드 스텝 2분",
    details: ["상체 과도한 흔들림 없음"],
    mandatory: false,
  },
  {
    id: 3,
    title: "잽 30회 정확도",
    details: ["손 빠른 복귀", "반대손 가드 유지"],
    mandatory: false,
  },
  {
    id: 4,
    title: "전진 잽 10회 + 후진 후 복귀 10회",
    details: ["무리한 전진 없음", "이동 후 가드 정리"],
    mandatory: true,
  },
  {
    id: 5,
    title: "더블 잽 또는 잽 + 정지 10회",
    details: ["리듬 유지"],
    mandatory: false,
  },
  {
    id: 6,
    title: "하체/지구력",
    details: ["줄넘기 2분 × 2라운드 또는 스쿼트 20회 + 월싯 30초"],
    mandatory: false,
  },
];

/* ─── White Lv.2 Values ───────────────────────────────── */
export const WHITE_LV2_PURPOSE = [
  "전진/후진 스텝 기초",
  "잽 품질 향상",
  "잽과 거리 감각 시작",
  "가드 복귀 습관 강화",
  "움직임 속 자세 유지",
];

export const WHITE_LV2_VALUE = [
  "전진/후진 스텝 기초",
  "잽 품질 향상",
  "움직임 속 자세 유지",
  "가드 복귀 습관 강화",
];

/* ─── Coach Points ────────────────────────────────────── */
export const WHITE_LV2_COACH_POINTS = [
  "이동 후 먼저 자세를 찾고 그다음 잽",
  "잽은 치고 멈추지 말고 돌아오게",
  "발이 교차되지 않게",
  "빠르기보다 정렬 유지",
];

/* ─── Beginner Alternatives ───────────────────────────── */
export const WHITE_LV2_BEGINNER_ALTS = [
  { original: "줄넘기", alt: "에어 줄넘기", note: "줄 없이 동일한 동작 수행" },
  { original: "전체", alt: "속도보다 정확도 우선", note: "느려도 정확하게 수행" },
  { original: "이동 잽", alt: "제자리 잽 후 스텝 연습", note: "분리 연습 후 합치기" },
];

/* ─── Supplement Rules ────────────────────────────────── */
export const WHITE_LV2_SUPPLEMENT_RULES = {
  maxExtraSessions: 1,
  retryWindowDays: 7,
  passMessage: "화이트 Lv.3 준비 완료\n움직임 속에서도 자세와 잽이 유지되고 있습니다",
  holdMessage: "전진/후진 스텝과 잽 복귀를 조금 더 다듬어 보세요\n부족한 항목만 보완하면 됩니다",
  failMessage: "코치 확인 필요",
};

/* ─── Internal Progression ────────────────────────────── */
export const WHITE_LV2_SESSION_PHASES = [
  { sessions: "1", focus: "블록 연습 (분리)" },
  { sessions: "2", focus: "전진/후진 스텝 + 잽 연결" },
  { sessions: "3", focus: "가벼운 랜덤 큐잉 (전진, 후진, 잽, 정지)" },
];
