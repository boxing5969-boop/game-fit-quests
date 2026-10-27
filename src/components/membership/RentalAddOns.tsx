/**
 * 🛒 운동복 · 락카 담기 — 수강권 결제 확인 창 · 렌탈 탭 공용 (2026-10-27 대표님 보고서 「앱 결제 장바구니」)
 *   "앱으로 결제할 때 먼저 수강권 선택 후 운동복 · 락카 결제도 물어보자 — 3개월이면 3개, 5개월이면 5개 — 한 번에 결제"
 *
 *   · 줄마다 '안 써요 / 쓸게요' — 쓰면 수강권과 같은 개월로 담기고(max), −/+ 로 줄일 수 있다 (1개월까지).
 *   · 지금 쓰고 있으면 "지금 11월 25일까지 → 결제하면 2월 23일까지"를 보여 준다 (남은 기간 뒤로 이어 붙음).
 *   · 락카 번호는 결제 후 데스크(지점장님)가 정해 준다.
 *   계산은 lib/cartPricing — 서버(payssam-create-bill · DB apply_payment_order)와 같은 식.
 */
import { Minus, Plus } from "lucide-react";
import { RENTAL_LABEL, endText, extendedEnd, rentalDays, type RentalKind } from "@/lib/cartPricing";
import { cn } from "@/lib/utils";

interface Props {
  /** 담을 수 있는 가장 긴 개월 — 수강권과 같이면 수강권 개월, 렌탈만이면 12 */
  maxMonths: number;
  /** 담은 개월 (0 = 안 씀) */
  value: Record<RentalKind, number>;
  onChange: (next: Record<RentalKind, number>) => void;
  /** 한 달 가격 — 상품이 없으면 그 줄을 숨긴다 */
  unitPrice: Partial<Record<RentalKind, number>>;
  /** 지금 끝나는 날 */
  currentEnd: Partial<Record<RentalKind, string | null>>;
  /** 같이 사는 수강권 (끝나는 날 계산용) — 렌탈만이면 없음 */
  membership?: { months: number; days: number } | null;
  today: string;
  /** 수강권 결제 창에서는 '같이 쓰실래요?' 질문 · 렌탈 탭에서는 '연장할 개월' */
  mode: "addon" | "standalone";
  className?: string;
}

const won = (n: number) => n.toLocaleString("ko-KR") + "원";

const RentalAddOns = ({ maxMonths, value, onChange, unitPrice, currentEnd, membership = null, today, mode, className }: Props) => {
  const kinds = (["sportswear", "locker"] as const).filter((k) => (unitPrice[k] ?? 0) > 0);
  if (kinds.length === 0) return null;
  // 1개월 수강권이면 고를 개월이 없다 — 회색 −/+ 대신 '1개월'만 (꺼진 것처럼 보이지 않게, 2026-10-27)
  const fixedMonths = mode === "addon" && maxMonths <= 1;
  const set = (k: RentalKind, months: number) => onChange({ ...value, [k]: Math.max(0, Math.min(maxMonths, months)) });

  return (
    <section className={cn("rounded-xl border border-border bg-background p-3", className)} aria-label="운동복 · 락카 담기">
      <p className="text-body font-black text-foreground">
        {mode === "addon" ? "운동복 · 락카도 같이 쓰실래요?" : "연장할 개월을 고르세요"}
      </p>
      <p className="mt-0.5 text-label leading-relaxed text-muted-foreground">
        {/* 한 줄 (2026-10-28 리디자인) — 렌탈만 결제할 때는 가격만 */}
        한 달 {won(unitPrice[kinds[0]] ?? 0)}
        {mode === "standalone"
          ? ""
          : fixedMonths
            ? ` · 수강권과 같은 ${maxMonths}개월로 담겨요`
            : " · 수강권과 같은 개월로 담기고, 줄일 수 있어요"}
      </p>

      <div className="mt-2.5 space-y-2">
        {kinds.map((k) => {
          const months = value[k] ?? 0;
          const on = months > 0;
          const unit = unitPrice[k] ?? 0;
          const cur = currentEnd[k] ?? null;
          const curActive = !!cur && cur >= today;
          const nextEnd = on ? extendedEnd(cur, rentalDays(months, membership), today) : null;
          return (
            <div key={k} className={cn("rounded-xl px-3 py-2.5 ring-1 ring-inset", on ? "bg-primary/5 ring-primary/40" : "bg-muted/40 ring-border")}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-label font-black text-foreground">{RENTAL_LABEL[k]}</p>
                  <p className="text-micro text-muted-foreground">
                    {curActive ? `지금 ${endText(cur!, today)}까지` : "지금 안 쓰고 있어요"}
                  </p>
                </div>
                {mode === "addon" && (
                  <div className="flex shrink-0 rounded-lg bg-background p-0.5 ring-1 ring-border" role="group" aria-label={`${RENTAL_LABEL[k]} 쓰기`}>
                    <button
                      type="button"
                      onClick={() => set(k, 0)}
                      aria-pressed={!on}
                      className={cn("rounded-md px-2.5 py-1.5 text-label font-bold", !on ? "bg-foreground text-background" : "text-muted-foreground")}
                    >
                      안 써요
                    </button>
                    <button
                      type="button"
                      onClick={() => set(k, maxMonths)}
                      aria-pressed={on}
                      className={cn("rounded-md px-2.5 py-1.5 text-label font-bold", on ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                    >
                      쓸게요
                    </button>
                  </div>
                )}
              </div>

              {on && fixedMonths && (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-body font-black tabular-nums text-foreground">{months}개월</span>
                  <span className="text-label font-black tabular-nums text-foreground">{won(unit * months)}</span>
                </div>
              )}
              {(on || mode === "standalone") && !fixedMonths && (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => set(k, months - 1)}
                      disabled={mode === "addon" ? months <= 1 : months <= 0}
                      aria-label={`${RENTAL_LABEL[k]} 1개월 빼기`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-background ring-1 ring-border active:scale-95 disabled:opacity-40"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-[3.5rem] text-center text-body font-black tabular-nums text-foreground">{months}개월</span>
                    <button
                      type="button"
                      onClick={() => set(k, months + 1)}
                      disabled={months >= maxMonths}
                      aria-label={`${RENTAL_LABEL[k]} 1개월 더하기`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-background ring-1 ring-border active:scale-95 disabled:opacity-40"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="text-label font-black tabular-nums text-foreground">{won(unit * months)}</span>
                </div>
              )}
              {on && nextEnd && (
                <p className="mt-1.5 text-micro text-muted-foreground">
                  결제하면 <b className="text-foreground">{endText(nextEnd, today)}까지</b>
                  {curActive ? " (남은 기간 뒤로 이어 붙여요)" : ""}
                  {k === "locker" && !curActive ? " · 락카 번호는 결제 후 데스크에서 정해 드려요" : ""}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default RentalAddOns;
