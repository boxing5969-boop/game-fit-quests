/**
 * ✅ 운동 달력 그날 카드 — 오늘의 체크 · 나만의 체크 · 한 줄 · 기분 스티커 (2026-11-12 대표님 「추천대로」 · 2-1단계)
 *   선릉역점 봄 회원님 11/11 제안: 앱 활동을 하면 저절로 체크(퀘스트 깨는 기분) · 내가 고르는 체크리스트 · 오늘 운동 간단히 기록.
 *   · compact = 아무 날도 안 골랐을 때 '오늘의 체크' 한 줄(칩 + 한 줄) — 홈 카드를 크게 늘리지 않으려고.
 *   · 고른 날 = 그날 들어온 시각 · 운동 시간 · 그날의 의미 + 체크 + 한 줄(쓴 것) + 기분 스티커(오늘부터 6일 전까지 고치기).
 *   · 저절로 체크는 누를 수 없고(체육관 = 출석, 응원 = 응원 보내기나 153, 한 줄 = 오늘 운동 한 줄), 오늘 아직이면 그 일을 하는 창을 연다.
 *   · 채운 것과 다음 한 걸음만 말한다(lib/calendarChecks checkProgress) — 못한 것 · 빈칸 표시 없음.
 *   · (2-2 · 2026-11-13) 그날의 153 일정(휴관 · 단축 운영 · 이벤트 · 대회 · 특강) · 저요 한 운동 모집 한 줄씩(Agenda) ·
 *     앞날은 일정만(체크 · 스티커 없음) · 휴관일에 안 왔으면 체육관 체크를 빼고 센다(lib/calendarEvents · dayChecks closed).
 *   · (2-3 · 2026-11-13) 코치 한마디(Notes — '○○ 코치님' + 한 줄, 오늘의 체크 한 줄에도) · 그날 한 일(Acts — PT 수업 · 153 PB ·
 *     타이틀매치 · 레벨업) · 그날의 D-day · 기념일(Marks) · 앞날은 '이 날을 목표일로'(onGoal). 글은 lib/calendarMarks.ts.
 *   · (2-4 · 2026-11-13) 운동 짝꿍과 둘 다 온 날(쌍도장)은 들어온 시각 아래 '짝꿍 ○○님과 같이 운동한 날이에요' (lib/calendarTogether.ts).
 *   · (3-4 · 2026-11-14) 주 n번 체크 칩은 '줄넘기 10분 · 2/3'(그 주 채운 수 · 채우면 '이번 주 채움') — 금색 별 · 한 줄에는 안 셈 ·
 *     오늘이 마감인 할 일은 체크 아래 한 줄씩(누르면 끝냈어요) · 앞날은 그날 마감인 할 일 이름만 (lib/memberHabits.ts).
 *   · (3-5 · 2026-11-14) 그날의 내 일정 · 기념일 한 줄씩(누르면 고치기 · '이날은 쉬어요' 이름표) · 공휴일 · 내 생일 한 줄 ·
 *     '+ 내 일정'(오늘 · 앞날) · 쉬어요 날은 휴관일처럼 체육관 체크를 뺀다 · 기분 스티커 20(첫 줄 8 + '스티커 더 보기') ·
 *     한 줄은 다이어리처럼 — 사진 3장 · 길면 '더 보기'. 켜고 끄기(view)를 따른다 (lib/memberEvents.ts).
 */
import { useLayoutEffect, useRef, useState } from "react";
import { CalendarDays, Check, ChevronRight, Flag, Gift, Lock, Plus, Star, UserRound, Users } from "lucide-react";
import { ActIcon, NoteIcon } from "@/components/attendance/CalendarMarkIcons";
import {
  GOAL_MAX,
  actIsGold,
  actText,
  actsOn,
  annivOn,
  annivShort,
  annivText,
  ddayCount,
  ddayText,
  ddaysOn,
  goalsOf,
  noteWho,
  notesOn,
  quickModeOf,
  type CalAct,
  type CalNote,
} from "@/lib/calendarMarks";
import { dayLabel, durationLabel, kstTime, type AttendanceDay } from "@/lib/attendanceHistory";
import type { DayMoment } from "@/lib/calendarMoments";
import {
  STICKERS,
  STICKER_FIRST_ROW,
  canEditDay,
  checkProgress,
  dayChecks,
  isStarDay,
  journalPhotos,
  stickerOf,
  type CalState,
  type DayCheck,
  type JournalVisibility,
  type StickerKey,
} from "@/lib/calendarChecks";
import { EVENT_KIND_META, callLine, callsOn, eventUntil, eventsOn, isClosedDay, type CalCall, type CalEvent } from "@/lib/calendarEvents";
import { isTogetherDay, togetherText } from "@/lib/calendarTogether";
import { flexChipLabel, mondayOfYmd, todosOn, weekDoneOf, weekGoalOf, type CalTodo } from "@/lib/memberHabits";
import { holidayOn } from "@/lib/krHolidays";
import {
  BIRTHDAY_LINE,
  BIRTHDAY_TODAY,
  REST_LABEL,
  birthdayOn,
  layerOn,
  myEventHex,
  myEventOn,
  myEventsOn,
  mySubLine,
  type MyEvent,
} from "@/lib/memberEvents";
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
  /** (2-3) 앞날 — '이 날을 목표일로' (D-day 시트를 그 날로) */
  onGoal?: (day: string) => void;
  /** (3-4) 오늘 마감인 할 일 끝냈어요 · 되돌리기 */
  onTodo?: (id: string, done: boolean) => void;
  /** (3-5) '+ 내 일정' — 그 날로 내 일정 시트 */
  onAddEvent?: (day: string) => void;
  /** (3-5) 내 일정 한 줄을 누르면 — 고치기 시트(반복이면 그 회차) */
  onOpenEvent?: (e: MyEvent, day: string) => void;
  /** (3-5) 오늘의 체크 한 줄(compact)의 내 일정 요약을 누르면 — 그날 카드를 펼친다 */
  onExpand?: () => void;
}

/** (3-5) 오늘의 체크 한 줄 — 오늘 내 일정은 한 줄 요약만(홈 카드가 길어지지 않게) · 누르면 그날 카드 */
const CompactMine = ({ events, onExpand }: { events: readonly MyEvent[]; onExpand?: () => void }) => {
  if (events.length === 0) return null;
  const text = events.map((e) => (e.allDay || !e.startTime ? e.title : `${e.title} ${e.startTime}`)).join(" · ");
  return (
    <button
      type="button"
      onClick={onExpand}
      disabled={!onExpand}
      aria-label={`오늘 내 일정 ${events.length}개 · ${text}`}
      className="mt-2 flex w-full items-center gap-2 rounded-lg bg-card px-3 py-2 text-left active:bg-secondary/60 disabled:active:bg-card"
    >
      <span className="flex shrink-0 gap-0.5" aria-hidden>
        {events.slice(0, 3).map((e) => (
          <span key={e.id} className="h-2 w-2 rounded-full" style={{ backgroundColor: myEventHex(e) }} />
        ))}
      </span>
      <span className="min-w-0 flex-1 truncate text-label font-bold text-foreground">{text}</span>
      {events.some((e) => e.rest) && <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-micro font-bold text-primary">{REST_LABEL}</span>}
      {onExpand && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
    </button>
  );
};

/** (3-5) 그날의 내 일정 · 기념일 — 색 막대 · 이름 · 시각 · 장소 · 반복 + '이날은 쉬어요' (없으면 그리지 않음) */
const MineList = ({ events, day, onOpen }: { events: readonly MyEvent[]; day: string; onOpen?: (e: MyEvent, day: string) => void }) => {
  if (events.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1.5" aria-label="내 일정">
      {events.map((e) => (
        <li key={e.id}>
          <button
            type="button"
            onClick={() => onOpen?.(e, day)}
            disabled={!onOpen}
            className="flex w-full items-center gap-2.5 rounded-lg bg-card px-3 py-2 text-left active:bg-secondary/60 disabled:active:bg-card"
          >
            <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: myEventHex(e) }} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-label font-bold text-foreground">{e.title}</span>
              <span className="block truncate text-micro text-muted-foreground">{mySubLine(e)}</span>
            </span>
            {e.rest && <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-micro font-bold text-primary">{REST_LABEL}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
};

/** (3-5) '+ 내 일정' 작은 단추 */
const AddEvent = ({ day, onAdd }: { day: string; onAdd?: (day: string) => void }) =>
  onAdd ? (
    <button
      type="button"
      onClick={() => onAdd(day)}
      className="inline-flex h-9 items-center gap-1 text-label font-bold text-primary active:opacity-70"
    >
      <Plus className="h-4 w-4" aria-hidden />내 일정
    </button>
  ) : null;

/** (3-4) 그날이 마감인 할 일 — 오늘은 눌러서 끝냈어요 · 앞날은 이름만 (없으면 그리지 않음) */
const Todos = ({ todos, canCheck, onTodo }: { todos: readonly CalTodo[]; canCheck: boolean; onTodo?: (id: string, done: boolean) => void }) => {
  if (todos.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1.5" aria-label="마감 있는 할 일">
      {todos.map((t) => (
        <li key={t.id}>
          {canCheck && onTodo ? (
            <button
              type="button"
              aria-pressed={t.done}
              onClick={() => onTodo(t.id, !t.done)}
              className="flex w-full items-center gap-2 rounded-lg bg-card px-3 py-2 text-left active:scale-[0.99]"
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                  t.done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50",
                )}
                aria-hidden
              >
                {t.done && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
              <span className={cn("line-clamp-2 min-w-0 flex-1 text-label font-bold leading-snug", t.done ? "text-muted-foreground line-through" : "text-foreground")}>
                {t.title}
              </span>
              <span className={cn("shrink-0 text-micro font-bold", t.done ? "text-primary" : "text-muted-foreground")}>{t.done ? "끝냈어요" : "오늘까지"}</span>
            </button>
          ) : (
            <span className="flex items-center gap-2 rounded-lg bg-card px-3 py-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
              <span className="line-clamp-2 min-w-0 flex-1 text-label font-bold leading-snug text-foreground">{t.title}</span>
              <span className="shrink-0 text-micro text-muted-foreground">이날까지</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
};

/** (2-3) 코치 한마디 — 코치님이 「오늘 만날 회원」에서 남긴 한 줄 (없으면 그리지 않음) */
const Notes = ({ notes }: { notes: readonly CalNote[] }) => {
  if (notes.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1.5" aria-label="코치 한마디">
      {notes.map((n) => (
        <li key={n.id} className="rounded-lg bg-card px-3 py-2.5">
          <p className="flex items-center gap-1 text-micro font-bold text-primary">
            <NoteIcon className="h-3.5 w-3.5 shrink-0" />
            {noteWho(n)}
          </p>
          <p className="mt-0.5 whitespace-pre-line text-body font-bold leading-snug text-foreground">{n.body}</p>
        </li>
      ))}
    </ul>
  );
};

/** (2-3) 그날 한 일 — PT 수업 · 153 PB · 타이틀매치 · 레벨업 (DB 에 있는 기록만) */
const Acts = ({ acts }: { acts: readonly CalAct[] }) => {
  if (acts.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1" aria-label="그날 한 일">
      {acts.map((a, i) => (
        <li key={`${a.kind}:${i}`} className={cn("flex items-center gap-1.5 text-label font-bold", actIsGold(a) ? "text-reward" : "text-foreground")}>
          <ActIcon act={a} className="h-4 w-4 shrink-0" />
          <span className="min-w-0">{actText(a)}</span>
        </li>
      ))}
    </ul>
  );
};

type MarkLine = { key: string; text: string; gold?: boolean; tone?: "holiday" | "birthday" };

/** (2-3) 그날의 D-day · 기념일 한 줄씩 · (3-5) 공휴일 · 내 생일 */
const Marks = ({ marks }: { marks: readonly MarkLine[] }) => {
  if (marks.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1" aria-label="D-day">
      {marks.map((m) => (
        <li
          key={m.key}
          className={cn(
            "flex items-center gap-1.5 text-label font-bold tabular-nums",
            m.tone ? "text-rose-600 dark:text-rose-300" : m.gold ? "text-reward" : "text-violet-700 dark:text-violet-300",
          )}
        >
          {m.tone === "birthday" ? (
            <Gift className="h-4 w-4 shrink-0" aria-hidden />
          ) : m.tone === "holiday" ? (
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
          ) : m.gold ? (
            <Star className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden />
          ) : (
            <Flag className="h-4 w-4 shrink-0" aria-hidden />
          )}
          <span className="min-w-0">{m.text}</span>
        </li>
      ))}
    </ul>
  );
};

/** (2-2) 그날의 153 일정 · 저요 한 운동 모집 — 한 줄씩 (없으면 그리지 않음) · (2-3) 앞날의 승급 심사는 오른쪽에 D-n */
const Agenda = ({
  day,
  today,
  events,
  calls,
  onOpenCalls,
}: {
  day: string;
  today: string;
  events: readonly CalEvent[];
  calls: readonly CalCall[];
  onOpenCalls?: () => void;
}) => {
  if (events.length === 0 && calls.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1.5" aria-label="이날 일정">
      {events.map((e) => {
        const until = eventUntil(e, day);
        const dcount = !until && e.kind === "exam" && day > today ? ddayCount({ day }, today) : null;
        return (
          <li key={e.id} className="flex items-center gap-2 rounded-lg bg-card px-3 py-2">
            <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-micro font-black", EVENT_KIND_META[e.kind].chip)}>
              {EVENT_KIND_META[e.kind].label}
            </span>
            <span className="line-clamp-2 min-w-0 flex-1 text-label font-bold leading-snug text-foreground">{e.title}</span>
            {until && <span className="shrink-0 text-micro tabular-nums text-muted-foreground">{until}</span>}
            {dcount && <span className="shrink-0 text-micro font-black tabular-nums text-violet-700 dark:text-violet-300">{dcount}</span>}
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
  onGoal,
  onTodo,
  onAddEvent,
  onOpenEvent,
  onExpand,
}: DayChecksPanelProps) => {
  const [moreStickers, setMoreStickers] = useState(false);
  const [fullLine, setFullLine] = useState(false);
  const [lineClamped, setLineClamped] = useState(false);
  const lineRef = useRef<HTMLParagraphElement | null>(null);
  const isToday = day === today;
  const future = day > today;
  const editable = canEditDay(day, today);
  const info = cal.days.get(day);
  // (3-5) 켜고 끄기 — 153 일정 · 같이 운동 / 내 일정 · 생일 / 공휴일 (휴관 · 쉬어요로 체크를 빼는 것은 끈 것과 상관없이)
  const view = cal.view;
  const events = layerOn(view, "153") ? eventsOn(cal.events, day) : [];
  const calls = layerOn(view, "153") ? callsOn(cal.calls, day) : [];
  const mine = layerOn(view, "mine") ? myEventsOn(cal.mine, day) : [];
  const rest = cal.mine.some((e) => e.rest && e.kind === "plan" && myEventOn(e, day));
  const holiday = layerOn(view, "holiday") ? holidayOn(day) : null;
  const bday = layerOn(view, "mine") && birthdayOn(cal.birthday, day);
  const rawChecks = dayChecks(day, !!attended, info, cal.items, isClosedDay(cal.events, day) || rest);
  // (3-4) 주 n번 칩 — 그 주 채운 수 / 그 주 목표
  const monday = mondayOfYmd(day);
  const checks = rawChecks.map((c) => {
    if (!c.flex || !c.itemId) return c;
    const item = cal.items.find((i) => i.id === c.itemId);
    if (!item) return c;
    return { ...c, label: flexChipLabel(c.label, weekDoneOf(item.id, cal.days, monday, today), weekGoalOf(item, monday)) };
  });
  const dayTodos = todosOn(cal.todos, day);
  const star = isStarDay(checks);
  const progress = checkProgress(checks, isToday);
  const sticker = stickerOf(info?.sticker);
  const stickerExtended = !!sticker && STICKERS.findIndex((x) => x.key === sticker.key) >= STICKER_FIRST_ROW;
  const showAllStickers = moreStickers || stickerExtended;
  const journal = info?.journal ?? null;
  // (3-5) 다이어리 — 세 줄로 잘렸는지 재어 '더 보기'를 낸다 (줄 수는 글씨 크기 · 화면 폭마다 달라서)
  useLayoutEffect(() => {
    const el = lineRef.current;
    setLineClamped(!!el && !fullLine && el.scrollHeight > el.clientHeight + 1);
  }, [journal?.content, journal?.mood, fullLine, compact, day]);
  const VisIcon = journal ? VIS_ICON[journal.visibility] : null;
  const activeItems = cal.items.filter((i) => i.archivedOn == null).length;
  // (2-3) 코치 한마디 · 그날 한 일 · D-day · 기념일
  const notes = notesOn(cal.notes, day);
  const acts = actsOn(cal.acts, day);
  const anniv = annivOn(cal.anniv, day);
  const dd = ddaysOn(cal.ddays, day, today);
  const marks: MarkLine[] = [];
  if (holiday) marks.push({ key: "holiday", text: `공휴일 · ${holiday}`, tone: "holiday" });
  if (bday) marks.push({ key: "birthday", text: isToday ? BIRTHDAY_TODAY : BIRTHDAY_LINE, tone: "birthday" });
  // 기념일 — 출석한 날은 금색 도장 한 줄(moment)이 말한다 · 오늘 아직 안 왔거나 앞날이면 여기서 · 지난 날 안 온 기념일은 말하지 않는다
  if (anniv && ((isToday && !attended) || future)) {
    marks.push({ key: "anniv", text: isToday ? annivText(anniv, true) : `${ddayCount(anniv, today)} · ${annivShort(anniv)}`, gold: true });
  }
  for (const d of dd) {
    if (d.kind === "anniv" && anniv) continue;
    // 승급 심사는 아래 일정 줄이 이미 말한다 (D-n 은 그 줄 오른쪽에)
    if (d.kind === "exam" && events.some((e) => e.id === d.id)) continue;
    marks.push({ key: `${d.kind}:${d.id ?? d.day}`, text: `${ddayCount(d, today)} · ${ddayText(d, today)}` });
  }
  const canGoal =
    !!onGoal && quickModeOf(day, today) === "future" && goalsOf(cal.ddays).length < GOAL_MAX && !dd.some((d) => d.kind === "goal");

  // 앞날 — 그날 153 일정 · 저요 한 모집 · D-day (체크 · 스티커는 그날이 와야) + 이 날을 목표일로
  if (future) {
    return (
      <div className="mt-3 rounded-xl bg-muted/60 px-4 py-3" aria-label={`${dayLabel(day)} 일정`}>
        <p className="text-body font-bold text-foreground">{dayLabel(day)}</p>
        <Marks marks={marks} />
        <MineList events={mine} day={day} onOpen={onOpenEvent} />
        <Agenda day={day} today={today} events={events} calls={calls} onOpenCalls={onOpenCalls} />
        <Todos todos={dayTodos.filter((t) => !t.done)} canCheck={false} />
        {(canGoal || onAddEvent) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4">
            <AddEvent day={day} onAdd={onAddEvent} />
            {canGoal && (
              <button
                type="button"
                onClick={() => onGoal?.(day)}
                className="inline-flex h-9 items-center gap-1 text-label font-bold text-primary active:opacity-70"
              >
                <Flag className="h-4 w-4" aria-hidden />이 날을 목표일로
              </button>
            )}
          </div>
        )}
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
      {/* (2-4) 쌍도장 — 운동 짝꿍과 둘 다 온 날 */}
      {!compact && attended && cal.partner && isTogetherDay(cal.partner, day) && (
        <p className="mt-1 flex items-center gap-1 text-label font-bold text-sky-700 dark:text-sky-300">
          <Users className="h-4 w-4 shrink-0" aria-hidden />
          {togetherText(cal.partner)}
        </p>
      )}

      {/* (2-3) 코치 한마디는 오늘의 체크 한 줄에도 — "코치님이 나를 봤다" */}
      <Notes notes={notes} />
      {!compact && <Acts acts={acts} />}
      {!compact ? <Marks marks={marks} /> : bday && <Marks marks={marks.filter((m) => m.tone === "birthday")} />}

      {/* (3-5) 그날의 내 일정 — 오늘의 체크 한 줄에는 한 줄 요약(있을 때만) */}
      {compact ? <CompactMine events={mine} onExpand={onExpand} /> : <MineList events={mine} day={day} onOpen={onOpenEvent} />}
      <Agenda day={day} today={today} events={events} calls={calls} onOpenCalls={onOpenCalls} />

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
      {/* (3-4) 오늘이 마감인 할 일 — 지난 날 카드에는 그리지 않는다 */}
      {isToday && <Todos todos={dayTodos} canCheck onTodo={onTodo} />}

      {!compact && journal && (
        <div className="mt-3 rounded-lg bg-card px-3 py-2.5">
          <p className="flex items-center gap-1 text-micro font-bold text-muted-foreground">
            {VisIcon && <VisIcon className="h-3.5 w-3.5" aria-hidden />}한 줄 · {VIS_LABEL[journal.visibility]}
          </p>
          <p ref={lineRef} className={cn("mt-1 whitespace-pre-line text-body leading-snug text-foreground", !fullLine && "line-clamp-3")}>
            {journal.mood ? `${journal.mood} · ` : ""}
            {journal.content}
          </p>
          {/* (3-5) 다이어리 — 세 줄을 넘으면 더 보기 */}
          {!fullLine && lineClamped && (
            <button type="button" onClick={() => setFullLine(true)} className="mt-1 h-8 text-label font-bold text-primary active:opacity-70">
              더 보기
            </button>
          )}
          {journalPhotos(journal).length > 0 && (
            <div className="mt-2 grid max-w-[16rem] grid-cols-3 gap-1.5">
              {journalPhotos(journal).map((url, i) => (
                <img key={url} src={url} alt={`그날 올린 사진 ${i + 1}`} loading="lazy" className="aspect-square w-full rounded-lg object-cover" />
              ))}
            </div>
          )}
        </div>
      )}

      {!compact && editable && (
        <div className="mt-3">
          <p className="flex items-center justify-between gap-2 text-micro font-bold text-muted-foreground">
            <span>
              {isToday ? "오늘 기분" : "그날 기분"}
              {sticker ? ` · ${sticker.label}` : ""}
            </span>
            {/* (3-5) 스티커 20 — 첫 줄 8 + 더 보기 (고른 스티커가 뒤쪽이면 펼쳐 둔다) */}
            {!stickerExtended && (
              <button
                type="button"
                aria-expanded={moreStickers}
                onClick={() => setMoreStickers((v) => !v)}
                className="h-7 text-micro font-bold text-primary active:opacity-70"
              >
                {moreStickers ? "접기" : `스티커 더 보기 ${STICKERS.length - STICKER_FIRST_ROW}`}
              </button>
            )}
          </p>
          <div className="mt-1.5 grid grid-cols-8 gap-1">
            {(showAllStickers ? STICKERS : STICKERS.slice(0, STICKER_FIRST_ROW)).map((s) => {
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
        <div className="mt-2 flex flex-wrap items-center gap-x-4">
          <button type="button" onClick={onManage} className="inline-flex h-9 items-center gap-0.5 text-label font-bold text-primary active:opacity-70">
            {activeItems > 0 ? "나만의 체크 고치기" : "나만의 체크 만들기"}
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
          <AddEvent day={day} onAdd={onAddEvent} />
        </div>
      )}
    </div>
  );
};

export default DayChecksPanel;
