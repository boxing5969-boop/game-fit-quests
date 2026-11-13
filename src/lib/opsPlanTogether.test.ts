/**
 * 캘린더 3-3단계 — 함께 쓰기 화면 계산 (src/lib/opsPlans.ts) · 지어낸 사람 · 지어낸 일정만
 */
import { describe, expect, it } from "vitest";

import {
  busyItems,
  calsOff,
  dayItems,
  dayMarks,
  draftError,
  draftFromPlan,
  draftPayload,
  eventLayerPlans,
  filterByCals,
  guestCounts,
  guestLine,
  guestProposals,
  insightTotal,
  inviteLine,
  isInvitedPlan,
  meetingEnd,
  meetingLayerPlans,
  minutesLabel,
  newDraft,
  occursOn,
  offOverlaps,
  planFileError,
  planOpenable,
  planTitle,
  proposalLabel,
  teamDayItems,
  type OpsPlan,
  type PlanGuest,
  type PlansWeek,
} from "./opsPlans";

const A = "a0000000-0000-0000-0000-00000000000a";
const B = "b0000000-0000-0000-0000-00000000000b";
const C = "c0000000-0000-0000-0000-00000000000c";
const BR = "153복싱짐 선릉역점";

const guest = (user_id: string, response: PlanGuest["response"], extra: Partial<PlanGuest> = {}): PlanGuest => ({
  user_id,
  name: `사람${user_id.slice(0, 1).toUpperCase()}`,
  response,
  note: null,
  auto: false,
  proposed_on: null,
  proposed_start: null,
  proposed_end: null,
  responded_at: null,
  ...extra,
});

const plan = (p: Partial<OpsPlan>): OpsPlan => ({
  id: "p1",
  user_id: A,
  branch: BR,
  kind: "work",
  title: "주간 회의",
  memo: null,
  masked: false,
  private: false,
  start_on: "2026-11-17",
  end_on: "2026-11-17",
  repeat_weekdays: [],
  until_on: null,
  skip_dates: [],
  all_day: false,
  start_time: "19:00",
  end_time: "20:00",
  mine: true,
  ...p,
});

const week = (w: Partial<PlansWeek>): PlansWeek => ({
  branch: BR,
  branches: [{ branch: BR, manage: false, mine: true }],
  manage: false,
  hq: false,
  me: A,
  from: "2026-11-16",
  to: "2026-11-22",
  today: "2026-11-16",
  now_hm: "10:00",
  members: [{ key: A, user_id: A, name: "사람A", title: "코치", me: true }],
  plans: [],
  shifts: [],
  offs: [],
  recent: [],
  ...w,
});

describe("3-3 초대받은 일정은 손님의 하루에 (못 가요는 빼고)", () => {
  const p = plan({ guests: [guest(B, "yes"), guest(C, "no")] });
  const w = week({ plans: [p] });
  it("만든 사람 · 참석한 손님에게 있고 못 가요 손님에게는 없다", () => {
    expect(dayItems(w, { key: A, user_id: A }, "2026-11-17")).toHaveLength(1);
    expect(dayItems(w, { key: B, user_id: B }, "2026-11-17")).toHaveLength(1);
    expect(dayItems(w, { key: C, user_id: C }, "2026-11-17")).toHaveLength(0);
  });
  it("답 기다림 · 아마도 그린다 · 다른 날은 없다", () => {
    const w2 = week({ plans: [plan({ guests: [guest(B, null), guest(C, "maybe")] })] });
    expect(dayItems(w2, { key: B, user_id: B }, "2026-11-17")).toHaveLength(1);
    expect(dayItems(w2, { key: C, user_id: C }, "2026-11-17")).toHaveLength(1);
    expect(dayItems(w2, { key: B, user_id: B }, "2026-11-18")).toHaveLength(0);
  });
});

describe("3-3 손님 답 · 제안 · 초대 줄", () => {
  const gs = [guest(A, "yes"), guest(B, "yes"), guest(C, null), guest("d", "no", { auto: true })];
  it("셈 · 한 줄 (0 은 빼고)", () => {
    expect(guestCounts(gs)).toEqual({ yes: 2, maybe: 0, no: 1, wait: 1 });
    expect(guestLine(gs)).toBe("참석 2 · 못 가요 1 · 답 기다림 1");
    expect(guestLine([])).toBe("");
  });
  it("제안 한 줄 — 시각이 있으면 시각까지", () => {
    const g = guest(B, "no", { proposed_on: "2026-11-18", proposed_start: "18:00", proposed_end: "19:00" });
    expect(guestProposals([g, guest(C, "yes")])).toEqual([g]);
    expect(proposalLabel(g)).toBe("11월 18일 (수) 18:00~19:00");
    expect(proposalLabel({ proposed_on: "2026-11-18", proposed_start: null, proposed_end: null })).toBe("11월 18일 (수)");
  });
  it("초대받은 일정 · 열 수 있나 · 이름", () => {
    const inv = plan({ mine: false, invited: true, my_response: null, owner_name: "사람B" });
    expect(isInvitedPlan(inv)).toBe(true);
    expect(isInvitedPlan(plan({}))).toBe(false);
    expect(inviteLine(inv)).toBe("사람B님 초대 · 답 기다림");
    expect(planOpenable(inv)).toBe(true);
    expect(planOpenable(plan({ mine: false }))).toBe(false);
    expect(planTitle(plan({ masked: true, title: null, kind: "personal" }))).toBe("개인 일정");
    expect(planTitle(plan({ title: null, kind: "pt" }))).toBe("PT");
  });
});

describe("3-3 팀원 바쁜 시간", () => {
  const w = week({
    busy: [
      { user_id: B, date: "2026-11-17", start: "19:00", end: "20:00", all_day: false },
      { user_id: B, date: "2026-11-17", start: "19:30", end: "21:00", all_day: false },
      { user_id: B, date: "2026-11-17", start: "22:00", end: "23:00", all_day: false },
      { user_id: C, date: "2026-11-17", start: null, end: null, all_day: true },
      { user_id: C, date: "2026-11-17", start: "10:00", end: "11:00", all_day: false },
    ],
  });
  it("겹치는 칸은 하나로 · 제목 없이 '바쁨'", () => {
    const items = busyItems(w, B, "2026-11-17");
    expect(items.map((i) => `${i.start}-${i.end}`)).toEqual(["19:00-21:00", "22:00-23:00"]);
    expect(items.every((i) => i.type === "busy")).toBe(true);
  });
  it("하루 종일이면 그것 하나", () => {
    const items = busyItems(w, C, "2026-11-17");
    expect(items).toHaveLength(1);
    expect(items[0].allDay).toBe(true);
  });
  it("코치님 팀 보기 — 나는 내 일정, 다른 분은 바쁨만", () => {
    const w2 = { ...w, plans: [plan({})] };
    const me = { key: A, user_id: A };
    expect(teamDayItems(w2, { user_id: A, name: "사람A", title: "코치", me: true }, me, "2026-11-17")[0].type).toBe("plan");
    expect(teamDayItems(w2, { user_id: B, name: "사람B", title: "코치", me: false }, me, "2026-11-17")[0].type).toBe("busy");
  });
});

describe("3-3 캘린더 켜고 끄기", () => {
  const mine = plan({ id: "m" });
  const inv = plan({ id: "i", user_id: B, mine: false, invited: true, guests: [guest(A, "yes")] });
  const ev = eventLayerPlans([{ id: "e1", title: "", startOn: "2026-11-17", endOn: "2026-11-17", kindLabel: "휴관" }], A, BR)[0];
  const w = week({
    plans: [mine, inv, ev],
    shifts: [{ key: A, branch: BR, weekday: 2, start_time: "14:00", end_time: "22:00", valid_from: "2026-01-01", valid_to: null, staff_start: null, staff_end: null }],
    busy: [{ user_id: B, date: "2026-11-17", start: "10:00", end: "11:00", all_day: false }],
  });
  it("처음엔 팀만 꺼짐", () => {
    expect([...calsOff(week({}))]).toEqual(["team"]);
    expect([...calsOff(week({ prefs: { brief_on: true, cals_off: [] } }))]).toEqual([]);
  });
  it("끈 것만 빠진다", () => {
    const f = filterByCals(w, new Set(["invited", "work", "events", "team"]));
    expect(f.plans.map((p) => p.id)).toEqual(["m"]);
    expect(f.shifts).toHaveLength(0);
    expect(f.busy).toHaveLength(0);
    const g = filterByCals(w, new Set(["mine"]));
    expect(g.plans.map((p) => p.id)).toEqual(["i", "ev:e1"]);
    expect(g.shifts).toHaveLength(1);
  });
});

describe("3-3 153 일정 · 정기 회의 겹쳐 그리기", () => {
  it("153 일정 = 하루 종일 · 이름 없으면 종류", () => {
    const [ev] = eventLayerPlans([{ id: "e1", title: "", startOn: "2026-11-20", endOn: "2026-11-21", kindLabel: "휴관" }], A, BR);
    expect(ev.layer).toBe("event");
    expect(ev.title).toBe("휴관");
    expect(occursOn(ev, "2026-11-21")).toBe(true);
    expect(planOpenable(ev)).toBe(true);
    expect(dayMarks([dayItems(week({ plans: [ev] }), { key: A, user_id: A }, "2026-11-20")], true).map((m) => m.key)).toEqual(["event"]);
  });
  it("정기 회의 = 매주 요일 · 1시간 · 다음 한 번 쉬기", () => {
    const [mt] = meetingLayerPlans(
      [{ id: "o1", title: "주간 회의", weekdays: [2], once_on: null, at: "10:30:00", video_url: "https://zoom.us/j/1", skip_day: "2026-11-24" }],
      A,
      BR,
    );
    expect(mt.start_time).toBe("10:30");
    expect(mt.end_time).toBe("11:30");
    expect(occursOn(mt, "2026-11-17")).toBe(true);
    expect(occursOn(mt, "2026-11-24")).toBe(false);
    expect(occursOn(mt, "2026-12-01")).toBe(true);
    expect(occursOn(mt, "2026-11-18")).toBe(false);
    expect(mt.layer_url).toBe("https://zoom.us/j/1");
  });
  it("한 번 하는 회의 · 늦은 회의는 23:59 까지 · 잘못된 줄은 빼기", () => {
    const rows = meetingLayerPlans(
      [
        { id: "o2", title: "", weekdays: [], once_on: "2026-11-19", at: "23:30", video_url: null, skip_day: null },
        { id: "o3", title: "x", weekdays: [], once_on: null, at: "10:00", video_url: null, skip_day: null },
      ],
      A,
      BR,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("정기 회의");
    expect(rows[0].end_time).toBe("23:59");
    expect(meetingEnd("09:15")).toBe("10:15");
  });
});

describe("3-3 넣기 칸 — 손님 · 회의 링크 · 집중 · 첨부", () => {
  it("새 일정은 기본 알림 · 고른 손님으로", () => {
    const d = newDraft(BR, "2026-11-17", "work", { start: "16:00", end: "17:00" }, { reminders: [5, 30], guests: [B] });
    expect(d.reminders).toEqual([5, 30]);
    expect(d.guests).toEqual([B]);
    expect(d.meet_url).toBe("");
  });
  it("고칠 때 손님 · 링크 · 첨부 · 집중을 그대로 읽는다", () => {
    const d = draftFromPlan(
      plan({ guests: [guest(B, "yes")], meet_url: "https://zoom.us/j/1", focus: true, attachments: [{ path: `${A}/x.pdf`, name: "자료", size: 10, type: "application/pdf" }] }),
    );
    expect(d.guests).toEqual([B]);
    expect(d.meet_url).toBe("https://zoom.us/j/1");
    expect(d.focus).toBe(true);
    expect(d.attachments).toHaveLength(1);
  });
  it("보낼 값 — 손님 · 링크 · 첨부(경로 · 이름) · 하루 종일이면 집중 끔", () => {
    const d = { ...newDraft(BR, "2026-11-17", "work"), guests: [B, B, C], meet_url: " zoom.us/j/9 ", focus: true, attachments: [{ path: `${A}/x.pdf`, name: "자료", size: 10, type: "t" }] };
    const p = draftPayload(d);
    expect(p.guests).toEqual([B, C]);
    expect(p.meet_url).toBe("zoom.us/j/9");
    expect(p.focus).toBe(true);
    expect(p.attachments).toEqual([{ path: `${A}/x.pdf`, name: "자료" }]);
    expect(draftPayload({ ...d, all_day: true }).focus).toBe(false);
  });
  it("검사 — 서버와 같은 말", () => {
    const d = newDraft(BR, "2026-11-17", "work");
    const today = "2026-11-16";
    expect(draftError({ ...d, meet_url: "https://example.com" }, today)).toBe("줌 · 구글 미트 링크만 넣을 수 있어요");
    expect(draftError({ ...d, meet_url: "회의 링크 https://meet.google.com/abc-defg-hij" }, today)).toBeNull();
    expect(draftError({ ...d, kind: "off", all_day: true, guests: [B] }, today)).toBe("휴무 일정에는 초대할 수 없어요");
    expect(draftError({ ...d, kind: "personal", private: true, guests: [B] }, today)).toBe("시간만 보이는 개인 일정에는 초대할 수 없어요");
    expect(draftError({ ...d, guests: Array.from({ length: 21 }, (_, i) => `g${i}`) }, today)).toBe("초대는 20명까지예요");
    expect(
      draftError({ ...d, attachments: Array.from({ length: 6 }, (_, i) => ({ path: `${A}/${i}.pdf`, name: "f", size: 1, type: "application/pdf" })) }, today),
    ).toBe("첨부는 5개까지예요");
  });
});

describe("3-3 휴무 기간 — 겹친 수업 · PT · 근무", () => {
  const w = week({
    plans: [
      plan({ id: "c", kind: "class", start_on: "2026-11-18", end_on: "2026-11-18" }),
      plan({ id: "w", kind: "work", start_on: "2026-11-18", end_on: "2026-11-18" }),
      plan({ id: "inv", kind: "class", mine: false, invited: true, user_id: B, guests: [guest(A, "yes")], start_on: "2026-11-19", end_on: "2026-11-19" }),
    ],
    shifts: [{ key: A, branch: BR, weekday: 3, start_time: "14:00", end_time: "22:00", valid_from: "2026-01-01", valid_to: null, staff_start: null, staff_end: null }],
  });
  it("내 수업 · 근무 시간만 (업무 · 초대받은 수업은 빼고)", () => {
    const rows = offOverlaps(w, { key: A, user_id: A }, "2026-11-17", "2026-11-19");
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe("2026-11-18");
    expect(rows[0].items.map((i) => (i.type === "plan" ? i.plan.id : i.type))).toEqual(["shift", "c"]);
  });
});

describe("3-3 시간 인사이트 · 첨부 검사", () => {
  it("분 → 글", () => {
    expect(minutesLabel(50)).toBe("50분");
    expect(minutesLabel(120)).toBe("2시간");
    expect(minutesLabel(90)).toBe("1시간 30분");
    expect(insightTotal({ class: 120, pt: 50, work: 90, meeting: 60, out: 0 })).toBe(320);
  });
  it("사진 · PDF · 10MB 아래만", () => {
    expect(planFileError({ name: "a.pdf", size: 1000, type: "application/pdf" })).toBeNull();
    expect(planFileError({ name: "b.HEIC", size: 1000, type: "" })).toBeNull();
    expect(planFileError({ name: "c.mp4", size: 1000, type: "video/mp4" })).toBe("사진(jpg · png · webp · heic) · PDF 만 넣을 수 있어요");
    expect(planFileError({ name: "d.jpg", size: 11 * 1024 * 1024, type: "image/jpeg" })).toBe("10MB 아래 파일만 넣을 수 있어요");
  });
});
