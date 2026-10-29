/**
 * 153운영본부 · 근무 — 함께 쓰는 작은 조각 (시트 · 칩 · 상태 표시 · 날짜 글)
 */
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { useModalDismiss } from "@/hooks/useModalDismiss";
import { cn } from "@/lib/utils";
import { OPS_WEEKDAY, fmtDuration, weekdayOf, type OpsDay, type OpsDayStatus } from "@/lib/opsWork";

export const opsInput =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-body text-foreground outline-none focus:border-primary/60";

export const kstToday = (): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
export const monthOf = (date: string): string => `${date.slice(0, 7)}-01`;
export const shiftMonth = (month: string, delta: number): string => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
};
/** "2026-10-21" → "10월 21일 (화)" */
export const fmtDay = (date: string): string => {
  const [, m, d] = date.split("-").map(Number);
  return `${m}월 ${d}일 (${OPS_WEEKDAY[weekdayOf(date)]})`;
};

export const OpsSheet = ({
  open,
  onClose,
  title,
  sub,
  children,
  footer,
  stacked,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sub?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** 시트 위에 또 뜨는 시트 */
  stacked?: boolean;
}) => {
  useModalDismiss(open, onClose);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className={cn(
            "fixed inset-0 flex items-end justify-center bg-background/85 backdrop-blur-sm sm:items-center sm:p-4",
            stacked ? "z-[120]" : "z-[100]",
          )}
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
          >
            <div className="flex items-start justify-between gap-2 border-b border-border px-5 pb-3 pt-5">
              <div className="min-w-0">
                <h2 className="truncate text-heading font-black text-foreground">{title}</h2>
                {sub && <p className="mt-0.5 truncate text-label text-muted-foreground">{sub}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="닫기"
                className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground active:scale-95"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && <div className="border-t border-border px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const OpsChip = ({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-pressed={on}
    className={cn(
      "shrink-0 rounded-full border px-3 py-1.5 text-label font-bold transition-colors active:scale-95 disabled:opacity-50",
      on ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground",
    )}
  >
    {children}
  </button>
);

export const OpsLabel = ({ children }: { children: ReactNode }) => (
  <p className="mb-1.5 mt-4 text-label font-bold text-muted-foreground first:mt-0">{children}</p>
);

export const OpsButton = ({
  onClick,
  disabled,
  children,
  tone = "primary",
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  tone?: "primary" | "dark" | "plain" | "danger";
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "flex h-12 w-full items-center justify-center gap-1.5 rounded-xl text-body font-black transition-all active:scale-[0.99] disabled:opacity-50",
      tone === "primary" && "bg-primary text-primary-foreground",
      tone === "dark" && "bg-foreground text-background",
      tone === "plain" && "border border-border bg-background text-foreground",
      tone === "danger" && "border border-destructive/40 bg-background text-destructive",
    )}
  >
    {children}
  </button>
);

export const STATUS_META: Record<OpsDayStatus, { label: string; cls: string }> = {
  ok: { label: "정상", cls: "bg-primary/10 text-primary" },
  late: { label: "지각", cls: "bg-orange-100 text-orange-700" },
  missing: { label: "출근 없음", cls: "bg-destructive/10 text-destructive" },
  adjusted: { label: "고침", cls: "bg-secondary text-foreground" },
  off: { label: "쉼", cls: "bg-muted text-muted-foreground" },
  extra: { label: "시간표 밖", cls: "bg-amber-100 text-amber-800" },
  today: { label: "오늘", cls: "bg-secondary text-foreground" },
  future: { label: "예정", cls: "bg-muted text-muted-foreground" },
  none: { label: "", cls: "" },
};

export const StatusPill = ({ status }: { status: OpsDayStatus }) =>
  status === "none" ? null : (
    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-micro font-bold", STATUS_META[status].cls)}>
      {STATUS_META[status].label}
    </span>
  );

export const MonthSwitcher = ({ month, onChange, max }: { month: string; onChange: (m: string) => void; max: string }) => {
  const [y, m] = month.split("-").map(Number);
  const canNext = shiftMonth(month, 1) <= max;
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, -1))}
        aria-label="지난달"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary active:scale-95"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[6.5rem] text-center text-body font-black tabular-nums text-foreground">
        {y}년 {m}월
      </span>
      <button
        type="button"
        onClick={() => canNext && onChange(shiftMonth(month, 1))}
        disabled={!canNext}
        aria-label="다음 달"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary active:scale-95 disabled:opacity-40"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
};

/** 날짜 한 줄 — 날짜 · 시간표(대타) · 얼굴 출근 · 연장 / 상태(정상은 안 그림) · 인정 시간 (근무자 카드 · 코치님 화면 공용) */
export const DayRow = ({ day, onClick }: { day: OpsDay; onClick: () => void }) => (
  <li>
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-secondary/60">
      <div className="min-w-0 flex-1">
        <p className="text-body font-bold text-foreground">{fmtDay(day.date)}</p>
        <p className="truncate text-label text-muted-foreground">
          {day.segs.length ? day.segs.map((s) => `${s.start}~${s.end}${s.coverFor ? " 대타" : ""}`).join(" · ") : "시간표 없음"}
          {day.checkin ? ` · 출근 ${day.checkin}` : ""}
          {day.overtimeMin > 0 ? ` · 연장 ${fmtDuration(day.overtimeMin)}` : ""}
        </p>
      </div>
      {day.status !== "ok" && <StatusPill status={day.status} />}
      <span className="w-16 shrink-0 text-right text-body font-black tabular-nums text-foreground">
        {day.creditedMin > 0 ? fmtDuration(day.creditedMin) : "—"}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  </li>
);
