/**
 * 153운영본부 · PT 기록 — 예시 자료 (지어낸 이름 · 실제 회원 정보 아님)
 *   서버에 함수가 아직 없을 때(DB 적용 전 · 옛 DB 를 보는 preview-* 미리보기)와 `?demo=1` 에서 화면을 채운다.
 *   오늘을 기준으로 날짜를 만든다 — 줄마다 화면의 한 가지 모습(차감 확인 · 확인 중 · 대기 · 사유 없는 차감 · 기록 없는 입장 …).
 *   team: 단체 PT(3단계) 예시 — 그제 4인 팀 수업에 셋(둘 수업 · 하나 미참석) → 수당 줄은 「온유 외 2명」 한 줄 · 팀 1회 수당.
 */
import type { OpsPtEvent, OpsPtRate } from "./opsPt";
import type { PtMemberCheck } from "./opsPtCheck";
import {
  addDays,
  isUseKind,
  ptKeyOf,
  type PtRecAttendance,
  type PtRecMember,
  type PtRecSession,
  type PtRecordData,
  type PtSavePayload,
} from "./opsPtRecord";

export const PT_SAMPLE_COACH = "sample-coach";
/** 예시 수당표 — 지어낸 금액(실제 수당표는 DB 에만) · 「기록 + 차감」 수당 예시(OpsPtPay)에 쓴다 */
export const PT_SAMPLE_RATES: OpsPtRate[] = [
  { team_size: 1, sessions: 10, session_rate: 30000, valid_from: "2026-01-01" },
  { team_size: 1, sessions: 20, session_rate: 30000, valid_from: "2026-01-01" },
  { team_size: 4, sessions: 10, session_rate: 80000, valid_from: "2026-01-01" },
];
const TICKET20 = "퍼스널 트레이닝 20회권";
const TICKET10 = "퍼스널 트레이닝 10회권";
const TEAM10 = "팀PT 4인 10회권";

const MEMBERS: PtRecMember[] = [
  { user_id: "sample-m1", name: "sky_01", label: "한하늘", tail: "1001", ticket: TICKET20, remaining: 12, end_date: null, checked_at: null },
  { user_id: "sample-m2", name: "강바다", label: null, tail: "1002", ticket: TICKET20, remaining: 7, end_date: null, checked_at: null },
  { user_id: "sample-m3", name: "ㄴㅁ", label: "나무", tail: "1003", ticket: TICKET10, remaining: 4, end_date: null, checked_at: null },
  { user_id: "sample-m4", name: "오별", label: null, tail: "1004", ticket: TICKET20, remaining: 15, end_date: null, checked_at: null },
  { user_id: "sample-m5", name: "구름", label: null, tail: "1005", ticket: TICKET10, remaining: 9, end_date: null, checked_at: null },
];
/** 단체 PT 예시 팀원(team 예시에만) */
const TEAM_MEMBERS: PtRecMember[] = [
  { user_id: "sample-t1", name: "온유", label: null, tail: "2001", ticket: TEAM10, remaining: 6, end_date: null, checked_at: null },
  { user_id: "sample-t2", name: "윤슬", label: null, tail: "2002", ticket: TEAM10, remaining: 6, end_date: null, checked_at: null },
  { user_id: "sample-t3", name: "이든", label: null, tail: "2003", ticket: TEAM10, remaining: 7, end_date: null, checked_at: null },
];
const ALL = [...MEMBERS, ...TEAM_MEMBERS];
const nameOf = (id: string) => ALL.find((m) => m.user_id === id)?.name ?? "회원";
const ticketOf = (id: string) => ALL.find((m) => m.user_id === id)?.ticket ?? null;

/**
 * 예시 한 벌 — manage: 관리자 화면(지점 전체) / 코치 화면(본인)
 *   auto: 자동 기록을 켠 지점처럼(2026-11-12 근무 1단계) — 어제 수업 하나가 서버가 넣은 자동 기록 · 이틀 안의 입장은 묻지 않음
 *   team: 단체 PT 예시(3단계)를 더한다 — 화면 예시(`?demo=1`)에서만 켠다(시험의 낱수는 그대로)
 */
export const buildPtSample = (today: string, manage: boolean, opts: { auto?: boolean; team?: boolean } = {}): PtRecordData => {
  const d = (n: number) => addDays(today, n);
  const at = (n: number, hm: string) => `${d(n)}T${hm}:00+09:00`;
  let seq = 0;
  const session = (member: string, day: number, kind: PtRecSession["kind"], more: Partial<PtRecSession> = {}): PtRecSession => ({
    id: `sample-s${(seq += 1)}`,
    member_user_id: member,
    member_name: nameOf(member),
    ticket_name: ticketOf(member),
    coach_staff_id: PT_SAMPLE_COACH,
    session_date: d(day),
    kind,
    uses: 1,
    moved_to: null,
    no_entry_reason: null,
    note: null,
    late: false,
    reviewed_at: null,
    created_at: at(day, "20:10"),
    ...more,
  });
  const event = (member: string, day: number, used = 1): OpsPtEvent => ({
    id: `sample-e${(seq += 1)}`,
    member_user_id: member,
    member_name: nameOf(member),
    ticket_name: ticketOf(member),
    before: null,
    after: null,
    used,
    kind: "used",
    status: "auto",
    coach_staff_id: PT_SAMPLE_COACH,
    work_date: d(day),
    detected_at: at(day, "10:40"),
    note: null,
  });
  const came = (member: string, day: number, hm: string): PtRecAttendance => ({ user_id: member, date: d(day), at: at(day, hm) });
  // 회원 확인(2-4) — 물은 차감 한 줄(지어낸 답)
  const ask = (e: OpsPtEvent, more: Partial<PtMemberCheck>): PtMemberCheck => ({
    id: `sample-k${(seq += 1)}`,
    event_id: e.id,
    member_user_id: e.member_user_id ?? "",
    work_date: e.work_date,
    used: e.used,
    coach_staff_id: e.coach_staff_id,
    asked_at: `${e.work_date}T16:55:00+09:00`,
    answer: null,
    answered_at: null,
    note: null,
    reply: null,
    closed_at: null,
    closed_by_name: null,
    ...more,
  });

  const sessions: PtRecSession[] = [
    session("sample-m2", 0, "lesson"), // 오늘 수업 — 차감 확인 중
    session("sample-m5", 0, "self"), // 오늘 개인 운동
    session(
      "sample-m3",
      -1,
      "lesson",
      opts.auto ? { source: "auto", note: "자동 기록 — 브로제이 차감 + 그날 입장", created_at: at(0, "10:50") } : {},
    ), // 어제 수업 — 차감 확인(자동 기록을 켠 예시는 서버가 넣은 기록)
    session("sample-m2", -2, "lesson"), // 옮겨 온 수업
    session("sample-m4", -3, "lesson"), // 차감 대기
    session("sample-m1", -4, "lesson", { no_entry_reason: "door_open" }), // 출석 체크 없는 수업(사유 있음)
    session("sample-m2", -5, "moved", { moved_to: d(-2) }), // 일정 변경
    session("sample-m3", -6, "noshow"), // 노쇼 — 차감 확인
    session("sample-m1", -7, "lesson", { late: true, created_at: at(-6, "09:05") }), // 늦은 기록 — 지점장 확인 전
  ];
  const events: OpsPtEvent[] = [
    event("sample-m3", 0), // 어제 수업
    event("sample-m2", -1), // 그제 수업
    event("sample-m5", -1), // 사유 없는 차감
    event("sample-m1", -3), // 나흘 전 수업
    event("sample-m3", -5), // 노쇼
    event("sample-m1", -6), // 이레 전 수업
  ];
  const evOf = (member: string, day: number) => events.find((e) => e.member_user_id === member && e.work_date === d(day)) as OpsPtEvent;
  const checks: PtMemberCheck[] = [
    // 사유 없는 차감 — 회원이 「아니에요」(지점장 · 대표님이 답할 차례)
    ask(evOf("sample-m5", -1), { answer: "no", answered_at: at(-1, "19:12"), note: "그날은 개인 운동만 했어요" }),
    // 물은 뒤 코치가 미참석으로 기록한 차감 — 회원은 「아니에요」 → 기록과 맞았어도 답할 때까지 수당 보류
    ask(evOf("sample-m3", -5), { answer: "no", answered_at: at(-4, "08:31"), note: "전날 코치님께 미리 말씀드렸어요" }),
  ];
  const attendance: PtRecAttendance[] = [
    came("sample-m5", 0, "07:32"),
    came("sample-m1", 0, "18:02"), // 오늘 들어옴 — 아직 기록 전
    came("sample-m2", 0, "19:08"),
    came("sample-m3", -1, "19:01"),
    came("sample-m2", -2, "18:58"),
    came("sample-m4", -2, "20:03"), // 기록 없는 입장
    came("sample-m4", -3, "20:01"),
    came("sample-m1", -7, "18:05"),
  ];
  if (opts.team) {
    // 그제 4인 팀 수업 — 온유 · 윤슬 수업, 이든 미참석(차감 셋) → 수당은 수업 한 번(팀 1회)
    sessions.push(
      session("sample-t1", -2, "lesson", { created_at: at(-2, "20:20") }),
      session("sample-t2", -2, "lesson", { created_at: at(-2, "20:21") }),
      session("sample-t3", -2, "noshow", { created_at: at(-2, "20:22") }),
    );
    events.push(event("sample-t1", -2), event("sample-t2", -2), event("sample-t3", -2));
    attendance.push(came("sample-t1", -2, "18:56"), came("sample-t2", -2, "19:02"));
  }
  return {
    branch: "예시 지점",
    on: true,
    notify: true,
    auto: !!opts.auto,
    started_on: d(-10),
    from: d(-24),
    to: d(31),
    today,
    manage,
    can_set: manage && !!opts.auto, // 자동 기록 예시는 관리자 예시에 대표님 켜기 · 끄기 칸까지
    me_staff: manage ? null : PT_SAMPLE_COACH,
    sample: true,
    coaches: [{ id: PT_SAMPLE_COACH, name: "예시 코치" }],
    check: { on: true, started_at: at(-10, "10:00"), can_set: manage && !!opts.auto, can_close: manage },
    checks,
    members: opts.team ? ALL : MEMBERS,
    sessions,
    events,
    attendance,
  };
};

// ───────── 예시 화면에서 눌러 보기 — 서버 없이 이 기기 안에서만 바뀐다 ─────────
export type PtDemoAction =
  | { type: "save"; p: PtSavePayload }
  | { type: "void"; id: string }
  | { type: "review"; id: string }
  | { type: "label"; member: string; label: string }
  | { type: "auto"; on: boolean }
  // 회원 확인(2-4) — 「아니에요」에 답하고 닫기 · 켜기 · 끄기
  | { type: "checkClose"; id: string; reply: string }
  | { type: "checkSet"; on: boolean };

let demoSeq = 0;

/** 서버(ops_pt_session_save 등)와 같은 규칙을 흉내 낸다 — 막힐 때는 같은 말로 던진다 */
export const applyPtDemo = (d: PtRecordData, a: PtDemoAction): PtRecordData => {
  const sessions = d.sessions ?? [];
  const today = d.today ?? "";
  if (a.type === "auto") return { ...d, auto: a.on };
  if (a.type === "checkSet") return { ...d, check: { on: a.on, started_at: d.check?.started_at ?? null, can_set: !!d.check?.can_set, can_close: !!d.check?.can_close } };
  if (a.type === "checkClose") {
    const c = (d.checks ?? []).find((x) => x.id === a.id);
    if (!c || c.answer !== "no") throw new Error("회원님이 「아니에요」라고 한 것만 답할 수 있어요");
    if (c.closed_at) throw new Error("이미 답했어요");
    if (a.reply.trim().length < 2) throw new Error("회원님께 보낼 답을 적어 주세요");
    const closed = { ...c, reply: a.reply.trim(), closed_at: new Date().toISOString(), closed_by_name: "예시 지점장" };
    return { ...d, checks: (d.checks ?? []).map((x) => (x.id === a.id ? closed : x)) };
  }
  if (a.type === "void") return { ...d, sessions: sessions.filter((s) => s.id !== a.id) };
  if (a.type === "review") {
    return { ...d, sessions: sessions.map((s) => (s.id === a.id ? { ...s, reviewed_at: new Date().toISOString() } : s)) };
  }
  if (a.type === "label") {
    const label = a.label.trim() || null;
    return { ...d, members: (d.members ?? []).map((m) => (m.user_id === a.member ? { ...m, label } : m)) };
  }
  const p = a.p;
  const old = p.id ? sessions.find((s) => s.id === p.id) ?? null : null;
  const memberId = old ? old.member_user_id : p.member_user_id;
  const member = (d.members ?? []).find((m) => m.user_id === memberId) ?? null;
  const name = old?.member_name ?? member?.name ?? p.member_name;
  const key = ptKeyOf(memberId, name);
  const sameDay = sessions.filter((s) => s.id !== p.id && s.session_date === p.session_date && ptKeyOf(s.member_user_id, s.member_name) === key);
  if (isUseKind(p.kind) && sameDay.some((s) => isUseKind(s.kind))) throw new Error("그날 이 회원 기록이 이미 있어요");
  if (p.kind === "self" && sameDay.some((s) => isUseKind(s.kind))) throw new Error("그날 수업 기록이 이미 있어요");
  const late = isUseKind(p.kind) && !d.manage && p.session_date < today;
  const next: PtRecSession = {
    id: old?.id ?? `sample-n${(demoSeq += 1)}`,
    member_user_id: memberId,
    member_name: name,
    ticket_name: old?.ticket_name ?? member?.ticket ?? null,
    coach_staff_id: old?.coach_staff_id ?? p.coach_staff_id ?? PT_SAMPLE_COACH,
    session_date: p.session_date,
    kind: p.kind,
    uses: p.uses,
    moved_to: p.moved_to,
    no_entry_reason: p.no_entry_reason,
    note: p.note || null,
    late: d.manage ? false : (old?.late ?? false) || late,
    reviewed_at: d.manage ? new Date().toISOString() : (old?.late ?? false) || late ? null : old?.reviewed_at ?? null,
    created_at: old?.created_at ?? new Date().toISOString(),
  };
  const rest = sessions.filter((s) => s.id !== next.id && !(isUseKind(p.kind) && s.kind === "self" && sameDay.includes(s)));
  return { ...d, sessions: [next, ...rest] };
};
