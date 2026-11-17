/**
 * 라이브보드 TV 2번 「수상자 축하」 — 서버 값(board_launch_awards) → 화면 글 한 곳 (2026-11-17 대표님 「적용해」)
 * 보고서: https://claude.ai/artifact/3Sh1bLdd7x5LwCwJAh9Jqr
 *
 * 읽는 순서(3초): ① 축하 띠(왕좌 n명 · 1위 혜택 한 번만) → ② 수상자 카드(사진 · 이름 · 레벨 · 기록 · 받았어요) →
 * ③ 증거(40일 · 레벨업 · 운동으로 쌓인 마일리지)와 내 마일리지 → ④ QR 하나.
 *
 * 규칙: 숫자는 모두 서버 값 · 마일리지를 '원'으로 바꿔 말하지 않는다(점 · 할인으로 써요) · '받았어요'는 받은 분만 ·
 * 같은 숫자는 한 화면에 한 번(1위 혜택 50,000점은 띠에만) · 못한 것은 보이지 않는다.
 */
import { LAUNCH_EVENT_PRIZE } from "@/services/king153Service";
import { CARD_SIGN, branchShortOf } from "@/lib/calendarTogether";
import { toGlobalLevel } from "@/lib/rankLabels";

export type AwardCategory = "attendance" | "app" | "nickname";
export const AWARD_CATEGORIES: readonly AwardCategory[] = ["attendance", "app", "nickname"];

export const AWARD_THRONE: Record<AwardCategory, string> = {
  attendance: "출석왕",
  app: "앱 활동왕",
  nickname: "좋아요왕",
};

/** 사람의 한마디 (결정 5 추천안 — 바꾸려면 이 한 줄) */
export const AWARDS_QUOTE = "자주 와 주신 날들이 왕관이 됐어요. 다음 왕관도 응원할게요.";
/** QR 이 여는 곳 — 내 정보의 153 마일리지 칸 (로그인 전이면 로그인 뒤 그 자리로) */
export const AWARDS_QR_URL = "https://myboxer153.com/mypage?focus=mileage&from=tv-awards";

export type AwardLeague = "white" | "blue" | "red" | "black";
const LEAGUES: readonly AwardLeague[] = ["white", "blue", "red", "black"];

export interface AwardRow {
  rank: number;
  name: string | null;
  hidden: boolean;
  score: number;
  /** 1위만 — 받은 마일리지(받기 전이면 null) */
  paidPoints: number | null;
  /** 프로필 사진 주소(https) — 사진이 없는 분 · 이름을 뺀 분 · 카드에 캐릭터를 고른 분은 null */
  photo: string | null;
  /** 지금 리그 · 리그 안 레벨(1~10) — 이름을 뺀 분은 null */
  league: AwardLeague | null;
  level: number | null;
}

export interface AwardsData {
  branch: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  items: { category: AwardCategory; rows: AwardRow[] }[];
  stats: { membersTrained: number; levelUps: number; earnedPoints: number; membersWithPoints: number } | null;
  rules: { enabled: boolean; attendance: number | null; levelUp: number | null } | null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
const leagueOf = (v: unknown): AwardLeague | null =>
  typeof v === "string" && (LEAGUES as readonly string[]).includes(v) ? (v as AwardLeague) : null;
/** 사진 주소는 https 만 (빈칸 · 이상한 값이면 null) */
const photoOf = (v: unknown): string | null => {
  const u = str(v);
  return u && u.length <= 2048 && /^https:\/\/\S+$/.test(u) ? u : null;
};

/** 서버 값을 믿지 않고 다듬는다 — 모양이 다르면 null (화면은 예전 보드)
 *  TV 카드에 캐릭터는 그리지 않는다(2026-11-17 13시 대표님 「캐릭터는 안보이게 해주고」) — 예전 서버가 1위에 붙이던
 *  character 는 읽지 않는다. 대신 줄마다 프로필 사진 · 레벨(같은 날 14시 「이름옆에 프로필 사진 있는 사람은 프로필 사진
 *  넣어줘 레벨이랑」) — 이름을 뺀 분은 사진 · 레벨도 없이. */
export function normalizeAwards(raw: unknown): AwardsData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const branch = str(r.branch);
  const status = str(r.status);
  if (!branch || !status) return null;
  const items: AwardsData["items"] = [];
  for (const it of Array.isArray(r.items) ? r.items : []) {
    const o = (it ?? {}) as Record<string, unknown>;
    const category = o.category as AwardCategory;
    if (!AWARD_CATEGORIES.includes(category)) continue;
    const rows: AwardRow[] = [];
    for (const rr of Array.isArray(o.rows) ? o.rows : []) {
      const x = (rr ?? {}) as Record<string, unknown>;
      const rank = num(x.rank);
      const score = num(x.score);
      if (rank == null || rank < 1 || score == null) continue;
      const paid = num(x.paid_points);
      const hidden = x.hidden === true;
      const lv = num(x.level);
      rows.push({
        rank,
        name: hidden ? null : str(x.name),
        hidden,
        score,
        paidPoints: paid != null && paid > 0 ? paid : null,
        photo: hidden ? null : photoOf(x.photo),
        league: hidden ? null : leagueOf(x.league),
        level: hidden || lv == null || lv < 1 || lv > 40 ? null : Math.round(lv),
      });
    }
    rows.sort((a, b) => a.rank - b.rank);
    items.push({ category, rows: rows.slice(0, 3) });
  }
  const s = (r.stats ?? null) as Record<string, unknown> | null;
  const rl = (r.rules ?? null) as Record<string, unknown> | null;
  return {
    branch,
    status,
    startDate: str(r.start_date),
    endDate: str(r.end_date),
    items,
    stats: s
      ? {
          membersTrained: Math.max(0, num(s.members_trained) ?? 0),
          levelUps: Math.max(0, num(s.level_ups) ?? 0),
          earnedPoints: Math.max(0, num(s.earned_points) ?? 0),
          membersWithPoints: Math.max(0, num(s.members_with_points) ?? 0),
        }
      : null,
    rules: rl ? { enabled: rl.enabled === true, attendance: num(rl.attendance), levelUp: num(rl.level_up) } : null,
  };
}

/** 747700 → '74만 7,700점' · 9800 → '9,800점' */
export function formatPoints(n: number): string {
  const v = Math.max(0, Math.round(n));
  const man = Math.floor(v / 10000);
  const rest = v % 10000;
  if (man === 0) return `${rest.toLocaleString("ko-KR")}점`;
  return rest === 0 ? `${man.toLocaleString("ko-KR")}만 점` : `${man.toLocaleString("ko-KR")}만 ${rest.toLocaleString("ko-KR")}점`;
}

/** 이름 옆 사진 크기(TV px) — 1위 · 2위 · 3위 */
export const AWARD_PHOTO_PX = { king: 90, other: 32 } as const;

/** 이름 글씨 크기(TV px) — 한글 1칸 · 그 밖 0.58칸으로 어림해 칸에 맞춘다(28px 아래로는 줄이지 않음)
 *  카드 안쪽 너비 약 358px(왼쪽 2/3 = 1280px · 카드 3장). 사진이 없으면 이름 칸이 그 너비를 다 쓴다:
 *  48px 이면 7.4칸 · 40px 이면 8.8칸까지 한 줄 / 사진(90px + 사이 14px)이 있으면 남는 약 254px:
 *  48px 이면 5.3칸 · 40px 이면 6.3칸까지 한 줄. 그보다 길면 34px 두 줄. */
export function nameSize(name: string, withPhoto = false): 48 | 40 | 34 {
  let units = 0;
  for (const ch of name) units += /[ㄱ-ㆎ가-힣一-鿿]/.test(ch) ? 1 : 0.58;
  const [big, mid] = withPhoto ? [5.3, 6.3] : [7.4, 8.8];
  return units <= big ? 48 : units <= mid ? 40 : 34;
}

export interface AwardLevelView {
  /** 'Lv.10' — 누적 레벨(화이트 1~10 · 블루 11~20 · 레드 21~30 · 블랙 31~40) */
  text: string;
  league: AwardLeague | null;
}
const levelView = (r: AwardRow): AwardLevelView | null =>
  r.level == null ? null : { text: `Lv.${toGlobalLevel(r.league, r.level)}`, league: r.league };

/** 2위 · 3위 한 사람 */
export interface AwardOtherView {
  rank: number;
  name: string;
  photo: string | null;
  level: AwardLevelView | null;
}
/** 칸이 모자라 한 줄로 합칠 때의 글 — '2위 ○○' (사진 · 레벨 없이) */
export const otherText = (o: AwardOtherView): string => `${o.rank}위 ${o.name}`;

const recordText = (cat: AwardCategory, score: number) => {
  const n = score.toLocaleString("ko-KR");
  return cat === "attendance" ? `출석 ${n}일` : cat === "app" ? `활동 ${n}점` : `하트 ${n}개`;
};

/** 시작 · 끝 날짜(그날 포함) → 며칠 */
export function eventDays(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / 86_400_000) + 1;
}

export interface AwardCardView {
  category: AwardCategory;
  throne: string;
  name: string;
  nameSize: 48 | 40 | 34;
  /** 1위 프로필 사진 — 없으면 이름이 카드 너비를 다 쓴다 */
  photo: string | null;
  /** 1위 레벨 — 기록 앞 리그 색 알약 */
  level: AwardLevelView | null;
  record: string;
  paid: boolean;
  /** 카드 오른쪽 위 표시 — 받았어요 / 드릴 예정 */
  chip: string;
  /** 2위 · 3위 — 한 줄에 한 명(순위 · 사진(있는 분만) · 이름 · 레벨, 없으면 빈 배열) */
  others: AwardOtherView[];
}

export interface AwardsView {
  title: string;
  prizeLine: string;
  cards: AwardCardView[];
  evidence: string | null;
  band: { title: string; steps: string[]; note: string } | null;
  quote: string;
  byline: string;
  signature: string;
  qrUrl: string;
  qrCaption: readonly [string, string];
}

/** 이벤트가 끝났고 1위가 한 명이라도 있을 때만 화면을 만든다 — 아니면 null(예전 보드) */
export function awardsView(data: AwardsData | null): AwardsView | null {
  if (!data || data.status !== "ended") return null;
  const cards: AwardCardView[] = [];
  for (const cat of AWARD_CATEGORIES) {
    const rows = data.items.find((i) => i.category === cat)?.rows ?? [];
    const king = rows.find((r) => r.rank === 1);
    if (!king) continue;
    const name = king.hidden || !king.name ? "1위 회원님" : king.name;
    const rest: AwardOtherView[] = rows
      .filter((r) => r.rank > 1 && r.rank <= 3)
      .map((r) => ({ rank: r.rank, name: r.hidden || !r.name ? "회원님" : r.name, photo: r.photo, level: levelView(r) }));
    cards.push({
      category: cat,
      throne: AWARD_THRONE[cat],
      name,
      nameSize: nameSize(name, king.photo != null),
      photo: king.photo,
      level: levelView(king),
      record: recordText(cat, king.score),
      paid: king.paidPoints != null,
      chip: king.paidPoints != null ? "받았어요" : "드릴 예정",
      others: rest,
    });
  }
  if (!cards.length) return null;

  // 같은 사람이 두 왕좌를 가지면 '왕좌 n명'이 틀리지 않게 — 이름이 같으면 한 사람(이름을 뺀 분은 따로 센다)
  const people = new Set(cards.map((c, i) => (c.name === "1위 회원님" ? `hidden-${i}` : c.name))).size;

  const days = eventDays(data.startDate, data.endDate);
  const st = data.stats;
  const parts: string[] = [];
  if (st && st.levelUps > 0) parts.push(`레벨업 ${st.levelUps.toLocaleString("ko-KR")}번`);
  if (st && st.earnedPoints > 0) parts.push(`운동으로 쌓인 마일리지 ${formatPoints(st.earnedPoints)}`);
  const evidence = parts.length ? `${days ? `${days}일 동안 ` : ""}${parts.join(" · ")}` : null;

  const rules = data.rules;
  const band =
    rules?.enabled && rules.attendance && rules.attendance > 0
      ? {
          title: "회원님 마일리지도 쌓이고 있어요",
          steps: [
            `오면 +${rules.attendance.toLocaleString("ko-KR")}`,
            ...(rules.levelUp && rules.levelUp > 0 ? [`레벨업 +${rules.levelUp.toLocaleString("ko-KR")}`] : []),
            "결제 때 할인으로",
          ],
          note: "출석은 얼굴 인식으로 저절로 쌓여요",
        }
      : null;

  const short = branchShortOf(data.branch) ?? data.branch;
  return {
    title: `축하합니다! 런칭 이벤트 왕좌 ${people}명`,
    prizeLine: `1위께 153 마일리지 ${LAUNCH_EVENT_PRIZE.amount}점`,
    cards,
    evidence,
    band,
    quote: `“${AWARDS_QUOTE}”`,
    byline: `153복싱짐 ${short} 코치진`,
    signature: CARD_SIGN,
    qrUrl: AWARDS_QR_URL,
    qrCaption: ["내 마일리지", "보기"],
  };
}
