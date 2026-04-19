import { useEffect } from "react";
import { CheckCircle2, Star, Flame } from "lucide-react";
import { formatRank } from "@/lib/rankLabels";

interface CheckinResult {
  xp_granted: number;
  is_duplicate: boolean;
  display_name: string;
  league: string;
  level: number;
}

interface CheckinSuccessModalProps {
  open: boolean;
  onClose: () => void;
  result: CheckinResult | null;
}

const RANK_COLORS: Record<string, string> = {
  white: "from-gray-100 to-gray-300",
  blue: "from-blue-400 to-blue-600",
  red: "from-red-400 to-red-600",
  black: "from-gray-700 to-gray-900",
};

const CheckinSuccessModal = ({ open, onClose, result }: CheckinSuccessModalProps) => {
  useEffect(() => {
    if (open) {
      const timer = setTimeout(onClose, 4000);
      return () => clearTimeout(timer);
    }
  }, [open, onClose]);

  if (!open || !result) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-sm animate-bounce-in rounded-3xl bg-card p-8 text-center shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {result.is_duplicate ? (
          <>
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-400/20 to-primary/20">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">다시 입장! 🥊</h2>
            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              <p>라이브보드에 다시 입장합니다</p>
              <p>오늘 도전을 다시 시작합니다</p>
            </div>
            <div className="mt-4 flex items-center justify-center gap-1 text-sm text-muted-foreground">
              <Flame className="h-4 w-4 text-primary" />
              <span>출석 XP는 이미 지급되었어요</span>
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-reward/20">
              <Star className="h-10 w-10 text-primary animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">출석 완료!</h2>
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="rounded-full bg-primary/10 px-4 py-1.5 text-lg font-bold text-primary">
                +{result.xp_granted}XP
              </span>
            </div>
            <div className={`mt-4 rounded-2xl bg-gradient-to-r ${RANK_COLORS[result.league] || RANK_COLORS.white} p-0.5`}>
              <div className="rounded-2xl bg-card px-4 py-3">
                <p className="text-sm font-bold text-foreground">{formatRank(result.league, result.level)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">오늘도 복싱 레벨업 중 🥊</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-center gap-1 text-sm text-muted-foreground">
              <Flame className="h-4 w-4 text-primary" />
              <span>꾸준한 출석이 레벨업의 핵심!</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CheckinSuccessModal;
