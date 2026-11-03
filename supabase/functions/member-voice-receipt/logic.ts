// 고객의 소리 영수증 — 판정만 (2026-11-03 대표님 "고객의 소리에도 답변 달수있게해줘")
//   Deno(Edge Function member-voice-receipt)와 vitest(src/lib/memberVoiceReceipt.test.ts)가 같이 쓰는 순수 함수만 둔다 —
//   바깥 모듈을 import 하지 않는다.

/** 앱 고객의 소리 분류 — 153OS 워커 /api/feedback/submit 과 같은 값(서키트 설문은 앱에서 안 낸다) */
export const VOICE_CATEGORIES = ["coach_praise", "improvement", "complaint", "free"] as const;
export type VoiceCategory = (typeof VOICE_CATEGORIES)[number];

export const VOICE_LABEL: Record<string, string> = {
  coach_praise: "코치 칭찬",
  improvement: "개선 제안",
  complaint: "불편·건의",
  free: "자유 한마디",
  circuit: "서키트 설문",
};

/** 영수증 · 회원 '내가 보낸 의견'에 보이는 제목 */
export const voiceTitle = (category: string): string => `고객의 소리 · ${VOICE_LABEL[category] ?? "의견"}`;

export interface ClaimInput {
  slug: string;
  category: VoiceCategory;
  content: string;
  rating: number | null;
}

/** 화면이 보낸 값 확인 — 153OS 워커와 같은 규칙(앞뒤 공백 뺀 내용 2~2000자 · 별점 1~5 또는 없음) */
export function parseClaim(b: unknown): ClaimInput | null {
  if (!b || typeof b !== "object") return null;
  const o = b as Record<string, unknown>;
  const slug = typeof o.slug === "string" ? o.slug.trim() : "";
  if (!slug || slug.length > 64) return null;
  const category = o.category as VoiceCategory;
  if (!VOICE_CATEGORIES.includes(category)) return null;
  const content = typeof o.content === "string" ? o.content.trim() : "";
  if (content.length < 2 || content.length > 2000) return null;
  let rating: number | null = null;
  if (o.rating != null) {
    const r = Number(o.rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) return null;
    rating = r;
  }
  return { slug, category, content, rating };
}

export interface FeedbackRow {
  id: string;
  rating: number | null;
}

export type PickReason = "ok" | "not_found" | "ambiguous";

/**
 * 방금 낸 그 글 하나 고르기 — 153OS 에서 같은 의견함 · 같은 분류 · 같은 글 · 10분 안으로 이미 좁혀 온 줄 중에서
 * 같은 별점이고 아직 영수증이 없는 줄이 **하나뿐일 때만** 고른다. 둘 이상이면(같은 글이 겹침) 아무것도 고르지 않는다 —
 * 다른 사람 글에 답변이 가는 것보다 답변이 저장만 되는 쪽이 낫다.
 */
export function pickClaim(rows: FeedbackRow[], rating: number | null, taken: Set<string>): { id: string | null; reason: PickReason } {
  const left = rows.filter((r) => (r.rating ?? null) === rating && !taken.has(r.id));
  if (left.length === 1) return { id: left[0].id, reason: "ok" };
  return { id: null, reason: left.length ? "ambiguous" : "not_found" };
}
