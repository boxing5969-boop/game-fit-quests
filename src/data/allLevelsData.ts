// ═══════════════════════════════════════════════════════
// 40-Level Unified Data Structure
// All levels 1~40 across White/Blue/Red/Black leagues
// Updated: 3-day pacing, skill dictionary, no home missions
// ═══════════════════════════════════════════════════════

export interface RoutineBlock {
  title: string;
  emoji: string;
  durationMin: number;
  drills: string[];
}

export interface LearningModule {
  id: string;
  title: string;
  keyPoints: string[];
  commonMistakes?: string[];
  coachCues?: string[];
}

export interface ReviewCriteria {
  id: string;
  title: string;
  details: string[];
  mandatory: boolean;
}

export interface UnifiedLevel {
  globalLevel: number;
  league: "white" | "blue" | "red" | "black";
  levelInLeague: number;
  title: string;
  shortGoal: string;
  valueGained: string[];
  routineA: RoutineBlock[];
  routineB: RoutineBlock[];
  checklistFocus: string[];
  progressionConfig: {
    minXp: number;
    minSessions: number;
    minDays: number;
    minMinutes: number;
    checklistPassCount: number;
    mandatoryItems: number[];
    additionalRules?: Record<string, any>;
  };
  coachTags: string[];
  learningModules: LearningModule[];
  reviewCriteria: ReviewCriteria[];
  illustrationMeta: { title: string; brief: string; prompt: string };
  completionMode: "self_or_coach" | "coach_required" | "admin_required";
}

// ─── Helper to create routine blocks ───
function r(title: string, emoji: string, dur: number, drills: string[]): RoutineBlock {
  return { title, emoji, durationMin: dur, drills };
}

// ═══════════════════════════════════════════════════════
// WHITE SKILL DICTIONARY
// ═══════════════════════════════════════════════════════
export const WHITE_SKILL_DICTIONARY = {
  stance: {
    name: "기본 스탠스",
    how: "왼발이 앞, 오른발이 뒤. 발은 일직선이 아니라 기찻길처럼 어깨너비로 벌린다. 앞발은 11시, 뒷발은 1~2시 방향. 무릎은 잠그지 않고, 턱은 살짝 당긴다.",
    coachCues: ["레일 위에 서", "턱 숨겨", "무릎 잠그지 마"],
    commonMistakes: ["두 발이 일직선", "상체 과하게 세움", "턱 들림"],
  },
  guard: {
    name: "기본 가드",
    how: "앞손은 눈썹~광대 앞, 뒷손은 턱 옆. 팔꿈치는 너무 벌어지지 않게 아래로. 어깨는 힘 빼되 턱은 보호한다.",
    coachCues: ["손은 얼굴 옆", "팔꿈치 닫아", "어깨 힘 빼"],
    commonMistakes: ["손이 가슴으로 내려감", "팔꿈치 과하게 벌어짐"],
  },
  forwardStep: {
    name: "전진 스텝",
    how: "앞발이 먼저 나가고, 뒷발이 같은 거리만 따라온다. 발이 끌리거나 모이지 않게 한다.",
    coachCues: ["앞발 먼저", "간격 유지", "점프하지 마"],
    commonMistakes: ["발 모임", "상체 돌진", "보폭 과다"],
  },
  backStep: {
    name: "후진 스텝",
    how: "뒷발이 먼저 빠지고, 앞발이 따라온다. 상체가 뒤로 젖지 않게 한다.",
    coachCues: ["뒤발 먼저", "몸 젖히지 마", "레일 유지"],
    commonMistakes: ["앞발 먼저 빠짐", "뒤로 넘어짐", "발 꼬임"],
  },
  sideStep: {
    name: "좌우 스텝",
    how: "움직이는 방향의 발이 먼저 나가고 반대발이 따라온다. 교차하지 않는다.",
    coachCues: ["가는 쪽 발 먼저", "교차 금지", "머리 높이 유지"],
    commonMistakes: ["발 교차", "상체 흔들림", "무릎 펴짐"],
  },
  jab: {
    name: "잽",
    how: "앞손을 직선으로 빠르게 뻗고 바로 회수한다. 어깨가 턱을 살짝 가린다. 뒷손은 얼굴에 붙인다.",
    coachCues: ["찍고 바로 와", "뒷손 얼굴", "짧고 빠르게"],
    commonMistakes: ["팔만 뻗음", "손 늦게 회수", "뒷손 내려감"],
  },
  cross: {
    name: "카운터(뒷손 직선)",
    how: "뒷발 바닥을 살짝 돌리며 골반과 어깨를 함께 회전시키고 뒷손을 직선으로 보낸다. 공격 후 직선으로 그대로 가드로 되돌아온다. 허리, 골반, 다리, 발목을 함께 사용한다.",
    coachCues: ["뒤꿈치 돌려", "골반 같이", "직선으로 갔다가 직선으로 와"],
    commonMistakes: ["허리만 비틂", "몸이 너무 앞으로 쏠림", "손이 원으로 돌아옴", "앞손 내려감"],
  },
  oneTwo: {
    name: "원투",
    how: "잽으로 라인을 만들고, 이어서 카운터를 넣는다. 둘 다 끝나면 바로 가드 복귀.",
    coachCues: ["하나-둘-가드", "치고 서 있지 마", "리듬 유지"],
    commonMistakes: ["잽과 카운터가 섞임", "콤보 후 멈춤", "가드 늦음"],
  },
  inOutJab: {
    name: "인앤아웃 잽",
    how: "거리 밖에서 앞발과 함께 잽으로 들어가고, 다시 빠져서 원거리로 복귀한다.",
    coachCues: ["들어가서 찍고 빠져", "몸 던지지 마"],
    commonMistakes: ["손만 뻗음", "들어가고 못 빠짐", "과도한 돌진"],
  },
  leadPivot: {
    name: "리드 피벗 45도",
    how: "콤보 후 앞발을 작은 축으로 두고, 뒷발이 반원을 그리며 30~45도 각도를 바꾼다. 큰 회전 금지.",
    coachCues: ["작게 돌아", "허리만 돌리지 마", "가드 유지"],
    commonMistakes: ["90도 이상 과회전", "발 먼저 꼬임", "상체 비틀기만 함"],
  },
};

// ═══════════════════════════════════════════════════════
// WHITE LEAGUE (Levels 1–10) — Full content per spec
// Pacing: 3 sessions, 3 days, 150 min baseline
// ═══════════════════════════════════════════════════════
const WHITE_LEVELS: UnifiedLevel[] = [
  {
    globalLevel: 1, league: "white", levelInLeague: 1,
    title: "스탠스·가드·잽 입문",
    shortGoal: "안정적인 자세, 제자리 스텝, 잽",
    valueGained: ["운동을 시작하는 정체성 형성", "기본 자세와 가드 인식", "첫 잽 경험", "수업을 끝까지 해내는 경험", "기초체력과 리듬 시작"],
    routineA: [
      r("워밍업", "🔥", 5, ["발목 바운스", "제자리 마칭", "어깨 돌리기", "에어 스쿼트 10회"]),
      r("줄넘기", "🪢", 5, ["기본 바운스 2분", "액티브 레스트 1분", "복서 스텝 2분"]),
      r("스탠스·가드", "🪞", 10, ["가드 자세 정렬 2분", "제자리 스텝 3분", "좌우 중심 이동 3분", "스탠스 정지 → 스텝 2분"]),
      r("잽 입문", "👊", 10, ["잽 폼 설명", "거울 앞 잽 20회", "잽 후 가드 복귀 10회", "반대손 가드 유지 확인"]),
      r("하체 기초", "🦵", 7, ["스쿼트 15회", "카프 레이즈 20회", "플랭크 30초"]),
      r("마무리", "🧘", 3, ["호흡 정리", "오늘 포인트 체크"]),
    ],
    routineB: [
      r("워밍업", "🔥", 5, ["발목 바운스", "힙 오픈/클로즈", "어깨 돌리기"]),
      r("줄넘기/리듬", "🪢", 5, ["기본 바운스 2분", "라인 홉 2분"]),
      r("스탠스·스텝", "🪞", 10, ["기본 스탠스 정렬 3분", "제자리 복서 바운스 3분", "좌우 중심 이동 4분"]),
      r("잽 반복", "🎯", 10, ["제자리 잽 20회", "타깃 터치 잽 20회", "잽 후 가드 복귀"]),
      r("하체/코어", "🦵", 7, ["리버스 런지 8회씩", "카프 레이즈 20회", "플랭크 30초"]),
      r("마무리", "🧘", 3, ["호흡 정리"]),
    ],
    checklistFocus: ["가드 자세 60초 유지", "잽 20회 정확도", "제자리 스텝 2분", "하체 기초체력"],
    progressionConfig: { minXp: 300, minSessions: 3, minDays: 3, minMinutes: 150, checklistPassCount: 3, mandatoryItems: [0, 1] },
    coachTags: ["가드", "잽", "스텝", "체력", "자세 복구"],
    learningModules: [
      {
        id: "stance-guard", title: "기본 스탠스와 가드",
        keyPoints: ["발은 어깨너비, 기찻길 위에 서기", "앞발 11시, 뒷발 1~2시", "체중 균등, 무릎 잠그지 않기", "손은 얼굴 높이에서 턱 보호"],
        coachCues: WHITE_SKILL_DICTIONARY.stance.coachCues,
        commonMistakes: WHITE_SKILL_DICTIONARY.stance.commonMistakes,
      },
      {
        id: "jab-intro", title: "잽 첫 동작",
        keyPoints: ["앞손을 직선으로 뻗기", "어깨로 턱 보호", "손 빠르게 복귀", "뒷손 가드 유지"],
        coachCues: WHITE_SKILL_DICTIONARY.jab.coachCues,
        commonMistakes: WHITE_SKILL_DICTIONARY.jab.commonMistakes,
      },
    ],
    reviewCriteria: [
      { id: "w1-r1", title: "가드 자세 60초 유지", details: ["턱 들림 없음", "손이 얼굴에서 크게 떨어지지 않음"], mandatory: true },
      { id: "w1-r2", title: "잽 20회 정확도", details: ["반대손 가드 유지", "잽 후 손 빠른 복귀", "어깨로 턱 보호"], mandatory: true },
      { id: "w1-r3", title: "제자리 스텝 2분", details: ["몸통 크게 흔들리지 않음"], mandatory: false },
      { id: "w1-r4", title: "하체 기초체력", details: ["스쿼트 15회", "플랭크 30초"], mandatory: false },
    ],
    illustrationMeta: { title: "첫 잽", brief: "스탠스와 가드를 잡고 첫 잽을 내미는 복서", prompt: "Beginner boxer in proper stance throwing first jab, boxing gym background, warm lighting" },
    completionMode: "self_or_coach",
  },
  {
    globalLevel: 2, league: "white", levelInLeague: 2,
    title: "사이드 스텝과 인앤아웃 잽",
    shortGoal: "사이드 스텝 안정화, 인앤아웃 잽",
    valueGained: ["사이드 스텝 기초", "인앤아웃 잽 경험", "거리 감각 시작", "움직임 속 자세 유지"],
    routineA: [
      r("워밍업", "🔥", 5, ["발목 바운스", "어깨/골반 가동성", "에어 스쿼트 10회"]),
      r("줄넘기", "🪢", 5, ["기본 바운스 2분", "복서 스텝 2분"]),
      r("사이드 스텝", "🪞", 10, ["사이드 스텝 좌 2분", "사이드 스텝 우 2분", "좌우 혼합 3분", "이동 후 정지 3분"]),
      r("인앤아웃 잽", "👊", 10, ["인앤아웃 잽 설명", "인앤아웃 잽 10회", "인 → 잽 → 아웃 복귀 반복"]),
      r("하체/균형", "🦵", 7, ["사이드 런지 10회씩", "싱글 레그 밸런스 30초씩"]),
      r("마무리", "🧘", 3, ["호흡 정리"]),
    ],
    routineB: [
      r("워밍업", "🔥", 5, ["제자리 마칭", "힙 오픈/클로즈"]),
      r("줄넘기/리듬", "🪢", 5, ["복서 스텝"]),
      r("사이드 이동 후 잽", "👊", 10, ["사이드 이동 후 잽 10회", "더블 잽 10회", "잽 후 사이드 아웃"]),
      r("인앤아웃 연습", "🎯", 10, ["인앤아웃 잽 반복 20회", "들어가서 찍고 빠지기"]),
      r("하체/코어", "🦵", 7, ["스쿼트 15회", "플랭크 30초"]),
      r("마무리", "🧘", 3, ["호흡 정리"]),
    ],
    checklistFocus: ["사이드 스텝 2분", "인앤아웃 잽 10회", "더블 잽", "균형 유지"],
    progressionConfig: { minXp: 300, minSessions: 3, minDays: 3, minMinutes: 150, checklistPassCount: 3, mandatoryItems: [0, 1] },
    coachTags: ["사이드 스텝", "인앤아웃 잽", "균형", "가드", "거리"],
    learningModules: [
      {
        id: "side-step", title: "사이드 스텝 기초",
        keyPoints: ["좌우 이동 시 발 교차 없이", "이동 후 정지 → 스탠스 복구", "상체 과도한 흔들림 없이"],
        coachCues: WHITE_SKILL_DICTIONARY.sideStep.coachCues,
        commonMistakes: WHITE_SKILL_DICTIONARY.sideStep.commonMistakes,
      },
      {
        id: "in-out-jab", title: "인앤아웃 잽",
        keyPoints: ["거리 밖에서 들어가서 잽", "잽 후 빠르게 원거리 복귀", "몸 던지지 않기"],
        coachCues: WHITE_SKILL_DICTIONARY.inOutJab.coachCues,
        commonMistakes: WHITE_SKILL_DICTIONARY.inOutJab.commonMistakes,
      },
    ],
    reviewCriteria: [
      { id: "w2-r1", title: "사이드 스텝 2분 유지", details: ["발 교차 없음", "상체 흔들림 최소"], mandatory: true },
      { id: "w2-r2", title: "인앤아웃 잽 10회", details: ["들어가서 찍고 빠지기", "과도한 돌진 없음"], mandatory: true },
      { id: "w2-r3", title: "더블 잽 10회", details: ["리듬 유지"], mandatory: false },
      { id: "w2-r4", title: "균형 유지 확인", details: ["이동 후 정지 시 흔들림 없음"], mandatory: false },
    ],
    illustrationMeta: { title: "사이드 무브", brief: "사이드 스텝 후 잽을 던지는 복서", prompt: "Boxer doing side step and throwing jab, dynamic angle, boxing gym" },
    completionMode: "self_or_coach",
  },
  {
    globalLevel: 3, league: "white", levelInLeague: 3,
    title: "카운터(뒷손 직선) 입문",
    shortGoal: "뒷손 안정적인 카운터, 발목/허리/골반/다리 회전, 직선 복귀",
    valueGained: ["카운터 첫 경험", "전신 연결 회전", "직선 복귀 습관", "파워 전달 기초"],
    routineA: [
      r("워밍업", "🔥", 5, ["발목 바운스", "골반 회전", "어깨 돌리기"]),
      r("줄넘기/리듬", "🪢", 5, ["기본 바운스 2분", "복서 스텝 2분"]),
      r("카운터 폼", "🥊", 12, ["카운터 폼 설명", "뒤꿈치 돌리기 연습", "골반-어깨 회전 연결", "카운터 → 가드 직선 복귀 10회"]),
      r("카운터 반복", "🎯", 10, ["느린 카운터 20회", "카운터 후 직선 복귀 확인", "앞손 가드 유지 체크"]),
      r("하체/코어", "🦵", 5, ["스쿼트 15회", "플랭크 30초"]),
      r("마무리", "🧘", 3, ["호흡 정리"]),
    ],
    routineB: [
      r("워밍업", "🔥", 5, ["제자리 마칭", "골반 회전"]),
      r("줄넘기/리듬", "🪢", 5, ["복서 스텝"]),
      r("카운터 + 가드", "🥊", 12, ["카운터 10회 → 가드 복귀", "거울 앞 카운터 폼 체크", "전신 연결 확인"]),
      r("잽 복습 + 카운터", "🎯", 10, ["잽 10회", "카운터 10회", "잽-카운터 분리 연습"]),
      r("하체/코어", "🦵", 5, ["런지 8회씩", "카프 레이즈 20회"]),
      r("마무리", "🧘", 3, ["호흡 정리"]),
    ],
    checklistFocus: ["카운터 20회 정확도", "뒤꿈치 회전", "직선 복귀", "전신 연결"],
    progressionConfig: { minXp: 300, minSessions: 3, minDays: 3, minMinutes: 150, checklistPassCount: 3, mandatoryItems: [0, 1] },
    coachTags: ["카운터", "회전", "직선 복귀", "골반", "가드"],
    learningModules: [
      {
        id: "cross-intro", title: "카운터(뒷손 직선)",
        keyPoints: ["뒷발 바닥 회전 → 골반 → 어깨 → 주먹", "직선으로 보내고 직선으로 복귀", "전신 연결로 파워 전달", "앞손 가드 반드시 유지"],
        coachCues: WHITE_SKILL_DICTIONARY.cross.coachCues,
        commonMistakes: WHITE_SKILL_DICTIONARY.cross.commonMistakes,
      },
    ],
    reviewCriteria: [
      { id: "w3-r1", title: "카운터 20회 정확도", details: ["뒤꿈치 회전 확인", "골반-어깨 연결"], mandatory: true },
      { id: "w3-r2", title: "직선 복귀", details: ["손이 원으로 돌아오지 않음", "가드 위치로 직선 복귀"], mandatory: true },
      { id: "w3-r3", title: "전신 연결", details: ["발목-다리-골반-허리-어깨 순서"], mandatory: false },
      { id: "w3-r4", title: "앞손 가드 유지", details: ["카운터 시 앞손 내려가지 않음"], mandatory: false },
    ],
    illustrationMeta: { title: "카운터", brief: "카운터를 전신으로 던지는 복서", prompt: "Boxer throwing powerful cross punch with full body rotation, boxing gym" },
    completionMode: "self_or_coach",
  },
  {
    globalLevel: 4, league: "white", levelInLeague: 4,
    title: "인앤아웃 잽 + 카운터 연결",
    shortGoal: "인앤아웃 잽과 카운터를 연결한다",
    valueGained: ["잽-카운터 연결 경험", "공격 후 복귀 습관", "거리 조절 시작"],
    routineA: [
      r("워밍업", "🔥", 5, ["발목 바운스", "어깨 가동성"]),
      r("줄넘기/리듬", "🪢", 5, ["기본 바운스 2분", "복서 스텝 2분"]),
      r("인앤아웃 잽 + 카운터", "🥊", 15, ["인앤아웃 잽 10회 복습", "카운터 10회 복습", "인앤아웃 잽 → 카운터 연결 10회", "연결 후 가드 복귀"]),
      r("하체/코어", "🦵", 7, ["스쿼트 15회", "플랭크 30초"]),
      r("마무리", "🧘", 3, ["호흡 정리"]),
    ],
    routineB: [
      r("워밍업", "🔥", 5, ["제자리 마칭", "힙 오픈/클로즈"]),
      r("줄넘기/리듬", "🪢", 5, ["복서 스텝"]),
      r("연결 드릴", "🥊", 15, ["잽 → 카운터 → 가드 10회", "인앤아웃 잽 → 카운터 → 아웃 10회", "느리게 정확하게 반복"]),
      r("하체/코어", "🦵", 7, ["런지 10회씩", "카프 레이즈 20회"]),
      r("마무리", "🧘", 3, ["호흡 정리"]),
    ],
    checklistFocus: ["인앤아웃 잽 → 카운터 연결 10회", "연결 후 가드 복귀", "거리 조절"],
    progressionConfig: { minXp: 300, minSessions: 3, minDays: 3, minMinutes: 150, checklistPassCount: 3, mandatoryItems: [0, 1] },
    coachTags: ["잽", "카운터", "연결", "거리", "가드 복귀"],
    learningModules: [
      { id: "jab-cross-link", title: "잽-카운터 연결", keyPoints: ["인앤아웃 잽으로 진입", "카운터로 마무리", "연결 후 즉시 가드 복귀"], coachCues: ["들어가서 하나-둘-가드"], commonMistakes: ["카운터 없이 잽만 반복", "연결 후 멈춤"] },
    ],
    reviewCriteria: [
      { id: "w4-r1", title: "잽-카운터 연결 10회", details: ["리듬감 있는 연결"], mandatory: true },
      { id: "w4-r2", title: "가드 복귀", details: ["연결 후 즉시 가드"], mandatory: true },
      { id: "w4-r3", title: "거리 조절", details: ["인앤아웃 거리 적절"], mandatory: false },
    ],
    illustrationMeta: { title: "잽-카운터", brief: "잽과 카운터를 연결하는 복서", prompt: "Boxer connecting jab to cross in combination, boxing gym" },
    completionMode: "self_or_coach",
  },
  {
    globalLevel: 5, league: "white", levelInLeague: 5,
    title: "안정적인 원투",
    shortGoal: "안정적인 원투",
    valueGained: ["원투 콤비네이션 숙달", "리듬감 향상", "가드 복귀 자동화"],
    routineA: [
      r("워밍업", "🔥", 5, ["발목 바운스", "어깨 가동성"]),
      r("줄넘기/리듬", "🪢", 5, ["기본 바운스", "복서 스텝"]),
      r("원투 드릴", "🥊", 15, ["원투 폼 설명", "느린 원투 20회", "원투 → 가드 복귀 10회", "원투 리듬 연습"]),
      r("하체/코어", "🦵", 7, ["스쿼트 15회", "플랭크 30초"]),
      r("마무리", "🧘", 3, ["호흡 정리"]),
    ],
    routineB: [
      r("워밍업", "🔥", 5, ["제자리 마칭", "골반 회전"]),
      r("줄넘기/리듬", "🪢", 5, ["복서 스텝"]),
      r("원투 반복", "🥊", 15, ["원투 20회", "잽-잽-카운터 10회", "원투 후 사이드 스텝 아웃"]),
      r("하체/코어", "🦵", 7, ["런지 10회씩", "플랭크 30초"]),
      r("마무리", "🧘", 3, ["호흡 정리"]),
    ],
    checklistFocus: ["원투 20회 정확도", "하나-둘-가드 리듬", "치고 서 있지 않기"],
    progressionConfig: { minXp: 300, minSessions: 3, minDays: 3, minMinutes: 150, checklistPassCount: 3, mandatoryItems: [0, 1] },
    coachTags: ["원투", "리듬", "가드 복귀", "콤비"],
    learningModules: [
      { id: "one-two", title: "원투", keyPoints: ["잽으로 라인 → 카운터로 마무리", "하나-둘-가드 리듬", "치고 서 있지 말기"], coachCues: WHITE_SKILL_DICTIONARY.oneTwo.coachCues, commonMistakes: WHITE_SKILL_DICTIONARY.oneTwo.commonMistakes },
    ],
    reviewCriteria: [
      { id: "w5-r1", title: "원투 20회", details: ["잽과 카운터 구분 명확"], mandatory: true },
      { id: "w5-r2", title: "가드 복귀", details: ["콤보 후 멈추지 않음"], mandatory: true },
      { id: "w5-r3", title: "리듬", details: ["일정한 리듬 유지"], mandatory: false },
    ],
    illustrationMeta: { title: "원투", brief: "원투를 던지는 복서", prompt: "Boxer throwing one-two combination, side view, boxing gym" },
    completionMode: "self_or_coach",
  },
  {
    globalLevel: 6, league: "white", levelInLeague: 6,
    title: "리드 피벗과 연결 드릴",
    shortGoal: "안정적인 리드 피벗, 인앤아웃 잽 → 카운터 → 리드 피벗",
    valueGained: ["리드 피벗 경험", "각도 변환 기초", "콤보 후 탈출"],
    routineA: [
      r("워밍업", "🔥", 5, ["발목 바운스", "어깨 가동성"]),
      r("줄넘기/리듬", "🪢", 5, ["기본 바운스", "복서 스텝"]),
      r("리드 피벗", "🥊", 15, ["리드 피벗 폼 설명", "피벗 연습 20회", "인앤아웃 잽 → 카운터 → 피벗 10회"]),
      r("하체/코어", "🦵", 7, ["스쿼트 15회", "플랭크 30초"]),
      r("마무리", "🧘", 3, ["호흡 정리"]),
    ],
    routineB: [
      r("워밍업", "🔥", 5, ["제자리 마칭", "골반 회전"]),
      r("줄넘기/리듬", "🪢", 5, ["복서 스텝"]),
      r("피벗 연결", "🥊", 15, ["피벗 20회", "원투 → 피벗 10회", "인앤아웃 잽 → 카운터 → 피벗 → 가드 복귀"]),
      r("하체/코어", "🦵", 7, ["런지 10회씩", "플랭크 30초"]),
      r("마무리", "🧘", 3, ["호흡 정리"]),
    ],
    checklistFocus: ["리드 피벗 20회", "인앤아웃 잽 → 카운터 → 피벗 연결", "가드 유지"],
    progressionConfig: { minXp: 300, minSessions: 3, minDays: 3, minMinutes: 150, checklistPassCount: 3, mandatoryItems: [0, 1] },
    coachTags: ["피벗", "각도", "연결", "가드"],
    learningModules: [
      { id: "lead-pivot", title: "리드 피벗 45도", keyPoints: ["앞발 축으로 30~45도 각도 변환", "큰 회전 금지", "콤보 후 탈출 경로"], coachCues: WHITE_SKILL_DICTIONARY.leadPivot.coachCues, commonMistakes: WHITE_SKILL_DICTIONARY.leadPivot.commonMistakes },
    ],
    reviewCriteria: [
      { id: "w6-r1", title: "리드 피벗 20회", details: ["30~45도 적절한 각도"], mandatory: true },
      { id: "w6-r2", title: "연결 드릴", details: ["잽→카운터→피벗 안정적 연결"], mandatory: true },
      { id: "w6-r3", title: "가드 유지", details: ["피벗 중 가드 유지"], mandatory: false },
    ],
    illustrationMeta: { title: "리드 피벗", brief: "피벗으로 각도를 바꾸는 복서", prompt: "Boxer performing lead pivot after combination, boxing gym" },
    completionMode: "self_or_coach",
  },
  {
    globalLevel: 7, league: "white", levelInLeague: 7,
    title: "Lv.1~6 반복 + 파트너 미트",
    shortGoal: "Lv.1~6 동작을 연결하고 파트너 미트로 받아주기",
    valueGained: ["전체 동작 연결", "파트너 드릴 경험", "미트 잡기 기초"],
    routineA: [
      r("워밍업", "🔥", 5, ["발목 바운스", "어깨 가동성"]),
      r("줄넘기/리듬", "🪢", 5, ["복서 스텝"]),
      r("종합 드릴", "🥊", 15, ["잽 10회", "인앤아웃 잽 10회", "카운터 10회", "원투 10회", "인앤아웃 잽 → 카운터 → 피벗 10회"]),
      r("파트너 미트", "🤝", 8, ["미트 잡기 기초", "파트너 잽 받기", "파트너 원투 받기"]),
      r("마무리", "🧘", 3, ["호흡 정리"]),
    ],
    routineB: [
      r("워밍업", "🔥", 5, ["제자리 마칭"]),
      r("줄넘기/리듬", "🪢", 5, ["복서 스텝"]),
      r("연결 드릴", "🥊", 15, ["인앤아웃 잽 → 카운터 → 피벗 → 원투 연결", "반복 3세트", "정확도 중심"]),
      r("파트너 미트", "🤝", 8, ["미트 교대", "큐에 반응하기"]),
      r("마무리", "🧘", 3, ["호흡 정리"]),
    ],
    checklistFocus: ["전체 연결 드릴 3세트", "파트너 미트 드릴 완료", "미트 잡기 기초"],
    progressionConfig: { minXp: 300, minSessions: 3, minDays: 3, minMinutes: 150, checklistPassCount: 3, mandatoryItems: [0, 1] },
    coachTags: ["연결", "파트너", "미트", "종합", "복습"],
    learningModules: [
      { id: "combo-review", title: "Lv.1~6 종합 복습", keyPoints: ["모든 동작을 순서대로 연결", "정확도 우선", "파트너와 함께 연습"], coachCues: ["정확하게 연결해", "미트 받을 때 자세 유지"], commonMistakes: ["급하게 연결", "미트 잡을 때 자세 무너짐"] },
    ],
    reviewCriteria: [
      { id: "w7-r1", title: "종합 연결 드릴", details: ["잽→인앤아웃→카운터→원투→피벗 연결"], mandatory: true },
      { id: "w7-r2", title: "파트너 미트", details: ["미트 드릴 2분 이상"], mandatory: true },
      { id: "w7-r3", title: "미트 잡기", details: ["기본 미트 잡기 가능"], mandatory: false },
    ],
    illustrationMeta: { title: "파트너 드릴", brief: "파트너와 미트 훈련", prompt: "Two boxers doing mitt work in boxing gym" },
    completionMode: "self_or_coach",
  },
  {
    globalLevel: 8, league: "white", levelInLeague: 8,
    title: "원투쓰리·원투원투·원투쓱빡",
    shortGoal: "스트레이트 3종 세트 안정적 수행",
    valueGained: ["원투쓰리 경험", "원투원투 리듬", "원투쓱빡 경험", "콤비 다양성"],
    routineA: [
      r("워밍업", "🔥", 5, ["발목 바운스", "어깨 가동성"]),
      r("줄넘기/리듬", "🪢", 5, ["복서 스텝"]),
      r("스트레이트 3종", "🥊", 18, [
        "원투쓰리(잽-카운터-훅) 폼 → 10회",
        "원투원투(잽-카운터-잽-카운터) 폼 → 10회",
        "원투쓱빡 폼 설명 → 10회",
        "원투쓱빡: 잽-카운터 직후 빠르게 바디(쓱) → 헤드(빡) 연결",
        "3종 세트 순서대로 반복"
      ]),
      r("하체/코어", "🦵", 5, ["스쿼트 15회", "플랭크 30초"]),
      r("마무리", "🧘", 3, ["호흡 정리"]),
    ],
    routineB: [
      r("워밍업", "🔥", 5, ["제자리 마칭"]),
      r("줄넘기/리듬", "🪢", 5, ["복서 스텝"]),
      r("3종 반복", "🥊", 18, [
        "원투쓰리 10회",
        "원투원투 10회",
        "원투쓱빡 10회",
        "랜덤 큐잉으로 3종 혼합"
      ]),
      r("하체/코어", "🦵", 5, ["런지 10회씩"]),
      r("마무리", "🧘", 3, ["호흡 정리"]),
    ],
    checklistFocus: ["원투쓰리 10회", "원투원투 10회", "원투쓱빡 10회", "3종 세트 구분"],
    progressionConfig: { minXp: 300, minSessions: 3, minDays: 3, minMinutes: 150, checklistPassCount: 3, mandatoryItems: [0, 1] },
    coachTags: ["원투쓰리", "원투원투", "원투쓱빡", "콤비", "리듬"],
    learningModules: [
      {
        id: "straight-combo", title: "스트레이트 3종 세트",
        keyPoints: [
          "원투쓰리: 잽-카운터-훅 연결",
          "원투원투: 잽-카운터-잽-카운터 더블 연결",
          "원투쓱빡: 잽-카운터 → 빠른 바디(쓱) → 헤드(빡) 연결. 상하 리듬 전환이 핵심",
          "3종 모두 가드 복귀로 마무리"
        ],
        coachCues: ["쓱은 바디로 빠르게", "빡은 올라오면서 정확하게", "리듬 유지"],
        commonMistakes: ["3종 구분 못함", "원투쓱빡에서 상하 전환 늦음", "콤보 후 가드 늦음"]
      },
    ],
    reviewCriteria: [
      { id: "w8-r1", title: "원투쓰리 10회", details: ["잽-카운터-훅 구분 명확"], mandatory: true },
      { id: "w8-r2", title: "원투쓱빡 10회", details: ["상하 리듬 전환 확인"], mandatory: true },
      { id: "w8-r3", title: "원투원투 10회", details: ["더블 카운터 정확도"], mandatory: false },
    ],
    illustrationMeta: { title: "원투쓱빡", brief: "다양한 콤비네이션을 연결하는 복서", prompt: "Boxer performing multiple punch combinations in boxing gym" },
    completionMode: "self_or_coach",
  },
  {
    globalLevel: 9, league: "white", levelInLeague: 9,
    title: "더킹·위빙 입문",
    shortGoal: "더킹 동작 숙달, 위빙 동작 숙달",
    valueGained: ["더킹 기초", "위빙 기초", "방어 동작 다양화", "머리 움직임 인식"],
    routineA: [
      r("워밍업", "🔥", 5, ["발목 바운스", "어깨 가동성"]),
      r("줄넘기/리듬", "🪢", 5, ["복서 스텝"]),
      r("더킹·위빙", "🥊", 18, [
        "더킹 폼 설명 → 천천히 20회",
        "위빙 폼 설명 → 천천히 20회",
        "더킹 후 카운터 10회",
        "위빙 후 훅 자세 잡기 10회",
        "더킹-위빙 교대 연습"
      ]),
      r("하체/코어", "🦵", 5, ["스쿼트 15회", "플랭크 30초"]),
      r("마무리", "🧘", 3, ["호흡 정리"]),
    ],
    routineB: [
      r("워밍업", "🔥", 5, ["제자리 마칭"]),
      r("줄넘기/리듬", "🪢", 5, ["복서 스텝"]),
      r("더킹·위빙 반복", "🥊", 18, [
        "더킹 20회",
        "위빙 20회",
        "더킹 → 카운터 → 피벗 10회",
        "파트너 큐 반응 연습"
      ]),
      r("하체/코어", "🦵", 5, ["런지 10회씩"]),
      r("마무리", "🧘", 3, ["호흡 정리"]),
    ],
    checklistFocus: ["더킹 20회", "위빙 20회", "더킹 후 카운터", "위빙 후 훅 자세"],
    progressionConfig: { minXp: 300, minSessions: 3, minDays: 3, minMinutes: 150, checklistPassCount: 3, mandatoryItems: [0, 1] },
    coachTags: ["더킹", "위빙", "방어", "카운터", "머리 움직임"],
    learningModules: [
      { id: "duck-weave", title: "더킹과 위빙", keyPoints: ["더킹: 무릎을 굽혀 머리를 낮추고 복귀", "위빙: U자로 머리를 좌우로 이동", "더킹 후 카운터 연결", "위빙 후 훅 자세 잡기"], coachCues: ["무릎으로 내려가", "허리만 꺾지 마", "눈은 앞을 봐"], commonMistakes: ["허리만 숙임", "시선 아래로", "복귀 늦음"] },
    ],
    reviewCriteria: [
      { id: "w9-r1", title: "더킹 20회", details: ["무릎 굽힘으로 내려가기"], mandatory: true },
      { id: "w9-r2", title: "위빙 20회", details: ["U자 궤적 확인"], mandatory: true },
      { id: "w9-r3", title: "더킹 후 카운터", details: ["방어-공격 연결"], mandatory: false },
    ],
    illustrationMeta: { title: "더킹·위빙", brief: "더킹과 위빙을 연습하는 복서", prompt: "Boxer practicing ducking and weaving defense movements" },
    completionMode: "self_or_coach",
  },
  {
    globalLevel: 10, league: "white", levelInLeague: 10,
    title: "화이트 마스터 / 블루 리그 승격",
    shortGoal: "Lv.1~9 핵심 드릴 종합 + 파트너 미트 타이밍",
    valueGained: ["화이트 전체 복습", "블루 승격 자격", "기초 완성 확인", "파트너 타이밍 훈련"],
    routineA: [
      r("워밍업", "🔥", 5, ["발목 바운스", "어깨 가동성"]),
      r("줄넘기/리듬", "🪢", 5, ["복서 스텝"]),
      r("종합 드릴", "🥊", 20, [
        "잽 드릴 3회 반복", "인앤아웃 잽 3회", "카운터 3회", "원투 3회",
        "인앤아웃 잽 → 카운터 → 피벗 3회",
        "원투쓰리 3회", "원투원투 3회", "원투쓱빡 3회",
        "더킹 후 카운터 3회", "위빙 후 자세 잡기 3회"
      ]),
      r("파트너 미트", "🤝", 8, ["Lv.10 드릴 연속 3번", "타이밍 훈련"]),
      r("마무리", "🧘", 3, ["호흡 정리"]),
    ],
    routineB: [
      r("워밍업", "🔥", 5, ["제자리 마칭"]),
      r("줄넘기/리듬", "🪢", 5, ["복서 스텝"]),
      r("종합 반복", "🥊", 20, [
        "Lv.1~9 핵심 드릴 각 3회",
        "파트너 교대 미트",
        "랜덤 큐잉 반응"
      ]),
      r("종합 체크", "🤝", 8, ["타이밍 훈련", "밸런스 체크", "연결 품질 확인"]),
      r("마무리", "🧘", 3, ["호흡 정리"]),
    ],
    checklistFocus: ["전 기술 종합 시연", "Lv.10 드릴 연속 3번", "파트너 미트 타이밍", "밸런스·파워·자세·리듬·연결·복귀"],
    progressionConfig: { minXp: 500, minSessions: 5, minDays: 5, minMinutes: 250, checklistPassCount: 5, mandatoryItems: [0, 1, 2] },
    coachTags: ["종합", "승격", "체크", "타이밍", "밸런스"],
    learningModules: [
      { id: "white-master", title: "화이트 마스터 종합", keyPoints: ["Lv.1~9 핵심 드릴을 각 3회 안정적 반복", "Lv.10 드릴 연속 3번 성공", "밸런스, 파워, 자세, 리듬, 연결, 복귀, 타이밍 종합 심사", "단순 암기가 아닌 실행 품질 평가"], coachCues: ["하나하나 정확하게", "전체를 연결해서"], commonMistakes: ["급하게 몰아침", "기본기 무시하고 연결만 시도"] },
    ],
    reviewCriteria: [
      { id: "w10-r1", title: "Lv.1~9 드릴 각 3회", details: ["안정적 반복 확인"], mandatory: true },
      { id: "w10-r2", title: "Lv.10 종합 드릴 연속 3번", details: ["연속 성공 확인"], mandatory: true },
      { id: "w10-r3", title: "밸런스·파워·자세·리듬", details: ["종합 평가"], mandatory: true },
      { id: "w10-r4", title: "연결·복귀·타이밍", details: ["실행 품질 평가"], mandatory: false },
      { id: "w10-r5", title: "파트너 미트 타이밍", details: ["파트너와 타이밍 맞추기"], mandatory: false },
      { id: "w10-r6", title: "코치 종합 판단", details: ["리그 승격 적합 여부"], mandatory: false },
    ],
    illustrationMeta: { title: "화이트 마스터", brief: "블루 리그 승격 준비", prompt: "Boxer completing white league final test, dramatic lighting, boxing gym" },
    completionMode: "coach_required",
  },
];

// ═══════════════════════════════════════════════════════
// BLUE LEAGUE (Levels 11–20)
// ═══════════════════════════════════════════════════════
function generateBlueLeague(): UnifiedLevel[] {
  const levels: Array<{
    lv: number; title: string; goal: string; values: string[]; tags: string[];
    focusA: string[]; focusB: string[];
    modules: LearningModule[]; reviews: ReviewCriteria[];
  }> = [
    { lv: 1, title: "움직이며 자세 유지", goal: "이동 중 기본 자세를 유지하는 능력을 키운다", values: ["이동 중 자세 유지", "풋워크 안정성", "가드 자동화"], tags: ["자세", "이동", "유지", "균형"],
      focusA: ["이동 중 가드 유지 3분", "전후좌우 이동 혼합 3분", "이동 후 정지 → 자세 체크"], focusB: ["방향 전환 드릴", "이동 속도 변화", "이동 후 잽"],
      modules: [{ id: "b1-mod", title: "움직이며 자세 유지", keyPoints: ["이동 중 가드 높이 유지", "정지 시 자세 즉시 복구", "머리 높이 일정하게"], coachCues: ["이동해도 가드 유지", "정지하면 자세 체크"], commonMistakes: ["이동 시 가드 내려감", "정지 후 자세 복구 늦음"] }],
      reviews: [{ id: "b1-r1", title: "이동 중 가드 유지 3분", details: ["가드 내려가지 않음"], mandatory: true }, { id: "b1-r2", title: "방향 전환 후 자세 체크", details: ["즉시 자세 복구"], mandatory: true }] },
    { lv: 2, title: "잽 마스터리", goal: "잽의 정확도, 속도, 리듬을 높인다", values: ["잽 정확도 향상", "잽 속도 향상", "잽 리듬 완성"], tags: ["잽", "정확도", "속도", "리듬"],
      focusA: ["잽 정확도 드릴 30회", "잽 속도 변화 드릴", "더블 잽-트리플 잽"], focusB: ["타깃 정확도 잽", "리듬 변화 잽", "이동 잽 마스터리"],
      modules: [{ id: "b2-mod", title: "잽 마스터리", keyPoints: ["정확도 → 속도 → 리듬 순서", "타깃 크기 줄여가며 연습", "다양한 리듬 변화"], coachCues: ["정확하게 먼저", "속도는 나중에"], commonMistakes: ["속도만 추구", "정확도 무시"] }],
      reviews: [{ id: "b2-r1", title: "잽 30회 정확도", details: ["타깃 적중률 80% 이상"], mandatory: true }, { id: "b2-r2", title: "더블/트리플 잽", details: ["리듬 유지"], mandatory: true }] },
    { lv: 3, title: "스트레이트 회전 입문", goal: "스트레이트의 회전력과 체중 이동을 배운다", values: ["스트레이트 회전력", "체중 이동 이해", "파워 전달 향상"], tags: ["스트레이트", "회전", "체중이동", "파워"],
      focusA: ["스트레이트 회전 연습 20회", "체중 이동 드릴", "파워 체크"], focusB: ["느린 스트레이트 → 빠른 스트레이트", "회전 정확도", "연결 후 복귀"],
      modules: [{ id: "b3-mod", title: "스트레이트 회전", keyPoints: ["뒤꿈치→골반→어깨→주먹 순서", "체중을 앞으로 실지 않기", "회전 후 원위치"], coachCues: ["뒤꿈치 돌려", "체중 앞으로 실지 마"], commonMistakes: ["체중 과도하게 앞으로", "회전 없이 팔만 뻗음"] }],
      reviews: [{ id: "b3-r1", title: "스트레이트 회전 20회", details: ["회전력 확인"], mandatory: true }, { id: "b3-r2", title: "체중 이동 정확도", details: ["앞으로 쏠리지 않음"], mandatory: true }] },
    { lv: 4, title: "원투 연결 정교화", goal: "잽-스트레이트를 자연스럽게 연결한다", values: ["원투 정교화", "리듬 향상", "연결 자연스러움"], tags: ["1-2", "콤비", "리듬", "연결"],
      focusA: ["원투 정교화 드릴", "속도 변화 원투", "이동 원투"], focusB: ["원투 → 방어 → 원투", "랜덤 큐 원투", "샌드백 원투"],
      modules: [{ id: "b4-mod", title: "원투 정교화", keyPoints: ["잽과 카운터 사이 갭 최소화", "리듬 다양화", "이동 중 원투"], coachCues: ["갭 줄여", "리듬 바꿔봐"], commonMistakes: ["잽과 카운터 사이 너무 느림", "원투 후 멈춤"] }],
      reviews: [{ id: "b4-r1", title: "원투 20회 정교화", details: ["갭 최소화"], mandatory: true }, { id: "b4-r2", title: "이동 원투", details: ["이동 중 안정적 원투"], mandatory: true }] },
    { lv: 5, title: "공격 후 복귀와 기본 방어", goal: "공격 후 안전하게 돌아오는 습관을 강화한다", values: ["공격 후 복귀 자동화", "기본 방어 숙달", "안전한 복싱 습관"], tags: ["복귀", "방어", "안전", "습관"],
      focusA: ["공격 → 가드 복귀 드릴", "슬립 연습", "패리 기초"], focusB: ["공격 → 방어 → 카운터", "큐 반응 방어", "방어 후 복귀"],
      modules: [{ id: "b5-mod", title: "방어와 복귀", keyPoints: ["모든 공격 후 즉시 가드 복귀", "슬립과 패리 기초", "방어 → 카운터 연결"], coachCues: ["치면 바로 와", "슬립 후 카운터"], commonMistakes: ["공격 후 가드 늦음", "슬립 시 과하게 피함"] }],
      reviews: [{ id: "b5-r1", title: "공격 후 복귀 연속 20회", details: ["즉시 가드 복귀"], mandatory: true }, { id: "b5-r2", title: "슬립/패리 기초", details: ["기본 동작 수행"], mandatory: true }] },
    { lv: 6, title: "리드 훅 입문", goal: "리드 훅의 정교함과 파워를 높인다", values: ["리드 훅 경험", "회전력 발전", "상하 공격 시작"], tags: ["리드 훅", "회전", "파워", "각도"],
      focusA: ["리드 훅 폼 20회", "잽-훅 연결", "훅 → 가드 복귀"], focusB: ["느린 훅 → 빠른 훅", "잽-훅-카운터 3타", "바디 훅 기초"],
      modules: [{ id: "b6-mod", title: "리드 훅", keyPoints: ["팔꿈치 90도 고정", "골반 회전으로 파워", "바디와 헤드 구분"], coachCues: ["팔꿈치 각도 유지", "골반으로 쳐"], commonMistakes: ["팔로만 스윙", "팔꿈치 각도 무너짐"] }],
      reviews: [{ id: "b6-r1", title: "리드 훅 20회", details: ["폼 정확도"], mandatory: true }, { id: "b6-r2", title: "잽-훅 연결", details: ["자연스러운 연결"], mandatory: true }] },
    { lv: 7, title: "어퍼컷 입문", goal: "어퍼컷의 정확도와 타이밍을 향상시킨다", values: ["어퍼컷 경험", "상하 리듬", "인파이트 기초"], tags: ["어퍼컷", "정확도", "타이밍", "바디"],
      focusA: ["어퍼컷 폼 20회", "잽-어퍼 연결", "바디 어퍼컷"], focusB: ["잽-어퍼-훅 3타", "바디-헤드 전환", "어퍼 후 가드 복귀"],
      modules: [{ id: "b7-mod", title: "어퍼컷", keyPoints: ["무릎→골반→어깨 순서", "팔꿈치 직각 유지", "바디와 헤드 구분"], coachCues: ["아래서 올려", "무릎으로 시작"], commonMistakes: ["팔로만 올림", "바디/헤드 구분 없음"] }],
      reviews: [{ id: "b7-r1", title: "어퍼컷 20회", details: ["폼 정확도"], mandatory: true }, { id: "b7-r2", title: "상하 전환", details: ["바디→헤드 자연스러움"], mandatory: true }] },
    { lv: 8, title: "2~4타 콤비네이션 리듬", goal: "다양한 콤비네이션의 리듬을 만든다", values: ["콤비 다양성", "리듬감 완성", "자연스러운 연결"], tags: ["콤비", "리듬", "다양성", "연결"],
      focusA: ["2타 콤비 5종 × 10회", "3타 콤비 3종 × 10회", "4타 콤비 시도"], focusB: ["랜덤 큐 콤비", "샌드백 콤비 적용", "콤비 후 방어"],
      modules: [{ id: "b8-mod", title: "콤비네이션 리듬", keyPoints: ["2타→3타→4타 점진적 확장", "각 콤비의 리듬 특성 이해", "콤비 후 반드시 가드 복귀"], coachCues: ["리듬 유지해", "콤비 후 가드"], commonMistakes: ["콤비 중 리듬 깨짐", "콤비 후 멈춤"] }],
      reviews: [{ id: "b8-r1", title: "3타 이상 콤비 3종", details: ["리듬 유지"], mandatory: true }, { id: "b8-r2", title: "콤비 후 가드 복귀", details: ["즉시 복귀"], mandatory: true }] },
    { lv: 9, title: "샌드백·미트 적용", goal: "실제 타깃에 기술을 적용한다", values: ["임팩트 경험", "파워 전달 체험", "실전 감각 시작"], tags: ["샌드백", "미트", "임팩트", "적용"],
      focusA: ["샌드백 3분 라운드 × 2", "미트 3분 라운드 × 2", "콤비 적용"], focusB: ["파워 샷 연습", "임팩트 체크", "3분 페이싱"],
      modules: [{ id: "b9-mod", title: "타깃 적용", keyPoints: ["임팩트 시 주먹 조이기", "타깃 관통 느낌", "3분 라운드 페이싱"], coachCues: ["관통해", "주먹 조여"], commonMistakes: ["표면만 치기", "3분 못 버팀"] }],
      reviews: [{ id: "b9-r1", title: "샌드백 3분 × 2", details: ["3분 완주"], mandatory: true }, { id: "b9-r2", title: "미트 3분 × 2", details: ["코치 큐 반응"], mandatory: true }] },
    { lv: 10, title: "블루 마스터 / 레드 리그 승격", goal: "블루 리그 전체를 정리하고 레드 승격을 준비한다", values: ["블루 전체 복습", "레드 승격 자격", "기본기 숙련 확인"], tags: ["복습", "승격", "종합", "마스터"],
      focusA: ["블루 전 기술 종합 드릴", "3분 라운드 × 3", "종합 체크"], focusB: ["파트너 드릴 종합", "랜덤 큐 반응 테스트", "체크리스트 준비"],
      modules: [{ id: "b10-mod", title: "블루 마스터 종합", keyPoints: ["블루 전 기술 안정적 시연", "3분 라운드 3세트 완주", "파트너 드릴 적용"], coachCues: ["전체를 보여줘", "안정적으로"], commonMistakes: ["일부 기술만 시연", "체력 부족"] }],
      reviews: [{ id: "b10-r1", title: "블루 전 기술 종합", details: ["안정적 시연"], mandatory: true }, { id: "b10-r2", title: "3분 × 3 라운드", details: ["완주"], mandatory: true }, { id: "b10-r3", title: "코치 종합 판단", details: ["레드 승격 적합 여부"], mandatory: true }] },
  ];

  return levels.map(l => createFullLeagueLevel("blue", l.lv, 10 + l.lv, l.title, l.goal, l.values, l.tags, l.focusA, l.focusB, l.modules, l.reviews, l.lv === 10));
}

// ═══════════════════════════════════════════════════════
// RED LEAGUE (Levels 21–30)
// ═══════════════════════════════════════════════════════
function generateRedLeague(): UnifiedLevel[] {
  const levels: Array<{
    lv: number; title: string; goal: string; values: string[]; tags: string[];
    focusA: string[]; focusB: string[];
    modules: LearningModule[]; reviews: ReviewCriteria[];
  }> = [
    { lv: 1, title: "거리 감각 시작", goal: "상대와의 거리를 읽고 조절하기 시작한다", values: ["거리 감각 시작", "적정 거리 인식", "거리 기반 공격"], tags: ["거리", "감각", "조절", "읽기"],
      focusA: ["거리 측정 드릴", "적정 거리에서 잽", "거리 벗어날 때 인식"], focusB: ["파트너 거리 드릴", "거리별 공격 선택", "거리 유지 이동"],
      modules: [{ id: "r1-mod", title: "거리 감각", keyPoints: ["자신의 잽 거리 파악", "상대 거리 변화 읽기", "거리에 따른 공격 선택"], coachCues: ["거리 느껴봐", "잽 닿는 거리 확인"], commonMistakes: ["거리 무시하고 돌진", "너무 먼 거리에서 공격"] }],
      reviews: [{ id: "r1-r1", title: "거리 측정 드릴", details: ["적정 거리 인식"], mandatory: true }, { id: "r1-r2", title: "거리별 공격", details: ["거리에 맞는 공격"], mandatory: true }] },
    { lv: 2, title: "타이밍 감각", goal: "타이밍을 읽고 정확한 순간에 치는 감각을 기른다", values: ["타이밍 감각", "정확한 순간 인식", "카운터 타이밍"], tags: ["타이밍", "감각", "순간", "정확도"],
      focusA: ["타이밍 반응 드릴", "카운터 타이밍 연습", "파트너 리듬 읽기"], focusB: ["큐 반응 속도 훈련", "타이밍 변화 적응", "공격-방어 전환 타이밍"],
      modules: [{ id: "r2-mod", title: "타이밍", keyPoints: ["상대 리듬 읽기", "공격 순간 선택", "카운터 타이밍 연습"], coachCues: ["기다려", "지금!"], commonMistakes: ["타이밍 무시하고 연타", "카운터 너무 늦음"] }],
      reviews: [{ id: "r2-r1", title: "타이밍 드릴", details: ["큐 반응 정확도"], mandatory: true }, { id: "r2-r2", title: "카운터 타이밍", details: ["적절한 순간 카운터"], mandatory: true }] },
    { lv: 3, title: "방어 반응 속도", goal: "방어 반응 속도를 향상시킨다", values: ["반응 속도 향상", "방어 자동화", "카운터 기회 인식"], tags: ["방어", "반응", "속도", "카운터"],
      focusA: ["반응 방어 드릴", "랜덤 큐 슬립/패리", "방어→카운터 연결"], focusB: ["속도 증가 드릴", "파트너 랜덤 공격 방어", "방어 후 콤비"],
      modules: [{ id: "r3-mod", title: "방어 반응", keyPoints: ["시각 큐 인식 속도 향상", "슬립/패리/블록 선택", "방어 직후 카운터"], coachCues: ["눈으로 먼저 봐", "방어 후 바로 쳐"], commonMistakes: ["방어만 하고 카운터 안함", "과잉 반응"] }],
      reviews: [{ id: "r3-r1", title: "랜덤 방어 드릴", details: ["반응 속도"], mandatory: true }, { id: "r3-r2", title: "방어→카운터", details: ["연결 속도"], mandatory: true }] },
    { lv: 4, title: "각도 이동 적용", goal: "각도를 이용한 이동과 공격을 적용한다", values: ["각도 이동", "위치 우위", "측면 공격"], tags: ["각도", "이동", "적용", "위치"],
      focusA: ["피벗 후 공격", "각도 이동 드릴", "측면 잽-훅 연결"], focusB: ["45도 이동 후 콤비", "각도 변환 후 카운터", "파트너 각도 드릴"],
      modules: [{ id: "r4-mod", title: "각도 이동", keyPoints: ["피벗으로 각도 만들기", "측면에서 공격 기회", "이동 후 즉시 공격"], coachCues: ["각도 만들어", "측면으로 가"], commonMistakes: ["직선으로만 이동", "각도 이동 후 공격 안함"] }],
      reviews: [{ id: "r4-r1", title: "각도 이동 후 공격", details: ["피벗 → 공격 연결"], mandatory: true }, { id: "r4-r2", title: "위치 우위", details: ["측면 위치 확보"], mandatory: true }] },
    { lv: 5, title: "3분 라운드 적응", goal: "3분 라운드를 온전히 수행한다", values: ["라운드 체력", "페이스 조절", "지구력 향상"], tags: ["라운드", "체력", "페이스", "지구력"],
      focusA: ["3분 라운드 × 3", "페이스 조절 연습", "마지막 30초 집중"], focusB: ["3분 × 4 시도", "라운드별 전략 변화", "회복 속도 체크"],
      modules: [{ id: "r5-mod", title: "3분 라운드", keyPoints: ["처음 1분: 리듬 잡기", "중간 1분: 주력 기술", "마지막 1분: 마무리 집중"], coachCues: ["페이스 유지해", "마지막 30초 올려"], commonMistakes: ["처음에 너무 빠르게", "마지막에 체력 고갈"] }],
      reviews: [{ id: "r5-r1", title: "3분 × 3 라운드", details: ["완주"], mandatory: true }, { id: "r5-r2", title: "페이스 조절", details: ["일정한 강도 유지"], mandatory: true }] },
    { lv: 6, title: "콤비 변형", goal: "상황에 따라 콤비네이션을 변형한다", values: ["콤비 변형력", "상황 적응", "창의적 공격"], tags: ["콤비", "변형", "상황", "적응"],
      focusA: ["기본 콤비에서 변형", "상황별 콤비 선택", "변형 콤비 반복"], focusB: ["큐 기반 콤비 변형", "공격-방어 혼합 콤비", "자유 콤비 시간"],
      modules: [{ id: "r6-mod", title: "콤비 변형", keyPoints: ["기본 콤비에서 파생", "상황에 따른 선택", "자신만의 콤비 만들기"], coachCues: ["상황 봐서 바꿔", "기본에서 변형해"], commonMistakes: ["항상 같은 콤비만 사용", "변형이 비효율적"] }],
      reviews: [{ id: "r6-r1", title: "콤비 변형 3종", details: ["기본에서 변형 가능"], mandatory: true }, { id: "r6-r2", title: "상황별 선택", details: ["적절한 콤비 선택"], mandatory: true }] },
    { lv: 7, title: "파트너 드릴 적응", goal: "파트너와의 드릴에서 반응과 적응력을 키운다", values: ["파트너 적응", "반응 향상", "실전 감각"], tags: ["파트너", "드릴", "반응", "적응"],
      focusA: ["파트너 공격-방어 교대", "조건부 스파링 기초", "반응 드릴"], focusB: ["파트너 미트 고급", "조건부 반응 연습", "커뮤니케이션 드릴"],
      modules: [{ id: "r7-mod", title: "파트너 드릴", keyPoints: ["파트너 리듬에 적응", "반응-카운터 자동화", "안전한 강도 조절"], coachCues: ["파트너 봐", "반응해"], commonMistakes: ["파트너 무시하고 독주", "강도 조절 실패"] }],
      reviews: [{ id: "r7-r1", title: "파트너 드릴 3분 × 2", details: ["적응력"], mandatory: true }, { id: "r7-r2", title: "조건부 스파링", details: ["침착한 대응"], mandatory: true }] },
    { lv: 8, title: "제한 실전 침착함", goal: "제한된 실전 상황에서 침착하게 대응한다", values: ["실전 침착함", "멘탈 관리", "제한 상황 적응"], tags: ["실전", "침착", "제한", "멘탈"],
      focusA: ["조건부 스파링 3분 × 2", "잽 전용 스파링", "제한 공격 스파링"], focusB: ["방어 전용 스파링", "카운터 전용 스파링", "멘탈 체크"],
      modules: [{ id: "r8-mod", title: "실전 침착함", keyPoints: ["초조해하지 않기", "기본기 유지", "강도 조절 준수"], coachCues: ["침착하게", "기본기 유지"], commonMistakes: ["초조해서 난타", "기본기 무너짐"] }],
      reviews: [{ id: "r8-r1", title: "제한 스파링 3분 × 2", details: ["침착한 대응"], mandatory: true }, { id: "r8-r2", title: "강도 준수", details: ["규칙 내 유지"], mandatory: true }] },
    { lv: 9, title: "자기 약점 분석", goal: "자신의 약점을 분석하고 보완 방향을 설정한다", values: ["자기 분석", "약점 인식", "보완 계획"], tags: ["분석", "약점", "보완", "성찰"],
      focusA: ["영상 분석 or 코치 피드백", "약점 3가지 도출", "보완 드릴 설정"], focusB: ["약점 집중 드릴", "보완 확인 테스트", "자기 평가"],
      modules: [{ id: "r9-mod", title: "자기 분석", keyPoints: ["영상으로 자기 확인", "코치 피드백 수용", "보완 드릴 설정"], coachCues: ["어디가 약한지 봐", "보완 계획 세워"], commonMistakes: ["객관적 분석 안함", "약점 인정 안함"] }],
      reviews: [{ id: "r9-r1", title: "약점 3가지 도출", details: ["구체적 약점 명시"], mandatory: true }, { id: "r9-r2", title: "보완 드릴 수행", details: ["약점별 드릴 완료"], mandatory: true }] },
    { lv: 10, title: "레드 마스터 / 블랙 리그 승격", goal: "레드 리그 전체를 정리하고 블랙 승격을 준비한다", values: ["레드 전체 복습", "블랙 승격 자격", "적용 능력 확인"], tags: ["복습", "승격", "종합", "마스터"],
      focusA: ["레드 전 기술 종합", "조건부 스파링 종합", "체크리스트 준비"], focusB: ["파트너 드릴 종합", "자기 분석 발표", "코치 종합 심사"],
      modules: [{ id: "r10-mod", title: "레드 마스터 종합", keyPoints: ["거리-타이밍-방어-각도 종합", "조건부 스파링 안정적 수행", "자기 분석 및 보완 증명"], coachCues: ["전체를 보여줘", "안정적으로"], commonMistakes: ["일부만 시연", "실전 침착함 부족"] }],
      reviews: [{ id: "r10-r1", title: "종합 기술 시연", details: ["안정적 시연"], mandatory: true }, { id: "r10-r2", title: "조건부 스파링", details: ["침착한 수행"], mandatory: true }, { id: "r10-r3", title: "코치 종합 판단", details: ["블랙 승격 적합 여부"], mandatory: true }] },
  ];

  return levels.map(l => createFullLeagueLevel("red", l.lv, 20 + l.lv, l.title, l.goal, l.values, l.tags, l.focusA, l.focusB, l.modules, l.reviews, l.lv === 10));
}

// ═══════════════════════════════════════════════════════
// BLACK LEAGUE (Levels 31–40)
// ═══════════════════════════════════════════════════════
function generateBlackLeague(): UnifiedLevel[] {
  const levels: Array<{
    lv: number; title: string; goal: string; values: string[]; tags: string[];
    focusA: string[]; focusB: string[];
    modules: LearningModule[]; reviews: ReviewCriteria[];
  }> = [
    { lv: 1, title: "자세 설명하기", goal: "기본 자세를 다른 사람에게 설명할 수 있다", values: ["설명력 시작", "코칭 기초", "자세 완전 이해"], tags: ["설명", "자세", "코칭", "전달"],
      focusA: ["자세 설명 연습", "초보자에게 가르치기", "키포인트 정리"], focusB: ["설명 → 시범 → 교정 흐름", "질문 대응 연습", "1분 설명 연습"],
      modules: [{ id: "bk1-mod", title: "자세 설명", keyPoints: ["핵심 3가지로 요약", "시범 → 설명 → 교정 순서", "초보자 눈높이 맞추기"], coachCues: ["쉽게 설명해봐", "핵심만"], commonMistakes: ["너무 복잡하게 설명", "시범 없이 말로만"] }],
      reviews: [{ id: "bk1-r1", title: "자세 설명 1분", details: ["핵심 포인트 포함"], mandatory: true }, { id: "bk1-r2", title: "시범 포함", details: ["설명+시범 결합"], mandatory: true }] },
    { lv: 2, title: "기본 펀치 설명하기", goal: "기본 펀치를 체계적으로 설명할 수 있다", values: ["펀치 설명력", "체계적 전달", "교정 포인트"], tags: ["펀치", "설명", "체계", "코칭"],
      focusA: ["잽/카운터/훅/어퍼 설명", "교정 포인트 정리", "흔한 실수 설명"], focusB: ["4가지 펀치 각 1분 설명", "실수 교정 시범", "Q&A 대응"],
      modules: [{ id: "bk2-mod", title: "펀치 설명", keyPoints: ["각 펀치의 핵심 3가지", "흔한 실수와 교정법", "순서: 설명→시범→교정"], coachCues: ["각각 핵심 3개", "실수도 설명해"], commonMistakes: ["핵심 없이 장황하게", "교정법 빠짐"] }],
      reviews: [{ id: "bk2-r1", title: "4가지 펀치 설명", details: ["각 1분"], mandatory: true }, { id: "bk2-r2", title: "교정 포인트", details: ["실수별 교정법"], mandatory: true }] },
    { lv: 3, title: "강도 조절과 안전", goal: "훈련 강도를 조절하고 안전을 관리한다", values: ["강도 조절", "안전 관리", "리스크 인식"], tags: ["강도", "조절", "안전", "관리"],
      focusA: ["RPE 설명 및 적용", "안전 체크리스트 연습", "부상 예방 동작"], focusB: ["강도 단계별 시범", "위험 상황 대응", "안전 커뮤니케이션"],
      modules: [{ id: "bk3-mod", title: "강도와 안전", keyPoints: ["RPE 스케일 이해 및 적용", "워밍업/쿨다운 중요성", "부상 징후 인식 및 대응"], coachCues: ["강도 확인해", "안전 먼저"], commonMistakes: ["강도 무시", "안전 체크 생략"] }],
      reviews: [{ id: "bk3-r1", title: "RPE 적용 설명", details: ["실제 적용 시범"], mandatory: true }, { id: "bk3-r2", title: "안전 체크리스트", details: ["주요 항목 숙지"], mandatory: true }] },
    { lv: 4, title: "잘못된 폼 관찰하기", goal: "잘못된 폼을 관찰하고 교정 포인트를 찾는다", values: ["관찰력", "교정 능력", "분석적 시선"], tags: ["관찰", "교정", "폼", "분석"],
      focusA: ["영상 속 오류 찾기", "교정 우선순위 정하기", "1가지씩 교정"], focusB: ["라이브 관찰 연습", "교정 피드백 연습", "긍정-교정 균형"],
      modules: [{ id: "bk4-mod", title: "폼 관찰", keyPoints: ["가장 큰 오류 1개 먼저", "긍정 피드백 먼저 → 교정", "관찰 → 분석 → 피드백 순서"], coachCues: ["가장 큰 문제 1개만", "긍정 먼저"], commonMistakes: ["한꺼번에 여러 개 교정", "부정적 피드백만"] }],
      reviews: [{ id: "bk4-r1", title: "오류 관찰 테스트", details: ["3가지 오류 도출"], mandatory: true }, { id: "bk4-r2", title: "교정 피드백", details: ["긍정-교정 균형"], mandatory: true }] },
    { lv: 5, title: "초보자 루틴 설계", goal: "초보자를 위한 기본 루틴을 설계한다", values: ["루틴 설계", "프로그래밍 기초", "레벨 맞춤"], tags: ["루틴", "설계", "초보자", "프로그래밍"],
      focusA: ["50분 루틴 설계", "블록별 시간 배분", "강도 조절 포함"], focusB: ["설계한 루틴 시범", "동료 피드백 수렴", "루틴 수정"],
      modules: [{ id: "bk5-mod", title: "루틴 설계", keyPoints: ["워밍업→메인→쿨다운 구조", "초보자 체력 고려", "점진적 난이도 설계"], coachCues: ["초보자 눈높이로", "50분 구성해봐"], commonMistakes: ["너무 어렵게 설계", "시간 배분 불균형"] }],
      reviews: [{ id: "bk5-r1", title: "50분 루틴 설계", details: ["구조와 시간 배분"], mandatory: true }, { id: "bk5-r2", title: "루틴 시범", details: ["실제 수행 가능한 수준"], mandatory: true }] },
    { lv: 6, title: "라운드 운영과 페이스 조절", goal: "라운드를 전략적으로 운영한다", values: ["라운드 운영", "전략적 페이스", "체력 관리"], tags: ["라운드", "운영", "전략", "페이스"],
      focusA: ["3분 라운드 전략 설정", "라운드별 강도 변화", "페이스 분석"], focusB: ["5라운드 운영 연습", "전략적 체력 분배", "라운드 복기"],
      modules: [{ id: "bk6-mod", title: "라운드 운영", keyPoints: ["라운드별 목표 설정", "체력 분배 전략", "마지막 라운드 집중"], coachCues: ["전략적으로 운영해", "체력 분배해"], commonMistakes: ["매 라운드 전력", "전략 없이 진행"] }],
      reviews: [{ id: "bk6-r1", title: "5라운드 전략 수립", details: ["라운드별 목표"], mandatory: true }, { id: "bk6-r2", title: "전략적 수행", details: ["계획대로 운영"], mandatory: true }] },
    { lv: 7, title: "영상 기반 자기 분석", goal: "영상을 보고 자신의 기술을 분석한다", values: ["영상 분석", "자기 객관화", "개선점 도출"], tags: ["영상", "분석", "자기평가", "피드백"],
      focusA: ["자기 영상 촬영 및 분석", "강점/약점 3가지씩", "개선 계획"], focusB: ["분석 결과 발표", "코치 피드백 비교", "개선 드릴 수행"],
      modules: [{ id: "bk7-mod", title: "영상 분석", keyPoints: ["객관적 시선으로 보기", "강점/약점 균형 분석", "구체적 개선 계획"], coachCues: ["객관적으로 봐", "강점도 찾아"], commonMistakes: ["약점만 보기", "추상적 분석"] }],
      reviews: [{ id: "bk7-r1", title: "영상 분석 리포트", details: ["강점/약점 각 3가지"], mandatory: true }, { id: "bk7-r2", title: "개선 계획", details: ["구체적 드릴 포함"], mandatory: true }] },
    { lv: 8, title: "짧고 정확한 피드백", goal: "짧고 효과적인 피드백을 줄 수 있다", values: ["피드백 스킬", "효과적 소통", "코칭 커뮤니케이션"], tags: ["피드백", "정확", "효과", "코칭"],
      focusA: ["30초 피드백 연습", "긍정-교정-격려 구조", "동료 피드백 연습"], focusB: ["라이브 피드백 연습", "다양한 레벨 대응", "피드백 복기"],
      modules: [{ id: "bk8-mod", title: "피드백 스킬", keyPoints: ["30초 이내 핵심 전달", "긍정 → 교정 → 격려 구조", "레벨에 맞는 언어 선택"], coachCues: ["30초 안에", "핵심만 전달해"], commonMistakes: ["장황한 피드백", "부정적 피드백만"] }],
      reviews: [{ id: "bk8-r1", title: "30초 피드백 3회", details: ["핵심 전달"], mandatory: true }, { id: "bk8-r2", title: "긍정-교정-격려", details: ["구조 준수"], mandatory: true }] },
    { lv: 9, title: "미니 클래스 리드", goal: "작은 그룹을 이끌고 수업을 진행한다", values: ["클래스 리드", "그룹 관리", "진행 능력"], tags: ["리드", "클래스", "진행", "코칭"],
      focusA: ["15분 미니 클래스 설계", "2~3명 그룹 리드", "피드백 포함 진행"], focusB: ["미니 클래스 수행", "코치 관찰 및 피드백", "개선점 반영"],
      modules: [{ id: "bk9-mod", title: "미니 클래스", keyPoints: ["15분 구성: 설명→시범→실습→피드백", "그룹 전체와 개인 균형", "안전 관리 포함"], coachCues: ["자연스럽게 이끌어", "전체를 봐"], commonMistakes: ["한 명에만 집중", "시간 관리 실패"] }],
      reviews: [{ id: "bk9-r1", title: "미니 클래스 15분", details: ["완료"], mandatory: true }, { id: "bk9-r2", title: "피드백 포함", details: ["개인 피드백 제공"], mandatory: true }] },
    { lv: 10, title: "블랙 마스터 / 자기훈련 + 초급코칭", goal: "자기 훈련과 초급 코칭을 동시에 수행한다", values: ["마스터 달성", "자기훈련 완성", "코칭 기초 완성"], tags: ["마스터", "자기훈련", "코칭", "종합"],
      focusA: ["자기 훈련 루틴 수행", "초급자 코칭 30분", "종합 심사 준비"], focusB: ["코칭 루틴 수행", "자기 분석 발표", "코치 종합 심사"],
      modules: [{ id: "bk10-mod", title: "블랙 마스터 종합", keyPoints: ["자기 훈련 자율 설계", "초급자 30분 수업 리드", "코칭과 자기훈련 균형"], coachCues: ["모든 것을 보여줘"], commonMistakes: ["코칭에만 집중", "자기 훈련 소홀"] }],
      reviews: [{ id: "bk10-r1", title: "자기 훈련 루틴", details: ["자율 설계 및 수행"], mandatory: true }, { id: "bk10-r2", title: "초급자 코칭 30분", details: ["수업 리드 완료"], mandatory: true }, { id: "bk10-r3", title: "코치 종합 판단", details: ["블랙 마스터 인정 여부"], mandatory: true }] },
  ];

  return levels.map(l => createFullLeagueLevel("black", l.lv, 30 + l.lv, l.title, l.goal, l.values, l.tags, l.focusA, l.focusB, l.modules, l.reviews, l.lv === 10));
}

// ─── Full league level creator ───
function createFullLeagueLevel(
  league: "blue" | "red" | "black",
  levelInLeague: number,
  globalLevel: number,
  title: string,
  shortGoal: string,
  valueGained: string[],
  coachTags: string[],
  focusA: string[],
  focusB: string[],
  learningModules: LearningModule[],
  reviewCriteria: ReviewCriteria[],
  isBoss: boolean,
): UnifiedLevel {
  // 3-day baseline, boss levels stricter
  const baseSessions = isBoss ? 5 : 3;
  const baseDays = isBoss ? 5 : 3;
  const baseMinutes = isBoss ? 250 : 150;
  const baseXp = isBoss ? 500 : 300;

  return {
    globalLevel,
    league,
    levelInLeague,
    title,
    shortGoal,
    valueGained,
    routineA: [
      r("워밍업", "🔥", 5, ["조깅", "동적 스트레칭", "가동성 운동"]),
      r("줄넘기/리듬", "🪢", 5, ["복서 스텝", "리듬 변화"]),
      r("메인 기술 A", "🥊", 18, focusA),
      r("체력/근력", "🦵", 7, ["스쿼트 20회", "버피 5회", "플랭크 45초"]),
      r("마무리", "🧘", 3, ["쿨다운", "리뷰"]),
    ],
    routineB: [
      r("워밍업", "🔥", 5, ["조깅", "밴드 운동"]),
      r("줄넘기/리듬", "🪢", 5, ["고급 스텝"]),
      r("메인 기술 B", "🥊", 18, focusB),
      r("체력/근력", "🦵", 7, ["런지 12회씩", "마운틴 클라이머 30초"]),
      r("마무리", "🧘", 3, ["쿨다운"]),
    ],
    checklistFocus: coachTags.slice(0, 4).map(t => `${t} 확인`),
    progressionConfig: {
      minXp: baseXp,
      minSessions: baseSessions,
      minDays: baseDays,
      minMinutes: baseMinutes,
      checklistPassCount: isBoss ? 3 : 2,
      mandatoryItems: [0, 1],
    },
    coachTags,
    learningModules,
    reviewCriteria,
    illustrationMeta: { title, brief: shortGoal, prompt: `${league} league boxing training: ${title}` },
    completionMode: league === "black" && levelInLeague >= 5 ? "admin_required" as const :
                    isBoss ? "coach_required" as const : "self_or_coach" as const,
  };
}

// ═══════════════════════════════════════════════════════
// COMBINED 40-LEVEL EXPORT
// ═══════════════════════════════════════════════════════
export const ALL_LEVELS: UnifiedLevel[] = [
  ...WHITE_LEVELS,
  ...generateBlueLeague(),
  ...generateRedLeague(),
  ...generateBlackLeague(),
];

// ─── Lookup helpers ───
export function getLevelByGlobal(globalLevel: number): UnifiedLevel | undefined {
  return ALL_LEVELS.find(l => l.globalLevel === globalLevel);
}

export function getLevelById(league: string, levelInLeague: number): UnifiedLevel | undefined {
  return ALL_LEVELS.find(l => l.league === league && l.levelInLeague === levelInLeague);
}

export function getLevelsForLeague(league: string): UnifiedLevel[] {
  return ALL_LEVELS.filter(l => l.league === league);
}

export function getGlobalLevel(league: string, levelInLeague: number): number {
  const leagueOffset: Record<string, number> = { white: 0, blue: 10, red: 20, black: 30 };
  return (leagueOffset[league] || 0) + levelInLeague;
}

// ─── Daily participation types ───
export type ParticipationMode = "self_challenge" | "coach_backup" | "partial" | "needs_review" | "not_completed";
export type DailyValidationStatus = "valid_self_challenge" | "valid_coach_backup" | "partial_completion" | "needs_review" | "not_completed";

export interface DailyParticipation {
  date: string;
  levelId: string;
  globalLevel: number;
  mode: ParticipationMode;
  startedAt: string | null;
  finishedAt: string | null;
  actualMinutes: number;
  xpAwarded: number;
  bonusXp: number;
  coachStatus: string | null;
  coachTags: string[];
  selfChallengeStreak: number;
}

export const SELF_CHALLENGE_BONUS_XP = 20;

export const COACH_QUICK_TAGS = [
  "가드", "잽", "카운터", "원투", "피벗", "스텝",
  "체력", "자세 복구", "더킹", "위빙",
  "콤비", "거리", "타이밍", "설명력",
];

export const COACH_QUICK_ACTIONS = [
  { id: "complete", label: "완료", emoji: "✅", color: "bg-status-complete" },
  { id: "partial", label: "부분 완료", emoji: "⚠️", color: "bg-status-pending" },
  { id: "needs_review", label: "보완 필요", emoji: "🔄", color: "bg-destructive/80" },
  { id: "levelup_check", label: "레벨업 체크", emoji: "⬆️", color: "bg-primary" },
  { id: "promotion_check", label: "리그 승격 체크", emoji: "🏆", color: "bg-reward" },
] as const;
