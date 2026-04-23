import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import confetti from "canvas-confetti";
import { Crown, Banknote, Sparkles } from "lucide-react";

interface TutorialCompleteModalProps {
  open: boolean;
  onClose: () => void;
  /** 합산 지급 금액 (단계별 즉시 보상 포함). 기본값 1000. */
  grantedGems: number;
}

/**
 * 입단식 완료 — 게임형 완료 팝업.
 *
 * Spec copy (정확히):
 *   "입단식 완료! 🎉"
 *   "당신은 이제 정식 챌린저입니다."
 *   "1000 파이트 머니 + 신입 챌린저 칭호 + 기본 이펙트를 획득했습니다."
 *
 * 메인 CTA: "첫 퀘스트 시작하기" → /missions
 */
export const TutorialCompleteModal = ({
  open,
  onClose,
  grantedGems,
}: TutorialCompleteModalProps) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const end = Date.now() + 1800;
    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 60,
        origin: { x: 0 },
        colors: ["#E8553A", "#F5A623", "#FFD700"],
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 60,
        origin: { x: 1 },
        colors: ["#E8553A", "#F5A623", "#FFD700"],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, [open]);

  if (!open) return null;

  const goToMissions = () => {
    onClose();
    navigate("/missions");
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/55 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-complete-title"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-sm animate-bounce-in rounded-3xl border border-reward/40 bg-gradient-to-br from-card via-card to-[hsl(42_92%_8%)] p-7 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 text-6xl" aria-hidden>🎉</div>
        <h2
          id="tutorial-complete-title"
          className="text-xl font-bold text-foreground"
        >
          입단식 완료!
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          당신은 이제 정식 챌린저입니다.
        </p>

        {/* 보상 3종 표시 */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center gap-2 rounded-2xl border border-reward/30 bg-reward/10 px-4 py-3 text-left">
            <Banknote className="h-5 w-5 shrink-0 text-reward" />
            <div className="flex-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-reward">파이트 머니</p>
              <p className="number-font text-base font-bold text-foreground">
                +{grantedGems.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-left">
            <Crown className="h-5 w-5 shrink-0 text-primary" />
            <div className="flex-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-primary">신규 칭호</p>
              <p className="text-base font-bold text-foreground">신입 챌린저</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-left">
            <Sparkles className="h-5 w-5 shrink-0 text-accent" />
            <div className="flex-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-accent">기본 이펙트</p>
              <p className="text-base font-bold text-foreground">반짝이</p>
            </div>
          </div>
        </div>

        {/* 보너스 안내 */}
        <p className="mt-4 rounded-xl border border-border bg-card/60 px-3 py-2 text-[11px] text-muted-foreground">
          🎁 보너스 — 오늘 첫 체크인을 완료하면 추가{" "}
          <b className="number-font text-reward">+300</b> 파이트 머니
        </p>

        {/* 메인 CTA + 닫기 */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-border bg-background py-3 text-sm font-semibold text-muted-foreground active:scale-[0.98]"
          >
            확인
          </button>
          <button
            type="button"
            onClick={goToMissions}
            className="col-span-2 rounded-2xl bg-gradient-to-r from-primary to-[hsl(13_85%_50%)] py-3 text-sm font-bold text-primary-foreground shadow-glow-soft active:scale-[0.98]"
          >
            첫 퀘스트 시작하기
          </button>
        </div>
      </div>
    </div>
  );
};

export default TutorialCompleteModal;
