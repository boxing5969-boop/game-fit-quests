// ═══════════════════════════════════════════════════════
// 40-Level Unified Data Structure
// All levels 1~40 across White/Blue/Red/Black leagues
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
}

export interface HomeMission {
  id: string;
  title: string;
  description: string;
  emoji: string;
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
  homeMissionOptions: HomeMission[];
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
  illustrationMeta: { title: string; brief: string; prompt: string };
  completionMode: "self_or_coach" | "coach_required" | "admin_required";
}

// ─── Helper to create routine blocks ───
function r(title: string, emoji: string, dur: number, drills: string[]): RoutineBlock {
  return { title, emoji, durationMin: dur, drills };
}

// ═══════════════════════════════════════════════════════
// WHITE LEAGUE (Levels 1–10)
// ═══════════════════════════════════════════════════════
const WHITE_LEVELS: UnifiedLevel[] = [
  {
    globalLevel: 1, league: "white", levelInLeague: 1,
    title: "스탠스·가드·잽 입문",
    shortGoal: "기본 자세를 잡고 첫 잽을 배우며 기초체력과 리듬을 만든다",
    valueGained: ["운동을 시작하는 정체성 형성", "기본 자세와 가드 인식", "첫 잽 경험", "수업을 끝까지 해내는 경험", "기초체력과 리듬 시작"],
    routineA: [
      r("워밍업", "🔥", 5, ["발목 바운스", "제자리 마칭", "어깨 돌리기", "에어 스쿼트 10회"]),
      r("줄넘기", "🪢", 5, ["기본 바운스 2분", "액티브 레스트 1분", "복서 스텝 2분"]),
      r("스탠스·가드", "🪞", 10, ["가드 자세 정렬 2분", "제자리 스텝 3분", "좌우 중심 이동 3분", "스탠스 정지 → 스텝 2분"]),
      r("하체 기초", "🦵", 7, ["스쿼트 15회", "카프 레이즈 20회", "플랭크 30초"]),
      r("마무리", "🧘", 3, ["호흡 정리", "오늘 포인트 체크"]),
    ],
    routineB: [
      r("워밍업", "🔥", 5, ["발목 바운스", "힙 오픈/클로즈", "어깨 돌리기"]),
      r("줄넘기/리듬", "🪢", 5, ["기본 바운스 2분", "라인 홉 2분"]),
      r("잽 입문", "👊", 10, ["잽 폼 설명", "거울 앞 잽 20회", "잽 후 가드 복귀 10회"]),
      r("타깃 터치", "🎯", 8, ["제자리 잽 20회", "타깃 터치 잽 20회"]),
      r("하체/코어", "🦵", 7, ["리버스 런지 8회씩", "카프 레이즈 20회", "플랭크 30초"]),
      r("마무리", "🧘", 3, ["호흡 정리"]),
    ],
    homeMissionOptions: [
      { id: "guard-hold", title: "2분 가드 유지 영상", description: "가드 자세를 2분간 유지하며 촬영", emoji: "🛡️" },
      { id: "jab-20", title: "잽 20회 영상", description: "거울 앞에서 잽 20회 정확하게 수행", emoji: "👊" },
    ],
    checklistFocus: ["가드 자세 60초 유지", "잽 20회 정확도", "제자리 스텝 2분", "하체 기초체력"],
    progressionConfig: { minXp: 500, minSessions: 5, minDays: 5, minMinutes: 250, checklistPassCount: 5, mandatoryItems: [0, 3] },
    coachTags: ["가드", "잽", "스텝", "체력", "자세 복구"],
    learningModules: [
      { id: "stance-guard", title: "기본 스탠스와 가드", keyPoints: ["발은 어깨너비", "체중 균등", "손은 얼굴 높이에서 턱 보호"] },
      { id: "jab-intro", title: "잽 첫 동작", keyPoints: ["앞손을 직선으로 뻗기", "어깨로 턱 보호", "손 빠르게 복귀"] },
    ],
    illustrationMeta: { title: "첫 잽", brief: "스탠스와 가드를 잡고 첫 잽을 내미는 복서", prompt: "Beginner boxer in proper stance throwing first jab, boxing gym background, warm lighting" },
    completionMode: "self_or_coach",
  },
  {
    globalLevel: 2, league: "white", levelInLeague: 2,
    title: "전진·후진 스텝과 잽 반복",
    shortGoal: "움직이면서 자세를 유지하고 잽을 반복한다",
    valueGained: ["전진/후진 스텝 기초", "잽 품질 향상", "움직임 속 자세 유지", "가드 복귀 습관 강화"],
    routineA: [
      r("워밍업", "🔥", 5, ["발목 바운스", "어깨/골반 가동성", "에어 스쿼트 10회"]),
      r("줄넘기", "🪢", 5, ["기본 바운스 2분", "복서 스텝 2분"]),
      r("전진/후진 스텝", "🪞", 10, ["전진 2분", "후진 2분", "혼합 2분", "이동 후 스탠스 복구 2분"]),
      r("하체 기초", "🦵", 7, ["스쿼트 15회", "스플릿 스쿼트 홀드 20초", "플랭크 30초"]),
      r("마무리", "🧘", 3, ["호흡 정리"]),
    ],
    routineB: [
      r("워밍업", "🔥", 5, ["제자리 마칭", "어깨 돌리기"]),
      r("줄넘기/리듬", "🪢", 5, ["기본 바운스", "이키 셔플"]),
      r("전진 잽", "👊", 10, ["전진 잽 10회", "후진 후 가드 복귀 10회", "더블 잽 기초"]),
      r("하체/가드 유지", "🦵", 7, ["카프 레이즈 20회", "가드 자세 정지"]),
      r("마무리", "🧘", 3, ["호흡 정리"]),
    ],
    homeMissionOptions: [
      { id: "forward-jab", title: "전진 잽 10회 영상", description: "전진 후 잽 10회 정확하게", emoji: "👊" },
      { id: "back-guard", title: "후진 후 가드 복귀 10회", description: "후진 스텝 후 가드 복귀 반복", emoji: "🛡️" },
    ],
    checklistFocus: ["전진·후진 스텝 2분", "잽 30회 정확도", "전진 잽 + 후진 복귀", "더블 잽"],
    progressionConfig: { minXp: 600, minSessions: 6, minDays: 5, minMinutes: 300, checklistPassCount: 5, mandatoryItems: [0, 3], additionalRules: { movementJabBlockMinSessions: 4 } },
    coachTags: ["스텝", "잽", "가드 복귀", "더블 잽", "자세 복구"],
    learningModules: [
      { id: "forward-back", title: "전진·후진 스텝 기초", keyPoints: ["앞발 먼저 → 뒷발 따라감", "발 교차 없이", "이동 후 스탠스 복구"] },
      { id: "jab-movement", title: "잽 + 이동 연결", keyPoints: ["전진 잽", "후진 후 가드 복귀", "속도보다 정렬 유지"] },
    ],
    illustrationMeta: { title: "이동 잽", brief: "전진하며 잽을 뻗는 복서", prompt: "Boxer stepping forward throwing jab, side view, boxing gym" },
    completionMode: "self_or_coach",
  },
  {
    globalLevel: 3, league: "white", levelInLeague: 3,
    title: "사이드 스텝과 잽 안정화",
    shortGoal: "좌우로 움직이면서 자세를 유지하고 잽을 더 안정적으로 쓴다",
    valueGained: ["사이드 스텝 기초", "잽 안정성 향상", "좌우 이동 후 정지", "균형감 향상"],
    routineA: [
      r("워밍업", "🔥", 5, ["발목 바운스", "어깨/골반 가동성"]),
      r("줄넘기/리듬", "🪢", 5, ["기본 바운스", "사이드 스텝 점프"]),
      r("사이드 스텝", "🪞", 10, ["사이드 스텝 좌 2분", "사이드 스텝 우 2분", "좌우 혼합 3분", "이동 후 정지 3분"]),
      r("하체/균형", "🦵", 7, ["사이드 런지 10회씩", "싱글 레그 밸런스 30초씩"]),
      r("마무리", "🧘", 3, ["호흡 정리"]),
    ],
    routineB: [
      r("워밍업", "🔥", 5, ["제자리 마칭", "힙 오픈/클로즈"]),
      r("줄넘기/리듬", "🪢", 5, ["복서 스텝"]),
      r("사이드 이동 후 잽", "👊", 10, ["사이드 이동 후 잽 10회", "더블 잽 10회", "잽 후 사이드 아웃"]),
      r("잽 복귀", "🎯", 8, ["잽 복귀 연습 20회", "속도보다 정확도"]),
      r("하체/코어", "🦵", 7, ["스쿼트 15회", "플랭크 30초"]),
      r("마무리", "🧘", 3, ["호흡 정리"]),
    ],
    homeMissionOptions: [
      { id: "side-step", title: "사이드 스텝 2분 영상", description: "좌우 사이드 스텝 2분 유지", emoji: "🦶" },
      { id: "side-jab", title: "사이드 이동 후 잽 10회", description: "이동 후 잽 정확히 수행", emoji: "👊" },
    ],
    checklistFocus: ["사이드 스텝 2분", "사이드 이동 후 잽", "더블 잽", "균형 유지"],
    progressionConfig: { minXp: 600, minSessions: 6, minDays: 5, minMinutes: 300, checklistPassCount: 5, mandatoryItems: [0, 2], additionalRules: { sideStepJabBlockMinSessions: 4 } },
    coachTags: ["사이드 스텝", "잽", "균형", "가드", "더블 잽"],
    learningModules: [
      { id: "side-step", title: "사이드 스텝 기초", keyPoints: ["좌우 이동 시 발 교차 없이", "이동 후 정지 → 스탠스 복구", "상체 과도한 흔들림 없이"] },
      { id: "jab-stability", title: "잽 안정화", keyPoints: ["사이드 이동 후 잽", "더블 잽 리듬", "잽 후 사이드 아웃"] },
    ],
    illustrationMeta: { title: "사이드 무브", brief: "사이드 스텝 후 잽을 던지는 복서", prompt: "Boxer doing side step and throwing jab, dynamic angle, boxing gym" },
    completionMode: "self_or_coach",
  },
  // White 4~10: structured but concise
  ...generateWhite4to10(),
];

function generateWhite4to10(): UnifiedLevel[] {
  const levels: Array<{ lv: number; title: string; goal: string; values: string[]; tags: string[]; focusA: string[]; focusB: string[]; checklist: string[] }> = [
    { lv: 4, title: "잽 리듬과 거리 감각", goal: "잽의 리듬과 거리 감각을 만든다", values: ["잽 리듬 형성", "거리 감각 시작", "템포 조절"], tags: ["잽", "리듬", "거리", "템포"], focusA: ["줄넘기 리듬", "잽 템포 변화", "거리 조절 연습"], focusB: ["잽 리듬 드릴", "거리 측정 연습", "빠른 잽 vs 느린 잽"], checklist: ["잽 리듬 2분 유지", "거리 조절 잽 10회", "템포 변화 잽"] },
    { lv: 5, title: "가드 복귀와 기본 방어", goal: "공격 후 가드로 돌아오는 습관을 만든다", values: ["가드 복귀 자동화", "기본 방어 인식", "안전한 복싱 습관"], tags: ["가드", "방어", "복귀", "안전"], focusA: ["가드 복귀 드릴", "슬립/숙이기 기초", "방어 후 잽"], focusB: ["가드 복귀 20회", "기본 방어 동작", "방어 → 잽 연결"], checklist: ["가드 복귀 연속 20회", "슬립 기초", "방어 후 잽 10회"] },
    { lv: 6, title: "리드 훅 입문", goal: "리드 훅의 기본 폼을 배운다", values: ["리드 훅 첫 경험", "회전력 기초", "잽-훅 연결 시작"], tags: ["리드 훅", "회전", "콤비", "가드"], focusA: ["리드 훅 폼", "회전 연습", "잽-훅 연결 기초"], focusB: ["리드 훅 느리게 20회", "잽-훅 10회", "훅 후 가드 복귀"], checklist: ["리드 훅 20회 정확도", "잽-훅 연결 10회", "훅 후 가드 복귀"] },
    { lv: 7, title: "어퍼컷 입문과 상하 리듬", goal: "어퍼컷을 배우고 상하 공격 리듬을 만든다", values: ["어퍼컷 첫 경험", "상하 리듬 형성", "공격 다양성 시작"], tags: ["어퍼컷", "상하", "리듬", "콤비"], focusA: ["어퍼컷 폼", "상하 리듬 연습", "바디-헤드 전환"], focusB: ["어퍼컷 20회", "잽-어퍼 10회", "상하 콤비 기초"], checklist: ["어퍼컷 20회 정확도", "상하 리듬 유지", "잽-어퍼 연결"] },
    { lv: 8, title: "기본 콤비네이션 연결", goal: "2~3타 기본 콤비네이션을 연결한다", values: ["기본 콤비 숙달", "리듬감 향상", "자연스러운 연결"], tags: ["콤비", "리듬", "연결", "스피드"], focusA: ["잽-스트레이트", "잽-훅", "잽-어퍼"], focusB: ["2타 콤비 반복", "3타 콤비 기초", "콤비 후 가드"], checklist: ["잽-스트레이트 10회", "잽-훅 10회", "3타 콤비 시도"] },
    { lv: 9, title: "파트너 반응과 기초 실전 감각", goal: "파트너와 함께 반응하며 기초 실전 감각을 기른다", values: ["파트너 반응 경험", "실전 감각 시작", "타이밍 인식"], tags: ["파트너", "반응", "타이밍", "실전"], focusA: ["미트 워크", "파트너 드릴 기초", "반응 잽"], focusB: ["미트 잡기 기초", "큐에 반응하기", "가벼운 스파링 준비"], checklist: ["미트 드릴 2분", "큐 반응 잽 10회", "파트너 드릴 완료"] },
    { lv: 10, title: "화이트 마스터 체크 / 블루 리그 승격 준비", goal: "화이트 리그 전체를 정리하고 블루 승격을 준비한다", values: ["화이트 전체 복습", "블루 승격 자격", "기초 완성 확인"], tags: ["복습", "승격", "종합", "체크"], focusA: ["화이트 전 기술 복습", "종합 드릴", "체력 테스트"], focusB: ["잽-훅-어퍼 종합", "스텝 종합", "체크리스트 준비"], checklist: ["전 기술 종합 시연", "체력 기준 충족", "코치 승격 심사"] },
  ];

  return levels.map(l => ({
    globalLevel: l.lv,
    league: "white" as const,
    levelInLeague: l.lv,
    title: l.title,
    shortGoal: l.goal,
    valueGained: l.values,
    routineA: [
      r("워밍업", "🔥", 5, ["발목 바운스", "어깨 가동성"]),
      r("줄넘기/리듬", "🪢", 5, ["기본 바운스 2분", "복서 스텝 2분"]),
      r("메인 기술", "🥊", 15, l.focusA),
      r("하체/코어", "🦵", 7, ["스쿼트 15회", "플랭크 30초"]),
      r("마무리", "🧘", 3, ["호흡 정리"]),
    ],
    routineB: [
      r("워밍업", "🔥", 5, ["제자리 마칭", "힙 오픈/클로즈"]),
      r("줄넘기/리듬", "🪢", 5, ["복서 스텝"]),
      r("메인 기술", "🥊", 15, l.focusB),
      r("하체/코어", "🦵", 7, ["런지 10회씩", "카프 레이즈 20회"]),
      r("마무리", "🧘", 3, ["호흡 정리"]),
    ],
    homeMissionOptions: [
      { id: `w${l.lv}-home1`, title: `${l.title} 연습 영상`, description: "핵심 동작 1분 영상 촬영", emoji: "📹" },
      { id: `w${l.lv}-home2`, title: "가드 유지 2분", description: "가드 자세 2분 유지", emoji: "🛡️" },
    ],
    checklistFocus: l.checklist,
    progressionConfig: {
      minXp: l.lv <= 5 ? 500 + (l.lv - 1) * 100 : 600 + (l.lv - 5) * 50,
      minSessions: l.lv <= 5 ? 5 : 6,
      minDays: 5,
      minMinutes: 250 + (l.lv - 1) * 25,
      checklistPassCount: l.lv === 10 ? 6 : 5,
      mandatoryItems: [0, 2],
    },
    coachTags: l.tags,
    learningModules: [
      { id: `w${l.lv}-mod`, title: l.title, keyPoints: l.values.slice(0, 3) },
    ],
    illustrationMeta: { title: l.title, brief: l.goal, prompt: `Boxing training ${l.title}, gym setting` },
    completionMode: l.lv === 10 ? "coach_required" as const : "self_or_coach" as const,
  }));
}

// ═══════════════════════════════════════════════════════
// BLUE LEAGUE (Levels 11–20)
// ═══════════════════════════════════════════════════════
function generateBlueLeague(): UnifiedLevel[] {
  const levels = [
    { lv: 1, title: "움직이며 자세 유지", goal: "이동 중 기본 자세를 유지하는 능력을 키운다", tags: ["자세", "이동", "유지", "균형"] },
    { lv: 2, title: "잽 마스터리", goal: "잽의 정확도, 속도, 리듬을 높인다", tags: ["잽", "정확도", "속도", "리듬"] },
    { lv: 3, title: "스트레이트 회전 입문", goal: "스트레이트의 회전력과 체중 이동을 배운다", tags: ["스트레이트", "회전", "체중이동", "파워"] },
    { lv: 4, title: "1-2 연결", goal: "잽-스트레이트를 자연스럽게 연결한다", tags: ["1-2", "콤비", "리듬", "연결"] },
    { lv: 5, title: "공격 후 복귀와 방어", goal: "공격 후 안전하게 돌아오는 습관을 강화한다", tags: ["복귀", "방어", "안전", "습관"] },
    { lv: 6, title: "리드 훅 정교화", goal: "리드 훅의 정교함과 파워를 높인다", tags: ["리드 훅", "정교화", "파워", "각도"] },
    { lv: 7, title: "어퍼컷 정교화", goal: "어퍼컷의 정확도와 타이밍을 향상시킨다", tags: ["어퍼컷", "정확도", "타이밍", "바디"] },
    { lv: 8, title: "2~4타 콤비네이션 리듬", goal: "다양한 콤비네이션의 리듬을 만든다", tags: ["콤비", "리듬", "다양성", "연결"] },
    { lv: 9, title: "샌드백/미트 적용", goal: "실제 타깃에 기술을 적용한다", tags: ["샌드백", "미트", "임팩트", "적용"] },
    { lv: 10, title: "블루 마스터 체크 / 레드 리그 승격 준비", goal: "블루 리그 전체를 정리하고 레드 승격을 준비한다", tags: ["복습", "승격", "종합", "마스터"] },
  ];

  return levels.map((l, i) => createLeagueLevel("blue", l.lv, 10 + l.lv, l.title, l.goal, l.tags, l.lv === 10));
}

// ═══════════════════════════════════════════════════════
// RED LEAGUE (Levels 21–30)
// ═══════════════════════════════════════════════════════
function generateRedLeague(): UnifiedLevel[] {
  const levels = [
    { lv: 1, title: "거리 감각 시작", goal: "상대와의 거리를 읽고 조절하기 시작한다", tags: ["거리", "감각", "조절", "읽기"] },
    { lv: 2, title: "타이밍 감각", goal: "타이밍을 읽고 정확한 순간에 치는 감각을 기른다", tags: ["타이밍", "감각", "순간", "정확도"] },
    { lv: 3, title: "방어 반응 속도", goal: "방어 반응 속도를 향상시킨다", tags: ["방어", "반응", "속도", "카운터"] },
    { lv: 4, title: "각도 이동 적용", goal: "각도를 이용한 이동과 공격을 적용한다", tags: ["각도", "이동", "적용", "위치"] },
    { lv: 5, title: "3분 라운드 적응", goal: "3분 라운드를 온전히 수행한다", tags: ["라운드", "체력", "페이스", "지구력"] },
    { lv: 6, title: "콤비 변형", goal: "상황에 따라 콤비네이션을 변형한다", tags: ["콤비", "변형", "상황", "적응"] },
    { lv: 7, title: "파트너 드릴 적응", goal: "파트너와의 드릴에서 반응과 적응력을 키운다", tags: ["파트너", "드릴", "반응", "적응"] },
    { lv: 8, title: "제한 실전 침착함", goal: "제한된 실전 상황에서 침착하게 대응한다", tags: ["실전", "침착", "제한", "멘탈"] },
    { lv: 9, title: "자기 약점 분석", goal: "자신의 약점을 분석하고 보완 방향을 설정한다", tags: ["분석", "약점", "보완", "성찰"] },
    { lv: 10, title: "레드 마스터 체크 / 블랙 리그 승격 준비", goal: "레드 리그 전체를 정리하고 블랙 승격을 준비한다", tags: ["복습", "승격", "종합", "마스터"] },
  ];

  return levels.map(l => createLeagueLevel("red", l.lv, 20 + l.lv, l.title, l.goal, l.tags, l.lv === 10));
}

// ═══════════════════════════════════════════════════════
// BLACK LEAGUE (Levels 31–40)
// ═══════════════════════════════════════════════════════
function generateBlackLeague(): UnifiedLevel[] {
  const levels = [
    { lv: 1, title: "자세 설명하기", goal: "기본 자세를 다른 사람에게 설명할 수 있다", tags: ["설명", "자세", "코칭", "전달"] },
    { lv: 2, title: "기본 펀치 설명하기", goal: "기본 펀치를 체계적으로 설명할 수 있다", tags: ["펀치", "설명", "체계", "코칭"] },
    { lv: 3, title: "강도 조절과 안전", goal: "훈련 강도를 조절하고 안전을 관리한다", tags: ["강도", "조절", "안전", "관리"] },
    { lv: 4, title: "잘못된 폼 관찰하기", goal: "잘못된 폼을 관찰하고 교정 포인트를 찾는다", tags: ["관찰", "교정", "폼", "분석"] },
    { lv: 5, title: "초보자 루틴 설계", goal: "초보자를 위한 기본 루틴을 설계한다", tags: ["루틴", "설계", "초보자", "프로그래밍"] },
    { lv: 6, title: "라운드 운영과 페이스 조절", goal: "라운드를 전략적으로 운영한다", tags: ["라운드", "운영", "전략", "페이스"] },
    { lv: 7, title: "영상 기반 자기 분석", goal: "영상을 보고 자신의 기술을 분석한다", tags: ["영상", "분석", "자기평가", "피드백"] },
    { lv: 8, title: "짧고 정확한 피드백", goal: "짧고 효과적인 피드백을 줄 수 있다", tags: ["피드백", "정확", "효과", "코칭"] },
    { lv: 9, title: "미니 클래스 리드", goal: "작은 그룹을 이끌고 수업을 진행한다", tags: ["리드", "클래스", "진행", "코칭"] },
    { lv: 10, title: "블랙 마스터 / 자기훈련 + 초급코칭", goal: "자기 훈련과 초급 코칭을 동시에 수행한다", tags: ["마스터", "자기훈련", "코칭", "종합"] },
  ];

  return levels.map(l => createLeagueLevel("black", l.lv, 30 + l.lv, l.title, l.goal, l.tags, l.lv === 10));
}

// ─── Generic level creator for Blue/Red/Black ───
function createLeagueLevel(
  league: "blue" | "red" | "black",
  levelInLeague: number,
  globalLevel: number,
  title: string,
  shortGoal: string,
  coachTags: string[],
  isBoss: boolean,
): UnifiedLevel {
  const difficultyMultiplier = league === "blue" ? 1.2 : league === "red" ? 1.5 : 2.0;
  const baseXp = Math.round(500 + (globalLevel - 1) * 30);
  const baseSessions = league === "blue" ? 6 : league === "red" ? 7 : 8;
  const baseMinutes = Math.round(250 + (globalLevel - 1) * 15);

  return {
    globalLevel,
    league,
    levelInLeague,
    title,
    shortGoal,
    valueGained: [shortGoal, `${title} 경험`, `레벨 ${globalLevel} 달성`],
    routineA: [
      r("워밍업", "🔥", 5, ["조깅", "동적 스트레칭", "가동성 운동"]),
      r("줄넘기/리듬", "🪢", 5, ["복서 스텝", "더블 언더 시도"]),
      r("메인 기술 A", "🥊", 18, coachTags.map(t => `${t} 드릴`)),
      r("체력/근력", "🦵", 7, ["스쿼트 20회", "버피 5회", "플랭크 45초"]),
      r("마무리", "🧘", 3, ["쿨다운", "리뷰"]),
    ],
    routineB: [
      r("워밍업", "🔥", 5, ["조깅", "밴드 운동"]),
      r("줄넘기/리듬", "🪢", 5, ["고급 스텝"]),
      r("메인 기술 B", "🥊", 18, coachTags.map(t => `${t} 응용`)),
      r("체력/근력", "🦵", 7, ["런지 12회씩", "마운틴 클라이머 30초"]),
      r("마무리", "🧘", 3, ["쿨다운"]),
    ],
    homeMissionOptions: [
      { id: `${league[0]}${levelInLeague}-home1`, title: `${title} 핵심 연습`, description: "핵심 기술 1분 영상", emoji: "📹" },
      { id: `${league[0]}${levelInLeague}-home2`, title: "복습 기록", description: "오늘 배운 내용 정리", emoji: "📝" },
    ],
    checklistFocus: coachTags.slice(0, 4).map(t => `${t} 확인`),
    progressionConfig: {
      minXp: baseXp,
      minSessions: isBoss ? baseSessions + 2 : baseSessions,
      minDays: 5 + Math.floor(globalLevel / 15),
      minMinutes: baseMinutes,
      checklistPassCount: isBoss ? 6 : 5,
      mandatoryItems: [0, 2],
    },
    coachTags,
    learningModules: [
      { id: `${league[0]}${levelInLeague}-mod`, title, keyPoints: coachTags.slice(0, 3).map(t => `${t} 핵심 포인트`) },
    ],
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
  "가드", "잽", "스텝", "체력", "자세 복구",
  "더블 잽", "콤비", "거리", "타이밍", "설명력",
];

export const COACH_QUICK_ACTIONS = [
  { id: "complete", label: "완료", emoji: "✅", color: "bg-status-complete" },
  { id: "partial", label: "부분 완료", emoji: "⚠️", color: "bg-status-pending" },
  { id: "needs_review", label: "보완 필요", emoji: "🔄", color: "bg-destructive/80" },
  { id: "levelup_check", label: "레벨업 체크 예정", emoji: "⬆️", color: "bg-primary" },
] as const;
