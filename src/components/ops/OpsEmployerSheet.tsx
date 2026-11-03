/**
 * 계약서 — 사업주 정보 · 대표님 서명 (2026-11-03) — 지점마다 처음 한 번. 대표님만 바꾼다(회계매니저는 보기만).
 *   서명은 손가락으로 그리거나 도장 사진을 올린다 → 계약서를 보낼 때마다 그대로 들어간다(보낸 계약서는 그때 서명 그대로).
 */
import { useEffect, useRef, useState } from "react";
import { ImageUp } from "lucide-react";
import { toast } from "sonner";

import type { ContractEmployer } from "@/lib/opsContract";
import { useOpsEmployerSave } from "@/services/opsContractService";
import { shortBranch } from "@/services/opsService";
import OpsSignaturePad from "./OpsSignaturePad";
import { OpsButton, OpsChip, OpsLabel, OpsSheet, opsInput } from "./OpsParts";

interface Props {
  open: boolean;
  onClose: () => void;
  branch: string;
  employer: ContractEmployer | null;
  /** 대표님 — 바꿀 수 있다 */
  canEdit: boolean;
  stacked?: boolean;
}

/** 올린 사진 → 긴 변 360px PNG */
const imageToPng = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    if (!file.type.startsWith("image/")) return rej(new Error("사진 파일을 골라 주세요"));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 360 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * k));
      c.height = Math.max(1, Math.round(img.height * k));
      c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rej(new Error("사진을 읽지 못했어요"));
    };
    img.src = url;
  });

const OpsEmployerSheet = ({ open, onClose, branch, employer, canEdit, stacked }: Props) => {
  const save = useOpsEmployerSave();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ biz_name: "", owner_name: "", biz_number: "", address: "", phone: "" });
  const [signMode, setSignMode] = useState<"keep" | "draw">("keep");
  const [sign, setSign] = useState<string | null>(null);
  /** 새 서명을 어떻게 — 손가락으로 그림 · 도장 사진 */
  const [source, setSource] = useState<"pad" | "photo">("pad");

  useEffect(() => {
    if (!open) return;
    setForm({
      biz_name: employer?.biz_name || branch,
      owner_name: employer?.owner_name ?? "",
      biz_number: employer?.biz_number ?? "",
      address: employer?.address ?? "",
      phone: employer?.phone ?? "",
    });
    setSignMode(employer?.sign ? "keep" : "draw");
    setSign(null);
    setSource("pad");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.biz_name.trim()) return toast.error("사업체명을 넣어 주세요");
    if (!form.owner_name.trim()) return toast.error("대표자 이름을 넣어 주세요");
    if (signMode === "draw" && !sign) return toast.error("대표님 서명을 그려 주세요");
    save.mutate(
      { branch, ...form, ...(signMode === "draw" && sign ? { sign } : {}) },
      {
        onSuccess: () => {
          toast.success("사업주 정보를 저장했어요");
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  const field = (k: keyof typeof form, label: string, placeholder: string, max: number, inputMode?: "tel" | "numeric") => (
    <>
      <OpsLabel>{label}</OpsLabel>
      <input
        value={form[k]}
        onChange={(e) => set(k, e.target.value.slice(0, max))}
        className={opsInput}
        placeholder={placeholder}
        inputMode={inputMode}
        disabled={!canEdit}
      />
    </>
  );

  return (
    <OpsSheet
      open={open}
      onClose={onClose}
      title="사업주 정보"
      sub={`${shortBranch(branch)} · 계약서 맨 아래 사업주 칸`}
      stacked={stacked}
      footer={
        canEdit ? (
          <OpsButton onClick={submit} disabled={save.isPending}>
            저장
          </OpsButton>
        ) : undefined
      }
    >
      {!canEdit && (
        <p className="mb-3 rounded-xl bg-secondary/70 px-3 py-2.5 text-label text-muted-foreground">사업주 정보와 서명은 대표님만 바꿔요</p>
      )}
      {field("biz_name", "사업체명", "153복싱짐 선릉역점", 60)}
      {field("owner_name", "대표자", "대표님 이름", 30)}
      {field("biz_number", "사업자등록번호", "000-00-00000", 20, "numeric")}
      {field("address", "주소", "사업장 주소", 120)}
      {field("phone", "전화", "02-000-0000", 30, "tel")}

      <OpsLabel>대표님 서명</OpsLabel>
      {employer?.sign && (
        <div className="mb-2 flex gap-1.5">
          <OpsChip on={signMode === "keep"} onClick={() => setSignMode("keep")} disabled={!canEdit}>
            지금 서명 그대로
          </OpsChip>
          <OpsChip on={signMode === "draw"} onClick={() => setSignMode("draw")} disabled={!canEdit}>
            새로 그리기
          </OpsChip>
        </div>
      )}
      {signMode === "keep" && employer?.sign ? (
        <div className="flex h-24 items-center justify-center rounded-2xl border border-border bg-white">
          <img src={employer.sign} alt="대표님 서명" className="max-h-20 max-w-[70%] object-contain" />
        </div>
      ) : canEdit ? (
        <>
          {source === "photo" && sign ? (
            <div className="flex h-28 items-center justify-center rounded-2xl border border-border bg-white">
              <img src={sign} alt="도장" className="max-h-24 max-w-[70%] object-contain" />
            </div>
          ) : (
            <OpsSignaturePad onChange={setSign} label="대표님 서명을 그려 주세요" />
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                setSign(await imageToPng(f));
                setSource("photo");
              } catch (err) {
                toast.error((err as Error).message);
              }
              e.target.value = "";
            }}
          />
          <div className="mt-1 flex gap-1.5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-10 items-center gap-1.5 rounded-full bg-secondary px-3 text-label font-bold text-foreground active:scale-95"
            >
              <ImageUp className="h-4 w-4" /> 도장 사진 올리기
            </button>
            {source === "photo" && (
              <button
                type="button"
                onClick={() => {
                  setSign(null);
                  setSource("pad");
                }}
                className="flex h-10 items-center rounded-full bg-secondary px-3 text-label font-bold text-foreground active:scale-95"
              >
                손으로 그리기
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="text-label text-muted-foreground">아직 서명이 없어요</p>
      )}
      <p className="mt-3 text-label text-muted-foreground">보낸 계약서에는 보낼 때의 정보 · 서명이 그대로 남아요</p>
    </OpsSheet>
  );
};

export default OpsEmployerSheet;
