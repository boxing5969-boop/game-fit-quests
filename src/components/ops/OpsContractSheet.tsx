/**
 * 계약서 한 장 — 보기 · 서명 · PDF (2026-11-03)
 *   코치님(받은 분): 읽기 → '서명하기'(동의 · 이름 · 주소/연락처(선택) · 손가락 서명) → 서명 완료 · PDF 저장
 *   대표님 · 회계매니저: 상태 · PDF · '지금 여기서 서명 받기'(대면 — 앱 계정이 없는 분) · 사본 준 것 남기기 · 무효로 하기
 *   알림 링크 /office?tab=work&contract=<id> 로도 열린다(OpsWorkTab).
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, FileDown } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { CONTRACT_STATUS, contractFileName, krShortDay, krStamp } from "@/lib/opsContract";
import { renderContractPdf, savePdf } from "@/lib/contractPdf";
import {
  useOpsContract,
  useOpsContractDelivered,
  useOpsContractSign,
  useOpsContractVoid,
  type OpsContractFull,
} from "@/services/opsContractService";
import OpsContractDoc from "./OpsContractDoc";
import OpsSignaturePad from "./OpsSignaturePad";
import { OpsButton, OpsLabel, OpsSheet, opsInput } from "./OpsParts";

interface Props {
  id: string | null;
  onClose: () => void;
  stacked?: boolean;
}

const docProps = (c: OpsContractFull) => ({
  doc: c.doc,
  employerSign: c.employer_sign,
  employerAt: c.sent_at,
  workerSign: c.worker_sign,
  workerName: c.worker_sign_name,
  workerAddress: c.worker_address,
  workerPhone: c.worker_phone,
  workerAt: c.signed_at,
  inPerson: c.in_person,
  meta: { id: c.id, docHash: c.doc_hash, sealedHash: c.sealed_hash },
  status: c.status,
  voidReason: c.void_reason,
});

/** PDF — 화면 밖에 A4 폭으로 그려서 뜬다 */
export const ContractPdfButton = ({ c, tone = "plain" }: { c: OpsContractFull; tone?: "plain" | "primary" | "dark" }) => {
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!busy) return;
    let alive = true;
    const t = window.setTimeout(async () => {
      try {
        const root = ref.current?.firstElementChild as HTMLElement | null;
        if (!root) throw new Error("계약서를 그리지 못했어요");
        const blob = await renderContractPdf(root, { title: `${c.doc.title} · ${c.doc.worker.name}`, footer: `문서 번호 ${c.id.slice(0, 8)}` });
        const how = await savePdf(blob, contractFileName(c.kind, c.worker_sign_name || c.doc.worker.name, c.doc.date));
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
        <FileDown className="h-5 w-5" /> {busy ? "PDF 만드는 중…" : c.status === "sent" ? "PDF (서명 전)" : "PDF 저장"}
      </OpsButton>
      {busy &&
        createPortal(
          <div ref={ref} aria-hidden style={{ position: "fixed", left: -12000, top: 0, width: 794, background: "#ffffff", pointerEvents: "none" }}>
            <OpsContractDoc {...docProps(c)} print />
          </div>,
          document.body,
        )}
    </>
  );
};

const OpsContractSheet = ({ id, onClose, stacked }: Props) => {
  const q = useOpsContract(id);
  const sign = useOpsContractSign();
  const voidM = useOpsContractVoid();
  const delivered = useOpsContractDelivered();
  const c = q.data;
  const [step, setStep] = useState<"view" | "sign">("view");
  const [inPerson, setInPerson] = useState(false);
  const [agree, setAgree] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [signImg, setSignImg] = useState<string | null>(null);
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState("");
  const bodyTop = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStep("view");
    setVoiding(false);
    setReason("");
  }, [id]);

  const startSign = (person: boolean) => {
    if (!c) return;
    setInPerson(person);
    setAgree(false);
    setName(c.doc.worker.name);
    setAddress("");
    setPhone("");
    setSignImg(null);
    setStep("sign");
    requestAnimationFrame(() => bodyTop.current?.scrollIntoView({ block: "start" }));
  };

  const submitSign = () => {
    if (!c || !signImg) return;
    sign.mutate(
      { id: c.id, hash: c.doc_hash, sign: signImg, name, address, phone, inPerson },
      {
        onSuccess: () => {
          toast.success(inPerson ? "서명을 받았어요" : "서명했어요 — 계약서는 언제든 여기서 볼 수 있어요");
          setStep("view");
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  const st = c ? CONTRACT_STATUS[c.status] : null;
  const waitingDelivery = !!c && c.can_manage && c.status === "signed" && !c.delivered_at;

  return (
    <OpsSheet
      open={!!id}
      onClose={onClose}
      title={c?.doc.title ?? "계약서"}
      sub={c ? `${c.doc.worker.name} · ${st?.label}` : undefined}
      stacked={stacked}
      footer={
        !c ? undefined : step === "sign" ? (
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <OpsButton tone="plain" onClick={() => setStep("view")} disabled={sign.isPending}>
              돌아가기
            </OpsButton>
            <OpsButton onClick={submitSign} disabled={!agree || !signImg || !name.trim() || sign.isPending}>
              {sign.isPending ? "서명하는 중…" : "서명하기"}
            </OpsButton>
          </div>
        ) : c.can_sign && c.is_worker ? (
          <OpsButton onClick={() => startSign(false)}>다 읽었어요 · 서명하기</OpsButton>
        ) : (
          <ContractPdfButton c={c} tone={c.status === "signed" ? "primary" : "plain"} />
        )
      }
    >
      <div ref={bodyTop} />
      {q.isLoading ? (
        <div className="space-y-3" aria-hidden>
          <div className="h-16 animate-pulse rounded-2xl bg-secondary" />
          <div className="h-96 animate-pulse rounded-2xl bg-secondary" />
        </div>
      ) : !c ? (
        <div className="py-8 text-center">
          <p className="text-body font-bold text-foreground">계약서를 열 수 없어요</p>
          <p className="mt-1 text-label text-muted-foreground">{(q.error as Error | null)?.message ?? "잠시 후 다시 시도해 주세요"}</p>
        </div>
      ) : step === "sign" ? (
        <>
          <p className="rounded-xl bg-secondary/70 px-3 py-2.5 text-label text-muted-foreground">
            {inPerson ? `${c.doc.worker.name}님이 이 휴대폰에 직접 서명해요` : "서명하면 대표님께 알림이 가고, 계약서는 언제든 여기서 보고 PDF 로 받을 수 있어요"}
          </p>
          <label className="mt-4 flex items-start gap-2.5 rounded-2xl border border-border p-3.5">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
            <span className="text-body text-foreground">계약서 내용을 모두 읽었고, 전자문서로 서명하고 받는 데 동의해요</span>
          </label>
          <OpsLabel>이름</OpsLabel>
          <input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} className={opsInput} autoComplete="name" />
          <OpsLabel>주소 (선택)</OpsLabel>
          <input value={address} onChange={(e) => setAddress(e.target.value.slice(0, 120))} className={opsInput} autoComplete="street-address" />
          <OpsLabel>연락처 (선택)</OpsLabel>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d-]/g, "").slice(0, 20))}
            className={opsInput}
            inputMode="tel"
            autoComplete="tel"
          />
          <OpsLabel>서명</OpsLabel>
          <OpsSignaturePad onChange={setSignImg} />
        </>
      ) : (
        <>
          {/* 상태 */}
          <div
            className={cn(
              "mb-3 rounded-2xl px-4 py-3",
              c.status === "signed" ? "bg-primary/10" : c.status === "sent" ? "bg-amber-50" : "bg-secondary/70",
            )}
          >
            <p className={cn("flex items-center gap-1.5 text-body font-black", c.status === "signed" ? "text-primary" : c.status === "sent" ? "text-amber-800" : "text-muted-foreground")}>
              {c.status === "signed" && <CheckCircle2 className="h-5 w-5" />}
              {c.status === "signed"
                ? `${krShortDay(c.signed_at)} 서명 완료`
                : c.status === "sent"
                  ? c.is_worker
                    ? "읽고 아래에서 서명해 주세요"
                    : "코치님 서명을 기다려요"
                  : "무효가 된 계약서예요"}
            </p>
            <p className="mt-0.5 text-label text-muted-foreground">
              {c.status === "signed"
                ? `${c.in_person ? "대면 서명" : "앱에서 본인 서명"} · ${krStamp(c.signed_at)}`
                : c.status === "sent"
                  ? `${krShortDay(c.sent_at)} 보냄${c.can_manage ? (c.has_app ? (c.viewed_at ? ` · ${krShortDay(c.viewed_at)} 읽음` : " · 아직 안 읽음") : " · 앱 계정 없음") : ""}`
                  : c.void_reason ?? ""}
            </p>
          </div>

          {/* 대면 서명 — 관리자 휴대폰에서 */}
          {c.can_manage && c.status === "sent" && (
            <div className="mb-3">
              <OpsButton tone="dark" onClick={() => startSign(true)}>
                지금 여기서 서명 받기
              </OpsButton>
              {c.has_app && <p className="mt-1.5 text-label text-muted-foreground">앱으로도 보냈어요 — 코치님이 앱에서 서명해도 돼요</p>}
            </div>
          )}

          {/* 사본 주기 — 앱 계정이 없는 분께 대면 서명을 받은 뒤 */}
          {waitingDelivery && (
            <div className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 p-3.5">
              <p className="text-body font-black text-amber-900">코치님께 사본을 주세요</p>
              <p className="mt-0.5 text-label text-amber-800">근로기준법 17조 — 아래 'PDF 저장'으로 카톡 · 문자로 보내거나 인쇄해서 드려요</p>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                {(["pdf", "paper"] as const).map((how) => (
                  <button
                    key={how}
                    type="button"
                    disabled={delivered.isPending}
                    onClick={() =>
                      delivered.mutate(
                        { id: c.id, how },
                        { onSuccess: () => toast.success("사본을 준 것으로 남겼어요"), onError: (e) => toast.error((e as Error).message) },
                      )
                    }
                    className="h-11 rounded-xl border border-amber-300 bg-white text-label font-black text-amber-900 active:scale-[0.98] disabled:opacity-50"
                  >
                    {how === "pdf" ? "PDF 로 보냈어요" : "종이로 줬어요"}
                  </button>
                ))}
              </div>
            </div>
          )}
          {c.can_manage && c.status === "signed" && c.delivered_at && (
            <p className="mb-3 text-label text-muted-foreground">
              사본 줌 · {c.delivered_how === "app" ? "앱" : c.delivered_how === "pdf" ? "PDF" : "종이"} · {krShortDay(c.delivered_at)}
            </p>
          )}

          <OpsContractDoc {...docProps(c)} />

          {/* 무효로 하기 */}
          {c.can_manage && c.status !== "void" && (
            <div className="mt-4">
              {voiding ? (
                <div className="rounded-2xl border border-destructive/30 p-3.5">
                  <OpsLabel>무효로 하는 까닭{c.status === "signed" ? "" : " (선택)"}</OpsLabel>
                  <input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 200))} className={opsInput} placeholder="예: 시급을 잘못 적음 · 새 계약서로" />
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <OpsButton tone="plain" onClick={() => setVoiding(false)}>
                      그만두기
                    </OpsButton>
                    <OpsButton
                      tone="danger"
                      disabled={voidM.isPending || (c.status === "signed" && reason.trim().length < 2)}
                      onClick={() =>
                        voidM.mutate(
                          { id: c.id, reason },
                          {
                            onSuccess: () => {
                              toast.success("무효로 했어요");
                              setVoiding(false);
                            },
                            onError: (e) => toast.error((e as Error).message),
                          },
                        )
                      }
                    >
                      무효로 하기
                    </OpsButton>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setVoiding(true)} className="w-full py-2 text-center text-label font-bold text-muted-foreground underline underline-offset-2">
                  이 계약서를 무효로 하기
                </button>
              )}
            </div>
          )}
        </>
      )}
    </OpsSheet>
  );
};

export default OpsContractSheet;
