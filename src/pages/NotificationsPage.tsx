/**
 * 🔔 알림함 — 공지 · 출석 · 수업 소식을 한곳에 (2026-10-01 대표님).
 *
 * 관리자 '전체 공지 발송'·출석 취소·수업 참여 알림이 notifications 에 쌓이기만 하고 회원 화면에 안 보였다.
 *   · 날짜별(오늘·어제·9월 30일 수요일)로 최신순. 30개씩, 아래 '이전 알림 더 보기'.
 *   · 이 화면을 열면 서버에는 바로 모두 읽음 처리 — 화면에 있는 동안은 새로 온 것을 민트로 강조해 둔다.
 *   · 링크가 있는 알림은 눌러서 그 화면으로, 없는 알림은 눌러서 내용을 펼친다.
 *   · 맨 위 '휴대폰으로도 알림 받기' 카드 — 켜면 같은 알림이 휴대폰 알림으로도 온다 (components/notifications/PushOptInCard).
 *   · 알림을 열고 뒤로가기 = 다시 알림함 · 보던 자리 · 아직 안 연 새 알림 표시 그대로 (2026-11-19 회원 제안 — lib/inboxReturn).
 *     연(누른) 알림은 새 알림 표시를 끈다 — 여러 알림을 하나씩 볼 때 어디까지 봤는지 보이게.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { AppPage, PageHeader } from "@/components/ui/rankingup";
import PushOptInCard from "@/components/notifications/PushOptInCard";
import { useAuth } from "@/contexts/AuthContext";
import { useMarkNotificationsRead, useMyNotifications, useUnreadNotificationCount } from "@/hooks/useNotifications";
import { useAppUpdates } from "@/hooks/useAppUpdates";
import { groupNotificationsByDay, notificationTime, type AppNotification } from "@/lib/notifications";
import {
  historyIdx,
  inboxFresh,
  markInboxOpened,
  readInboxReturn,
  readInboxSeen,
  rememberInboxOpen,
  writeInboxSeen,
} from "@/lib/inboxReturn";
import { cn } from "@/lib/utils";

const LONG_BODY = 80;

const NotificationRow = ({
  n,
  fresh,
  expanded,
  onTap,
}: {
  n: AppNotification;
  fresh: boolean;
  expanded: boolean;
  onTap: () => void;
}) => {
  const long = !n.link && n.body.length > LONG_BODY;
  // 2026-10-28 리디자인: 줄마다 같던 종 그림 · '바로 가기' 줄을 빼고 — 새 알림 점 · 제목 16 · 내용 2줄 · 갈 곳이 있으면 오른쪽 ›
  return (
    <li>
      <button
        type="button"
        onClick={onTap}
        aria-expanded={long ? expanded : undefined}
        className={cn(
          "flex w-full items-center gap-3 py-3.5 pl-3 pr-4 text-left transition-colors active:bg-secondary/70",
          fresh && "bg-primary/[0.06]",
        )}
      >
        <span
          aria-label={fresh ? "새 알림" : undefined}
          className={cn("mt-2 h-2 w-2 shrink-0 self-start rounded-full", fresh ? "bg-primary" : "bg-transparent")}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 text-body font-bold leading-snug text-foreground">{n.title}</span>
            <span className="shrink-0 text-micro tabular-nums text-muted-foreground">{notificationTime(n.createdAt)}</span>
          </span>
          {n.body && (
            <span
              className={cn(
                "mt-0.5 block whitespace-pre-line break-words text-label leading-relaxed text-muted-foreground",
                (n.link || (long && !expanded)) && "line-clamp-2",
              )}
            >
              {n.body}
            </span>
          )}
          {!n.link && long && (
            <span className="mt-1 block text-label font-semibold text-muted-foreground/80">{expanded ? "접기" : "더 보기"}</span>
          )}
        </span>
        {n.link && <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-label="열기" />}
      </button>
    </li>
  );
};

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const { hasNew: updatesNew } = useAppUpdates();
  const list = useMyNotifications();
  const unread = useUnreadNotificationCount();
  const { mutate: markAllRead } = useMarkNotificationsRead();
  const items = useMemo(() => (list.data?.pages ?? []).flat(), [list.data]);
  const days = useMemo(() => groupNotificationsByDay(items), [items]);
  // 이 화면을 연 순간 안 읽었던 알림 — 서버는 바로 읽음 처리하고, 화면에선 머무는 동안 강조
  const [fresh, setFresh] = useState<ReadonlySet<string> | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    if (fresh !== null || !list.isSuccess) return;
    const unreadNow = items.filter((n) => !n.readAt).map((n) => n.id);
    // 알림을 열고 돌아온 길이면(30분 안) 처음 열었을 때의 새 알림 중 아직 안 연 것을 그대로 표시한다
    const { fresh: show, seen } = inboxFresh(readInboxSeen(uid), unreadNow);
    setFresh(show);
    writeInboxSeen(uid, seen);
    // 첫 30개 밖에 안 읽은 게 남아 있을 수도 있어서, 안 읽은 수를 아직 모르면 그냥 부른다
    if (unreadNow.length > 0 || unread.data !== 0) markAllRead(null);
  }, [fresh, list.isSuccess, items, unread.data, markAllRead, uid]);

  // 알림을 열고 돌아왔으면 보던 자리로 — 크롬은 스스로 돌려놓지만, 알림함을 다시 연 길(InboxReturnBridge)은 맨 위에서 열린다
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !list.isSuccess || items.length === 0) return;
    restored.current = true;
    const r = readInboxReturn();
    if (!r || r.scrollY <= 0 || historyIdx() !== r.inbox) return;
    const y = r.scrollY;
    const id = window.requestAnimationFrame(() => {
      if (Math.abs(window.scrollY - y) > 4) window.scrollTo(0, y);
    });
    return () => window.cancelAnimationFrame(id);
  }, [list.isSuccess, items.length]);

  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate("/home", { replace: true });
  };

  const onTap = (n: AppNotification) => {
    // 누른 알림은 '새 알림' 표시를 끈다 — 돌아와도 그대로 (여러 알림을 하나씩 볼 때 어디까지 봤는지)
    writeInboxSeen(uid, markInboxOpened(readInboxSeen(uid), n.id));
    setFresh((prev) => {
      if (!prev?.has(n.id)) return prev;
      const next = new Set(prev);
      next.delete(n.id);
      return next;
    });
    if (n.link) {
      rememberInboxOpen(); // 뒤로가기 = 다시 알림함 (InboxReturnBridge)
      navigate(n.link);
      return;
    }
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(n.id)) next.delete(n.id);
      else next.add(n.id);
      return next;
    });
  };

  return (
    <AppPage
      header={
        <PageHeader
          title="알림"
          sticky
          leftAction={
            <button
              type="button"
              onClick={goBack}
              aria-label="뒤로"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary transition-transform active:scale-95"
            >
              <ChevronLeft className="h-5 w-5 text-secondary-foreground" />
            </button>
          }
          // 공지사항(일일경영리포트에서 쓴 지점 공지 게시판)은 따로 — 2026-11-02
          rightAction={
            <button
              type="button"
              onClick={() => navigate(updatesNew ? "/notices?tab=updates" : "/notices")}
              aria-label={updatesNew ? "공지사항 — 새 앱 업데이트" : undefined}
              className="relative flex h-9 items-center rounded-full bg-secondary px-3.5 text-label font-bold text-secondary-foreground transition-transform active:scale-95"
            >
              공지사항
              {/* 아직 안 본 앱 업데이트 — 빨간 점만(휴대폰 알림 없음 · 2026-11-15) */}
              {updatesNew && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background" aria-hidden />}
            </button>
          }
        />
      }
    >
      <PushOptInCard variant="inbox" className="mb-4" />
      {list.isLoading ? (
        <ul className="space-y-2" aria-busy="true" aria-label="알림 불러오는 중">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex gap-3 rounded-2xl bg-card p-4 shadow-elev-1">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
              </div>
            </li>
          ))}
        </ul>
      ) : list.isError ? (
        <div className="rounded-2xl bg-card px-5 py-8 text-center shadow-elev-1">
          <p className="text-body font-bold text-foreground">알림을 불러오지 못했어요</p>
          <p className="mt-1 text-label text-muted-foreground">인터넷 연결을 확인하고 다시 시도해 주세요</p>
          <button
            type="button"
            onClick={() => list.refetch()}
            className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-full bg-secondary px-4 text-label font-bold text-foreground active:scale-95"
          >
            <RotateCcw className="h-4 w-4" /> 다시 시도
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
            <Bell className="h-7 w-7 text-muted-foreground" />
          </span>
          <p className="mt-4 text-body font-bold text-foreground">아직 알림이 없어요</p>
          <p className="mt-1 text-label leading-relaxed text-muted-foreground">
            공지 · 출석 · 수업 소식이 오면 여기에 모여요
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {days.map((d) => (
            <section key={d.key} aria-label={d.label}>
              <h2 className="mb-2 px-1 text-label font-bold text-muted-foreground">{d.label}</h2>
              <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl bg-card shadow-elev-1">
                {d.items.map((n) => (
                  <NotificationRow
                    key={n.id}
                    n={n}
                    fresh={!!fresh?.has(n.id)}
                    expanded={expanded.has(n.id)}
                    onTap={() => onTap(n)}
                  />
                ))}
              </ul>
            </section>
          ))}
          {list.hasNextPage && (
            <button
              type="button"
              onClick={() => list.fetchNextPage()}
              disabled={list.isFetchingNextPage}
              className="flex h-11 w-full items-center justify-center rounded-2xl bg-card text-label font-bold text-foreground shadow-elev-1 active:scale-[0.99] disabled:opacity-60"
            >
              {list.isFetchingNextPage ? "불러오는 중…" : "이전 알림 더 보기"}
            </button>
          )}
        </div>
      )}
    </AppPage>
  );
};

export default NotificationsPage;
