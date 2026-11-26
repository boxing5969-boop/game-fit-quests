/**
 * 라이브보드 TV 2번 「체육관 공지사항」 탭 — 시간표 · 고르기 (2026-11-26 대표님 「우리 런칭이벤트 했던 사이니지 모니터에 체육관 공지사항
 * 탭하나 만들자 … 샤워실 최신형 린나이 대용량보일러 업그레이드를 통해 온수 끊김 문제 해결 · 회원님들이 사용하면 좋을 마이복서 153 기능
 * 공지사항은 총 3개정도만 돌아가게 만들자」 · 작업판 `myboxer:tv`)
 *
 * TV 2번 왼쪽 큰 칸(런칭 이벤트가 끝난 뒤)은 두 탭을 1분씩 번갈아 보여 준다 — 시계 기준(TV 를 껐다 켜도 · 여러 대여도 같은 화면):
 *   짝수 분 = 「마이복서153」(가치 전달 장면 하나 · 장면은 두 분에 하나씩 넘어간다) · 홀수 분 = 「체육관 공지사항」.
 *   공지 탭 1분 안에서 공지가 차례로 넘어간다(4장이면 15초씩 · 3장이면 20초씩). 한 지점에 4장까지(그 뒤는 잘린다).
 *   그 지점 공지가 없으면(다른 지점 · 기간이 끝남) 예전 그대로 가치 전달만 1분마다.
 * 글은 src/data/gymNotices.ts 한 곳 — 이 파일은 고르기 · 시간 계산만.
 */
import { GYM_NOTICES } from "@/data/gymNotices";
import { APP_ORIGIN } from "@/lib/appValueReel";

/** 탭 한 번 = 1분 (가치 전달 장면 한 장과 같은 길이) */
export const NOTICE_TAB_MS = 60_000;
/** 공지 탭에 한 번에 도는 공지 수 상한 — 15초 아래로 줄지 않게 */
export const NOTICE_MAX = 4;

/** 공지 안에서 나타나는 차례(공지 시작부터 ms) — 15초 공지라 3초 안에 다 보인다(나타날 때 페이드 한 번씩 · 그 뒤엔 그대로) */
export const NOTICE_BEATS = {
  answer: 500,
  visual: 800,
  proofs: [1_200, 1_600, 2_000] as const,
  ease: 2_500,
  qr: 2_900,
} as const;

/** 오른쪽 그림 — 공지마다 다른 틀(글은 데이터 파일에 · 그리기는 GymNoticeBoard) */
export type GymNoticeVisual =
  | { kind: "shower"; status: string }
  | { kind: "style"; title: string; bars: readonly { label: string; value: number }[]; foot: string }
  | { kind: "timer"; preset: string; clock: string; round: string; rounds: number; sub: string }
  | { kind: "pass"; nowLabel: string; nowSub: string; nextLabel: string; nextSub: string };

export interface GymNotice {
  /** 'YYYYMMDD-짧은-이름' — 한 번 정하면 바꾸지 않는다 */
  id: string;
  /** 보여 줄 지점(정식 이름) */
  branches: readonly string[];
  /** 'YYYY-MM-DD' 부터 (없으면 바로) */
  from?: string;
  /** 'YYYY-MM-DD' 까지 (없으면 내릴 때까지) */
  until?: string;
  /** 머리 칩 — 짧게 */
  tag: string;
  /** 1줄: 언제 · 어떤 상황 */
  kicker: string;
  /** 2줄 제목 — 둘째 줄을 민트로 칠한다 */
  hook: readonly [string, string];
  /** 답 한 줄 */
  answer: string;
  /** 내용 세 줄 */
  proofs: readonly string[];
  /** 의심 해소 · 맺는 한 줄 */
  ease: string;
  visual: GymNoticeVisual;
  /** 앱 화면으로 가는 QR 하나 — 체육관 소식(샤워실 등)은 없음 */
  qr?: { path: string; caption: readonly [string, string] };
}

/** 오늘 이 지점 TV 에 돌릴 공지 — 지점 · 기간이 맞는 것만, 적은 차례대로 4장까지 */
export function gymNoticesFor(
  branch: string | null | undefined,
  today: string,
  list: readonly GymNotice[] = GYM_NOTICES,
): GymNotice[] {
  const name = branch?.trim();
  if (!name) return [];
  return list
    .filter((n) => n.branches.includes(name) && (!n.from || n.from <= today) && (!n.until || today <= n.until))
    .slice(0, NOTICE_MAX);
}

/** 지금 TV 2번 왼쪽 칸이 보여 줄 것 */
export type Tv2Turn =
  | { tab: "value"; round: number }
  | { tab: "notice"; index: number; startedAt: number; ms: number };

export function tv2TurnAt(nowMs: number, count: number): Tv2Turn {
  const t = Math.max(0, nowMs);
  const minute = Math.floor(t / NOTICE_TAB_MS);
  if (count <= 0) return { tab: "value", round: minute };
  if (minute % 2 === 0) return { tab: "value", round: minute / 2 };
  const n = Math.min(count, NOTICE_MAX);
  const ms = NOTICE_TAB_MS / n;
  const offset = t % NOTICE_TAB_MS;
  const index = Math.min(n - 1, Math.floor(offset / ms));
  return { tab: "notice", index, startedAt: t - offset + index * ms, ms };
}

/** 다음에 화면이 바뀔 때까지 남은 ms — 분이 바뀔 때 · 공지가 넘어갈 때 */
export function msToNextTurn(nowMs: number, count: number): number {
  const t = Math.max(0, nowMs);
  const toMinute = NOTICE_TAB_MS - (t % NOTICE_TAB_MS);
  const turn = tv2TurnAt(t, count);
  if (turn.tab === "value") return toMinute;
  return Math.max(1, Math.min(toMinute, turn.startedAt + turn.ms - t));
}

/** QR 주소 — 어느 화면에서 왔는지 끝에 표시 */
export const noticeQrUrl = (path: string): string =>
  `${APP_ORIGIN}${path}${path.includes("?") ? "&" : "?"}from=tv-notice`;
