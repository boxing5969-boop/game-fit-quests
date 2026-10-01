/**
 * 🎬 한 동작(미션)의 영상들 — 대표 영상 고르기 · 실사/애니 같은 다른 버전 목록 (2026-10-01).
 *
 * 대표님: "4스텝 잽 애니메이션 영상을 원본(실사) 영상이랑 같이 나오게".
 * 한 미션에 mission_videos 가 여러 개일 수 있다. 순서는 sort_order(0 = 대표) → 먼저 올린 것.
 *   · 대표 영상 — 목록 썸네일 · 처음 재생 · 코치 화면에서 고치는 영상
 *   · 다른 버전 — 플레이어 위 '실사 | 애니메이션' 칸으로 바꿔 본다
 * 예전 코드는 mission_videos[0] 을 썼는데, 같은 미션에 영상이 둘이면 DB 가 돌려주는 순서가 정해져 있지 않아
 * 애니가 대표로 뜰 수 있었다 → 여기서 정한 순서만 쓴다.
 */

export interface MissionVideoRow {
  id?: string | null;
  video_url: string | null;
  poster_url: string | null;
  label?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
}

export interface VideoVariant {
  label: string;
  videoUrl: string;
  posterUrl: string | null;
}

/** 대표 영상의 기본 이름표 (관장님 실사 시범) */
export const PRIMARY_VIDEO_LABEL = "실사";

/** missions 조회에 붙이는 영상 칸 — 순서를 정하려면 sort_order · created_at 까지 같이 읽어야 한다 */
export const MISSION_VIDEO_EMBED = "mission_videos(video_url, poster_url, label, sort_order, created_at)";

const hasUrl = (r: MissionVideoRow | null | undefined): r is MissionVideoRow =>
  !!r && typeof r.video_url === "string" && r.video_url.trim().length > 0;

/** 주소가 있는 영상만, 정해진 순서로 (sort_order → 올린 시각 → 원래 순서) */
export function sortMissionVideos<T extends MissionVideoRow>(rows: ReadonlyArray<T> | null | undefined): T[] {
  return (rows ?? [])
    .map((r, i) => ({ r, i }))
    .filter((x) => hasUrl(x.r))
    .sort((a, b) => {
      const so = (a.r.sort_order ?? 0) - (b.r.sort_order ?? 0);
      if (so !== 0) return so;
      const ta = a.r.created_at ? Date.parse(a.r.created_at) : NaN;
      const tb = b.r.created_at ? Date.parse(b.r.created_at) : NaN;
      if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return ta - tb;
      return a.i - b.i;
    })
    .map((x) => x.r);
}

/** 대표 영상 (없으면 null) */
export function primaryMissionVideo<T extends MissionVideoRow>(rows: ReadonlyArray<T> | null | undefined): T | null {
  return sortMissionVideos(rows)[0] ?? null;
}

/** 플레이어가 보여 줄 영상 목록 — 대표가 먼저. 이름표가 없으면 대표는 '실사', 나머지는 '영상 2' 처럼 */
export function videoVariants(rows: ReadonlyArray<MissionVideoRow> | null | undefined): VideoVariant[] {
  const seen = new Set<string>();
  const out: VideoVariant[] = [];
  sortMissionVideos(rows).forEach((r, i) => {
    const url = (r.video_url ?? "").trim();
    if (seen.has(url)) return; // 같은 주소가 두 번 붙어 있으면 한 번만
    seen.add(url);
    const label = (r.label ?? "").trim() || (i === 0 ? PRIMARY_VIDEO_LABEL : `영상 ${out.length + 1}`);
    out.push({ label, videoUrl: url, posterUrl: r.poster_url?.trim() || null });
  });
  return out;
}

/** 애니 같은 다른 버전이 있는지 (목록 카드에 '애니 버전' 표시용) — 대표 말고 다른 영상 이름표들 */
export function extraVariantLabels(variants: ReadonlyArray<VideoVariant>): string[] {
  return variants.slice(1).map((v) => v.label);
}

/** 어두운 영상 모달(VideoOverlay)이 받는 모양 — { label, url } */
export function overlayVariants(
  variants: ReadonlyArray<VideoVariant>,
  mapUrl: (url: string) => string = (u) => u,
): { label: string; url: string }[] {
  return variants.map((v) => ({ label: v.label, url: mapUrl(v.videoUrl) }));
}
