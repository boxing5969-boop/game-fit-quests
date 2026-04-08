import { useEffect } from "react";
import confetti from "canvas-confetti";
import { RANK_LABELS, RANK_ICONS, formatRank } from "@/lib/rankLabels";

interface RankUpCeremonyProps {
  isOpen: boolean;
  onClose: () => void;
  oldRank: string;
  newRank: string;
  memberName: string;
}

const RANK_COLORS: Record<string, string> = {
  white: "from-gray-300 to-gray-100",
  blue: "from-blue-500 to-blue-300",
  red: "from-red-500 to-red-300",
  black: "from-gray-900 to-gray-600",
};

const RankUpCeremony = ({ isOpen, onClose, oldRank, newRank, memberName }: RankUpCeremonyProps) => {
  useEffect(() => {
    if (isOpen) {
      const end = Date.now() + 3000;
      const frame = () => {
        confetti({ particleCount: 5, angle: 60, spread: 80, origin: { x: 0, y: 0.6 }, colors: ["#E8553A", "#F5A623", "#FFD700", "#4CAF50"] });
        confetti({ particleCount: 5, angle: 120, spread: 80, origin: { x: 1, y: 0.6 }, colors: ["#E8553A", "#F5A623", "#FFD700", "#4CAF50"] });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/50 backdrop-blur-md">
      <div className="mx-4 w-full max-w-sm animate-bounce-in space-y-6 rounded-3xl bg-card p-8 text-center shadow-2xl">
        <div className="flex items-center justify-center gap-4">
          <div className="text-4xl opacity-50">{RANK_ICONS[oldRank]}</div>
          <span className="text-2xl">→</span>
          <div className="text-5xl animate-pulse">{RANK_ICONS[newRank]}</div>
        </div>

        <h2 className="text-2xl text-foreground">🏆 승급 완료!</h2>

        <p className="text-lg font-bold text-primary">
          {RANK_LABELS[newRank]} 랭크 획득
        </p>

        <div className={`mx-auto rounded-2xl bg-gradient-to-b ${RANK_COLORS[newRank] || "from-primary to-accent"} p-6 text-center shadow-lg`}>
          <p className="text-xs text-white/70 mb-2">153랭크업 시스템 인증서</p>
          <p className="text-lg font-bold text-white">{memberName}</p>
          <div className="my-3 text-4xl">{RANK_ICONS[newRank]}</div>
          <p className="text-sm font-bold text-white">{RANK_LABELS[newRank]} 랭크</p>
          <p className="mt-1 text-xs text-white/70">
            {new Date().toLocaleDateString("ko-KR")} 달성
          </p>
          <div className="mt-3 border-t border-white/20 pt-2">
            <p className="text-[10px] text-white/50">153랭크업 시스템</p>
          </div>
        </div>

        <button onClick={onClose} className="w-full rounded-xl bg-primary py-3.5 text-base font-bold text-primary-foreground shadow-md transition-all active:scale-[0.98]">
          새로운 도전을 시작합니다 🥊
        </button>
      </div>
    </div>
  );
};

export default RankUpCeremony;
