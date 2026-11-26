/**
 * 라이브보드 TV 2번 「마이복서153 가치 전달」 — 장면 글 · 숫자 한 곳 (2026-11-18 대표님 「사이니지에 현재 시상식 있잖아 그건 한줄로
 * 작게 만들어주고 마이복서153 가치전달하는 영상을 돌리자 1분 간격으로 … 어떤것을 얻을수있고 어떤 기능이있고 어떤 가치가 있는지
 * 너의 최고성능 프롬프트로 설득력있게 작성해줘」)
 *
 * 보는 사람: 체육관 안 회원님 — 2~4m 거리, 라운드 사이 숨 고르며 3~8초씩 본다.
 * 목표: 「오는 날이 눈에 보이는 성장이 된다」를 느끼고, 지금 휴대폰으로 그 화면 하나를 연다(QR) → 「153은 가치 있다」.
 *
 * 장면 하나(1분) = 전환 4칸(153-vscore-conversion) + 훅 5단계(153-viral-hook):
 *   ① 훅 — 1줄 누가 · 언제 · 상황(kicker) → 2줄 빈칸 질문(hook — 답을 쓰지 않는다)
 *   ② 증거 — 답(answer, 2.5초 뒤) · 세 줄(proofs) · 오른쪽 그림(visual — 서버 숫자와 앱 화면 모양)
 *   ③ 의심 해소 한 줄(ease) — 앱 앞에서 회원님이 망설이는 셋: 「따로 적어야 하지?」 · 「초보라 볼 게 없는데」 · 「못한 게 보일까 봐」
 *   ④ 행동 하나 — QR 한 개가 그 화면을 바로 연다(로그인 전이면 로그인 뒤 그 자리)
 * 장면마다 그림 틀이 다르다(큰 숫자 · 리그 길 · 칸 · 사다리 · 달력 · 요일 · 모집 카드 · 두 카드 · 가격 비교) — 같은 틀만 돌리지 않는다.
 *
 * 규칙: 숫자는 서버 값(board_app_pulse · board_launch_awards rules)과 코드에 있는 구조(레벨 40 · 영상 칸)만 · 같은 숫자는 한 장면에
 *   한 번 · 마일리지를 '원'으로 말하지 않는다 · 못한 것(빠진 날 · 줄어든 숫자)은 보이지 않는다 · 작은 숫자(회원 10명 아래 등)는 숨김 ·
 *   153 브랜드 금칙(국가대표 · 최고 · 프리미엄 · 보장 · 벨트 · 계급 · 긴 줄표 …) 0 · 해요체 · 서명 「153 건강과 행복. 153복싱짐」.
 *   글을 바꾸면 시험(appValueReel.test.ts)이 글자 수 · 금칙 · 숫자 겹침을 본다.
 */
import { NFA_NORM_TOTAL } from "@/data/nfaNorms";
import { CARD_SIGN, branchShortOf } from "@/lib/calendarTogether";
import { formatPoints, type AwardsView } from "@/lib/launchAwards";
import { LAUNCH_EVENT_PRIZE } from "@/services/king153Service";
import { MEMBER_SHELVES, SHELF_INFO } from "@/lib/trainingCards";

/** 한 장면 시간 — 대표님 「1분 간격으로」. 시계로 돌린다(TV 를 껐다 켜도 · 여러 대여도 같은 장면) */
export const SCENE_MS = 60_000;

/** 장면 안에서 나타나는 차례(장면 시작부터 ms) — 나타날 때 페이드 한 번씩, 그 뒤엔 그대로 */
export const SCENE_BEATS = {
  answer: 2_500,
  visual: 3_500,
  proofs: [4_500, 5_500, 6_500] as const,
  ease: 8_000,
  qr: 9_500,
} as const;

/** 이보다 작으면 숫자를 그리지 않는다(작은 숫자는 오히려 비어 보인다) */
export const PULSE_MIN = { members: 10, hours: 10, levelUps: 10, points: 10_000, products: 5 } as const;

export const APP_ORIGIN = "https://myboxer153.com";
/** QR 주소 끝 표시 — 어느 화면에서 왔는지 */
const FROM = "from=tv-value";

/** 서버 값이 없을 때(함수 적용 전 · 읽기 실패) 아는 대로 — 지금(11/18) 설정 그대로. 서버 값이 오면 서버가 이긴다 */
const SUNREUNG = "153복싱짐 선릉역점";
const FALLBACK_PILOT = [SUNREUNG];
const FALLBACK_WEATHER = [SUNREUNG, "153복싱짐 역삼점", "153복싱짐 잠실점", "153복싱짐 칠금점"];

export type ValueSceneId =
  | "record"
  | "level"
  | "learn"
  | "mileage"
  | "calendar"
  | "promise"
  | "together"
  | "bodymind"
  | "market";

export type LeagueId = "white" | "blue" | "red" | "black";
const LEAGUE_IDS: readonly LeagueId[] = ["white", "blue", "red", "black"];
const LEAGUE_NAME: Record<LeagueId, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };

export interface MileageRules {
  enabled: boolean;
  attendance: number | null;
  levelUp: number | null;
  titleMatch: number | null;
  record: number | null;
}

export interface LevelRule {
  rank: LeagueId;
  visits: number | null;
  auto: boolean;
  first: number | null;
  last: number | null;
}

export interface AppPulse {
  branch: string;
  days: number;
  members: number;
  visits: number;
  minutes: number;
  levelUps: number;
  points: number;
  mileage: MileageRules | null;
  levels: LevelRule[];
  features: { promise: boolean; returnBonus: number | null; weather: boolean; market: boolean; marketCount: number };
}

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const count = (v: unknown): number => Math.max(0, Math.round(num(v) ?? 0));
const plus = (v: unknown): number | null => {
  const n = num(v);
  return n != null && n > 0 ? Math.round(n) : null;
};

/** 마일리지 규칙 — 서버 모양 둘(board_app_pulse 의 snake · 정리된 camel) 다 읽는다 */
export function normalizeMileage(raw: unknown): MileageRules | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  return {
    enabled: r.enabled === true,
    attendance: plus(r.attendance),
    levelUp: plus(r.level_up ?? r.levelUp),
    titleMatch: plus(r.title_match ?? r.titleMatch),
    record: plus(r.record),
  };
}

/** board_app_pulse 응답 — 서버 값을 믿지 않고 다듬는다(모양이 다르면 null → 숫자 없는 장면) */
export function normalizePulse(raw: unknown): AppPulse | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const branch = typeof r.branch === "string" && r.branch.trim() ? r.branch.trim() : null;
  if (!branch) return null;
  const rules = (r.rules ?? {}) as Record<string, unknown>;
  const levels: LevelRule[] = [];
  for (const it of Array.isArray(rules.levels) ? rules.levels : []) {
    const o = (it ?? {}) as Record<string, unknown>;
    const rank = o.rank as LeagueId;
    if (!LEAGUE_IDS.includes(rank)) continue;
    const visits = num(o.visits);
    levels.push({
      rank,
      visits: visits != null && visits >= 1 && visits <= 99 ? Math.round(visits) : null,
      auto: o.auto === true,
      first: num(o.first),
      last: num(o.last),
    });
  }
  const f = (r.features ?? {}) as Record<string, unknown>;
  return {
    branch,
    days: count(r.days) || 28,
    members: count(r.members),
    visits: count(r.visits),
    minutes: count(r.minutes),
    levelUps: count(r.level_ups),
    points: count(r.points),
    mileage: normalizeMileage(rules.mileage),
    levels,
    features: {
      promise: f.promise === true,
      returnBonus: plus(f.return_bonus),
      weather: f.weather === true,
      market: f.market === true,
      marketCount: count(f.market_count),
    },
  };
}

/** 68313분 → '1,138시간' (내림 — 부풀리지 않는다) */
export const hoursText = (minutes: number): string =>
  `${Math.floor(Math.max(0, minutes) / 60).toLocaleString("ko-KR")}시간`;

/** 559430 → '55만 9,430' */
export function manText(n: number): string {
  const v = Math.max(0, Math.round(n));
  const man = Math.floor(v / 10000);
  const rest = v % 10000;
  if (man === 0) return rest.toLocaleString("ko-KR");
  return rest === 0 ? `${man.toLocaleString("ko-KR")}만` : `${man.toLocaleString("ko-KR")}만 ${rest.toLocaleString("ko-KR")}`;
}

/** 그림 아래 서버 숫자 한 칸 — 작은 회색 이름표 + 굵은 값 */
export interface PulseChip {
  label: string;
  value: string;
}

/** 오른쪽 그림 — 장면마다 다른 틀 */
export type SceneVisual =
  | { kind: "pulse"; caption: string | null; hero: string | null; heroLabel: string | null; flow: string[] }
  | { kind: "leagues"; leagues: { id: LeagueId; name: string; range: string }[]; chip: PulseChip | null }
  | { kind: "shelves"; shelves: { label: string; color: string }[] }
  | { kind: "ladder"; rows: { label: string; plus: string; big: boolean }[]; chip: PulseChip | null }
  | { kind: "calendar"; weather: boolean; coach: boolean; promise: boolean }
  | { kind: "promise"; days: string[]; picked: number[]; done: number[]; notice: string }
  | { kind: "together"; title: string; call: string; joined: string }
  | { kind: "bodymind"; cards: { tag: string; label: string; value: string }[]; source: string }
  | { kind: "market"; count: string | null; rows: { label: string; save: string }[] };

export interface ValueScene {
  id: ValueSceneId;
  /** 머리 칩 — 한 단어 */
  tag: string;
  /** 1줄: 누가 · 언제 · 상황 */
  kicker: string;
  /** 2줄: 빈칸 질문 — 줄마다 */
  hook: string[];
  /** 답 — 2.5초 뒤 */
  answer: string;
  /** 증거 세 줄 */
  proofs: string[];
  /** 의심 해소 한 줄 */
  ease: string;
  visual: SceneVisual;
  qr: { url: string; caption: readonly [string, string] };
}

export interface ReelInput {
  branch: string | null | undefined;
  pulse: AppPulse | null;
  /** 수상자 축하(board_launch_awards)가 준 마일리지 규칙 — 서버 함수가 없을 때 예비 */
  awardsRules?: MileageRules | null;
  /** 한국 날짜 YYYY-MM-DD — 달력 QR 이 그날을 연다 */
  today: string;
}

const url = (path: string) => `${APP_ORIGIN}${path}${path.includes("?") ? "&" : "?"}${FROM}`;

/** 서버 값이 작으면 숫자 대신 null */
const enough = (p: AppPulse | null) => !!p && p.members >= PULSE_MIN.members;

/**
 * 오늘 TV 가 돌릴 장면들 — 켠 기능 · 서버 숫자에 맞춰 고른다(없는 기능은 장면을 빼고, 모르는 숫자는 글에서 뺀다).
 * 차례: 기록(확신) → 레벨(인정) → 영상(유능감) → 마일리지(이득) → 달력(뿌듯함) → 약속(기대) → 같이(함께) → 몸과 마음(확신) → 마켓(이득)
 */
export function buildReel({ branch, pulse, awardsRules, today }: ReelInput): ValueScene[] {
  const name = pulse?.branch ?? (branch?.trim() || null);
  const short = branchShortOf(name) ?? "우리 지점";
  const big = enough(pulse);
  const features = pulse?.features ?? {
    promise: !!name && FALLBACK_PILOT.includes(name),
    returnBonus: null,
    weather: !!name && FALLBACK_WEATHER.includes(name),
    market: !!name && FALLBACK_PILOT.includes(name),
    marketCount: 0,
  };
  const mileage = pulse?.mileage ?? awardsRules ?? null;
  const mileageOn = !!mileage?.enabled && (mileage.attendance ?? 0) > 0;
  const whiteVisits = pulse?.levels.find((l) => l.rank === "white")?.visits ?? null;

  const scenes: ValueScene[] = [];

  // ① 기록 — 앱이 하는 일 한 문장(이 장면만 봐도 남는 것)
  const hours = pulse ? Math.floor(pulse.minutes / 60) : 0;
  const showHours = big && hours >= PULSE_MIN.hours;
  scenes.push({
    id: "record",
    tag: "기록",
    kicker: "샤워하면 땀은 씻겨 나가요",
    hook: ["오늘 운동은", "어디에 남을까요?"],
    answer: "마이복서153에 저절로 쌓여요",
    proofs: ["출석 · 운동 시간 · 레벨이 한눈에", "몇 번보다 몇 시간을 보여 줘요", "온 날마다 달력에 도장 하나"],
    ease: "따로 적지 않아요 · 출석이 곧 기록이에요",
    visual: {
      kind: "pulse",
      caption: showHours ? `지난 4주 · ${short}` : null,
      hero: showHours ? hoursText(pulse!.minutes) : null,
      heroLabel: showHours ? `회원님 ${pulse!.members.toLocaleString("ko-KR")}명이 쌓은 운동 시간` : null,
      flow: ["출석", "운동 시간", "레벨", ...(mileageOn ? ["마일리지"] : [])],
    },
    qr: { url: url("/mypage/attendance"), caption: ["내 운동 기록", "보기"] },
  });

  // ② 레벨 — '인정' 욕구(성장 기록). 한 레벨 출석 수는 서버 규칙일 때만 숫자로
  scenes.push({
    id: "level",
    tag: "레벨",
    kicker: "복싱에도 레벨이 있어요",
    hook: whiteVisits ? ["레벨 2까지,", "몇 번 오면 될까요?"] : ["오는 만큼", "레벨이 오를까요?"],
    answer: whiteVisits ? `화이트 리그는 ${whiteVisits}번이면 한 레벨` : "출석만으로 한 레벨씩 올라가요",
    proofs: [
      "레벨 10마다 타이틀매치 도전",
      "앱이 남은 횟수를 홈에서 알려 줘요",
      mileageOn ? "레벨이 오를 때마다 마일리지도 쌓여요" : "레벨이 오르면 축하 편지가 와요",
    ],
    ease: "처음이어도 레벨 1부터 · 오는 만큼 올라가요",
    visual: {
      kind: "leagues",
      leagues: LEAGUE_IDS.map((id, i) => ({ id, name: LEAGUE_NAME[id], range: `레벨 ${i * 10 + 1}~${i * 10 + 10}` })),
      chip:
        big && pulse!.levelUps >= PULSE_MIN.levelUps
          ? { label: "지난 4주", value: `레벨업 ${pulse!.levelUps.toLocaleString("ko-KR")}번` }
          : null,
    },
    qr: { url: url("/rank-up"), caption: ["레벨 지도", "보기"] },
  });

  // ③ 영상으로 배우기 — '유능감'. 칸은 코드에 있는 회원 칸 그대로
  scenes.push({
    id: "learn",
    tag: "영상",
    kicker: "수업 때 배운 콤비네이션",
    hook: ["집에 가면", "기억날까요?"],
    answer: "앱에서 영상으로 다시 봐요",
    proofs: ["동작마다 영상 · 그림 · 설명 한 장", "내 레벨 동작부터 먼저 보여 줘요", "15 · 30 · 50분, 내 수업을 자동으로 짜요"],
    ease: "「천천히」 · 반복 재생으로 따라 해요",
    visual: {
      kind: "shelves",
      shelves: MEMBER_SHELVES.map((s) => ({ label: SHELF_INFO[s].label, color: SHELF_INFO[s].color })),
    },
    qr: { url: url("/missions?learn=1"), caption: ["영상으로", "배우기"] },
  });

  // ④ 153 마일리지 — 규칙을 아는(서버 값) · 켜진 때만. '원'으로 말하지 않는다
  if (mileageOn && mileage) {
    const rows: { label: string; plus: string; big: boolean }[] = [];
    const add = (label: string, n: number | null, isBig = false) => {
      if (n != null && n > 0) rows.push({ label, plus: `+${n.toLocaleString("ko-KR")}점`, big: isBig });
    };
    // 출석 · 레벨업이 같은 값이면 한 줄로(TV 칸이 낮은 날에도 사다리가 다 들어가게)
    if (mileage.attendance && mileage.levelUp && mileage.attendance === mileage.levelUp) {
      add("출석 · 레벨업", mileage.attendance);
    } else {
      add("출석", mileage.attendance);
      add("레벨업", mileage.levelUp);
    }
    add("타이틀매치", mileage.titleMatch);
    add("153 레코드", mileage.record, true);
    scenes.push({
      id: "mileage",
      tag: "마일리지",
      kicker: "운동하러 왔을 뿐인데",
      hook: ["결제할 때", "할인이 된다면?"],
      answer: "출석이 153 마일리지가 돼요",
      proofs: [
        "오는 날마다 · 레벨이 오를 때마다",
        mileage.titleMatch || mileage.record ? "153 레코드 · 타이틀매치는 더 크게" : "오래 다닐수록 차곡차곡",
        "모은 마일리지는 결제 때 할인으로",
      ],
      ease: "따로 신청하지 않아요 · 출석하면 저절로",
      visual: {
        kind: "ladder",
        rows,
        chip:
          big && pulse!.points >= PULSE_MIN.points
            ? { label: "지난 4주 회원님들에게", value: `${formatPoints(pulse!.points)} 쌓였어요` }
            : null,
      },
      qr: { url: url("/mypage?focus=mileage"), caption: ["내 마일리지", "보기"] },
    });
  }

  // ⑤ 운동 달력 — '뿌듯함'. 날씨 도장이 없는 지점은 다른 훅으로
  scenes.push({
    id: "calendar",
    tag: "달력",
    kicker: features.weather ? "비 오는 날 퇴근길에도 왔다면" : "바쁜 한 주에도 시간을 냈다면",
    hook: ["그날, 누가", "기억해 줄까요?"],
    answer: features.weather ? "달력에 우산 도장이 찍혀요" : "달력에 도장이 남아요",
    proofs: [
      "온 날은 도장 · 다 채운 날은 금색 별",
      features.weather ? "눈 · 폭염 · 한파 날도 날씨 도장" : "153 기념일은 금색 도장으로",
      features.promise ? "코치님 한마디도 그날 칸에 남아요" : "그날 쓴 한 줄 · 사진도 함께",
    ],
    ease: "빠진 날은 표시하지 않아요",
    visual: { kind: "calendar", weather: features.weather, coach: features.promise, promise: features.promise },
    qr: { url: url(`/home?cal=${today}`), caption: ["내 운동 달력", "보기"] },
  });

  // ⑥ 운동 약속 — 켠 지점만(선릉역점 시범). 다시 시작 보너스는 서버 숫자일 때만
  if (features.promise) {
    scenes.push({
      id: "promise",
      tag: "약속",
      kicker: "작심삼일이 걱정된다면",
      hook: ["주 2번,", "어떻게 지킬까요?"],
      answer: "요일만 정하면 앱이 챙겨요",
      proofs: [
        "약속한 날엔 알림이 한 번 와요",
        "온 날은 달력 도장으로 채워져요",
        features.returnBonus
          ? `쉬었다 오면 보너스 ${features.returnBonus.toLocaleString("ko-KR")}점 · 한 달 한 번`
          : "휴대폰 캘린더에도 넣을 수 있어요",
      ],
      ease: "약속은 언제든 바꾸거나 멈출 수 있어요",
      visual: {
        kind: "promise",
        days: ["월", "화", "수", "목", "금", "토", "일"],
        picked: [1, 3],
        done: [1],
        notice: "오늘은 운동 약속한 날이에요",
      },
      qr: { url: url(`/home?cal=${today}`), caption: ["운동 약속", "걸기"] },
    });
  }

  // ⑦ 같이 해요 — 혼자 오기 싫은 날의 동료(같은 지점끼리만 보인다)
  scenes.push({
    id: "together",
    tag: "같이",
    kicker: "혼자 오기 싫은 날",
    hook: ["같이 칠 사람,", "어디 있을까요?"],
    answer: "「오늘 같이 해요」에 올려요",
    proofs: ["시간을 올리면 동료가 「저요!」", "같이 운동한 날은 서로 153", "응원 한마디 · 스티커도 보내요"],
    ease: "우리 지점 동료끼리만 보여요",
    visual: {
      kind: "together",
      title: "오늘 같이 해요",
      call: "저녁 · 미트 같이 해요",
      joined: "저요! 3명",
    },
    qr: { url: url("/myboxer/community?together=1"), caption: ["오늘 같이", "해요"] },
  });

  // ⑧ 몸과 마음 — '확신'(재등록 순간). 예시 숫자는 예시라고 쓴다
  scenes.push({
    id: "bodymind",
    tag: "몸과 마음",
    kicker: "153 다닌 지 한 달",
    hook: ["나는 뭐가", "달라졌을까요?"],
    answer: "몸과 마음을 숫자로 비교해요",
    proofs: ["몸: 같은 나이 국민체력100 기준", "마음: 세계 연구에서 쓰는 검사 셋", "오른 것만 크게 보여 줘요"],
    ease: "마음 체크 답은 나만 봐요",
    visual: {
      kind: "bodymind",
      cards: [
        { tag: "몸", label: "체력 나이", value: "실제보다 4살 젊어요" },
        { tag: "마음", label: "자신감", value: "4주 전보다 +12점" },
      ],
      source: `국민체력100 · ${manText(NFA_NORM_TOTAL)}명 기준`,
    },
    qr: { url: url("/mypage/attendance?mind=1"), caption: ["몸과 마음", "비교하기"] },
  });

  // ⑨ 153 마켓 — 켠 지점 · 상품이 있을 때만. 가격 비교는 앱이 상품마다 확인한 날과 같이 보여 준다(TV 는 예시)
  if (features.market) {
    const n = pulse?.features.marketCount ?? 0;
    scenes.push({
      id: "market",
      tag: "마켓",
      kicker: "새 글러브 · 붕대가 필요하다면",
      hook: ["인터넷 최저가,", "직접 찾아보셨어요?"],
      answer: "153 마켓에 비교한 값이 있어요",
      proofs: ["가격마다 최저가 · 공식몰과 비교", "앱에서 주문하고 데스크에서 결제", "도착하면 알림 · 체육관에서 받아요"],
      ease: "결제 전에는 언제든 취소할 수 있어요",
      visual: {
        kind: "market",
        count: n >= PULSE_MIN.products ? `용품 ${n.toLocaleString("ko-KR")}가지` : null,
        rows: [
          { label: "글러브", save: "최저가보다 4,800원 저렴" },
          { label: "핸드랩", save: "최저가보다 1,300원 저렴" },
        ],
      },
      qr: { url: url("/market"), caption: ["153 마켓", "보기"] },
    });
  }

  return scenes;
}

/** 지금 보여 줄 장면 번호 — 1분마다(시계 기준). pace = 몇 분에 한 장면씩 넘길지(「체육관 공지사항」 탭과 번갈아 돌면 2 — lib/gymNotices.ts) */
export const sceneIndexAt = (nowMs: number, total: number, pace = 1): number =>
  total > 0 ? Math.floor(Math.floor(Math.max(0, nowMs) / SCENE_MS) / Math.max(1, Math.round(pace))) % total : 0;

/** 지금 장면이 시작한 지 몇 ms */
export const sceneOffsetAt = (nowMs: number): number => Math.max(0, nowMs) % SCENE_MS;

/** 서명 — 153 브랜드 기준 그대로 */
export const REEL_SIGN = CARD_SIGN;

/** 수상자 축하 한 줄 (같은 날 대표님 「현재 시상식 있잖아 그건 한줄로 작게」) — 왕좌 · 1위 이름 · 1위 혜택 */
export interface AwardsStrip {
  label: string;
  winners: { throne: string; name: string }[];
  /** 혜택 글 — 긴 것부터, 칸에 들어가는 첫 글을 쓴다(하나도 안 들어가면 뺀다) */
  prizes: string[];
}

export function awardsStripOf(view: AwardsView | null | undefined): AwardsStrip | null {
  if (!view || !view.cards.length) return null;
  const allPaid = view.cards.every((c) => c.paid);
  return {
    label: "런칭 이벤트 1위",
    winners: view.cards.map((c) => ({ throne: c.throne, name: c.name })),
    // 긴 글(「1위께 153 마일리지 50,000점 · 받았어요」) → 짧은 글(「마일리지 50,000점 받았어요」)
    prizes: [
      `${view.prizeLine}${allPaid ? " · 받았어요" : ""}`,
      `마일리지 ${LAUNCH_EVENT_PRIZE.amount}점${allPaid ? " 받았어요" : ""}`,
    ],
  };
}
