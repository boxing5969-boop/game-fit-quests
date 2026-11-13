/**
 * 📅 캘린더 3-1단계 — 휴대폰 캘린더에서 (늘) 보기 시트 (2026-11-13 대표님 「추천대로 3-1부터」 · 「캘린더 3단계 보고서」)
 *
 *   주소 하나를 아이폰 · 구글 캘린더에 한 번 넣으면 153 일정이 저절로 들어간다(한 방향 · 알림 · 위젯은 그 앱 것).
 *     · 코치진: 153운영본부 「일정」 탭 맨 아래 '휴대폰 캘린더에서 보기' (kind staff)
 *     · 회원: 운동 달력 — 약속 시트 '늘 보기(구독)' · 나만의 체크 시트 맨 아래 (kind member)
 *   아이폰 · 아이패드 · 맥 = webcal 로 바로 '구독' · 안드로이드 · 삼성 · 컴퓨터 = 구글 캘린더 '추가' 화면(cid) ·
 *   주소 복사(구글 컴퓨터 'URL로 추가') · 파일로 받기(한 번만 — 네이버 캘린더 PC '가져오기').
 *   '캘린더가 방금 읽어 갔어요'로 연결을 확인한다(열려 있는 동안 15초마다 다시 읽음).
 *   새 주소 · 연결 끊기는 두 번 눌러서. 서버 · 주소 · 글은 services/calendarFeedService · lib/calendarFeed.
 */
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CalendarCheck, CalendarPlus, ChevronDown, Copy, Download, Link2, ShieldCheck } from "lucide-react";

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { copyText } from "@/lib/appInvite";
import { isIosApp, loadIosAppNative } from "@/lib/iosApp";
import {
  FEED_INCLUDES,
  FEED_POINTS,
  FEED_PRIVACY,
  FEED_SECRET,
  FEED_TIPS,
  FEED_TITLE,
  feedDevice,
  feedDownloadUrl,
  feedHttpsUrl,
  feedWebcalUrl,
  fetchedLine,
  googleAddUrl,
  type FeedDevice,
  type FeedKind,
  type FeedState,
} from "@/lib/calendarFeed";
import { useCalendarFeed, useCalendarFeedOff, useCalendarFeedOn } from "@/services/calendarFeedService";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

/** 바깥 주소 열기 — 아이폰 앱은 앱 안 사파리 창, 그 밖은 새 창(막히면 이 창) */
function openOutside(url: string) {
  if (isIosApp()) {
    void loadIosAppNative().then((n) => n.openInAppBrowser(url));
    return;
  }
  const w = window.open(url, "_blank", "noopener");
  if (!w) window.location.href = url;
}

/** 큰 줄 단추 */
const RowButton = ({
  icon,
  title,
  sub,
  onClick,
  primary = false,
}: {
  icon: ReactNode;
  title: string;
  sub?: string;
  onClick: () => void;
  primary?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-transform active:scale-[0.99]",
      primary ? "border-primary/40 bg-primary/5" : "border-border bg-card",
    )}
  >
    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", primary ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground")}>
      {icon}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-body font-bold text-foreground">{title}</span>
      {sub && <span className="mt-0.5 block text-label leading-snug text-muted-foreground">{sub}</span>}
    </span>
  </button>
);

/** 그리기만 — 화면 확인 · 시험용 (데이터는 아래 CalendarFeedSheet) */
export const CalendarFeedBody = ({
  kind,
  st,
  device,
  busy,
  onCreate,
  onRotate,
  onOff,
  onApple,
  onGoogle,
  onCopy,
  onDownload,
  now,
}: {
  kind: FeedKind;
  st: FeedState | null;
  device: FeedDevice;
  busy: boolean;
  onCreate: () => void;
  onRotate: () => void;
  onOff: () => void;
  onApple: () => void;
  onGoogle: () => void;
  onCopy: () => void;
  onDownload: () => void;
  now?: Date;
}) => {
  const [manage, setManage] = useState(false);
  const [confirm, setConfirm] = useState<"rotate" | "off" | null>(null);
  useEffect(() => {
    if (!confirm) return;
    const t = window.setTimeout(() => setConfirm(null), 4000);
    return () => window.clearTimeout(t);
  }, [confirm]);

  if (!st) {
    return (
      <div className="space-y-3" aria-hidden>
        <div className="h-16 animate-pulse rounded-2xl bg-muted" />
        <div className="h-16 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }
  if (!st.can) {
    return <p className="rounded-2xl bg-muted/60 px-4 py-4 text-body text-muted-foreground">이 계정은 아직 주소를 만들 수 없어요</p>;
  }

  if (!st.on) {
    return (
      <div className="space-y-4">
        <ul className="space-y-2.5 rounded-2xl bg-card px-4 py-4">
          {FEED_POINTS[kind].map((t) => (
            <li key={t} className="flex items-start gap-2 text-body leading-snug text-foreground">
              <CalendarCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onCreate}
          disabled={busy}
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-primary text-body font-black text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "만드는 중…" : "연결 주소 만들기"}
        </button>
        <p className="flex items-start gap-1.5 text-label leading-snug text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {FEED_SECRET}
        </p>
      </div>
    );
  }

  const fetched = !!st.lastFetchedAt;
  return (
    <div className="space-y-3">
      {device === "apple" ? (
        <>
          <RowButton primary icon={<CalendarCheck className="h-5 w-5" aria-hidden />} title="아이폰 캘린더에 추가" sub="'구독'을 누르면 끝이에요" onClick={onApple} />
          <RowButton icon={<CalendarPlus className="h-5 w-5" aria-hidden />} title="구글 캘린더에 추가" sub="구글 계정 캘린더로 볼 때" onClick={onGoogle} />
        </>
      ) : (
        <RowButton
          primary
          icon={<CalendarPlus className="h-5 w-5" aria-hidden />}
          title="구글 캘린더에 추가"
          sub="열린 화면에서 '추가' · 삼성 캘린더도 같이 보여요"
          onClick={onGoogle}
        />
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-label font-bold text-foreground active:scale-[0.98]"
        >
          <Copy className="h-4 w-4" aria-hidden /> 주소 복사
        </button>
        <button
          type="button"
          onClick={onDownload}
          className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-label font-bold text-foreground active:scale-[0.98]"
        >
          <Download className="h-4 w-4" aria-hidden /> 파일로 받기
        </button>
      </div>

      {/* 연결 확인 — 캘린더 앱이 읽어 가면 바뀐다 */}
      <div role="status" className={cn("flex items-start gap-2 rounded-2xl px-4 py-3", fetched ? "bg-primary/10" : "bg-card")}>
        <Link2 className={cn("mt-0.5 h-5 w-5 shrink-0", fetched ? "text-primary" : "text-muted-foreground")} aria-hidden />
        <p className={cn("min-w-0 flex-1 text-label font-bold leading-snug", fetched ? "text-foreground" : "text-muted-foreground")}>{fetchedLine(st, now)}</p>
      </div>

      {/* 다른 캘린더에 넣는 법 · 주소 관리 — 설명은 접어 둔다 */}
      <div className="rounded-2xl border border-border bg-card">
        <button
          type="button"
          onClick={() => setManage((v) => !v)}
          aria-expanded={manage}
          className="flex h-12 w-full items-center justify-between px-4 text-label font-bold text-foreground"
        >
          다른 캘린더 · 주소 관리
          <ChevronDown className={cn("h-4 w-4 transition-transform", manage && "rotate-180")} aria-hidden />
        </button>
        {manage && (
          <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
            <ul className="space-y-1.5">
              {FEED_TIPS.map((t) => (
                <li key={t} className="text-label leading-snug text-muted-foreground">
                  · {t}
                </li>
              ))}
            </ul>
            <p className="flex items-start gap-1.5 text-label leading-snug text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {FEED_PRIVACY[kind]}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => (confirm === "rotate" ? (setConfirm(null), onRotate()) : setConfirm("rotate"))}
              className="flex min-h-11 w-full items-center justify-center rounded-xl bg-secondary px-3 py-2 text-label font-bold text-foreground active:scale-[0.98] disabled:opacity-50"
            >
              {confirm === "rotate" ? "한 번 더 누르면 새 주소 — 옛 주소를 넣은 캘린더는 비어요" : "새 주소 만들기"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => (confirm === "off" ? (setConfirm(null), onOff()) : setConfirm("off"))}
              className="flex min-h-11 w-full items-center justify-center rounded-xl px-3 py-2 text-label font-bold text-destructive active:bg-destructive/10 disabled:opacity-50"
            >
              {confirm === "off" ? "한 번 더 누르면 연결을 끊어요 — 캘린더의 153 일정이 비어요" : "연결 끊기"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/** 시트 — open 동안만 서버를 읽는다 */
const CalendarFeedSheet = ({ open, onOpenChange, kind }: { open: boolean; onOpenChange: (v: boolean) => void; kind: FeedKind }) => {
  const q = useCalendarFeed(kind, open, open);
  const on = useCalendarFeedOn();
  const off = useCalendarFeedOff();
  const st = q.data && q.data.available ? q.data : q.data ? { ...q.data, can: false } : null;
  const url = feedHttpsUrl(SUPABASE_URL, st?.token ?? null);
  const device = feedDevice(typeof navigator !== "undefined" ? navigator.userAgent : "", isIosApp());
  const busy = on.isPending || off.isPending;

  const create = (rotate = false) =>
    on.mutate(
      { kind, rotate },
      {
        onSuccess: () => toast.success(rotate ? "새 주소를 만들었어요 — 캘린더에 다시 넣어 주세요" : "주소를 만들었어요 — 쓰시는 캘린더에 넣어 주세요"),
        onError: (e) => toast.error((e as Error).message),
      },
    );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="text-heading">{FEED_TITLE[kind]}</DrawerTitle>
          <DrawerDescription className="text-label">{FEED_INCLUDES[kind]}가 쓰시는 휴대폰 캘린더에 저절로 들어가요</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          {q.isError ? (
            <p className="rounded-2xl bg-muted/60 px-4 py-4 text-body text-muted-foreground">{(q.error as Error).message}</p>
          ) : (
            <CalendarFeedBody
              kind={kind}
              st={st}
              device={device}
              busy={busy}
              onCreate={() => create(false)}
              onRotate={() => create(true)}
              onOff={() =>
                off.mutate(kind, {
                  onSuccess: () => toast.success("연결을 끊었어요 — 캘린더가 다음에 읽을 때 153 일정이 비어요"),
                  onError: (e) => toast.error((e as Error).message),
                })
              }
              onApple={() => {
                if (!url) return;
                window.location.href = feedWebcalUrl(url);
              }}
              onGoogle={() => url && openOutside(googleAddUrl(url))}
              onCopy={() => {
                if (!url) return;
                void copyText(url).then((ok) => (ok ? toast.success("주소를 복사했어요") : toast.error("복사하지 못했어요 — 길게 눌러 복사해 주세요")));
              }}
              onDownload={() => {
                if (!url) return;
                if (isIosApp()) void loadIosAppNative().then((n) => n.openInAppBrowser(feedDownloadUrl(url)));
                else window.location.href = feedDownloadUrl(url);
              }}
            />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default CalendarFeedSheet;
