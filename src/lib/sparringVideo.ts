/**
 * 🎥 스파링 영상 1차(유튜브) — 화면이 같이 쓰는 순수 함수 (2026-11-25 · docs/features/64-스파링-영상.md)
 *
 *   · 경기 번호 = 녹화 노트북 파일 이름 = 유튜브 제목: `<지점 코드>-<YYMMDD>-<번호>` (예: sunreung-261125-07) — 실명 없음
 *   · 저장처(provider) youtube | r2 | device | gdrive | storage — 2차 플랜에서 저장처만 바꿔 끼운다. 지금은 youtube 만 튼다.
 *   · DB 규칙(supabase/migrations/20261125195550_sparring_video_v1.sql)과 같게 맞춘다 — 유튜브 주소 읽기 · 경기 길이.
 *   시험: sparringVideo.test.ts
 */

export type VideoProvider = "youtube" | "r2" | "device" | "gdrive" | "storage";

/**
 * 링 카메라(코치 「스파링 기록」 · 동의서 「영상 촬영」 칸) 켜기 — 장비가 준비되면 true 로 (2026-11-25 대표님
 * 「일단은 인스타그램처럼 회원님들 스스로가 직접 올리는 기능만 활성화해놓고 노트북 카메라 등등 준비되면 시작하자」)
 */
export const SPARRING_CAMERA_ON = false;

/** 회원이 직접 올리는 영상 (2026-11-26) — 비공개 저장소 member-videos · 60초까지 · 90일 보관 */
export const MEMBER_VIDEO_BUCKET = "member-videos";
export const UPLOAD_MAX_SEC = 60;
/** 저장소 한도와 같다 (50MB) */
export const UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

export type VideoKind = "sparring" | "mitt" | "other";
export const VIDEO_KINDS: readonly { key: VideoKind; label: string }[] = [
  { key: "mitt", label: "미트" },
  { key: "sparring", label: "스파링" },
  { key: "other", label: "쉐도우 · 샌드백" },
];
export const kindLabel = (k: string | null | undefined): string =>
  VIDEO_KINDS.find((x) => x.key === k)?.label ?? "훈련";

/** 저장 경로 — 서버(sparvid_upload_register)가 `<내 id>/[A-Za-z0-9_.-]+` 만 받는다 */
export function uploadPathOf(userId: string, ext: string, now: Date, rand: number): string {
  const safeExt = /^[a-z0-9]{2,4}$/.test(ext) ? ext : "mp4";
  const stamp = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const tail = Math.floor(rand * 1e9).toString(36);
  return `${userId}/${stamp}_${tail}.${safeExt}`;
}

/** 파일 형식 → 확장자 */
export function extOf(contentType: string, fileName = ""): string {
  if (/quicktime/.test(contentType) || /\.mov$/i.test(fileName)) return "mov";
  if (/webm/.test(contentType)) return "webm";
  if (/3gpp/.test(contentType)) return "3gp";
  return "mp4";
}

/** 녹화 노트북이 만드는 파일 이름 = 유튜브 제목 */
export const MATCH_CODE_RE = /^[a-z0-9]+-\d{6}-\d{2,}$/;

/** 유튜브 주소 · 영상 id → 11자 id (DB sparvid_attach_video 와 같은 규칙). 못 읽으면 null */
export function youtubeIdOf(ref: string | null | undefined): string | null {
  const s = (ref ?? "").trim();
  if (!s) return null;
  const m = s.match(/(?:v=|youtu\.be\/|\/shorts\/|\/live\/|\/video\/|\/embed\/)([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{11}$/.test(s) ? s : null;
}

/** 저장처별 썸네일 (1차 = 유튜브만) */
export function thumbOf(provider: string, externalId: string): string | null {
  if (provider === "youtube" && /^[A-Za-z0-9_-]{11}$/.test(externalId)) {
    return `https://i.ytimg.com/vi/${externalId}/mqdefault.jpg`;
  }
  return null;
}

/** 영상 시각 83.5 → "1:23" (없으면 빈 글) */
export function clockOf(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return "";
  const t = Math.floor(sec);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** 경기 길이(초) — DB _sparvid_match_end_est 와 같다(+10초 여유는 DB 쪽만) */
export function matchLengthSec(rounds: number, roundSec: number, restSec: number): number {
  const r = Math.max(0, Math.floor(rounds));
  return r * Math.max(0, roundSec) + Math.max(0, r - 1) * Math.max(0, restSec);
}

/** "11월 25일 (수) 19:42" — 한국 시각 */
export function whenLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("month")}월 ${get("day")}일 (${get("weekday")}) ${get("hour")}:${get("minute")}`;
}

/** "19:42" — 한국 시각 */
export function hhmmOf(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

export interface FilmBlock {
  a?: string | null;
  b?: string | null;
}

/** 촬영 안 하는 까닭 — 코치 화면 한 줄 ("김OO 영상 동의 없음 · 이OO 동의서 없음") */
export function filmBlockLine(block: FilmBlock | null | undefined, aName: string, bName: string): string {
  if (!block) return "";
  return [block.a ? `${aName} ${block.a}` : "", block.b ? `${bName} ${block.b}` : ""].filter(Boolean).join(" · ");
}

/** 고르기 목록 사람 옆 표시 — film_block null = 촬영 가능 */
export function filmBadge(filmBlock: string | null | undefined): { label: string; ok: boolean } {
  return filmBlock ? { label: filmBlock, ok: false } : { label: "🎥 촬영 가능", ok: true };
}

/** 경기 번호에서 "#07" */
export function seqLabel(seq: number | null | undefined): string {
  return seq == null ? "" : `#${String(seq).padStart(2, "0")}`;
}
