/**
 * PT 수당 2단계 2-4 — 회원 확인: 차감이 잡혔는데 기록이 없으면 회원에게 묻는다(「네, 맞아요」 · 「아니에요」)
 *   (2026-11-16 대표님 「2-3적용하고 다음작업가자」 · 보고서 https://claude.ai/artifact/Dzy15seo1Y6ZWd2DapywyZ 「회원 알림」 ·
 *    근무 1단계 결정 ⑥ 「회원 차감 알림 + '아니에요' 단추」)
 *
 *   서버(supabase/migrations/20261116195750_ops_pt_member_check.sql)가 묻는다 — 짝지을 기록이 여섯 시간 넘게 없는 차감,
 *   매일 10:55 ~ 20:55 매시, 회원마다 알림 한 통(링크 /home?ptcheck=1). 여기는 모양 · 글 · 검사만.
 *     · 회원(홈 「PT 수업」 카드): ask 답을 기다림 · wait 「아니에요」 — 지점에서 확인 중 · closed 지점의 답(사흘)
 *     · 코치 · 관리자(확인 필요): 사유 없는 차감 카드에 회원 답 한 줄 · 열린 「아니에요」는 지점장 · 대표님이 답하고 닫는다.
 *       닫기 전까지 그 차감과 짝지은 수업은 수당을 보류한다(opsPtPay 「회원 확인 중」 · 짝짓기는 matchPtRecord).
 *   회원 화면에는 '노쇼'를 쓰지 않는다 — '미참석'. 회원 이름 · 금액은 여기 없다(예시는 지어낸 자료).
 */

export type PtCheckAnswer = "yes" | "no";

/** 코치 · 관리자 화면의 한 줄(ops_pt_member_check_list) */
export interface PtMemberCheck {
  id: string;
  event_id: string;
  member_user_id: string;
  /** 차감이 잡힌 날(앱이 알아챈 날) */
  work_date: string;
  /** 물을 때 짝지을 기록이 없던 횟수 */
  used: number;
  coach_staff_id: string | null;
  asked_at: string;
  answer: PtCheckAnswer | null;
  answered_at: string | null;
  /** 「아니에요」 한 줄(선택) */
  note: string | null;
  /** 지점장 · 대표님이 회원에게 보낸 답 */
  reply: string | null;
  closed_at: string | null;
  closed_by_name: string | null;
}

export interface PtCheckMeta {
  /** 이 지점에서 회원 확인을 켰는가 */
  on: boolean;
  started_at: string | null;
  /** 켜고 끌 수 있는가(대표님) */
  can_set: boolean;
  /** 「아니에요」에 답하고 닫을 수 있는가(지점장 · 대표님) */
  can_close: boolean;
}

export interface PtCheckList extends PtCheckMeta {
  checks: PtMemberCheck[];
}

export const PT_ASK_NOTE_MAX = 200;
export const PT_CHECK_REPLY_MAX = 300;

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v : null;
const num = (v: unknown, fallback = 0) =>
  typeof v === "number" && Number.isFinite(v) ? v : Number(v) || fallback;

export const normalizePtCheckList = (raw: unknown): PtCheckList => {
  const r = (raw ?? {}) as Record<string, unknown>;
  const list = Array.isArray(r.checks)
    ? (r.checks as Array<Record<string, unknown>>)
    : [];
  return {
    on: r.on === true,
    started_at: str(r.started_at),
    can_set: r.can_set === true,
    can_close: r.can_close === true,
    checks: list
      .map((x): PtMemberCheck => ({
        id: String(x.id ?? ""),
        event_id: String(x.event_id ?? ""),
        member_user_id: String(x.member_user_id ?? ""),
        work_date: String(x.work_date ?? "").slice(0, 10),
        used: Math.max(1, num(x.used, 1)),
        coach_staff_id: str(x.coach_staff_id),
        asked_at: String(x.asked_at ?? ""),
        answer: x.answer === "yes" || x.answer === "no" ? x.answer : null,
        answered_at: str(x.answered_at),
        note: str(x.note),
        reply: str(x.reply),
        closed_at: str(x.closed_at),
        closed_by_name: str(x.closed_by_name),
      }))
      .filter(
        (c) =>
          !!c.id && !!c.event_id && /^\d{4}-\d{2}-\d{2}$/.test(c.work_date),
      ),
  };
};

/** 열린 「아니에요」 — 지점장 · 대표님이 답하기 전(그 차감과 짝지은 수업은 수당 보류) */
export const isOpenDispute = (c: Pick<PtMemberCheck, "answer" | "closed_at">) =>
  c.answer === "no" && !c.closed_at;

// ───────── 날짜 글(한국 시간) ─────────
/** 'YYYY-MM-DD' 또는 시각 → 「11/20」 */
export const ptCheckMd = (v: string | null): string => {
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v))
    return `${Number(v.slice(5, 7))}/${Number(v.slice(8, 10))}`;
  const ms = Date.parse(v);
  if (!Number.isFinite(ms)) return "";
  const k = new Date(ms + 9 * 3_600_000);
  return `${k.getUTCMonth() + 1}/${k.getUTCDate()}`;
};
/** 'YYYY-MM-DD' → 「11월 20일」 */
export const ptAskDay = (day: string) =>
  `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일`;

/** 확인 필요 카드의 회원 답 한 줄 */
export const ptCheckLine = (
  c: PtMemberCheck,
): { text: string; tone: "muted" | "ok" | "warn" } => {
  if (c.answer === "yes")
    return {
      text: `회원 확인 · 받은 수업이 맞대요 (${ptCheckMd(c.answered_at)})`,
      tone: "ok",
    };
  if (c.answer === "no") {
    if (c.closed_at)
      return {
        text: `회원 「아니에요」 → ${c.closed_by_name ?? "지점"} 답함 · ${c.reply ?? ""}`.trim(),
        tone: "muted",
      };
    return {
      text: `회원 「아니에요」 (${ptCheckMd(c.answered_at)})${c.note ? ` · “${c.note}”` : ""}`,
      tone: "warn",
    };
  }
  return {
    text: `회원님께 물어봤어요 · ${ptCheckMd(c.asked_at)} — 아직 답 전`,
    tone: "muted",
  };
};

/** 답장 예시 — 누르면 글칸에 들어가고 고쳐서 보낸다 */
export const PT_CHECK_REPLY_PRESETS: readonly string[] = [
  "그날 수업이 맞아요 — 수업 기록을 고쳐 두었어요",
  "당일 취소 규정으로 1회 차감됐어요",
  "미참석 규정으로 1회 차감됐어요",
  "차감을 되돌렸어요 — 남은 횟수가 다시 맞춰져요",
];

/** 지점장 · 대표님 답 검사(서버와 같은 말) */
export const ptReplyError = (reply: string): string | null => {
  const t = reply.trim();
  if (t.length < 2) return "회원님께 보낼 답을 적어 주세요";
  if (t.length > PT_CHECK_REPLY_MAX) return "300자 안으로 적어 주세요";
  return null;
};

// ───────── 회원 화면 ─────────
/** ask 답을 기다림 · wait 「아니에요」 — 지점에서 확인 중 · closed 지점의 답(사흘 동안) */
export type PtAskState = "ask" | "wait" | "closed";

export interface PtDeductAsk {
  id: string;
  work_date: string;
  used: number;
  state: PtAskState;
  note: string | null;
  reply: string | null;
  answered_at: string | null;
  closed_at: string | null;
}

export const normalizePtAsks = (raw: unknown): PtDeductAsk[] =>
  (Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [])
    .map((x): PtDeductAsk => ({
      id: String(x.id ?? ""),
      work_date: String(x.work_date ?? "").slice(0, 10),
      used: Math.max(1, num(x.used, 1)),
      state: x.state === "wait" || x.state === "closed" ? x.state : "ask",
      note: str(x.note),
      reply: str(x.reply),
      answered_at: str(x.answered_at),
      closed_at: str(x.closed_at),
    }))
    .filter((a) => !!a.id && /^\d{4}-\d{2}-\d{2}$/.test(a.work_date));

export const PT_ASK_HINT =
  "수업 기록이 아직 없어서 여쭤봐요. 받으신 수업이 맞나요?";
export const PT_ASK_RULE =
  "당일 취소 · 미참석도 1회 차감돼요 · 차감은 수업 다음 날 확인될 때도 있어요";

/** 띠 한 줄 — ask 「11월 20일에 PT 1회 차감이 확인됐어요」 · wait · closed */
export const ptAskLine = (a: PtDeductAsk): string => {
  if (a.state === "wait")
    return "지점에서 확인하고 있어요 — 확인되면 알려 드릴게요";
  if (a.state === "closed") return a.reply ?? "지점에서 확인했어요";
  return `${ptAskDay(a.work_date)}에 PT ${a.used}회 차감이 확인됐어요`;
};

/** 회원 메모 검사(서버와 같은 말) */
export const ptAskNoteError = (note: string): string | null =>
  note.trim().length > PT_ASK_NOTE_MAX ? "200자 안으로 적어 주세요" : null;

// ───────── 예시(서버를 부르지 않는다 · 지어낸 자료) ─────────
const addDay = (d: string, n: number) =>
  new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000)
    .toISOString()
    .slice(0, 10);

/** 회원 예시 — `/home?ptdemo=1` */
export const buildPtAsksSample = (today: string): PtDeductAsk[] => [
  {
    id: "sample-ask1",
    work_date: addDay(today, -1),
    used: 1,
    state: "ask",
    note: null,
    reply: null,
    answered_at: null,
    closed_at: null,
  },
];

/** 회원 예시에서 답하기 — 「네」는 띠가 사라지고 「아니에요」는 확인 중으로 */
export const applyPtAskDemo = (
  list: PtDeductAsk[],
  id: string,
  answer: PtCheckAnswer,
  note: string | null,
  now = new Date().toISOString(),
): PtDeductAsk[] => {
  const cur = list.find((a) => a.id === id);
  if (!cur || cur.state !== "ask") throw new Error("이미 답해 주셨어요");
  if (answer === "yes") return list.filter((a) => a.id !== id);
  return list.map((a) =>
    a.id === id
      ? {
          ...a,
          state: "wait" as const,
          note: note?.trim() || null,
          answered_at: now,
        }
      : a,
  );
};
