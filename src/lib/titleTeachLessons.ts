/**
 * 🧤 타이틀미션 「왜 미트를 잡아 줄까」 — 3편 이야기 (2026-11-05 대표님).
 *
 * 대표님 원문
 *   "타이틀미션 레벨 10에 왜 미트를 대 주고 지도를 해 봐야 하는지, 내가 배운 걸 알려 줘 봐야 하는지를 설득하는 탭을 만들고
 *    레벨 10이 되면 이 글 3일간 발송되게 하자 — 3번 공격 성공 · 3번 미트 성공을 해야 하는 과학적인 이유"
 *   보여 준 릴스: 3-2-1 공부법(3번 읽고 · 2번 소리 내어 설명하고 · 1번 직접 써 보기) — 질문으로 열고, 숫자로 정리하고,
 *   "진짜 한 번만 해 봐"로 끝나는 짧은 문답.
 *
 * 화면: 타이틀매치 › 타이틀미션 카드의 '왜 미트를 잡아 줄까' 탭 (components/titlematch/TitleTeachTab).
 * 알림: DB title_teach_dispatch() 가 레벨 10 이 된 회원에게 하루 한 편씩 3번 — 링크 /title-match?lv=10&why=1~3.
 *   각 편의 notice(알림 제목 · 한 줄)는 DB 함수 글과 같아야 한다 — 바꾸면 둘 다 (마이그레이션 20261105011632).
 *
 * 글 규칙: 153 브랜드(과장 · 개인 경력 없음, 짧고 구체적) · bokdung-ig13 훅(질문으로 열기) · 행동은 한 편에 하나 ·
 *   연구는 확인한 것만, 숫자는 논문 요약에 있는 것만 (출처는 sources). '가르치면 90% 기억'(학습 피라미드)은 근거 없는 말이라 쓰지 않는다.
 *   미트 잡기 자체를 다룬 연구는 없다 — 연구(연구로 보면)와 153 의 적용(체육관에서는)을 나눠 쓴다. 3번 · 7일이 '최적'이라고 쓰지 않는다.
 */

export type TeachDay = 1 | 2 | 3;

export interface TeachPoint {
  text: string;
  /** 화면에 작게 — 한국어로 읽는 이름 · 연도 */
  by: string;
}

export interface TeachLesson {
  day: TeachDay;
  /** 탭 칸 이름 (짧게) */
  tab: string;
  /** 큰 질문 — 훅 */
  hook: string;
  /** 한 줄 답 */
  answer: string;
  /** 답을 받쳐 주는 한두 줄 (없으면 생략) */
  bridge?: string;
  /** 숫자로 보기 (3편) */
  numbers?: readonly string[];
  /** 연구로 보면 */
  points: readonly TeachPoint[];
  /** 체육관에서는 */
  gym: readonly string[];
  /** 오늘 해 볼 것 — 한 편에 하나 */
  action: { text: string; kind: "partner" | "practice" | "apply" };
  /** 알림 — DB title_teach_dispatch 와 같은 글 */
  notice: { title: string; body: string };
  /** 출처 (펼쳐 보기) */
  sources: readonly string[];
}

export const TITLE_TEACH_LESSONS: readonly TeachLesson[] = [
  {
    day: 1,
    tab: "가르치기",
    hook: "레벨 10, 마지막 관문은 왜 미트 잡아 주기일까요?",
    answer: "가르쳐 본 사람이 더 오래 기억해요.",
    bridge:
      "공부법으로 알려진 3-2-1도 핵심은 같아요. 3번 읽고, 2번 소리 내어 설명하고, 1번 직접 써 봐요. 읽기만 하면 잊어도, 남에게 설명해 보면 내 것이 돼요.",
    points: [
      {
        text: "배운 내용을 영상으로 직접 가르친 학생들이, 공부만 하거나 가르칠 준비만 한 학생들보다 일주일 뒤 시험을 더 잘 봤어요.",
        by: "피오렐라 · 메이어, 2013",
      },
      {
        text: "가르칠 '제자'가 있다고 믿은 학생들은 더 오래 붙잡고 더 많이 배웠어요. 심리학에서는 이걸 '프로테제(제자) 효과'라고 불러요.",
        by: "체이스 외, 2009",
      },
      {
        text: "효과는 안 보고 꺼내서 설명할 때 났어요. 대본을 보며 가르친 쪽보다 일주일 뒤 시험이 좋았어요.",
        by: "코 외, 2018",
      },
    ],
    gym: [
      "미트를 들면 영상을 볼 수 없어요.",
      "9동작 순서를 머릿속에서 꺼내, 파트너가 칠 자리에 미트를 먼저 대 줘야 해요.",
      "그래서 153은 미트 잡아 주기를 '안 보고 설명하기'로 봐요.",
    ],
    action: { text: "미트를 서로 잡아 줄 파트너 한 명 찾기", kind: "partner" },
    notice: {
      title: "레벨 10, 마지막 관문은 왜 미트 잡아 주기일까요?",
      body: "가르쳐 본 사람이 더 오래 기억해요. 타이틀미션 이야기 1/3",
    },
    sources: [
      "Fiorella & Mayer (2013). The relative benefits of learning by teaching and teaching expectancy. Contemporary Educational Psychology, 38(4), 281–288.",
      "Chase, Chin, Oppezzo & Schwartz (2009). Teachable agents and the protégé effect: Increasing the effort towards learning. Journal of Science Education and Technology, 18(4), 334–352.",
      "Koh, Lee & Lim (2018). The learning benefits of teaching: A retrieval practice hypothesis. Applied Cognitive Psychology, 32(3), 401–410.",
    ],
  },
  {
    day: 2,
    tab: "번갈아 하기",
    hook: "미트 잡아 주는 동안, 내 연습은 손해일까요?",
    answer: "아니에요. 번갈아 하면 내가 치는 횟수가 줄어도 배우는 건 줄지 않아요.",
    points: [
      {
        text: "균형 잡기 연습에서, 짝과 번갈아 하며 서로 지켜본 사람들이 처음엔 뒤졌다가 혼자 연습한 사람들을 앞질렀고, 다음 날에도 더 잘했어요.",
        by: "셰이 외, 1999",
      },
      {
        text: "의대생 내시경 연습에서, 둘이 번갈아 한 학생들은 직접 한 횟수가 절반이었는데도 3주 뒤 실력이 혼자 다 한 학생들과 같았어요.",
        by: "비에룸 외, 2014",
      },
      {
        text: "남이 연습하는 걸 지켜본 사람들은, 직접 연습한 사람만큼 실수를 알아채고 고치는 눈이 생겼어요.",
        by: "블랑댕 · 프로토, 2000",
      },
    ],
    gym: [
      "미트를 들면 상대 쪽에서 9동작을 보게 돼요.",
      "잽 뒤에 오른손이 내려가는 순간, 백스텝에서 두 발이 모이는 순간이 바로 보여요. 그 눈으로 내 동작도 고치게 돼요.",
      "파트너가 빠지고 도는 길을 따라가며 미트를 대 줘야 해서, 9동작을 반대편에서도 알게 돼요.",
    ],
    action: { text: "파트너 동작을 지켜보며 고칠 점 딱 하나만 찾아 알려 주기. '오른손!' 한마디면 돼요.", kind: "practice" },
    notice: {
      title: "미트 잡아 주는 동안, 내 연습은 손해일까요?",
      body: "번갈아 하면 내가 치는 횟수가 줄어도 배우는 건 줄지 않아요. 타이틀미션 이야기 2/3",
    },
    sources: [
      "Shea, Wulf & Whitacre (1999). Enhancing training efficiency and effectiveness through the use of dyad training. Journal of Motor Behavior, 31(2), 119–125.",
      "Bjerrum, Eika, Charles & Hilberg (2014). Dyad practice is efficient practice: A randomised bronchoscopy simulation study. Medical Education, 48(7), 705–712.",
      "Blandin & Proteau (2000). On the cognitive basis of observational learning: Development of mechanisms for the detection and correction of errors. Quarterly Journal of Experimental Psychology A, 53(3), 846–867.",
    ],
  },
  {
    day: 3,
    tab: "왜 3번",
    hook: "왜 한 번이 아니라 3번 연속일까요?",
    answer: "한 번은 운이어도 3번 연속은 실력이에요.",
    numbers: [
      "반쯤 되는 실력이면, 3번 연속은 8번에 1번(12.5%)뿐이에요.",
      "10번에 9번 되는 실력이면, 3번 연속은 10번에 7번꼴(73%)이에요.",
      "그래서 3번 연속이면 운으로 보기 어려워요. 그게 내 실력이에요.",
    ],
    points: [
      {
        text: "연습 때 한 번 잘된 것만으로는 몸에 익었다고 보기 어려워요. 연습 중 성적은 실력을 잘못 보여 주기 쉬워요.",
        by: "소더스트롬 · 비요크, 2015",
      },
      {
        text: "한 번 맞힌 뒤에도 계속 꺼내 본 내용은 일주일 뒤 80% 남았고, 한 번 맞히고 그만둔 내용은 33~36%만 남았어요.",
        by: "카피키 · 로디거, 2008",
      },
      {
        text: "한 번에 몰아서 하는 것보다 날을 나눠 연습한 것이 오래 남아요. 317개 실험을 모아 본 결과예요.",
        by: "세페다 외, 2006",
      },
    ],
    gym: [
      "153 타이틀미션은 3 · 3 · 3이에요. 9동작 3번 연속 성공, 같은 동작 미트 3번 잡아 주기, 도전 기회 3번.",
      "잡아 주는 사람이 흔들리면 파트너의 9동작도 흔들려요. 미트 3번 연속이면 반대편에서도 순서를 안다는 뜻이에요.",
      "3번이 다 아쉬워도 끝이 아니에요. 7일 동안 날을 나눠 연습하고 다시 도전해요.",
    ],
    action: { text: "파트너와 3번 연속이 되면, 아래 버튼으로 {who}께 심사를 신청해요.", kind: "apply" },
    notice: {
      title: "왜 한 번이 아니라 3번 연속일까요?",
      body: "한 번은 운이어도 3번 연속은 실력이에요. 타이틀미션 이야기 3/3",
    },
    sources: [
      "Soderstrom & Bjork (2015). Learning versus performance: An integrative review. Perspectives on Psychological Science, 10(2), 176–199.",
      "Karpicke & Roediger (2008). The critical importance of retrieval for learning. Science, 319(5865), 966–968.",
      "Cepeda, Pashler, Vul, Wixted & Rohrer (2006). Distributed practice in verbal recall tasks: A review and quantitative synthesis. Psychological Bulletin, 132(3), 354–380.",
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

/** 행동 글의 {who} 를 심사하는 사람으로 */
export const fillWho = (text: string, who: string) => text.replace(/\{who\}/g, who);
