/**
 * 153운영본부 「오늘 청소」 2단계 — 「청소 항목 고치기」 (대표님 · 지점 관리자 · 전체 화면 한 장 · 2026-11-17)
 *   시간대 고르기 → 시간대 설정(시작 · 끝낼 때까지 · 요일 · 담당 · 미완료 알림) → 요일마다 목표 분 합
 *   → 동선 순서 항목(위 · 아래 · 누르면 고치기) → 「항목 더하기」 → 뺀 항목(다시 넣기)
 *   코드를 고치지 않고 항목 · 분 · 요일을 바꾼다(사진은 3단계). 계산 · 검사 말 src/lib/opsCleanReport.ts
 */
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { useModalDismiss } from "@/hooks/useModalDismiss";
import { cn } from "@/lib/utils";
import {
  EDIT_ZONES,
  WEEK_ORDER,
  addMinutes,
  dowWord,
  editSections,
  editZoneLabel,
  editZoneRule,
  itemDraftError,
  itemDraftOf,
  itemDraftPayload,
  moveInSection,
  newItemDraft,
  nthWord,
  ruleText,
  slotDraftError,
  slotDraftOf,
  slotDraftPayload,
  slotItems,
  slotSummary,
  slotWeekMinutes,
  type CleanReport,
  type ItemDraft,
  type ItemWhen,
  type SlotDraft,
} from "@/lib/opsCleanReport";
import type { CleanReportActions } from "./OpsCleanReport";
import { OpsButton, OpsChip, OpsLabel, OpsSheet, opsInput } from "./OpsParts";

const short = (branch: string) => branch.replace("153복싱짐", "").trim() || branch;
const onlyDigits = (v: string) => v.replace(/[^\d]/g, "").slice(0, 3);

const Stepper = ({ value, onChange, min, max, label }: { value: string; onChange: (v: string) => void; min: number; max: number; label: string }) => {
  const n = Number(value) || 0;
  const set = (x: number) => onChange(String(Math.max(min, Math.min(max, x))));
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => set(n - 1)} aria-label={`${label} 줄이기`} className="flex h-11 w-11 items-center justify-center rounded-xl border border-border active:scale-95">
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <input value={value} onChange={(e) => onChange(onlyDigits(e.target.value))} inputMode="numeric" aria-label={label} className={cn(opsInput, "w-20 text-center tabular-nums")} />
      <span className="text-body text-muted-foreground">분</span>
      <button type="button" onClick={() => set(n + 1)} aria-label={`${label} 늘리기`} className="flex h-11 w-11 items-center justify-center rounded-xl border border-border active:scale-95">
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
};

const Toggle = ({ on, onChange, label, sub }: { on: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) => (
  <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-center justify-between gap-3 py-2 text-left">
    <span className="min-w-0">
      <span className="block text-body font-bold text-foreground">{label}</span>
      {sub && <span className="block text-label text-muted-foreground">{sub}</span>}
    </span>
    <span className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", on ? "bg-primary" : "bg-muted-foreground/30")}>
      <span className={cn("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform", on ? "translate-x-[1.375rem]" : "translate-x-0.5")} />
    </span>
  </button>
);

// ── 항목 시트 ────────────────────────────────────────────────

const ItemSheet = ({
  rep,
  draft,
  setDraft,
  onSave,
  busy,
}: {
  rep: CleanReport;
  draft: ItemDraft | null;
  setDraft: (d: ItemDraft | null) => void;
  onSave: (d: ItemDraft) => void;
  busy: boolean;
}) => {
  const d = draft;
  const slot = rep.slots.find((s) => s.id === d?.slotId) ?? null;
  const days = slot ? WEEK_ORDER.filter((x) => slot.weekdays.includes(x)) : [];
  const set = (patch: Partial<ItemDraft>) => d && setDraft({ ...d, ...patch });
  const isNew = !d?.id;
  const save = (patch?: Partial<ItemDraft>) => {
    if (!d || !slot) return;
    const next = { ...d, ...patch };
    const err = itemDraftError(next, slot.weekdays);
    if (err) return toast.error(err);
    onSave(next);
  };
  return (
    <OpsSheet
      open={!!d}
      onClose={() => setDraft(null)}
      stacked
      title={isNew ? "항목 더하기" : d?.active === false ? "뺀 항목" : "항목 고치기"}
      sub={slot ? `${slot.label} ${slot.time}` : undefined}
      footer={
        d && (
          <div className="flex gap-2">
            {!isNew && (
              <div className="w-28 shrink-0">
                <OpsButton tone={d.active ? "danger" : "plain"} disabled={busy} onClick={() => save({ active: !d.active })}>
                  {d.active ? "빼기" : "다시 넣기"}
                </OpsButton>
              </div>
            )}
            <OpsButton disabled={busy} onClick={() => save()}>
              {isNew ? "더하기" : "저장"}
            </OpsButton>
          </div>
        )
      }
    >
      {d && slot && (
        <>
          <OpsLabel>이름</OpsLabel>
          <input value={d.title} onChange={(e) => set({ title: e.target.value })} maxLength={60} placeholder="예: 거울 닦기" aria-label="항목 이름" className={opsInput} />

          <OpsLabel>구역</OpsLabel>
          <div className="flex flex-wrap gap-1.5">
            {EDIT_ZONES.map((z) => (
              <OpsChip key={z} on={d.zone === z} onClick={() => set({ zone: z })}>
                {editZoneLabel(z)}
              </OpsChip>
            ))}
          </div>
          {d.zone === "mission" && <p className="mt-1.5 text-label text-muted-foreground">「오늘의 미션」 카드로 보여요 — 요일이나 한 달에 한 번을 골라 주세요</p>}

          <OpsLabel>목표 분</OpsLabel>
          <Stepper value={d.min} onChange={(v) => set({ min: v })} min={0} max={120} label="목표 분" />

          <OpsLabel>언제 하나요?</OpsLabel>
          <div className="flex flex-wrap gap-1.5">
            {([
              ["all", "매일"],
              ["days", "요일 고르기"],
              ["month", "한 달에 한 번"],
            ] as [ItemWhen, string][]).map(([w, t]) => (
              <OpsChip key={w} on={d.when === w} onClick={() => set({ when: w })}>
                {t}
              </OpsChip>
            ))}
          </div>
          {d.when === "days" && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {days.map((x) => (
                <OpsChip key={x} on={d.days.includes(x)} onClick={() => set({ days: d.days.includes(x) ? d.days.filter((y) => y !== x) : [...d.days, x] })}>
                  {dowWord(x)}
                </OpsChip>
              ))}
            </div>
          )}
          {d.when === "month" && (
            <div className="mt-2 space-y-2 rounded-2xl bg-secondary/60 p-3">
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <OpsChip key={n} on={d.nth === n} onClick={() => set({ nth: n })}>
                    {nthWord(n)}
                  </OpsChip>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {WEEK_ORDER.map((x) => (
                  <OpsChip key={x} on={d.nthDow === x} onClick={() => set({ nthDow: x })}>
                    {dowWord(x)}요일
                  </OpsChip>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {([
                  [0, "그날"],
                  [-1, "전날"],
                  [1, "다음 날"],
                ] as [number, string][]).map(([o, t]) => (
                  <OpsChip key={o} on={d.off === o} onClick={() => set({ off: o })}>
                    {t}
                  </OpsChip>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <OpsChip on={d.months.length === 0} onClick={() => set({ months: [] })}>
                  모든 달
                </OpsChip>
                {Array.from({ length: 12 }, (_, k) => k + 1).map((m) => (
                  <OpsChip key={m} on={d.months.includes(m)} onClick={() => set({ months: d.months.includes(m) ? d.months.filter((y) => y !== m) : [...d.months, m] })}>
                    {m}월
                  </OpsChip>
                ))}
              </div>
            </div>
          )}

          <OpsLabel>끝난 상태 (선택)</OpsLabel>
          <textarea value={d.doneText} onChange={(e) => set({ doneText: e.target.value })} maxLength={120} rows={2} placeholder="예: 물때 · 얼룩 없이 반짝여요" aria-label="끝난 상태" className={cn(opsInput, "resize-none")} />
          <OpsLabel>방법 (선택)</OpsLabel>
          <textarea value={d.how} onChange={(e) => set({ how: e.target.value })} maxLength={300} rows={3} aria-label="방법" className={cn(opsInput, "resize-none")} />
          <OpsLabel>주의 (선택)</OpsLabel>
          <input value={d.caution} onChange={(e) => set({ caution: e.target.value })} maxLength={120} aria-label="주의" className={opsInput} />

          {rep.slots.length > 1 && (
            <>
              <OpsLabel>시간대</OpsLabel>
              <div className="flex flex-wrap gap-1.5">
                {rep.slots.map((s) => (
                  <OpsChip key={s.id} on={d.slotId === s.id} onClick={() => set({ slotId: s.id })}>
                    {s.label} {s.time}
                  </OpsChip>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </OpsSheet>
  );
};

// ── 시간대 시트 ──────────────────────────────────────────────

const SlotSheet = ({
  rep,
  draft,
  setDraft,
  onSave,
  busy,
}: {
  rep: CleanReport;
  draft: SlotDraft | null;
  setDraft: (d: SlotDraft | null) => void;
  onSave: (d: SlotDraft) => void;
  busy: boolean;
}) => {
  const d = draft;
  const set = (patch: Partial<SlotDraft>) => d && setDraft({ ...d, ...patch });
  const alertAt = d && /^\d{1,3}$/.test(d.alertMin) && /^\d{2}:\d{2}$/.test(d.time) ? addMinutes(d.time, Number(d.alertMin)) : null;
  return (
    <OpsSheet
      open={!!d}
      onClose={() => setDraft(null)}
      stacked
      title="시간대 고치기"
      sub={d?.label}
      footer={
        d && (
          <OpsButton
            disabled={busy}
            onClick={() => {
              const err = slotDraftError(d);
              if (err) return toast.error(err);
              onSave(d);
            }}
          >
            저장
          </OpsButton>
        )
      }
    >
      {d && (
        <>
          <OpsLabel>이름</OpsLabel>
          <input value={d.label} onChange={(e) => set({ label: e.target.value })} maxLength={12} aria-label="시간대 이름" className={opsInput} />
          <OpsLabel>시작 시각</OpsLabel>
          <input type="time" value={d.time} onChange={(e) => set({ time: e.target.value })} aria-label="시작 시각" className={cn(opsInput, "tabular-nums")} />
          <OpsLabel>끝낼 때까지</OpsLabel>
          <Stepper value={d.budget} onChange={(v) => set({ budget: v })} min={1} max={240} label="끝낼 때까지 분" />
          <OpsLabel>요일</OpsLabel>
          <div className="flex flex-wrap gap-1.5">
            {WEEK_ORDER.map((x) => (
              <OpsChip key={x} on={d.weekdays.includes(x)} onClick={() => set({ weekdays: d.weekdays.includes(x) ? d.weekdays.filter((y) => y !== x) : [...d.weekdays, x] })}>
                {dowWord(x)}
              </OpsChip>
            ))}
          </div>
          <OpsLabel>담당</OpsLabel>
          <div className="flex flex-wrap gap-1.5">
            <OpsChip on={!d.assignee} onClick={() => set({ assignee: null })}>
              그 시간 근무자 모두
            </OpsChip>
            {rep.staff.map((s) => (
              <OpsChip key={s.id} on={d.assignee === s.id} onClick={() => set({ assignee: s.id })}>
                {s.name}
              </OpsChip>
            ))}
          </div>
          <p className="mt-1.5 text-label text-muted-foreground">담당이 쉬는 날은 그 시간 근무자 모두에게 보여요</p>
          <OpsLabel>미완료 알림</OpsLabel>
          <Toggle on={d.alertOn} onChange={(v) => set({ alertOn: v })} label="안 끝나면 대표님 · 지점장님께 알림" sub={d.alertOn && alertAt ? `${alertAt}에 체크 안 한 항목이 남아 있으면 한 번` : "끔"} />
          {d.alertOn && (
            <>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-body text-muted-foreground">시작하고</span>
                <input value={d.alertMin} onChange={(e) => set({ alertMin: onlyDigits(e.target.value) })} inputMode="numeric" aria-label="알림 분" className={cn(opsInput, "w-20 text-center tabular-nums")} />
                <span className="text-body text-muted-foreground">분 뒤</span>
              </div>
              <Toggle on={d.alertLoud} onChange={(v) => set({ alertLoud: v })} label="밤에도 휴대폰으로" sub="밤 10시 ~ 아침 8시 알림은 원래 알림함에만 가요" />
            </>
          )}
        </>
      )}
    </OpsSheet>
  );
};

// ── 본체 ─────────────────────────────────────────────────────

export default function OpsCleanEdit({ rep, onClose, actions, demo = false }: { rep: CleanReport; onClose: () => void; actions: CleanReportActions; demo?: boolean }) {
  const [slotId, setSlotId] = useState<string | null>(null);
  const [itemDraft, setItemDraft] = useState<ItemDraft | null>(null);
  const [slotDraft, setSlotDraft] = useState<SlotDraft | null>(null);
  const [showOff, setShowOff] = useState(false);
  useModalDismiss(true, () => {
    if (!itemDraft && !slotDraft) onClose();
  });
  const slot = rep.slots.find((s) => s.id === slotId) ?? rep.slots[0] ?? null;
  const items = useMemo(() => (slot ? slotItems(rep, slot.id) : []), [rep, slot]);
  const off = useMemo(() => (slot ? slotItems(rep, slot.id, false) : []), [rep, slot]);
  const sections = useMemo(() => editSections(items), [items]);
  const week = useMemo(() => (slot ? slotWeekMinutes(slot, rep.items, rep.today) : []), [slot, rep.items, rep.today]);

  const move = (id: string, dir: -1 | 1) => {
    if (!slot || actions.busy) return;
    const ids = moveInSection(items, id, dir);
    if (ids) actions.order(slot.id, ids);
  };
  const saveItem = (d: ItemDraft) =>
    actions.saveItem(itemDraftPayload(d), () => {
      setItemDraft(null);
      toast.success(!d.id ? "항목을 더했어요" : d.active ? "저장했어요" : "뺐어요 · 뺀 항목에서 다시 넣을 수 있어요");
    });

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="청소 항목 고치기" className="fixed inset-0 z-[117] flex flex-col bg-background">
      <div className="shrink-0 border-b border-border/70 bg-background pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 w-full max-w-md items-center gap-2 px-3">
          <button type="button" onClick={onClose} aria-label="닫기" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary active:scale-95">
            <X className="h-5 w-5 text-secondary-foreground" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-body font-black text-foreground">청소 항목 고치기</p>
            <p className="truncate text-micro font-bold text-muted-foreground">
              {short(rep.branch)}
              {demo ? " · 예시 · 저장 안 됨" : ""}
            </p>
          </div>
          <span className="h-10 w-10 shrink-0" />
        </div>
        {rep.slots.length > 1 && (
          <div className="mx-auto flex w-full max-w-md gap-1.5 overflow-x-auto px-3 pb-2.5" role="tablist" aria-label="시간대">
            {rep.slots.map((s) => (
              <OpsChip key={s.id} on={s.id === slot?.id} onClick={() => setSlotId(s.id)}>
                {s.label} <span className="tabular-nums opacity-70">{s.time}</span>
              </OpsChip>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {slot && (
          <div className="mx-auto w-full max-w-md space-y-4 px-4 pb-10 pt-4">
            <button
              type="button"
              onClick={() => setSlotDraft(slotDraftOf(slot))}
              className="flex w-full items-center gap-3 rounded-3xl bg-card p-4 text-left shadow-elev-1 active:scale-[0.99]"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-heading font-black text-foreground">
                  {slot.label} <span className="tabular-nums">{slot.time}</span>
                </span>
                <span className="mt-0.5 block text-label text-muted-foreground">{slotSummary(slot)}</span>
              </span>
              <span className="shrink-0 text-label font-bold text-foreground">고치기</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>

            <section className="rounded-3xl bg-card p-4 shadow-elev-1" aria-label="요일마다 목표 분">
              <div className="flex items-baseline justify-between gap-2 px-1">
                <h3 className="text-heading font-black text-foreground">요일마다 목표 분</h3>
                <span className="shrink-0 text-label font-bold text-muted-foreground">{slot.budget}분 안에</span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {week.map((w) => {
                  const over = w.max > slot.budget;
                  return (
                    <span
                      key={w.dow}
                      className={cn(
                        "rounded-xl px-3 py-2 text-label font-bold tabular-nums",
                        over ? "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100" : "bg-secondary text-foreground",
                      )}
                    >
                      {dowWord(w.dow)} {w.min === w.max ? `${w.min}분` : `${w.min}~${w.max}분`}
                    </span>
                  );
                })}
              </div>
              {week.some((w) => w.max > slot.budget) && <p className="mt-2 px-1 text-label font-bold text-amber-800 dark:text-amber-200">{slot.budget}분을 넘는 요일이 있어요</p>}
            </section>

            {sections.map((sec) => {
              const rule = editZoneRule(sec.zone);
              return (
                <section key={sec.key} className="rounded-3xl bg-card p-4 shadow-elev-1" aria-label={sec.label}>
                  <h3 className="px-1 text-heading font-black text-foreground">{sec.label}</h3>
                  {rule && <p className="mt-0.5 px-1 text-label text-muted-foreground">{rule}</p>}
                  <ul className="mt-2 divide-y divide-border/70">
                    {sec.items.map((i, k) => (
                      <li key={i.id} className="flex items-center gap-1">
                        <button type="button" onClick={() => setItemDraft(itemDraftOf(i, slot))} className="min-w-0 flex-1 py-2.5 pl-1 text-left active:opacity-70">
                          <span className="block truncate text-body font-bold text-foreground">{i.title}</span>
                          <span className="block truncate text-label text-muted-foreground">
                            {i.min}분 · {ruleText(i, slot.weekdays)}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => move(i.id, -1)}
                          disabled={k === 0 || actions.busy}
                          aria-label={`${i.title} 위로`}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-secondary disabled:opacity-25"
                        >
                          <ArrowUp className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(i.id, 1)}
                          disabled={k === sec.items.length - 1 || actions.busy}
                          aria-label={`${i.title} 아래로`}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-secondary disabled:opacity-25"
                        >
                          <ArrowDown className="h-4 w-4" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}

            <button
              type="button"
              onClick={() => setItemDraft(newItemDraft(slot, sections[sections.length - 1]?.zone === "mission" ? "hall" : (sections[sections.length - 1]?.zone ?? "hall")))}
              className="flex h-14 w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-background text-body font-black text-foreground active:scale-[0.99]"
            >
              <Plus className="h-5 w-5" aria-hidden />
              항목 더하기
            </button>

            {off.length > 0 && (
              <section className="rounded-3xl bg-card p-4 shadow-elev-1" aria-label="뺀 항목">
                <button type="button" onClick={() => setShowOff((v) => !v)} aria-expanded={showOff} className="flex w-full items-center justify-between px-1 text-left">
                  <span className="text-heading font-black text-foreground">
                    뺀 항목 <span className="tabular-nums text-muted-foreground">{off.length}</span>
                  </span>
                  <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", showOff && "rotate-180")} aria-hidden />
                </button>
                {showOff && (
                  <ul className="mt-2 divide-y divide-border/70">
                    {off.map((i) => (
                      <li key={i.id}>
                        <button type="button" onClick={() => setItemDraft(itemDraftOf(i, slot))} className="w-full py-2.5 pl-1 text-left active:opacity-70">
                          <span className="block truncate text-body font-bold text-muted-foreground line-through decoration-muted-foreground/40">{i.title}</span>
                          <span className="block truncate text-label text-muted-foreground">눌러서 다시 넣기</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>
        )}
      </div>

      <ItemSheet key={itemDraft ? (itemDraft.id ?? "new") : "none"} rep={rep} draft={itemDraft} setDraft={setItemDraft} onSave={saveItem} busy={actions.busy} />
      <SlotSheet
        key={slotDraft?.id ?? "none"}
        rep={rep}
        draft={slotDraft}
        setDraft={setSlotDraft}
        busy={actions.busy}
        onSave={(d) =>
          actions.saveSlot(slotDraftPayload(d), () => {
            setSlotDraft(null);
            toast.success("시간대를 저장했어요");
          })
        }
      />
    </div>,
    document.body,
  );
}
