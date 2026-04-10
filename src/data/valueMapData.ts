export interface ValueMapLevel {
  level: number;
  rank: "white" | "blue" | "red" | "black";
  title: string;
}

export interface LeagueSummary {
  rank: "white" | "blue" | "red" | "black";
  label: string;
  emoji: string;
  theme: string;
  levels: string;
  description: string;
  completionValues: string[];
}

export interface UnlockReward {
  level: number;
  rank: "white" | "blue" | "red" | "black";
  rewards: string[];
}

export const LEAGUE_SUMMARIES: LeagueSummary[] = [
  {
    rank: "white",
    label: "화이트 리그",
    emoji: "⬜",
    theme: "습관 · 기초체력 · 자세",
    levels: "Lv 1~10",
    description: "운동 습관과 기초 체력을 만드는 단계입니다.",
    completionValues: ["운동 습관 형성", "기본 심폐지구력 확보", "복싱 스텝 준비"],
  },
  {
    rank: "blue",
    label: "블루 리그",
    emoji: "🔵",
    theme: "기본기 · 정확성 · 반복 품질",
    levels: "Lv 11~20",
    description: "복싱 기본기를 습득하고 반복 품질을 높이는 단계입니다.",
    completionValues: ["기본 펀치 4종 습득", "기본 방어 개념 형성", "미트·백 훈련 가능"],
  },
  {
    rank: "red",
    label: "레드 리그",
    emoji: "🔴",
    theme: "적용 · 반응 · 퍼포먼스",
    levels: "Lv 21~30",
    description: "실전 대응력과 퍼포먼스를 키우는 단계입니다.",
    completionValues: ["실전형 기본기", "반응·거리·타이밍 향상", "기술 스파링 준비"],
  },
  {
    rank: "black",
    label: "블랙 리그",
    emoji: "⚫",
    theme: "전문가 · 코칭 · 자기주도",
    levels: "Lv 31~40",
    description: "전문가 정체성과 코칭 역량을 완성하는 단계입니다.",
    completionValues: ["전문가 정체성", "초급 코칭 역량", "자기 프로그램 이해도"],
  },
];

export const LEVEL_VALUE_MAP: ValueMapLevel[] = [
  { level: 1, rank: "white", title: "앱 적응, 첫 운동 완료" },
  { level: 2, rank: "white", title: "주 2회 이상 출석 리듬 형성" },
  { level: 3, rank: "white", title: "기본 가드와 자세를 인지" },
  { level: 4, rank: "white", title: "줄넘기·기초 리듬을 버틸 수 있음" },
  { level: 5, rank: "white", title: "사다리·스텝 정확도 향상" },
  { level: 6, rank: "white", title: "제자리 스텝 유지력 형성" },
  { level: 7, rank: "white", title: "사이드 이동 시 자세 안정" },
  { level: 8, rank: "white", title: "하체 지구력 향상" },
  { level: 9, rank: "white", title: "주간 활동량 목표에 가까워지는 생활 패턴" },
  { level: 10, rank: "white", title: '"운동하는 사람" 정체성 형성' },
  { level: 11, rank: "blue", title: "움직이면서 스탠스 유지" },
  { level: 12, rank: "blue", title: "잽의 형태 이해" },
  { level: 13, rank: "blue", title: "스트레이트와 회전 익힘" },
  { level: 14, rank: "blue", title: "1-2 연결 가능" },
  { level: 15, rank: "blue", title: "공격 후 가드 복귀 습관 형성" },
  { level: 16, rank: "blue", title: "리드 훅의 궤도와 회전 습득" },
  { level: 17, rank: "blue", title: "기본 어퍼 이해" },
  { level: 18, rank: "blue", title: "2~4개 콤비네이션 연결" },
  { level: 19, rank: "blue", title: "샌드백/미트 적용" },
  { level: 20, rank: "blue", title: "기본기가 있는 입문자 단계" },
  { level: 21, rank: "red", title: "거리 감각 형성" },
  { level: 22, rank: "red", title: "타이밍 감각 형성" },
  { level: 23, rank: "red", title: "방어 반응 속도 향상" },
  { level: 24, rank: "red", title: "각도 변화와 스텝 활용 가능" },
  { level: 25, rank: "red", title: "3분 라운드 체력 향상" },
  { level: 26, rank: "red", title: "콤비네이션 변형 가능" },
  { level: 27, rank: "red", title: "파트너 드릴 적응" },
  { level: 28, rank: "red", title: "제한 실전에서 침착함 형성" },
  { level: 29, rank: "red", title: "자기 약점 인식" },
  { level: 30, rank: "red", title: "복싱 수행자 단계" },
  { level: 31, rank: "black", title: "기본 자세 설명 가능" },
  { level: 32, rank: "black", title: "잽/스트레이트/훅/어퍼 설명 가능" },
  { level: 33, rank: "black", title: "안전 수칙과 강도 조절 이해" },
  { level: 34, rank: "black", title: "다른 회원의 기본 실수 파악 가능" },
  { level: 35, rank: "black", title: "초보자용 루틴 이해" },
  { level: 36, rank: "black", title: "라운드 운영과 페이스 조절 가능" },
  { level: 37, rank: "black", title: "영상으로 동작 분석 가능" },
  { level: 38, rank: "black", title: "간단한 피드백 제공 가능" },
  { level: 39, rank: "black", title: "미니 클래스 리드 가능" },
  { level: 40, rank: "black", title: "자기훈련 + 초급코칭 가능" },
];

export const UNLOCK_REWARDS: UnlockReward[] = [
  {
    level: 10,
    rank: "white",
    rewards: ["블루 입문 가이드", "기본기 영상 라이브러리", "내 약점 체크"],
  },
  {
    level: 20,
    rank: "blue",
    rewards: ["콤비네이션 카드", "미트·백 루틴 추천", "동작 비교 기능"],
  },
  {
    level: 30,
    rank: "red",
    rewards: ["파트너 드릴 메뉴", "퍼포먼스 리포트", "라운드 심박·강도 분석"],
  },
  {
    level: 40,
    rank: "black",
    rewards: ["코치 모드", "회원 지도 체크리스트", "수업 진행 템플릿"],
  },
];
