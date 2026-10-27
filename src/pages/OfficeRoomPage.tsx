/**
 * 🏢 지점 회의실 — 회의실 화면 /office/room
 *   (2026-10-27 대표님: "회의실 화면을 보면서 채팅창을 입력하면 말풍선으로 대화가 나오게 —
 *    진짜 회의 하는 것처럼 채팅창이랑 화면이랑 한 화면에 같이 보이게")
 *
 *   위    — 회의실을 크게 본 사무실 그림. 들어온 사람이 탁자에 앉고, 채팅에 쓴 말이 그 사람 머리 위 말풍선으로 몇 초 뜬다
 *           (옆사람과 겹치면 먼저 한 말이 위로 올라가 한 줄 + 이름표). 쓰고 있는 사람 머리 옆에는 '…'.
 *           '사무실 전체'를 누르면 사무실 전체(책상에 앉은 사람 · 상태 말풍선)를 본다.
 *   가운데 — 안건 · 정한 것(눌러서 펼침) · 채팅
 *   아래  — 입력창 (대표님 · 지점장은 '정한 것' 핀을 켜고 보내기)
 *
 *   들어오면 회의에 참석(office_join_meeting) — 나가기는 '나가기'(내 자리로), 대표님 · 지점장은 '끝내기'.
 *   화면 높이 = 100dvh. 키보드가 올라오면 보이는 높이(visualViewport)에 맞춰 줄인다 — 아이폰 · 안드로이드 크롬은 키보드가
 *   화면을 덮어 그대로 두면 위 그림이 밀려 올라간다. 그림을 보면서 쓰는 화면이라 그때는 안건 띠를 접는다.
 *   하단 탭 · AI 버튼은 이 화면에서 숨긴다.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronUp, DoorOpen, Maximize2, Minimize2, Pin, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import OfficeScene, { type SceneTalk } from "@/components/office/OfficeScene";
import { Decisions, EndMeetingSheet, MessageList, MinutesSheet } from "@/components/office/OfficeMeeting";
import { sendOfficeTyping, useOfficeOnline, useOfficeTyping } from "@/lib/officePresence";
import { OFFICE_VIEW_ALL, OFFICE_VIEW_MEETING, officeViewAspect } from "@/lib/officeLayout";
import {
  officeDuration,
  readOfficeBranch,
  useJoinMeeting,
  useLeaveMeeting,
  useMarkDecision,
  useOfficeMessages,
  useOfficeState,
  useSendOfficeMessage,
  type OfficeMessage,
} from "@/services/officeService";

/** 말풍선이 떠 있는 시간 — 길게 쓸수록 조금 더 (최대 9초) */
const talkMs = (text: string) => Math.min(9000, 4200 + text.length * 60);

/** 쓰는 중 신호 간격 (받는 쪽은 4.5초 동안 '…') */
const TYPING_EVERY_MS = 2500;

/**
 * 키보드가 화면을 덮고 있으면 보이는 영역 { 높이, 위치 } — 아니면 null.
 *   아이폰(사파리 · 앱) · 안드로이드 크롬은 키보드가 페이지 높이를 줄이지 않고 덮는다 → 보이는 높이에 맞춰 화면을 줄인다.
 */
const useKeyboardViewport = () => {
  const [vv, setVv] = useState<{ h: number; top: number } | null>(null);
  useEffect(() => {
    const v = window.visualViewport;
    if (!v) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const full = Math.max(window.innerHeight, document.documentElement.clientHeight);
        const open = full - v.height > 120 && Math.abs(v.scale - 1) < 0.01;
        const h = Math.round(v.height);
        const top = Math.round(v.offsetTop);
        setVv((prev) => (!open ? null : prev && prev.h === h && prev.top === top ? prev : { h, top }));
      });
    };
    update();
    v.addEventListener("resize", update);
    v.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener("resize", update);
      v.removeEventListener("scroll", update);
    };
  }, []);
  return vv;
};

const OfficeRoomPage = () => {
  const navigate = useNavigate();
  const [branch] = useState<string | null>(readOfficeBranch);
  const stateQ = useOfficeState(branch);
  const state = stateQ.data;
  const presence = useOfficeOnline(state?.topic);
  const typing = useOfficeTyping(state?.topic);
  const kb = useKeyboardViewport();
  const meeting = state?.meeting ?? null;
  const me = state?.me ?? null;
  const host = state?.role === "host";
  const inRoom = !!meeting?.attendees.some((a) => a.user_id === me && a.in_room);

  // 끝난 뒤에도 방금 회의의 회의록을 열 수 있게
  const lastMeetingId = useRef<string | null>(null);
  if (meeting) lastMeetingId.current = meeting.id;

  const msgs = useOfficeMessages(meeting?.id ?? null, !!meeting);
  const messages = useMemo(() => msgs.data?.messages ?? [], [msgs.data]);
  const join = useJoinMeeting();
  const leave = useLeaveMeeting();
  const send = useSendOfficeMessage();
  const mark = useMarkDecision();

  // 실시간 접속 목록이 아직 안 왔으면 나만이라도 앉혀 둔다 (이 화면을 연 사람은 지금 들어와 있다)
  const online = useMemo(() => {
    if (!state) return presence.online;
    if (presence.online.has(state.me)) return presence.online;
    const s = new Set(presence.online);
    s.add(state.me);
    return s;
  }, [presence.online, state]);

  // ── 들어오면 회의에 참석 (회의마다 한 번) ──
  const joinTried = useRef<string | null>(null);
  useEffect(() => {
    if (!meeting || inRoom || joinTried.current === meeting.id) return;
    joinTried.current = meeting.id;
    join.mutate(meeting.id, { onError: (e) => toast.error((e as Error).message) });
  }, [meeting, inRoom, join]);

  // ── 머리 위 대화 말풍선 ──
  const [talk, setTalk] = useState<Record<string, SceneTalk>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const say = useCallback((uid: string, t: SceneTalk) => {
    setTalk((prev) => ({ ...prev, [uid]: t }));
    const old = timers.current.get(uid);
    if (old) clearTimeout(old);
    timers.current.set(
      uid,
      setTimeout(() => {
        setTalk((prev) => {
          if (prev[uid]?.id !== t.id) return prev;
          const next = { ...prev };
          delete next[uid];
          return next;
        });
        timers.current.delete(uid);
      }, talkMs(t.text)),
    );
  }, []);
  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  // 새로 온 말만 말풍선으로 — 화면을 열 때 있던 말은 마지막 한 마디만(2분 안에 한 말이면: 들어서자마자 지금 말하는 사람이 보이게).
  // 회의가 바뀌면 처음부터.
  const seen = useRef<Set<string> | null>(null);
  const seenFor = useRef<string | null>(null);
  useEffect(() => {
    if (!msgs.data || !meeting) return;
    if (seenFor.current !== meeting.id || !seen.current) {
      seenFor.current = meeting.id;
      seen.current = new Set(messages.map((m) => m.id));
      const last = [...messages].reverse().find((m) => m.kind !== "system");
      if (last && Date.now() - new Date(last.created_at).getTime() < 120_000) {
        say(last.author.user_id, { id: last.id, text: last.body, kind: last.kind === "decision" ? "decision" : "chat", at: Date.now() });
      }
      return;
    }
    const now = Date.now();
    let n = 0; // 한꺼번에 온 말은 뒤에 온 것이 더 최근
    for (const m of messages) {
      if (seen.current.has(m.id)) continue;
      seen.current.add(m.id);
      if (m.kind === "system") continue;
      say(m.author.user_id, { id: m.id, text: m.body, kind: m.kind === "decision" ? "decision" : "chat", at: now + n++ });
    }
  }, [messages, msgs.data, meeting, say]);

  // ── 보내기 — 내 말풍선은 바로 띄운다 ──
  const [text, setText] = useState("");
  const [asDecision, setAsDecision] = useState(false);
  // 쓰는 동안 2.5초마다 '쓰는 중' — 다 지우거나 보내면 그만 (내용은 보내지 않는다)
  const typingSent = useRef(0);
  const onType = (v: string) => {
    setText(v);
    const topic = state?.topic;
    if (!topic || !me || !meeting) return;
    if (!v.trim()) {
      if (typingSent.current) sendOfficeTyping(topic, me, false);
      typingSent.current = 0;
      return;
    }
    const now = Date.now();
    if (now - typingSent.current > TYPING_EVERY_MS) {
      typingSent.current = now;
      sendOfficeTyping(topic, me);
    }
  };
  const doSend = () => {
    const body = text.trim();
    if (!body || !meeting || send.isPending) return;
    const kind = asDecision ? "decision" : "chat";
    if (typingSent.current) sendOfficeTyping(state?.topic, me, false);
    typingSent.current = 0;
    if (me) say(me, { id: `me-${Date.now()}`, text: body, kind, at: Date.now() });
    setText("");
    setAsDecision(false);
    send.mutate(
      { meetingId: meeting.id, body, kind },
      {
        onSuccess: (r) => {
          if (r?.id) seen.current?.add(r.id);
        },
        onError: (e) => {
          toast.error((e as Error).message);
          setText(body);
        },
      },
    );
  };
  const pin = (m: OfficeMessage) =>
    mark.mutate({ messageId: m.id, on: m.kind !== "decision" }, { onError: (e) => toast.error((e as Error).message) });

  // ── 채팅 스크롤: 처음엔 맨 아래, 새 말은 바닥 근처에 있을 때만 따라 내려간다 ──
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const didInitialScroll = useRef(false);
  const onScroll = () => {
    const el = scrollRef.current;
    if (el) nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };
  const lastId = messages[messages.length - 1]?.id ?? "";
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !msgs.data) return;
    if (!didInitialScroll.current) {
      el.scrollTop = el.scrollHeight;
      didInitialScroll.current = true;
      return;
    }
    if (nearBottom.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [lastId, msgs.data]);
  // 키보드가 올라와 칸이 줄어도 바닥에 있던 사람은 바닥에
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (nearBottom.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── 화면 ──
  const [full, setFull] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [minutesId, setMinutesId] = useState<string | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const hereCount = meeting ? meeting.attendees.filter((a) => a.in_room && online.has(a.user_id)).length : 0;
  const decisions = messages.filter((m) => m.kind === "decision").length;

  const goOffice = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate("/office", { replace: true });
  };
  const leaveRoom = () => {
    if (!meeting) return goOffice();
    leave.mutate(meeting.id, {
      onSuccess: () => navigate("/office", { replace: true }),
      onError: (e) => toast.error((e as Error).message),
    });
  };

  return (
    // 평소 100dvh (아이폰은 상태바만큼 뺀다) — 키보드가 덮으면 보이는 영역에 붙여 그림 · 입력창이 함께 보이게
    <div
      className={cn("flex flex-col bg-background", kb ? "fixed inset-x-0 z-[60]" : "h-screen")}
      style={
        kb
          ? { top: kb.top, height: kb.h, paddingTop: "env(safe-area-inset-top, 0px)" }
          : { height: "calc(100dvh - env(safe-area-inset-top, 0px))" }
      }
    >
      {/* 머리글 */}
      <header className="z-30 shrink-0 border-b-[0.5px] border-black/[0.1] bg-background/[0.86] backdrop-blur-xl backdrop-saturate-[1.8] dark:border-white/[0.08]">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-3 py-2">
          <button
            type="button"
            onClick={goOffice}
            aria-label="사무실로"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary transition-transform active:scale-95"
          >
            <ChevronLeft className="h-5 w-5 text-secondary-foreground" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15.5px] font-black leading-tight text-foreground">{meeting?.title ?? "지점 회의실"}</p>
            <p className="truncate text-[11.5px] font-semibold text-muted-foreground">
              {state?.label ?? ""}
              {meeting
                ? ` · ${hereCount}명 참석 · ${officeDuration(meeting.opened_at, null)}째`
                : state
                  ? " · 열린 회의가 없어요"
                  : ""}
            </p>
          </div>
          {meeting && (
            <button
              type="button"
              disabled={leave.isPending}
              onClick={leaveRoom}
              className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-secondary px-3 text-[12.5px] font-black text-foreground active:scale-95 disabled:opacity-60"
              aria-label="회의 나가기 — 내 자리로"
            >
              <DoorOpen className="h-4 w-4" /> 나가기
            </button>
          )}
          {meeting && host && (
            <button
              type="button"
              onClick={() => setEndOpen(true)}
              className="flex h-9 shrink-0 items-center rounded-full bg-foreground px-3 text-[12.5px] font-black text-background active:scale-95"
            >
              끝내기
            </button>
          )}
        </div>
      </header>

      {/* 회의실 그림 — 말풍선이 여기 뜬다 */}
      <div className="mx-auto w-full max-w-lg shrink-0">
        {state ? (
          <div className="relative">
            <OfficeScene
              state={state}
              online={online}
              view={full ? OFFICE_VIEW_ALL : OFFICE_VIEW_MEETING}
              talk={talk}
              typing={typing}
              meetingLabel={false}
            />
            {/* 아래 오른쪽 — 위쪽은 말풍선 자리 */}
            <button
              type="button"
              onClick={() => setFull((v) => !v)}
              className="absolute bottom-2 right-2 z-[8] flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur active:scale-95"
            >
              {full ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
              {full ? "회의실 크게" : "사무실 전체"}
            </button>
          </div>
        ) : (
          <div className="w-full animate-pulse bg-secondary" style={{ aspectRatio: `${officeViewAspect(OFFICE_VIEW_MEETING)}` }} aria-hidden />
        )}
      </div>

      {/* 안건 · 정한 것 — 눌러서 펼침 (키보드가 올라와 있으면 접는다 — 그림 · 채팅 자리) */}
      {meeting && !kb && (
        <div className="mx-auto w-full max-w-lg shrink-0 border-b border-border/70 bg-card">
          <button
            type="button"
            onClick={() => setInfoOpen((v) => !v)}
            aria-expanded={infoOpen}
            className="flex w-full items-center gap-2 px-3.5 py-2 text-left"
          >
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-[2px] text-[11px] font-black text-primary">
              안건 {meeting.agenda.length}
            </span>
            {decisions > 0 && (
              <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-2 py-[2px] text-[11px] font-black text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                <Pin className="h-3 w-3" /> 정한 것 {decisions}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-muted-foreground">
              {meeting.agenda.length ? meeting.agenda.map((a, i) => `${i + 1}. ${a}`).join("  ") : meeting.title}
            </span>
            {infoOpen ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </button>
          {infoOpen && (
            <div className="max-h-[32vh] space-y-2.5 overflow-y-auto px-3.5 pb-3">
              {meeting.agenda.length > 0 && (
                <ol className="space-y-1 rounded-2xl bg-secondary/70 px-3 py-2.5 text-[13.5px] leading-relaxed text-foreground">
                  {meeting.agenda.map((item, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="shrink-0 font-black text-primary">{i + 1}</span>
                      <span className="break-words">{item}</span>
                    </li>
                  ))}
                </ol>
              )}
              <Decisions messages={messages} />
            </div>
          )}
        </div>
      )}

      {/* 채팅 */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="mx-auto min-h-0 w-full max-w-lg flex-1 overflow-y-auto overscroll-contain px-3.5 py-3"
      >
        {!state && stateQ.isError ? (
          <p className="py-8 text-center text-[13px] text-muted-foreground">
            {(stateQ.error as Error | null)?.message ?? "회의실에 들어올 수 없어요"}
          </p>
        ) : !meeting ? (
          state && (
            <div className="py-8 text-center">
              <p className="text-[15px] font-black text-foreground">
                {lastMeetingId.current ? "회의가 끝났어요" : "지금은 열린 회의가 없어요"}
              </p>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                {lastMeetingId.current ? "채팅 · 정한 것 · 참석이 회의록으로 남았어요" : "회의가 열리면 알림이 와요"}
              </p>
              <div className="mt-4 flex justify-center gap-2">
                {lastMeetingId.current && (
                  <button
                    type="button"
                    onClick={() => setMinutesId(lastMeetingId.current)}
                    className="rounded-2xl bg-foreground px-4 py-2.5 text-[13.5px] font-black text-background active:scale-95"
                  >
                    회의록 보기
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => navigate("/office", { replace: true })}
                  className="rounded-2xl bg-secondary px-4 py-2.5 text-[13.5px] font-black text-foreground active:scale-95"
                >
                  사무실로
                </button>
              </div>
            </div>
          )
        ) : msgs.isLoading ? (
          <div className="space-y-2" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 w-2/3 animate-pulse rounded-2xl bg-secondary" />
            ))}
          </div>
        ) : messages.length ? (
          <MessageList messages={messages} canPin={host} onPin={pin} />
        ) : (
          <p className="py-6 text-center text-[13px] leading-relaxed text-muted-foreground">
            첫 말을 남겨 회의를 시작해 보세요
            <br />
            쓴 말이 내 캐릭터 머리 위 말풍선으로 떠요
          </p>
        )}
      </div>

      {/* 입력창 */}
      {meeting && (
        <div className="shrink-0 border-t-[0.5px] border-black/[0.1] bg-card/95 px-3 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 backdrop-blur dark:border-white/[0.08]">
          <div className="mx-auto flex max-w-lg items-end gap-2">
            {host && (
              <button
                type="button"
                onClick={() => setAsDecision((v) => !v)}
                aria-pressed={asDecision}
                aria-label={asDecision ? "정한 것으로 보내기 켜짐" : "정한 것으로 보내기"}
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border active:scale-95",
                  asDecision
                    ? "border-amber-500 bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"
                    : "border-border bg-background text-muted-foreground",
                )}
              >
                <Pin className="h-4 w-4" />
              </button>
            )}
            <textarea
              value={text}
              onChange={(e) => onType(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  doSend();
                }
              }}
              rows={1}
              maxLength={1000}
              enterKeyHint="send"
              placeholder={asDecision ? "회의에서 정한 것을 한 줄로" : "말하기 — 머리 위 말풍선으로 떠요"}
              className="max-h-28 min-h-[44px] flex-1 resize-none rounded-2xl border border-border bg-background px-3 py-2.5 text-[15px] text-foreground outline-none focus:border-primary/60"
            />
            <button
              type="button"
              onClick={doSend}
              disabled={!text.trim() || send.isPending}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground active:scale-95 disabled:opacity-40"
              aria-label="보내기"
            >
              <Send className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      )}

      {meeting && (
        <EndMeetingSheet
          open={endOpen}
          onClose={() => setEndOpen(false)}
          meetingId={meeting.id}
          summary={`${meeting.title} · ${officeDuration(meeting.opened_at, null)} · 참석 ${meeting.attendees.length}명 · 정한 것 ${decisions}개`}
          onEnded={() => setMinutesId(meeting.id)}
        />
      )}
      <MinutesSheet meetingId={minutesId} onClose={() => setMinutesId(null)} />
    </div>
  );
};

export default OfficeRoomPage;
