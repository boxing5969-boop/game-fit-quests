/**
 * 🧾 내 결제 · 마일리지 내역 — 회원 본인 (2026-10-27 대표님: "회원님들 마일리지 사용 내역이랑 결제 내역 등등 자세히 볼 수 있도록 해 줘")
 *   여는 곳: 내정보 '결제 · 마일리지 내역' 줄 · 153 마일리지 카드 '전체 내역 보기'.
 *   결제 내역 — 앱 결제(결제 완료 · 취소 · 결제 대기) · 항목(수강권 · 운동복 · 락카)과 기간 · 마일리지 할인 · 결제 금액 · 카드.
 *   마일리지 내역 — 달마다 들어온 것 · 쓴 것, 50줄씩 더 보기.
 *   숫자 · 글은 services/myPayHistoryService 한 곳.
 */
import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Coins, ExternalLink, Loader2, Receipt } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useAuth } from "@/contexts/AuthContext";
import { useMyMileage, useMyMileageSavings } from "@/hooks/useMileage";
import MileageSavedBanner from "@/components/membership/MileageSavedBanner";
import { isIosApp, loadIosAppNative } from "@/lib/iosApp";
import {
  MILEAGE_PAGE,
  PAY_STATUS_TEXT,
  fetchMyMileageRows,
  fetchMyPayOrders,
  groupMileageByMonth,
  itemLabel,
  kstDateTimeText,
  mileageRowSub,
  mileageRowTitle,
  payTotals,
  shortYmd,
  type PayOrder,
} from "@/services/myPayHistoryService";
import { cn } from "@/lib/utils";

export type PayHistoryTab = "pay" | "mileage";

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const pts = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString("ko-KR")}`;
/** '2026-10-27T…' (KST) → '10.27' */
const md = (iso: string) => {
  const d = new Date(Date.parse(iso) + 9 * 3600_000);
  return `${d.getUTCMonth() + 1}.${d.getUTCDate()}`;
};

/** 결제 대기 링크 열기 — 아이폰 앱은 앱 안 사파리 창(카드사 앱 이동이 된다), 나머지는 이 창에서 (결제 확인 창과 같은 길) */
const openPay = async (url: string) => {
  if (isIosApp()) {
    await (await loadIosAppNative()).openInAppBrowser(url, () => window.location.reload());
  } else {
    window.location.href = url;
  }
};

const STATUS_STYLE: Record<PayOrder["status"], string> = {
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  canceled: "bg-muted text-muted-foreground",
  sent: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

const OrderCard = ({ o }: { o: PayOrder }) => {
  const canceled = o.status === "canceled";
  return (
    <li className="rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-center gap-2">
        <span className={cn("rounded-full px-2 py-0.5 text-micro font-black", STATUS_STYLE[o.status])}>{PAY_STATUS_TEXT[o.status]}</span>
        <span className="text-label tabular-nums text-muted-foreground">{kstDateTimeText(o.paidAt || o.createdAt)}</span>
      </div>
      <p className={cn("mt-1.5 text-body font-bold leading-snug text-foreground", canceled && "text-muted-foreground line-through")}>{o.productName}</p>

      {o.items.length > 0 && (
        <ul className="mt-2 space-y-1.5 rounded-xl bg-muted/40 px-3 py-2.5">
          {o.items.map((it, i) => (
            <li key={`${it.kind}-${i}`} className="flex items-start justify-between gap-2 text-label">
              <span className="min-w-0">
                <span className="block font-bold text-foreground">{itemLabel(it)}</span>
                {it.startDate && it.endDate && (
                  <span className={cn("block text-label tabular-nums text-muted-foreground", (canceled || it.reverted) && "line-through")}>
                    {shortYmd(it.startDate)} ~ {shortYmd(it.endDate)}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-bold tabular-nums text-foreground">{won(it.amount + it.mileageUsed)}</span>
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-2.5 space-y-1 text-label">
        {o.mileageUsed > 0 && (
          <>
            <div className="flex justify-between gap-2 text-muted-foreground">
              <dt>상품 금액</dt>
              <dd className="tabular-nums">{won(o.listPrice)}</dd>
            </div>
            <div className="flex justify-between gap-2 text-amber-700 dark:text-amber-400">
              <dt>153 마일리지 할인</dt>
              <dd className="font-bold tabular-nums">−{won(o.mileageUsed)}</dd>
            </div>
          </>
        )}
        <div className="flex justify-between gap-2 border-t border-border/60 pt-1.5">
          <dt className="font-bold text-foreground">{o.status === "sent" ? "결제할 금액" : "결제 금액"}</dt>
          <dd className={cn("text-body font-black tabular-nums text-foreground", canceled && "text-muted-foreground line-through")}>{won(o.amount)}</dd>
        </div>
        {o.card && o.status !== "sent" && <p className="text-right text-label text-muted-foreground">{o.card}</p>}
      </dl>

      {canceled && (
        <p className="mt-2 rounded-xl bg-muted/60 px-3 py-2 text-label leading-relaxed text-muted-foreground">
          취소 · 환불됐어요{o.canceledAt ? ` (${kstDateTimeText(o.canceledAt)})` : ""}. 늘었던 기간과 쓴 마일리지는 되돌렸어요.
        </p>
      )}
      {o.status === "sent" && o.shortUrl && (
        <button
          type="button"
          onClick={() => void openPay(o.shortUrl!)}
          className="mt-2.5 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-foreground text-label font-bold text-background active:scale-[0.98]"
        >
          이어서 결제하기 <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </li>
  );
};

const PayTab = ({ userId }: { userId: string }) => {
  const savings = useMyMileageSavings();
  const q = useQuery({
    queryKey: ["myPayHistory", "orders", userId],
    staleTime: 30_000,
    queryFn: () => fetchMyPayOrders(userId),
  });
  if (q.isLoading) return <div className="h-40 animate-pulse rounded-2xl bg-muted/60" aria-label="결제 내역을 불러오는 중" />;
  if (q.isError) {
    return (
      <div className="rounded-2xl bg-muted/50 p-4 text-center text-label text-muted-foreground">
        결제 내역을 불러오지 못했어요
        <button type="button" onClick={() => void q.refetch()} className="mt-2 block w-full rounded-xl bg-card py-2.5 font-bold text-foreground ring-1 ring-border">
          다시 불러오기
        </button>
      </div>
    );
  }
  const orders = q.data ?? [];
  const t = payTotals(orders);
  // 아낀 금액은 데스크 결제 할인까지 (2026-10-30) — 서버 값을 못 읽으면 앱 결제 것만
  const saved = savings.data ? savings.data.total : t.saved;
  return (
    <div className="space-y-3">
      {/* 결제가 하나도 없으면 0원 칸 두 개를 그리지 않는다 (2026-10-28 리디자인 — 빈 것은 그리지 않기) */}
      {orders.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-primary/10 px-3.5 py-3">
            <p className="text-label font-bold text-muted-foreground">앱으로 결제</p>
            <p className="mt-0.5 text-heading tabular-nums text-foreground">{won(t.paid)}</p>
            <p className="text-label text-muted-foreground">{t.count}건</p>
          </div>
          <div className="rounded-2xl bg-amber-500/10 px-3.5 py-3">
            <p className="text-label font-bold text-muted-foreground">마일리지로 아낌</p>
            <p className="mt-0.5 text-heading tabular-nums text-foreground">{won(saved)}</p>
            {(savings.data?.desk ?? 0) > 0 && <p className="text-label text-muted-foreground">데스크 할인 포함</p>}
          </div>
        </div>
      )}
      {orders.length === 0 ? (
        <p className="rounded-2xl bg-muted/50 px-4 py-6 text-center text-label text-muted-foreground">아직 앱으로 결제한 내역이 없어요</p>
      ) : (
        <ul className="space-y-2.5">
          {orders.map((o) => (
            <OrderCard key={o.id} o={o} />
          ))}
        </ul>
      )}
      <p className="text-label text-muted-foreground">데스크에서 결제한 내역은 지점장님께 물어봐 주세요</p>
    </div>
  );
};

const MileageTab = ({ userId }: { userId: string }) => {
  const { data: mine } = useMyMileage();
  const q = useInfiniteQuery({
    queryKey: ["myPayHistory", "mileage", userId],
    staleTime: 30_000,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchMyMileageRows(userId, pageParam),
    getNextPageParam: (last) => (last.length < MILEAGE_PAGE ? undefined : last[last.length - 1].at),
  });
  const rows = (q.data?.pages ?? []).flat();
  const months = groupMileageByMonth(rows);
  const thisMonth = months[0];
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-amber-500/10 px-3.5 py-3">
        <p className="flex items-center gap-1.5 text-label font-bold text-muted-foreground">
          <Coins className="h-4 w-4 text-amber-600" aria-hidden /> 지금 쓸 수 있는 마일리지
        </p>
        <p className="mt-0.5 text-title font-black tabular-nums text-foreground">
          {(mine?.balance ?? 0).toLocaleString("ko-KR")}
          <span className="ml-0.5 text-label font-bold text-muted-foreground">점</span>
        </p>
        {thisMonth && (
          <p className="text-label text-muted-foreground">
            {thisMonth.label} 들어온 것 <b className="tabular-nums text-foreground">{pts(thisMonth.plus)}</b> · 쓴 것{" "}
            <b className="tabular-nums text-foreground">{thisMonth.minus.toLocaleString("ko-KR")}</b>
          </p>
        )}
      </div>
      {/* 지금까지 아낀 금액 (2026-10-30 대표님 "배민처럼") — 할인받은 적이 있을 때만 */}
      <MileageSavedBanner variant="tile" />

      {q.isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-muted/60" aria-label="마일리지 내역을 불러오는 중" />
      ) : q.isError ? (
        <p className="rounded-2xl bg-muted/50 px-4 py-6 text-center text-label text-muted-foreground">마일리지 내역을 불러오지 못했어요</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl bg-muted/50 px-4 py-6 text-center text-label text-muted-foreground">아직 쌓인 마일리지가 없어요</p>
      ) : (
        <div className="space-y-3">
          {months.map((m) => (
            <section key={m.key} aria-label={m.label}>
              <div className="flex items-baseline justify-between px-1">
                <p className="text-label font-black text-foreground">{m.label}</p>
                <p className="text-label tabular-nums text-muted-foreground">
                  {pts(m.plus)}
                  {m.minus < 0 ? ` · ${m.minus.toLocaleString("ko-KR")}` : ""}
                </p>
              </div>
              <ul className="mt-1 divide-y divide-border/60 rounded-2xl border border-border bg-card px-3">
                {m.rows.map((r) => {
                  const sub = mileageRowSub(r);
                  return (
                    <li key={r.id} className="flex items-center gap-2.5 py-2.5">
                      <span className="w-11 shrink-0 text-label tabular-nums text-muted-foreground">{md(r.at)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-body font-semibold text-foreground">{mileageRowTitle(r)}</span>
                        {sub && <span className="block truncate text-label text-muted-foreground">{sub}</span>}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-body font-bold tabular-nums",
                          r.amount >= 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground",
                        )}
                      >
                        {pts(r.amount)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {q.hasNextPage && (
            <button
              type="button"
              onClick={() => void q.fetchNextPage()}
              disabled={q.isFetchingNextPage}
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-muted text-label font-bold text-foreground active:scale-[0.98] disabled:opacity-60"
            >
              {q.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              더 보기
            </button>
          )}
        </div>
      )}
      {/* 한 줄 — 1,000점 단위 · 취소하면 돌려받는 것은 결제 창에서 다시 알려 준다 */}
      <p className="text-label text-muted-foreground">결제할 때 1점 = 1원 · 결제 금액의 10%까지</p>
    </div>
  );
};

const MyPayHistorySheet = ({
  open,
  onOpenChange,
  initialTab = "pay",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialTab?: PayHistoryTab;
}) => {
  const { user } = useAuth();
  const [tab, setTab] = useState<PayHistoryTab>(initialTab);
  const [wasOpen, setWasOpen] = useState(open);
  // 열 때마다 부른 곳의 탭으로
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setTab(initialTab);
  }
  if (!user?.id) return null;
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="flex items-center gap-1.5 text-heading">
            <Receipt className="h-5 w-5 text-primary" aria-hidden /> 결제 · 마일리지 내역
          </DrawerTitle>
          {/* 화면 읽기 도구용 설명만 — 눈에 보이는 설명 줄은 두지 않는다 */}
          <DrawerDescription className="sr-only">결제한 것 · 취소한 것 · 마일리지가 들어오고 나간 것</DrawerDescription>
        </DrawerHeader>
        <div className="px-4">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="내역 고르기">
            {(
              [
                ["pay", "결제 내역"],
                ["mileage", "마일리지 내역"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={cn(
                  "h-11 rounded-lg text-body font-bold transition-colors",
                  tab === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          {tab === "pay" ? <PayTab userId={user.id} /> : <MileageTab userId={user.id} />}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default MyPayHistorySheet;
