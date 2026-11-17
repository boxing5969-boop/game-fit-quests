/**
 * 153운영본부 「오늘 청소」 — 전체 화면 한 장 (2026-11-16 · 1단계)
 *   머리(닫기 · 날짜 · 시간대) → 남은 시간 · 진행 → 인수인계 → 동선 순서대로(시작 · 오늘의 미션 · 구역 …) → 지킬 수칙 → 아래 「청소 끝내기」
 *   · 항목 = 엄지 하나로 누르는 큰 체크 칸: 누르면 완료 · 다시 누르면 풀기 / 오른쪽 › = 끝난 상태 · 방법 · 보류 · 문제
 *   · '전체 완료' 단추는 없다(대표님 결정) — 항목마다 누른다. 끝내기는 모든 항목에 상태(완료 · 보류 · 문제)가 있을 때만
 *   · 보여 주기만 한다 — 읽고 쓰기는 OpsClean 이 넘긴 actions(서버 또는 예시)로
 *   계산 · 글 src/lib/opsClean.ts
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowDown, BarChart3, Check, ChevronDown, ChevronLeft, ChevronRight, Pause, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { useModalDismiss } from "@/hooks/useModalDismiss";
import { cn } from "@/lib/utils";
import {
  CLEAN_HOLD_REASONS,
  CLEAN_NOTE_MAX,
  CLEAN_RULES,
  CLEAN_STATE_LABEL,
  cleanDayLabel,
  cleanHm,
  cleanNoteError,
  cleanSections,
  cleanTimer,
  elapsedMinutes,
  finishBlock,
  finishLine,
  handoverView,
  kstMs,
  missionHeading,
  shiftCleanDay,
  slotCounts,
  stepCleanDay,
  slotStatus,
  zoneLabel,
  type CleanCounts,
  type CleanDay,
  type CleanHandover,
  type CleanItem,
  type CleanSlot,
  type CleanState,
  type CleanTimer,
} from "@/lib/opsClean";
import { OpsButton, OpsLabel, OpsSheet, opsInput } from "./OpsParts";

export interface CleanSheetActions {
  /** 완료 · 보류 · 문제 · 풀기(null) — 누르는 순간 화면에 먼저 */
  check: (itemId: string, state: CleanState | null, note: string | null, at: string) => void;
  start: (slot: string, at: string) => void;
  finish: (slot: string, note: string | null, at: string, done: () => void) => void;
  /** 시작 · 끝내기가 가는 중 */
  busy: boolean;
}

interface Props {
  day: CleanDay;
  /** (대표님 · 지점 관리자) 「청소 현황」 열기 — 2단계 */
  onReport?: () => void;
  /** (대표님 · 지점 관리자) 지점 고르기 — 둘 이상일 때 */
  onBranch?: (branch: string) => void;
  /** 위에 다른 전체 화면(현황)이 떠 있다 — Esc 로 닫지 않는다 */
  covered?: boolean;
  /** 보고 있는 시간대 (없으면 첫 칸) */
  slotKey: string | null;
  onSlot: (slot: string) => void;
  onClose: () => void;
  actions: CleanSheetActions;
  /** 예시 화면 — 그 시간대가 막 시작한 것처럼 보여 준다 */
  demo?: boolean;
  /** 관리자 — 날짜 넘기기 (7일 전까지) */
  onDate?: (date: string) => void;
  loading?: boolean;
}

const TONE: Record<CleanState, { row: string; dot: string; text: string; badge: string }> = {
  done: {
    row: "border-transparent bg-secondary/70",
    dot: "border-primary bg-primary text-primary-foreground",
    text: "text-muted-foreground",
    badge: "bg-primary/10 text-primary",
  },
  hold: {
    row: "border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10",
    dot: "border-amber-400 bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
    text: "text-amber-800 dark:text-amber-200",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  },
  issue: {
    row: "border-destructive/40 bg-destructive/5",
    dot: "border-destructive bg-destructive/10 text-destructive",
    text: "text-destructive",
    badge: "bg-destructive/10 text-destructive",
  },
};

// ── 맨 위: 남은 시간 · 진행 ──────────────────────────────────

const heroText = (timer: CleanTimer, counts: CleanCounts, date: string): { label: string; big: string; unit: string; warn: boolean } => {
  if (timer.kind === "finished") return { label: "청소 끝", big: timer.minutes == null ? "끝" : String(timer.minutes), unit: timer.minutes == null ? "" : "분 걸렸어요", warn: false };
  if (timer.kind === "past") return { label: `${cleanDayLabel(date)} 기록`, big: `${counts.checked}`, unit: `/ ${counts.total}`, warn: false };
  if (timer.kind === "idle") {
    const n = Math.min(timer.budget, timer.leftMin);
    return n > 0
      ? { label: `끝낼 시각 ${timer.endLabel}`, big: String(n), unit: "분", warn: false }
      : { label: `끝낼 시각 ${timer.endLabel}`, big: "시작 전", unit: "", warn: false };
  }
  // 끝내기를 잊은 채 한참 지난 것(1시간 반 넘게)은 분을 세지 않는다
  if (timer.overMin > 90) return { label: `끝낼 시각 ${timer.endLabel}`, big: "끝내기 전", unit: "", warn: false };
  return timer.overMin > 0
    ? { label: `끝낼 시각 ${timer.endLabel}`, big: `+${timer.overMin}`, unit: "분 지남", warn: true }
    : { label: `끝낼 시각 ${timer.endLabel}`, big: String(timer.leftMin), unit: "분 남음", warn: false };
};

const Hero = ({
  slot,
  timer,
  counts,
  date,
  canStart,
  busy,
  onStart,
}: {
  slot: CleanSlot;
  timer: CleanTimer;
  counts: CleanCounts;
  date: string;
  canStart: boolean;
  busy: boolean;
  onStart: () => void;
}) => {
  const t = heroText(timer, counts, date);
  const pct = counts.total > 0 ? Math.round((counts.checked / counts.total) * 100) : 0;
  const finished = timer.kind === "finished";
  return (
    <section className="rounded-3xl bg-card p-5 shadow-elev-1" aria-label="남은 시간과 진행">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-label font-bold text-muted-foreground">{t.label}</p>
          <p className={cn("mt-0.5 text-display tabular-nums", t.warn ? "text-orange-600 dark:text-orange-400" : "text-foreground")}>
            {t.big}
            {t.unit && <span className="ml-1.5 text-heading font-black">{t.unit}</span>}
          </p>
        </div>
        {timer.kind !== "past" && (
          <p className="shrink-0 pb-1 text-right text-heading font-black tabular-nums text-foreground" aria-label={`${counts.total}개 가운데 ${counts.checked}개 체크`}>
            {counts.checked}
            <span className="text-body font-bold text-muted-foreground"> / {counts.total}</span>
          </p>
        )}
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary" aria-hidden>
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2.5 text-label text-muted-foreground">
        {finished
          ? [finishLine(slot), slot.run?.finishedByName, cleanHm(slot.run?.finishedAt ?? null)].filter(Boolean).join(" · ")
          : `${counts.total}개 · 목표 ${counts.minutes}분${slot.people.length > 0 ? ` · ${slot.people.join(" · ")}` : ""}`}
      </p>
      {finished && slot.run?.note && (
        <p className="mt-2 rounded-2xl bg-secondary/70 px-3.5 py-2.5 text-body font-bold leading-snug text-foreground">{slot.run.note}</p>
      )}
      {canStart && (
        <button
          type="button"
          onClick={onStart}
          disabled={busy}
          className="mt-4 flex h-14 w-full items-center justify-center rounded-2xl bg-foreground text-body font-black text-background transition-transform active:scale-[0.99] disabled:opacity-60"
        >
          청소 시작
        </button>
      )}
    </section>
  );
};

// ── 인수인계 ─────────────────────────────────────────────────

const HandoverBand = ({ lines, date }: { lines: readonly CleanHandover[]; date: string }) => {
  const [more, setMore] = useState(false);
  if (lines.length === 0) return null;
  const sums = lines.filter((h) => h.kind === "sum");
  const rest = lines.filter((h) => h.kind !== "sum");
  const shown = more ? rest : rest.slice(0, 3);
  return (
    <section className="rounded-3xl border border-border bg-card p-4" aria-label="인수인계">
      <h3 className="text-label font-black text-muted-foreground">인수인계</h3>
      {sums.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sums.map((h) => (
            <span key={`${h.date}-${h.slot}`} className="rounded-full bg-secondary px-2.5 py-1 text-micro font-bold tabular-nums text-foreground">
              {handoverView(h, date).main}
            </span>
          ))}
        </div>
      )}
      {shown.length > 0 && (
        <ul className="mt-3 space-y-2.5">
          {shown.map((h, i) => {
            const v = handoverView(h, date);
            return (
              <li key={`${h.kind}-${h.date}-${h.slot}-${i}`} className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-micro font-black",
                    v.tone === "plain" ? "bg-secondary text-foreground" : TONE[v.tone].badge,
                  )}
                >
                  {v.badge}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-bold leading-snug text-foreground">{v.main}</span>
                  {v.sub && <span className="block text-label text-muted-foreground">{v.sub}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {rest.length > 3 && (
        <button type="button" onClick={() => setMore((v) => !v)} className="mt-2 flex h-9 items-center text-label font-bold text-muted-foreground active:opacity-70">
          {more ? "접기" : `${rest.length - 3}개 더 보기`}
        </button>
      )}
    </section>
  );
};

// ── 항목 한 줄 ───────────────────────────────────────────────

const ItemRow = ({
  item,
  canAct,
  accent,
  onToggle,
  onOpen,
}: {
  item: CleanItem;
  canAct: boolean;
  /** 오늘의 미션 — 민트 테두리 */
  accent: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) => {
  const s = item.state;
  const sub =
    s === "hold" || s === "issue"
      ? [CLEAN_STATE_LABEL[s], item.note, s === "issue" && item.resolved ? (item.resolveNote ? `처리됨 · ${item.resolveNote}` : "처리됨") : null].filter(Boolean).join(" · ")
      : s === "done"
        ? [cleanHm(item.at), item.byName].filter(Boolean).join(" · ")
        : item.doneText;
  return (
    <li
      id={`clean-item-${item.id}`}
      className={cn(
        "flex items-stretch overflow-hidden rounded-2xl border transition-colors",
        s ? TONE[s].row : accent ? "border-primary/50 bg-card shadow-elev-1" : "border-border bg-card shadow-elev-1",
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={s === "done"}
        aria-label={`${item.title}${s ? ` · ${CLEAN_STATE_LABEL[s]}` : ""}`}
        disabled={!canAct}
        onClick={onToggle}
        className="flex min-h-[68px] min-w-0 flex-1 items-center gap-3 py-3 pl-3.5 pr-2 text-left transition-transform active:scale-[0.99]"
      >
        <span
          className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2", s ? TONE[s].dot : "border-muted-foreground/40")}
          aria-hidden
        >
          {s === "done" && <Check className="h-5 w-5" strokeWidth={3} />}
          {s === "hold" && <Pause className="h-4 w-4" strokeWidth={2.5} />}
          {s === "issue" && <AlertTriangle className="h-4 w-4" strokeWidth={2.5} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block text-body font-bold leading-snug", s === "done" ? "text-muted-foreground line-through" : "text-foreground")}>
            {item.title}
            {item.monthly && !s && <span className="ml-1.5 whitespace-nowrap rounded-full bg-primary/10 px-1.5 py-0.5 text-micro font-black text-primary">월 1회</span>}
          </span>
          {sub && <span className={cn("mt-0.5 block text-label leading-snug", s === "hold" || s === "issue" ? cn("font-bold", TONE[s].text) : "text-muted-foreground")}>{sub}</span>}
        </span>
      </button>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${item.title} — 방법 · 보류 · 문제`}
        className="flex w-12 shrink-0 items-center justify-center border-l border-border/60 text-muted-foreground active:bg-secondary/60"
      >
        <ChevronRight className="h-5 w-5" aria-hidden />
      </button>
    </li>
  );
};

// ── 항목 시트: 끝난 상태 · 방법 · 보류 · 문제 ────────────────

const ItemSheet = ({
  item,
  canAct,
  onClose,
  onSet,
}: {
  item: CleanItem | null;
  canAct: boolean;
  onClose: () => void;
  onSet: (state: CleanState | null, note: string | null) => void;
}) => {
  const [mode, setMode] = useState<"view" | "hold" | "issue">("view");
  const [note, setNote] = useState("");
  const id = item?.id ?? null;
  const state = item?.state ?? null;
  // 다른 항목을 열 때마다 처음 모양으로
  useEffect(() => {
    setMode("view");
    setNote("");
  }, [id]);
  if (!item) return <OpsSheet open={false} onClose={onClose} title="" stacked>{null}</OpsSheet>;
  const save = (s: CleanState | null, text: string | null) => {
    const err = s ? cleanNoteError(s, text ?? "") : null;
    if (err) {
      toast.error(err);
      return;
    }
    onSet(s, text && text.trim() ? text.replace(/\s+/g, " ").trim() : null);
    onClose();
  };
  return (
    <OpsSheet
      open
      onClose={onClose}
      stacked
      title={item.title}
      sub={`${zoneLabel(item.zone)}${item.min > 0 ? ` · 목표 ${item.min}분` : ""}${item.monthly ? " · 월 1회" : ""}`}
      footer={
        !canAct ? undefined : mode === "hold" ? (
          <OpsButton tone="dark" onClick={() => save("hold", note)}>
            보류로 남기기
          </OpsButton>
        ) : mode === "issue" ? (
          <OpsButton tone="dark" onClick={() => save("issue", note)}>
            문제 알리기
          </OpsButton>
        ) : state === "done" ? (
          <OpsButton tone="plain" onClick={() => save(null, null)}>
            체크 풀기
          </OpsButton>
        ) : (
          <OpsButton tone="dark" onClick={() => save("done", null)}>
            <Check className="h-5 w-5" strokeWidth={3} aria-hidden /> 완료
          </OpsButton>
        )
      }
    >
      {state && state !== "done" && mode === "view" && (
        <p className={cn("mb-4 rounded-2xl px-3.5 py-3 text-body font-bold leading-snug", TONE[state].badge)}>
          {[CLEAN_STATE_LABEL[state], item.note].filter(Boolean).join(" · ")}
          <span className="mt-0.5 block text-label font-medium opacity-80">{[item.byName, cleanHm(item.at)].filter(Boolean).join(" · ")}</span>
        </p>
      )}

      {mode === "view" && (
        <>
          {item.doneText && (
            <>
              <OpsLabel>끝난 상태</OpsLabel>
              <p className="text-body font-bold leading-snug text-foreground">{item.doneText}</p>
            </>
          )}
          {item.how && (
            <>
              <OpsLabel>방법</OpsLabel>
              <p className="text-body leading-relaxed text-foreground">{item.how}</p>
            </>
          )}
          {item.caution && (
            <>
              <OpsLabel>주의</OpsLabel>
              <p className="flex items-start gap-2 rounded-2xl bg-amber-50 px-3.5 py-3 text-body font-bold leading-snug text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {item.caution}
              </p>
            </>
          )}
          {canAct && (
            <>
              <OpsLabel>지금 못 하면</OpsLabel>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setNote(state === "hold" ? (item.note ?? "") : "");
                    setMode("hold");
                  }}
                  className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 text-body font-black text-amber-900 active:scale-[0.99] dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
                >
                  <Pause className="h-4 w-4" strokeWidth={2.5} aria-hidden /> 보류
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNote(state === "issue" ? (item.note ?? "") : "");
                    setMode("issue");
                  }}
                  className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/5 text-body font-black text-destructive active:scale-[0.99]"
                >
                  <AlertTriangle className="h-4 w-4" strokeWidth={2.5} aria-hidden /> 문제
                </button>
              </div>
              {state && state !== "done" && (
                <button type="button" onClick={() => save(null, null)} className="mt-3 flex h-10 w-full items-center justify-center text-label font-bold text-muted-foreground active:opacity-70">
                  {CLEAN_STATE_LABEL[state]} 풀기
                </button>
              )}
            </>
          )}
        </>
      )}

      {mode === "hold" && (
        <>
          <OpsLabel>왜 보류하나요? — 누르면 바로 남겨요</OpsLabel>
          <div className="grid gap-2">
            {CLEAN_HOLD_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => save("hold", r)}
                className="flex h-12 items-center justify-between rounded-xl border border-border bg-background px-4 text-body font-bold text-foreground active:scale-[0.99]"
              >
                {r}
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
              </button>
            ))}
          </div>
          <OpsLabel>다른 이유</OpsLabel>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={CLEAN_NOTE_MAX}
            placeholder="예: 공사 중이라 못 들어가요"
            aria-label="보류 이유"
            className={opsInput}
          />
          <button type="button" onClick={() => setMode("view")} className="mt-3 flex h-10 items-center text-label font-bold text-muted-foreground active:opacity-70">
            <ChevronLeft className="h-4 w-4" aria-hidden /> 돌아가기
          </button>
        </>
      )}

      {mode === "issue" && (
        <>
          <OpsLabel>무엇이 문제인가요? — 대표님 · 지점장님께 알림이 가요</OpsLabel>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={CLEAN_NOTE_MAX}
            rows={3}
            placeholder="예: 샴푸가 떨어졌어요 · 전구가 나갔어요"
            aria-label="문제 내용"
            className={cn(opsInput, "resize-none leading-relaxed")}
          />
          <button type="button" onClick={() => setMode("view")} className="mt-3 flex h-10 items-center text-label font-bold text-muted-foreground active:opacity-70">
            <ChevronLeft className="h-4 w-4" aria-hidden /> 돌아가기
          </button>
        </>
      )}
    </OpsSheet>
  );
};

// ── 끝내기 시트 ──────────────────────────────────────────────

const FinishSheet = ({
  open,
  slot,
  minutes,
  busy,
  onClose,
  onFinish,
}: {
  open: boolean;
  slot: CleanSlot;
  /** 지금 끝내면 걸린 시간 (이미 끝낸 것은 기록된 시간) */
  minutes: number | null;
  busy: boolean;
  onClose: () => void;
  onFinish: (note: string | null) => void;
}) => {
  const [note, setNote] = useState("");
  const already = !!slot.run?.finishedAt;
  useEffect(() => {
    if (open) setNote(slot.run?.note ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const left = slot.items.filter((i) => i.state === "hold" || i.state === "issue");
  return (
    <OpsSheet
      open={open}
      onClose={onClose}
      stacked
      title={already ? "한마디 고치기" : "청소 끝내기"}
      sub={`${slot.label} · ${finishLine(slot)}`}
      footer={
        <OpsButton
          tone="dark"
          disabled={busy}
          onClick={() => {
            const err = cleanNoteError(null, note);
            if (err) {
              toast.error(err);
              return;
            }
            onFinish(note.trim() ? note.replace(/\s+/g, " ").trim() : null);
          }}
        >
          {already ? "저장" : "끝내기"}
        </OpsButton>
      }
    >
      {minutes != null && (
        <p className="text-body text-muted-foreground">
          걸린 시간 <span className="text-title font-black tabular-nums text-foreground">{minutes}</span>
          <span className="font-bold text-foreground">분</span>
        </p>
      )}
      {left.length > 0 && (
        <>
          <OpsLabel>다음 근무자가 이어서 볼 것</OpsLabel>
          <ul className="space-y-1.5">
            {left.map((i) => (
              <li key={i.id} className="flex items-start gap-2 text-body leading-snug text-foreground">
                <span className={cn("mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-micro font-black", TONE[i.state as "hold" | "issue"].badge)}>
                  {CLEAN_STATE_LABEL[i.state as "hold" | "issue"]}
                </span>
                <span className="min-w-0 flex-1 font-bold">
                  {i.title}
                  {i.note && <span className="font-medium text-muted-foreground"> · {i.note}</span>}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <OpsLabel>다음 근무자에게 한마디 (안 써도 돼요)</OpsLabel>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={CLEAN_NOTE_MAX}
        rows={3}
        placeholder="예: 여자 샤워실 샴푸가 거의 떨어졌어요"
        aria-label="다음 근무자에게 한마디"
        className={cn(opsInput, "resize-none leading-relaxed")}
      />
    </OpsSheet>
  );
};

// ── 전체 화면 ────────────────────────────────────────────────

export default function OpsCleanSheet({ day, slotKey, onSlot, onClose, actions, demo = false, onDate, loading = false, onReport, onBranch, covered = false }: Props) {
  const slot = useMemo(() => day.slots.find((s) => s.slot === slotKey) ?? day.slots[0] ?? null, [day.slots, slotKey]);
  const [itemId, setItemId] = useState<string | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  // Esc — 항목 · 끝내기 시트가 떠 있으면 그 시트만 닫힌다(시트가 맡는다)
  useModalDismiss(true, () => {
    if (!itemId && !finishOpen && !covered) onClose();
  });

  // 시계 — 15초마다.
  //   예시는 그 시간대가 시작하고 2분 지난 것처럼 + 완료한 항목의 목표 분만큼 시간이 흐른 것처럼(남은 시간 · 걸린 시간이 어떻게 보이는지)
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 15_000);
    return () => window.clearInterval(t);
  }, []);
  const slotTime = slot?.time ?? null;
  const base = useMemo(() => (demo && slotTime ? kstMs(day.date, slotTime) + 120_000 - Date.now() : 0), [demo, slotTime, day.date]);
  const doneMin = demo && slot && !slot.run?.finishedAt ? slot.items.reduce((n, i) => n + (i.state === "done" ? i.min : 0), 0) : 0;
  const offset = base + doneMin * 60_000;
  const nowMs = Date.now() + offset;
  /** 서버에는 안 가는 시각 — 예시 화면이 누른 때를 적을 때만 쓴다 */
  const nowIso = (addMin = 0) => new Date(Date.now() + offset + (demo ? addMin * 60_000 : 0)).toISOString();

  // 시간대 · 날짜가 바뀌면 맨 위로
  const scrollRef = useRef<HTMLDivElement>(null);
  const slotId = slot?.slot ?? "";
  useEffect(() => {
    scrollRef.current?.scrollTo?.({ top: 0 });
    setItemId(null);
    setFinishOpen(false);
  }, [slotId, day.date]);

  const today = day.date === day.today;
  const canAct = !!slot && (slot.mine || day.manage);
  const counts = slot ? slotCounts(slot) : null;
  const status = slot ? slotStatus(slot) : "idle";
  const timer = slot ? cleanTimer(slot, day.date, day.today, nowMs) : null;
  const sections = useMemo(() => (slot ? cleanSections(slot.items) : []), [slot]);
  const openItem = slot?.items.find((i) => i.id === itemId) ?? null;

  const toggle = (item: CleanItem) => {
    if (!canAct) return;
    if (item.state === "hold" || item.state === "issue") {
      setItemId(item.id);
      return;
    }
    actions.check(item.id, item.state === "done" ? null : "done", null, nowIso(item.state === "done" ? 0 : item.min));
  };
  const goFirstLeft = () => {
    const first = slot?.items.find((i) => !i.state);
    if (first) document.getElementById(`clean-item-${first.id}`)?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  };
  const pressFinish = () => {
    if (!slot) return;
    const block = finishBlock(slot);
    if (block) {
      toast(block);
      goFirstLeft();
      return;
    }
    setFinishOpen(true);
  };
  // 지금 끝내면 걸린 시간 — 이미 끝낸 것은 기록된 시간
  const finishMinutes = !slot
    ? null
    : slot.run?.finishedAt
      ? elapsedMinutes(slot.run)
      : today && slot.run?.startedAt
        ? elapsedMinutes({ ...slot.run, finishedAt: new Date(nowMs).toISOString() })
        : null;

  // 관리자 날짜 넘기기 — 7일 전까지 · 청소가 도는 요일만
  const minDate = shiftCleanDay(day.today, -7);
  const prevDate = stepCleanDay(day.date, -1, day.days, minDate, day.today);
  const nextDate = stepCleanDay(day.date, 1, day.days, minDate, day.today);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={today ? "오늘 청소" : "청소 기록"} className="fixed inset-0 z-[115] flex flex-col bg-background">
      {/* 머리 — 닫기 · 제목 · 날짜 */}
      <div className="shrink-0 border-b border-border/70 bg-background pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 w-full max-w-md items-center gap-2 px-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary active:scale-95"
          >
            <X className="h-5 w-5 text-secondary-foreground" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-body font-black text-foreground">{today ? "오늘 청소" : "청소 기록"}</p>
            <p className="truncate text-micro font-bold text-muted-foreground">
              {onDate ? (slot ? `${slot.label} ${slot.time}` : day.branch.replace("153복싱짐", "").trim()) : [cleanDayLabel(day.date), slot ? `${slot.label} ${slot.time}` : null].filter(Boolean).join(" · ")}
            </p>
          </div>
          {onReport && demo && <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-micro font-black text-muted-foreground">예시</span>}
          {onReport ? (
            <button
              type="button"
              onClick={onReport}
              aria-label="청소 현황"
              className="flex h-10 shrink-0 items-center gap-1 rounded-full bg-secondary px-3 text-label font-bold text-secondary-foreground active:scale-95"
            >
              <BarChart3 className="h-4 w-4" aria-hidden />
              현황
            </button>
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center">
              {demo && <span className="rounded-full bg-secondary px-2 py-0.5 text-micro font-black text-muted-foreground">예시</span>}
            </span>
          )}
        </div>

        {/* 관리자 — 날짜 넘기기 (7일 전까지) */}
        {onDate && (
          <div className="mx-auto flex h-10 w-full max-w-md items-center justify-center gap-1 px-3 pb-1">
            <button
              type="button"
              onClick={() => prevDate && onDate(prevDate)}
              disabled={!prevDate}
              aria-label="앞 날"
              className="flex h-9 w-9 items-center justify-center rounded-full text-foreground active:bg-secondary disabled:opacity-30"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <p className="min-w-[8.5rem] text-center text-label font-black tabular-nums text-foreground">{cleanDayLabel(day.date)}</p>
            <button
              type="button"
              onClick={() => nextDate && onDate(nextDate)}
              disabled={!nextDate}
              aria-label="다음 날"
              className="flex h-9 w-9 items-center justify-center rounded-full text-foreground active:bg-secondary disabled:opacity-30"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>
        )}

        {/* 지점 — 대표님 · 지점 관리자, 둘 이상일 때 */}
        {onBranch && day.branches.length > 1 && (
          <div className="mx-auto flex w-full max-w-md gap-1.5 overflow-x-auto px-3 pb-2" aria-label="지점">
            {day.branches.map((b) => (
              <button
                key={b.branch}
                type="button"
                aria-pressed={b.branch === day.branch}
                onClick={() => onBranch(b.branch)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-label font-bold active:scale-95",
                  b.branch === day.branch ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground",
                )}
              >
                {b.branch.replace("153복싱짐", "").trim() || b.branch}
              </button>
            ))}
          </div>
        )}

        {/* 시간대 — 둘 이상일 때 */}
        {day.slots.length > 1 && (
          <div className="mx-auto flex w-full max-w-md gap-1.5 overflow-x-auto px-3 pb-2.5" role="tablist" aria-label="시간대">
            {day.slots.map((s) => {
              const on = s.slot === slot?.slot;
              const st = slotStatus(s);
              return (
                <button
                  key={s.slot}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => onSlot(s.slot)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-label font-bold transition-colors active:scale-95",
                    on ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground",
                  )}
                >
                  <span
                    className={cn("h-2 w-2 rounded-full", st === "finished" ? "bg-primary" : st === "doing" ? "bg-amber-400" : on ? "bg-background/50" : "bg-muted-foreground/40")}
                    aria-hidden
                  />
                  {s.label}
                  <span className="tabular-nums opacity-70">{s.time}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 본문 */}
      <div ref={scrollRef} className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain transition-opacity", loading && "opacity-60")}>
        <div className="mx-auto w-full max-w-md space-y-5 px-4 pb-8 pt-4">
          {!slot || !counts || !timer ? (
            <div className="rounded-3xl bg-card px-5 py-12 text-center shadow-elev-1">
              <p className="text-body font-bold text-foreground">{day.closed ? "휴관일이에요" : "이 날은 청소가 없어요"}</p>
              <p className="mt-1.5 text-label text-muted-foreground">평일 오픈 · 저녁 · 마감 때 청소 목록이 열려요</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <Hero
                  slot={slot}
                  timer={timer}
                  counts={counts}
                  date={day.date}
                  canStart={slot.mine && timer.kind === "idle"}
                  busy={actions.busy}
                  onStart={() => actions.start(slot.slot, nowIso())}
                />
                <HandoverBand lines={slot.handover} date={day.date} />
              </div>

              {sections.map((sec) => (
                <section key={sec.key} aria-label={sec.kind === "mission" ? "오늘의 미션" : sec.label}>
                  {sec.kind === "mission" && (
                    <p className="flex items-center gap-1 px-1 text-label font-black text-primary">
                      <Sparkles className="h-4 w-4 shrink-0" aria-hidden /> 오늘의 미션
                    </p>
                  )}
                  <div className="flex items-baseline justify-between gap-2 px-1">
                    <h3 className="min-w-0 truncate text-heading font-black text-foreground">
                      {sec.kind === "mission" ? missionHeading(day.date, sec.items) : sec.label}
                    </h3>
                    <span className="shrink-0 text-label font-bold tabular-nums text-muted-foreground">
                      {sec.minutes > 0 ? `${sec.minutes}분 · ` : ""}
                      {sec.checked}/{sec.items.length}
                    </span>
                  </div>
                  {sec.kind === "zone" && sec.rule && <p className="mt-1 px-1 text-label leading-snug text-muted-foreground">{sec.rule}</p>}
                  <ul className="mt-2 space-y-2">
                    {sec.items.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        canAct={canAct}
                        accent={sec.kind === "mission"}
                        onToggle={() => toggle(item)}
                        onOpen={() => setItemId(item.id)}
                      />
                    ))}
                  </ul>
                </section>
              ))}

              {/* 지킬 수칙 — 접어 둔다 */}
              <section className="rounded-3xl border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setRulesOpen((v) => !v)}
                  aria-expanded={rulesOpen}
                  className="flex h-14 w-full items-center justify-between px-4 text-body font-bold text-foreground active:opacity-70"
                >
                  지킬 수칙 {CLEAN_RULES.length}가지
                  <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", rulesOpen && "rotate-180")} aria-hidden />
                </button>
                {rulesOpen && (
                  <ul className="space-y-3 border-t border-border px-4 py-4">
                    {CLEAN_RULES.map((r) => (
                      <li key={r.title}>
                        <p className="text-label font-black text-foreground">{r.title}</p>
                        <p className="mt-0.5 text-body leading-relaxed text-muted-foreground">{r.body}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              {day.manage && !slot.mine && <p className="px-1 text-label text-muted-foreground">대신 체크하면 내 이름으로 남아요</p>}
            </>
          )}
        </div>
      </div>

      {/* 아래 — 청소 끝내기 (시작 전에는 위 「청소 시작」이 할 일이라 숨긴다) */}
      {slot && counts && canAct && status !== "idle" && (
        <div className="shrink-0 border-t border-border/70 bg-background pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto w-full max-w-md px-4 py-3">
            {status === "finished" ? (
              <button
                type="button"
                onClick={() => setFinishOpen(true)}
                className="flex h-14 w-full items-center justify-center rounded-2xl border border-border bg-background text-body font-bold text-foreground active:scale-[0.99]"
              >
                한마디 남기기 · 고치기
              </button>
            ) : counts.left > 0 ? (
              <button
                type="button"
                onClick={pressFinish}
                className="flex h-14 w-full items-center justify-center gap-1.5 rounded-2xl bg-secondary text-body font-black text-foreground active:scale-[0.99]"
              >
                아직 {counts.left}개 남았어요 <ArrowDown className="h-4 w-4" aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                onClick={pressFinish}
                disabled={actions.busy}
                className="flex h-14 w-full items-center justify-center rounded-2xl bg-foreground text-body font-black text-background active:scale-[0.99] disabled:opacity-60"
              >
                청소 끝내기
              </button>
            )}
          </div>
        </div>
      )}

      <ItemSheet
        item={openItem}
        canAct={canAct}
        onClose={() => setItemId(null)}
        onSet={(state, note) => openItem && actions.check(openItem.id, state, note, nowIso())}
      />
      {slot && (
        <FinishSheet
          open={finishOpen}
          slot={slot}
          minutes={finishMinutes}
          busy={actions.busy}
          onClose={() => setFinishOpen(false)}
          onFinish={(note) => actions.finish(slot.slot, note, nowIso(), () => setFinishOpen(false))}
        />
      )}
    </div>,
    document.body,
  );
}
