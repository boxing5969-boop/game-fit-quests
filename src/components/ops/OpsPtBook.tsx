/**
 * 153운영본부 · 근무 — 「PT 예약」 판 (2026-11-14 · PT 프리미엄 1단계 · 보고서 https://claude.ai/artifact/KVmuJHjNQ2aqLw4ADc62xn)
 *
 *   코치(PT 위탁): 내 담당 예약만 — 결과가 필요한 지난 예약(맨 위 · [수업함] 한 번) → 오늘부터 3주 날짜 줄 → 그날 수업 줄
 *     · [예약 넣기](회원 → 날짜 → 시간 → 이번만 / 매주) · PT 회원(예약 없는 회원 먼저) · 예약 가능 시간(회원이 직접 잡는 칸)
 *   지점장 · 대표님: 지점 전체(코치가 둘 이상이면 코치 칩으로 거르기) · 대표님은 켜기 · 수업 적립 금액
 *   꺼진 지점: 대표님에게만 「켜기」 카드 — 그 밖엔 아무것도 그리지 않는다(서버에 함수가 없는 DB 도 같다)
 *   알림 링크 /office?tab=work&pt=book 으로 오면 이 판으로 내려온다.
 *   계산 · 글 = src/lib/ptBooking.ts · 읽고 쓰기 = src/services/ptBookingService.ts · 창 = OpsPtBookSheets.tsx
 *   수당 · 급여 금액은 여기 없다(회원 마일리지 금액만).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  BOOKING_STATUS_META,
  PT_WEEKDAY,
  addDays,
  boardRows,
  boardView,
  dateLabel,
  dayWord,
  enteredOn,
  kstMinutes,
  memberRows,
  minuteClock,
  slotSummary,
  slotsOfCoach,
  weekdayOf,
  type PtBoard,
  type PtBoardRow,
} from "@/lib/ptBooking";
import { usePtBoard, usePtBoardActions } from "@/services/ptBookingService";
import { cn } from "@/lib/utils";
import { OpsButton, OpsChip } from "./OpsParts";
import { PtAddSheet, PtDetailSheet, PtMembersSheet, PtSettingsSheet, PtSlotsSheet, type PtAddPreset } from "./OpsPtBookSheets";

const card = "rounded-2xl border border-border bg-card p-5";
const STRIP_DAYS = 21;
const n = (v: number) => v.toLocaleString("ko-KR");
const errText = (e: unknown, fb: string) => (e instanceof Error && e.message ? e.message : fb);

type Pill = { label: string; tone: "live" | "good" | "plain" | "warn" };
/** 줄 오른쪽 표시 — 예약 그대로면 없음(›), 수업 중 · 결과 필요 · 끝난 결과 */
function rowPill(row: PtBoardRow, now: number): Pill | null {
  const st = row.bookings.map((b) => b.status);
  if (st.includes("booked")) {
    if (Date.parse(row.end_at) <= now) return { label: "결과 필요", tone: "warn" };
    if (Date.parse(row.start_at) <= now) return { label: "수업 중", tone: "good" };
    return null;
  }
  return new Set(st).size === 1 ? BOOKING_STATUS_META[st[0]] : { label: "처리 끝", tone: "plain" };
}
const pillCls = (tone: Pill["tone"]) =>
  cn(
    "shrink-0 rounded-full px-2.5 py-1 text-micro font-bold",
    tone === "live" && "bg-secondary text-foreground",
    tone === "good" && "bg-primary/10 text-primary",
    tone === "warn" && "bg-orange-100 text-orange-700",
    tone === "plain" && "bg-muted text-muted-foreground",
  );

const rowNames = (row: PtBoardRow) => row.bookings.map((b) => b.member_name).join(" · ");

/** 줄 아래 회색 한 줄 — 남은 횟수 · 앱 예약 · 입장 · (관리자) 코치 */
function rowSub(row: PtBoardRow, board: PtBoard, coachName: string | null): string {
  const parts: string[] = [];
  if (row.bookings.length > 1) {
    parts.push(`팀 PT ${row.bookings.length}명`);
    const inN = row.bookings.filter((b) => enteredOn(board, b.member_user_id, row.day)).length;
    if (inN > 0) parts.push(`입장 ${inN}명`);
  } else {
    const b = row.bookings[0];
    const m = board.members.find((x) => x.user_id === b.member_user_id);
    if (m?.remaining != null) parts.push(`남은 ${n(m.remaining)}회`);
    if (b.made_by === "member") parts.push("앱 예약");
    if (enteredOn(board, b.member_user_id, row.day)) parts.push("입장함");
  }
  if (coachName) parts.push(`${coachName} 코치`);
  return parts.join(" · ");
}

export interface OpsPtBookProps {
  branch: string;
  /** 이 코치 것만(근무자 카드에서) — 없으면 코치 = 본인 · 관리자 = 지점 전체 */
  coachId?: string | null;
  /** 예시 화면(?demo=1) — 서버를 부르지 않는다 */
  demo?: boolean;
  /** 예시를 관리자 화면으로 */
  demoManage?: boolean;
}

const OpsPtBook = ({ branch, coachId = null, demo = false, demoManage = false }: OpsPtBookProps) => {
  const q = usePtBoard(branch, { demo, demoManage });
  const actions = usePtBoardActions(branch, { demo, demoManage });
  const board = q.data;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const [filter, setFilter] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [add, setAdd] = useState<PtAddPreset | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [slotsOpen, setSlotsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [morePending, setMorePending] = useState(false);
  const [quick, setQuick] = useState<string | null>(null);

  // 알림을 누르고 왔을 때(/office?tab=work&pt=book) — 이 판으로 내려온다
  const [params] = useSearchParams();
  const rootRef = useRef<HTMLElement | null>(null);
  const wantScroll = params.get("pt") === "book";
  const scrolled = useRef(false);
  useEffect(() => {
    if (!wantScroll || scrolled.current || !board?.on || !rootRef.current) return;
    scrolled.current = true;
    rootRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [wantScroll, board?.on]);

  // 누구 것을 보나 — 근무자 카드에서 정해 줬으면 그 코치, 코치는 본인, 관리자는 고른 코치(없으면 전체)
  const coach = coachId ?? (board?.manage ? filter : (board?.me_staff ?? null));
  const view = useMemo(() => (board?.on ? boardView(board, coach, now) : null), [board, coach, now]);
  const members = useMemo(() => (board?.on ? memberRows(board, coach, now) : []), [board, coach, now]);
  const detailRow = useMemo(
    () => (board && detailKey ? (boardRows(board.bookings).find((r) => r.key === detailKey) ?? null) : null),
    [board, detailKey],
  );

  if (!board) return null;

  // 꺼져 있음 — 대표님에게만 켜는 카드
  if (!board.on || !view) {
    if (!board.can_set) return null;
    return (
      <section className={card}>
        <p className="text-body font-black text-foreground">PT 예약이 꺼져 있어요</p>
        <p className="mb-3 mt-1 text-label text-muted-foreground">
          켜면 코치님이 앱에서 PT 예약을 넣고, PT 회원 홈에 「PT 수업」 카드가 생겨요 · 수업 1회마다 마일리지가 쌓여요
        </p>
        <OpsButton tone="dark" onClick={() => setSettingsOpen(true)}>
          켜기 · 설정
        </OpsButton>
        <PtSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} board={board} actions={actions} />
      </section>
    );
  }

  const today = board.today;
  const sel = day && day >= today ? day : today;
  const days = Array.from({ length: STRIP_DAYS }, (_, i) => addDays(today, i));
  const rows = view.byDay.get(sel) ?? [];
  const multiCoach = board.manage && !coachId && board.coaches.length > 1;
  const coachName = (id: string) => board.coaches.find((c) => c.id === id)?.name ?? null;
  const todayCount = view.countByDay.get(today) ?? 0;
  const weekCount = days.slice(0, 7).reduce((s, d) => s + (view.countByDay.get(d) ?? 0), 0);
  const noNext = members.filter((m) => m.noNext).length;
  const slotCoach = coach ?? (board.coaches.length === 1 ? board.coaches[0].id : null);
  const slotLine = slotCoach ? slotSummary(slotsOfCoach(board.slots, slotCoach)) : "코치마다 정해요";
  const s = board.settings;
  const pending = morePending ? view.pending : view.pending.slice(0, 3);
  const pendingCount = view.pending.reduce((sum, r) => sum + r.bookings.filter((b) => b.status === "booked").length, 0);

  const openAdd = (preset: PtAddPreset = {}) => {
    setAdd({ date: sel, ...preset });
    setAddOpen(true);
  };

  /** 결과 필요 줄의 [수업함] — 그 줄의 남은 예약을 모두 수업으로 */
  const quickLesson = async (row: PtBoardRow) => {
    if (quick) return;
    const ids = row.bookings.filter((b) => b.status === "booked").map((b) => b.id);
    setQuick(row.key);
    try {
      for (const id of ids) await actions.close.mutateAsync({ id, kind: "lesson" });
      toast.success(ids.length > 1 ? `${ids.length}명 수업함으로 기록했어요` : "수업함으로 기록했어요");
    } catch (e) {
      toast.error(errText(e, "기록하지 못했어요"));
    } finally {
      setQuick(null);
    }
  };

  return (
    <section ref={rootRef} className={cn(card, "scroll-mt-20")} aria-label="PT 예약">
      {/* 머리 — 오늘 · 이번 주 건수 + 예약 넣기 */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-heading font-black text-foreground">PT 예약</h2>
          <p className="truncate text-label text-muted-foreground">
            오늘 {todayCount}건 · 7일 동안 {weekCount}건
          </p>
        </div>
        <button
          type="button"
          onClick={() => openAdd()}
          className="flex h-11 shrink-0 items-center gap-1 rounded-full bg-primary px-4 text-body font-black text-primary-foreground transition-transform active:scale-95"
        >
          <Plus className="h-4 w-4" aria-hidden />
          예약 넣기
        </button>
      </div>

      {multiCoach && (
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
          <OpsChip on={filter === null} onClick={() => setFilter(null)}>
            전체
          </OpsChip>
          {board.coaches.map((c) => (
            <OpsChip key={c.id} on={filter === c.id} onClick={() => setFilter(c.id)}>
              {c.name}
            </OpsChip>
          ))}
        </div>
      )}

      {/* 결과가 필요한 지난 예약 — 오래된 것부터 */}
      {view.pending.length > 0 && (
        <div className="mt-4 rounded-2xl bg-secondary/70 p-3">
          <p className="px-1 text-label font-bold text-foreground">
            수업했나요? <span className="tabular-nums text-primary">{pendingCount}</span>
          </p>
          <ul className="mt-2 space-y-2">
            {pending.map((row) => {
              const left = row.bookings.filter((b) => b.status === "booked");
              const entered = left.some((b) => enteredOn(board, b.member_user_id, row.day));
              return (
                <li key={row.key} className="rounded-xl bg-card p-3">
                  <p className="truncate text-body font-black text-foreground">{left.map((b) => b.member_name).join(" · ")}</p>
                  <p className="truncate text-label text-muted-foreground">
                    {dayWord(row.day, today)} {minuteClock(kstMinutes(row.start_at))}
                    {entered ? " · 입장함" : ""}
                    {multiCoach && !coach && coachName(row.coach_staff_id) ? ` · ${coachName(row.coach_staff_id)} 코치` : ""}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void quickLesson(row)}
                      disabled={quick !== null}
                      className="h-11 rounded-xl bg-primary text-body font-black text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
                    >
                      {quick === row.key ? "기록 중…" : "수업함"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailKey(row.key)}
                      disabled={quick !== null}
                      className="h-11 rounded-xl border border-border bg-background text-body font-bold text-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
                    >
                      다른 결과
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {view.pending.length > 3 && (
            <button type="button" onClick={() => setMorePending((v) => !v)} className="mt-2 h-10 w-full text-label font-bold text-foreground">
              {morePending ? "접기" : `${view.pending.length - 3}건 더 보기`}
            </button>
          )}
        </div>
      )}

      {/* 날짜 줄 — 오늘부터 3주 */}
      <div className="-mx-5 mt-4 flex gap-1.5 overflow-x-auto px-5 pb-1" role="tablist" aria-label="날짜">
        {days.map((d, i) => {
          const on = d === sel;
          const count = view.countByDay.get(d) ?? 0;
          const dd = Number(d.slice(8, 10));
          const wd = weekdayOf(d);
          const top = i === 0 ? "오늘" : dd === 1 ? `${Number(d.slice(5, 7))}월` : PT_WEEKDAY[wd];
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={on}
              aria-label={`${dateLabel(d)} ${count}건`}
              onClick={() => setDay(d)}
              className={cn(
                "flex w-[3.25rem] shrink-0 flex-col items-center rounded-2xl border py-2 transition-transform active:scale-95",
                on ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground",
              )}
            >
              <span className={cn("text-micro font-bold", on ? "text-background/75" : wd === 0 ? "text-destructive" : "text-muted-foreground")}>{top}</span>
              <span className="text-body font-black tabular-nums leading-tight">{dd}</span>
              <span className={cn("text-micro font-black tabular-nums", count === 0 ? "opacity-0" : on ? "text-background" : "text-primary")}>
                {count || 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* 그날 수업 */}
      <p className="mt-4 text-body font-black text-foreground">
        {dateLabel(sel)}
        {rows.length > 0 && <span className="font-bold text-muted-foreground"> · {view.countByDay.get(sel) ?? 0}건</span>}
      </p>
      {rows.length === 0 ? (
        <button
          type="button"
          onClick={() => openAdd()}
          className="mt-2 flex h-14 w-full items-center justify-center gap-1 rounded-xl border border-dashed border-border text-body font-bold text-muted-foreground active:scale-[0.99]"
        >
          <Plus className="h-4 w-4" aria-hidden />이 날 예약 넣기
        </button>
      ) : (
        <ul className="mt-1 divide-y divide-border">
          {rows.map((row) => {
            const pill = rowPill(row, now);
            const sub = rowSub(row, board, multiCoach && !coach ? coachName(row.coach_staff_id) : null);
            return (
              <li key={row.key}>
                <button type="button" onClick={() => setDetailKey(row.key)} className="flex w-full items-center gap-3 py-3 text-left active:bg-secondary/60">
                  <span className="w-12 shrink-0 text-body font-black tabular-nums text-foreground">{minuteClock(kstMinutes(row.start_at))}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-bold text-foreground">{rowNames(row)}</span>
                    {sub && <span className="block truncate text-label text-muted-foreground">{sub}</span>}
                  </span>
                  {pill ? <span className={pillCls(pill.tone)}>{pill.label}</span> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* 아래 — 회원 · 예약 가능 시간 · 설정 */}
      <div className="-mx-5 -mb-5 mt-4 divide-y divide-border border-t border-border">
        <button type="button" onClick={() => setMembersOpen(true)} className="flex h-14 w-full items-center gap-2 px-5 text-left active:bg-secondary/60">
          <span className="flex-1 truncate text-body font-bold text-foreground">PT 회원 {members.length}명</span>
          {noNext > 0 && <span className="shrink-0 rounded-full bg-orange-100 px-2.5 py-1 text-micro font-bold text-orange-700">예약 없음 {noNext}</span>}
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
        <button type="button" onClick={() => setSlotsOpen(true)} className="flex h-14 w-full items-center gap-2 px-5 text-left active:bg-secondary/60">
          <span className="shrink-0 text-body font-bold text-foreground">예약 가능 시간</span>
          <span className="min-w-0 flex-1 truncate text-right text-label text-muted-foreground">{slotLine}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
        {board.can_set && (
          <button type="button" onClick={() => setSettingsOpen(true)} className="flex h-14 w-full items-center gap-2 px-5 text-left active:bg-secondary/60">
            <span className="shrink-0 text-body font-bold text-foreground">설정</span>
            <span className="min-w-0 flex-1 truncate text-right text-label text-muted-foreground">
              {s?.mileage_on ? `수업 1회 ${n(s.lesson_mileage)}점 적립` : "수업 적립 꺼짐"}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        )}
      </div>

      <PtAddSheet open={addOpen} onClose={() => setAddOpen(false)} board={board} coach={coach} actions={actions} preset={add} />
      <PtDetailSheet
        row={detailRow}
        onClose={() => setDetailKey(null)}
        board={board}
        actions={actions}
        now={now}
        onAddToTeam={(row) => {
          setDetailKey(null);
          setAdd({ date: row.day, minute: kstMinutes(row.start_at), join: true, coach: row.coach_staff_id });
          setAddOpen(true);
        }}
      />
      <PtSlotsSheet open={slotsOpen} onClose={() => setSlotsOpen(false)} board={board} coach={coach} actions={actions} />
      <PtMembersSheet
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        rows={members}
        today={today}
        onBook={(id) => {
          setMembersOpen(false);
          openAdd({ members: [id] });
        }}
      />
      <PtSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} board={board} actions={actions} />
    </section>
  );
};

/** 예시(?demo=1) — 코치 · 관리자 화면을 바꿔 가며 눌러 본다(지어낸 회원 · 서버를 부르지 않는다) */
export const OpsPtBookDemo = () => {
  const [manage, setManage] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <span className="mr-1 text-label font-bold text-muted-foreground">PT 예약 예시</span>
        <OpsChip on={!manage} onClick={() => setManage(false)}>
          코치 화면
        </OpsChip>
        <OpsChip on={manage} onClick={() => setManage(true)}>
          관리자 화면
        </OpsChip>
      </div>
      <OpsPtBook key={manage ? "m" : "c"} branch="153복싱짐 예시점" demo demoManage={manage} />
    </div>
  );
};

export default OpsPtBook;
