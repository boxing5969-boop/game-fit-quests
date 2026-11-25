// 🧭 153 회원 성향 검사 · 코치용 지도 카드 — 문항 · 채점 · 오삼코치 지시문 · 답 검사 한 곳
//   (2026-11-25 대표님 「회원님들도 mbti 검사를 통해 … 코치님들이 회원님들의 성격 성향을 빠르게 파악하여 거기에 맞게 지도할수있도록」)
//
//   · 문항은 여기 한 곳 — 화면(src/lib/memberStyle.ts)이 그대로 쓰고, DB member_style_save 는 키 모양 · 값 범위만 본다.
//   · 세 묶음: 16유형 4축(16문항 · 5점) · 다섯 가지 성격(10문항 · 5점, 요인마다 바른 문항 + 거꾸로 문항) · 복싱 지도 선호(10문항 · 고르기)
//     16유형은 공식 MBTI® 검사가 아닌 153 자체 문항 — 화면에는 「153 성향 16유형(MBTI 방식)」 · 다섯 가지 성격은 빅파이브 이론의 짧은 판.
//   · 원칙: 유형 이름으로 사람을 규정하지 않는다. 16유형 · 다섯 가지 성격이 부딪히면 다섯 가지 성격과 실제 출석 기록이 먼저.
//     카드에는 진단 · 병명 · 마음 상태 추측을 쓰지 않는다. 확정(답 · 기록) / 추정(해석) / 불명확(자료 부족)을 나눠 적는다.
//   · 쓰는 곳: Edge Function member-style(카드 만들기) · 화면(검사 · 결과 · 코치 카드).
//   Deno 를 쓰지 않는 순수 TS — 앱 테스트가 그대로 불러 검사한다.

import { KO_STYLE } from "./koStyle.ts";

/* ───────────────────────── 문항 ───────────────────────── */

export type StyleAxis = "EI" | "SN" | "TF" | "JP";
export type Big5 = "O" | "C" | "E" | "A" | "N";

export interface ScaleItem {
  id: string;
  text: string;
  /** 16유형: 동의할수록 앞 글자(E · S · T · J) 쪽이면 +1, 뒤 글자 쪽이면 -1 */
  axis?: StyleAxis;
  /** 다섯 가지 성격: 동의할수록 그 요인이 높으면 +1, 거꾸로 문항이면 -1 */
  big5?: Big5;
  dir: 1 | -1;
}

export interface ChoiceItem {
  id: string;
  title: string;
  name: string;
  options: Array<{ v: string; label: string }>;
}

/** 5점 — 1 전혀 아니에요 · 3 반반 · 5 정말 그래요 */
export const SCALE_LABELS = ["전혀 아니에요", "아닌 편", "반반", "그런 편", "정말 그래요"] as const;

export const TYPE_ITEMS: ScaleItem[] = [
  { id: "t1", axis: "EI", dir: 1, text: "여러 사람과 같이 운동하면 힘이 더 나요" },
  { id: "t2", axis: "EI", dir: -1, text: "운동할 땐 혼자 집중하는 시간이 편해요" },
  { id: "t3", axis: "EI", dir: 1, text: "처음 보는 회원에게도 먼저 말을 거는 편이에요" },
  { id: "t4", axis: "EI", dir: -1, text: "운동이 끝나면 조용히 쉬면서 힘을 다시 채워요" },
  { id: "t5", axis: "SN", dir: 1, text: "동작은 말보다 직접 보고 따라 하는 게 빨라요" },
  { id: "t6", axis: "SN", dir: -1, text: "왜 이렇게 하는지 원리를 알아야 몸이 따라와요" },
  { id: "t7", axis: "SN", dir: 1, text: "오늘 할 것을 순서대로 하나씩 하는 게 좋아요" },
  { id: "t8", axis: "SN", dir: -1, text: "새로운 콤비네이션을 이것저것 시도해 보는 게 재밌어요" },
  { id: "t9", axis: "TF", dir: 1, text: "잘못된 자세는 돌려 말하지 말고 바로 짚어 주면 좋아요" },
  { id: "t10", axis: "TF", dir: -1, text: "코치님이 기분을 먼저 알아봐 주면 더 열심히 하게 돼요" },
  { id: "t11", axis: "TF", dir: 1, text: "기록 · 숫자로 내가 늘었는지 확인하는 게 좋아요" },
  { id: "t12", axis: "TF", dir: -1, text: "같이 운동하는 사람들과 분위기가 좋은 게 가장 중요해요" },
  { id: "t13", axis: "JP", dir: 1, text: "운동하는 요일 · 시간을 정해 두고 지키는 편이에요" },
  { id: "t14", axis: "JP", dir: -1, text: "그날 기분 · 컨디션에 따라 운동하러 가는 편이에요" },
  { id: "t15", axis: "JP", dir: 1, text: "수업 순서가 미리 정해져 있으면 마음이 편해요" },
  { id: "t16", axis: "JP", dir: -1, text: "그날그날 다른 운동을 하는 게 덜 지루해요" },
];

export const BIG5_ITEMS: ScaleItem[] = [
  { id: "b1", big5: "E", dir: 1, text: "나는 활발하고 에너지가 넘치는 사람이에요" },
  { id: "b2", big5: "E", dir: -1, text: "나는 조용하고 말수가 적은 편이에요" },
  { id: "b3", big5: "A", dir: 1, text: "나는 다른 사람을 잘 배려하고 따뜻한 편이에요" },
  { id: "b4", big5: "A", dir: -1, text: "나는 남의 말에 쉽게 반박하는 편이에요" },
  { id: "b5", big5: "C", dir: 1, text: "나는 맡은 일을 끝까지 꼼꼼하게 해내요" },
  { id: "b6", big5: "C", dir: -1, text: "나는 계획을 세워도 자주 미루는 편이에요" },
  { id: "b7", big5: "N", dir: 1, text: "나는 걱정이 많고 쉽게 긴장하는 편이에요" },
  { id: "b8", big5: "N", dir: -1, text: "나는 웬만한 일에는 마음이 흔들리지 않아요" },
  { id: "b9", big5: "O", dir: 1, text: "나는 새로운 경험 · 배움을 좋아해요" },
  { id: "b10", big5: "O", dir: -1, text: "나는 익숙한 방식을 그대로 하는 게 편해요" },
];

export const PREF_ITEMS: ChoiceItem[] = [
  {
    id: "p_goal", name: "운동하는 이유", title: "153에서 운동하는 가장 큰 이유는요?",
    options: [
      { v: "diet", label: "살 빼기 · 몸매" }, { v: "stress", label: "스트레스 풀기" }, { v: "skill", label: "복싱 실력" },
      { v: "health", label: "체력 · 건강" }, { v: "defense", label: "자기 방어" }, { v: "match", label: "스파링 · 대회" },
    ],
  },
  {
    id: "p_praise", name: "칭찬 받는 법", title: "칭찬은 어떻게 받을 때 가장 기분 좋아요?",
    options: [{ v: "public", label: "다른 사람 앞에서 크게" }, { v: "private", label: "조용히 나에게만" }, { v: "number", label: "기록 · 숫자로" }],
  },
  {
    id: "p_correct", name: "자세 교정", title: "자세를 고쳐 줄 때는요?",
    options: [{ v: "direct", label: "바로 딱 짚어서" }, { v: "soft", label: "잘한 점 먼저, 고칠 점 하나" }, { v: "show", label: "말 대신 시범으로" }],
  },
  {
    id: "p_learn", name: "배우는 방식", title: "새 동작은 어떻게 배우면 잘 돼요?",
    options: [{ v: "why", label: "원리 설명 먼저" }, { v: "copy", label: "일단 따라 하기" }, { v: "video", label: "영상 보고 혼자 연습" }],
  },
  {
    id: "p_compete", name: "랭킹 · 대결", title: "랭킹 · 대결은 나에게…",
    options: [{ v: "fuel", label: "불타게 해요" }, { v: "ok", label: "있으면 좋아요" }, { v: "burden", label: "부담돼요" }],
  },
  {
    id: "p_contact", name: "스파링 마음", title: "맞고 때리는 스파링은요?",
    options: [{ v: "want", label: "빨리 해 보고 싶어요" }, { v: "later", label: "실력이 늘면 해 볼래요" }, { v: "no", label: "아직은 무서워요 · 안 할래요" }],
  },
  {
    id: "p_intensity", name: "운동 강도", title: "운동 강도는요?",
    options: [{ v: "push", label: "끝까지 몰아붙여 주세요" }, { v: "steady", label: "적당히 땀날 만큼" }, { v: "own", label: "내 페이스대로" }],
  },
  {
    id: "p_social", name: "같이 · 혼자", title: "수업 시간에는요?",
    options: [{ v: "pair", label: "다른 회원과 짝 운동이 좋아요" }, { v: "either", label: "상관없어요" }, { v: "solo", label: "혼자 하는 게 편해요" }],
  },
  {
    id: "p_quit", name: "지칠 때 신호", title: "운동이 하기 싫어질 때 나는…",
    options: [{ v: "quiet", label: "말이 줄고 조용해져요" }, { v: "excuse", label: "바쁘다는 핑계가 늘어요" }, { v: "vanish", label: "말없이 안 나가요" }, { v: "rare", label: "거의 그런 적 없어요" }],
  },
  {
    id: "p_contact_me", name: "안 나올 때 연락", title: "한동안 못 나오면 코치님 연락은요?",
    options: [{ v: "yes", label: "연락 주시면 힘나요" }, { v: "light", label: "가볍게 한 번이면 좋아요" }, { v: "no", label: "부담돼요 · 기다려 주세요" }],
  },
];

export const ALL_SCALE_ITEMS: ScaleItem[] = [...TYPE_ITEMS, ...BIG5_ITEMS];
export const STYLE_VERSION = 1;
export const STYLE_REWARD_GEMS = 3000;

export type StyleAnswers = Record<string, number | string>;

/* ───────────────────────── 채점 ───────────────────────── */

export interface StyleScores {
  /** 축마다 -100 ~ +100 (+ = 앞 글자) */
  axes: Record<StyleAxis, number>;
  type16: string;
  /** 0 ~ 100 */
  big5: Record<Big5, number>;
  prefs: Record<string, string>;
}

const AXIS_LETTERS: Record<StyleAxis, [string, string]> = { EI: ["E", "I"], SN: ["S", "N"], TF: ["T", "F"], JP: ["J", "P"] };

/** 답을 다듬는다 — 모르는 키 · 범위 밖 값은 버린다 */
export function cleanStyleAnswers(raw: unknown): StyleAnswers {
  const out: StyleAnswers = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const r = raw as Record<string, unknown>;
  for (const it of ALL_SCALE_ITEMS) {
    const v = Number(r[it.id]);
    if (Number.isInteger(v) && v >= 1 && v <= 5) out[it.id] = v;
  }
  for (const it of PREF_ITEMS) {
    const v = r[it.id];
    if (typeof v === "string" && it.options.some((o) => o.v === v)) out[it.id] = v;
  }
  return out;
}

export function missingItems(a: StyleAnswers): string[] {
  return [...ALL_SCALE_ITEMS.map((i) => i.id), ...PREF_ITEMS.map((i) => i.id)].filter((id) => a[id] === undefined);
}

export function scoreStyle(a: StyleAnswers): StyleScores {
  const axes = { EI: 0, SN: 0, TF: 0, JP: 0 } as Record<StyleAxis, number>;
  for (const ax of Object.keys(axes) as StyleAxis[]) {
    const items = TYPE_ITEMS.filter((i) => i.axis === ax && typeof a[i.id] === "number");
    if (!items.length) continue;
    const sum = items.reduce((s, i) => s + ((a[i.id] as number) - 3) * i.dir, 0);
    axes[ax] = Math.round((sum / (items.length * 2)) * 100);
  }
  const type16 = (Object.keys(AXIS_LETTERS) as StyleAxis[]).map((ax) => AXIS_LETTERS[ax][axes[ax] >= 0 ? 0 : 1]).join("");
  const big5 = { O: 50, C: 50, E: 50, A: 50, N: 50 } as Record<Big5, number>;
  for (const f of Object.keys(big5) as Big5[]) {
    const items = BIG5_ITEMS.filter((i) => i.big5 === f && typeof a[i.id] === "number");
    if (!items.length) continue;
    const mean = items.reduce((s, i) => s + (i.dir === 1 ? (a[i.id] as number) : 6 - (a[i.id] as number)), 0) / items.length;
    big5[f] = Math.round(((mean - 1) / 4) * 100);
  }
  const prefs: Record<string, string> = {};
  for (const it of PREF_ITEMS) if (typeof a[it.id] === "string") prefs[it.id] = a[it.id] as string;
  return { axes, type16, big5, prefs };
}

export const BIG5_NAMES: Record<Big5, string> = { O: "새로움 좋아함", C: "꾸준함", E: "에너지 · 사교", A: "배려", N: "긴장 · 걱정" };

export function prefLabel(id: string, v: string | undefined): string {
  const it = PREF_ITEMS.find((i) => i.id === id);
  return it?.options.find((o) => o.v === v)?.label ?? "";
}

/* ───────────────────────── 오삼코치 지도 카드 ───────────────────────── */

export interface StyleBehavior {
  visits8w: number;
  weekdays: string;
  usualHour: number | null;
  longestGapDays: number | null;
  daysSinceFirst: number | null;
  league: string | null;
  level: number | null;
  pt: boolean;
}

export interface CoachCard {
  one_line: string;
  first_words: string[];
  teach: { explain: string; correct: string; praise: string; intensity: string; group: string };
  say: string[];
  avoid: string[];
  dropout: { level: "낮음" | "보통" | "높음"; signals: string[]; basis: "확정" | "추정" | "불명확" };
  retention: string;
  next_goal: string;
  sparring: string;
  evidence: Array<{ claim: string; basis: "확정" | "추정" | "불명확" }>;
}

export const CARD_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["one_line", "first_words", "teach", "say", "avoid", "dropout", "retention", "next_goal", "sparring", "evidence"],
  properties: {
    one_line: { type: "string" },
    first_words: { type: "array", items: { type: "string" } },
    teach: {
      type: "object", additionalProperties: false,
      required: ["explain", "correct", "praise", "intensity", "group"],
      properties: { explain: { type: "string" }, correct: { type: "string" }, praise: { type: "string" }, intensity: { type: "string" }, group: { type: "string" } },
    },
    say: { type: "array", items: { type: "string" } },
    avoid: { type: "array", items: { type: "string" } },
    dropout: {
      type: "object", additionalProperties: false, required: ["level", "signals", "basis"],
      properties: {
        level: { type: "string", enum: ["낮음", "보통", "높음"] },
        signals: { type: "array", items: { type: "string" } },
        basis: { type: "string", enum: ["확정", "추정", "불명확"] },
      },
    },
    retention: { type: "string" },
    next_goal: { type: "string" },
    sparring: { type: "string" },
    evidence: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["claim", "basis"],
        properties: { claim: { type: "string" }, basis: { type: "string", enum: ["확정", "추정", "불명확"] } },
      },
    },
  },
};

export const CARD_SYSTEM = `너는 한국 복싱짐에서 15년 동안 수천 명을 가르친 수석 코치이자, 성격심리(다섯 가지 성격 · 16유형)와 운동 동기 이론(자기결정이론 · 습관 형성)을 현장에 쓰는 코칭 전문가다.
할 일: 회원 한 명의 성향 검사 답과 출석 기록을 보고, 코치님이 이 회원을 10초 안에 이해하고 오늘 수업에서 바로 맞춤 지도를 하도록 「지도 카드」를 만든다.

[규칙]
1. 근거를 나눈다 — 확정(회원이 고른 답 · 출석 기록에 그대로 있음) / 추정(네 해석) / 불명확(자료 부족). evidence 에 3~5개.
2. 유형 이름으로 사람을 규정하지 않는다. "ISTJ라서" 같은 말 금지 — "원리 설명을 원한다고 골랐고 꾸준함이 높아서"처럼 근거로 말한다. 글에 16유형 네 글자를 쓰지 않는다.
3. 16유형과 다섯 가지 성격이 부딪히면 다섯 가지 성격과 출석 기록을 따른다. 16유형은 약한 힌트다.
4. 진단 · 병명 · 마음 상태 추측(우울 · 불안장애 · ADHD 등)을 쓰지 않는다. '긴장 · 걱정' 점수는 "처음엔 천천히" 같은 지도 요령으로만 쓴다.
5. 코치님이 그대로 소리 내 말할 수 있는 한국어 해요체 문장. 반말 · 비하 · 과한 칭찬 금지. 존중하면서 에너지 있게.
6. '국가대표' · 'MBTI' 단어를 쓰지 않는다. 숫자는 입력에 있는 것만 쓴다(지어내지 않는다).
7. 짧게 — one_line 30자 안, 나머지 한 칸 50자 안. first_words 2개 · say 3개 · avoid 3개(각각 짧은 이유 포함) · dropout.signals 1~3개.
8. 출석 기록이 적으면(8주 3번 아래) dropout 은 기록 부족을 말하고 basis 는 불명확.
9. 회원이 스파링을 무섭다고 했으면 sparring 은 권하지 않는 쪽(미트 · 짝 드릴로 자신감부터).
10. 회원이 연락을 부담스러워하면 retention 은 연락 대신 다음에 왔을 때 할 말로.

${KO_STYLE}`;

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
export { WEEK as STYLE_WEEK };

export function buildCardUser(input: { nickname: string; scores: StyleScores; behavior: StyleBehavior }): string {
  const { scores: s, behavior: b } = input;
  const axisLine = (ax: StyleAxis) => {
    const [a, z] = AXIS_LETTERS[ax];
    const v = s.axes[ax];
    return `${a}/${z} ${v >= 0 ? a : z} 쪽 ${Math.abs(v)}점`;
  };
  const prefs = PREF_ITEMS.map((it) => `- ${it.name}: ${prefLabel(it.id, s.prefs[it.id]) || "답 없음"}`).join("\n");
  return `[회원] ${input.nickname || "회원"}
[16유형 축 · 약한 힌트] ${(["EI", "SN", "TF", "JP"] as StyleAxis[]).map(axisLine).join(" · ")}
[다섯 가지 성격 0~100] ${(Object.keys(BIG5_NAMES) as Big5[]).map((f) => `${BIG5_NAMES[f]} ${s.big5[f]}`).join(" · ")}
[복싱 지도 선호 — 회원이 고른 답]
${prefs}
[출석 기록 — 최근 8주]
- 출석 ${b.visits8w}번 · 자주 오는 요일 ${b.weekdays || "기록 없음"} · 보통 ${b.usualHour === null ? "시간 기록 없음" : `${b.usualHour}시쯤`}
- 가장 길게 쉰 기간 ${b.longestGapDays === null ? "기록 없음" : `${b.longestGapDays}일`} · 첫 출석부터 ${b.daysSinceFirst === null ? "기록 없음" : `${b.daysSinceFirst}일`}
- 지금 ${b.league ?? "리그 모름"} ${b.level ?? ""}레벨 · PT ${b.pt ? "받는 중" : "아님"}
위 자료로 지도 카드를 JSON 으로 만들어 줘.`;
}

export type CardCheck = { ok: true; value: CoachCard } | { ok: false; reason: string };

const BANNED = /국가대표|MBTI|[EI][SN][TF][JP]|우울|장애|ADHD|공황|정신과/;
const s50 = (v: unknown, max = 60) => typeof v === "string" && v.trim().length > 0 && v.trim().length <= max;

export function checkCard(raw: unknown): CardCheck {
  const c = raw as CoachCard;
  if (!c || typeof c !== "object") return { ok: false, reason: "모양이 틀렸어요 — JSON 하나로" };
  if (!s50(c.one_line, 40)) return { ok: false, reason: "one_line 은 30자 안 한 줄" };
  const lists: Array<[string, unknown, number]> = [["first_words", c.first_words, 2], ["say", c.say, 3], ["avoid", c.avoid, 3]];
  for (const [k, v, n] of lists) {
    if (!Array.isArray(v) || v.length < n || v.length > n + 1 || !v.every((x) => s50(x, 80))) return { ok: false, reason: `${k} 는 ${n}개 · 한 줄씩` };
  }
  const t = c.teach;
  if (!t || !["explain", "correct", "praise", "intensity", "group"].every((k) => s50((t as any)[k], 80))) return { ok: false, reason: "teach 다섯 칸을 모두 한 줄로" };
  for (const k of ["retention", "next_goal", "sparring"] as const) if (!s50(c[k], 90)) return { ok: false, reason: `${k} 를 한 줄로` };
  if (!c.dropout || !Array.isArray(c.dropout.signals) || c.dropout.signals.length > 3) return { ok: false, reason: "dropout.signals 는 1~3개" };
  if (!Array.isArray(c.evidence) || c.evidence.length < 2 || c.evidence.length > 6) return { ok: false, reason: "evidence 는 3~5개" };
  const all = JSON.stringify(c);
  const m = all.match(BANNED);
  if (m) return { ok: false, reason: `쓰지 않는 말이 있어요: ${m[0]} — 근거로 풀어서` };
  return { ok: true, value: c };
}

export function parseJson(text: string): unknown {
  const s = (text ?? "").trim();
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try {
    return JSON.parse(s.slice(a, b + 1));
  } catch {
    return null;
  }
}
