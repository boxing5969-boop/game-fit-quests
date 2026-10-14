/**
 * 🏆 타이틀매치 도전 — 회원 신청 · 지점장 영상 심사 · 도전 3번 (2026-10-14 대표님).
 *
 * 대표님 원문
 *   · 레벨 10이 된 회원에게 "화이트 타이틀매치를 통해 다음 레벨로" 팝업 → '타이틀미션 보기'
 *   · 미션 설명: 1) 파트너를 구한다  2) 파트너와 타이틀미션을 연습한다  3) 지점장님에게 심사를 신청한다
 *   · 심사하는 지점장이 영상을 찍어 앱에 올린다 · 도전은 3번까지
 *   · 미션 = 완벽한 자세로 3번 연속 성공 → 똑같은 동작 3회 미트 받아주기
 *   · 3번 모두 아쉬우면 7일 뒤 다시 신청 · 신청은 레벨 10이 되자마자
 *
 * 정본은 DB — get_title_match_state · request_title_match_review · record_title_match_attempt
 * (마이그레이션 20261014150000_white_title_match_challenge.sql). 숫자(3번·7일)도 서버가 내려 준 값을 쓴다.
 * 여기는 화면이 쓰는 순수 계산과 안내 문구만 둔다 (테스트: titleMatchChallenge.test.ts).
 */

import { isPilotBranch } from "./pilotBranches";

export type ChallengeStatus = "requested" | "passed" | "failed" | "cancelled";
export type GateAuthority = "coach" | "manager" | "owner";

export interface TitleAttempt {
  no: number;
  passed: boolean;
  note: string | null;
  recordedAt: string;
  /** 비공개 저장소 title-match-videos 안 경로 — 보려면 서명 주소를 받는다 */
  videoPath: string;
}

export interface TitleChallenge {
  id: string;
  status: ChallengeStatus;
  requestedAt: string;
  /** 회원이 앱에서 신청했으면 true, 지점장이 바로 시작했으면 false */
  requestedBySelf: boolean;
  closedAt: string | null;
  attempts: TitleAttempt[];
}

export interface TitleMatchState {
  rank: string;
  level: number;
  isTitleLevel: boolean;
  flowEnabled: boolean;
  cleared: boolean;
  authority: GateAuthority;
  maxAttempts: number;
  retryDays: number;
  /** 3번 마감 뒤 다시 신청할 수 있는 시각 (잠겨 있지 않으면 null) */
  retryAt: string | null;
  /** 열린 신청, 없으면 가장 최근 신청 */
  challenge: TitleChallenge | null;
  canRequest: boolean;
}

export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_RETRY_DAYS = 7;

/** 회원 신청 · 지점장 영상 심사 흐름을 쓰는 리그 — DB title_match_flow_enabled() 와 같은 목록 */
export const TITLE_FLOW_LEAGUES: readonly string[] = ["white"];
export const isTitleFlowLeague = (rank: string | null | undefined): boolean =>
  !!rank && TITLE_FLOW_LEAGUES.includes(rank);

/**
 * 이 회원이 신청 흐름을 쓰는가 — 리그 + 시범 지점 (2026-10-14: 선릉역점부터, DB title_match_flow_enabled_for 와 같은 규칙).
 * 다른 지점의 화이트 레벨 10은 어제처럼 심사 항목 확인 → 담당 코치님 승인.
 */
export const isTitleFlowFor = (rank: string | null | undefined, branch: string | null | undefined): boolean =>
  isTitleFlowLeague(rank) && isPilotBranch(branch);

/** 리그 → 타이틀매치 화면 칸 (?lv=) */
export const titleStageLevel = (rank: string | null | undefined): number => {
  const i = ["white", "blue", "red", "black"].indexOf(rank ?? "");
  return (i < 0 ? 0 : i) * 10 + 10;
};
export const titleMatchLink = (rank: string | null | undefined) => `/title-match?lv=${titleStageLevel(rank)}`;

const LEAGUE_KO: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };
const NEXT_LEAGUE_KO: Record<string, string> = { white: "블루", blue: "레드", red: "블랙", black: "MASTER" };
export const leagueKo = (rank: string | null | undefined) => LEAGUE_KO[rank ?? ""] ?? "";
export const nextLeagueKo = (rank: string | null | undefined) => NEXT_LEAGUE_KO[rank ?? ""] ?? "다음 리그";

// ── 서버 응답 읽기 ─────────────────────────────────────────

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const STATUSES: readonly ChallengeStatus[] = ["requested", "passed", "failed", "cancelled"];
const AUTHORITIES: readonly GateAuthority[] = ["coach", "manager", "owner"];

function parseAttempt(raw: unknown): TitleAttempt | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const no = num(a.no, 0);
  if (no < 1) return null;
  return {
    no,
    passed: a.passed === true,
    note: typeof a.note === "string" && a.note.trim() ? a.note : null,
    recordedAt: str(a.recordedAt),
    videoPath: str(a.videoPath),
  };
}

function parseChallenge(raw: unknown): TitleChallenge | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const status = STATUSES.find((s) => s === c.status);
  if (!status || !str(c.id)) return null;
  const attempts = (Array.isArray(c.attempts) ? c.attempts : [])
    .map(parseAttempt)
    .filter((a): a is TitleAttempt => !!a)
    .sort((x, y) => x.no - y.no);
  return {
    id: str(c.id),
    status,
    requestedAt: str(c.requestedAt),
    requestedBySelf: c.requestedBySelf === true,
    closedAt: typeof c.closedAt === "string" ? c.closedAt : null,
    attempts,
  };
}

/** get_title_match_state 응답 → 화면용. ok 가 아니거나 모양이 틀리면 null */
export function parseTitleMatchState(raw: unknown): TitleMatchState | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (s.ok !== true) return null;
  return {
    rank: str(s.rank),
    level: num(s.level, 1),
    isTitleLevel: s.isTitleLevel === true,
    flowEnabled: s.flowEnabled === true,
    cleared: s.cleared === true,
    authority: AUTHORITIES.find((a) => a === s.authority) ?? "manager",
    maxAttempts: num(s.maxAttempts, DEFAULT_MAX_ATTEMPTS),
    retryDays: num(s.retryDays, DEFAULT_RETRY_DAYS),
    retryAt: typeof s.retryAt === "string" && s.retryAt ? s.retryAt : null,
    challenge: parseChallenge(s.challenge),
    canRequest: s.canRequest === true,
  };
}

// ── 단계 ───────────────────────────────────────────────────

/** 열린(심사 중) 신청 */
export const openChallenge = (s: TitleMatchState | null | undefined): TitleChallenge | null =>
  s?.challenge?.status === "requested" ? s.challenge : null;

export const attemptsUsed = (c: TitleChallenge | null | undefined): number => c?.attempts.length ?? 0;

/** 이번 신청에서 남은 기회 (열린 신청이 없으면 전체) */
export const attemptsLeft = (s: TitleMatchState | null | undefined): number => {
  const max = s?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  return Math.max(0, max - attemptsUsed(openChallenge(s)));
};

/**
 * 회원 화면 단계
 *   not_title   — 아직 레벨 10 이 아니거나, 이 리그는 앱 신청 흐름이 아님
 *   cleared     — 통과
 *   locked      — 3번 마감, retryAt 까지 신청 불가
 *   ready       — 지금 신청할 수 있음
 *   requested   — 신청함 · 아직 도전 기록 없음
 *   challenging — 신청함 · 도전 1번 이상 (기회 남음)
 */
export type MemberPhase = "not_title" | "cleared" | "locked" | "ready" | "requested" | "challenging";

export function memberPhase(s: TitleMatchState | null | undefined): MemberPhase {
  if (!s || !s.flowEnabled || !s.isTitleLevel) return s?.cleared ? "cleared" : "not_title";
  if (s.cleared) return "cleared";
  const open = openChallenge(s);
  if (open) return attemptsUsed(open) > 0 ? "challenging" : "requested";
  if (s.retryAt) return "locked";
  return s.canRequest ? "ready" : "not_title";
}

/** 홈 팝업을 띄울지 — 신청할 수 있는 회원에게만 (신청했거나 잠겨 있으면 띄우지 않는다) */
export const shouldShowInvite = (s: TitleMatchState | null | undefined): boolean =>
  memberPhase(s) === "ready";

// ── 날짜 (한국 기준) ────────────────────────────────────────

const KST_MS = 9 * 3600 * 1000;

/** 한국 날짜 "2026-10-14" — 기기 시간대와 무관 */
export function kstDateKey(d: Date = new Date()): string {
  return new Date(d.getTime() + KST_MS).toISOString().slice(0, 10);
}

/** "10월 21일" (한국 날짜) */
export function formatKoMonthDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const k = new Date(t + KST_MS);
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일`;
}

/** "10/14 19:05" (한국 시각) — 도전 기록 한 줄 */
export function formatKoShortDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const k = new Date(t + KST_MS);
  const hh = String(k.getUTCHours()).padStart(2, "0");
  const mm = String(k.getUTCMinutes()).padStart(2, "0");
  return `${k.getUTCMonth() + 1}/${k.getUTCDate()} ${hh}:${mm}`;
}

/**
 * 3번 마감된 시각 → 다시 신청할 수 있는 시각. DB title_match_retry_at() 과 같은 규칙:
 * 마감된 한국 날짜 + retryDays 일의 0시(한국).
 */
export function retryAtFrom(closedAtIso: string | null | undefined, retryDays = DEFAULT_RETRY_DAYS): string | null {
  if (!closedAtIso) return null;
  const t = Date.parse(closedAtIso);
  if (!Number.isFinite(t)) return null;
  const kstDayStart = Math.floor((t + KST_MS) / 86400000) * 86400000; // 한국 날짜 0시를 UTC 숫자로
  return new Date(kstDayStart + retryDays * 86400000 - KST_MS).toISOString();
}

/** 홈 팝업 '오늘은 그만' 기억 키 — 사람마다 · 한국 날짜마다 (다른 화면 캐시와 겹치지 않게 153title:) */
export const invitePopupKey = (userId: string, now: Date = new Date()) =>
  `153title:invite:${userId}:${kstDateKey(now)}`;

// ── 안내 문구 (대표님 원문) ──────────────────────────────────

export const TITLE_MISSION_STEPS: ReadonlyArray<{ n: number; title: string; desc: string }> = [
  { n: 1, title: "파트너를 구해요", desc: "미트를 서로 잡아 줄 회원 한 명이면 돼요" },
  { n: 2, title: "파트너와 타이틀미션을 연습해요", desc: "아래 동작 영상을 보며 번갈아 치고, 번갈아 미트를 받아 줘요" },
  { n: 3, title: "지점장님께 심사를 신청해요", desc: "준비되면 아래 버튼을 눌러요 — 지점장님께 바로 알림이 가요" },
];

/** 심사 기준 — 도전 횟수·재신청 일수는 서버 값 */
export function titleMissionRules(maxAttempts = DEFAULT_MAX_ATTEMPTS, retryDays = DEFAULT_RETRY_DAYS): string[] {
  return [
    "타이틀매치 동작을 완벽한 자세로 3번 연속 성공",
    "이어서 똑같은 동작을 파트너에게 미트로 3번 받아주기",
    `지점장님이 영상으로 찍어 앱에 올려요 · 도전은 ${maxAttempts}번까지`,
    `${maxAttempts}번 모두 아쉬우면 ${retryDays}일 뒤 다시 신청해요`,
  ];
}

/** 심사하는 사람 (회원에게 보이는 말) */
export const reviewerLabel = (a: GateAuthority | null | undefined): string =>
  a === "owner" ? "관장님" : a === "coach" ? "코치님" : "지점장님";

// ── 영상 (지점장 촬영) ───────────────────────────────────────

/** 저장소 한도와 같다 (title-match-videos 50MB) */
export const TITLE_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
/** 앱 안 촬영 — 2Mbps · 최대 2분 30초 ≈ 38MB (한도 안) */
export const RECORDER_BITS_PER_SECOND = 2_000_000;
export const RECORDER_MAX_SECONDS = 150;

const TYPE_BY_EXT: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  qt: "video/quicktime",
  webm: "video/webm",
  "3gp": "video/3gpp",
};
const EXT_BY_TYPE: Record<string, string> = {
  "video/mp4": "mp4",
  "video/x-m4v": "m4v",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/3gpp": "3gp",
};

/** 저장소가 받는 영상 형식으로 맞춘다 (코덱 꼬리 제거 · 확장자로 짐작). 모르는 형식이면 null */
export function videoContentType(file: { type?: string | null; name?: string | null }): string | null {
  const base = (file.type ?? "").split(";")[0].trim().toLowerCase();
  if (EXT_BY_TYPE[base]) return base;
  const ext = (file.name ?? "").split(".").pop()?.toLowerCase() ?? "";
  return TYPE_BY_EXT[ext] ?? null;
}

/**
 * 저장 경로 — "{회원 id}/{한국 날짜시각}-{임의 6자}.{확장자}".
 * DB record_title_match_attempt 가 '^회원id/[A-Za-z0-9._-]{1,120}$' 로 확인한다.
 */
export function titleVideoPath(memberId: string, contentType: string, now: Date = new Date(), rand: number = Math.random()): string {
  const k = new Date(now.getTime() + KST_MS).toISOString(); // 2026-10-14T19:05:33.000Z (한국 시각 숫자)
  const stamp = k.slice(0, 19).replace(/[-:]/g, "").replace("T", "-"); // 20261014-190533
  const tail = Math.floor(Math.abs(rand) * 36 ** 6).toString(36).padStart(6, "0").slice(-6);
  const ext = EXT_BY_TYPE[contentType] ?? "mp4";
  return `${memberId}/${stamp}-${tail}.${ext}`;
}

/** 앱 안 촬영 형식 — mp4(아이폰·최신 크롬)를 먼저, 안 되면 webm */
export function pickRecorderMime(isTypeSupported: (t: string) => boolean): { mimeType: string; contentType: string } | null {
  const order = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  for (const t of order) {
    try {
      if (isTypeSupported(t)) return { mimeType: t, contentType: t.split(";")[0] };
    } catch {
      /* 일부 브라우저는 모르는 형식에 예외를 던진다 */
    }
  }
  return null;
}

/** "12.3MB" */
export const formatMb = (bytes: number) => `${(Math.max(0, bytes) / (1024 * 1024)).toFixed(1)}MB`;

/** "1:05" */
export const formatClock = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
