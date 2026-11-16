// 🎬 영상으로 배우기 — 레벨 미션 영상도 칸에 (2026-11-16 대표님 「영상으로 배우기 탭에 내가 기존에 올린 레벨 1부터 레벨10까지 영상 … 모두 볼수있게」)
//   예전에는 워밍업 영상(category warmup)만 워밍업 칸 맨 앞에 있었다. 이제 레벨 미션 영상(category level)도
//   [복싱/○○] 꼬리표로 칸(스텝 · 기본기 · 기술 · 방어 · 체력 …)을 정하고, 리그 · 레벨을 붙여 카드와 같은 규칙으로 놓는다
//   (내 레벨까지 먼저 · 위 레벨은 「레벨 n부터」 · 다음 리그는 「다음 리그에서 배울 동작」으로 접힘 — shelfLayout).
//   · 같은 영상 주소가 두 레벨에 붙어 있으면(레벨 7 = 레벨 1 영상 다시 쓰기) 낮은 레벨 하나만
//   · 「· 실사」 「· 애니 ○○」처럼 같은 동작의 다른 버전 미션은 한 칸 — 열면 플레이어 위 버전 칸(실사 | 애니)으로 바꿔 본다
//   · 꺼진 미션 · 영상이 없는 미션은 안 넣는다. 미션 표 · 제출 · 진행률은 그대로(여기는 보기만)
import type { Shelf } from "@/lib/trainingCards";
import { primaryMissionVideo, type MissionVideoRow } from "@/lib/missionVideos";

export interface LearnMissionSource {
  id: string;
  title: string;
  category?: string | null;
  is_active?: boolean | null;
  sort_order?: number | null;
  levels?: { rank_name?: string | null; level_number?: number | null } | null;
  mission_videos?: MissionVideoRow[] | null;
}

/** 칸에 놓일 영상 하나 (TrainingShelf 의 ShelfWarmup 과 같은 모양 + 같은 동작 다른 버전 미션 id) */
export interface LearnVideo {
  id: string;
  title: string;
  poster: string | null;
  /** 리그를 이은 레벨 (화이트 1~10 · 블루 11~20 …) — 워밍업 영상은 없음(모든 레벨) */
  level?: number;
  /** 칸 — 워밍업 영상은 없음(워밍업 칸) */
  shelf?: Shelf;
  /** 같은 동작 다른 버전(실사 · 애니) — 첫 번째가 이 칸의 미션 */
  memberIds: string[];
  /** 버전 이름 — memberIds 와 같은 순서 */
  variantLabels: string[];
}

const RANK_BASE: Record<string, number> = { white: 0, blue: 10, red: 20, black: 30 };

/** 리그 · 리그 안 레벨 → 이은 레벨 (모르는 리그 · 숫자 없음 → null) */
export function missionAbsLevel(rank: string | null | undefined, levelNumber: number | null | undefined): number | null {
  const base = RANK_BASE[(rank ?? "").trim()];
  const n = Number(levelNumber);
  if (base == null || !Number.isFinite(n) || n < 1 || n > 10) return null;
  return base + Math.round(n);
}

/** "[복싱/스텝] …" → "스텝" */
export function missionTagWord(title: string): string | null {
  const m = (title ?? "").match(/^\s*\[[^/\]]*\/\s*([^\]]+)\]/);
  return m ? m[1].trim() : null;
}

const TAG_SHELF: Record<string, Shelf> = {
  스텝: "step",
  풋워크: "step",
  잽: "basics",
  기본기: "basics",
  줄넘기: "fitness",
  체력: "fitness",
  컨디셔닝: "fitness",
  방어: "defense",
  기술: "skill",
  콤비: "skill",
  콤비네이션: "skill",
  카운터: "skill",
  미트: "drill",
  샌드백: "drill",
  워밍업: "warmup",
  쿨다운: "cooldown",
  스트레칭: "cooldown",
};

/** 레벨 미션의 칸 — 꼬리표로 · '기초'는 스텝 이야기면 스텝 칸 · 모르는 꼬리표는 기술 칸(카드 분류와 같은 기본) */
export function missionShelf(title: string): Shelf {
  const tag = missionTagWord(title);
  if (tag === "기초") return /스텝|풋워크/.test(title) ? "step" : "basics";
  return (tag && TAG_SHELF[tag]) || "skill";
}

/** 같은 동작의 다른 버전 — "… · 실사ㅣ…" / "… · 애니 여성ㅣ…" → { base, label } */
function variantOf(title: string): { base: string; label: string } | null {
  const m = (title ?? "").match(/^(.*?)\s*·\s*((?:실사|애니)[^ㅣ|]*?)\s*(?:[ㅣ|].*)?$/);
  if (!m) return null;
  const base = m[1].trim();
  return base ? { base, label: m[2].trim() } : null;
}

/** 영상 주소를 견줄 열쇠 — 유튜브는 영상 id(youtu.be · watch?v= · shorts · embed), 아니면 주소 그대로 */
function videoKey(url: string): string {
  const m = (url ?? "").match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{11})/);
  return m ? `yt:${m[1]}` : (url ?? "").trim();
}

/**
 * 미션 목록 → 영상으로 배우기 칸에 놓을 영상들.
 * 워밍업 영상은 예전과 같은 모양(레벨 · 칸 없음 = 워밍업 칸 맨 앞), 레벨 미션 영상은 레벨 · 칸을 붙인다.
 * 순서: 워밍업 → 레벨 낮은 것부터(같은 레벨은 미션 순서). 같은 영상 주소는 처음 것만.
 */
export function learnVideos(missions: readonly LearnMissionSource[]): LearnVideo[] {
  type Row = { m: LearnMissionSource; level: number | null; url: string; warmup: boolean };
  const rows: Row[] = [];
  for (const m of missions) {
    if (m.is_active === false) continue;
    const v = primaryMissionVideo(m.mission_videos);
    const url = (v?.video_url ?? "").trim();
    if (!url) continue;
    const warmup = m.category === "warmup";
    const level = warmup ? null : missionAbsLevel(m.levels?.rank_name, m.levels?.level_number);
    if (!warmup && level == null) continue;
    rows.push({ m, level, url, warmup });
  }
  rows.sort(
    (a, b) =>
      Number(b.warmup) - Number(a.warmup) ||
      (a.level ?? 0) - (b.level ?? 0) ||
      (a.m.sort_order ?? 0) - (b.m.sort_order ?? 0),
  );

  const out: LearnVideo[] = [];
  const byVideo = new Set<string>();
  const byVariant = new Map<string, LearnVideo>();
  for (const r of rows) {
    const key = videoKey(r.url);
    if (byVideo.has(key)) continue;
    byVideo.add(key);
    const poster = primaryMissionVideo(r.m.mission_videos)?.poster_url?.trim() || null;
    const variant = r.warmup ? null : variantOf(r.m.title);
    const groupKey = variant ? `${r.level}|${variant.base}` : null;
    const group = groupKey ? byVariant.get(groupKey) : undefined;
    if (group && variant) {
      group.memberIds.push(r.m.id);
      group.variantLabels.push(variant.label);
      if (!group.poster && poster) group.poster = poster;
      continue;
    }
    const item: LearnVideo = r.warmup
      ? { id: r.m.id, title: r.m.title, poster, memberIds: [r.m.id], variantLabels: [] }
      : {
          id: r.m.id,
          // 버전 꼬리표(· 실사)는 칸 이름에서 뺀다 — 버전은 열어서 고른다
          title: variant ? r.m.title.replace(/\s*·\s*(?:실사|애니)[^ㅣ|]*/, "") : r.m.title,
          poster,
          level: r.level ?? undefined,
          shelf: missionShelf(r.m.title),
          memberIds: [r.m.id],
          variantLabels: variant ? [variant.label] : [],
        };
    out.push(item);
    if (groupKey) byVariant.set(groupKey, item);
  }
  return out;
}

/** 미션 영상 찾기 — 꼬리표([복싱/○○])는 빼고, 띄어쓰기 · 기호 없이 낱말마다 들어 있나 */
const squash = (v: string) => v.toLowerCase().replace(/[\s·ㅣ|,.()[\]/~-]+/g, "");
export function titleMatches(title: string, q: string): boolean {
  const words = (q ?? "").split(/\s+/).map(squash).filter(Boolean);
  if (!words.length) return false;
  const t = squash((title ?? "").replace(/^\s*\[[^\]]*\]\s*/, ""));
  return words.every((w) => t.includes(w));
}
