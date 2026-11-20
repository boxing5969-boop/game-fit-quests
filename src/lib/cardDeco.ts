/**
 * 🎨 프로필 카드 꾸미기 (2026-11-21 대표님 「리뷰를 달면 마일리지와 선물을 드리자 · 회원님들 프로필 카드 꾸밀 수 있는 선물 ·
 * 프로필 카드를 이쁘게 꾸밀 수 있는 기능 · 꾸민 프로필 카드는 사이니지에 뜨게」).
 *
 * 칸 네 개 — 테두리(frame) · 바탕(skin) · 스티커(sticker) · 칭호(title). 칸마다 하나씩 낀다(안 껴도 된다).
 * 이름이 free_ 로 시작하면 누구나, 아니면 받은 것만(서버 _card_deco_ok 가 같은 규칙으로 막는다).
 * 리뷰 미션 선물 = 서버 _review_gifts 와 같은 이름 — 여기 REVIEW_GIFTS 를 바꾸면 서버 함수도 같이.
 * 구글은 보상 없이 부탁만(2026-11-21 02:07 대표님) — 예전 구글 선물(사파이어 · 별)은 기본 꾸미기로 옮겼다.
 *
 * 그림은 CSS 만(움직임 없음) — TV 에서 카드 수십 장이 같이 떠도 다시 그리지 않는다. 바탕은 모두 어두운 색(카드 글자가 흰색).
 * 153 브랜드: 민트 #3fe8c0 · 금색 #f5c453 · 보라와 파랑을 섞지 않는다 · 네온 게임 느낌 없이.
 */
import { icon3dSrc } from "@/lib/emoji3d/map";

export type DecoSlot = "frame" | "skin" | "sticker" | "title";
export type DecoSource = "free" | "review_naver" | "review_google" | "review_daangn" | "review_all";

export interface DecoItem {
  id: string;
  slot: DecoSlot;
  name: string;
  source: DecoSource;
  /** 테두리 — 카드 둘레 선(그라디언트) · 바깥 빛(멈춘 그림자) */
  edge?: string;
  glow?: string;
  /** 바탕 — 카드 면 */
  face?: string;
  /** 스티커 — 153 입체 아이콘 이름 */
  icon?: string;
  /** 칭호 — 카드 머리줄 글 · 글자색 */
  text?: string;
  textClass?: string;
}

export const DECO_ITEMS: readonly DecoItem[] = [
  // ── 테두리 ──
  {
    id: "free_frame_silver",
    slot: "frame",
    name: "실버 라인",
    source: "free",
    edge: "linear-gradient(135deg, #f5f7fa 0%, #9aa4b1 38%, #e9edf1 58%, #7c8693 100%)",
    glow: "0 6px 22px rgba(205, 214, 228, 0.18), 0 0 0 1px rgba(205, 214, 228, 0.25)",
  },
  {
    id: "free_frame_mint",
    slot: "frame",
    name: "153 민트",
    source: "free",
    edge: "linear-gradient(135deg, #3fe8c0 0%, #0f7d68 42%, #6ff2d2 66%, #0b5f4f 100%)",
    glow: "0 6px 26px rgba(63, 232, 192, 0.28), 0 0 0 1px rgba(63, 232, 192, 0.35)",
  },
  {
    id: "frame_supporter",
    slot: "frame",
    name: "153 골드 서포터",
    source: "review_all",
    edge: "linear-gradient(135deg, #fff1b8 0%, #f5c453 22%, #3fe8c0 48%, #e0a326 74%, #fff1b8 100%)",
    glow: "0 0 0 1.5px rgba(245, 196, 83, 0.55), 0 10px 34px rgba(245, 196, 83, 0.32), 0 0 60px rgba(63, 232, 192, 0.16)",
  },
  // ── 바탕 ──
  {
    id: "free_skin_carbon",
    slot: "skin",
    name: "카본",
    source: "free",
    face: "repeating-linear-gradient(45deg, rgba(255,255,255,0.035) 0 2px, transparent 2px 6px), linear-gradient(135deg, #1b1e23 0%, #0d0f12 100%)",
  },
  {
    id: "free_skin_navy",
    slot: "skin",
    name: "미드나잇",
    source: "free",
    face: "radial-gradient(110% 80% at 100% 0%, rgba(148, 163, 184, 0.16), transparent 60%), linear-gradient(135deg, #0e1a2e 0%, #08101d 60%, #0c1626 100%)",
  },
  {
    id: "skin_emerald",
    slot: "skin",
    name: "에메랄드",
    source: "review_naver",
    face: "radial-gradient(120% 90% at 0% 0%, rgba(63, 232, 192, 0.30), transparent 55%), repeating-linear-gradient(135deg, rgba(63,232,192,0.05) 0 1px, transparent 1px 9px), linear-gradient(135deg, #06291f 0%, #04140f 60%, #0a2a22 100%)",
  },
  {
    id: "free_skin_sapphire",
    slot: "skin",
    name: "사파이어",
    source: "free",
    face: "radial-gradient(120% 90% at 100% 0%, rgba(96, 165, 250, 0.32), transparent 55%), repeating-radial-gradient(circle at 0% 100%, rgba(255,255,255,0) 0 10px, rgba(147,197,253,0.06) 10px 11px), linear-gradient(135deg, #0b1d3f 0%, #060e20 60%, #0d2350 100%)",
  },
  {
    id: "skin_sunset",
    slot: "skin",
    name: "선셋",
    source: "review_daangn",
    face: "radial-gradient(120% 90% at 0% 100%, rgba(255, 138, 61, 0.38), transparent 60%), radial-gradient(80% 60% at 100% 0%, rgba(245, 196, 83, 0.18), transparent 60%), linear-gradient(135deg, #2a1206 0%, #140804 60%, #3a1a08 100%)",
  },
  // ── 스티커 ──
  { id: "free_sticker_glove", slot: "sticker", name: "글러브", source: "free", icon: "glove_red" },
  { id: "free_sticker_fire", slot: "sticker", name: "불꽃", source: "free", icon: "fire" },
  { id: "free_sticker_muscle", slot: "sticker", name: "근육", source: "free", icon: "muscle" },
  { id: "sticker_bolt", slot: "sticker", name: "번개", source: "review_naver", icon: "bolt" },
  { id: "free_sticker_star", slot: "sticker", name: "별", source: "free", icon: "star" },
  { id: "sticker_heart", slot: "sticker", name: "하트", source: "review_daangn", icon: "heart_red" },
  { id: "sticker_crown", slot: "sticker", name: "왕관", source: "review_all", icon: "crown" },
  // ── 칭호 ──
  { id: "free_title_round", slot: "title", name: "오늘도 한 라운드", source: "free", text: "오늘도 한 라운드" },
  { id: "free_title_steady", slot: "title", name: "꾸준함이 무기", source: "free", text: "꾸준함이 무기" },
  { id: "free_title_happy", slot: "title", name: "153 건강과 행복", source: "free", text: "153 건강과 행복" },
  { id: "title_supporter", slot: "title", name: "153 서포터", source: "review_all", text: "153 서포터", textClass: "text-[#f5c453]" },
];

const BY_ID = new Map(DECO_ITEMS.map((d) => [d.id, d]));

export const DECO_SLOTS: readonly { slot: DecoSlot; label: string }[] = [
  { slot: "frame", label: "테두리" },
  { slot: "skin", label: "바탕" },
  { slot: "sticker", label: "스티커" },
  { slot: "title", label: "칭호" },
];

/** 리뷰 미션 선물 — 서버 public._review_gifts 와 같은 이름 */
export const REVIEW_GIFTS: Record<"naver" | "google" | "daangn" | "all", readonly string[]> = {
  naver: ["skin_emerald", "sticker_bolt"],
  google: [],
  daangn: ["skin_sunset", "sticker_heart"],
  all: ["frame_supporter", "sticker_crown", "title_supporter"],
};

export const SOURCE_LABEL: Record<DecoSource, string> = {
  free: "기본",
  review_naver: "네이버 리뷰 미션 선물",
  review_google: "구글 리뷰 미션 선물",
  review_daangn: "당근 리뷰 미션 선물",
  review_all: "리뷰 미션 모두 완료 선물",
};

export interface CardDecoStyle {
  frame?: string | null;
  skin?: string | null;
  sticker?: string | null;
  title?: string | null;
}

export interface ResolvedDeco {
  frame: DecoItem | null;
  skin: DecoItem | null;
  sticker: DecoItem | null;
  title: DecoItem | null;
}

export const decoItem = (id: string | null | undefined): DecoItem | null => (id ? BY_ID.get(id) ?? null : null);

const pick = (id: unknown, slot: DecoSlot): string | null => {
  if (typeof id !== "string") return null;
  const it = BY_ID.get(id);
  return it && it.slot === slot ? it.id : null;
};

/** 서버 값 → 아는 이름만 남긴다(모르는 이름 · 칸이 틀린 이름은 버림). 낀 게 하나도 없으면 null */
export function normalizeDeco(raw: unknown): CardDecoStyle | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const out: CardDecoStyle = {
    frame: pick(r.frame, "frame"),
    skin: pick(r.skin, "skin"),
    sticker: pick(r.sticker, "sticker"),
    title: pick(r.title, "title"),
  };
  return out.frame || out.skin || out.sticker || out.title ? out : null;
}

export function resolveDeco(d: CardDecoStyle | null | undefined): ResolvedDeco | null {
  const n = normalizeDeco(d);
  if (!n) return null;
  return { frame: decoItem(n.frame), skin: decoItem(n.skin), sticker: decoItem(n.sticker), title: decoItem(n.title) };
}

export const isFreeItem = (id: string) => id.startsWith("free_");

/** 낄 수 있나 — 기본(free_)이거나 받은 것 */
export const isUnlocked = (id: string, owned: ReadonlySet<string>) => isFreeItem(id) || owned.has(id);

export const itemsOf = (slot: DecoSlot) => DECO_ITEMS.filter((d) => d.slot === slot);

export const stickerSrc = (it: DecoItem | null) => (it?.icon ? icon3dSrc(it.icon) : null);

/** 선물 이름들 — '에메랄드 바탕 · 번개 스티커' */
export function giftLine(ids: readonly string[]): string {
  const slotWord: Record<DecoSlot, string> = { frame: "테두리", skin: "바탕", sticker: "스티커", title: "칭호" };
  return ids
    .map((id) => decoItem(id))
    .filter((d): d is DecoItem => !!d)
    .map((d) => `${d.name} ${slotWord[d.slot]}`)
    .join(" · ");
}
