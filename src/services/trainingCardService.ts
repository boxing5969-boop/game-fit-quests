/**
 * 🃏 153 콘텐츠 카드 읽기 · 영상 주소 · 영상 넣기 (2026-11-13)
 *
 *   · 카드 = training_exercises (RLS: 켜진 카드는 누구나 읽기 · 쓰기는 마이그레이션 뒤 대표님 · 운영진만)
 *   · select("*") — 영상 칸이 아직 없는 DB(적용 전 · 옛 DB 미리보기)에서도 그대로 읽힌다 (lib/trainingCards normalizeCard)
 *   · 영상은 비공개 저장소 training-videos — 서명 주소(1시간)를 기기 안에 잠깐 기억한다
 *   · 예시 모드(?demo=1, 이 창을 닫을 때까지): 서버를 부르지 않고 lib/trainingCardsSample 의 카드
 *   · 쿼리 열쇠는 ["training-library", …] 아래 — 훈련 라이브러리에서 고치면(invalidate ["training-library"]) 같이 새로 읽는다
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  TRAINING_VIDEO_BUCKET,
  cardMedia,
  normalizeCard,
  trainingVideoPath,
  type TrainingCard,
} from "@/lib/trainingCards";
import { SAMPLE_TRAINING_CARDS } from "@/lib/trainingCardsSample";

const DEMO_KEY = "153cards:demo";

/** 예시 모드 — 주소에 ?demo=1 이 한 번이라도 있었으면 이 창(탭)을 닫을 때까지 */
export function isTrainingDemo(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search).get("demo");
    if (q === "1") {
      window.sessionStorage.setItem(DEMO_KEY, "1");
      return true;
    }
    if (q === "0") window.sessionStorage.removeItem(DEMO_KEY);
    return window.sessionStorage.getItem(DEMO_KEY) === "1";
  } catch {
    return false;
  }
}

export const TRAINING_CARDS_KEY = ["training-library", "cards"] as const;

/** 켜진 카드 전부 (순서대로) — 회원 · 코치진 화면이 같이 쓴다. 표가 없거나 못 읽으면 빈 목록 */
export function useTrainingCards(enabled = true) {
  const demo = isTrainingDemo();
  return useQuery({
    queryKey: [...TRAINING_CARDS_KEY, demo ? "demo" : "db"],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<TrainingCard[]> => {
      if (demo) return SAMPLE_TRAINING_CARDS;
      const { data, error } = await (supabase as any)
        .from("training_exercises")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) {
        // 옛 DB(미리보기)에 표가 없거나 권한이 없으면 카드 없이 — 화면은 칸을 숨긴다
        if (import.meta.env.DEV) console.warn("[training-cards]", error.message);
        return [];
      }
      return ((data ?? []) as Record<string, unknown>[]).map(normalizeCard).filter((c) => c.id && c.name);
    },
  });
}

/* ───────── 영상 주소 (서명 주소 1시간 · 기기 안에 기억) ───────── */

const SIGN_SEC = 3600;
const signedCache = new Map<string, { url: string; exp: number }>();

const remember = (path: string, url: string) => signedCache.set(path, { url, exp: Date.now() + SIGN_SEC * 1000 });
const recall = (path: string): string | null => {
  const hit = signedCache.get(path);
  return hit && hit.exp > Date.now() + 2 * 60_000 ? hit.url : null;
};

export async function trainingVideoUrl(path: string): Promise<string> {
  const hit = recall(path);
  if (hit) return hit;
  const { data, error } = await supabase.storage.from(TRAINING_VIDEO_BUCKET).createSignedUrl(path, SIGN_SEC);
  if (error || !data?.signedUrl) throw new Error("영상을 불러오지 못했어요 — 잠시 뒤 다시 눌러 주세요");
  remember(path, data.signedUrl);
  return data.signedUrl;
}

/** 첫 장면 그림 여러 장을 한 번에 — 못 받은 것은 빠진다 */
async function signMany(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const need = paths.filter((p) => {
    const hit = recall(p);
    if (hit) out[p] = hit;
    return !hit;
  });
  if (!need.length) return out;
  const { data, error } = await supabase.storage.from(TRAINING_VIDEO_BUCKET).createSignedUrls(need, SIGN_SEC);
  if (error || !data) return out;
  for (const row of data) {
    if (row.path && row.signedUrl) {
      remember(row.path, row.signedUrl);
      out[row.path] = row.signedUrl;
    }
  }
  return out;
}

/** 카드 영상 주소 — 회원용 또는 코치용(없으면 회원용). 저장소 경로면 서명 주소, 링크면 그대로 */
export function useCardVideo(card: TrainingCard | null, who: "member" | "coach", enabled = true) {
  const media = card ? cardMedia(card, who) : null;
  const key = media ? (media.kind === "storage" ? media.path : media.url) : null;
  return useQuery({
    queryKey: ["training-library", "video", key],
    enabled: enabled && !!media,
    staleTime: 45 * 60_000,
    retry: 1,
    queryFn: async (): Promise<string> => {
      if (!media) return "";
      return media.kind === "storage" ? trainingVideoUrl(media.path) : media.url;
    },
  });
}

/** 타일 그림 — 첫 장면(poster_path, 서명) → 없으면 지금 그림(image_url) */
export function useCardPosters(cards: readonly TrainingCard[]) {
  const paths = [...new Set(cards.map((c) => c.poster_path).filter((p): p is string => !!p))].sort();
  const q = useQuery({
    queryKey: ["training-library", "posters", paths.join("|")],
    enabled: paths.length > 0,
    staleTime: 45 * 60_000,
    queryFn: () => signMany(paths),
  });
  const signed = q.data ?? {};
  return (card: TrainingCard): string | null => (card.poster_path && signed[card.poster_path]) || card.image_url || null;
}

/* ───────── 영상 넣기 · 빼기 (대표님 · 운영진 — 저장소 · 표 권한이 서버에서 막는다) ───────── */

export type CardVideoKind = "member" | "coach" | "poster";

const COLUMN: Record<CardVideoKind, "video_path" | "coach_video_path" | "poster_path"> = {
  member: "video_path",
  coach: "coach_video_path",
  poster: "poster_path",
};

/** 크롬으로 넣을 때 한도가 10MB 라 영상은 10MB 안으로 만들어 올린다 (저장소 자체 한도는 50MB) */
export const CARD_VIDEO_MAX_BYTES = 50 * 1024 * 1024;

export async function uploadCardVideo(card: Pick<TrainingCard, "id">, kind: CardVideoKind, file: File): Promise<string> {
  if (file.size > CARD_VIDEO_MAX_BYTES) throw new Error("50MB 아래 파일만 넣을 수 있어요");
  const isPoster = kind === "poster";
  if (isPoster ? !/^image\/(webp|jpeg|png)$/.test(file.type) : file.type !== "video/mp4") {
    throw new Error(isPoster ? "첫 장면은 webp · jpg · png 그림만 넣을 수 있어요" : "영상은 mp4 파일만 넣을 수 있어요");
  }
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const rand = Math.random().toString(36).slice(2, 10);
  const path = trainingVideoPath(kind, card.id, ext, rand);
  const up = await supabase.storage.from(TRAINING_VIDEO_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) throw new Error(`올리지 못했어요 — ${up.error.message}`);
  const { error } = await (supabase as any)
    .from("training_exercises")
    .update({ [COLUMN[kind]]: path })
    .eq("id", card.id);
  if (error) throw new Error(`카드에 붙이지 못했어요 — ${error.message}`);
  return path;
}

/** 카드에서 빼기 — 파일은 저장소에 남는다(되돌릴 수 있게) */
export async function clearCardVideo(card: Pick<TrainingCard, "id">, kind: CardVideoKind): Promise<void> {
  const { error } = await (supabase as any)
    .from("training_exercises")
    .update({ [COLUMN[kind]]: null })
    .eq("id", card.id);
  if (error) throw new Error(`빼지 못했어요 — ${error.message}`);
}
