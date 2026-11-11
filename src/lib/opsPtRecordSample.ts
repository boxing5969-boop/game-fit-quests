/**
 * 153운영본부 · PT 기록 — 예시 자료 (지어낸 이름 · 실제 회원 정보 아님)
 *   서버에 함수가 아직 없을 때(DB 적용 전 · 옛 DB 를 보는 preview-* 미리보기)와 `?demo=1` 에서 화면을 채운다.
 *   오늘을 기준으로 날짜를 만든다 — 줄마다 화면의 한 가지 모습(차감 확인 · 확인 중 · 대기 · 사유 없는 차감 · 기록 없는 입장 …).
 */
import type { OpsPtEvent } from "./opsPt";
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
const TICKET20 = "퍼스널 트레이닝 20회권";
const TICKET10 = "퍼스널 트레이닝 10회권";

const MEMBERS: PtRecMember[] = [
  { user_id: "sample-m1", name: "sky_01", label: "한하늘", tail: "1001", ticket: TICKET20, remaining: 12, end_date: null, checked_at: null },
  { user_id: "sample-m2", name: "강바다", label: null, tail: "1002", ticket: TICKET20, remaining: 7, end_date: null, checked_at: null },
  { user_id: "sample-m3", name: "ㄴㅁ", label: "나무", tail: "1003", ticket: TICKET10, remaining: 4, end_date: null, checked_at: null },
  { user_id: "sample-m4", name: "오별", label: null, tail: "1004", ticket: TICKET20, remaining: 15, end_date: null, checked_at: null },
  { user_id: "sample-m5", name: "구름", label: null, tail: "1005", ticket: TICKET10, remaining: 9, end_date: null, checked_at: null },
];
const nameOf = (id: string) => MEMBERS.find((m) => m.user_id === id)?.name ?? "회원";
const ticketOf = (id: string) => MEMBERS.find((m) => m.user_id === id)?.ticket ?? null;

/** 예시 한 벌 — manage: 관리자 화면(지점 전체) / 코치 화면(본인) */
export const buildPtSample = (today: string, manage: boolean): PtRecordData => {
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

  const sessions: PtRecSession[] = [
    session("sample-m2", 0, "lesson"), // 오늘 수업 — 차감 확인 중
    session("sample-m5", 0, "self"), // 오늘 개인 운동
    session("sample-m3", -1, "lesson"), // 어제 수업 — 차감 확인
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
  return {
    branch: "예시 지점",
    on: true,
    notify: true,
    started_on: d(-10),
    from: d(-24),
    to: d(31),
    today,
    manage,
    can_set: false,
    me_staff: manage ? null : PT_SAMPLE_COACH,
    sample: true,
    coaches: [{ id: PT_SAMPLE_COACH, name: "예시 코치" }],
    members: MEMBERS,
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
  | { type: "label"; member: string; label: string };

let demoSeq = 0;

/** 서버(ops_pt_session_save 등)와 같은 규칙을 흉내 낸다 — 막힐 때는 같은 말로 던진다 */
export const applyPtDemo = (d: PtRecordData, a: PtDemoAction): PtRecordData => {
  const sessions = d.sessions ?? [];
  const today = d.today ?? "";
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
