/**
 * 📮 받은 오류 신고함 — 본사(super_admin·admin) 전용 (2026-10-18 대표님: "회원님들이 보낸 신고 자세히 볼 수 있게").
 *
 *   · 데이터: RPC get_app_feedback_inbox (보낸 회원 이름·지점·사진까지) · set_app_feedback_status (확인함 · 고쳤어요 · 다시 새 신고로).
 *   · 알림의 '바로 가기'는 /feedback?inbox=1&id=<신고> — 그 신고를 강조하고 화면 가운데로 데려온다.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, MonitorSmartphone, RotateCcw, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type FeedbackStatus = "new" | "seen" | "fixed";

export interface AppFeedbackItem {
  id: string;
  category: string;
  content: string;
  status: FeedbackStatus;
  page_path: string | null;
  device_info: string | null;
  created_at: string;
  handled_at: string | null;
  user_id: string;
  member_name: string;
  member_nickname: string | null;
  member_branch: string | null;
  member_avatar: string | null;
  handled_by_name: string | null;
}

export interface AppFeedbackInboxData {
  counts: { new: number; seen: number; fixed: number; all: number };
  items: AppFeedbackItem[];
}

export const APP_FEEDBACK_INBOX_KEY = ["app-feedback-inbox"] as const;

export function useAppFeedbackInbox(enabled: boolean) {
  return useQuery({
    queryKey: APP_FEEDBACK_INBOX_KEY,
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<AppFeedbackInboxData> => {
      // 새 RPC 는 생성 타입(types.ts)에 아직 없어 캐스팅으로 부른다
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("get_app_feedback_inbox", { p_limit: 200 });
      if (error) throw error;
      const d = (data ?? {}) as Partial<AppFeedbackInboxData>;
      return {
        counts: { new: 0, seen: 0, fixed: 0, all: 0, ...(d.counts ?? {}) },
        items: Array.isArray(d.items) ? d.items : [],
      };
    },
  });
}

const STATUS_META: Record<FeedbackStatus, { label: string; cls: string }> = {
  new: { label: "새 신고", cls: "bg-destructive/15 text-destructive" },
  seen: { label: "확인함", cls: "bg-status-pending/15 text-status-pending" },
  fixed: { label: "고쳤어요", cls: "bg-status-complete/15 text-status-complete" },
};

const CATEGORY_CLS: Record<string, string> = {
  오류: "bg-destructive/10 text-destructive",
  불편: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  제안: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
};

type Filter = "new" | "seen" | "fixed" | "all";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "new", label: "새 신고" },
  { key: "seen", label: "확인함" },
  { key: "fixed", label: "고쳤어요" },
  { key: "all", label: "전체" },
];

const shortBranch = (b: string | null) => (b ? b.replace(/^153복싱짐\s*/, "") : null);

const whenText = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/** 기기 정보(User-Agent)를 사람이 읽는 말로 — "Android 10 · 삼성 인터넷 30" */
export function deviceLabel(ua: string | null): string | null {
  if (!ua) return null;
  let os: string | null = null;
  const ios = ua.match(/(?:iPhone|iPad).*? OS (\d+)[_.]/);
  const android = ua.match(/Android (\d+(?:\.\d+)?)/);
  if (ios) os = `iPhone iOS ${ios[1]}`;
  else if (/iPhone|iPad/.test(ua)) os = "iPhone";
  else if (android) os = `Android ${android[1]}`;
  else if (/Windows/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "Mac";
  let browser: string | null = null;
  const pick = (re: RegExp, name: string) => {
    const m = ua.match(re);
    if (!browser && m) browser = m[1] ? `${name} ${m[1]}` : name;
  };
  pick(/KAKAOTALK(?:\/| )?(\d+)?/, "카카오톡");
  pick(/NAVER\((?:inapp|higgs)[^)]*\)/, "네이버 앱");
  pick(/Instagram ?(\d+)?/, "인스타그램");
  pick(/SamsungBrowser\/(\d+)/, "삼성 인터넷");
  pick(/EdgA?\/(\d+)/, "Edge");
  pick(/CriOS\/(\d+)/, "Chrome");
  if (!browser && /; wv\)/.test(ua)) browser = "앱 안 브라우저";
  pick(/Chrome\/(\d+)/, "Chrome");
  pick(/Version\/(\d+).*Safari/, "Safari");
  const out = [os, browser].filter(Boolean).join(" · ");
  return out || ua.slice(0, 60);
}

const Avatar = ({ src, name }: { src: string | null; name: string }) => {
  const [broken, setBroken] = useState(false);
  if (src && !broken)
    return <img src={src} alt="" onError={() => setBroken(true)} className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border/60" />;
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-label font-bold text-secondary-foreground">
      {name.slice(0, 1)}
    </span>
  );
};

const AppFeedbackInbox = ({ focusId }: { focusId?: string | null }) => {
  const qc = useQueryClient();
  const inbox = useAppFeedbackInbox(true);
  const counts = inbox.data?.counts;
  const [filter, setFilter] = useState<Filter | null>(null);
  // 알림에서 특정 신고를 열었으면 '전체'로, 아니면 새 신고가 있을 때 '새 신고'부터
  const active: Filter = filter ?? (focusId ? "all" : counts && counts.new > 0 ? "new" : "all");
  const items = useMemo(
    () => (inbox.data?.items ?? []).filter((it) => active === "all" || it.status === active),
    [inbox.data, active],
  );

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: FeedbackStatus }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("set_app_feedback_status", { p_id: id, p_status: status });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.status === "fixed" ? "고친 신고로 옮겼어요" : v.status === "seen" ? "확인했어요" : "새 신고로 돌렸어요");
      void qc.invalidateQueries({ queryKey: APP_FEEDBACK_INBOX_KEY });
    },
    onError: () => toast.error("바꾸지 못했어요 · 잠시 후 다시 눌러 주세요"),
  });

  // 알림 '바로 가기'로 온 신고는 화면 가운데로
  const focusRef = useRef<HTMLLIElement | null>(null);
  const scrolled = useRef(false);
  // 신고함이 열린 채로 다른 신고 알림을 누르면 focusId 만 바뀐다 (2026-10-19) — 고른 칸이 그 신고를 가리지 않게
  // 처음 열 때처럼('전체') 되돌리고, 다시 가운데로 데려온다. 처음 열 때는 아무것도 바꾸지 않는다.
  const lastFocus = useRef(focusId);
  useEffect(() => {
    if (lastFocus.current === focusId) return;
    lastFocus.current = focusId;
    scrolled.current = false;
    if (focusId) setFilter(null);
  }, [focusId]);
  // 방금 들어온 신고라 불러 둔 목록(30초 캐시)에 없으면 — 그 신고마다 한 번만 다시 불러온다
  const { data: inboxData, isFetching: inboxFetching, refetch: refetchInbox } = inbox;
  const refetchedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!focusId || !inboxData || inboxFetching || refetchedFor.current === focusId) return;
    if (inboxData.items.some((it) => it.id === focusId)) return;
    refetchedFor.current = focusId;
    void refetchInbox();
  }, [focusId, inboxData, inboxFetching, refetchInbox]);
  useEffect(() => {
    if (!focusId || scrolled.current || !focusRef.current) return;
    scrolled.current = true;
    focusRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusId, items]);

  if (inbox.isLoading)
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-body text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> 받은 신고를 불러오는 중…
      </div>
    );
  if (inbox.isError)
    return (
      <div className="rounded-2xl bg-card px-5 py-8 text-center shadow-elev-1">
        <p className="text-label font-bold text-foreground">받은 신고를 불러오지 못했어요</p>
        <button
          type="button"
          onClick={() => inbox.refetch()}
          className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-full bg-secondary px-4 text-label font-bold text-foreground active:scale-95"
        >
          <RotateCcw className="h-4 w-4" /> 다시 시도
        </button>
      </div>
    );

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="tablist" aria-label="신고 상태">
        {FILTERS.map((f) => {
          const n = counts ? counts[f.key] : 0;
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={active === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-label font-bold transition-colors",
                active === f.key ? "bg-foreground text-background" : "bg-secondary text-muted-foreground",
              )}
            >
              {f.label} <span className="tabular-nums opacity-80">{n}</span>
            </button>
          );
        })}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 px-5 py-10 text-center">
          <p className="text-label font-bold text-foreground">
            {active === "new" ? "새로 들어온 신고가 없어요" : "여기에 해당하는 신고가 없어요"}
          </p>
          <p className="mt-1 text-label text-muted-foreground">회원님이 신고를 보내면 알림이 오고 여기에 쌓여요</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((it) => {
            const focused = it.id === focusId;
            const st = STATUS_META[it.status] ?? STATUS_META.new;
            const device = deviceLabel(it.device_info);
            const busy = setStatus.isPending && setStatus.variables?.id === it.id;
            return (
              <li
                key={it.id}
                ref={focused ? focusRef : undefined}
                className={cn(
                  "rounded-2xl bg-card p-4 shadow-elev-1 ring-1 transition-shadow",
                  focused ? "ring-2 ring-primary" : "ring-border/60",
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className={cn("rounded-full px-2 py-0.5 text-micro font-bold", CATEGORY_CLS[it.category] ?? "bg-secondary text-foreground")}>
                    {it.category}
                  </span>
                  <span className={cn("rounded-full px-2 py-0.5 text-micro font-bold", st.cls)}>{st.label}</span>
                  <span className="ml-auto shrink-0 text-label tabular-nums text-muted-foreground">{whenText(it.created_at)}</span>
                </div>

                <div className="mt-3 flex items-center gap-2.5">
                  <Avatar src={it.member_avatar} name={it.member_name} />
                  <div className="min-w-0">
                    <p className="truncate text-label font-bold text-foreground">
                      {it.member_name}
                      {it.member_nickname && it.member_nickname !== it.member_name && (
                        <span className="ml-1 font-semibold text-muted-foreground">({it.member_nickname})</span>
                      )}
                    </p>
                    {it.member_branch && <p className="truncate text-label text-muted-foreground">{shortBranch(it.member_branch)}</p>}
                  </div>
                </div>

                <p className="mt-3 whitespace-pre-line break-words text-label leading-relaxed text-foreground">{it.content}</p>

                {(device || it.page_path) && (
                  <p className="mt-2.5 flex items-start gap-1.5 text-label leading-snug text-muted-foreground">
                    <MonitorSmartphone className="mt-px h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 break-words">{[device, it.page_path].filter(Boolean).join(" · ")}</span>
                  </p>
                )}
                {it.status !== "new" && (it.handled_by_name || it.handled_at) && (
                  <p className="mt-1 text-label text-muted-foreground">
                    {st.label}
                    {it.handled_by_name ? ` · ${it.handled_by_name}` : ""}
                    {it.handled_at ? ` · ${whenText(it.handled_at)}` : ""}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {it.status === "new" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setStatus.mutate({ id: it.id, status: "seen" })}
                      className="inline-flex h-9 items-center gap-1 rounded-full bg-secondary px-3.5 text-label font-bold text-foreground active:scale-95 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" /> 확인함
                    </button>
                  )}
                  {it.status !== "fixed" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setStatus.mutate({ id: it.id, status: "fixed" })}
                      className="inline-flex h-9 items-center gap-1 rounded-full bg-primary px-3.5 text-label font-bold text-primary-foreground active:scale-95 disabled:opacity-50"
                    >
                      <Wrench className="h-3.5 w-3.5" /> 고쳤어요
                    </button>
                  )}
                  {it.status !== "new" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setStatus.mutate({ id: it.id, status: "new" })}
                      className="inline-flex h-9 items-center gap-1 rounded-full bg-secondary px-3.5 text-label font-bold text-muted-foreground active:scale-95 disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> 새 신고로
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="px-1 pt-1 text-center text-label leading-relaxed text-muted-foreground">
        회원님이 보낸 신고는 운영진만 볼 수 있어요. 고친 뒤 '고쳤어요'를 눌러 두면 나중에 다시 찾기 쉬워요.
      </p>
    </div>
  );
};

export default AppFeedbackInbox;
