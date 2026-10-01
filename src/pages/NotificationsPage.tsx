/**
 * 🔔 알림함 — 공지 · 출석 · 수업 소식을 한곳에 (2026-10-01 대표님).
 *
 * 관리자 '전체 공지 발송'·출석 취소·수업 참여 알림이 notifications 에 쌓이기만 하고 회원 화면에 안 보였다.
 *   · 날짜별(오늘·어제·9월 30일 수요일)로 최신순. 30개씩, 아래 '이전 알림 더 보기'.
 *   · 이 화면을 열면 서버에는 바로 모두 읽음 처리 — 화면에 있는 동안은 새로 온 것을 민트로 강조해 둔다.
 *   · 링크가 있는 알림은 눌러서 그 화면으로, 없는 알림은 눌러서 내용을 펼친다.
 *   · 맨 위 휴대폰 알림 켜기 카드는 (2번) 웹 푸시에서 붙는다.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { AppPage, PageHeader } from "@/components/ui/rankingup";
import { useMarkNotificationsRead, useMyNotifications, useUnreadNotificationCount } from "@/hooks/useNotifications";
import { groupNotificationsByDay, notificationTime, type AppNotification } from "@/lib/notifications";
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
  return (
    <li>
      <button
        type="button"
        onClick={onTap}
        aria-expanded={long ? expanded : undefined}
        className={cn(
          "flex w-full gap-3 px-4 py-3.5 text-left transition-colors active:bg-secondary/70",
          fresh && "bg-primary/[0.06]",
        )}
      >
        <span
          className={cn(
            "relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            fresh ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground",
          )}
        >
          <Bell className="h-4 w-4" strokeWidth={2.2} />
          {fresh && (
            <span aria-label="새 알림" className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0 text-[14.5px] font-bold leading-snug text-foreground">{n.title}</span>
            <span className="shrink-0 pt-0.5 text-[11.5px] tabular-nums text-muted-foreground">{notificationTime(n.createdAt)}</span>
          </span>
          {n.body && (
            <span
              className={cn(
                "mt-0.5 block whitespace-pre-line break-words text-[13px] leading-relaxed text-muted-foreground",
                long && !expanded && "line-clamp-3",
              )}
            >
              {n.body}
            </span>
          )}
          {n.link ? (
            <span className="mt-1.5 inline-flex items-center gap-0.5 text-[12.5px] font-bold text-primary">
              바로 가기 <ChevronRight className="h-3.5 w-3.5" />
            </span>
          ) : long ? (
            <span className="mt-1 block text-[12px] font-semibold text-muted-foreground/80">{expanded ? "접기" : "더 보기"}</span>
          ) : null}
        </span>
      </button>
    </li>
  );
};

const NotificationsPage = () => {
  const navigate = useNavigate();
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
    const ids = new Set(items.filter((n) => !n.readAt).map((n) => n.id));
    setFresh(ids);
    // 첫 30개 밖에 안 읽은 게 남아 있을 수도 있어서, 안 읽은 수를 아직 모르면 그냥 부른다
    if (ids.size > 0 || unread.data !== 0) markAllRead(null);
  }, [fresh, list.isSuccess, items, unread.data, markAllRead]);

  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate("/home", { replace: true });
  };

  const onTap = (n: AppNotification) => {
    if (n.link) {
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
          subtitle="공지 · 출석 · 수업 소식"
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
        />
      }
    >
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
          <p className="text-[15px] font-bold text-foreground">알림을 불러오지 못했어요</p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">인터넷 연결을 확인하고 다시 시도해 주세요</p>
          <button
            type="button"
            onClick={() => list.refetch()}
            className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-full bg-secondary px-4 text-[13px] font-bold text-foreground active:scale-95"
          >
            <RotateCcw className="h-4 w-4" /> 다시 시도
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
            <Bell className="h-7 w-7 text-muted-foreground" />
          </span>
          <p className="mt-4 text-[15px] font-bold text-foreground">아직 알림이 없어요</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            공지 · 출석 · 수업 소식이 오면 여기에 모여요
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {days.map((d) => (
            <section key={d.key} aria-label={d.label}>
              <h2 className="mb-2 px-1 text-[13px] font-bold text-muted-foreground">{d.label}</h2>
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
              className="flex h-11 w-full items-center justify-center rounded-2xl bg-card text-[13.5px] font-bold text-foreground shadow-elev-1 active:scale-[0.99] disabled:opacity-60"
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
