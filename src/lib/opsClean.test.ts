import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  CLEAN_NOTE_MAX,
  CLEAN_OFF,
  CLEAN_ZONES,
  cleanDayLabel,
  cleanDue,
  cleanHm,
  cleanNoteError,
  cleanSections,
  cleanTimer,
  elapsedMinutes,
  finishBlock,
  finishLine,
  handoverView,
  handoverWhen,
  kstMs,
  missionHeading,
  myOpenSlots,
  normalizeCleanDay,
  pickSlot,
  shiftCleanDay,
  slotCounts,
  stepCleanDay,
  slotEndLabel,
  slotStatus,
  slotStatusText,
  slotSubLine,
  withItemState,
  zoneGroups,
  type CleanDay,
  type CleanItem,
  type CleanSlot,
} from "./opsClean";
import {
  CLEAN_SEED_BRANCH,
  CLEAN_SEED_ITEMS,
  CLEAN_SEED_SLOTS,
  applyCleanDemo,
  buildCleanSample,
  cleanSeedItemRows,
  cleanSeedSlotRows,
  sampleDate,
  seedItemsOn,
} from "./opsCleanSample";

const SQL = readFileSync("supabase/migrations/20261116211742_ops_clean_stage1.sql", "utf8");

// 2026-11-16(월) ~ 11-20(금) · 11-21(토) · 11-22(일)
const MON = "2026-11-16";
const TUE = "2026-11-17";
const WED = "2026-11-18";
const THU = "2026-11-19";
const FRI = "2026-11-20";
const OPEN = CLEAN_SEED_SLOTS[0];
const EVENING = CLEAN_SEED_SLOTS[1];
const CLOSE = CLEAN_SEED_SLOTS[2];
const minutes = (date: string, slot = OPEN) => seedItemsOn(date, slot).reduce((n, i) => n + i.min, 0);
const codes = (date: string, slot = OPEN) => seedItemsOn(date, slot).map((i) => i.code);

const item = (id: string, over: Partial<CleanItem> = {}): CleanItem => ({
  id,
  zone: "hall",
  title: `항목 ${id}`,
  min: 2,
  doneText: null,
  how: null,
  caution: null,
  mission: false,
  monthly: false,
  state: null,
  note: null,
  at: null,
  byName: null,
  ...over,
});
const slotOf = (over: Partial<CleanSlot> = {}): CleanSlot => ({
  slot: "open",
  label: "오픈",
  time: "11:00",
  budget: 50,
  mine: true,
  people: [],
  run: null,
  items: [item("a"), item("b"), item("c")],
  handover: [],
  ...over,
});
const dayOf = (slots: CleanSlot[], over: Partial<CleanDay> = {}): CleanDay => ({
  available: true,
  on: true,
  branch: "예시 지점",
  branches: [{ branch: "예시 지점", manage: false, mine: true }],
  manage: false,
  me: "me",
  date: MON,
  today: MON,
  closed: false,
  days: [1, 2, 3, 4, 5],
  slots,
  ...over,
});

describe("서버 값 읽기", () => {
  it("모양이 다르면 꺼진 것으로 — 함수는 있다고 본다", () => {
    expect(normalizeCleanDay(null)).toEqual({ ...CLEAN_OFF, available: true });
    expect(normalizeCleanDay({ on: false })).toEqual({ ...CLEAN_OFF, available: true });
    expect(normalizeCleanDay({ on: true, date: "어제", today: MON }).on).toBe(false);
    expect(CLEAN_OFF.available).toBe(false);
  });

  it("시간대 · 항목 · 인수인계를 다듬는다 — 이름 없는 항목 · 시각이 틀린 시간대 · 모르는 상태는 버린다", () => {
    const d = normalizeCleanDay({
      on: true,
      branch: "예시 지점",
      branches: [{ branch: "예시 지점", manage: true, mine: false }, { branch: "" }],
      manage: true,
      me: "u1",
      date: MON,
      today: TUE,
      closed: false,
      days: [1, 2, 3, 4, 5, 9, "월"],
      slots: [
        {
          slot: "open",
          label: "오픈",
          time: "11:00",
          budget: 50,
          mine: false,
          people: ["예시 코치 A", "", 3],
          run: { started_at: "2026-11-16T02:01:00Z", finished_at: null, note: " ", finished_by_name: null },
          items: [
            { id: "i1", zone: "women", title: "여자 탈의실", min: 2, done_text: "머리카락 없음", how: null, caution: null, mission: false, monthly: false, state: "hold", note: "회원 사용 중", at: "2026-11-16T02:10:00Z", by_name: "예시 코치 A" },
            { id: "i2", title: "  " },
            { id: "i3", zone: "", title: "상태 모름", min: -3, state: "skip" },
          ],
          handover: [
            { kind: "sum", date: "2026-11-13", slot: "close", label: "마감", time: "22:50", done: 4, due: 5, finished: true },
            { kind: "말", date: "2026-11-13" },
            { kind: "hold", date: "날짜 아님" },
          ],
        },
        { slot: "x", time: "11시" },
        { slot: "", time: "12:00" },
      ],
    });
    expect(d.on).toBe(true);
    expect(d.manage).toBe(true);
    expect(d.days).toEqual([1, 2, 3, 4, 5]);
    expect(d.branches).toEqual([{ branch: "예시 지점", manage: true, mine: false }]);
    expect(d.slots).toHaveLength(1);
    const s = d.slots[0];
    expect(s.people).toEqual(["예시 코치 A"]);
    expect(s.run).toEqual({ startedAt: "2026-11-16T02:01:00Z", finishedAt: null, note: null, finishedByName: null });
    expect(s.items.map((i) => i.id)).toEqual(["i1", "i3"]);
    expect(s.items[0]).toMatchObject({ zone: "women", state: "hold", note: "회원 사용 중", byName: "예시 코치 A", doneText: "머리카락 없음" });
    expect(s.items[1]).toMatchObject({ zone: "hall", min: 0, state: null });
    expect(s.handover).toHaveLength(1);
    expect(s.handover[0]).toMatchObject({ kind: "sum", done: 4, due: 5, finished: true });
  });
});

describe("날짜 규칙 — DB _ops_clean_due 와 같은 식", () => {
  const days = [1, 2, 3, 4, 5];
  it("시간대가 도는 요일 · 항목 요일", () => {
    expect(cleanDue(MON, days, {})).toBe(true);
    expect(cleanDue("2026-11-21", days, {})).toBe(false);
    expect(cleanDue("2026-11-22", days, {})).toBe(false);
    expect(cleanDue(TUE, days, { days: [2] })).toBe(true);
    expect(cleanDue(WED, days, { days: [2] })).toBe(false);
    expect(cleanDue("어제", days, {})).toBe(false);
  });

  it("그 달 n번째 요일 — 첫째 · 셋째 · 다섯째 수요일", () => {
    const nth = (n: number) => ({ days: [3], nth: n, nthDow: 3 });
    expect(cleanDue("2026-11-04", days, nth(1))).toBe(true);
    expect(cleanDue("2026-11-11", days, nth(1))).toBe(false);
    expect(cleanDue("2026-11-18", days, nth(3))).toBe(true);
    expect(cleanDue("2026-11-25", days, nth(4))).toBe(true);
    expect(cleanDue("2026-11-25", days, nth(5))).toBe(false);
    expect(cleanDue("2026-12-30", days, nth(5))).toBe(true);
  });

  it("n번째 그 요일의 전날 — 첫째 수요일 전날 화요일(달이 바뀌어도)", () => {
    const eve = { days: [2], nth: 1, nthDow: 3, off: -1 };
    expect(cleanDue("2026-11-03", days, eve)).toBe(true);
    expect(cleanDue("2026-11-10", days, eve)).toBe(false);
    expect(cleanDue("2026-12-01", days, eve)).toBe(true);
    // 2027-09-01 이 수요일 — 그 전날은 8월 31일 화요일
    expect(cleanDue("2027-08-31", days, eve)).toBe(true);
    expect(cleanDue("2027-09-07", days, eve)).toBe(false);
  });

  it("하는 달", () => {
    expect(cleanDue(MON, days, { months: [11] })).toBe(true);
    expect(cleanDue(MON, days, { months: [3, 6, 9, 12] })).toBe(false);
  });
});

describe("선릉역점 첫 자료 — 보고서 4판", () => {
  it("오픈은 11:50 안에 — 월 40 · 화 42 · 수 48 · 목 47 · 금 47분", () => {
    expect([MON, TUE, WED, THU, FRI].map((d) => minutes(d))).toEqual([40, 42, 48, 47, 47]);
    expect([MON, TUE, WED, THU, FRI].map((d) => seedItemsOn(d, OPEN).length)).toEqual([14, 13, 14, 12, 15]);
    for (const d of [MON, TUE, WED, THU, FRI]) expect(minutes(d)).toBeLessThanOrEqual(OPEN.budget);
  });

  it("월 1회 미션이 낀 날도 50분 안 — 필터 전날 화요일 50분 · 수요일은 늘 48분", () => {
    expect(minutes("2026-11-03")).toBe(50);
    for (const d of ["2026-11-04", "2026-11-11", "2026-11-18", "2026-11-25", "2026-12-30"]) expect(minutes(d)).toBe(48);
    // 수요일마다 월 1회 미션은 하나만
    for (const d of ["2026-11-04", "2026-11-11", "2026-11-18", "2026-11-25", "2026-12-30"]) {
      expect(seedItemsOn(d, OPEN).filter((i) => i.nth != null)).toHaveLength(1);
    }
    // 2년 동안 평일 오픈은 하루도 50분을 넘지 않는다
    let d = "2026-11-16";
    for (let n = 0; n < 730; n++, d = shiftCleanDay(d, 1)) expect(minutes(d)).toBeLessThanOrEqual(50);
  });

  it("저녁 2개 5분 · 마감 5개 10분(수요일은 로봇청소기 켜기까지 6개) · 주말은 없다", () => {
    expect(seedItemsOn(MON, EVENING).length).toBe(2);
    expect(minutes(MON, EVENING)).toBe(5);
    expect(seedItemsOn(MON, CLOSE).length).toBe(5);
    expect(minutes(MON, CLOSE)).toBe(10);
    expect(codes(WED, CLOSE)).toContain("robot_wed");
    expect(minutes(WED, CLOSE)).toBe(10);
    for (const s of CLEAN_SEED_SLOTS) {
      expect(seedItemsOn("2026-11-21", s)).toHaveLength(0);
      expect(seedItemsOn("2026-11-22", s)).toHaveLength(0);
    }
  });

  it("목요일은 물걸레 — 로봇청소기를 켜지 않고 입구는 물걸레에 들어 있다", () => {
    expect(codes(THU)).toContain("start_thu");
    expect(codes(THU)).not.toContain("start");
    expect(codes(THU)).not.toContain("entry");
    expect(codes(THU)).toContain("m_thu_mop");
    expect(codes(MON)).toContain("start");
    expect(codes(MON)).toContain("entry");
  });

  it("동선 순서 — 시작 → 미션 → 여자 구역 → 남자 구역 → 링 → 입구 → 홀 → 마무리", () => {
    const zones = seedItemsOn(MON, OPEN).map((i) => i.zone);
    const order = zones.filter((z, i) => i === 0 || zones[i - 1] !== z);
    expect(order).toEqual(["start", "mission", "women", "men", "ring", "entry", "hall", "finish"]);
  });

  it("글 길이 · 이름 · 구역 — DB 제약과 화면 규칙 안", () => {
    const seen = new Set<string>();
    for (const i of CLEAN_SEED_ITEMS) {
      const key = `${i.slot}/${i.code}`;
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
      expect(i.code).toMatch(/^[a-z][a-z0-9_]{1,31}$/);
      expect(CLEAN_ZONES[i.zone], `${key} 구역`).toBeTruthy();
      expect(i.title.length, key).toBeGreaterThan(0);
      expect(i.title.length, key).toBeLessThanOrEqual(60);
      expect((i.done ?? "").length, key).toBeLessThanOrEqual(120);
      expect((i.how ?? "").length, key).toBeLessThanOrEqual(300);
      expect((i.caution ?? "").length, key).toBeLessThanOrEqual(120);
      expect(i.min).toBeGreaterThanOrEqual(0);
      expect(i.mission).toBe(i.zone === "mission");
      expect(CLEAN_SEED_SLOTS.some((s) => s.slot === i.slot), key).toBe(true);
      // n번째 규칙은 요일과 함께 · 며칠 차이는 n번째 규칙이 있을 때만
      expect((i.nth == null) === (i.nthDow == null), key).toBe(true);
      if (i.nth == null) expect(i.off ?? 0, key).toBe(0);
      // 끝난 상태는 모든 항목에
      expect(i.done, `${key} 끝난 상태`).toBeTruthy();
    }
    expect(CLEAN_SEED_ITEMS).toHaveLength(35);
  });

  it("마이그레이션 첫 자료와 한 줄씩 같다", () => {
    for (const row of cleanSeedSlotRows()) expect(SQL, row).toContain(row);
    for (const row of cleanSeedItemRows()) expect(SQL, row).toContain(row);
    expect(SQL).toContain(`'${CLEAN_SEED_BRANCH}'`);
    // 자료 줄 수도 같다 — 마이그레이션에만 있는 줄이 없게
    const slotRows = SQL.match(/^\s+\('(open|evening|close)', '(오픈|저녁|마감)', /gm) ?? [];
    const itemRows = SQL.match(/^\s+\('(open|evening|close)', '[a-z_]+', '[a-z]+', /gm) ?? [];
    expect(slotRows).toHaveLength(CLEAN_SEED_SLOTS.length);
    expect(itemRows).toHaveLength(CLEAN_SEED_ITEMS.length);
  });

  it("마이그레이션은 줄을 지우지 않고 · 기존 함수를 바꾸지 않는다", () => {
    expect(SQL).not.toMatch(/\bdelete\b/i);
    expect(SQL).not.toMatch(/\bdrop\s+(table|function|trigger|policy)\b/i);
    const fns = [...SQL.matchAll(/create or replace function public\.([a-z0-9_]+)/g)].map((m) => m[1]);
    expect(fns.length).toBeGreaterThan(0);
    for (const f of fns) expect(f).toMatch(/^_?ops_clean_/);
    const tables = [...SQL.matchAll(/create table if not exists public\.([a-z0-9_]+)/g)].map((m) => m[1]);
    expect(tables.sort()).toEqual(["ops_clean_checks", "ops_clean_items", "ops_clean_runs", "ops_clean_slots"]);
  });

  it("서버 검사 말과 화면 검사 말이 같다", () => {
    expect(SQL).toContain(cleanNoteError("issue", "")!);
    expect(SQL).toContain(cleanNoteError("hold", "가".repeat(CLEAN_NOTE_MAX + 1))!);
    expect(SQL).toContain("아직 체크하지 않은 항목이 %개 있어요");
    expect(finishBlock(slotOf())).toBe("아직 체크하지 않은 항목이 3개 있어요");
  });
});

describe("진행 · 묶기", () => {
  it("세기 — 완료 · 보류 · 문제 · 남은 것 · 목표 분", () => {
    const s = slotOf({ items: [item("a", { state: "done", min: 3 }), item("b", { state: "hold" }), item("c", { state: "issue" }), item("d", { min: 5 })] });
    expect(slotCounts(s)).toEqual({ total: 4, done: 1, hold: 1, issue: 1, checked: 3, left: 1, minutes: 12 });
    expect(finishLine(s)).toBe("완료 1 · 보류 1 · 문제 1");
    expect(finishLine(slotOf({ items: [item("a", { state: "done" })] }))).toBe("완료 1");
    expect(finishBlock(s)).toBe("아직 체크하지 않은 항목이 1개 있어요");
    expect(finishBlock(slotOf({ items: [item("a", { state: "hold" })] }))).toBeNull();
  });

  it("상태 — 시작 전 · 하는 중 · 끝", () => {
    expect(slotStatus(slotOf())).toBe("idle");
    expect(slotStatus(slotOf({ run: { startedAt: "2026-11-16T02:00:00Z", finishedAt: null, note: null, finishedByName: null } }))).toBe("doing");
    expect(slotStatus(slotOf({ items: [item("a", { state: "done" }), item("b")] }))).toBe("doing");
    const done = slotOf({ run: { startedAt: "2026-11-16T02:01:00Z", finishedAt: "2026-11-16T02:48:00Z", note: null, finishedByName: null } });
    expect(slotStatus(done)).toBe("finished");
    expect(slotStatusText(done)).toBe("끝 · 47분");
    expect(slotStatusText(slotOf())).toBe("시작 전");
    expect(slotStatusText(slotOf({ items: [item("a", { state: "done" }), item("b")] }))).toBe("1 / 2");
  });

  it("화면 순서 — 이어지는 미션은 한 묶음 · 같은 구역끼리 · 동선 그대로", () => {
    const items = [
      item("s", { zone: "start" }),
      item("m1", { zone: "mission", mission: true, min: 8, state: "done" }),
      item("m2", { zone: "mission", mission: true, min: 2 }),
      item("w1", { zone: "women" }),
      item("w2", { zone: "women", state: "hold" }),
      item("r", { zone: "ring" }),
    ];
    const secs = cleanSections(items);
    expect(secs.map((s) => (s.kind === "mission" ? "mission" : s.zone))).toEqual(["start", "mission", "women", "ring"]);
    expect(secs[1]).toMatchObject({ kind: "mission", minutes: 10, checked: 1 });
    expect(secs[1].items.map((i) => i.id)).toEqual(["m1", "m2"]);
    expect(secs[2]).toMatchObject({ kind: "zone", label: "여자 구역", minutes: 4, checked: 1 });
    expect(secs[2].kind === "zone" && secs[2].rule).toContain("노크");
    expect(new Set(secs.map((s) => s.key)).size).toBe(secs.length);
    // 미션을 뺀 구역 묶음
    expect(zoneGroups(items).map((g) => g.zone)).toEqual(["start", "women", "ring"]);
  });

  it("미션 제목 — 요일 · 월 1회", () => {
    expect(missionHeading(TUE, [item("m", { mission: true })])).toBe("화요일 미션");
    expect(missionHeading(WED, [item("m", { mission: true }), item("n", { mission: true, monthly: true })])).toBe("수요일 미션 · 월 1회 미션");
    expect(cleanDayLabel(TUE)).toBe("11월 17일 (화)");
  });

  it("목록 한 줄 — 개수 · 목표 분 · 미션 이름", () => {
    expect(slotSubLine(slotOf())).toBe("3개 · 6분");
    const s = slotOf({ items: [item("a"), item("m", { mission: true, title: "거울" }), item("n", { mission: true, title: "필터" })] });
    expect(slotSubLine(s)).toBe("3개 · 6분 · 미션 거울 외 1");
  });
});

describe("시간", () => {
  const at = (hm: string) => kstMs(MON, hm);
  it("끝낼 시각 · 걸린 시간", () => {
    expect(slotEndLabel({ time: "11:00", budget: 50 })).toBe("11:50");
    expect(slotEndLabel({ time: "22:50", budget: 10 })).toBe("23:00");
    expect(elapsedMinutes({ startedAt: "2026-11-16T02:01:00Z", finishedAt: "2026-11-16T02:48:00Z", note: null, finishedByName: null })).toBe(47);
    expect(elapsedMinutes({ startedAt: null, finishedAt: "2026-11-16T02:48:00Z", note: null, finishedByName: null })).toBeNull();
    // 며칠 뒤에 대신 끝낸 기록은 시간을 말하지 않는다
    expect(elapsedMinutes({ startedAt: "2026-11-13T02:01:00Z", finishedAt: "2026-11-16T02:48:00Z", note: null, finishedByName: null })).toBeNull();
    expect(cleanHm("2026-11-16T02:32:00Z")).toBe("11:32");
    expect(cleanHm("2026-11-16T15:05:00Z")).toBe("00:05");
    expect(cleanHm(null)).toBe("");
    expect(shiftCleanDay("2026-11-30", 1)).toBe("2026-12-01");
    expect(shiftCleanDay("2026-11-16", -7)).toBe("2026-11-09");
  });

  it("관리자 날짜 넘기기 — 청소가 도는 요일만 밟고 · 7일 전 ~ 오늘 안에서", () => {
    const days = [1, 2, 3, 4, 5];
    const min = "2026-11-09";
    // 월요일의 앞 날 = 금요일 · 금요일의 다음 날 = 월요일
    expect(stepCleanDay(MON, -1, days, min, MON)).toBe("2026-11-13");
    expect(stepCleanDay("2026-11-13", 1, days, min, MON)).toBe(MON);
    expect(stepCleanDay(WED, -1, days, "2026-11-11", WED)).toBe(TUE);
    // 오늘 뒤 · 7일 전 앞으로는 못 간다
    expect(stepCleanDay(MON, 1, days, min, MON)).toBeNull();
    expect(stepCleanDay(min, -1, days, min, MON)).toBeNull();
    // 오늘이 일요일(청소 없는 날)이어도 오늘로는 돌아온다 · 요일을 모르면 하루씩
    expect(stepCleanDay("2026-11-20", 1, days, "2026-11-15", "2026-11-22")).toBe("2026-11-22");
    expect(stepCleanDay("2026-11-22", -1, days, "2026-11-15", "2026-11-22")).toBe("2026-11-20");
    expect(stepCleanDay(MON, -1, [], min, MON)).toBe("2026-11-15");
  });

  it("시작 전 — 끝낼 시각까지 남은 분(시작 전에는 목표 시간까지만)", () => {
    expect(cleanTimer(slotOf(), MON, MON, at("10:40"))).toEqual({ kind: "idle", endLabel: "11:50", budget: 50, leftMin: 70 });
    expect(cleanTimer(slotOf(), MON, MON, at("11:07"))).toMatchObject({ kind: "idle", leftMin: 43 });
    expect(cleanTimer(slotOf(), MON, MON, at("12:10"))).toMatchObject({ kind: "idle", leftMin: 0 });
  });

  it("하는 중 — 남은 분 · 지난 분", () => {
    const run = { startedAt: new Date(at("11:02")).toISOString(), finishedAt: null, note: null, finishedByName: null };
    expect(cleanTimer(slotOf({ run }), MON, MON, at("11:20"))).toEqual({ kind: "running", endLabel: "11:50", leftMin: 30, overMin: 0 });
    expect(cleanTimer(slotOf({ run }), MON, MON, at("11:55"))).toEqual({ kind: "running", endLabel: "11:50", leftMin: 0, overMin: 5 });
  });

  it("끝 · 지난 날", () => {
    const run = { startedAt: new Date(at("11:01")).toISOString(), finishedAt: new Date(at("11:48")).toISOString(), note: null, finishedByName: null };
    expect(cleanTimer(slotOf({ run }), MON, MON, at("13:00"))).toEqual({ kind: "finished", minutes: 47 });
    expect(cleanTimer(slotOf(), "2026-11-13", MON, at("13:00"))).toEqual({ kind: "past" });
    expect(cleanTimer(slotOf({ run }), "2026-11-13", MON, at("13:00")).kind).toBe("finished");
  });
});

describe("검사 말", () => {
  it("문제는 한 줄이 있어야 · 200자까지", () => {
    expect(cleanNoteError("issue", " ")).toBe("무엇이 문제인지 한 줄 적어 주세요");
    expect(cleanNoteError("issue", "샴푸 없음")).toBeNull();
    expect(cleanNoteError("hold", "")).toBeNull();
    expect(cleanNoteError("hold", "가".repeat(201))).toBe("메모는 200자까지 쓸 수 있어요");
    expect(cleanNoteError(null, "가".repeat(200))).toBeNull();
  });
});

describe("인수인계 글", () => {
  const h = (over: Record<string, unknown>) => ({ kind: "sum" as const, date: "2026-11-16", slot: "close", label: "마감", time: "22:50", title: null, text: null, byName: null, done: 5, due: 5, finished: true, ...over });
  it("언제 — 오늘 · 어제 · 어젯밤 · 그 앞은 날짜", () => {
    expect(handoverWhen(h({ date: TUE, time: "11:00" }), TUE)).toBe("오늘");
    expect(handoverWhen(h({ date: MON, time: "22:50" }), TUE)).toBe("어젯밤");
    expect(handoverWhen(h({ date: MON, time: "11:00" }), TUE)).toBe("어제");
    expect(handoverWhen(h({ date: "2026-11-13", time: "22:50" }), MON)).toBe("11/13(금)");
  });

  it("요약 · 한마디 · 보류 · 문제", () => {
    expect(handoverView(h({}), TUE)).toEqual({ tone: "plain", badge: null, main: "어젯밤 마감 5/5 · 끝", sub: null });
    expect(handoverView(h({ done: 4, finished: false }), TUE).main).toBe("어젯밤 마감 4/5");
    expect(handoverView(h({ kind: "note", text: "샴푸가 거의 떨어졌어요", byName: "예시 코치 C" }), TUE)).toEqual({
      tone: "plain",
      badge: "한마디",
      main: "샴푸가 거의 떨어졌어요",
      sub: "어젯밤 마감 · 예시 코치 C",
    });
    expect(handoverView(h({ kind: "hold", title: "여자 샤워실", text: "회원 사용 중", byName: "예시 코치 A" }), TUE)).toMatchObject({
      tone: "hold",
      badge: "보류",
      main: "여자 샤워실 · 회원 사용 중",
    });
    expect(handoverView(h({ kind: "issue", title: "여자 화장실", text: null }), TUE)).toMatchObject({ tone: "issue", badge: "문제", main: "여자 화장실" });
  });
});

describe("고르기 · 고치기", () => {
  const open = slotOf({ slot: "open", time: "11:00", mine: false });
  const evening = slotOf({ slot: "evening", label: "저녁", time: "19:50", budget: 10, mine: true });
  const close = slotOf({ slot: "close", label: "마감", time: "22:50", budget: 10, mine: false });
  const day = dayOf([open, evening, close], { manage: true });

  it("처음 열 시간대 — 링크 → 내 차례 → 지금 시각에 가까운 것 → 첫 칸", () => {
    expect(pickSlot(day, "close", kstMs(MON, "11:10"))?.slot).toBe("close");
    expect(pickSlot(day, null, kstMs(MON, "11:10"))?.slot).toBe("evening");
    const none = dayOf([open, { ...evening, mine: false }, close], { manage: true });
    expect(pickSlot(none, null, kstMs(MON, "11:10"))?.slot).toBe("open");
    expect(pickSlot(none, null, kstMs(MON, "20:10"))?.slot).toBe("evening");
    expect(pickSlot(none, null, kstMs(MON, "09:00"))?.slot).toBe("open");
    expect(pickSlot(none, "없는 칸", kstMs(MON, "23:00"))?.slot).toBe("close");
    expect(pickSlot(dayOf([]), null, 0)).toBeNull();
  });

  it("누르는 순간 — 그 항목만 바뀌고 · 오늘 처음이면 시작 시각이 생긴다", () => {
    const now = "2026-11-16T02:05:00.000Z";
    const next = withItemState(day, "a", "done", "버릴 메모", "나", now);
    // 같은 id 가 세 시간대에 있는 시험 자료 — 모두 바뀐다(실제 id 는 겹치지 않는다)
    expect(next.slots[0].items[0]).toMatchObject({ state: "done", note: null, at: now, byName: "나" });
    expect(next.slots[0].items[1].state).toBeNull();
    expect(next.slots[0].run?.startedAt).toBe(now);
    expect(day.slots[0].items[0].state).toBeNull();
    const hold = withItemState(next, "b", "hold", "회원 사용 중", "나", "2026-11-16T02:06:00.000Z");
    expect(hold.slots[0].items[1]).toMatchObject({ state: "hold", note: "회원 사용 중" });
    expect(hold.slots[0].run?.startedAt).toBe(now);
    const cleared = withItemState(hold, "b", null, null, "나", "2026-11-16T02:07:00.000Z");
    expect(cleared.slots[0].items[1]).toMatchObject({ state: null, note: null, at: null, byName: null });
    // 지난 날을 대신 체크할 때는 시작 시각을 만들지 않는다
    const past = withItemState(dayOf([slotOf()], { date: "2026-11-13" }), "a", "done", null, "나", now);
    expect(past.slots[0].run).toBeNull();
  });

  it("내 차례 가운데 안 끝난 것 — 휴관일 · 꺼진 계정은 없다", () => {
    expect(myOpenSlots(day).map((s) => s.slot)).toEqual(["evening"]);
    expect(myOpenSlots({ ...day, closed: true })).toEqual([]);
    expect(myOpenSlots(CLEAN_OFF)).toEqual([]);
    const done = dayOf([{ ...evening, run: { startedAt: "2026-11-16T10:51:00Z", finishedAt: "2026-11-16T10:58:00Z", note: null, finishedByName: null } }]);
    expect(myOpenSlots(done)).toEqual([]);
  });
});

describe("예시 화면", () => {
  it("예시는 늘 평일 — 주말이면 다음 월요일", () => {
    expect(sampleDate("2026-11-21")).toBe("2026-11-23");
    expect(sampleDate("2026-11-22")).toBe("2026-11-23");
    expect(sampleDate(WED)).toBe(WED);
  });

  it("코치 예시 — 세 시간대 모두 내 차례 · 시작 전 · 지난 마감 인수인계", () => {
    const d = buildCleanSample(TUE, "coach");
    expect(d.slots.map((s) => s.slot)).toEqual(["open", "evening", "close"]);
    expect(d.slots.every((s) => s.mine && slotStatus(s) === "idle")).toBe(true);
    expect(d.manage).toBe(false);
    expect(d.slots[0].items).toHaveLength(13);
    expect(d.slots[0].handover.map((h) => h.kind)).toEqual(["sum", "note", "hold"]);
    expect(handoverView(d.slots[0].handover[0], d.date).main).toBe("어젯밤 마감 4/5 · 끝");
    // 이름은 지어낸 것만 — 사람 이름이 들어가는 칸(근무자 · 체크한 분 · 끝낸 분 · 인수인계)을 모두 본다
    for (const who of ["coach", "manager"] as const) {
      const day = buildCleanSample(TUE, who);
      const names = day.slots.flatMap((s) => [
        ...s.people,
        ...(s.run?.finishedByName ? [s.run.finishedByName] : []),
        ...s.items.flatMap((i) => (i.byName ? [i.byName] : [])),
        ...s.handover.flatMap((h) => (h.byName ? [h.byName] : [])),
      ]);
      expect(names.length).toBeGreaterThan(0);
      expect(names.filter((n) => !/^예시 코치 [A-C]$/.test(n))).toEqual([]);
    }
  });

  it("관리자 예시 — 오픈 끝(보류 1) · 저녁 하는 중 · 마감 시작 전 · 뒤 시간대가 앞 시간대 것을 본다", () => {
    const d = buildCleanSample(TUE, "manager");
    expect(d.manage).toBe(true);
    expect(d.slots.map(slotStatus)).toEqual(["finished", "doing", "idle"]);
    expect(slotCounts(d.slots[0])).toMatchObject({ hold: 1, left: 0 });
    expect(slotStatusText(d.slots[0])).toBe("끝 · 47분");
    expect(d.slots[2].handover.slice(0, 5).map((h) => `${h.kind}:${h.slot}`)).toEqual(["sum:evening", "sum:open", "note:open", "hold:open", "sum:close"]);
    expect(d.slots[0].people).toEqual(["예시 코치 A"]);
  });

  it("예시에서 누르기 — 체크 · 시작 · 끝내기가 서버와 같은 모양으로 · 인수인계도 따라 바뀐다", () => {
    let d = buildCleanSample(TUE, "coach");
    const first = d.slots[0].items[0];
    d = applyCleanDemo(d, { type: "start", slot: "open" }, "2026-11-17T02:02:00.000Z");
    expect(slotStatus(d.slots[0])).toBe("doing");
    d = applyCleanDemo(d, { type: "check", itemId: first.id, state: "issue", note: "창문이 안 열려요" }, "2026-11-17T02:03:00.000Z");
    expect(d.slots[0].items[0]).toMatchObject({ state: "issue", note: "창문이 안 열려요" });
    expect(d.slots[0].run?.startedAt).toBe("2026-11-17T02:02:00.000Z");
    // 저녁 화면 인수인계 맨 위 = 오늘 오픈
    expect(d.slots[1].handover.slice(0, 2).map((h) => `${h.kind}:${h.slot}`)).toEqual(["sum:open", "issue:open"]);
    d = applyCleanDemo(d, { type: "finish", slot: "open", note: "한마디" }, "2026-11-17T02:40:00.000Z");
    expect(slotStatus(d.slots[0])).toBe("finished");
    expect(d.slots[0].run).toMatchObject({ note: "한마디", finishedByName: "나" });
    expect(elapsedMinutes(d.slots[0].run)).toBe(38);
    expect(d.slots[1].handover[0]).toMatchObject({ kind: "sum", finished: true });
    // 다시 끝내기 = 한마디만 바뀐다
    const again = applyCleanDemo(d, { type: "finish", slot: "open", note: null }, "2026-11-17T03:00:00.000Z");
    expect(again.slots[0].run).toMatchObject({ note: null, finishedAt: "2026-11-17T02:40:00.000Z" });
  });
});
