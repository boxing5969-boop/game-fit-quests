/**
 * 🃏 153 콘텐츠 카드 — 훈련 라이브러리(training_exercises) 한 줄 = 카드 한 장 (2026-11-13 대표님 「추천대로 진행」)
 *
 *   설계 문서 「153 트레이닝 콘텐츠 구조 설계 — 전략 회의 · 훈련 탭」(https://claude.ai/artifact/QRkpNriftYizMqQdaqnZVj)
 *   카드 한 장을 네 곳이 같이 쓴다 — 회원 훈련 탭 「영상으로 배우기」 · 레벨 자세히 › 필수 훈련 ·
 *   전략 회의 오늘 프로그램(카드 고르기) · 수업 기록(가르친 카드) · 영상 칸(153 콘텐츠 카드).
 *
 *   · 분류(category)는 DB 그대로 두고 화면에서만 칸(shelf)으로 묶는다 — 아래 표 한 곳.
 *   · 영상 칸(video_path · coach_video_path · poster_path · minutes · equipment)은 새 마이그레이션(대표님 「적용해」 뒤)에서 생긴다.
 *     그 전 DB · 옛 DB(미리보기)에는 칸이 없으니 모두 '없을 수 있음'으로 읽는다.
 *   · 이 파일은 화면 없는 계산만 — 시험 trainingCards.test.ts (Supabase 를 부르지 않는다)
 */
import type { BlockKind, ProgramBlock } from "@/services/strategyService";
import type { TrainingExercise } from "@/hooks/useTrainingLibrary";
import { toSpokenKo } from "@/lib/spokenKo";

export interface TrainingCard extends TrainingExercise {
  /** 회원용 영상(정사각 · 소리 없음) — 비공개 저장소 training-videos 의 member/… 경로 */
  video_path?: string | null;
  /** 코치용 영상(가로 · 목소리) — coach/… 경로, 코치진만 */
  coach_video_path?: string | null;
  /** 첫 장면 그림 — member/… 경로 (없으면 image_url) */
  poster_path?: string | null;
  /** 기본 몇 분 — 오늘 프로그램 블록 분으로 (없으면 칸 기본값) */
  minutes?: number | null;
  /** 준비물 (예: 아령 0.5~1kg) */
  equipment?: string | null;
}

/**
 * 화면에서 묶는 칸 — 회원 칩 8개 + 준비(붕대 감기 한 줄) + 코치(코치진만)
 *   2026-11-13 대표님 「8칸으로 다시」: 거울 앞 자세 연습 같은 기본기는 '기본기' 칸으로 따로, 미트 · 샌드백 · 짝 연습(스파링 준비)은 '드릴' 칸으로.
 *   옛 칸 id 'mitt'(미트·샌드백)는 주소 · 기기 기억값에서 'drill' 로 이어받는다(normalizeShelf).
 */
export type Shelf = "warmup" | "basics" | "step" | "skill" | "defense" | "drill" | "fitness" | "cooldown" | "prep" | "coach";

export interface ShelfInfo {
  id: Shelf;
  label: string;
  /** 칸 색 — 영상 템플릿 v2 와 같은 색(워밍업 주황 · 스텝 파랑 · 기술 민트 · 방어 보라 · 드릴(옛 미트·샌드백) 코랄) · 기본기 금색 */
  color: string;
  /** minutes 칸이 비었을 때 오늘 프로그램 블록 분 */
  minutes: number;
  /** 검색에 같이 보는 말 — 칸 이름 밖의 말(옛 칸 이름 '미트·샌드백' 등) */
  words?: string;
}

export const SHELF_INFO: Record<Shelf, ShelfInfo> = {
  warmup: { id: "warmup", label: "워밍업", color: "#FF8A3D", minutes: 8 },
  basics: { id: "basics", label: "기본기", color: "#A87400", minutes: 8, words: "거울 앞 자세 · 기본 동작" },
  step: { id: "step", label: "스텝", color: "#3D7BFF", minutes: 5 },
  skill: { id: "skill", label: "기술", color: "#1FB58F", minutes: 5 },
  defense: { id: "defense", label: "방어", color: "#8B5CF6", minutes: 6 },
  drill: { id: "drill", label: "드릴", color: "#FF5A5F", minutes: 8, words: "미트·샌드백 · 짝 연습 · 스파링 준비" },
  fitness: { id: "fitness", label: "체력", color: "#D6336C", minutes: 6 },
  cooldown: { id: "cooldown", label: "쿨다운", color: "#1098AD", minutes: 5 },
  prep: { id: "prep", label: "준비", color: "#6B7684", minutes: 5 },
  coach: { id: "coach", label: "코치", color: "#191F28", minutes: 5 },
};

/** 회원 훈련 탭 칩 순서 (준비 = 맨 위 '붕대 감기' 한 줄 · 코치 = 코치진만) */
export const MEMBER_SHELVES: readonly Shelf[] = ["warmup", "basics", "step", "skill", "defense", "drill", "fitness", "cooldown"];
/** 전략 회의(코치진) 칩 순서 */
export const STAFF_SHELVES: readonly Shelf[] = [...MEMBER_SHELVES, "coach"];

/**
 * DB 분류 → 칸 (설계 문서 「지금 분류 → 회원 칸 · 수업 블록」 표 + 11/13 8칸). 표에 없는 새 분류는 기술 칸.
 *   기본기 = 잽 · 원투 · 훅 · 어퍼 · 거울 스탠스 체크 · 가드 · 번호 콜 / 드릴 = 미트 · 샌드백 · 스파링 준비(짝과 주고받는 연습)
 */
const CATEGORY_SHELF: Record<string, Shelf> = {
  워밍업: "warmup",
  기본기: "basics",
  풋워크: "step",
  콤비네이션: "skill",
  카운터: "skill",
  방어: "defense",
  미트: "drill",
  샌드백: "drill",
  스파링준비: "drill",
  컨디셔닝: "fitness",
  줄넘기: "fitness",
  쿨다운: "cooldown",
  회복: "cooldown",
  준비: "prep",
  코칭: "coach",
};

/** DB 분류 → 오늘 프로그램 블록 종류 (같은 표 · 샌드백은 마무리운동) */
const CATEGORY_BLOCK: Record<string, BlockKind> = {
  워밍업: "warmup",
  풋워크: "skill",
  기본기: "skill",
  콤비네이션: "skill",
  카운터: "skill",
  스파링준비: "skill",
  방어: "defense",
  미트: "mitt",
  샌드백: "conditioning",
  컨디셔닝: "conditioning",
  줄넘기: "conditioning",
  쿨다운: "cooldown",
  회복: "cooldown",
  준비: "etc",
  코칭: "etc",
};

export const KNOWN_CATEGORIES = Object.keys(CATEGORY_SHELF);

/** 예전 칸 id → 지금 칸 (11/13 '미트·샌드백' mitt → '드릴' drill) — 주소 ?shelf= · 기기에 기억한 칸 */
const LEGACY_SHELF: Readonly<Record<string, Shelf>> = { mitt: "drill" };

/** 주소 · 기기 기억값을 칸으로 — 고를 수 있는 칸이 아니면 null */
export function normalizeShelf(v: string | null | undefined, allowed: readonly Shelf[]): Shelf | null {
  if (!v) return null;
  const s = (LEGACY_SHELF[v] ?? v) as Shelf;
  return allowed.includes(s) ? s : null;
}

export const categoryToShelf = (category: string | null | undefined): Shelf => CATEGORY_SHELF[(category ?? "").trim()] ?? "skill";

export const categoryToBlockKind = (category: string | null | undefined): BlockKind =>
  CATEGORY_BLOCK[(category ?? "").trim()] ?? "skill";

export const cardShelf = (card: Pick<TrainingCard, "category">): ShelfInfo => SHELF_INFO[categoryToShelf(card.category)];

/** 회원에게 보이는 카드 — 켜져 있고 코치 칸이 아닌 것 (준비 = 붕대 감기는 맨 위 한 줄로 따로) */
export const isMemberVisible = (card: Pick<TrainingCard, "category" | "is_active">): boolean =>
  card.is_active !== false && categoryToShelf(card.category) !== "coach";

const clampMinutes = (n: number): number => Math.max(1, Math.min(120, Math.round(n)));

/** 블록에 들어갈 분 — 카드의 minutes, 없으면 칸 기본값 */
export const cardMinutes = (card: Pick<TrainingCard, "category" | "minutes">): number => {
  const m = Number(card.minutes);
  return clampMinutes(Number.isFinite(m) && m > 0 ? m : cardShelf(card).minutes);
};

const levelOf = (card: Pick<TrainingCard, "level_min">): number => {
  const n = Number(card.level_min);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

/** 카드 레벨(없으면 0) — 정리표(shelfLayout)의 위 리그 접기도 같은 값 */
export const cardLevel = (card: Pick<TrainingCard, "level_min">): number => levelOf(card);

/**
 * 레벨 표시 — 내 레벨까지는 '레벨 n', 위 레벨은 '레벨 n부터'(잠그지 않는다 · 결정 7번).
 * 레벨이 없는 카드(붕대 감기 등)는 표시 없음.
 */
export function levelTag(card: Pick<TrainingCard, "level_min">, myLevel: number): { text: string; upcoming: boolean } | null {
  const lv = levelOf(card);
  if (!lv) return null;
  const upcoming = lv > Math.max(1, myLevel);
  return { text: upcoming ? `레벨 ${lv}부터` : `레벨 ${lv}`, upcoming };
}

const bySort = (a: TrainingCard, b: TrainingCard) =>
  (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, "ko");

/** 회원 칸 안 순서 — 내 레벨까지의 카드가 먼저(순서대로), 위 레벨 카드는 뒤에 레벨 낮은 것부터 */
export function orderForMember<T extends TrainingCard>(cards: readonly T[], myLevel: number): T[] {
  const me = Math.max(1, myLevel);
  const ready = cards.filter((c) => levelOf(c) <= me).sort(bySort);
  const later = cards.filter((c) => levelOf(c) > me).sort((a, b) => levelOf(a) - levelOf(b) || bySort(a, b));
  return [...ready, ...later];
}

/** 코치진 칸 안 순서 — 레벨 낮은 것부터 */
export function orderForStaff<T extends TrainingCard>(cards: readonly T[]): T[] {
  return [...cards].sort((a, b) => levelOf(a) - levelOf(b) || bySort(a, b));
}

/** 칸으로 나누기 — 칸마다 비어 있으면 키가 없다 */
export function groupByShelf<T extends TrainingCard>(cards: readonly T[]): Partial<Record<Shelf, T[]>> {
  const out: Partial<Record<Shelf, T[]>> = {};
  for (const c of cards) {
    const s = categoryToShelf(c.category);
    (out[s] ??= []).push(c);
  }
  return out;
}

/**
 * 「다음 동작 →」 — 보고 있던 목록에서 같은 칸의 다음 카드 (끝이면 없음).
 * anyShelf: 목록이 이미 한 칸(대표님 정리로 다른 칸에서 옮겨 온 카드도 있음)이면 분류와 상관없이 바로 다음 카드.
 */
export function nextCard<T extends Pick<TrainingCard, "id" | "category">>(
  list: readonly T[],
  current: Pick<TrainingCard, "id" | "category">,
  opts?: { anyShelf?: boolean },
): T | null {
  const i = list.findIndex((c) => c.id === current.id);
  if (i < 0) return null;
  if (opts?.anyShelf) return list[i + 1] ?? null;
  const shelf = categoryToShelf(current.category);
  for (let j = i + 1; j < list.length; j++) {
    if (categoryToShelf(list[j].category) === shelf) return list[j];
  }
  return null;
}

const ORDINAL = ["하나", "둘", "셋", "넷", "다섯", "여섯"];

/** 소리로 읽기 좋게 — 화살표 · 가운뎃점 · 괄호를 말로 */
const speakable = (s: string): string =>
  toSpokenKo(
    s
      .replace(/\s*→\s*/g, ", 그다음 ")
      .replace(/\s*[·•]\s*/g, ", ")
      .replace(/[()[\]「」『』]/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );

/**
 * 「설명 듣기」 — 이름 · 한 줄 · 포인트를 문장마다 (휴대폰 목소리, 153 은 '일오삼').
 * 긴 글 한 번에 읽히면 끊기는 기기가 있어 문장 목록으로 준다.
 */
export function cardSpeech(card: Pick<TrainingCard, "name" | "summary" | "cues">): string[] {
  const out: string[] = [];
  const name = speakable(card.name);
  if (name) out.push(`${name}.`);
  const summary = speakable(card.summary ?? "");
  if (summary) out.push(summary.endsWith(".") ? summary : `${summary}.`);
  const cues = (card.cues ?? []).map(speakable).filter(Boolean).slice(0, ORDINAL.length);
  if (cues.length) {
    out.push("포인트예요.");
    cues.forEach((c, i) => out.push(`${ORDINAL[i]}, ${c}`));
  }
  return out;
}

/** 영상 자리 — 저장소 경로(서명 주소로 바꿔야 함) 또는 바로 쓰는 주소(유튜브 · 링크) */
export type CardMedia = { kind: "storage"; path: string } | { kind: "url"; url: string };

/**
 * 누가 보는 영상인가 — 회원: 회원용 저장소 영상 → 예전 video_url
 *   코치진: 코치용(목소리) → 없으면 회원용과 같다
 */
export function cardMedia(card: Pick<TrainingCard, "video_path" | "coach_video_path" | "video_url">, who: "member" | "coach"): CardMedia | null {
  if (who === "coach" && card.coach_video_path) return { kind: "storage", path: card.coach_video_path };
  if (card.video_path) return { kind: "storage", path: card.video_path };
  const url = (card.video_url ?? "").trim();
  return url ? { kind: "url", url } : null;
}

/** 코치용 영상이 따로 있나 (전략 회의 · 코치진 카드 시트의 「코치용 영상」 단추) */
export const hasCoachVideo = (card: Pick<TrainingCard, "coach_video_path">): boolean => !!card.coach_video_path;

/** 카드에 영상이 붙어 있나 (코치진 타일 · 카드 서랍의 ▶ 표시) */
export const hasCardVideo = (card: Pick<TrainingCard, "video_path" | "coach_video_path" | "video_url">): boolean =>
  !!(card.video_path || card.coach_video_path || (card.video_url ?? "").trim());

/** 회원이 볼 수 있는 영상이 있나 (회원 타일의 ▶ 표시) — 코치용 영상만 붙은 카드는 회원에게 영상이 없다 */
export const hasMemberVideo = (card: Pick<TrainingCard, "video_path" | "video_url">): boolean =>
  !!(card.video_path || (card.video_url ?? "").trim());

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[\s·\-_/()]+/g, "");

/** 서랍 · 영상 칸 검색 — 이름 · 한 줄 · 분류 · 칸 이름 · 준비물 (띄어쓰기 · 가운뎃점 무시) */
export function matchesCardQuery(card: TrainingCard, q: string): boolean {
  return cardMatchRank(card, q) < 3;
}

/** 검색 순서 — 0 이름 · 1 한 줄 · 준비물 · 2 분류 · 칸 이름 · 3 안 맞음 (이름이 맞는 카드가 먼저) */
export function cardMatchRank(card: TrainingCard, q: string): number {
  const n = norm(q);
  if (!n) return 0;
  if (norm(card.name).includes(n)) return 0;
  if ([card.summary, card.target, card.equipment ?? ""].some((s) => norm(s).includes(n))) return 1;
  const shelf = cardShelf(card);
  if ([card.category, shelf.label, shelf.words ?? ""].some((s) => norm(s).includes(n))) return 2;
  return 3;
}

/** 검색 결과 — 맞는 카드만, 이름이 맞는 것부터 (같으면 레벨 · 순서) */
export function searchCards<T extends TrainingCard>(cards: readonly T[], q: string): T[] {
  return orderForStaff(cards.filter((c) => cardMatchRank(c, q) < 3)).sort((a, b) => cardMatchRank(a, q) - cardMatchRank(b, q));
}

export const TRAINING_VIDEO_BUCKET = "training-videos";

/** 저장소 경로 — member/ 는 로그인한 사람 누구나 · coach/ 는 코치진만 (마이그레이션의 저장소 규칙과 같다) */
export function trainingVideoPath(kind: "member" | "coach" | "poster", cardId: string, ext: string, rand: string): string {
  const safeId = cardId.replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "card";
  const safeRand = rand.replace(/[^a-z0-9]/gi, "").slice(0, 12) || "v";
  if (kind === "poster") {
    const e = /^(webp|jpg|jpeg|png)$/i.test(ext) ? ext.toLowerCase() : "webp";
    return `member/poster-${safeId}-${safeRand}.${e}`;
  }
  return `${kind}/${safeId}-${safeRand}.mp4`;
}

/** 오늘 프로그램 블록 하나 — 카드를 고르면 이름 · 분 · 블록 종류가 채워진다 */
export function cardToBlock(card: TrainingCard, note = ""): ProgramBlock {
  return {
    kind: categoryToBlockKind(card.category),
    title: card.name.slice(0, 80),
    minutes: cardMinutes(card),
    card_id: card.id,
    mission_id: null,
    video_id: null,
    note,
  };
}

/**
 * 「이 카드로 오늘 프로그램 만들기」 — 기본 틀에서 같은 종류의 빈 블록을 채우고, 없으면 쿨다운 앞에 끼운다.
 * 받은 블록 배열은 그대로 두고 새 배열을 돌려준다.
 */
export function placeCardInBlocks(blocks: readonly ProgramBlock[], card: TrainingCard): ProgramBlock[] {
  const out = blocks.map((b) => ({ ...b }));
  const block = cardToBlock(card);
  const empty = out.findIndex((b) => b.kind === block.kind && !b.title.trim() && !b.card_id && !b.video_id && !b.mission_id);
  if (empty >= 0) {
    out[empty] = { ...block, note: out[empty].note ?? "" };
    return out;
  }
  const cool = out.findIndex((b) => b.kind === "cooldown");
  out.splice(cool >= 0 ? cool : out.length, 0, block);
  return out;
}

/** 오늘 프로그램에 붙은 153 카드 id (수업 기록의 칩 — 겹치면 한 번) */
export function programCardIds(blocks: readonly Pick<ProgramBlock, "card_id">[] | null | undefined): string[] {
  const seen = new Set<string>();
  for (const b of blocks ?? []) {
    if (b.card_id && !seen.has(b.card_id)) seen.add(b.card_id);
  }
  return [...seen];
}

/** DB 한 줄 → 카드 (칸이 없거나 모양이 달라도 화면이 깨지지 않게) */
export function normalizeCard(row: Record<string, unknown>): TrainingCard {
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const strOrNull = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()) : []);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : v == null ? null : Number(v) || null);
  return {
    id: str(row.id),
    category: str(row.category) || "기본기",
    name: str(row.name),
    summary: str(row.summary),
    description: str(row.description),
    benefits: str(row.benefits),
    target: str(row.target),
    difficulty: str(row.difficulty) || "초급",
    cues: list(row.cues),
    mistakes: list(row.mistakes),
    level_min: Number(row.level_min) || 0,
    sort_order: Number(row.sort_order) || 0,
    image_url: strOrNull(row.image_url),
    video_url: strOrNull(row.video_url),
    is_active: row.is_active !== false,
    video_path: strOrNull(row.video_path),
    coach_video_path: strOrNull(row.coach_video_path),
    poster_path: strOrNull(row.poster_path),
    minutes: num(row.minutes),
    equipment: strOrNull(row.equipment),
  };
}
