/**
 * 마이복서153 — 시각화 훈련 콘텐츠 데이터.
 *
 * 153복싱짐으로 돌아온 성인 회원이 복싱 매니아 → 복싱인 → 전문가 → 지도자 → 마스터
 * 가 되는 미래를 감정적으로 상상하게 하는 3분 1라운드 시각화 세션.
 *
 * 본 파일은 정적 콘텐츠 상수만 포함. DB / API / 외부 호출 0.
 *
 * 보호 원칙:
 *   · 다른 파일 미수정.
 *   · 회원의 진행 기록은 별도 hook 에서 localStorage 단독 처리.
 */

// ─────────────────────────────────────────────────────────────
// 1. 타입
// ─────────────────────────────────────────────────────────────

export type MoodKey =
  | "tired"
  | "stressed"
  | "awkward"
  | "excited"
  | "want_change"
  | "future_leader";

export type MindsetKey =
  | "return_to_self"
  | "no_compare"
  | "one_more_time"
  | "respect_body"
  | "becoming_boxer";

export type PromiseKey =
  | "breath_back"
  | "guard_up"
  | "no_compare_action"
  | "listen_coach"
  | "retry_after_fail"
  | "record_emotion"
  | "thank_self";

export interface MoodOption {
  key: MoodKey;
  label: string;
  response: string;
}

export interface MindsetOption {
  key: MindsetKey;
  label: string;
  description: string;
}

export interface PromiseOption {
  key: PromiseKey;
  label: string;
  action: string;
}

export interface VisualizationSegment {
  /** 세그먼트 식별자 (1..12) */
  id: number;
  /** 시작 초 (0..180) */
  start: number;
  /** 종료 초 (0..180) */
  end: number;
  /** 화면 헤더에 노출되는 짧은 제목 */
  title: string;
  /** 동작 안내 한 줄 (눈을 감습니다 등) */
  guide: string;
  /** 본문 내레이션 — 모바일 가독성을 위해 줄바꿈 포함 */
  narration: string;
}

export interface VisualizationSession {
  id: string;
  title: string;
  subtitle: string;
  durationSeconds: 180;
  openingText: string;
  closingDeclaration: string;
  segments: VisualizationSegment[];
}

// ─────────────────────────────────────────────────────────────
// 2. 오늘의 마음 선택지
// ─────────────────────────────────────────────────────────────

export const MOOD_OPTIONS: MoodOption[] = [
  {
    key: "tired",
    label: "몸이 피곤합니다",
    response:
      "피곤한 몸으로도 여기까지 온 당신은\n이미 오늘의 첫 번째 승리를 만들었습니다.",
  },
  {
    key: "stressed",
    label: "스트레스가 많습니다",
    response:
      "오늘의 땀은 하루의 무게를 내려놓고\n다시 나를 회복하는 시간이 될 수 있습니다.",
  },
  {
    key: "awkward",
    label: "아직 어색합니다",
    response:
      "어색함은 시작의 증거입니다.\n익숙하지 않아도 괜찮습니다.\n오늘은 돌아온 것만으로 충분합니다.",
  },
  {
    key: "excited",
    label: "조금 설렙니다",
    response:
      "좋습니다. 오늘의 설렘을 몸의 리듬으로 바꾸고,\n153복싱짐에서 나만의 시간을 시작합니다.",
  },
  {
    key: "want_change",
    label: "나를 바꾸고 싶습니다",
    response:
      "변화는 거창한 결심보다\n오늘 한 번의 출석, 한 번의 호흡, 한 번의 재도전에서\n시작됩니다.",
  },
  {
    key: "future_leader",
    label: "언젠가 지도자까지 가보고 싶습니다",
    response:
      "좋은 지도자는 처음부터 완벽한 사람이 아니라,\n자신의 시작을 오래 기억하는 사람입니다.",
  },
];

// ─────────────────────────────────────────────────────────────
// 3. 오늘의 한 가지 마음가짐
// ─────────────────────────────────────────────────────────────

export const MINDSET_OPTIONS: MindsetOption[] = [
  {
    key: "return_to_self",
    label: "나는 다시 나에게 돌아온다",
    description:
      "오늘의 훈련은 나를 몰아붙이는 시간이 아니라,\n나를 다시 회복하는 시간입니다.",
  },
  {
    key: "no_compare",
    label: "나는 비교하지 않는다",
    description:
      "오늘의 상대는 다른 사람이 아니라 어제의 나입니다.\n내 속도로 충분합니다.",
  },
  {
    key: "one_more_time",
    label: "나는 한 번 더 해본다",
    description:
      "완벽하지 않아도 괜찮습니다.\n복싱인은 실패 후 다시 움직이는 사람입니다.",
  },
  {
    key: "respect_body",
    label: "나는 내 몸을 존중한다",
    description:
      "몸을 벌주기 위해 운동하는 것이 아니라,\n더 좋은 삶을 선물하기 위해 훈련합니다.",
  },
  {
    key: "becoming_boxer",
    label: "나는 복싱인이 되어간다",
    description:
      "복싱은 취미를 넘어 나의 태도, 나의 리듬,\n나의 삶의 방식이 되어갑니다.",
  },
];

// ─────────────────────────────────────────────────────────────
// 4. 오늘의 세 가지 실천 약속
// ─────────────────────────────────────────────────────────────

export const PROMISE_OPTIONS: PromiseOption[] = [
  {
    key: "breath_back",
    label: "숨이 차면 호흡으로 돌아오기",
    action: "힘든 순간에 3번 천천히 호흡하고 다시 시작합니다.",
  },
  {
    key: "guard_up",
    label: "손이 내려가면 다시 올리기",
    action: "코치가 말하기 전에 스스로 자세를 다시 세웁니다.",
  },
  {
    key: "no_compare_action",
    label: "다른 사람과 비교하지 않기",
    action: "오늘은 내 리듬, 내 기록, 내 감각에 집중합니다.",
  },
  {
    key: "listen_coach",
    label: "코치의 설명을 끝까지 듣기",
    action: "피드백을 방어하지 않고 배움으로 받아들입니다.",
  },
  {
    key: "retry_after_fail",
    label: "실패하면 한 번 더 하기",
    action: "틀린 동작을 피하지 않고 다시 시도합니다.",
  },
  {
    key: "record_emotion",
    label: "훈련 후 감정 기록하기",
    action: "오늘 가장 복싱인 같았던 순간을 한 문장으로 남깁니다.",
  },
  {
    key: "thank_self",
    label: "오늘의 나에게 고맙다고 말하기",
    action: "훈련이 끝난 뒤, 돌아온 나를 인정합니다.",
  },
];

// ─────────────────────────────────────────────────────────────
// 5. 3분 1라운드 시각화 세션 — 12 세그먼트 × 15초
// ─────────────────────────────────────────────────────────────

export const VISUALIZATION_SESSION: VisualizationSession = {
  // ⚠️ id 변경 금지 — localStorage 진행 기록 호환성 유지
  id: "myboxer-153-returned-person",
  title: "153복싱짐으로 돌아온 사람",
  subtitle: "153마인드셋 · 오늘의 훈련을 시작하는 3분 시각화",
  durationSeconds: 180,
  openingText:
    "지금부터 3분 동안,\n오늘의 몸과 마음을 153복싱짐에 맞춥니다.\n\n잘하려고 애쓰는 시간이 아니라,\n다시 나를 믿기 시작하는 시간입니다.",
  closingDeclaration:
    "나는 오늘도 153복싱짐으로 돌아왔다.\n나는 완벽하지 않아도 다시 시작하는 사람이다.\n나는 복싱인이 되어가는 중이다.",
  segments: [
    {
      id: 1,
      start: 0,
      end: 15,
      title: "오늘도 돌아온 나",
      guide: "눈을 천천히 감고, 여기까지 온 자신을 먼저 인정합니다.",
      narration:
        "하루가 길었습니다.\n몸은 무겁고, 마음은 아직\n바깥일에 붙잡혀 있을지도 모릅니다.\n\n그래도 당신은 오늘 다시\n153복싱짐으로 돌아왔습니다.\n\n그 자체로 이미 오늘의\n첫 번째 선택을 해낸 것입니다.",
    },
    {
      id: 2,
      start: 15,
      end: 30,
      title: "문 앞의 짧은 정적",
      guide: "153복싱짐 문 앞에 선 자신을 떠올립니다.",
      narration:
        "153복싱짐 문 앞에 서 있습니다.\n문 안쪽에서 따뜻한 빛이 새어 나옵니다.\n\n샌드백이 흔들리는 소리, 짧은 호흡,\n글러브가 맞닿는 소리가 들립니다.\n\n그 소리들은 당신을 재촉하지 않습니다.\n다만 조용히 말합니다.\n괜찮다, 다시 시작하면 된다.",
    },
    {
      id: 3,
      start: 30,
      end: 45,
      title: "하루를 내려놓는다",
      guide: "어깨와 턱의 힘을 천천히 빼봅니다.",
      narration:
        "문을 열기 전,\n오늘 하루의 무게를 잠시 내려놓습니다.\n\n해야 할 일, 신경 쓰이는 말,\n피곤함, 스트레스는\n지금 이 순간만큼은 밖에 둡니다.\n\n지금부터의 시간은\n남을 증명하는 시간이 아니라,\n나를 회복하는 시간입니다.",
    },
    {
      id: 4,
      start: 45,
      end: 60,
      title: "손을 준비하는 의식",
      guide: "손을 감싸고 준비하는 장면을 천천히 상상합니다.",
      narration:
        "손을 준비합니다.\n손목을 감싸고, 손가락 사이를 지나고,\n주먹을 가볍게 쥡니다.\n\n이것은 단순한 준비 동작이 아닙니다.\n오늘의 나를 함부로 대하지 않겠다는\n작은 약속입니다.\n\n몸이 조금씩 훈련의 시간을\n알아차리기 시작합니다.",
    },
    {
      id: 5,
      start: 60,
      end: 75,
      title: "거울 속의 사람",
      guide: "거울 앞에 선 자신을 바라봅니다.",
      narration:
        "거울 앞에 섭니다.\n거울 속의 당신은 완벽한 복서가 아닙니다.\n\n하지만 포기하지 않고 다시 돌아온 사람입니다.\n처음보다 조금 더 자연스럽게 서 있고,\n예전보다 조금 더\n자신을 바라볼 수 있는 사람입니다.\n\n그 정도면 오늘 시작하기에 충분합니다.",
    },
    {
      id: 6,
      start: 75,
      end: 90,
      title: "자세가 마음을 세운다",
      guide: "발을 안정되게 놓고, 턱을 살짝 당깁니다.",
      narration:
        "발을 안정되게 놓습니다.\n턱을 살짝 당기고,\n양손을 얼굴 앞으로 올립니다.\n\n자세를 세우는 순간,\n마음도 함께 세워집니다.\n\n당신은 오늘 잘하려고만 온 것이 아닙니다.\n무너진 하루 끝에서도 다시 나아질 수 있다는 것을\n몸으로 확인하러 왔습니다.",
    },
    {
      id: 7,
      start: 90,
      end: 105,
      title: "첫 번째 움직임",
      guide: "짧게 숨을 내쉬고, 첫 동작을 상상합니다.",
      narration:
        "짧게 숨을 내쉽니다.\n첫 잽이 나갑니다.\n빠르게 나갔다가 다시 돌아옵니다.\n\n아주 작은 움직임일 수 있습니다.\n하지만 당신은 느낍니다.\n\n멈춰 있던 몸이 깨어나고,\n흐려져 있던 마음이\n다시 한곳으로 모이기 시작합니다.",
    },
    {
      id: 8,
      start: 105,
      end: 120,
      title: "땀이 마음을 바꾼다",
      guide: "움직임 속에서 마음이 가벼워지는 감각을 떠올립니다.",
      narration:
        "한 번 더 움직입니다.\n다시 한 번 더 움직입니다.\n숨이 차오르고, 땀이 흐릅니다.\n\n그런데 이상하게 마음은 조금 가벼워집니다.\n\n오늘 당신을 무겁게 만들었던 것들이\n움직임 속에서 천천히 떨어져 나갑니다.",
    },
    {
      id: 9,
      start: 120,
      end: 135,
      title: "복싱이 좋아지는 순간",
      guide: "몇 달 뒤, 복싱이 기다려지는 자신을 상상합니다.",
      narration:
        "몇 달 뒤의 당신을 떠올립니다.\n퇴근 후 자연스럽게 가방을 챙기고,\n좋은 글러브를 알아보고,\n복싱 영상을 찾아봅니다.\n\n예전에는 운동이 숙제처럼 느껴졌지만,\n이제는 153복싱짐에 가는 시간이\n하루의 작은 낭만이 됩니다.",
    },
    {
      id: 10,
      start: 135,
      end: 150,
      title: "복싱인이 되어가는 나",
      guide: "복싱이 삶의 태도가 되는 장면을 떠올립니다.",
      narration:
        "조금 더 시간이 흐릅니다.\n당신은 이제 동작을 따라 하는 사람에서,\n의미를 이해하는 사람이 되어갑니다.\n\n거리, 호흡, 타이밍, 자세의 이유가\n조금씩 보입니다.\n\n복싱은 몸만 바꾸는 것이 아니라,\n당신이 하루를 버티고\n다시 회복하는 방식을 바꿉니다.",
    },
    {
      id: 11,
      start: 150,
      end: 165,
      title: "누군가의 시작을 이해하는 사람",
      guide: "처음 온 회원을 따뜻하게 바라보는 자신을 상상합니다.",
      narration:
        "어느 날, 처음 온 회원이\n어색한 표정으로 서 있습니다.\n\n당신은 그 마음을 압니다.\n당신도 처음엔 그랬기 때문입니다.\n\n그래서 마음속으로 조용히 말할 수 있습니다.\n괜찮습니다.\n처음부터 잘하는 사람보다,\n다시 돌아오는 사람이 오래 갑니다.",
    },
    {
      id: 12,
      start: 165,
      end: 180,
      title: "오늘의 153마인드셋",
      guide: "마지막으로 오늘의 선언을 마음속으로 말합니다.",
      narration:
        "이제 당신은 압니다.\n복싱은 강한 척하는 시간이 아니라,\n나를 다시 세우는 시간입니다.\n\n153복싱짐으로 돌아오는 날들이 쌓이면,\n당신은 운동하는 사람을 넘어\n복싱을 삶에 품은 사람이 됩니다.\n\n오늘도 그 길의 한 장면이 시작됩니다.",
    },
  ],
};

// ─────────────────────────────────────────────────────────────
// 6. 헬퍼
// ─────────────────────────────────────────────────────────────

export function getMoodOption(key: MoodKey): MoodOption | null {
  return MOOD_OPTIONS.find((m) => m.key === key) ?? null;
}

export function getMindsetOption(key: MindsetKey): MindsetOption | null {
  return MINDSET_OPTIONS.find((m) => m.key === key) ?? null;
}

export function getPromiseOption(key: PromiseKey): PromiseOption | null {
  return PROMISE_OPTIONS.find((p) => p.key === key) ?? null;
}

/**
 * 경과 초로 현재 활성 세그먼트를 반환. (start ≤ elapsed < end)
 * 마지막 세그먼트는 elapsed === durationSeconds 일 때도 활성 유지.
 *
 * @param elapsedSec 경과 초
 * @param session 대상 세션 (미지정 시 단기 세션)
 */
export function getActiveSegment(
  elapsedSec: number,
  session: VisualizationSession = VISUALIZATION_SESSION,
): VisualizationSegment {
  const segs = session.segments;
  for (const seg of segs) {
    if (elapsedSec >= seg.start && elapsedSec < seg.end) return seg;
  }
  return segs[segs.length - 1];
}

// ─────────────────────────────────────────────────────────────
// 7. 장기 시각화 세션 — 1년 뒤, 나는 복싱인이 되어 있다
// ─────────────────────────────────────────────────────────────

export const LONG_TERM_VISUALIZATION_SESSION: VisualizationSession = {
  id: "myboxer-153-one-year-later",
  title: "1년 뒤, 나는 복싱인이 되어 있다",
  subtitle: "성인 회원용 3분 1라운드 장기 시각화",
  durationSeconds: 180,
  openingText:
    "지금부터 1년 뒤의 나를 상상합니다.\n153복싱짐에 꾸준히 돌아온 내가\n어떤 사람이 되어 있는지\n마음속에서 먼저 만나봅니다.",
  closingDeclaration:
    "나는 오늘도 153복싱짐으로 돌아왔다.\n나는 복싱인이 되어가는 중이다.\n언젠가 나는 누군가의 시작을\n도울 수 있는 사람이 된다.",
  segments: [
    {
      id: 1,
      start: 0,
      end: 15,
      title: "1년 뒤의 저녁",
      guide: "눈을 감고 1년 뒤의 자신을 천천히 떠올립니다.",
      narration:
        "눈을 천천히 감습니다.\n1년 뒤의 당신을 떠올립니다.\n\n퇴근 후, 당신은 자연스럽게 운동 가방을 챙깁니다.\n예전에는 피곤하면 바로 집으로 향했지만,\n이제는 압니다.\n\n153복싱짐에 다녀온 날의 내가\n조금 더 가볍고, 조금 더 단단하고,\n조금 더 나답다는 것을.",
    },
    {
      id: 2,
      start: 15,
      end: 30,
      title: "익숙한 문",
      guide: "153복싱짐의 익숙한 공기를 느낍니다.",
      narration:
        "당신은 153복싱짐 문을 엽니다.\n익숙한 공기, 익숙한 매트,\n익숙한 샌드백 소리, 코치의 목소리,\n함께 훈련하는 사람들의 호흡이 느껴집니다.\n\n처음 왔을 때는 모든 것이 낯설었지만,\n지금 이 공간은\n당신의 하루를 다시 세우는 장소가 되었습니다.",
    },
    {
      id: 3,
      start: 30,
      end: 45,
      title: "처음의 나를 기억한다",
      guide: "처음 왔던 날의 어색함을 부드럽게 떠올립니다.",
      narration:
        "처음 왔을 때의 당신을 떠올립니다.\n어디에 서야 할지, 손은 어떻게 올려야 할지,\n내가 잘하고 있는지조차 알 수 없었습니다.\n\n하지만 그 어색함 속에서도\n당신은 계속 돌아왔습니다.\n그 반복이 지금의 당신을 만들었습니다.",
    },
    {
      id: 4,
      start: 45,
      end: 60,
      title: "익숙해진 준비",
      guide: "핸드랩과 글러브의 감각을 차분히 상상합니다.",
      narration:
        "핸드랩을 감는 손이 익숙합니다.\n가방에서 글러브를 꺼내는 동작이 자연스럽습니다.\n\n거울 앞에 서면,\n예전보다 자세가 조금 더 안정되어 있습니다.\n\n당신은 더 이상 완벽한 사람을 흉내 내지 않습니다.\n당신은 당신의 속도를 압니다.",
    },
    {
      id: 5,
      start: 60,
      end: 75,
      title: "오늘도 오셨네요",
      guide: "오늘도 왔다는 사실을 천천히 받아들입니다.",
      narration:
        "코치가 말합니다.\n오늘도 오셨네요.\n\n당신은 조용히 웃습니다.\n그 한마디가 좋습니다.\n\n오늘도 왔다는 것.\n오늘도 돌아왔다는 것.\n오늘도 나를 포기하지 않았다는 것.\n\n그 사실만으로도 당신은\n이미 복싱인의 하루를 살고 있습니다.",
    },
    {
      id: 6,
      start: 75,
      end: 90,
      title: "몸이 깨어나는 시간",
      guide: "몸이 살아나는 감각을 따라갑니다.",
      narration:
        "훈련이 시작됩니다.\n처음에는 몸이 무겁습니다.\n\n하지만 첫 동작이 지나고,\n두 번째 동작이 지나고,\n호흡이 올라오고, 땀이 흐르기 시작하면\n당신은 다시 살아나는 감각을 느낍니다.\n\n하루 동안 쌓였던 스트레스가\n움직임 속에서 조금씩 풀립니다.",
    },
    {
      id: 7,
      start: 90,
      end: 105,
      title: "복싱이 삶에 들어온다",
      guide: "복싱이 일상에 자리 잡은 모습을 봅니다.",
      narration:
        "당신은 이제 복싱을\n단순한 운동으로만 느끼지 않습니다.\n\n복싱은 당신에게\n하루를 정리하는 방식입니다.\n몸을 깨우는 방식입니다.\n나를 다시 존중하는 방식입니다.\n\n153복싱짐은 단순한 운동 공간이 아니라,\n당신이 당신 자신으로 돌아오는 공간이 되었습니다.",
    },
    {
      id: 8,
      start: 105,
      end: 120,
      title: "새로 온 회원",
      guide: "처음 온 사람의 마음을 떠올려 봅니다.",
      narration:
        "어느 순간, 새로 온 회원이\n옆에서 어색하게 서 있습니다.\n\n그 사람의 표정을 보자마자\n당신은 알 수 있습니다.\n처음의 당신도 그랬기 때문입니다.\n\n무엇을 해야 할지 모르던 마음,\n남들보다 못할까 봐 걱정하던 마음,\n실수할까 봐 망설이던 마음을\n당신은 기억합니다.",
    },
    {
      id: 9,
      start: 120,
      end: 135,
      title: "복싱 매니아가 된 나",
      guide: "복싱이 즐거운 낭만이 된 자신을 봅니다.",
      narration:
        "당신은 이제 복싱 매니아가 되어갑니다.\n좋은 글러브를 알아봅니다.\n복싱 영상을 봅니다.\n\n기술의 이름을 하나씩 이해합니다.\n코치의 설명이 조금씩 다르게 들립니다.\n몸이 먼저 반응하는 순간이 생깁니다.\n\n복싱은 어느새\n당신의 즐거운 낭만이 되었습니다.",
    },
    {
      id: 10,
      start: 135,
      end: 150,
      title: "복싱인의 눈",
      guide: "복싱인이 된 자신의 눈으로 세상을 봅니다.",
      narration:
        "그리고 어느 날, 당신은 깨닫습니다.\n나는 이제 복싱을 하는 사람이 아니라,\n복싱을 삶의 일부로 가진 사람이 되어가고 있다.\n\n조급하지 않게,\n무너지지 않게,\n다시 자세를 세우며,\n다시 호흡을 찾으며,\n\n다시 153복싱짐으로 돌아오며\n당신은 복싱인이 되어갑니다.",
    },
    {
      id: 11,
      start: 150,
      end: 165,
      title: "누군가를 세우는 사람",
      guide: "누군가에게 복싱을 알려주는 자신을 떠올립니다.",
      narration:
        "더 먼 미래의 당신을 떠올립니다.\n누군가에게 복싱을 알려주는 당신.\n\n처음 온 사람의 긴장을 알아차리는 당신.\n실패한 사람에게\n다시 해볼 수 있다고 말해주는 당신.\n\n강함을 과시하는 사람이 아니라,\n사람을 다시 움직이게 만드는 사람.\n그것이 지도자의 시작입니다.",
    },
    {
      id: 12,
      start: 165,
      end: 180,
      title: "오늘이 시작이다",
      guide: "오늘의 출석이 모든 것의 시작임을 받아들입니다.",
      narration:
        "좋은 지도자는 기술만 전달하지 않습니다.\n좋은 지도자는\n누군가가 자기 자신을 다시 믿도록 돕습니다.\n\n당신은 언젠가 그런 사람이 될 수 있습니다.\n\n오늘의 출석이 그 시작입니다.\n오늘의 호흡이 그 시작입니다.\n오늘 153복싱짐으로 돌아온\n이 순간이 그 시작입니다.",
    },
  ],
};

// ─────────────────────────────────────────────────────────────
// 8. 세션 카탈로그 — 모든 세션 묶음
// ─────────────────────────────────────────────────────────────

export const VISUALIZATION_SESSIONS: VisualizationSession[] = [
  VISUALIZATION_SESSION,
  LONG_TERM_VISUALIZATION_SESSION,
];

export function getSessionById(id: string): VisualizationSession | null {
  return VISUALIZATION_SESSIONS.find((s) => s.id === id) ?? null;
}
