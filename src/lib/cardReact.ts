/**
 * 💬 영상으로 배우기 3단계 — 반응 · 의견 · 찾았는데 없는 동작 · 영상 찍어 주세요 (2026-11-15 대표님 「3단계시작」)
 *
 *   계산 · 글 한 곳 — 서버 supabase/migrations/20261115010941_training_card_react.sql 과 같은 말 · 같은 셈
 *   · ♥ — 회원 화면 숫자는 ♥ 누른 회원이 5명을 넘을 때만(결정 5번). 코치진 화면은 숫자 전부
 *   · 쉬워요 · 딱 좋아요 · 어려워요 — 한 번 고르고, 다시 누르면 지움
 *   · 코치님께 의견 — 300자 · 하루 5개 · 그 지점 코치진 · 대표님만 본다(결정 4번) → 코치님 답이 회원님께
 *   · 찾았는데 없는 동작 · 영상 찍어 주세요 — 검색어 열쇠는 띄어쓰기 · 가운뎃점 · 줄표 · 괄호를 뺀 글(화면 찾기와 같은 셈)
 *   감정 설계: 내 말이 수업을 바꾼다는 존중 · 작은 숫자는 숨김 · 코치님 답이 감
 */

export type Feel = "easy" | "ok" | "hard";

export const FEELS: readonly { id: Feel; label: string }[] = [
  { id: "easy", label: "쉬워요" },
  { id: "ok", label: "딱 좋아요" },
  { id: "hard", label: "어려워요" },
];

/** 회원 화면 ♥ 숫자는 이 수를 넘을 때만 (결정 5번) */
export const HEART_SHOW_OVER = 5;
export const OPINION_MAX = 300;
export const OPINION_PER_DAY = 5;
export const ASK_QUERY_MAX = 40;

export interface CardReply {
  body: string;
  at: string;
  by: { name: string; title: string };
  mine: boolean;
}

export interface CardOpinion {
  id: string;
  item: string;
  body: string;
  at: string;
  reply: CardReply | null;
  /** 답이 없거나, 답을 읽었다 */
  seen: boolean;
}

/** 코치진 화면 — 회원 이름 · 지점 · 카드 이름 · 답할 수 있나 */
export interface StaffOpinion extends CardOpinion {
  branch: string | null;
  itemName: string;
  owner: { userId: string; name: string; avatarUrl: string | null };
  canReply: boolean;
}

export interface CardCounts {
  hearts: number;
  easy: number;
  ok: number;
  hard: number;
  /** 영상 찍어 주세요 */
  asks: number;
  opinions: number;
}

export interface CardSocial {
  viewer: "member" | "staff";
  me: { heart: boolean; feel: Feel | null; asked: boolean };
  /** ♥ 누른 회원 수 — 5명을 넘을 때만(서버가 가린다) */
  hearts: number | null;
  /** 내 의견과 답 */
  opinions: CardOpinion[];
  staff: { counts: CardCounts; opinions: StaffOpinion[] } | null;
}

export interface OpinionList {
  branch: string | null;
  waiting: number;
  opinions: StaffOpinion[];
}

/* ───────── 읽기 (서버 값을 믿지 않고 다듬기) ───────── */

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};
const isFeel = (v: unknown): v is Feel => v === "easy" || v === "ok" || v === "hard";

function parseReply(v: unknown): CardReply | null {
  if (!v || typeof v !== "object") return null;
  const r = obj(v);
  const body = str(r.body);
  if (!body) return null;
  const by = obj(r.by);
  return { body, at: str(r.at), by: { name: str(by.name) || "코치", title: str(by.title) || "코치" }, mine: r.mine === true };
}

export function parseOpinion(v: unknown): CardOpinion | null {
  const r = obj(v);
  const id = str(r.id);
  if (!id) return null;
  const reply = parseReply(r.reply);
  return { id, item: str(r.item), body: str(r.body), at: str(r.at), reply, seen: reply ? r.seen === true : true };
}

export function parseStaffOpinion(v: unknown): StaffOpinion | null {
  const base = parseOpinion(v);
  if (!base) return null;
  const r = obj(v);
  const owner = obj(r.owner);
  return {
    ...base,
    branch: str(r.branch) || null,
    itemName: str(r.item_name) || "카드",
    owner: { userId: str(owner.user_id), name: str(owner.name) || "회원", avatarUrl: str(owner.avatar_url) || null },
    canReply: r.can_reply === true,
  };
}

const list = <T>(v: unknown, f: (x: unknown) => T | null): T[] => (Array.isArray(v) ? v.map(f).filter((x): x is T => !!x) : []);

export function parseSocial(v: unknown): CardSocial {
  const r = obj(v);
  const me = obj(r.me);
  const st = r.staff && typeof r.staff === "object" ? obj(r.staff) : null;
  const c = obj(st?.counts);
  const hearts = num(r.hearts);
  return {
    viewer: r.viewer === "staff" ? "staff" : "member",
    me: { heart: me.heart === true, feel: isFeel(me.feel) ? me.feel : null, asked: me.asked === true },
    hearts: hearts > HEART_SHOW_OVER ? hearts : null,
    opinions: list(r.opinions, parseOpinion),
    staff: st
      ? {
          counts: { hearts: num(c.hearts), easy: num(c.easy), ok: num(c.ok), hard: num(c.hard), asks: num(c.asks), opinions: num(c.opinions) },
          opinions: list(st.opinions, parseStaffOpinion),
        }
      : null,
  };
}

export function parseOpinionList(v: unknown): OpinionList {
  const r = obj(v);
  return { branch: str(r.branch) || null, waiting: num(r.waiting), opinions: list(r.opinions, parseStaffOpinion) };
}

/* ───────── 글 · 검사 (서버와 같은 말) ───────── */

export const feelLabel = (f: Feel | null): string => FEELS.find((x) => x.id === f)?.label ?? "";

/** 회원 화면 ♥ 숫자 — 5명을 넘을 때만 */
export const heartCountText = (hearts: number | null): string | null => (hearts != null && hearts > HEART_SHOW_OVER ? String(hearts) : null);

export function opinionError(body: string): string | null {
  const t = body.trim();
  if (t.length < 1) return "의견을 적어 주세요";
  if (t.length > OPINION_MAX) return `의견은 ${OPINION_MAX}자까지 써요`;
  return null;
}

export function replyError(body: string): string | null {
  const t = body.trim();
  if (t.length < 1) return "답을 적어 주세요";
  if (t.length > OPINION_MAX) return `답은 ${OPINION_MAX}자까지 써요`;
  return null;
}

/** 찾기 글 — 띄어쓰기를 한 칸으로 · 40자 (서버가 남기는 글) */
export const cleanQuery = (q: string): string => q.replace(/\s+/g, " ").trim().slice(0, ASK_QUERY_MAX);

/** 검색어 열쇠 — 서버 training_card_ask 와 같은 셈 (2글자 아래면 null) */
export function askKey(q: string): string | null {
  const norm = cleanQuery(q).toLowerCase().replace(/[\s·_/()-]+/g, "").slice(0, ASK_QUERY_MAX);
  return norm.length >= 2 ? `q:${norm}` : null;
}

/** 코치진 화면 숫자 한 줄 — 0인 칸은 빼고 (빈 것은 그리지 않기) */
export function countChips(c: CardCounts): { key: string; label: string; strong: boolean }[] {
  const out: { key: string; label: string; strong: boolean }[] = [];
  if (c.hearts) out.push({ key: "hearts", label: `♥ ${c.hearts}`, strong: false });
  for (const f of FEELS) {
    const n = c[f.id];
    if (n) out.push({ key: f.id, label: `${f.label} ${n}`, strong: f.id === "hard" && n >= 3 && n * 2 >= c.easy + c.ok + c.hard });
  }
  if (c.asks) out.push({ key: "asks", label: `영상 요청 ${c.asks}`, strong: false });
  return out;
}

/** 어려워요 비율(%) — 고른 사람이 3명 이상일 때만 */
export function hardPercent(c: Pick<CardCounts, "easy" | "ok" | "hard">): number | null {
  const total = c.easy + c.ok + c.hard;
  return total >= 3 ? Math.round((c.hard / total) * 100) : null;
}

/** 누른 뒤 화면 — 서버 답을 기다리지 않고 먼저 (♥ 숫자는 서버 값이 올 때 바뀐다) */
export function applyReact(s: CardSocial, patch: { heart?: boolean; feel?: Feel | null }): CardSocial {
  return {
    ...s,
    me: {
      ...s.me,
      heart: patch.heart ?? s.me.heart,
      feel: patch.feel === undefined ? s.me.feel : patch.feel,
    },
  };
}
