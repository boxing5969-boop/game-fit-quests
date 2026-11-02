/**
 * 153운영본부 · 「일정」 — 내 일정 넣기 · 고치기 시트 (2026-11-02 대표님 "팀원들 스스로 스케줄 관리")
 *   종류(수업 · PT · 업무 · 외부 · 휴무 · 개인) · 제목 · 날짜 · 한 번/매주(요일 · 언제까지) · 여러 날 · 하루 종일/시각 · 메모
 *   · '개인'은 '대표님 · 지점장님께는 시간만 보이기'를 고를 수 있다 (서버도 개인만 받는다)
 *   · 반복 일정을 그날에서 열면 '이 날만 / 매주 전체' — 이 날만 바꾸기는 서버가 그날을 빼고 한 번 하는 일정을 새로 만든다
 *   · 지우기: 한 번 하는 일정은 지우기, 반복은 '이 날만 빼기' 또는 '반복 모두 지우기' (두 번 눌러 확인)
 *   검사는 src/lib/opsPlans.ts draftError (서버 ops_plan_save 와 같은 말)
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { OPS_WEEKDAY } from "@/lib/opsWork";
import {
  PLAN_KINDS,
  PLAN_KIND_META,
  PLAN_MEMO_MAX,
  PLAN_TITLE_MAX,
  WEEK_MON_FIRST,
  addDays,
  draftError,
  draftFromPlan,
  draftPayload,
  isRepeat,
  newDraft,
  planDay,
  type OpsPlan,
  type PlanDraft,
  type PlanKind,
} from "@/lib/opsPlans";
import { shortBranch } from "@/services/opsService";
import { useOpsPlanRemove, useOpsPlanSave, useOpsPlanSkip } from "@/services/opsPlanService";
import { OpsButton, OpsChip, OpsLabel, OpsSheet, opsInput } from "./OpsParts";

export type PlanSheetTarget =
  | { mode: "new"; branch: string; date: string; kind?: PlanKind }
  /** date: 반복 일정을 그날에서 열었으면 그날 (매주 반복 목록에서 열면 null) */
  | { mode: "edit"; plan: OpsPlan; date: string | null };

type Scope = "day" | "series";

const OpsPlanSheet = ({ target, today, onClose }: { target: PlanSheetTarget | null; today: string; onClose: () => void }) => {
  const save = useOpsPlanSave();
  const skip = useOpsPlanSkip();
  const remove = useOpsPlanRemove();
  // 닫히는 동안(애니메이션)에도 마지막 내용을 그린다
  const [last, setLast] = useState<PlanSheetTarget | null>(null);
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [scope, setScope] = useState<Scope>("series");
  const [confirm, setConfirm] = useState<"skip" | "remove" | null>(null);

  useEffect(() => {
    setConfirm(null);
    if (!target) return;
    setLast(target);
    if (target.mode === "new") {
      setDraft(newDraft(target.branch, target.date, target.kind));
      setScope("series");
    } else if (isRepeat(target.plan) && target.date) {
      // 반복 일정을 그날에서 열었으면 '이 날만'부터 — 날짜도 그날
      setDraft({ ...draftFromPlan(target.plan), start_on: target.date });
      setScope("day");
    } else {
      setDraft(draftFromPlan(target.plan));
      setScope("series");
    }
  }, [target]);

  const t = target ?? last;
  if (!t || !draft) return null;

  const editing = t.mode === "edit" ? t.plan : null;
  const repeatEdit = !!editing && isRepeat(editing);
  const occurrence = t.mode === "edit" && repeatEdit ? t.date : null;
  const onlyDate = scope === "day" ? occurrence : null;
  const shown = draft;
  const err = draftError(shown, today, onlyDate);

  // 범위를 바꾸면 날짜도 — 이 날만 = 그날, 매주 전체 = 반복이 시작한 날
  const pickScope = (s: Scope) => {
    setScope(s);
    setConfirm(null);
    setDraft((d) => (d && editing ? { ...d, start_on: s === "day" && occurrence ? occurrence : editing.start_on } : d));
  };
  const busy = save.isPending || skip.isPending || remove.isPending;
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

  const toggleDay = (wd: number) =>
    setDraft((d) =>
      d ? { ...d, repeat_weekdays: d.repeat_weekdays.includes(wd) ? d.repeat_weekdays.filter((x) => x !== wd) : [...d.repeat_weekdays, wd] } : d,
    );

  const onSave = () => {
    if (err || busy) return;
    save.mutate(draftPayload(shown, onlyDate), {
      onSuccess: () => {
        toast.success(onlyDate ? `${planDay(onlyDate)} 일정만 바꿨어요` : editing ? "일정을 고쳤어요" : "일정을 넣었어요");
        onClose();
      },
      onError: (e) => toast.error((e as Error).message),
    });
  };

  const onSkip = () => {
    if (!editing || !occurrence) return;
    if (confirm !== "skip") return setConfirm("skip");
    skip.mutate(
      { id: editing.id, date: occurrence },
      {
        onSuccess: () => {
          toast.success(`${planDay(occurrence)}만 뺐어요`);
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  const onRemove = () => {
    if (!editing) return;
    if (confirm !== "remove") return setConfirm("remove");
    remove.mutate(editing.id, {
      onSuccess: () => {
        toast.success(repeatEdit ? "반복 일정을 모두 지웠어요" : "일정을 지웠어요");
        onClose();
      },
      onError: (e) => toast.error((e as Error).message),
    });
  };

  const sub = [shortBranch(draft.branch), onlyDate ? `${planDay(onlyDate)}만` : null].filter(Boolean).join(" · ");

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
            {save.isPending ? "저장하는 중…" : onlyDate ? "이 날만 바꾸기" : "저장"}
          </OpsButton>
          {editing && (
            <div className={cn("grid gap-2", occurrence ? "grid-cols-2" : "grid-cols-1")}>
              {occurrence && (
                <OpsButton tone="plain" onClick={onSkip} disabled={busy}>
                  {confirm === "skip" ? "한 번 더 누르면 빼요" : "이 날만 빼기"}
                </OpsButton>
              )}
              <OpsButton tone="danger" onClick={onRemove} disabled={busy}>
                {confirm === "remove" ? "한 번 더 누르면 지워요" : repeatEdit ? "반복 모두 지우기" : "지우기"}
              </OpsButton>
            </div>
          )}
        </div>
      }
    >
      {occurrence && (
        <>
          <OpsLabel>바꿀 범위</OpsLabel>
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-secondary/70 p-1">
            {(["day", "series"] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={scope === s}
                onClick={() => scope !== s && pickScope(s)}
                className={cn(
                  "h-11 rounded-xl text-body font-black transition-all active:scale-[0.98]",
                  scope === s ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground",
                )}
              >
                {s === "day" ? "이 날만" : "매주 전체"}
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

      <OpsLabel>{draft.repeat && !onlyDate ? "시작하는 날" : "날짜"}</OpsLabel>
      <input
        type="date"
        value={shown.start_on}
        min={addDays(today, -62)}
        max={addDays(today, 400)}
        onChange={(e) => set("start_on", e.target.value)}
        className={opsInput}
      />

      {!onlyDate && (
        <>
          <OpsLabel>반복</OpsLabel>
          <div className="flex gap-1.5">
            <OpsChip on={!draft.repeat} onClick={() => set("repeat", false)}>
              한 번
            </OpsChip>
            <OpsChip on={draft.repeat} onClick={() => set("repeat", true)}>
              매주
            </OpsChip>
          </div>
          {draft.repeat ? (
            <>
              <div className="mt-2 grid grid-cols-7 gap-1">
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
              <OpsLabel>언제까지 (비우면 계속)</OpsLabel>
              <input
                type="date"
                value={draft.until_on}
                min={draft.start_on}
                onChange={(e) => set("until_on", e.target.value)}
                className={opsInput}
              />
            </>
          ) : (
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
            step={600}
            value={draft.start_time}
            onChange={(e) => set("start_time", e.target.value)}
            className={`${opsInput} py-2`}
            aria-label="시작 시각"
          />
          <span className="text-body text-muted-foreground">~</span>
          <input
            type="time"
            step={600}
            value={draft.end_time}
            onChange={(e) => set("end_time", e.target.value)}
            className={`${opsInput} py-2`}
            aria-label="끝 시각"
          />
        </div>
      )}

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
