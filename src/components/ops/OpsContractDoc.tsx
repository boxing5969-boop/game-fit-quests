/**
 * 계약서 한 장 그리기 (2026-11-03) — 화면(휴대폰 폭에 맞춤)과 PDF(A4 폭 794px · 글씨 크기 고정) 두 가지.
 *   글은 보낸 그대로(doc) — 여기서는 모양만. 종이처럼 늘 흰 바탕 · 검은 글씨(어두운 화면에서도).
 *   PDF 쪽 나누기는 [data-pdf-block] 경계에서 (src/lib/contractPdf.ts).
 */
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { krDate, krStamp, type ContractDoc, type ContractStatus } from "@/lib/opsContract";

export interface OpsContractDocProps {
  doc: ContractDoc;
  employerSign?: string | null;
  employerAt?: string | null;
  workerSign?: string | null;
  /** 서명할 때 적은 이름 (없으면 계약서의 이름) */
  workerName?: string | null;
  workerAddress?: string | null;
  workerPhone?: string | null;
  workerAt?: string | null;
  inPerson?: boolean;
  meta?: { id: string; docHash: string; sealedHash?: string | null } | null;
  status?: ContractStatus;
  voidReason?: string | null;
  /** PDF 용 (A4 폭 · 글씨 크기 고정) */
  print?: boolean;
}

type Part = { className?: string; style?: CSSProperties };

const SCREEN: Record<string, Part> = {
  root: { className: "relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-5 text-body leading-relaxed text-slate-900" },
  title: { className: "text-center text-heading font-black tracking-tight" },
  basis: { className: "mt-1 text-center text-label text-slate-500" },
  intro: { className: "mt-4" },
  item: { className: "mt-3.5" },
  head: { className: "font-bold" },
  line: { className: "mt-0.5 pl-3 -indent-3" },
  table: { className: "mt-1.5 w-full border-collapse text-label" },
  th: { className: "border border-slate-300 bg-slate-100 px-1 py-1 text-center font-bold" },
  td: { className: "border border-slate-300 px-1 py-1 text-center align-middle" },
  date: { className: "mt-6 text-center font-bold" },
  party: { className: "mt-4" },
  partyLabel: { className: "font-black" },
  row: { className: "mt-1 flex gap-2" },
  rowKey: { className: "w-[6.5rem] shrink-0 text-slate-500" },
  rowVal: { className: "min-w-0 flex-1 break-words" },
  signImg: { className: "h-12 max-w-[11rem] object-contain" },
  signNote: { className: "text-label text-slate-500" },
  meta: { className: "mt-5 border-t border-slate-200 pt-3 text-label leading-relaxed text-slate-500" },
  void: { className: "mb-4 rounded-xl bg-red-50 px-3 py-2 text-label font-bold text-red-700" },
};

const PRINT: Record<string, Part> = {
  root: { style: { width: 794, padding: "8px 72px 24px", fontSize: 14, lineHeight: 1.7, color: "#111827", background: "#ffffff", position: "relative" } },
  title: { style: { textAlign: "center", fontSize: 26, fontWeight: 900, letterSpacing: "-0.01em" } },
  basis: { style: { textAlign: "center", fontSize: 12, color: "#6b7280", marginTop: 2 } },
  intro: { style: { marginTop: 22 } },
  item: { style: { marginTop: 13 } },
  head: { style: { fontWeight: 700 } },
  line: { style: { marginTop: 1, paddingLeft: 16, textIndent: -16 } },
  table: { style: { marginTop: 6, width: "100%", borderCollapse: "collapse", fontSize: 13 } },
  // 표 칸은 줄 간격을 줄인다 — 넓은 줄 간격이면 그림으로 뜰 때(html2canvas) 글자가 칸 아래로 처진다
  th: { style: { border: "1px solid #9ca3af", background: "#f3f4f6", padding: "6px 6px", textAlign: "center", fontWeight: 700, lineHeight: 1.25, verticalAlign: "middle" } },
  td: { style: { border: "1px solid #9ca3af", padding: "6px 6px", textAlign: "center", lineHeight: 1.25, verticalAlign: "middle" } },
  date: { style: { marginTop: 30, textAlign: "center", fontWeight: 700, fontSize: 15 } },
  party: { style: { marginTop: 18 } },
  partyLabel: { style: { fontWeight: 900 } },
  row: { style: { marginTop: 4, display: "flex", gap: 10 } },
  rowKey: { style: { width: 120, flexShrink: 0, color: "#4b5563" } },
  rowVal: { style: { flex: 1, minWidth: 0, wordBreak: "break-all" } },
  signImg: { style: { height: 58, maxWidth: 220, objectFit: "contain" } },
  signNote: { style: { fontSize: 12, color: "#6b7280" } },
  meta: { style: { marginTop: 26, borderTop: "1px solid #e5e7eb", paddingTop: 10, fontSize: 11.5, lineHeight: 1.6, color: "#6b7280" } },
  void: { style: { marginBottom: 16, borderRadius: 10, background: "#fef2f2", padding: "8px 12px", fontSize: 13, fontWeight: 700, color: "#b91c1c" } },
};

const OpsContractDoc = ({
  doc,
  employerSign,
  employerAt,
  workerSign,
  workerName,
  workerAddress,
  workerPhone,
  workerAt,
  inPerson,
  meta,
  status,
  voidReason,
  print,
}: OpsContractDocProps) => {
  const S = print ? PRINT : SCREEN;
  const p = (k: string, extra?: Part): Part => ({
    className: cn(S[k]?.className, extra?.className) || undefined,
    style: S[k]?.style || extra?.style ? { ...S[k]?.style, ...extra?.style } : undefined,
  });
  const row = (k: string, children: ReactNode, center = false) => (
    <div key={k} {...p("row", center ? { className: "items-center", style: print ? { alignItems: "center" } : undefined } : undefined)}>
      <span {...p("rowKey")}>{k}</span>
      <span {...p("rowVal")}>{children}</span>
    </div>
  );
  /** 이름 + 서명 그림 (없으면 '서명 전') */
  const signed = (name: string, src?: string | null) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: print ? 10 : 8, flexWrap: "wrap" }}>
      <span style={{ fontWeight: 700 }}>{name}</span>
      {src ? <img src={src} alt="서명" {...p("signImg")} /> : <span {...p("signNote")}>(서명 전)</span>}
      {/* 종이(PDF)는 서명 옆 '(서명)' 표시 — 휴대폰 화면은 줄이 넘쳐 뺀다 */}
      {src && print && <span {...p("signNote")}>(서명)</span>}
    </span>
  );

  const signedName = (workerName || doc.worker.name).trim();

  return (
    <div {...p("root")} data-contract-doc>
      {status === "void" && (
        <div {...p("void")} data-pdf-block>
          이 계약서는 무효예요{voidReason ? ` · ${voidReason}` : ""}
        </div>
      )}
      <div data-pdf-block>
        <h3 {...p("title")}>{doc.title}</h3>
        <p {...p("basis")}>{doc.basis}</p>
        <p {...p("intro")}>{doc.intro}</p>
      </div>

      {doc.items.map((it, i) => {
        const inline = !it.table && it.lines.length === 1;
        return (
          <div key={i} {...p("item")} data-pdf-block>
            {inline ? (
              <p>
                <span {...p("head")}>
                  {i + 1}. {it.head}
                </span>{" "}
                : {it.lines[0]}
              </p>
            ) : (
              <>
                <p {...p("head")}>
                  {i + 1}. {it.head}
                </p>
                {it.table && it.table.rows.length > 0 && (
                  <table {...p("table")}>
                    <thead>
                      <tr>
                        {it.table.head.map((h) => (
                          <th key={h} {...p("th")}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {it.table.rows.map((r, ri) => (
                        <tr key={ri}>
                          {r.map((c, ci) => (
                            <td key={ci} {...p("td")}>
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {it.lines.map((l, li) => (
                  <p key={li} {...p("line")}>
                    - {l}
                  </p>
                ))}
              </>
            )}
          </div>
        );
      })}

      <div data-pdf-block>
        <p {...p("date")}>{krDate(doc.date)}</p>
        <div {...p("party")}>
          <p {...p("partyLabel")}>({doc.employer.label})</p>
          {doc.employer.rows.map(([k, v]) => row(k, v))}
          {row("대표자", signed(doc.employer.owner, employerSign), true)}
        </div>
        <div {...p("party")}>
          <p {...p("partyLabel")}>({doc.worker.label})</p>
          {row("주소", workerAddress || "")}
          {row("연락처", workerPhone || "")}
          {row("성명", signed(signedName, workerSign), true)}
        </div>
      </div>

      {meta && (
        <div {...p("meta")} data-pdf-block>
          <p>
            전자문서 · 문서 번호 {meta.id.slice(0, 8)}
            {employerAt ? ` · ${doc.employer.label} 서명 ${krStamp(employerAt)}` : ""}
            {workerAt ? ` · ${doc.worker.label} 서명 ${krStamp(workerAt)} (${inPerson ? "대면 서명" : "앱 · 본인 계정"})` : ""}
          </p>
          <p>
            문서 지문(SHA-256) {meta.docHash.slice(0, 16)}
            {meta.sealedHash ? ` · 서명 봉인 ${meta.sealedHash.slice(0, 16)}` : ""}
          </p>
        </div>
      )}
    </div>
  );
};

export default OpsContractDoc;
