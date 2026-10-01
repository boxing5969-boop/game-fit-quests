/**
 * 🏆 타이틀매치 — 리그마다 마지막 관문(리그 안 레벨 10) 정리 (2026-10-01 대표님: 타이틀매치 영상만 따로 모은 메뉴).
 *
 * 전체 레벨 10 · 20 · 30 · 40 = 화이트 · 블루 · 레드 · 블랙 리그의 레벨 10.
 * 영상은 그 리그 Lv.10 미션(missions + mission_videos) — 코치 화면 → 미션에서 올리면 화면에 바로 나온다.
 * 여기에는 화면(pages/TitleMatchPage)이 쓰는 순수 계산만 둔다 (테스트: titleMatch.test.ts).
 */

export type TitleLeague = "white" | "blue" | "red" | "black";

export interface TitleStage {
  league: TitleLeague;
  /** 전체 레벨 — 10·20·30·40 */
  level: number;
  /** 리그 이름 — "화이트" */
  name: string;
}

/** 리그 안에서 타이틀매치가 있는 레벨 */
export const TITLE_LEVEL_IN_LEAGUE = 10;

export const TITLE_STAGES: readonly TitleStage[] = [
  { league: "white", level: 10, name: "화이트" },
  { league: "blue", level: 20, name: "블루" },
  { league: "red", level: 30, name: "레드" },
  { league: "black", level: 40, name: "블랙" },
];

const LEAGUES: readonly string[] = TITLE_STAGES.map((s) => s.league);

/** 주소 ?lv=20 → 블루. 없거나 엉뚱한 값이면 null */
export const stageFromParam = (raw: string | null | undefined): TitleStage | null => {
  if (!raw) return null;
  const n = Number(raw);
  return TITLE_STAGES.find((s) => s.level === n) ?? null;
};

/** 바로 앞 타이틀매치 (화이트는 없음) */
export const previousStage = (stage: TitleStage): TitleStage | null => {
  const i = TITLE_STAGES.findIndex((s) => s.league === stage.league);
  return i > 0 ? TITLE_STAGES[i - 1] : null;
};

/** 회원 위치 (member_progress) */
export interface MemberSpot {
  rank: string;
  /** 리그 안 레벨 1~10 */
  level: number;
  /** 지금까지 통과한 타이틀매치 수 */
  bossesCleared: number;
}

/** passed = 지나온 관문 · mine = 지금 리그의 관문 · ahead = 앞으로 만날 관문 */
export type StageState = "passed" | "mine" | "ahead";

/** 이 타이틀매치가 회원에게 어떤 자리인가 (회원 정보가 없거나 리그를 모르면 null) */
export function stageState(stage: TitleStage, spot: MemberSpot | null): StageState | null {
  if (!spot) return null;
  const mine = LEAGUES.indexOf(spot.rank);
  if (mine < 0) return null;
  const idx = LEAGUES.indexOf(stage.league);
  // 다음 리그로 올라갔거나, 레벨 10 에 머물러 있어도 이 관문을 이미 통과했으면(블랙 마스터 등) 지나온 관문
  if (mine > idx || spot.bossesCleared >= idx + 1) return "passed";
  return mine === idx ? "mine" : "ahead";
}

/** 처음 열 때 고를 칸 — 내가 도전할 타이틀매치. 다 통과했으면 마지막 칸, 회원 정보가 없으면 첫 칸 */
export function defaultStage(spot: MemberSpot | null): TitleStage {
  if (!spot) return TITLE_STAGES[0];
  return (
    TITLE_STAGES.find((s) => stageState(s, spot) !== "passed") ?? TITLE_STAGES[TITLE_STAGES.length - 1]
  );
}

/** 지금 리그 타이틀매치까지 남은 레벨 — 0 이면 지금이 타이틀매치 */
export const levelsLeft = (spot: MemberSpot): number => {
  const lv = Math.min(TITLE_LEVEL_IN_LEAGUE, Math.max(1, Math.floor(spot.level) || 1));
  return TITLE_LEVEL_IN_LEAGUE - lv;
};

// ── 영상 ───────────────────────────────────────────────────

export interface TitleVideo {
  id: string;
  league: TitleLeague;
  title: string;
  description: string | null;
  keyPoints: string[];
  videoUrl: string;
  posterUrl: string | null;
}

type MissionRow = {
  id: string;
  title: string;
  description: string | null;
  key_point_1: string | null;
  key_point_2: string | null;
  key_point_3: string | null;
  mission_videos: Array<{ video_url: string | null; poster_url: string | null }> | null;
  levels: { rank_name: string | null; level_number: number | null } | null;
};

const isLeague = (v: unknown): v is TitleLeague => typeof v === "string" && LEAGUES.includes(v);

/**
 * missions 행 → 타이틀매치 영상. 받은 순서(sort_order)를 그대로 지킨다.
 * 영상 주소가 없는 미션 · 레벨 10 이 아닌 미션 · 모르는 리그는 뺀다.
 */
export function toTitleVideos(rows: unknown): TitleVideo[] {
  if (!Array.isArray(rows)) return [];
  const out: TitleVideo[] = [];
  for (const r of rows as MissionRow[]) {
    const league = r?.levels?.rank_name;
    if (!isLeague(league) || r.levels?.level_number !== TITLE_LEVEL_IN_LEAGUE) continue;
    const v = r.mission_videos?.find((x) => !!x?.video_url?.trim()) ?? null;
    const url = v?.video_url?.trim() ?? "";
    if (!url) continue;
    out.push({
      id: r.id,
      league,
      title: r.title ?? "",
      description: r.description ?? null,
      keyPoints: [r.key_point_1, r.key_point_2, r.key_point_3]
        .map((k) => (k ?? "").trim())
        .filter(Boolean),
      videoUrl: url,
      posterUrl: v?.poster_url?.trim() || null,
    });
  }
  return out;
}

/** 리그별로 나누기 — 영상이 없는 리그도 빈 칸으로 들어 있다 */
export function groupByLeague(videos: readonly TitleVideo[]): Record<TitleLeague, TitleVideo[]> {
  const out: Record<TitleLeague, TitleVideo[]> = { white: [], blue: [], red: [], black: [] };
  for (const v of videos) out[v.league].push(v);
  return out;
}
