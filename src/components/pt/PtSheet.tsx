/**
 * 🗓 내 PT 일정 창 — 예정 · 지난 수업 · 예약하기 · 시간 바꾸기 (2026-11-14 대표님 — 홈 「PT 수업」 카드에서 연다)
 *   · 예정: 예약마다 [시간 바꾸기] [취소]. 취소는 무슨 일이 생기는지 먼저 보여 주고 한 번 더 묻는다
 *       (전날까지 = 차감 없음 · 방금 잡은 예약 = 차감 없음 · 수업 당일 = 1회 차감 — lib/ptBooking cancelMode, 서버 pt_cancel 과 같은 판정)
 *     수업 시간이 지난 예약은 「수업 받았어요」(수업 기록 + 적립).
 *   · 지난 수업: 날짜마다 한 줄 — 수업 완료 +1,000 · 취소 · 당일 취소 · 미참석 · 코치님 사정 · 시간 변경.
 *   · 예약하기 / 시간 바꾸기: 날짜(앞으로 14일) → 코치님이 열어 둔 빈 시간 → 확인. 누르면 바로 확정(코치님께 알림).
 *   숫자 · 규칙은 서버 값 그대로(남은 횟수 = 브로제이 기준 시각과 함께).
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarPlus } from "lucide-react";
import { toast } from "sonner";

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { asOfLabel, ymdText } from "@/lib/gymTicketInfo";
import {
  CANCEL_COPY,
  DAY_PART_LABEL,
  PT_RULE_LINE,
  PT_WEEKDAY,
  aheadChip,
  canMove,
  cancelMode,
  dateLabel,
  dayDiff,
  dayWord,
  freeCount,
  freeSlotGroups,
  historyView,
  kstDateOfIso,
  monthLessons,
  splitBookings,
  ticketTotal,
  timeLabel,
  weekdayOf,
  whenLabel,
  type PtHome,
  type PtHomeBooking,
} from "@/lib/ptBooking";
import { usePtActions, usePtOpenSlots } from "@/services/ptBookingService";
import { cn } from "@/lib/utils";
import { PremiumTag, TicketCells } from "./HomePtCard";

const n = (v: number) => v.toLocaleString("ko-KR");
const errText = (e: unknown, fb: string) => (e instanceof Error && e.message ? e.message : fb);

type View = { kind: "list" } | { kind: "book" } | { kind: "move"; booking: PtHomeBooking };

export interface PtSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  home: PtHome;
  initialView?: "list" | "book";
}

const PtSheet = ({ open, onOpenChange, home, initialView = "list" }: PtSheetProps) => {
  const [view, setView] = useState<View>(initialView === "book" && home.canBook ? { kind: "book" } : { kind: "list" });
  const [tab, setTab] = useState<"next" | "past">("next");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const picking = view.kind !== "list";
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="pb-2 text-left">
          <div className="flex items-center gap-2">
            {picking && (
              <button
                type="button"
                onClick={() => setView({ kind: "list" })}
                aria-label="내 PT 일정으로"
                className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground active:bg-muted"
              >
                <ArrowLeft className="h-5 w-5" aria-hidden />
              </button>
            )}
            <DrawerTitle className="flex min-w-0 items-center gap-2 text-heading">
              <span className="truncate">{view.kind === "book" ? "PT 예약하기" : view.kind === "move" ? "시간 바꾸기" : "내 PT 일정"}</span>
              {!picking && <PremiumTag />}
            </DrawerTitle>
          </div>
          <DrawerDescription className="text-label">
            {view.kind === "move" ? `지금 예약 · ${whenLabel(view.booking.start_at, home.today)}` : PT_RULE_LINE}
          </DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          {view.kind === "list" ? (
            <ListView
              home={home}
              now={now}
              tab={tab}
              setTab={setTab}
              onBook={() => setView({ kind: "book" })}
              onMove={(b) => setView({ kind: "move", booking: b })}
            />
          ) : (
            <SlotPicker home={home} now={now} move={view.kind === "move" ? view.booking : null} onDone={() => { setTab("next"); setView({ kind: "list" }); }} />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

// ───────────────────────── 목록 ─────────────────────────
const ListView = ({
  home,
  now,
  tab,
  setTab,
  onBook,
  onMove,
}: {
  home: PtHome;
  now: number;
  tab: "next" | "past";
  setTab: (t: "next" | "past") => void;
  onBook: () => void;
  onMove: (b: PtHomeBooking) => void;
}) => {
  const { confirm: waiting, upcoming } = splitBookings(home, now);
  const total = ticketTotal(home.ticket.name);
  const remaining = home.ticket.remaining;
  const asOf = asOfLabel(home.ticket.checkedAt, now);
  const month = monthLessons(home, home.today.slice(0, 7));

  return (
    <div className="space-y-4">
      {/* 수업권 — 주인공 숫자 하나(남은 횟수) */}
      <section aria-label="PT 수업권" className="rounded-2xl bg-muted/50 px-5 py-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-label font-bold text-muted-foreground">남은 횟수</p>
            <p className="mt-0.5 text-display tracking-tight tabular-nums text-foreground">
              {remaining != null ? n(remaining) : "—"}
              <span className="ml-1 text-heading font-bold">회</span>
            </p>
          </div>
          <div className="min-w-0 pb-1.5 text-right">
            {home.ticket.name && <p className="truncate text-label font-bold text-foreground">{home.ticket.name}</p>}
            {home.ticket.endDate && <p className="text-label text-muted-foreground">{ymdText(home.ticket.endDate)}까지</p>}
          </div>
        </div>
        {total != null && remaining != null && total >= remaining && <TicketCells total={total} remaining={remaining} className="mt-3" />}
        {asOf && <p className="mt-2 text-label text-muted-foreground">{asOf} · 하루쯤 늦게 바뀔 수 있어요</p>}
      </section>

      {/* 예정 · 지난 수업 */}
      <div role="tablist" aria-label="PT 일정 보기" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {(
          [
            ["next", `예정 ${upcoming.length + waiting.length}`],
            ["past", "지난 수업"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn(
              "h-10 rounded-lg text-body font-bold transition-colors",
              tab === k ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "next" ? (
        <div className="space-y-3">
          {waiting.map((b) => (
            <ConfirmCard key={b.id} booking={b} home={home} />
          ))}
          {upcoming.map((b) => (
            <BookingCard key={b.id} booking={b} home={home} now={now} onMove={() => onMove(b)} />
          ))}
          {upcoming.length === 0 && waiting.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border px-5 py-6 text-center text-body text-muted-foreground">
              잡혀 있는 수업이 없어요
            </p>
          )}
          {home.canBook ? (
            <button
              type="button"
              onClick={onBook}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-body font-black text-primary-foreground transition-transform active:scale-[0.98]"
            >
              <CalendarPlus className="h-5 w-5" aria-hidden />
              예약하기
            </button>
          ) : (
            <p className="rounded-xl bg-muted/60 px-4 py-3 text-label text-muted-foreground">
              {!home.pt
                ? "PT 수업권이 있으면 예약할 수 있어요"
                : home.room <= 0 && home.coach
                  ? "남은 횟수만큼 예약이 잡혀 있어요"
                  : "예약은 코치님이 넣어 드려요 · 코치님이 시간을 열어 두면 여기서 직접 고를 수 있어요"}
            </p>
          )}
        </div>
      ) : (
        <div>
          {month.lessons > 0 && (
            <p className="mb-1 rounded-xl bg-primary/5 px-4 py-3 text-body font-bold text-foreground">
              이번 달 수업 {n(month.lessons)}회
              {month.mileage > 0 && <span className="ml-1.5 tabular-nums text-primary">+{n(month.mileage)} 마일리지</span>}
            </p>
          )}
          {home.history.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-5 py-6 text-center text-body text-muted-foreground">
              첫 수업을 하면 여기에 쌓여요
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {home.history.map((h) => {
                const v = historyView(h, home.today);
                return (
                  <li key={h.key} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-bold text-foreground">
                        {dateLabel(h.day)}
                        {h.start_at ? ` ${timeLabel(h.start_at)}` : ""}
                      </p>
                      <p className="truncate text-label text-muted-foreground">
                        {h.kind === "moved" && v.sub ? v.sub : `${h.coach} 코치님`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className={cn(
                          "inline-block rounded-full px-2.5 py-1 text-label font-bold",
                          v.tone === "good" && "bg-primary/10 text-primary",
                          v.tone === "warn" && "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
                          v.tone === "plain" && "bg-muted text-muted-foreground",
                        )}
                      >
                        {v.label}
                      </span>
                      {v.sub && h.kind !== "moved" && (
                        <p
                          className={cn(
                            "mt-1 text-label font-bold tabular-nums",
                            v.tone === "good" ? "text-primary" : v.tone === "warn" ? "text-orange-700 dark:text-orange-300" : "text-muted-foreground",
                          )}
                        >
                          {v.sub}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

/** 수업 시간이 지난 예약 — 「수업 받았어요」 */
const ConfirmCard = ({ booking, home }: { booking: PtHomeBooking; home: PtHome }) => {
  const { confirm } = usePtActions();
  const onConfirm = () => {
    if (confirm.isPending) return;
    confirm.mutate(booking.id, {
      onSuccess: (r) => toast.success(r.mileage > 0 ? `수업 기록 완료 · +${n(r.mileage)} 마일리지 🥊` : "수업 기록 완료 🥊"),
      onError: (e: unknown) => toast.error(errText(e, "기록하지 못했어요")),
    });
  };
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <p className="text-heading font-black text-foreground">{whenLabel(booking.start_at, home.today)}</p>
      <p className="mt-0.5 text-label text-muted-foreground">{booking.coach} 코치님 · 수업을 받았다면 눌러 주세요</p>
      <button
        type="button"
        onClick={onConfirm}
        disabled={confirm.isPending}
        className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-body font-black text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {confirm.isPending ? "기록하는 중…" : "수업 받았어요"}
        {!confirm.isPending && home.rules.mileage > 0 && (
          <span className="rounded-full bg-white/25 px-2 py-0.5 text-label font-black tabular-nums">+{n(home.rules.mileage)}</span>
        )}
      </button>
    </div>
  );
};

/** 앞으로의 예약 한 장 — 시간 바꾸기 · 취소(한 번 더 묻기) */
const BookingCard = ({ booking, home, now, onMove }: { booking: PtHomeBooking; home: PtHome; now: number; onMove: () => void }) => {
  const { cancel } = usePtActions();
  const [asking, setAsking] = useState(false);
  const mode = cancelMode(booking, home.today, now, home.rules.graceMinutes);
  const movable = canMove(booking, home.today, now, home.rules.graceMinutes);
  const chip = aheadChip(booking.day, home.today);
  const copy = mode === "started" ? null : CANCEL_COPY[mode];

  const onCancel = () => {
    if (cancel.isPending || mode === "started") return;
    cancel.mutate(
      { id: booking.id, lateOk: mode === "late" },
      {
        onSuccess: (r) => toast.success(r.deducted ? "취소했어요 · 수업권 1회가 차감돼요" : "차감 없이 취소했어요"),
        onError: (e: unknown) => toast.error(errText(e, "취소하지 못했어요")),
      },
    );
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-heading font-black text-foreground">{whenLabel(booking.start_at, home.today)}</p>
          <p className="mt-0.5 truncate text-label text-muted-foreground">
            {booking.coach} 코치님 · {home.rules.slotMinutes}분{booking.team ? " · 팀 수업" : ""}
          </p>
        </div>
        {chip && <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-label font-bold text-secondary-foreground">{chip}</span>}
      </div>

      {asking && copy ? (
        <div
          role="alertdialog"
          aria-label="예약 취소 확인"
          className={cn("mt-3 rounded-xl px-4 py-3", copy.danger ? "bg-orange-50 dark:bg-orange-500/10" : "bg-muted/60")}
        >
          <p className={cn("text-body font-black", copy.danger ? "text-orange-700 dark:text-orange-300" : "text-foreground")}>{copy.title}</p>
          <p className="mt-1 text-label text-muted-foreground">{copy.body}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAsking(false)}
              disabled={cancel.isPending}
              className="h-11 rounded-xl border border-border bg-card text-body font-bold text-foreground active:scale-[0.98]"
            >
              그대로 두기
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={cancel.isPending}
              className={cn(
                "h-11 rounded-xl text-body font-black active:scale-[0.98] disabled:opacity-60",
                copy.danger ? "bg-orange-600 text-white" : "bg-foreground text-background",
              )}
            >
              {cancel.isPending ? "취소하는 중…" : copy.ok}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onMove}
            disabled={!movable}
            className="h-11 rounded-xl border border-border bg-card text-body font-bold text-foreground active:scale-[0.98] disabled:text-muted-foreground disabled:opacity-60"
          >
            시간 바꾸기
          </button>
          <button
            type="button"
            onClick={() => setAsking(true)}
            disabled={mode === "started"}
            className="h-11 rounded-xl border border-border bg-card text-body font-bold text-foreground active:scale-[0.98] disabled:opacity-60"
          >
            취소
          </button>
        </div>
      )}
      {!movable && !asking && <p className="mt-2 text-label text-muted-foreground">오늘 수업 시간은 코치님께 말씀해 주세요</p>}
    </div>
  );
};

// ───────────────────────── 예약하기 · 시간 바꾸기 ─────────────────────────
const SlotPicker = ({ home, now, move, onDone }: { home: PtHome; now: number; move: PtHomeBooking | null; onDone: () => void }) => {
  const { data, isLoading, isError, refetch } = usePtOpenSlots(true);
  const { book, move: moveAct } = usePtActions();
  const [day, setDay] = useState<string | null>(null);
  const [at, setAt] = useState<string | null>(null);
  const moveDay = move?.day ?? null;
  const busy = book.isPending || moveAct.isPending;

  const days = useMemo(() => data?.days ?? [], [data]);
  // 처음엔 빈 시간이 있는 가장 가까운 날
  useEffect(() => {
    if (day || days.length === 0) return;
    setDay((days.find((d) => freeCount(d, moveDay) > 0) ?? days[0]).date);
  }, [days, day, moveDay]);

  const cur = days.find((d) => d.date === day) ?? null;
  const groups = cur && (!cur.mine || cur.date === moveDay) ? freeSlotGroups(cur).map((g) => ({ ...g, slots: g.slots.filter((s) => s.at !== move?.start_at) })).filter((g) => g.slots.length) : [];
  const noRoom = !move && (data?.room ?? home.room) <= 0;

  const submit = () => {
    if (!at || busy) return;
    const label = `${dateLabel(kstDateOfIso(at))} ${timeLabel(at)}`;
    const opts = {
      onSuccess: () => {
        toast.success(move ? `시간을 바꿨어요 · ${label}` : `예약했어요 · ${label}`);
        onDone();
      },
      onError: (e: unknown) => {
        toast.error(errText(e, move ? "시간을 바꾸지 못했어요" : "예약하지 못했어요"));
        setAt(null);
        void refetch();
      },
    };
    if (move) moveAct.mutate({ id: move.id, at }, opts);
    else book.mutate(at, opts);
  };

  if (isLoading) return <div className="h-48 animate-pulse rounded-2xl bg-muted/60" aria-label="예약할 수 있는 시간을 불러오는 중" />;
  if (isError || !data) {
    return (
      <div className="py-6 text-center">
        <p className="text-body text-muted-foreground">예약할 수 있는 시간을 불러오지 못했어요</p>
        <button type="button" onClick={() => void refetch()} className="mt-3 h-11 rounded-xl bg-muted px-5 text-body font-bold text-foreground active:scale-[0.98]">
          다시 불러오기
        </button>
      </div>
    );
  }
  if (!data.coach || days.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-5 py-6 text-center text-body text-muted-foreground">
        코치님이 아직 예약 시간을 열어 두지 않았어요 · 코치님께 예약을 부탁해 주세요
      </p>
    );
  }
  if (noRoom) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-5 py-6 text-center text-body text-muted-foreground">
        남은 횟수만큼 예약이 잡혀 있어요
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* 날짜 — 앞으로 14일 */}
      <div className="-mx-4 overflow-x-auto px-4 pb-1" role="group" aria-label="날짜">
        <div className="flex w-max gap-1.5">
          {days.map((d) => {
            const free = freeCount(d, moveDay);
            const on = d.date === day;
            const diff = dayDiff(home.today, d.date);
            return (
              <button
                key={d.date}
                type="button"
                aria-pressed={on}
                aria-label={`${dateLabel(d.date)}${free > 0 ? ` 빈 시간 ${free}개` : d.mine ? " 예약 있음" : " 빈 시간 없음"}`}
                onClick={() => {
                  setDay(d.date);
                  setAt(null);
                }}
                className={cn(
                  "flex h-[4.5rem] w-14 shrink-0 flex-col items-center justify-center rounded-2xl border transition-transform active:scale-95",
                  on ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground",
                  !on && free === 0 && "opacity-45",
                )}
              >
                <span className="text-label font-bold">{diff === 0 ? "오늘" : diff === 1 ? "내일" : PT_WEEKDAY[weekdayOf(d.date)]}</span>
                <span className="text-heading font-black tabular-nums">{Number(d.date.slice(8))}</span>
                <span className={cn("mt-0.5 h-1.5 w-1.5 rounded-full", free > 0 ? (on ? "bg-background" : "bg-primary") : "bg-transparent")} aria-hidden />
              </button>
            );
          })}
        </div>
      </div>

      {/* 시간 — 빈 칸만 */}
      {cur && (
        <section aria-label={`${dateLabel(cur.date)} 빈 시간`}>
          <p className="text-body font-black text-foreground">
            {dayWord(cur.date, home.today) === dateLabel(cur.date) ? dateLabel(cur.date) : `${dayWord(cur.date, home.today)} · ${dateLabel(cur.date)}`}
          </p>
          {groups.length === 0 ? (
            <p className="mt-2 rounded-xl bg-muted/60 px-4 py-4 text-body text-muted-foreground">
              {cur.mine && cur.date !== moveDay ? "이 날은 이미 PT 예약이 있어요" : "이 날은 빈 시간이 없어요 · 다른 날을 골라 보세요"}
            </p>
          ) : (
            groups.map((g) => (
              <div key={g.part} className="mt-3">
                <p className="text-label font-bold text-muted-foreground">{DAY_PART_LABEL[g.part]}</p>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                  {g.slots.map((s) => {
                    const on = s.at === at;
                    return (
                      <button
                        key={s.at}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setAt(on ? null : s.at)}
                        className={cn(
                          "h-12 rounded-xl border text-body font-bold tabular-nums transition-transform active:scale-95",
                          on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground",
                        )}
                      >
                        {timeLabel(s.at)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {/* 확인 */}
      {at && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-4">
          <p className="text-label font-bold text-primary">{move ? "이 시간으로 바꿔요" : "이 시간으로 예약해요"}</p>
          <p className="mt-1 text-heading font-black text-foreground">{whenLabel(at, home.today)}</p>
          <p className="mt-1 text-label text-muted-foreground">
            {data.coach.name} 코치님 · {data.slotMinutes}분
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={!at || busy}
        className="flex h-14 w-full items-center justify-center rounded-2xl bg-primary text-body font-black text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? "저장하는 중…" : !at ? "시간을 골라 주세요" : move ? "이 시간으로 바꾸기" : "이 시간으로 예약"}
      </button>
    </div>
  );
};

export default PtSheet;
