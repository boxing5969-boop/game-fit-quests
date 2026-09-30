/**
 * 메시지 대화방 — /messages/:threadId · /messages/to/:userId (아직 대화가 없는 사람에게 첫 메시지)
 *
 * · 4초마다 새 메시지를 읽는다(화면이 가려지면 멈춤). 최신 쪽을 읽으면 서버가 읽음 처리한다.
 * · 내 말풍선 = 먹색, 상대 = 흰 카드. 같은 사람 3분 안 메시지는 한 덩어리, 시각은 덩어리 끝에만.
 * · 이모지만 1~3개 → 말풍선 없이 크게. 링크는 누를 수 없는 글자로만 보인다(피싱 방지).
 * · 받은 요청: 수락 · 삭제(상대에게 알리지 않음) · 차단. 보낸 요청: 수락 전까지 1개만.
 * · ⋯ : 라이센스 보기(회원) · 신고하기(본사만 확인) · 차단 · 대화 나가기(내 화면에서만)
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, ChevronLeft, MoreHorizontal, Smile } from "lucide-react";
import { toast } from "sonner";

import {
  DM_KEY,
  useDmBlock,
  useDmPeer,
  useDmSummary,
  useDmThread,
  useHideDmThread,
  useRespondDm,
  useSendDm,
} from "@/hooks/useDm";
import { getDmThread, type DmMessage, type DmPerson } from "@/services/dmService";
import { absorbDmPage, dmBubbleTime, dmUntilLabel, layoutDmBubbles, mergeDmMessages, type DmBubbleView } from "@/lib/dmTime";
import { dmPersonLine } from "@/lib/dmPeople";
import { isEmojiOnly } from "@/lib/dmText";
import { openCredentialChange } from "@/lib/appEvents";
import { cn } from "@/lib/utils";
import { DmAvatar, DmKindBadge, DmSheet } from "@/components/dm/DmParts";
import DmReportSheet from "@/components/dm/DmReportSheet";
import MemberLicenseSheet from "@/components/license/MemberLicenseSheet";

const QUICK_EMOJI = ["🥊", "💪", "🔥", "👍", "👏", "🙏", "😂", "😊", "❤️", "🙌", "💯", "😭"] as const;
const MAX_LEN = 1000;

interface Pending {
  tempId: string;
  body: string;
  failed: boolean;
}

const goBackTo = (navigate: ReturnType<typeof useNavigate>, fallback: string) => {
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
  if (idx > 0) navigate(-1);
  else navigate(fallback, { replace: true });
};

// ── 말풍선 ───────────────────────────────────────────────────
const bubbleRadius = (mine: boolean, start: boolean, end: boolean) => {
  if (start && end) return "rounded-[20px]";
  if (mine) return start ? "rounded-[20px] rounded-br-md" : end ? "rounded-[20px] rounded-tr-md" : "rounded-[20px] rounded-r-md";
  return start ? "rounded-[20px] rounded-bl-md" : end ? "rounded-[20px] rounded-tl-md" : "rounded-[20px] rounded-l-md";
};

const Bubble = ({ v, peer, seen }: { v: DmBubbleView<DmMessage>; peer: DmPerson | null; seen: boolean }) => {
  const m = v.msg;
  const emoji = isEmojiOnly(m.body);
  return (
    <>
      {v.dayLabel && (
        <div className="my-3 flex justify-center">
          <span className="rounded-full bg-secondary px-3 py-1 text-[11.5px] font-semibold text-muted-foreground">{v.dayLabel}</span>
        </div>
      )}
      <div className={cn("flex items-end gap-2", m.mine ? "justify-end" : "justify-start", v.groupStart ? "mt-2.5" : "mt-[3px]")}>
        {!m.mine && (v.groupEnd ? <DmAvatar person={peer} size={28} /> : <span className="w-7 shrink-0" />)}
        <div className={cn("flex min-w-0 max-w-[76%] flex-col", m.mine ? "items-end" : "items-start")}>
          {emoji ? (
            <span className="px-0.5 text-[40px] leading-[1.15]">{m.body.trim()}</span>
          ) : (
            <span
              className={cn(
                "whitespace-pre-wrap px-3.5 py-2 text-[15px] leading-[1.42] [overflow-wrap:anywhere]",
                m.mine
                  ? "bg-foreground text-background"
                  : "bg-card text-foreground ring-1 ring-black/[0.05] dark:bg-secondary dark:ring-white/[0.06]",
                bubbleRadius(m.mine, v.groupStart, v.groupEnd),
              )}
            >
              {m.body}
            </span>
          )}
          {v.groupEnd && (
            <span className="mt-1 px-1 text-[10.5px] text-muted-foreground">
              {dmBubbleTime(m.created_at)}
              {seen ? " · 읽음" : ""}
            </span>
          )}
        </div>
      </div>
    </>
  );
};

// ── 화면 ────────────────────────────────────────────────────
const ThreadScreen = ({ threadId, toUserId }: { threadId: string | null; toUserId: string | null }) => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: summary } = useDmSummary();
  const thread = useDmThread(threadId);
  const peerQ = useDmPeer(toUserId, !threadId);
  const send = useSendDm();
  const respond = useRespondDm();
  const hide = useHideDmThread();
  const block = useDmBlock();

  // 첫 메시지 화면으로 왔는데 이미 대화가 있으면 그 대화로
  const existingThread = peerQ.data?.thread_id ?? null;
  useEffect(() => {
    if (!threadId && existingThread) navigate(`/messages/${existingThread}`, { replace: true });
  }, [threadId, existingThread, navigate]);

  const data = thread.data;
  const peer: DmPerson | null = data?.peer ?? peerQ.data?.peer ?? null;
  const name = peer?.display ?? "회원";

  // 받은 메시지를 쌓아 두는 곳. 최신 페이지(4초마다 새로 읽는 최근 40개)는 새 메시지가 오면 앞쪽이 밀려나므로
  // 한 번 받은 메시지는 여기 남긴다 — more = list 맨 앞보다 오래된 메시지가 더 있는지 (2026-09-30 검수)
  const [acc, setAcc] = useState<{ list: DmMessage[]; more: boolean; page: DmMessage[] | null }>({
    list: [],
    more: false,
    page: null,
  });
  const page = data?.messages ?? null;
  if (page && page !== acc.page) {
    // 새 페이지가 오면 그리는 중에 바로 합친다 (이전 값으로 상태를 맞추는 React 방식 — 한 번 더 그리고 끝, 깜빡임 없음)
    const next = absorbDmPage(acc.list, page, !!data?.has_more);
    setAcc({ list: next.list, more: next.reset ? !!data?.has_more : acc.more, page });
  }
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [licenseOpen, setLicenseOpen] = useState(false);

  const messages = acc.list;
  const views = useMemo(() => layoutDmBubbles(messages), [messages]);
  const hasMore = acc.more;
  const lastMsg = messages.length ? messages[messages.length - 1] : null;
  const seenLast =
    !!lastMsg?.mine && !!data?.other_read_at && Date.parse(data.other_read_at) >= Date.parse(lastMsg.created_at);

  // 보낼 수 있는지 — 대화가 있으면 대화 기준, 첫 메시지면 사람 기준
  const canSend = threadId ? !!data?.can_send : !!peerQ.data?.can_send;
  const reason = threadId ? data?.reason ?? null : peerQ.data?.reason ?? null;
  const reasonText = threadId ? data?.reason_text ?? null : peerQ.data?.reason_text ?? null;
  const suspendedUntil = data?.suspended_until ?? summary?.suspended_until ?? null;
  const firstSending = !threadId && pending.some((p) => !p.failed);

  // ── 스크롤: 처음엔 맨 아래, 새 메시지는 바닥 근처에 있을 때만 따라 내려간다 ──
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const didInitialScroll = useRef(false);
  const restore = useRef<{ h: number; top: number } | null>(null);
  const onScroll = () => {
    const el = scrollRef.current;
    if (el) nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
  };
  const lastKey = `${lastMsg?.id ?? 0}:${pending.length}`;
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!didInitialScroll.current) {
      if (data || peerQ.data) {
        el.scrollTop = el.scrollHeight;
        didInitialScroll.current = true;
      }
      return;
    }
    if (nearBottom.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [lastKey, data, peerQ.data]);
  // 이전 메시지를 위에 붙이면 보던 자리를 그대로
  const firstId = messages.length ? messages[0].id : 0;
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const r = restore.current;
    if (el && r) {
      el.scrollTop = el.scrollHeight - r.h + r.top;
      restore.current = null;
    }
  }, [firstId]);
  // 키보드가 올라와 화면이 줄어도 바닥에 있던 사람은 바닥에
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (nearBottom.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 새 메시지를 읽었으면 배지·받은함도 다시 — 나갈 때도 한 번
  const lastId = lastMsg?.id ?? 0;
  useEffect(() => {
    if (!threadId || !lastId) return;
    void qc.invalidateQueries({ queryKey: [...DM_KEY, "summary"] });
    void qc.invalidateQueries({ queryKey: [...DM_KEY, "threads"] });
  }, [threadId, lastId, qc]);
  // 화면을 떠났는지 — 떠난 뒤 끝난 첫 메시지 보내기가 다른 화면을 대화방으로 바꿔 버리지 않게
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      void qc.invalidateQueries({ queryKey: [...DM_KEY, "summary"] });
      void qc.invalidateQueries({ queryKey: [...DM_KEY, "threads"] });
    };
  }, [qc]);

  const loadOlder = async () => {
    if (!threadId || loadingOlder || !messages.length) return;
    setLoadingOlder(true);
    const el = scrollRef.current;
    try {
      const res = await getDmThread(threadId, messages[0].id, 40);
      restore.current = { h: el?.scrollHeight ?? 0, top: el?.scrollTop ?? 0 };
      setAcc((a) => ({ ...a, list: mergeDmMessages(res.messages, a.list), more: res.has_more }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "이전 메시지를 불러오지 못했어요");
    } finally {
      setLoadingOlder(false);
    }
  };

  // ── 보내기 ──
  const taRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [text]);
  const coarse = useMemo(
    () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(pointer: coarse)").matches,
    [],
  );

  const deliver = async (body: string, retryId?: string) => {
    const b = body.trim();
    if (!b) return;
    const id = retryId ?? `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setPending((p) => (retryId ? p.map((x) => (x.tempId === id ? { ...x, failed: false } : x)) : [...p, { tempId: id, body: b, failed: false }]));
    nearBottom.current = true;
    try {
      const res = await send.mutateAsync({ threadId, toUserId: threadId ? null : toUserId, body: b });
      setPending((p) => p.filter((x) => x.tempId !== id));
      if (!threadId) {
        if (alive.current) navigate(`/messages/${res.thread_id}`, { replace: true });
        return;
      }
      setAcc((a) => ({ ...a, list: mergeDmMessages(a.list, [res.message]) }));
    } catch (e) {
      setPending((p) => p.map((x) => (x.tempId === id ? { ...x, failed: true } : x)));
      toast.error(e instanceof Error ? e.message : "보내지 못했어요");
    }
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || !canSend || firstSending) return;
    const body = text;
    setText("");
    void deliver(body);
  };

  const insertEmoji = (em: string) => {
    const ta = taRef.current;
    const start = ta?.selectionStart ?? text.length;
    const end = ta?.selectionEnd ?? text.length;
    const next = (text.slice(0, start) + em + text.slice(end)).slice(0, MAX_LEN);
    setText(next);
    requestAnimationFrame(() => {
      const pos = Math.min(start + em.length, next.length);
      ta?.setSelectionRange(pos, pos);
    });
  };

  // ── 요청 수락·삭제·차단 ──
  const onAccept = async () => {
    if (!threadId) return;
    try {
      await respond.mutateAsync({ threadId, action: "accept" });
      toast.success("수락했어요 · 이제 대화할 수 있어요");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "처리하지 못했어요");
    }
  };
  const onDecline = async () => {
    if (!threadId) return;
    try {
      await respond.mutateAsync({ threadId, action: "decline" });
      toast.success("요청을 삭제했어요");
      goBackTo(navigate, "/messages?tab=requests");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "처리하지 못했어요");
    }
  };
  const onBlock = async (on: boolean) => {
    if (!peer) return;
    try {
      if (on && threadId && data?.needs_response) await respond.mutateAsync({ threadId, action: "decline" });
      await block.mutateAsync({ userId: peer.user_id, block: on, threadId });
      setMenuOpen(false);
      toast.success(on ? `${name}님을 차단했어요` : `${name}님 차단을 풀었어요`);
      if (on && data?.needs_response) goBackTo(navigate, "/messages?tab=requests");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "처리하지 못했어요");
    }
  };
  const onHide = async () => {
    if (!threadId) return;
    try {
      await hide.mutateAsync(threadId);
      toast.success("대화를 내 화면에서 지웠어요");
      goBackTo(navigate, "/messages");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "처리하지 못했어요");
    }
  };

  // ── 첫 화면 안내 — 아직 대화가 없는 사람에게 첫 메시지를 쓸 때만 (이미 있는 대화는 규칙이 다르다) ──
  const introText = (() => {
    if (!peer || threadId) return "";
    if (peer.kind === "member" && summary?.kind === "member")
      return `첫 메시지는 ${name}님의 메시지 요청함으로 가요. 수락하면 대화가 이어지고, 수락 전에는 1개만 보낼 수 있어요.`;
    if (peer.kind === "coach") return "코치님께 바로 전달돼요. 수업·운동 이야기를 편하게 남겨 보세요.";
    return `${name}님께 바로 전달돼요.`;
  })();

  const loadingFirst = threadId ? thread.isLoading : peerQ.isLoading;
  // 한 번 불러온 뒤의 잠깐 실패(4초마다 다시 읽다가 네트워크가 끊김)는 대화를 그대로 두고 아래 한 줄로만 알린다
  const loadError = threadId
    ? thread.isError && !data
    : (peerQ.isError && !peerQ.data) || (!!peerQ.data && !peerQ.data.can_open);
  const reconnecting = !!threadId && thread.isRefetchError;
  const errorText = threadId
    ? thread.error instanceof Error
      ? thread.error.message
      : "대화를 열 수 없어요"
    : peerQ.data?.reason_text ?? (peerQ.error instanceof Error ? peerQ.error.message : "메시지를 보낼 수 없는 사람이에요");

  return (
    // 100dvh = 키보드가 올라오면 줄어드는 높이 (모르는 브라우저는 h-screen)
    <div className="flex h-screen flex-col bg-background" style={{ height: "100dvh" }}>
      {/* 머리글 */}
      <header className="z-30 shrink-0 border-b-[0.5px] border-black/[0.1] bg-background/[0.86] backdrop-blur-xl backdrop-saturate-[1.8] dark:border-white/[0.08]">
        <div className="mx-auto flex max-w-lg items-center gap-2.5 px-3 py-2.5">
          <button
            type="button"
            onClick={() => goBackTo(navigate, "/messages")}
            aria-label="뒤로"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary transition-transform active:scale-95"
          >
            <ChevronLeft className="h-5 w-5 text-secondary-foreground" />
          </button>
          <button
            type="button"
            onClick={() => peer?.kind === "member" && setLicenseOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
            aria-label={peer?.kind === "member" ? `${name}님 라이센스 보기` : name}
          >
            <DmAvatar person={peer} size={38} />
            <span className="min-w-0">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-[16px] font-bold text-foreground">{peer ? name : " "}</span>
                <DmKindBadge kind={peer?.kind} />
              </span>
              <span className="block truncate text-[12px] text-muted-foreground">{dmPersonLine(peer)}</span>
            </span>
          </button>
          {threadId && data && (
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="대화 메뉴"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary transition-transform active:scale-95"
            >
              <MoreHorizontal className="h-5 w-5 text-secondary-foreground" />
            </button>
          )}
        </div>
      </header>
      {reconnecting && (
        <div className="shrink-0 bg-amber-500/10 py-1 text-center text-[11.5px] font-semibold text-amber-700 dark:text-amber-300" role="status">
          연결이 잠시 끊겼어요 · 다시 연결하는 중
        </div>
      )}

      {/* 메시지 */}
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-lg px-3 pb-3 pt-2">
          {loadingFirst ? (
            <div className="space-y-3 pt-6" aria-hidden>
              <div className="h-9 w-40 animate-pulse rounded-[20px] bg-muted" />
              <div className="ml-auto h-9 w-52 animate-pulse rounded-[20px] bg-muted" />
              <div className="h-9 w-32 animate-pulse rounded-[20px] bg-muted" />
            </div>
          ) : loadError ? (
            <div className="mt-10 rounded-3xl bg-card px-5 py-10 text-center shadow-elev-1">
              <p className="text-[15px] font-bold text-foreground">{errorText}</p>
              <button
                type="button"
                onClick={() => navigate("/messages", { replace: true })}
                className="mt-4 rounded-full bg-secondary px-4 py-2 text-[13px] font-bold active:scale-95"
              >
                메시지 목록으로
              </button>
            </div>
          ) : (
            <>
              {hasMore ? (
                <div className="flex justify-center py-2">
                  <button
                    type="button"
                    onClick={loadOlder}
                    disabled={loadingOlder}
                    className="rounded-full bg-secondary px-3.5 py-1.5 text-[12px] font-bold text-muted-foreground active:scale-95 disabled:opacity-60"
                  >
                    {loadingOlder ? "불러오는 중…" : "이전 메시지 더 보기"}
                  </button>
                </div>
              ) : (
                <div className={cn("flex flex-col items-center px-6 text-center", messages.length ? "pb-2 pt-4" : "pb-4 pt-10")}>
                  <DmAvatar person={peer} size={messages.length ? 64 : 84} />
                  <p className="mt-3 text-[17px] font-extrabold text-foreground">{name}</p>
                  <p className="text-[12.5px] text-muted-foreground">{dmPersonLine(peer)}</p>
                  {!messages.length && introText && (
                    <p className="mt-4 rounded-2xl bg-card px-4 py-3 text-[12.5px] leading-relaxed text-muted-foreground shadow-elev-1">
                      {introText}
                    </p>
                  )}
                </div>
              )}

              {views.map((v) => (
                <Bubble key={v.msg.id} v={v} peer={peer} seen={seenLast && v.msg.id === lastMsg?.id} />
              ))}

              {pending.map((p) => (
                <div key={p.tempId} className="mt-[3px] flex flex-col items-end">
                  <span
                    className={cn(
                      "max-w-[76%] whitespace-pre-wrap rounded-[20px] bg-foreground px-3.5 py-2 text-[15px] leading-[1.42] text-background [overflow-wrap:anywhere]",
                      p.failed ? "opacity-40" : "opacity-60",
                    )}
                  >
                    {p.body}
                  </span>
                  {p.failed ? (
                    <span className="mt-1 flex items-center gap-2 px-1 text-[11px]">
                      <span className="font-bold text-destructive">보내지 못했어요</span>
                      <button type="button" onClick={() => deliver(p.body, p.tempId)} className="font-bold text-foreground underline underline-offset-2">
                        다시 보내기
                      </button>
                      <button
                        type="button"
                        onClick={() => setPending((x) => x.filter((y) => y.tempId !== p.tempId))}
                        className="text-muted-foreground underline underline-offset-2"
                      >
                        지우기
                      </button>
                    </span>
                  ) : (
                    <span className="mt-1 px-1 text-[10.5px] text-muted-foreground">보내는 중…</span>
                  )}
                </div>
              ))}

              {reason === "awaiting_accept" && (
                <div className="mt-4 flex justify-center">
                  <span className="rounded-full bg-secondary px-3.5 py-1.5 text-center text-[11.5px] font-semibold text-muted-foreground">
                    {name}님이 수락하면 대화를 이어 갈 수 있어요
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 아래 — 받은 요청이면 수락·삭제·차단, 보낼 수 없으면 이유, 아니면 입력창 */}
      {!loadingFirst && !loadError && (
        data?.needs_response ? (
          <div className="shrink-0 border-t-[0.5px] border-black/[0.1] bg-card px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3.5 dark:border-white/[0.08]">
            <div className="mx-auto max-w-lg">
              <p className="text-[14px] font-bold text-foreground">{name}님이 메시지를 보냈어요</p>
              <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
                수락하면 대화가 시작되고 답장할 수 있어요. 삭제해도 상대에게 알리지 않아요.
              </p>
              <div className="mt-3 grid grid-cols-[1fr_1fr_1.4fr] gap-2">
                <button
                  type="button"
                  onClick={() => onBlock(true)}
                  disabled={block.isPending || respond.isPending}
                  className="h-11 rounded-xl bg-secondary text-[13.5px] font-bold text-destructive active:scale-[0.98] disabled:opacity-50"
                >
                  차단
                </button>
                <button
                  type="button"
                  onClick={onDecline}
                  disabled={respond.isPending}
                  className="h-11 rounded-xl bg-secondary text-[13.5px] font-bold text-foreground active:scale-[0.98] disabled:opacity-50"
                >
                  삭제
                </button>
                <button
                  type="button"
                  onClick={onAccept}
                  disabled={respond.isPending}
                  className="h-11 rounded-xl bg-primary text-[14px] font-extrabold text-primary-foreground active:scale-[0.98] disabled:opacity-50"
                >
                  수락
                </button>
              </div>
            </div>
          </div>
        ) : !canSend ? (
          <div className="shrink-0 border-t-[0.5px] border-black/[0.1] bg-card px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 dark:border-white/[0.08]">
            <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
              <p className="text-[12.5px] leading-snug text-muted-foreground">
                {reason === "suspended" && suspendedUntil
                  ? `신고 처리로 ${dmUntilLabel(suspendedUntil)}까지 메시지를 보낼 수 없어요`
                  : reason === "awaiting_accept"
                    ? "수락 전에는 메시지를 1개만 보낼 수 있어요"
                    : reasonText ?? "지금은 메시지를 보낼 수 없어요"}
              </p>
              {reason === "change_credentials" && (
                <button
                  type="button"
                  onClick={openCredentialChange}
                  className="shrink-0 rounded-full bg-primary px-3.5 py-2 text-[12.5px] font-bold text-primary-foreground active:scale-95"
                >
                  지금 바꾸기
                </button>
              )}
              {reason === "you_blocked" && (
                <button
                  type="button"
                  onClick={() => onBlock(false)}
                  disabled={block.isPending}
                  className="shrink-0 rounded-full bg-secondary px-3.5 py-2 text-[12.5px] font-bold text-foreground active:scale-95 disabled:opacity-50"
                >
                  차단 풀기
                </button>
              )}
            </div>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="shrink-0 border-t-[0.5px] border-black/[0.1] bg-card/95 px-3 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 backdrop-blur dark:border-white/[0.08]"
          >
            <div className="mx-auto max-w-lg">
              {emojiOpen && (
                <div className="-mx-1 mb-1.5 flex gap-0.5 overflow-x-auto pb-1" role="group" aria-label="이모지 넣기">
                  {QUICK_EMOJI.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => insertEmoji(em)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[22px] transition-transform active:scale-90"
                      aria-label={`${em} 넣기`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => setEmojiOpen((o) => !o)}
                  aria-pressed={emojiOpen}
                  aria-label="이모지"
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90",
                    emojiOpen ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground",
                  )}
                >
                  <Smile className="h-5 w-5" />
                </button>
                <textarea
                  ref={taRef}
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
                  onKeyDown={(e) => {
                    // 컴퓨터 키보드: Enter = 보내기, Shift+Enter = 줄바꿈 (한글 조합 중에는 보내지 않는다)
                    if (!coarse && e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  rows={1}
                  placeholder={messages.length ? "메시지 보내기…" : `${name}님께 첫 메시지…`}
                  aria-label="메시지 입력"
                  className="max-h-[120px] min-h-[40px] flex-1 resize-none rounded-[20px] bg-secondary px-4 py-[9px] text-[16px] leading-[1.35] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/35"
                />
                <button
                  type="submit"
                  disabled={!text.trim() || firstSending}
                  aria-label="보내기"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-90 disabled:opacity-35"
                >
                  <ArrowUp className="h-5 w-5" strokeWidth={2.6} />
                </button>
              </div>
              {text.length > MAX_LEN - 100 && (
                <p className="mt-1 text-right text-[11px] text-muted-foreground">
                  {text.length}/{MAX_LEN}
                </p>
              )}
            </div>
          </form>
        )
      )}

      {/* ⋯ 메뉴 */}
      <DmSheet open={menuOpen} onClose={() => setMenuOpen(false)} title={name} subtitle={dmPersonLine(peer)}>
        <ul className="space-y-2 pb-1">
          {peer?.kind === "member" && (
            <li>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setLicenseOpen(true);
                }}
                className="w-full rounded-2xl bg-secondary/60 px-4 py-3.5 text-left text-[14.5px] font-bold text-foreground active:scale-[0.99]"
              >
                라이센스 보기
              </button>
            </li>
          )}
          <li>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setReportOpen(true);
              }}
              className="w-full rounded-2xl bg-secondary/60 px-4 py-3.5 text-left active:scale-[0.99]"
            >
              <span className="block text-[14.5px] font-bold text-destructive">신고하기</span>
              <span className="block text-[12px] text-muted-foreground">본사만 확인하고, 상대에게는 알리지 않아요</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => onBlock(!data?.i_blocked)}
              disabled={block.isPending}
              className="w-full rounded-2xl bg-secondary/60 px-4 py-3.5 text-left active:scale-[0.99] disabled:opacity-50"
            >
              <span className="block text-[14.5px] font-bold text-foreground">{data?.i_blocked ? "차단 풀기" : "차단하기"}</span>
              <span className="block text-[12px] text-muted-foreground">
                {data?.i_blocked ? "다시 메시지를 주고받을 수 있어요" : "서로 메시지를 보낼 수 없어요 · 상대에게 알리지 않아요"}
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={onHide}
              disabled={hide.isPending}
              className="w-full rounded-2xl bg-secondary/60 px-4 py-3.5 text-left active:scale-[0.99] disabled:opacity-50"
            >
              <span className="block text-[14.5px] font-bold text-foreground">대화 나가기</span>
              <span className="block text-[12px] text-muted-foreground">내 화면에서만 지워져요 · 새 메시지가 오면 다시 보여요</span>
            </button>
          </li>
        </ul>
      </DmSheet>

      {threadId && (
        <DmReportSheet
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          threadId={threadId}
          peerName={name}
          onDone={(blocked) => {
            if (blocked) goBackTo(navigate, "/messages");
          }}
        />
      )}

      <MemberLicenseSheet
        userId={licenseOpen && peer?.kind === "member" ? peer.user_id : null}
        onClose={() => setLicenseOpen(false)}
        hideMessageButton
      />
    </div>
  );
};

const MessageThreadPage = () => {
  const { threadId, userId } = useParams<{ threadId?: string; userId?: string }>();
  // 대화가 바뀌면 화면 상태(이전 메시지·보내는 중)를 새로 시작한다
  return (
    <ThreadScreen
      key={threadId ? `t:${threadId}` : `u:${userId ?? ""}`}
      threadId={threadId ?? null}
      toUserId={threadId ? null : userId ?? null}
    />
  );
};

export default MessageThreadPage;
