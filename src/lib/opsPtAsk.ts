/**
 * 153운영본부 · PT 기록 「코치에게 물어보기」 — 글 · 검사 · 짝 찾기 (2026-11-19 대표님 「앱안에서 재우코치님에게 바로 이야기하는 기능」)
 *   대표님 · 지점장이 확인 필요 카드(기록 없는 입장 · 사유 없는 차감 · 차감 대기)에서 그 건만 골라 담당 코치에게 묻고,
 *   코치가 「오늘 PT」 맨 위에서 한 줄로 답하면 그 카드에 답이 달린다. 오류 신고(opsPtReport — 코치 → 관리자)의 반대 방향.
 *   서버: supabase/migrations/20261119114451_ops_pt_asks.sql (검사 말은 서버와 같다 — 시험 opsPtAsk.test.ts 가 지킨다)
 */
import { addDays, mdOf } from "./opsPtRecord";

export type PtAskItem = "entry" | "deduct" | "wait" | "other";
export type PtAskStatus = "open" | "answered";

export interface PtAsk {
  id: string;
  coach_staff_id: string;
  coach_name: string | null;
  asker_name: string | null;
  /** 내가 물은 것 */
  mine: boolean;
  item: PtAskItem;
  event_id: string | null;
  session_id: string | null;
  member_user_id: string | null;
  member_name: string | null;
  about_date: string | null;
  note: string | null;
  status: PtAskStatus;
  answer: string | null;
  answered_at: string | null;
  created_at: string;
}

/** 어느 카드에서 묻는가 — 서버에 그대로 간다 */
export interface PtAskTarget {
  item: PtAskItem;
  event_id?: string | null;
  session_id?: string | null;
  member_user_id?: string | null;
  member_name?: string | null;
  about_date?: string | null;
}

export interface PtAskPayload {
  branch: string;
  coach_staff_id: string;
  item: PtAskItem;
  event_id: string | null;
  session_id: string | null;
  member_user_id: string | null;
  member_name: string | null;
  about_date: string | null;
  note: string;
}

export const PT_ASK_NOTE_MAX = 200;
export const PT_ASK_ANSWER_MAX = 300;

/** 코치 답 예시 — 눌러서 채우고 고쳐 쓴다 */
export const PT_ASK_ANSWER_PRESETS: Record<PtAskItem, readonly string[]> = {
  entry: ["PT 수업이었어요 — 브로제이 차감할게요", "수업이었고 차감은 이미 했어요", "개인 운동이었어요"],
  deduct: ["그날 수업이었어요 — 기록할게요", "전날 수업의 차감이에요", "잘못 뺐어요 — 브로제이에서 되돌릴게요"],
  wait: ["지금 브로제이에서 차감할게요", "이미 차감했어요 — 하루 이틀 뒤 반영돼요", "수업이 아니었어요 — 기록을 지워 주세요"],
  other: ["확인했어요", "확인하고 다시 말씀드릴게요"],
};

/** 무엇을 묻는가 한 줄 — 서버 알림 글과 같은 말 */
export const ptAskQuestion = (t: { item: PtAskItem; member_name?: string | null; about_date?: string | null }): string => {
  const who = [t.member_name, t.about_date ? mdOf(t.about_date) : null].filter(Boolean).join(" ");
  if (t.item === "entry") return `${who} 입장 — PT 수업이었나요?`.trim();
  if (t.item === "deduct") return `${who} 차감 — 어떤 수업이었나요?`.trim();
  if (t.item === "wait") return `${who} 수업 — 브로제이 차감이 안 보여요`.trim();
  return "확인 부탁드려요";
};

export const ptAskPayload = (branch: string, coachId: string, t: PtAskTarget, note: string): PtAskPayload => ({
  branch,
  coach_staff_id: coachId,
  item: t.item,
  event_id: t.event_id ?? null,
  session_id: t.session_id ?? null,
  member_user_id: t.member_user_id ?? null,
  member_name: t.member_name ?? null,
  about_date: t.about_date ?? null,
  note: note.trim(),
});

/** 보내기 전 검사 — 서버와 같은 말 */
export const ptAskNoteError = (item: PtAskItem, note: string): string | null => {
  const n = note.trim();
  if (n.length > PT_ASK_NOTE_MAX) return "한마디는 200자까지 적을 수 있어요";
  if (item === "other" && n.length < 2) return "물어볼 말을 적어 주세요";
  return null;
};
export const ptAskAnswerError = (answer: string): string | null => {
  const a = answer.trim();
  if (a.length < 2) return "답을 적어 주세요";
  if (a.length > PT_ASK_ANSWER_MAX) return "답은 300자까지 적을 수 있어요";
  return null;
};

const same = (a: string | null | undefined, b: string | null | undefined) => (a ?? null) === (b ?? null);

/**
 * 이 카드의 질문 — 열린 것 먼저, 없으면 가장 최근에 답한 것.
 *   차감 · 기록은 id 로, 입장은 회원 + 날짜로 맞춘다. coachId 가 있으면 그 코치에게 물은 것만.
 */
export const ptAskFor = (asks: readonly PtAsk[], t: PtAskTarget, coachId?: string | null): PtAsk | null => {
  const hit = asks.filter(
    (a) =>
      a.item === t.item &&
      (!coachId || a.coach_staff_id === coachId) &&
      (t.item === "deduct"
        ? same(a.event_id, t.event_id)
        : t.item === "wait"
          ? same(a.session_id, t.session_id)
          : same(a.member_user_id, t.member_user_id) && same(a.about_date, t.about_date)),
  );
  if (hit.length === 0) return null;
  const byNew = (x: PtAsk, y: PtAsk) => y.created_at.localeCompare(x.created_at);
  return hit.filter((a) => a.status === "open").sort(byNew)[0] ?? [...hit].sort(byNew)[0];
};

/** 카드 안 한 줄 — 관리자 화면 */
export const ptAskLine = (a: PtAsk): { text: string; tone: "ok" | "warn" } =>
  a.status === "answered"
    ? { text: `${a.coach_name ?? "코치"} 답 · ${a.answer ?? ""}`, tone: "ok" }
    : { text: `${a.coach_name ?? "코치"}님께 물어봤어요 — 답을 기다려요`, tone: "warn" };

/** 코치 화면 — 아직 답하지 않은 질문(오래된 것 먼저) */
export const ptOpenAsks = (asks: readonly PtAsk[], coachId: string | null): PtAsk[] =>
  asks.filter((a) => a.status === "open" && (!coachId || a.coach_staff_id === coachId)).sort((x, y) => x.created_at.localeCompare(y.created_at));

// ───────────────────────── 예시 화면 ─────────────────────────
export type PtAskDemoAction =
  | { type: "send"; p: PtAskPayload }
  | { type: "answer"; id: string; answer: string };

export const buildPtAskSample = (today: string, manage: boolean, coachId: string): PtAsk[] => [
  {
    id: "sample-a1",
    coach_staff_id: coachId,
    coach_name: "예시 코치",
    asker_name: "운영진",
    mine: manage,
    item: "other",
    event_id: null,
    session_id: null,
    member_user_id: null,
    member_name: null,
    about_date: addDays(today, -1),
    note: "어제 저녁 수업 차감 다 하셨는지 한 번 봐 주세요",
    status: "open",
    answer: null,
    answered_at: null,
    created_at: `${today}T09:10:00+09:00`,
  },
];

let demoSeq = 0;
export const applyPtAskDemo = (list: PtAsk[], a: PtAskDemoAction, ctx: { coachId: string }): PtAsk[] => {
  if (a.type === "answer") {
    return list.map((x) => (x.id === a.id ? { ...x, status: "answered", answer: a.answer.trim(), answered_at: new Date().toISOString() } : x));
  }
  const next: PtAsk = {
    id: `sample-an${(demoSeq += 1)}`,
    coach_staff_id: a.p.coach_staff_id || ctx.coachId,
    coach_name: "예시 코치",
    asker_name: "운영진",
    mine: true,
    item: a.p.item,
    event_id: a.p.event_id,
    session_id: a.p.session_id,
    member_user_id: a.p.member_user_id,
    member_name: a.p.member_name,
    about_date: a.p.about_date,
    note: a.p.note || null,
    status: "open",
    answer: null,
    answered_at: null,
    created_at: new Date().toISOString(),
  };
  return [next, ...list];
};
