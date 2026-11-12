// 🧥 153 굿즈 사전예약 신청 관리 — 첫 상품 「153 플리스 집업」 (2026-11-12 대표님 「마이복서에 올려서 판매신청받고」)
// 대표님 · 관리자 = 전 지점(지점 고르기), 지점장 · 코치 = 자기 지점만(서버 goods_admin_orders 가 정한다).
// 데스크에서 카드 결제를 받으면 '결제 완료', 옷을 건네면 '받음'. 업체 발주는 '결제 완료 기준' 색 × 사이즈 표 그대로 복사.
// 미리보기 주소는 옛 DB 를 봐서 함수가 없다 → ?demo=1 이면 예시 신청으로 화면만 본다.
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import {
  FLEECE_FALLBACK,
  GOODS_FLEECE_PATH,
  GOODS_FLEECE_SLUG,
  GOODS_FLEECE_URL,
  GOODS_STATUS_LABEL,
  colorLabel,
  ddayLabel,
  deadlineLabel,
  formatPhone,
  matchesQuery,
  nextActions,
  shortBranch,
  summarize,
  supplierText,
  won,
  type GoodsBasis,
  type GoodsOrder,
  type GoodsStatus,
} from "@/lib/goodsPreorder";
import { getGoodsAdminList, updateGoodsOrder, type GoodsAdminList } from "@/services/goodsService";

const STATUS_CLS: Record<GoodsStatus, string> = {
  applied: "bg-amber-500/10 text-amber-700",
  paid: "bg-emerald-500/10 text-emerald-700",
  delivered: "bg-foreground text-background",
  canceled: "bg-muted text-muted-foreground",
};

const isDemo = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1";

function demoList(): GoodsAdminList {
  const mk = (i: number, name: string, branch: string, color: string, size: string, qty: number, status: GoodsStatus): GoodsOrder => ({
    id: `demo-${i}`,
    order_no: `FL-${4100 + i * 37}`,
    color,
    size,
    qty,
    unit_price: 39000,
    amount: 39000 * qty,
    status,
    branch_name: branch,
    created_at: new Date(Date.now() - i * 3_600_000).toISOString(),
    paid_at: status === "paid" || status === "delivered" ? new Date().toISOString() : null,
    delivered_at: status === "delivered" ? new Date().toISOString() : null,
    canceled_at: status === "canceled" ? new Date().toISOString() : null,
    can_cancel: status === "applied",
    name,
    phone: `0105555${String(1000 + i).slice(-4)}`,
    source: i % 3 ? "link" : "app",
    member_match: i % 4 ? "phone" : "none",
    user_id: null,
    staff_memo: i === 2 ? "다음 주 화요일 결제 예정" : null,
    cancel_reason: status === "canceled" ? "member" : null,
  });
  return {
    ok: true,
    scope: { all: true, branch: null },
    campaign: FLEECE_FALLBACK,
    orders: [
      mk(1, "김예시", "153복싱짐 선릉역점", "white", "L", 1, "applied"),
      mk(2, "이예시", "153복싱짐 선릉역점", "gray", "M", 2, "paid"),
      mk(3, "박예시", "153복싱짐 잠실점", "white", "XL", 1, "paid"),
      mk(4, "최예시", "153복싱짐 역삼점", "white", "2XL", 1, "delivered"),
      mk(5, "정예시", "153복싱짐 칠금점", "gray", "L", 1, "canceled"),
      mk(6, "한예시", "153복싱짐 선릉역점", "white", "M", 3, "applied"),
    ],
  };
}

const FILTERS: { key: "all" | GoodsStatus; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "applied", label: "결제 전" },
  { key: "paid", label: "결제 완료" },
  { key: "delivered", label: "받음" },
  { key: "canceled", label: "취소" },
];

async function copyText(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    window.prompt("아래 글을 길게 눌러 복사하세요", text);
  }
}

const GoodsOrdersPanel = () => {
  const qc = useQueryClient();
  const demo = isDemo();
  const [branch, setBranch] = useState<string>("");
  const [basis, setBasis] = useState<GoodsBasis>("paid");
  const [filter, setFilter] = useState<"all" | GoodsStatus>("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [demoOrders, setDemoOrders] = useState<GoodsOrder[] | null>(null);

  const key = ["goods-admin", GOODS_FLEECE_SLUG, branch || null];
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: key,
    queryFn: async () => (demo ? demoList() : getGoodsAdminList(GOODS_FLEECE_SLUG, branch || null)),
    staleTime: 20_000,
  });

  const campaign = data?.campaign?.ok ? data.campaign : FLEECE_FALLBACK;
  const orders = useMemo(() => demoOrders ?? data?.orders ?? [], [demoOrders, data]);
  const sum = useMemo(() => summarize(orders, campaign, basis), [orders, campaign, basis]);
  const shown = useMemo(
    () => orders.filter((o) => (filter === "all" || o.status === filter) && matchesQuery(o, q)),
    [orders, filter, q],
  );

  const patch = async (o: GoodsOrder, p: Parameters<typeof updateGoodsOrder>[1], done: string) => {
    if (demo) {
      const base = demoOrders ?? data?.orders ?? [];
      setDemoOrders(
        base.map((x) =>
          x.id === o.id
            ? {
                ...x,
                ...(p.status ? { status: p.status } : {}),
                ...(p.color ? { color: p.color } : {}),
                ...(p.size ? { size: p.size } : {}),
                ...(p.qty ? { qty: p.qty, amount: x.unit_price * p.qty } : {}),
                ...(p.memo !== undefined ? { staff_memo: p.memo || null } : {}),
              }
            : x,
        ),
      );
      toast.success(`${done} (예시)`);
      return;
    }
    setBusyId(o.id);
    try {
      const r = await updateGoodsOrder(o.id, p);
      if (!r?.ok) {
        toast.error(r?.code === "BAD_STATUS" ? "지금 상태에서는 바꿀 수 없어요" : r?.code === "LOCKED" ? "받은 · 취소한 신청은 옵션을 못 바꿔요" : "바꾸지 못했어요");
      } else {
        toast.success(done);
      }
      await qc.invalidateQueries({ queryKey: ["goods-admin"] });
    } catch (e) {
      toast.error(e instanceof Error && e.message.includes("운영진") ? e.message : "바꾸지 못했어요. 다시 눌러 주세요.");
    } finally {
      setBusyId(null);
    }
  };

  const onAction = (o: GoodsOrder, to: GoodsStatus, label: string) => {
    if (to === "canceled" && !window.confirm(`${o.name ?? ""} ${o.order_no} 신청을 취소할까요?`)) return;
    void patch(o, { status: to }, `${o.order_no} · ${label}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }

  if (isError || !data?.ok) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center">
        <p className="text-body font-bold text-foreground">굿즈 신청을 불러오지 못했어요</p>
        <p className="mt-1 text-label text-muted-foreground">운영 DB 에 굿즈 함수가 아직 없거나, 운영진 계정이 아니에요.</p>
        <button type="button" onClick={() => refetch()} className="mt-3 rounded-xl bg-secondary px-4 py-2 text-label font-bold text-secondary-foreground active:scale-95">
          다시 불러오기
        </button>
      </div>
    );
  }

  const branches = campaign.branches ?? [];
  const sizeKeys = Object.keys(sum.sizeTotals);
  const colorKeys = Object.keys(sum.matrix);

  return (
    <div className="space-y-4">
      {demo && (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-label font-bold text-amber-700">예시 화면이에요 · 실제 신청이 아니에요</p>
      )}

      {/* 상품 · 마감 · 링크 */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-label font-bold text-muted-foreground">굿즈 사전예약 · {data.scope.all ? "전 지점" : shortBranch(data.scope.branch)}</p>
            <p className="mt-0.5 text-heading text-foreground">{campaign.title}</p>
            <p className="mt-0.5 text-label text-muted-foreground">
              {won(campaign.price)} · {deadlineLabel(campaign.closes_at)} 마감 · {ddayLabel(campaign)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="shrink-0 rounded-full bg-secondary p-2 text-secondary-foreground active:scale-95"
            aria-label="새로고침"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => window.open(GOODS_FLEECE_PATH, "_blank")}
            className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-border py-2.5 text-label font-bold text-foreground active:scale-[0.98]"
          >
            <ExternalLink className="h-4 w-4" /> 상세페이지
          </button>
          <button
            type="button"
            onClick={() => copyText(GOODS_FLEECE_URL, "상세페이지 링크를 복사했어요")}
            className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-border py-2.5 text-label font-bold text-foreground active:scale-[0.98]"
          >
            <Copy className="h-4 w-4" /> 링크 복사
          </button>
        </div>
      </div>

      {/* 숫자 */}
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["결제 전", sum.byStatus.applied.pieces, `${sum.byStatus.applied.orders}건`],
            ["결제 완료", sum.byStatus.paid.pieces + sum.byStatus.delivered.pieces, won(sum.byStatus.paid.amount + sum.byStatus.delivered.amount)],
            ["받음", sum.byStatus.delivered.pieces, `${sum.byStatus.delivered.orders}건`],
          ] as const
        ).map(([label, pieces, sub]) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-3 text-center">
            <p className="text-title text-foreground">
              {pieces}
              <span className="ml-0.5 text-label font-medium text-muted-foreground">벌</span>
            </p>
            <p className="text-label font-bold text-foreground">{label}</p>
            <p className="text-micro text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      {/* 색 × 사이즈 */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-heading text-foreground">색 × 사이즈</p>
          <div className="flex rounded-full bg-muted p-0.5">
            {(["paid", "all"] as const).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBasis(b)}
                className={`rounded-full px-3 py-1 text-label font-bold ${basis === b ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground"}`}
              >
                {b === "paid" ? "결제 기준" : "신청 포함"}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[300px] text-center text-body">
            <thead>
              <tr className="text-label text-muted-foreground">
                <th className="py-1.5 text-left font-bold">인쇄 색</th>
                {sizeKeys.map((s) => (
                  <th key={s} className="py-1.5 font-bold">{s}</th>
                ))}
                <th className="py-1.5 font-bold">합계</th>
              </tr>
            </thead>
            <tbody>
              {colorKeys.map((c) => (
                <tr key={c} className="border-t border-border/60">
                  <td className="py-2 text-left text-label font-bold text-foreground">{colorLabel(campaign, c)}</td>
                  {sizeKeys.map((s) => (
                    <td key={s} className={`py-2 font-bold tabular-nums ${sum.matrix[c][s] ? "text-foreground" : "text-muted-foreground/50"}`}>
                      {sum.matrix[c][s]}
                    </td>
                  ))}
                  <td className="py-2 font-extrabold tabular-nums text-foreground">{sum.colorTotals[c]}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-foreground/80">
                <td className="py-2 text-left text-label font-extrabold text-foreground">합계</td>
                {sizeKeys.map((s) => (
                  <td key={s} className="py-2 font-extrabold tabular-nums text-foreground">{sum.sizeTotals[s]}</td>
                ))}
                <td className="py-2 font-black tabular-nums text-foreground">{sum.pieces}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() => copyText(supplierText(campaign, orders, basis), "업체 발주 문구를 복사했어요")}
          className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl bg-foreground py-2.5 text-label font-bold text-background active:scale-[0.98]"
        >
          <Copy className="h-4 w-4" /> 업체 발주 문구 복사 ({basis === "paid" ? "결제 기준" : "신청 포함"})
        </button>
      </div>

      {/* 거르기 */}
      <div className="space-y-2">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {FILTERS.map((f) => {
            const n = f.key === "all" ? orders.length : orders.filter((o) => o.status === f.key).length;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-label font-bold transition-all active:scale-95 ${
                  filter === f.key ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground"
                }`}
              >
                {f.label} {n}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          {data.scope.all && (
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="h-11 shrink-0 rounded-xl border border-border bg-card px-2 text-label font-bold text-foreground"
              aria-label="지점"
            >
              <option value="">전 지점</option>
              {branches.map((b) => (
                <option key={b} value={b}>{shortBranch(b)}</option>
              ))}
            </select>
          )}
          <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="이름 · 번호 · 신청 번호"
              className="min-w-0 flex-1 bg-transparent text-body text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>
      </div>

      {/* 목록 */}
      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-body text-muted-foreground">{orders.length ? "조건에 맞는 신청이 없어요" : "아직 들어온 신청이 없어요"}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {shown.map((o) => (
            <li key={o.id} className={`rounded-2xl border border-border bg-card p-4 ${o.status === "canceled" ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-body font-extrabold text-foreground">
                    {o.name} <span className="text-label font-bold text-muted-foreground">· {shortBranch(o.branch_name)}</span>
                  </p>
                  <a href={`tel:${o.phone}`} className="text-label font-bold text-primary underline-offset-2 hover:underline">
                    {formatPhone(o.phone)}
                  </a>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-micro font-extrabold ${STATUS_CLS[o.status]}`}>
                  {GOODS_STATUS_LABEL[o.status]}
                </span>
              </div>
              <p className="mt-2 text-body font-bold text-foreground">
                {colorLabel(campaign, o.color)} · {o.size} · {o.qty}벌 <span className="text-label text-muted-foreground">· {won(o.amount)}</span>
              </p>
              <p className="mt-0.5 text-micro text-muted-foreground">
                {o.order_no} · {new Date(o.created_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                {o.source === "app" ? " · 앱" : " · 링크"}
                {o.member_match === "none" ? " · 회원 번호 아님" : ""}
              </p>
              {o.staff_memo && <p className="mt-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-label text-foreground">메모 · {o.staff_memo}</p>}

              {editing === o.id ? (
                <OrderEditor
                  order={o}
                  colors={campaign.colors}
                  sizes={campaign.sizes}
                  busy={busyId === o.id}
                  onCancel={() => setEditing(null)}
                  onSave={async (p) => {
                    await patch(o, p, `${o.order_no} 고쳤어요`);
                    setEditing(null);
                  }}
                />
              ) : (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {nextActions(o.status).map((a) => (
                    <button
                      key={a.to}
                      type="button"
                      disabled={busyId === o.id}
                      onClick={() => onAction(o, a.to, a.label)}
                      className={`rounded-xl px-3 py-2 text-label font-bold active:scale-95 disabled:opacity-40 ${
                        a.tone === "primary"
                          ? "bg-foreground text-background"
                          : a.tone === "danger"
                            ? "border border-destructive/40 text-destructive"
                            : "border border-border text-foreground"
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={busyId === o.id}
                    onClick={() => setEditing(o.id)}
                    className="rounded-xl border border-border px-3 py-2 text-label font-bold text-muted-foreground active:scale-95 disabled:opacity-40"
                  >
                    옵션 · 메모
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

function OrderEditor({
  order,
  colors,
  sizes,
  busy,
  onCancel,
  onSave,
}: {
  order: GoodsOrder;
  colors: { key: string; label: string }[];
  sizes: string[];
  busy: boolean;
  onCancel: () => void;
  onSave: (p: { color?: string; size?: string; qty?: number; memo?: string }) => Promise<void>;
}) {
  const locked = order.status === "delivered" || order.status === "canceled";
  const [color, setColor] = useState(order.color);
  const [size, setSize] = useState(order.size);
  const [qty, setQty] = useState(order.qty);
  const [memo, setMemo] = useState(order.staff_memo ?? "");
  const sel = "h-11 rounded-xl border border-border bg-card px-2 text-label font-bold text-foreground disabled:opacity-50";
  return (
    <div className="mt-3 space-y-2 rounded-xl bg-muted/60 p-3">
      <div className="grid grid-cols-3 gap-2">
        <select value={color} disabled={locked} onChange={(e) => setColor(e.target.value)} className={sel} aria-label="인쇄 색">
          {colors.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
        <select value={size} disabled={locked} onChange={(e) => setSize(e.target.value)} className={sel} aria-label="사이즈">
          {sizes.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={qty} disabled={locked} onChange={(e) => setQty(Number(e.target.value))} className={sel} aria-label="벌 수">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n}벌</option>
          ))}
        </select>
      </div>
      {locked && <p className="text-micro text-muted-foreground">받은 · 취소한 신청은 메모만 바꿀 수 있어요</p>}
      <input
        value={memo}
        maxLength={200}
        onChange={(e) => setMemo(e.target.value)}
        placeholder="메모 (예: 다음 주 결제 예정)"
        className="h-11 w-full rounded-xl border border-border bg-card px-3 text-body text-foreground placeholder:text-muted-foreground"
      />
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-border py-2.5 text-label font-bold text-foreground">
          닫기
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            onSave({
              ...(locked ? {} : {
                ...(color !== order.color ? { color } : {}),
                ...(size !== order.size ? { size } : {}),
                ...(qty !== order.qty ? { qty } : {}),
              }),
              ...(memo !== (order.staff_memo ?? "") ? { memo } : {}),
            })
          }
          className="flex-1 rounded-xl bg-foreground py-2.5 text-label font-bold text-background disabled:opacity-40"
        >
          저장
        </button>
      </div>
    </div>
  );
}

export default GoodsOrdersPanel;
