/**
 * 🎯 153 D-day 시트 (2026-11-13 대표님 「다음」 — 운동 달력 2-3단계 · 보고서 '기념일 D-day → 153 D-day')
 *   다가오는 D-day — 내가 정한 목표일 · 153 PB 다시 재는 날(42일) · 153 기념일(30일 안) · 승급 심사(타이틀 레벨) · 타이틀매치 다시 도전.
 *   목표일 정하기(내일부터 2년 안 · 3개까지 · 이름 20자 — 서버 set_my_goal_day 와 같은 검사 lib/calendarMarks goalDraftError) ·
 *   빼기는 지우지 않고 두 번 눌러. 앞날을 길게 눌렀거나 그날 카드의 '이 날을 목표일로'로 열면 그 날로 채운다(initialDay).
 *   카드 머리 칩(가장 가까운 D-day)을 누르면 열린다 — WorkoutCalendar 가 누를 때만 받는 조각.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  GOAL_EXAMPLES,
  GOAL_MAX,
  GOAL_TITLE_MAX,
  ddayCount,
  ddayText,
  emptyGoalDraft,
  goalDayBounds,
  goalDraftError,
  goalsOf,
  mdw,
  sortDdays,
  type CalDday,
  type GoalDraft,
} from "@/lib/calendarMarks";
import { cn } from "@/lib/utils";
import { useRemoveGoalDay, useSaveGoalDay } from "@/services/calendarCheckService";

export interface DdaySheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ddays: readonly CalDday[];
  today: string;
  /** 이 날로 목표일 칸을 채워 연다 (앞날 길게 누르기 · '이 날을 목표일로') */
  initialDay?: string | null;
}

const DdaySheet = ({ open, onOpenChange, ddays, today, initialDay = null }: DdaySheetProps) => {
  const [draft, setDraft] = useState<GoalDraft>(() => emptyGoalDraft(initialDay ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const save = useSaveGoalDay();
  const remove = useRemoveGoalDay();
  const sorted = useMemo(() => sortDdays(ddays, today), [ddays, today]);
  const goalCount = goalsOf(ddays).length;
  const full = goalCount >= GOAL_MAX;
  const bounds = goalDayBounds(today);

  useEffect(() => {
    if (!open) return;
    setDraft(emptyGoalDraft(initialDay ?? ""));
    setError(null);
    setConfirmId(null);
  }, [open, initialDay]);

  const set = (patch: Partial<GoalDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError(null);
  };

  const submit = async () => {
    const e = goalDraftError(draft, today, goalCount);
    if (e) {
      setError(e);
      return;
    }
    try {
      await save.mutateAsync({ draft });
      toast.success(`${mdw(draft.day)} 목표일을 정했어요 · 달력에 D-day로 보여요`);
      setDraft(emptyGoalDraft());
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
      toast.success("목표일을 뺐어요");
      setConfirmId(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const busy = save.isPending || remove.isPending;
  const titleLen = [...draft.title.replace(/\s+/g, " ").trim()].length;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="text-heading">153 D-day</DrawerTitle>
          <DrawerDescription className="text-label">목표일은 {GOAL_MAX}개까지 · 153 PB · 기념일 · 승급 심사는 저절로 보여요</DrawerDescription>
        </DrawerHeader>
        <div className="space-y-5 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          {sorted.length > 0 && (
            <ul className="divide-y divide-border rounded-2xl border border-border bg-card" aria-label="다가오는 D-day">
              {sorted.map((d) => (
                <li key={`${d.kind}:${d.id ?? d.day}`} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-14 shrink-0 text-center text-body font-black tabular-nums text-violet-700 dark:text-violet-300">
                    {ddayCount(d, today)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-bold text-foreground">{ddayText(d, today)}</span>
                    <span className="block text-label tabular-nums text-muted-foreground">
                      {d.kind === "pb" && d.day < today ? "코치님께 말씀해 주세요" : mdw(d.day)}
                    </span>
                  </span>
                  {d.kind === "goal" && d.id && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onRemove(d.id as string)}
                      className="h-9 shrink-0 rounded-full px-3 text-label font-bold text-muted-foreground active:bg-muted disabled:opacity-50"
                    >
                      {confirmId === d.id ? "한 번 더" : "빼기"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {full ? (
            <p className="rounded-xl bg-muted/60 px-4 py-3 text-label text-muted-foreground">
              목표일을 {GOAL_MAX}개 정했어요 · 하나를 빼면 새로 정할 수 있어요
            </p>
          ) : (
            <section aria-label="목표일 정하기" className="space-y-4">
              <p className="text-body font-bold text-foreground">목표일 정하기</p>
              <div>
                <label htmlFor="goal-day" className="text-label font-bold text-muted-foreground">
                  언제?
                </label>
                <input
                  id="goal-day"
                  type="date"
                  value={draft.day}
                  min={bounds.min}
                  max={bounds.max}
                  onChange={(e) => set({ day: e.target.value })}
                  className="mt-2 h-12 w-full rounded-xl border border-border bg-card px-4 text-body tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label htmlFor="goal-title" className="text-label font-bold text-muted-foreground">
                  무엇을 위한 날인가요?
                </label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {GOAL_EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => set({ title: ex })}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-label font-bold active:scale-95",
                        draft.title === ex ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground",
                      )}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
                <input
                  id="goal-title"
                  value={draft.title}
                  maxLength={GOAL_TITLE_MAX + 5}
                  onChange={(e) => set({ title: e.target.value })}
                  placeholder="예: 바디프로필"
                  className="mt-2 h-12 w-full rounded-xl border border-border bg-card px-4 text-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <p className={cn("mt-1 text-right text-micro tabular-nums", titleLen > GOAL_TITLE_MAX ? "font-bold text-destructive" : "text-muted-foreground")}>
                  {titleLen}/{GOAL_TITLE_MAX}
                </p>
              </div>
              {error && (
                <p role="alert" className="text-label font-bold text-destructive">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy || !draft.title.trim() || !draft.day}
                className="flex h-14 w-full items-center justify-center rounded-2xl bg-primary text-body font-black text-primary-foreground active:scale-[0.98] disabled:opacity-50"
              >
                {save.isPending ? "저장하는 중…" : "목표일 정하기"}
              </button>
            </section>
          )}
          {full && error && (
            <p role="alert" className="text-label font-bold text-destructive">
              {error}
            </p>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default DdaySheet;
