// 만족도 조사 자동 답변 · 의견 알림 — 판정과 답변 문장 (2026-10-30 대표님)
//   "의견 없고 긍정적인 답변만 하신 분들에게는 하루 지나고 내가 남긴 것처럼 비슷하게 대신 남겨 줘 — 항상 건강과 행복을 바란다,
//    노력하는 체육관이 되겠다는 마무리 인사, AI 티 나지 않게 내가 쓴 것처럼 다양하게.
//    의견이나 개선됐으면 좋겠다고 한 것은 나한테 알림으로."
//   Deno(Edge Function)와 vitest 가 같이 쓰는 순수 함수만 둔다 — 바깥 모듈을 import 하지 않는다.

export interface AnswerIn {
  type: string; // rating | multiple_choice | yes_no | text
  question: string;
  text: string | null;
  score: number | null;
  max: number | null;
  /** 보기 목록 — QR · 예전 응답은 보기 글 없이 번호(score)만 남아 있다 */
  choices?: string[] | null;
}

export interface PositiveFlags {
  recommend: boolean;
  coachTop: boolean;
  /** 만료 회원 설문 '다시 이용하실 의향' 예 */
  comeback: boolean;
}
export type Verdict = ({ kind: "positive" } & PositiveFlags) | { kind: "opinion"; reasons: string[] };

/** 적었지만 의견이 아닌 글 — "없음", "-", "특별히 없습니다" 같은 것 */
const TRIVIAL = /^(없(음|어요|습니다|다|당)?|x|-+|\.+|무|ㄴㄴ|no|none|특별히\s*없(음|어요|습니다|다)?)\s*[.!~^]*$/i;
/** 보기 중 의견이 아닌 쪽 — '특별히 없습니다' · 만료 회원 설문의 '개인 사정(이사·부상·직장 등)' */
const NOTHING_CHOICE = /특별히\s*없|없습니다|없음|개인\s*사정/;

/** 보기 답 글 — 글이 없으면 번호로 보기에서 찾는다 */
export const choiceLabel = (a: AnswerIn): string => {
  const t = (a.text ?? "").trim();
  if (t) return t;
  if (a.score != null && a.choices && a.score >= 1 && a.score <= a.choices.length) return a.choices[a.score - 1];
  return "";
};

const short = (s: string, n = 40) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** 긍정만 = 별점 모두 5점 만점에 4점 이상 · 보기는 '특별히 없습니다' · 적은 글 없음 · '아니오' 없음. 하나라도 아니면 의견. */
export function classify(answers: AnswerIn[]): Verdict {
  const reasons: string[] = [];
  let recommend = false;
  let coachTop = false;
  let comeback = false;
  for (const a of answers) {
    const t = (a.text ?? "").trim();
    if (a.type === "rating") {
      if (a.score == null) continue;
      const max = a.max && a.max > 0 ? a.max : 5;
      if (a.score / max < 0.8) reasons.push(`${short(a.question, 16)} ${a.score}점`);
      if (/코치/.test(a.question) && a.score >= max) coachTop = true;
    } else if (a.type === "multiple_choice") {
      const label = choiceLabel(a);
      if (label && !NOTHING_CHOICE.test(label)) reasons.push(`선택: ${label}`);
    } else if (a.type === "yes_no") {
      if (t === "아니오") reasons.push(`${short(a.question, 16)} 아니오`);
      if (t === "예" && /추천/.test(a.question)) recommend = true;
      if (t === "예" && /다시/.test(a.question)) comeback = true;
    } else if (t && !TRIVIAL.test(t)) {
      reasons.push(`“${short(t)}”`);
    }
  }
  return reasons.length ? { kind: "opinion", reasons } : { kind: "positive", recommend, coachTop, comeback };
}

// ── 답변 문장 — 대표님이 직접 단 답변 말투(짧게 · 감사 · 건강·행복 · 노력하는 체육관 · ^^ ~ !) ──
const OPEN = [
  "참여해주셔서 감사합니다!",
  "좋은 평가 감사합니다~",
  "바쁘신데 참여해주셔서 감사합니다",
  "좋게 봐주셔서 정말 감사합니다!",
  "설문 참여해주셔서 감사해요^^",
  "따뜻한 평가 남겨주셔서 감사합니다",
  "저희도 매일매일 감사합니다!",
  "좋은 점수 주셔서 감사합니다~",
];
const MID_RECOMMEND = ["추천까지 해주신다니 더 힘이 나네요!", "주변에 추천해주신다니 정말 감사합니다", "추천해주신다는 말씀에 저희도 힘이 납니다"];
const MID_COACH = ["코치님들께도 꼭 전해드릴게요", "코치님들도 들으면 정말 좋아하실 거예요^^"];
const MID_COMEBACK = ["언제든 다시 오시면 반갑게 맞이하겠습니다", "다시 뵐 날 기다리고 있을게요^^"];
const MID_PLAIN = ["덕분에 저희도 힘이 납니다", "앞으로도 즐겁게 운동하실 수 있게 신경 쓰겠습니다"];
const HEALTH = [
  "항상 건강하시고 행복하세요!",
  "늘 건강하고 행복하세요^^",
  "153과 함께 건강하고 행복한 하루하루 되세요!",
  "늘 건강과 행복을 응원하겠습니다",
  "항상 건강과 행복이 함께하시길 바랍니다",
  "오늘도 건강하고 행복한 하루 보내세요~",
];
const CLOSE = [
  "더 노력하는 체육관 되겠습니다!",
  "회원님들을 위해 노력하는 체육관 되겠습니다.",
  "앞으로도 더 노력하는 153 되겠습니다^^",
  "실망시키지 않게 더 노력하는 체육관 되겠습니다!",
  "더 좋은 체육관 되도록 노력하겠습니다.",
  "변함없이 노력하는 체육관 되겠습니다!",
];

/** 응답 번호로 정해지는 수 — 같은 응답은 다시 돌려도 같은 문장 */
function seedOf(id: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const pick = <T,>(arr: readonly T[], n: number): T => arr[n % arr.length];

/** 긍정 응답 답변 — 감사 + (추천·코치·일반 한마디) + 건강·행복 + 노력하는 체육관. salt 를 바꾸면 다른 문장 */
export function composeReply(id: string, v: Partial<PositiveFlags>, salt = 0): string {
  const r = (k: number) => seedOf(id, salt * 31 + k);
  const parts = [pick(OPEN, r(1))];
  const special = [...(v.comeback ? MID_COMEBACK : []), ...(v.recommend ? MID_RECOMMEND : []), ...(v.coachTop ? MID_COACH : [])];
  const mids = special.length ? special : MID_PLAIN;
  const midChance = special.length ? 70 : 40;
  if (r(2) % 100 < midChance) parts.push(pick(mids, r(3)));
  const health = pick(HEALTH, r(4));
  const close = pick(CLOSE, r(5));
  if (r(6) % 100 < 70) parts.push(health, close);
  else parts.push(close, health);
  return parts.join(" ");
}

/** 한국 시각(시) — 자동 답변은 9~21시, 의견 알림은 8~22시에만 */
export const kstHour = (d: Date) => (d.getUTCHours() + 9) % 24;
