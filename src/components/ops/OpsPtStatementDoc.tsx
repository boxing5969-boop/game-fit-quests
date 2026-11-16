/**
 * 153운영본부 · PT 수당 2단계 2-3 — PT 수당 명세서 한 장
 *   (2026-11-16 대표님 「올리고 적용 그리고 다음작업시작」 · 보고서 「월 마감과 명세서」 — "명세서는 앱이 만들어요")
 *
 *   승인한 달의 줄(ops_pt_closes.lines) 그대로 — 여기서는 모양만: 받는 분 · 지급하는 곳 · 합계와 3.3% · 회원별 수업한 날 ·
 *   「보정」 · 「정산」 · 승인할 때의 보류. 화면(휴대폰 폭)과 PDF(A4 폭 794px · 글씨 크기 고정) 두 모양이고,
 *   종이처럼 늘 흰 바탕 · 검은 글씨다(어두운 화면에서도). PDF 쪽 나누기는 [data-pdf-block] 경계에서 —
 *   계약서와 같은 길(src/lib/contractPdf.ts renderContractPdf · savePdf).
 *   금액을 보는 화면(대표님 · 회계매니저 · 그 코치 본인)만 그린다 — 지점장은 줄 목록(횟수)만 본다.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { FileDown } from "lucide-react";
import { toast } from "sonner";

import { renderContractPdf, savePdf } from "@/lib/contractPdf";
import { krDate, krShortDay } from "@/lib/opsContract";
import {
  ptCoachLabel,
  ptPayDate,
  ptStatementFileName,
  ptStatementGroups,
  ptTicketText,
  type PtCloseHold,
  type PtCloseLine,
  type PtEmployer,
  type PtStatement,
  type PtStatementItem,
} from "@/lib/opsPtClose";
import { PT_PAY_STATE_LABEL, type PtPayLineState } from "@/lib/opsPtPay";
import { PT_KIND_LABEL, mdOf, type PtKind } from "@/lib/opsPtRecord";
import { OpsButton } from "./OpsParts";

export interface PtStatementDocProps {
  branch: string;
  coachName: string | null | undefined;
  /** 승인한 달의 명세(금액을 보는 화면) */
  st: PtStatement;
  /** 지급하는 곳 — 없으면 지점 이름만 */
  employer: PtEmployer | null;
  /** PDF 용 (A4 폭 · 글씨 크기 고정) */
  print?: boolean;
}

type Part = { className?: string; style?: CSSProperties };

const SCREEN: Record<string, Part> = {
  root: { className: "overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-5 text-body leading-relaxed text-slate-900" },
  title: { className: "text-center text-heading font-black tracking-tight" },
  basis: { className: "mt-0.5 text-center text-label text-slate-500" },
  party: { className: "mt-4" },
  row: { className: "mt-1 flex gap-2 text-label" },
  rowKey: { className: "w-[5.5rem] shrink-0 text-slate-500" },
  rowVal: { className: "min-w-0 flex-1 break-words font-bold" },
  head: { className: "mt-5 text-label font-black" },
  table: { className: "mt-1.5 w-full table-fixed border-collapse text-label" },
  th: { className: "whitespace-nowrap border border-slate-300 bg-slate-100 px-1 py-1 text-center font-bold" },
  td: { className: "border border-slate-300 px-1.5 py-1 align-middle" },
  tdNum: { className: "whitespace-nowrap border border-slate-300 px-1 py-1 text-right align-middle tabular-nums" },
  sum: { className: "mt-3" },
  sub: { className: "text-micro text-slate-500" },
  strong: { className: "font-black" },
  total: { className: "bg-slate-50 font-black" },
  note: { className: "mt-1 text-micro text-slate-500" },
  meta: { className: "mt-5 border-t border-slate-200 pt-3 text-micro leading-relaxed text-slate-500" },
};

const PRINT: Record<string, Part> = {
  root: { style: { width: 794, padding: "8px 72px 24px", fontSize: 14, lineHeight: 1.6, color: "#111827", background: "#ffffff" } },
  title: { style: { textAlign: "center", fontSize: 26, fontWeight: 900, letterSpacing: "-0.01em" } },
  basis: { style: { textAlign: "center", fontSize: 13, color: "#6b7280", marginTop: 2 } },
  party: { style: { marginTop: 18 } },
  row: { style: { marginTop: 3, display: "flex", gap: 10 } },
  rowKey: { style: { width: 110, flexShrink: 0, color: "#4b5563" } },
  rowVal: { style: { flex: 1, minWidth: 0, fontWeight: 700, wordBreak: "break-all" } },
  head: { style: { marginTop: 18, fontWeight: 900, fontSize: 15 } },
  table: { style: { marginTop: 6, width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" } },
  // 표 칸은 줄 간격을 줄인다 — 넓은 줄 간격이면 그림으로 뜰 때(html2canvas) 글자가 칸 아래로 처진다(계약서와 같은 값)
  th: {
    style: {
      border: "1px solid #9ca3af",
      background: "#f3f4f6",
      padding: "6px 8px",
      textAlign: "center",
      fontWeight: 700,
      lineHeight: 1.25,
      verticalAlign: "middle",
    },
  },
  td: { style: { border: "1px solid #9ca3af", padding: "5px 8px", lineHeight: 1.3, verticalAlign: "middle" } },
  tdNum: {
    style: {
      border: "1px solid #9ca3af",
      padding: "5px 8px",
      lineHeight: 1.3,
      verticalAlign: "middle",
      textAlign: "right",
      fontVariantNumeric: "tabular-nums",
      whiteSpace: "nowrap",
    },
  },
  sum: { style: { marginTop: 14 } },
  sub: { style: { fontSize: 11.5, color: "#6b7280" } },
  strong: { style: { fontWeight: 900 } },
  total: { style: { background: "#f9fafb", fontWeight: 900 } },
  note: { style: { marginTop: 4, fontSize: 11.5, color: "#6b7280" } },
  meta: { style: { marginTop: 18, borderTop: "1px solid #e5e7eb", paddingTop: 8, fontSize: 11.5, lineHeight: 1.55, color: "#6b7280" } },
};

/** 표 칸 너비 — 화면은 좁아서 회원 · 수업권을 한 칸에, 인쇄는 따로 */
const COLS = {
  sum: ["66%", "34%"],
  memberScreen: ["30%", "26%", "14%", "30%"],
  memberPrint: ["17%", "24%", "33%", "9%", "17%"],
  line: ["26%", "42%", "32%"],
  hold: ["45%", "55%"],
} as const;
const Cols = ({ w }: { w: readonly string[] }) => (
  <colgroup>
    {w.map((x, i) => (
      <col key={i} style={{ width: x }} />
    ))}
  </colgroup>
);

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const sumRate = (list: Array<{ rate: number | null }>) => list.reduce((n, l) => n + (l.rate ?? 0), 0);
const kindOf = (k: string) => PT_KIND_LABEL[k as PtKind] ?? k;
const monthNo = (ym: string) => Number(ym.slice(5, 7));
/** "12/3 · 12/10 · 12/17(노쇼)" — 수업이 아닌 종류만 괄호로 */
const daysText = (items: PtStatementItem[]) => items.map((i) => `${mdOf(i.date)}${i.kind === "lesson" ? "" : `(${kindOf(i.kind)})`}`).join(" · ");
const holdText = (h: PtCloseHold) =>
  h.state === "extra" ? `기록 없는 차감${h.n && h.n > 1 ? ` ${h.n}회` : ""}` : (PT_PAY_STATE_LABEL[h.state as PtPayLineState] ?? "보류");
/** 서버 시각(+00:00) → 한국 날짜 "2027년 1월 4일" */
const kstDay = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return krDate(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(d));
};

const OpsPtStatementDoc = ({ branch, coachName, st, employer, print = false }: PtStatementDocProps) => {
  const P = print ? PRINT : SCREEN;
  const y = Number(st.ym.slice(0, 4));
  const m = monthNo(st.ym);
  const groups = ptStatementGroups(st.pay);
  const holds = st.close?.holds ?? [];
  const payer = [employer?.biz_name?.trim() || branch, employer?.owner_name?.trim() ? `대표 ${employer.owner_name.trim()}` : ""].filter(Boolean).join(" · ");
  const lineRow = (l: PtCloseLine, minus: boolean) => (
    <tr key={l.k} data-pdf-block>
      <td {...P.td}>
        {mdOf(l.date)} · {l.name}
      </td>
      <td {...P.td}>
        {[kindOf(l.kind), l.from ? `${monthNo(l.from)}월 ${minus ? "지급" : "수업"}` : "", !minus && l.deduct ? `차감 ${mdOf(l.deduct)}` : ""]
          .filter(Boolean)
          .join(" · ")}
      </td>
      <td {...P.tdNum}>{l.rate == null ? "—" : `${minus ? "−" : "+"}${won(l.rate)}`}</td>
    </tr>
  );

  return (
    <div {...P.root}>
      <div data-pdf-block>
        <p {...P.title}>PT 수당 명세서</p>
        <p {...P.basis}>
          {y}년 {m}월 수업분 · {branch}
        </p>
      </div>

      <div {...P.party} data-pdf-block>
        <div {...P.row}>
          <span {...P.rowKey}>받는 분</span>
          <span {...P.rowVal}>{ptCoachLabel(coachName)}</span>
        </div>
        <div {...P.row}>
          <span {...P.rowKey}>지급하는 곳</span>
          <span {...P.rowVal}>{payer}</span>
        </div>
        {employer?.biz_number?.trim() && (
          <div {...P.row}>
            <span {...P.rowKey}>사업자번호</span>
            <span {...P.rowVal}>{employer.biz_number.trim()}</span>
          </div>
        )}
        <div {...P.row}>
          <span {...P.rowKey}>승인한 날</span>
          <span {...P.rowVal}>{kstDay(st.close?.approved_at) || "—"}</span>
        </div>
        <div {...P.row}>
          <span {...P.rowKey}>지급 예정일</span>
          <span {...P.rowVal}>{krDate(ptPayDate(st.ym))}</span>
        </div>
      </div>

      {/* 합계 */}
      <div {...P.sum} data-pdf-block>
        <table {...P.table}>
          <Cols w={COLS.sum} />
          <tbody>
            <tr>
              <td {...P.td}>이 달 수업 {st.pay.length}회</td>
              <td {...P.tdNum}>{won(sumRate(st.pay))}</td>
            </tr>
            {st.adj.length > 0 && (
              <tr>
                <td {...P.td}>보정 {st.adj.length}회 — 닫은 달에서 뒤늦게 지급 대상이 된 수업</td>
                <td {...P.tdNum}>+{won(sumRate(st.adj))}</td>
              </tr>
            )}
            {st.settle.length > 0 && (
              <tr>
                <td {...P.td}>정산 {st.settle.length}회 — 지급한 뒤 없던 일이 된 수업</td>
                <td {...P.tdNum}>−{won(sumRate(st.settle))}</td>
              </tr>
            )}
            <tr>
              <td {...P.td}>
                <span {...P.strong}>합계 (3.3% 전)</span>
              </td>
              <td {...P.tdNum}>
                <span {...P.strong}>{won(st.gross ?? 0)}</span>
              </td>
            </tr>
            <tr>
              <td {...P.td}>소득세 3%</td>
              <td {...P.tdNum}>−{won(st.tax?.income ?? 0)}</td>
            </tr>
            <tr>
              <td {...P.td}>지방소득세 0.3%</td>
              <td {...P.tdNum}>−{won(st.tax?.local ?? 0)}</td>
            </tr>
            <tr {...P.total}>
              <td {...P.td}>실지급액 (3.3% 뗀 금액)</td>
              <td {...P.tdNum}>{won(st.net ?? 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 회원별 */}
      {groups.length > 0 && (
        <>
          <p {...P.head} data-pdf-block>
            회원별 수업
          </p>
          <table {...P.table}>
            <Cols w={print ? COLS.memberPrint : COLS.memberScreen} />
            <thead>
              <tr data-pdf-block>
                {print ? (
                  <>
                    <th {...P.th}>회원</th>
                    <th {...P.th}>수업권 · 1회 수당</th>
                  </>
                ) : (
                  <th {...P.th}>회원 · 수업권</th>
                )}
                <th {...P.th}>수업한 날</th>
                <th {...P.th}>횟수</th>
                <th {...P.th}>금액</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const ticket = [ptTicketText(g.ticket), g.rate != null ? `1회 ${won(g.rate)}` : ""].filter(Boolean).join(" · ");
                return (
                  <tr key={g.key} data-pdf-block>
                    {print ? (
                      <>
                        <td {...P.td}>
                          <span {...P.strong}>{g.name}</span>
                        </td>
                        <td {...P.td}>{ticket}</td>
                      </>
                    ) : (
                      <td {...P.td}>
                        <span {...P.strong}>{g.name}</span>
                        <br />
                        <span {...P.sub}>{ticket}</span>
                      </td>
                    )}
                    <td {...P.td}>{daysText(g.items)}</td>
                    <td {...P.tdNum}>{g.uses}회</td>
                    <td {...P.tdNum}>{g.amount == null ? "—" : won(g.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {st.pay.some((l) => l.t === "carry") && <p {...P.note}>지난달에 한 수업도 들어 있어요 — 차감이 이 달에 잡혀 이 달에 지급해요.</p>}
        </>
      )}

      {st.adj.length > 0 && (
        <>
          <p {...P.head} data-pdf-block>
            보정 — 닫은 달에서 뒤늦게 지급 대상이 된 수업
          </p>
          <table {...P.table}>
            <Cols w={COLS.line} />
            <tbody>{st.adj.map((l) => lineRow(l, false))}</tbody>
          </table>
        </>
      )}

      {st.settle.length > 0 && (
        <>
          <p {...P.head} data-pdf-block>
            정산 — 지급한 뒤 없던 일이 된 수업 (코치 동의)
          </p>
          <table {...P.table}>
            <Cols w={COLS.line} />
            <tbody>{st.settle.map((l) => lineRow(l, true))}</tbody>
          </table>
        </>
      )}

      {holds.length > 0 && (
        <>
          <p {...P.head} data-pdf-block>
            승인할 때 보류 {st.hold}회 — 이 달에 넣지 않았어요
          </p>
          <table {...P.table}>
            <Cols w={COLS.hold} />
            <tbody>
              {holds.map((h, i) => (
                <tr key={h.k ?? `${h.date}-${h.name}-${i}`} data-pdf-block>
                  <td {...P.td}>
                    {mdOf(h.date)} · {h.name}
                  </td>
                  <td {...P.td}>{holdText(h)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p {...P.note}>풀리면 다음에 닫는 달에 「보정」 줄로 지급해요.</p>
        </>
      )}

      <div {...P.meta} data-pdf-block>
        마이복서153 앱에서 승인한 줄 그대로예요
        {st.close?.confirmed_at ? ` · 코치 확정 ${krShortDay(st.close.confirmed_at)}` : ""}
        {st.close?.approved_at ? ` · 승인 ${krShortDay(st.close.approved_at)}` : ""}
        {st.close?.id ? ` · 문서 번호 ${st.close.id.slice(0, 8)}` : ""}
        <br />
        사업소득 3.3%(소득세 3% + 지방소득세 0.3%, 각각 10원 미만 버림)를 떼고 지급해요. 닫은 뒤 달라진 수업은 다음 달 명세서의 「보정」 · 「정산」 줄에 나와요.
        {employer?.address?.trim() ? (
          <>
            <br />
            {[employer.biz_name?.trim(), employer.address.trim(), employer.phone?.trim()].filter(Boolean).join(" · ")}
          </>
        ) : null}
      </div>
    </div>
  );
};

/** PDF — 화면 밖에 A4 폭으로 그려서 뜬다(계약서와 같은 길). 휴대폰은 공유(카톡 · 파일), 컴퓨터는 내려받기 */
export const PtStatementPdfButton = (props: Omit<PtStatementDocProps, "print"> & { tone?: "plain" | "primary" | "dark" }) => {
  const { tone = "primary", ...doc } = props;
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const title = `PT 수당 명세서 · ${Number(doc.st.ym.slice(0, 4))}년 ${monthNo(doc.st.ym)}월 · ${ptCoachLabel(doc.coachName)}`;
  useEffect(() => {
    if (!busy) return;
    let alive = true;
    const t = window.setTimeout(async () => {
      try {
        const root = ref.current?.firstElementChild as HTMLElement | null;
        if (!root) throw new Error("명세서를 그리지 못했어요");
        const blob = await renderContractPdf(root, {
          title,
          footer: `PT 수당 명세서 ${doc.st.ym}${doc.st.close?.id ? ` · ${doc.st.close.id.slice(0, 8)}` : ""}`,
        });
        const how = await savePdf(blob, ptStatementFileName(doc.st.ym, doc.coachName));
        if (alive && how === "downloaded") toast.success("PDF 를 내려받았어요");
      } catch (e) {
        if (alive) toast.error((e as Error).message || "PDF 를 만들지 못했어요");
      } finally {
        if (alive) setBusy(false);
      }
    }, 60);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);
  return (
    <>
      <OpsButton tone={tone} onClick={() => setBusy(true)} disabled={busy}>
        <FileDown className="h-5 w-5" /> {busy ? "PDF 만드는 중…" : "PDF 저장 · 보내기"}
      </OpsButton>
      {busy &&
        createPortal(
          <div ref={ref} aria-hidden style={{ position: "fixed", left: -12000, top: 0, width: 794, background: "#ffffff", pointerEvents: "none" }}>
            <OpsPtStatementDoc {...doc} print />
          </div>,
          document.body,
        )}
    </>
  );
};

export default OpsPtStatementDoc;
