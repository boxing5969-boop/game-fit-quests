/**
 * 🛍 153 마켓 — 운영진 주문함 · 상품 · 요청 (2026-11-17 · 관리자 화면 /manager?tab=market · 전체관리자 대시보드 「마켓」)
 *
 *   주문 흐름: 결제 전 → [결제 확인] → 결제 완료 → [발주했어요] → 주문 넣음 → [도착했어요] → 도착 → [전달했어요] → 받음
 *     · 회원 알림은 결제 확인 · 도착 · 취소 때만 간다(서버 market_admin_order_set).
 *     · 취소는 어느 단계에서든(결제 뒤면 환불 · 반품) — 사유를 적으면 회원 화면에 그대로 보인다.
 *   보이는 범위(서버가 정한다): 대표님 · 관리자 = 전 지점(지점 고르기) · 지점장 · 코치 = 자기 지점.
 *   도매가 · 남는 돈 · 상품 고치기는 대표님 · 관리자에게만(board.boss).
 *   예시 화면 ?demo=1 — 서버를 부르지 않는다(지어낸 회원 · 지어낸 가격).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import MarketProductsAdmin from "@/components/admin/MarketProductsAdmin";
import { OrderStatusChip } from "@/components/market/MarketParts";
import { shortBranch } from "@/lib/dmPeople";
import {
  boardGroups,
  boardTodoCount,
  MARKET_MILEAGE_PCT,
  marketMileageMax,
  mdOfTime,
  orderTitle,
  priceFlags,
  purchaseList,
  purchaseText,
  purchaseTotals,
  staffActions,
  won,
  type BoardGroup,
  type MarketBoard,
  type MarketOrder,
} from "@/lib/market153";
import { useMarketAdminActions, useMarketBoard, type OrderSetInput } from "@/services/marketService";
import { cn } from "@/lib/utils";

type PanelTab = "orders" | "products" | "wishes";

const inputCls =
  "h-11 w-full rounded-xl border border-border bg-card px-3.5 text-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";

// ── 주문 한 줄 ───────────────────────────────────────────────

const OrderRow = ({
  order,
  showBranch,
  busy,
  onSet,
}: {
  order: MarketOrder;
  showBranch: boolean;
  busy: boolean;
  onSet: (input: OrderSetInput, done: string) => Promise<boolean>;
}) => {
  const [mode, setMode] = useState<null | "cancel" | "memo" | "pay">(null);
  const [reason, setReason] = useState("");
  const [mileage, setMileage] = useState("");
  const [memo, setMemo] = useState(order.staffMemo ?? "");
  const actions = staffActions(order.status);
  const primary = actions.find((a) => a.kind === "primary");
  const back = actions.find((a) => a.kind === "back");
  const cancelA = actions.find((a) => a.kind === "cancel");
  const who = order.memberName ?? "회원";
  // 결제 확인 때 마일리지 할인 — 주문 금액의 5%까지(1,000점 단위). 보유 점수는 서버가 다시 본다.
  const mileMax = marketMileageMax(order.amount);
  const mileUse = Number(mileage.replace(/\D/g, "")) || 0;
  const mileErr =
    mileUse === 0 ? null : mileUse % 1000 !== 0 ? "1,000점 단위로 넣어 주세요" : mileUse > mileMax ? `최대 ${mileMax.toLocaleString("ko-KR")}점까지예요` : null;
  const isPayStep = order.status === "applied" && primary?.to === "paid";

  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-body font-black text-foreground">
          {who}
          {showBranch && order.branch && <span className="ml-1.5 text-label font-bold text-muted-foreground">{shortBranch(order.branch)}</span>}
        </p>
        <OrderStatusChip status={order.status} />
      </div>
      <p className="mt-1 text-body font-bold leading-snug text-foreground">{orderTitle(order)}</p>
      <p className="mt-0.5 text-label tabular-nums text-muted-foreground">
        {won(order.amount)} · {mdOfTime(order.createdAt)} 주문{order.orderNo ? ` · ${order.orderNo}` : ""}
      </p>
      {(order.mileageUsed ?? 0) > 0 && (
        <p className="mt-0.5 text-label font-bold tabular-nums text-amber-700 dark:text-reward">
          마일리지 {(order.mileageUsed ?? 0).toLocaleString("ko-KR")}점 할인 · 받은 돈 {won(order.amount - (order.mileageUsed ?? 0))}
        </p>
      )}
      {order.note && <p className="mt-2 rounded-xl bg-secondary/70 px-3 py-2 text-label leading-snug text-foreground">회원 한마디 · {order.note}</p>}
      {order.staffMemo && mode !== "memo" && <p className="mt-2 text-label leading-snug text-muted-foreground">메모 · {order.staffMemo}</p>}
      {order.status === "canceled" && order.cancelReason && (
        <p className="mt-2 text-label leading-snug text-muted-foreground">취소 사유 · {order.cancelReason}</p>
      )}

      {mode === "cancel" && cancelA && (
        <div className="mt-3 space-y-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
          <label htmlFor={`mk-reason-${order.id}`} className="text-label font-bold text-foreground">
            {cancelA.label} — 사유 (회원에게 보여요 · 선택)
          </label>
          <input
            id={`mk-reason-${order.id}`}
            value={reason}
            maxLength={100}
            onChange={(e) => setReason(e.target.value)}
            placeholder="예: 품절 · 회원 요청"
            className={inputCls}
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode(null)} className="h-11 flex-1 rounded-xl bg-secondary text-label font-bold text-secondary-foreground">
              그만두기
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                const ok = await onSet({ id: order.id, status: cancelA.to, reason: reason.trim() || null }, `${who} · ${cancelA.label}`);
                if (ok) setMode(null);
              }}
              className="h-11 flex-[1.4] rounded-xl bg-destructive text-label font-black text-destructive-foreground disabled:opacity-50"
            >
              {cancelA.label} 확정
            </button>
          </div>
        </div>
      )}

      {mode === "pay" && primary && (
        <div className="mt-3 space-y-2 rounded-xl border border-border bg-secondary/40 p-3">
          <label htmlFor={`mk-mile-${order.id}`} className="text-label font-bold text-foreground">
            153 마일리지 할인 (선택 · 주문 금액의 {MARKET_MILEAGE_PCT}%까지)
          </label>
          <div className="flex gap-2">
            <input
              id={`mk-mile-${order.id}`}
              inputMode="numeric"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              placeholder={mileMax > 0 ? `쓸 점수 (최대 ${mileMax.toLocaleString("ko-KR")})` : "이 주문은 마일리지를 못 써요"}
              disabled={mileMax <= 0}
              className={cn(inputCls, "min-w-0 flex-1")}
            />
            <button
              type="button"
              disabled={mileMax <= 0}
              onClick={() => setMileage(String(mileMax))}
              className="h-11 shrink-0 rounded-xl bg-card px-3 text-label font-bold text-foreground ring-1 ring-border disabled:opacity-40"
            >
              최대
            </button>
          </div>
          {mileErr ? (
            <p className="text-label font-bold text-destructive">{mileErr}</p>
          ) : (
            <p className="text-label tabular-nums text-muted-foreground">
              데스크에서 받을 돈 <b className="text-foreground">{won(order.amount - mileUse)}</b>
              {mileUse > 0 ? ` · 마일리지 ${mileUse.toLocaleString("ko-KR")}점` : ""}
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode(null)} className="h-11 flex-1 rounded-xl bg-secondary text-label font-bold text-secondary-foreground">
              그만두기
            </button>
            <button
              type="button"
              disabled={busy || !!mileErr}
              onClick={async () => {
                const ok = await onSet(
                  { id: order.id, status: primary.to, mileage: mileUse > 0 ? mileUse : null },
                  mileUse > 0 ? `${who} · ${primary.label} · 마일리지 ${mileUse.toLocaleString("ko-KR")}점` : `${who} · ${primary.label}`,
                );
                if (ok) setMode(null);
              }}
              className="h-11 flex-[1.4] rounded-xl bg-foreground text-label font-black text-background disabled:opacity-50"
            >
              {primary.label} · {won(order.amount - mileUse)}
            </button>
          </div>
        </div>
      )}

      {mode === "memo" && (
        <div className="mt-3 space-y-2 rounded-xl border border-border bg-secondary/40 p-3">
          <label htmlFor={`mk-memo-${order.id}`} className="text-label font-bold text-foreground">
            메모 (코치진만 봐요)
          </label>
          <input
            id={`mk-memo-${order.id}`}
            value={memo}
            maxLength={200}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="예: 금요일 저녁 결제 예정"
            className={inputCls}
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode(null)} className="h-11 flex-1 rounded-xl bg-secondary text-label font-bold text-secondary-foreground">
              닫기
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                const ok = await onSet({ id: order.id, memo }, "메모를 남겼어요");
                if (ok) setMode(null);
              }}
              className="h-11 flex-[1.4] rounded-xl bg-foreground text-label font-black text-background disabled:opacity-50"
            >
              메모 저장
            </button>
          </div>
        </div>
      )}

      {mode === null && (
        <div className="mt-3 space-y-2">
          {primary && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (isPayStep) {
                  setMileage("");
                  setMode("pay");
                  return;
                }
                void onSet({ id: order.id, status: primary.to }, `${who} · ${primary.label}`);
              }}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-foreground text-body font-black text-background active:scale-[0.99] disabled:opacity-50"
            >
              {primary.label}
            </button>
          )}
          <div className="flex flex-wrap gap-2">
            {back && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void onSet({ id: order.id, status: back.to }, `${who} · ${back.label}`)}
                className="h-10 rounded-xl bg-secondary px-3.5 text-label font-bold text-secondary-foreground disabled:opacity-50"
              >
                {back.label}
              </button>
            )}
            {cancelA && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setReason("");
                  setMode("cancel");
                }}
                className="h-10 rounded-xl bg-secondary px-3.5 text-label font-bold text-destructive disabled:opacity-50"
              >
                {cancelA.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMemo(order.staffMemo ?? "");
                setMode("memo");
              }}
              className="h-10 rounded-xl bg-secondary px-3.5 text-label font-bold text-secondary-foreground"
            >
              메모
            </button>
          </div>
        </div>
      )}
    </li>
  );
};

// ── 발주 목록 ────────────────────────────────────────────────

const PurchaseCard = ({ board }: { board: MarketBoard }) => {
  const lines = useMemo(() => purchaseList(board.orders, board.products), [board.orders, board.products]);
  const [fallback, setFallback] = useState<string | null>(null);
  if (!lines.length) return null;
  const totals = purchaseTotals(lines);
  const copy = async () => {
    const text = purchaseText(lines, board.today);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("발주 목록을 복사했어요");
      setFallback(null);
    } catch {
      setFallback(text);
    }
  };
  return (
    <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4" aria-label="발주 목록">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-body font-black text-foreground">
          발주할 것 <span className="tabular-nums">· 모두 {totals.qty}개</span>
        </p>
        <button
          type="button"
          onClick={copy}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-card px-3.5 text-label font-bold text-foreground shadow-elev-1 active:scale-95"
        >
          <Copy className="h-4 w-4" /> 목록 복사
        </button>
      </div>
      <ul className="mt-3 space-y-1.5">
        {lines.map((l) => (
          <li key={l.key} className="flex items-baseline gap-2 text-label text-foreground">
            <span className="min-w-0 flex-1 leading-snug">
              {l.name}
              {l.option ? ` · ${l.option}` : ""}
            </span>
            <span className="shrink-0 font-black tabular-nums">× {l.qty}</span>
          </li>
        ))}
      </ul>
      {board.boss && (
        <p className="mt-3 border-t border-primary/20 pt-2.5 text-label tabular-nums text-muted-foreground">
          {totals.cost != null ? (
            <>
              도매가 합계 <b className="font-black text-foreground">{won(totals.cost)}</b> (대표님 · 관리자만 보여요)
            </>
          ) : (
            "도매가를 안 넣은 상품이 있어 합계를 못 냈어요"
          )}
        </p>
      )}
      <p className="mt-2 text-label leading-snug text-muted-foreground">공급처에 주문을 넣은 뒤, 아래 주문마다 「발주했어요」를 눌러 주세요.</p>
      {fallback && (
        <textarea
          readOnly
          value={fallback}
          rows={Math.min(8, lines.length + 2)}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="발주 목록 — 길게 눌러 복사"
          className="mt-2 w-full rounded-xl border border-border bg-card p-3 text-label text-foreground"
        />
      )}
    </section>
  );
};

// ── 주문 묶음 ────────────────────────────────────────────────

const GroupBlock = ({
  group,
  showBranch,
  busyId,
  onSet,
}: {
  group: BoardGroup;
  showBranch: boolean;
  busyId: string | null;
  onSet: (input: OrderSetInput, done: string) => Promise<boolean>;
}) => {
  const closed = group.key === "closed";
  const [open, setOpen] = useState(!closed);
  return (
    <section aria-label={group.label}>
      <button
        type="button"
        onClick={() => closed && setOpen((v) => !v)}
        aria-expanded={open}
        className={cn("mb-2 flex w-full items-center gap-2 text-left", !closed && "cursor-default")}
      >
        <span className={cn("text-body font-black", closed ? "text-muted-foreground" : "text-foreground")}>{group.label}</span>
        <span className="rounded-full bg-secondary px-2 text-label font-black tabular-nums text-secondary-foreground">{group.orders.length}</span>
        {closed && <span className="ml-auto text-label font-bold text-muted-foreground">{open ? "접기" : "펼치기"}</span>}
      </button>
      {open && (
        <ul className="space-y-2.5">
          {group.orders.map((o) => (
            <OrderRow key={o.id} order={o} showBranch={showBranch} busy={busyId === o.id} onSet={onSet} />
          ))}
        </ul>
      )}
    </section>
  );
};

// ── 판 ──────────────────────────────────────────────────────

const MarketOrdersPanel = () => {
  const [branch, setBranch] = useState<string | null>(null);
  const [tab, setTab] = useState<PanelTab>("orders");
  const [busyId, setBusyId] = useState<string | null>(null);
  const q = useMarketBoard(branch);
  const { setOrder, demo } = useMarketAdminActions(branch);
  const board = q.data;

  const groups = useMemo(() => (board ? boardGroups(board.orders) : []), [board]);
  const todo = board ? boardTodoCount(board.orders) : 0;
  const warnCount = useMemo(
    () =>
      board
        ? board.products.filter((p) => p.active && priceFlags(p, board.today, board.staleDays, board.boss).some((f) => f.tone === "warn")).length
        : 0,
    [board],
  );

  const onSet = async (input: OrderSetInput, done: string): Promise<boolean> => {
    setBusyId(input.id);
    try {
      await setOrder.mutateAsync(input);
      toast.success(demo ? `${done} (예시)` : done);
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setBusyId(null);
    }
  };

  // 알림 링크(/manager?tab=market)로 들어오면 이 판이 화면 아래쪽에 있다 → 한 번 내려 준다
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") !== "market") return;
    const t = window.setTimeout(() => rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    return () => window.clearTimeout(t);
  }, []);
  const wrap = (body: ReactNode) => (
    <div ref={rootRef} className="scroll-mt-20">
      {body}
    </div>
  );

  if (q.isLoading) {
    return wrap(
      <div className="space-y-3" aria-busy="true" aria-label="주문함 불러오는 중">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>,
    );
  }

  if (q.isError || !board) {
    return wrap(
      <div className="rounded-2xl border border-dashed border-border p-6 text-center">
        <p className="text-body font-bold text-foreground">주문함을 불러오지 못했어요</p>
        <p className="mt-1 text-label text-muted-foreground">{q.error instanceof Error ? q.error.message : "잠시 뒤 다시 눌러 주세요"}</p>
        <button
          type="button"
          onClick={() => q.refetch()}
          className="mt-3 h-10 rounded-xl bg-secondary px-4 text-label font-bold text-secondary-foreground active:scale-95"
        >
          다시 불러오기
        </button>
      </div>,
    );
  }

  if (!board.available) {
    return wrap(
      <div className="rounded-2xl border border-dashed border-border p-6 text-center">
        <p className="text-body font-bold text-foreground">153 마켓은 아직 준비 중이에요</p>
        <p className="mt-1 text-label leading-relaxed text-muted-foreground">운영 DB 에 적용하면 여기에서 주문 · 상품 · 요청을 봐요.</p>
      </div>,
    );
  }

  if (!board.on) {
    return wrap(
      <div className="rounded-2xl border border-dashed border-border p-6 text-center">
        <p className="text-body font-bold text-foreground">우리 지점 마켓은 아직 열지 않았어요</p>
        <p className="mt-1 text-label leading-relaxed text-muted-foreground">시범 지점부터 열고 있어요.</p>
      </div>,
    );
  }

  const showBranch = board.scope === "all" && !branch;
  const tabs: { key: PanelTab; label: string; n: number; dot?: boolean }[] = [
    { key: "orders", label: "주문", n: todo },
    { key: "products", label: "상품", n: board.products.length, dot: warnCount > 0 },
    { key: "wishes", label: "요청", n: board.wishes.length },
  ];

  return wrap(
    <div className="space-y-4">
      {demo && (
        <p className="rounded-xl border border-dashed border-border bg-secondary/60 px-3.5 py-2.5 text-label leading-snug text-muted-foreground">
          <b className="font-bold text-foreground">예시 화면</b> · 지어낸 회원과 가격이에요. 눌러 봐도 실제로 바뀌지 않아요
        </p>
      )}

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-label font-bold text-muted-foreground">
              153 마켓 · {board.scope === "all" ? (branch ? shortBranch(branch) : "켠 지점 모두") : shortBranch(board.branch)}
            </p>
            <p className="mt-0.5 text-heading font-black text-foreground">{todo > 0 ? `할 일 ${todo}건` : "지금 할 일이 없어요"}</p>
            <p className="mt-0.5 text-label leading-snug text-muted-foreground">결제 확인 → 발주 → 도착 → 전달 순서로 눌러요</p>
          </div>
          <button
            type="button"
            onClick={() => q.refetch()}
            aria-label="새로고침"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground active:scale-95"
          >
            <RefreshCw className={cn("h-4 w-4", q.isFetching && "animate-spin")} />
          </button>
        </div>
        {board.scope === "all" && board.branches.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="지점">
            {[null, ...board.branches].map((b) => (
              <button
                key={b ?? "*"}
                type="button"
                role="tab"
                aria-selected={branch === b}
                onClick={() => setBranch(b)}
                className={cn(
                  "h-9 rounded-full px-3.5 text-label font-bold",
                  branch === b ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground",
                )}
              >
                {b ? shortBranch(b) : "모두"}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-secondary p-1" role="tablist" aria-label="153 마켓 관리">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex h-10 items-center justify-center gap-1.5 rounded-xl text-label font-bold transition-colors",
              tab === t.key ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground",
            )}
          >
            {t.label}
            {t.n > 0 && <span className="tabular-nums">{t.n}</span>}
            {t.dot && <span className="h-2 w-2 rounded-full bg-destructive" aria-label="가격 확인이 필요해요" />}
          </button>
        ))}
      </div>

      {tab === "orders" && (
        <div className="space-y-5">
          <PurchaseCard board={board} />
          {groups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center">
              <p className="text-body font-bold text-foreground">아직 주문이 없어요</p>
              <p className="mt-1 text-label text-muted-foreground">회원님이 주문하면 알림이 오고 여기에 떠요</p>
            </div>
          ) : (
            groups.map((g) => <GroupBlock key={g.key} group={g} showBranch={showBranch} busyId={busyId} onSet={onSet} />)
          )}
        </div>
      )}

      {tab === "products" && <MarketProductsAdmin board={board} branch={branch} />}

      {tab === "wishes" &&
        (board.wishes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center">
            <p className="text-body font-bold text-foreground">아직 요청이 없어요</p>
            <p className="mt-1 text-label text-muted-foreground">회원님이 「찾는 용품 요청」을 보내면 여기에 쌓여요</p>
          </div>
        ) : (
          <ul className="space-y-2.5" aria-label="회원 요청">
            {board.wishes.map((w) => (
              <li key={w.id} className="rounded-2xl border border-border bg-card p-4">
                <p className="text-body font-bold leading-snug text-foreground">{w.body}</p>
                <p className="mt-1 text-label text-muted-foreground">
                  {w.memberName}
                  {showBranch && w.branch ? ` · ${shortBranch(w.branch)}` : ""} · {mdOfTime(w.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        ))}
    </div>,
  );
};

export default MarketOrdersPanel;
