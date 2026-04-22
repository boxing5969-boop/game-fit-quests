import { ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { DIET_HEALTH_DISCLAIMER } from "@/data/dietProgramData";
import { cn } from "@/lib/utils";

interface DietConsentGateProps {
  accepted: boolean;
  onChange: (next: boolean) => void;
  /** 청소년 트랙일 때 추가 한 줄을 보여주기 위한 표시용 플래그 */
  isYouth?: boolean;
  className?: string;
}

/**
 * 동의 / 안내 카드.
 *
 * 4줄의 보건 공시(DIET_HEALTH_DISCLAIMER) 노출 + 청소년이면 추가 안내.
 * 체크가 true 여야 온보딩 최종 제출이 가능하도록 부모가 게이트링.
 */
export const DietConsentGate = ({
  accepted,
  onChange,
  isYouth = false,
  className,
}: DietConsentGateProps) => {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-4 space-y-3",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-[13px] font-bold text-foreground">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <span>건강 및 안내사항</span>
      </div>

      <ul className="space-y-1.5 text-[12px] leading-relaxed text-muted-foreground">
        {DIET_HEALTH_DISCLAIMER.map((line) => (
          <li key={line} className="pl-3 -indent-3">
            <span className="mr-1 text-primary">·</span>
            {line}
          </li>
        ))}
        {isYouth && (
          <li className="pl-3 -indent-3">
            <span className="mr-1 text-primary">·</span>
            청소년 트랙은 식사 거르기·단식·극단적 제한을 포함하지 않습니다.
          </li>
        )}
      </ul>

      <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-primary/25 bg-primary/5 p-3 active:scale-[0.99] transition-transform">
        <Checkbox
          checked={accepted}
          onCheckedChange={(v) => onChange(v === true)}
          className="mt-0.5"
        />
        <span className="text-[12.5px] leading-relaxed text-foreground">
          위 안내 내용을 이해했으며, 일반 건강관리용 습관 프로그램으로 참여함에
          동의합니다.
        </span>
      </label>
    </div>
  );
};

export default DietConsentGate;
