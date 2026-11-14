/**
 * 153운영본부 · PT 예약 — 창 다섯 개 (2026-11-14 · OpsPtBook 이 연다)
 *   · PtAddSheet      예약 넣기: 회원(여러 명 = 팀 PT) → 날짜 → 시간 → 이번만 / 매주 n번. 남은 횟수를 넘는 건은 한 번 더 묻고 넣는다
 *   · PtDetailSheet   예약 한 줄: 시간 바꾸기 · 수업함 · 미참석 · 당일 취소 · 예약 취소 · 코치 사정 (lib/ptBooking closeOptions — 서버와 같은 판정)
 *   · PtSlotsSheet    예약 가능 시간(매주): 열어 둔 시간 안에서 회원이 직접 예약한다
 *   · PtMembersSheet  PT 회원: 남은 횟수 · 다음 수업 · 예약 없는 회원 먼저 → 누르면 그 회원으로 예약 넣기
 *   · PtSettingsSheet 켜기 · 끄기 · 수업 적립 금액(대표님만)
 *   금액(수당)은 여기 없다. 회원 실명은 서버 값 그대로(이름표를 먼저).
 */
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import {
  BOOKING_STATUS_META,
  PT_MAX_TEAM,
  PT_WEEKDAY,
  PT_WEEK_CHOICES,
  SLOT_WEEK_ORDER,
  TIME_CHOICES,
  addDays,
  bookDraftError,
  bookPayload,
  busyMinutes,
  closeOptions,
  dateLabel,
  dayWord,
  enteredOn,
  isLiveStatus,
  kstDateOfIso,
  kstIso,
  kstMinutes,
  memberLabel,
  minuteClock,
  saveSummary,
  slotsError,
  slotsOfCoach,
  slotsPayload,
  weekdayOf,
  weeksLabel,
  type PtBoard,
  type PtBoardRow,
  type PtBookDraft,
  type PtCloseKind,
  type PtMemberRow,
  type PtSaveResult,
  type SlotRange,
} from "@/lib/ptBooking";
import type { usePtBoardActions } from "@/services/ptBookingService";
import { cn } from "@/lib/utils";
import { OpsButton, OpsChip, OpsLabel, OpsSheet, opsInput } from "./OpsParts";

type Actions = ReturnType<typeof usePtBoardActions>;
const errText = (e: unknown, fb: string) => (e instanceof Error && e.message ? e.message : fb);
const n = (v: number) => v.toLocaleString("ko-KR");
const NO_MINUTES: Set<number> = new Set();
/** 코치 화면의 시각은 24시간으로(예약판 줄과 같게) — "19:00" */
const clock = (iso: string) => minuteClock(kstMinutes(iso));
const ARMED_LABEL: Partial<Record<PtCloseKind, string>> = {
  noshow: "한 번 더 누르면 미참석으로 기록해요",
  late_cancel: "한 번 더 누르면 당일 취소로 기록해요",
};

type PartKey = "am" | "pm" | "eve";
const PARTS: { key: PartKey; label: string; from: number; to: number }[] = [
  { key: "am", label: "오전", from: 6 * 60, to: 12 * 60 },
  { key: "pm", label: "오후", from: 12 * 60, to: 18 * 60 },
  { key: "eve", label: "저녁", from: 18 * 60, to: 24 * 60 },
];
const partOf = (m: number): PartKey => (m < 12 * 60 ? "am" : m < 18 * 60 ? "pm" : "eve");

/**
 * 시간 고르기 — 오전 · 오후 · 저녁 한 칸씩(30분마다). 지난 시각은 그리지 않는다.
 *   busy = 그 코치의 다른 예약과 겹침(흐리게) · sameStart = 같은 시각 예약이 있음(점 — 팀으로 묶을 수 있다)
 */
const TimeGrid = ({
  value,
  onChange,
  busy,
  sameStart,
  minMinute,
  prefer,
}: {
  value: number | null;
  onChange: (m: number) => void;
  busy: Set<number>;
  sameStart: Set<number>;
  /** 오늘이면 지금 시각 앞은 못 고른다 */
  minMinute: number;
  /** 처음 펼칠 칸을 정하는 시각(이 코치가 자주 잡는 시각) */
  prefer: number;
}) => {
  const openOf = (key: PartKey) => {
    const part = PARTS.find((x) => x.key === key) ?? PARTS[2];
    return TIME_CHOICES.filter((m) => m >= part.from && m < part.to && m >= minMinute);
  };
  const firstOpen = PARTS.find((x) => openOf(x.key).length > 0)?.key ?? null;
  const [part, setPart] = useState<PartKey>(() => {
    const want = partOf(value ?? prefer);
    return openOf(want).length > 0 ? want : (firstOpen ?? want);
  });
  // 밖에서 시각이 정해지면(팀 회원 추가 · 창을 다시 열 때) 그 시각이 든 칸으로
  useEffect(() => {
    if (value != null) setPart(partOf(value));
  }, [value]);
  // 날짜를 오늘로 바꿔 보던 칸이 비면 열려 있는 첫 칸으로
  const list = openOf(part);
  useEffect(() => {
    if (list.length === 0 && firstOpen && firstOpen !== part) setPart(firstOpen);
  }, [list.length, firstOpen, part]);

  if (!firstOpen) return <p className="rounded-xl bg-muted/60 px-4 py-3 text-label text-muted-foreground">이 날은 남은 시간이 없어요 — 다른 날짜를 골라 주세요</p>;
  return (
    <div>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1" role="tablist" aria-label="시간대">
        {PARTS.map((x) => {
          const on = x.key === part;
          const none = openOf(x.key).length === 0;
          return (
            <button
              key={x.key}
              type="button"
              role="tab"
              aria-selected={on}
              disabled={none}
              onClick={() => setPart(x.key)}
              className={cn(
                "h-10 rounded-lg text-body font-bold transition-colors disabled:opacity-40",
                on ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground",
              )}
            >
              {x.label}
            </button>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {list.map((m) => {
          const on = value === m;
          const taken = busy.has(m) && !sameStart.has(m);
          return (
            <button
              key={m}
              type="button"
              aria-pressed={on}
              disabled={taken}
              onClick={() => onChange(m)}
              className={cn(
                "relative h-11 rounded-xl border text-body font-bold tabular-nums transition-transform active:scale-95",
                on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground",
                taken && "opacity-35",
              )}
            >
              {minuteClock(m)}
              {sameStart.has(m) && !on && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" aria-label="같은 시간 예약 있음" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/** 날짜 고르기 — 오늘부터 2주 줄 + 달력(그 뒤 날짜) */
const DateStrip = ({ value, onChange, today, inCard }: { value: string; onChange: (d: string) => void; today: string; /** 카드(p-4) 안에 넣을 때 */ inCard?: boolean }) => {
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const extra = value && !days.includes(value) ? value : null;
  const chip = (d: string, top: string) => {
    const on = d === value;
    const wd = weekdayOf(d);
    return (
      <button
        key={d}
        type="button"
        aria-pressed={on}
        aria-label={dateLabel(d)}
        onClick={() => onChange(d)}
        className={cn(
          "flex w-[3.25rem] shrink-0 flex-col items-center rounded-2xl border py-2 transition-transform active:scale-95",
          on ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground",
        )}
      >
        <span className={cn("text-micro font-bold", on ? "text-background/75" : wd === 0 ? "text-destructive" : "text-muted-foreground")}>{top}</span>
        <span className="text-body font-black tabular-nums leading-tight">{Number(d.slice(8, 10))}</span>
      </button>
    );
  };
  return (
    <div className={cn("flex gap-1.5 overflow-x-auto pb-1", inCard ? "-mx-4 px-4" : "-mx-5 px-5")}>
      {extra && chip(extra, `${Number(extra.slice(5, 7))}월`)}
      {days.map((d, i) => chip(d, i === 0 ? "오늘" : Number(d.slice(8, 10)) === 1 ? `${Number(d.slice(5, 7))}월` : PT_WEEKDAY[weekdayOf(d)]))}
      <label className="relative flex w-[3.25rem] shrink-0 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border text-muted-foreground">
        <CalendarDays className="h-5 w-5" aria-hidden />
        <span className="text-micro font-bold">달력</span>
        <input
          type="date"
          aria-label="다른 날짜 고르기"
          value={value}
          min={today}
          max={addDays(today, 120)}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
};

/** 이 코치가 가장 자주 잡는 시작 시각(없으면 저녁 7시) — 시간 고르기를 그 칸부터 펼친다 */
function usualMinute(board: PtBoard, coach: string | null): number {
  const count = new Map<number, number>();
  for (const b of board.bookings) {
    if (coach && b.coach_staff_id !== coach) continue;
    const m = kstMinutes(b.start_at);
    count.set(m, (count.get(m) ?? 0) + 1);
  }
  let best = 19 * 60;
  let top = 0;
  for (const [m, c] of count) if (c > top) [best, top] = [m, c];
  return best;
}

// ───────────────────────── 예약 넣기 ─────────────────────────
export interface PtAddPreset {
  members?: string[];
  date?: string;
  minute?: number | null;
  /** 같은 시간 예약과 팀으로 묶기(상세 창의 「팀 회원 추가」) */
  join?: boolean;
  /** 그 줄의 담당 코치(관리자가 전체를 보다가 팀 회원을 더할 때) */
  coach?: string | null;
}

export const PtAddSheet = ({
  open,
  onClose,
  board,
  coach,
  actions,
  preset,
}: {
  open: boolean;
  onClose: () => void;
  board: PtBoard;
  /** 이 코치로 넣는다(코치 화면 · 근무자 카드) — null 이면 관리자가 고른다 */
  coach: string | null;
  actions: Actions;
  preset: PtAddPreset | null;
}) => {
  const slotMin = board.settings?.slot_minutes ?? 50;
  const blank = (): PtBookDraft => ({
    members: preset?.members ?? [],
    date: preset?.date ?? board.today,
    minute: preset?.minute ?? null,
    weeks: 1,
    coach: coach ?? preset?.coach ?? (board.coaches.length === 1 ? board.coaches[0].id : null),
  });
  const [d, setD] = useState<PtBookDraft>(blank);
  const [limit, setLimit] = useState<PtSaveResult | null>(null);
  const [forcing, setForcing] = useState(false);
  const [find, setFind] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    setD(blank());
    setLimit(null);
    setForcing(false);
    setFind("");
    setNow(Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const members = useMemo(
    () => [...board.members].filter((m) => m.ticket != null).sort((a, b) => memberLabel(a).localeCompare(memberLabel(b), "ko")),
    [board.members],
  );
  const busy = useMemo(() => busyMinutes(board, d.coach, d.date, slotMin), [board, d.coach, d.date, slotMin]);
  const sameStart = useMemo(() => {
    const s = new Set<number>();
    for (const b of board.bookings) {
      if (b.status === "booked" && b.day === d.date && (!d.coach || b.coach_staff_id === d.coach)) s.add(kstMinutes(b.start_at));
    }
    return s;
  }, [board.bookings, d.coach, d.date]);
  const prefer = useMemo(() => usualMinute(board, d.coach), [board, d.coach]);
  const joining = d.minute != null && sameStart.has(d.minute);
  const minMinute = d.date === board.today ? kstMinutes(new Date(now - 10 * 60_000).toISOString()) : 0;
  const err = bookDraftError(d, board, now);
  const names = d.members.map((id) => memberLabel(members.find((m) => m.user_id === id) ?? { name: "회원", label: null }));
  const busyNow = actions.save.isPending || forcing;
  // 남은 횟수를 넘어 건너뛴 줄(이름 · 날짜) — 한 번 더 묻는 화면
  const overRows = (limit?.skipped ?? [])
    .filter((x) => x.reason === "limit" && x.member && x.day)
    .map((x) => ({ day: x.day, member: x.member as string, name: memberLabel(board.members.find((m) => m.user_id === x.member) ?? { name: "회원", label: null }) }))
    .sort((x, y) => x.day.localeCompare(y.day) || x.name.localeCompare(y.name, "ko"));
  // 고른 회원 중 그날 이미 예약(또는 차감된 결과)이 있는 회원 — 그날은 서버가 건너뛴다
  const takenNames = d.members
    .filter((id) => board.bookings.some((b) => b.member_user_id === id && b.day === d.date && isLiveStatus(b.status)))
    .map((id) => memberLabel(board.members.find((m) => m.user_id === id) ?? { name: "회원", label: null }));
  // 회원이 많으면(12명 넘게) 찾기 칸 — 고른 회원은 늘 보인다
  const key = find.trim();
  const shown = key ? members.filter((m) => d.members.includes(m.user_id) || `${memberLabel(m)} ${m.name} ${m.tail}`.includes(key)) : members;

  const toggle = (id: string) =>
    setD((x) => ({ ...x, members: x.members.includes(id) ? x.members.filter((v) => v !== id) : x.members.length < PT_MAX_TEAM ? [...x.members, id] : x.members }));

  const submit = () => {
    if (err || busyNow) return;
    actions.save.mutate(bookPayload(d, board.branch, { join: joining || !!preset?.join }), {
      onSuccess: (r) => {
        const s = saveSummary(r);
        if (r.made > 0) toast.success(s.text);
        if (s.limit > 0) {
          setLimit(r); // 남은 횟수를 넘는 건만 따로 묻는다
          return;
        }
        if (r.made === 0) toast.error(s.text);
        onClose();
      },
      onError: (e: unknown) => toast.error(errText(e, "예약을 넣지 못했어요")),
    });
  };
  /** 남은 횟수를 넘어 건너뛴 건만 다시 — 날짜마다 한 번씩(같은 시간에 이미 들어간 팀원이 있으면 그 팀에 묶는다) */
  const submitOver = async () => {
    if (!limit || busyNow || d.minute == null) return;
    const byDay = new Map<string, string[]>();
    for (const x of limit.skipped) {
      if (x.reason !== "limit" || !x.member || !x.day) continue;
      byDay.set(x.day, [...(byDay.get(x.day) ?? []), x.member]);
    }
    setForcing(true);
    let made = 0;
    try {
      for (const [day, members] of [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        const r = await actions.save.mutateAsync({
          branch: board.branch,
          ...(d.coach ? { coach_staff_id: d.coach } : {}),
          members,
          start_at: kstIso(day, d.minute),
          weeks: 1,
          force: true,
          join: true,
        });
        made += r.made;
      }
      if (made > 0) toast.success(`${made}건 더 넣었어요`);
      else toast.error("더 넣은 예약이 없어요");
      onClose();
    } catch (e) {
      toast.error(errText(e, made > 0 ? `${made}건만 넣었어요 — 나머지는 다시 시도해 주세요` : "예약을 넣지 못했어요"));
      if (made > 0) onClose();
    } finally {
      setForcing(false);
    }
  };

  return (
    <OpsSheet
      open={open}
      onClose={onClose}
      title={limit ? "남은 횟수를 넘어요" : "PT 예약 넣기"}
      sub={limit ? "나머지도 넣을지 골라 주세요" : "넣는 즉시 회원 앱에 보여요"}
      stacked
      footer={
        limit ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <OpsButton tone="plain" onClick={onClose} disabled={forcing}>
                여기까지만
              </OpsButton>
              <OpsButton tone="dark" onClick={() => void submitOver()} disabled={busyNow}>
                {busyNow ? "넣는 중…" : "그대로 넣기"}
              </OpsButton>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {err ? (
              <p className="text-label text-muted-foreground">{err}</p>
            ) : (
              <p className="truncate text-label font-bold text-foreground">
                {names.join(" · ")} · {dayWord(d.date, board.today)} {minuteClock(d.minute ?? 0)}
                {d.weeks > 1 ? ` · ${weeksLabel(d.weeks)}` : ""}
              </p>
            )}
            <OpsButton onClick={submit} disabled={!!err || busyNow}>
              {busyNow ? "넣는 중…" : joining ? "같은 시간에 팀으로 넣기" : "예약 넣기"}
            </OpsButton>
          </div>
        )
      }
    >
      {limit ? (
        <div>
          {limit.made > 0 && (
            <p className="flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-3 text-body font-black text-foreground">
              <Check className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              {limit.made}건 넣었어요
            </p>
          )}
          <p className="mb-1.5 mt-4 text-label font-bold text-muted-foreground">남은 횟수를 넘는 예약 {overRows.length}건</p>
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {overRows.map((x) => (
              <li key={`${x.day}:${x.member}`} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="truncate text-body font-bold text-foreground">{x.name}</span>
                <span className="shrink-0 text-label tabular-nums text-muted-foreground">
                  {dateLabel(x.day)} {minuteClock(d.minute ?? 0)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-label text-muted-foreground">남은 횟수는 브로제이 기준이에요 · 재등록 예정이면 그대로 넣어도 돼요</p>
        </div>
      ) : (
        <>
          <OpsLabel>회원 {d.members.length > 1 ? `· 팀 PT ${d.members.length}명` : ""}</OpsLabel>
          {members.length > 12 && (
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                value={find}
                onChange={(e) => setFind(e.target.value)}
                placeholder="이름 · 전화 끝 4자리"
                aria-label="회원 찾기"
                className={cn(opsInput, "pl-9")}
              />
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {shown.map((m) => {
              const on = d.members.includes(m.user_id);
              return (
                <button
                  key={m.user_id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(m.user_id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-2 text-body font-bold transition-transform active:scale-95",
                    on ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground",
                  )}
                >
                  {on && <Check className="h-4 w-4" aria-hidden />}
                  {memberLabel(m)}
                  {m.remaining != null && <span className={cn("text-label font-bold tabular-nums", on ? "text-background/70" : "text-muted-foreground")}>{m.remaining}</span>}
                </button>
              );
            })}
            {members.length === 0 && <p className="text-body text-muted-foreground">PT 수업권이 있는 회원이 없어요</p>}
            {members.length > 0 && shown.length === 0 && <p className="text-body text-muted-foreground">찾는 회원이 없어요</p>}
          </div>
          <p className="mt-1.5 text-label text-muted-foreground">숫자 = 남은 횟수 · 여러 명을 고르면 팀 PT</p>
          {takenNames.length > 0 && (
            <p className="mt-1 text-label font-bold text-orange-700">
              {takenNames.join(" · ")} 님은 {dayWord(d.date, board.today)} 예약이 이미 있어요 — 그날은 건너뛰어요
            </p>
          )}

          {board.manage && !coach && board.coaches.length > 1 && (
            <>
              <OpsLabel>담당 코치</OpsLabel>
              <div className="flex flex-wrap gap-1.5">
                {board.coaches.map((c) => (
                  <OpsChip key={c.id} on={d.coach === c.id} onClick={() => setD((x) => ({ ...x, coach: c.id, minute: null }))}>
                    {c.name}
                  </OpsChip>
                ))}
              </div>
            </>
          )}

          <OpsLabel>날짜 · {dateLabel(d.date)}</OpsLabel>
          <DateStrip value={d.date} today={board.today} onChange={(date) => setD((x) => ({ ...x, date, minute: null }))} />

          <OpsLabel>시간 · {slotMin}분 수업</OpsLabel>
          <TimeGrid
            key={`${d.coach ?? ""}:${open ? 1 : 0}`}
            value={d.minute}
            onChange={(minute) => setD((x) => ({ ...x, minute }))}
            busy={busy}
            sameStart={sameStart}
            minMinute={minMinute}
            prefer={prefer}
          />
          {joining && <p className="mt-2 rounded-xl bg-primary/5 px-3 py-2 text-label font-bold text-foreground">그 시간에 예약이 있어요 — 같은 수업(팀 PT)으로 묶어서 넣어요</p>}

          <OpsLabel>반복</OpsLabel>
          <div className="flex flex-wrap gap-1.5">
            {PT_WEEK_CHOICES.map((w) => (
              <OpsChip key={w} on={d.weeks === w} onClick={() => setD((x) => ({ ...x, weeks: w }))}>
                {weeksLabel(w)}
              </OpsChip>
            ))}
          </div>
          {d.weeks > 1 && <p className="mt-1.5 text-label text-muted-foreground">같은 요일 · 같은 시각으로 {d.weeks}주 · 남은 횟수까지만 들어가요</p>}
        </>
      )}
    </OpsSheet>
  );
};

// ───────────────────────── 예약 한 줄 ─────────────────────────
export const PtDetailSheet = ({
  row,
  onClose,
  board,
  actions,
  now,
  onAddToTeam,
}: {
  row: PtBoardRow | null;
  onClose: () => void;
  board: PtBoard;
  actions: Actions;
  now: number;
  onAddToTeam: (row: PtBoardRow) => void;
}) => {
  const [target, setTarget] = useState<string | null>(null);
  const [armed, setArmed] = useState<PtCloseKind | null>(null);
  const [note, setNote] = useState("");
  const [moving, setMoving] = useState(false);
  const [mDate, setMDate] = useState("");
  const [mMin, setMMin] = useState<number | null>(null);
  const key = row?.key ?? null;
  useEffect(() => {
    setTarget(null);
    setArmed(null);
    setNote("");
    setMoving(false);
    setMDate(row?.day ?? "");
    setMMin(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const slotMin = board.settings?.slot_minutes ?? 50;
  const open = row?.bookings.filter((b) => b.status === "booked") ?? [];
  const cur = open.find((b) => b.id === target) ?? open[0] ?? null;
  const options = cur ? closeOptions(cur, board.today, now) : [];
  const busy = useMemo(() => {
    if (!row || !mDate) return new Set<number>();
    const out = busyMinutes(board, row.coach_staff_id, mDate, slotMin, row.bookings.map((b) => b.id));
    if (mDate === row.day) out.add(kstMinutes(row.start_at)); // 지금 시간으로는 못 바꾼다
    return out;
  }, [board, row, mDate, slotMin]);
  const pending = actions.close.isPending || actions.save.isPending;
  // 팀 회원 추가 — 아직 시작 전이고 자리가 남았을 때만
  const canAddTeam = !!row && Date.parse(row.start_at) > now && open.length < PT_MAX_TEAM;

  const doClose = (kind: PtCloseKind, danger: boolean) => {
    if (!cur || pending) return;
    if (danger && armed !== kind) {
      setArmed(kind);
      return;
    }
    actions.close.mutate(
      { id: cur.id, kind, note: note.trim() || null },
      {
        onSuccess: () => {
          toast.success(kind === "lesson" ? "수업함으로 기록했어요" : kind === "noshow" ? "미참석으로 기록했어요" : kind === "late_cancel" ? "당일 취소로 기록했어요" : "취소했어요");
          if (open.length <= 1) onClose();
          else {
            setTarget(null);
            setArmed(null);
            setNote("");
          }
        },
        onError: (e: unknown) => toast.error(errText(e, "처리하지 못했어요")),
      },
    );
  };
  const doMove = () => {
    if (!cur || mMin == null || !mDate || pending) return;
    actions.save.mutate(
      { id: cur.id, start_at: kstIso(mDate, mMin) },
      {
        onSuccess: () => {
          toast.success(`시간을 바꿨어요 · ${dateLabel(mDate)} ${minuteClock(mMin)}`);
          onClose();
        },
        onError: (e: unknown) => toast.error(errText(e, "시간을 바꾸지 못했어요")),
      },
    );
  };

  return (
    <OpsSheet
      open={!!row}
      onClose={onClose}
      title={row ? `${clock(row.start_at)} ~ ${clock(row.end_at)}` : ""}
      sub={row ? `${dateLabel(row.day)} · ${board.coaches.find((c) => c.id === row.coach_staff_id)?.name ?? "코치"} 코치` : undefined}
      stacked
    >
      {row && (
        <>
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {row.bookings.map((b) => {
              const m = board.members.find((x) => x.user_id === b.member_user_id);
              const meta = BOOKING_STATUS_META[b.status];
              const pick = open.length > 1 && b.status === "booked";
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    disabled={!pick}
                    onClick={() => {
                      setTarget(b.id);
                      setArmed(null);
                    }}
                    aria-pressed={pick ? cur?.id === b.id : undefined}
                    className={cn("flex w-full items-center gap-3 px-4 py-3 text-left", pick && cur?.id === b.id && "bg-primary/5")}
                  >
                    {pick && (
                      <span
                        aria-hidden
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                          cur?.id === b.id ? "border-primary bg-primary text-primary-foreground" : "border-border",
                        )}
                      >
                        {cur?.id === b.id && <Check className="h-3 w-3" />}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-black text-foreground">{b.member_name}</p>
                      <p className="truncate text-label text-muted-foreground">
                        {m?.remaining != null ? `남은 ${m.remaining}회` : "남은 횟수 모름"}
                        {b.made_by === "member" ? " · 회원이 앱에서 예약" : ""}
                        {enteredOn(board, b.member_user_id, b.day) ? " · 입장함" : ""}
                        {b.close_note ? ` · ${b.close_note}` : ""}
                      </p>
                    </div>
                    {b.status !== "booked" && (
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-1 text-micro font-bold",
                          meta.tone === "live" && "bg-secondary text-foreground",
                          meta.tone === "good" && "bg-primary/10 text-primary",
                          meta.tone === "warn" && "bg-orange-100 text-orange-700",
                          meta.tone === "plain" && "bg-muted text-muted-foreground",
                        )}
                      >
                        {meta.label}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {open.length > 1 && <p className="mt-1.5 text-label text-muted-foreground">팀 수업 — 한 명씩 골라서 처리해요 · 시간을 바꾸면 팀이 함께 옮겨져요</p>}

          {cur ? (
            <>
              {/* 시간 바꾸기 */}
              {moving ? (
                <div className="mt-4 rounded-2xl border border-border p-4">
                  <p className="text-body font-black text-foreground">언제로 바꿀까요?</p>
                  <p className="mt-1 text-label text-muted-foreground">{mDate ? dateLabel(mDate) : ""}</p>
                  <div className="mt-2">
                    <DateStrip
                      inCard
                      value={mDate}
                      today={board.today}
                      onChange={(v) => {
                        setMDate(v);
                        setMMin(null);
                      }}
                    />
                  </div>
                  <div className="mt-3">
                    <TimeGrid
                      value={mMin}
                      onChange={setMMin}
                      busy={busy}
                      sameStart={NO_MINUTES}
                      minMinute={mDate === board.today ? kstMinutes(new Date(now - 10 * 60_000).toISOString()) : 0}
                      prefer={kstMinutes(row.start_at)}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <OpsButton tone="plain" onClick={() => setMoving(false)}>
                      그대로 두기
                    </OpsButton>
                    <OpsButton onClick={doMove} disabled={mMin == null || pending}>
                      {actions.save.isPending ? "바꾸는 중…" : "이 시간으로"}
                    </OpsButton>
                  </div>
                  <p className="mt-2 text-label text-muted-foreground">회원에게 바뀐 시간이 알림으로 가요</p>
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {open.length > 1 && <p className="text-label font-bold text-muted-foreground">{cur.member_name} 님</p>}
                  {options.map((o) => {
                    const danger = o.tone === "danger";
                    const arm = armed === o.kind;
                    return (
                      <button
                        key={o.kind}
                        type="button"
                        onClick={() => doClose(o.kind, danger)}
                        disabled={pending}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-transform active:scale-[0.99] disabled:opacity-60",
                          o.tone === "primary" && "border-primary bg-primary text-primary-foreground",
                          o.tone === "plain" && "border-border bg-background text-foreground",
                          danger && (arm ? "border-orange-700 bg-orange-700 text-white" : "border-orange-300 bg-background text-orange-700"),
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block text-body font-black">{arm ? (ARMED_LABEL[o.kind] ?? o.label) : o.label}</span>
                          <span className={cn("block text-label", o.tone === "primary" ? "text-primary-foreground/80" : arm ? "text-white/85" : "text-muted-foreground")}>{o.note}</span>
                        </span>
                      </button>
                    );
                  })}
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={200}
                    placeholder="메모 (선택) — 예: 회원 출장"
                    aria-label="메모"
                    className={opsInput}
                  />
                  <div className={cn("grid gap-2 pt-1", canAddTeam ? "grid-cols-2" : "grid-cols-1")}>
                    <OpsButton tone="plain" onClick={() => setMoving(true)} disabled={pending}>
                      시간 바꾸기
                    </OpsButton>
                    {canAddTeam && (
                      <OpsButton tone="plain" onClick={() => onAddToTeam(row)} disabled={pending}>
                        <Plus className="h-4 w-4" aria-hidden />
                        팀 회원 추가
                      </OpsButton>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="mt-4 rounded-xl bg-muted/60 px-4 py-3 text-label text-muted-foreground">
              끝난 예약이에요 · 결과를 고치려면 아래 「오늘 PT」 · PT 기록에서 그 수업 기록을 고쳐 주세요
            </p>
          )}
        </>
      )}
    </OpsSheet>
  );
};

// ───────────────────────── 예약 가능 시간 ─────────────────────────
const SLOT_STARTS = Array.from({ length: 36 }, (_, i) => 6 * 60 + i * 30); // 06:00 ~ 23:30
const SLOT_ENDS = Array.from({ length: 36 }, (_, i) => 6 * 60 + 30 + i * 30); // 06:30 ~ 24:00
const clockOrEnd = (m: number) => (m === 1440 ? "24:00" : minuteClock(m));

export const PtSlotsSheet = ({
  open,
  onClose,
  board,
  coach,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  board: PtBoard;
  coach: string | null;
  actions: Actions;
}) => {
  const [who, setWho] = useState<string | null>(coach ?? board.coaches[0]?.id ?? null);
  const [week, setWeek] = useState<Map<number, SlotRange[]>>(new Map());
  useEffect(() => {
    if (!open) return;
    const w = coach ?? board.coaches[0]?.id ?? null;
    setWho(w);
    setWeek(w ? slotsOfCoach(board.slots, w) : new Map());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const pickCoach = (id: string) => {
    setWho(id);
    setWeek(slotsOfCoach(board.slots, id));
  };
  const set = (wd: number, ranges: SlotRange[]) =>
    setWeek((m) => {
      const next = new Map(m);
      if (ranges.length) next.set(wd, [...ranges].sort((a, b) => a.start_min - b.start_min || a.end_min - b.end_min));
      else next.delete(wd);
      return next;
    });
  const err = slotsError(week);
  const s = board.settings;

  const save = () => {
    if (!who || err || actions.slots.isPending) return;
    actions.slots.mutate(
      { coach: who, slots: slotsPayload(week) },
      {
        onSuccess: () => {
          toast.success(week.size ? "예약 가능 시간을 저장했어요" : "예약 가능 시간을 닫았어요");
          onClose();
        },
        onError: (e: unknown) => toast.error(errText(e, "저장하지 못했어요")),
      },
    );
  };

  return (
    <OpsSheet
      open={open}
      onClose={onClose}
      title="예약 가능 시간"
      sub="열어 둔 시간 안에서 회원이 직접 예약해요"
      stacked
      footer={
        <div className="space-y-2">
          {err && <p className="text-label font-bold text-destructive">{err}</p>}
          <OpsButton onClick={save} disabled={!who || !!err || actions.slots.isPending}>
            {actions.slots.isPending ? "저장하는 중…" : "저장"}
          </OpsButton>
        </div>
      }
    >
      {board.manage && !coach && board.coaches.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {board.coaches.map((c) => (
            <OpsChip key={c.id} on={who === c.id} onClick={() => pickCoach(c.id)}>
              {c.name}
            </OpsChip>
          ))}
        </div>
      )}
      <p className="rounded-xl bg-muted/60 px-4 py-3 text-label text-muted-foreground">
        수업 {s?.slot_minutes ?? 50}분 · 회원은 수업 {s?.min_lead_hours ?? 4}시간 전까지, {s?.ahead_days ?? 14}일 앞까지 잡을 수 있어요 · 비워 두면 코치가 넣은 예약만 있어요
      </p>
      {(week.get(1) ?? []).length > 0 && (
        <button
          type="button"
          onClick={() =>
            setWeek((m) => {
              const next = new Map(m);
              for (const wd of [2, 3, 4, 5]) next.set(wd, (m.get(1) ?? []).map((r) => ({ ...r })));
              return next;
            })
          }
          className="mt-2 h-10 rounded-full border border-border px-3 text-label font-bold text-foreground active:scale-95"
        >
          월요일 시간을 화~금에도 넣기
        </button>
      )}
      <ul className="mt-2 divide-y divide-border">
        {SLOT_WEEK_ORDER.map((wd) => {
          const ranges = week.get(wd) ?? [];
          const addRange = () => {
            const last = ranges[ranges.length - 1];
            const start = last ? Math.min(last.end_min + 60, 22 * 60) : 18 * 60;
            set(wd, [...ranges, { start_min: start, end_min: Math.min(start + 180, 1440) }]);
          };
          return (
            <li key={wd} className="flex items-start gap-3 py-2.5">
              <span className={cn("mt-2 w-5 shrink-0 text-body font-black", ranges.length ? "text-foreground" : "text-muted-foreground")}>{PT_WEEKDAY[wd]}</span>
              <div className="min-w-0 flex-1 space-y-2">
                {ranges.length === 0 && (
                  <button
                    type="button"
                    onClick={addRange}
                    className="flex h-10 items-center gap-1 rounded-full border border-dashed border-border px-3 text-label font-bold text-muted-foreground active:scale-95"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    열기
                  </button>
                )}
                {ranges.map((r, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <select
                      aria-label={`${PT_WEEKDAY[wd]}요일 시작`}
                      value={r.start_min}
                      onChange={(e) => set(wd, ranges.map((x, j) => (j === i ? { ...x, start_min: Number(e.target.value) } : x)))}
                      className={cn(opsInput, "h-10 min-w-0 flex-1 px-2 py-1.5 tabular-nums")}
                    >
                      {SLOT_STARTS.map((m) => (
                        <option key={m} value={m}>
                          {minuteClock(m)}
                        </option>
                      ))}
                    </select>
                    <span className="text-label text-muted-foreground">~</span>
                    <select
                      aria-label={`${PT_WEEKDAY[wd]}요일 끝`}
                      value={r.end_min}
                      onChange={(e) => set(wd, ranges.map((x, j) => (j === i ? { ...x, end_min: Number(e.target.value) } : x)))}
                      className={cn(opsInput, "h-10 min-w-0 flex-1 px-2 py-1.5 tabular-nums")}
                    >
                      {SLOT_ENDS.map((m) => (
                        <option key={m} value={m}>
                          {clockOrEnd(m)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      aria-label={`${PT_WEEKDAY[wd]}요일 ${minuteClock(r.start_min)} 시간대 빼기`}
                      onClick={() => set(wd, ranges.filter((_, j) => j !== i))}
                      className="flex h-10 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                    {i === ranges.length - 1 && ranges.length < 3 ? (
                      <button
                        type="button"
                        aria-label={`${PT_WEEKDAY[wd]}요일 시간대 추가`}
                        onClick={addRange}
                        className="flex h-10 w-9 shrink-0 items-center justify-center rounded-full text-foreground active:bg-muted"
                      >
                        <Plus className="h-4 w-4" aria-hidden />
                      </button>
                    ) : (
                      <span className="w-9 shrink-0" aria-hidden />
                    )}
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </OpsSheet>
  );
};

// ───────────────────────── PT 회원 ─────────────────────────
export const PtMembersSheet = ({
  open,
  onClose,
  rows,
  today,
  onBook,
}: {
  open: boolean;
  onClose: () => void;
  rows: PtMemberRow[];
  today: string;
  onBook: (memberId: string) => void;
}) => (
  <OpsSheet open={open} onClose={onClose} title={`PT 회원 ${rows.length}명`} sub="예약이 없는 회원 먼저 · 누르면 예약 넣기" stacked>
    {rows.length === 0 ? (
      <p className="py-6 text-center text-body text-muted-foreground">PT 수업권이 있는 회원이 없어요</p>
    ) : (
      <ul className="divide-y divide-border">
        {rows.map((m) => (
          <li key={m.user_id}>
            <button type="button" onClick={() => onBook(m.user_id)} className="flex w-full items-center gap-3 py-3 text-left active:bg-secondary/60">
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-black text-foreground">{memberLabel(m)}</p>
                <p className="truncate text-label text-muted-foreground">
                  {m.next ? `다음 ${dayWord(kstDateOfIso(m.next), today)} ${clock(m.next)}` : m.booked > 0 ? `예약 ${m.booked}건` : "잡힌 수업 없음"}
                  {m.ticket ? ` · ${m.ticket}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className={cn("text-body font-black tabular-nums", m.low ? "text-orange-700" : "text-foreground")}>
                  {m.remaining != null ? `남은 ${n(m.remaining)}회` : "—"}
                </p>
                {m.noNext && <span className="mt-0.5 inline-block rounded-full bg-orange-100 px-2 py-0.5 text-micro font-bold text-orange-700">예약 없음</span>}
              </div>
            </button>
          </li>
        ))}
      </ul>
    )}
    {rows.length > 0 && <p className="mt-3 text-label text-muted-foreground">남은 횟수는 브로제이 기준이에요 · 하루 이틀 늦게 맞춰질 수 있어요</p>}
  </OpsSheet>
);

// ───────────────────────── 설정(대표님) ─────────────────────────
export const PtSettingsSheet = ({ open, onClose, board, actions }: { open: boolean; onClose: () => void; board: PtBoard; actions: Actions }) => {
  const s = board.settings;
  const [bookingOn, setBookingOn] = useState(false);
  const [mileageOn, setMileageOn] = useState(false);
  const [amount, setAmount] = useState("1000");
  useEffect(() => {
    if (!open) return;
    // 처음 켤 때(설정 줄이 아직 없음)는 예약 · 수업 적립을 켠 채로 보여 준다 — 저장을 눌러야 바뀐다
    setBookingOn(s ? s.booking_on : board.record_on);
    setMileageOn(s ? s.mileage_on : true);
    setAmount(String(s?.lesson_mileage ?? 1000));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const value = Number(amount.replace(/[^0-9]/g, ""));
  const bad = !Number.isFinite(value) || value < 0 || value > 100_000;

  const save = () => {
    if (bad || actions.setting.isPending) return;
    actions.setting.mutate(
      { booking_on: bookingOn, mileage_on: mileageOn, lesson_mileage: value },
      {
        onSuccess: () => {
          toast.success("저장했어요");
          onClose();
        },
        onError: (e: unknown) => toast.error(errText(e, "바꾸지 못했어요")),
      },
    );
  };

  return (
    <OpsSheet
      open={open}
      onClose={onClose}
      title="PT 예약 설정"
      sub={board.branch}
      stacked
      footer={
        <OpsButton onClick={save} disabled={bad || actions.setting.isPending}>
          {actions.setting.isPending ? "저장하는 중…" : "저장"}
        </OpsButton>
      }
    >
      <div className="divide-y divide-border rounded-2xl border border-border">
        <label className="flex items-center justify-between gap-3 px-4 py-3.5">
          <span className="min-w-0">
            <span className="block text-body font-black text-foreground">PT 예약</span>
            <span className="block text-label text-muted-foreground">코치 예약판 · 회원 홈 「PT 수업」 카드 · 예약 알림</span>
          </span>
          <Switch checked={bookingOn} onCheckedChange={setBookingOn} aria-label="PT 예약" disabled={!board.record_on && !bookingOn} />
        </label>
        <label className="flex items-center justify-between gap-3 px-4 py-3.5">
          <span className="min-w-0">
            <span className="block text-body font-black text-foreground">수업 적립</span>
            <span className="block text-label text-muted-foreground">수업 기록 1회마다 마일리지 · 기록을 지우면 되돌려요</span>
          </span>
          <Switch checked={mileageOn} onCheckedChange={setMileageOn} aria-label="수업 적립" />
        </label>
        <div className="px-4 py-3.5">
          <label htmlFor="pt-mileage-amount" className="block text-body font-black text-foreground">
            수업 1회 마일리지
          </label>
          <div className="mt-2 flex items-center gap-2">
            <input
              id="pt-mileage-amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={cn(opsInput, "tabular-nums")}
            />
            <span className="shrink-0 text-body text-muted-foreground">점</span>
          </div>
          <p className={cn("mt-1.5 text-label", bad ? "font-bold text-destructive" : "text-muted-foreground")}>
            {bad ? "0 ~ 100,000 사이로 넣어 주세요" : "마일리지 1점 = 결제 할인 1원 · 연속 2회 수업은 2배"}
          </p>
        </div>
      </div>
      {!board.record_on && <p className="mt-3 text-label font-bold text-orange-700">PT 기록을 먼저 켜야 예약을 켤 수 있어요</p>}
      {s?.started_on && (
        <p className="mt-3 text-label text-muted-foreground">
          적립은 {dateLabel(s.started_on)} 수업부터 · 코치님 · 운영진 · 체험 계정은 적립하지 않아요
        </p>
      )}
    </OpsSheet>
  );
};
