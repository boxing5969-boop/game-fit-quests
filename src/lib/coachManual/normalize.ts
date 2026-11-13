/**
 * 📘 153 매뉴얼 — DB 책(coach_manual_books.data) → 화면용 책 (깨진 칸이 화면을 죽이지 않게)
 *
 *   책 글은 DB 에서 고친다(Claude 가 SQL 로 — 저장소에 글을 넣지 않는다). 손으로 고친 JSON 이 조금 틀려도
 *   · 모르는 블록 · 빈 카드 · 정답 자리가 보기 밖인 문제는 버리고
 *   · 장 id · 그림 이름 · 영상 id 가 규칙에 안 맞으면 그 항목을 버린다 (주소에 쓰이는 이름이라)
 *   필독 장이 하나도 없거나 장이 비면 null → 화면은 앱 안 예시(book1Sample)를 쓴다. 테스트 normalize.test.ts
 *
 *   일반 장(프롤로그~9장)은 앱 안 예시와 같은 글이라 DB 에는 {"id":"ch1","from":"app","version":1} 만 둔다(2026-11-11)
 *   → fallback(앱 안 책)의 같은 id 장을 쓰고 판(version) · 필독(required)만 DB 값을 따른다.
 *   그 장 글을 고칠 때는 DB 에 장 전체를 넣는다 — DB 글이 앞선다(앱을 다시 올리지 않아도 바뀜)
 */
import type { ManualBlock, ManualBook, ManualCard, ManualChapter, ManualQuiz } from "./types";

const ID_RE = /^[a-z0-9_]{1,24}$/;
const ASSET_RE = /^[a-z0-9-]{1,48}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** 수업 템플릿 id (classTemplates — 소문자 · 숫자 · -) · 순서 영상 자리(DB step 0~20) */
const TEMPLATE_RE = /^[a-z0-9-]{1,40}$/;
const MAX_TEMPLATE_STEP = 20;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const strOrNull = (v: unknown): string | null => str(v) || null;
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter((s) => s.length > 0) : []);
const int = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : fallback;

export function normalizeBlock(raw: unknown): ManualBlock | null {
  if (!isObj(raw)) return null;
  switch (raw.t) {
    case "p":
    case "quote": {
      const text = str(raw.text);
      return text ? { t: raw.t, text } : null;
    }
    case "ul": {
      const items = strList(raw.items);
      return items.length ? { t: "ul", items } : null;
    }
    case "ol": {
      const items = strList(raw.items);
      if (!items.length) return null;
      const start = int(raw.start, 0);
      return start >= 1 ? { t: "ol", items, start } : { t: "ol", items };
    }
    case "table": {
      const head = Array.isArray(raw.head) ? raw.head.map(str) : [];
      const rows = Array.isArray(raw.rows)
        ? raw.rows.filter(Array.isArray).map((r) => (r as unknown[]).map(str)).filter((r) => r.some((c) => c))
        : [];
      return rows.length ? { t: "table", head, rows } : null;
    }
    case "image": {
      const src = str(raw.src);
      return ASSET_RE.test(src) ? { t: "image", src, alt: str(raw.alt) } : null;
    }
    case "video": {
      const missionId = str(raw.missionId);
      const poster = str(raw.poster);
      const title = str(raw.title);
      if (!UUID_RE.test(missionId) || !ASSET_RE.test(poster) || !title) return null;
      const caption = str(raw.caption);
      return caption ? { t: "video", missionId, poster, title, caption } : { t: "video", missionId, poster, title };
    }
    case "card": {
      const cardId = str(raw.cardId);
      if (!UUID_RE.test(cardId)) return null;
      const caption = str(raw.caption);
      return caption ? { t: "card", cardId, caption } : { t: "card", cardId };
    }
    case "tplvideo": {
      const template = str(raw.template);
      const title = str(raw.title);
      const step = typeof raw.step === "number" && Number.isInteger(raw.step) ? raw.step : -1;
      if (!TEMPLATE_RE.test(template) || step < 0 || step > MAX_TEMPLATE_STEP || !title) return null;
      const caption = str(raw.caption);
      return caption ? { t: "tplvideo", template, step, title, caption } : { t: "tplvideo", template, step, title };
    }
    default:
      return null;
  }
}

function normalizeCard(raw: unknown): ManualCard | null {
  if (!isObj(raw)) return null;
  const blocks = (Array.isArray(raw.blocks) ? raw.blocks : []).map(normalizeBlock).filter((b): b is ManualBlock => !!b);
  return blocks.length ? { title: strOrNull(raw.title), blocks } : null;
}

function normalizeQuiz(raw: unknown): ManualQuiz | null {
  if (!isObj(raw)) return null;
  const q = str(raw.q);
  const options = strList(raw.options);
  const answer = int(raw.answer, -1);
  if (!q || options.length < 2 || answer < 0 || answer >= options.length) return null;
  return { q, options, answer, why: str(raw.why) };
}

function normalizeChapter(raw: unknown, fallback: ManualBook | null): ManualChapter | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id);
  if (!ID_RE.test(id)) return null;
  // 일반 장 — 앱 안 글 + DB 의 판 · 필독
  if (raw.from === "app") {
    const base = fallback?.chapters.find((c) => c.id === id);
    if (!base) return null;
    return {
      ...base,
      version: typeof raw.version === "number" && Number.isFinite(raw.version) ? Math.max(1, Math.trunc(raw.version)) : base.version,
      required: typeof raw.required === "boolean" ? raw.required : base.required,
    };
  }
  const title = str(raw.title);
  if (!title) return null;
  const cards = (Array.isArray(raw.cards) ? raw.cards : []).map(normalizeCard).filter((c): c is ManualCard => !!c);
  if (!cards.length) return null;
  const image = str(raw.image);
  return {
    id,
    no: str(raw.no) || title,
    title,
    gain: strOrNull(raw.gain),
    minutes: Math.max(0, int(raw.minutes, 0)),
    image: ASSET_RE.test(image) ? image : null,
    version: Math.max(1, int(raw.version, 1)),
    required: raw.required === true,
    cards,
    today: strOrNull(raw.today),
    quiz: (Array.isArray(raw.quiz) ? raw.quiz : []).map(normalizeQuiz).filter((q): q is ManualQuiz => !!q),
  };
}

export function normalizeBook(raw: unknown, fallback: ManualBook | null = null): ManualBook | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id);
  if (!ID_RE.test(id)) return null;
  const seen = new Set<string>();
  const chapters = (Array.isArray(raw.chapters) ? raw.chapters : [])
    .map((c) => normalizeChapter(c, fallback))
    .filter((c): c is ManualChapter => !!c && !seen.has(c.id) && !!seen.add(c.id));
  if (!chapters.some((c) => c.required)) return null;
  const cover = str(raw.cover);
  return {
    id,
    no: str(raw.no) || "1권",
    title: str(raw.title) || "153 매뉴얼",
    tagline: strOrNull(raw.tagline),
    cover: ASSET_RE.test(cover) ? cover : "cover",
    guide: strList(raw.guide),
    signature: strOrNull(raw.signature),
    source: str(raw.source),
    chapters,
  };
}
