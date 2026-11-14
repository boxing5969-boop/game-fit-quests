/**
 * 📅 내 일정 · 기념일 시트 (캘린더 3-5단계 · 2026-11-14 대표님 「진행하자」 — 「캘린더 3단계 보고서」 3-5 · 네이버처럼, 153식으로)
 *   · 일정 = 이름 · 날짜(여러 날 한 달까지) · 하루 종일 / 시각 · 반복(3-2 운영본부와 같은 규칙) · 이날은 쉬어요 · 알림 2개 · 색 8 · 장소 · 메모
 *   · 기념일 = 이름 · 양력(매년 그 날) / 음력(lib/lunar 로 앞으로 올 양력 날들을 계산해 보낸다 — 이 조각 안에서만 음력 표를 받는다) · 알림 · 색 · 메모
 *   · 반복 일정을 그날에서 열면 '이 날만'부터(3-2 와 같은 결) · 빼기는 두 번 눌러(지우지 않고 removed_at · 이 날만 = 빼는 날).
 *   · 검사 말은 서버와 같다(lib/memberEvents myEventDraftError) · 저장 = set_my_cal_event · 빼기 = remove_my_cal_event.
 *   WorkoutCalendar 가 누를 때만 받는 조각 — 그날 카드 '+ 내 일정' · 내 일정 줄 · 목록 · 검색에서 연다.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Moon } from "lucide-react";

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Switch } from "@/components/ui/switch";
import { lunarAdjustNote, lunarLabel, lunarOccurrences, solarToLunar } from "@/lib/lunar";
import {
  ALLDAY_REMINDERS,
  MY_AHEAD_DAYS,
  MY_COLORS,
  MY_LOCATION_MAX,
  MY_MEMO_MAX,
  MY_PAST_DAYS,
  MY_REMINDER_MAX,
  MY_SPAN_MAX,
  MY_TITLE_MAX,
  REST_LABEL,
  TIMED_REMINDERS,
  draftForScope,
  draftFromMyEvent,
  emptyMyEventDraft,
  isRepeating,
  mdwShort,
  myDraftPreview,
  myEventDraftError,
  myEventHex,
  myEventPayload,
  reminderLabel,
  type EndMode,
  type MyEvent,
  type MyEventDraft,
  type MyEventKind,
  type MyScope,
} from "@/lib/memberEvents";
import { RECUR_COUNT_MAX, monthModeLabel, monthModes, type RecurFreq } from "@/lib/opsRecur";
import { cn } from "@/lib/utils";
import { useRemoveMyEvent, useSaveMyEvent } from "@/services/calendarCheckService";

export interface MyEventTarget {
  mode: "new" | "edit";
  /** 새 일정 = 고른 날 · 고치기 = 연 날(반복이면 그 회차) */
  day: string;
  kind?: MyEventKind;
  event?: MyEvent;
}

export interface MyEventSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: MyEventTarget | null;
  today: string;
}

const addDays = (d: string, n: number) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10);
};

const SCOPE_LABEL: Record<MyScope, string> = { one: "이 날만", following: "이후 모두", all: "전체" };
const FREQS: ReadonlyArray<{ key: RecurFreq | "none"; label: string }> = [
  { key: "none", label: "안 함" },
  { key: "DAILY", label: "매일" },
  { key: "WEEKLY", label: "매주" },
  { key: "MONTHLY", label: "매월" },
  { key: "YEARLY", label: "매년" },
];
const ENDS: ReadonlyArray<{ key: EndMode; label: string }> = [
  { key: "never", label: "계속" },
  { key: "until", label: "날짜까지" },
  { key: "count", label: "횟수" },
];
/** 월요일부터 — 값은 0 = 일 … 6 = 토 */
const WEEK = [
  { d: 1, l: "월" },
  { d: 2, l: "화" },
  { d: 3, l: "수" },
  { d: 4, l: "목" },
  { d: 5, l: "금" },
  { d: 6, l: "토" },
  { d: 0, l: "일" },
] as const;
const PLAN_EXAMPLES = ["회식", "여행", "출장", "야근", "병원"] as const;
const ANNIV_EXAMPLES = ["결혼기념일", "엄마 생신", "아빠 생신", "만난 날"] as const;

const inputCls =
  "h-12 w-full rounded-xl border border-border bg-card px-4 text-body tabular-nums text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";

const Chip = ({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) => (
  <button
    type="button"
    aria-pressed={on}
    disabled={disabled}
    onClick={onClick}
    className={cn(
      "inline-flex h-10 items-center justify-center gap-1 rounded-full border px-3.5 text-label font-bold transition-transform active:scale-95 disabled:opacity-40",
      on ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground",
    )}
  >
    {children}
  </button>
);

const Label = ({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) => (
  <label htmlFor={htmlFor} className="block text-label font-bold text-muted-foreground">
    {children}
  </label>
);

const MyEventSheet = ({ open, onOpenChange, target, today }: MyEventSheetProps) => {
  const save = useSaveMyEvent();
  const remove = useRemoveMyEvent();
  const [draft, setDraft] = useState<MyEventDraft>(() => emptyMyEventDraft(today));
  const [scope, setScope] = useState<MyScope>("all");
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const editing = target?.mode === "edit" ? (target.event ?? null) : null;
  const repeatEdit = !!editing && editing.kind === "plan" && !!editing.rrule;
  const occurrence = editing && isRepeating(editing) ? (target?.day ?? null) : null;

  useEffect(() => {
    if (!open || !target) return;
    setError(null);
    setConfirm(false);
    if (target.mode === "new") {
      setDraft(emptyMyEventDraft(target.day, target.kind ?? "plan"));
      setScope("all");
    } else if (target.event) {
      const e = target.event;
      if (e.kind === "plan" && e.rrule && target.day) {
        // 반복 일정을 그날에서 열었으면 '이 날만'부터 — 날짜도 그날
        setDraft(draftForScope(draftFromMyEvent(e), e, "one", target.day));
        setScope("one");
      } else {
        setDraft(draftFromMyEvent(e));
        setScope("all");
      }
    }
  }, [open, target]);

  const set = (patch: Partial<MyEventDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError(null);
    setConfirm(false);
  };
  const pickScope = (s: MyScope) => {
    if (!editing || s === scope) return;
    setScope(s);
    setConfirm(false);
    setDraft((d) => draftForScope(d, editing, s, occurrence));
  };
  const pickKind = (k: MyEventKind) => {
    if (editing || k === draft.kind) return;
    setDraft((d) => ({ ...emptyMyEventDraft(d.startOn, k), title: d.title, color: d.color, memo: d.memo }));
    setError(null);
  };
  const pickFreq = (f: RecurFreq | "none") => {
    setDraft((d) =>
      f === "none"
        ? { ...d, repeat: false }
        : {
            ...d,
            repeat: true,
            freq: f,
            interval: d.freq === f ? d.interval : 1,
            weekdays: d.weekdays.length ? d.weekdays : [new Date(`${d.startOn}T00:00:00Z`).getUTCDay()],
            monthMode: monthModes(d.startOn).includes(d.monthMode) ? d.monthMode : "day",
          },
    );
    setError(null);
  };
  const toggleDay = (wd: number) =>
    set({ weekdays: draft.weekdays.includes(wd) ? draft.weekdays.filter((x) => x !== wd) : [...draft.weekdays, wd] });
  const toggleReminder = (min: number | null) => {
    if (min == null) return set({ reminders: [] });
    if (draft.reminders.includes(min)) return set({ reminders: draft.reminders.filter((m) => m !== min) });
    if (draft.reminders.length >= MY_REMINDER_MAX) {
      setError("알림은 2개까지예요");
      return;
    }
    set({ reminders: [...draft.reminders, min].sort((a, b) => a - b) });
  };
  const setAllDay = (allDay: boolean) => {
    if (allDay === draft.allDay) return;
    // 알림 고르는 칸이 바뀐다 — 맞지 않는 알림은 비운다
    const allowed: readonly number[] = allDay ? ALLDAY_REMINDERS : TIMED_REMINDERS;
    set({ allDay, reminders: draft.reminders.filter((m) => allowed.includes(m)).length ? draft.reminders.filter((m) => allowed.includes(m)) : allDay ? [] : [30] });
  };

  // 음력 기념일 — 앞으로 올 양력 날들 (이 조각 안에서만 음력 표)
  const lunar = draft.kind === "anniv" && draft.calendar === "lunar";
  const occDates = useMemo(
    () => (lunar ? lunarOccurrences(draft.lunarM, draft.lunarD, draft.lunarLeap, today) : []),
    [lunar, draft.lunarM, draft.lunarD, draft.lunarLeap, today],
  );
  const nextLunar = occDates.find((d) => d >= today) ?? null;
  const lunarNote = nextLunar ? lunarAdjustNote(Number(nextLunar.slice(0, 4)), draft.lunarM, draft.lunarD, draft.lunarLeap) : null;
  const opts = { scope: editing ? scope : undefined, occurrence, occDates };
  const oneOff = !!editing && scope === "one" && !!occurrence;
  const preview = useMemo(() => (draft.kind === "plan" && draft.repeat && !oneOff ? myDraftPreview(draft, 3) : []), [draft, oneOff]);
  const titleLen = [...draft.title.replace(/\s+/g, " ").trim()].length;
  const busy = save.isPending || remove.isPending;
  const allDayLike = draft.kind === "anniv" || draft.allDay;
  const reminderChoices: readonly number[] = allDayLike ? ALLDAY_REMINDERS : TIMED_REMINDERS;

  const switchToLunar = (on: boolean) => {
    if (on === lunar) return;
    if (on) {
      // 양력 날짜를 음력으로 바꿔 채워 준다(표 안의 날이면)
      const l = solarToLunar(draft.startOn);
      set({ calendar: "lunar", ...(l ? { lunarM: l.m, lunarD: l.d, lunarLeap: l.leap } : {}) });
    } else {
      set({ calendar: "solar", startOn: nextLunar ?? draft.startOn });
    }
  };

  const submit = async () => {
    const e = myEventDraftError(draft, today, opts);
    if (e) {
      setError(e);
      return;
    }
    try {
      await save.mutateAsync(myEventPayload(draft, opts));
      toast.success(
        editing && occurrence && scope === "one"
          ? `${mdwShort(occurrence)}만 바꿨어요`
          : editing && occurrence && scope === "following"
            ? `${mdwShort(occurrence)}부터 바꿨어요`
            : editing
              ? "고쳤어요"
              : draft.kind === "anniv"
                ? "기념일을 넣었어요 · 해마다 달력에 보여요"
                : `${mdwShort(draft.startOn)}에 넣었어요`,
      );
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onRemove = async () => {
    if (!editing) return;
    if (!confirm) {
      setConfirm(true);
      return;
    }
    const s: MyScope = repeatEdit && occurrence ? scope : "all";
    try {
      await remove.mutateAsync({ id: editing.id, scope: s, date: occurrence });
      toast.success(s === "one" && occurrence ? `${mdwShort(occurrence)}만 뺐어요` : s === "following" && occurrence ? `${mdwShort(occurrence)}부터 뺐어요` : "뺐어요");
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const removeLabel = repeatEdit && occurrence ? (scope === "one" ? "이 날만 빼기" : scope === "following" ? "이후 모두 빼기" : "반복 모두 빼기") : "빼기";
  const head = editing ? (editing.kind === "anniv" ? "기념일 고치기" : "일정 고치기") : "내 일정";
  const sub = editing
    ? occurrence && scope !== "all" && repeatEdit
      ? `${mdwShort(occurrence)}${scope === "one" ? "만" : "부터"}`
      : editing.kind === "anniv"
        ? "해마다 달력에 보여요"
        : mdwShort(editing.startOn)
    : draft.kind === "anniv"
      ? "해마다 달력에 보여요 · 알림은 아침 9시"
      : `${mdwShort(draft.startOn)} · 나만 보여요`;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="text-heading">{head}</DrawerTitle>
          <DrawerDescription className="text-label">{sub}</DrawerDescription>
        </DrawerHeader>
        <div className="space-y-5 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          {!editing && (
            <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="무엇을 넣을까요">
              {(["plan", "anniv"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={draft.kind === k}
                  onClick={() => pickKind(k)}
                  className={cn(
                    "h-11 rounded-xl border text-body font-bold active:scale-[0.98]",
                    draft.kind === k ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground",
                  )}
                >
                  {k === "plan" ? "일정" : "기념일"}
                </button>
              ))}
            </div>
          )}

          {repeatEdit && occurrence && (
            <div>
              <Label>어디까지 바꿀까요?</Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(["one", "following", "all"] as const).map((s) => (
                  <Chip key={s} on={scope === s} onClick={() => pickScope(s)}>
                    {SCOPE_LABEL[s]}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="my-ev-title">이름</Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(draft.kind === "anniv" ? ANNIV_EXAMPLES : PLAN_EXAMPLES).map((ex) => (
                <Chip key={ex} on={draft.title === ex} onClick={() => set({ title: ex })}>
                  {ex}
                </Chip>
              ))}
            </div>
            <input
              id="my-ev-title"
              value={draft.title}
              maxLength={MY_TITLE_MAX + 10}
              onChange={(e) => set({ title: e.target.value })}
              placeholder={draft.kind === "anniv" ? "예: 결혼기념일" : "예: 팀 회식"}
              className={cn(inputCls, "mt-2")}
            />
            <p className={cn("mt-1 text-right text-micro tabular-nums", titleLen > MY_TITLE_MAX ? "font-bold text-destructive" : "text-muted-foreground")}>
              {titleLen}/{MY_TITLE_MAX}
            </p>
          </div>

          {draft.kind === "plan" ? (
            <>
              <div>
                <Label htmlFor="my-ev-start">{draft.repeat && !oneOff ? "시작하는 날" : "날짜"}</Label>
                <input
                  id="my-ev-start"
                  type="date"
                  value={draft.startOn}
                  min={addDays(today, -MY_PAST_DAYS)}
                  max={addDays(today, MY_AHEAD_DAYS)}
                  onChange={(e) => set({ startOn: e.target.value, endOn: draft.endOn < e.target.value ? e.target.value : draft.endOn })}
                  className={cn(inputCls, "mt-2")}
                />
                {(!draft.repeat || oneOff) && (
                  <div className="mt-2">
                    <Label htmlFor="my-ev-end">끝나는 날 (여러 날이면 · 한 달까지)</Label>
                    <input
                      id="my-ev-end"
                      type="date"
                      value={draft.endOn}
                      min={draft.startOn}
                      max={draft.startOn ? addDays(draft.startOn, MY_SPAN_MAX) : undefined}
                      onChange={(e) => set({ endOn: e.target.value })}
                      className={cn(inputCls, "mt-2")}
                    />
                  </div>
                )}
              </div>

              <div>
                <Label>시간</Label>
                <div className="mt-2 flex gap-1.5">
                  <Chip on={draft.allDay} onClick={() => setAllDay(true)}>
                    하루 종일
                  </Chip>
                  <Chip on={!draft.allDay} onClick={() => setAllDay(false)}>
                    시각 정하기
                  </Chip>
                </div>
                {!draft.allDay && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      type="time"
                      aria-label="시작 시각"
                      value={draft.startTime}
                      step={300}
                      onChange={(e) => set({ startTime: e.target.value })}
                      className={inputCls}
                    />
                    <input
                      type="time"
                      aria-label="끝 시각"
                      value={draft.endTime}
                      step={300}
                      onChange={(e) => set({ endTime: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                )}
              </div>

              {!oneOff && (
                <div>
                  <Label>반복</Label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {FREQS.map((f) => (
                      <Chip key={f.key} on={f.key === "none" ? !draft.repeat : draft.repeat && draft.freq === f.key} onClick={() => pickFreq(f.key)}>
                        {f.label}
                      </Chip>
                    ))}
                  </div>
                  {draft.repeat && (
                    <div className="mt-3 space-y-3 rounded-xl bg-muted/60 p-3">
                      {draft.freq === "WEEKLY" && (
                        <div className="grid grid-cols-7 gap-1" role="group" aria-label="반복할 요일">
                          {WEEK.map((w) => (
                            <button
                              key={w.d}
                              type="button"
                              aria-pressed={draft.weekdays.includes(w.d)}
                              onClick={() => toggleDay(w.d)}
                              className={cn(
                                "h-10 rounded-lg border text-label font-bold active:scale-95",
                                draft.weekdays.includes(w.d) ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground",
                              )}
                            >
                              {w.l}
                            </button>
                          ))}
                        </div>
                      )}
                      {draft.freq === "MONTHLY" && (
                        <div className="flex flex-wrap gap-1.5">
                          {monthModes(draft.startOn).map((m) => (
                            <Chip key={m} on={draft.monthMode === m} onClick={() => set({ monthMode: m })}>
                              {monthModeLabel(m, draft.startOn)}
                            </Chip>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {ENDS.map((e) => (
                          <Chip key={e.key} on={draft.endMode === e.key} onClick={() => set({ endMode: e.key })}>
                            {e.label}
                          </Chip>
                        ))}
                      </div>
                      {draft.endMode === "until" && (
                        <input
                          type="date"
                          aria-label="반복이 끝나는 날"
                          value={draft.untilOn}
                          min={draft.startOn}
                          max={addDays(today, 3650)}
                          onChange={(e) => set({ untilOn: e.target.value })}
                          className={inputCls}
                        />
                      )}
                      {draft.endMode === "count" && (
                        <label className="flex items-center gap-2 text-body font-bold text-foreground">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={RECUR_COUNT_MAX}
                            value={draft.count}
                            onChange={(e) => set({ count: Math.trunc(Number(e.target.value) || 0) })}
                            className={cn(inputCls, "w-28")}
                          />
                          번
                        </label>
                      )}
                      {preview.length > 0 && (
                        <p className="text-label text-muted-foreground">다음 · {preview.map(mdwShort).join(" · ")}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-start justify-between gap-3 rounded-xl bg-muted/60 p-3">
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-body font-bold text-foreground">
                    <Moon className="h-4 w-4 text-primary" aria-hidden />
                    {REST_LABEL}
                  </span>
                  <span className="mt-0.5 block text-label text-muted-foreground">그날은 운동 약속 알림 · 저녁 체크 알림을 쉬어요</span>
                </span>
                <Switch checked={draft.rest} onCheckedChange={(v) => set({ rest: v })} aria-label={REST_LABEL} />
              </div>
            </>
          ) : (
            <>
              <div>
                <Label>날짜</Label>
                <div className="mt-2 flex gap-1.5">
                  <Chip on={!lunar} onClick={() => switchToLunar(false)}>
                    양력
                  </Chip>
                  <Chip on={lunar} onClick={() => switchToLunar(true)}>
                    음력
                  </Chip>
                </div>
                {lunar ? (
                  <div className="mt-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        aria-label="음력 달"
                        value={draft.lunarM}
                        onChange={(e) => set({ lunarM: Number(e.target.value) })}
                        className={inputCls}
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <option key={m} value={m}>
                            {m}월
                          </option>
                        ))}
                      </select>
                      <select aria-label="음력 날" value={draft.lunarD} onChange={(e) => set({ lunarD: Number(e.target.value) })} className={inputCls}>
                        {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d}>
                            {d}일
                          </option>
                        ))}
                      </select>
                    </div>
                    <label className="flex items-center gap-2 text-body font-bold text-foreground">
                      <input type="checkbox" checked={draft.lunarLeap} onChange={(e) => set({ lunarLeap: e.target.checked })} className="h-5 w-5 accent-primary" />
                      윤달
                    </label>
                    <p className="text-label text-muted-foreground">
                      {nextLunar ? `${lunarLabel({ m: draft.lunarM, d: draft.lunarD, leap: draft.lunarLeap })} · 다음은 ${nextLunar.slice(0, 4)}년 ${mdwShort(nextLunar)}` : "날짜를 다시 골라 주세요"}
                    </p>
                    {lunarNote && <p className="text-label text-muted-foreground">{lunarNote}</p>}
                  </div>
                ) : (
                  <input
                    type="date"
                    aria-label="기념일 날짜"
                    value={draft.startOn}
                    min="1900-01-01"
                    max={addDays(today, MY_AHEAD_DAYS)}
                    onChange={(e) => set({ startOn: e.target.value })}
                    className={cn(inputCls, "mt-2")}
                  />
                )}
              </div>
            </>
          )}

          <div>
            <Label>알림 (2개까지)</Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip on={draft.reminders.length === 0} onClick={() => toggleReminder(null)}>
                없음
              </Chip>
              {reminderChoices.map((m) => (
                <Chip key={m} on={draft.reminders.includes(m)} onClick={() => toggleReminder(m)}>
                  {reminderLabel(m, allDayLike)}
                </Chip>
              ))}
            </div>
            {/* 하루 종일 · 기념일 알림은 아침 9시라 조용한 시간과 겹치지 않는다 — 시각 일정만 */}
            {!allDayLike && draft.reminders.length > 0 && (
              <p className="mt-1.5 text-label text-muted-foreground">밤 10시 ~ 아침 8시 알림은 알림함에만 들어가요</p>
            )}
          </div>

          <div>
            <Label>색</Label>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="색">
              {MY_COLORS.map((c) => {
                const on = (draft.color ?? null) === c.key || (!draft.color && myEventHex({ color: null, kind: draft.kind }) === c.hex);
                return (
                  <button
                    key={c.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={c.label}
                    onClick={() => set({ color: c.key })}
                    className={cn("flex h-9 w-9 items-center justify-center rounded-full active:scale-90", on && "ring-2 ring-foreground ring-offset-2 ring-offset-background")}
                    style={{ backgroundColor: c.hex }}
                  >
                    {on && <Check className="h-4 w-4 text-white" aria-hidden />}
                  </button>
                );
              })}
            </div>
          </div>

          {draft.kind === "plan" && (
            <div>
              <Label htmlFor="my-ev-loc">장소 (선택)</Label>
              <input
                id="my-ev-loc"
                value={draft.location}
                maxLength={MY_LOCATION_MAX + 10}
                onChange={(e) => set({ location: e.target.value })}
                placeholder="예: 강남역"
                className={cn(inputCls, "mt-2")}
              />
            </div>
          )}

          <div>
            <Label htmlFor="my-ev-memo">메모 (선택)</Label>
            <textarea
              id="my-ev-memo"
              value={draft.memo}
              rows={3}
              maxLength={MY_MEMO_MAX + 20}
              onChange={(e) => set({ memo: e.target.value })}
              className="mt-2 w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-body text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <p className={cn("text-right text-micro tabular-nums", [...draft.memo.trim()].length > MY_MEMO_MAX ? "font-bold text-destructive" : "text-muted-foreground")}>
              {[...draft.memo.trim()].length}/{MY_MEMO_MAX}
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
            disabled={busy || !draft.title.trim()}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-primary text-body font-black text-primary-foreground active:scale-[0.98] disabled:opacity-50"
          >
            {save.isPending ? "저장하는 중…" : editing ? "저장" : "넣기"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => void onRemove()}
              disabled={busy}
              className="flex h-12 w-full items-center justify-center rounded-2xl text-body font-bold text-muted-foreground active:bg-muted disabled:opacity-50"
            >
              {confirm ? `한 번 더 누르면 ${removeLabel}` : removeLabel}
            </button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default MyEventSheet;
