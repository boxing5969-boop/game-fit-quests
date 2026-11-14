/**
 * PT 프리미엄 1단계 — 화면 계산(src/lib/ptBooking.ts) · 예시 자료(ptBookingSample.ts) 시험.
 *   지어낸 이름 · 지어낸 숫자만 쓴다(저장소는 공개). 시각은 모두 한국 시간 2026-11-16(월) 14:00 기준.
 */
import { describe, expect, it } from "vitest";
import {
  CANCEL_COPY,
  PT_HOME_OFF,
  PT_RULE_LINE,
  addDays,
  aheadChip,
  boardRows,
  boardView,
  bookDraftError,
  bookPayload,
  busyMinutes,
  canMove,
  cancelMode,
  closeOptions,
  dateLabel,
  dateShort,
  dayDiff,
  dayWord,
  enteredOn,
  freeCount,
  freeSlotGroups,
  historyView,
  kstDateOf,
  kstIso,
  kstMinutes,
  memberLabel,
  memberRows,
  minuteClock,
  minuteLabel,
  monthLessons,
  needsResult,
  normalizePtBoard,
  normalizePtHome,
  normalizePtSlots,
  normalizeSaveResult,
  saveSummary,
  showPtCard,
  slotSummary,
  slotsError,
  slotsOfCoach,
  slotsPayload,
  splitBookings,
  ticketTotal,
  weekdayOf,
  whenLabel,
  type PtBookDraft,
  type PtHistoryItem,
  type PtHistoryKind,
  type PtHomeBooking,
  type SlotRange,
} from "./ptBooking";
import { applyPtBoardDemo, applyPtHomeDemo, buildPtBoardSample, buildPtHomeSample, buildPtSlotsSample } from "./ptBookingSample";

const TODAY = "2026-11-16"; // 월요일
const NOW = Date.parse(kstIso(TODAY, 14 * 60)); // 한국 시간 14:00
const at = (offset: number, min: number) => kstIso(addDays(TODAY, offset), min);

describe("날짜 · 시각(한국 시간)", () => {
  it("자정 경계 · 날짜 차 · 요일", () => {
    expect(kstDateOf(Date.parse("2026-11-15T15:00:00Z"))).toBe("2026-11-16");
    expect(kstDateOf(Date.parse("2026-11-15T14:59:59Z"))).toBe("2026-11-15");
    expect(dayDiff("2026-11-16", "2026-11-18")).toBe(2);
    expect(dayDiff("2026-11-16", "2026-11-15")).toBe(-1);
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(weekdayOf(TODAY)).toBe(1);
  });
  it("분 ↔ ISO · 글", () => {
    expect(kstIso(TODAY, 19 * 60)).toBe("2026-11-16T10:00:00.000Z");
    expect(kstMinutes("2026-11-16T10:00:00.000Z")).toBe(19 * 60);
    expect(minuteLabel(0)).toBe("오전 12:00");
    expect(minuteLabel(12 * 60)).toBe("오후 12:00");
    expect(minuteLabel(19 * 60 + 30)).toBe("오후 7:30");
    expect(minuteClock(9 * 60 + 5)).toBe("09:05");
    expect(dateLabel(TODAY)).toBe("11월 16일 (월)");
    expect(dateShort(TODAY)).toBe("11/16 (월)");
  });
  it("오늘 · 내일 · 어제 · 며칠 뒤", () => {
    expect(dayWord(TODAY, TODAY)).toBe("오늘");
    expect(dayWord(addDays(TODAY, 1), TODAY)).toBe("내일");
    expect(dayWord(addDays(TODAY, -1), TODAY)).toBe("어제");
    expect(dayWord(addDays(TODAY, 2), TODAY)).toBe("11월 18일 (수)");
    expect(whenLabel(at(1, 19 * 60), TODAY)).toBe("내일 오후 7:00");
    expect(aheadChip(addDays(TODAY, 3), TODAY)).toBe("3일 뒤");
    expect(aheadChip(addDays(TODAY, 1), TODAY)).toBeNull();
  });
});

describe("회원 — 홈 PT 카드", () => {
  it("꺼진 값 · 모르는 값은 버린다", () => {
    expect(normalizePtHome(null)).toBe(PT_HOME_OFF);
    expect(normalizePtHome({ on: false, pt: true })).toBe(PT_HOME_OFF);
    const h = normalizePtHome(
      {
        on: true,
        pt: true,
        ticket: { name: "퍼스널 트레이닝 20회권", remaining: "7" },
        coach: { id: "c1", name: "가온" },
        bookings: [{ id: "b2", start_at: at(2, 19 * 60), end_at: at(2, 19 * 60 + 50), team: true }, { id: "bad" }, { id: "b1", start_at: at(1, 10 * 60), end_at: at(1, 10 * 60 + 50), made_by: "member" }],
        history: [
          { key: "k1", day: "2026-11-10", kind: "lesson", uses: 2, mileage: 2000 },
          { key: "k2", day: "2026-11-09", kind: "모르는 것" },
        ],
      },
      NOW,
    );
    expect(h.today).toBe(TODAY);
    expect(h.ticket.remaining).toBe(7);
    expect(h.bookings.map((b) => b.id)).toEqual(["b1", "b2"]); // 이른 것부터 · 깨진 줄은 버림
    expect(h.bookings[0]).toMatchObject({ day: addDays(TODAY, 1), made_by: "member", team: false });
    expect(h.bookings[1].team).toBe(true);
    expect(h.history).toHaveLength(1);
    expect(h.rules).toEqual({ slotMinutes: 50, minLeadHours: 4, aheadDays: 14, mileage: 0, graceMinutes: 10 });
    expect(normalizePtHome({ on: true, ticket: { remaining: -1 } }, NOW).ticket.remaining).toBeNull();
  });
  it("카드를 그릴까 — PT 회원이거나 살아 있는 예약이 있을 때", () => {
    const base = normalizePtHome({ on: true }, NOW);
    expect(showPtCard(base)).toBe(false);
    expect(showPtCard({ ...base, pt: true })).toBe(true);
    expect(showPtCard(normalizePtHome({ on: true, bookings: [{ id: "b", start_at: at(1, 600), end_at: at(1, 650) }] }, NOW))).toBe(true);
    expect(showPtCard(PT_HOME_OFF)).toBe(false);
  });

  const booking = (over: Partial<PtHomeBooking>): PtHomeBooking => ({
    id: "b",
    start_at: at(0, 19 * 60),
    end_at: at(0, 19 * 60 + 50),
    day: TODAY,
    coach: "가온",
    made_by: "coach",
    created_at: new Date(NOW - 3 * 86_400_000).toISOString(),
    team: false,
    ...over,
  });
  it("취소 규칙 — 전날까지 무료 · 당일 차감 · 방금 잡은 예약 10분 · 지난 수업", () => {
    expect(cancelMode(booking({ start_at: at(1, 19 * 60), day: addDays(TODAY, 1) }), TODAY, NOW)).toBe("free");
    expect(cancelMode(booking({}), TODAY, NOW)).toBe("late");
    expect(cancelMode(booking({ made_by: "member", created_at: new Date(NOW - 5 * 60_000).toISOString() }), TODAY, NOW)).toBe("grace");
    expect(cancelMode(booking({ made_by: "member", created_at: new Date(NOW - 11 * 60_000).toISOString() }), TODAY, NOW)).toBe("late");
    // 코치가 방금 넣은 당일 예약은 봐주는 시간이 없다
    expect(cancelMode(booking({ made_by: "coach", created_at: new Date(NOW - 60_000).toISOString() }), TODAY, NOW)).toBe("late");
    expect(cancelMode(booking({ start_at: at(0, 13 * 60) }), TODAY, NOW)).toBe("started");
    expect(canMove(booking({ start_at: at(1, 19 * 60), day: addDays(TODAY, 1) }), TODAY, NOW)).toBe(true);
    expect(canMove(booking({}), TODAY, NOW)).toBe(false);
  });
  it("수업 시간이 된 예약 = 「수업 받았어요」 · 나머지 = 앞으로", () => {
    const h = normalizePtHome(
      {
        on: true,
        bookings: [
          { id: "old", start_at: at(-1, 19 * 60), end_at: at(-1, 19 * 60 + 50) },
          { id: "am", start_at: at(0, 10 * 60), end_at: at(0, 10 * 60 + 50) },
          { id: "next", start_at: at(1, 19 * 60), end_at: at(1, 19 * 60 + 50) },
        ],
      },
      NOW,
    );
    const s = splitBookings(h, NOW);
    expect(s.confirm.map((b) => b.id)).toEqual(["am", "old"]); // 늦은 것부터
    expect(s.upcoming.map((b) => b.id)).toEqual(["next"]);
  });

  const hist = (kind: PtHistoryKind, over: Partial<PtHistoryItem> = {}): PtHistoryItem => ({
    key: kind,
    day: "2026-11-10",
    kind,
    uses: 1,
    start_at: null,
    mileage: 0,
    coach: "가온",
    by: null,
    moved_to: null,
    ...over,
  });
  it("지난 수업 글 — 잘한 것 · 차감 · 그 밖", () => {
    expect(historyView(hist("lesson", { mileage: 1000 }), TODAY)).toEqual({ label: "수업 완료", sub: "+1,000", tone: "good" });
    expect(historyView(hist("lesson", { uses: 2, mileage: 0 }), TODAY)).toEqual({ label: "수업 완료 · 2회", sub: null, tone: "good" });
    expect(historyView(hist("noshow"), TODAY)).toEqual({ label: "미참석", sub: "1회 차감", tone: "warn" });
    expect(historyView(hist("late_cancel"), TODAY)).toEqual({ label: "당일 취소", sub: "1회 차감", tone: "warn" });
    expect(historyView(hist("coach_cancel", { by: "coach" }), TODAY).label).toBe("코치님 사정");
    expect(historyView(hist("coach_cancel", { by: "system" }), TODAY).label).toBe("취소");
    expect(historyView(hist("canceled"), TODAY)).toEqual({ label: "취소", sub: "차감 없음", tone: "plain" });
    expect(historyView(hist("moved", { moved_to: at(1, 19 * 60) }), TODAY).sub).toBe("→ 내일 오후 7:00");
  });
  it("회원 화면 글에는 탓하는 말을 쓰지 않는다('노쇼' → '미참석')", () => {
    const kinds: PtHistoryKind[] = ["lesson", "noshow", "late_cancel", "coach_cancel", "canceled", "moved"];
    const texts = [
      PT_RULE_LINE,
      ...Object.values(CANCEL_COPY).flatMap((c) => [c.title, c.body, c.ok]),
      ...kinds.flatMap((k) => {
        const v = historyView(hist(k), TODAY);
        return [v.label, v.sub ?? ""];
      }),
    ];
    for (const t of texts) expect(t).not.toMatch(/노쇼|무단|벌점|실패/);
  });
  it("이번 달 수업 수 · 적립 · 수업권 총 횟수", () => {
    const h = {
      ...PT_HOME_OFF,
      on: true,
      history: [hist("lesson", { uses: 2, mileage: 2000 }), hist("lesson", { key: "b", day: "2026-11-12", mileage: 1000 }), hist("noshow", { key: "c" }), hist("lesson", { key: "d", day: "2026-10-30", mileage: 1000 })],
    };
    expect(monthLessons(h, "2026-11")).toEqual({ lessons: 3, mileage: 3000 });
    expect(ticketTotal("퍼스널 트레이닝 20회권")).toBe(20);
    expect(ticketTotal("2:1 PT 10회")).toBe(10);
    expect(ticketTotal("자유 이용권")).toBeNull();
    expect(ticketTotal(null)).toBeNull();
  });
});

describe("회원 — 예약할 수 있는 칸", () => {
  const slots = normalizePtSlots({
    on: true,
    coach: { id: "c1", name: "가온" },
    room: 2,
    days: [
      { date: addDays(TODAY, 2), mine: true, slots: [{ at: at(2, 19 * 60), free: true }] },
      {
        date: addDays(TODAY, 1),
        mine: false,
        slots: [
          { at: at(1, 20 * 60), free: true },
          { at: at(1, 10 * 60), free: false },
          { at: at(1, 19 * 60), free: true },
        ],
      },
    ],
  });
  it("날짜 · 시각 순서 · 빈 칸 수", () => {
    expect(slots.days.map((d) => d.date)).toEqual([addDays(TODAY, 1), addDays(TODAY, 2)]);
    expect(slots.days[0].slots.map((s) => kstMinutes(s.at))).toEqual([600, 1140, 1200]);
    expect(freeCount(slots.days[0])).toBe(2);
    expect(freeCount(slots.days[1])).toBe(0); // 그날 내 예약이 있다
    expect(freeCount(slots.days[1], addDays(TODAY, 2))).toBe(1); // 그 예약을 옮기는 중이면 비켜 준다
  });
  it("빈 칸만 오전 · 오후 · 저녁으로", () => {
    const g = freeSlotGroups(slots.days[0]);
    expect(g.map((x) => x.part)).toEqual(["eve"]);
    expect(g[0].slots).toHaveLength(2);
    expect(normalizePtSlots({ on: false }).on).toBe(false);
  });
});

// ───────────────────────── 코치 예약판 ─────────────────────────
const rawBooking = (id: string, coach: string, member: string, name: string, offset: number, min: number, status: string, extra: Record<string, unknown> = {}) => ({
  id,
  coach_staff_id: coach,
  member_user_id: member,
  member_name: name,
  start_at: at(offset, min),
  end_at: at(offset, min + 50),
  day: addDays(TODAY, offset),
  status,
  made_by: "coach",
  ...extra,
});
const board = normalizePtBoard(
  {
    on: true,
    manage: true,
    can_set: true,
    record_on: true,
    today: TODAY,
    settings: { booking_on: true, mileage_on: true, lesson_mileage: 1000, started_on: "2026-11-01", slot_minutes: 50, min_lead_hours: 4, ahead_days: 14 },
    coaches: [
      { id: "c1", name: "가온" },
      { id: "c2", name: "나래" },
    ],
    members: [
      { user_id: "m1", name: "도담", ticket: "퍼스널 트레이닝 20회권", remaining: 5, booked: 1 },
      { user_id: "m2", name: "라온", ticket: "퍼스널 트레이닝 10회권", remaining: 1, booked: 1 },
      { user_id: "m3", name: "마루", label: "마루(아침)", ticket: "2:1 PT 20회권", remaining: null, booked: 1 },
      { user_id: "m4", name: "바다", ticket: null, remaining: null, booked: 0 },
      { user_id: "m5", name: "사랑", ticket: "퍼스널 트레이닝 10회권", remaining: 3, booked: 0 },
    ],
    bookings: [
      rawBooking("b5", "c2", "m1", "도담", 1, 20 * 60, "booked"),
      rawBooking("b1", "c1", "m1", "도담", -1, 19 * 60, "booked"),
      rawBooking("b2", "c1", "m1", "도담", 0, 10 * 60, "done"),
      rawBooking("b3", "c1", "m2", "라온", 0, 19 * 60, "booked", { team_id: "t1" }),
      rawBooking("b4", "c1", "m3", "마루(아침)", 0, 19 * 60, "booked", { team_id: "t1", made_by: "member" }),
      rawBooking("b6", "c1", "m2", "라온", 2, 10 * 60, "canceled"),
      rawBooking("b7", "c1", "m4", "바다", 0, 13 * 60 + 30, "booked"),
      { id: "broken", status: "booked" },
      rawBooking("b8", "c1", "m5", "사랑", 3, 10 * 60, "모르는 상태"),
    ],
    slots: [
      { coach_staff_id: "c1", weekday: 1, start_min: 1080, end_min: 1320 },
      { coach_staff_id: "c1", weekday: 3, start_min: 1080, end_min: 1320 },
      { coach_staff_id: "c2", weekday: 6, start_min: 600, end_min: 780 },
    ],
    attendance: [{ user_id: "m1", date: TODAY, at: at(0, 9 * 60 + 50) }],
  },
  "가나점",
  NOW,
);
const byId = (id: string) => board.bookings.find((b) => b.id === id)!;

describe("코치 예약판 — 읽기 · 묶기", () => {
  it("깨진 줄 · 모르는 상태는 버리고 시각 순으로", () => {
    expect(board.branch).toBe("가나점");
    expect(board.bookings.map((b) => b.id)).toEqual(["b1", "b2", "b7", "b3", "b4", "b5", "b6"]);
    expect(byId("b4").made_by).toBe("member");
    expect(memberLabel(board.members[2])).toBe("마루(아침)");
    expect(memberLabel(board.members[0])).toBe("도담");
    expect(normalizePtBoard({ on: false }, "가나점", NOW)).toMatchObject({ on: false, manage: false, settings: null, bookings: [], members: [] });
  });
  it("팀 PT 는 한 줄", () => {
    const rows = boardRows(board.bookings);
    const team = rows.find((r) => r.key.startsWith("t:t1:"))!;
    expect(team.bookings.map((b) => b.id)).toEqual(["b3", "b4"]);
    expect(rows).toHaveLength(6);
  });
  it("결과가 필요한 지난 예약 · 날짜별 살아 있는 줄 · 건수", () => {
    expect(needsResult(byId("b1"), NOW)).toBe(true);
    expect(needsResult(byId("b7"), NOW)).toBe(false); // 수업 중(14:20 에 끝난다)
    expect(needsResult(byId("b2"), NOW)).toBe(false);
    const v = boardView(board, null, NOW);
    expect(v.pending.map((r) => r.bookings[0].id)).toEqual(["b1"]);
    expect(v.byDay.get(TODAY)!.map((r) => r.bookings.map((b) => b.id).join("+"))).toEqual(["b2", "b7", "b3+b4"]);
    expect(v.countByDay.get(TODAY)).toBe(4);
    expect(v.countByDay.get(addDays(TODAY, 1))).toBe(1);
    expect(v.byDay.has(addDays(TODAY, 2))).toBe(false); // 취소한 줄은 판에서 뺀다
    const c2 = boardView(board, "c2", NOW);
    expect(c2.pending).toHaveLength(0);
    expect(c2.byDay.has(TODAY)).toBe(false);
    expect(c2.countByDay.get(addDays(TODAY, 1))).toBe(1);
  });
  it("입장 표시 · 회원 줄(예약 없는 회원 먼저 → 다음 수업이 가까운 순)", () => {
    expect(enteredOn(board, "m1", TODAY)).toBe(true);
    expect(enteredOn(board, "m2", TODAY)).toBe(false);
    const rows = memberRows(board, null, NOW);
    expect(rows.map((m) => m.user_id)).toEqual(["m5", "m2", "m3", "m1"]); // 수업권 없는 m4 는 없다
    expect(rows[0]).toMatchObject({ noNext: true, next: null, low: false });
    expect(rows[1]).toMatchObject({ noNext: false, low: true, next: at(0, 19 * 60) });
    expect(rows[3].next).toBe(at(1, 20 * 60));
    // 코치로 거르면 그 코치의 다음 수업만
    expect(memberRows(board, "c1", NOW).find((m) => m.user_id === "m1")!.next).toBeNull();
  });
  it("닫기 고르기 — 서버와 같은 판정", () => {
    const kinds = (id: string) => closeOptions(byId(id), TODAY, NOW).map((o) => o.kind);
    expect(kinds("b3")).toEqual(["late_cancel", "coach_cancel"]); // 오늘 · 시작 전
    expect(kinds("b5")).toEqual(["cancel", "coach_cancel"]); // 내일
    expect(kinds("b1")).toEqual(["lesson", "noshow", "late_cancel", "coach_cancel"]); // 지난 수업
    expect(kinds("b7")).toEqual(["lesson", "noshow", "late_cancel", "coach_cancel"]); // 수업 중
    expect(kinds("b2")).toEqual([]);
    expect(closeOptions(byId("b5"), TODAY, NOW)[0].note).toMatch(/차감이 없어요/);
  });
});

describe("코치 예약판 — 넣기", () => {
  const draft = (over: Partial<PtBookDraft> = {}): PtBookDraft => ({ members: ["m1"], date: addDays(TODAY, 1), minute: 19 * 60, weeks: 1, coach: "c1", ...over });
  it("넣기 전 검사 — 서버와 같은 말", () => {
    expect(bookDraftError(draft({ members: [] }), board, NOW)).toBe("회원을 골라 주세요");
    expect(bookDraftError(draft({ members: ["a", "b", "c", "d", "e", "f", "g"] }), board, NOW)).toBe("한 번에 6명까지 넣을 수 있어요");
    expect(bookDraftError(draft({ minute: null }), board, NOW)).toBe("날짜와 시간을 골라 주세요");
    expect(bookDraftError(draft({ date: TODAY, minute: 13 * 60 }), board, NOW)).toBe("지난 시간에는 예약을 넣을 수 없어요");
    expect(bookDraftError(draft({ date: TODAY, minute: 13 * 60 + 55 }), board, NOW)).toBeNull(); // 10분 안은 넣을 수 있다
    expect(bookDraftError(draft({ date: addDays(TODAY, 121) }), board, NOW)).toBe("날짜가 너무 멀어요");
    expect(bookDraftError(draft({ coach: null }), board, NOW)).toBe("담당 코치를 골라 주세요");
    expect(bookDraftError(draft({ coach: null }), { ...board, manage: false }, NOW)).toBeNull(); // 코치는 늘 본인
    expect(bookDraftError(draft(), board, NOW)).toBeNull();
  });
  it("보낼 값", () => {
    expect(bookPayload(draft({ weeks: 4 }), "가나점")).toEqual({ branch: "가나점", coach_staff_id: "c1", members: ["m1"], start_at: at(1, 19 * 60), weeks: 4 });
    expect(bookPayload(draft({ coach: null }), "가나점", { force: true, join: true })).toEqual({ branch: "가나점", members: ["m1"], start_at: at(1, 19 * 60), weeks: 1, force: true, join: true });
  });
  it("저장 결과 한 줄", () => {
    const r = normalizeSaveResult({
      made: 2,
      ids: ["a", "b"],
      skipped: [
        { day: "2026-11-23", reason: "limit", member: "m2" },
        { day: "2026-11-30", reason: "busy" },
        { day: "2026-12-07", reason: "모르는 것" },
      ],
    });
    expect(r.skipped).toHaveLength(2);
    expect(saveSummary(r)).toEqual({ text: "2건 넣었어요 · 1건은 그 시간에 다른 예약이 있어요 · 1건은 남은 횟수를 넘어요", limit: 1, busy: 1, sameDay: 0 });
    expect(saveSummary(normalizeSaveResult({ made: 0, skipped: [{ day: "2026-11-23", reason: "same_day", member: "m1" }] })).text).toBe("1건은 그날 이미 예약이 있어요");
    expect(saveSummary(normalizeSaveResult(null)).text).toBe("넣은 예약이 없어요");
  });
  it("겹치는 시작 시각(수업 길이만큼) — 그 코치 · 살아 있는 예약만", () => {
    const busy = busyMinutes(board, "c1", TODAY, 50);
    expect([...busy].sort((a, b) => a - b)).toEqual([780, 810, 840, 1110, 1140, 1170]);
    expect(busy.has(1080)).toBe(false); // 18:00 ~ 18:50 은 19:00 수업과 안 겹친다
    expect(busy.has(600)).toBe(false); // 끝난 수업(수업함)은 안 본다
    expect(busyMinutes(board, "c1", TODAY, 50, ["b3", "b4"]).has(1140)).toBe(false);
    expect(busyMinutes(board, "c2", TODAY, 50).size).toBe(0);
    expect(busyMinutes(board, "c2", addDays(TODAY, 1), 50).has(1200)).toBe(true);
  });
});

describe("예약 가능 시간(매주)", () => {
  const week = (entries: [number, SlotRange[]][]) => new Map<number, SlotRange[]>(entries);
  const eve: SlotRange = { start_min: 1080, end_min: 1320 };
  it("코치별로 모으기 · 보낼 값", () => {
    const w = slotsOfCoach(board.slots, "c1");
    expect([...w.keys()].sort()).toEqual([1, 3]);
    expect(slotsPayload(w)).toEqual([
      { weekday: 1, start_min: 1080, end_min: 1320 },
      { weekday: 3, start_min: 1080, end_min: 1320 },
    ]);
    expect(slotsOfCoach(board.slots, "없는 코치").size).toBe(0);
  });
  it("한 줄 요약", () => {
    expect(slotSummary(week([]))).toBe("열어 둔 시간이 없어요");
    expect(slotSummary(week([1, 2, 3, 4, 5].map((d) => [d, [eve]])))).toBe("월~금 18:00~22:00");
    expect(slotSummary(week([1, 3, 5].map((d) => [d, [eve]])))).toBe("월·수·금 18:00~22:00");
    expect(slotSummary(week([[1, [eve]], [2, [eve]], [3, [eve]], [6, [{ start_min: 600, end_min: 780 }]]]))).toBe("월·화·수·토 · 요일마다 달라요");
    expect(slotSummary(week([1, 2, 3, 4, 5, 6].map((d) => [d, d === 6 ? [{ start_min: 600, end_min: 780 }] : [eve]])))).toBe("월~토 · 요일마다 달라요");
    const two: SlotRange[] = [
      { start_min: 600, end_min: 720 },
      { start_min: 1080, end_min: 1440 },
    ];
    expect(slotSummary(week([[1, two], [3, two]]))).toBe("월·수 10:00~12:00 외");
    expect(slotSummary(week([[0, [{ start_min: 1200, end_min: 1440 }]]]))).toBe("일 20:00~24:00");
  });
  it("검사", () => {
    expect(slotsError(week([[1, [eve]]]))).toBeNull();
    expect(slotsError(week([[1, [{ start_min: 600, end_min: 600 }]]]))).toBe("시간대를 다시 확인해 주세요");
    expect(slotsError(week([[1, [{ start_min: 615, end_min: 700 }]]]))).toBe("시간대를 다시 확인해 주세요");
    expect(slotsError(week([[1, [{ start_min: 600, end_min: 780 }, { start_min: 720, end_min: 900 }]]]))).toBe("같은 요일의 시간대가 겹쳐요");
    expect(slotsError(week([[1, [{ start_min: 600, end_min: 720 }, { start_min: 720, end_min: 900 }]]]))).toBeNull(); // 맞닿는 것은 된다
    const many = week([0, 1, 2, 3, 4, 5, 6].map((d) => [d, Array.from({ length: 5 }, (_, i) => ({ start_min: 360 + i * 120, end_min: 420 + i * 120 }))]));
    expect(slotsError(many)).toBe("시간대는 28칸까지 넣을 수 있어요");
  });
});

describe("예시 자료 — 실제 화면과 같은 규칙으로 움직인다", () => {
  it("회원: 예약 · 취소 · 시간 바꾸기 · 수업 받았어요", () => {
    const h0 = buildPtHomeSample(NOW);
    expect(h0).toMatchObject({ on: true, pt: true, canBook: true, today: TODAY });
    expect(splitBookings(h0, NOW).confirm.map((b) => b.id)).toEqual(["demo-h0"]);
    const slots = buildPtSlotsSample(h0, NOW);
    expect(slots.on).toBe(true);
    expect(slots.days.every((d) => d.slots.every((s) => !s.free || Date.parse(s.at) >= NOW + 4 * 3600_000))).toBe(true); // 4시간 전까지만

    // 예약 — 남은 자리 하나 줄고, 같은 날 두 번은 막힌다
    const h1 = applyPtHomeDemo(h0, { type: "book", at: at(2, 19 * 60) }, NOW);
    expect(h1.bookings).toHaveLength(h0.bookings.length + 1);
    expect(h1.room).toBe(h0.room - 1);
    expect(() => applyPtHomeDemo(h1, { type: "book", at: at(2, 20 * 60) }, NOW)).toThrow("그날은 이미 PT 예약이 있어요");

    // 전날까지 취소 = 차감 없음
    const h2 = applyPtHomeDemo(h1, { type: "cancel", id: "demo-h2", lateOk: false }, NOW);
    expect(h2.history.find((x) => x.day === addDays(TODAY, 1))?.kind).toBe("canceled");
    expect(h2.room).toBe(h1.room + 1);

    // 당일 취소 = 한 번 더 물어야 하고, 차감으로 남는다 · 당일에는 시간을 못 바꾼다
    expect(() => applyPtHomeDemo(h2, { type: "cancel", id: "demo-h1", lateOk: false }, NOW)).toThrow("1회 차감");
    expect(() => applyPtHomeDemo(h2, { type: "move", id: "demo-h1", at: at(5, 19 * 60) }, NOW)).toThrow("수업 당일에는");
    const h3 = applyPtHomeDemo(h2, { type: "cancel", id: "demo-h1", lateOk: true }, NOW);
    expect(h3.history.find((x) => x.day === TODAY)?.kind).toBe("late_cancel");

    // 시간 바꾸기 — 옛 예약은 지난 수업에 '시간 변경'으로
    const h4 = applyPtHomeDemo(h3, { type: "move", id: "demo-h3", at: at(5, 19 * 60) }, NOW);
    expect(h4.bookings.some((b) => b.day === addDays(TODAY, 5))).toBe(true);
    expect(h4.history.find((x) => x.kind === "moved" && x.day === addDays(TODAY, 4))?.moved_to).toBe(at(5, 19 * 60));

    // 수업 받았어요 — 적립 · 지난 수업으로
    const h5 = applyPtHomeDemo(h4, { type: "confirm", id: "demo-h0" }, NOW);
    expect(h5.mileageTotal).toBe(h4.mileageTotal + 1000);
    expect(h5.bookings.some((b) => b.id === "demo-h0")).toBe(false);
    expect(h5.history.find((x) => x.day === addDays(TODAY, -1) && x.kind === "lesson")).toMatchObject({ mileage: 1000, by: null });
    expect(() => applyPtHomeDemo(h5, { type: "confirm", id: "demo-h4" }, NOW)).toThrow("수업 시간이 되면");
  });

  it("코치: 남은 횟수 · 팀 묶기 · 닫기 · 팀 옮기기", () => {
    const b0 = buildPtBoardSample(NOW, false);
    expect(b0).toMatchObject({ on: true, manage: false, me_staff: "demo-coach-1", can_set: false });
    expect(boardView(b0, b0.me_staff, NOW).pending.map((r) => r.bookings[0].id)).toEqual(["demo-b1"]);
    expect(buildPtBoardSample(NOW, true).coaches).toHaveLength(2);

    // 남은 1회 회원을 매주 4번 → 1건만, 3건은 남은 횟수를 넘는다 → 넘긴 날만 다시(force + join)
    const r1 = applyPtBoardDemo(b0, { type: "save", p: { members: ["demo-m9"], start_at: at(2, 20 * 60), weeks: 4 } }, NOW);
    expect(r1.result?.made).toBe(1);
    expect(r1.result?.skipped.map((x) => x.reason)).toEqual(["limit", "limit", "limit"]);
    const over = r1.result!.skipped[0];
    const r2 = applyPtBoardDemo(r1.board, { type: "save", p: { members: [over.member!], start_at: kstIso(over.day, 20 * 60), weeks: 1, force: true, join: true } }, NOW);
    expect(r2.result).toMatchObject({ made: 1, skipped: [] });
    expect(r2.board.members.find((m) => m.user_id === "demo-m9")?.booked).toBe(2);

    // 같은 시간 — 그냥 넣으면 건너뛰고, 팀으로 묶으면 같은 팀
    const busy = applyPtBoardDemo(b0, { type: "save", p: { members: ["demo-m8"], start_at: at(0, 21 * 60) } }, NOW);
    expect(busy.result).toMatchObject({ made: 0, skipped: [{ reason: "busy" }] });
    const joined = applyPtBoardDemo(b0, { type: "save", p: { members: ["demo-m8"], start_at: at(0, 21 * 60), join: true } }, NOW);
    expect(joined.result?.made).toBe(1);
    const team = joined.board.bookings.filter((x) => x.start_at === at(0, 21 * 60) && x.status === "booked");
    expect(team).toHaveLength(2);
    expect(team[0].team_id).toBeTruthy();
    expect(new Set(team.map((x) => x.team_id)).size).toBe(1);
    // 그날 이미 예약이 있는 회원
    const same = applyPtBoardDemo(b0, { type: "save", p: { members: ["demo-m1"], start_at: at(0, 22 * 60 + 30) } }, NOW);
    expect(same.result).toMatchObject({ made: 0, skipped: [{ reason: "same_day", member: "demo-m1" }] });

    // 닫기 — 수업함 · 두 번은 안 된다
    const closed = applyPtBoardDemo(b0, { type: "close", id: "demo-b1", kind: "lesson" }, NOW).board;
    expect(closed.bookings.find((x) => x.id === "demo-b1")?.status).toBe("done");
    expect(boardView(closed, closed.me_staff, NOW).pending).toHaveLength(0);
    expect(() => applyPtBoardDemo(closed, { type: "close", id: "demo-b1", kind: "noshow" }, NOW)).toThrow("이미 처리된 예약이에요");

    // 팀 옮기기 — 두 줄이 함께, 같은 팀으로
    const moved = applyPtBoardDemo(b0, { type: "save", p: { id: "demo-b5", start_at: at(0, 22 * 60) } }, NOW);
    expect(moved.result?.made).toBe(2);
    expect(moved.board.bookings.filter((x) => ["demo-b5", "demo-b6"].includes(x.id)).every((x) => x.status === "moved")).toBe(true);
    const now22 = moved.board.bookings.filter((x) => x.start_at === at(0, 22 * 60) && x.status === "booked");
    expect(now22.map((x) => x.team_id)).toEqual(["demo-team-1", "demo-team-1"]);
    expect(() => applyPtBoardDemo(b0, { type: "save", p: { id: "demo-b5", start_at: at(0, 20 * 60 + 30) } }, NOW)).toThrow("그 시간에 다른 예약이 있어요");

    // 예약 가능 시간 · 설정
    const slotted = applyPtBoardDemo(b0, { type: "slots", coach: "demo-coach-1", slots: [{ weekday: 1, start_min: 600, end_min: 720 }] }, NOW).board;
    expect(slotSummary(slotsOfCoach(slotted.slots, "demo-coach-1"))).toBe("월 10:00~12:00");
    expect(applyPtBoardDemo(b0, { type: "setting", p: { lesson_mileage: 2000 } }, NOW).board.settings?.lesson_mileage).toBe(2000);
  });
});
