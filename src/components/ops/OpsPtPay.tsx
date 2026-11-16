/**
 * 153운영본부 · PT 수당 2단계 — 「기록 + 차감」 한 달 정산표
 *   (2026-11-16 대표님 「다음진행하자」 · 보고서 「2단계 제작 계획」 2-1 · 계산 src/lib/opsPtPay.ts)
 *
 *   근무자 카드 'PT' 탭(대표님 · 지점장)과 코치 화면 'PT' 카드 — 그 달 수업을 한 줄씩:
 *   지급 대상(기록 + 차감이 맞은 수업) · 보류(차감 대기 · 수업권 끝남 확인 중 · 확인 전 · 사유 필요 · 기록 없는 차감) · 차감 기준과 다른 까닭.
 *   전환 달(지점마다 ptPayFirstRecordMonth) 앞 달은 「미리 보기」 — 그 달 수당은 차감 기록 기준 그대로다.
 *   금액은 수당표를 받은 화면만(대표님 · 회계매니저 · 그 코치 본인) — rates 가 null 이면 횟수만.
 *   월 마감(2-2 · 2026-11-16): 「기록 + 차감」 지급 달이고 서버에 마감 함수가 있으면 한 달 명세(확정 · 승인 · 「보정」 · 「정산」)를
 *   그린다 — OpsPtClose.tsx PtCloseCard · src/lib/opsPtClose.ts. 미리 보기 달 · 마감 함수가 없는 서버는 아래 2-1 카드 그대로.
 */
import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { fmtWon } from "@/lib/opsWork";
import type { OpsPtEvent, OpsPtRate } from "@/lib/opsPt";
import { PT_PAY_STATE_LABEL, ptPayDiffNotes, ptPayFirstRecordMonth, ptPayHoldText, ptPayMonth, ptPayMonthCovered, type PtPayLine } from "@/lib/opsPtPay";
import { PT_KIND_LABEL, PT_NO_ENTRY_MONTH_LIMIT, matchPtRecord, mdOf } from "@/lib/opsPtRecord";
import { useOpsPtRecord } from "@/services/opsPtRecordService";
import { PtCloseCard, usePtCloseBook } from "./OpsPtClose";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
/** "11/11(수)" */
const mdw = (date: string) => `${mdOf(date)}(${WD[new Date(`${date}T00:00:00Z`).getUTCDay()]})`;
const monthLabel = (ym: string) => `${Number(ym.slice(5, 7))}월`;

const LineRow = ({ l, money }: { l: PtPayLine; money: boolean }) => {
  const sub = [
    PT_KIND_LABEL[l.kind],
    l.auto ? "자동 기록" : "",
    l.noEntry ? "출석 없음" : "",
    l.carry ? "지난달 수업" : "",
    l.deductDate ? `차감 ${mdOf(l.deductDate)}${l.lateDeduct ? " · 늦은 차감" : ""}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-bold text-foreground">
          {mdw(l.date)} · {l.name}
        </p>
        <p className="text-label text-muted-foreground">{sub}</p>
      </div>
      <div className="shrink-0 text-right">
        {l.state !== "paid" ? (
          <p className="text-label font-bold text-amber-700">{PT_PAY_STATE_LABEL[l.state]}</p>
        ) : money ? (
          <p className="text-body font-black tabular-nums text-foreground">{l.rate == null ? "금액 없음" : fmtWon(l.rate)}</p>
        ) : (
          <p className="text-label font-bold text-primary">지급 대상</p>
        )}
      </div>
    </li>
  );
};

interface Props {
  branch: string;
  /** 이 코치의 기록 · 차감만 */
  coachId: string | null;
  /** 보는 달 (YYYY-MM-01) */
  month: string;
  /** 수당표 — 금액을 못 보는 화면은 null(횟수만) */
  rates: OpsPtRate[] | null;
  /** 그 달 차감 전체(ops_pt_month — PT 기록을 켜기 전 차감도 있다) */
  monthEvents?: OpsPtEvent[];
  /** 관리자 화면(근무자 카드 'PT' 탭) — 없으면 코치 화면 */
  manage?: boolean;
  /** 관리자 화면 — 마감 시트 제목에 쓰는 코치 이름 */
  coachName?: string;
  demo?: boolean;
  /** 예시 화면 — 이 달부터 지급 기준인 모습으로 보여 준다 */
  asOfficial?: boolean;
  /** 바로 아래에 차감 기록 기준(OpsPtPanel)이 이어진다 — 머리글을 그린다 */
  panelBelow?: boolean;
}

const OpsPtPay = ({ branch, coachId, month, rates, monthEvents, manage = false, coachName, demo = false, asOfficial = false, panelBelow = false }: Props) => {
  const q = useOpsPtRecord(branch, { demo, demoManage: manage });
  const data = q.data;
  const [open, setOpen] = useState(false);
  const calc = useMemo(() => {
    if (!data?.on) return null;
    const res = matchPtRecord(data);
    return { res, covered: ptPayMonthCovered(month, data), pay: ptPayMonth(res, data.events ?? [], rates, month, coachId, monthEvents) };
  }, [data, rates, month, coachId, monthEvents]);
  // 월 마감(2-2) — 서버에 마감 함수가 있고 PT 기록을 켠 지점만. 넉 달이 지난 달은 승인본이 있을 때만 명세가 나온다
  const closeCtx = usePtCloseBook(branch, rates, { demo, manage });
  const st = useMemo(
    () => (closeCtx && coachId && calc ? closeCtx.book.statement(coachId, month, monthEvents) : null),
    [closeCtx, coachId, calc, month, monthEvents],
  );
  if (!calc) return null;

  const { res, pay } = calc;
  const panelLabel = (text: string) => (panelBelow ? <p className="mb-2 text-label font-bold text-muted-foreground">{text}</p> : null);
  // PT 기록을 켜기 전 달 — 견줄 기록이 없다(차감 기록 기준만)
  if (pay.ym < res.startedOn.slice(0, 7)) return panelLabel("차감 기록 기준");
  const official = asOfficial || pay.basis === "record";
  // 「기록 + 차감」 지급 달 — 한 달 명세(확정 · 승인 · 보정 · 정산)
  if (st && closeCtx && coachId && official) {
    return (
      <>
        <PtCloseCard branch={branch} coachId={coachId} coachName={coachName} month={month} st={st} ctx={closeCtx} manage={manage} demo={demo} />
        {panelLabel("차감 기록 기준 (참고)")}
      </>
    );
  }
  // 넉 달이 지난 달 — 받은 자료에 그 달 기록이 일부만 있다. 0회로 보이지 않게 셈하지 않는다(승인한 달은 위 명세가 승인본을 보여 준다)
  if (!calc.covered) {
    return (
      <>
        <p className="mb-4 rounded-xl bg-secondary/60 px-3 py-2 text-label text-muted-foreground">넉 달이 지난 달은 「기록 + 차감」으로 다시 셈하지 않아요.</p>
        {panelLabel("차감 기록 기준")}
      </>
    );
  }
  const money = pay.gross != null;
  const first = ptPayFirstRecordMonth(res.startedOn);
  const startedThisMonth = res.startedOn.slice(0, 7) === pay.ym && res.startedOn.slice(8, 10) !== "01";
  const notes = ptPayDiffNotes(pay);
  const holdText = ptPayHoldText(pay.hold);
  const empty = pay.lines.length === 0 && pay.hold.extra === 0;

  return (
    <>
      <div className="mb-4 rounded-2xl border border-border p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-label text-muted-foreground">
            {official ? `${monthLabel(pay.ym)} ${manage ? "PT 수당" : "내 PT 수당"} · 기록 + 차감` : `${monthLabel(pay.ym)} · 기록 + 차감으로 셈하면`}
          </p>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-micro font-bold",
              official ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground",
            )}
          >
            {official ? "이 달 지급 기준" : "미리 보기"}
          </span>
        </div>
        {/* 미리 보기 달은 금액을 주인공으로 두지 않는다 — 그 달 수당(차감 기록 기준)으로 읽히지 않게 횟수가 주인공 */}
        <p className="mt-1 text-title font-black tabular-nums text-foreground">{official && money ? fmtWon(pay.gross ?? 0) : `${pay.paidUses}회`}</p>
        <p className="text-label text-muted-foreground">
          {!money
            ? "지급 대상 — 기록과 차감이 맞은 수업"
            : official
              ? `지급 대상 ${pay.paidUses}회 · 3.3% 떼면 ${fmtWon(pay.net ?? 0)}`
              : `지급 대상 · 이 기준이면 ${fmtWon(pay.gross ?? 0)} (3.3% 떼면 ${fmtWon(pay.net ?? 0)})`}
        </p>

        {!official && (
          <p className="mt-3 rounded-xl bg-secondary/60 px-3 py-2 text-label text-muted-foreground">
            {monthLabel(first)} 수업분부터 이 기준으로 지급해요. {monthLabel(pay.ym)} 수당은 아래 차감 기록 기준 그대로예요.
            {startedThisMonth ? ` PT 기록을 켠 ${mdOf(res.startedOn)}부터만 맞춰 봤어요.` : ""}
          </p>
        )}
        {pay.carryUses > 0 && (
          <p className="mt-2 rounded-xl bg-secondary/60 px-3 py-2 text-label text-muted-foreground">
            지난달 수업 {pay.carryUses}회가 들어 있어요 — 차감이 이 달에 잡혀 이 달에 지급해요
          </p>
        )}
        {money && pay.unpriced > 0 && (
          <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-label font-bold text-amber-800">
            {manage
              ? `수당표에 없는 수업권 ${pay.unpriced}회 — 금액을 정해 주세요`
              : `수당표에 없는 수업권 ${pay.unpriced}회 — 대표님이 금액을 정하면 더해져요`}
          </p>
        )}
        {pay.hold.total > 0 && (
          <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-label font-bold text-amber-800">
            보류 {pay.hold.total}회 — {holdText}. 풀리면 지급 대상이 돼요
          </p>
        )}
        {pay.noEntryOver && (
          <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-label font-bold text-amber-800">
            출석 체크 없는 수업 {pay.noEntry}회 — 한 달 {PT_NO_ENTRY_MONTH_LIMIT}회를 넘었어요
          </p>
        )}

        {(pay.byDeduct.uses > 0 || notes.length > 0) && (
          <div className="mt-3 border-t border-border/70 pt-3">
            <p className="text-label font-bold text-foreground">
              차감 기준으로 셈하면 {pay.byDeduct.uses}회{money && pay.byDeduct.gross != null ? ` · ${fmtWon(pay.byDeduct.gross)}` : ""}
            </p>
            {notes.length === 0 ? (
              <p className="mt-0.5 text-label text-muted-foreground">
                {pay.byDeduct.uses === pay.paidUses ? "두 기준이 같아요" : "남은 차이는 위 보류 때문이에요"}
              </p>
            ) : (
              <ul className="mt-1 space-y-0.5">
                {notes.map((n) => (
                  <li key={n} className="text-label text-muted-foreground">
                    · {n}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {empty ? (
          <p className="mt-3 rounded-xl bg-secondary/60 px-3 py-4 text-center text-label text-muted-foreground">이 달 수업 기록이 아직 없어요</p>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="mt-3 flex h-10 w-full items-center justify-center gap-1 rounded-xl bg-secondary text-label font-black text-foreground active:scale-[0.98]"
            >
              {open ? "수업 줄 접기" : `수업 ${pay.lines.length}줄 보기`}
              <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
            </button>
            {open && (
              <>
                {pay.lines.length > 0 && (
                  <ul className="mt-2 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border">
                    {pay.lines.map((l) => (
                      <LineRow key={l.id} l={l} money={money} />
                    ))}
                  </ul>
                )}
                {pay.extras.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {pay.extras.map((x) => (
                      <li key={x.eventId} className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2">
                        <span className="min-w-0 flex-1 truncate text-label text-amber-800">
                          {mdw(x.workDate)} 차감 · {x.name} · {x.count}회
                        </span>
                        <span className="shrink-0 text-label font-bold text-amber-800">기록 없음</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-label text-muted-foreground">
                  수업한 날의 달에 들어요 — 차감이 다음 달에 잡혀도 수업한 달 몫이에요. 보류는 위 「확인 필요」에서 풀 수 있어요.
                  {pay.hold.check > 0
                    ? manage
                      ? " 「수업권 끝남」은 아래 「확인할 것」에서 확인해 주세요."
                      : " 「수업권 끝남」은 지점장 확인을 기다려요."
                    : ""}
                </p>
              </>
            )}
          </>
        )}
      </div>
      {panelLabel(`차감 기록 기준${official ? " (참고)" : ` — ${monthLabel(pay.ym)} 수당`}`)}
    </>
  );
};

export default OpsPtPay;
