/**
 * 153운영본부 · 「일정」 탭 「할 일」 보기 — 캘린더 3-4단계 (2026-11-14 대표님 「진행」 · 「캘린더 3단계 보고서」 3-4)
 *   DB = 11/08 20261108230818_ops_tasks.sql(표 · 함수) + 3-4 20261114005029_calendar_stage34.sql(맡긴 일 · 팀 · 알림 · 브리핑).
 *   계산 · 글은 여기 한 곳(시험 opsTasks.test.ts) · 자료는 services/opsTaskService.ts · 화면은 components/ops/OpsTasks.tsx.
 *   · 상태 3색 — 파랑 할 일 · 노랑 하는 중 · 회색 끝 (빨강 = 시간이 정해진 일 = 일정 보기의 수업 · PT 그대로)
 *   · 코치님 = 본인 할 일 · 맡겨진 할 일만 · 고정 업무는 그 시각 근무자에게만(관리자는 지점 것 모두) — 서버가 정한다.
 *   · 맡기기(지점 관리자 → 그 지점 팀) · 답장(받은 분 → 맡긴 분, 200자) · 「중요한 일 3개」 · 작성률은 대표님 결정 7대로 없다.
 *   · 돈 숫자 없음 · 시험은 지어낸 이름만.
 */
import { OPS_WEEKDAY, weekdayOf } from "@/lib/opsWork";

export type TaskStatus = "todo" | "doing" | "done";
export type TaskSource = "self" | "preset" | "assigned";

export interface OpsTask {
  id: string;
  title: string;
  memo: string | null;
  kind: "mine" | "delegate";
  effect: number;
  due_on: string | null;
  status: TaskStatus;
  source: TaskSource;
  preset_id: string | null;
  reply: string | null;
  created_by: string;
  /** 남이 넣은 일일 때만 (지점장님 · 대표님 이름) */
  created_by_name: string | null;
  done_at: string | null;
  updated_at: string;
}

/** 내가 맡긴 일 (지점 관리자 화면) */
export interface AssignedTask {
  id: string;
  title: string;
  memo: string | null;
  due_on: string | null;
  status: TaskStatus;
  reply: string | null;
  user_id: string;
  user_name: string;
  done_at: string | null;
  updated_at: string;
}

export interface DutyItem {
  id: string;
  title: string;
  slot: "open" | "close";
  time: string;
  /** 그 시각 근무자가 나인가 */
  mine: boolean;
  people: string[];
  checked: boolean;
  checked_at: string | null;
  checked_by_name: string | null;
}

export interface TaskPreset {
  id: string;
  title: string;
  effect: number;
}

export interface TasksDay {
  /** 서버에 할 일 함수가 있나 (없으면 「할 일」 보기를 숨긴다) */
  available: boolean;
  branch: string;
  manage: boolean;
  me: string;
  date: string;
  today: string;
  tasks: OpsTask[];
  duties: DutyItem[];
  presets: TaskPreset[];
  manualVersion: string | null;
  /** 3-4 — 내가 맡긴 일 · 맡길 수 있는 팀 (지점 관리자만, 서버가 3-4 칸을 보냈을 때만) */
  assigned: AssignedTask[];
  team: Array<{ user_id: string; name: string }>;
}

export const TASKS_OFF: TasksDay = {
  available: false,
  branch: "",
  manage: false,
  me: "",
  date: "",
  today: "",
  tasks: [],
  duties: [],
  presets: [],
  manualVersion: null,
  assigned: [],
  team: [],
};

export interface BoardPerson {
  user_id: string;
  name: string;
  open: number;
  doing: number;
  done_week: number;
  overdue: number;
  assigned_open: number;
  shift_weekdays: number;
}

export interface TaskBoard {
  from: string;
  to: string;
  people: BoardPerson[];
  duties: { due: number; done: number } | null;
}

// ───────────────────────── 정해 둔 값 (서버와 같다) ─────────────────────────
export const TASK_TITLE_MAX = 60;
export const TASK_MEMO_MAX = 300;
export const TASK_REPLY_MAX = 200;
/** 처음 3장 안내를 읽었다는 판 이름 (ops_task_pref_set manual_version) */
export const TASK_GUIDE_VERSION = "v1";

export const TASK_STATUS_META: Record<TaskStatus, { label: string; dot: string; ring: string; text: string }> = {
  todo: { label: "할 일", dot: "bg-sky-500", ring: "border-sky-500", text: "text-sky-700 dark:text-sky-300" },
  doing: { label: "하는 중", dot: "bg-amber-400", ring: "border-amber-400", text: "text-amber-700 dark:text-amber-300" },
  done: { label: "끝", dot: "bg-slate-400", ring: "border-slate-400", text: "text-muted-foreground" },
};
export const TASK_STATUS_ORDER: readonly TaskStatus[] = ["doing", "todo", "done"];

/** 동그라미를 누를 때 — 파랑 → 노랑 → 회색 → 파랑 */
export const nextStatus = (s: TaskStatus): TaskStatus => (s === "todo" ? "doing" : s === "doing" ? "done" : "todo");

/** 처음 3장 — 11/08 「코치 6규칙」을 지금 화면에 있는 것으로 줄였다 */
export const TASK_GUIDE: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: "내 일과 맡길 일을 나눠요",
    body: "수업 · 회원 응대 · 재등록 상담은 내 일이에요. 청소 · 단순 입력처럼 넘길 수 있는 일은 지점장님이 맡겨 주세요.",
  },
  {
    title: "색으로 상태를 봐요",
    body: "파랑 = 할 일 · 노랑 = 하는 중 · 회색 = 끝. 동그라미를 누르면 바뀌어요. 수업 · PT처럼 시간이 정해진 일은 「일」 보기에 있어요.",
  },
  {
    title: "마감 먼저 · 주 하루는 쉬어요",
    body: "마감이 가까운 일부터 해요. 수업 사이 빈 시간엔 짧은 일을 노랑으로 바꿔 끝내요. 일주일에 하루는 완전히 쉬어요.",
  },
];

// ───────────────────────── 서버 값 읽기 ─────────────────────────
type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const ymd = (v: unknown): string | null => {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const status = (v: unknown): TaskStatus => (v === "doing" || v === "done" ? v : "todo");

const readTask = (raw: unknown): OpsTask | null => {
  const r = obj(raw);
  const id = str(r?.id);
  const title = str(r?.title);
  if (!r || !id || !title) return null;
  return {
    id,
    title,
    memo: str(r.memo),
    kind: r.kind === "delegate" ? "delegate" : "mine",
    effect: Math.min(3, Math.max(1, num(r.effect) || 2)),
    due_on: ymd(r.due_on),
    status: status(r.status),
    source: r.source === "assigned" || r.source === "preset" ? r.source : "self",
    preset_id: str(r.preset_id),
    reply: str(r.reply),
    created_by: str(r.created_by) ?? "",
    created_by_name: str(r.created_by_name),
    done_at: str(r.done_at),
    updated_at: str(r.updated_at) ?? "",
  };
};

const readAssigned = (raw: unknown): AssignedTask | null => {
  const r = obj(raw);
  const id = str(r?.id);
  const title = str(r?.title);
  const user = str(r?.user_id);
  if (!r || !id || !title || !user) return null;
  return {
    id,
    title,
    memo: str(r.memo),
    due_on: ymd(r.due_on),
    status: status(r.status),
    reply: str(r.reply),
    user_id: user,
    user_name: str(r.user_name) ?? "팀원",
    done_at: str(r.done_at),
    updated_at: str(r.updated_at) ?? "",
  };
};

const readDuty = (raw: unknown): DutyItem | null => {
  const r = obj(raw);
  const id = str(r?.id);
  const title = str(r?.title);
  if (!r || !id || !title) return null;
  return {
    id,
    title,
    slot: r.slot === "close" ? "close" : "open",
    time: (str(r.time) ?? "").slice(0, 5),
    mine: r.mine === true,
    people: arr(r.people).map((p) => str(p)).filter((p): p is string => !!p),
    checked: r.checked === true,
    checked_at: str(r.checked_at),
    checked_by_name: str(r.checked_by_name),
  };
};

/** ops_tasks_day 답 → 화면 */
export function normalizeTasksDay(raw: unknown): TasksDay {
  const r = obj(raw);
  if (!r) return TASKS_OFF;
  const prefs = obj(r.prefs);
  return {
    available: true,
    branch: str(r.branch) ?? "",
    manage: r.manage === true,
    me: str(r.me) ?? "",
    date: ymd(r.date) ?? "",
    today: ymd(r.today) ?? "",
    tasks: arr(r.tasks).map(readTask).filter((t): t is OpsTask => !!t),
    duties: arr(r.duties).map(readDuty).filter((d): d is DutyItem => !!d),
    presets: arr(r.presets)
      .map((p) => {
        const o = obj(p);
        const id = str(o?.id);
        const title = str(o?.title);
        return o && id && title ? { id, title, effect: Math.min(3, Math.max(1, num(o.effect) || 2)) } : null;
      })
      .filter((p): p is TaskPreset => !!p),
    manualVersion: str(prefs?.manual_version),
    assigned: arr(r.assigned).map(readAssigned).filter((t): t is AssignedTask => !!t),
    team: arr(r.team)
      .map((p) => {
        const o = obj(p);
        const id = str(o?.user_id);
        return o && id ? { user_id: id, name: str(o.name) ?? "팀원" } : null;
      })
      .filter((p): p is { user_id: string; name: string } => !!p),
  };
}

/** ops_task_board 답 → 화면 (작성률 칸 focus_days 는 읽지 않는다 — 대표님 결정 7) */
export function normalizeBoard(raw: unknown): TaskBoard | null {
  const r = obj(raw);
  if (!r) return null;
  const d = obj(r.duties);
  return {
    from: ymd(r.from) ?? "",
    to: ymd(r.to) ?? "",
    people: arr(r.people)
      .map((p) => {
        const o = obj(p);
        const id = str(o?.user_id);
        return o && id
          ? {
              user_id: id,
              name: str(o.name) ?? "팀원",
              open: num(o.open),
              doing: num(o.doing),
              done_week: num(o.done_week),
              overdue: num(o.overdue),
              assigned_open: num(o.assigned_open),
              shift_weekdays: num(o.shift_weekdays),
            }
          : null;
      })
      .filter((p): p is BoardPerson => !!p),
    duties: d && num(d.due) > 0 ? { due: num(d.due), done: num(d.done) } : null,
  };
}

// ───────────────────────── 날짜 글 ─────────────────────────
const daysBetween = (a: string, b: string): number => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
export const addDaysYmd = (d: string, n: number): string => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10);
};
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

export type DueTone = "past" | "today" | "soon" | "later";
/** 마감 한 줄 — 오늘까지 · 내일까지 · 11/18(수)까지 · 지난 마감은 날짜만(빨간 글씨는 화면이) */
export function dueLabel(due: string | null, today: string): { text: string; tone: DueTone } | null {
  if (!due) return null;
  const n = daysBetween(today, due);
  if (n < 0) return { text: `${md(due)}까지`, tone: "past" };
  if (n === 0) return { text: "오늘까지", tone: "today" };
  if (n === 1) return { text: "내일까지", tone: "soon" };
  return { text: `${md(due)}(${OPS_WEEKDAY[weekdayOf(due)]})까지`, tone: n <= 6 ? "soon" : "later" };
}

/** 마감 빨리 고르기 — 오늘 · 내일 · 금요일(이번 주 금요일이 지났으면 다음 주) */
export function quickDues(today: string): Array<{ key: string; label: string; date: string }> {
  const dow = weekdayOf(today); // 0 = 일
  const toFri = (5 - dow + 7) % 7 || 7;
  const fri = addDaysYmd(today, dow === 5 ? 7 : toFri);
  const out = [
    { key: "today", label: "오늘", date: today },
    { key: "tomorrow", label: "내일", date: addDaysYmd(today, 1) },
  ];
  if (fri !== addDaysYmd(today, 1)) out.push({ key: "fri", label: dow === 5 || dow === 6 || dow === 0 ? "다음 주 금" : "금요일", date: fri });
  return out;
}

// ───────────────────────── 묶기 · 달력 점 ─────────────────────────
/** 하는 중 → 할 일 → 끝(36시간 안) — 서버 순서(마감 빠른 순)를 그대로 묶는다 */
export function groupTasks(tasks: readonly OpsTask[]): Record<TaskStatus, OpsTask[]> {
  const g: Record<TaskStatus, OpsTask[]> = { todo: [], doing: [], done: [] };
  for (const t of tasks) g[t.status].push(t);
  return g;
}

/** 달력 칸 — 그날이 마감인 안 끝낸 할 일 */
export function dueByDay(tasks: readonly OpsTask[]): Map<string, OpsTask[]> {
  const m = new Map<string, OpsTask[]>();
  for (const t of tasks) {
    if (t.status === "done" || !t.due_on) continue;
    const list = m.get(t.due_on) ?? [];
    list.push(t);
    m.set(t.due_on, list);
  }
  return m;
}

/** 맡긴 분 한 줄 — '지점장님이 맡김' 같은 표시 (내가 넣은 일이면 null) */
export const fromLine = (t: Pick<OpsTask, "source" | "created_by_name">): string | null =>
  t.source === "assigned" && t.created_by_name ? `${t.created_by_name}님이 맡김` : null;

/** 받은 일 — 제목 · 마감 · 메모는 맡긴 분이 고친다(받은 분은 상태 · 답장) */
export const isAssignedToMe = (t: Pick<OpsTask, "source" | "created_by">, me: string): boolean => t.source === "assigned" && t.created_by !== me;

// ───────────────────────── 넣기 · 고치기 ─────────────────────────
export interface TaskDraft {
  title: string;
  memo: string;
  due: string | null;
  /** null = 나 · 지점 관리자만 다른 분 */
  userId: string | null;
  presetId: string | null;
}

export const emptyTaskDraft = (): TaskDraft => ({ title: "", memo: "", due: null, userId: null, presetId: null });

export const draftFromTask = (t: OpsTask): TaskDraft => ({ title: t.title, memo: t.memo ?? "", due: t.due_on, userId: null, presetId: t.preset_id });

/** 서버(ops_task_save)와 같은 검사 — 통과하면 null */
export function taskDraftError(d: TaskDraft, today: string): string | null {
  const title = d.title.trim();
  if (!title) return "할 일을 적어 주세요";
  if ([...title].length > TASK_TITLE_MAX) return "할 일은 60자까지예요";
  if ([...d.memo.trim()].length > TASK_MEMO_MAX) return "메모는 300자까지예요";
  if (d.due && (d.due < addDaysYmd(today, -31) || d.due > addDaysYmd(today, 366))) return "기한을 다시 골라 주세요";
  return null;
}

/** 보낼 값 — 고칠 때는 그 일의 종류 · 효과 점수를 그대로 (서버가 비우면 기본값으로 바꾼다) */
export function taskPayload(d: TaskDraft, branch: string, edit?: Pick<OpsTask, "id" | "kind" | "effect"> | null): Record<string, unknown> {
  const base: Record<string, unknown> = {
    title: d.title.trim(),
    memo: d.memo.trim() || null,
    due_on: d.due,
  };
  if (edit) return { ...base, id: edit.id, kind: edit.kind, effect: edit.effect };
  return { ...base, branch, ...(d.userId ? { user_id: d.userId } : {}), ...(d.presetId ? { preset_id: d.presetId } : {}) };
}

// ───────────────────────── 지점 관리자 — 이번 주 팀 ─────────────────────────
/** 한 사람 줄 — 숫자 칩(0 은 빼고) + 살펴볼 것 */
export function boardChips(p: BoardPerson): { chips: string[]; flags: string[] } {
  const chips: string[] = [];
  if (p.doing > 0) chips.push(`하는 중 ${p.doing}`);
  if (p.open > 0) chips.push(`할 일 ${p.open}`);
  if (p.done_week > 0) chips.push(`이번 주 끝 ${p.done_week}`);
  const flags: string[] = [];
  if (p.overdue > 0) flags.push(`마감 지남 ${p.overdue}`);
  if (p.shift_weekdays >= 7) flags.push("쉬는 날 없음");
  return { chips, flags };
}

/** 이번 주 고정 업무 체크 — '체크 12 / 15' (없으면 null) */
export const dutyLine = (d: TaskBoard["duties"]): string | null => (d ? `고정 업무 체크 ${d.done} / ${d.due}` : null);
