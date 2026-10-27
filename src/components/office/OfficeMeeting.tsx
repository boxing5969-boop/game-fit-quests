/**
 * 🏢 지점 회의실 — 회의 (2026-10-27 · 보고서 '회의 열기 · 들어가기' · 추천 기능 1단계)
 *   · MeetingSummaryCard — 사무실 첫 화면: 안건 · 지금 회의실에 있는 사람 · '회의실 들어가기'
 *   · (회의실 화면 /office/room — 사무실 그림 + 채팅을 한 화면에: pages/OfficeRoomPage)
 *   · EndMeetingSheet  — 회의 끝내기 확인(대표님 · 지점장)
 *   · OpenMeetingSheet — 회의 열기: 안건 한 줄 + 항목 3~5개 → 지도진에게 알림
 *   · MinutesSheet     — 지난 회의록: 참석 · 정한 것 · 채팅 전부
 *   · MessageList · Decisions — 채팅 줄 · 정한 것 모음 (회의실 화면 · 회의록 공용)
 */
import { useEffect, useMemo, useState } from "react";
import { LogIn, Pin, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DmSheet } from "@/components/dm/DmParts";
import { Label, inputCls } from "@/components/strategy/StrategyComposers";
import {
  officeDateTime,
  officeDuration,
  officeName,
  officeTime,
  useCloseMeeting,
  useOfficeMessages,
  useOpenMeeting,
  type OfficeMessage,
  type OfficeState,
} from "@/services/officeService";

/* ───────────── 채팅 줄 ───────────── */

const MessageRow = ({
  m,
  canPin,
  onPin,
}: {
  m: OfficeMessage;
  canPin: boolean;
  onPin?: (m: OfficeMessage) => void;
}) => {
  if (m.kind === "system") {
    return (
      <p className="py-1 text-center text-[11px] font-semibold text-muted-foreground">
        {m.body} · {officeTime(m.created_at)}
      </p>
    );
  }
  const decision = m.kind === "decision";
  return (
    <div className={cn("flex flex-col", m.mine ? "items-end" : "items-start")}>
      {!m.mine && (
        <span className="mb-0.5 px-1 text-[11px] font-bold text-muted-foreground">{officeName(m.author)}</span>
      )}
      <div className={cn("flex max-w-[86%] items-end gap-1", m.mine && "flex-row-reverse")}>
        <div
          className={cn(
            "whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[14px] leading-relaxed",
            decision
              ? "border border-amber-400/70 bg-amber-50 text-amber-950 dark:bg-amber-500/15 dark:text-amber-100"
              : m.mine
                ? "bg-foreground text-background"
                : "bg-secondary text-foreground",
          )}
        >
          {decision && (
            <span className="mb-0.5 flex items-center gap-1 text-[10.5px] font-black text-amber-700 dark:text-amber-300">
              <Pin className="h-3 w-3" /> 정한 것
            </span>
          )}
          {m.body}
        </div>
        <span className="shrink-0 pb-0.5 text-[10px] text-muted-foreground">{officeTime(m.created_at)}</span>
        {canPin && onPin && (
          <button
            type="button"
            onClick={() => onPin(m)}
            className={cn(
              "mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full active:scale-90",
              decision ? "bg-amber-400/30 text-amber-700" : "bg-secondary text-muted-foreground",
            )}
            aria-label={decision ? "정한 것에서 빼기" : "정한 것으로 남기기"}
          >
            <Pin className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
};

export const MessageList = ({
  messages,
  canPin = false,
  onPin,
  className,
}: {
  messages: OfficeMessage[];
  canPin?: boolean;
  onPin?: (m: OfficeMessage) => void;
  className?: string;
}) => (
  <div className={cn("space-y-2.5", className)}>
    {messages.map((m) => (
      <MessageRow key={m.id} m={m} canPin={canPin && m.kind !== "system"} onPin={onPin} />
    ))}
  </div>
);

/** 정한 것만 모아 보기 */
export const Decisions = ({ messages }: { messages: OfficeMessage[] }) => {
  const list = messages.filter((m) => m.kind === "decision");
  if (!list.length) return null;
  return (
    <div className="rounded-2xl border border-amber-400/60 bg-amber-50/80 p-3 dark:bg-amber-500/10">
      <p className="flex items-center gap-1 text-[12.5px] font-black text-amber-800 dark:text-amber-200">
        <Pin className="h-3.5 w-3.5" /> 정한 것 {list.length}
      </p>
      <ol className="mt-1.5 space-y-1 text-[13px] leading-relaxed text-amber-950 dark:text-amber-50">
        {list.map((m, i) => (
          <li key={m.id} className="flex gap-1.5">
            <span className="shrink-0 font-black">{i + 1}.</span>
            <span className="whitespace-pre-wrap break-words">{m.body}</span>
          </li>
        ))}
      </ol>
    </div>
  );
};

/* ───────────── 열린 회의 — 사무실 첫 화면 카드 ───────────── */

/** 안건 · 참석 · '회의실 들어가기' (채팅은 회의실 화면 /office/room 에서 그림과 함께) */
export const MeetingSummaryCard = ({
  state,
  online,
  onEnter,
  entering,
}: {
  state: OfficeState;
  online: ReadonlySet<string>;
  onEnter: () => void;
  entering?: boolean;
}) => {
  const meeting = state.meeting!;
  const inRoom = meeting.attendees.some((a) => a.user_id === state.me && a.in_room);
  const people = useMemo(() => new Map(state.people.map((p) => [p.user_id, p])), [state.people]);
  const here = meeting.attendees.filter((a) => a.in_room && online.has(a.user_id) && people.has(a.user_id));
  const [, setTick] = useState(0);
  // 'N분째' 를 1분마다 새로
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="rounded-3xl border border-primary/40 bg-card p-4 shadow-elev-1">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11.5px] font-black text-primary">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> 회의 중 · {officeDuration(meeting.opened_at, null)}째
        </span>
        <span className="truncate text-[11.5px] font-semibold text-muted-foreground">
          {officeName(meeting.opened_by)} · {officeTime(meeting.opened_at)}
        </span>
      </div>
      <h3 className="mt-2.5 text-[18px] font-black leading-snug text-foreground">{meeting.title}</h3>
      {meeting.agenda.length > 0 && (
        <ol className="mt-2 space-y-1 rounded-2xl bg-secondary/70 px-3 py-2.5 text-[13.5px] leading-relaxed text-foreground">
          {meeting.agenda.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="shrink-0 font-black text-primary">{i + 1}</span>
              <span className="break-words">{item}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 text-[12px] font-bold text-muted-foreground">
        지금 회의실 {here.length}명{here.length ? ` · ${here.map((a) => people.get(a.user_id)!.name).join(" · ")}` : ""}
      </p>
      <button
        type="button"
        disabled={entering}
        onClick={onEnter}
        className="mt-3 flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-primary text-[15px] font-black text-primary-foreground active:scale-[0.99] disabled:opacity-60"
      >
        <LogIn className="h-4 w-4" /> {inRoom ? "회의실로 돌아가기" : "회의실 들어가기"}
      </button>
    </div>
  );
};

/** 회의 끝내기 확인 — 대표님 · 지점장 */
export const EndMeetingSheet = ({
  open,
  onClose,
  meetingId,
  summary,
  onEnded,
}: {
  open: boolean;
  onClose: () => void;
  meetingId: string;
  summary: string;
  onEnded?: () => void;
}) => {
  const close = useCloseMeeting();
  return (
    <DmSheet
      open={open}
      onClose={onClose}
      title="회의를 끝낼까요?"
      subtitle="들어와 있던 분들은 모두 자리로 돌아가고, 채팅 · 정한 것 · 참석이 회의록으로 남아요."
      footer={
        <button
          type="button"
          disabled={close.isPending}
          onClick={() =>
            close.mutate(meetingId, {
              onSuccess: () => {
                onClose();
                toast.success("회의록으로 남겼어요");
                onEnded?.();
              },
              onError: (e) => toast.error((e as Error).message),
            })
          }
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-foreground text-[15px] font-black text-background active:scale-[0.99] disabled:opacity-60"
        >
          {close.isPending ? "끝내는 중…" : "회의 끝내기"}
        </button>
      }
    >
      <p className="text-[13.5px] leading-relaxed text-foreground">{summary}</p>
    </DmSheet>
  );
};

/* ───────────── 회의 열기 ───────────── */

export const OpenMeetingSheet = ({
  open,
  onClose,
  branch,
  label,
  onOpened,
}: {
  open: boolean;
  onClose: () => void;
  branch: string;
  label: string;
  /** 열린 뒤 (회의실 화면으로 가기 등) */
  onOpened?: (meetingId: string) => void;
}) => {
  const openMeeting = useOpenMeeting();
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<string[]>(["", "", ""]);

  useEffect(() => {
    if (open) {
      setTitle("");
      setItems(["", "", ""]);
    }
  }, [open]);

  const submit = () => {
    const t = title.trim();
    if (!t || openMeeting.isPending) return;
    openMeeting.mutate(
      { branch, title: t, agenda: items.map((s) => s.trim()).filter(Boolean).slice(0, 5) },
      {
        onSuccess: (id) => {
          toast.success("회의를 열었어요 — 지도진에게 알림을 보냈어요");
          onClose();
          onOpened?.(id);
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  return (
    <DmSheet
      open={open}
      onClose={onClose}
      title={`${label} 회의 열기`}
      subtitle="열면 지점 코치님 · 지점장님 휴대폰으로 '지금 지점 회의가 열렸어요' 알림이 가요."
      footer={
        <button
          type="button"
          onClick={submit}
          disabled={!title.trim() || openMeeting.isPending}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-[15px] font-black text-primary-foreground active:scale-[0.99] disabled:opacity-40"
        >
          {openMeeting.isPending ? "여는 중…" : "회의 열기"}
        </button>
      }
    >
      <Label hint="80자까지">안건 한 줄</Label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={80}
        placeholder="예) 11월 신규 회원 첫 수업 맞이 방법"
        className={inputCls}
      />
      <Label hint="3~5개 · 비워 둬도 돼요">정할 항목</Label>
      <div className="space-y-2">
        {items.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-4 shrink-0 text-center text-[13px] font-black text-primary">{i + 1}</span>
            <input
              value={v}
              onChange={(e) => setItems((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
              maxLength={60}
              placeholder={i === 0 ? "예) 첫 수업 인사 · 붕대 감아 드리기" : ""}
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
    </DmSheet>
  );
};

/* ───────────── 지난 회의록 ───────────── */

export const MinutesSheet = ({ meetingId, onClose }: { meetingId: string | null; onClose: () => void }) => {
  const q = useOfficeMessages(meetingId, !!meetingId);
  const d = q.data;
  const messages = d?.messages ?? [];
  return (
    <DmSheet
      open={!!meetingId}
      onClose={onClose}
      tall
      title={d?.meeting.title ?? "회의록"}
      subtitle={
        d
          ? `${officeDateTime(d.meeting.opened_at)} · ${officeDuration(d.meeting.opened_at, d.meeting.closed_at)}${d.meeting.closed_at ? "" : " (진행 중)"}`
          : undefined
      }
    >
      {q.isLoading || !d ? (
        <div className="space-y-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-2xl bg-secondary" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {d.meeting.agenda.length > 0 && (
            <ol className="space-y-1 rounded-2xl bg-secondary/70 px-3 py-2.5 text-[13.5px] leading-relaxed text-foreground">
              {d.meeting.agenda.map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 font-black text-primary">{i + 1}</span>
                  <span className="break-words">{item}</span>
                </li>
              ))}
            </ol>
          )}
          <div>
            <p className="text-[12px] font-bold text-muted-foreground">참석 {d.meeting.attendees.length}명</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {d.meeting.attendees.map((a) => (
                <span
                  key={a.user_id}
                  className="rounded-full border border-border bg-background px-2 py-[3px] text-[11.5px] font-bold text-foreground"
                >
                  {officeName(a)} <span className="font-semibold text-muted-foreground">{officeTime(a.first_joined_at)}</span>
                </span>
              ))}
            </div>
          </div>
          <Decisions messages={messages} />
          <div className="rounded-2xl bg-background p-3">
            {messages.length ? (
              <MessageList messages={messages} />
            ) : (
              <p className="py-4 text-center text-[13px] text-muted-foreground">남긴 말이 없어요</p>
            )}
          </div>
        </div>
      )}
    </DmSheet>
  );
};
