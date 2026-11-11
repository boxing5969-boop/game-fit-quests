/**
 * 마이복서153 공유하기 › QR 보기 — 옆 사람이 카메라로 찍으면 앱 링크가 열린다 (2026-11-12, AppShareCard 에서 연다).
 *
 * qrcode.react 는 'qr' 묶음(QR 출석 스캐너와 같이 350KB 남짓)이라 설정 화면이 미리 받지 않게
 * 'QR 보기'를 처음 누를 때 이 파일을 따로 받는다(AppShareCard 의 lazyWithRetry).
 * QR 은 늘 흰 바탕에 검은 점 — 어두운 화면 모드에서도 카메라가 잘 읽게.
 */
import { AnimatePresence, motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { Link2, Share2, X } from "lucide-react";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { appLinkLabel, inviteLink } from "@/lib/appInvite";

// AppShareCard 의 보조 단추와 같은 모양 (이 파일을 그쪽에서 불러오면 QR 묶음이 설정 화면에 같이 실리므로 따로 둔다)
const SUB_BTN =
  "flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-3 text-body font-bold text-foreground transition-all hover:bg-muted active:scale-[0.98] disabled:opacity-60";

interface Props {
  open: boolean;
  code: string | undefined;
  sharing: boolean;
  onClose: () => void;
  onShare: () => void;
  onCopy: () => void;
}

const AppShareQrSheet = ({ open, code, sharing, onClose, onShare, onCopy }: Props) => {
  useModalDismiss(open, onClose);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-background/85 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="QR로 마이복서153 공유"
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
          >
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <h2 className="text-heading text-foreground">QR로 공유</h2>
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
                <QRCodeSVG
                  value={inviteLink(code)}
                  size={232}
                  level="M"
                  marginSize={2}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  title="마이복서153 링크"
                />
              </div>
              <p className="mt-4 text-center text-body font-bold text-foreground">카메라로 찍으면 마이복서153이 열려요</p>
              <p className="mt-1 select-all break-all text-center text-label text-muted-foreground">{appLinkLabel(code)}</p>
              <div className="mt-5 grid w-full grid-cols-2 gap-2">
                <button type="button" onClick={onCopy} className={SUB_BTN}>
                  <Link2 className="h-4 w-4" />
                  링크 복사
                </button>
                <button
                  type="button"
                  onClick={onShare}
                  disabled={sharing}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-primary py-3 text-body font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-60"
                >
                  <Share2 className="h-4 w-4" />
                  공유하기
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AppShareQrSheet;
