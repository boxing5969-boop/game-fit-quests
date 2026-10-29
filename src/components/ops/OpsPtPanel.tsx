/**
 * 153운영본부 · PT — 회원별 이번 달 수업 · 남은 횟수 · 차감 기록 (관리자: 수당 · 확인 · 빼기 / PT 코치: 보기만)
 *   2026-10-29 대표님 "재우가 와서 PT를 소진하면 어떤 사람 PT를 했고 PT 횟수 얼마나 남았는지 볼 수 있도록 월급 정산할 때 같이"
 *   계산은 src/lib/opsPt.ts
 */
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { fmtWon } from "@/lib/opsWork";
import { classifyTicket, withholding33, type OpsPtEvent, type OpsPtSummary } from "@/lib/opsPt";
import { useOpsPtEventSet } from "@/services/opsService";
import { OpsLabel, fmtDay } from "./OpsParts";

export const ptTicketLabel = (ticket: string | null) => {
  if (!ticket) return "";
  const k = classifyTicket(ticket);
  const n = k.sessions ? `${k.sessions}회` : "";
  return k.teamSize === 1 ? `1:1 ${n}`.trim() : `${k.teamSize}인 팀 ${n}`.trim();
};

const STATUS: Record<OpsPtEvent["status"], { label: string; cls: string }> = {
  auto: { label: "", cls: "" },
  confirmed: { label: "인정", cls: "bg-primary/10 text-primary" },
  check: { label: "확인", cls: "bg-amber-100 text-amber-800" },
  excluded: { label: "뺌", cls: "bg-muted text-muted-foreground" },
};

/** 수업권이 끝난 기록 — 마지막 수업이면 '수업으로', 기한 만료 · 환불이면 '빼기' */
export const PtCheckItem = ({ e }: { e: OpsPtEvent }) => {
  const set = useOpsPtEventSet();
  const run = (status: "confirmed" | "excluded") =>
    set.mutate(
      { id: e.id, status },
      {
        onSuccess: () => toast.success(status === "confirmed" ? "PT 수업으로 넣었어요" : "수당에서 뺐어요"),
        onError: (err) => toast.error((err as Error).message),
      },
    );
  return (
    <li className="rounded-xl bg-amber-50 p-3">
      <p className="text-label font-bold text-amber-800">PT 수업권 끝남 · {fmtDay(e.work_date)}</p>
      <p className="mt-0.5 text-body text-foreground">
        {e.member_name} · {ptTicketLabel(e.ticket_name)} · 남은 {e.before ?? e.used}회
      </p>
      {e.note && <p className="text-label text-muted-foreground">{e.note}</p>}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={set.isPending}
          onClick={() => run("excluded")}
          className="h-10 rounded-xl border border-border bg-background text-label font-black text-foreground active:scale-[0.98] disabled:opacity-50"
        >
          빼기
        </button>
        <button
          type="button"
          disabled={set.isPending}
          onClick={() => run("confirmed")}
          className="h-10 rounded-xl bg-primary text-label font-black text-primary-foreground active:scale-[0.98] disabled:opacity-50"
        >
          수업 {e.used}회로
        </button>
      </div>
    </li>
  );
};

const OpsPtPanel = ({
  summary,
  events,
  manage,
}: {
  summary: OpsPtSummary;
  /** 이 코치의 이번 달 차감 기록 (최근 먼저) */
  events: OpsPtEvent[];
  manage: boolean;
}) => {
  const set = useOpsPtEventSet();
  const tax = summary.gross != null ? withholding33(summary.gross) : null;
  const toggle = (e: OpsPtEvent) =>
    set.mutate(
      { id: e.id, status: e.status === "excluded" ? "auto" : "excluded" },
      { onError: (err) => toast.error((err as Error).message) },
    );

  return (
    <div>
      <div className={cn("grid gap-2", manage ? "grid-cols-2" : "grid-cols-1")}>
        <div className="rounded-2xl border border-border p-4">
          <p className="text-label text-muted-foreground">이번 달 PT</p>
          <p className="mt-0.5 text-title font-black tabular-nums text-foreground">{summary.uses}회</p>
          <p className="text-label text-muted-foreground">회원 {summary.members.filter((m) => m.usedThisMonth > 0).length}명</p>
        </div>
        {manage && (
          <div className="rounded-2xl border border-border p-4">
            <p className="text-label text-muted-foreground">PT 수당</p>
            <p className="mt-1.5 whitespace-nowrap text-heading font-black tabular-nums text-foreground">{fmtWon(summary.gross ?? 0)}</p>
            <p className="text-label text-muted-foreground">3.3% 떼면 {fmtWon(tax?.net ?? 0)}</p>
          </div>
        )}
      </div>
      {manage && summary.unpriced > 0 && (
        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-label font-bold text-amber-800">
          수당표에 없는 수업권 {summary.unpriced}회 — 금액을 정해 주세요
        </p>
      )}

      {manage && summary.toCheck.length > 0 && (
        <>
          <OpsLabel>확인할 것</OpsLabel>
          <ul className="space-y-2">
            {summary.toCheck.map((e) => (
              <PtCheckItem key={e.id} e={e} />
            ))}
          </ul>
        </>
      )}

      <OpsLabel>{manage ? "회원별" : "내 PT 회원"}</OpsLabel>
      {summary.members.length === 0 ? (
        <p className="rounded-xl bg-secondary/60 px-3 py-4 text-center text-label text-muted-foreground">PT 수업권이 있는 회원이 없어요</p>
      ) : (
        <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border">
          {summary.members.map((m) => (
            <li key={m.key} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-bold text-foreground">{m.name}</p>
                <p className="truncate text-label text-muted-foreground">
                  {ptTicketLabel(m.ticket)}
                  {m.remaining != null ? ` · 남음 ${m.remaining}회` : " · 끝남"}
                  {m.endDate ? ` · ~${Number(m.endDate.slice(5, 7))}/${Number(m.endDate.slice(8, 10))}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-body font-black tabular-nums text-foreground">{m.usedThisMonth > 0 ? `${m.usedThisMonth}회` : "—"}</p>
                {manage && m.pay != null && m.pay > 0 && <p className="text-label tabular-nums text-muted-foreground">{fmtWon(m.pay)}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <OpsLabel>차감 기록 (브로제이)</OpsLabel>
      {events.length === 0 ? (
        <p className="rounded-xl bg-secondary/60 px-3 py-4 text-center text-label text-muted-foreground">이번 달 차감 기록이 아직 없어요</p>
      ) : (
        <ul className="space-y-1.5">
          {events.map((e) => (
            <li key={e.id} className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-label text-foreground">
                {fmtDay(e.work_date)} · {e.member_name} · {e.used}회
                {e.before != null && e.after != null ? ` (${e.before}→${e.after})` : e.kind === "manual" ? " (직접 넣음)" : ""}
              </span>
              {STATUS[e.status].label && (
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-micro font-bold", STATUS[e.status].cls)}>
                  {STATUS[e.status].label}
                </span>
              )}
              {manage && e.status !== "check" && (
                <button
                  type="button"
                  disabled={set.isPending}
                  onClick={() => toggle(e)}
                  className="shrink-0 text-label font-bold text-muted-foreground underline underline-offset-2"
                >
                  {e.status === "excluded" ? "되돌리기" : "빼기"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-label text-muted-foreground">
        브로제이 남은 횟수는 회원마다 하루~이틀에 한 번 확인해요 — 차감 날짜가 하루 이틀 늦게 잡힐 수 있어요
      </p>
    </div>
  );
};

export default OpsPtPanel;
