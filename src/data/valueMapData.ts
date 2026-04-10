export interface ValueMapLevel {
  level: number;
  league: "white" | "blue" | "red" | "black";
  shortValueTitle: string;
  valueDescription: string;
  unlockedBenefit: string;
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

export const FULL_VALUE_MAP: ValueMapLevel[] = [
  // White League
  { level: 1, league: "white", shortValueTitle: "운동 시작 정체성 형성", valueDescription: "처음 시작한 사람에서 훈련을 시작한 사람으로 전환", unlockedBenefit: "시작 배지" },
  { level: 2, league: "white", shortValueTitle: "주간 운동 리듬 시작", valueDescription: "주 2회 이상 운동 리듬 형성", unlockedBenefit: "출석 루틴 뱃지" },
  { level: 3, league: "white", shortValueTitle: "기본 가드와 자세 인지", valueDescription: "복싱의 시작 자세를 이해", unlockedBenefit: "자세 체크 해금" },
  { level: 4, league: "white", shortValueTitle: "줄넘기와 리듬 적응", valueDescription: "심폐 리듬과 발 리듬 향상", unlockedBenefit: "리듬 카드 해금" },
  { level: 5, league: "white", shortValueTitle: "발 정확성 향상", valueDescription: "사다리와 스텝에서 발의 위치 감각 향상", unlockedBenefit: "스텝 카드 해금" },
  { level: 6, league: "white", shortValueTitle: "제자리 스텝 유지", valueDescription: "가드와 리듬을 유지한 채 움직이기 시작", unlockedBenefit: "제자리 스텝 미션 해금" },
  { level: 7, league: "white", shortValueTitle: "사이드 이동 안정", valueDescription: "좌우 이동 시 자세 무너짐 감소", unlockedBenefit: "사이드 스텝 미션 해금" },
  { level: 8, league: "white", shortValueTitle: "하체 버티는 힘 향상", valueDescription: "종아리, 허벅지, 균형 능력 향상", unlockedBenefit: "하체 서킷 해금" },
  { level: 9, league: "white", shortValueTitle: "주간 활동 루틴 근접", valueDescription: "주간 활동량 목표에 가까워짐", unlockedBenefit: "주간 목표 보드 해금" },
  { level: 10, league: "white", shortValueTitle: "운동하는 사람 정체성 형성", valueDescription: "화이트 완료, 블루 진입 준비", unlockedBenefit: "블루 진입 배지" },
  // Blue League
  { level: 11, league: "blue", shortValueTitle: "움직이면서 자세 유지", valueDescription: "스탠스를 움직임 속에서도 유지", unlockedBenefit: "기본기 시작 해금" },
  { level: 12, league: "blue", shortValueTitle: "잽 이해", valueDescription: "가장 기본적인 펀치의 역할 이해", unlockedBenefit: "잽 카드 해금" },
  { level: 13, league: "blue", shortValueTitle: "스트레이트 회전 이해", valueDescription: "뒷발-골반-어깨 연결 감각 형성", unlockedBenefit: "스트레이트 카드 해금" },
  { level: 14, league: "blue", shortValueTitle: "1-2 연결", valueDescription: "직선 두 개를 리듬 있게 연결", unlockedBenefit: "콤비 시작 해금" },
  { level: 15, league: "blue", shortValueTitle: "공격 후 가드 복귀 습관", valueDescription: "치고 돌아오는 습관 형성", unlockedBenefit: "방어 복귀 카드 해금" },
  { level: 16, league: "blue", shortValueTitle: "리드 훅 이해", valueDescription: "곡선 펀치의 회전 감각 습득", unlockedBenefit: "훅 카드 해금" },
  { level: 17, league: "blue", shortValueTitle: "기본 어퍼 이해", valueDescription: "상하 리듬과 중심선 타격 이해", unlockedBenefit: "어퍼 카드 해금" },
  { level: 18, league: "blue", shortValueTitle: "2~4개 콤비 연결", valueDescription: "단발에서 흐름 있는 공격으로 전환", unlockedBenefit: "콤비 카드 해금" },
  { level: 19, league: "blue", shortValueTitle: "샌드백·미트 적용", valueDescription: "배운 기술을 실제 훈련기구에 적용", unlockedBenefit: "미트 루틴 해금" },
  { level: 20, league: "blue", shortValueTitle: "기본기 있는 입문자 완성", valueDescription: "복싱 초보자에서 기본기 입문자로 성장", unlockedBenefit: "레드 진입 배지" },
  // Red League
  { level: 21, league: "red", shortValueTitle: "거리 감각 시작", valueDescription: "닿는 거리와 안전거리 이해", unlockedBenefit: "거리 드릴 해금" },
  { level: 22, league: "red", shortValueTitle: "타이밍 인지", valueDescription: "언제 치고 언제 빠질지 감각 형성", unlockedBenefit: "타이밍 카드 해금" },
  { level: 23, league: "red", shortValueTitle: "방어 반응 속도 향상", valueDescription: "기본 방어의 반응성이 빨라짐", unlockedBenefit: "반응 훈련 해금" },
  { level: 24, league: "red", shortValueTitle: "각도와 스텝 적용", valueDescription: "단순 직선 이동에서 각도 이동으로 발전", unlockedBenefit: "각도 이동 카드 해금" },
  { level: 25, league: "red", shortValueTitle: "3분 라운드 체력 상승", valueDescription: "실제 복싱 라운드 체력 적응", unlockedBenefit: "라운드 체력 해금" },
  { level: 26, league: "red", shortValueTitle: "콤비 변형 가능", valueDescription: "상황에 따라 콤비를 바꾸기 시작", unlockedBenefit: "변형 콤비 카드 해금" },
  { level: 27, league: "red", shortValueTitle: "파트너 드릴 적응", valueDescription: "실제 사람을 상대로 거리와 리듬을 읽기 시작", unlockedBenefit: "파트너 드릴 해금" },
  { level: 28, league: "red", shortValueTitle: "제한 실전 침착함", valueDescription: "흥분하지 않고 기술을 유지", unlockedBenefit: "제한 실전 카드 해금" },
  { level: 29, league: "red", shortValueTitle: "자기 약점 인식", valueDescription: "부족한 점을 말로 정리할 수 있음", unlockedBenefit: "약점 리포트 해금" },
  { level: 30, league: "red", shortValueTitle: "복싱 수행자 정체성 형성", valueDescription: "운동 회원에서 실전형 수행자로 성장", unlockedBenefit: "블랙 진입 배지" },
  // Black League
  { level: 31, league: "black", shortValueTitle: "기본 자세 설명 가능", valueDescription: "자세를 다른 사람에게 설명 가능", unlockedBenefit: "티칭 시작 해금" },
  { level: 32, league: "black", shortValueTitle: "기본 펀치 설명 가능", valueDescription: "잽, 스트레이트, 훅, 어퍼를 설명 가능", unlockedBenefit: "기술 설명 카드 해금" },
  { level: 33, league: "black", shortValueTitle: "강도 조절과 안전 이해", valueDescription: "회원 수준에 맞는 강도와 안전을 이해", unlockedBenefit: "안전 가이드 해금" },
  { level: 34, league: "black", shortValueTitle: "다른 회원 실수 관찰 가능", valueDescription: "잘못된 자세를 관찰하고 인지", unlockedBenefit: "교정 포인트 카드 해금" },
  { level: 35, league: "black", shortValueTitle: "초보자 루틴 구조 이해", valueDescription: "초보자를 위한 수업 구조를 이해", unlockedBenefit: "수업 템플릿 해금" },
  { level: 36, league: "black", shortValueTitle: "라운드 운영과 페이스 조절", valueDescription: "강도와 휴식의 운영이 가능", unlockedBenefit: "라운드 운영 카드 해금" },
  { level: 37, league: "black", shortValueTitle: "영상 기반 자기분석", valueDescription: "자신의 움직임을 보며 분석 가능", unlockedBenefit: "영상 분석 카드 해금" },
  { level: 38, league: "black", shortValueTitle: "간단한 피드백 제공", valueDescription: "짧고 정확한 피드백 가능", unlockedBenefit: "피드백 가이드 해금" },
  { level: 39, league: "black", shortValueTitle: "미니 클래스 리드 가능", valueDescription: "짧은 입문 세션 리드 가능", unlockedBenefit: "미니 클래스 모드 해금" },
  { level: 40, league: "black", shortValueTitle: "자기훈련 + 초급코칭 가능", valueDescription: "자기주도 훈련과 초급 코칭이 가능한 단계", unlockedBenefit: "블랙 마스터 배지" },
];
