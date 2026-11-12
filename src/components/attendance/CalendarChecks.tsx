/**
 * ✅ 운동 달력 그날 카드 — 오늘의 체크 · 나만의 체크 · 한 줄 · 기분 스티커 (2026-11-12 대표님 「추천대로」 · 2-1단계)
 *   선릉역점 봄 회원님 11/11 제안: 앱 활동을 하면 저절로 체크(퀘스트 깨는 기분) · 내가 고르는 체크리스트 · 오늘 운동 간단히 기록.
 *   · compact = 아무 날도 안 골랐을 때 '오늘의 체크' 한 줄(칩 + 한 줄) — 홈 카드를 크게 늘리지 않으려고.
 *   · 고른 날 = 그날 들어온 시각 · 운동 시간 · 그날의 의미 + 체크 + 한 줄(쓴 것) + 기분 스티커(오늘부터 6일 전까지 고치기).
 *   · 저절로 체크는 누를 수 없고(체육관 = 출석, 응원 = 응원 보내기나 153, 한 줄 = 오늘 운동 한 줄), 오늘 아직이면 그 일을 하는 창을 연다.
 *   · 채운 것과 다음 한 걸음만 말한다(lib/calendarChecks checkProgress) — 못한 것 · 빈칸 표시 없음.
 *   · (2-2 · 2026-11-13) 그날의 153 일정(휴관 · 단축 운영 · 이벤트 · 대회 · 특강) · 저요 한 운동 모집 한 줄씩(Agenda) ·
 *     앞날은 일정만(체크 · 스티커 없음) · 휴관일에 안 왔으면 체육관 체크를 빼고 센다(lib/calendarEvents · dayChecks closed).
 */
import { Check, ChevronRight, Lock, Plus, Star, UserRound, Users } from "lucide-react";
import { dayLabel, durationLabel, kstTime, type AttendanceDay } from "@/lib/attendanceHistory";
import type { DayMoment } from "@/lib/calendarMoments";
import {
  STICKERS,
  canEditDay,
  checkProgress,
  dayChecks,
  isStarDay,
  stickerOf,
  type CalState,
  type DayCheck,
  type JournalVisibility,
  type StickerKey,
} from "@/lib/calendarChecks";
import { EVENT_KIND_META, callLine, callsOn, eventUntil, eventsOn, isClosedDay, type CalCall, type CalEvent } from "@/lib/calendarEvents";
import { cn } from "@/lib/utils";

const VIS_LABEL: Record<JournalVisibility, string> = { private: "나만 보기", partners: "친구만", branch: "전체 공개" };
const VIS_ICON = { private: Lock, partners: UserRound, branch: Users } as const;

export interface DayChecksPanelProps {
  day: string;
  today: string;
  attended: AttendanceDay | null;
  moment?: DayMoment;
  cal: CalState;
  /** 고른 날이 없을 때의 '오늘의 체크' 한 줄 */
  compact?: boolean;
  busy?: boolean;
  onToggle: (itemId: string, done: boolean) => void;
  onSticker: (key: StickerKey | null) => void;
  onWriteLine: () => void;
  onCheer: () => void;
  onManage: () => void;
  /** (2-2) 저요 한 운동 모집을 누르면 — 커뮤니티 '오늘 같이 해요' */
  onOpenCalls?: () => void;
}

/** (2-2) 그날의 153 일정 · 저요 한 운동 모집 — 한 줄씩 (없으면 그리지 않음) */
const Agenda = ({
  day,
  events,
  calls,
  onOpenCalls,
}: {
  day: string;
  events: readonly CalEvent[];
  calls: readonly CalCall[];
  onOpenCalls?: () => void;
}) => {
  if (events.length === 0 && calls.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1.5" aria-label="이날 일정">
      {events.map((e) => {
        const until = eventUntil(e, day);
        return (
          <li key={e.id} className="flex items-center gap-2 rounded-lg bg-card px-3 py-2">
            <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-micro font-black", EVENT_KIND_META[e.kind].chip)}>
              {EVENT_KIND_META[e.kind].label}
            </span>
            <span className="line-clamp-2 min-w-0 flex-1 text-label font-bold leading-snug text-foreground">{e.title}</span>
            {until && <span className="shrink-0 text-micro tabular-nums text-muted-foreground">{until}</span>}
          </li>
        );
      })}
      {calls.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={onOpenCalls}
            disabled={!onOpenCalls}
            className="flex w-full items-center gap-2 rounded-lg bg-card px-3 py-2 text-left active:bg-secondary/60 disabled:active:bg-card"
          >
            <Users className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden />
            <span className="line-clamp-2 min-w-0 flex-1 text-label font-bold leading-snug text-foreground">{callLine(c)}</span>
            {c.done ? (
              <span className="shrink-0 text-micro font-bold text-primary">같이 했어요</span>
            ) : (
              onOpenCalls && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
          </button>
        </li>
      ))}
    </ul>
  );
};

/** 체크 칩 하나 — 채운 것 = 민트 · 오늘 할 수 있는 것 = 흰 칩(누르면 그 일) · 그 밖 = 점선(누를 수 없음) */
const CheckChip = ({
  c,
  today,
  editable,
  busy,
  onToggle,
  onWriteLine,
  onCheer,
}: {
  c: DayCheck;
  today: boolean;
  editable: boolean;
  busy?: boolean;
  onToggle: (itemId: string, done: boolean) => void;
  onWriteLine: () => void;
  onCheer: () => void;
}) => {
  const base = "inline-flex h-9 items-center gap-1 rounded-full px-3 text-label font-bold transition-transform";
  const doneCls = "border border-primary/30 bg-primary/10 text-primary";
  // 나만의 체크 — 고칠 수 있는 날이면 눌러서 했어요 · 취소
  if (c.kind === "custom" && c.itemId && editable) {
    const id = c.itemId;
    return (
      <button
        type="button"
        disabled={busy}
        aria-pressed={c.done}
        onClick={() => onToggle(id, !c.done)}
        className={cn(base, "active:scale-95", c.done ? doneCls : "border border-border bg-card text-foreground")}
      >
        {c.done ? <Check className="h-4 w-4" aria-hidden /> : <span className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/50" aria-hidden />}
        {c.label}
      </button>
    );
  }
  if (c.done) {
    return (
      <span className={cn(base, doneCls)}>
        <Check className="h-4 w-4" aria-hidden />
        {c.label}
      </span>
    );
  }
  // 오늘 아직인 저절로 체크 — 그 일을 하는 창을 연다 (체육관은 오면 저절로)
  if (today && (c.kind === "cheer" || c.kind === "line")) {
    return (
      <button
        type="button"
        onClick={c.kind === "cheer" ? onCheer : onWriteLine}
        className={cn(base, "border border-border bg-card text-foreground active:scale-95")}
      >
        <Plus className="h-4 w-4 text-primary" aria-hidden />
        {c.kind === "cheer" ? "응원 보내기" : "한 줄 쓰기"}
      </button>
    );
  }
  return <span className={cn(base, "border border-dashed border-border text-muted-foreground")}>{c.label}</span>;
};

const StarBadge = () => (
  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-reward/15 px-2.5 py-0.5 text-micro font-bold text-reward">
    <Star className="h-3.5 w-3.5" fill="currentColor" aria-hidden />
    금색 별
  </span>
);

export const DayChecksPanel = ({
  day,
  today,
  attended,
  moment,
  cal,
  compact = false,
  busy = false,
  onToggle,
  onSticker,
  onWriteLine,
  onCheer,
  onManage,
  onOpenCalls,
}: DayChecksPanelProps) => {
  const isToday = day === today;
  const future = day > today;
  const editable = canEditDay(day, today);
  const info = cal.days.get(day);
  const events = eventsOn(cal.events, day);
  const calls = callsOn(cal.calls, day);
  const checks = dayChecks(day, !!attended, info, cal.items, isClosedDay(cal.events, day));
  const star = isStarDay(checks);
  const progress = checkProgress(checks, isToday);
  const sticker = stickerOf(info?.sticker);
  const journal = info?.journal ?? null;
  const VisIcon = journal ? VIS_ICON[journal.visibility] : null;
  const activeItems = cal.items.filter((i) => i.archivedOn == null).length;

  // 앞날 — 그날 153 일정 · 저요 한 모집만 (체크 · 스티커는 그날이 와야)
  if (future) {
    return (
      <div className="mt-3 rounded-xl bg-muted/60 px-4 py-3" aria-label={`${dayLabel(day)} 일정`}>
        <p className="text-body font-bold text-foreground">{dayLabel(day)}</p>
        <Agenda day={day} events={events} calls={calls} onOpenCalls={onOpenCalls} />
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl bg-muted/60 px-4 py-3" aria-label={isToday ? "오늘의 체크" : `${dayLabel(day)} 기록`}>
      <div className="flex items-center justify-between gap-2">
        <p className={cn("flex min-w-0 items-center gap-1.5", compact ? "text-label font-bold text-muted-foreground" : "text-body font-bold text-foreground")}>
          {compact ? "오늘의 체크" : isToday ? `오늘 · ${dayLabel(day)}` : dayLabel(day)}
          {/* 고칠 수 있는 날은 아래 스티커 칸에 보이니 머리에는 지난 날만 */}
          {sticker && !compact && !editable && <span>{sticker.emoji}</span>}
          {compact && star && <StarBadge />}
        </p>
        {compact ? (
          <button
            type="button"
            onClick={onManage}
            className="inline-flex h-8 shrink-0 items-center gap-0.5 text-label font-bold text-primary active:opacity-70"
          >
            나만의 체크
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        ) : (
          star && <StarBadge />
        )}
      </div>

      {!compact && attended && (
        <p className="mt-1 flex items-center justify-between gap-3 text-label tabular-nums">
          <span className="text-muted-foreground">{kstTime(attended.at)} 들어옴</span>
          <span className="font-bold text-foreground">{durationLabel(attended.minutes)}</span>
        </p>
      )}
      {!compact && attended && moment && (
        <p className={cn("mt-1 flex items-center gap-1 text-label font-bold", moment.gold ? "text-reward" : "text-primary")}>
          <Star className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden />
          {moment.text}
        </p>
      )}

      <Agenda day={day} events={events} calls={calls} onOpenCalls={onOpenCalls} />

      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="체크">
        {checks.map((c) => (
          <CheckChip
            key={c.key}
            c={c}
            today={isToday}
            editable={editable}
            busy={busy}
            onToggle={onToggle}
            onWriteLine={onWriteLine}
            onCheer={onCheer}
          />
        ))}
      </div>
      {progress && <p className="mt-2 text-label font-bold text-foreground">{progress}</p>}

      {!compact && journal && (
        <div className="mt-3 rounded-lg bg-card px-3 py-2.5">
          <p className="flex items-center gap-1 text-micro font-bold text-muted-foreground">
            {VisIcon && <VisIcon className="h-3.5 w-3.5" aria-hidden />}한 줄 · {VIS_LABEL[journal.visibility]}
          </p>
          <p className="mt-1 line-clamp-3 whitespace-pre-line text-body leading-snug text-foreground">
            {journal.mood ? `${journal.mood} · ` : ""}
            {journal.content}
          </p>
          {journal.photoUrl && (
            <img src={journal.photoUrl} alt="그날 올린 사진" loading="lazy" className="mt-2 h-20 w-20 rounded-lg object-cover" />
          )}
        </div>
      )}

      {!compact && editable && (
        <div className="mt-3">
          <p className="text-micro font-bold text-muted-foreground">
            {isToday ? "오늘 기분" : "그날 기분"}
            {sticker ? ` · ${sticker.label}` : ""}
          </p>
          <div className="mt-1.5 grid grid-cols-8 gap-1">
            {STICKERS.map((s) => {
              const on = info?.sticker === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={on}
                  aria-label={`기분 스티커 ${s.label}`}
                  onClick={() => onSticker(on ? null : s.key)}
                  className={cn(
                    "flex h-10 items-center justify-center rounded-lg text-heading transition-transform active:scale-90",
                    on ? "bg-card ring-2 ring-primary" : "bg-card/70",
                  )}
                >
                  {s.emoji}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isToday && !compact && (
        <button
          type="button"
          onClick={onManage}
          className="mt-2 inline-flex h-9 items-center gap-0.5 text-label font-bold text-primary active:opacity-70"
        >
          {activeItems > 0 ? "나만의 체크 고치기" : "나만의 체크 만들기"}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
};

export default DayChecksPanel;
