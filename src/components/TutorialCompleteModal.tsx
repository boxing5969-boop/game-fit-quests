import { useEffect } from "react";
import confetti from "canvas-confetti";
import { Gem } from "lucide-react";

interface TutorialCompleteModalProps {
  open: boolean;
  onClose: () => void;
  /** Actually granted gem amount returned by the server RPC. */
  grantedGems: number;
}

/**
 * One-time celebration shown after complete_tutorial_once successfully
 * flips tutorial_reward_claimed. The overlay that triggered the mutation
 * unmounts as soon as profile.tutorial_completed flips true; this modal
 * is a separate sibling so the celebration survives the unmount.
 *
 * Spec copy (exact): "튜토리얼 완료! 🎉 1000젬을 획득했습니다"
 */
export const TutorialCompleteModal = ({
  open,
  onClose,
  grantedGems,
}: TutorialCompleteModalProps) => {
  useEffect(() => {
    if (!open) return;
    const end = Date.now() + 1500;
    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ["#E8553A", "#F5A623", "#FFD700"],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ["#E8553A", "#F5A623", "#FFD700"],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-complete-title"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-sm animate-bounce-in rounded-3xl bg-card p-8 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 text-6xl" aria-hidden>🎉</div>
        <h2
          id="tutorial-complete-title"
          className="text-xl font-bold text-foreground"
        >
          튜토리얼 완료! 🎉 {grantedGems}젬을 획득했습니다
        </h2>
        <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-reward/30 bg-reward/10 px-4 py-3 text-reward">
          <Gem className="h-5 w-5" />
          <span className="number-font text-lg font-bold">
            +{grantedGems}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-2xl bg-primary py-3.5 text-base font-bold text-primary-foreground shadow-glow-soft transition-all active:scale-[0.98]"
        >
          확인
        </button>
      </div>
    </div>
  );
};

export default TutorialCompleteModal;
