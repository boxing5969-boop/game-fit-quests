/**
 * 153 응원 스티커 — 글자 10개 그대로 + 상황 스티커 2개, 그림은 153 입체 스티커 (2026-10-16 대표님 승인)
 *   그림: Higgsfield(GPT Image 2.5) 시트 → public/assets/cheer/*.webp (256px, 투명)
 *   서버(send_boxing_cheer)는 스티커 글자를 그대로 저장한다 — 글자를 바꾸면 예전 응원은 그림 없이 글자로만 보인다.
 */

export type CheerSituation = "birthday" | "promoted" | "returning";

export interface CheerSticker {
  text: string;
  key: string;
  /** 이 상황인 동료에게 맨 앞에 추천 */
  recommendFor?: CheerSituation;
  /** 그 상황일 때만 보이는 스티커 (생일·승급) */
  onlyWhen?: boolean;
}

/** 그림을 바꾸면 올린다 (브라우저 캐시) */
export const CHEER_STICKER_VERSION = 1;

export const CHEER_STICKER_LIST: readonly CheerSticker[] = [
  { text: "나이스 잽!", key: "cheer-jab" },
  { text: "오늘 폼 좋다!", key: "cheer-form" },
  { text: "가드 살아있네!", key: "cheer-guard" },
  { text: "한 라운드 더 가자!", key: "cheer-round" },
  { text: "포기 안 한 게 진짜 승리!", key: "cheer-trophy" },
  { text: "어제의 나를 이겼네요!", key: "cheer-yesterday" },
  { text: "오삼이가 인정한 파이터!", key: "cheer-certified" },
  { text: "샌드백이 떨고 있다!", key: "cheer-sandbag" },
  { text: "돌아온 것부터 승리!", key: "cheer-comeback", recommendFor: "returning" },
  { text: "오늘도 링에 올랐군!", key: "cheer-ring" },
  { text: "승급 축하해요!", key: "cheer-belt", recommendFor: "promoted", onlyWhen: true },
  { text: "생일 축하해요!", key: "cheer-birthday", recommendFor: "birthday", onlyWhen: true },
];

/** 응원 화면 장식용 (받은 응원함 머리 등) */
export const CHEER_BUMP_ICON = `/assets/cheer/cheer-bump.webp?v=${CHEER_STICKER_VERSION}`;

const BY_TEXT = new Map(CHEER_STICKER_LIST.map((s) => [s.text, s]));

/** 스티커 글자 → 그림 주소 (예전 글자·박수 등 모르는 글자면 null) */
export function cheerStickerImage(text: string | null | undefined): string | null {
  const s = text ? BY_TEXT.get(text.trim()) : undefined;
  return s ? `/assets/cheer/${s.key}.webp?v=${CHEER_STICKER_VERSION}` : null;
}

/** 첫 칸만 누르는 쏠림(21번 중 15번 '나이스 잽!')을 막으려고 받는 사람·날짜마다 순서를 섞는다 */
function seededOrder<T>(list: readonly T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const j = (h >>> 0) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 이 동료에게 보여 줄 스티커 순서 — 상황 추천 먼저, 나머지는 섞어서 */
export function stickersFor(
  receiverId: string,
  situations: Partial<Record<CheerSituation, boolean>>,
): { list: CheerSticker[]; recommended: string | null } {
  const today = new Date().toISOString().slice(0, 10);
  const active = CHEER_STICKER_LIST.filter((s) => !s.onlyWhen || (s.recommendFor && situations[s.recommendFor]));
  const picks = (["birthday", "promoted", "returning"] as const).filter((k) => situations[k]);
  const rec = picks.map((k) => active.find((s) => s.recommendFor === k)).find(Boolean) ?? null;
  const rest = seededOrder(active.filter((s) => s !== rec), `${receiverId}:${today}`);
  return { list: rec ? [rec, ...rest] : rest, recommended: rec?.text ?? null };
}

/** 한마디 추천 (고정 문구 — 누르면 채워진다) */
export const CHEER_NOTE_SUGGESTIONS = ["오늘도 수고했어요!", "같이 운동해서 힘났어요", "다음에 미트 잡아 줄게요"] as const;
