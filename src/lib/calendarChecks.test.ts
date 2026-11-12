import { describe, expect, it } from "vitest";
import {
  CAL_OFF,
  applyDone,
  applySticker,
  calendarRange,
  canEditDay,
  checkItemError,
  checkItemPayload,
  checkProgress,
  dayChecks,
  draftFromItem,
  emptyCheckDraft,
  isStarDay,
  itemLabel,
  itemsForDay,
  normalizeCalendar,
  stickerOf,
  type CheckItem,
} from "./calendarChecks";

// 2026-11-12 = 목요일
const JAB: CheckItem = { id: "jab", label: "잽", target: 100, unit: "번", weekdays: null, createdOn: "2026-11-01", archivedOn: null };
const ROPE: CheckItem = { id: "rope", label: "줄넘기", target: 10, unit: "분", weekdays: [1, 3, 5], createdOn: "2026-11-01", archivedOn: null };
const OLD: CheckItem = { id: "old", label: "스트레칭", target: null, unit: null, weekdays: null, createdOn: "2026-11-01", archivedOn: "2026-11-10" };

describe("운동 달력 체크 — 서버 값 읽기", () => {
  it("꺼짐 · 잘못된 줄 빼기 · 정리", () => {
    expect(normalizeCalendar(null)).toBe(CAL_OFF);
    expect(normalizeCalendar({ on: false }).on).toBe(false);
    const s = normalizeCalendar({
      on: true,
      today: "2026-11-12",
      items: [
        { id: "jab", label: "잽", target: 100, unit: "번", weekdays: null, created_on: "2026-11-01", archived_on: null },
        { id: "x", label: "", created_on: "2026-11-01" },
        { id: "w", label: "줄넘기", target: null, unit: "분", weekdays: [5, 1, 3, 3, 9], created_on: "2026-11-01" },
        { id: "all", label: "매일", weekdays: [0, 1, 2, 3, 4, 5, 6], created_on: "2026-11-01" },
      ],
      days: [
        { day: "2026-11-11", cheer: true, give153: false, journal: { id: "j", content: " 오늘 미트 ", mood: "💪 좋음", photo_url: null, visibility: "private" }, done: ["jab"], sticker: "proud" },
        { day: "bad" },
        { day: "2026-11-12", sticker: "cool", done: null },
      ],
    });
    expect(s.on).toBe(true);
    expect(s.items.map((i) => i.id)).toEqual(["jab", "w", "all"]);
    expect(s.items[1]).toMatchObject({ weekdays: [1, 3, 5], target: null, unit: null });
    expect(s.items[2].weekdays).toBeNull(); // 7요일 = 매일
    expect(s.days.get("2026-11-11")).toMatchObject({ cheer: true, done: ["jab"], sticker: "proud", journal: { content: "오늘 미트", visibility: "private" } });
    expect(s.days.get("2026-11-12")).toMatchObject({ sticker: null, done: [] });
    expect(s.days.size).toBe(2);
    // 2-2 칸이 없는 옛 서버 값도 읽힌다
    expect(s.events).toEqual([]);
    expect(s.calls).toEqual([]);
    expect(s.nudge).toEqual({ on: false, at: "20:00" });
  });

  it("(2-2) 153 일정 · 저요 한 모집 · 저녁 독려", () => {
    const s = normalizeCalendar({
      on: true,
      today: "2026-11-13",
      items: [],
      days: [],
      events: [{ id: "e", kind: "closed", title: "휴관", start_on: "2026-11-14", end_on: "2026-11-14" }],
      calls: [{ id: "c", day: "2026-11-13", hour: 19, purpose: "mitt", mine: true, joiners: 1 }],
      nudge: { on: true, at: "20:00" },
    });
    expect(s.events).toHaveLength(1);
    expect(s.calls[0]).toMatchObject({ id: "c", hour: 19, mine: true, joiners: 1 });
    expect(s.nudge).toEqual({ on: true, at: "20:00" });
    expect(normalizeCalendar({ on: true, nudge: { on: true, at: "8pm" } }).nudge).toEqual({ on: true, at: "20:00" });
  });
});

describe("운동 달력 체크 — 날짜", () => {
  it("고칠 수 있는 날 = 오늘부터 6일 전까지 · 앞날 안 됨", () => {
    expect(canEditDay("2026-11-12", "2026-11-12")).toBe(true);
    expect(canEditDay("2026-11-06", "2026-11-12")).toBe(true);
    expect(canEditDay("2026-11-05", "2026-11-12")).toBe(false);
    expect(canEditDay("2026-11-13", "2026-11-12")).toBe(false);
  });

  it("보이는 날짜 → 물을 범위", () => {
    expect(calendarRange(["2026-11-16", "2026-11-10", "x"])).toEqual({ from: "2026-11-10", to: "2026-11-16" });
    expect(calendarRange([])).toBeNull();
  });

  it("그날의 나만의 체크 — 만든 날부터 · 뺀 날 전까지 · 그 요일", () => {
    expect(itemsForDay([JAB, ROPE, OLD], "2026-11-12").map((i) => i.id)).toEqual(["jab"]); // 목 — 줄넘기 아님 · 스트레칭은 11/10 에 뺌
    expect(itemsForDay([JAB, ROPE, OLD], "2026-11-09").map((i) => i.id)).toEqual(["jab", "rope", "old"]); // 월
    expect(itemsForDay([JAB], "2026-10-31")).toEqual([]); // 만들기 전
  });
});

describe("운동 달력 체크 — 그날의 체크 · 금색 별", () => {
  it("저절로 3개 + 나만의 체크 · 응원은 응원이나 153", () => {
    const c = dayChecks("2026-11-12", true, { day: "2026-11-12", cheer: false, give153: true, journal: null, done: ["jab"], sticker: null }, [JAB, ROPE]);
    expect(c.map((x) => [x.label, x.done])).toEqual([
      ["체육관", true],
      ["응원", true],
      ["한 줄", false],
      ["잽 100번", true],
    ]);
    expect(isStarDay(c)).toBe(false);
  });

  it("(2-2) 휴관일에 안 왔으면 체육관은 빼고 센다 — 쉬는 날도 별", () => {
    const line = { id: "j", content: "쉬는 날 스트레칭", mood: null, photoUrl: null, visibility: "private" as const, at: "" };
    const cal = { day: "2026-11-12", cheer: true, give153: false, journal: line, done: ["jab"], sticker: null };
    const closed = dayChecks("2026-11-12", false, cal, [JAB], true);
    expect(closed.map((c) => c.key)).toEqual(["cheer", "line", "item:jab"]);
    expect(isStarDay(closed)).toBe(true);
    // 휴관일에 왔으면 체육관도 센다
    expect(dayChecks("2026-11-12", true, cal, [JAB], true)[0]).toMatchObject({ key: "gym", done: true });
    // 휴관일이 아니면 그대로
    expect(isStarDay(dayChecks("2026-11-12", false, cal, [JAB]))).toBe(false);
  });

  it("다 채운 날 = 금색 별 · 기록 없는 날은 별 없음", () => {
    const line = { id: "j", content: "좋았다", mood: null, photoUrl: null, visibility: "private" as const, at: "" };
    const all = dayChecks("2026-11-12", true, { day: "2026-11-12", cheer: true, give153: false, journal: line, done: ["jab"], sticker: null }, [JAB]);
    expect(isStarDay(all)).toBe(true);
    expect(isStarDay(dayChecks("2026-11-12", false, undefined, []))).toBe(false);
  });

  it("한 줄 — 채운 것과 다음 한 걸음만, 못한 것은 말하지 않는다", () => {
    const mk = (done: boolean[]) => done.map((d, i) => ({ key: String(i), kind: "custom" as const, label: "x", done: d }));
    expect(checkProgress(mk([true, true, true]), true)).toBe("오늘 금색 별을 받았어요");
    expect(checkProgress(mk([true, true, true]), false)).toBe("금색 별을 받은 날이에요");
    expect(checkProgress(mk([true, false, false, false]), true)).toBe("1개 채웠어요 · 3개 더 채우면 금색 별");
    expect(checkProgress(mk([true, true, false]), false)).toBe("이날 2개 채웠어요");
    expect(checkProgress(mk([false, false, false]), true)).toBe("하나씩 채우면 금색 별이 돼요");
    expect(checkProgress(mk([false, false, false]), false)).toBeNull();
    for (const d of [[true, false], [false, false], [true, true]]) {
      for (const t of [true, false]) expect(checkProgress(mk(d), t) ?? "").not.toMatch(/못|안 했|놓|빠|실패|0개/);
    }
  });

  it("할 때마다 바로 — 캐시 고치기", () => {
    const s0 = normalizeCalendar({ on: true, today: "2026-11-12", items: [], days: [] });
    const s1 = applyDone(s0, "2026-11-12", "jab", true);
    expect(s1.days.get("2026-11-12")?.done).toEqual(["jab"]);
    const s2 = applyDone(applySticker(s1, "2026-11-12", "fire"), "2026-11-12", "jab", false);
    expect(s2.days.get("2026-11-12")).toMatchObject({ done: [], sticker: "fire" });
    expect(s0.days.size).toBe(0); // 앞 상태는 그대로
  });
});

describe("운동 달력 체크 — 글 · 만들기", () => {
  it("항목 이름 · 스티커", () => {
    expect(itemLabel(JAB)).toBe("잽 100번");
    expect(itemLabel({ label: "줄넘기", target: 1000, unit: "번" })).toBe("줄넘기 1,000번");
    expect(itemLabel({ label: "스트레칭", target: null, unit: null })).toBe("스트레칭");
    expect(stickerOf("proud")?.label).toBe("뿌듯");
    expect(stickerOf("cool")).toBeNull();
  });

  it("검사는 서버와 같은 말 · 보낼 값", () => {
    const d = emptyCheckDraft();
    expect(checkItemError(d)).toBe("체크 이름을 적어 주세요");
    expect(checkItemError({ ...d, label: "가".repeat(21) })).toBe("체크 이름은 20자 안으로 적어 주세요");
    expect(checkItemError({ ...d, label: "잽", target: "0" })).toBe("목표 숫자는 1부터 9,999까지 적어 주세요");
    expect(checkItemError({ ...d, label: "잽", target: "1.5" })).toBe("목표 숫자는 1부터 9,999까지 적어 주세요");
    expect(checkItemError({ ...d, label: "잽", target: "100", weekdays: [7] })).toBe("요일을 다시 골라 주세요");
    expect(checkItemError({ ...d, label: "잽", target: "1,000" })).toBeNull();
    expect(checkItemPayload({ label: "  잽  연습 ", target: "1,000", unit: "번", weekdays: [5, 1, 1] }, "id1")).toEqual({
      p_id: "id1",
      p_label: "잽 연습",
      p_target: 1000,
      p_unit: "번",
      p_weekdays: [1, 5],
    });
    expect(checkItemPayload({ label: "스트레칭", target: "", unit: "분", weekdays: [0, 1, 2, 3, 4, 5, 6] })).toMatchObject({
      p_id: null,
      p_target: null,
      p_unit: null,
      p_weekdays: null,
    });
    expect(draftFromItem(ROPE)).toEqual({ label: "줄넘기", target: "10", unit: "분", weekdays: [1, 3, 5] });
  });
});
