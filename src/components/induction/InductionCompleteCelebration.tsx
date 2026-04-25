import { useEffect, useState } from "react";
import { ArrowRight, Check, Banknote, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InductionRewardPreview } from "./InductionRewardPreview";
import { cn } from "@/lib/utils";
import { celebrationHaptic } from "@/lib/haptics";

interface InductionCompleteCelebrationProps {
  totalGems: number;
  /** 완료 버튼 — InductionCeremonyOverlay 가 /missions 로 네비게이션까지 처리. */
  onClose: () => void;
  className?: string;
}

/**
 * 입단식 완료 축하 카드 — 챔피언 벨트 공개식 톤.
 *
 * ── UX 구성 (위→아래, gap-3.5) ──────────────────────────────
 *   1. 체크 메달 (gradient primary→reward) + 뒤 링 펄스
 *   2. "CHAMPION OF THE DAY" 미니 캡스
 *   3. "입단식 완료! 🎉" 대제목 + 서브라인
 *   4. +N,NNN 젬 hero 카운트업 (골든 glow)
 *   5. 보상 4-tile 그리드 (celebrated 모드)
 *   6. 보상 recap — 작은 단일 라인
 *   7. 보너스 안내 박스 (🎁 미션 해금 + 체크인 +300젬)
 *   8. CTA "첫 퀘스트 시작하기 →"
 *
 * ── 밀도 ────────────────────────────────────────────────────
 *   gap-3.5 + p-5 로 전체 카드 높이 ~500px 이내. 대부분 모바일
 *   뷰포트에서 스크롤 없이 한 화면에 들어감. overflow-y-auto
 *   (overlay 레벨) 가 fallback 으로 동작.
 *
 * ── 중복 지급 방지 ──────────────────────────────────────────
 *   표시 전용 — 실제 보상은 상위 오버레이가 이미 RPC 로 지급 완료.
 *   카드 내부는 추가 RPC 호출 없음.
 */
export const InductionCompleteCelebration = ({
  totalGems,
  onClose,
  className,
}: InductionCompleteCelebrationProps) => {
  const [displayGems, setDisplayGems] = useState(0);

  useEffect(() => {
    // 마운트 시 1회 haptic.
    celebrationHaptic();

    // 젬 카운트업 — 1.2s easeOutCubic.
    const duration = 1200;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayGems(Math.round(totalGems * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [totalGems]);

  return (
    <div
      className={cn(
        "relative w-full max-w-[360px] overflow-hidden rounded-3xl",
        "bg-gradient-to-b from-card via-card to-card/95",
        "border border-reward/45 shadow-[0_0_64px_rgba(246,196,83,0.4)]",
        "animate-bounce-in",
        className,
      )}
      role="alertdialog"
      aria-labelledby="induction-complete-title"
    >
      {/* 상단 챔피언 벨트 라인 */}
      <div className="h-1.5 w-full bg-gradient-to-r from-reward via-primary to-reward" />

      <div className="flex flex-col gap-3.5 p-5">
        {/* 1. 체크 메달 + 펄스 링 */}
        <div className="flex justify-center pt-1">
          <div className="relative">
            <span
              className="absolute inset-0 rounded-full bg-reward/35 animate-ping"
              aria-hidden
            />
            <span
              className="absolute -inset-1 rounded-full bg-reward/20 blur-md"
              aria-hidden
            />
            <span
              className={cn(
                "relative flex h-16 w-16 items-center justify-center rounded-full",
                "bg-gradient-to-br from-reward via-reward to-primary",
                "text-primary-foreground shadow-[0_0_40px_rgba(246,196,83,0.6)]",
                "ring-4 ring-reward/30",
                "animate-bounce-in",
              )}
              aria-hidden
            >
              <Check className="h-9 w-9" strokeWidth={3.5} />
            </span>
          </div>
        </div>

        {/* 2 + 3. 타이틀 블록 */}
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-[10px] font-black uppercase tracking-[0.28em] text-reward">
            WELCOME TO 153
          </span>
          <h2
            id="induction-complete-title"
            className="text-2xl font-extrabold tracking-tight text-foreground"
          >
            시작 준비 완료 <span className="inline-block animate-bounce-in">🎉</span>
          </h2>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            오늘부터 당신의 모든 훈련이 기록됩니다.
          </p>
        </div>

        {/* 4. Hero 카운트업 */}
        <div
          className={cn(
            "flex items-baseline justify-center gap-1 rounded-2xl",
            "bg-gradient-to-br from-reward/30 via-reward/10 to-reward/30",
            "border border-reward/50 px-4 py-3",
            "shadow-[0_0_32px_rgba(246,196,83,0.4)]",
          )}
          aria-live="polite"
        >
          <Banknote className="h-6 w-6 self-center text-reward" />
          <span className="number-font text-[32px] font-black leading-none text-reward">
            +{displayGems.toLocaleString()}
          </span>
          <span className="text-sm font-bold text-reward/90">젬</span>
        </div>

        {/* 5. 보상 4-tile 그리드 */}
        <InductionRewardPreview totalGems={totalGems} celebrated />

        {/* 6. 보상 recap */}
        <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
          {totalGems.toLocaleString()}젬 · 신입 회원 배지 · 기본 이펙트 획득
        </p>

        {/* 7. 보너스 안내 */}
        <div className="flex items-start gap-2.5 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2.5">
          <span
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent"
            aria-hidden
          >
            <Gift className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 leading-tight">
            <div className="text-[12px] font-bold text-accent">
              보너스 훈련 해금
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              오늘 첫 체크인 시 추가{" "}
              <span className="font-bold text-reward">+300 파이트 머니</span>
            </div>
          </div>
        </div>

        {/* 8. CTA */}
        <Button
          onClick={onClose}
          className={cn(
            "h-12 w-full rounded-2xl font-bold tracking-wide",
            "bg-gradient-to-r from-primary via-primary to-primary/90",
            "text-primary-foreground hover:from-primary/95 hover:to-primary/85",
            "shadow-[0_8px_28px_-8px_rgba(217,54,32,0.8)]",
          )}
        >
          <span>첫 훈련 시작하기</span>
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default InductionCompleteCelebration;
