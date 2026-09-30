/**
 * 메시지(DM) 시각 표기 — 전부 한국 시간(Asia/Seoul) 기준. 폰 시간대가 달라도 같은 날짜로 묶인다.
 *
 *   · 목록: 오늘 = "오후 3:05" · 어제 = "어제" · 올해 = "9월 28일" · 그 전 = "2025. 9. 28."
 *   · 말풍선: "오후 3:05"
 *   · 날짜 구분선: "9월 30일 수요일" (올해가 아니면 연도까지)
 *   · 말풍선 묶기: 같은 사람이 3분 안에 이어 보낸 메시지는 한 덩어리 — 시각은 덩어리의 마지막에만
 *
 * 한국어 날짜 글자(오전·오후·요일)는 기기 언어 데이터에 기대지 않고 직접 만든다 — 기기마다 "AM 9:07" 처럼
 * 섞여 나오는 일이 없게. 숫자(연·월·일·시·분)만 Intl 로 한국 시간대로 뽑는다.
 */

const TZ = "Asia/Seoul";

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h23",
});

interface KstParts {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: string;
}

const toDate = (v: string | Date): Date => (v instanceof Date ? v : new Date(v));

const kstParts = (v: string | Date): KstParts => {
  const p = partsFmt.formatToParts(toDate(v));
  const get = (t: Intl.DateTimeFormatPartTypes) => p.find((x) => x.type === t)?.value ?? "0";
  // 일부 엔진은 자정을 "24" 로 준다 — 0 시로 맞춘다
  const h = Number(get("hour")) % 24;
  return { y: Number(get("year")), mo: Number(get("month")), d: Number(get("day")), h, mi: get("minute").padStart(2, "0") };
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** "2026-09-30" — 한국 날짜 */
export const kstDayKey = (v: string | Date): string => {
  const { y, mo, d } = kstParts(v);
  return `${y}-${pad2(mo)}-${pad2(d)}`;
};

const dayDiff = (a: string, b: string): number =>
  Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);

const monthDay = ({ mo, d }: KstParts) => `${mo}월 ${d}일`;
const fullDate = ({ y, mo, d }: KstParts) => `${y}. ${mo}. ${d}.`;

/** 말풍선 시각 — "오후 3:05" */
export const dmBubbleTime = (v: string | Date): string => {
  const { h, mi } = kstParts(v);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h < 12 ? "오전" : "오후"} ${h12}:${mi}`;
};

/** 받은함 목록 시각 */
export const dmListTime = (v: string | Date, now: Date = new Date()): string => {
  const diff = dayDiff(kstDayKey(now), kstDayKey(v));
  if (diff <= 0) return dmBubbleTime(v);
  if (diff === 1) return "어제";
  const p = kstParts(v);
  return p.y === kstParts(now).y ? monthDay(p) : fullDate(p);
};

/** 날짜 구분선 — "9월 30일 수요일" · 올해가 아니면 "2025. 9. 28. 일요일" */
export const dmDayLabel = (v: string | Date, now: Date = new Date()): string => {
  const p = kstParts(v);
  const wd = WEEKDAYS[new Date(`${p.y}-${pad2(p.mo)}-${pad2(p.d)}T00:00:00Z`).getUTCDay()];
  return `${p.y === kstParts(now).y ? monthDay(p) : fullDate(p)} ${wd}요일`;
};

/** 신고 제한 끝나는 날 — "10월 7일" (올해가 아니면 연도까지) */
export const dmUntilLabel = (v: string | Date, now: Date = new Date()): string => {
  const p = kstParts(v);
  return p.y === kstParts(now).y ? monthDay(p) : fullDate(p);
};

export interface DmBubbleLike {
  id: number | string;
  mine: boolean;
  created_at: string;
}

export interface DmBubbleView<T extends DmBubbleLike> {
  msg: T;
  /** 이 말풍선 위에 날짜 구분선을 그린다 (그날의 첫 메시지) */
  dayLabel: string | null;
  /** 같은 사람 덩어리의 첫 말풍선 (위쪽 간격을 조금 더 준다) */
  groupStart: boolean;
  /** 같은 사람 덩어리의 마지막 말풍선 (시각을 붙인다) */
  groupEnd: boolean;
}

const GROUP_GAP_MS = 3 * 60_000;

/** 말풍선 배치 — 날짜 구분선 · 같은 사람 3분 안 묶기. 입력은 오래된 것 → 최신 순. */
export const layoutDmBubbles = <T extends DmBubbleLike>(msgs: readonly T[], now: Date = new Date()): DmBubbleView<T>[] => {
  const days = msgs.map((m) => kstDayKey(m.created_at));
  return msgs.map((m, i) => {
    const prev = i > 0 ? msgs[i - 1] : null;
    const next = i < msgs.length - 1 ? msgs[i + 1] : null;
    const newDay = !prev || days[i - 1] !== days[i];
    const joinsPrev =
      !!prev && !newDay && prev.mine === m.mine && Date.parse(m.created_at) - Date.parse(prev.created_at) <= GROUP_GAP_MS;
    const joinsNext =
      !!next &&
      days[i + 1] === days[i] &&
      next.mine === m.mine &&
      Date.parse(next.created_at) - Date.parse(m.created_at) <= GROUP_GAP_MS;
    return {
      msg: m,
      dayLabel: newDay ? dmDayLabel(m.created_at, now) : null,
      groupStart: !joinsPrev,
      groupEnd: !joinsNext,
    };
  });
};

/** 여러 목록을 id 로 합친다 (오래된 페이지 + 최신 페이지 + 방금 보낸 것) — 오래된 것 → 최신 순 */
export const mergeDmMessages = <T extends { id: number }>(...lists: ReadonlyArray<readonly T[]>): T[] => {
  const byId = new Map<number, T>();
  for (const list of lists) for (const m of list) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.id - b.id);
};

/**
 * 대화방이 쌓아 둔 메시지(have)에 새로 읽은 최신 페이지(page)를 붙인다.
 * 최신 페이지는 늘 '가장 최근 N개'라 새 메시지가 오면 앞쪽이 밀려난다 — 그래서 한 번 받은 메시지는 버리지 않고 쌓는다
 * (2026-09-30 검수: 예전엔 최신 페이지만 믿어 '이전 메시지 더 보기' 뒤 중간 메시지가 사라졌다).
 * 단, 오래 자리를 비워 최신 페이지가 가진 것과 겹치지 않고 그 앞에도 메시지가 더 있으면(pageHasMore)
 * 사이가 비었을 수 있으니 최신 페이지부터 새로 시작한다(reset) — 이전 메시지는 '더 보기'로 다시 불러온다.
 */
export const absorbDmPage = <T extends { id: number }>(
  have: readonly T[],
  page: readonly T[],
  pageHasMore: boolean,
): { list: T[]; reset: boolean } => {
  if (!have.length) return { list: [...page], reset: true };
  if (!page.length) return { list: [...have], reset: false };
  const newestHave = have[have.length - 1].id;
  const overlaps = page[0].id <= newestHave;
  if (!overlaps && pageHasMore) return { list: [...page], reset: true };
  return { list: mergeDmMessages(have, page), reset: false };
};
