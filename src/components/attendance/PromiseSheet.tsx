/**
 * 🤝 운동 약속 걸기 · 고치기 시트 (2026-11-12 대표님 「추천하는대로 진행할게」 — 11/08 계획 「약속 4칸 + 대비책 1줄」 중 요일 · 시간대 · 대비책)
 *   요일(월요일부터 · 처음엔 주 2번 권함) → 시간대(골라도 되고 안 골라도 됨) → 대비책 한 줄(예시 3개) → 알림 → 약속 문장 → 「약속합니다」.
 *   지점은 내 지점 하나라 묻지 않는다. 지킴 = 약속한 날 출석(직접 체크 없음) — 시트에 그렇게 한 줄.
 *   검사 · 글은 src/lib/promise153.ts, 저장은 services/promiseService.ts (set_my_promise · stop_my_promise).
 *   (2-2 · 2026-11-13 대표님 「다음」) 알림 시각 고르기(전날 저녁 · 아침 7시 · 8시 30분 · 낮 12시 · 오후 5시 — set_my_promise_v2) ·
 *   「휴대폰 캘린더에 추가」(저장한 약속 그대로 · Edge Function calendar-ics — 앱 알림을 안 켠 회원에게도 휴대폰이 알려 준다).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Switch } from "@/components/ui/switch";
import {
  PLAN_B_EXAMPLES,
  PLAN_B_MAX,
  PROMISE_WEEK,
  REMIND_KEYS,
  TIME_SLOTS,
  draftChanged,
  draftFromPromise,
  draftHint,
  promiseDraftError,
  promiseSentence,
  remindLabel,
  toggleDay,
  type Promise153,
  type PromiseDraft,
} from "@/lib/promise153";
import { openPhoneCalendar } from "@/lib/promiseIcs";
import { cn } from "@/lib/utils";
import { useSetPromise, useStopPromise } from "@/services/promiseService";

const n = (v: number) => v.toLocaleString("ko-KR");

export interface PromiseSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  promise: Promise153 | null;
  /** '선릉역점' — 약속 문장에 */
  branchShort: string | null;
  /** 복귀 보너스 마일리지 (안내 한 줄) */
  returnBonus: number;
  /** '전날 저녁' 알림 시각 (서버 calendar_notice.promise_eve) */
  eveAt?: string;
  /** 오늘 (휴대폰 캘린더 첫 날) */
  today: string;
}

const PromiseSheet = ({ open, onOpenChange, promise, branchShort, returnBonus, eveAt = "20:00", today }: PromiseSheetProps) => {
  const [draft, setDraft] = useState<PromiseDraft>(() => draftFromPromise(promise));
  const [error, setError] = useState<string | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const save = useSetPromise();
  const stop = useStopPromise();

  // 열 때마다 지금 약속으로 다시 채운다
  useEffect(() => {
    if (!open) return;
    setDraft(draftFromPromise(promise));
    setError(null);
    setConfirmStop(false);
  }, [open, promise]);

  const set = (patch: Partial<PromiseDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError(null);
  };

  const submit = async () => {
    const e = promiseDraftError(draft);
    if (e) {
      setError(e);
      return;
    }
    try {
      const next = await save.mutateAsync(draft);
      const saved = next.promise;
      const when = draft.notify ? remindLabel(saved?.remind ?? draft.remind, eveAt) : null;
      toast.success(promise ? "약속을 고쳤어요" : when ? `약속했어요 · ${when}에 알려 드릴게요` : "약속했어요", {
        action: saved
          ? { label: "휴대폰 캘린더에", onClick: () => void openPhoneCalendar(saved, today, branchShort) }
          : undefined,
      });
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onStop = async () => {
    if (!confirmStop) {
      setConfirmStop(true);
      return;
    }
    try {
      await stop.mutateAsync();
      toast.success("약속을 멈췄어요 · 언제든 다시 걸 수 있어요");
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const busy = save.isPending || stop.isPending;
  const ready = draft.weekdays.length > 0;
  const unchanged = !!promise && !draftChanged(draft, promise);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="text-heading">{promise ? "운동 약속 고치기" : "운동 약속 걸기"}</DrawerTitle>
          <DrawerDescription className="text-label">약속한 날이 달력에 보이고, 고른 시각에 알려 드려요</DrawerDescription>
        </DrawerHeader>
        <div className="space-y-5 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          {/* 요일 */}
          <section aria-label="요일">
            <p className="text-label font-bold text-muted-foreground">언제 갈까요?</p>
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
                      "flex h-12 items-center justify-center rounded-xl border text-body font-black transition-transform active:scale-95",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground",
                    )}
                  >
                    {w.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-label text-muted-foreground">{draftHint(draft.weekdays.length)}</p>
          </section>

          {/* 시간대 — 골라도 되고 안 골라도 된다 */}
          <section aria-label="시간대">
            <p className="text-label font-bold text-muted-foreground">몇 시쯤? (골라도 되고 안 골라도 돼요)</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {TIME_SLOTS.map((s) => {
                const on = draft.timeSlot === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ timeSlot: on ? null : s.key })}
                    className={cn(
                      "flex h-12 flex-col items-center justify-center rounded-xl border transition-transform active:scale-95",
                      on ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground",
                    )}
                  >
                    <span className="text-body font-bold">{s.label}</span>
                    <span className="text-micro text-muted-foreground">{s.range}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 대비책 한 줄 */}
          <section aria-label="대비책">
            <label htmlFor="promise-plan-b" className="text-label font-bold text-muted-foreground">
              못 갈 것 같은 날엔? (대비책 한 줄 · 선택)
            </label>
            <input
              id="promise-plan-b"
              value={draft.planB}
              maxLength={PLAN_B_MAX + 10}
              onChange={(e) => set({ planB: e.target.value })}
              placeholder="예: 늦게 끝나면 30분만 하고 와요"
              className="mt-2 h-12 w-full rounded-xl border border-border bg-card px-4 text-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PLAN_B_EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => set({ planB: ex })}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-label font-bold transition-transform active:scale-95",
                    draft.planB === ex ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground",
                  )}
                >
                  {ex}
                </button>
              ))}
            </div>
          </section>

          {/* 알림 — 켜면 시각 고르기 */}
          <section aria-label="알림" className="rounded-xl bg-muted/60 px-4 py-3">
            <label className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-body font-bold text-foreground">약속 알림</span>
                <span className="block text-label text-muted-foreground">그날 이미 다녀왔으면 보내지 않아요 · 휴관일엔 쉬어요</span>
              </span>
              <Switch checked={draft.notify} onCheckedChange={(v) => set({ notify: v })} aria-label="약속 알림" />
            </label>
            {draft.notify && (
              <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="알림 시각">
                {REMIND_KEYS.map((k) => {
                  const on = draft.remind === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set({ remind: k })}
                      className={cn(
                        "h-9 rounded-full border px-3 text-label font-bold transition-transform active:scale-95",
                        on ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground",
                      )}
                    >
                      {remindLabel(k, eveAt)}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* 약속 문장 */}
          {ready && (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-4">
              <p className="text-label font-bold text-primary">나의 약속</p>
              <p className="mt-1 text-heading font-black text-foreground">{promiseSentence(draft, branchShort)}</p>
              <p className="mt-1.5 text-label text-muted-foreground">
                약속한 날 체육관에 오면 그날이 약속 지킨 날이에요
                {returnBonus > 0 ? ` · 약속을 놓쳐도 다시 오면 복귀 보너스 ${n(returnBonus)}점(한 달 한 번)` : ""}
              </p>
            </div>
          )}

          {/* 휴대폰 캘린더 — 저장한 약속 그대로 (고친 것이 있으면 저장한 뒤 알림 창의 단추로) */}
          {unchanged && (
            <button
              type="button"
              onClick={() => {
                if (!openPhoneCalendar(promise, today, branchShort)) toast.error("휴대폰 캘린더에 넣지 못했어요");
              }}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-transform active:scale-[0.99]"
            >
              <CalendarPlus className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-body font-bold text-foreground">휴대폰 캘린더에 추가</span>
                <span className="block text-label text-muted-foreground">앱 알림을 꺼 두어도 휴대폰 캘린더가 알려 줘요</span>
              </span>
            </button>
          )}

          {error && (
            <p role="alert" className="text-label font-bold text-destructive">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !ready}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-primary text-body font-black text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {save.isPending ? "저장하는 중…" : promise ? "이렇게 고칠게요" : "약속합니다"}
          </button>
          {promise && (
            <button
              type="button"
              onClick={() => void onStop()}
              disabled={busy}
              className="flex h-11 w-full items-center justify-center rounded-xl text-label font-bold text-muted-foreground active:bg-muted disabled:opacity-50"
            >
              {confirmStop ? "한 번 더 누르면 약속을 멈춰요" : "약속 잠시 멈추기"}
            </button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default PromiseSheet;
