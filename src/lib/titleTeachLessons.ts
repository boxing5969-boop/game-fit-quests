/**
 * 🧤 타이틀미션 「설계 노트」 — 3번 공격 · 3번 미트로 만든 이유, 3편 (2026-11-05 대표님).
 *
 * 대표님 원문
 *   01:04 "타이틀미션 레벨 10에 왜 미트를 대 주고 지도를 해 봐야 하는지, 내가 배운 걸 알려 줘 봐야 하는지를 설득하는 탭을 만들고
 *          레벨 10이 되면 이 글 3일간 발송되게 하자 — 3번 공격 성공 · 3번 미트 성공을 해야 하는 과학적인 이유"
 *          (보여 준 릴스: 3-2-1 공부법 — 3번 읽고 · 2번 소리 내어 설명하고 · 1번 직접 써 보기)
 *   11:07 "도전과 실패를 통해 성장한다 … 처음에는 어색하고 잘되지 않지만 노력을 통해 성장한다. 반복은 천재를 만든다."
 *   11:24 "글씨 크기 · 밸런스 UI 는 토스와 세계적 테크 기업처럼 · 부정어를 줄이고 긍정어로 ·
 *          '왜 미트 잡아 주기일까요'보다 '왜 3번 공격 3번 미트로 설계했는지' 설명하기 — 설득하려 하면 방어기제가 생기니까 ·
 *          실제 연구 자세히 · 월드 클래스 · 국가대표 선수들이 운동과 지도로 얻는 것 · 공부(수능 만점자 · 하버드 · 서울대 ·
 *          경이적인 기록)와 비교"
 *
 * 화면: 타이틀매치 › 타이틀미션 카드의 '설계 노트' 탭 (components/titlematch/TitleTeachTab) · 대표님 미리 보기(TitleMatchPage).
 * 알림: DB title_teach_dispatch() 가 레벨 10 이 된 회원에게 하루 한 편씩 3번 — 링크 /title-match?lv=10&why=1~3.
 *   각 편의 notice(알림 제목 · 한 줄)는 DB 함수 글과 같아야 한다 — 바꾸면 둘 다.
 *
 * 글 규칙
 *   - 설득하지 않고 설계를 설명한다(심리적 반발 — 밀어붙이면 방어한다). 질문 훅 대신 '이렇게 만든 이유'.
 *   - 긍정어로: 손해 · 실패 · 못 · 안 되는 대신 자라요 · 다시 도전 · 다듬을 점.
 *   - 연구는 원문 요약에서 확인한 것만, 숫자도 확인한 것만 (sources). '가르치면 90% 기억'(학습 피라미드)은 근거가 없어 쓰지 않는다.
 *     잠 하룻밤 20%(반론 있음) · '3번 · 7일이 최적' · 미트 잡기 자체를 다룬 연구 — 쓰지 않는다(체육관에서는 = 153 의 적용).
 *   - 실제 사람 이야기는 기사 · 책에서 확인한 것만. 수능 만점자 인터뷰 두 곳에는 '친구를 가르쳤다'는 말이 없어 '문제를 만들어
 *     친구와 함께 풀었다'만 쓴다(이름은 쓰지 않는다). 서울대는 확인된 자료를 찾지 못해 넣지 않았다.
 *   - '반복은 천재를 만든다'는 연구 결과가 아니라 153(대표님)의 말로 마지막에.
 */

export type TeachDay = 1 | 2 | 3;

/** 카드 머리 제목 · 탭 이름 */
export const TEACH_SERIES_TITLE = "3번 공격 · 3번 미트로 만든 이유";
export const TEACH_TAB_LABEL = "설계 노트";

export interface TeachFinding {
  /** 결과 한두 문장 */
  text: string;
  /** 한국어로 읽는 이름 · 연도 */
  by: string;
  /** 출처 주소 (누르면 원문) */
  url?: string;
  /** '실험 자세히'를 펼치면 — 누가 · 몇 명 · 무엇을 */
  detail?: string;
}

export interface TeachStory {
  /** 굵은 머리말 */
  who: string;
  text: string;
  /** 153 입체 아이콘 이름 (public/assets/icons3d) */
  icon: string;
  /** 출처 이름 (없으면 생략) */
  by?: string;
  url?: string;
}

export interface TeachStep {
  label: string;
  text: string;
  /** 153 입체 아이콘 이름 */
  icon: string;
  by?: string;
  url?: string;
}

/**
 * 유튜브 영상 (대표님 "영상을 보여 주는 모든 서비스는 유튜브와 연결").
 *   ted   = TED 강연 — 표지가 강연자 얼굴 사진이라 그림 없이 글 카드로만 보여 준다. 한국어 자막은 TED 페이지에 있어 링크를 같이 둔다.
 *   short = 153 유튜브 쇼츠 — 앱에 넣어 둔 세로 표지.
 */
export interface TeachVideo {
  /** 어느 칸 아래에 둘지 */
  place: "stories" | "steps" | "gym";
  kind: "ted" | "short";
  /** 유튜브 영상 번호 */
  id: string;
  title: string;
  /** 누가 · 어디 */
  by: string;
  /** 대략 길이 (TED 페이지 기준) */
  length?: string;
  /** 쇼츠 표지 (public) */
  poster?: string;
  /** TED 한국어 자막 페이지 */
  koUrl?: string;
  /** 영상 창 아래 '핵심 포인트' — TED 한국어 자막에서 확인한 내용만 */
  points?: readonly string[];
}

export interface TeachSource {
  label: string;
  url?: string;
}

export interface TeachStat {
  value: string;
  label: string;
  /** 계산 한 줄 (막대 아래) */
  calc: string;
  /** 막대 길이 0~100 */
  pct: number;
}

export interface TeachLesson {
  day: TeachDay;
  /** 탭 칸 이름 (짧게) */
  tab: string;
  /** 큰 제목 위 작은 줄 */
  kicker: string;
  /** 큰 제목 — 한 문장 */
  title: string;
  /** 제목 아래 설명 */
  lead: string;
  /** 맨 위 사진 — 153복싱짐 선릉역점 실제 수업 (홈페이지와 같은 사진) */
  hero: { src: string; alt: string; caption: string };
  /** 숫자로 보기 (3편) */
  stats?: { title: string; items: readonly TeachStat[]; note: string };
  /** 연구로 보면 */
  research: readonly TeachFinding[];
  /** 단계 (3편 — 153 의 성장 순서) */
  steps?: { title: string; items: readonly TeachStep[] };
  /** 공부 · 세계 최고 팀 이야기 */
  stories?: { title: string; items: readonly TeachStory[] };
  /** 153 체육관에서는 */
  gym: readonly string[];
  /** 1편 — 체육관에서는 칸에 타이틀미션 9동작 시범 영상(코치 화면에서 넣은 레벨 10 미션 영상)을 붙인다 */
  titleVideo?: boolean;
  /** 유튜브 영상 */
  videos?: readonly TeachVideo[];
  /** 오늘 해 볼 것 — 한 편에 하나 */
  action: { text: string; kind: "partner" | "practice" | "apply" };
  /** 마무리 한 줄 (3편) */
  closing?: { line: string; sub: string };
  /** 알림 — DB title_teach_dispatch 와 같은 글 */
  notice: { title: string; body: string };
  /** 출처 (펼쳐 보기 — 누르면 원문) */
  sources: readonly TeachSource[];
}

export const TITLE_TEACH_LESSONS: readonly TeachLesson[] = [
  {
    day: 1,
    tab: "가르치기",
    kicker: "설계 노트 1 · 3번 미트",
    title: "가르쳐 본 사람이 가장 오래 기억해요",
    lead:
      "153 타이틀미션은 9동작 3번 연속 성공과, 같은 동작을 파트너에게 미트로 3번 받아 주기로 설계했어요. 오늘은 '3번 미트'를 넣은 이유예요.",
    hero: {
      src: "/assets/title-teach/hero-1.webp",
      alt: "코치가 미트를 잡고 회원의 펀치를 받아 주는 1:1 미트 수업",
      caption: "153복싱짐 · 코치가 잡아 주는 1:1 미트",
    },
    research: [
      {
        text: "배운 내용을 직접 가르친 학생들이 일주일 뒤 시험에서 가장 높은 점수를 받았어요.",
        by: "피오렐라 · 메이어, 2013",
        url: "https://doi.org/10.1016/j.cedpsych.2013.06.001",
        detail:
          "대학생들이 도플러 효과를 배운 뒤 시험 공부만 한 무리, 가르칠 준비만 한 무리, 영상으로 직접 가르친 무리로 나눴어요. 일주일 뒤에는 직접 가르친 무리가 가장 잘 기억했어요.",
      },
      {
        text: "효과의 열쇠는 머릿속에서 꺼내 설명하기였어요. 기억만으로 가르친 학생들이 일주일 뒤에도 잘 기억했어요.",
        by: "코 · 이 · 임, 2018",
        url: "https://doi.org/10.1002/acp.3410",
        detail:
          "124명을 기억만으로 가르치기, 대본 보며 가르치기, 떠올려 써 보기, 다른 일 하기로 나눴어요. 일주일 뒤 기억만으로 가르친 무리와 떠올려 써 본 무리가 가장 높았어요.",
      },
      {
        text: "가르칠 '제자'가 있다고 믿은 학생들은 더 오래 공부하고 더 많이 배웠어요. 이것을 '프로테제(제자) 효과'라고 불러요.",
        by: "체이스 외, 2009",
        url: "https://purl.stanford.edu/zm369yx3532",
        detail:
          "미국 중학교 2학년 학생들이 컴퓨터 속 학생 캐릭터를 가르친다고 믿고 공부했어요. 처음 성적이 낮던 학생일수록 더 크게 늘었어요.",
      },
    ],
    stories: {
      title: "공부를 잘하는 사람들은",
      items: [
        {
          who: "하버드 물리학 강의실",
          icon: "graduation",
          text: "에릭 마주르 교수는 수업 시간에 학생끼리 서로 답을 설명하게 했어요. 개념 시험에서 오른 폭이 첫해 2배 가까이, 6년째에는 3배 가까이 커졌어요.",
          by: "크라우치 · 마주르, 2001",
          url: "https://mazur.harvard.edu/publications/peer-instruction-ten-years-experience-and-results",
        },
        {
          who: "노벨상 물리학자 리처드 파인만",
          icon: "bulb",
          text: "어려운 이론을 대학 1학년 강의로 풀어 보며, 쉽게 설명할 수 있어야 진짜 이해한 것이라고 봤어요.",
          by: "굿스타인, 1996",
          url: "https://kottke.org/17/06/if-you-cant-explain-something-in-simple-terms-you-dont-understand-it",
        },
        {
          who: "수능 만점자",
          icon: "pencil",
          text: "2025년 수능 만점자는 내신 기간에 직접 문제를 만들어 친구들과 함께 풀었어요. 문제를 만드는 건 가르치는 사람의 자리에서 하는 공부예요.",
          by: "전북일보, 2025",
          url: "https://www.jjan.kr/article/20251205500037",
        },
        {
          who: "3-2-1 공부법",
          icon: "book",
          text: "3번 읽고, 2번 소리 내어 설명하고, 1번 직접 써 봐요. 설명하는 순간 내 것이 돼요.",
        },
      ],
    },
    gym: [
      "미트를 드는 순간, 파트너의 코치가 돼요.",
      "9동작 순서를 머릿속에서 꺼내, 파트너가 칠 자리에 미트를 먼저 대 줘요.",
      "그래서 미트 3번은 9동작을 몸으로 3번 설명하는 시간이에요.",
    ],
    titleVideo: true,
    action: { text: "미트를 서로 잡아 줄 파트너 한 명 찾기", kind: "partner" },
    notice: {
      title: "153이 타이틀미션을 3번 공격 · 3번 미트로 만든 이유",
      body: "설계 노트 1/3 · 가르쳐 본 사람이 가장 오래 기억해요",
    },
    sources: [
      {
        label: "Fiorella & Mayer (2013). The relative benefits of learning by teaching and teaching expectancy. Contemporary Educational Psychology, 38(4), 281–288.",
        url: "https://doi.org/10.1016/j.cedpsych.2013.06.001",
      },
      {
        label: "Koh, Lee & Lim (2018). The learning benefits of teaching: A retrieval practice hypothesis. Applied Cognitive Psychology, 32(3), 401–410.",
        url: "https://doi.org/10.1002/acp.3410",
      },
      {
        label: "Chase, Chin, Oppezzo & Schwartz (2009). Teachable agents and the protégé effect. Journal of Science Education and Technology, 18(4), 334–352.",
        url: "https://purl.stanford.edu/zm369yx3532",
      },
      {
        label: "Crouch & Mazur (2001). Peer Instruction: Ten years of experience and results. American Journal of Physics, 69, 970–977.",
        url: "https://mazur.harvard.edu/publications/peer-instruction-ten-years-experience-and-results",
      },
      {
        label: "Goodstein & Goodstein (1996). Feynman's Lost Lecture. W. W. Norton. · 소개 글: kottke.org (2017)",
        url: "https://kottke.org/17/06/if-you-cant-explain-something-in-simple-terms-you-dont-understand-it",
      },
      { label: "전북일보 (2025.12.5). 수능 만점자 인터뷰.", url: "https://www.jjan.kr/article/20251205500037" },
    ],
  },
  {
    day: 2,
    tab: "함께 자라기",
    kicker: "설계 노트 2 · 3번 미트",
    title: "미트를 잡는 시간에도 실력이 자라요",
    lead: "타이틀미션은 둘이 함께 통과하도록 설계했어요. 치는 사람과 받아 주는 사람이 번갈아 가며 같이 자라요.",
    hero: {
      src: "/assets/title-teach/hero-2.webp",
      alt: "글러브를 낀 두 회원이 마주 서서 짝 연습을 하는 장면",
      caption: "153복싱짐 · 마주 서서 하는 짝 연습",
    },
    research: [
      {
        text: "짝과 번갈아 하며 서로 지켜본 사람들이 혼자 연습한 사람들보다 더 잘 배웠어요. 다음 날 다시 해도 더 잘했어요.",
        by: "셰이 · 울프 · 휘태커, 1999",
        url: "https://doi.org/10.1080/00222899909600983",
        detail: "36명이 흔들리는 판 위에서 균형 잡기를 배웠어요. 짝과 번갈아 한 무리가 연습하면서 앞서 나갔어요.",
      },
      {
        text: "둘이 번갈아 한 의대생들은 직접 한 횟수가 절반이었어요. 3주 뒤 실력은 혼자 다 한 학생들과 같았어요.",
        by: "비에룸 외, 2014",
        url: "https://pubmed.ncbi.nlm.nih.gov/24909532/",
        detail: "의대생 36명이 기관지 내시경 시뮬레이터로 배웠어요. 짝 무리는 한 사람이 할 때 다른 사람이 옆에서 지켜봤어요.",
      },
      {
        text: "남이 연습하는 모습을 지켜본 사람도 직접 연습한 사람만큼 고칠 점을 찾는 눈이 생겼어요.",
        by: "블랑댕 · 프로토, 2000",
        url: "https://doi.org/10.1080/713755917",
        detail: "타이밍 동작을 지켜보기만 한 무리가 직접 해 본 무리와 비슷하게, 동작의 어디를 다듬어야 하는지 알아챘어요.",
      },
    ],
    stories: {
      title: "세계 최고 팀들은",
      items: [
        {
          who: "유도 · 자타공영",
          icon: "handshake",
          text: "유도를 만든 가노 지고로의 원칙은 '자타공영', 나와 남이 함께 잘되는 거예요. 국제유도연맹은 기술을 받아 주는 파트너가 있어야 기술이 자라고, 파트너에게 조언하며 나도 배운다고 설명해요.",
          by: "국제유도연맹",
          url: "https://www.ijf.org/history/judo-culture/2290",
        },
        {
          who: "뉴질랜드 럭비 대표팀 올블랙스",
          icon: "trophy",
          text: "2007년 월드컵 뒤, 고참 선수 5명에게 경기 계획을 함께 짜고 어린 선수들을 가르치는 역할을 맡겼어요. 이 팀은 2011년과 2015년 월드컵을 연달아 우승했어요.",
          by: "뉴질랜드 헤럴드, 2008",
          url: "https://www.nzherald.co.nz/sport/rugby/all-blacks/all-blacks-players-to-help-form-gameplan/RQT5YRKO6B6EPJIPYYLMSMBTLQ/",
        },
        {
          who: "세계적인 외과 의사 아툴 가완디",
          icon: "stethoscope",
          text: "1,000번 넘게 한 수술도 스승에게 지켜봐 달라고 했어요. 세계 최고 선수들에게 늘 코치가 있는 것처럼요. 스승이 팔꿈치 각도와 시야를 짚어 주자 수술 결과가 더 좋아졌다고 해요.",
          by: "NPR · 뉴요커, 2011",
          url: "https://www.npr.org/transcripts/140849085",
        },
      ],
    },
    videos: [
      {
        place: "stories",
        kind: "ted",
        id: "oHDq1PcYkT4",
        title: "무언가를 잘하고 싶다면, 코치를 두세요",
        by: "아툴 가완디 · 외과 의사",
        length: "약 17분",
        koUrl: "https://www.ted.com/talks/atul_gawande_want_to_get_great_at_something_get_a_coach?language=ko",
        points: [
          "5년 동안 해마다 좋아지던 수술 결과가 멈추자, 은퇴한 은사에게 수술을 지켜봐 달라고 했어요.",
          "코치는 바깥에서 나를 보는 눈과 귀가 되어, 지금 내 모습을 더 정확히 알게 해 줘요.",
          "세계에서 가장 뛰어난 사람에게도 코치가 필요하다고 말해요.",
        ],
      },
      {
        place: "gym",
        kind: "short",
        id: "XOhXvrtik6U",
        title: "코치가 미트를 계속 움직이는 이유",
        by: "153복싱짐 선릉역점 · 유튜브 쇼츠",
        poster: "/assets/title-teach/short-XOhXvrtik6U.webp",
      },
    ],
    gym: [
      "미트를 들면 파트너의 9동작이 정면에서 보여요. 잽 뒤 오른손 자리, 백스텝의 발 간격이 한눈에 들어와요.",
      "그 눈으로 내 동작도 다듬게 돼요.",
      "파트너가 빠지고 도는 길을 따라 미트를 대면서, 9동작을 상대 쪽에서도 익혀요.",
    ],
    action: { text: "파트너 동작에서 좋은 점 하나, 다듬을 점 하나 말해 주기", kind: "practice" },
    notice: {
      title: "미트를 잡는 시간도 훈련이 되는 이유",
      body: "설계 노트 2/3 · 세계 최고 팀들도 서로 가르치며 강해져요",
    },
    sources: [
      {
        label: "Shea, Wulf & Whitacre (1999). Enhancing training efficiency and effectiveness through the use of dyad training. Journal of Motor Behavior, 31(2), 119–125.",
        url: "https://doi.org/10.1080/00222899909600983",
      },
      {
        label: "Bjerrum, Eika, Charles & Hilberg (2014). Dyad practice is efficient practice: A randomised bronchoscopy simulation study. Medical Education, 48(7), 705–712.",
        url: "https://pubmed.ncbi.nlm.nih.gov/24909532/",
      },
      {
        label: "Blandin & Proteau (2000). On the cognitive basis of observational learning. Quarterly Journal of Experimental Psychology A, 53(3), 846–867.",
        url: "https://doi.org/10.1080/713755917",
      },
      { label: "International Judo Federation. Judo culture: Jita Kyoei (mutual prosperity).", url: "https://www.ijf.org/history/judo-culture/2290" },
      {
        label: "New Zealand Herald (2008). All Blacks players to help form gameplan.",
        url: "https://www.nzherald.co.nz/sport/rugby/all-blacks/all-blacks-players-to-help-form-gameplan/RQT5YRKO6B6EPJIPYYLMSMBTLQ/",
      },
      {
        label: "NPR (2011.9.27). Athletes have coaches. Why not everyone else? · Atul Gawande, 'Personal Best', The New Yorker (2011).",
        url: "https://www.npr.org/transcripts/140849085",
      },
    ],
  },
  {
    day: 3,
    tab: "반복",
    kicker: "설계 노트 3 · 3번 공격",
    title: "3번 연속이면 실력이에요",
    lead: "공격은 3번 연속 성공, 도전 기회도 3번으로 설계했어요. 반복이 실력이 되는 길을 그대로 담았어요.",
    hero: {
      src: "/assets/title-teach/hero-3.webp",
      alt: "거울 앞에서 코치 미트에 연타를 넣는 회원",
      caption: "153복싱짐 · 연타를 받아 주는 미트",
    },
    stats: {
      title: "3번 연속 성공할 확률",
      items: [
        { value: "12.5%", label: "반쯤 되는 실력", calc: "50% × 50% × 50%", pct: 12.5 },
        { value: "73%", label: "10번에 9번 되는 실력", calc: "90% × 90% × 90%", pct: 72.9 },
      ],
      note: "그래서 3번 연속이면 그날의 운보다 내 실력이에요.",
    },
    research: [
      {
        text: "한 번 잘된 것보다 다시 해도 되는지가 진짜 실력을 보여 줘요.",
        by: "소더스트롬 · 비요크, 2015",
        url: "https://doi.org/10.1177/1745691615569000",
        detail: "연습 중 성적과 실제로 익힌 정도는 다를 수 있어요. 시간이 지나 다시 해 볼 때 몸에 익었는지 알 수 있어요.",
      },
      {
        text: "한 번 맞힌 뒤에도 계속 꺼내 본 내용은 일주일 뒤 80%가 남았어요. 한 번에서 멈춘 쪽은 33~36%였어요.",
        by: "카피키 · 로디거, 2008",
        url: "https://doi.org/10.1126/science.1152408",
        detail: "대학생들이 스와힐리어 단어 40쌍을 외웠어요. 다시 읽기보다 다시 떠올리기가 기억을 지켜 줬어요.",
      },
      {
        text: "날을 나눠 연습하면 한 번에 몰아서 할 때보다 오래 남아요. 317개 실험을 모아 본 결과예요.",
        by: "세페다 외, 2006",
        url: "https://doi.org/10.1037/0033-2909.132.3.354",
        detail: "그래서 153은 다시 도전까지 7일을 두었어요. 며칠에 나눠 연습할 시간이에요.",
      },
    ],
    steps: {
      title: "153의 성장 순서",
      items: [
        { label: "도전", icon: "target", text: "실력보다 한 뼘 높은 목표를 잡아요." },
        {
          label: "몰입",
          icon: "fire",
          text: "실력에 딱 맞는 도전일 때 가장 깊이 빠져들어요.",
          by: "칙센트미하이, 1990",
          url: "https://www.ted.com/talks/mihaly_csikszentmihalyi_flow_the_secret_to_happiness",
        },
        {
          label: "다시 도전",
          icon: "muscle",
          text: "먼저 부딪혀 본 사람이 더 많이 배워요. 53개 연구를 모아 본 결과예요.",
          by: "신하 · 카푸르, 2021",
          url: "https://doi.org/10.3102/00346543211019105",
        },
        {
          label: "성장",
          icon: "seedling",
          text: "처음엔 생각하며 천천히, 반복하면 매끄럽게, 마지막엔 몸이 먼저 움직여요.",
          by: "피츠 · 포스너, 1967",
        },
      ],
    },
    videos: [
      {
        place: "steps",
        kind: "ted",
        id: "fXIeFJCqsPs",
        title: "몰입, 행복의 비밀",
        by: "미하이 칙센트미하이 · 심리학자",
        length: "약 19분",
        koUrl: "https://www.ted.com/talks/mihaly_csikszentmihalyi_flow_the_secret_to_happiness?language=ko",
        points: [
          "도전도 내 실력도 평소보다 높을 때 몰입에 빠져요.",
          "몰입하면 할 일이 분명하고, 바로 피드백이 오고, 시간 가는 줄 몰라요.",
          "몸이 저절로 움직이는 듯한 순간은 오래 훈련하고 기술을 다듬은 사람에게 찾아와요.",
        ],
      },
    ],
    gym: [
      "레벨 1 첫날 잽도 처음엔 생각하며 쳤어요. 지금은 몸이 먼저 나가요. 9동작도 같은 길을 가요.",
      "도전 기회는 3번이에요. 영상에서 다듬을 점 하나를 찾고, 7일 동안 날을 나눠 연습한 뒤 다시 도전해요.",
      "미트 3번이 연속으로 되면, 상대 쪽에서도 9동작 순서를 안다는 뜻이에요.",
    ],
    action: { text: "파트너와 3번 연속이 되면, 아래 버튼으로 {who}께 심사를 신청해요.", kind: "apply" },
    closing: { line: "반복은 천재를 만든다", sub: "153 건강과 행복" },
    notice: {
      title: "3번 연속 성공 · 3번 기회로 만든 이유",
      body: "설계 노트 3/3 · 반복은 천재를 만들어요",
    },
    sources: [
      {
        label: "Soderstrom & Bjork (2015). Learning versus performance: An integrative review. Perspectives on Psychological Science, 10(2), 176–199.",
        url: "https://doi.org/10.1177/1745691615569000",
      },
      {
        label: "Karpicke & Roediger (2008). The critical importance of retrieval for learning. Science, 319(5865), 966–968.",
        url: "https://doi.org/10.1126/science.1152408",
      },
      {
        label: "Cepeda, Pashler, Vul, Wixted & Rohrer (2006). Distributed practice in verbal recall tasks. Psychological Bulletin, 132(3), 354–380.",
        url: "https://doi.org/10.1037/0033-2909.132.3.354",
      },
      {
        label: "Csikszentmihalyi (1990). Flow: The Psychology of Optimal Experience. Harper & Row. · TED (2004) Flow, the secret to happiness.",
        url: "https://www.ted.com/talks/mihaly_csikszentmihalyi_flow_the_secret_to_happiness",
      },
      {
        label: "Sinha & Kapur (2021). When problem solving followed by instruction works: Evidence for productive failure. Review of Educational Research, 91(5), 761–798.",
        url: "https://doi.org/10.3102/00346543211019105",
      },
      { label: "Fitts & Posner (1967). Human Performance. Brooks/Cole." },
    ],
  },
];

export const lessonFor = (day: TeachDay): TeachLesson => TITLE_TEACH_LESSONS[day - 1];

/** 알림 링크 ?why= → 몇 편 (1~3 이 아니면 null) */
export function teachDayFromParam(raw: string | null | undefined): TeachDay | null {
  const n = Number(raw);
  return n === 1 || n === 2 || n === 3 ? n : null;
}

/** 알림 링크 — DB title_match_link('white') || '&why=' || 편 과 같은 모양 */
export const titleTeachLink = (day: TeachDay) => `/title-match?lv=10&why=${day}`;

/** 동작 외우는 말을 덩어리로 — '잽 잽 원투 — 빠지고 꽂고 — …' → ['잽 잽 원투', '빠지고 꽂고', …] */
export const chantChunks = (chant: string): string[] =>
  chant
    .split(/\s*[—–]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * 유튜브 재생 주소 — 앱 VideoPlayer 는 embed 주소를 그대로 쓴다.
 * TED 는 자막을 켜고 한국어를 먼저 고른다(유튜브에 한국어 자막이 없으면 유튜브가 다른 자막을 띄운다).
 */
export const teachVideoEmbed = (v: Pick<TeachVideo, "id" | "kind">) =>
  `https://www.youtube.com/embed/${v.id}?autoplay=1&playsinline=1&rel=0${
    v.kind === "ted" ? "&cc_load_policy=1&cc_lang_pref=ko&hl=ko" : ""
  }`;

/** 읽는 데 걸리는 시간(분) — 연구 글이라 천천히, 1분에 400자쯤(빈칸 빼고) · 올림 */
export const readingMinutes = (l: TeachLesson) => {
  const text = [
    l.title,
    l.lead,
    l.stats?.note ?? "",
    ...l.research.map((r) => r.text),
    ...(l.steps?.items.map((s) => s.label + s.text) ?? []),
    ...(l.stories?.items.map((s) => s.who + s.text) ?? []),
    ...l.gym,
    l.action.text,
  ].join("");
  return Math.max(1, Math.ceil(text.replace(/\s/g, "").length / 400));
};

/** 행동 글의 {who} 를 심사하는 사람으로 */
export const fillWho = (text: string, who: string) => text.replace(/\{who\}/g, who);
