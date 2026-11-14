/**
 * 🥊 홈 첫 화면 「PT 수업」 카드 — PT 회원에게만 (2026-11-14 대표님 「홈화면에 PT 회원님들을 위한 스케줄관리 —
 *   내가 언제 운동을 했고 언제 취소했는지 · 당일 취소는 차감되고 하루전은 언제든지 가능 · 언제 운동할지 예약」)
 *   자리 = 내 카드(복서카드) 바로 아래. 새 페이지 없이 카드 한 장 + 아래에서 올라오는 창(PtSheet).
 *     · 주인공 = 다음 수업 「내일 오후 7:00」 (모레부터는 옆에 'n일 뒤')
 *     · 수업 시간이 지난 예약이 있으면 맨 위에 「수업 받았어요」 띠 — 누르면 수업 기록 + 적립(서버 pt_confirm_lesson)
 *     · 수업권 칸 막대 + 남은 횟수(브로제이 기준 시각과 함께 — 수강권 카드와 같은 숫자)
 *     · 규칙 한 줄 · 아래 단추 [예약하기](코치님이 시간을 열어 둔 회원만) · [내 PT 일정]
 *   알림 링크 `/home?pt=1` 이면 일정 창이 열린다(주소에서 ?pt= 는 지운다).
 *   서버 함수가 없는 DB(적용 전 · 옛 DB 미리보기) · PT 예약을 안 켠 지점 · PT 회원이 아니면 아무것도 그리지 않는다.
 *   예시 화면: `/home?ptdemo=1`(지어낸 자료 · 서버를 부르지 않음).
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarPlus, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { asOfLabel } from "@/lib/gymTicketInfo";
import { isPtMember } from "@/lib/ptMember";
import { PT_RULE_LINE, aheadChip, showPtCard, splitBookings, ticketTotal, whenLabel } from "@/lib/ptBooking";
import { isPtDemo, usePtActions, usePtHome } from "@/services/ptBookingService";
import { cn } from "@/lib/utils";

const PtSheet = lazy(() => import("./PtSheet"));

const n = (v: number) => v.toLocaleString("ko-KR");

/** 수업권 칸 막대 — 남은 횟수만큼 민트 (총 횟수를 모르면 그리지 않는다) */
export const TicketCells = ({ total, remaining, className }: { total: number; remaining: number; className?: string }) => {
  const cells = Math.min(total, 40);
  const left = Math.max(0, Math.min(cells, Math.round((remaining / total) * cells)));
  return (
    <div className={cn("flex gap-[3px]", className)} aria-hidden>
      {Array.from({ length: cells }, (_, i) => (
        <span key={i} className={cn("h-2 min-w-0 flex-1 rounded-full", i < left ? "bg-primary" : "bg-foreground/10")} />
      ))}
    </div>
  );
};

/** 프리미엄 표시 — 플래티넘 바탕에 샴페인 골드 글씨(혜택 문구는 쓰지 않는다) */
export const PremiumTag = ({ className }: { className?: string }) => (
  <span
    className={cn(
      "shrink-0 rounded-full border border-[#c8a96a]/60 bg-[#fbf7ee] px-2 py-0.5 text-micro font-black tracking-[0.12em] text-[#8a6a2b] dark:border-[#c8a96a]/40 dark:bg-[#c8a96a]/10 dark:text-[#e3c88f]",
      className,
    )}
  >
    PREMIUM
  </span>
);

const HomePtCard = () => {
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const demo = isPtDemo();
  // PT 수업권이 있는 회원만 서버를 부른다(그 밖의 회원에게는 요청도 카드도 없다)
  const maybePt = demo || isPtMember(profile) || !!(profile as { pt_ticket?: string | null } | null)?.pt_ticket;
  const { data } = usePtHome(maybePt);
  const { confirm } = usePtActions();
  const [sheet, setSheet] = useState<null | "list" | "book">(null);
  // 수업 시간이 되면 「수업 받았어요」 띠가 뜨게 — 30초마다 지금 시각을 다시 본다
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const show = !!data && showPtCard(data);
  // 알림 링크 /home?pt=1 → 일정 창
  const wantOpen = params.get("pt") === "1";
  useEffect(() => {
    if (!wantOpen || !data) return;
    if (show) setSheet("list");
    const next = new URLSearchParams(params);
    next.delete("pt");
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantOpen, !!data, show]);

  if (!data || !show) return null;

  const { confirm: waiting, upcoming } = splitBookings(data, now);
  const next = upcoming[0] ?? null;
  const ask = waiting[0] ?? null;
  const total = ticketTotal(data.ticket.name);
  const remaining = data.ticket.remaining;
  const asOf = asOfLabel(data.ticket.checkedAt, now);
  const chip = next ? aheadChip(next.day, data.today) : null;

  const onConfirm = () => {
    if (!ask || confirm.isPending) return;
    confirm.mutate(ask.id, {
      onSuccess: (r) => toast.success(r.mileage > 0 ? `수업 기록 완료 · +${n(r.mileage)} 마일리지 🥊` : "수업 기록 완료 🥊"),
      onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "기록하지 못했어요"),
    });
  };

  return (
    <>
      <section aria-label="PT 수업" className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-elev-1">
        {/* 프리미엄 한 줄 — 플래티넘에 샴페인 골드 */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: "linear-gradient(90deg, #c9d0d8 0%, #f3f5f7 28%, #c8a96a 52%, #eef1f4 78%, #c9d0d8 100%)" }}
        />
        <div className="flex items-center justify-between gap-2 px-5 pt-5">
          <h2 className="flex min-w-0 items-center gap-2 text-heading text-foreground">
            <span className="truncate">PT 수업</span>
            <PremiumTag />
          </h2>
          {upcoming.length > 0 && <span className="shrink-0 text-label font-bold text-muted-foreground">예약 {upcoming.length}건</span>}
        </div>

        {/* 수업 시간이 지난 예약 — 「수업 받았어요」 */}
        {ask && (
          <div className="mx-5 mt-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-body font-bold text-foreground">{whenLabel(ask.start_at, data.today)} 수업, 받으셨나요?</p>
            <button
              type="button"
              onClick={onConfirm}
              disabled={confirm.isPending}
              className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-body font-black text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              {confirm.isPending ? "기록하는 중…" : "수업 받았어요"}
              {!confirm.isPending && data.rules.mileage > 0 && (
                <span className="rounded-full bg-white/25 px-2 py-0.5 text-label font-black tabular-nums">+{n(data.rules.mileage)}</span>
              )}
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setSheet("list")}
          aria-label={next ? `다음 PT 수업 ${whenLabel(next.start_at, data.today)} · 내 PT 일정 보기` : "내 PT 일정 보기"}
          className="block w-full px-5 pb-4 pt-3 text-left active:bg-muted/30"
        >
          {next ? (
            <>
              <p className="text-label font-bold text-muted-foreground">다음 수업</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <p className="text-title font-black tracking-tight text-foreground">{whenLabel(next.start_at, data.today)}</p>
                {chip && <span className="rounded-full bg-secondary px-2.5 py-1 text-label font-bold text-secondary-foreground">{chip}</span>}
              </div>
              <p className="mt-1.5 text-body text-foreground">
                {next.coach} 코치님 · {data.rules.slotMinutes}분{next.team ? " · 팀 수업" : ""}
              </p>
            </>
          ) : (
            <>
              <p className="text-heading font-black text-foreground">다음 수업을 잡아 볼까요?</p>
              <p className="mt-1 text-body text-foreground">
                {data.canBook ? "코치님이 열어 둔 시간에서 바로 고를 수 있어요" : "코치님이 예약을 넣으면 여기에 보여요"}
              </p>
            </>
          )}

          {/* 수업권 — 칸 막대 + 남은 횟수(브로제이 기준 시각) */}
          {remaining != null && (
            <div className="mt-4">
              {total != null && total >= remaining && <TicketCells total={total} remaining={remaining} />}
              <p className="mt-2 text-label text-muted-foreground">
                <b className="font-black tabular-nums text-foreground">남은 {n(remaining)}회</b>
                {asOf ? ` · ${asOf}` : ""}
              </p>
            </div>
          )}
          <p className="mt-2 text-label text-muted-foreground">{PT_RULE_LINE}</p>
        </button>

        <div className="flex border-t border-border">
          {data.canBook && (
            <button
              type="button"
              onClick={() => setSheet("book")}
              className="flex h-14 min-w-0 flex-1 items-center justify-center gap-1.5 text-body font-black text-primary active:bg-muted/40"
            >
              <CalendarPlus className="h-5 w-5" aria-hidden />
              예약하기
            </button>
          )}
          <button
            type="button"
            onClick={() => setSheet("list")}
            className={cn(
              "flex h-14 min-w-0 flex-1 items-center justify-center gap-1 text-body font-bold text-foreground active:bg-muted/40",
              data.canBook && "border-l border-border",
            )}
          >
            내 PT 일정
            <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden />
          </button>
        </div>
      </section>

      {sheet && (
        <Suspense fallback={null}>
          <PtSheet open onOpenChange={(v) => !v && setSheet(null)} home={data} initialView={sheet} />
        </Suspense>
      )}
    </>
  );
};

export default HomePtCard;
