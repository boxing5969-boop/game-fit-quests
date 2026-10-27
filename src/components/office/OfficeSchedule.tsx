/**
 * 🏢 지점 회의실 정기 회의 예약 (2026-10-27 대표님 "다음 작업 진행하자" · DB 20261027225255_office_schedules.sql)
 *   · ScheduleSection — 사무실 화면 '정기 회의' 칸: 다음 시작이 가까운 순 · 1시간 안이면 '지금 열기'(대표님 · 지점장)
 *   · ScheduleSheet  — 예약하기 · 고치기: 이름 · 매주(요일) / 한 번(날짜) · 시간 · 미리 알림 · 정할 항목 · 줌/미트 링크 ·
 *                      지도진에게 알리기. 고칠 때는 '다음 한 번 쉬기' · '이 예약 취소'도 여기서.
 *   미리 알림 · 시간에 회의 열기 · 아무도 안 온 회의 닫기는 서버가 매분(office_schedule_tick) 한다 — 화면은 보여 주고 고치기만.
 *   코치님(회의를 못 여는 분)은 목록만 본다 · 잡힌 회의가 없으면 칸도 없다.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BellRing, CalendarClock, CalendarOff, ChevronRight, Plus, Video, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DmSheet } from "@/components/dm/DmParts";
import { Chip, Label, inputCls } from "@/components/strategy/StrategyComposers";
import { MeetingLinkField, WrapOption } from "@/components/office/OfficeMeeting";
import { MEETING_LINK_LABEL, extractMeetingLink, meetingLinkKind } from "@/lib/meetingLink";
import {
  REMIND_OPTIONS,
  WEEKDAY_KO,
  WEEK_ORDER,
  cleanWeekdays,
  clockLabel,
  kstYmd,
  nextLabel,
  nextOccurrence,
  remindChip,
  remindLabel,
  repeatLabel,
  scheduleDraftError,
  soonLabel,
  startsSoon,
  whenLabel,
} from "@/lib/officeSchedule";
import {
  useCancelSchedule,
  useOfficeSchedules,
  useOpenScheduleNow,
  useSaveSchedule,
  useSkipSchedule,
  type OfficeSchedule,
  type OfficeState,
} from "@/services/officeService";

/* ───────────── 사무실 화면 칸 ───────────── */

export const ScheduleSection = ({ state }: { state: OfficeState }) => {
  const navigate = useNavigate();
  const host = state.role === "host";
  const q = useOfficeSchedules(state.branch);
  const list = q.data ?? [];
  const openNow = useOpenScheduleNow();
  // 시트는 id 로 — 쉬기 · 취소 뒤 목록이 새로 오면 시트도 새 값을 본다
  const [sheet, setSheet] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const editing = sheet.id ? list.find((s) => s.id === sheet.id) ?? null : null;
  // '12분 뒤 시작' · '지금 열기' 를 시간 따라 새로
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  // 고치던 예약이 취소 · 끝나 목록에서 빠지면 시트를 닫는다
  useEffect(() => {
    if (sheet.open && sheet.id && q.isSuccess && !editing) setSheet({ open: false, id: null });
  }, [sheet, editing, q.isSuccess]);

  if (!host && list.length === 0) return null;

  const start = (s: OfficeSchedule) =>
    openNow.mutate(s.id, {
      onSuccess: () => {
        toast.success("회의를 열었어요 — 지도진에게 알림을 보냈어요");
        navigate("/office/room");
      },
      onError: (e) => toast.error((e as Error).message),
    });

  return (
    <section>
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-[15px] font-black text-foreground">정기 회의</h2>
        {host && list.length > 0 && (
          <button
            type="button"
            onClick={() => setSheet({ open: true, id: null })}
            className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-[12.5px] font-black text-foreground active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" /> 예약
          </button>
        )}
      </div>

      {q.isLoading ? (
        <div className="mt-2 h-20 animate-pulse rounded-3xl bg-card shadow-elev-1" />
      ) : list.length === 0 ? (
        <div className="mt-2 rounded-3xl bg-card p-4 shadow-elev-1">
          <div className="flex items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-secondary">
              <CalendarClock className="h-[18px] w-[18px] text-muted-foreground" />
            </span>
            <div className="min-w-0">
              <p className="text-[14.5px] font-black text-foreground">매주 하는 회의를 잡아 두세요</p>
              <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                시작 10분 전에 지도진 휴대폰으로 알림이 가고, 그 시간이 되면 회의가 저절로 열려요.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSheet({ open: true, id: null })}
            className="mt-3.5 flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-secondary text-[14px] font-black text-foreground active:scale-[0.99]"
          >
            <CalendarClock className="h-4 w-4" /> 회의 예약하기
          </button>
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-border/70 overflow-hidden rounded-3xl bg-card shadow-elev-1">
          {list.map((s) => (
            <ScheduleRow
              key={s.id}
              s={s}
              now={now}
              host={host}
              canOpen={host && !state.meeting}
              opening={openNow.isPending}
              onOpen={() => start(s)}
              onEdit={() => setSheet({ open: true, id: s.id })}
            />
          ))}
        </ul>
      )}

      {host && (
        <ScheduleSheet
          open={sheet.open}
          onClose={() => setSheet({ open: false, id: null })}
          schedule={editing}
          branch={state.branch}
          label={state.label}
          people={state.people.length}
          lastLink={state.last_video_url}
        />
      )}
    </section>
  );
};

/** 한 줄 — 왼쪽 시계 · 이름 · 반복 · 다음 회의 (대표님 · 지점장은 눌러서 고치기, 1시간 안이면 '지금 열기') */
const ScheduleRow = ({
  s,
  now,
  host,
  canOpen,
  opening,
  onOpen,
  onEdit,
}: {
  s: OfficeSchedule;
  now: Date;
  host: boolean;
  canOpen: boolean;
  opening: boolean;
  onOpen: () => void;
  onEdit: () => void;
}) => {
  const soon = !s.skip_next && startsSoon(s.next_at, now);
  const next = s.skip_next ? s.then_at : s.next_at;
  const [ampm, clock] = clockLabel(s.at).split(" ");
  const nextText = s.skip_next
    ? `이번엔 쉬어요${next ? ` · 다음 ${nextLabel(next, now)}` : ""}`
    : soon && s.next_at
      ? `${soonLabel(s.next_at, now)} 시작`
      : next
        ? `다음 · ${nextLabel(next, now)}`
        : "";

  const body = (
    <>
      <span
        className={cn(
          "flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl",
          soon ? "bg-primary/10 text-primary" : "bg-secondary text-foreground",
        )}
      >
        <span className="text-[10.5px] font-bold leading-none opacity-70">{ampm}</span>
        <span className="mt-1 text-[16px] font-black leading-none tabular-nums">{clock}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[14.5px] font-bold text-foreground">{s.title}</span>
          {s.video_url && (
            <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-secondary px-1.5 py-[1px] text-[10.5px] font-bold text-muted-foreground">
              <Video className="h-3 w-3" />
              {MEETING_LINK_LABEL[meetingLinkKind(s.video_url)]}
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
          {repeatLabel(s.weekdays, s.once_on)} · {remindLabel(s.remind_min)}
        </span>
        {nextText && (
          <span
            className={cn(
              "mt-0.5 block truncate text-[11.5px] font-bold",
              soon ? "text-primary" : s.skip_next ? "text-muted-foreground" : "text-foreground/80",
            )}
          >
            {nextText}
          </span>
        )}
      </span>
    </>
  );

  return (
    <li className="flex items-center gap-2 px-3 py-3">
      {host ? (
        <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3 text-left active:opacity-70">
          {body}
          {!(soon && canOpen) && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>
      )}
      {soon && canOpen && (
        <button
          type="button"
          disabled={opening}
          onClick={onOpen}
          className="h-9 shrink-0 rounded-full bg-primary px-3.5 text-[12.5px] font-black text-primary-foreground active:scale-95 disabled:opacity-60"
        >
          지금 열기
        </button>
      )}
    </li>
  );
};

/* ───────────── 예약하기 · 고치기 ───────────── */

const DAY_MS = 86_400_000;

export const ScheduleSheet = ({
  open,
  onClose,
  schedule,
  branch,
  label,
  people,
  lastLink,
}: {
  open: boolean;
  onClose: () => void;
  /** 고칠 예약 (없으면 새 예약) */
  schedule: OfficeSchedule | null;
  branch: string;
  label: string;
  /** 알림을 받는 사람 수 (지점 지도진 + 대표님) */
  people: number;
  /** 지난번 회의에 쓴 줌 · 구글 미트 링크 (새 예약에서 눌러서 넣기) */
  lastLink?: string | null;
}) => {
  const save = useSaveSchedule();
  const skip = useSkipSchedule();
  const cancel = useCancelSchedule();
  const editing = !!schedule;

  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"weekly" | "once">("weekly");
  const [days, setDays] = useState<number[]>([1]);
  const [onceOn, setOnceOn] = useState("");
  const [at, setAt] = useState("10:00");
  const [remind, setRemind] = useState(10);
  const [items, setItems] = useState<string[]>([""]);
  const [link, setLink] = useState("");
  const [notify, setNotify] = useState(true);
  const [confirmCancel, setConfirmCancel] = useState(false);

  // 열 때 한 번만 채운다 (목록이 새로 와도 쓰던 글은 그대로)
  const scheduleId = schedule?.id ?? null;
  useEffect(() => {
    if (!open) return;
    const s = schedule;
    setTitle(s?.title ?? "");
    setMode(s?.once_on ? "once" : "weekly");
    setDays(s && !s.once_on ? s.weekdays : [1]);
    setOnceOn(s?.once_on ?? kstYmd(new Date(Date.now() + DAY_MS)));
    setAt(s?.at ?? "10:00");
    setRemind(s?.remind_min ?? 10);
    setItems(s?.agenda.length ? s.agenda : [""]);
    setLink(s?.video_url ?? "");
    setNotify(!s);
    setConfirmCancel(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scheduleId]);

  const weekly = mode === "weekly";
  const parsedLink = extractMeetingLink(link);
  const err = scheduleDraftError({ title, mode, weekdays: days, onceOn, at });
  const preview = err ? null : nextOccurrence(weekly ? days : [], weekly ? null : onceOn, at);
  // 쉬기로 한 차례가 그대로면 미리 보기는 그다음 차례 (서버도 같은 차례면 '쉬기'를 남긴다)
  const skippedAt =
    schedule?.skip_next && schedule.next_at && preview && preview.getTime() === new Date(schedule.next_at).getTime()
      ? schedule.next_at
      : null;
  const shown = skippedAt && schedule?.then_at ? new Date(schedule.then_at) : preview;
  const busy = save.isPending || skip.isPending || cancel.isPending;
  const today = kstYmd(new Date());
  const lastDay = kstYmd(new Date(Date.now() + 365 * DAY_MS));

  const submit = () => {
    if (err || busy || parsedLink === "bad") return;
    const weekdays = weekly ? cleanWeekdays(days) : [];
    save.mutate(
      {
        id: schedule?.id ?? null,
        branch,
        title: title.trim(),
        agenda: items
          .map((v) => v.trim())
          .filter(Boolean)
          .slice(0, 5),
        weekdays,
        onceOn: weekly ? null : onceOn,
        at,
        remindMin: remind,
        videoUrl: typeof parsedLink === "string" ? parsedLink : null,
        notify,
      },
      {
        onSuccess: () => {
          toast.success(
            `${editing ? "예약을 고쳤어요" : "회의를 예약했어요"} · ${whenLabel(weekdays, weekly ? null : onceOn, at)}${
              notify ? " — 지도진에게 알렸어요" : ""
            }`,
          );
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  const toggleSkip = (v: boolean) => {
    if (!schedule) return;
    skip.mutate(
      { id: schedule.id, skip: v, notify },
      {
        onSuccess: () =>
          toast.success(
            (v ? "다음 한 번 쉬어요" : "쉬기를 풀었어요 — 다음 회의를 해요") + (notify ? " — 지도진에게 알렸어요" : ""),
          ),
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  const doCancel = () => {
    if (!schedule) return;
    cancel.mutate(
      { id: schedule.id, notify },
      {
        onSuccess: () => {
          toast.success(`예약을 취소했어요${notify ? " — 지도진에게 알렸어요" : ""}`);
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  return (
    <DmSheet
      open={open}
      onClose={onClose}
      title={editing ? "정기 회의 고치기" : `${label} 회의 예약`}
      subtitle="시작 전에 지도진 휴대폰으로 알림이 가고, 그 시간이 되면 회의가 저절로 열려요."
      footer={
        <button
          type="button"
          onClick={submit}
          disabled={!!err || busy || parsedLink === "bad"}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-[15px] font-black text-primary-foreground active:scale-[0.99] disabled:opacity-40"
        >
          {save.isPending ? "저장하는 중…" : editing ? "저장" : "예약하기"}
        </button>
      }
    >
      <Label hint="80자까지">회의 이름</Label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={80}
        placeholder="예) 주간 지도진 회의"
        className={inputCls}
      />

      <Label>반복</Label>
      <div className="flex gap-1.5">
        <Chip on={weekly} onClick={() => setMode("weekly")}>
          매주
        </Chip>
        <Chip on={!weekly} onClick={() => setMode("once")}>
          한 번만
        </Chip>
      </div>

      {weekly ? (
        <>
          <Label hint="여러 개 고를 수 있어요">요일</Label>
          <div className="flex gap-1">
            {WEEK_ORDER.map((d) => {
              const on = days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))}
                  className={cn(
                    "h-10 min-w-0 flex-1 rounded-full border text-[13.5px] font-black transition-colors active:scale-95",
                    on ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground",
                  )}
                >
                  {WEEKDAY_KO[d]}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <Label>날짜</Label>
          <input
            type="date"
            value={onceOn}
            min={today}
            max={lastDay}
            onChange={(e) => setOnceOn(e.target.value)}
            className={inputCls}
          />
        </>
      )}

      <Label hint="한국 시간">시작 시간</Label>
      <input type="time" value={at} step={300} onChange={(e) => setAt(e.target.value)} className={inputCls} />

      <Label>미리 알림</Label>
      <div className="flex flex-wrap gap-1.5">
        {REMIND_OPTIONS.map((m) => (
          <Chip key={m} on={remind === m} onClick={() => setRemind(m)}>
            {remindChip(m)}
          </Chip>
        ))}
      </div>

      <Label hint="선택 · 5개까지">정할 항목</Label>
      <div className="space-y-2">
        {items.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-4 shrink-0 text-center text-[13px] font-black text-primary">{i + 1}</span>
            <input
              value={v}
              onChange={(e) => setItems((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
              maxLength={60}
              placeholder={i === 0 ? "예) 지난주 돌아보기" : ""}
              className={inputCls}
            />
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => setItems((arr) => arr.filter((_, j) => j !== i))}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground active:scale-95"
                aria-label={`${i + 1}번 항목 빼기`}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {items.length < 5 && (
          <button
            type="button"
            onClick={() => setItems((arr) => [...arr, ""])}
            className="flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-[12.5px] font-bold text-muted-foreground active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" /> 항목 더하기
          </button>
        )}
      </div>

      <MeetingLinkField
        value={link}
        onChange={setLink}
        parsed={parsedLink}
        hint="선택 · 가맹 관장님처럼 바깥 분과 함께할 때"
        suggest={editing ? null : lastLink}
      />

      {/* 미리 보기 — 다음 회의 · 알림 */}
      <div className="mt-4 rounded-2xl bg-secondary/70 px-3.5 py-3">
        {shown ? (
          <>
            <p className="text-[13.5px] font-black text-foreground">다음 회의 · {nextLabel(shown)}</p>
            {skippedAt && (
              <p className="mt-0.5 text-[12px] font-bold text-muted-foreground">{nextLabel(skippedAt)} 회의는 쉬어요</p>
            )}
            <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
              {remind > 0 ? `${remindChip(remind)} 지도진 ${people}명 휴대폰에 알림 → ` : "알림 없이 "}그 시간에 회의가 저절로 열려요
            </p>
          </>
        ) : (
          <p className="text-[12.5px] font-bold text-muted-foreground">{err}</p>
        )}
      </div>

      <div className="mt-3 space-y-2">
        <WrapOption
          icon={<BellRing className="h-4 w-4" />}
          title={editing ? "지도진에게 알리기" : "지도진에게 바로 알리기"}
          sub={
            editing
              ? "저장 · 쉬기 · 취소할 때 '지점 회의가 바뀌었어요' 같은 알림을 한 번 보내요"
              : "'지점 회의가 잡혔어요' 알림을 한 번 보내요"
          }
          checked={notify}
          onChange={setNotify}
          disabled={busy}
        />
        {schedule && !schedule.once_on && schedule.next_at && (
          <WrapOption
            icon={<CalendarOff className="h-4 w-4" />}
            title="다음 한 번 쉬기"
            sub={`${nextLabel(schedule.next_at)} — 알림 · 회의 열기를 한 번 건너뛰어요`}
            checked={schedule.skip_next}
            onChange={toggleSkip}
            disabled={busy}
          />
        )}
      </div>

      {schedule &&
        (confirmCancel ? (
          <div className="mt-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-[13px] font-bold text-foreground">
              '{schedule.title}' 예약을 취소할까요? 다음부터 알림도 회의도 없어요.
            </p>
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmCancel(false)}
                className="h-10 flex-1 rounded-2xl bg-secondary text-[13.5px] font-black text-foreground active:scale-[0.99]"
              >
                그대로 두기
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={doCancel}
                className="h-10 flex-1 rounded-2xl bg-destructive text-[13.5px] font-black text-destructive-foreground active:scale-[0.99] disabled:opacity-60"
              >
                {cancel.isPending ? "취소하는 중…" : "예약 취소"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmCancel(true)}
            className="mt-3 w-full py-2 text-center text-[13px] font-bold text-destructive active:opacity-70"
          >
            이 예약 취소
          </button>
        ))}
    </DmSheet>
  );
};
