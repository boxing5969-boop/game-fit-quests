/**
 * ✅ 나만의 체크 만들기 · 고치기 시트 (2026-11-12 대표님 「추천대로」 — 봄 회원님 「유저가 체크리스트를 선택해서 자신에 맞게 · 잽연습 몇번」)
 *   이름(20자) · 목표 숫자(선택) + 단위 · 요일(안 고르면 매일) · 예시 4개 · 3개까지. 빼기는 지우지 않고(지난 날 기록은 그대로) 두 번 눌러.
 *   검사 · 보낼 값은 lib/calendarChecks.ts, 저장은 services/calendarCheckService.ts. 달력(WorkoutCalendar)이 처음 열 때 받아 온다.
 *   (2-2 · 2026-11-13) 맨 아래 「저녁 체크 알림」 — 켠 회원만 저녁 8시 한 번, 채운 것이 있고 아직 남았을 때만
 *   '오늘 2개 채웠어요 · 하나 더 채우면 금색 별' (하나도 안 채운 날 · 다 채운 날은 안 보냄 — set_my_calendar_prefs).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";

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
  type CheckItem,
  type CheckItemDraft,
} from "@/lib/calendarChecks";
import { PROMISE_WEEK, toggleDay, weekdaysLabel } from "@/lib/promise153";
import { cn } from "@/lib/utils";
import { useRemoveCheckItem, useSaveCheckItem, useSetCalendarNudge, useSetWeeklyRecap } from "@/services/calendarCheckService";
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

const CheckItemsSheet = ({ open, onOpenChange, items, nudge, recap, onOpenFeed }: CheckItemsSheetProps) => {
  const [draft, setDraft] = useState<CheckItemDraft>(emptyCheckDraft);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const save = useSaveCheckItem();
  const remove = useRemoveCheckItem();
  const nudgeM = useSetCalendarNudge();
  const recapM = useSetWeeklyRecap();
  const full = items.length >= CHECK_ITEM_MAX;
  const showForm = editId != null || !full;

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
      await save.mutateAsync({ draft, id: editId });
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
              {items.map((i) => (
                <li key={i.id} className="flex items-center gap-2 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-bold text-foreground">{itemLabel(i)}</span>
                    <span className="block text-label text-muted-foreground">{i.weekdays ? `매주 ${weekdaysLabel(i.weekdays)}` : "매일"}</span>
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
              ))}
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
                <p className="text-label font-bold text-muted-foreground">언제? (안 고르면 매일)</p>
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
                <p className="mt-1.5 text-label text-muted-foreground">
                  {draft.weekdays.length === 0 || draft.weekdays.length === 7 ? "매일 체크해요" : `매주 ${weekdaysLabel(draft.weekdays)} 체크해요`}
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
