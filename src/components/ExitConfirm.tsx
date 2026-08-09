/**
 * 종료 확인 팝업 — 홈에서 안드로이드 뒤로가기를 눌렀을 때 한 번 물어본다.
 * 바로 꺼지면 회원이 실수로 앱을 나가게 되고, 하던 운동 기록·미션이 끊긴다.
 */
import { useEffect } from "react";
import { exitApp } from "@/lib/androidBackExit";

export default function ExitConfirm({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center bg-black/60 p-4 pb-[calc(env(safe-area-inset-bottom)+16px)] sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-white/10 text-2xl">🥊</div>
        <p className="text-center text-[16px] font-bold text-white">앱을 종료할까요?</p>
        <p className="mt-1.5 text-center text-[12.5px] leading-relaxed text-white/60">
          오늘 훈련 기록이 남아 있으면 저장했는지 확인해 주세요.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-white/10 py-3 text-[14px] font-bold text-white transition active:scale-[0.98]"
          >
            아니오
          </button>
          <button
            onClick={() => { onClose(); exitApp(); }}
            className="flex-1 rounded-xl bg-white py-3 text-[14px] font-bold text-zinc-900 transition active:scale-[0.98]"
          >
            예, 종료
          </button>
        </div>
      </div>
    </div>
  );
}
