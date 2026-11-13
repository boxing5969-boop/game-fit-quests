import { describe, expect, it } from "vitest";
import {
  CARD_SIGN,
  albumOf,
  branchShortOf,
  isTogetherDay,
  monthCardModel,
  monthDayLabel,
  normalizePartner,
  normalizeRecapPref,
  partnerHint,
  partnerPromiseLine,
  recapBody,
  recapNext,
  renewalLine,
  sharedDays,
  togetherText,
  weekRecap,
  type CalPartner,
} from "@/lib/calendarTogether";
import type { AttendanceDay } from "@/lib/attendanceHistory";
import type { Promise153 } from "@/lib/promise153";
import type { CalDay } from "@/lib/calendarChecks";

const day = (d: string, minutes = 66): AttendanceDay => ({
  day: d,
  at: `${d}T10:00:00.000Z`,
  end: null,
  endSource: null,
  minutes,
  method: "face",
  branch: "153복싱짐 선릉역점",
});
const promise = (weekdays: number[], timeSlot: Promise153["timeSlot"] = null): Promise153 => ({
  weekdays,
  timeSlot,
  planB: null,
  notify: true,
  remind: null,
  startedOn: "2026-11-01",
});
const partner = (over: Partial<CalPartner> = {}): CalPartner => ({ name: "비비", days: [3, 5], slot: "morning", together: [], ...over });

// 서버 시험(test24.sql)과 같은 주 — 2026-11-09(월) ~ 11-15(일)
const A_LIST = [day("2026-11-15", 70), day("2026-11-11", 66), day("2026-11-09", 90), day("2026-11-08", 66)];

describe("서버 값 읽기", () => {
  it("짝꿍 — 이름이 없으면 없음 · 요일 정리 · 시간대 · 같이 온 날", () => {
    expect(normalizePartner(null)).toBeNull();
    expect(normalizePartner({ days: [1] })).toBeNull();
    expect(normalizePartner({ name: " 비비 ", days: [5, 3, 3, 9, "1"], slot: "lunch", together: ["2026-11-15", "x", "2026-11-11T00:00:00"] })).toEqual({
      name: "비비",
      days: [1, 3, 5],
      slot: null,
      together: ["2026-11-11", "2026-11-15"],
    });
  });
  it("주간 돌아보기 알림 — 기본 켬 · 시범 지점이 아니면 안 감", () => {
    expect(normalizeRecapPref(undefined)).toEqual({ on: true, at: "19:30", sends: false });
    expect(normalizeRecapPref({ on: false, at: "20:00", sends: true })).toEqual({ on: false, at: "20:00", sends: true });
    expect(normalizeRecapPref({ at: "7시" }).at).toBe("19:30");
  });
});

describe("운동 짝꿍과 같이 약속", () => {
  it("겹치는 요일만 서로 보인다 (월요일부터)", () => {
    expect(sharedDays(promise([0, 1, 3]), partner({ days: [3, 0] }))).toEqual([3, 0]);
    expect(partnerPromiseLine(promise([0, 1, 3]), partner({ days: [3, 0] }))).toBe("짝꿍 비비님과 수 · 일 같이 약속했어요");
    expect(partnerPromiseLine(promise([1]), partner({ days: [3] }))).toBeNull();
    expect(partnerPromiseLine(null, partner())).toBeNull();
    expect(partnerPromiseLine(promise([1]), null)).toBeNull();
  });
  it("약속 시트 한 줄 — 짝꿍 약속 · 아직 없으면 같이 하자는 말", () => {
    expect(partnerHint(partner())).toBe("짝꿍 비비님은 수 · 금 아침에 약속했어요");
    expect(partnerHint(partner({ days: [1, 2, 3, 4, 5], slot: null }))).toBe("짝꿍 비비님은 평일에 약속했어요");
    expect(partnerHint(partner({ days: [] }))).toBe("짝꿍 비비님도 약속을 걸면 같은 요일이 서로 보여요");
    expect(partnerHint(null)).toBeNull();
  });
  it("쌍도장 · 그날 한 줄", () => {
    const p = partner({ together: ["2026-11-11"] });
    expect(isTogetherDay(p, "2026-11-11")).toBe(true);
    expect(isTogetherDay(p, "2026-11-12")).toBe(false);
    expect(isTogetherDay(null, "2026-11-11")).toBe(false);
    expect(togetherText(p)).toBe("짝꿍 비비님과 같이 운동한 날이에요");
  });
});

describe("일요일 주간 돌아보기", () => {
  const stars = new Set(["2026-11-11"]);
  it("서버 알림과 같은 제목 · 글 (A — 약속 3번 · 금색 별 1개)", () => {
    const r = weekRecap({ today: "2026-11-15", list: A_LIST, promise: promise([0, 1, 3], "evening"), starDay: (d) => stars.has(d) });
    expect(r).not.toBeNull();
    expect(r?.from).toBe("2026-11-09");
    expect(r?.minutes).toBe(226);
    expect(r?.title).toBe("이번 주 3시간 46분 운동했어요");
    expect(r?.facts).toEqual(["약속 3번 지켰어요", "금색 별 1개"]);
    expect(recapBody(r!)).toBe("약속 3번 지켰어요 · 금색 별 1개. 다음 주도 월 · 수 · 일 저녁에 만나요");
  });
  it("B · F · G — 서버 시험과 같은 글", () => {
    const b = weekRecap({ today: "2026-11-15", list: [day("2026-11-11"), day("2026-11-13"), day("2026-11-15")], promise: promise([3, 5], "morning") });
    expect(b?.title).toBe("이번 주 3시간 18분 운동했어요");
    expect(recapBody(b!)).toBe("약속 2번 지켰어요. 다음 주도 수 · 금 아침에 만나요");
    const f = weekRecap({ today: "2026-11-15", list: [day("2026-11-12")] });
    expect(f?.title).toBe("이번 주 1시간 6분 운동했어요");
    expect(recapBody(f!)).toBe("다음 주도 체육관에서 만나요");
    const g = weekRecap({ today: "2026-11-15", list: [day("2026-11-14")], promise: promise([0, 1, 2, 3, 4, 5, 6]) });
    expect(recapBody(g!)).toBe("약속 1번 지켰어요. 다음 주도 매일 만나요");
  });
  it("일요일에만 · 그 주에 안 왔으면 없다", () => {
    expect(weekRecap({ today: "2026-11-14", list: A_LIST })).toBeNull();
    expect(weekRecap({ today: "2026-11-14", list: A_LIST, onlySunday: false })?.minutes).toBe(156);
    expect(weekRecap({ today: "2026-11-15", list: [day("2026-11-08")] })).toBeNull();
    expect(weekRecap({ today: "bad", list: A_LIST })).toBeNull();
  });
  it("짝꿍과 같이 온 날은 화면 칩에만 (알림 글에는 없음)", () => {
    const r = weekRecap({ today: "2026-11-15", list: A_LIST, partner: partner({ together: ["2026-11-11", "2026-11-15", "2026-11-08"] }) });
    expect(r?.together).toBe(2);
    expect(r?.facts).toContain("짝꿍과 같이 2번");
    expect(recapBody(r!)).not.toContain("짝꿍");
  });
  it("잘한 것만 — 못한 것 · 0번은 말하지 않는다", () => {
    const r = weekRecap({ today: "2026-11-15", list: [day("2026-11-15")], promise: promise([1, 3]), starDay: () => false });
    expect(r?.facts).toEqual([]);
    const all = [r!.title, ...r!.facts, r!.next, recapBody(r!)].join(" ");
    for (const bad of ["못", "빠진", "놓친", "0번", "안 왔", "아직"]) expect(all).not.toContain(bad);
  });
  it("다음 주 한 줄", () => {
    expect(recapNext(null)).toBe("다음 주도 체육관에서 만나요");
    expect(recapNext(promise([0, 1, 2, 3, 4, 5, 6], "night"))).toBe("다음 주도 매일 밤에 만나요");
    expect(recapNext(promise([2, 4]))).toBe("다음 주도 화 · 목에 만나요");
  });
});

describe("이번 달 운동 카드", () => {
  const data = {
    list: A_LIST,
    monthly: [
      { month: "2026-10", days: 4, minutes: 240 },
      { month: "2026-11", days: 4, minutes: 292 },
    ],
  };
  it("운동한 달만 · 제목 · 시간 · 지점 · 서명 · 파일 이름", () => {
    expect(monthCardModel({ month: "2026-09", data })).toBeNull();
    const m = monthCardModel({ month: "2026-11", data, name: "에이", branch: "153복싱짐 선릉역점" });
    expect(m?.title).toBe("에이님의 11월");
    expect(m?.minutes).toBe(292);
    expect(m?.minutesText).toBe("4시간 52분");
    expect(m?.branchShort).toBe("선릉역점");
    expect(m?.sign).toBe(CARD_SIGN);
    expect(m?.fileName).toBe("153-운동카드-2026-11.png");
    expect(monthCardModel({ month: "2026-11", data })?.title).toBe("11월의 운동");
  });
  it("도장 · 금색(기념일) · 쌍도장 · 앞뒤 달은 칸만", () => {
    const moments = new Map([["2026-11-09", { kind: "first" as const, text: "첫 도장을 찍은 날이에요", gold: true }]]);
    const m = monthCardModel({ month: "2026-11", data, moments, partner: partner({ together: ["2026-11-11"] }) })!;
    const cells = m.weeks.flat();
    const at = (d: string) => cells.find((c) => c.day === d)!;
    expect(at("2026-11-09")).toMatchObject({ on: true, gold: true, together: false, inMonth: true });
    expect(at("2026-11-11")).toMatchObject({ on: true, gold: false, together: true });
    expect(at("2026-11-10")).toMatchObject({ on: false, gold: false });
    // 11/01 은 일요일 — 첫 줄은 10/26(월)부터, 10월 칸은 inMonth false (10/08 출석이 있어도 도장 없음)
    expect(cells[0].day).toBe("2026-10-26");
    expect(cells.filter((c) => !c.inMonth).every((c) => !c.on)).toBe(true);
  });
  it("늘었을 때만 '앞 달보다' · 그 달 마지막 코치 한마디", () => {
    const notes = [
      { id: "1", day: "2026-11-11", who: "김", title: "코치", body: "잽이 좋았어요", at: "2026-11-11T11:00:00Z" },
      { id: "2", day: "2026-11-11", who: "박", title: "지점장", body: "스텝이 가벼워요", at: "2026-11-11T12:00:00Z" },
      { id: "3", day: "2026-10-30", who: "김", title: "코치", body: "지난달", at: "2026-10-30T12:00:00Z" },
    ];
    const m = monthCardModel({ month: "2026-11", data, notes })!;
    expect(m.gain).toBe("10월보다 +52분");
    expect(m.note).toEqual({ body: "스텝이 가벼워요", who: "박 지점장님", day: "2026-11-11" });
    expect(monthCardModel({ month: "2026-11", data: { ...data, monthly: [{ month: "2026-10", days: 9, minutes: 900 }, { month: "2026-11", days: 4, minutes: 292 }] } })?.gain).toBeNull();
  });
  it("지점 짧은 이름 · 날짜 글", () => {
    expect(branchShortOf("153복싱짐 칠금점")).toBe("칠금점");
    expect(branchShortOf("153 복싱짐 잠실점")).toBe("잠실점");
    expect(branchShortOf(null)).toBeNull();
    expect(monthDayLabel("2026-11-05")).toBe("11월 5일");
  });
});

describe("나의 153 앨범", () => {
  const cd = (d: string, photo: string | null): CalDay => ({
    day: d,
    cheer: false,
    give153: false,
    journal: { id: d, content: "한 줄", mood: null, photoUrl: photo, visibility: "private", at: "" },
    done: [],
    sticker: null,
  });
  it("그 달 사진만 · 최근 날부터", () => {
    const days = new Map<string, CalDay>([
      ["2026-11-03", cd("2026-11-03", "a.jpg")],
      ["2026-11-12", cd("2026-11-12", "b.jpg")],
      ["2026-11-05", cd("2026-11-05", null)],
      ["2026-10-30", cd("2026-10-30", "c.jpg")],
    ]);
    expect(albumOf(days, "2026-11").map((p) => p.url)).toEqual(["b.jpg", "a.jpg"]);
    expect(albumOf(days, "2026-12")).toEqual([]);
  });
});

describe("재등록 즈음 153과 함께한 시간", () => {
  const base = { membershipEnd: "2026-11-30", firstDay: "2026-02-03", totalMinutes: 7700 };
  it("끝나기 14일 전부터 끝나고 14일까지", () => {
    expect(renewalLine({ ...base, today: "2026-11-15" })).toBeNull();
    expect(renewalLine({ ...base, today: "2026-11-16" })).toEqual({
      title: "153과 함께한 시간",
      time: "128시간 20분",
      since: "2026년 2월 3일 첫 도장부터",
      ended: false,
    });
    expect(renewalLine({ ...base, today: "2026-12-14" })?.ended).toBe(true);
    expect(renewalLine({ ...base, today: "2026-12-15" })).toBeNull();
  });
  it("수강권 · 첫 도장 · 운동 시간이 없으면 없다", () => {
    expect(renewalLine({ ...base, membershipEnd: null, today: "2026-11-20" })).toBeNull();
    expect(renewalLine({ ...base, firstDay: null, today: "2026-11-20" })).toBeNull();
    expect(renewalLine({ ...base, totalMinutes: 0, today: "2026-11-20" })).toBeNull();
  });
});
