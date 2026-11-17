/**
 * 153운영본부 「오늘 청소」 2단계 — 대표님 · 지점 관리자 「청소 현황」 (전체 화면 한 장 · 2026-11-17)
 *   머리(닫기 · 지점 · 2주 / 4주 · 고치기) → 주마다 요일 × 시간대 칸(누르면 그날 목록 — 7일 안 · 그 앞은 한 줄)
 *   → 문제(처리했어요) → 항목별 걸린 시간(보통 n분 · 목표) → 「항목 · 시간대 고치기」
 *   보여 주기만 한다 — 읽고 쓰기는 OpsClean 이 넘긴 actions(서버 또는 예시)로. 계산 · 글 src/lib/opsCleanReport.ts
 */
import { lazy, Suspense, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronRight, CircleHelp, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import { useModalDismiss } from "@/hooks/useModalDismiss";
import { cn } from "@/lib/utils";
import { shiftCleanDay } from "@/lib/opsClean";
import {
  ITEM_FLAG_LABEL,
  RESOLVE_NOTE_MAX,
  RESOLVE_PRESETS,
  TYPICAL_MIN_SAMPLES,
  cellLine,
  doneIssues,
  itemFlag,
  itemStatLine,
  openIssues,
  reportCell,
  reportDayLabel,
  reportWeeks,
  resolveNoteError,
  slotItems,
  type CleanReport,
  type ReportCell,
  type ReportIssue,
  type ReportSlot,
} from "@/lib/opsCleanReport";
import { OpsButton, OpsChip, OpsLabel, OpsSheet, opsInput } from "./OpsParts";

const OpsCleanEdit = lazy(() => import("./OpsCleanEdit"));

export interface CleanReportActions {
  resolve: (itemId: string, date: string, note: string | null, done: () => void) => void;
  saveItem: (payload: Record<string, unknown>, done: () => void) => void;
  order: (slotId: string, ids: string[]) => void;
  saveSlot: (payload: Record<string, unknown>, done: () => void) => void;
  busy: boolean;
}

interface Props {
  rep: CleanReport;
  weeks: number;
  onWeeks: (w: number) => void;
  onBranch?: (branch: string) => void;
  onClose: () => void;
  /** 그날 그 시간대 목록 열기 — 7일 안만 (없으면 한 줄로) */
  onOpenDay?: (date: string, slot: string) => void;
  actions: CleanReportActions;
  demo?: boolean;
  loading?: boolean;
}

const short = (branch: string) => branch.replace("153복싱짐", "").trim() || branch;

// ── 칸 ───────────────────────────────────────────────────────

const CELL_TONE: Record<ReportCell["kind"], string> = {
  finished: "bg-primary/10 text-primary",
  doing: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  partial: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-300 dark:bg-amber-500/10 dark:text-amber-200",
  none: "bg-secondary text-muted-foreground",
  wait: "bg-background text-muted-foreground ring-1 ring-inset ring-border",
  empty: "bg-background text-muted-foreground",
  closed: "bg-secondary text-muted-foreground",
  off: "",
};

const CellBody = ({ cell, slot }: { cell: ReportCell; slot: ReportSlot }) => {
  const r = cell.run;
  if (cell.kind === "finished")
    return (
      <>
        <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
        <span className="text-micro font-bold tabular-nums">{cell.minutes !== null ? `${cell.minutes}분` : "끝"}</span>
      </>
    );
  if (cell.kind === "doing" || cell.kind === "partial")
    return (
      <>
        <span className="whitespace-nowrap text-micro font-black tabular-nums">남은 {r ? Math.max(0, r.due - r.done - r.hold - r.issue) : 0}</span>
        <span className="text-micro font-bold">{cell.kind === "doing" ? "진행" : "끝 전"}</span>
      </>
    );
  if (cell.kind === "wait") return <span className="text-micro font-bold tabular-nums">{slot.time}</span>;
  if (cell.kind === "none") return <span className="text-label font-black">–</span>;
  if (cell.kind === "closed") return <span className="text-micro font-bold">휴관</span>;
  return <span className="text-label">·</span>;
};

const WeekGrid = ({
  rep,
  week,
  onCell,
}: {
  rep: CleanReport;
  week: ReturnType<typeof reportWeeks>[number];
  onCell: (date: string, slot: ReportSlot, cell: ReportCell) => void;
}) => {
  const dayMap = useMemo(() => new Map(rep.days.map((d) => [d.date, d])), [rep.days]);
  const cols = week.dates.length;
  return (
    <section className="rounded-3xl bg-card p-4 shadow-elev-1" aria-label={`${week.label} 청소`}>
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h3 className="text-heading font-black text-foreground">{week.label}</h3>
        {week.rate !== null && (
          <p className="shrink-0 text-label font-bold tabular-nums text-muted-foreground">
            완료 <span className="text-foreground">{week.rate}%</span> · 끝 {week.finished}/{week.counted}
          </p>
        )}
      </div>
      <div className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `3.25rem repeat(${cols}, minmax(0, 1fr))` }}>
        <span />
        {week.dates.map((d) => (
          <span key={d} className={cn("text-center text-micro font-bold tabular-nums", d === rep.today ? "text-foreground" : "text-muted-foreground")}>
            {reportDayLabel(d).replace(/^\d+\//, "").replace(/\((.)\)/, " $1")}
          </span>
        ))}
        {rep.slots.map((s) => (
          <div key={s.id} className="contents">
            <span className="flex flex-col justify-center pr-1">
              <span className="text-label font-black leading-tight text-foreground">{s.label}</span>
              <span className="text-micro tabular-nums text-muted-foreground">{s.time}</span>
            </span>
            {week.dates.map((d) => {
              const cell = reportCell(rep, dayMap.get(d), s);
              if (cell.kind === "off") return <span key={d} />;
              const r = cell.run;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => onCell(d, s, cell)}
                  aria-label={cellLine(d, s, cell)}
                  className={cn("relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl active:scale-95", CELL_TONE[cell.kind], d === rep.today && "outline outline-2 outline-offset-1 outline-foreground/15")}
                >
                  <CellBody cell={cell} slot={s} />
                  {!!r && (r.issue > 0 || r.hold > 0) && (
                    <span className={cn("absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full", r.issue > 0 ? "bg-red-500" : "bg-amber-400")} aria-hidden />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
};

// ── 문제 ─────────────────────────────────────────────────────

const ResolveSheet = ({
  issue,
  onClose,
  onDone,
  busy,
}: {
  issue: ReportIssue | null;
  onClose: () => void;
  onDone: (note: string | null) => void;
  busy: boolean;
}) => {
  const [note, setNote] = useState("");
  const err = resolveNoteError(note);
  return (
    <OpsSheet
      open={!!issue}
      onClose={onClose}
      stacked
      title="문제 처리"
      sub={issue ? `${issue.title} · ${reportDayLabel(issue.date)} ${issue.label}` : undefined}
      footer={
        <OpsButton
          onClick={() => {
            if (err) return toast.error(err);
            onDone(note.replace(/\s+/g, " ").trim() || null);
          }}
          disabled={busy}
        >
          처리했어요
        </OpsButton>
      }
    >
      {issue?.note && <p className="rounded-2xl bg-red-50 px-4 py-3 text-body text-red-900 dark:bg-red-500/10 dark:text-red-100">{issue.note}</p>}
      <OpsLabel>어떻게 했나요? (선택 · 남긴 분께 알림이 가요)</OpsLabel>
      <div className="flex flex-wrap gap-1.5">
        {RESOLVE_PRESETS.map((p) => (
          <OpsChip key={p} on={note === p} onClick={() => setNote(note === p ? "" : p)}>
            {p}
          </OpsChip>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={RESOLVE_NOTE_MAX}
        rows={3}
        placeholder="예: 배수구 뚫고 거름망 새로 넣었어요"
        aria-label="처리 메모"
        className={cn(opsInput, "mt-2 resize-none")}
      />
    </OpsSheet>
  );
};

const IssueSection = ({ rep, onResolve }: { rep: CleanReport; onResolve: (i: ReportIssue) => void }) => {
  const open = openIssues(rep);
  const done = doneIssues(rep);
  const [showDone, setShowDone] = useState(false);
  return (
    <section className="rounded-3xl bg-card p-4 shadow-elev-1" aria-label="청소 문제">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h3 className="text-heading font-black text-foreground">
          문제 <span className={cn("tabular-nums", open.length > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>{open.length}</span>
        </h3>
        <span className="text-label text-muted-foreground">최근 30일</span>
      </div>
      {open.length === 0 ? (
        <p className="mt-2 px-1 text-body text-muted-foreground">처리할 문제가 없어요</p>
      ) : (
        <ul className="mt-2.5 space-y-2">
          {open.map((i) => (
            <li key={`${i.itemId}-${i.date}`} className="rounded-2xl border border-red-200 bg-background p-3.5 dark:border-red-500/30">
              <p className="text-body font-black text-foreground">{i.title}</p>
              {i.note && <p className="mt-0.5 text-body text-foreground">{i.note}</p>}
              <p className="mt-1 text-label text-muted-foreground">{[`${reportDayLabel(i.date)} ${i.label}`, i.byName].filter(Boolean).join(" · ")}</p>
              <button
                type="button"
                onClick={() => onResolve(i)}
                className="mt-2.5 flex h-11 w-full items-center justify-center rounded-xl bg-foreground text-body font-black text-background active:scale-[0.99]"
              >
                처리했어요
              </button>
            </li>
          ))}
        </ul>
      )}
      {done.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            aria-expanded={showDone}
            className="flex h-10 w-full items-center justify-between px-1 text-label font-bold text-muted-foreground"
          >
            처리한 문제 {done.length}
            <ChevronDown className={cn("h-4 w-4 transition-transform", showDone && "rotate-180")} aria-hidden />
          </button>
          {showDone && (
            <ul className="space-y-1.5">
              {done.map((i) => (
                <li key={`${i.itemId}-${i.date}`} className="rounded-2xl bg-secondary/60 px-3.5 py-2.5">
                  <p className="text-body font-bold text-foreground">
                    {i.title} <span className="text-label font-bold text-primary">처리됨</span>
                  </p>
                  {i.resolveNote && <p className="text-label text-foreground">{i.resolveNote}</p>}
                  <p className="text-label text-muted-foreground">
                    {[`${reportDayLabel(i.date)} ${i.label}`, i.resolvedByName ? `${i.resolvedByName} 처리` : null].filter(Boolean).join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};

// ── 항목별 걸린 시간 ─────────────────────────────────────────

const ItemTimes = ({ rep }: { rep: CleanReport }) => {
  const [slotId, setSlotId] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [showRest, setShowRest] = useState(false);
  const slot = rep.slots.find((s) => s.id === slotId) ?? rep.slots[0] ?? null;
  const items = slot ? slotItems(rep, slot.id) : [];
  const flags = items.map((i) => itemFlag(i));
  const measured = items.filter((i) => i.samples >= TYPICAL_MIN_SAMPLES && i.typical !== null).length;
  const summary = (["long", "hold", "short"] as const)
    .map((f) => [f, flags.filter((x) => x === f).length] as const)
    .filter(([, n]) => n > 0)
    .map(([f, n]) => `${ITEM_FLAG_LABEL[f]} ${n}`)
    .join(" · ");
  return (
    <section className="rounded-3xl bg-card p-4 shadow-elev-1" aria-label="항목별 걸린 시간">
      <div className="flex items-center justify-between gap-2 px-1">
        <h3 className="text-heading font-black text-foreground">항목별 걸린 시간</h3>
        <button
          type="button"
          onClick={() => setHelp((v) => !v)}
          aria-expanded={help}
          aria-label="걸린 시간 세는 법"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground active:bg-secondary"
        >
          <CircleHelp className="h-5 w-5" aria-hidden />
        </button>
      </div>
      {help && (
        <p className="mt-1 rounded-2xl bg-secondary/70 px-3.5 py-2.5 text-label leading-relaxed text-foreground">
          보통 걸린 분은 바로 앞 항목(첫 항목은 청소 시작)부터 이 항목을 완료로 누를 때까지의 가운데 값이에요. 30초 안에 연달아 누른 것과 1시간 넘는 것은 빼고,{" "}
          {TYPICAL_MIN_SAMPLES}번 넘게 잰 항목만 보여 줘요.
        </p>
      )}
      {rep.slots.length > 1 && (
        <div className="mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {rep.slots.map((s) => (
            <OpsChip
              key={s.id}
              on={s.id === slot?.id}
              onClick={() => {
                setSlotId(s.id);
                setShowRest(false);
              }}
            >
              {s.label}
            </OpsChip>
          ))}
        </div>
      )}
      <p className="mt-2 px-1 text-label font-bold text-muted-foreground">
        {measured === 0 ? "잰 기록이 더 모이면 보통 걸린 분이 보여요" : summary || "모두 목표 안쪽이에요"}
      </p>
      <ul className="mt-2 divide-y divide-border/70">
        {items.map((i, k) => {
          const f = flags[k];
          // 확인할 항목(표시가 붙은 것) 먼저 — 나머지는 접어 둔다
          if (!f && !showRest && flags.some(Boolean)) return null;
          return (
            <li key={i.id} className="flex items-center gap-3 px-1 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-bold text-foreground">{i.title}</span>
                <span className="block truncate text-label text-muted-foreground">{itemStatLine(i)}</span>
              </span>
              {f && (
                <span
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-micro font-black",
                    f === "long" || f === "hold" ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200" : "bg-primary/10 text-primary",
                  )}
                >
                  {ITEM_FLAG_LABEL[f]}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {flags.some(Boolean) && flags.some((f) => !f) && (
        <button
          type="button"
          onClick={() => setShowRest((v) => !v)}
          aria-expanded={showRest}
          className="mt-1 flex h-10 w-full items-center justify-between px-1 text-label font-bold text-muted-foreground"
        >
          {showRest ? "다른 항목 접기" : `다른 항목 ${flags.filter((f) => !f).length}개`}
          <ChevronDown className={cn("h-4 w-4 transition-transform", showRest && "rotate-180")} aria-hidden />
        </button>
      )}
    </section>
  );
};

// ── 본체 ─────────────────────────────────────────────────────

export default function OpsCleanReport({ rep, weeks, onWeeks, onBranch, onClose, onOpenDay, actions, demo = false, loading = false }: Props) {
  const [resolving, setResolving] = useState<ReportIssue | null>(null);
  const [editing, setEditing] = useState(false);
  useModalDismiss(true, () => {
    if (!resolving && !editing) onClose();
  });
  const list = useMemo(() => reportWeeks(rep), [rep]);
  const minDay = shiftCleanDay(rep.today, -7);

  const onCell = (date: string, slot: ReportSlot, cell: ReportCell) => {
    if (onOpenDay && date >= minDay && cell.kind !== "closed" && cell.kind !== "wait") onOpenDay(date, slot.slot);
    else toast(cellLine(date, slot, cell));
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="청소 현황" className="fixed inset-0 z-[116] flex flex-col bg-background">
      <div className="shrink-0 border-b border-border/70 bg-background pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 w-full max-w-md items-center gap-2 px-3">
          <button type="button" onClick={onClose} aria-label="닫기" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary active:scale-95">
            <X className="h-5 w-5 text-secondary-foreground" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-body font-black text-foreground">청소 현황</p>
            <p className="truncate text-micro font-bold text-muted-foreground">
              {short(rep.branch)}
              {demo ? " · 예시" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="항목 · 시간대 고치기"
            className="flex h-10 shrink-0 items-center gap-1 rounded-full bg-secondary px-3 text-label font-bold text-secondary-foreground active:scale-95"
          >
            <Pencil className="h-4 w-4" aria-hidden />
            고치기
          </button>
        </div>
        <div className="mx-auto flex w-full max-w-md items-center gap-1.5 overflow-x-auto px-3 pb-2.5">
          {onBranch &&
            rep.branches.length > 1 &&
            rep.branches.map((b) => (
              <OpsChip key={b.branch} on={b.branch === rep.branch} onClick={() => onBranch(b.branch)}>
                {short(b.branch)}
              </OpsChip>
            ))}
          {onBranch && rep.branches.length > 1 && <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />}
          {[2, 4].map((w) => (
            <OpsChip key={w} on={weeks === w} onClick={() => onWeeks(w)}>
              {w}주
            </OpsChip>
          ))}
        </div>
      </div>

      <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain transition-opacity", loading && "opacity-60")}>
        <div className="mx-auto w-full max-w-md space-y-4 px-4 pb-10 pt-4">
          {list.length === 0 ? (
            <div className="rounded-3xl bg-card px-5 py-12 text-center shadow-elev-1">
              <p className="text-body font-bold text-foreground">이 기간에는 청소 기록이 없어요</p>
            </div>
          ) : (
            list.map((w) => <WeekGrid key={w.monday} rep={rep} week={w} onCell={onCell} />)
          )}
          <p className="px-2 text-label leading-relaxed text-muted-foreground">
            <Check className="inline h-3.5 w-3.5 text-primary" strokeWidth={3} aria-hidden /> 끝(걸린 분) · 남은 n = 끝내기 전 · – 체크 없음 · 점 = 보류 · 문제 · 누르면 그날 목록
          </p>
          <IssueSection rep={rep} onResolve={setResolving} />
          <ItemTimes rep={rep} />
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex h-14 w-full items-center justify-between rounded-2xl border border-border bg-background px-4 text-body font-black text-foreground active:scale-[0.99]"
          >
            항목 · 시간대 고치기
            <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden />
          </button>
        </div>
      </div>

      <ResolveSheet
        key={resolving ? `${resolving.itemId}-${resolving.date}` : "none"}
        issue={resolving}
        onClose={() => setResolving(null)}
        busy={actions.busy}
        onDone={(note) => {
          if (!resolving) return;
          actions.resolve(resolving.itemId, resolving.date, note, () => setResolving(null));
        }}
      />
      {editing && (
        <Suspense fallback={null}>
          <OpsCleanEdit rep={rep} onClose={() => setEditing(false)} actions={actions} demo={demo} />
        </Suspense>
      )}
    </div>,
    document.body,
  );
}
