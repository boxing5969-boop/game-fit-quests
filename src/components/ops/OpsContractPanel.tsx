/**
 * 근무자 카드 › 계약서 탭 (2026-11-03) — 대표님 · 회계매니저(돈을 보는 분)만
 *   사업주 정보(처음 한 번) · 이 사람 계약서 목록(서명 기다림 · 서명 완료 · 무효) · 새로 쓰기(근로계약서 / PT 업무위탁 계약서)
 */
import { useState } from "react";
import { ChevronRight, FileSignature, Store } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  CONTRACT_STATUS,
  contractNeeds,
  contractShortName,
  employerReady,
  krShortDay,
  periodText,
  visibleContracts,
  type ContractKind,
} from "@/lib/opsContract";
import type { OpsRule, OpsStaff } from "@/lib/opsWork";
import { useOpsContractList } from "@/services/opsContractService";
import OpsContractEditor from "./OpsContractEditor";
import OpsContractSheet from "./OpsContractSheet";
import OpsEmployerSheet from "./OpsEmployerSheet";
import { OpsButton } from "./OpsParts";

const OpsContractPanel = ({ branch, staff, rules }: { branch: string; staff: OpsStaff; rules: OpsRule[] }) => {
  const q = useOpsContractList(staff.id);
  const [editor, setEditor] = useState<ContractKind | null>(null);
  const [view, setView] = useState<string | null>(null);
  const [empOpen, setEmpOpen] = useState(false);

  if (q.isLoading)
    return (
      <div className="space-y-2" aria-hidden>
        <div className="h-20 animate-pulse rounded-2xl bg-secondary" />
        <div className="h-28 animate-pulse rounded-2xl bg-secondary" />
      </div>
    );
  if (!q.data)
    return (
      <div className="rounded-2xl bg-secondary/60 px-4 py-6 text-center">
        <p className="text-body font-bold text-foreground">계약서를 불러오지 못했어요</p>
        <p className="mt-1 text-label text-muted-foreground">{(q.error as Error | null)?.message ?? "잠시 후 다시 시도해 주세요"}</p>
      </div>
    );

  const data = q.data;
  const emp = data.employer;
  const ready = employerReady(emp);
  const needs = contractNeeds(staff);
  const list = visibleContracts(data.contracts);

  return (
    <>
      {staff.kind === "volunteer" && (
        <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2.5 text-label text-amber-800">
          무급 도우미는 계약서가 없어요 — 시간을 정해 일을 맡기면 근로자예요(형태를 바꾸면 근로계약서를 쓸 수 있어요)
        </p>
      )}

      {/* 사업주 정보 — 계약서 맨 아래 사업주 칸 · 대표님 서명 */}
      <button
        type="button"
        onClick={() => setEmpOpen(true)}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl border p-4 text-left active:scale-[0.99]",
          ready ? "border-border" : "border-amber-300 bg-amber-50",
        )}
      >
        <Store className={cn("h-6 w-6 shrink-0", ready ? "text-muted-foreground" : "text-amber-700")} />
        <div className="min-w-0 flex-1">
          <p className="text-body font-black text-foreground">사업주 정보</p>
          <p className={cn("truncate text-label", ready ? "text-muted-foreground" : "font-bold text-amber-800")}>
            {ready
              ? `${emp!.biz_name} · 대표 ${emp!.owner_name}`
              : data.hq
                ? "처음 한 번 — 사업체 정보와 대표님 서명을 넣어 주세요"
                : "대표님이 사업주 정보와 서명을 넣으면 보낼 수 있어요"}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {/* 계약서 목록 */}
      {list.length > 0 && (
        <ul className="mt-3 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border">
          {list.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => setView(c.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-secondary/60">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-bold text-foreground">{c.title}</p>
                  <p className="truncate text-label text-muted-foreground">
                    {periodText(c.start_date, c.end_date)}
                    {c.status === "signed"
                      ? ` · ${krShortDay(c.signed_at)} 서명${!c.delivered_at ? " · 사본 아직" : ""}`
                      : c.status === "sent"
                        ? ` · ${krShortDay(c.sent_at)} 보냄${c.has_app ? (c.viewed_at ? " · 읽음" : "") : " · 대면 서명"}`
                        : c.void_reason
                          ? ` · ${c.void_reason}`
                          : ""}
                  </p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-micro font-bold", CONTRACT_STATUS[c.status].cls)}>
                  {CONTRACT_STATUS[c.status].label}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 새로 쓰기 */}
      {needs.length > 0 && (
        <div className="mt-4 space-y-2">
          {needs.map((k, i) => (
            <OpsButton key={k} tone={i === 0 ? "primary" : "plain"} disabled={!ready} onClick={() => setEditor(k)}>
              <FileSignature className="h-5 w-5" />
              {k === "labor" ? "근로계약서 쓰기" : staff.pt_freelancer && staff.kind !== "freelancer" ? "PT 업무위탁 계약서 쓰기" : "업무위탁 계약서 쓰기"}
            </OpsButton>
          ))}
          <p className="text-label text-muted-foreground">
            {staff.user_id
              ? `보내면 ${staff.name}님 앱에 알림이 가요 — 앱에서 읽고 손가락으로 서명해요`
              : "앱 계정이 없는 분은 보낸 뒤 이 휴대폰으로 직접 서명을 받아요"}
          </p>
          {needs.includes("labor") && !list.some((c) => c.kind === "labor" && c.status === "signed") && (
            <p className="text-label text-muted-foreground">{contractShortName("labor")}는 첫 출근 날 주세요 — 안 주면 500만 원 이하 벌금(근로기준법 17조)</p>
          )}
        </div>
      )}

      <OpsContractEditor
        open={!!editor}
        onClose={() => setEditor(null)}
        kind={editor}
        branch={branch}
        staff={staff}
        rules={rules}
        data={data}
        stacked
        onSent={(id) => {
          setEditor(null);
          setView(id);
        }}
      />
      <OpsContractSheet id={view} onClose={() => setView(null)} stacked />
      <OpsEmployerSheet open={empOpen} onClose={() => setEmpOpen(false)} branch={branch} employer={emp} canEdit={data.hq} stacked />
    </>
  );
};

export default OpsContractPanel;
