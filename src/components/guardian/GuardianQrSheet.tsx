/**
 * 데스크 「보호자 연결 QR」 — 어머님 · 아버님이 휴대폰 카메라로 찍으면 연결 화면이 열린다 (2026-11-23).
 * qrcode.react 는 'qr' 묶음이라 회원 상세가 미리 받지 않게 처음 열 때 따로 받는다(GuardianStaffSection 의 lazyWithRetry).
 * QR 은 늘 흰 바탕에 검은 점 — 어두운 화면 모드에서도 카메라가 잘 읽게.
 */
import { QRCodeSVG } from "qrcode.react";
import { Link2, X } from "lucide-react";
import { useModalDismiss } from "@/hooks/useModalDismiss";

interface Props {
  url: string;
  memberName: string;
  expiresText: string | null;
  needsAccept: boolean;
  onClose: () => void;
  onCopy: () => void;
}

const GuardianQrSheet = ({ url, memberName, expiresText, needsAccept, onClose, onCopy }: Props) => {
  useModalDismiss(true, onClose, { back: true });
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-background/85 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="보호자 연결 QR"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 className="text-heading text-foreground">보호자 연결 QR</h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col items-center overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-2">
          <div className="rounded-3xl bg-white p-4 shadow-elev-1 ring-1 ring-black/5">
            <QRCodeSVG value={url} size={240} level="M" marginSize={2} bgColor="#ffffff" fgColor="#000000" title="보호자 연결 링크" />
          </div>
          <p className="mt-4 text-center text-body font-bold text-foreground">{memberName} 회원의 보호자 연결</p>
          <p className="mt-1 text-center text-label text-muted-foreground [text-wrap:pretty]">
            어머님 · 아버님 휴대폰 카메라로 찍고 카카오로 시작하면 연결돼요.
            {needsAccept ? " 성인 회원이라 회원 본인이 앱에서 수락해야 이어져요." : ""}
          </p>
          {expiresText && <p className="mt-1 text-center text-label text-muted-foreground">{expiresText}까지 · 한 분만</p>}
          <button
            type="button"
            onClick={onCopy}
            className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-3 text-body font-bold text-foreground transition-all hover:bg-muted active:scale-[0.98]"
          >
            <Link2 className="h-4 w-4" />
            링크 복사 (문자로 보낼 때)
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuardianQrSheet;
