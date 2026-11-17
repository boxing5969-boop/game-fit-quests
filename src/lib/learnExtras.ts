// 🎬 영상으로 배우기 — 마이복서153 안의 다른 153 영상도 칸에 (2026-11-16 대표님 「구글 드라이브에있는 영상도 마이복서 153에있는 영상도
//   활용해서 영상으로 배우기 컨텐츠에 넣어놓자」 · 같은 날 「영상으로 배우기 탭에는 다른동작에 설명이 나와」)
//   ① 153플레이에 모아 둔 153복싱짐 영상(유튜브 · 인스타 릴스 — 관장 레슨 · 분석 · 미트 · 샌드백 …)
//      · 레벨 미션 영상과 같은 영상은 빼고(그건 레벨 미션 칸으로) · 코치 교육 자료(블랙 리그 · 코치교육)는 빼고 · 꺼진 · 관리자 전용 영상도 빼고
//      · 리그로 레벨(화이트 1 · 블루 11 · 레드 21 — 위 리그는 카드처럼 「다음 리그에서 배울 동작」으로 접힘)
//      · 칸 = 「153 레슨」 하나(2026-11-17 대표님 「릴스 유튜브와 연결된 기본기 관련 영상은 따로 분류하자」 — 동작 카드 칸에서 뺌)
//        꼬리표 · 제목으로 고른 예전 칸(topic)은 릴스 썸네일의 153 동작 장면을 고르는 데 쓴다(lib/learnScene)
//   ② 153 PB 종목 시범 영상 8편(대표님 10/29 촬영 · public/test153) — 체력 칸
//   설명은 그 영상의 자료 그대로(153플레이 요약 · 153 PB 기준 · 방법 · 요령) — 카드 글과 섞지 않는다.
//   회원 화면 글이라 조회수와 '국가대표' 말은 뺀다(153 브랜드 기준 · 회원용 콘텐츠엔 '국가대표' 0회). 원본(153플레이)은 그대로.
import type { Shelf } from "@/lib/trainingCards";

/** 153플레이(boxing_programs)의 우리 채널 이름 */
export const OWN_CHANNEL = "153복싱짐";

export interface LearnProgramSource {
  /** 153플레이 영상 번호 (boxing_programs.id — 정수) */
  id: number | string;
  yt_id: string;
  title: string;
  league?: string | null;
  tags?: string[] | null;
  train_type?: string[] | null;
  platform?: string | null;
  summary?: string | null;
  channel?: string | null;
  is_active?: boolean | null;
  visibility?: string | null;
}

export interface LearnPbSource {
  name: string;
  standard: string;
  howTo: string;
  tip: string;
  video?: { src: string; poster: string };
}

export type LearnExtraKind = "program" | "pb";

/** 칸에 놓일 153 영상 하나 — 열면 레벨 미션 영상과 같은 플레이어(가로 영상 + 설명) */
export interface LearnExtra {
  /** 타일 열쇠(m:<id>)에 쓰는 uuid — 153플레이 영상 id · 153 PB 는 고정 id */
  id: string;
  kind: LearnExtraKind;
  title: string;
  poster: string | null;
  /** 리그를 이은 레벨 (화이트 1 · 블루 11 · 레드 21 · 153 PB 1) */
  level: number;
  /** 놓일 칸 — 153플레이 영상은 「153 레슨」 칸 하나(2026-11-17 대표님 「따로 분류하자」) · 153 PB 는 체력 칸 */
  shelf: Shelf;
  /** 무슨 동작 이야기인가(예전 칸 — 꼬리표 · 제목으로) — 썸네일 장면 고르기 */
  topic: Shelf;
  /** 인스타 릴스 — 첫 장면 그림이 없다 → 153 동작 장면 + 제목 썸네일 */
  reel: boolean;
  /** 썸네일 장면을 고를 글 — 제목 + 꼬리표 */
  sceneText: string;
  /** 타일 아래 한 줄 — 「153 레슨」 · 「153 분석」 · 「153 PB 종목」 … */
  badge: string;
  /** 유튜브(https://youtu.be/…) · 인스타 릴스(https://www.instagram.com/reel/…/) · 153 PB(/test153/pbN.mp4) */
  videoUrl: string;
  /** 플레이어 설명 한 단락 (없으면 빈 글) */
  description: string;
  /** 플레이어 「핵심 포인트」 */
  points: string[];
}

const LEAGUE_LEVEL: Record<string, number> = { 화이트: 1, 블루: 11, 레드: 21 };

/** 153 PB 종목 고정 id — 1~8번 종목 (타일 열쇠는 uuid 여야 한다 · shelfLayout LEAF_RE) */
export const pbExtraId = (n: number): string => `15300153-0000-4153-8153-${String(n).padStart(12, "0")}`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 153플레이 영상 번호(정수) → 타일 id(uuid 모양 · 늘 같은 값). 이미 uuid 면 그대로 */
export function programExtraId(id: number | string): string | null {
  const s = String(id ?? "").trim();
  if (UUID_RE.test(s)) return s.toLowerCase();
  if (!/^\d{1,12}$/.test(s)) return null;
  return `1530b0b0-0000-4b00-8000-${s.padStart(12, "0")}`;
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

// '국가대표' 말 빼기 — "전 국가대표 카운터 포인트 레슨" → "카운터 포인트 레슨" · "국가대표 출신의 미트 시퀀스" → "미트 시퀀스"
// · "전 복싱 국가대표의 카운터" → "카운터" · "국가대표가 말하는 잽의 가치" → "잽의 가치" · "국가대표 1분 레슨" → "1분 레슨"
const NATIONAL_RE = /(?:전\s*)?(?:복싱\s*)?국가대표(?:\s*출신)?(?:의|가\s*말하는|가)?\s*/g;
// 조회수 — "(18만 조회 대표작)" · "10만 조회 검증 레슨." · "2.8만 조회 레슨" · "12만뷰"
const VIEWS_PAREN_RE = /\s*\(\s*\d+(?:\.\d+)?만\s*(?:조회|뷰)[^)]*\)/g;
const VIEWS_CLAUSE_RE = /(^|[.!?]\s+|,\s*)\d+(?:\.\d+)?만\s*(?:조회|뷰)[^.!?]*[.!?]/g;
const VIEWS_INLINE_RE = /\d+(?:\.\d+)?만\s*(?:조회|뷰)\s*/g;

/** 영상 이름 — 앞 꼬리표([레슨] · [분석] · [153] …) · 조회수 · 길이(2분) · '국가대표' 말을 뺀다 */
export function cleanLearnTitle(raw: string): string {
  let s = (raw ?? "").replace(/^\s*\[[^\]]*\]\s*/, "");
  // " — 10만뷰 기본기 강의" · " — 12만뷰" 처럼 조회수가 든 뒷부분은 통째로
  s = s.replace(/\s*[—–-]\s*[^—–]*\d+(?:\.\d+)?만\s*(?:뷰|조회)[^—–]*$/, "");
  s = s.replace(/\s*\(\s*\d+\s*(?:분|초)\s*\)\s*$/, "");
  s = s.replace(NATIONAL_RE, "");
  s = squash(s).replace(/\s*[—–-]\s*$/, "").replace(/^\s*[—–-]\s*/, "");
  return squash(s);
}

/** 영상 설명 — 조회수 · '국가대표' 말을 빼고 문장을 다듬는다 */
export function cleanLearnSummary(raw: string | null | undefined): string {
  let s = raw ?? "";
  s = s.replace(VIEWS_PAREN_RE, "");
  s = s.replace(VIEWS_CLAUSE_RE, (_m, lead: string) => (lead && /[.!?]/.test(lead) ? lead.trimEnd() + " " : lead.includes(",") ? "" : lead));
  s = s.replace(VIEWS_INLINE_RE, "");
  s = s.replace(NATIONAL_RE, "");
  s = s
    .replace(/\s+([.,!?])/g, "$1")
    .replace(/,\s*\./g, ".")
    .replace(/—\s*\./g, ".");
  return squash(s);
}

const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩";

/** 설명 → 단락 + 핵심 포인트 — 「① … ② … ③ …」가 있으면 포인트로 나눈다 */
export function splitLearnPoints(summary: string): { description: string; points: string[] } {
  const s = squash(summary ?? "");
  const first = [...s].findIndex((ch) => CIRCLED.includes(ch));
  if (first < 0) return { description: s, points: [] };
  const chars = [...s];
  const lead = chars
    .slice(0, first)
    .join("")
    .replace(/\s*[—–:\-]\s*$/, "")
    .trim();
  const points: string[] = [];
  let cur = "";
  for (const ch of chars.slice(first)) {
    if (CIRCLED.includes(ch)) {
      if (cur.trim()) points.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) points.push(cur.trim());
  // 마지막 포인트 뒤에 붙은 맺음 말은 단락으로 옮긴다 —
  //   「… 되받기. 크로스 카운터 3원칙 직강.」(문장) · 「… 심리적 우위까지, 회피의 가치를 5가지로 정리.」(쉼표 뒤 맺음)
  let tail = "";
  if (points.length) {
    const i = points.length - 1;
    const last = points[i];
    const cut = last.search(/[.!?]\s+\S/);
    if (cut >= 0) {
      points[i] = last.slice(0, cut + 1);
      tail = last.slice(cut + 1).trim();
    } else {
      const m = last.match(/^(.+?),\s*([^,]*(?:가지|정리|레슨|근거|강의)[^,]*)$/);
      if (m) {
        points[i] = m[1].replace(/까지$/, "").trim();
        tail = m[2].trim();
      }
    }
  }
  const tidy = points.map((p) => p.replace(/[.\s]+$/, "").trim()).filter(Boolean);
  const description = [lead, tail].filter(Boolean).join(" — ");
  return { description, points: tidy };
}

const hasAny = (list: readonly string[], words: readonly string[]) => words.some((w) => list.includes(w));

/** 153플레이 영상의 칸 — 꼬리표 · 훈련 종류 · 제목으로 (모르는 것은 기술 칸) */
export function programShelf(p: Pick<LearnProgramSource, "title" | "tags" | "train_type" | "league">): Shelf {
  const tags = (p.tags ?? []).map((t) => t.trim());
  const types = (p.train_type ?? []).map((t) => t.trim());
  const title = p.title ?? "";
  if (/몸\s*풀|워밍업/.test(title)) return "warmup";
  if (types.includes("체력") || tags.includes("컨디셔닝") || /줄넘기|사다리/.test(title)) return "fitness";
  if (hasAny(tags, ["미트", "샌드백", "드릴"]) || /스피드볼|미트|샌드백|스파링/.test(title)) return "drill";
  if (hasAny(tags, ["디펜스", "방어", "회피"])) return "defense";
  const punch = hasAny(tags, ["잽", "훅", "어퍼컷", "콤비네이션", "카운터", "바디샷"]);
  if (tags.includes("풋워크") && !punch) return "step";
  // 기본기 칸은 처음 배우는 것만 — 화이트 리그 영상의 기본기 · 가드 · 잽. 블루 · 레드의 기본기 영상(훅 레슨 · 숏훅 …)은 기술 칸
  const white = (p.league ?? "화이트").trim() === "화이트";
  if (white && hasAny(tags, ["기본기", "가드", "잽"])) return "basics";
  return "skill";
}

/** 타일 아래 한 줄 — 153플레이 꼬리표로 */
export function programBadge(title: string): string {
  const tag = ((title ?? "").match(/^\s*\[([^\]]+)\]/)?.[1] ?? "").trim();
  if (tag === "레슨") return "153 레슨";
  if (tag === "분석") return "153 분석";
  if (tag === "153연타") return "153 연타";
  if (tag === "153기술") return "153 기술";
  return "153 영상";
}

const BADGE_RANK: Record<string, number> = { "153 레슨": 0, "153 영상": 1, "153 기술": 2, "153 연타": 3, "153 분석": 4 };

const youtubeIdOf = (s: string): string | null => {
  const t = (s ?? "").trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(t)) return t;
  const m = t.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
};

/**
 * 153플레이 영상 → 영상으로 배우기 칸에 놓을 영상들.
 * missionVideoUrls = 레벨 미션 영상 주소(같은 영상은 레벨 미션 칸에만 — 두 번 나오지 않게).
 * 순서: 레벨 낮은 것부터 → 레슨 · 153 영상 · 기술 · 연타 · 분석 → 이름.
 */
export function learnPrograms(programs: readonly LearnProgramSource[], missionVideoUrls: readonly string[] = []): LearnExtra[] {
  const missionYt = new Set(missionVideoUrls.map((u) => youtubeIdOf(u)).filter((x): x is string => !!x));
  const seen = new Set<string>();
  const out: LearnExtra[] = [];
  for (const p of programs) {
    const id = p ? programExtraId(p.id) : null;
    if (!id || !p.yt_id) continue;
    if ((p.channel ?? OWN_CHANNEL) !== OWN_CHANNEL) continue;
    if (p.is_active === false || p.visibility === "admin") continue;
    const league = (p.league ?? "화이트").trim();
    const tags = p.tags ?? [];
    if (league === "블랙" || tags.includes("코치교육")) continue;
    const platform = (p.platform ?? "youtube").trim();
    let videoUrl: string;
    let poster: string | null;
    if (platform === "instagram") {
      const code = p.yt_id.trim();
      if (!/^[A-Za-z0-9_-]{5,40}$/.test(code)) continue;
      videoUrl = `https://www.instagram.com/reel/${code}/`;
      poster = null;
    } else if (platform === "youtube") {
      const yt = youtubeIdOf(p.yt_id);
      if (!yt || missionYt.has(yt)) continue;
      videoUrl = `https://youtu.be/${yt}`;
      poster = `https://i.ytimg.com/vi/${yt}/mqdefault.jpg`;
    } else continue;
    if (seen.has(videoUrl)) continue;
    seen.add(videoUrl);
    const title = cleanLearnTitle(p.title);
    if (!title) continue;
    const { description, points } = splitLearnPoints(cleanLearnSummary(p.summary));
    out.push({
      id,
      kind: "program",
      title,
      poster,
      level: LEAGUE_LEVEL[league] ?? 1,
      shelf: "lesson",
      topic: programShelf(p),
      reel: platform === "instagram",
      sceneText: [title, ...tags].join(" "),
      badge: programBadge(p.title),
      videoUrl,
      description,
      points,
    });
  }
  return out.sort(
    (a, b) =>
      a.level - b.level ||
      (BADGE_RANK[a.badge] ?? 9) - (BADGE_RANK[b.badge] ?? 9) ||
      a.title.localeCompare(b.title, "ko"),
  );
}

/** 153 PB 종목 시범 영상 → 체력 칸 (영상이 있는 종목만 · 종목 순서 그대로) */
export function learnPbVideos(stations: readonly LearnPbSource[]): LearnExtra[] {
  const out: LearnExtra[] = [];
  stations.forEach((s, i) => {
    if (!s.video?.src) return;
    out.push({
      id: pbExtraId(i + 1),
      kind: "pb",
      title: s.name,
      poster: s.video.poster || null,
      level: 1,
      shelf: "fitness",
      topic: "fitness",
      reel: false,
      sceneText: s.name,
      badge: "153 PB 종목",
      videoUrl: s.video.src,
      description: s.howTo,
      points: [`인정 기준 — ${s.standard}`, s.tip].filter(Boolean),
    });
  });
  return out;
}

/** 영상 주소 종류 — 플레이어가 고른다 */
export const isInstagramUrl = (url: string): boolean => /instagram\.com\/(?:reel|reels|p)\//.test(url ?? "");

/** 인스타 릴스 주소 → 퍼가기 주소 — 글(원래 캡션) 없이 영상만(/embed/) · 설명은 앱이 다듬은 글로 아래에 */
export function instagramEmbedUrl(url: string): string | null {
  const m = (url ?? "").match(/instagram\.com\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/);
  return m ? `https://www.instagram.com/reel/${m[1]}/embed/` : null;
}
