import { useEffect } from "react";
import confetti from "canvas-confetti";

interface LevelUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  newLevel: number;
  newRank: string;
  xpGranted: number;
}

const RANK_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };
const RANK_ICONS: Record<string, string> = { white: "⚪", blue: "🔵", red: "🔴", black: "⚫" };

const LevelUpModal = ({ isOpen, onClose, newLevel, newRank, xpGranted }: LevelUpModalProps) => {
  useEffect(() => {
    if (isOpen) {
      // Fire confetti
      const duration = 2000;
      const end = Date.now() + duration;
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
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-4 w-full max-w-sm animate-bounce-in rounded-3xl bg-card p-8 text-center shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 text-6xl">{RANK_ICONS[newRank] || "🥊"}</div>
        <h2 className="mb-2 text-2xl text-foreground">레벨 업! 🎉</h2>
        <p className="text-lg text-primary font-bold">
          {RANK_LABELS[newRank]} Lv.{newLevel}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">+{xpGranted} XP 획득!</p>
        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-primary py-3.5 text-base font-bold text-primary-foreground shadow-md transition-all active:scale-[0.98]"
          >
            계속 도전하기 🥊
          </button>
        </div>
      </div>
    </div>
  );
};

export default LevelUpModal;
