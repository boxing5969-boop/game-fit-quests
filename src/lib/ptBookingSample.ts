/**
 * PT 예약 — 예시 자료 (지어낸 회원 · 코치). 서버를 부르지 않고 이 기기 안에서만 바뀐다.
 *   회원 화면: /home?ptdemo=1 · 코치 화면: /office?tab=work&demo=1
 *   옛 DB 를 보는 미리보기(preview-*) · DB 적용 전에도 화면을 눌러 볼 수 있게 — 실제 화면과 같은 규칙(lib/ptBooking)으로 움직인다.
 */
import {
  addDays,
  cancelMode,
  isLiveStatus,
  kstDateOf,
  kstDateOfIso,
  kstIso,
  weekdayOf,
  type PtBoard,
  type PtBoardBooking,
  type PtBoardMember,
  type PtBoardSlot,
  type PtBookingStatus,
  type PtCloseKind,
  type PtHistoryItem,
  type PtHome,
  type PtHomeBooking,
  type PtOpenSlots,
  type PtSaveResult,
  type PtSlotDay,
} from "./ptBooking";

const COACH = { id: "demo-coach-1", name: "한결" };
const COACH2 = { id: "demo-coach-2", name: "다온" };
const SLOT_MIN = 50;
const MILEAGE = 1000;

let seq = 0;
const nid = (p: string) => `demo-${p}-${++seq}`;

// ───────────────────────── 회원 ─────────────────────────
const hb = (id: string, date: string, min: number, made: "member" | "coach", createdAgoMin: number, now: number, team = false): PtHomeBooking => ({
  id,
  start_at: kstIso(date, min),
  end_at: kstIso(date, min + SLOT_MIN),
  day: date,
  coach: COACH.name,
  made_by: made,
  created_at: new Date(now - createdAgoMin * 60_000).toISOString(),
  team,
});

export function buildPtHomeSample(now: number = Date.now()): PtHome {
  const today = kstDateOf(now);
  const d = (n: number) => addDays(today, n);
  const bookings: PtHomeBooking[] = [
    hb("demo-h0", d(-1), 19 * 60, "coach", 60 * 24 * 6, now), // 어제 저녁 — 「수업 받았어요」
    hb("demo-h2", d(1), 19 * 60, "coach", 60 * 24 * 3, now),
    hb("demo-h3", d(4), 19 * 60, "coach", 60 * 24 * 3, now),
    hb("demo-h4", d(8), 10 * 60, "member", 60 * 5, now),
  ];
  // 오늘 밤 수업(당일 취소 안내를 볼 수 있게) — 1시간 넘게 남았을 때만
  const tonight = kstIso(today, 21 * 60);
  if (Date.parse(tonight) - now > 3600_000) bookings.push(hb("demo-h1", today, 21 * 60, "coach", 60 * 24 * 2, now));
  bookings.sort((a, b) => a.start_at.localeCompare(b.start_at));
  const hist = (key: string, off: number, kind: PtHistoryItem["kind"], extra: Partial<PtHistoryItem> = {}): PtHistoryItem => ({
    key,
    day: d(off),
    kind,
    uses: 1,
    start_at: kstIso(d(off), 19 * 60),
    mileage: kind === "lesson" ? MILEAGE : 0,
    coach: COACH.name,
    by: null,
    moved_to: null,
    ...extra,
  });
  const history: PtHistoryItem[] = [
    hist("demo-s1", -3, "lesson"),
    hist("demo-c1", -5, "canceled", { by: "member" }),
    hist("demo-s2", -8, "lesson"),
    hist("demo-s3", -10, "lesson"),
    hist("demo-m1", -12, "moved", { by: "member", moved_to: kstIso(d(-10), 19 * 60) }),
    hist("demo-s4", -15, "late_cancel"),
    hist("demo-s5", -17, "lesson"),
    hist("demo-k1", -19, "coach_cancel", { by: "coach" }),
  ];
  const remaining = 13;
  const upcoming = bookings.filter((b) => Date.parse(b.end_at) > now && Date.parse(b.start_at) > now).length;
  return {
    on: true,
    pt: true,
    branch: "153복싱짐 예시점",
    today,
    ticket: { name: "퍼스널 트레이닝 20회권", remaining, endDate: d(75), checkedAt: new Date(now - 5 * 3600_000).toISOString() },
    coach: COACH,
    rules: { slotMinutes: SLOT_MIN, minLeadHours: 4, aheadDays: 14, mileage: MILEAGE, graceMinutes: 10 },
    room: Math.max(0, remaining - upcoming),
    canBook: true,
    bookings,
    history,
    mileageTotal: 4 * MILEAGE,
  };
}

/** 예시 코치가 열어 둔 시간 — 평일 저녁 6 · 7 · 8 · 9시, 토요일 오전 10 · 11시 · 낮 12시 */
const OPEN_MIN: Record<number, number[]> = {
  1: [18 * 60, 19 * 60, 20 * 60, 21 * 60],
  2: [18 * 60, 19 * 60, 20 * 60, 21 * 60],
  3: [18 * 60, 19 * 60, 20 * 60, 21 * 60],
  4: [18 * 60, 19 * 60, 20 * 60, 21 * 60],
  5: [18 * 60, 19 * 60, 20 * 60],
  6: [10 * 60, 11 * 60, 12 * 60],
};
/** 예시에서 다른 회원이 잡아 둔 칸(요일 · 분) */
const TAKEN: [number, number][] = [
  [1, 19 * 60],
  [2, 20 * 60],
  [3, 19 * 60],
  [4, 18 * 60],
  [6, 10 * 60],
];

export function buildPtSlotsSample(home: PtHome, now: number = Date.now()): PtOpenSlots {
  const days: PtSlotDay[] = [];
  const lead = now + home.rules.minLeadHours * 3600_000;
  const mineDays = new Set(home.bookings.map((b) => b.day));
  const mineAt = new Set(home.bookings.map((b) => b.start_at));
  for (let i = 0; i <= home.rules.aheadDays; i++) {
    const date = addDays(home.today, i);
    const wd = weekdayOf(date);
    const slots = (OPEN_MIN[wd] ?? [])
      .map((m) => kstIso(date, m))
      .filter((at) => Date.parse(at) > now)
      .map((at) => ({
        at,
        free: Date.parse(at) >= lead && !mineAt.has(at) && !TAKEN.some(([w, m]) => w === wd && kstIso(date, m) === at),
      }));
    if (slots.length) days.push({ date, mine: mineDays.has(date), slots });
  }
  const upcoming = home.bookings.filter((b) => Date.parse(b.start_at) > now).length;
  return { on: true, coach: home.coach, slotMinutes: home.rules.slotMinutes, room: Math.max(0, (home.ticket.remaining ?? 4) - upcoming), days };
}

export type PtHomeDemoAction =
  | { type: "book"; at: string }
  | { type: "move"; id: string; at: string }
  | { type: "cancel"; id: string; lateOk: boolean }
  | { type: "confirm"; id: string };

/** 예시 화면에서 눌러 보기 — 실제 서버와 같은 규칙. 막히는 경우는 같은 말로 던진다 */
export function applyPtHomeDemo(h: PtHome, a: PtHomeDemoAction, now: number = Date.now()): PtHome {
  const today = kstDateOf(now);
  const withRoom = (x: PtHome): PtHome => {
    const upcoming = x.bookings.filter((b) => Date.parse(b.start_at) > now).length;
    return { ...x, room: Math.max(0, (x.ticket.remaining ?? 4) - upcoming) };
  };
  const newBooking = (at: string): PtHomeBooking => {
    const day = kstDateOfIso(at);
    return {
      id: nid("h"),
      start_at: at,
      end_at: new Date(Date.parse(at) + h.rules.slotMinutes * 60_000).toISOString(),
      day,
      coach: h.coach?.name ?? COACH.name,
      made_by: "member",
      created_at: new Date(now).toISOString(),
      team: false,
    };
  };
  const histOf = (b: PtHomeBooking, kind: PtHistoryItem["kind"], extra: Partial<PtHistoryItem> = {}): PtHistoryItem => ({
    key: nid("hist"),
    day: b.day,
    kind,
    uses: 1,
    start_at: b.start_at,
    mileage: 0,
    coach: b.coach,
    by: "member",
    moved_to: null,
    ...extra,
  });
  const sortHist = (list: PtHistoryItem[]) =>
    [...list].sort((x, y) => y.day.localeCompare(x.day) || (y.start_at ?? "").localeCompare(x.start_at ?? ""));

  if (a.type === "book") {
    if (h.room <= 0) throw new Error("남은 횟수만큼만 예약할 수 있어요");
    if (h.bookings.some((b) => b.day === kstDateOfIso(a.at))) throw new Error("그날은 이미 PT 예약이 있어요");
    return withRoom({ ...h, bookings: [...h.bookings, newBooking(a.at)].sort((x, y) => x.start_at.localeCompare(y.start_at)) });
  }
  const b = h.bookings.find((x) => x.id === a.id);
  if (!b) throw new Error("예약을 찾을 수 없어요");
  const rest = h.bookings.filter((x) => x.id !== a.id);
  if (a.type === "move") {
    const mode = cancelMode(b, today, now, h.rules.graceMinutes);
    if (mode !== "free" && mode !== "grace") throw new Error("수업 당일에는 시간을 바꿀 수 없어요 — 코치님께 말씀해 주세요");
    if (rest.some((x) => x.day === kstDateOfIso(a.at))) throw new Error("그날은 이미 PT 예약이 있어요");
    return withRoom({
      ...h,
      bookings: [...rest, newBooking(a.at)].sort((x, y) => x.start_at.localeCompare(y.start_at)),
      history: sortHist([...h.history, histOf(b, "moved", { moved_to: a.at })]),
    });
  }
  if (a.type === "cancel") {
    const mode = cancelMode(b, today, now, h.rules.graceMinutes);
    if (mode === "started") throw new Error("수업 시간이 지난 예약이에요 — 코치님께 말씀해 주세요");
    if (mode === "late" && !a.lateOk) throw new Error("오늘 수업은 취소하면 1회 차감돼요");
    return withRoom({ ...h, bookings: rest, history: sortHist([...h.history, histOf(b, mode === "late" ? "late_cancel" : "canceled")]) });
  }
  // confirm
  if (Date.parse(b.start_at) > now) throw new Error("수업 시간이 되면 누를 수 있어요");
  return withRoom({
    ...h,
    bookings: rest,
    history: sortHist([...h.history, histOf(b, "lesson", { mileage: h.rules.mileage, by: null })]),
    mileageTotal: h.mileageTotal + h.rules.mileage,
  });
}

// ───────────────────────── 코치 · 지점장 · 대표님 ─────────────────────────
const NAMES: [string, string | null, number, number][] = [
  // 이름 · 이름표 · 남은 횟수 · 수업권 총 횟수
  ["김하늘", null, 13, 20],
  ["이서준", "서준(저녁)", 7, 20],
  ["박지우", null, 18, 20],
  ["최예린", null, 2, 10],
  ["정민호", null, 9, 20],
  ["강수아", null, 15, 20],
  ["윤도현", null, 5, 10],
  ["한소율", null, 20, 20],
  ["오태윤", null, 1, 20],
];
const MEMBER_ID = (i: number) => `demo-m${i + 1}`;

const bb = (
  id: string,
  member: number,
  date: string,
  min: number,
  status: PtBookingStatus,
  now: number,
  extra: Partial<PtBoardBooking> = {},
): PtBoardBooking => ({
  id,
  coach_staff_id: COACH.id,
  member_user_id: MEMBER_ID(member),
  member_name: NAMES[member][1] ?? NAMES[member][0],
  start_at: kstIso(date, min),
  end_at: kstIso(date, min + SLOT_MIN),
  day: date,
  status,
  made_by: "coach",
  team_id: null,
  series_id: null,
  moved_from: null,
  session_id: null,
  confirmed_at: null,
  closed_role: status === "booked" ? null : "coach",
  close_note: null,
  created_at: new Date(now - 3 * 86_400_000).toISOString(),
  ...extra,
});

const withBooked = (members: PtBoardMember[], bookings: PtBoardBooking[], now: number): PtBoardMember[] =>
  members.map((m) => ({
    ...m,
    booked: bookings.filter((b) => b.member_user_id === m.user_id && b.status === "booked" && Date.parse(b.end_at) > now).length,
  }));

export function buildPtBoardSample(now: number = Date.now(), manage = false): PtBoard {
  const today = kstDateOf(now);
  const d = (n: number) => addDays(today, n);
  const members: PtBoardMember[] = NAMES.map(([name, label, remaining, total], i) => ({
    user_id: MEMBER_ID(i),
    name,
    label,
    tail: String(1000 + ((i * 2731) % 9000)),
    ticket: `퍼스널 트레이닝 ${total}회권`,
    remaining,
    end_date: d(40 + i * 9),
    checked_at: new Date(now - (3 + i) * 3600_000).toISOString(),
    booked: 0,
  }));
  const bookings: PtBoardBooking[] = [
    // 어제 — 결과가 아직 없는 예약 하나 · 수업한 예약 하나
    bb("demo-b1", 1, d(-1), 20 * 60, "booked", now),
    bb("demo-b2", 0, d(-1), 19 * 60, "done", now, { closed_role: "member", confirmed_at: new Date(now - 20 * 3600_000).toISOString() }),
    // 오늘
    bb("demo-b3", 2, today, 10 * 60, Date.parse(kstIso(today, 10 * 60 + SLOT_MIN)) <= now ? "done" : "booked", now),
    bb("demo-b4", 4, today, 18 * 60, "booked", now, { made_by: "member" }),
    bb("demo-b5", 5, today, 19 * 60, "booked", now, { team_id: "demo-team-1" }),
    bb("demo-b6", 6, today, 19 * 60, "booked", now, { team_id: "demo-team-1" }),
    bb("demo-b7", 0, today, 21 * 60, "booked", now),
    // 앞으로
    bb("demo-b8", 0, d(1), 19 * 60, "booked", now, { series_id: "demo-series-1" }),
    bb("demo-b9", 3, d(1), 20 * 60, "booked", now),
    bb("demo-b10", 2, d(2), 10 * 60, "booked", now),
    bb("demo-b11", 4, d(3), 18 * 60, "booked", now),
    bb("demo-b12", 0, d(4), 19 * 60, "booked", now, { series_id: "demo-series-1" }),
    bb("demo-b13", 1, d(5), 20 * 60, "booked", now),
    bb("demo-b14", 0, d(8), 19 * 60, "booked", now, { series_id: "demo-series-1" }),
    bb("demo-b15", 5, d(7), 19 * 60, "booked", now, { team_id: "demo-team-2" }),
    bb("demo-b16", 6, d(7), 19 * 60, "booked", now, { team_id: "demo-team-2" }),
    // 지난 결과
    bb("demo-b17", 3, d(-2), 20 * 60, "late_canceled", now, { closed_role: "member" }),
    bb("demo-b18", 4, d(-3), 18 * 60, "canceled", now, { closed_role: "member" }),
  ];
  if (manage) {
    bookings.push(
      bb("demo-b19", 7, today, 20 * 60, "booked", now, { coach_staff_id: COACH2.id }),
      bb("demo-b20", 7, d(2), 20 * 60, "booked", now, { coach_staff_id: COACH2.id }),
    );
  }
  bookings.sort((a, b) => a.start_at.localeCompare(b.start_at));
  const slots: PtBoardSlot[] = Object.entries(OPEN_MIN).map(([wd, mins]) => ({
    id: `demo-slot-${wd}`,
    coach_staff_id: COACH.id,
    weekday: Number(wd),
    start_min: mins[0],
    end_min: mins[mins.length - 1] + 60,
  }));
  return {
    branch: "153복싱짐 예시점",
    on: true,
    manage,
    me_staff: manage ? null : COACH.id,
    can_set: manage,
    record_on: true,
    today,
    settings: { booking_on: true, mileage_on: true, lesson_mileage: MILEAGE, started_on: d(-20), slot_minutes: SLOT_MIN, min_lead_hours: 4, ahead_days: 14 },
    coaches: manage ? [COACH, COACH2] : [COACH],
    members: withBooked(members, bookings, now),
    bookings,
    slots,
    attendance: [
      { user_id: MEMBER_ID(2), date: today, at: kstIso(today, 9 * 60 + 52) },
      { user_id: MEMBER_ID(0), date: d(-1), at: kstIso(d(-1), 18 * 60 + 50) },
    ],
  };
}

export type PtBoardDemoAction =
  | { type: "save"; p: { members?: string[]; start_at: string; weeks?: number; coach_staff_id?: string; id?: string; force?: boolean; join?: boolean } }
  | { type: "close"; id: string; kind: PtCloseKind; note?: string | null }
  | { type: "slots"; coach: string; slots: { weekday: number; start_min: number; end_min: number }[] }
  | { type: "setting"; p: Partial<NonNullable<PtBoard["settings"]>> };

const CLOSE_STATUS: Record<PtCloseKind, PtBookingStatus> = {
  cancel: "canceled",
  coach_cancel: "coach_canceled",
  late_cancel: "late_canceled",
  noshow: "noshow",
  lesson: "done",
};

/** 예시 예약판에서 눌러 보기 — 저장 결과(건너뛴 것)도 서버와 같은 모양으로 돌려준다 */
export function applyPtBoardDemo(board: PtBoard, a: PtBoardDemoAction, now: number = Date.now()): { board: PtBoard; result?: PtSaveResult } {
  const slotMs = (board.settings?.slot_minutes ?? SLOT_MIN) * 60_000;
  const finish = (bookings: PtBoardBooking[], extra: Partial<PtBoard> = {}): PtBoard => {
    const sorted = [...bookings].sort((x, y) => x.start_at.localeCompare(y.start_at));
    return { ...board, ...extra, bookings: sorted, members: withBooked(board.members, sorted, now) };
  };
  if (a.type === "setting") return { board: { ...board, settings: board.settings ? { ...board.settings, ...a.p } : board.settings } };
  if (a.type === "slots") {
    const rest = board.slots.filter((s) => s.coach_staff_id !== a.coach);
    return { board: { ...board, slots: [...rest, ...a.slots.map((s) => ({ ...s, coach_staff_id: a.coach }))] } };
  }
  if (a.type === "close") {
    const b = board.bookings.find((x) => x.id === a.id);
    if (!b || b.status !== "booked") throw new Error("이미 처리된 예약이에요");
    return {
      board: finish(board.bookings.map((x) => (x.id === a.id ? { ...x, status: CLOSE_STATUS[a.kind], closed_role: "coach", close_note: a.note ?? null } : x))),
    };
  }
  // save
  const p = a.p;
  if (p.id) {
    const b = board.bookings.find((x) => x.id === p.id);
    if (!b || b.status !== "booked") throw new Error("예약을 찾을 수 없어요");
    const group = board.bookings.filter((x) => x.status === "booked" && (x.id === b.id || (b.team_id && x.team_id === b.team_id && x.start_at === b.start_at)));
    const ids = group.map((x) => x.id);
    const s = Date.parse(p.start_at);
    const e = s + (Date.parse(b.end_at) - Date.parse(b.start_at));
    if (board.bookings.some((x) => x.status === "booked" && !ids.includes(x.id) && x.coach_staff_id === b.coach_staff_id && Date.parse(x.start_at) < e && Date.parse(x.end_at) > s)) {
      throw new Error("그 시간에 다른 예약이 있어요");
    }
    const moved = group.map((x) => ({ ...x, id: nid("b"), start_at: p.start_at, end_at: new Date(e).toISOString(), day: kstDateOfIso(p.start_at), moved_from: x.id, made_by: "coach" as const }));
    const next = board.bookings.map((x) => (ids.includes(x.id) ? { ...x, status: "moved" as const, closed_role: "coach" as const } : x));
    return { board: finish([...next, ...moved]), result: { made: moved.length, ids: moved.map((x) => x.id), skipped: [] } };
  }
  const coach = p.coach_staff_id ?? board.me_staff ?? board.coaches[0]?.id ?? COACH.id;
  const members = p.members ?? [];
  const weeks = Math.min(Math.max(p.weeks ?? 1, 1), 12);
  let list = [...board.bookings];
  const made: PtBoardBooking[] = [];
  const skipped: PtSaveResult["skipped"] = [];
  const series = weeks > 1 ? nid("series") : null;
  for (let w = 0; w < weeks; w++) {
    const s = Date.parse(p.start_at) + w * 7 * 86_400_000;
    const e = s + slotMs;
    const startIso = new Date(s).toISOString();
    const day = kstDateOf(s);
    const overlap = list.filter((x) => x.status === "booked" && x.coach_staff_id === coach && Date.parse(x.start_at) < e && Date.parse(x.end_at) > s);
    let team: string | null = members.length > 1 ? nid("team") : null;
    if (overlap.length) {
      if (p.join && overlap.every((x) => x.start_at === startIso)) {
        team = overlap.find((x) => x.team_id)?.team_id ?? nid("team");
        list = list.map((x) => (overlap.some((o) => o.id === x.id) ? { ...x, team_id: team } : x));
      } else {
        skipped.push({ day, reason: "busy", member: null });
        continue;
      }
    }
    for (const uid of members) {
      const m = board.members.find((x) => x.user_id === uid);
      const future = list.filter((x) => x.member_user_id === uid && x.status === "booked" && Date.parse(x.end_at) > now).length;
      if (!p.force && (m?.remaining ?? 4) - future <= 0) {
        skipped.push({ day, reason: "limit", member: uid });
        continue;
      }
      if (list.some((x) => x.member_user_id === uid && x.day === day && isLiveStatus(x.status))) {
        skipped.push({ day, reason: "same_day", member: uid });
        continue;
      }
      const nb: PtBoardBooking = {
        id: nid("b"),
        coach_staff_id: coach,
        member_user_id: uid,
        member_name: m ? (m.label ?? m.name) : "회원",
        start_at: startIso,
        end_at: new Date(e).toISOString(),
        day,
        status: "booked",
        made_by: "coach",
        team_id: team,
        series_id: series,
        moved_from: null,
        session_id: null,
        confirmed_at: null,
        closed_role: null,
        close_note: null,
        created_at: new Date(now).toISOString(),
      };
      list.push(nb);
      made.push(nb);
    }
  }
  return { board: finish(list), result: { made: made.length, ids: made.map((x) => x.id), skipped } };
}
