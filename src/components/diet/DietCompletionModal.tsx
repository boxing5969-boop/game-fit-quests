import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Award, PartyPopper, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { celebrationHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

interface DietCompletionModalProps {
  open: boolean;
  approvedDays: number;
  bestStreak: number;
  onClose: () => void;
  onChoosePlan?: () => void;
  className?: string;
}

/**
 * 153 다이어트 21일 완주 축하 모달.
 *
 * 톤: 체중·감량 언급 없이 "습관이 바뀐 21일" 프레임.
 * 푸시 없음 — portal + celebrationHaptic 으로 경량 연출.
 * 재노출 방지는 호출부(Hub) 가 localStorage 로 관리.
 */
export const DietCompletionModal = ({
  open,
  approvedDays,
  bestStreak,
  onClose,
  onChoosePlan,
  className,
}: DietCompletionModalProps) => {
  useEffect(() => {
    if (open) celebrationHaptic();
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[72] flex items-center justify-center p-4",
        "bg-background/80 backdrop-blur-sm animate-fade-in",
        className,
      )}
      role="alertdialog"
      aria-labelledby="diet-completion-title"
    >
      <div
        className={cn(
          "w-full max-w-[360px] overflow-hidden rounded-3xl",
          "border border-reward/40 bg-card",
          "shadow-[0_0_56px_rgba(246,196,83,0.4)]",
          "animate-bounce-in",
        )}
      >
        <div className="h-1 w-full bg-gradient-to-r from-reward via-primary to-reward" />
        <div className="flex flex-col gap-4 p-6">
          {/* 배지 링 */}
          <div className="flex justify-center">
            <div className="relative">
              <span
                className="absolute inset-0 rounded-full bg-reward/30 animate-ping"
                aria-hidden
              />
              <span
                className={cn(
                  "relative flex h-16 w-16 items-center justify-center rounded-full",
                  "bg-gradient-to-br from-reward via-reward to-primary",
                  "text-primary-foreground shadow-[0_0_36px_rgba(246,196,83,0.55)]",
                  "animate-bounce-in",
                )}
                aria-hidden
              >
                <PartyPopper className="h-8 w-8" />
              </span>
            </div>
          </div>

          {/* 타이틀 + 서브 */}
          <div className="text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-reward">
              21-DAY CHALLENGE COMPLETE
            </p>
            <h2
              id="diet-completion-title"
              className="mt-1 text-2xl font-extrabold text-foreground"
            >
              21일 습관 리셋, 완주했어요!
            </h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
              체중보다 먼저 바뀐 건 리듬입니다. 이 페이스를 유지해 볼까요?
            </p>
          </div>

          {/* 요약 2-pill */}
          <div className="grid grid-cols-2 gap-2">
            <StatTile icon={<Award />} label="승인된 일수" value={`${approvedDays}일`} />
            <StatTile icon={<Sparkles />} label="최고 스트릭" value={`${bestStreak}일`} />
          </div>

          {/* 보상 안내 */}
          <div className="rounded-xl border border-reward/30 bg-reward/10 px-3 py-2.5 text-[12px] leading-relaxed text-foreground">
            <p className="font-bold text-reward-foreground">
              🏅 21일 완주 배지 + 보너스 50젬
            </p>
            <p className="mt-0.5 text-muted-foreground">
              지갑과 내 배지에 자동 반영되었어요.
            </p>
          </div>

          {/* CTA */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="h-11 rounded-2xl px-4"
            >
              <X className="mr-1 h-4 w-4" />
              나중에
            </Button>
            <Button
              onClick={() => {
                onChoosePlan?.();
                onClose();
              }}
              className={cn(
                "ml-auto h-11 flex-1 rounded-2xl font-bold tracking-wide",
                "bg-gradient-to-r from-primary to-primary/85 text-primary-foreground",
                "shadow-[0_6px_22px_-6px_rgba(217,54,32,0.7)]",
              )}
            >
              유지 플랜 고르기
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

const StatTile = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => (
  <div className="rounded-xl border border-border bg-card p-3 text-center">
    <span className="mx-auto flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
      {icon}
    </span>
    <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
    <p className="mt-0.5 number-font text-[15px] font-extrabold text-foreground">
      {value}
    </p>
  </div>
);

export default DietCompletionModal;
