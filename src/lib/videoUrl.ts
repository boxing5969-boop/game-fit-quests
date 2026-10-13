/**
 * 영상 주소 안전 검사 (2026-10-13 — 붕대 감기 영상 URL 을 코치가 직접 넣게 되면서).
 *
 *   · httpsUrlOrNull — https 주소만 통과. 'javascript:' 같은 주소가 플레이어·iframe 으로 들어가지 않게.
 *   · strictYoutubeId — 유튜브 호스트(youtube.com · youtu.be)일 때만 영상 id. 주소 아무 데나 'v=' 가 있다고
 *     유튜브로 오인하지 않는다 (예: …/wrap.mp4?v=2 는 그냥 영상 파일).
 */
import { youtubeId } from "@/hooks/useLevelVideos";

export const httpsUrlOrNull = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return /^https:\/\/[^\s]+$/i.test(s) ? s : null;
};

export const strictYoutubeId = (url: string): string | null => {
  const s = url.trim();
  return /^https?:\/\/([a-z0-9-]+\.)*(youtube\.com|youtu\.be)\//i.test(s) ? youtubeId(s) : null;
};
