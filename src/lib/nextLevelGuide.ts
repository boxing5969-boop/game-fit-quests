/**
 * 🎯 홈 「다음 레벨까지」 — 이번 레벨 미션 안내 (2026-11-16 대표님
 * 「마이복서 153 홈화면에 회원님들에게 다음 레벨로 가려면 얼마나 출석하면 될지? 또 어떤 미션을 달성하면 되는지 알려주자」)
 *
 * 몇 번 더 오면 되는지(출석)는 LevelUpRequestCard 가 서버 값(get_level_cycle_progress)으로 말한다 —
 * 여기는 그 아래 「미션」 칸에 무엇을 보일지만 고른다. 화면 없는 계산만 (시험 nextLevelGuide.test.ts).
 *
 *   · 레벨 1~9 — 출석으로 올라간다(화이트 · 블루는 자동, 레드 · 블랙은 심사). 미션 = 이 레벨의 레벨 미션 영상
 *                (missions 표 — 훈련 탭 「오늘의 영상」 · 「내 레벨 연습하기」와 같은 목록 · 같은 '따라했어요' 표시).
 *                영상이 아직 없는 레벨(블루 · 레드 · 블랙 대부분)은 레벨 데이터의 목표 한 줄.
 *   · 레벨 10  — 타이틀매치. 타이틀매치 신청 흐름이 열린 지점(시범 지점 화이트)은 타이틀미션 두 줄 + 심사 신청,
 *                그 밖은 타이틀매치 동작 영상.
 *   · 못한 것은 세지 않는다 — '0/3' 같은 숫자 없이, 따라 한 미션에만 표시한다 (회원 감정 설계 기준 ③).
 */
import { toGlobalLevel } from "@/lib/rankLabels";
import { formatKoMonthDay, titleMatchLink, type MemberPhase } from "@/lib/titleMatchChallenge";

/** 홈 카드에 줄로 보이는 미션 수 — 넘으면 「미션 n개 모두 보기」 */
export const MAX_MISSION_ROWS = 3;

/** 이번 레벨 미션 연습 화면 — 훈련 탭 「내 레벨 연습하기」(맨 위 타이틀매치 목표 · 이번 레벨 동작) */
export const PRACTICE_LINK = "/missions?open=practice";

/**
 * 타이틀미션 두 줄 — 심사 기준(titleMissionRules 첫 두 줄)을 홈 카드 한 줄 길이로 줄인 것.
 * 기준이 바뀌면 titleMatchChallenge.ts 와 같이 고친다 (시험이 '3번 연속 성공' · '3번 받아주기'를 같이 본다).
 */
export const TITLE_MISSION_SHORT: readonly string[] = ["완벽한 자세로 3번 연속 성공", "같은 동작을 미트로 3번 받아주기"];

export interface GuideVideo {
  id: string;
  /** 미션 제목 원문 — "[복싱/스텝] 사이드 방향전환 스텝ㅣ각도 만드는 좌우 풋워크" */
  title: string;
}

export interface MissionRow {
  /** 누르면 틀 미션 id (같은 동작의 다른 버전이 여럿이면 첫 번째) */
  id: string;
  name: string;
  /** 이 기기에서 '따라했어요'를 누른 미션 */
  done: boolean;
}

export interface MissionGuide {
  /** 칸 제목 — "레벨 4 미션" · "타이틀미션" · "타이틀매치 동작" */
  heading: string;
  /** 번호 줄 — 타이틀미션 두 줄 · 영상이 없는 레벨의 목표 한 줄 */
  steps: string[];
  /** 미션 영상 줄 — 아직 안 따라 한 것 먼저, MAX_MISSION_ROWS 개까지 */
  rows: MissionRow[];
  /** 이 레벨 미션 수 (같은 동작의 다른 버전은 하나로) */
  total: number;
  /** 맨 아래 한 줄 */
  link: { label: string; to: string };
}

export interface MissionGuideInput {
  /** white · blue · red · black */
  league: string;
  /** 리그 안 레벨 1~10 */
  level: number;
  /** 이 레벨의 레벨 미션 영상 (워밍업 영상 빼고 · 미션 순서대로) */
  videos: readonly GuideVideo[];
  /** '따라했어요' 표시 (useWatchedVideos) */
  watched: Readonly<Record<string, unknown>>;
  /** 영상이 없는 레벨에서 대신 보일 한 줄 — 레벨 데이터(allLevelsData)의 목표 · 제목 */
  fallback?: { title?: string | null; goal?: string | null } | null;
  /** 타이틀매치 신청 흐름(회원 신청 · 지점장 영상 심사)이 열린 회원인가 — isTitleFlowFor */
  titleFlow: boolean;
}

/**
 * 미션 제목 → 이름 + 같은 동작의 다른 버전인가.
 * "[복싱/잽] 4스텝 잽ㅣ설명" → "4스텝 잽" (useLevelVideos 의 parseVideoTitle 과 같은 규칙)
 * · 버전 꼬리표("· 실사" · "· 애니 여성")는 이름에서 뺀다 (learnMissions 와 같은 규칙).
 */
function splitMissionTitle(title: string | null | undefined): { name: string; variant: boolean } {
  const rest = (title ?? "").replace(/^\s*\[[^\]]*\]\s*/, "");
  const name = rest.split(/[ㅣ|]/)[0].trim();
  const base = name.replace(/\s*·\s*(?:실사|애니)[^ㅣ|]*$/, "").trim();
  return base && base !== name ? { name: base, variant: true } : { name, variant: false };
}

/** 미션 이름 — 꼬리표 · 설명 · 버전 꼬리표를 뗀 것 */
export function missionDisplayName(title: string | null | undefined): string {
  return splitMissionTitle(title).name;
}

/**
 * 줄로 보일 미션 — 아직 안 따라 한 것 먼저(순서는 그대로) · max 개까지.
 * 같은 동작의 다른 버전(· 실사 · 애니)만 한 줄로 묶는다 — 이름만 같은 다른 미션(예: 「4스텝 잽」 두 편)은 따로 센다
 * (훈련 탭 「오늘의 영상」 수와 같게).
 */
export function missionRows(
  videos: readonly GuideVideo[],
  watched: Readonly<Record<string, unknown>>,
  max = MAX_MISSION_ROWS,
): { rows: MissionRow[]; total: number } {
  const byKey = new Map<string, MissionRow>();
  for (const v of videos) {
    if (!v?.id) continue;
    const { name, variant } = splitMissionTitle(v.title);
    if (!name) continue;
    const key = variant ? `v:${name}` : `i:${v.id}`;
    const had = byKey.get(key);
    // 같은 동작의 다른 버전 중 하나라도 따라 했으면 따라 한 것
    if (had) had.done = had.done || !!watched[v.id];
    else byKey.set(key, { id: v.id, name, done: !!watched[v.id] });
  }
  const all = [...byKey.values()];
  const ordered = [...all.filter((r) => !r.done), ...all.filter((r) => r.done)];
  return { rows: ordered.slice(0, Math.max(0, max)), total: all.length };
}

/** 홈 「미션」 칸에 보일 것. 보일 것이 없으면(영상도 목표 글도 없음) null — 칸을 그리지 않는다. */
export function missionGuide(input: MissionGuideInput): MissionGuide | null {
  const level = Math.min(10, Math.max(1, Math.round(Number(input.level) || 1)));
  const { rows, total } = missionRows(input.videos, input.watched);
  const goal = (input.fallback?.goal ?? "").trim() || (input.fallback?.title ?? "").trim();

  if (level >= 10) {
    if (input.titleFlow) {
      return {
        heading: "타이틀미션",
        steps: [...TITLE_MISSION_SHORT],
        rows,
        total,
        link: { label: "타이틀미션 자세히 보기", to: titleMatchLink(input.league) },
      };
    }
    if (total === 0 && !goal) return null;
    return {
      heading: "타이틀매치 동작",
      steps: total === 0 ? [goal] : [],
      rows,
      total,
      link: { label: "타이틀매치 동작 연습하기", to: PRACTICE_LINK },
    };
  }

  if (total === 0 && !goal) return null;
  return {
    heading: `레벨 ${toGlobalLevel(input.league, level)} 미션`,
    steps: total === 0 ? [goal] : [],
    rows,
    total,
    link: { label: total > rows.length ? `미션 ${total}개 모두 보기` : "미션 연습하러 가기", to: PRACTICE_LINK },
  };
}

export interface TitleFlowHero {
  /** 카드 주인공 한 줄 */
  hero: string;
  /** 그 아래 회색 한 줄 (없으면 null) */
  note: string | null;
  tone: "reward" | "pending" | "plain";
  /** 「타이틀미션 · 심사 신청」 큰 단추를 보일 때 — 지금 신청할 수 있는 회원에게만 */
  canRequest: boolean;
}

/**
 * 타이틀매치 신청 흐름의 지금 단계 → 홈 카드 주인공 줄.
 * 단계를 아직 모르면(서버 답 전) 늘 맞는 말 「타이틀매치만 남았어요」 — 신청 단추는 답이 온 뒤에만.
 * 못한 것(도전 실패 횟수)은 말하지 않고 다음 한 걸음만 (회원 감정 설계 기준 ③ ⑤).
 */
export function titleFlowHero(
  phase: MemberPhase | null | undefined,
  opts: { attemptsLeft: number; retryAt: string | null; reviewer: string },
): TitleFlowHero {
  const who = opts.reviewer || "지점장님";
  switch (phase) {
    case "ready":
      return { hero: "타이틀매치만 남았어요", note: null, tone: "reward", canRequest: true };
    case "requested":
      return { hero: "심사를 기다려요", note: `${who}이 심사 날짜를 잡아 드려요`, tone: "pending", canRequest: false };
    case "challenging":
      return {
        hero: `도전 중 · 남은 기회 ${Math.max(0, opts.attemptsLeft)}번`,
        note: "파트너와 한 번 더 맞춰 보고 다시 도전해요",
        tone: "reward",
        canRequest: false,
      };
    case "locked": {
      const day = formatKoMonthDay(opts.retryAt);
      return {
        hero: day ? `${day}부터 다시 신청해요` : "곧 다시 신청할 수 있어요",
        note: "파트너와 더 연습하면 다음엔 꼭 넘어요",
        tone: "plain",
        canRequest: false,
      };
    }
    case "cleared":
      return { hero: "타이틀매치 통과!", note: null, tone: "reward", canRequest: false };
    default:
      return { hero: "타이틀매치만 남았어요", note: null, tone: "reward", canRequest: false };
  }
}
