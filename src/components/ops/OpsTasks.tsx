/**
 * 153운영본부 · 「일정」 탭 「할 일」 보기 — 캘린더 3-4단계 (2026-11-14 대표님 「진행」)
 *   내 일정 보기 고르기 한 줄의 마지막 칸 「할 일」 (새 탭 없음) · 알림 링크 /office?tab=plan&todo=1 이면 여기로.
 *   · 처음 3장 안내(「읽었어요」 → ops_task_pref_set v1) · 오늘 고정 업무(그 시각 근무자 · 관리자) · 하는 중 · 할 일 · 끝(36시간)
 *   · 동그라미를 누르면 파랑 → 노랑 → 회색 · 줄을 누르면 시트(고치기 · 맡긴 일이면 상태 · 답장)
 *   · 지점 관리자: 맡긴 일(받은 분 · 상태 · 답장) · 이번 주 팀(숫자 · 마감 지남 · 쉬는 날 없음 · 고정 업무 체크) — 누르면 그분께 맡기기
 *   · 「중요한 일 3개」 · 작성률은 대표님 결정 7대로 없다.
 *   계산 · 글은 src/lib/opsTasks.ts · 자료는 services/opsTaskService.ts.
 */
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, MessageSquare, Plus } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  TASK_GUIDE,
  TASK_MEMO_MAX,
  TASK_REPLY_MAX,
  TASK_STATUS_META,
  TASK_STATUS_ORDER,
  TASK_TITLE_MAX,
  boardChips,
  draftFromTask,
  dueLabel,
  dutyLine,
  emptyTaskDraft,
  fromLine,
  groupTasks,
  isAssignedToMe,
  nextStatus,
  quickDues,
  taskDraftError,
  taskPayload,
  type AssignedTask,
  type DueTone,
  type DutyItem,
  type OpsTask,
  type TaskDraft,
  type TaskStatus,
  type TasksDay,
} from "@/lib/opsTasks";
import { mondayOf } from "@/lib/opsPlans";
import {
  useOpsDutyCheck,
  useOpsTaskBoard,
  useOpsTaskGuideRead,
  useOpsTaskRemove,
  useOpsTaskReply,
  useOpsTaskSave,
  useOpsTaskStatus,
} from "@/services/opsTaskService";
import { OpsButton, OpsChip, OpsLabel, OpsSheet, opsInput } from "./OpsParts";

export type TaskSheetTarget =
  | { mode: "new"; userId?: string | null; title?: string; presetId?: string | null; due?: string | null }
  | { mode: "mine"; task: OpsTask }
  | { mode: "assigned"; task: AssignedTask };

const TONE_CLS: Record<DueTone, string> = {
  past: "text-rose-600 dark:text-rose-300",
  today: "text-amber-700 dark:text-amber-300",
  soon: "text-foreground",
  later: "text-muted-foreground",
};

/** 상태 동그라미 — 파랑 테두리(할 일) · 노랑(하는 중) · 회색 + 체크(끝). 누르면 다음 상태 */
const StatusDot = ({ status, title, onClick, disabled }: { status: TaskStatus; title: string; onClick: () => void; disabled?: boolean }) => {
  const meta = TASK_STATUS_META[status];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${title} · ${meta.label} — 누르면 ${TASK_STATUS_META[nextStatus(status)].label}`}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:scale-90 disabled:opacity-50"
    >
      <span className={cn("flex h-6 w-6 items-center justify-center rounded-full border-2", meta.ring, status !== "todo" && meta.dot)}>
        {status === "done" && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} aria-hidden />}
      </span>
    </button>
  );
};

const GroupHead = ({ status, count }: { status: TaskStatus; count: number }) => (
  <p className={cn("mt-4 flex items-center gap-1.5 text-label font-black first:mt-0", TASK_STATUS_META[status].text)}>
    <span className={cn("h-2.5 w-2.5 rounded-full", TASK_STATUS_META[status].dot)} aria-hidden />
    {TASK_STATUS_META[status].label} {count}
  </p>
);

/** 할 일 한 줄 */
const TaskRow = ({
  t,
  me,
  today,
  busy,
  onStatus,
  onOpen,
}: {
  t: OpsTask;
  me: string;
  today: string;
  busy: boolean;
  onStatus: (s: TaskStatus) => void;
  onOpen: () => void;
}) => {
  const due = dueLabel(t.due_on, today);
  const from = fromLine(t);
  const replied = isAssignedToMe(t, me) && !!t.reply;
  const done = t.status === "done";
  return (
    <li className="flex items-center gap-1">
      <StatusDot status={t.status} title={t.title} disabled={busy} onClick={() => onStatus(nextStatus(t.status))} />
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 rounded-xl py-2 pr-1 text-left active:bg-secondary/60">
        <span className="min-w-0 flex-1">
          <span className={cn("block text-body font-bold leading-snug", done ? "text-muted-foreground line-through" : "text-foreground")}>{t.title}</span>
          {(due || from || replied || t.memo) && (
            <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-label">
              {due && !done && <span className={cn("font-bold tabular-nums", TONE_CLS[due.tone])}>{due.text}</span>}
              {from && <span className="text-muted-foreground">{from}</span>}
              {replied && (
                <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                  답장함
                </span>
              )}
              {t.memo && !from && <span className="truncate text-muted-foreground">{t.memo}</span>}
            </span>
          )}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    </li>
  );
};

/** 처음 3장 안내 */
const GuideCard = ({ onRead, busy, read }: { onRead?: () => void; busy?: boolean; read: boolean }) => (
  <div className="mt-3 rounded-2xl bg-secondary/60 p-4">
    <p className="text-body font-black text-foreground">할 일 쓰는 법</p>
    <ol className="mt-2 space-y-2.5">
      {TASK_GUIDE.map((g, i) => (
        <li key={g.title} className="flex gap-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-micro font-black text-background">{i + 1}</span>
          <span className="min-w-0">
            <span className="block text-body font-bold text-foreground">{g.title}</span>
            <span className="block text-label leading-snug text-muted-foreground">{g.body}</span>
          </span>
        </li>
      ))}
    </ol>
    {!read && onRead && (
      <button
        type="button"
        onClick={onRead}
        disabled={busy}
        className="mt-3 h-11 w-full rounded-xl bg-foreground text-body font-black text-background active:scale-[0.99] disabled:opacity-50"
      >
        읽었어요
      </button>
    )}
  </div>
);

/** 오늘 고정 업무 — 오픈 · 마감 시각마다 묶어서 체크 */
const DutyList = ({ duties, date, manage }: { duties: readonly DutyItem[]; date: string; manage: boolean }) => {
  const check = useOpsDutyCheck();
  const groups = useMemo(() => {
    const m = new Map<string, DutyItem[]>();
    for (const d of duties) {
      const k = `${d.slot}|${d.time}`;
      m.set(k, [...(m.get(k) ?? []), d]);
    }
    return [...m.entries()];
  }, [duties]);
  if (duties.length === 0) return null;
  const doneN = duties.filter((d) => d.checked).length;
  return (
    <section className="mt-4" aria-label="오늘 고정 업무">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-body font-black text-foreground">오늘 고정 업무</h3>
        <span className="text-label font-bold tabular-nums text-muted-foreground">
          {doneN} / {duties.length}
        </span>
      </div>
      {groups.map(([k, list]) => (
        <div key={k} className="mt-2">
          <p className="text-label font-bold text-muted-foreground">
            {list[0].slot === "open" ? "오픈" : "마감"} · {list[0].time}
            {manage && list[0].people.length > 0 ? ` · ${list[0].people.join(" · ")}` : ""}
          </p>
          <ul className="mt-1 space-y-1">
            {list.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={d.checked}
                  disabled={check.isPending || (!d.mine && !manage)}
                  onClick={() =>
                    check.mutate({ id: d.id, date, on: !d.checked }, { onError: (e) => toast.error((e as Error).message) })
                  }
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors active:scale-[0.99] disabled:opacity-60",
                    d.checked ? "border-transparent bg-secondary/70" : "border-border bg-card",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2",
                      d.checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                    )}
                    aria-hidden
                  >
                    {d.checked && <Check className="h-4 w-4" strokeWidth={3} />}
                  </span>
                  <span className={cn("min-w-0 flex-1 text-body font-bold", d.checked ? "text-muted-foreground line-through" : "text-foreground")}>
                    {d.title}
                  </span>
                  {d.checked && d.checked_by_name && <span className="shrink-0 text-label text-muted-foreground">{d.checked_by_name}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
};

/** 지점 관리자 — 내가 맡긴 일 */
const AssignedList = ({ list, today, onOpen }: { list: readonly AssignedTask[]; today: string; onOpen: (t: AssignedTask) => void }) => {
  if (list.length === 0) return null;
  return (
    <section className="mt-5 border-t border-border pt-4" aria-label="맡긴 일">
      <h3 className="text-body font-black text-foreground">맡긴 일 {list.length}</h3>
      <ul className="mt-1 space-y-0.5">
        {list.map((t) => {
          const due = dueLabel(t.due_on, today);
          const done = t.status === "done";
          return (
            <li key={t.id}>
              <button type="button" onClick={() => onOpen(t)} className="flex w-full items-center gap-3 rounded-xl py-2 text-left active:bg-secondary/60">
                <span className={cn("h-3 w-3 shrink-0 rounded-full", TASK_STATUS_META[t.status].dot)} aria-label={TASK_STATUS_META[t.status].label} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-body font-bold", done ? "text-muted-foreground line-through" : "text-foreground")}>{t.title}</span>
                  <span className="flex flex-wrap items-center gap-x-1.5 text-label text-muted-foreground">
                    <span>{t.user_name}님</span>
                    <span className={TASK_STATUS_META[t.status].text}>{TASK_STATUS_META[t.status].label}</span>
                    {due && !done && <span className={cn("font-bold tabular-nums", TONE_CLS[due.tone])}>{due.text}</span>}
                    {t.reply && (
                      <span className="inline-flex min-w-0 items-center gap-0.5 text-foreground">
                        <MessageSquare className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="truncate">{t.reply}</span>
                      </span>
                    )}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

/**
 * 「할 일」 보기 본문 (내 일정 카드 안)
 */
export const TasksView = ({ data, today, onOpen }: { data: TasksDay; today: string; onOpen: (t: TaskSheetTarget) => void }) => {
  const status = useOpsTaskStatus();
  const guide = useOpsTaskGuideRead();
  const [guideOpen, setGuideOpen] = useState(false);
  const g = groupTasks(data.tasks);
  const read = !!data.manualVersion;
  const empty = data.tasks.length === 0;
  const setStatus = (t: OpsTask, s: TaskStatus) =>
    status.mutate(
      { id: t.id, status: s },
      {
        onSuccess: () => {
          if (s === "done") toast.success("끝냈어요");
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );

  return (
    <div>
      {(!read || guideOpen) && (
        <GuideCard
          read={read}
          busy={guide.isPending}
          onRead={() => guide.mutate(undefined, { onSuccess: () => toast.success("시작해 볼까요?"), onError: (e) => toast.error((e as Error).message) })}
        />
      )}

      <DutyList duties={data.duties} date={data.date || today} manage={data.manage} />

      <section className="mt-4" aria-label="내 할 일">
        {empty ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-5 text-center">
            <p className="text-body font-bold text-foreground">아직 넣은 할 일이 없어요</p>
            <p className="mt-0.5 text-label text-muted-foreground">자주 하는 일을 눌러 바로 넣어 보세요</p>
            {data.presets.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-left">
                {data.presets.slice(0, 5).map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onOpen({ mode: "new", title: p.title, presetId: p.id })}
                      className="flex w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left active:scale-[0.99]"
                    >
                      <Plus className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-label font-bold text-foreground">{p.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          TASK_STATUS_ORDER.map((s) =>
            g[s].length > 0 ? (
              <div key={s}>
                <GroupHead status={s} count={g[s].length} />
                <ul className="mt-0.5">
                  {g[s].map((t) => (
                    <TaskRow
                      key={t.id}
                      t={t}
                      me={data.me}
                      today={today}
                      busy={status.isPending}
                      onStatus={(next) => setStatus(t, next)}
                      onOpen={() => onOpen({ mode: "mine", task: t })}
                    />
                  ))}
                </ul>
              </div>
            ) : null,
          )
        )}
      </section>

      {data.manage && <AssignedList list={data.assigned} today={today} onOpen={(t) => onOpen({ mode: "assigned", task: t })} />}

      {read && (
        <button
          type="button"
          onClick={() => setGuideOpen((v) => !v)}
          className="mt-4 text-label font-bold text-muted-foreground underline underline-offset-2 active:opacity-70"
        >
          {guideOpen ? "쓰는 법 접기" : "할 일 쓰는 법"}
        </button>
      )}
    </div>
  );
};

/**
 * 지점 관리자 — 이번 주 팀 (숫자만 · 돈 없음 · 작성률 없음). 사람을 누르면 그분께 맡기기.
 */
export const TaskTeamCard = ({ branch, me, today, onAssign }: { branch: string; me: string; today: string; onAssign: (userId: string) => void }) => {
  const q = useOpsTaskBoard(branch, mondayOf(today), true);
  const board = q.data;
  if (!board || board.people.length === 0) return null;
  const line = dutyLine(board.duties);
  return (
    <section className="rounded-2xl border border-border bg-card p-5" aria-label="이번 주 팀 할 일">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-heading font-black text-foreground">이번 주 팀</h2>
        {line && <span className="text-label font-bold tabular-nums text-muted-foreground">{line}</span>}
      </div>
      <ul className="mt-2 divide-y divide-border">
        {board.people.map((p) => {
          const { chips, flags } = boardChips(p);
          return (
            <li key={p.user_id}>
              <button
                type="button"
                disabled={p.user_id === me}
                onClick={() => onAssign(p.user_id)}
                className="flex w-full items-center gap-2 py-3 text-left active:bg-secondary/60 disabled:active:bg-transparent"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-bold text-foreground">{p.name}</span>
                  <span className="mt-0.5 flex flex-wrap gap-1">
                    {chips.length === 0 && flags.length === 0 && <span className="text-label text-muted-foreground">이번 주 할 일 없음</span>}
                    {chips.map((c) => (
                      <span key={c} className="rounded-md bg-secondary px-1.5 py-0.5 text-micro font-bold tabular-nums text-foreground">
                        {c}
                      </span>
                    ))}
                    {flags.map((f) => (
                      <span key={f} className="rounded-md bg-rose-100 px-1.5 py-0.5 text-micro font-bold tabular-nums text-rose-800 dark:bg-rose-500/20 dark:text-rose-200">
                        {f}
                      </span>
                    ))}
                  </span>
                </span>
                {p.user_id !== me && (
                  <span className="inline-flex shrink-0 items-center gap-0.5 text-label font-bold text-primary">
                    <Plus className="h-4 w-4" aria-hidden />
                    맡기기
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

/** 마감 고르기 — 없음 · 오늘 · 내일 · 금요일 · 날짜 */
const DuePicker = ({ value, today, onChange }: { value: string | null; today: string; onChange: (d: string | null) => void }) => {
  const quick = quickDues(today);
  const custom = !!value && !quick.some((q) => q.date === value);
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        <OpsChip on={!value} onClick={() => onChange(null)}>
          없음
        </OpsChip>
        {quick.map((q) => (
          <OpsChip key={q.key} on={value === q.date} onClick={() => onChange(q.date)}>
            {q.label}
          </OpsChip>
        ))}
        <label
          className={cn(
            "relative shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-label font-bold",
            custom ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground",
          )}
        >
          {custom && value ? dueLabel(value, today)?.text ?? value : "날짜"}
          <input
            type="date"
            value={value ?? ""}
            min={today}
            onChange={(e) => onChange(e.target.value || null)}
            aria-label="마감 날짜 고르기"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
      </div>
      {/* 오늘 · 내일은 칩이 말한다 — 그 밖의 날만 한 줄 */}
      {value && value !== quick[0]?.date && value !== quick[1]?.date && <p className="mt-1.5 text-label text-muted-foreground">{dueLabel(value, today)?.text ?? ""}</p>}
    </div>
  );
};

const StatusSegment = ({ value, onChange, disabled }: { value: TaskStatus; onChange: (s: TaskStatus) => void; disabled?: boolean }) => (
  <div role="radiogroup" aria-label="상태" className="grid grid-cols-3 gap-1 rounded-xl bg-secondary/70 p-1">
    {(["todo", "doing", "done"] as const).map((s) => (
      <button
        key={s}
        type="button"
        role="radio"
        aria-checked={value === s}
        disabled={disabled}
        onClick={() => onChange(s)}
        className={cn(
          "flex h-10 items-center justify-center gap-1.5 rounded-lg text-label font-black transition-all active:scale-[0.98] disabled:opacity-60",
          value === s ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground",
        )}
      >
        <span className={cn("h-2.5 w-2.5 rounded-full", TASK_STATUS_META[s].dot)} aria-hidden />
        {TASK_STATUS_META[s].label}
      </button>
    ))}
  </div>
);

/**
 * 할 일 시트 — 새로 넣기(관리자는 누구 일인지 고르기) · 내 할 일 고치기 · 받은 일(상태 · 답장) · 맡긴 일(답장 보기 · 고치기)
 */
export const TaskSheet = ({
  target,
  data,
  today,
  onClose,
}: {
  target: TaskSheetTarget | null;
  data: TasksDay;
  today: string;
  onClose: () => void;
}) => {
  const save = useOpsTaskSave();
  const status = useOpsTaskStatus();
  const remove = useOpsTaskRemove();
  const reply = useOpsTaskReply();
  const [draft, setDraft] = useState<TaskDraft>(emptyTaskDraft);
  const [error, setError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [memoOpen, setMemoOpen] = useState(false);

  // 시트가 열릴 때마다 처음 값
  useEffect(() => {
    if (!target) return;
    setError(null);
    setConfirmDel(false);
    if (target.mode === "new") {
      setDraft({ ...emptyTaskDraft(), title: target.title ?? "", presetId: target.presetId ?? null, due: target.due ?? null, userId: target.userId ?? null });
      setMemoOpen(false);
      setReplyText("");
    } else if (target.mode === "mine") {
      setDraft(draftFromTask(target.task));
      setMemoOpen(!!target.task.memo);
      setReplyText(target.task.reply ?? "");
    } else {
      setDraft({ title: target.task.title, memo: target.task.memo ?? "", due: target.task.due_on, userId: target.task.user_id, presetId: null });
      setMemoOpen(!!target.task.memo);
      setReplyText("");
    }
  }, [target]);

  if (!target) return <OpsSheet open={false} onClose={onClose} title="할 일">{null}</OpsSheet>;

  // 열린 동안 상태가 바뀌면(누름 · 다시 읽기) 최신 줄을 본다
  const liveMine = target.mode === "mine" ? data.tasks.find((t) => t.id === target.task.id) ?? target.task : null;
  const liveAssigned = target.mode === "assigned" ? data.assigned.find((t) => t.id === target.task.id) ?? target.task : null;
  const receivedFromOther = !!liveMine && isAssignedToMe(liveMine, data.me);
  const editable = target.mode === "new" || (!!liveMine && !receivedFromOther) || !!liveAssigned;
  const set = (patch: Partial<TaskDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError(null);
  };
  const assignee = draft.userId ? data.team.find((t) => t.user_id === draft.userId) : null;

  const submit = () => {
    const e = taskDraftError(draft, today);
    if (e) return setError(e);
    const payload = taskPayload(draft, data.branch, liveMine ? liveMine : liveAssigned ? { id: liveAssigned.id, kind: "mine", effect: 2 } : null);
    save.mutate(payload, {
      onSuccess: () => {
        toast.success(target.mode === "new" ? (assignee ? `${assignee.name}님께 맡겼어요` : "할 일을 넣었어요") : "고쳤어요");
        onClose();
      },
      onError: (err) => setError((err as Error).message),
    });
  };
  const doRemove = (id: string) => {
    if (!confirmDel) return setConfirmDel(true);
    remove.mutate(id, {
      onSuccess: () => {
        toast.success("지웠어요");
        onClose();
      },
      onError: (err) => setError((err as Error).message),
    });
  };
  const setStatus = (id: string, s: TaskStatus) => status.mutate({ id, status: s }, { onError: (err) => setError((err as Error).message) });
  const sendReply = (id: string) => {
    const text = replyText.trim();
    if (!text) return setError("질문을 적어 주세요");
    reply.mutate(
      { id, text },
      {
        onSuccess: () => toast.success("답장을 보냈어요"),
        onError: (err) => setError((err as Error).message),
      },
    );
  };

  const title =
    target.mode === "new" ? (assignee ? `${assignee.name}님께 맡기기` : "할 일 넣기") : target.mode === "assigned" ? "맡긴 일" : receivedFromOther ? "받은 일" : "할 일";
  const sub =
    target.mode === "assigned" && liveAssigned
      ? `${liveAssigned.user_name}님 · ${TASK_STATUS_META[liveAssigned.status].label}`
      : receivedFromOther && liveMine
        ? `${liveMine.created_by_name ?? "지점장"}님이 맡긴 일`
        : undefined;
  const busy = save.isPending || remove.isPending;

  return (
    <OpsSheet
      open
      onClose={onClose}
      title={title}
      sub={sub}
      footer={
        editable ? (
          <div className="flex gap-2">
            {target.mode !== "new" && (
              <button
                type="button"
                onClick={() => doRemove(liveMine?.id ?? liveAssigned?.id ?? "")}
                disabled={busy}
                className="h-12 shrink-0 rounded-xl border border-destructive/40 px-4 text-body font-bold text-destructive active:scale-[0.99] disabled:opacity-50"
              >
                {confirmDel ? "한 번 더" : "지우기"}
              </button>
            )}
            <div className="flex-1">
              <OpsButton onClick={submit} disabled={busy || !draft.title.trim()} tone="dark">
                {save.isPending ? "저장하는 중…" : target.mode === "new" ? (assignee ? "맡기기" : "넣기") : "이렇게 고칠게요"}
              </OpsButton>
            </div>
          </div>
        ) : undefined
      }
    >
      {/* 받은 일 — 맡긴 분이 정한 것 보기 + 상태 + 답장 */}
      {receivedFromOther && liveMine ? (
        <div>
          <p className="text-heading font-black leading-snug text-foreground">{liveMine.title}</p>
          {liveMine.due_on && (
            <p className={cn("mt-1 text-body font-bold", TONE_CLS[dueLabel(liveMine.due_on, today)?.tone ?? "later"])}>{dueLabel(liveMine.due_on, today)?.text}</p>
          )}
          {liveMine.memo && <p className="mt-2 whitespace-pre-line rounded-xl bg-secondary/60 px-3 py-2.5 text-body text-foreground">{liveMine.memo}</p>}
          <OpsLabel>상태</OpsLabel>
          <StatusSegment value={liveMine.status} disabled={status.isPending} onChange={(s) => setStatus(liveMine.id, s)} />
          <OpsLabel>답장 · 질문 — {liveMine.created_by_name ?? "맡긴 분"}님께 알림이 가요</OpsLabel>
          <textarea
            value={replyText}
            onChange={(e) => {
              setReplyText(e.target.value.slice(0, TASK_REPLY_MAX));
              setError(null);
            }}
            rows={3}
            placeholder="예) 내일 오전에 할게요 · 회원 연락처가 없어요"
            className={cn(opsInput, "resize-none")}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-micro tabular-nums text-muted-foreground">
              {[...replyText].length} / {TASK_REPLY_MAX}
            </span>
            <button
              type="button"
              onClick={() => sendReply(liveMine.id)}
              disabled={reply.isPending || !replyText.trim() || replyText.trim() === (liveMine.reply ?? "")}
              className="h-10 rounded-xl bg-foreground px-4 text-label font-black text-background active:scale-95 disabled:opacity-40"
            >
              {liveMine.reply ? "답장 고치기" : "답장 보내기"}
            </button>
          </div>
        </div>
      ) : (
        <div>
          {/* 맡긴 일 — 받은 분 답장 */}
          {liveAssigned?.reply && (
            <div className="mb-3 rounded-xl bg-secondary/60 px-3 py-2.5">
              <p className="flex items-center gap-1 text-micro font-bold text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                {liveAssigned.user_name}님 답장
              </p>
              <p className="mt-0.5 whitespace-pre-line text-body text-foreground">{liveAssigned.reply}</p>
            </div>
          )}

          {/* 새 일 — 관리자는 누구 일인지 */}
          {target.mode === "new" && data.manage && data.team.length > 0 && (
            <>
              <OpsLabel>누구 일인가요?</OpsLabel>
              <div className="flex flex-wrap gap-1.5">
                <OpsChip on={!draft.userId} onClick={() => set({ userId: null })}>
                  나
                </OpsChip>
                {data.team.map((m) => (
                  <OpsChip key={m.user_id} on={draft.userId === m.user_id} onClick={() => set({ userId: m.user_id, presetId: null })}>
                    {m.name}
                  </OpsChip>
                ))}
              </div>
            </>
          )}

          <OpsLabel>무엇을 할까요?</OpsLabel>
          <input
            value={draft.title}
            maxLength={TASK_TITLE_MAX + 5}
            onChange={(e) => set({ title: e.target.value, presetId: null })}
            placeholder="예) 체험 회원 등록 상담"
            className={opsInput}
          />
          {target.mode === "new" && !draft.userId && data.presets.length > 0 && (
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
              {data.presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => set({ title: p.title, presetId: p.id })}
                  className={cn(
                    "max-w-[16rem] shrink-0 truncate rounded-full border px-3 py-1.5 text-label font-bold active:scale-95",
                    draft.presetId === p.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground",
                  )}
                >
                  {p.title}
                </button>
              ))}
            </div>
          )}

          <OpsLabel>마감</OpsLabel>
          <DuePicker value={draft.due} today={today} onChange={(d) => set({ due: d })} />

          {memoOpen ? (
            <>
              <OpsLabel>메모</OpsLabel>
              <textarea
                value={draft.memo}
                onChange={(e) => set({ memo: e.target.value.slice(0, TASK_MEMO_MAX) })}
                rows={3}
                placeholder="예) 회원 이름 · 연락할 시간"
                className={cn(opsInput, "resize-none")}
              />
            </>
          ) : (
            <button type="button" onClick={() => setMemoOpen(true)} className="mt-4 text-label font-bold text-primary active:opacity-70">
              + 메모
            </button>
          )}

          {/* 내 할 일 — 상태 */}
          {liveMine && (
            <>
              <OpsLabel>상태</OpsLabel>
              <StatusSegment value={liveMine.status} disabled={status.isPending} onChange={(s) => setStatus(liveMine.id, s)} />
            </>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-label font-bold text-destructive">
          {error}
        </p>
      )}
    </OpsSheet>
  );
};
