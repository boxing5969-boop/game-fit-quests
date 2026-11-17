/**
 * 라이브보드 TV 2번 「수상자 축하」 — 서버 값(board_launch_awards) → 화면 글 한 곳 (2026-11-17 대표님 「적용해」)
 * 보고서: https://claude.ai/artifact/3Sh1bLdd7x5LwCwJAh9Jqr
 *
 * 읽는 순서(3초): ① 축하 띠(왕좌 n명 · 1위 혜택 한 번만) → ② 수상자 카드(이름 · 기록 · 받았어요) →
 * ③ 증거(40일 · 레벨업 · 운동으로 쌓인 마일리지)와 내 마일리지 → ④ QR 하나.
 *
 * 규칙: 숫자는 모두 서버 값 · 마일리지를 '원'으로 바꿔 말하지 않는다(점 · 할인으로 써요) · '받았어요'는 받은 분만 ·
 * 같은 숫자는 한 화면에 한 번(1위 혜택 50,000점은 띠에만) · 못한 것은 보이지 않는다.
 */
import { LAUNCH_EVENT_PRIZE } from "@/services/king153Service";
import { CARD_SIGN, branchShortOf } from "@/lib/calendarTogether";

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

export interface AwardCharacter {
  league: "white" | "blue" | "red" | "black" | null;
  level: number | null;
  parts: { style?: string; customization?: Record<string, unknown> } | null;
}

export interface AwardRow {
  rank: number;
  name: string | null;
  hidden: boolean;
  score: number;
  /** 1위만 — 받은 마일리지(받기 전이면 null) */
  paidPoints: number | null;
  character: AwardCharacter | null;
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
const LEAGUES = new Set(["white", "blue", "red", "black"]);

/** 서버 값을 믿지 않고 다듬는다 — 모양이 다르면 null (화면은 예전 보드) */
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
      const c = (x.character ?? null) as Record<string, unknown> | null;
      const league = typeof c?.league === "string" && LEAGUES.has(c.league) ? (c.league as AwardCharacter["league"]) : null;
      const parts = c?.parts && typeof c.parts === "object" && !Array.isArray(c.parts) ? (c.parts as AwardCharacter["parts"]) : null;
      const paid = num(x.paid_points);
      rows.push({
        rank,
        name: x.hidden === true ? null : str(x.name),
        hidden: x.hidden === true,
        score,
        paidPoints: paid != null && paid > 0 ? paid : null,
        character: c ? { league, level: num(c.level), parts } : null,
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

/** 이름 글씨 크기(TV px) — 한글 1칸 · 그 밖 0.58칸으로 어림해 칸에 맞춘다(28px 아래로는 줄이지 않음) */
export function nameSize(name: string): 48 | 40 | 34 {
  let units = 0;
  for (const ch of name) units += /[ㄱ-ㆎ가-힣一-鿿]/.test(ch) ? 1 : 0.58;
  return units <= 5.5 ? 48 : units <= 6.6 ? 40 : 34;
}

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
  record: string;
  paid: boolean;
  /** 카드 오른쪽 위 표시 — 받았어요 / 드릴 예정 */
  chip: string;
  /** 2위 · 3위 — 한 줄에 한 명(멀리서도 읽히게 · 없으면 빈 배열) */
  others: string[];
  character: AwardCharacter | null;
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
    const rest = rows
      .filter((r) => r.rank > 1 && r.rank <= 3)
      .map((r) => `${r.rank}위 ${r.hidden || !r.name ? "회원님" : r.name}`);
    cards.push({
      category: cat,
      throne: AWARD_THRONE[cat],
      name,
      nameSize: nameSize(name),
      record: recordText(cat, king.score),
      paid: king.paidPoints != null,
      chip: king.paidPoints != null ? "받았어요" : "드릴 예정",
      others: rest,
      character: king.hidden ? null : king.character,
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
