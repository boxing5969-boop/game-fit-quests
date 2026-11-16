/**
 * 🌱 오늘의 1분 성장 — 홈 카드의 글 (2026-10-27 대표님: "내가 공유한 정보를 복싱에 대입해서
 *   오늘의 1분 성장 교육이라고 하고 방향에 대해 알려주자")
 *
 *   2026-11-16 대표님 「매일 똑같은 거만 있어서 식상해 · 365일 매일매일」 → 「추천대로 진행」
 *   (보고서 https://claude.ai/artifact/5tVEQmxgmzABfNwZaHibtq)
 *     · 0단계(11/16): 화면은 그대로, 11/16 ~ 11/30 날마다 글 15편.
 *     · 1단계(대표님 「다음」): 글은 **달마다 파일** `./growth/YYYY-MM.ts` — 달 파일을 하나 더하면 그 달 글이 나온다
 *       (여기 · 화면은 고치지 않는다). 홈 묶음에 글 본문이 쌓이지 않게 **필요한 달만 따로 받는다**
 *       (오늘이 든 달까지의 최근 두 달 — 지난 7일이 앞 달에 걸칠 때 · 새 달 글이 아직 없을 때).
 *       O/X 글은 `quiz`(문제 · 정답) — 서랍에서 하나를 고르면 이야기가 열린다 · 지난 7일 글(`recentLessons`).
 *
 *   글 쓰는 법 (시험 growthLessons.test.ts 가 지킨다)
 *     · 날마다 글 = `daily({ id, from, … })` — 코너는 날짜의 요일에서 나온다:
 *       월 「이번 주 한 가지」 · 화 「복싱 상식 O/X」 · 수 「기술 한 끗」 · 목 「몸이 받는 선물」
 *       금 「링 위의 이야기」 · 토 「집에서 1분」 · 일 「한 주 돌아보기」
 *     · id 는 한 번 정하면 바꾸지 않는다(이 기기 · 서버 읽음 기록의 열쇠) — 소문자 · 숫자 · 줄표, 40자 안, 모든 달에서 하나뿐.
 *     · 규격: 제목 18자 · 한 줄 30자 · 본문 150~250자(빈칸 빼고 · O/X 는 문제까지) · 오늘 하나 1개(14자 · 60자) ·
 *       마무리 30자 · 해요체 · 잘한 것과 다음 한 걸음만 · 153 브랜드 기준의 쓰지 않는 낱말 · 긴 줄표 0.
 *     · O/X 글: `quiz.q` 는 문제 문장만, `story[0]` 은 "정답은 O예요." / "정답은 X예요." 로 시작 · 제목이 정답을 말하지 않게.
 *     · 사실(숫자 · 연도 · 연구)은 원문을 열어 확인한 것만 쓰고 sources 에 적는다(화 · 목 · 금은 꼭).
 *       153 수업 이야기는 레벨 과정(allLevelsData) · 첫 수업 과정에 있는 것만.
 *     · 날마다 글이 끝난 뒤에도 새 글이 없으면 같은 요일 코너 글을 주마다 돌아가며 보여 준다(todayLesson).
 */
import { LEGACY_LESSONS } from "./growth/legacy";
import { weekdayOf, type GrowthLesson } from "./growth/types";

export * from "./growth/types";
export { LEGACY_LESSONS };

type MonthModule = { default: readonly GrowthLesson[] };

/** 달마다 파일 — 그 달이 필요할 때 따로 받는다 */
const MONTH_LOADERS = import.meta.glob<MonthModule>("./growth/20??-??.ts");

const monthOfPath = (path: string): string => path.slice(path.lastIndexOf("/") + 1, -".ts".length);

/** 글이 있는 달 (YYYY-MM · 이른 달부터) */
export const GROWTH_MONTHS: readonly string[] = Object.keys(MONTH_LOADERS).map(monthOfPath).sort();

/** 오늘 화면에 필요한 달 — 오늘이 든 달까지의 가장 최근 두 달 (앞으로 올 달은 받지 않는다) */
export function monthsFor(today: string, months: readonly string[] = GROWTH_MONTHS): string[] {
  const ym = today.slice(0, 7);
  return months.filter((m) => m <= ym).slice(-2);
}

/** 한 달 글 — 그 달 파일이 없으면 빈 목록 */
export async function loadGrowthMonth(month: string): Promise<readonly GrowthLesson[]> {
  const load = MONTH_LOADERS[`./growth/${month}.ts`];
  return load ? (await load()).default : [];
}

/** 오늘 화면에 필요한 글 — 최근 두 달 + 날마다 글이 생기기 전의 글 */
export async function loadGrowthLessons(today: string): Promise<readonly GrowthLesson[]> {
  const parts = await Promise.all(monthsFor(today).map(loadGrowthMonth));
  return [...parts.flat(), ...LEGACY_LESSONS];
}

/** 가장 최근 교육이 '오늘의 교육'인 기간 (일) — days 가 없는 글 */
export const NEWEST_LESSON_DAYS = 7;

/** '지난 글'로 보여 주는 날 수 */
export const RECENT_LESSON_DAYS = 7;

const DAY_MS = 86_400_000;
const dayNumber = (ymd: string): number => Math.floor(Date.parse(`${ymd}T00:00:00Z`) / DAY_MS);

/** 날짜에 n일 더하기 (YYYY-MM-DD 글자 그대로) */
export const addDays = (ymd: string, n: number): string => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

/** '11/16(월)' — 지난 글 줄의 날짜 */
export const growthDayLabel = (ymd: string): string =>
  `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}(${WEEKDAY_KO[weekdayOf(ymd)]})`;

/** 그날의 글 — 받은 글 가운데서 고른다 */
export function todayLesson(today: string, lessons: readonly GrowthLesson[]): GrowthLesson | null {
  const live = lessons.filter((l) => l.from <= today).sort((a, b) => (a.from < b.from ? 1 : a.from > b.from ? -1 : 0));
  if (live.length === 0) return null;
  const newest = live[0];
  const age = dayNumber(today) - dayNumber(newest.from);
  if (age < (newest.days ?? NEWEST_LESSON_DAYS) || live.length === 1) return newest;
  // 날마다 글이 끝난 뒤 — 같은 요일 코너 글을 주마다 돌아가며 (화요일에 '한 주 돌아보기'가 나오지 않게)
  const sameWeekday = live.filter((l) => l.days === 1 && weekdayOf(l.from) === weekdayOf(today));
  if (sameWeekday.length > 0) return sameWeekday[Math.floor(age / 7) % sameWeekday.length];
  return live[((age % live.length) + live.length) % live.length];
}

export interface RecentLesson {
  /** 그 글이 '오늘의 글'이던 날 */
  day: string;
  lesson: GrowthLesson;
}

/** 지난 글 — 어제부터 거슬러 올라가며 그날 보이던 날마다 글 (오늘 글 · 같은 글은 한 번만 · 가까운 날부터) */
export function recentLessons(today: string, lessons: readonly GrowthLesson[], days = RECENT_LESSON_DAYS): RecentLesson[] {
  const seen = new Set<string>();
  const now = todayLesson(today, lessons);
  if (now) seen.add(now.id);
  const out: RecentLesson[] = [];
  for (let i = 1; i <= days; i++) {
    const day = addDays(today, -i);
    const lesson = todayLesson(day, lessons);
    if (!lesson || lesson.days !== 1 || seen.has(lesson.id)) continue;
    seen.add(lesson.id);
    out.push({ day, lesson });
  }
  return out;
}
