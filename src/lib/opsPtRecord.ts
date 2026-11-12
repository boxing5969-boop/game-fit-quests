/**
 * 153운영본부 · PT 기록 1단계 — 코치의 수업 기록을 브로제이 출석 · 차감과 맞춰 보기
 *   (2026-11-11 대표님 「이런 일이 발생하는 일이 없도록 마이복서153에 PT 기록을 하게」 → 「추천대로 진행하자」
 *    · 보고서 https://claude.ai/artifact/Dzy15seo1Y6ZWd2DapywyZ · DB 20261111184433_ops_pt_record.sql)
 *
 *   코치는 수업 1건마다 한 번 기록한다 — 수업 · 노쇼 · 당일취소(이 셋은 수업권 1회 차감) · 일정 변경 · 코치 사정 · 개인 운동.
 *   서버(ops_pt_record)는 자료만 보낸다(기록 · 출석 · 차감). 짝짓기 · 판정은 이 파일 한 곳 — opsPt.ts 와 같은 결.
 *   수당 기준은 아직 그대로(차감 기록) — 여기서는 어긋난 것만 「확인 필요」로 보여 준다.
 *
 *   짝짓기: 회원마다, 차감(앱이 알아챈 날 = work_date)을 이른 것부터
 *     ① 그날에서 이틀 앞까지의 기록 중 가장 이른 것(차감은 회원마다 하루~이틀에 한 번 읽는다)
 *     ② 없으면 더 오래된 기록 중 가장 이른 것 = 늦은 차감(보정)
 *     ③ 그래도 없으면 「사유 없는 차감」. 기록보다 앞선 차감은 그 기록과 짝짓지 않는다.
 *   사유 없는 차감에는 출석으로 어림한 실제 수업 날(guess — 알아채기 전 이틀 안의 입장)을 붙인다(2026-11-12 — 저녁 수업 차감이
 *     다음 날 잡혀 [기록하기]가 차감 날로 저장된 일). 기록 시트는 고른 날 입장이 없으면 앞 이틀의 입장을 알려 준다(ptNearEntry).
 */
import { countsForPay, type OpsPtEvent } from "./opsPt";

export type PtKind = "lesson" | "noshow" | "late_cancel" | "moved" | "coach_cancel" | "self";
export type PtNoEntryReason = "door_open" | "manual" | "other";

/** 차감을 앱이 알아채기까지 걸릴 수 있는 날 수 */
export const PT_LAG_DAYS = 2;
/** 출석 체크 없는 수업 — 한 달에 이 횟수를 넘으면 대표님께 표시 (2026-11-11 대표님 결정 4) */
export const PT_NO_ENTRY_MONTH_LIMIT = 3;

/** 수업권이 1회 차감되는 기록인가 (수업 · 노쇼 · 당일취소) */
export const isUseKind = (k: PtKind) => k === "lesson" || k === "noshow" || k === "late_cancel";

export const PT_KIND_LABEL: Record<PtKind, string> = {
  lesson: "수업",
  noshow: "노쇼",
  late_cancel: "당일취소",
  moved: "일정 변경",
  coach_cancel: "코치 사정",
  self: "개인 운동",
};
/** 기록을 고를 때 한 줄 설명 — 차감 · 수당은 종류가 정한다 */
export const PT_KIND_HINT: Record<PtKind, string> = {
  lesson: "수업을 했어요 · 차감 1회",
  noshow: "연락 없이 안 왔어요 · 차감 1회",
  late_cancel: "수업 당일에 취소했어요 · 차감 1회",
  moved: "전날까지 날짜를 옮겼어요 · 차감 없음",
  coach_cancel: "코치 사정으로 못 했어요 · 차감 없음",
  self: "수업이 아니라 개인 운동이에요",
};
export const PT_REASON_LABEL: Record<PtNoEntryReason, string> = {
  door_open: "문이 열려 있었어요",
  manual: "출석 체크를 못 했어요",
  other: "그 밖",
};

export interface PtRecMember {
  user_id: string;
  /** 앱 이름(별명일 수 있다) */
  name: string;
  /** PT 이름표 — 코치가 알아보는 이름 */
  label: string | null;
  /** 전화 끝 4자리 */
  tail: string;
  ticket: string | null;
  remaining: number | null;
  end_date: string | null;
  checked_at: string | null;
}

export interface PtRecSession {
  id: string;
  member_user_id: string | null;
  member_name: string;
  ticket_name: string | null;
  coach_staff_id: string | null;
  session_date: string;
  kind: PtKind;
  /** 이 기록이 맡는 차감 수(연속 2회 수업이면 2) */
  uses: number;
  moved_to: string | null;
  no_entry_reason: PtNoEntryReason | null;
  note: string | null;
  /** 수업 당일 자정을 넘겨 적음 */
  late: boolean;
  reviewed_at: string | null;
  created_at: string;
  /** coach = 사람이 적음 · auto = 브로제이 차감 + 그날 입장으로 서버가 넣음(2026-11-12 자동 기록). 예전 서버는 없음 = coach */
  source?: "coach" | "auto";
}

export interface PtRecAttendance {
  user_id: string;
  date: string;
  at: string;
}

export interface PtRecordData {
  branch: string;
  /** 이 지점에서 PT 기록을 쓰는가 */
  on: boolean;
  notify?: boolean;
  started_on?: string;
  from?: string;
  to?: string;
  today?: string;
  manage: boolean;
  /** 켜고 끌 수 있는가(대표님) */
  can_set?: boolean;
  /**
   * 자동 기록을 켠 지점(2026-11-12 근무 1단계) — 차감이 잡히면 서버가 입장한 날 '수업'으로 적는다. 코치는 차감만 한다.
   *   차감은 회원마다 하루~이틀에 한 번 읽히므로, 이틀 안의 입장은 「기록 없는 입장」으로 묻지 않는다(차감 기다림).
   */
  auto?: boolean;
  me_staff: string | null;
  /** 예시 자료(?demo=1) — 서버 자료가 아니다 */
  sample?: boolean;
  coaches?: Array<{ id: string; name: string }>;
  members?: PtRecMember[];
  sessions?: PtRecSession[];
  events?: OpsPtEvent[];
  attendance?: PtRecAttendance[];
}

// ───────── 날짜 ─────────
const dayNum = (d: string) => Math.round(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) / 86_400_000);
/** b − a (일) */
export const dayDiff = (a: string, b: string) => dayNum(b) - dayNum(a);
export const addDays = (d: string, n: number) => new Date((dayNum(d) + n) * 86_400_000).toISOString().slice(0, 10);
/** 11/5 */
export const mdOf = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

export const ptKeyOf = (userId: string | null, name: string) => userId ?? `name:${name}`;
/** 화면에 쓰는 이름 — PT 이름표가 있으면 그것, 없으면 앱 이름 */
export const ptMemberName = (m: Pick<PtRecMember, "name" | "label">) => m.label?.trim() || m.name;
/** 이름 아래 한 줄 — 이름표가 있으면 앱 이름, 없으면 전화 끝자리(같은 이름 · 별명을 가리려고) */
export const ptMemberSub = (m: PtRecMember) =>
  m.label && m.label.trim() && m.label.trim() !== m.name ? `앱 이름 ${m.name}` : m.tail ? `…${m.tail}` : "";

// ───────── 짝짓기 ─────────
export interface PtDeduct {
  eventId: string;
  workDate: string;
  /** 수업 날짜 → 앱이 차감을 알아챈 날 */
  days: number;
}

/** ok 기록 · 차감 맞음 / pending 차감 확인 중(이틀 안) / wait 차감 대기 / prestart 시작 전 수업(맞춰 보지 않음) / info 차감 없는 기록 */
export type PtRowState = "ok" | "pending" | "wait" | "prestart" | "info";

export interface PtRow {
  s: PtRecSession;
  key: string;
  name: string;
  /** 그날 첫 입장 시각 — 없으면 null */
  entryAt: string | null;
  deducts: PtDeduct[];
  state: PtRowState;
  /** 이틀을 넘겨 잡힌 차감(보정) */
  lateDeduct: boolean;
  /** 출석 체크 없는 수업 */
  noEntry: boolean;
  /** 출석 체크 없는 수업인데 사유가 없음 */
  needReason: boolean;
  /** 자정을 넘긴 기록 — 지점장 확인 전 */
  needReview: boolean;
  /** 앱 계정이 이어지지 않은 회원(이름만) — 차감은 지점장이 직접 넣는다 */
  untracked: boolean;
  /** 일정 변경 — 옮긴 날이 지났는데 그날 기록이 없음 */
  movedMissing: boolean;
  /** 수업권이 끝나 지점장 확인을 기다리는 차감이 있다(「확인할 것 · PT 수업권 끝남」) — 코치가 할 일은 없다 */
  heldByCheck: boolean;
}

/** 출석으로 어림한 실제 수업 날 — 그날 첫 입장 */
export interface PtGuess {
  date: string;
  at: string;
}

/** 사유 없는 차감 — 짝지을 기록이 없는 차감 */
export interface PtExtra {
  key: string;
  userId: string | null;
  name: string;
  eventId: string;
  workDate: string;
  /** 앱이 차감을 알아챈 시각 */
  detectedAt: string;
  count: number;
  ticket: string | null;
  coachId: string | null;
  /** 이 차감의 수업이었을 법한 입장(차감이 잡힌 날에서 이틀 앞까지 · 알아채기 전 · 그날 기록 없음) — 없으면 null */
  guess: PtGuess | null;
}

/** 기록 없는 입장 — PT 회원이 들어왔는데 그날 기록이 없음(자동 기록을 켠 지점은 이틀이 지나도 차감 · 기록이 없을 때 묻는다) */
export interface PtUnrecorded {
  key: string;
  userId: string;
  name: string;
  date: string;
  at: string;
  isToday: boolean;
  /** 자동 기록을 켠 지점에서 이틀 안의 입장 — 차감이 잡히면 저절로 적힌다(묻지 않는다) */
  waiting: boolean;
}

export interface PtMatchResult {
  today: string;
  startedOn: string;
  /** 자동 기록을 켠 지점 */
  auto: boolean;
  /** 기록(최근 먼저) */
  rows: PtRow[];
  extras: PtExtra[];
  unrecorded: PtUnrecorded[];
}

interface Slot {
  row: PtRow;
  date: string;
  taken: boolean;
}

/** 시각 글 → ms (못 읽으면 NaN) — 서버(+00:00) · 예시(+09:00)가 섞여도 바르게 견준다 */
const msOf = (iso: string) => Date.parse(iso);

/** 회원|날짜 → 첫 입장 지도에서 한 회원의 입장(날짜 순) */
const entriesOf = (entry: Map<string, string>, userId: string): PtGuess[] => {
  const out: PtGuess[] = [];
  for (const [k, at] of entry) {
    const bar = k.lastIndexOf("|");
    if (k.slice(0, bar) === userId) out.push({ date: k.slice(bar + 1), at });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
};

/**
 * 차감의 실제 수업 날 어림 — 차감이 잡힌 날(workDate)에서 이틀 앞까지의 입장 중, 앱이 차감을 알아채기 전(detectedAt)이고
 *   skip(그날 기록이 이미 있음 등)이 아닌 가장 늦은 것. 차감은 회원마다 하루~이틀에 한 번 읽혀 저녁 수업이 다음 날로 잡힌다.
 */
export const ptGuessClassDay = (
  entries: PtGuess[],
  workDate: string,
  detectedAt: string | null | undefined,
  skip: (date: string) => boolean = () => false,
): PtGuess | null => {
  const until = msOf(detectedAt ?? "");
  const limit = Number.isNaN(until) ? msOf(`${addDays(workDate, 1)}T00:00:00+09:00`) : until;
  let best: PtGuess | null = null;
  for (const e of entries) {
    if (e.date > workDate || dayDiff(e.date, workDate) > PT_LAG_DAYS) continue;
    const t = msOf(e.at);
    if (Number.isNaN(t) || t >= limit || skip(e.date)) continue;
    if (!best || e.date > best.date) best = e;
  }
  return best;
};

/**
 * 고른 날 출석이 없을 때 — 그 앞 이틀 안의 입장(그날 기록이 없는 것) 중 가장 늦은 것.
 *   기록 시트가 "11/11(수) 11:52 입장이 있어요 · 그날로 바꾸기"를 띄운다(날짜를 잘못 고르는 일 막기).
 */
export const ptNearEntry = (
  attendance: PtRecAttendance[],
  userId: string | null,
  date: string,
  hasRecord: (date: string) => boolean = () => false,
): PtGuess | null => {
  if (!userId || !date) return null;
  let best: PtGuess | null = null;
  for (const a of attendance) {
    if (a.user_id !== userId || a.date >= date || dayDiff(a.date, date) > PT_LAG_DAYS || hasRecord(a.date)) continue;
    if (!best || a.date > best.date || (a.date === best.date && a.at < best.at)) best = { date: a.date, at: a.at };
  }
  return best;
};

/** 기록 · 출석 · 차감을 맞춰 본다 */
export const matchPtRecord = (data: PtRecordData): PtMatchResult => {
  const today = data.today ?? new Date().toISOString().slice(0, 10);
  const startedOn = data.started_on ?? today;
  const auto = !!data.auto;
  const members = data.members ?? [];
  const sessions = data.sessions ?? [];
  const nameById = new Map(members.map((m) => [m.user_id, ptMemberName(m)]));
  const entry = new Map<string, string>();
  for (const a of data.attendance ?? []) {
    const k = `${a.user_id}|${a.date}`;
    const prev = entry.get(k);
    if (!prev || a.at < prev) entry.set(k, a.at);
  }

  // 기록 → 줄
  const rows: PtRow[] = sessions.map((s) => {
    const entryAt = s.member_user_id ? entry.get(`${s.member_user_id}|${s.session_date}`) ?? null : null;
    const noEntry = s.kind === "lesson" && !!s.member_user_id && !entryAt;
    return {
      s,
      key: ptKeyOf(s.member_user_id, s.member_name),
      name: (s.member_user_id && nameById.get(s.member_user_id)) || s.member_name,
      entryAt,
      deducts: [],
      state: "info" as PtRowState,
      lateDeduct: false,
      noEntry,
      needReason: noEntry && !s.no_entry_reason,
      needReview: s.late && !s.reviewed_at,
      untracked: isUseKind(s.kind) && !s.member_user_id,
      movedMissing: false,
      heldByCheck: false,
    };
  });

  // 회원마다 — 차감되는 기록의 칸(연속 2회면 두 칸) · 차감 1회씩
  const slotsBy = new Map<string, Slot[]>();
  for (const r of [...rows].sort((a, b) => a.s.session_date.localeCompare(b.s.session_date) || a.s.created_at.localeCompare(b.s.created_at))) {
    if (!isUseKind(r.s.kind)) continue;
    const list = slotsBy.get(r.key) ?? [];
    for (let i = 0; i < Math.max(1, r.s.uses || 1); i += 1) list.push({ row: r, date: r.s.session_date, taken: false });
    slotsBy.set(r.key, list);
  }
  const unitsBy = new Map<string, Array<{ e: OpsPtEvent; left: number }>>();
  for (const e of [...(data.events ?? [])].sort((a, b) => a.work_date.localeCompare(b.work_date) || a.detected_at.localeCompare(b.detected_at))) {
    if (!countsForPay(e) || e.used <= 0 || e.work_date < startedOn) continue;
    const k = ptKeyOf(e.member_user_id, e.member_name);
    const list = unitsBy.get(k) ?? [];
    list.push({ e, left: e.used });
    unitsBy.set(k, list);
  }

  // 서버가 창을 잘랐으면(넉 달 넘게 씀) 창 맨 앞 이틀의 차감은 창 밖 기록의 것일 수 있어 묻지 않는다
  const clippedFrom = data.from && data.from > addDays(startedOn, -14) ? data.from : null;
  const extras: PtExtra[] = [];
  for (const [k, units] of unitsBy) {
    const slots = slotsBy.get(k) ?? [];
    const take = (u: { e: OpsPtEvent; left: number }, ok: (s: Slot) => boolean) => {
      while (u.left > 0) {
        const slot = slots.find((s) => !s.taken && ok(s));
        if (!slot) break;
        slot.taken = true;
        slot.row.deducts.push({ eventId: u.e.id, workDate: u.e.work_date, days: dayDiff(slot.date, u.e.work_date) });
        u.left -= 1;
      }
    };
    // ① 제때(이틀 안) — 이른 차감부터, 이른 기록부터
    for (const u of units) take(u, (s) => s.date <= u.e.work_date && dayDiff(s.date, u.e.work_date) <= PT_LAG_DAYS);
    // ② 늦은 차감 — 더 오래된 기록
    for (const u of units) take(u, (s) => s.date < u.e.work_date);
    // ③ 남은 것
    for (const u of units) {
      if (u.left <= 0) continue;
      if (clippedFrom && dayDiff(clippedFrom, u.e.work_date) <= PT_LAG_DAYS) continue;
      extras.push({
        key: k,
        userId: u.e.member_user_id,
        name: (u.e.member_user_id && nameById.get(u.e.member_user_id)) || u.e.member_name,
        eventId: u.e.id,
        workDate: u.e.work_date,
        detectedAt: u.e.detected_at,
        count: u.left,
        ticket: u.e.ticket_name,
        coachId: u.e.coach_staff_id,
        guess: null,
      });
    }
  }

  // 줄 상태
  const usedOn = new Set<string>(); // 회원|날짜 — 그날 어떤 기록이든 있음
  for (const r of rows) usedOn.add(`${r.key}|${r.s.session_date}`);

  // 사유 없는 차감 — 출석으로 실제 수업 날을 어림한다(2026-11-12: 저녁 수업의 차감이 다음 날 잡혀
  //   [기록하기]가 차감 날로 채워진 채 저장된 일). 이른 차감부터, 한 입장은 한 차감에만.
  const minDay = addDays(startedOn, -14);
  const guessed = new Set<string>();
  for (const x of [...extras].sort((a, b) => a.workDate.localeCompare(b.workDate) || a.detectedAt.localeCompare(b.detectedAt))) {
    if (!x.userId) continue;
    const g = ptGuessClassDay(
      entriesOf(entry, x.userId),
      x.workDate,
      x.detectedAt,
      (d) => d < minDay || usedOn.has(`${x.key}|${d}`) || guessed.has(`${x.key}|${d}`),
    );
    if (g) {
      x.guess = g;
      guessed.add(`${x.key}|${g.date}`);
    }
  }
  // 수업권이 끝나 지점장 확인을 기다리는 차감(회원 → 가장 늦은 날)
  const checkOn = new Map<string, string>();
  for (const e of data.events ?? []) {
    if (e.status !== "check") continue;
    const k = ptKeyOf(e.member_user_id, e.member_name);
    if ((checkOn.get(k) ?? "") < e.work_date) checkOn.set(k, e.work_date);
  }
  for (const r of rows) {
    if (isUseKind(r.s.kind)) {
      const need = Math.max(1, r.s.uses || 1);
      if (r.deducts.length >= need) {
        r.state = "ok";
        r.lateDeduct = r.deducts.some((d) => d.days > PT_LAG_DAYS);
      } else if (r.s.session_date < startedOn) r.state = "prestart";
      else if (dayDiff(r.s.session_date, today) <= PT_LAG_DAYS) r.state = "pending";
      else r.state = "wait";
      if (r.state !== "ok" && r.state !== "prestart") r.heldByCheck = (checkOn.get(r.key) ?? "") >= r.s.session_date;
    } else if (r.s.kind === "moved" && r.s.moved_to && r.s.moved_to < today) {
      // 옮긴 날이 지났다 — 그날 기록도 입장도 없으면 알려 준다(입장이 있으면 「기록 없는 입장」이 맡는다)
      const came = !!r.s.member_user_id && entry.has(`${r.s.member_user_id}|${r.s.moved_to}`);
      r.movedMissing = !came && !usedOn.has(`${r.key}|${r.s.moved_to}`);
    }
  }

  // 기록 없는 입장 — 사유 없는 차감이 이미 그날을 묻고 있으면(어림한 날) 한 번만 묻는다
  const unrecorded: PtUnrecorded[] = [];
  for (const [k, at] of entry) {
    const [userId, date] = k.split("|");
    if (date < startedOn || date > today) continue;
    if (usedOn.has(`${userId}|${date}`) || guessed.has(`${userId}|${date}`)) continue;
    unrecorded.push({
      key: userId,
      userId,
      name: nameById.get(userId) ?? "회원",
      date,
      at,
      isToday: date === today,
      waiting: auto && dayDiff(date, today) <= PT_LAG_DAYS,
    });
  }
  unrecorded.sort((a, b) => b.date.localeCompare(a.date) || a.at.localeCompare(b.at));
  extras.sort((a, b) => b.workDate.localeCompare(a.workDate));
  rows.sort((a, b) => b.s.session_date.localeCompare(a.s.session_date) || b.s.created_at.localeCompare(a.s.created_at));
  return { today, startedOn, auto, rows, extras, unrecorded };
};

// ───────── 확인 필요 ─────────
export interface PtCounts {
  /** 출석 체크 없는 수업인데 사유 없음 */
  needReason: number;
  /** 사유 없는 차감(회) */
  extra: number;
  /** 차감 대기(회) */
  wait: number;
  /** 기록 없는 입장(지난 날 · 회원 · 날짜) */
  unrecorded: number;
  /** 옮긴 날 기록 없음 */
  movedMissing: number;
  /** 늦은 기록 — 지점장 확인 전 */
  needReview: number;
  /** 화면 맨 위 숫자 — 코치는 본인이 할 것, 관리자는 늦은 기록 확인까지 */
  total: number;
}

/** 한 코치(coachId) 또는 지점 전체(null)의 확인 필요 */
export const ptCounts = (res: PtMatchResult, coachId: string | null, manage: boolean): PtCounts => {
  const rows = coachId ? res.rows.filter((r) => r.s.coach_staff_id === coachId) : res.rows;
  const extras = coachId ? res.extras.filter((x) => x.coachId === coachId) : res.extras;
  const needReason = rows.filter((r) => r.needReason).length;
  const extra = extras.reduce((n, x) => n + x.count, 0);
  const wait = rows
    .filter((r) => r.state === "wait" && !r.heldByCheck)
    .reduce((n, r) => n + Math.max(1, r.s.uses || 1) - r.deducts.length, 0);
  // 오늘 입장은 아직 묻지 않는다 · 자동 기록을 켠 지점은 이틀 안의 입장도(차감이 잡히면 저절로 적힘)
  const unrecorded = res.unrecorded.filter((u) => !u.isToday && !u.waiting).length;
  const movedMissing = rows.filter((r) => r.movedMissing).length;
  const needReview = rows.filter((r) => r.needReview).length;
  return {
    needReason,
    extra,
    wait,
    unrecorded,
    movedMissing,
    needReview,
    total: needReason + extra + wait + unrecorded + movedMissing + (manage ? needReview : 0),
  };
};

/** 줄 오른쪽 한마디 */
export const ptRowStatus = (r: PtRow): { text: string; tone: "ok" | "warn" | "muted" } => {
  if (r.needReason) return { text: "출석 체크 없음 · 사유 필요", tone: "warn" };
  if (r.heldByCheck) return { text: "수업권 끝남 · 지점장 확인 중", tone: "muted" };
  if (r.state === "wait") return { text: r.untracked ? "차감 직접 넣기" : "차감 대기", tone: "warn" };
  if (r.movedMissing) return { text: "옮긴 날 기록 없음", tone: "warn" };
  if (r.needReview) return { text: "늦은 기록 · 확인 전", tone: "warn" };
  if (r.state === "pending") return { text: "차감 확인 중", tone: "muted" };
  if (r.state === "prestart") return { text: "시작 전 수업", tone: "muted" };
  if (r.state === "ok") {
    const last = r.deducts[r.deducts.length - 1];
    return r.lateDeduct && last ? { text: `늦은 차감 ${mdOf(last.workDate)}`, tone: "muted" } : { text: "차감 확인", tone: "ok" };
  }
  if (r.s.kind === "moved" && r.s.moved_to) return { text: `→ ${mdOf(r.s.moved_to)}`, tone: "muted" };
  return { text: "", tone: "muted" };
};

/** 한 달(YYYY-MM) 견줘 보기 — 지금 수당 기준(차감)과 12월부터의 기준(기록 + 차감), 금액 없이 횟수만 */
export const ptMonthCompare = (res: PtMatchResult, events: OpsPtEvent[], month: string, coachId: string | null) => {
  const ym = month.slice(0, 7);
  const rows = (coachId ? res.rows.filter((r) => r.s.coach_staff_id === coachId) : res.rows).filter((r) => r.s.session_date.startsWith(ym));
  const byDeduct = events
    .filter((e) => countsForPay(e) && e.work_date.startsWith(ym) && (!coachId || e.coach_staff_id === coachId))
    .reduce((n, e) => n + e.used, 0);
  const byRecord = rows.reduce((n, r) => n + (isUseKind(r.s.kind) ? Math.min(r.deducts.length, Math.max(1, r.s.uses || 1)) : 0), 0);
  const noEntry = rows.filter((r) => r.noEntry).length;
  return { byDeduct, byRecord, noEntry, noEntryOver: noEntry > PT_NO_ENTRY_MONTH_LIMIT };
};

// ───────── 오늘 PT ─────────
export interface PtTodayItem {
  key: string;
  userId: string | null;
  name: string;
  sub: string;
  /** 오늘 첫 입장 — 안 들어왔으면 null */
  at: string | null;
  member: PtRecMember | null;
  /** 오늘 기록(차감되는 기록 먼저) */
  row: PtRow | null;
}

/** 오늘 들어온 PT 회원(들어온 순서) + 오늘 기록만 있는 회원 */
export const ptTodayList = (data: PtRecordData, res: PtMatchResult): PtTodayItem[] => {
  const byId = new Map((data.members ?? []).map((m) => [m.user_id, m]));
  const todayRows = res.rows.filter((r) => r.s.session_date === res.today);
  const rowOf = (key: string) => todayRows.find((r) => r.key === key && isUseKind(r.s.kind)) ?? todayRows.find((r) => r.key === key) ?? null;
  const out: PtTodayItem[] = [];
  const seen = new Set<string>();
  const came = (data.attendance ?? []).filter((a) => a.date === res.today).sort((a, b) => a.at.localeCompare(b.at));
  for (const a of came) {
    if (seen.has(a.user_id)) continue;
    seen.add(a.user_id);
    const m = byId.get(a.user_id) ?? null;
    out.push({ key: a.user_id, userId: a.user_id, name: m ? ptMemberName(m) : "회원", sub: m ? ptMemberSub(m) : "", at: a.at, member: m, row: rowOf(a.user_id) });
  }
  for (const r of todayRows) {
    if (seen.has(r.key)) continue;
    seen.add(r.key);
    const m = r.s.member_user_id ? byId.get(r.s.member_user_id) ?? null : null;
    out.push({ key: r.key, userId: r.s.member_user_id, name: r.name, sub: m ? ptMemberSub(m) : "", at: null, member: m, row: rowOf(r.key) });
  }
  return out;
};

// ───────── 넣기 ─────────
export interface PtDraft {
  id?: string;
  member_user_id: string | null;
  member_name: string;
  kind: PtKind;
  session_date: string;
  uses: number;
  moved_to: string | null;
  no_entry_reason: PtNoEntryReason | null;
  note: string;
  coach_staff_id?: string | null;
}

/** 넣기 전 검사 — 서버(ops_pt_session_save)와 같은 말. 문제가 없으면 null */
export const ptDraftError = (d: PtDraft, ctx: { today: string; hasEntry: boolean }): string | null => {
  if (!d.member_user_id && !d.member_name.trim()) return "회원을 골라 주세요";
  if (!d.session_date) return "날짜를 골라 주세요";
  if ((isUseKind(d.kind) || d.kind === "self") && d.session_date > ctx.today) return "아직 오지 않은 날은 적을 수 없어요";
  if (d.kind === "moved") {
    if (!d.moved_to) return "옮긴 날짜를 골라 주세요";
    if (d.moved_to === d.session_date) return "옮긴 날짜가 원래 날짜와 같아요";
  }
  if (d.kind === "lesson" && (d.uses < 1 || d.uses > 4)) return "횟수는 1~4회로 넣어 주세요";
  if (d.kind === "lesson" && !!d.member_user_id && !ctx.hasEntry && !d.no_entry_reason) return "그날 출석 체크가 없어요 — 사유를 골라 주세요";
  return null;
};

/** 서버에 보내는 모양 */
export type PtSavePayload = ReturnType<typeof ptDraftPayload>;
export const ptDraftPayload = (branch: string, d: PtDraft) => ({
  ...(d.id ? { id: d.id } : {}),
  branch,
  member_user_id: d.member_user_id,
  member_name: d.member_name.trim(),
  kind: d.kind,
  session_date: d.session_date,
  uses: d.kind === "lesson" ? d.uses : 1,
  moved_to: d.kind === "moved" ? d.moved_to : null,
  no_entry_reason: d.kind === "lesson" ? d.no_entry_reason : null,
  note: d.note.trim(),
  ...(d.coach_staff_id ? { coach_staff_id: d.coach_staff_id } : {}),
});
