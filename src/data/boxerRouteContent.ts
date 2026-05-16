/**
 * 복싱인 루트 — 시각화 훈련 콘텐츠 데이터.
 *
 * 마이복서153 성인 회원용 3분 1라운드 시각화 세션.
 * 톤: 회복 / 낭만 / 꾸준함 / 자기 존중 / 전문성 / 지도자 가능성.
 * 모든 장소 표현은 "153복싱짐" 으로 통일.
 *
 * 데이터만 정적 상수. DB / API / localStorage 외 0건.
 */

export type RoutineMood =
  | "return"        // 돌아옴 / 회복
  | "rhythm"        // 꾸준함 / 리듬
  | "self_respect"  // 자기 존중 / 거울
  | "precision"     // 전문성 / 정확함
  | "stillness"     // 고요 / 호흡
  | "leadership"    // 지도자 가능성
  | "closing";      // 마무리 / 낭만

export interface RoutineSegment {
  /** 0..duration_sec 사이 시작 시점 (초) */
  start_sec: number;
  /** 화면에 노출되는 본문 (1~2 문장) */
  body: string;
  /** 호흡 가이드 — null 이면 호흡 패널 비표시 */
  breath?: {
    /** 들숨 / 멈춤 / 날숨 / 멈춤 (초) */
    pattern: [number, number, number, number];
    label: string;
  } | null;
}

export interface VisualizationRoutine {
  code: string;
  title: string;
  subtitle: string;
  mood: RoutineMood;
  /** 라운드 길이 — 모든 라운드는 1라운드 = 180초 (3분) */
  duration_sec: 180;
  /** 시각화 본문 흐름 (3~6 segment) */
  segments: RoutineSegment[];
  /** 라운드 종료 시 화면에 띄울 한 줄 */
  closing_line: string;
  /** 라운드 종료 후 회원에게 남는 한 문장 */
  takeaway: string;
}

// ──────────────────────────────────────────────────────────────────
// 7 라운드 — 한 주일 분량. 같은 회원이 매일 다른 라운드를 도는 게 기본 흐름.
// ──────────────────────────────────────────────────────────────────

export const VISUALIZATION_ROUTINES: VisualizationRoutine[] = [
  {
    code: "round_1_return",
    title: "153복싱짐으로 돌아온 사람",
    subtitle: "오랜만에 다시 들어선 첫 라운드",
    mood: "return",
    duration_sec: 180,
    segments: [
      {
        start_sec: 0,
        body:
          "눈을 감습니다.\n153복싱짐으로 돌아왔다고 생각해 봅니다.\n현관의 익숙한 공기, 발에 닿는 바닥의 감각이 먼저 들어옵니다.",
        breath: { pattern: [4, 2, 6, 2], label: "들이쉬며 천천히 들어선다" },
      },
      {
        start_sec: 45,
        body:
          "오랜만에 다시 온 것이 부끄럽지 않습니다.\n다시 온 것 자체로 충분합니다.\n신발을 바꿔 신고, 줄을 한 번 매듭짓습니다.",
        breath: { pattern: [4, 2, 6, 2], label: "내쉬며 어깨를 내려둔다" },
      },
      {
        start_sec: 95,
        body:
          "거울 앞에 천천히 섭니다.\n예전의 나와 지금의 나를 비교하지 않습니다.\n오늘의 나만 거울에 두고 봅니다.",
        breath: null,
      },
      {
        start_sec: 140,
        body:
          "한 번 짧게 잽을 뻗어봅니다.\n속도보다 자세를, 세기보다 정확함을 챙깁니다.\n돌아왔다는 사실이, 오늘의 가장 큰 훈련입니다.",
        breath: { pattern: [4, 2, 6, 2], label: "마무리 호흡" },
      },
    ],
    closing_line: "153복싱짐에서 오늘의 나를 다시 세운다.",
    takeaway: "돌아왔다는 것만으로 충분합니다. 내일 한 번 더 오면 됩니다.",
  },

  {
    code: "round_2_jump_rope",
    title: "줄넘기, 리듬을 되찾는 라운드",
    subtitle: "꾸준함은 속도보다 리듬에서 나온다",
    mood: "rhythm",
    duration_sec: 180,
    segments: [
      {
        start_sec: 0,
        body:
          "153복싱짐의 한쪽 구석, 줄넘기가 손에 잡힙니다.\n오늘은 횟수를 세지 않습니다.\n발이 바닥에 닿는 소리만 듣습니다.",
        breath: { pattern: [3, 1, 4, 1], label: "가볍게 호흡한다" },
      },
      {
        start_sec: 45,
        body:
          "처음 30초는 어색합니다.\n그 어색함을 견디는 것이 오늘의 일입니다.\n무리하지 않는 리듬을 찾습니다.",
        breath: null,
      },
      {
        start_sec: 95,
        body:
          "이제 리듬이 손목에서 나옵니다.\n어깨에 힘이 빠지고, 무릎이 가벼워집니다.\n속도가 아니라 같은 박자가 중요합니다.",
        breath: { pattern: [3, 1, 4, 1], label: "박자에 호흡을 맞춘다" },
      },
      {
        start_sec: 140,
        body:
          "줄을 천천히 내려놓습니다.\n같은 박자를 일주일만 더 지키면 됩니다.\n꾸준함은 그렇게 만들어집니다.",
        breath: null,
      },
    ],
    closing_line: "153복싱짐의 공기에서 오늘의 박자를 찾았다.",
    takeaway: "리듬을 찾는 데 일주일이면 충분합니다. 같은 시간에 다시 옵시다.",
  },

  {
    code: "round_3_mirror",
    title: "거울 앞에서, 자세를 다시 잡는다",
    subtitle: "자기 존중은 자세에서 시작한다",
    mood: "self_respect",
    duration_sec: 180,
    segments: [
      {
        start_sec: 0,
        body:
          "153복싱짐의 거울 앞에 섭니다.\n발의 위치, 무릎의 각도, 어깨의 높이를 차례로 확인합니다.\n작은 흐트러짐을 다그치지 않습니다.",
        breath: { pattern: [4, 2, 6, 2], label: "들이쉬며 자세를 점검한다" },
      },
      {
        start_sec: 50,
        body:
          "잽 한 번. 멈춤.\n다시 잽 한 번. 멈춤.\n속도보다 정확함이, 정확함보다 정직함이 먼저입니다.",
        breath: null,
      },
      {
        start_sec: 100,
        body:
          "거울 속의 사람을 비교 대상이 아니라\n오늘 함께 훈련하는 동료로 봅니다.\n나에게 친절한 시선을 한 번 보냅니다.",
        breath: { pattern: [4, 2, 6, 2], label: "내쉬며 시선을 부드럽게 둔다" },
      },
      {
        start_sec: 150,
        body:
          "자세를 한 번만 더 가다듬고 마칩니다.\n거울 앞은 매일 똑같이 다시 시작할 수 있는 자리입니다.",
        breath: null,
      },
    ],
    closing_line: "거울 앞은 매일 다시 시작할 수 있는 자리다.",
    takeaway: "오늘 자세 하나만 정직하게 잡았다면, 그것으로 충분합니다.",
  },

  {
    code: "round_4_mitt",
    title: "미트, 한 번만 더 정확하게",
    subtitle: "전문성은 한 번의 정확함이 모인 것",
    mood: "precision",
    duration_sec: 180,
    segments: [
      {
        start_sec: 0,
        body:
          "153복싱짐의 미트가 눈앞에 있다고 생각합니다.\n오늘은 많이 치는 라운드가 아닙니다.\n한 번만 정확하게 치는 라운드입니다.",
        breath: { pattern: [4, 1, 4, 1], label: "들이쉬며 자세를 잡는다" },
      },
      {
        start_sec: 45,
        body:
          "잽. 발의 위치가 흔들리지 않습니다.\n스트레이트. 어깨가 먼저 나가지 않습니다.\n팔이 아니라 몸이 먼저 움직입니다.",
        breath: null,
      },
      {
        start_sec: 95,
        body:
          "정확한 한 번이 흐트러진 다섯 번보다 낫습니다.\n오늘은 한 번의 정직한 동작을 모으는 시간입니다.",
        breath: { pattern: [4, 1, 4, 1], label: "내쉬며 회수한다" },
      },
      {
        start_sec: 145,
        body:
          "마지막으로 한 번 더, 천천히 정확하게.\n전문성은 빠른 속도가 아니라\n매번 같은 자세에서 나옵니다.",
        breath: null,
      },
    ],
    closing_line: "한 번의 정확함을 매일 모으는 사람이 된다.",
    takeaway: "전문성은 빠른 손이 아니라 정직한 자세에서 옵니다.",
  },

  {
    code: "round_5_breath",
    title: "무릎을 굽혀 호흡한다",
    subtitle: "가라앉는 마음을 다시 띄우는 라운드",
    mood: "stillness",
    duration_sec: 180,
    segments: [
      {
        start_sec: 0,
        body:
          "오늘은 마음이 무거워 153복싱짐에 들어섰습니다.\n장갑을 바로 끼지 않습니다.\n링 옆의 의자에 잠시 앉습니다.",
        breath: { pattern: [4, 4, 6, 2], label: "들이쉬며 의자에 앉는다" },
      },
      {
        start_sec: 50,
        body:
          "무릎에 손을 얹고 천천히 숨을 내쉽니다.\n오늘 있었던 일을 잠시 옆에 둡니다.\n지금 이 호흡 한 번에만 집중합니다.",
        breath: { pattern: [4, 4, 6, 2], label: "내쉬며 어깨를 내려둔다" },
      },
      {
        start_sec: 105,
        body:
          "마음이 다 가벼워질 필요는 없습니다.\n조금만 띄워두면 됩니다.\n오늘은 그것이 오늘의 라운드입니다.",
        breath: { pattern: [4, 4, 6, 2], label: "다시 한 번, 천천히" },
      },
      {
        start_sec: 155,
        body:
          "천천히 일어섭니다.\n장갑을 쥐어도 좋고, 그냥 나가도 좋습니다.\n온 것 자체가 오늘의 정답입니다.",
        breath: null,
      },
    ],
    closing_line: "153복싱짐의 공기 속에서 호흡을 다시 정돈했다.",
    takeaway: "마음이 다 가벼워질 필요는 없습니다. 조금만 띄워두면 됩니다.",
  },

  {
    code: "round_6_corner",
    title: "코너에서, 후배의 라운드를 본다",
    subtitle: "지도자의 자리도 훈련의 일부다",
    mood: "leadership",
    duration_sec: 180,
    segments: [
      {
        start_sec: 0,
        body:
          "153복싱짐의 링 코너에 섭니다.\n오늘은 내 라운드가 아니라 후배의 라운드입니다.\n조용히 서서 그의 자세를 봅니다.",
        breath: { pattern: [5, 2, 5, 2], label: "들이쉬며 자리를 잡는다" },
      },
      {
        start_sec: 50,
        body:
          "지적할 것을 먼저 찾지 않습니다.\n오늘 그가 잘하고 있는 한 가지를 먼저 봅니다.\n그 한 가지를 라운드가 끝나면 짧게 말해 줍니다.",
        breath: null,
      },
      {
        start_sec: 105,
        body:
          "지도는 강한 말이 아니라 정확한 한 마디입니다.\n오래 본 사람만이 짧게 말할 수 있습니다.\n오래 봐 둔 시간이 오늘 그에게 갑니다.",
        breath: { pattern: [5, 2, 5, 2], label: "내쉬며 시선을 그에게 둔다" },
      },
      {
        start_sec: 155,
        body:
          "라운드 종이 울립니다.\n수건을 건네고, 한 마디만 짧게 합니다.\n다음에는 내 라운드를 그가 코너에서 봐 줄 것입니다.",
        breath: null,
      },
    ],
    closing_line: "코너에 서는 시간도 153복싱짐의 훈련이다.",
    takeaway: "지도는 강한 말이 아니라 정확한 한 마디입니다.",
  },

  {
    code: "round_7_closing_bell",
    title: "마지막 라운드의 종소리",
    subtitle: "오늘의 나에게 한 줄을 남긴다",
    mood: "closing",
    duration_sec: 180,
    segments: [
      {
        start_sec: 0,
        body:
          "153복싱짐의 한 주가 끝나갑니다.\n마지막 라운드의 종이 멀리서 들립니다.\n오늘의 나를 한 번 천천히 봐 둡니다.",
        breath: { pattern: [4, 3, 6, 3], label: "들이쉬며 천천히 둘러본다" },
      },
      {
        start_sec: 50,
        body:
          "잘한 것 한 가지를 떠올립니다.\n부족했던 한 가지를 떠올립니다.\n둘 다 같은 사람의 일주일입니다.",
        breath: null,
      },
      {
        start_sec: 105,
        body:
          "다음 주에 다시 같은 자리에 서기로 합니다.\n많은 것을 약속하지 않습니다.\n같은 시간에 다시 오는 것 — 그 한 가지면 됩니다.",
        breath: { pattern: [4, 3, 6, 3], label: "내쉬며 한 주를 정리한다" },
      },
      {
        start_sec: 155,
        body:
          "장갑을 정리하고 거울을 한 번 봅니다.\n수고했다고 짧게 말해 줍니다.\n153복싱짐의 한 주가, 오늘로 천천히 닫힙니다.",
        breath: null,
      },
    ],
    closing_line: "같은 시간에 다시 오는 것이, 가장 큰 약속이다.",
    takeaway: "한 주의 끝에는 잘한 한 가지와 부족했던 한 가지를 함께 둡니다.",
  },
];

export function getRoutineByCode(code: string): VisualizationRoutine | null {
  return VISUALIZATION_ROUTINES.find((r) => r.code === code) ?? null;
}

/**
 * 오늘의 추천 라운드 — 같은 사람이 매일 같은 라운드를 도는 것을 막기 위해
 * 요일 기반으로 순환. 단순/예측 가능 — 회원이 미리 알고 와도 OK.
 */
export function pickTodayRoutine(now: Date = new Date()): VisualizationRoutine {
  const dayOfWeek = now.getDay(); // 0=일 .. 6=토
  return VISUALIZATION_ROUTINES[dayOfWeek % VISUALIZATION_ROUTINES.length];
}

export const ROUTINE_MOOD_LABEL: Record<RoutineMood, string> = {
  return: "회복",
  rhythm: "꾸준함",
  self_respect: "자기 존중",
  precision: "전문성",
  stillness: "고요",
  leadership: "지도자",
  closing: "마무리",
};

export const ROUTINE_MOOD_TONE: Record<RoutineMood, string> = {
  return: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  rhythm: "border-sky-500/30 bg-sky-500/10 text-sky-100",
  self_respect: "border-violet-500/30 bg-violet-500/10 text-violet-100",
  precision: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  stillness: "border-zinc-400/30 bg-zinc-500/10 text-zinc-100",
  leadership: "border-yellow-400/30 bg-yellow-500/10 text-yellow-100",
  closing: "border-rose-400/30 bg-rose-500/10 text-rose-100",
};
