/**
 * ✅ 나만의 체크 만들기 · 고치기 시트 (2026-11-12 대표님 「추천대로」 — 봄 회원님 「유저가 체크리스트를 선택해서 자신에 맞게 · 잽연습 몇번」)
 *   이름(20자) · 목표 숫자(선택) + 단위 · 요일(안 고르면 매일) · 예시 4개 · 3개까지. 빼기는 지우지 않고(지난 날 기록은 그대로) 두 번 눌러.
 *   검사 · 보낼 값은 lib/calendarChecks.ts, 저장은 services/calendarCheckService.ts. 달력(WorkoutCalendar)이 처음 열 때 받아 온다.
 *   (2-2 · 2026-11-13) 맨 아래 「저녁 체크 알림」 — 켠 회원만 저녁 8시 한 번, 채운 것이 있고 아직 남았을 때만
 *   '오늘 2개 채웠어요 · 하나 더 채우면 금색 별' (하나도 안 채운 날 · 다 채운 날은 안 보냄 — set_my_calendar_prefs).
 *   (3-4 · 2026-11-14 대표님 「진행」) 언제? = 매일 · 요일 · 주 n번(아무 날이나 — 금색 별에는 안 셈) ·
 *   체크마다 '이번 주 2/3번' · 'n주째 이어 가요' · '가장 길게 n주' (get_my_habits — 달성률 · 놓친 날은 없음) ·
 *   「마감 있는 할 일」 — 넣기(30자 · 오늘 · 내일 · 이번 주 일요일 · 날짜) · 끝냈어요 · 고치기 · 빼기 · 마감이 지나면 '다음에 해도 돼요'.
 *   습관 · 할 일 글 · 계산은 lib/memberHabits.ts.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronRight, Pencil } from "lucide-react";

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Switch } from "@/components/ui/switch";
import { hmLabel } from "@/lib/calendarEvents";
import {
  CHECK_EXAMPLES,
  CHECK_ITEM_MAX,
  CHECK_LABEL_MAX,
  CHECK_UNITS,
  checkItemError,
  draftFromItem,
  emptyCheckDraft,
  itemLabel,
  scheduleOf,
  type CheckItem,
  type CheckItemDraft,
  type CheckSchedule,
} from "@/lib/calendarChecks";
import {
  LATER_HINT,
  LATER_TITLE,
  TODO_EMPTY,
  TODO_EXAMPLES,
  TODO_OPEN_MAX,
  TODO_TITLE_MAX,
  WEEK_GOAL_MAX,
  scheduleLabel,
  streakParts,
  todoDueLabel,
  todoError,
  todoGroups,
  todoQuickDues,
  weekGoalHint,
  weekLine,
  type HabitItem,
  type MemberTodo,
} from "@/lib/memberHabits";
import { PROMISE_WEEK, toggleDay, weekdaysLabel } from "@/lib/promise153";
import { cn } from "@/lib/utils";
import {
  useMyHabits,
  useRemoveCheckItem,
  useRemoveTodo,
  useSaveCheckItem,
  useSaveTodo,
  useSetCalendarNudge,
  useSetTodoDone,
  useSetWeeklyRecap,
} from "@/services/calendarCheckService";
import type { CalRecapPref } from "@/lib/calendarTogether";

export interface CheckItemsSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** 지금 있는 나만의 체크 (뺀 것 빼고) */
  items: readonly CheckItem[];
  /** (2-2) 저녁 체크 알림 — 켰나 · 몇 시 */
  nudge?: { on: boolean; at: string };
  /** (2-4) 일요일 주간 돌아보기 알림 — 이 회원에게 가는 지점(sends)일 때만 칸이 보인다 */
  recap?: CalRecapPref;
  /** (3-1) 휴대폰 캘린더에서 늘 보기(구독 주소) — 서버에 기능이 있을 때만 */
  onOpenFeed?: () => void;
}

const kstToday = (): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

const SCHEDULES: ReadonlyArray<{ key: CheckSchedule; label: string }> = [
  { key: "daily", label: "매일" },
  { key: "days", label: "요일" },
  { key: "goal", label: "주 n번" },
];

const chipCls = (on: boolean) =>
  cn("h-9 rounded-full border px-3 text-label font-bold active:scale-95", on ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground");

/** 마감 고르기 — 오늘 · 내일 · 이번 주 일요일 · 날짜 */
const TodoDuePicker = ({ value, today, onChange }: { value: string | null; today: string; onChange: (d: string) => void }) => {
  const quick = todoQuickDues(today);
  const custom = !!value && !quick.some((q) => q.date === value);
  return (
    <div className="flex flex-wrap gap-1.5">
      {quick.map((q) => (
        <button key={q.key} type="button" aria-pressed={value === q.date} onClick={() => onChange(q.date)} className={chipCls(value === q.date)}>
          {q.label}
        </button>
      ))}
      <label className={cn("relative inline-flex cursor-pointer items-center", chipCls(custom))}>
        {custom && value ? todoDueLabel(value, today) : "날짜"}
        <input
          type="date"
          value={value ?? ""}
          min={today}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          aria-label="마감 날짜 고르기"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
};

/** 할 일 한 줄 — 동그라미 = 끝냈어요 · 연필 = 고치기(이름 · 마감 · 빼기) */
const TodoRow = ({ t, today, busy, onDone, onEdit }: { t: MemberTodo; today: string; busy: boolean; onDone: (done: boolean) => void; onEdit: () => void }) => {
  const done = !!t.doneOn;
  return (
    <li className="flex items-center gap-1">
      <button
        type="button"
        disabled={busy}
        aria-pressed={done}
        aria-label={done ? `${t.title} — 끝냈어요 (누르면 되돌리기)` : `${t.title} — 끝냈어요`}
        onClick={() => onDone(!done)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:scale-90 disabled:opacity-50"
      >
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full border-2",
            done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50",
          )}
        >
          {done && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />}
        </span>
      </button>
      <span className="min-w-0 flex-1 py-2">
        <span className={cn("block text-body font-bold leading-snug", done ? "text-muted-foreground line-through" : "text-foreground")}>{t.title}</span>
        <span className={cn("block text-label tabular-nums", done ? "text-muted-foreground" : t.dueOn === today ? "font-bold text-primary" : "text-muted-foreground")}>
          {done ? "끝냈어요" : todoDueLabel(t.dueOn, today)}
        </span>
      </span>
      {!done && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`${t.title} 고치기`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
        >
          <Pencil className="h-4 w-4" aria-hidden />
        </button>
      )}
    </li>
  );
};

/** 마감 있는 할 일 — 넣기 · 고치기 · 끝냈어요 · 빼기 */
const TodoSection = ({ todos, today }: { todos: readonly MemberTodo[]; today: string }) => {
  const saveTodo = useSaveTodo();
  const doneTodo = useSetTodoDone();
  const removeTodo = useRemoveTodo();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState<string | null>(today);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const g = useMemo(() => todoGroups(todos, today), [todos, today]);
  const openCount = g.upcoming.length + g.later.length;
  const editing = editId ? todos.find((t) => t.id === editId) ?? null : null;
  const busy = saveTodo.isPending || removeTodo.isPending;

  const reset = () => {
    setTitle("");
    setDue(today);
    setEditId(null);
    setError(null);
    setConfirmRemove(false);
  };
  const startEdit = (t: MemberTodo) => {
    setEditId(t.id);
    setTitle(t.title);
    setDue(t.dueOn);
    setError(null);
    setConfirmRemove(false);
  };
  const submit = () => {
    const e = todoError(title, due, today, editing ? editing.dueOn : undefined);
    if (e || !due) return setError(e ?? "마감일을 골라 주세요");
    saveTodo.mutate(
      { title, due, id: editId },
      {
        onSuccess: () => {
          toast.success(editId ? "고쳤어요" : `할 일을 넣었어요 · ${todoDueLabel(due, today)}`);
          reset();
        },
        onError: (err) => setError((err as Error).message),
      },
    );
  };
  const onRemove = () => {
    if (!editId) return;
    if (!confirmRemove) return setConfirmRemove(true);
    removeTodo.mutate(editId, {
      onSuccess: () => {
        toast.success("뺐어요");
        reset();
      },
      onError: (err) => setError((err as Error).message),
    });
  };
  const toggleDone = (t: MemberTodo, done: boolean) =>
    doneTodo.mutate(
      { id: t.id, done, today },
      {
        onSuccess: () => {
          if (done) toast.success("끝냈어요");
        },
        onError: (err) => toast.error((err as Error).message),
      },
    );

  const canAdd = !editId && openCount < TODO_OPEN_MAX;

  return (
    <section aria-label="마감 있는 할 일" className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-body font-black text-foreground">마감 있는 할 일</h3>
        {openCount > 0 && <span className="text-label tabular-nums text-muted-foreground">{openCount}개</span>}
      </div>

      {g.upcoming.length > 0 && (
        <ul className="mt-1">
          {g.upcoming.map((t) => (
            <TodoRow key={t.id} t={t} today={today} busy={doneTodo.isPending} onDone={(d) => toggleDone(t, d)} onEdit={() => startEdit(t)} />
          ))}
        </ul>
      )}

      {g.later.length > 0 && (
        <div className="mt-3 rounded-xl bg-muted/60 px-3 py-2">
          <p className="text-label font-bold text-foreground">{LATER_TITLE}</p>
          <p className="text-label text-muted-foreground">{LATER_HINT}</p>
          <ul className="mt-1">
            {g.later.map((t) => (
              <TodoRow key={t.id} t={t} today={today} busy={doneTodo.isPending} onDone={(d) => toggleDone(t, d)} onEdit={() => startEdit(t)} />
            ))}
          </ul>
        </div>
      )}

      {g.done.length > 0 && (
        <ul className="mt-2">
          {g.done.map((t) => (
            <TodoRow key={t.id} t={t} today={today} busy={doneTodo.isPending} onDone={(d) => toggleDone(t, d)} onEdit={() => startEdit(t)} />
          ))}
        </ul>
      )}

      {(canAdd || editId) && (
        <div className={cn("space-y-2.5", todos.length > 0 ? "mt-3 border-t border-border pt-3" : "mt-2")}>
          {todos.length === 0 && !editId && (
            <>
              <p className="text-label text-muted-foreground">{TODO_EMPTY}</p>
              <div className="flex flex-wrap gap-1.5">
                {TODO_EXAMPLES.map((ex) => (
                  <button key={ex} type="button" onClick={() => setTitle(ex)} className={chipCls(title === ex)}>
                    {ex}
                  </button>
                ))}
              </div>
            </>
          )}
          {editId && <p className="text-label font-bold text-muted-foreground">할 일 고치기</p>}
          <input
            value={title}
            maxLength={TODO_TITLE_MAX + 5}
            onChange={(e) => {
              setTitle(e.target.value);
              setError(null);
            }}
            placeholder="예) 수강권 연장 상담"
            aria-label="할 일"
            className="h-12 w-full rounded-xl border border-border bg-background px-4 text-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <TodoDuePicker
            value={due}
            today={today}
            onChange={(d) => {
              setDue(d);
              setError(null);
            }}
          />
          {error && (
            <p role="alert" className="text-label font-bold text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            {editId && (
              <>
                <button type="button" onClick={reset} className="h-12 flex-1 rounded-xl bg-muted text-body font-bold text-foreground active:scale-[0.98]">
                  그만
                </button>
                <button
                  type="button"
                  onClick={onRemove}
                  disabled={busy}
                  className="h-12 flex-1 rounded-xl border border-border text-body font-bold text-muted-foreground active:scale-[0.98] disabled:opacity-50"
                >
                  {confirmRemove ? "한 번 더" : "빼기"}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={busy || !title.trim() || !due}
              className="h-12 flex-[2] rounded-xl bg-foreground text-body font-black text-background active:scale-[0.98] disabled:opacity-40"
            >
              {saveTodo.isPending ? "저장하는 중…" : editId ? "이렇게 고칠게요" : "할 일 넣기"}
            </button>
          </div>
        </div>
      )}
      {!canAdd && !editId && openCount >= TODO_OPEN_MAX && (
        <p className="mt-2 text-label text-muted-foreground">할 일은 {TODO_OPEN_MAX}개까지 둘 수 있어요 · 끝내면 새로 넣을 수 있어요</p>
      )}
    </section>
  );
};

const CheckItemsSheet = ({ open, onOpenChange, items, nudge, recap, onOpenFeed }: CheckItemsSheetProps) => {
  const [draft, setDraft] = useState<CheckItemDraft>(emptyCheckDraft);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const save = useSaveCheckItem();
  const remove = useRemoveCheckItem();
  const nudgeM = useSetCalendarNudge();
  const recapM = useSetWeeklyRecap();
  // (3-4) 이번 주 · 이어 간 주 · 할 일 — 시트를 열 때만 받는다 (함수가 없으면 꺼짐 → 예전 시트 그대로)
  const habitsQ = useMyHabits(open);
  const habits = habitsQ.data?.on ? habitsQ.data : null;
  const today = habits?.today ?? kstToday();
  const habitOf = useMemo(() => new Map<string, HabitItem>((habits?.items ?? []).map((h) => [h.id, h])), [habits]);
  const full = items.length >= CHECK_ITEM_MAX;
  const showForm = editId != null || !full;
  const schedule = scheduleOf(draft);

  useEffect(() => {
    if (!open) return;
    setDraft(emptyCheckDraft());
    setEditId(null);
    setError(null);
    setConfirmId(null);
  }, [open]);

  const set = (patch: Partial<CheckItemDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError(null);
  };

  const submit = async () => {
    const e = checkItemError(draft);
    if (e) {
      setError(e);
      return;
    }
    try {
      const prev = editId ? items.find((i) => i.id === editId) : null;
      await save.mutateAsync({ draft, id: editId, prevIds: items.map((i) => i.id), hadGoal: !!prev?.weekGoal });
      toast.success(editId ? "체크를 고쳤어요" : "나만의 체크를 만들었어요 · 오늘부터 달력에서 체크해요");
      setDraft(emptyCheckDraft());
      setEditId(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onRemove = async (id: string) => {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    try {
      await remove.mutateAsync(id);
      toast.success("체크를 뺐어요 · 지난 기록은 그대로 남아요");
      setConfirmId(null);
      if (editId === id) {
        setEditId(null);
        setDraft(emptyCheckDraft());
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const busy = save.isPending || remove.isPending;
  const hasTarget = draft.target.trim() !== "";
  const goal = draft.goal ?? 3;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="text-heading">나만의 체크</DrawerTitle>
          <DrawerDescription className="text-label">내가 정한 운동을 달력에 체크해요 · {CHECK_ITEM_MAX}개까지</DrawerDescription>
        </DrawerHeader>
        <div className="space-y-5 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          {items.length > 0 && (
            <ul className="divide-y divide-border rounded-2xl border border-border bg-card" aria-label="지금 있는 체크">
              {items.map((i) => {
                const h = habitOf.get(i.id);
                const week = h ? weekLine(h.week) : null;
                const streak = h ? streakParts(h.nowWeeks, h.bestWeeks) : [];
                const met = !!h && h.week.goal > 0 && h.week.done >= h.week.goal;
                return (
                  <li key={i.id} className="flex items-center gap-2 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-bold text-foreground">{itemLabel(i)}</span>
                      <span className="block text-label text-muted-foreground">{scheduleLabel(i)}</span>
                      {(week || streak.length > 0) && (
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-label font-bold tabular-nums">
                          {week && (
                            <span className={cn("inline-flex items-center gap-0.5", met ? "text-primary" : "text-foreground")}>
                              {met && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />}
                              {week}
                            </span>
                          )}
                          {streak.map((s) => (
                            <span key={s} className="whitespace-nowrap text-reward">
                              {s}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setEditId(i.id);
                        setDraft(draftFromItem(i));
                        setError(null);
                        setConfirmId(null);
                      }}
                      className="h-9 shrink-0 rounded-full bg-muted px-3 text-label font-bold text-foreground active:scale-95 disabled:opacity-50"
                    >
                      고치기
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onRemove(i.id)}
                      className="h-9 shrink-0 rounded-full px-3 text-label font-bold text-muted-foreground active:bg-muted disabled:opacity-50"
                    >
                      {confirmId === i.id ? "한 번 더" : "빼기"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {full && editId == null && (
            <p className="rounded-xl bg-muted/60 px-4 py-3 text-label text-muted-foreground">
              {CHECK_ITEM_MAX}개를 다 만들었어요 · 하나를 빼면 새로 만들 수 있어요
            </p>
          )}

          {showForm && (
            <section aria-label={editId ? "체크 고치기" : "새 체크"} className="space-y-4">
              {editId == null && (
                <div className="flex flex-wrap gap-1.5">
                  {CHECK_EXAMPLES.filter((ex) => !items.some((i) => i.label === ex.label)).map((ex) => (
                    <button
                      key={ex.label}
                      type="button"
                      onClick={() => set({ label: ex.label, target: ex.target != null ? String(ex.target) : "", unit: ex.unit ?? "번" })}
                      className="rounded-full border border-border bg-card px-3 py-1.5 text-label font-bold text-foreground active:scale-95"
                    >
                      {itemLabel(ex)}
                    </button>
                  ))}
                </div>
              )}

              <div>
                <label htmlFor="check-label" className="text-label font-bold text-muted-foreground">
                  무엇을 할까요?
                </label>
                <input
                  id="check-label"
                  value={draft.label}
                  maxLength={CHECK_LABEL_MAX + 5}
                  onChange={(e) => set({ label: e.target.value })}
                  placeholder="예: 잽"
                  className="mt-2 h-12 w-full rounded-xl border border-border bg-card px-4 text-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label htmlFor="check-target" className="text-label font-bold text-muted-foreground">
                  얼마나? (선택)
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    id="check-target"
                    value={draft.target}
                    inputMode="numeric"
                    onChange={(e) => set({ target: e.target.value.replace(/[^\d,]/g, "").slice(0, 6) })}
                    placeholder="100"
                    className="h-12 w-28 rounded-xl border border-border bg-card px-4 text-body tabular-nums text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <div className={cn("flex flex-wrap gap-1.5", !hasTarget && "opacity-40")}>
                    {CHECK_UNITS.map((u) => (
                      <button
                        key={u}
                        type="button"
                        disabled={!hasTarget}
                        aria-pressed={draft.unit === u}
                        onClick={() => set({ unit: u })}
                        className={cn(
                          "h-9 rounded-full border px-3 text-label font-bold active:scale-95",
                          draft.unit === u && hasTarget ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground",
                        )}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-label font-bold text-muted-foreground">언제?</p>
                {/* (3-4) 매일 · 요일 · 주 n번 — 주 n번은 서버에 기능이 있을 때만 */}
                <div role="radiogroup" aria-label="언제 체크하나" className={cn("mt-2 grid gap-1 rounded-xl bg-muted/70 p-1", habits ? "grid-cols-3" : "grid-cols-2")}>
                  {SCHEDULES.filter((sc) => sc.key !== "goal" || !!habits || schedule === "goal").map((sc) => (
                    <button
                      key={sc.key}
                      type="button"
                      role="radio"
                      aria-checked={schedule === sc.key}
                      onClick={() => set({ schedule: sc.key })}
                      className={cn(
                        "h-10 rounded-lg text-label font-black transition-all active:scale-[0.98]",
                        schedule === sc.key ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground",
                      )}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>
                {schedule === "days" && (
                  <div className="mt-2 grid grid-cols-7 gap-1.5">
                    {PROMISE_WEEK.map((w) => {
                      const on = draft.weekdays.includes(w.day);
                      return (
                        <button
                          key={w.day}
                          type="button"
                          aria-pressed={on}
                          onClick={() => set({ weekdays: toggleDay(draft.weekdays, w.day) })}
                          className={cn(
                            "flex h-11 items-center justify-center rounded-xl border text-body font-bold active:scale-95",
                            on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground",
                          )}
                        >
                          {w.label}
                        </button>
                      );
                    })}
                  </div>
                )}
                {schedule === "goal" && (
                  <div className="mt-2 grid grid-cols-6 gap-1.5" role="radiogroup" aria-label="일주일에 몇 번">
                    {Array.from({ length: WEEK_GOAL_MAX }, (_, k) => k + 1).map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={goal === n}
                        onClick={() => set({ goal: n })}
                        className={cn(
                          "flex h-11 items-center justify-center rounded-xl border text-body font-bold tabular-nums active:scale-95",
                          goal === n ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground",
                        )}
                      >
                        {n}번
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-1.5 text-label text-muted-foreground">
                  {schedule === "goal"
                    ? weekGoalHint(goal)
                    : schedule === "days" && draft.weekdays.length > 0 && draft.weekdays.length < 7
                      ? `매주 ${weekdaysLabel(draft.weekdays)} 체크해요`
                      : schedule === "days"
                        ? "체크할 요일을 골라 주세요"
                        : "매일 체크해요"}
                </p>
              </div>

              {error && (
                <p role="alert" className="text-label font-bold text-destructive">
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                {editId != null && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditId(null);
                      setDraft(emptyCheckDraft());
                      setError(null);
                    }}
                    className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-muted text-body font-bold text-foreground active:scale-[0.98]"
                  >
                    그만 고치기
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={busy || !draft.label.trim()}
                  className="flex h-14 flex-[2] items-center justify-center rounded-2xl bg-primary text-body font-black text-primary-foreground active:scale-[0.98] disabled:opacity-50"
                >
                  {save.isPending ? "저장하는 중…" : editId ? "이렇게 고칠게요" : "체크 만들기"}
                </button>
              </div>
            </section>
          )}

          {/* 마감 있는 할 일 (3-4) */}
          {habits && <TodoSection todos={habits.todos} today={today} />}

          {/* 저녁 체크 알림 — 잘한 것만 (2-2) */}
          {nudge && (
            <label className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-4 py-3">
              <span className="min-w-0">
                <span className="block text-body font-bold text-foreground">{hmLabel(nudge.at)} 체크 알림</span>
                <span className="block text-label text-muted-foreground">오늘 채운 만큼 알려 드려요 · 하나도 안 채운 날엔 보내지 않아요</span>
              </span>
              <Switch
                checked={nudge.on}
                disabled={nudgeM.isPending}
                onCheckedChange={(v) =>
                  nudgeM.mutate(v, {
                    onSuccess: () => toast.success(v ? `${hmLabel(nudge.at)}에 오늘 체크를 알려 드릴게요` : "저녁 체크 알림을 껐어요"),
                    onError: (e) => toast.error((e as Error).message),
                  })
                }
                aria-label="저녁 체크 알림"
              />
            </label>
          )}

          {/* 일요일 주간 돌아보기 알림 — 기본 켬 · 안 온 주엔 보내지 않는다 (2-4) */}
          {recap?.sends && (
            <label className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-4 py-3">
              <span className="min-w-0">
                <span className="block text-body font-bold text-foreground">일요일 주간 돌아보기</span>
                <span className="block text-label text-muted-foreground">일요일 {hmLabel(recap.at)}에 이번 주 운동을 알려 드려요 · 안 온 주엔 보내지 않아요</span>
              </span>
              <Switch
                checked={recap.on}
                disabled={recapM.isPending}
                onCheckedChange={(v) =>
                  recapM.mutate(v, {
                    onSuccess: () => toast.success(v ? `일요일 ${hmLabel(recap.at)}에 이번 주를 돌아봐 드릴게요` : "주간 돌아보기 알림을 껐어요"),
                    onError: (e) => toast.error((e as Error).message),
                  })
                }
                aria-label="일요일 주간 돌아보기 알림"
              />
            </label>
          )}

          {/* 휴대폰 캘린더에서 늘 보기 — 약속 · 153 일정 · D-day 가 저절로 (3-1) */}
          {onOpenFeed && (
            <button
              type="button"
              onClick={onOpenFeed}
              className="flex w-full items-center justify-between gap-3 rounded-xl bg-muted/60 px-4 py-3 text-left active:scale-[0.99]"
            >
              <span className="min-w-0">
                <span className="block text-body font-bold text-foreground">휴대폰 캘린더에서 늘 보기</span>
                <span className="block text-label text-muted-foreground">약속 · 153 일정 · D-day가 저절로 들어가요</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default CheckItemsSheet;
