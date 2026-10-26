/**
 * 🎫 회원 상세 '수강' 탭 — 전체관리자(대표님 계정)만 (2026-10-27 대표님: "나는 회원별로 수강정보를 앱에서 확인할수있게 해줘
 *   개요 내정보 등등있는탭에 추가하면 될것같아" · 보고서 10번 "처음엔 대표님만").
 *
 *   · 지금 이용 중 — 수강권(끝나는 날 · 남은 날 · 등록일 · 누적 결제) · 락카(번호 · 끝나는 날) · 운동복(끝나는 날) · PT(남은 횟수)
 *   · 고치기 — 락카 번호(set_member_locker) · 락카 · 운동복 끝나는 날(set_member_rental_ends). 회원 수강권 화면에 바로 보인다.
 *   · 앱 결제 — payment_orders + 항목(payment_order_items: 수강권 · 운동복 · 락카, 반영한 기간)
 *   · 브로제이 · 다짐 매출 — Edge Function member-pass-history → 153OS member_sales_history
 *     (브로제이는 전화번호가 없어 같은 지점 · 같은 이름으로 찾는다 — 동명이인이면 섞일 수 있다고 적는다)
 *   · 출석 — 이번 달 · 지난달 · 마지막 출석 (회원 상세의 출석 기록과 같은 캐시)
 */
import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Pencil, Shirt, Ticket, CalendarCheck, Receipt, Store } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAttendanceHistory } from "@/hooks/useAttendanceHistory";
import { daysUntil, leftText, lockerNumberText, lockerView, termStateOf, type TermState } from "@/lib/gymTicketInfo";
import { kstToday } from "@/lib/levelPractice";
import { translateError } from "@/lib/errorMessages";
import { cn } from "@/lib/utils";

type MemberProfile = {
  user_id: string;
  branch_name?: string | null;
  membership_end?: string | null;
  gym_reg_date?: string | null;
  payment_total?: number | null;
  locker_label?: string | null;
  locker_end?: string | null;
  sportswear_end?: string | null;
  pt_ticket?: string | null;
  pt_remaining?: number | null;
  pt_end_date?: string | null;
  pt_until?: string | null;
  is_staff?: boolean | null;
};

interface OrderItem {
  order_id: string;
  kind: "membership" | "sportswear" | "locker";
  product_name: string;
  months: number;
  amount: number;
  list_amount: number;
  start_date: string | null;
  end_date: string | null;
  applied_at: string | null;
  reverted_at: string | null;
}
interface Order {
  id: string;
  product_name: string | null;
  amount: number | null;
  list_price: number | null;
  mileage_used: number | null;
  status: string;
  paid_at: string | null;
  created_at: string;
  items: OrderItem[];
}
interface SaleRow {
  day: string;
  category: string | null;
  product: string | null;
  amount: number;
  method: string | null;
  is_new?: boolean | null;
  status?: string | null;
  renew?: boolean | null;
}
interface SalesHistory {
  matched?: { by?: string; name?: string; branch?: string; same_name?: number; src?: "broj" | "dagym"; synced_at?: string | null };
  broj?: SaleRow[];
  dagym?: SaleRow[];
}

const won = (n: number) => `${n < 0 ? "-" : ""}${Math.abs(Math.round(n)).toLocaleString("ko-KR")}원`;
const kstDay = (iso: string) => new Date(Date.parse(iso) + 9 * 3600 * 1000).toISOString().slice(0, 10);
const dot = (ymd: string) => ymd.slice(0, 10).replace(/-/g, ". ") + ".";

const DAGYM_CAT: Record<string, string> = {
  general: "회원권",
  daily: "일일권",
  rentalLocker: "락카",
  rentalSportsWear: "운동복",
  transferMembership: "양도",
  etc: "기타",
};
const KIND_LABEL: Record<OrderItem["kind"], string> = { membership: "수강권", sportswear: "운동복", locker: "락카" };

const stateCls = (s: TermState) =>
  s === "ended" ? "bg-destructive/15 text-destructive" : s === "soon" ? "bg-status-pending/15 text-status-pending" : "bg-primary/10 text-primary";

/** 한 줄 — 이름 · 값 · 남은 날 */
const UseRow = ({ icon: Icon, label, value, end, today }: { icon: typeof Ticket; label: string; value?: string | null; end: string | null; today: string }) => {
  const left = daysUntil(end, today);
  const st = termStateOf(left);
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-foreground">
            {label}
            {value ? <span className="ml-1.5 font-semibold text-muted-foreground">{value}</span> : null}
          </p>
          <p className="text-[12px] text-muted-foreground">{end ? `${dot(end)}까지` : "끝나는 날 없음"}</p>
        </div>
      </div>
      {left != null && <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-black tabular-nums", stateCls(st))}>{leftText(left)}</span>}
    </div>
  );
};

const Section = ({ icon: Icon, title, note, children }: { icon: typeof Ticket; title: string; note?: string | null; children: ReactNode }) => (
  <section className="rounded-2xl border border-border bg-card">
    <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
      <p className="flex items-center gap-1.5 text-[13px] font-black text-foreground">
        <Icon className="h-4 w-4 text-primary" aria-hidden /> {title}
      </p>
      {note ? <span className="min-w-0 truncate text-[11px] text-muted-foreground">{note}</span> : null}
    </div>
    {children}
  </section>
);

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

const MemberPassPanel = ({ profile }: { profile: MemberProfile }) => {
  const qc = useQueryClient();
  const today = kstToday();
  const userId = profile.user_id;
  const locker = lockerView(profile);
  const att = useAttendanceHistory(userId, true);

  // ── 앱 결제 (주문 + 항목) ──
  const orders = useQuery({
    queryKey: ["member-pass-orders", userId],
    staleTime: 30_000,
    queryFn: async (): Promise<Order[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data, error } = await sb
        .from("payment_orders")
        .select("id, product_name, amount, list_price, mileage_used, status, paid_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw new Error(translateError(error));
      const list = (data ?? []) as Omit<Order, "items">[];
      const ids = list.map((o) => o.id);
      let items: OrderItem[] = [];
      if (ids.length) {
        const r = await sb
          .from("payment_order_items")
          .select("order_id, kind, product_name, months, amount, list_amount, start_date, end_date, applied_at, reverted_at")
          .in("order_id", ids);
        if (!r.error) items = (r.data ?? []) as OrderItem[];
      }
      const order = { membership: 0, sportswear: 1, locker: 2 } as const;
      return list.map((o) => ({ ...o, items: items.filter((i) => i.order_id === o.id).sort((a, b) => order[a.kind] - order[b.kind]) }));
    },
  });

  // ── 브로제이 · 다짐 매출 (153OS) ──
  const sales = useQuery({
    queryKey: ["member-pass-sales", userId],
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async (): Promise<SalesHistory> => {
      const { data, error } = await supabase.functions.invoke("member-pass-history", { body: { user_id: userId } });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return (data ?? {}) as SalesHistory;
    },
  });

  // ── 고치기 ──
  const [edit, setEdit] = useState<{ label: string; lockerEnd: string; swEnd: string } | null>(null);
  const save = useMutation({
    mutationFn: async (v: { label: string; lockerEnd: string; swEnd: string }) => {
      const rpc = (supabase as unknown as { rpc: Rpc }).rpc.bind(supabase);
      if (v.label.trim() !== (profile.locker_label ?? "").trim()) {
        const { error } = await rpc("set_member_locker", { p_user_id: userId, p_label: v.label.trim() });
        if (error) throw new Error(translateError(error));
      }
      if ((v.lockerEnd || null) !== (profile.locker_end ?? null) || (v.swEnd || null) !== (profile.sportswear_end ?? null)) {
        const { error } = await rpc("set_member_rental_ends", {
          p_user_id: userId,
          p_locker_end: v.lockerEnd || null,
          p_sportswear_end: v.swEnd || null,
        });
        if (error) throw new Error(translateError(error));
      }
    },
    onSuccess: () => {
      toast.success("저장했어요 — 회원 수강권 화면에 바로 보여요");
      setEdit(null);
      qc.invalidateQueries({ queryKey: ["member-detail", userId] });
    },
    onError: (e: Error) => toast.error(e.message || "저장하지 못했어요"),
  });

  const ptLine = profile.pt_ticket || profile.pt_remaining != null
    ? [profile.pt_ticket, profile.pt_remaining != null ? `남은 ${profile.pt_remaining}회` : null].filter(Boolean).join(" · ")
    : null;
  const ptEnd = profile.pt_end_date ?? null;

  const ordersShown = (orders.data ?? []).filter((o) => o.status === "paid" || o.status === "canceled");
  const unpaidLinks = (orders.data ?? []).filter((o) => o.status === "sent" || o.status === "created").length;
  const m = sales.data?.matched;
  const salesRows = (m?.src === "dagym" ? sales.data?.dagym : sales.data?.broj) ?? [];

  return (
    <div className="space-y-3">
      {/* 지금 이용 중 */}
      <Section icon={Ticket} title="지금 이용 중" note={profile.branch_name ?? null}>
        <div className="divide-y divide-border">
          {profile.is_staff ? (
            <p className="px-4 py-3 text-[13px] text-muted-foreground">지도진 계정 — 무제한</p>
          ) : (
            <UseRow icon={Ticket} label="수강권" end={profile.membership_end ?? null} today={today} />
          )}
          <UseRow icon={Lock} label="락카" value={locker ? lockerNumberText(locker) : "번호 없음"} end={profile.locker_end ?? null} today={today} />
          <UseRow icon={Shirt} label="운동복" end={profile.sportswear_end ?? null} today={today} />
          {(ptLine || ptEnd) && (
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <p className="text-[13px] font-bold text-foreground">
                PT <span className="ml-1.5 font-semibold text-muted-foreground">{ptLine ?? "-"}</span>
              </p>
              {ptEnd && <span className="shrink-0 text-[12px] text-muted-foreground">기한 {dot(ptEnd)}</span>}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[12px] text-muted-foreground">
            {profile.gym_reg_date && <span>등록 {dot(profile.gym_reg_date)}</span>}
            {profile.payment_total != null && profile.payment_total > 0 && <span>누적 결제(수강권) {won(profile.payment_total)}</span>}
          </div>
        </div>

        {edit ? (
          <div className="space-y-2.5 border-t border-border px-4 py-3">
            <label className="block text-[12px] font-bold text-muted-foreground">
              락카 번호
              <input
                value={edit.label}
                onChange={(e) => setEdit({ ...edit, label: e.target.value })}
                placeholder="예: 12 · 개인락카 / 12 (비우면 지움)"
                maxLength={40}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[12px] font-bold text-muted-foreground">
                락카 끝나는 날
                <input
                  type="date"
                  value={edit.lockerEnd}
                  onChange={(e) => setEdit({ ...edit, lockerEnd: e.target.value })}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground focus:border-primary focus:outline-none"
                />
              </label>
              <label className="block text-[12px] font-bold text-muted-foreground">
                운동복 끝나는 날
                <input
                  type="date"
                  value={edit.swEnd}
                  onChange={(e) => setEdit({ ...edit, swEnd: e.target.value })}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground focus:border-primary focus:outline-none"
                />
              </label>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">날짜를 비우면 '끝나는 날 없음'이 돼요. 앱에서 결제하면 끝나는 날은 저절로 늘어나요.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => save.mutate(edit)}
                disabled={save.isPending}
                className="h-10 flex-1 rounded-lg bg-primary text-sm font-bold text-primary-foreground active:scale-[0.98] disabled:opacity-50"
              >
                {save.isPending ? "저장 중…" : "저장"}
              </button>
              <button type="button" onClick={() => setEdit(null)} className="h-10 rounded-lg bg-muted px-4 text-sm font-bold text-muted-foreground active:scale-95">
                취소
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEdit({ label: profile.locker_label ?? "", lockerEnd: profile.locker_end ?? "", swEnd: profile.sportswear_end ?? "" })}
            className="flex h-10 w-full items-center justify-center gap-1.5 border-t border-border text-[13px] font-bold text-primary active:bg-muted/40"
          >
            <Pencil className="h-3.5 w-3.5" /> 락카 · 운동복 고치기
          </button>
        )}
      </Section>

      {/* 앱 결제 */}
      <Section icon={Receipt} title="앱 결제" note={unpaidLinks > 0 ? `링크만 만들고 안 낸 것 ${unpaidLinks}건` : null}>
        {orders.isLoading ? (
          <p className="px-4 py-3 text-[13px] text-muted-foreground">불러오는 중…</p>
        ) : orders.isError ? (
          <p className="px-4 py-3 text-[13px] text-destructive">앱 결제를 불러오지 못했어요</p>
        ) : ordersShown.length === 0 ? (
          <p className="px-4 py-3 text-[13px] text-muted-foreground">앱으로 결제한 기록이 없어요</p>
        ) : (
          <div className="divide-y divide-border">
            {ordersShown.map((o) => (
              <div key={o.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] text-muted-foreground">
                      {dot(kstDay(o.paid_at ?? o.created_at))}
                      <span className={cn("ml-1.5 rounded px-1.5 py-0.5 text-[10.5px] font-bold", o.status === "paid" ? "bg-status-complete/15 text-status-complete" : "bg-destructive/15 text-destructive")}>
                        {o.status === "paid" ? "결제 완료" : "취소"}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[13.5px] font-bold text-foreground">{o.product_name ?? "-"}</p>
                  </div>
                  <span className={cn("shrink-0 text-[13.5px] font-black tabular-nums", o.status === "paid" ? "text-foreground" : "text-muted-foreground line-through")}>
                    {won(o.amount ?? 0)}
                  </span>
                </div>
                {o.items.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {o.items.map((i, n) => (
                      <li key={n} className="flex items-center justify-between gap-3 text-[12px] text-muted-foreground">
                        <span className="min-w-0 truncate">
                          {KIND_LABEL[i.kind]} · {i.product_name}
                          {i.start_date && i.end_date ? ` · ${dot(i.start_date)} ~ ${dot(i.end_date)}` : ""}
                          {i.reverted_at ? " · 되돌림" : ""}
                        </span>
                        <span className="shrink-0 tabular-nums">{won(i.list_amount)}</span>
                      </li>
                    ))}
                    {(o.mileage_used ?? 0) > 0 && (
                      <li className="flex items-center justify-between gap-3 text-[12px] text-muted-foreground">
                        <span>마일리지</span>
                        <span className="shrink-0 tabular-nums">-{(o.mileage_used ?? 0).toLocaleString("ko-KR")}점</span>
                      </li>
                    )}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 브로제이 · 다짐 매출 */}
      <Section
        icon={Store}
        title={m?.src === "dagym" ? "다짐 매출" : "브로제이 매출"}
        note={m?.synced_at ? `${m.synced_at} 기준` : null}
      >
        {sales.isLoading ? (
          <p className="px-4 py-3 text-[13px] text-muted-foreground">불러오는 중…</p>
        ) : sales.isError ? (
          <p className="px-4 py-3 text-[13px] text-destructive">매출 기록을 불러오지 못했어요</p>
        ) : (
          <>
            {m?.by && m.by !== "none" && (
              <p className="border-b border-border px-4 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
                {m.src === "dagym"
                  ? "다짐 회원 번호(전화번호)로 찾았어요"
                  : `같은 지점 · 같은 이름(${m.name ?? "-"})으로 찾았어요${(m.same_name ?? 0) > 1 ? ` — 같은 이름 회원이 ${m.same_name}명이라 다른 분 기록이 섞일 수 있어요` : ""}`}
              </p>
            )}
            {salesRows.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-muted-foreground">기록이 없어요</p>
            ) : (
              <div className="divide-y divide-border">
                {salesRows.map((s, n) => {
                  const refund = s.amount < 0 || s.status === "refunded";
                  const cat = m?.src === "dagym" ? DAGYM_CAT[s.category ?? ""] ?? s.category : s.category;
                  const tag = m?.src === "dagym"
                    ? (s.category === "general" ? (s.renew ? "재등록" : "신규") : null)
                    : null;
                  return (
                    <div key={n} className="flex items-start justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="text-[12px] text-muted-foreground">
                          {dot(s.day)}
                          {cat ? ` · ${cat}` : ""}
                          {tag ? ` · ${tag}` : ""}
                          {refund ? " · 환불" : ""}
                          {s.method ? ` · ${s.method}` : ""}
                        </p>
                        <p className="text-[13px] font-bold text-foreground">{s.product || "-"}</p>
                      </div>
                      <span className={cn("shrink-0 text-[13px] font-black tabular-nums", refund ? "text-destructive" : "text-foreground")}>{won(s.amount)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </Section>

      {/* 출석 */}
      <Section icon={CalendarCheck} title="출석">
        {att.isLoading ? (
          <p className="px-4 py-3 text-[13px] text-muted-foreground">불러오는 중…</p>
        ) : att.isError || !att.data ? (
          <p className="px-4 py-3 text-[13px] text-muted-foreground">출석 기록을 불러오지 못했어요</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 px-4 py-3 text-center">
            <div>
              <p className="text-[11px] text-muted-foreground">이번 달</p>
              <p className="text-base font-black tabular-nums text-foreground">{att.data.month}회</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">지난달</p>
              <p className="text-base font-black tabular-nums text-foreground">{att.data.lastMonth}회</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">마지막 출석</p>
              <p className="text-[13px] font-black tabular-nums text-foreground">{att.data.lastDay ? dot(att.data.lastDay) : "-"}</p>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
};

export default MemberPassPanel;
