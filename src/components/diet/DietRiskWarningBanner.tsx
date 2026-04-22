import { AlertTriangle } from "lucide-react";
import type { DietRiskFlags } from "@/lib/diet/ruleEngine";
import { hasAnyRisk } from "@/lib/diet/ruleEngine";
import { cn } from "@/lib/utils";

interface DietRiskWarningBannerProps {
  risk: DietRiskFlags;
  /** 청소년이면 별도 코치 상담 메시지 추가 */
  isYouth?: boolean;
  className?: string;
}

/**
 * 위험요인 중 하나라도 있으면 상단에 띄우는 안내 배너.
 * 사용자에게 "제한된 버전으로 진행" 임을 명시적으로 알리고
 * 전문가 상담을 권장.
 */
export const DietRiskWarningBanner = ({
  risk,
  isYouth = false,
  className,
}: DietRiskWarningBannerProps) => {
  if (!hasAnyRisk(risk) && !isYouth) return null;

  const reasons: string[] = [];
  if (risk.pregnancyBreastfeeding) reasons.push("임신·수유");
  if (risk.diabetesMedication) reasons.push("혈당 관리 중");
  if (risk.eatingDisorderRisk) reasons.push("섭식 관련 치료 경험");
  if (risk.otherConditions && risk.otherConditions.trim() !== "") {
    reasons.push("기타 건강 주의");
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-destructive/30 bg-destructive/10 p-3",
        "flex items-start gap-2.5",
        className,
      )}
      role="note"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div className="text-[12px] leading-relaxed text-foreground">
        <p className="font-bold text-destructive">맞춤 안전 모드로 진행합니다</p>
        {reasons.length > 0 && (
          <p className="mt-0.5 text-muted-foreground">
            체크한 항목: {reasons.join(" · ")}
          </p>
        )}
        <p className="mt-1 text-muted-foreground">
          단식·식사 거르기·극단적 제한 기능은 제공되지 않으며, 불편감이 있으면
          전문가 상담을 권해드립니다.
        </p>
        {isYouth && (
          <p className="mt-1 text-muted-foreground">
            청소년은 성장·건강 보호를 위해 습관 챌린지형으로만 진행합니다.
          </p>
        )}
      </div>
    </div>
  );
};

export default DietRiskWarningBanner;
