/**
 * 🥊 오삼이 1단 답변 엔진 — 회원 질문을 지식 베이스(data/osamiFaq.ts)와 맞춰 본다 (2026-10-03).
 *
 * 순수 함수만 있다. React·Supabase import 금지 (테스트가 node 에서 그대로 돈다).
 *
 * 점수 = 핵심 낱말 점수(드문 낱말일수록 크게) + 문장 유사도(바이그램 다이스). 100점 만점.
 *   · ANSWER_MIN 이상이고 2등과 차이가 나면 → 그 답을 바로 보여 준다 (AI 호출 없음)
 *   · SUGGEST_MIN 이상이면 → "이걸 물어보신 건가요?" 후보 칩
 *   · 그 아래면 → AI 서버로. 이때 buildKbContext() 가 고른 관련 항목([앱 안내])과 기능 지도를 함께 보내
 *     에지 함수(chat-assistant)가 프롬프트에 끼운다 — 지식 베이스는 앱 한 곳(data/osamiFaq.ts)에만 둔다.
 */
import { OSAMI_FAQ, OSAMI_FAQ_CATEGORY_LABEL, type OsamiFaqCategory, type OsamiFaqEntry } from "../data/osamiFaq";

// ── 글자 다듬기 (lib/appSearch.ts 와 같은 규칙 — Deno 로 복사되므로 여기 따로 둔다) ──

/** 띄어쓰기·기호를 빼고 소문자로 — 한글·영문·숫자·초성만 남긴다 */
export function kbNormalize(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^0-9a-zㄱ-ㅎ가-힣]/g, "");
}

/** 숫자 경계를 지키는 포함 — "레벨10" 안의 "레벨1" 은 맞지 않는다 */
export function kbIncludesWord(hay: string, needle: string): boolean {
  if (!needle) return false;
  const digitStart = /\d/.test(needle[0]);
  const digitEnd = /\d/.test(needle[needle.length - 1]);
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) {
    const before = hay[i - 1] ?? "";
    const after = hay[i + needle.length] ?? "";
    if ((!digitStart || !/\d/.test(before)) && (!digitEnd || !/\d/.test(after))) return true;
  }
  return false;
}

/** 글자 두 개씩 묶음 — 문장 유사도용 */
export function kbBigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i + 1 < s.length; i++) {
    const g = s.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

/** 다이스 계수 0~1 — 두 문장이 얼마나 겹치나 */
export function kbDice(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return a === b && a.length > 0 ? 1 : 0;
  const A = kbBigrams(a);
  const B = kbBigrams(b);
  let inter = 0;
  for (const [g, n] of A) inter += Math.min(n, B.get(g) ?? 0);
  return (2 * inter) / (a.length - 1 + b.length - 1);
}

// ── 질문에서 알맹이만 ──────────────────────────────────────
// "출석은 어떻게 해요" → "출석", "직행권이 뭐예요" → "직행권" — 조사·의문 꼬리를 떼어
// 문장 유사도가 "어떻게 해요" 같은 흔한 꼬리 때문에 엉뚱한 항목과 겹치지 않게 한다.
// (핵심 낱말 비교는 떼기 전 전체 문장으로 하므로 낱말이 깨질 걱정은 없다)

const STOP_TOKENS = new Set([
  "어떻게", "어떡해", "어떡해요", "어케", "뭐예요", "뭐에요", "뭐야", "뭔가요", "무엇인가요", "무엇이에요", "뭐임", "뭐죠", "뭐지",
  "해요", "하나요", "해", "하죠", "하는법", "하는방법", "방법", "되나요", "돼요", "되요", "돼", "됨", "되죠",
  "알려주세요", "알려줘요", "알려줘", "알려", "가르쳐줘", "궁금해요", "궁금", "질문", "문의",
  "있어요", "있나요", "있어", "있죠", "없어요", "없나요", "없어", "안돼요", "안되요", "안돼", "안됨", "안되나요",
  "싶어요", "싶어", "싶은데", "할래요", "할래", "할수있어요", "할수있나요", "할수있어", "수있어요", "수있나요",
  "주세요", "줘요", "줘", "좀", "제", "내", "저", "나", "제가", "내가", "저는", "나는", "저희", "우리",
  "그", "이거", "저거", "그거", "것", "거", "건", "게", "요", "네", "음", "아", "어", "오", "뭘", "무엇을", "뭐를", "뭐가", "뭐", "무엇",
  "하고", "해서", "하면", "할", "한", "하는", "된", "되는", "인", "는", "은",
  "지금", "오늘", "혹시", "근데", "그런데", "그리고", "또", "다시", "진짜", "정말", "너무", "많이", "잘", "자세히", "자세하게",
]);

/** 낱말 끝에 붙는 조사·꼬리 — 긴 것부터 뗀다 (한 글자 남을 때까지만) */
const SUFFIXES = [
  "하고싶어요", "하고싶어", "하려면", "할려면", "하는법", "하는방법", "하는거예요", "하는거에요", "되나요", "되는거예요", "이에요", "인가요", "입니까",
  "입니다", "하나요", "있나요", "없나요", "싶어요", "주세요", "어떻게", "라고요", "이라고", "에서는", "으로는", "한테는", "에게는",
  "했는데", "하는데", "했어요", "했어", "인데요", "인데", "는데", "한데", "하기", "하는", "되기",
  "예요", "에요", "해요", "돼요", "되요", "해야", "있어", "없어", "싶어", "줘요", "뭐야", "뭐예요", "뭐에요", "이야", "이면", "으면", "하면",
  "에서", "으로", "한테", "에게", "까지", "부터", "처럼", "마다", "보다", "이랑", "하면", "해도", "이고", "은요", "는요",
  "은", "는", "이", "가", "을", "를", "의", "에", "도", "만", "로", "요", "야", "랑", "과", "와", "께", "님",
];

/**
 * 끝 글자가 조사처럼 보여도 떼면 안 되는 낱말 — "양도"→"양", "통과"→"통", "한도"→"" 처럼 뜻이 사라진다.
 * (검수 2026-10-03: "양도"·"메시지 한도"·"타이틀매치 통과" 가 엉뚱한 항목으로 간 원인)
 */
const KEEP_WHOLE = new Set([
  "양도", "한도", "효과", "통과", "결과", "성과", "강도", "속도", "정도", "진도", "각도", "빈도", "제도", "태도", "시도",
  "추가", "평가", "휴가", "나이", "사과", "포도", "지도",
]);

/** 문장 → 알맹이 낱말을 이어 붙인 문자열 */
export function kbContent(raw: string): string {
  const out: string[] = [];
  for (const t0 of (raw ?? "").toLowerCase().normalize("NFC").split(/[\s!?.,~·/()[\]"'…:;、，-]+/)) {
    let t = t0.replace(/[^0-9a-zㄱ-ㅎ가-힣]/g, "");
    if (!t) continue;
    let changed = true;
    while (changed && t.length > 1) {
      changed = false;
      if (STOP_TOKENS.has(t)) { t = ""; break; }
      if (KEEP_WHOLE.has(t)) break;
      for (const suf of SUFFIXES) {
        if (t.length - suf.length >= 1 && t.endsWith(suf)) {
          t = t.slice(0, t.length - suf.length);
          changed = true;
          break;
        }
      }
    }
    if (t && !STOP_TOKENS.has(t)) out.push(t);
  }
  return out.join("");
}

// ── 점수 ───────────────────────────────────────────────────

export interface OsamiMatch {
  entry: OsamiFaqEntry;
  score: number;
}

export type OsamiMatchKind = "answer" | "suggest" | "none";

export interface OsamiMatchResult {
  kind: OsamiMatchKind;
  /** kind === 'answer' 일 때 보여 줄 항목 */
  best: OsamiMatch | null;
  /** 점수순 후보 (best 포함, 최대 4) */
  candidates: OsamiMatch[];
}

/** 이 점수 이상이면 바로 답한다 */
export const ANSWER_MIN = 40;
/** 1등이 2등보다 이만큼 앞서야 바로 답한다 (아니면 후보 칩으로) */
export const ANSWER_MARGIN = 8;
/** 이 점수 이상이면 후보로 보여 준다 */
export const SUGGEST_MIN = 22;

interface PreparedEntry {
  entry: OsamiFaqEntry;
  /** 대표 질문·다른 표현의 알맹이 */
  phrases: string[];
  keywords: { k: string; w: number }[];
}

let prepared: PreparedEntry[] | null = null;

/** 낱말이 몇 항목에 들어 있나 — 흔한 낱말("설정"·"변경")은 점수를 덜 준다 */
function prepare(): PreparedEntry[] {
  if (prepared) return prepared;
  const df = new Map<string, number>();
  const norm = OSAMI_FAQ.map((entry) => {
    const ks = Array.from(new Set(entry.keywords.map(kbNormalize).filter((k) => k.length >= 1)));
    for (const k of ks) df.set(k, (df.get(k) ?? 0) + 1);
    return { entry, ks };
  });
  prepared = norm.map(({ entry, ks }) => ({
    entry,
    // 대표 질문이 "A / B" 처럼 두 질문을 묶은 경우 따로 비교한다
    phrases: Array.from(new Set([...entry.q.split(/\s+\/\s+/), ...entry.alts].map(kbContent).filter(Boolean))),
    keywords: ks.map((k) => {
      const d = df.get(k) ?? 1;
      const rarity = d <= 1 ? 1 : d === 2 ? 0.75 : d <= 4 ? 0.55 : 0.35;
      // 긴 낱말일수록 뜻이 분명하다
      const base = k.length <= 1 ? 6 : k.length === 2 ? 10 : k.length === 3 ? 14 : 17;
      return { k, w: base * rarity };
    }),
  }));
  return prepared;
}

/** 항목 하나의 점수 (0~100). q = 전체 정규화 문장, c = 알맹이 */
export function scoreOsamiEntry(p: PreparedEntry, q: string, c: string): number {
  if (!q) return 0;
  // 알맹이가 대표 질문·다른 표현과 똑같으면 만점
  if (c && p.phrases.some((ph) => ph === c)) return 100;
  let kw = 0;
  let hits = 0;
  for (const { k, w } of p.keywords) {
    if (kbIncludesWord(q, k)) { kw += w; hits += 1; }
  }
  if (hits >= 2) kw += 5;
  let phrase = 0;
  if (c) {
    for (const ph of p.phrases) {
      const d = kbDice(c, ph);
      if (d > phrase) phrase = d;
      // 질문이 표현을 통째로 품은 경우 ("닉네임변경어디서" ⊃ "닉네임변경")
      if (ph.length >= 3 && kbIncludesWord(c, ph)) phrase = Math.max(phrase, 0.85);
    }
  }
  return Math.min(100, kw + phrase * 50);
}

/**
 * "복싱이 다이어트에 좋아요?" 처럼 효과·비교·이유를 묻는 말 — 앱 안내보다 코치 설명이 맞다.
 * 앱 표현을 거의 그대로 썼을 때(70점 이상)만 예외.
 */
const GENERAL_QUESTION_RE = /(좋아요|좋은가요|좋나요|좋은지|효과|도움이|도움돼|도움되|추천해|괜찮|어때요|어떤가요|어떤게|왜|이유|차이|비교|vs)/;

/** 질문 하나를 지식 베이스와 맞춰 본다 */
export function matchOsamiFaq(query: string): OsamiMatchResult {
  const q = kbNormalize(query);
  if (!q) return { kind: "none", best: null, candidates: [] };
  const c = kbContent(query);
  const general = GENERAL_QUESTION_RE.test(query ?? "");
  const scored: OsamiMatch[] = prepare()
    .map((p) => ({ entry: p.entry, score: Math.round(scoreOsamiEntry(p, q, c)) }))
    .filter((m) => m.score >= SUGGEST_MIN)
    .sort((a, b) => b.score - a.score);
  const candidates = scored.slice(0, 4);
  const best = candidates[0];
  if (!best) return { kind: "none", best: null, candidates: [] };
  const second = candidates[1]?.score ?? 0;
  const clear = best.score - second >= ANSWER_MARGIN || best.score >= 80;
  if (best.score >= ANSWER_MIN && clear && (!general || best.score >= 70)) {
    return { kind: "answer", best, candidates };
  }
  return { kind: "suggest", best: null, candidates };
}

// ── 인사·잡담 (AI 안 부르고 바로) ─────────────────────────────

const GREETING_RE = /^(안녕|안녕하세요|안녕하십니까|하이|헬로|반가워|반갑습니다|좋은\s*(아침|저녁|하루)|hi|hello|hey|ㅎㅇ)[!?.~\s]*$/i;
const THANKS_RE = /^(고마워|고맙습니다|감사|감사합니다|감사해요|땡큐|thanks|thank you|thx|ㄳ|ㄱㅅ)[!?.~\s]*$/i;
const BYE_RE = /^(잘가|잘 가|안녕히|바이|bye|다음에|수고|수고하세요|끝)[!?.~\s]*$/i;
const LAUGH_RE = /^[ㅋㅎ!~.\s]+$/;

/** 짧은 인사·감사·웃음은 정해진 말로 답한다 — 없으면 null */
export function smallTalkReply(query: string): string | null {
  const t = (query ?? "").trim();
  if (!t) return null;
  if (GREETING_RE.test(t)) return "안녕하세요! 오삼 코치예요 🥊 오늘도 한 라운드 가 볼까요? 출석·레벨업·수강권처럼 궁금한 걸 편하게 물어보세요.";
  if (THANKS_RE.test(t)) return "별말씀을요! 오늘도 응원합니다 💪 또 궁금한 게 생기면 언제든 불러 주세요.";
  if (BYE_RE.test(t)) return "네, 다음 라운드에서 또 만나요! 오늘 한 걸음이면 충분해요 🥊";
  if (LAUGH_RE.test(t)) return "ㅎㅎ 좋아요! 궁금한 게 있으면 말씀만 하세요 🥊";
  return null;
}

// ── 화제 판별 ─────────────────────────────────────────────

/**
 * 복싱 기술·훈련·식단·마음가짐처럼 AI 코치가 답해야 하는 화제.
 * 직접 쓰지 말고 isCoachingTopic() 을 쓴다 — 글자 일부만 겹치는 말("까먹었어요"·"자세히"·"동기화")을 먼저 걸러 낸다.
 */
export const COACHING_TOPIC_RE =
  /(복싱|복서|잽|스트레이트|크로스|훅|어퍼|카운터|스파링|풋워크|콤비|컴비|디펜스|가드|슬립|위빙|더킹|패리|블록|샌드백|미트|쉐도우|섀도|줄넘기|글러브|핸드랩|스텝|스탠스|사우스포|펀치|클린치|타격|자세|호흡|체력|근력|유산소|스트레칭|부상|통증|아파|아픈|아프|어지|다이어트|식단|영양|칼로리|단백질|탄수|지방|체중|감량|살빼|살 빼|식사|체지방|뱃살|야식|간식|음료|단식|먹|마셔|마시|무서|두려|힘들|지쳐|지친|포기|의욕|동기|멘탈|마음|스트레스|긴장|불안|자신감|슬럼프|정체기)/;

/** 화제 낱말과 글자만 겹치는 말 — 지우고 판별한다 (뒤돌아보기 정규식은 구형 아이폰 사파리가 못 읽어서 쓰지 않는다) */
const COACHING_LOOKALIKE_RE = /까먹|먹통|자세히|자세하게|자세한|동기화/g;

/** 복싱·식단·마음가짐 화제인가 */
export function isCoachingTopic(text: string): boolean {
  return COACHING_TOPIC_RE.test((text ?? "").replace(COACHING_LOOKALIKE_RE, " "));
}

/**
 * 앱 사용법·규칙 화제 — AI 에게 [앱 기능 지도](대표 질문 목록)를 함께 보내 "어느 메뉴에서" 를 정확히 말하게 한다.
 * 복싱·식단만 묻는 말에는 보내지 않는다 (토큰 절약).
 */
export const APP_TOPIC_RE =
  /(앱|어플|메뉴|버튼|화면|설정|로그인|비밀번호|비번|아이디|출석|레벨|리그|타이틀|마일리지|젬|파이트|랭킹|챌린지|알림|메시지|수강권|홀딩|환불|양도|결제|캐릭터|단증|코너맨|파트너|장비|영상|코스|매뉴얼|플레이|게임|미니게임|qr|큐알|데스크|지점|승인|심사|가이드|오삼|닉네임|탈퇴|설치|튜토리얼|입단식)/i;

// ── AI 서버에 넘길 참고 자료 ───────────────────────────────

/** 참고 자료로 붙일 최소 점수 — "그 질문일 수도 있다" 수준(SUGGEST_MIN)보다 조금 높게 잡아 잡음(일반 낱말 우연 일치)을 걸러낸다 */
export const HINT_MIN = 30;

export interface OsamiKbHint {
  id: string;
  q: string;
  answer: string;
}

/**
 * 질문과 관련 있는 항목 몇 개를 고른다 — AI 가 앱 사실을 틀리지 않게 참고하도록.
 * 점수 문턱을 낮게 잡아(살짝만 닿아도) 최대 k 개, 글자 수 상한 안에서.
 */
export function pickOsamiKbHints(query: string, k = 4, maxChars = 2200): OsamiKbHint[] {
  const q = kbNormalize(query);
  if (!q) return [];
  const c = kbContent(query);
  const scored = prepare()
    .map((p) => ({ entry: p.entry, score: scoreOsamiEntry(p, q, c) }))
    .filter((m) => m.score >= HINT_MIN)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
  const out: OsamiKbHint[] = [];
  let used = 0;
  for (const m of scored) {
    const a = m.entry.answer.length > 700 ? m.entry.answer.slice(0, 700) + "…" : m.entry.answer;
    const cost = m.entry.q.length + a.length;
    if (used + cost > maxChars) break;
    out.push({ id: m.entry.id, q: m.entry.q, answer: a });
    used += cost;
  }
  return out;
}

/** 참고 자료를 프롬프트 글로 */
export function formatOsamiKbHints(hints: OsamiKbHint[]): string {
  if (hints.length === 0) return "";
  return hints.map((h, i) => `[앱 안내 ${i + 1}] Q: ${h.q}\nA: ${h.answer}`).join("\n\n");
}

/** 앱 전체 기능 한 줄 요약 — 앱 화제일 때 AI 에게 주는 지도 (분류: 대표 질문 목록) */
export function osamiFaqIndex(): string {
  const byCat = new Map<string, string[]>();
  for (const f of OSAMI_FAQ) {
    const arr = byCat.get(f.category) ?? [];
    arr.push(f.q);
    byCat.set(f.category, arr);
  }
  return Array.from(byCat.entries())
    .map(([cat, qs]) => `· ${OSAMI_FAQ_CATEGORY_LABEL[cat as OsamiFaqCategory] ?? cat}: ${qs.join(" / ")}`)
    .join("\n");
}

/** AI 서버(chat-assistant)에 함께 보내는 지식 베이스 컨텍스트 */
export interface OsamiKbContext {
  /** 질문과 관련 있는 항목 (최대 4개, 2,200자 안) */
  hints: Array<{ q: string; answer: string }>;
  /** 앱 화제일 때만 — 기능 지도 */
  index?: string;
}

/**
 * 2단(AI) 요청에 실어 보낼 앱 지식 — 서버는 이것을 [앱 안내]·[앱 기능 지도] 로 프롬프트에 끼운다.
 * 데이터를 서버에 복사해 두지 않으므로 숫자·규칙은 data/osamiFaq.ts 한 곳만 고치면 된다.
 */
export function buildKbContext(query: string): OsamiKbContext {
  const hints = pickOsamiKbHints(query).map(({ q, answer }) => ({ q, answer }));
  // 기능 지도(≈1,600자)는 앱을 묻는 말에만 — 복싱·식단 질문에 붙이면 무료 한도(분당 토큰)만 먹는다.
  const index = APP_TOPIC_RE.test(query) ? osamiFaqIndex() : undefined;
  return index ? { hints, index } : { hints };
}

// ── 답하는 길 정하기 (화면과 테스트가 같은 판단을 쓴다) ─────────────────

/** 코칭 화제인데도 앱 안내로 바로 답하려면 이만큼 확실해야 한다 — 그 아래는 AI 가 자세히 답하고 안내는 칩으로 */
export const COACHING_DIRECT_MIN = 70;

/** 공식 문구로 바로 답해야 하는 항목 — 코칭 화제여도 AI 로 돌리지 않는다 (안전 안내) */
const ALWAYS_DIRECT = new Set(["gd-safety"]);

export type OsamiPlan =
  /** 인사·감사 — 정해진 말 */
  | { kind: "small"; reply: string }
  /** 앱 안내로 바로 답 (others = 다른 후보) */
  | { kind: "faq"; best: OsamiMatch; others: OsamiMatch[] }
  /** 애매함 — "이걸 물어보신 걸까요?" 후보 칩 */
  | { kind: "suggest"; candidates: OsamiMatch[] }
  /** AI 코치에게 (related = 답 아래 붙일 관련 앱 안내) */
  | { kind: "ai"; related: OsamiMatch[] };

/**
 * 회원 말 한 마디를 어디로 보낼지 정한다.
 *   인사 → small / 확실한 앱 질문 → faq / 애매한 앱 질문 → suggest / 그 밖(복싱·식단·고민·모르는 질문) → ai
 * 복싱·식단·마음가짐 화제는 앱 안내 점수가 COACHING_DIRECT_MIN 미만이면 AI 로 보낸다
 * ("다이어트 중에 치킨 먹어도 돼요" 가 153다이어트 소개문으로 답해지지 않게).
 */
export function planOsamiReply(text: string): OsamiPlan {
  const small = smallTalkReply(text);
  if (small) return { kind: "small", reply: small };
  const m = matchOsamiFaq(text);
  const coaching = isCoachingTopic(text);
  const related = m.candidates.filter((c) => c.score >= HINT_MIN);
  if (m.kind === "answer" && m.best) {
    const best = m.best;
    if (coaching && best.score < COACHING_DIRECT_MIN && !ALWAYS_DIRECT.has(best.entry.id)) return { kind: "ai", related };
    return { kind: "faq", best, others: m.candidates.filter((c) => c.entry.id !== best.entry.id) };
  }
  if (m.kind === "suggest") return coaching ? { kind: "ai", related } : { kind: "suggest", candidates: m.candidates };
  return { kind: "ai", related };
}
