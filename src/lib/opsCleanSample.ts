/**
 * 153운영본부 「오늘 청소」 — 선릉역점 청소 항목(보고서 4판 그대로)과 예시 화면 자료
 *   · CLEAN_SEED_SLOTS · CLEAN_SEED_ITEMS = 마이그레이션 20261116211742_ops_clean_stage1.sql 의 첫 자료와 같은 글
 *     (시험 opsClean.test.ts 가 한 줄씩 견준다 — 여기를 고치면 마이그레이션 글도 같이)
 *   · buildCleanSample = 예시 화면(/office?cleandemo=coach · manager) — 서버를 부르지 않고 이 기기 안에서만 바뀐다. 이름은 지어낸 것.
 *   분은 모두 「목표 분」: 오픈 매일 30분 + 요일 미션(월 10 · 화 12 · 수 18 · 목 20 · 금 17) = 40 · 42 · 48 · 47 · 47분, 11:50 까지.
 */
import {
  cleanDue,
  kstMs,
  slotCounts,
  withItemState,
  type CleanDay,
  type CleanHandover,
  type CleanItem,
  type CleanRule,
  type CleanSlot,
  type CleanState,
} from "./opsClean";

export interface CleanSeedSlot {
  slot: string;
  label: string;
  time: string;
  budget: number;
  days: readonly number[];
  sort: number;
}

export interface CleanSeedItem extends CleanRule {
  slot: string;
  code: string;
  zone: string;
  title: string;
  min: number;
  done: string | null;
  how: string | null;
  caution: string | null;
  mission: boolean;
  sort: number;
}

export const CLEAN_SEED_BRANCH = "153복싱짐 선릉역점";

const WEEKDAYS = [1, 2, 3, 4, 5] as const;

export const CLEAN_SEED_SLOTS: readonly CleanSeedSlot[] = [
  { slot: "open", label: "오픈", time: "11:00", budget: 50, days: WEEKDAYS, sort: 1 },
  { slot: "evening", label: "저녁", time: "19:50", budget: 10, days: WEEKDAYS, sort: 2 },
  { slot: "close", label: "마감", time: "22:50", budget: 10, days: WEEKDAYS, sort: 3 },
];

const it = (
  slot: string,
  code: string,
  zone: string,
  title: string,
  min: number,
  sort: number,
  text: { done?: string; how?: string; caution?: string } = {},
  rule: CleanRule & { mission?: boolean } = {},
): CleanSeedItem => ({
  slot,
  code,
  zone,
  title,
  min,
  sort,
  done: text.done ?? null,
  how: text.how ?? null,
  caution: text.caution ?? null,
  mission: rule.mission === true,
  days: rule.days ?? null,
  nth: rule.nth ?? null,
  nthDow: rule.nthDow ?? null,
  off: rule.off ?? 0,
  months: rule.months ?? null,
});

const LOCKER_HOW = "바닥 머리카락 → 화장대·드라이기 주변 → 벤치·분실물 → 휴지통·면봉통 → 거울 물자국";
const SHOWER_HOW = "배수구 거름망 → 바닥 헹구기 → 샴푸·바디워시 확인 → 물기 밀기";
const TOILET_HOW = "변기 솔질·시트 → 세면대·수전 → 휴지통 → 휴지·핸드타월·비누 → 바닥 얼룩";
const LOCKER_DONE = "바닥과 화장대에 머리카락 없음";
const SHOWER_DONE = "거름망 머리카락 없음, 샴푸·바디워시 3분의 1 이상";
const TOILET_DONE = "변기·세면대 얼룩 없음, 휴지 여분 1개 이상";
const TOILET_CAUTION = "빨강 걸레(화장실 전용)만 써요";
const FILTER_HOW = "전원 끄기 → 필터 분리 → 청소기로 먼지 → 다시 끼우기";
const FILTER_DONE = "빛에 비춰 막힌 곳 없음";
const FILTER_CAUTION = "물로 씻으면 완전히 말린 뒤 끼워요";
const BAG_CAUTION = "락스·진한 알코올 금지";

export const CLEAN_SEED_ITEMS: readonly CleanSeedItem[] = [
  // ── 오픈 11:00 (11:50 까지) ──
  it("open", "start", "start", "창문 열기 · 바닥 물건 치우기 · 로봇청소기 켜기", 2, 10,
    { done: "바닥에 줄넘기·붕대·물병 없음", how: "창문 열기 → 바닥 물건 치우기 → 로봇청소기 시작" },
    { days: [1, 2, 3, 5] }),
  it("open", "start_thu", "start", "창문 열기 · 바닥 물건 치우기", 2, 10,
    { done: "바닥에 줄넘기·붕대·물병 없음", how: "로봇청소기는 어젯밤 마감 때 돌았어요. 오늘은 켜지 않고 바로 물걸레로 가요." },
    { days: [4] }),
  // 요일 미션 — 먼지를 먼저 떨어야 로봇청소기가 빨아들인다
  it("open", "m_mon_dust", "mission", "걸레받이 · 창가 먼지", 8, 20,
    { done: "손가락으로 훑어 먼지가 안 묻음", how: "긴 먼지떨이로 한 바퀴, 창틀은 젖은 걸레", caution: "높은 곳은 발판 사용" },
    { mission: true, days: [1] }),
  it("open", "m_mon_ring", "mission", "링 줄 · 코너 패드 닦기", 2, 21,
    { done: "링 줄·코너 패드에 땀 자국 없음", how: "초록 걸레로 링 줄 → 코너 패드" },
    { mission: true, days: [1] }),
  it("open", "m_tue_mirror", "mission", "인피니티 미러 · 내부 거울 · 출입문 유리", 12, 20,
    { done: "조명 켜고 봐도 손자국·줄 없음", how: "극세사 걸레로 위에서 아래로", caution: "인피니티 미러 세정제는 제조사 권장 확인" },
    { mission: true, days: [2] }),
  it("open", "m_tue_filter", "mission", "에어컨 필터 먼지 제거 (절반)", 8, 22,
    { done: FILTER_DONE, how: `${FILTER_HOW}. 나머지 절반은 내일 해요.`, caution: FILTER_CAUTION },
    { mission: true, days: [2], nth: 1, nthDow: 3, off: -1 }),
  it("open", "m_wed_bag", "mission", "샌드백 윗부분 먼지", 8, 20,
    { done: "윗부분 먼지 없음", how: "발판에 올라 윗부분 먼지 닦기 (치는 면은 금요일)", caution: BAG_CAUTION },
    { mission: true, days: [3] }),
  it("open", "m_wed_filter", "mission", "에어컨 필터 먼지 제거 (나머지)", 10, 23,
    { done: FILTER_DONE, how: FILTER_HOW, caution: FILTER_CAUTION },
    { mission: true, days: [3], nth: 1, nthDow: 3 }),
  it("open", "m_wed_drain", "mission", "샤워실 배수구 뚜껑 열고 이물질 제거", 10, 23,
    { done: "물 한 바가지가 바로 빠짐", how: "뚜껑 열기 → 머리카락·이물질 → 솔질. 줄눈·실리콘 곰팡이도 같이 봐요.", caution: "장갑 착용" },
    { mission: true, days: [3], nth: 2, nthDow: 3 }),
  it("open", "m_wed_tape", "mission", "바닥 기본기 가이드 테이프 보수", 10, 23,
    { done: "발에 걸리는 모서리 없음", how: "들뜬 곳·끊긴 곳 교체", caution: "같은 색·폭 테이프로" },
    { mission: true, days: [3], nth: 3, nthDow: 3 }),
  it("open", "m_wed_robot", "mission", "로봇청소기 정비 · 소모품 재고 세기", 10, 23,
    { done: "브러시에 감긴 것 없음, 모자란 소모품은 '문제'로 알림", how: "브러시·필터 청소 → 세제·휴지·핸드타월·테이프 재고 세기" },
    { mission: true, days: [3], nth: 4, nthDow: 3 }),
  it("open", "m_wed_quarter", "mission", "분기 미션: 환풍기 그릴 · 락커 위 · 드라이기 흡입구 · 천장 모서리", 10, 23,
    { done: "먼지 덩어리 없음", how: "위에서 아래로 한 곳씩", caution: "높은 곳은 발판 사용" },
    { mission: true, days: [3], nth: 5, nthDow: 3 }),
  it("open", "m_thu_mop", "mission", "바닥 물걸레 (입구 포함)", 20, 20,
    { done: "10분 뒤 마름, 발자국 없음", how: "꼭 짠 밀대로 안쪽에서 입구로", caution: "수업 20분 전까지 끝내요" },
    { mission: true, days: [4] }),
  it("open", "m_fri_gear", "mission", "운동 기구 · 소도구 · 선반 먼지", 10, 20,
    { done: "손잡이 끈적임 없음", how: "손잡이 위주, 선반은 위 칸부터", caution: "전자 패널은 마른 걸레" },
    { mission: true, days: [5] }),
  it("open", "m_fri_bag", "mission", "샌드백 치는 면 땀 닦기", 5, 21,
    { done: "치는 면 끈적임 없음", how: "치는 면을 위에서 아래로 닦기", caution: BAG_CAUTION },
    { mission: true, days: [5] }),
  it("open", "m_fri_glove", "mission", "대여 글러브 안쪽 닦기", 2, 22,
    { done: "안쪽이 축축하지 않음", how: "안쪽을 닦고 벌려서 말리기" },
    { mission: true, days: [5] }),
  // 여자 구역 → 남자 구역 (각 7분) — 여자 구역은 11:30 전에
  it("open", "women_locker", "women", "여자 탈의실", 2, 31, { done: LOCKER_DONE, how: LOCKER_HOW }),
  it("open", "women_shower", "women", "여자 샤워실", 2, 32, { done: SHOWER_DONE, how: SHOWER_HOW }),
  it("open", "women_toilet", "women", "여자 화장실", 3, 33, { done: TOILET_DONE, how: TOILET_HOW, caution: TOILET_CAUTION }),
  it("open", "men_locker", "men", "남자 탈의실", 2, 41, { done: LOCKER_DONE, how: LOCKER_HOW }),
  it("open", "men_shower", "men", "남자 샤워실", 2, 42, { done: SHOWER_DONE, how: SHOWER_HOW }),
  it("open", "men_toilet", "men", "남자 화장실", 3, 43, { done: TOILET_DONE, how: TOILET_HOW, caution: TOILET_CAUTION }),
  it("open", "ring", "ring", "링 땀 자국 닦기", 4, 50,
    { done: "땀 자국 없음, 밟아도 미끄럽지 않음", how: "물 뿌리기 → 링 전용 밀대 → 마른 패드", caution: "초록 걸레(링 전용)만 써요" }),
  it("open", "entry", "entry", "입구 신발 벗는 곳", 3, 60,
    { done: "모래·먼지 없음", how: "쓸기 → 닦기 → 매트 털기 → 신발장 앞 정리" },
    { days: [1, 2, 3, 5] }),
  it("open", "hall_bins", "hall", "휴지통 · 빨래통 비우기", 2, 71,
    { done: "휴지통·빨래통이 비어 있음", how: "휴지통 봉투 교체 → 빨래통 비우기" }),
  it("open", "hall_tidy", "hall", "정리정돈 · 데스크 · 정수기 · 손잡이", 2, 72,
    { done: "바닥에 장비 없음, 데스크 먼지 없음", how: "글러브·소도구 제자리 → 데스크·정수기·손잡이 닦기", caution: "파랑 걸레(거울·데스크 전용)만 써요" }),
  it("open", "finish", "finish", "로봇 먼지통 · 걸레 널기 · 도구 제자리", 3, 80,
    { done: "젖은 걸레가 뭉쳐 있지 않음", how: "로봇 먼지통 → 걸레 빨아 널기 → 도구 제자리 → 냄새 확인" }),
  // ── 저녁 19:50 (20:00 까지) ──
  it("evening", "laundry", "laundry", "빨래통 비우기 · 빨래 주머니 내놓기", 4, 10,
    { done: "빨래통이 비어 있고 새 주머니가 걸려 있음", how: "빨래통 비우기 → 꽉 찬 빨래 주머니 밖에 내놓기 → 새 주머니 걸기" }),
  it("evening", "bins", "hall", "넘친 휴지통 봉투 교체 · 종이컵 보충", 1, 20,
    { done: "넘친 휴지통 없음, 종이컵 채워짐" }),
  // ── 마감 22:50 (23:00 까지) ──
  it("close", "tidy", "hall", "홀 정리정돈 · 대여 글러브 벌려서 말리기", 3, 10,
    { done: "바닥에 장비 없음, 글러브는 벌려 둠" }),
  it("close", "bins", "hall", "홀 휴지통 · 종이컵 정리 · 정수기 물받이", 2, 11,
    { done: "휴지통 비움, 물받이에 물 없음" }),
  it("close", "laundry", "laundry", "빨래통 비우기 · 세탁 끝난 운동복 정리", 3, 20,
    { done: "빨래통이 비어 있음, 운동복은 제자리" }),
  it("close", "men_tidy", "men", "남자 탈의실 눈에 보이는 것 정리", 1, 30,
    { done: "바닥·벤치에 물건 없음" }),
  it("close", "lock", "lock", "문단속: 창문 · 전원 · 에어컨·난방", 1, 40,
    { done: "창문 닫힘, 전원·에어컨·난방 꺼짐" }),
  it("close", "robot_wed", "lock", "퇴근 직전 로봇청소기 켜기", 0, 41,
    { done: "로봇청소기가 돌기 시작함", how: "목요일 아침 물걸레 준비예요. 바닥 물건을 치우고 켜요." },
    { days: [3] }),
];

// ── 마이그레이션 첫 자료 글 (만들 때 · 시험이 견줄 때만 쓴다) ──

const q = (v: string | null): string => (v == null ? "null" : `'${v.replace(/'/g, "''")}'`);
const set = (v: readonly number[] | null | undefined): string => (v ? `'{${v.join(",")}}'` : "null");
const n = (v: number | null | undefined): string => (v == null ? "null" : String(v));

/** insert … values 의 시간대 줄 */
export const cleanSeedSlotRows = (): string[] =>
  CLEAN_SEED_SLOTS.map((s) => `(${q(s.slot)}, ${q(s.label)}, ${q(s.time)}, ${s.budget}, ${set(s.days)}, ${s.sort})`);

/** insert … values 의 항목 줄 */
export const cleanSeedItemRows = (): string[] =>
  CLEAN_SEED_ITEMS.map(
    (i) =>
      `(${q(i.slot)}, ${q(i.code)}, ${q(i.zone)}, ${q(i.title)}, ${i.min}, ${q(i.done)}, ${q(i.how)}, ${q(i.caution)}, ${i.mission}, ${set(i.days)}, ${n(i.nth)}, ${n(i.nthDow)}, ${i.off ?? 0}, ${set(i.months)}, ${i.sort})`,
  );

/** 그날 그 시간대에 하는 항목 (동선 순서) */
export const seedItemsOn = (date: string, slot: CleanSeedSlot): CleanSeedItem[] =>
  CLEAN_SEED_ITEMS.filter((i) => i.slot === slot.slot && cleanDue(date, slot.days, i)).sort((a, b) => a.sort - b.sort);

// ── 예시 화면 ────────────────────────────────────────────────

const shift = (date: string, days: number): string => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};
const dowOf = (date: string): number => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

/** 예시는 늘 평일로 — 주말이면 다음 월요일 */
export const sampleDate = (today: string): string => {
  const dow = dowOf(today);
  return dow === 6 ? shift(today, 2) : dow === 0 ? shift(today, 1) : today;
};

const toItem = (s: CleanSeedItem): CleanItem => ({
  id: `demo-${s.slot}-${s.code}`,
  zone: s.zone,
  title: s.title,
  min: s.min,
  doneText: s.done,
  how: s.how,
  caution: s.caution,
  mission: s.mission,
  monthly: s.nth != null,
  state: null,
  note: null,
  at: null,
  byName: null,
});

const mark = (items: CleanItem[], state: (i: CleanItem, idx: number) => { state: CleanState; note?: string } | null, by: string, at: string): CleanItem[] =>
  items.map((i, idx) => {
    const s = state(i, idx);
    return s ? { ...i, state: s.state, note: s.note ?? null, byName: by, at } : i;
  });

export type CleanDemoWho = "coach" | "manager";

/** 예시의 '지난 근무일 마감'이 남긴 것 (늘 같은 글) */
const lastNightLines = (date: string): CleanHandover[] => {
  const prev = shift(date, dowOf(date) === 1 ? -3 : -1);
  const base = { date: prev, slot: "close", label: "마감", time: "22:50" };
  return [
    { ...base, kind: "sum", title: null, text: null, byName: null, done: 4, due: 5, finished: true },
    { ...base, kind: "note", title: null, text: "여자 샤워실 샴푸가 거의 떨어졌어요", byName: "예시 코치 C", done: 0, due: 0, finished: false },
    { ...base, kind: "hold", title: "남자 탈의실 눈에 보이는 것 정리", text: "회원 사용 중", byName: "예시 코치 C", done: 0, due: 0, finished: false },
  ];
};

/**
 * 인수인계 다시 만들기 — 서버 _ops_clean_handover 와 같은 뜻:
 *   오늘 앞 시간대가 남긴 것(늦은 시간대부터 · 요약 → 한마디 → 문제 → 보류) + 지난 근무일 것
 */
const withHandover = (day: CleanDay): CleanDay => ({
  ...day,
  slots: day.slots.map((s) => {
    const earlier = day.slots
      .filter((o) => o.time < s.time && (!!o.run || o.items.some((i) => i.state)))
      .sort((a, b) => (a.time < b.time ? 1 : -1));
    const lines: CleanHandover[] = [];
    for (const o of earlier) {
      const c = slotCounts(o);
      const base = { date: day.date, slot: o.slot, label: o.label, time: o.time };
      lines.push({ ...base, kind: "sum", title: null, text: null, byName: null, done: c.done, due: c.total, finished: !!o.run?.finishedAt });
      if (o.run?.note) lines.push({ ...base, kind: "note", title: null, text: o.run.note, byName: o.run.finishedByName, done: 0, due: 0, finished: false });
      for (const k of ["issue", "hold"] as const) {
        for (const i of o.items) {
          if (i.state === k) lines.push({ ...base, kind: k, title: i.title, text: i.note, byName: i.byName, done: 0, due: 0, finished: false });
        }
      }
    }
    return { ...s, handover: [...lines, ...lastNightLines(day.date)].slice(0, 12) };
  }),
});

/**
 * 예시 하루 — coach: 세 시간대 모두 내 차례(아직 시작 전) · manager: 오픈 끝 · 저녁 하는 중 · 마감 시작 전
 */
export const buildCleanSample = (today: string, who: CleanDemoWho): CleanDay => {
  const date = sampleDate(today);
  const iso = (hm: string): string => new Date(kstMs(date, hm)).toISOString();
  const slots: CleanSlot[] = CLEAN_SEED_SLOTS.map((s) => {
    let items = seedItemsOn(date, s).map(toItem);
    let run: CleanSlot["run"] = null;
    if (who === "manager") {
      if (s.slot === "open") {
        items = mark(items, (i) => (i.id === "demo-open-women_shower" ? { state: "hold", note: "회원 사용 중" } : { state: "done" }), "예시 코치 A", iso("11:40"));
        run = { startedAt: iso("11:01"), finishedAt: iso("11:48"), note: "여자 샤워실은 회원이 계셔서 보류했어요", finishedByName: "예시 코치 A" };
      } else if (s.slot === "evening") {
        items = mark(items, (_, idx) => (idx === 0 ? { state: "done" } : null), "예시 코치 B", iso("19:53"));
        run = { startedAt: iso("19:51"), finishedAt: null, note: null, finishedByName: null };
      }
    }
    return {
      slot: s.slot,
      label: s.label,
      time: s.time,
      budget: s.budget,
      mine: who === "coach",
      people: who === "manager" ? [s.slot === "open" ? "예시 코치 A" : s.slot === "evening" ? "예시 코치 B" : "예시 코치 C"] : [],
      run,
      items,
      handover: [],
    };
  });
  return withHandover({
    available: true,
    on: true,
    branch: "예시 지점",
    branches: [{ branch: "예시 지점", manage: who === "manager", mine: who === "coach" }],
    manage: who === "manager",
    me: "demo",
    date,
    today: date,
    closed: false,
    days: [...WEEKDAYS],
    slots,
  });
};

export type CleanDemoAction =
  | { type: "check"; itemId: string; state: CleanState | null; note: string | null }
  | { type: "start"; slot: string }
  | { type: "finish"; slot: string; note: string | null };

/** 예시 화면에서 누른 것 — 서버와 같은 규칙으로 이 기기 안에서만 */
export const applyCleanDemo = (day: CleanDay, a: CleanDemoAction, nowIso: string): CleanDay => {
  if (a.type === "check") return withHandover(withItemState(day, a.itemId, a.state, a.note, "나", nowIso));
  return withHandover({
    ...day,
    slots: day.slots.map((s) => {
      if (s.slot !== a.slot) return s;
      const base = s.run ?? { startedAt: null, finishedAt: null, note: null, finishedByName: null };
      if (a.type === "start") return { ...s, run: { ...base, startedAt: base.startedAt ?? nowIso } };
      return {
        ...s,
        run: {
          startedAt: base.startedAt ?? nowIso,
          finishedAt: base.finishedAt ?? nowIso,
          note: a.note,
          finishedByName: base.finishedByName ?? "나",
        },
      };
    }),
  });
};
