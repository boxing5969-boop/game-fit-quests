/**
 * 🥊 레벨업 안내 — 새 튜토리얼 (2026-11-27)
 *   대표님 「마이복서 153 듀토리얼 지금은 너무 복잡한데 이거 업데이트 하자 … 회원님들의 UX를 경험할수있게 피로하지 않게」
 *   → 「7일 캠프는 이제 빼자 레벨업 시스템에 대해서 동기부여 해주자 어떻게 레벨이 올라가는지 왜 하는지 알려주는 듀토리얼으로」
 *   표현: 「출석하면 레벨업」이 아니라 트레이닝 → 레벨업 · '도장'은 유아틱 → 대표님이 고른 「트레이닝 1일차 · 2일차」
 *   (11/18 대표님 「1일차 수업 2일차 수업 3일차 수업」 · 153 수업 매뉴얼의 일차와 같은 말)
 *
 * 화면 5장 — 한 장에 한 가지 · 글은 두 줄 안팎 · 언제든 건너뛰기 · 휴대폰 뒤로가기 = 닫기 · 옆으로 밀어 넘기기
 *   1 왜     — 40레벨(화이트 → 블랙) · 레벨마다 기술 하나 · 「반복은 천재를 만든다」
 *   2 일차   — 트레이닝한 날이 1일차 · 2일차로 쌓인다 (직접 눌러 보는 연습 · 3일차에 레벨업 축하 + 보상 상자)
 *   3 리그   — 리그마다 레벨업까지 필요한 날(서버 get_levelup_rules) · 레벨 10은 타이틀매치 · 운동 종료 팁
 *   4 보상   — 레벨업 보상(홈 보상 상자와 같은 셈) · 마일리지 = 결제 할인 · 챔피언 머니 = 캐릭터 꾸미기
 *   5 시작   — 내 일차는 홈 「다음 레벨까지」 · 알림 켜기(레벨업 소식 · 「레벨 N 달성!」 알림이 실제로 간다)
 * 누구에게 저절로: 회원(지도진 · 관리자 · 마스터 빼고) · 홈에서 · 계정에 한 번(서버 member_guides · 이 기기 기록은 예비).
 * 띄운 접속에는 편지(WelcomeLetter)를 다음 접속으로 미룬다 — 창이 연달아 뜨지 않게.
 * 이 파일은 화면 없는 계산 · 글 · 상태만 (시험 levelGuide.test.ts).
 */
import { RANK_LABELS } from "@/data/sharedConstants";
import type { LeagueRule } from "@/lib/journeyMath";
import { whoLabel } from "@/lib/levelAuthority";
import {
  ATTEND_MONEY,
  LEAGUE_ORDER,
  LEAGUE_VISITS,
  questReward,
  questStamps,
  type QuestLeague,
  type QuestReward,
  type QuestStamp,
} from "@/lib/levelQuest";
import type { MileageRules } from "@/services/mileageService";

/** 안내 이름 (서버 member_guides.guide) */
export const LEVEL_GUIDE = "level";

export const GUIDE_STEPS = ["why", "days", "leagues", "rewards", "start"] as const;
export type GuideStepKey = (typeof GUIDE_STEPS)[number];
export const GUIDE_STEP_COUNT = GUIDE_STEPS.length;

/** 연습 화면 — 화이트 레벨 1 → 레벨 2 (화이트는 레벨마다 트레이닝 3일) */
export const DEMO_DAYS = LEAGUE_VISITS.white;

const won = (n: number) => Math.trunc(n).toLocaleString("ko-KR");

// ─── 글 (회원 화면 — im-not-ai 점검 · 숫자는 서버 값) ───

export const GUIDE_COPY = {
  why: {
    kicker: (name: string | null | undefined) => (name && name.trim() ? `${name.trim()}님, 반가워요` : "반가워요"),
    title: "복싱 실력이 레벨로 보여요",
    body: "153은 복싱을 40레벨로 나눴어요. 레벨마다 기술을 하나씩 배우며 화이트부터 블랙까지 올라가요.",
  },
  days: {
    title: "트레이닝한 날이 1일차, 2일차로 쌓여요",
    body: "체육관에서 트레이닝하면 그날이 하루로 기록돼요. 앱에서 따로 누를 건 없어요.",
    reached: "레벨 2 달성!",
    note: "연습 화면이에요. 진짜 레벨은 체육관 트레이닝으로 올라가요.",
  },
  leagues: {
    title: "레벨업까지 필요한 날",
    body: "리그가 오를수록 한 레벨에 더 오래 머물며 깊게 배워요.",
    titleMatch: "레벨 10 · 20 · 30 · 40은 타이틀매치",
    titleMatchBody: "리그의 마지막 관문이에요. 배운 기술을 보여 주고 통과하면 다음 리그로 올라가요.",
    tip: "운동이 끝나면 「운동 종료」를 눌러 주세요. 오래 운동한 날은 다음 일차가 조금 미리 차요.",
  },
  rewards: {
    title: "레벨이 오를 때마다 보상이 있어요",
  },
  start: {
    title: "이제 트레이닝으로 레벨을 올려요",
    body: "내 일차와 다음 레벨까지 남은 날은 홈 「다음 레벨까지」 카드에 늘 보여요.",
    pushTitle: "레벨이 오르면 휴대폰으로 알려 드릴게요",
    pushOn: "알림 켜고 시작하기",
    pushSkip: "알림 없이 시작하기",
    go: "내 레벨 보러 가기",
  },
} as const;

/** 연습 단추 — 「1일차 트레이닝 해 보기」 → … → 다 하면 null (다음으로) */
export function demoActionLabel(done: number): string | null {
  const n = Math.max(0, Math.round(Number(done) || 0));
  return n >= DEMO_DAYS ? null : `${n + 1}일차 트레이닝 해 보기`;
}

/** 연습 일차 칸 — 해 본 날 수(0 ~ 3). 마지막으로 한 날이 '오늘' (홈 카드와 같은 그림) */
export function demoDays(done: number): QuestStamp[] {
  const n = Math.max(0, Math.min(DEMO_DAYS, Math.round(Number(done) || 0)));
  return questStamps({
    league: "white",
    level: 1,
    req: DEMO_DAYS,
    progress: n,
    progressFloor: n,
    attendedToday: n > 0,
    leveledUpToday: false,
  });
}

type MileageLike = Pick<MileageRules, "enabled" | "level_up" | "title_match" | "attendance"> | null | undefined;

const mileageOn = (m: MileageLike) => (m && m.enabled ? m : null);

/** 연습에서 레벨 2에 닿았을 때 받는 보상 (보여 주기만 — 실제 지급 없음) */
export function demoReward(mileage: MileageLike): QuestReward {
  const m = mileageOn(mileage);
  return questReward({
    boss: false,
    approval: false,
    nextLeague: "블루 리그",
    mileage: m ? { enabled: true, level_up: m.level_up, title_match: m.title_match } : null,
    goal: "레벨 2",
    received: true,
  });
}

/** 4장 보상 상자 — 레벨 1~9 레벨업 보상 (홈 「레벨 N 달성 보상」과 같은 셈) */
export function levelUpReward(mileage: MileageLike): QuestReward {
  const m = mileageOn(mileage);
  return questReward({
    boss: false,
    approval: false,
    nextLeague: "블루 리그",
    mileage: m ? { enabled: true, level_up: m.level_up, title_match: m.title_match } : null,
    goal: null,
    received: false,
  });
}

export interface GuidePerk {
  /** 153 입체 아이콘 이름 */
  icon: string;
  name: string;
  text: string;
}

/** 4장 — 보상이 어디에 쓰이는지 (마일리지를 끈 운영이면 마일리지 줄 없이) */
export function guidePerks(mileage: MileageLike): GuidePerk[] {
  const perks: GuidePerk[] = [];
  if (mileageOn(mileage)) {
    perks.push({ icon: "coin", name: "마일리지", text: "수강권 · PT · 용품 결제 때 1점 = 1원으로 할인돼요 (결제 금액의 10%까지)" });
  }
  perks.push({ icon: "money", name: "챔피언 머니", text: "캐릭터를 꾸미는 앱 화폐예요" });
  perks.push({ icon: "trophy", name: "리그 승급", text: "리그가 오르면 새 캐릭터 아이템이 열려요. 레벨 40 타이틀매치까지 통과하면 명예의 전당이에요" });
  return perks;
}

export interface DailyPerkItem {
  /** 153 입체 아이콘 이름 */
  icon: string;
  name: string;
  /** "+100" */
  value: string;
}

/** 4장 아래 — 레벨업과 따로, 트레이닝한 날마다 바로 쌓이는 것 (홈 「오늘의 퀘스트」와 같은 값) */
export function dailyPerkItems(mileage: MileageLike): DailyPerkItem[] {
  const m = mileageOn(mileage);
  const items: DailyPerkItem[] = [{ icon: "money", name: "챔피언 머니", value: `+${won(ATTEND_MONEY)}` }];
  if (m && m.attendance > 0) items.push({ icon: "coin", name: "마일리지", value: `+${won(m.attendance)}` });
  return items;
}

/** 4장 아래 한 줄(읽어 주기) — 「트레이닝한 날마다 챔피언 머니 +100 · 마일리지 +300도 바로 쌓여요」 */
export function dailyPerkLine(mileage: MileageLike): string {
  const parts = dailyPerkItems(mileage).map((it) => `${it.name} ${it.value}`);
  return `트레이닝한 날마다 ${parts.join(" · ")}도 바로 쌓여요`;
}

/** 4장 아래 머리글 */
export const DAILY_PERK_LABEL = "트레이닝한 날마다 바로";

export interface GuideLeagueRow {
  league: QuestLeague;
  /** "화이트 리그" */
  name: string;
  /** "레벨 1~10" */
  range: string;
  /** 레벨마다 필요한 트레이닝 날 */
  days: number;
  /** 날을 채우면 바로 레벨업 (화이트 · 블루) — 아니면 지도진이 보고 승급 */
  auto: boolean;
  /** 승급을 보는 사람 — "담당 코치님" · "지점장·관장님" (자동이면 null) */
  judge: string | null;
  /** 레벨마다 최소 머무는 날 (블랙 45) */
  minDays: number;
}

/** 3장 — 리그마다 레벨업까지 필요한 날 (서버 규칙 · 못 읽으면 기본값 3 · 5 · 8 · 20) */
export function guideLeagues(rules: readonly LeagueRule[] | null | undefined): GuideLeagueRow[] {
  return LEAGUE_ORDER.map((lg, i) => {
    const r = rules?.find((x) => x.rank === lg);
    const first = r && r.firstLevel > 0 ? r.firstLevel : i * 10 + 1;
    const last = r && r.lastLevel > 0 ? r.lastLevel : i * 10 + 10;
    const days = r && Number(r.visitsPerLevel) > 0 ? Math.round(Number(r.visitsPerLevel)) : LEAGUE_VISITS[lg];
    const auto = r ? !!r.autoAdvance : lg === "white" || lg === "blue";
    return {
      league: lg,
      name: `${RANK_LABELS[lg]} 리그`,
      range: `레벨 ${first}~${last}`,
      days,
      auto,
      judge: auto ? null : whoLabel(r?.levelAuthority),
      minDays: Math.max(0, Math.round(Number(r?.minDaysPerLevel) || 0)),
    };
  });
}

/** 3장 리그 줄 오른쪽 작은 글 — 「자동 레벨업」 · 「담당 코치님이 보고 승급 · 레벨마다 45일 이상」 */
export function leagueRowNote(row: GuideLeagueRow): string {
  const how = row.auto ? "자동 레벨업" : `${row.judge ?? "코치님"}이 보고 승급`;
  return row.minDays > 0 ? `${how} · 레벨마다 ${row.minDays}일 이상` : how;
}

// ─── 누구에게 · 언제 ───

export interface GuideStatus {
  seen: boolean;
  done: boolean;
  skipped: boolean;
  maxStep: number;
  opens: number;
}

/** 서버 member_guide_status 결과 → 화면 값 (모양이 이상하면 '안 봄') */
export function parseGuideStatus(raw: unknown): GuideStatus {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0);
  return { seen: o.seen === true, done: o.done === true, skipped: o.skipped === true, maxStep: num(o.max_step), opens: num(o.opens) };
}

export interface GuideAudienceInput {
  signedIn: boolean;
  /** 관리자 계정 (회원으로 보기 중이어도) */
  isAdmin: boolean;
  /** 지도진 — 코치 · 지점장 · 관장 */
  isStaff: boolean;
  /** 레벨 40 마스터 · 마스터 로드 — 올라갈 레벨이 없다 */
  isMaster: boolean;
}

/** 저절로 띄우는 사람 — 승급할 레벨이 있는 회원만 */
export function isGuideAudience(i: GuideAudienceInput): boolean {
  return i.signedIn && !i.isAdmin && !i.isStaff && !i.isMaster;
}

/** 레벨 40 마스터 · 마스터 로드인가 (홈 isMaster40 · onMasterTrack 과 같은 셈) */
export function isMasterProgress(p: unknown): boolean {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  const black40 = o.current_rank === "black" && Number(o.current_level) === 10 && Number(o.bosses_cleared) >= 4;
  const masterTrack = !!o.master_track_unlocked && Number(o.master_level ?? 0) >= 1;
  return black40 || masterTrack;
}

/** 홈 주소인가 (첫 화면 /home · 뿌리 /) */
export const isHomePath = (path: string) => path === "/home" || path === "/";

export interface AutoShowInput {
  audience: boolean;
  /** 서버 기록 — 읽는 중이면 null · 못 읽었으면 "error" */
  status: GuideStatus | null | "error";
  /** 이 기기에서 본 적 있음 (서버를 못 읽을 때의 예비) */
  localSeen: boolean;
  /** 이번 접속에 이미 띄웠음 */
  shownThisSession: boolean;
}

/** 띄울 차례인가 — 회원 · 아직 안 봄 (서버가 정본 · 서버를 못 읽으면 이 기기 기록) */
export function guideDue(i: AutoShowInput): boolean {
  if (!i.audience || i.shownThisSession) return false;
  if (i.status === null) return false;
  if (i.status === "error") return !i.localSeen;
  return !i.status.seen;
}

export const guideLocalKey = (uid: string) => `153guide:${LEVEL_GUIDE}:seen:${uid}`;
export const guideSessionKey = (uid: string) => `153guide:${LEVEL_GUIDE}:shown:${uid}`;

// ─── 편지와 순서 맞추기 (WelcomeLetter) ───
//   checking = 서버 기록 읽는 중 · due = 띄울 차례(홈에 오면) · showing = 띄우는 중 · shown = 이번 접속에 띄웠음 → 편지는 다음 접속에
//   clear = 이미 봤음(편지 그대로) · idle = 대상 아님(지도진 · 관리자 · 마스터)

export type GuideGate = "idle" | "checking" | "due" | "showing" | "shown" | "clear";

let gate: GuideGate = "idle";
const gateSubs = new Set<() => void>();

export const getGuideGate = (): GuideGate => gate;

export function setGuideGate(next: GuideGate): void {
  if (gate === next) return;
  gate = next;
  gateSubs.forEach((f) => f());
}

export function subscribeGuideGate(f: () => void): () => void {
  gateSubs.add(f);
  return () => {
    gateSubs.delete(f);
  };
}

/** 편지가 기다릴 때 — 안내를 확인 중 · 띄울 차례 · 띄우는 중 · 이번 접속에 띄웠음 */
export const guideHoldsLetters = (g: GuideGate): boolean => g === "checking" || g === "due" || g === "showing" || g === "shown";

// ─── 다시 보기 (설정 · 내정보 · 레벨 카드 ?) ───

export const LEVEL_GUIDE_OPEN_EVENT = "153guide:open";
export type GuideOpenSource = "settings" | "mypage" | "rule" | "url";

export function openLevelGuide(source: GuideOpenSource): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LEVEL_GUIDE_OPEN_EVENT, { detail: { source } }));
}

/** 주소로 열기 — ?guide=level (운영진 미리 보기 · 대표님 확인용) */
export const wantsGuideFromUrl = (search: string): boolean => new URLSearchParams(search).get("guide") === LEVEL_GUIDE;
