import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DIET_COACH_TEMPLATES,
  type CoachTemplateItem,
} from "@/data/diet/coachTemplates";

export type { CoachTemplateItem } from "@/data/diet/coachTemplates";

interface DietCoachTemplatePickerProps {
  selectedId: string | null;
  onPick: (item: CoachTemplateItem) => void;
  className?: string;
}

/**
 * 코치 메시지 템플릿 선택기.
 * 템플릿 본문 정의는 `src/data/diet/coachTemplates.ts`.
 */
export const DietCoachTemplatePicker = ({
  selectedId,
  onPick,
  className,
}: DietCoachTemplatePickerProps) => (
  <div className={cn("space-y-1.5", className)}>
    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      <MessageSquare className="h-3.5 w-3.5" />
      템플릿
    </p>
    <div className="grid grid-cols-1 gap-1.5">
      {DIET_COACH_TEMPLATES.map((t) => {
        const active = selectedId === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t)}
            className={cn(
              "rounded-xl border px-3 py-2 text-left transition-colors",
              active
                ? "border-primary bg-primary/10"
                : "border-border bg-card hover:border-primary/40",
            )}
          >
            <p
              className={cn(
                "text-[12.5px] font-bold",
                active ? "text-primary" : "text-foreground",
              )}
            >
              {t.label}
            </p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground leading-relaxed">
              {t.body}
            </p>
          </button>
        );
      })}
    </div>
  </div>
);

export default DietCoachTemplatePicker;
