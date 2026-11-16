/**
 * 👀 홈 「다음 레벨까지」 카드 예시 — 어느 계정으로 들어와도 회원 화면 모습을 볼 수 있게 (운영진 미리 보기).
 *
 * 왜: 지도진 · 마스터(레벨 40) 계정의 홈에는 이 카드가 없다(승급할 다음 레벨이 없다) — 대표님 · 코치님이
 * 회원에게 무엇이 보이는지 확인하고 설명할 수 있게, 주소에 ?lvdemo= 를 붙이면 지어낸 진행 상황으로 카드를 그린다.
 *   /home?lvdemo=4    화이트 레벨 4 · 1번 왔어요 → 「2번 더 오면 돼요」 + 레벨 4 미션
 *   /home?lvdemo=1    처음 온 회원 → 「3번 더 오면 돼요」 + 레벨 1 미션
 *   /home?lvdemo=10   화이트 레벨 10 · 신청 전 → 타이틀미션 두 줄 + 타이틀매치 동작 + 신청 단추
 *   /home?lvdemo=wait 화이트 레벨 10 · 신청한 뒤 → 「심사를 기다려요」
 * 진행 상황(출석 · 심사 단계)만 지어낸 값이고 서버를 부르지 않는다. 미션 영상 목록은 그 레벨의 실제 미션을 읽는다.
 * 주소에서 빼면 바로 원래 화면 (기기에 남기지 않는다). 시험 nextLevelGuideSample.test.ts
 */
import type { TitleMatchState } from "@/lib/titleMatchChallenge";

/** LevelUpRequestCard 가 서버 대신 쓰는 값 */
export interface LevelCardDemo {
  league: string;
  /** 리그 안 레벨 1~10 */
  level: number;
  /** get_level_cycle_progress 와 같은 모양에서 카드가 읽는 칸 */
  cycle: {
    sessions: number;
    days: number;
    minutes: number;
    progressFloor: number;
    reqSessions: number;
    reqDays: number;
    reqMinutes: number;
    meets: boolean;
    reqMinDays: number;
    elapsedDays: number;
    rank: string;
    autoAdvances: boolean;
    fastTrackGates: number;
  };
  /** level_status.status */
  reviewStatus: string | null;
  /** 타이틀매치 신청 흐름(시범 지점 화이트 레벨 10)으로 그릴지 */
  titleFlow: boolean;
  titleState: TitleMatchState | null;
}

export interface NextLevelDemo {
  key: "1" | "4" | "10" | "wait";
  /** 예시 띠에 보이는 말 */
  label: string;
  /** 예시를 바꿔 보는 칩 이름 */
  chip: string;
  data: LevelCardDemo;
}

const whiteCycle = (visits: number): LevelCardDemo["cycle"] => ({
  sessions: visits,
  days: visits,
  minutes: 0,
  progressFloor: visits,
  reqSessions: 3,
  reqDays: 3,
  reqMinutes: 0,
  meets: false,
  reqMinDays: 0,
  elapsedDays: 5,
  rank: "white",
  autoAdvances: true,
  fastTrackGates: 0,
});

const titleState = (over: Partial<TitleMatchState>): TitleMatchState => ({
  rank: "white",
  level: 10,
  isTitleLevel: true,
  flowEnabled: true,
  cleared: false,
  authority: "manager",
  maxAttempts: 3,
  retryDays: 7,
  retryAt: null,
  challenge: null,
  canRequest: true,
  ...over,
});

const DEMOS: Record<NextLevelDemo["key"], NextLevelDemo> = {
  "1": {
    key: "1",
    label: "처음 온 회원 · 레벨 1",
    chip: "레벨 1",
    data: { league: "white", level: 1, cycle: whiteCycle(0), reviewStatus: null, titleFlow: false, titleState: null },
  },
  "4": {
    key: "4",
    label: "레벨 4 · 1번 온 회원",
    chip: "레벨 4",
    data: { league: "white", level: 4, cycle: whiteCycle(1), reviewStatus: null, titleFlow: false, titleState: null },
  },
  "10": {
    key: "10",
    label: "레벨 10 · 타이틀매치 신청 전",
    chip: "레벨 10",
    data: { league: "white", level: 10, cycle: whiteCycle(0), reviewStatus: null, titleFlow: true, titleState: titleState({}) },
  },
  wait: {
    key: "wait",
    label: "레벨 10 · 심사 신청한 뒤",
    chip: "신청 뒤",
    data: {
      league: "white",
      level: 10,
      cycle: whiteCycle(0),
      reviewStatus: null,
      titleFlow: true,
      titleState: titleState({
        canRequest: false,
        challenge: { id: "demo", status: "requested", requestedAt: "2026-11-16T00:00:00.000Z", requestedBySelf: true, closedAt: null, attempts: [] },
      }),
    },
  },
};

/** 예시 종류 — 띠에서 바꿔 볼 수 있게 순서대로 */
export const NEXT_LEVEL_DEMOS: readonly NextLevelDemo[] = [DEMOS["1"], DEMOS["4"], DEMOS["10"], DEMOS.wait];

/** 예시 주소 */
export const nextLevelDemoLink = (key: NextLevelDemo["key"]) => `/home?lvdemo=${key}`;

/** 주소의 ?lvdemo= 값 → 예시. 없거나 '0' 이면 null(원래 화면), 모르는 값은 레벨 4 예시 */
export function nextLevelDemo(param: string | null | undefined): NextLevelDemo | null {
  const v = (param ?? "").trim().toLowerCase();
  if (!v || v === "0" || v === "off") return null;
  return DEMOS[v as NextLevelDemo["key"]] ?? DEMOS["4"];
}
