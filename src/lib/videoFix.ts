// 🎬 영상 고쳐 주세요 — 화면 없는 계산 한 곳 (2026-11-17 대표님 「복덩이네앱에 설치한 편집 프로그램을 여기도 설치해서
//   앱안에서 내가 너에게 이영상은 어떤 동작인지 간략하게 설명을 할게 그럼 니가 편집을 다시해줘」)
//   서버 = supabase/migrations/20261117112356_training_video_fix.sql — 검사 말은 서버와 같다(시험 videoFix.test.ts 가 견준다).
//   대표님 · 운영진이 카드 영상을 보다가 「이 장면 고쳐 달라기」 → 클로드가 다시 만든 영상을 올리면 카드 시트에서 「이대로 붙이기」.

export type VideoFixCat = "motion" | "cut" | "text" | "sound" | "other";
export type VideoFixState = "requested" | "doing" | "done" | "skip" | "canceled";
export type VideoCandidateState = "review" | "approved" | "rejected";

export interface VideoFix {
  id: string;
  cardId: string;
  cardName: string;
  videoPath: string | null;
  atSec: number;
  fromSec: number | null;
  toSec: number | null;
  motion: string;
  cat: VideoFixCat;
  body: string;
  held: boolean;
  heldVideoPath: string | null;
  heldPosterPath: string | null;
  state: VideoFixState;
  reply: string;
  byName: string;
  createdAt: string;
  doneAt: string | null;
}

export interface VideoCandidate {
  id: string;
  cardId: string;
  cardName: string;
  videoPath: string;
  posterPath: string | null;
  note: string;
  fixIds: string[];
  state: VideoCandidateState;
  createdAt: string;
  decidedAt: string | null;
  decidedNote: string;
}

export interface VideoFixData {
  canEdit: boolean;
  fixes: VideoFix[];
  candidates: VideoCandidate[];
}

/** 무엇을 고칠까요 — 순서 = 화면 칩 순서 */
export const FIX_CATS: readonly { id: VideoFixCat; label: string; placeholder: string }[] = [
  { id: "motion", label: "동작이 달라요", placeholder: "예) 이 영상은 훅이에요 · 앞 5초는 원투" },
  { id: "cut", label: "이 구간만 써요", placeholder: "예) 옆에서 찍은 부분만 써 주세요" },
  { id: "text", label: "자막 · 설명", placeholder: "예) 자막을 「팔꿈치는 몸 가까이」로" },
  { id: "sound", label: "소리", placeholder: "예) 음악을 조금 작게" },
  { id: "other", label: "그 밖", placeholder: "한 줄로 알려 주세요" },
];

/** 실제로는 어떤 동작인가요 — 빠르게 고르는 칩 */
export const FIX_MOTIONS: readonly string[] = [
  "잽",
  "스트레이트",
  "원투",
  "훅",
  "어퍼컷",
  "바디",
  "슬립",
  "더킹",
  "위빙",
  "블로킹",
  "패리",
  "가드",
  "스탠스",
  "스텝",
  "콤비",
];

export const FIX_STATE_LABEL: Record<VideoFixState, string> = {
  requested: "보냈어요",
  doing: "고치는 중",
  done: "다 고쳤어요",
  skip: "그대로 둬요",
  canceled: "그만뒀어요",
};

export const catLabel = (cat: VideoFixCat): string => FIX_CATS.find((c) => c.id === cat)?.label ?? "그 밖";

const CATS = new Set<string>(FIX_CATS.map((c) => c.id));
const STATES = new Set<string>(["requested", "doing", "done", "skip", "canceled"]);
const CAND_STATES = new Set<string>(["review", "approved", "rejected"]);

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/** 서버 값을 믿지 않고 다듬는다 — 모양이 틀린 줄은 버림 */
export function parseVideoFixList(raw: unknown): VideoFixData {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  if (o.can_edit !== true) return { canEdit: false, fixes: [], candidates: [] };
  const fixes: VideoFix[] = [];
  for (const r of Array.isArray(o.fixes) ? o.fixes : []) {
    if (!r || typeof r !== "object") continue;
    const x = r as Record<string, unknown>;
    const id = str(x.id);
    const cardId = str(x.card_id);
    const cat = str(x.cat);
    const state = str(x.state);
    if (!id || !cardId || !CATS.has(cat) || !STATES.has(state)) continue;
    fixes.push({
      id,
      cardId,
      cardName: str(x.card_name) || "카드",
      videoPath: str(x.video_path) || null,
      atSec: Math.max(0, num(x.at_sec) ?? 0),
      fromSec: num(x.from_sec),
      toSec: num(x.to_sec),
      motion: str(x.motion),
      cat: cat as VideoFixCat,
      body: str(x.body),
      held: x.held === true,
      heldVideoPath: str(x.held_video_path) || null,
      heldPosterPath: str(x.held_poster_path) || null,
      state: state as VideoFixState,
      reply: str(x.reply),
      byName: str(x.by_name) || "운영진",
      createdAt: str(x.created_at),
      doneAt: str(x.done_at) || null,
    });
  }
  const candidates: VideoCandidate[] = [];
  for (const r of Array.isArray(o.candidates) ? o.candidates : []) {
    if (!r || typeof r !== "object") continue;
    const x = r as Record<string, unknown>;
    const id = str(x.id);
    const cardId = str(x.card_id);
    const videoPath = str(x.video_path);
    const state = str(x.state);
    if (!id || !cardId || !videoPath || !CAND_STATES.has(state)) continue;
    candidates.push({
      id,
      cardId,
      cardName: str(x.card_name) || "카드",
      videoPath,
      posterPath: str(x.poster_path) || null,
      note: str(x.note),
      fixIds: Array.isArray(x.fix_ids) ? x.fix_ids.filter((v): v is string => typeof v === "string") : [],
      state: state as VideoCandidateState,
      createdAt: str(x.created_at),
      decidedAt: str(x.decided_at) || null,
      decidedNote: str(x.decided_note),
    });
  }
  return { canEdit: true, fixes, candidates };
}

export interface VideoFixDraft {
  cat: VideoFixCat | null;
  motion: string;
  body: string;
  atSec: number | null;
  fromSec: number | null;
  toSec: number | null;
}

/** 보내기 전 검사 — 서버 training_video_fix_add 와 같은 말 */
export function fixDraftError(d: VideoFixDraft): string | null {
  if (!d.cat || !CATS.has(d.cat)) return "고칠 곳 종류가 맞지 않아요";
  const body = squash(d.body ?? "");
  const motion = squash(d.motion ?? "");
  if (body.length > 300) return "300자까지 써 주세요";
  if (motion.length > 20) return "동작 이름이 너무 길어요";
  if (!body && !motion) return "무엇을 고칠지 한 줄 써 주세요";
  const bad = (v: number | null) => v != null && (!Number.isFinite(v) || v < 0 || v > 3600);
  if (bad(d.atSec) || bad(d.fromSec) || bad(d.toSec)) return "시간이 맞지 않아요";
  if (d.fromSec != null && d.toSec != null && d.fromSec >= d.toSec) return "구간이 맞지 않아요";
  return null;
}

/** 0:04 · 1:05 · 12:30 (소수는 버림) */
export function fmtSec(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return "";
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** 「1:05」 · 「65」 · 「1분 5초」 → 65 · 빈 칸 → null · 못 읽으면 NaN */
export function parseSecInput(input: string): number | null {
  const s = (input ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2}):(\d{1,2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = s.match(/^(?:(\d{1,2})\s*분)?\s*(?:(\d{1,2})\s*초)?$/);
  if (m && (m[1] || m[2])) return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
  if (/^\d{1,4}(?:\.\d+)?$/.test(s)) return Number(s);
  return NaN;
}

const OPEN: ReadonlySet<VideoFixState> = new Set(["requested", "doing"]);

/** 카드 하나의 요청 · 숨긴 영상 · 확인할 새 영상 */
export function fixesForCard(data: VideoFixData | null | undefined, cardId: string | null | undefined) {
  const fixes = data && cardId ? data.fixes.filter((f) => f.cardId === cardId) : [];
  const candidates = data && cardId ? data.candidates.filter((c) => c.cardId === cardId) : [];
  return {
    open: fixes.filter((f) => OPEN.has(f.state)),
    held: fixes.find((f) => f.held && f.heldVideoPath) ?? null,
    review: candidates.filter((c) => c.state === "review"),
    done: fixes.filter((f) => f.state === "done" || f.state === "skip").slice(0, 3),
  };
}

/** 편집 막대 숫자 — 고쳐 달라고 한 것(보냈어요 · 고치는 중) · 확인할 새 영상 */
export function fixCounts(data: VideoFixData | null | undefined): { open: number; review: number } {
  if (!data) return { open: 0, review: 0 };
  return {
    open: data.fixes.filter((f) => OPEN.has(f.state)).length,
    review: data.candidates.filter((c) => c.state === "review").length,
  };
}

/** 요청 한 줄 글 — 「0:04 · 훅이에요 · 이 영상은 훅이에요」 */
export function fixLine(f: Pick<VideoFix, "atSec" | "fromSec" | "toSec" | "motion" | "cat" | "body">): string {
  const when =
    f.fromSec != null || f.toSec != null ? `${fmtSec(f.fromSec ?? 0)}~${f.toSec != null ? fmtSec(f.toSec) : "끝"}` : fmtSec(f.atSec);
  const what = f.cat === "motion" && f.motion ? `실제 동작 ${f.motion}` : catLabel(f.cat);
  return [when, what, squash(f.body)].filter(Boolean).join(" · ");
}
