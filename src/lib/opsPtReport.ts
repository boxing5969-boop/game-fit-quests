/**
 * 153운영본부 · PT 기록 「오류 신고」 — 코치가 기록 · 차감에서 틀린 것을 보면 대표님 · 지점장에게 알린다
 *   (2026-11-12 대표님 「pt 선생님이 볼때 오류가 있으면 오류신고 할수있도록 기능 만들어줘」 · DB 20261112192419_ops_pt_reports.sql)
 *
 *   코치: 기록 한 줄 · 사유 없는 차감 · 차감 대기 · 「오늘 PT」 아래 단추 → 무엇이 틀렸나요 + 실제 수업 날짜 + 메모 → 보내기.
 *   관리자(대표님 · 지점장): 근무자 카드 'PT' 탭 맨 위 「오류 신고」 → [신고대로 고치기](기존 기록 시트로 고친 뒤 '고쳤어요')
 *     · [처리](고쳤어요 · 그대로 둬요 + 한마디) → 보낸 코치에게 알림.
 *   서버는 신고만 저장한다 — 기록을 고치는 길은 기존 ops_pt_session_save · ops_pt_session_void 하나(검사 · 늦은 기록 규칙이 한 곳에).
 *   글(종류 이름 · 막힘 말)은 서버와 같다 — 바꾸면 두 곳을 같이.
 */
import { addDays, isUseKind, mdOf, ptKeyOf, type PtMatchResult, type PtRow } from "./opsPtRecord";

export type PtReportKind = "wrong_date" | "missing" | "not_held" | "wrong_count" | "wrong_member" | "other";
export type PtReportStatus = "open" | "fixed" | "kept";

/** 화면에 보이는 순서 */
export const PT_REPORT_KINDS: PtReportKind[] = ["wrong_date", "missing", "not_held", "wrong_count", "wrong_member", "other"];

/** 서버 _ops_pt_report_kind_label 과 같은 말 */
export const PT_REPORT_KIND_LABEL: Record<PtReportKind, string> = {
  wrong_date: "날짜가 달라요",
  missing: "수업했는데 기록이 없어요",
  not_held: "수업 안 했는데 잡혔어요",
  wrong_count: "횟수가 달라요",
  wrong_member: "회원이 달라요",
  other: "그 밖",
};
/** 고를 때 한 줄 설명 */
export const PT_REPORT_KIND_HINT: Record<PtReportKind, string> = {
  wrong_date: "수업한 날과 다른 날로 적혀 있어요 — 실제 수업 날짜를 골라 주세요",
  missing: "수업을 했는데 기록이나 차감이 안 보여요 — 수업한 날짜를 골라 주세요",
  not_held: "수업 · 노쇼가 아닌데 기록이나 차감이 잡혔어요",
  wrong_count: "차감 횟수가 실제와 달라요 — 몇 회였는지 메모에 적어 주세요",
  wrong_member: "다른 회원으로 잡혔어요 — 누구였는지 메모에 적어 주세요",
  other: "위에 없는 일이에요 — 무엇이 이상한지 적어 주세요",
};
export const PT_REPORT_NOTE_PLACEHOLDER: Record<PtReportKind, string> = {
  wrong_date: "예: 수요일 저녁 8시 수업이었어요",
  missing: "예: 수업 뒤 브로제이 차감도 했어요",
  not_held: "예: 개인 운동만 하고 갔어요",
  wrong_count: "예: 연속 2회 수업이었어요",
  wrong_member: "예: 같은 이름 다른 회원이에요",
  other: "무엇이 이상한지 적어 주세요",
};
export const PT_REPORT_STATUS_LABEL: Record<PtReportStatus, string> = {
  open: "확인 중",
  fixed: "고쳤어요",
  kept: "그대로 둬요",
};
export const PT_REPORT_NOTE_MAX = 300;

/** 실제 수업 날짜를 꼭 골라야 하는 종류 */
export const ptReportNeedsDate = (k: PtReportKind | null) => k === "wrong_date" || k === "missing";

export interface PtReport {
  id: string;
  coach_staff_id: string | null;
  coach_name: string | null;
  reporter_name: string | null;
  /** 내가 보낸 신고 */
  mine: boolean;
  session_id: string | null;
  event_id: string | null;
  member_user_id: string | null;
  /** 이름표가 있으면 이름표 */
  member_name: string | null;
  about_date: string | null;
  kind: PtReportKind;
  right_date: string | null;
  note: string | null;
  status: PtReportStatus;
  reply: string | null;
  handled_at: string | null;
  created_at: string;
  /** 신고한 기록의 지금 모습 */
  session?: { session_date: string; kind: string; status: string; uses: number } | null;
  /** 신고한 차감의 지금 모습 */
  event?: { work_date: string; used: number; before: number | null; after: number | null; status: string } | null;
}

export interface PtReportDraft {
  kind: PtReportKind | null;
  session_id: string | null;
  event_id: string | null;
  member_user_id: string | null;
  member_name: string;
  /** 화면에 보이던 날짜(기록 날짜 · 차감이 잡힌 날) */
  about_date: string | null;
  right_date: string | null;
  note: string;
  /** 관리자가 보낼 때 어느 코치의 PT 인가 */
  coach_staff_id?: string | null;
}

export const emptyPtReportDraft = (more: Partial<PtReportDraft> = {}): PtReportDraft => ({
  kind: null,
  session_id: null,
  event_id: null,
  member_user_id: null,
  member_name: "",
  about_date: null,
  right_date: null,
  note: "",
  ...more,
});

/** 보내기 전 검사 — 서버(ops_pt_report_send)와 같은 말. 문제가 없으면 null */
export const ptReportDraftError = (d: PtReportDraft, ctx: { today: string }): string | null => {
  if (!d.kind) return "무엇이 틀렸는지 골라 주세요";
  const target = !!d.session_id || !!d.event_id;
  if (!target && !d.member_user_id && !d.member_name.trim() && d.kind !== "other") return "회원을 골라 주세요";
  if (ptReportNeedsDate(d.kind) && !d.right_date) return "실제 수업 날짜를 골라 주세요";
  if (d.right_date && d.right_date > ctx.today) return "아직 오지 않은 날은 고를 수 없어요";
  if (d.right_date && d.right_date < addDays(ctx.today, -120)) return "날짜가 너무 멀어요";
  if (d.kind === "wrong_date" && d.right_date && d.right_date === d.about_date) return "지금 날짜와 같아요 — 실제 수업 날짜를 골라 주세요";
  if (d.kind === "other" && d.note.trim().length < 2) return "무엇이 틀렸는지 적어 주세요";
  if (d.note.trim().length > PT_REPORT_NOTE_MAX) return "메모는 300자까지 적을 수 있어요";
  return null;
};

/** 서버에 보내는 모양 */
export type PtReportPayload = ReturnType<typeof ptReportPayload>;
export const ptReportPayload = (branch: string, d: PtReportDraft) => ({
  branch,
  kind: d.kind,
  session_id: d.session_id,
  event_id: d.event_id,
  member_user_id: d.member_user_id,
  member_name: d.member_name.trim(),
  about_date: d.about_date,
  right_date: ptReportNeedsDate(d.kind) || d.right_date ? d.right_date : null,
  note: d.note.trim(),
  ...(d.coach_staff_id ? { coach_staff_id: d.coach_staff_id } : {}),
});

/** "날짜가 달라요 · 11/12 → 11/11" */
export const ptReportLine = (r: Pick<PtReport, "kind" | "about_date" | "right_date">) => {
  const dates =
    r.about_date && r.right_date ? `${mdOf(r.about_date)} → ${mdOf(r.right_date)}` : r.right_date ? mdOf(r.right_date) : r.about_date ? mdOf(r.about_date) : "";
  return [PT_REPORT_KIND_LABEL[r.kind], dates].filter(Boolean).join(" · ");
};

/** "11/12 19:24" (KST) */
export const ptReportStamp = (iso: string) => {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(t);
  const v = (type: string) => p.find((x) => x.type === type)?.value ?? "";
  return `${Number(v("month"))}/${Number(v("day"))} ${v("hour")}:${v("minute")}`;
};

/** 열린 신고 수 — coachId 가 있으면 그 코치 것만 */
export const ptReportOpenCount = (reports: PtReport[] | undefined, coachId: string | null = null) =>
  (reports ?? []).filter((r) => r.status === "open" && (!coachId || r.coach_staff_id === coachId)).length;

/** 관리자가 할 수 있는 고치기
 *   edit = 그 기록의 날짜를 신고한 날로(기록 시트) · new = 신고한 날 수업 기록 넣기 · void = 그 기록 지우기(사유와 함께)
 *   done = 이미 신고대로 되어 있음(처리만 누르면 됨) · null = 앱에서 바로 고칠 수 없는 신고(브로제이 · 메모 확인)
 */
export type PtReportFix =
  | { type: "edit"; row: PtRow; date: string }
  | { type: "new"; member_user_id: string | null; member_name: string; date: string }
  | { type: "void"; row: PtRow }
  | { type: "done"; text: string };

export const ptReportFix = (r: PtReport, res: PtMatchResult | null): PtReportFix | null => {
  if (r.status !== "open" || !res) return null;
  const row = r.session_id ? res.rows.find((x) => x.s.id === r.session_id) ?? null : null;
  if (r.kind === "wrong_date" && r.right_date) {
    if (r.session_id) {
      if (!row) return r.session?.status === "void" ? { type: "done", text: "그 기록은 지워졌어요" } : null;
      if (row.s.session_date === r.right_date) return { type: "done", text: `기록이 ${mdOf(r.right_date)}로 되어 있어요` };
      return { type: "edit", row, date: r.right_date };
    }
  }
  if (r.kind === "missing" || (r.kind === "wrong_date" && !r.session_id)) {
    if (!r.right_date || (!r.member_user_id && !r.member_name)) return null;
    const key = ptKeyOf(r.member_user_id, r.member_name ?? "");
    const has = res.rows.some((x) => x.key === key && x.s.session_date === r.right_date && isUseKind(x.s.kind));
    if (has) return { type: "done", text: `${mdOf(r.right_date)} 수업 기록이 있어요` };
    return { type: "new", member_user_id: r.member_user_id, member_name: r.member_name ?? "", date: r.right_date };
  }
  if (r.kind === "not_held" && r.session_id) {
    if (!row) return r.session?.status === "void" ? { type: "done", text: "그 기록은 지워졌어요" } : null;
    return { type: "void", row };
  }
  return null;
};

/** 고친 뒤 코치에게 갈 한마디 */
export const ptReportFixReply = (fix: PtReportFix) =>
  fix.type === "edit"
    ? `기록 날짜를 ${mdOf(fix.date)}로 고쳤어요`
    : fix.type === "new"
      ? `${mdOf(fix.date)} 수업 기록을 넣었어요`
      : fix.type === "void"
        ? "그 기록을 지웠어요"
        : "확인했어요 — 지금 기록이 맞아요";

// ───────── 예시 화면(?demo=1) — 서버 없이 이 기기 안에서만 ─────────
export const buildPtReportSample = (today: string, manage: boolean, coachId: string): PtReport[] => {
  const at = (n: number, hm: string) => `${addDays(today, n)}T${hm}:00+09:00`;
  const base = { coach_staff_id: coachId, coach_name: "예시 코치", reporter_name: "예시 코치", mine: !manage, event_id: null, handled_at: null, reply: null };
  return [
    {
      ...base,
      id: "sample-r1",
      session_id: null,
      member_user_id: "sample-m4",
      member_name: "오별",
      about_date: null,
      kind: "missing",
      right_date: addDays(today, -2),
      note: "수업 뒤 브로제이 차감도 했어요",
      status: "open",
      created_at: at(0, "09:12"),
      session: null,
      event: null,
    },
    {
      ...base,
      id: "sample-r2",
      session_id: null,
      member_user_id: "sample-m2",
      member_name: "강바다",
      about_date: addDays(today, -6),
      kind: "wrong_count",
      right_date: null,
      note: "연속 2회 수업이었어요",
      status: "fixed",
      reply: "브로제이 차감을 2회로 맞췄어요",
      handled_at: at(-5, "11:20"),
      created_at: at(-6, "21:40"),
      session: null,
      event: null,
    },
  ];
};

export type PtReportDemoAction =
  | { type: "send"; p: PtReportPayload; memberName: string }
  | { type: "resolve"; id: string; status: Exclude<PtReportStatus, "open">; reply: string };

let demoSeq = 0;
export const applyPtReportDemo = (list: PtReport[], a: PtReportDemoAction, ctx: { manage: boolean; coachId: string }): PtReport[] => {
  if (a.type === "resolve") {
    return list.map((r) =>
      r.id === a.id ? { ...r, status: a.status, reply: a.reply.trim() || null, handled_at: new Date().toISOString() } : r,
    );
  }
  const next: PtReport = {
    id: `sample-rn${(demoSeq += 1)}`,
    coach_staff_id: ctx.coachId,
    coach_name: "예시 코치",
    reporter_name: ctx.manage ? "운영진" : "예시 코치",
    mine: true,
    session_id: a.p.session_id,
    event_id: a.p.event_id,
    member_user_id: a.p.member_user_id,
    member_name: a.memberName || a.p.member_name || null,
    about_date: a.p.about_date,
    kind: a.p.kind as PtReportKind,
    right_date: a.p.right_date,
    note: a.p.note || null,
    status: "open",
    reply: null,
    handled_at: null,
    created_at: new Date().toISOString(),
    session: null,
    event: null,
  };
  return [next, ...list];
};
