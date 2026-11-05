/**
 * 🧭 153 코치 성향 카드 · 맞춤 피드백 — 화면 규칙 한 곳 (2026-11-05 대표님 「코치님들의 mbti와 심리 상세한 정보를 먼저 획득한 뒤에
 *    … 코치님들이 알아들을 수 있도록 피드백해 주는 기능」)
 *   문항 · 지시문은 supabase/functions/_shared/coachMind.ts 한 곳 — 여기서는 다시 내보내고 화면 모양만 정한다.
 *   DB: supabase/migrations/20261105124544_coach_mind.sql · 오삼코치: supabase/functions/coach-mind
 *   원칙: 기준은 모두에게 같고, 말하는 순서 · 말투 · 예시만 코치님마다 다르다 · 카드는 본인 · 대표님만 · 평가 · 급여 · 근무에 쓰지 않는다
 */
import type { StaffDisplay } from "@/lib/coachGrowth";
import {
  MIND_QUESTIONS,
  type MindAnswers,
  type MindQuestion,
  type MindSummary,
  type NoteBody,
  type NoteCore,
} from "../../supabase/functions/_shared/coachMind.ts";

export {
  MIND_GROUPS,
  MIND_QUESTIONS,
  MBTI_TYPES,
  MIND_NOTE_LIMITS,
  cleanMindAnswers,
  labelOf,
  type MindAnswers,
  type MindQuestion,
  type MindSummary,
  type NoteBody,
  type NoteCore,
  type NotePoint,
} from "../../supabase/functions/_shared/coachMind.ts";

export type MbtiSource = "test" | "guess";

export interface MindProfile {
  mbti: string | null;
  mbti_source: MbtiSource | null;
  answers: MindAnswers;
  note_power: string | null;
  note_know: string | null;
  summary: MindSummary | null;
  summary_at: string | null;
  consent_at: string | null;
  updated_at: string;
}

export interface ReceivedNote {
  id: string;
  note_id: string;
  created_at: string;
  from: StaffDisplay | null;
  core: NoteCore;
  body: NoteBody | null;
  tailored: boolean;
  seen_at: string | null;
  acked_at: string | null;
  reply: string | null;
  reply_at: string | null;
}

export interface TeamMind {
  person: StaffDisplay | null;
  has_mind: boolean;
  mind_at: string | null;
  asked_at: string | null;
  /** 대표님께만 온다 */
  mind?: MindProfile;
}

export interface SentItem {
  id: string;
  person: StaffDisplay | null;
  tailored: boolean;
  /** 보낸 분 · 대표님께만 */
  body: NoteBody | null;
  seen_at: string | null;
  acked_at: string | null;
  /** 보낸 분 · 대표님께만 */
  reply: string | null;
  reply_at: string | null;
}

export interface SentNote {
  id: string;
  created_at: string;
  title: string;
  author: StaffDisplay | null;
  mine: boolean;
  core: NoteCore | null;
  items: SentItem[];
}

export interface CoachMindState {
  staff: boolean;
  hq?: boolean;
  can_direct?: boolean;
  branch?: string;
  ai?: boolean;
  mine?: MindProfile | null;
  /** 대표님 · 지점장님이 내 카드를 부탁한 때 */
  asked_at?: string | null;
  notes?: ReceivedNote[];
  unseen?: number;
  team?: TeamMind[] | null;
  sent?: SentNote[] | null;
}

/** 한 문항 고르기 — 하나 고르는 문항은 다시 누르면 지우고, 여러 개는 꽉 차면 먼저 고른 것을 밀어낸다 */
export function toggleAnswer(a: MindAnswers, q: MindQuestion, v: string): MindAnswers {
  const next: MindAnswers = { ...a };
  if (q.kind === "one") {
    if (next[q.id] === v) delete next[q.id];
    else next[q.id] = v;
    return next;
  }
  const cur = Array.isArray(next[q.id]) ? [...(next[q.id] as string[])] : [];
  const i = cur.indexOf(v);
  if (i >= 0) cur.splice(i, 1);
  else {
    cur.push(v);
    while (cur.length > (q.max ?? 1)) cur.shift();
  }
  if (cur.length) next[q.id] = cur;
  else delete next[q.id];
  return next;
}

export const isPicked = (a: MindAnswers, q: MindQuestion, v: string): boolean => {
  const cur = a[q.id];
  return Array.isArray(cur) ? cur.includes(v) : cur === v;
};

export const answeredCount = (a: MindAnswers): number =>
  MIND_QUESTIONS.filter((q) => {
    const v = a[q.id];
    return Array.isArray(v) ? v.length > 0 : !!v;
  }).length;

export const requiredDone = (a: MindAnswers): boolean => MIND_QUESTIONS.filter((q) => q.required).every((q) => !!a[q.id]);

/** 문항 하나의 답 — 고른 글 목록 */
export function answerLabels(a: MindAnswers, q: MindQuestion): string[] {
  const v = a[q.id];
  const list = Array.isArray(v) ? v : v ? [v] : [];
  return list.map((x) => q.options.find((o) => o.v === x)?.label ?? "").filter(Boolean);
}

export function noteCounts(items: Array<{ seen_at: string | null; acked_at: string | null; reply: string | null }>) {
  return {
    total: items.length,
    seen: items.filter((i) => !!i.seen_at).length,
    acked: items.filter((i) => !!i.acked_at).length,
    replies: items.filter((i) => !!i.reply).length,
  };
}

export const emptyCore = (): NoteCore => ({ title: "", points: [{ head: "", body: "" }], why: "", checks: [] });

/** 보내도 되는 공통 기준인가 — 제목 하나 + 기준 한 줄 이상 */
export const coreReady = (c: NoteCore | null | undefined): boolean =>
  !!c && !!c.title.trim() && c.points.some((p) => p.head.trim() || p.body.trim());

/** 화면 · 서버에 보낼 공통 기준 — 빈 줄을 뺀다 */
export const tidyCore = (c: NoteCore): NoteCore => ({
  title: c.title.trim(),
  points: c.points.map((p) => ({ head: p.head.trim(), body: p.body.trim() })).filter((p) => p.head || p.body),
  why: c.why.trim(),
  checks: c.checks.map((x) => x.trim()).filter(Boolean),
});

/** '방금' · 'N분 전' · 'N시간 전' · 'M월 D일' */
export function agoKo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const m = Math.floor((now - t) / 60_000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  if (m < 24 * 60) return `${Math.floor(m / 60)}시간 전`;
  const d = new Date(t + 9 * 3600_000);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
}
