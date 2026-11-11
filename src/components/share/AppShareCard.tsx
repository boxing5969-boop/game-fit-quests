/**
 * 설정 › 마이복서153 공유하기 (2026-11-12 대표님 「마이복서 153앱 공유기능 만들어줘 설정에」).
 *
 * 누구에게나 앱 링크 보내기 — ① 공유하기: 휴대폰 공유 창(카톡 · 문자 …)에 소개 글 + 링크 ② 링크 복사
 * ③ QR 보기: 옆 사람이 카메라로 찍으면 바로 열린다(데스크에서 새 회원에게 · 동료에게 보여 주기 — AppShareQrSheet).
 * 링크 = https://myboxer153.com/?inv=<내 초대 코드> (lib/appInvite — 코드를 못 받으면 코드 없이). 안드로이드 폰은 앱이 있으면 앱으로,
 * 없으면 구글 플레이 안내(AndroidAppGate)로 이어진다. 보상은 예전 규칙 그대로(운동 짝꿍 › 초대) — 이 카드에는 보상 말이 없다.
 */
import { Suspense, useState } from "react";
import { Link2, QrCode, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useMyInviteCode } from "@/hooks/useCornerman";
import { copyAppLink, shareAppLink } from "@/lib/appInvite";
import { icon3dSrc } from "@/lib/emoji3d/map";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

// QR 그리기(qrcode.react)는 'QR 보기'를 처음 누를 때 받는다 — 설정 화면이 QR 묶음을 미리 받지 않게
const AppShareQrSheet = lazyWithRetry(() => import("./AppShareQrSheet"));

const SUB_BTN =
  "flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-3 text-body font-bold text-foreground transition-all hover:bg-muted active:scale-[0.98] disabled:opacity-60";

const AppShareCard = () => {
  // 운동 짝꿍 초대와 같은 캐시 — 처음 한 번 서버가 코드를 만든다(승인 전 계정이면 없음 → 코드 없는 링크)
  const { data: code } = useMyInviteCode(true);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrLoaded, setQrLoaded] = useState(false); // 한 번 열면 닫을 때도 그대로 두어 닫히는 움직임이 보이게
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    if (sharing) return; // 공유 창이 열려 있는 동안 또 누르면 브라우저가 거절한다
    setSharing(true);
    try {
      const r = await shareAppLink(code);
      if (r === "copied") toast.success("소개 글과 링크를 복사했어요 · 카톡 대화창에 붙여 넣어 주세요");
      else if (r === "failed") toast.error("공유 창을 열지 못했어요 · 링크 복사를 눌러 주세요");
    } finally {
      setSharing(false);
    }
  };

  const handleCopy = async () => {
    if (await copyAppLink(code)) toast.success("링크를 복사했어요");
    else toast.error("복사하지 못했어요 · QR 보기 아래 링크를 길게 눌러 복사해 주세요");
  };

  const openQr = () => {
    setQrLoaded(true);
    setQrOpen(true);
  };

  return (
    <>
      <div className="animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-elev-1">
        <div className="mb-4 flex items-center gap-3">
          <img src={icon3dSrc("phone")} alt="" className="h-11 w-11 shrink-0 object-contain" />
          <div className="min-w-0">
            <h2 className="text-body font-bold text-foreground">마이복서153 공유하기</h2>
            <p className="mt-0.5 text-label text-muted-foreground">카톡 · 문자로 앱 링크를 보내요</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleShare}
          disabled={sharing}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-body font-bold text-primary-foreground shadow-md transition-all active:scale-[0.98] disabled:opacity-60"
        >
          <Share2 className="h-4 w-4" />
          공유하기
        </button>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" onClick={handleCopy} className={SUB_BTN}>
            <Link2 className="h-4 w-4" />
            링크 복사
          </button>
          <button type="button" onClick={openQr} className={SUB_BTN}>
            <QrCode className="h-4 w-4" />
            QR 보기
          </button>
        </div>
      </div>

      {qrLoaded && (
        <Suspense fallback={null}>
          <AppShareQrSheet
            open={qrOpen}
            code={code}
            sharing={sharing}
            onClose={() => setQrOpen(false)}
            onShare={handleShare}
            onCopy={handleCopy}
          />
        </Suspense>
      )}
    </>
  );
};

export default AppShareCard;
