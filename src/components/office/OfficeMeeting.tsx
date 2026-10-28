/**
 * 🏢 지점 회의실 — 회의 (2026-10-27 · 보고서 '회의 열기 · 들어가기' · 추천 기능 1단계)
 *   · MeetingSummaryCard — 사무실 첫 화면: 안건 · 지금 회의실에 있는 사람 · '회의실 들어가기'
 *   · (회의실 화면 /office/room — 사무실 그림 + 채팅을 한 화면에: pages/OfficeRoomPage)
 *   · EndMeetingSheet  — 회의 끝내기 확인(대표님 · 지점장)
 *   · OpenMeetingSheet — 회의 열기: 안건 한 줄 + 항목 3~5개 → 지도진에게 알림
 *   · MinutesSheet     — 지난 회의록: 참석 · 정한 것 · 채팅 전부
 *   · MessageList · Decisions — 채팅 줄 · 정한 것 모음 (회의실 화면 · 회의록 공용)
 *   · MeetingLinkBar · MeetingLinkSheet — 줌 · 구글 미트 링크로 들어가기 · 넣기/바꾸기(대표님 · 지점장) (2026-10-27 대표님 "그렇게하자")
 *   · 3단계(2026-10-27 대표님 "다음단계진행할까?") — 끝내기 시트에서 오삼코치 3줄 요약 · 정한 것 → 전략 회의실 지시 · 못 오신 분께 요약 알림,
 *     회의록에 요약 · 지시 확인 n/n · 알림 현황 (끝낼 때 못 한 것은 회의록에서 대표님 · 지점장이 보낸다)
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { BellRing, ClipboardCheck, LogIn, Pin, Plus, Sparkles, Video, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { DmSheet } from "@/components/dm/DmParts";
import { Label, inputCls } from "@/components/strategy/StrategyComposers";
import { isIosApp, loadIosAppNative } from "@/lib/iosApp";
import { MEETING_LINK_BAD, MEETING_LINK_LABEL, extractMeetingLink, meetingLinkKind } from "@/lib/meetingLink";
import {
  officeDateTime,
  officeDuration,
  officeName,
  officeTime,
  summarizeMeeting,
  useCloseMeeting,
  useOfficeMessages,
  useOfficeRecap,
  useOpenMeeting,
  useSetMeetingLink,
  useSummarizeMeeting,
  useWrapUpMeeting,
  type OfficeDisplay,
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
      <p className="py-1 text-center text-label font-semibold text-muted-foreground">
        {m.body} · {officeTime(m.created_at)}
      </p>
    );
  }
  const decision = m.kind === "decision";
  return (
    <div className={cn("flex flex-col", m.mine ? "items-end" : "items-start")}>
      {!m.mine && (
        <span className="mb-0.5 px-1 text-label font-bold text-muted-foreground">{officeName(m.author)}</span>
      )}
      <div className={cn("flex max-w-[86%] items-end gap-1", m.mine && "flex-row-reverse")}>
        <div
          className={cn(
            "whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-label leading-relaxed",
            decision
              ? "border border-amber-400/70 bg-amber-50 text-amber-950 dark:bg-amber-500/15 dark:text-amber-100"
              : m.mine
                ? "bg-foreground text-background"
                : "bg-secondary text-foreground",
          )}
        >
          {decision && (
            <span className="mb-0.5 flex items-center gap-1 text-micro font-black text-amber-700 dark:text-amber-300">
              <Pin className="h-3 w-3" /> 정한 것
            </span>
          )}
          {m.body}
        </div>
        <span className="shrink-0 pb-0.5 text-label text-muted-foreground">{officeTime(m.created_at)}</span>
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
      <p className="flex items-center gap-1 text-label font-black text-amber-800 dark:text-amber-200">
        <Pin className="h-3.5 w-3.5" /> 정한 것 {list.length}
      </p>
      <ol className="mt-1.5 space-y-1 text-label leading-relaxed text-amber-950 dark:text-amber-50">
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
        <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-micro font-black text-primary">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> 회의 중 · {officeDuration(meeting.opened_at, null)}째
        </span>
        <span className="truncate text-label font-semibold text-muted-foreground">
          {meeting.scheduled ? "정기 회의" : officeName(meeting.opened_by)} · {officeTime(meeting.opened_at)}
        </span>
      </div>
      <h3 className="mt-2.5 text-heading font-black leading-snug text-foreground">{meeting.title}</h3>
      {meeting.agenda.length > 0 && (
        <ol className="mt-2 space-y-1 rounded-2xl bg-secondary/70 px-3 py-2.5 text-label leading-relaxed text-foreground">
          {meeting.agenda.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="shrink-0 font-black text-primary">{i + 1}</span>
              <span className="break-words">{item}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 text-label font-bold text-muted-foreground">
        지금 회의실 {here.length}명{here.length ? ` · ${here.map((a) => people.get(a.user_id)!.name).join(" · ")}` : ""}
      </p>
      <button
        type="button"
        disabled={entering}
        onClick={onEnter}
        className="mt-3 flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-primary text-body font-black text-primary-foreground active:scale-[0.99] disabled:opacity-60"
      >
        <LogIn className="h-4 w-4" /> {inRoom ? "회의실로 돌아가기" : "회의실 들어가기"}
      </button>
    </div>
  );
};

/** '강건형 코치님 · 김성윤 코치님 외 3분' */
const peopleLine = (list: OfficeDisplay[], max = 3) =>
  list.slice(0, max).map(officeName).join(" · ") + (list.length > max ? ` 외 ${list.length - max}분` : "");

/** 끝내면서 함께 할 것 한 줄 — 그림 · 제목 · 설명 · 스위치 (줄 어디를 눌러도 켜고 끈다). 정기 회의 예약 시트도 쓴다 */
export const WrapOption = ({
  icon,
  title,
  sub,
  checked,
  onChange,
  disabled,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) => (
  <label
    className={cn(
      "flex cursor-pointer items-start gap-3 rounded-2xl border bg-background px-3 py-3 transition-colors",
      checked ? "border-primary/50" : "border-border",
      disabled && "pointer-events-none opacity-60",
    )}
  >
    <span
      className={cn(
        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
        checked ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground",
      )}
    >
      {icon}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-label font-black leading-snug text-foreground">{title}</span>
      <span className="mt-0.5 block text-label leading-snug text-muted-foreground">{sub}</span>
    </span>
    <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={title} className="mt-1 shrink-0" />
  </label>
);

type EndStep = "" | "ai" | "close" | "send";
const END_LABEL: Record<EndStep, string> = {
  "": "회의 끝내기",
  ai: "오삼코치가 정리하는 중…",
  close: "끝내는 중…",
  send: "보내는 중…",
};

/**
 * 회의 끝내기 — 대표님 · 지점장 (3단계: 끝내면서 함께 할 것)
 *   ① 오삼코치 3줄 요약(이야기가 2줄 이상일 때) → ② 끝내기 → ③ 정한 것 → 전략 회의실 지시 · 못 오신 분께 요약 알림
 *   요약이 늦거나 안 되면 요약 없이 끝낸다(회의는 꼭 끝난다). 못 한 것은 회의록에서 다시 할 수 있다.
 */
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
  const wrap = useWrapUpMeeting();
  const recapQ = useOfficeRecap(meetingId, open);
  const r = recapQ.data;
  const [step, setStep] = useState<EndStep>("");
  const [useAi, setUseAi] = useState(true);
  const [toStrategy, setToStrategy] = useState(true);
  const [toAbsent, setToAbsent] = useState(true);
  useEffect(() => {
    if (open) {
      setUseAi(true);
      setToStrategy(true);
      setToAbsent(true);
    }
  }, [open]);

  const decisions = r?.decisions ?? 0;
  const absent = r?.absent ?? [];
  const canAi = (r?.talk ?? 0) >= 2;
  const busy = step !== "";

  const finish = async () => {
    if (busy) return;
    const wantAi = useAi && canAi;
    const wantDirective = toStrategy && decisions > 0;
    const wantRecap = toAbsent && absent.length > 0;
    const done = ["회의록으로 남겼어요"];
    try {
      if (wantAi) {
        setStep("ai");
        const ok = await Promise.race([
          summarizeMeeting(meetingId).then(() => true),
          new Promise<boolean>((res) => setTimeout(() => res(false), 20_000)),
        ]).catch(() => false);
        if (!ok) done.push("요약은 회의록에서 다시 만들 수 있어요");
      }
      setStep("close");
      await close.mutateAsync(meetingId);
    } catch (e) {
      setStep("");
      toast.error((e as Error).message);
      return;
    }
    if (wantDirective || wantRecap) {
      setStep("send");
      try {
        const res = await wrap.mutateAsync({ meetingId, directive: wantDirective, recap: wantRecap });
        if (res.directive_new) done.push("전략 회의실에 지시를 보냈어요");
        if (res.recap_new && res.recap_to > 0) done.push(`못 오신 ${res.recap_to}분께 요약을 보냈어요`);
      } catch (e) {
        toast.error(`회의는 끝냈어요 — ${(e as Error).message} (회의록에서 다시 보낼 수 있어요)`);
      }
    }
    setStep("");
    toast.success(done.join(" · "));
    onClose();
    onEnded?.();
  };

  return (
    <DmSheet
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="회의를 끝낼까요?"
      subtitle="들어와 있던 분들은 모두 자리로 돌아가고, 채팅 · 정한 것 · 참석이 회의록으로 남아요."
      footer={
        <button
          type="button"
          disabled={busy}
          onClick={() => void finish()}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-foreground text-body font-black text-background active:scale-[0.99] disabled:opacity-60"
        >
          {END_LABEL[step]}
        </button>
      }
    >
      <p className="text-label leading-relaxed text-foreground">{summary}</p>
      {(recapQ.isLoading || r) && (
        <>
          <p className="mb-2 mt-4 text-label font-bold text-muted-foreground">끝내면서 함께 할 것</p>
          {recapQ.isLoading || !r ? (
            <div className="space-y-2" aria-hidden>
              {[0, 1].map((i) => (
                <div key={i} className="h-[62px] animate-pulse rounded-2xl bg-secondary" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {canAi && (
                <WrapOption
                  icon={<Sparkles className="h-4 w-4" />}
                  title="오삼코치 3줄 요약"
                  sub="회의 채팅을 AI(Anthropic)로 보내 정리해요 · 앱에는 요약 세 줄만 남아요"
                  checked={useAi}
                  onChange={setUseAi}
                  disabled={busy}
                />
              )}
              {decisions > 0 ? (
                <WrapOption
                  icon={<ClipboardCheck className="h-4 w-4" />}
                  title={`정한 것 ${decisions}가지 → 전략 회의실 지시`}
                  sub="코치님들이 '확인했어요'를 눌러요 · 안 누르면 다음 날 아침 9시에 다시 알려요"
                  checked={toStrategy}
                  onChange={setToStrategy}
                  disabled={busy}
                />
              ) : (
                <p className="flex items-start gap-2 rounded-2xl bg-secondary/70 px-3 py-2.5 text-label leading-snug text-muted-foreground">
                  <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  정한 것이 없어 전략 회의실 지시는 보내지 않아요 — 회의 중 채팅 옆 핀을 누르면 정한 것으로 남아요
                </p>
              )}
              {absent.length > 0 && (
                <WrapOption
                  icon={<BellRing className="h-4 w-4" />}
                  title={`못 오신 ${absent.length}분께 회의 요약 알림`}
                  sub={peopleLine(absent)}
                  checked={toAbsent}
                  onChange={setToAbsent}
                  disabled={busy}
                />
              )}
            </div>
          )}
        </>
      )}
    </DmSheet>
  );
};

/* ───────────── 줌 · 구글 미트 링크 ───────────── */

/** 링크 열기 — 아이폰 앱은 앱 안 사파리 창(거기서 줌 · 미트 앱으로), 그 밖은 새 창 */
const openMeetingLink = (url: string) => {
  if (isIosApp()) void loadIosAppNative().then((n) => n.openInAppBrowser(url));
  else window.open(url, "_blank", "noopener,noreferrer");
};

/** 회의 화면 — 링크가 있으면 '줌 회의 들어가기' (대표님 · 지점장은 '바꾸기') */
export const MeetingLinkBar = ({ url, canEdit, onEdit }: { url: string; canEdit: boolean; onEdit: () => void }) => {
  const kind = meetingLinkKind(url);
  return (
    <div className="mx-auto flex w-full max-w-lg items-center gap-2 px-3 py-2">
      <button
        type="button"
        onClick={() => openMeetingLink(url)}
        className={cn(
          "flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-label font-black text-white active:scale-[0.99]",
          kind === "meet" ? "bg-[#00897B]" : "bg-[#2D8CFF]",
        )}
      >
        <Video className="h-4 w-4 shrink-0" />
        <span className="truncate">{MEETING_LINK_LABEL[kind]} 회의 들어가기</span>
      </button>
      {canEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="h-10 shrink-0 rounded-full bg-secondary px-3.5 text-label font-black text-foreground active:scale-95"
        >
          바꾸기
        </button>
      )}
    </div>
  );
};

/** 링크 넣기 · 바꾸기 · 빼기 — 대표님 · 지점장 */
export const MeetingLinkSheet = ({
  open,
  onClose,
  meetingId,
  current,
  suggest,
}: {
  open: boolean;
  onClose: () => void;
  meetingId: string;
  current: string | null;
  /** 지난번 회의에 쓴 링크 (눌러서 넣기) */
  suggest?: string | null;
}) => {
  const setLink = useSetMeetingLink();
  const [text, setText] = useState("");
  useEffect(() => {
    if (open) setText(current ?? "");
  }, [open, current]);
  const parsed = extractMeetingLink(text);
  const save = (url: string) =>
    setLink.mutate(
      { meetingId, url },
      {
        onSuccess: (v) => {
          toast.success(v ? `${MEETING_LINK_LABEL[meetingLinkKind(v)]} 링크를 넣었어요` : "링크를 뺐어요");
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  return (
    <DmSheet
      open={open}
      onClose={onClose}
      title="줌 · 구글 미트 링크"
      subtitle="넣으면 회의 화면에 '회의 들어가기' 버튼이 생기고 채팅에 안내가 한 줄 남아요."
      footer={
        <div className="flex gap-2">
          {current && (
            <button
              type="button"
              disabled={setLink.isPending}
              onClick={() => save("")}
              className="h-12 shrink-0 rounded-2xl bg-secondary px-4 text-label font-black text-foreground active:scale-[0.99] disabled:opacity-60"
            >
              링크 빼기
            </button>
          )}
          <button
            type="button"
            disabled={typeof parsed !== "string" || setLink.isPending}
            onClick={() => typeof parsed === "string" && save(parsed)}
            className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-primary text-body font-black text-primary-foreground active:scale-[0.99] disabled:opacity-40"
          >
            {setLink.isPending ? "넣는 중…" : "넣기"}
          </button>
        </div>
      }
    >
      <MeetingLinkField value={text} onChange={setText} parsed={parsed} suggest={current ? null : suggest} />
    </DmSheet>
  );
};

/** 링크 칸 — 줌 초대 글을 통째로 붙여 넣어도 링크만 골라 보여 준다. suggest = 지난번 링크(눌러야 들어간다) */
export const MeetingLinkField = ({
  value,
  onChange,
  parsed,
  hint,
  suggest,
}: {
  value: string;
  onChange: (v: string) => void;
  parsed: string | null | "bad";
  hint?: string;
  suggest?: string | null;
}) => (
  <>
    <Label hint={hint ?? "줌 초대 글을 통째로 붙여 넣어도 돼요"}>줌 · 구글 미트 링크</Label>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode="url"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      placeholder="https://zoom.us/j/… 또는 meet.google.com/…"
      className={inputCls}
    />
    {parsed === "bad" ? (
      <p className="mt-1.5 text-label font-bold text-destructive">{MEETING_LINK_BAD}</p>
    ) : parsed && parsed !== value.trim() ? (
      <p className="mt-1.5 break-all text-label font-semibold text-muted-foreground">넣을 링크: {parsed}</p>
    ) : suggest && !value.trim() ? (
      <button
        type="button"
        onClick={() => onChange(suggest)}
        className="mt-2 flex max-w-full items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-label font-bold text-foreground active:scale-95"
      >
        <Video className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">지난번 {MEETING_LINK_LABEL[meetingLinkKind(suggest)]} 링크 쓰기</span>
      </button>
    ) : null}
  </>
);

/* ───────────── 회의 열기 ───────────── */

export const OpenMeetingSheet = ({
  open,
  onClose,
  branch,
  label,
  lastLink,
  onOpened,
}: {
  open: boolean;
  onClose: () => void;
  branch: string;
  label: string;
  /** 지난번 회의에 쓴 줌 · 구글 미트 링크 — 미리 채운다 */
  lastLink?: string | null;
  /** 열린 뒤 (회의실 화면으로 가기 등) */
  onOpened?: (meetingId: string) => void;
}) => {
  const openMeeting = useOpenMeeting();
  const setLink = useSetMeetingLink();
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<string[]>(["", "", ""]);
  const [link, setLinkText] = useState("");

  useEffect(() => {
    if (open) {
      setTitle("");
      setItems(["", "", ""]);
      setLinkText("");
    }
  }, [open]);

  const parsedLink = extractMeetingLink(link);
  const busy = openMeeting.isPending || setLink.isPending;

  const submit = async () => {
    const t = title.trim();
    if (!t || busy || parsedLink === "bad") return;
    let id: string;
    try {
      id = await openMeeting.mutateAsync({ branch, title: t, agenda: items.map((s) => s.trim()).filter(Boolean).slice(0, 5) });
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }
    // 링크는 회의가 열린 다음에 (안 들어가도 회의는 열려 있다 — 회의 화면에서 다시 넣을 수 있다)
    if (parsedLink) {
      await setLink
        .mutateAsync({ meetingId: id, url: parsedLink })
        .catch((e) => toast.error(`회의는 열었어요 — ${(e as Error).message}`));
    }
    toast.success("회의를 열었어요 — 지도진에게 알림을 보냈어요");
    onClose();
    onOpened?.(id);
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
          onClick={() => void submit()}
          disabled={!title.trim() || busy || parsedLink === "bad"}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-body font-black text-primary-foreground active:scale-[0.99] disabled:opacity-40"
        >
          {busy ? "여는 중…" : "회의 열기"}
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
            <span className="w-4 shrink-0 text-center text-label font-black text-primary">{i + 1}</span>
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
            className="flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-label font-bold text-muted-foreground active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" /> 항목 더하기
          </button>
        )}
      </div>
      <MeetingLinkField
        value={link}
        onChange={setLinkText}
        parsed={parsedLink}
        hint="선택 · 바깥 분과 함께할 때만"
        suggest={lastLink}
      />
    </DmSheet>
  );
};

/* ───────────── 지난 회의록 ───────────── */

/** 회의록 — 3줄 요약 (대표님 · 지점장: 만들기 · 다시 정리) */
const RecapSummary = ({ meetingId }: { meetingId: string }) => {
  const { data: r } = useOfficeRecap(meetingId);
  const make = useSummarizeMeeting();
  if (!r) return null;
  const run = () =>
    make.mutate(meetingId, {
      onSuccess: () => toast.success("오삼코치가 3줄로 정리했어요"),
      onError: (e) => toast.error((e as Error).message),
    });
  if (!r.summary?.length) {
    if (!r.host || r.talk < 2) return null;
    return (
      <button
        type="button"
        onClick={run}
        disabled={make.isPending}
        className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-primary/50 bg-primary/5 py-2.5 text-label font-black text-primary active:scale-[0.99] disabled:opacity-60"
      >
        <Sparkles className="h-4 w-4" /> {make.isPending ? "오삼코치가 정리하는 중…" : "오삼코치 3줄 요약 만들기"}
      </button>
    );
  }
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center gap-2">
        <p className="flex min-w-0 flex-1 items-center gap-1 text-label font-black text-primary">
          <Sparkles className="h-3.5 w-3.5 shrink-0" /> {r.summary_by === "ai" ? "오삼코치 3줄 요약" : "회의 요약"}
        </p>
        {r.host && (
          <button
            type="button"
            onClick={run}
            disabled={make.isPending}
            className="shrink-0 rounded-full bg-background px-2.5 py-1 text-micro font-bold text-muted-foreground active:scale-95 disabled:opacity-60"
          >
            {make.isPending ? "정리하는 중…" : "다시 정리"}
          </button>
        )}
      </div>
      <ul className="mt-1.5 space-y-1 text-label leading-relaxed text-foreground">
        {r.summary.map((line, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-primary" />
            <span className="break-words">{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/** 회의록 — 전략 회의실 지시(확인 n/n) · 못 오신 분 알림. 안 보냈으면 대표님 · 지점장이 여기서 보낸다 (회의마다 한 번) */
const RecapFollowUp = ({ meetingId }: { meetingId: string }) => {
  const { data: r } = useOfficeRecap(meetingId);
  const wrap = useWrapUpMeeting();
  const navigate = useNavigate();
  if (!r) return null;
  const canSend = r.host && r.closed && !wrap.isPending;
  const send = (what: "directive" | "recap") =>
    wrap.mutate(
      { meetingId, directive: what === "directive", recap: what === "recap" },
      {
        onSuccess: (res) =>
          toast.success(
            what === "directive"
              ? "전략 회의실에 지시를 보냈어요"
              : res.recap_to > 0
                ? `못 오신 ${res.recap_to}분께 요약을 보냈어요`
                : "못 오신 분이 없어요",
          ),
        onError: (e) => toast.error((e as Error).message),
      },
    );
  const sendBtn = "flex w-full items-center justify-center gap-1.5 rounded-2xl border border-border bg-background py-2.5 text-label font-black text-foreground active:scale-[0.99] disabled:opacity-60";
  const rows: ReactNode[] = [];
  if (r.directive) {
    rows.push(
      <div key="d" className="flex items-center gap-3 rounded-2xl bg-secondary/70 px-3 py-2.5">
        <ClipboardCheck className="h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-label font-black text-foreground">전략 회의실 지시로 보냈어요</p>
          <p className="text-label font-semibold text-muted-foreground">
            확인 {r.directive.acked}/{r.directive.targets}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/messages?tab=strategy")}
          className={cn(
            "h-9 shrink-0 rounded-full px-3.5 text-label font-black active:scale-95",
            r.directive.to_ack ? "bg-primary text-primary-foreground" : "bg-background text-foreground",
          )}
        >
          {r.directive.to_ack ? "확인하러 가기" : "보기"}
        </button>
      </div>,
    );
  } else if (r.host && r.closed && r.decisions > 0) {
    rows.push(
      <button key="d" type="button" disabled={!canSend} onClick={() => send("directive")} className={sendBtn}>
        <ClipboardCheck className="h-4 w-4 text-primary" /> 정한 것 {r.decisions}가지를 전략 회의실 지시로 보내기
      </button>,
    );
  }
  if (r.recap_at && (r.recap_to ?? 0) > 0) {
    rows.push(
      <p key="r" className="flex items-center gap-1.5 px-1 text-label font-semibold text-muted-foreground">
        <BellRing className="h-3.5 w-3.5 shrink-0" /> 못 오신 {r.recap_to}분께 요약 알림을 보냈어요 · {officeTime(r.recap_at)}
      </p>,
    );
  } else if (r.host && r.closed && !r.recap_at && r.absent.length > 0) {
    rows.push(
      <button key="r" type="button" disabled={!canSend} onClick={() => send("recap")} className={sendBtn}>
        <BellRing className="h-4 w-4 text-primary" /> 못 오신 {r.absent.length}분께 회의 요약 보내기
      </button>,
    );
  }
  return rows.length ? <div className="space-y-2">{rows}</div> : null;
};

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
      {q.isError ? (
        <p className="py-8 text-center text-label leading-relaxed text-muted-foreground">
          {(q.error as Error | null)?.message ?? "회의록을 불러오지 못했어요"}
        </p>
      ) : q.isLoading || !d ? (
        <div className="space-y-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-2xl bg-secondary" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {d.meeting.agenda.length > 0 && (
            <ol className="space-y-1 rounded-2xl bg-secondary/70 px-3 py-2.5 text-label leading-relaxed text-foreground">
              {d.meeting.agenda.map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 font-black text-primary">{i + 1}</span>
                  <span className="break-words">{item}</span>
                </li>
              ))}
            </ol>
          )}
          <div>
            <p className="text-label font-bold text-muted-foreground">참석 {d.meeting.attendees.length}명</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {d.meeting.attendees.map((a) => (
                <span
                  key={a.user_id}
                  className="rounded-full border border-border bg-background px-2 py-[3px] text-micro font-bold text-foreground"
                >
                  {officeName(a)} <span className="font-semibold text-muted-foreground">{officeTime(a.first_joined_at)}</span>
                </span>
              ))}
            </div>
          </div>
          {meetingId && <RecapSummary meetingId={meetingId} />}
          <Decisions messages={messages} />
          {meetingId && <RecapFollowUp meetingId={meetingId} />}
          <div className="rounded-2xl bg-background p-3">
            {messages.length ? (
              <MessageList messages={messages} />
            ) : (
              <p className="py-4 text-center text-label text-muted-foreground">남긴 말이 없어요</p>
            )}
          </div>
        </div>
      )}
    </DmSheet>
  );
};
