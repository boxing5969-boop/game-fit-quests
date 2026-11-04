// 📈 153 코치 수업 관찰 — 오삼코치로 다듬기 (chat-assistant action "coach-observe-polish", 2026-11-05 대표님
//   「153마이복서에 최고성능 프롬프트로 상세하게 만들자」)
//   대표님 · 지점장님이 수업을 보고 적은 짧은 메모 + 다섯 가지 점검표 → 잘한 것 2 · 바꿀 것 1.
//   Deno 를 쓰지 않는 순수 TS — 앱 테스트(src/lib/coachFeedback.test.ts)가 그대로 불러 검사한다.

export type Mark = "y" | "s" | "n";

export interface FeedbackStd {
  no: number;
  title: string;
  how: string;
  /** 기준의 예시 말 — 한 줄에 하나("…"), 바꿀 것의 따옴표 말에 쓴다 */
  say?: string;
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

/** 지시문에 넣는 예시 한 벌 — 이 예시 답도 checkFeedback 을 통과해야 한다(테스트가 확인) */
export const FEEDBACK_EXAMPLE = {
  marks:
    "1. 이름을 불러요: 했어요\n2. 시작과 끝은 인사로: 했어요\n3. 칭찬은 구체적으로: 조금\n4. 처음 온 회원을 먼저: 못 했어요\n5. 다음 목표를 알려줘요: 표시 안 함",
  memo: "이름 잘 부름. 체험 오신 분 끝나고 그냥 보냄",
  output: {
    good1: "회원마다 이름을 불러 주셔서 수업 내내 분위기가 밝았어요",
    good2: "들어오고 나갈 때 한 분씩 인사해 주셔서 수업의 시작과 끝이 따뜻했어요",
    fix1: '체험 오신 분께 끝나고 "다음엔 언제 오세요? 그날 제가 또 봐 드릴게요" 하고 다음 방문 날을 같이 정해 주세요',
    fix_no: 4,
    error: "",
  },
} as const;

/** 기준의 예시 말(줄마다 하나)을 한 줄로 */
const sayLine = (say?: string): string => {
  const lines = (say ?? "").split(/\n+/).map((x) => x.trim()).filter(Boolean);
  return lines.length ? `\n   예시 말: ${lines.join(" / ")}` : "";
};

export function buildFeedbackSystem(standards: FeedbackStd[]): string {
  const list = standards.map((s) => `${s.no}. ${s.title} — ${s.how}${sayLine(s.say)}`).join("\n");
  const ex = FEEDBACK_EXAMPLE;
  return `너는 일오삼(153)복싱짐의 '수업 관찰 피드백' 정리 비서다. 대표님이나 지점장님이 코치님 수업을 보고 적은 짧은 메모와 다섯 가지 점검표를, 코치님이 다음 수업에서 바로 쓸 수 있는 피드백(잘한 것 2 · 바꿀 것 1)으로 다듬는다.

[153 코치 기준]
${list}

[목표]
코치님이 읽고 '내가 잘한 걸 보셨구나' 느끼고, 다음 수업에서 바꿀 한 가지를 정확히 아는 것. 153의 약속은 '짧은 시간 안에 회원님께 행복을'이다 — 바꿀 것은 이 약속에 가장 크게 다가가는 한 걸음으로 고른다.

[규칙]
1. 잘한 것 1~2개(good1 · good2): 메모와 점검표에 있는 사실만, '코치님의 행동 + 회원에게 생긴 일'로 쓴다. 예: "회원마다 이름을 불러 주셔서 수업 내내 분위기가 밝았어요". '좋았어요 · 수고하셨어요'처럼 무엇을 했는지 없는 칭찬은 쓰지 않는다. 근거가 하나뿐이면 good2는 빈 문자열.
2. 바꿀 것은 정확히 1개(fix1): 메모가 짚은 것이 있으면 그것, 없으면 점검표의 '못 했어요'를 '조금'보다 먼저 — 그중 회원에게 가장 영향이 큰 것 하나. 모두 '했어요'이고 메모에도 고칠 점이 없으면 회원이 더 행복해질 다음 한 걸음 하나. '~해 주세요' 꼴의 행동 하나 + 다음 수업에서 그대로 쓸 수 있는 말 한 줄을 큰따옴표로 붙인다(위 기준의 예시 말을 쓰거나 상황에 맞게 바꿔도 된다). 예: 처음 온 회원께 끝나고 "다음엔 언제 오세요?" 물어봐 주세요.
3. 지어내지 않는다: 메모에 없는 사실 · 사람 이름 · 숫자(인원 · 횟수 · 시간)를 만들지 않는다. 숫자는 메모에 있던 것만 쓴다.
4. 탓하지 않는다: 부족 · 실망 · 왜 안 · 못하셨 · 최악 같은 비난 · 평가 낱말은 쓰지 않는다. 사람이 아니라 행동을 말한다.
5. 말투: 관찰한 분이 코치님께 — 따뜻한 해요체 존댓말. 잘한 것은 한 항목 60자 안팎(최대 ${FEEDBACK_LIMITS.good}자), 바꿀 것은 따옴표 말까지 최대 ${FEEDBACK_LIMITS.fix}자. 이모지는 쓰지 않는다.
6. fix_no는 바꿀 것과 연결된 기준 번호다(위 목록의 번호 하나).
7. 메모가 비었거나 근거가 모자라면 점검표의 '했어요' 기준을 근거로 good1을 쓴다. 그것도 없으면 다른 칸은 빈 값으로 두고 error에 "메모를 한두 줄만 더 적어 주세요"를 쓴다.
8. 회원 실명은 메모에 있으면 그대로 둘 수 있지만 새로 만들지 않는다. 전화번호 · 주소 같은 개인정보는 쓰지 않는다. 회원의 건강 · 부상 이야기는 옮기지 않는다.

[예시 — 모양만 참고하고, 기준 이름 · 번호는 위 목록을 따른다]
점검표:
${ex.marks}
메모: ${ex.memo}
답: ${JSON.stringify(ex.output)}

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
  return `[코치님] ${input.coachName || "코치님"}\n[점검표]\n${marks}\n[관찰 메모]\n${memo}`;
}

/** 숫자 검사에서 써도 되는 글 — 기준 이름 · 하는 법 · 예시 말 (기준을 고쳐 숫자를 넣어도 막히지 않게) */
export const stdAllowText = (standards: FeedbackStd[]): string =>
  standards.map((s) => `${s.title} ${s.how} ${s.say ?? ""}`).join(" ");

const RETRY_NOTE: Record<string, string> = {
  digits: "메모에 없는 숫자가 들어갔어요. 숫자는 메모에 있던 것만 쓰세요.",
  blame: "탓하는 말이 들어갔어요. 사람이 아니라 행동을 부드럽게 말하세요.",
  too_long: `너무 길어요. 잘한 것은 60자 안팎, 바꿀 것은 ${FEEDBACK_LIMITS.fix}자 안으로 줄이세요.`,
  phone: "전화번호가 들어갔어요. 개인정보는 빼세요.",
  empty: "good1 과 fix1 을 꼭 채우세요.",
};

/** 검사에 걸려 다시 쓸 때 붙이는 말 — 무엇이 걸렸는지 알려 주면 두 번째 답이 맞을 때가 많다 */
export function retryNote(reason: string): string {
  return `[다시 쓰기] 앞 답은 쓸 수 없어요 — ${RETRY_NOTE[reason] ?? "규칙을 다시 확인하세요."} 나머지 규칙도 그대로 지켜 JSON 하나만 다시 내세요.`;
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

/** 숫자는 메모(와 기준 글 · 153)에 있던 것만 — 지어낸 인원 · 시간이 들어가지 않게 */
function inventedDigits(text: string, allowed: string): boolean {
  const ok = new Set(allowed.match(/\d+/g) ?? []);
  return (text.match(/\d+/g) ?? []).some((d) => !ok.has(d));
}

export type FeedbackCheck = { ok: true; result: FeedbackResult } | { ok: false; reason: string; message?: string };

/** 모델이 낸 JSON 검사 — 모양 · 길이 · 탓하는 말 · 전화번호 · 지어낸 숫자 (allow = 숫자를 써도 되는 기준 글) */
export function checkFeedback(raw: unknown, ctx: { memo: string; stdNos: number[]; allow?: string }): FeedbackCheck {
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
  if (inventedDigits(all, `${ctx.memo} ${ctx.allow ?? ""} 153`)) return { ok: false, reason: "digits" };
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
