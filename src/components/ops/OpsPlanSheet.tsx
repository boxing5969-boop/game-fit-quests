/**
 * 153운영본부 · 「일정」 — 내 일정 넣기 · 고치기 시트 (2026-11-02 대표님 "팀원들 스스로 스케줄 관리" · 3-2 2026-11-13 「3-2 시작」)
 *   종류(수업 · PT · 업무 · 외부 · 휴무 · 개인) · 제목 · 날짜 · 하루 종일/시각 · 반복 · 알림 · 장소 · 색 · 메모
 *   · 반복(3-2): 안 함 · 매일 · 매주(요일) · 매월(13일 · 둘째 금요일 · 마지막 금요일 · 말일) · 매년 + 간격 + 끝(계속 · 날짜까지 · n번)
 *     — 규칙 계산은 src/lib/opsRecur.ts(서버와 같은 결과), 미리 보기 '다음: …'
 *   · 알림(3-2): 시각 일정만 · 4개까지 · 기본 10분 전(대표님 결정 6 — 밤 10시 ~ 아침 8시는 알림함에만)
 *   · 반복 일정을 그날에서 열면 '이 일정만 / 이후 모두 / 전체' — 이 일정만 = 그날을 빼고 한 번 하는 일정을 새로(같은 묶음),
 *     이후 모두 = 원래 반복은 그 전날까지 + 그날부터 새 반복
 *   · 지우기: 범위대로 — 이 일정만 = 그날 빼기 · 이후 모두 = 그 전날까지 · 전체 = 휴지통(30일 안에 되살리기) · 두 번 눌러 확인
 *   · '개인'은 '대표님 · 지점장님께는 시간만 보이기'를 고를 수 있다 (서버도 개인만 받는다)
 *   검사는 src/lib/opsPlans.ts draftError (서버 ops_plan_save 와 같은 말)
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { OPS_WEEKDAY } from "@/lib/opsWork";
import {
  INTERVAL_CHOICES,
  PLAN_COLORS,
  PLAN_KINDS,
  PLAN_KIND_META,
  PLAN_LOCATION_MAX,
  PLAN_MEMO_MAX,
  PLAN_TITLE_MAX,
  REMINDER_MAX,
  REMINDER_OPTIONS,
  WEEK_MON_FIRST,
  addDays,
  ddayLabel,
  draftError,
  draftForScope,
  draftFromPlan,
  draftMonthModes,
  draftPayload,
  draftPreview,
  intervalLabel,
  isRepeat,
  newDraft,
  planDay,
  type EndMode,
  type OpsPlan,
  type PlanDraft,
  type PlanKind,
  type PlanScope,
} from "@/lib/opsPlans";
import { RECUR_COUNT_MAX, monthModeLabel, type RecurFreq } from "@/lib/opsRecur";
import { shortBranch } from "@/services/opsService";
import { useOpsPlanRemoveScope, useOpsPlanSave } from "@/services/opsPlanService";
import { OpsButton, OpsChip, OpsLabel, OpsSheet, opsInput } from "./OpsParts";

export type PlanSheetTarget =
  | { mode: "new"; branch: string; date: string; kind?: PlanKind; time?: { start: string; end: string } }
  /** date: 반복 일정을 그날에서 열었으면 그날 (반복 목록에서 열면 null) */
  | { mode: "edit"; plan: OpsPlan; date: string | null };

const SCOPE_LABEL: Record<PlanScope, string> = { one: "이 일정만", following: "이후 모두", all: "전체" };
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

const mdShort = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}(${OPS_WEEKDAY[new Date(`${d}T00:00:00Z`).getUTCDay()]})`;

const OpsPlanSheet = ({ target, today, onClose }: { target: PlanSheetTarget | null; today: string; onClose: () => void }) => {
  const save = useOpsPlanSave();
  const remove = useOpsPlanRemoveScope();
  // 닫히는 동안(애니메이션)에도 마지막 내용을 그린다
  const [last, setLast] = useState<PlanSheetTarget | null>(null);
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [scope, setScope] = useState<PlanScope>("all");
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    setConfirm(false);
    if (!target) return;
    setLast(target);
    if (target.mode === "new") {
      setDraft(newDraft(target.branch, target.date, target.kind, target.time));
      setScope("all");
    } else if (isRepeat(target.plan) && target.date) {
      // 반복 일정을 그날에서 열었으면 '이 일정만'부터 — 날짜도 그날
      setDraft(draftForScope(draftFromPlan(target.plan), target.plan, "one", target.date));
      setScope("one");
    } else {
      setDraft(draftFromPlan(target.plan));
      setScope("all");
    }
  }, [target]);

  const t = target ?? last;
  const preview = useMemo(() => (draft ? draftPreview(draft, 3) : []), [draft]);
  if (!t || !draft) return null;

  const editing = t.mode === "edit" ? t.plan : null;
  const repeatEdit = !!editing && isRepeat(editing);
  const occurrence = t.mode === "edit" && repeatEdit ? t.date : null;
  const oneOff = scope === "one" && !!occurrence;
  const err = draftError(draft, today, oneOff);

  const pickScope = (s: PlanScope) => {
    if (!editing || s === scope) return;
    setScope(s);
    setConfirm(false);
    setDraft((d) => (d ? draftForScope(d, editing, s, occurrence) : d));
  };
  const busy = save.isPending || remove.isPending;
  const set = <K extends keyof PlanDraft>(k: K, v: PlanDraft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  const pickKind = (k: PlanKind) =>
    setDraft((d) =>
      d
        ? {
            ...d,
            kind: k,
            // 휴무는 하루 종일부터 · 휴무에서 다른 종류로 오면 시각으로
            all_day: k === "off" ? true : d.kind === "off" ? false : d.all_day,
            private: k === "personal" ? d.private : false,
          }
        : d,
    );

  const pickFreq = (f: RecurFreq | "none") =>
    setDraft((d) =>
      d
        ? f === "none"
          ? { ...d, repeat: false }
          : {
              ...d,
              repeat: true,
              freq: f,
              interval: d.freq === f ? d.interval : 1,
              repeat_weekdays: d.repeat_weekdays.length ? d.repeat_weekdays : [new Date(`${d.start_on}T00:00:00Z`).getUTCDay()],
              monthMode: draftMonthModes(d).includes(d.monthMode) ? d.monthMode : "day",
            }
        : d,
    );

  const toggleDay = (wd: number) =>
    setDraft((d) =>
      d ? { ...d, repeat_weekdays: d.repeat_weekdays.includes(wd) ? d.repeat_weekdays.filter((x) => x !== wd) : [...d.repeat_weekdays, wd] } : d,
    );

  const toggleReminder = (min: number | null) =>
    setDraft((d) => {
      if (!d) return d;
      if (min === null) return { ...d, reminders: [] };
      if (d.reminders.includes(min)) return { ...d, reminders: d.reminders.filter((x) => x !== min) };
      if (d.reminders.length >= REMINDER_MAX) return d;
      return { ...d, reminders: [...d.reminders, min].sort((a, b) => a - b) };
    });

  const onSave = () => {
    if (err || busy) return;
    save.mutate(draftPayload(draft, editing ? scope : null, occurrence), {
      onSuccess: () => {
        toast.success(
          editing && occurrence && scope === "one"
            ? `${planDay(occurrence)} 일정만 바꿨어요`
            : editing && occurrence && scope === "following"
              ? `${planDay(occurrence)}부터 바꿨어요`
              : editing
                ? "일정을 고쳤어요"
                : "일정을 넣었어요",
        );
        onClose();
      },
      onError: (e) => toast.error((e as Error).message),
    });
  };

  const onRemove = () => {
    if (!editing) return;
    if (!confirm) return setConfirm(true);
    const s: PlanScope = repeatEdit && occurrence ? scope : "all";
    remove.mutate(
      { id: editing.id, scope: s, date: occurrence },
      {
        onSuccess: () => {
          toast.success(
            s === "one" && occurrence
              ? `${planDay(occurrence)}만 뺐어요`
              : s === "following" && occurrence
                ? `${planDay(occurrence)}부터 지웠어요`
                : "휴지통으로 옮겼어요 — 30일 안에 되살릴 수 있어요",
          );
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  const dday = !draft.repeat || oneOff ? ddayLabel(draft.start_on, today) : null;
  const sub = [shortBranch(draft.branch), occurrence && scope !== "all" ? `${planDay(occurrence)}${scope === "one" ? "만" : "부터"}` : null, dday && dday !== "D-day" ? dday : null]
    .filter(Boolean)
    .join(" · ");
  const removeLabel =
    repeatEdit && occurrence ? (scope === "one" ? "이 일정만 빼기" : scope === "following" ? "이후 모두 지우기" : "반복 모두 지우기") : repeatEdit ? "반복 모두 지우기" : "지우기";
  const showRepeat = !oneOff;
  const intervals = draft.repeat ? [...new Set([...INTERVAL_CHOICES[draft.freq], draft.interval])].sort((a, b) => a - b) : [];

  return (
    <OpsSheet
      open={!!target}
      onClose={onClose}
      title={editing ? "일정 고치기" : "일정 넣기"}
      sub={sub}
      footer={
        <div className="space-y-2">
          {err && <p className="text-center text-label text-muted-foreground">{err}</p>}
          <OpsButton onClick={onSave} disabled={!!err || busy}>
            {save.isPending ? "저장하는 중…" : editing && occurrence && scope !== "all" ? `${SCOPE_LABEL[scope]} 바꾸기` : "저장"}
          </OpsButton>
          {editing && (
            <OpsButton tone="danger" onClick={onRemove} disabled={busy}>
              {confirm ? "한 번 더 누르면 지워요" : removeLabel}
            </OpsButton>
          )}
        </div>
      }
    >
      {occurrence && (
        <>
          <OpsLabel>바꿀 범위</OpsLabel>
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-secondary/70 p-1">
            {(["one", "following", "all"] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={scope === s}
                onClick={() => pickScope(s)}
                className={cn(
                  "h-11 rounded-xl text-body font-black transition-all active:scale-[0.98]",
                  scope === s ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground",
                )}
              >
                {SCOPE_LABEL[s]}
              </button>
            ))}
          </div>
        </>
      )}

      <OpsLabel>종류</OpsLabel>
      <div className="grid grid-cols-3 gap-1.5">
        {PLAN_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={draft.kind === k}
            onClick={() => pickKind(k)}
            className={cn(
              "flex h-11 items-center justify-center gap-1.5 rounded-xl border text-body font-black transition-colors active:scale-[0.98]",
              draft.kind === k ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground",
            )}
          >
            <span className={cn("h-2.5 w-2.5 rounded-full", PLAN_KIND_META[k].dot)} aria-hidden />
            {PLAN_KIND_META[k].label}
          </button>
        ))}
      </div>

      <OpsLabel>제목</OpsLabel>
      <input
        value={draft.title}
        onChange={(e) => set("title", e.target.value.slice(0, PLAN_TITLE_MAX))}
        placeholder={PLAN_KIND_META[draft.kind].hint}
        maxLength={PLAN_TITLE_MAX}
        className={opsInput}
      />

      <OpsLabel>{draft.repeat && showRepeat ? "시작하는 날" : "날짜"}</OpsLabel>
      <input
        type="date"
        value={draft.start_on}
        min={addDays(today, -62)}
        max={addDays(today, 400)}
        onChange={(e) => set("start_on", e.target.value)}
        className={opsInput}
      />
      {(!draft.repeat || !showRepeat) && (
        <>
          <OpsLabel>끝나는 날 (여러 날이면)</OpsLabel>
          <input
            type="date"
            value={draft.end_on}
            min={draft.start_on}
            max={draft.start_on ? addDays(draft.start_on, 62) : undefined}
            onChange={(e) => set("end_on", e.target.value)}
            className={opsInput}
          />
        </>
      )}

      <OpsLabel>시간</OpsLabel>
      <div className="flex gap-1.5">
        <OpsChip on={!draft.all_day} onClick={() => set("all_day", false)}>
          시각 정하기
        </OpsChip>
        <OpsChip on={draft.all_day} onClick={() => set("all_day", true)}>
          하루 종일
        </OpsChip>
      </div>
      {!draft.all_day && (
        <div className="mt-2 flex items-center gap-1.5">
          <input
            type="time"
            step={300}
            value={draft.start_time}
            onChange={(e) => set("start_time", e.target.value)}
            className={`${opsInput} py-2`}
            aria-label="시작 시각"
          />
          <span className="text-body text-muted-foreground">~</span>
          <input
            type="time"
            step={300}
            value={draft.end_time}
            onChange={(e) => set("end_time", e.target.value)}
            className={`${opsInput} py-2`}
            aria-label="끝 시각"
          />
        </div>
      )}

      {showRepeat && (
        <>
          <OpsLabel>반복</OpsLabel>
          <div className="flex flex-wrap gap-1.5">
            {FREQS.map((f) => (
              <OpsChip key={f.key} on={f.key === "none" ? !draft.repeat : draft.repeat && draft.freq === f.key} onClick={() => pickFreq(f.key)}>
                {f.label}
              </OpsChip>
            ))}
          </div>
          {draft.repeat && (
            <div className="mt-2 space-y-2 rounded-2xl bg-secondary/50 p-3">
              {draft.freq === "WEEKLY" && (
                <div className="grid grid-cols-7 gap-1">
                  {WEEK_MON_FIRST.map((wd) => (
                    <button
                      key={wd}
                      type="button"
                      aria-pressed={draft.repeat_weekdays.includes(wd)}
                      aria-label={`${OPS_WEEKDAY[wd]}요일`}
                      onClick={() => toggleDay(wd)}
                      className={cn(
                        "h-10 rounded-xl border text-body font-black active:scale-95",
                        draft.repeat_weekdays.includes(wd) ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground",
                      )}
                    >
                      {OPS_WEEKDAY[wd]}
                    </button>
                  ))}
                </div>
              )}
              {draft.freq === "MONTHLY" && (
                <div className="flex flex-wrap gap-1.5">
                  {draftMonthModes(draft).map((m) => (
                    <OpsChip key={m} on={draft.monthMode === m} onClick={() => set("monthMode", m)}>
                      {monthModeLabel(m, draft.start_on)}
                    </OpsChip>
                  ))}
                </div>
              )}
              {intervals.length > 1 && (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="간격">
                  {intervals.map((n) => (
                    <OpsChip key={n} on={draft.interval === n} onClick={() => set("interval", n)}>
                      {intervalLabel(draft.freq, n)}
                    </OpsChip>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="끝">
                {ENDS.map((e) => (
                  <OpsChip key={e.key} on={draft.endMode === e.key} onClick={() => set("endMode", e.key)}>
                    {e.label}
                  </OpsChip>
                ))}
              </div>
              {draft.endMode === "until" && (
                <input
                  type="date"
                  value={draft.until_on}
                  min={draft.start_on}
                  onChange={(e) => set("until_on", e.target.value)}
                  className={opsInput}
                  aria-label="반복이 끝나는 날"
                />
              )}
              {draft.endMode === "count" && (
                <label className="flex items-center gap-2 text-body text-foreground">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={RECUR_COUNT_MAX}
                    value={Number.isFinite(draft.count) ? draft.count : ""}
                    onChange={(e) => set("count", Math.floor(Number(e.target.value)))}
                    className={cn(opsInput, "w-24")}
                    aria-label="반복 횟수"
                  />
                  번
                </label>
              )}
              {preview.length > 0 && <p className="text-label text-muted-foreground">다음: {preview.map(mdShort).join(" · ")}</p>}
            </div>
          )}
        </>
      )}

      {!draft.all_day && (
        <>
          <OpsLabel>알림 (4개까지)</OpsLabel>
          <div className="flex flex-wrap gap-1.5">
            <OpsChip on={draft.reminders.length === 0} onClick={() => toggleReminder(null)}>
              없음
            </OpsChip>
            {REMINDER_OPTIONS.map((o) => (
              <OpsChip
                key={o.min}
                on={draft.reminders.includes(o.min)}
                disabled={!draft.reminders.includes(o.min) && draft.reminders.length >= REMINDER_MAX}
                onClick={() => toggleReminder(o.min)}
              >
                {o.label}
              </OpsChip>
            ))}
          </div>
        </>
      )}

      <OpsLabel>장소 (선택)</OpsLabel>
      <input
        value={draft.location}
        onChange={(e) => set("location", e.target.value.slice(0, PLAN_LOCATION_MAX))}
        placeholder="예) 2층 링 · 강남 교육장"
        maxLength={PLAN_LOCATION_MAX}
        className={opsInput}
      />

      <OpsLabel>색</OpsLabel>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="색">
        <button
          type="button"
          role="radio"
          aria-checked={!draft.color}
          aria-label="종류 색"
          onClick={() => set("color", null)}
          className={cn(
            "flex h-9 items-center gap-1 rounded-full border px-3 text-label font-bold active:scale-95",
            !draft.color ? "border-foreground text-foreground" : "border-border text-muted-foreground",
          )}
        >
          <span className={cn("h-3 w-3 rounded-full", PLAN_KIND_META[draft.kind].dot)} aria-hidden />
          종류 색
        </button>
        {PLAN_COLORS.map((c) => (
          <button
            key={c.key}
            type="button"
            role="radio"
            aria-checked={draft.color === c.key}
            aria-label={c.label}
            onClick={() => set("color", c.key)}
            className={cn("h-9 w-9 rounded-full border-2 active:scale-95", draft.color === c.key ? "border-foreground" : "border-transparent")}
          >
            <span className="mx-auto block h-6 w-6 rounded-full" style={{ backgroundColor: c.hex }} aria-hidden />
          </button>
        ))}
      </div>

      <OpsLabel>메모 (선택)</OpsLabel>
      <textarea
        value={draft.memo}
        onChange={(e) => set("memo", e.target.value.slice(0, PLAN_MEMO_MAX))}
        rows={2}
        maxLength={PLAN_MEMO_MAX}
        className={cn(opsInput, "resize-none")}
      />

      {draft.kind === "personal" && (
        <label className="mt-4 flex items-center gap-2 text-body text-foreground">
          <input type="checkbox" checked={draft.private} onChange={(e) => set("private", e.target.checked)} className="h-5 w-5" />
          대표님 · 지점장님께는 시간만 보이기
        </label>
      )}
    </OpsSheet>
  );
};

export default OpsPlanSheet;
