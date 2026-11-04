// 📈 153 코치 수업 관찰 — 오삼코치로 다듬기 (chat-assistant action "coach-observe-polish", 2026-11-05 대표님
//   「153마이복서에 최고성능 프롬프트로 상세하게 만들자」)
//   대표님 · 지점장님이 수업을 보고 적은 짧은 메모 + 다섯 가지 점검표 → 잘한 것 2 · 바꿀 것 1.
//   Deno 를 쓰지 않는 순수 TS — 앱 테스트(src/lib/coachFeedback.test.ts)가 그대로 불러 검사한다.

export type Mark = "y" | "s" | "n";

export interface FeedbackStd {
  no: number;
  title: string;
  how: string;
}

export interface FeedbackInput {
  standards: FeedbackStd[];
  marks: Record<string, Mark>;
  memo: string;
  coachName: string;
}

export interface FeedbackResult {
  good1: string;
  good2: string;
  fix1: string;
  fix_no: number | null;
}

const MARK_WORD: Record<Mark, string> = { y: "했어요", s: "조금", n: "못 했어요" };

export const FEEDBACK_LIMITS = { good: 90, fix: 120, error: 60 } as const;

/** 쓰면 안 되는 말 — 탓하기 · 평가 낱말 (다듬은 글 어디에도) */
export const BLAME_WORDS = ["부족", "실망", "왜 안", "못하셨", "최악", "한심", "게으"];

export function buildFeedbackSystem(standards: FeedbackStd[]): string {
  const list = standards.map((s) => `${s.no}. ${s.title} — ${s.how}`).join("\n");
  return `너는 일오삼(153)복싱짐 대표님의 '수업 관찰 피드백' 정리 비서다. 대표님이나 지점장님이 코치님 수업을 보고 적은 짧은 메모와 다섯 가지 점검표를, 코치님이 다음 수업에서 바로 쓸 수 있는 피드백으로 다듬는다.

[153 코치 기준]
${list}

[목표]
코치님이 읽고 '대표님이 내가 잘한 걸 보셨구나' 느끼고, 다음 수업에서 바꿀 한 가지를 정확히 아는 것. 153의 약속은 '짧은 시간 안에 회원님께 행복을'이다.

[규칙]
1. 잘한 것 1~2개(good1 · good2): 메모와 점검표에 있는 사실만 쓴다. '행동 + 회원에게 생긴 일'로 쓴다. 예: "회원마다 이름을 불러 주셔서 수업 내내 분위기가 밝았어요". 메모에 없는 사실 · 숫자 · 사람 이름을 지어내지 않는다. 근거가 하나뿐이면 good2는 빈 문자열.
2. 바꿀 것은 정확히 1개(fix1): 점검표에서 '못 했어요'나 '조금'인 기준 중 회원에게 가장 영향이 큰 것 하나. 메모가 다른 것을 짚으면 메모를 따른다. '~해 주세요' 꼴의 행동 하나 + 다음 수업에서 그대로 쓸 수 있는 말 한 줄을 큰따옴표로 붙인다. 예: 처음 온 회원께 끝나고 "다음엔 언제 오세요?" 물어봐 주세요.
3. 탓하지 않는다: 부족 · 실망 · 왜 안 · 못하셨 · 최악 같은 비난 · 평가 낱말은 쓰지 않는다. 사람이 아니라 행동을 말한다.
4. 말투: 대표님이 코치님께 — 따뜻한 해요체 존댓말. 잘한 것은 한 항목 60자 안팎(최대 ${FEEDBACK_LIMITS.good}자), 바꿀 것은 따옴표 말까지 최대 ${FEEDBACK_LIMITS.fix}자. 이모지는 쓰지 않는다.
5. fix_no는 바꿀 것과 연결된 기준 번호다(위 목록의 번호 하나).
6. 메모가 비었거나 근거가 모자라면 점검표의 '했어요' 기준을 근거로 good1을 쓴다. 그것도 없으면 다른 칸은 빈 값으로 두고 error에 "메모를 한두 줄만 더 적어 주세요"를 쓴다.
7. 회원 실명은 메모에 있으면 그대로 둘 수 있지만 새로 만들지 않는다. 전화번호 · 주소 같은 개인정보는 쓰지 않는다. 회원의 건강 · 부상 이야기는 옮기지 않는다.

[출력] 설명 없이 JSON 하나만: {"good1":"…","good2":"…","fix1":"…","fix_no":3,"error":""}`;
}

export const FEEDBACK_SCHEMA = {
  type: "object",
  properties: {
    good1: { type: "string" },
    good2: { type: "string" },
    fix1: { type: "string" },
    fix_no: { type: "integer" },
    error: { type: "string" },
  },
  required: ["good1", "good2", "fix1", "fix_no", "error"],
  additionalProperties: false,
};

export function buildFeedbackUser(input: FeedbackInput): string {
  const marks = input.standards
    .map((s) => {
      const m = input.marks[String(s.no)];
      return `${s.no}. ${s.title}: ${m ? MARK_WORD[m] : "표시 안 함"}`;
    })
    .join("\n");
  const memo = input.memo.trim() || "(메모 없음)";
  return `[코치님] ${input.coachName || "코치님"}\n[점검표]\n${marks}\n[대표님 메모]\n${memo}`;
}

/** 화면이 보낸 점검표만 남긴다 — 1~9번 · y/s/n */
export function cleanMarks(raw: unknown): Record<string, Mark> {
  const out: Record<string, Mark> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (/^[1-9]$/.test(k) && (v === "y" || v === "s" || v === "n")) out[k] = v;
  }
  return out;
}

const EMOJI_RE = /\p{Extended_Pictographic}️?/gu;
const PHONE_RE = /01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/;

const tidy = (v: unknown): string => (typeof v === "string" ? v.replace(EMOJI_RE, "").replace(/\s+/g, " ").trim() : "");

/** 숫자는 메모에 있던 것만 — 지어낸 인원 · 시간이 들어가지 않게 */
function inventedDigits(text: string, memo: string): boolean {
  const memoDigits = new Set(memo.match(/\d+/g) ?? []);
  return (text.match(/\d+/g) ?? []).some((d) => !memoDigits.has(d));
}

export type FeedbackCheck = { ok: true; result: FeedbackResult } | { ok: false; reason: string; message?: string };

/** 모델이 낸 JSON 검사 — 모양 · 길이 · 탓하는 말 · 전화번호 · 지어낸 숫자 */
export function checkFeedback(raw: unknown, ctx: { memo: string; stdNos: number[] }): FeedbackCheck {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "shape" };
  const r = raw as Record<string, unknown>;
  const err = tidy(r.error);
  const good1 = tidy(r.good1);
  const good2 = tidy(r.good2);
  const fix1 = tidy(r.fix1);
  if (err && !good1) return { ok: false, reason: "model_error", message: err.slice(0, FEEDBACK_LIMITS.error) };
  if (!good1 || !fix1) return { ok: false, reason: "empty" };
  if (good1.length > FEEDBACK_LIMITS.good || good2.length > FEEDBACK_LIMITS.good || fix1.length > FEEDBACK_LIMITS.fix) {
    return { ok: false, reason: "too_long" };
  }
  const all = [good1, good2, fix1].join(" ");
  if (BLAME_WORDS.some((w) => all.includes(w))) return { ok: false, reason: "blame" };
  if (PHONE_RE.test(all)) return { ok: false, reason: "phone" };
  if (inventedDigits(all, ctx.memo)) return { ok: false, reason: "digits" };
  const no = typeof r.fix_no === "number" && Number.isInteger(r.fix_no) && ctx.stdNos.includes(r.fix_no) ? r.fix_no : null;
  return { ok: true, result: { good1, good2, fix1, fix_no: no } };
}

/** 모델 글에서 JSON 한 덩어리 꺼내기 */
export function parseFeedbackJson(text: string): unknown {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try {
    return JSON.parse(text.slice(a, b + 1));
  } catch {
    return null;
  }
}
